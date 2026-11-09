// API del Módulo de Gestión de Eventos en Cloudflare Workers + D1.
// Tiene las mismas 11 rutas y reglas que la versión Node/Express (Modulo_Eventos/).
// Las páginas (HTML, CSS, JS) las sirve Cloudflare desde Modulo_Eventos/public;
// este Worker solo responde las rutas /api/*.
import { verificarPassword, firmarToken, verificarToken } from './seguridad.js';

// Hora de Colombia (UTC-5), en el mismo formato en que se guardan los eventos: AAAA-MM-DDTHH:MM
const AHORA = "strftime('%Y-%m-%dT%H:%M','now','-5 hours')";
const ahoraColombia = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16);

// ---------- Utilidades de respuesta ----------
const json = (datos, estado = 200) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const error = (estado, mensaje, extra = {}) => json({ mensaje, ...extra }, estado);

async function leerCuerpo(request) {
  try { return await request.json(); } catch { return {}; }
}

// ---------- Sesión y roles (equivale a middleware/auth.js) ----------
async function usuarioDe(request, env) {
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return null;
  return verificarToken(h.slice(7), env.JWT_SECRET); // { id, rol } o null
}

async function exigir(request, env, roles) {
  const usuario = await usuarioDe(request, env);
  if (!usuario) {
    const h = request.headers.get('Authorization');
    return { respuesta: error(401, h ? 'Sesión inválida o expirada.' : 'Debes iniciar sesión.') };
  }
  if (roles && !roles.includes(usuario.rol)) return { respuesta: error(403, 'No tienes permiso.') };
  return { usuario };
}

// ---------- Validación de eventos (CU-03 flujo alterno A1) ----------
function validarEvento(body, { exigirFuturo }) {
  const errores = {};
  const texto = v => (typeof v === 'string' ? v.trim() : '');
  const datos = {
    nombre: texto(body.nombre),
    categoria: texto(body.categoria),
    descripcion: texto(body.descripcion),
    fecha_hora: texto(body.fecha_hora),
    lugar: texto(body.lugar),
    cupo_maximo: Number(body.cupo_maximo),
    imagen_url: texto(body.imagen_url) || null,
    organizador: texto(body.organizador) || null,
  };
  if (!datos.nombre) errores.nombre = 'El nombre es obligatorio.';
  if (!['deportivo', 'cultural'].includes(datos.categoria)) errores.categoria = 'Selecciona una categoría.';
  if (!datos.descripcion) errores.descripcion = 'La descripción es obligatoria.';
  if (!datos.lugar) errores.lugar = 'El lugar es obligatorio.';
  if (!Number.isInteger(datos.cupo_maximo) || datos.cupo_maximo < 1)
    errores.cupo_maximo = 'El cupo debe ser un número entero mayor que 0.';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(datos.fecha_hora) || isNaN(new Date(datos.fecha_hora)))
    errores.fecha_hora = 'Ingresa una fecha y hora válidas.';
  else if (exigirFuturo && datos.fecha_hora < ahoraColombia())
    errores.fecha_hora = 'La fecha ya pasó: no admitiría inscripciones (RN-04).';
  return { errores, datos };
}
const hayErrores = errores => Object.keys(errores).length > 0;
const responderErrores = errores =>
  error(400, 'Datos incompletos o inválidos. Corrige los campos marcados.', { errores });

// ---------- Rutas ----------

// POST /api/auth/login (RF-01)
async function login(request, env) {
  const { correo, password } = await leerCuerpo(request);
  if (!correo || !password) return error(400, 'Correo y contraseña son obligatorios.');
  const u = await env.DB.prepare('SELECT * FROM usuarios WHERE correo = ?').bind(String(correo).trim().toLowerCase()).first();
  if (!u || !(await verificarPassword(password, u.password_hash))) return error(401, 'Credenciales incorrectas.');
  const token = await firmarToken({ id: u.id, rol: u.rol }, env.JWT_SECRET);
  return json({ token, usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol } });
}

// GET /api/auth/yo
async function yo(request, env) {
  const { usuario, respuesta } = await exigir(request, env);
  if (respuesta) return respuesta;
  const u = await env.DB.prepare('SELECT id,nombre,correo,rol FROM usuarios WHERE id = ?').bind(usuario.id).first();
  return u ? json(u) : error(404, 'El usuario no existe.');
}

// GET /api/eventos?categoria=&fecha=  (RF-03, RF-04, RF-06). Con ?todos=1, solo administrador.
async function listarEventos(request, env, url) {
  const categoria = url.searchParams.get('categoria');
  const fecha = url.searchParams.get('fecha');
  const todos = url.searchParams.get('todos');
  if (todos) {
    const { respuesta } = await exigir(request, env, ['administrador']);
    if (respuesta) return respuesta;
  }
  let sql = 'SELECT *, cupo_maximo - cupos_disponibles AS inscritos FROM v_eventos_cupos WHERE 1=1';
  const p = [];
  if (!todos) sql += ` AND estado='activo' AND fecha_hora >= ${AHORA}`;
  if (categoria) { sql += ' AND categoria = ?'; p.push(categoria); }
  if (fecha) { sql += ' AND substr(fecha_hora,1,10) = ?'; p.push(fecha); }
  sql += ' ORDER BY fecha_hora';
  const { results } = await env.DB.prepare(sql).bind(...p).all();
  return json(results);
}

// GET /api/eventos/:id (RF-05, RF-06)
async function detalleEvento(env, id) {
  const ev = await env.DB.prepare(`SELECT *, cupo_maximo - cupos_disponibles AS inscritos,
      fecha_hora < ${AHORA} AS pasado
    FROM v_eventos_cupos WHERE id=? AND estado='activo'`).bind(id).first();
  return ev ? json(ev) : error(404, 'El evento no existe.');
}

// POST /api/eventos (admin, RF-14)
async function crearEvento(request, env) {
  const { usuario, respuesta } = await exigir(request, env, ['administrador']);
  if (respuesta) return respuesta;
  const { errores, datos: d } = validarEvento(await leerCuerpo(request), { exigirFuturo: true });
  if (hayErrores(errores)) return responderErrores(errores);
  const r = await env.DB.prepare(`INSERT INTO eventos
      (nombre,categoria,descripcion,fecha_hora,lugar,cupo_maximo,imagen_url,organizador,creado_por)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(d.nombre, d.categoria, d.descripcion, d.fecha_hora, d.lugar, d.cupo_maximo, d.imagen_url, d.organizador, usuario.id).run();
  return json({ id: r.meta.last_row_id, mensaje: 'Evento publicado.' }, 201);
}

// PUT /api/eventos/:id (admin, RF-14)
async function editarEvento(request, env, id) {
  const { respuesta } = await exigir(request, env, ['administrador']);
  if (respuesta) return respuesta;
  const actual = await env.DB.prepare('SELECT id FROM eventos WHERE id=?').bind(id).first();
  if (!actual) return error(404, 'El evento no existe.');
  const { errores, datos: d } = validarEvento(await leerCuerpo(request), { exigirFuturo: false });
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id=? AND estado='activa'").bind(id).first();
  if (!errores.cupo_maximo && d.cupo_maximo < n)
    errores.cupo_maximo = `El cupo no puede ser menor que las ${n} inscripciones activas.`;
  if (hayErrores(errores)) return responderErrores(errores);
  await env.DB.prepare(`UPDATE eventos SET nombre=?,categoria=?,descripcion=?,fecha_hora=?,
      lugar=?,cupo_maximo=?,imagen_url=?,organizador=? WHERE id=?`)
    .bind(d.nombre, d.categoria, d.descripcion, d.fecha_hora, d.lugar, d.cupo_maximo, d.imagen_url, d.organizador, id).run();
  return json({ mensaje: 'Evento actualizado.' });
}

// DELETE /api/eventos/:id (admin, RF-14): sale del catálogo, se conservan las inscripciones
async function bajaEvento(request, env, id) {
  const { respuesta } = await exigir(request, env, ['administrador']);
  if (respuesta) return respuesta;
  const r = await env.DB.prepare("UPDATE eventos SET estado='baja' WHERE id=? AND estado='activo'").bind(id).run();
  return r.meta.changes ? json({ mensaje: 'Evento dado de baja.' }) : error(404, 'El evento no existe o ya fue dado de baja.');
}

// GET /api/eventos/:id/inscritos (admin, RF-13)
async function inscritos(request, env, id) {
  const { respuesta } = await exigir(request, env, ['administrador']);
  if (respuesta) return respuesta;
  const ev = await env.DB.prepare('SELECT id,nombre,fecha_hora,lugar,cupo_maximo,estado FROM eventos WHERE id=?').bind(id).first();
  if (!ev) return error(404, 'El evento no existe.');
  const { results } = await env.DB.prepare(`SELECT u.nombre,u.correo,u.rol,i.fecha_inscripcion
      FROM inscripciones i JOIN usuarios u ON u.id=i.usuario_id
      WHERE i.evento_id=? AND i.estado='activa' ORDER BY i.fecha_inscripcion`).bind(id).all();
  return json({ evento: ev, cantidad: results.length, inscritos: results });
}

// POST /api/eventos/:id/inscripcion (RF-07 a RF-10, RN-01 a RN-04)
// D1 no permite transacciones interactivas, así que la verificación del cupo y el registro
// se hacen en UNA sola sentencia INSERT ... SELECT, que SQLite ejecuta de forma atómica.
// Así nunca hay sobrecupos aunque muchas personas pidan el último cupo al mismo tiempo (RNF-03).
async function inscribirse(request, env, id) {
  const { usuario, respuesta } = await exigir(request, env, ['estudiante', 'docente']);
  if (respuesta) return respuesta;
  let r;
  try {
    r = await env.DB.prepare(`INSERT INTO inscripciones (usuario_id, evento_id)
      SELECT ?1, e.id FROM eventos e
      WHERE e.id = ?2 AND e.estado = 'activo' AND e.fecha_hora >= ${AHORA}
        AND (SELECT COUNT(*) FROM inscripciones i WHERE i.evento_id = e.id AND i.estado = 'activa') < e.cupo_maximo
        AND NOT EXISTS (SELECT 1 FROM inscripciones i WHERE i.evento_id = e.id AND i.usuario_id = ?1 AND i.estado = 'activa')`)
      .bind(usuario.id, id).run();
  } catch (e) {
    if (!String(e.message).includes('UNIQUE')) throw e;
    r = { meta: { changes: 0 } };
  }
  const ev = await env.DB.prepare(`SELECT estado, cupos_disponibles, fecha_hora < ${AHORA} AS pasado FROM v_eventos_cupos WHERE id=?`).bind(id).first();
  if (r.meta.changes) return json({ mensaje: 'Inscripción exitosa.', cupos_disponibles: ev.cupos_disponibles }, 201);

  // No se insertó: se explica el motivo
  if (!ev || ev.estado !== 'activo') return error(404, 'El evento no existe.');
  if (ev.pasado) return error(409, 'El evento ya pasó.');
  const ya = await env.DB.prepare("SELECT 1 FROM inscripciones WHERE evento_id=? AND usuario_id=? AND estado='activa'").bind(id, usuario.id).first();
  if (ya) return error(409, 'Ya estás inscrito en este evento.');
  return error(409, 'Cupo agotado.');
}

// DELETE /api/eventos/:id/inscripcion (RF-12, RN-07)
async function cancelarInscripcion(request, env, id) {
  const { usuario, respuesta } = await exigir(request, env, ['estudiante', 'docente']);
  if (respuesta) return respuesta;
  const r = await env.DB.prepare(`UPDATE inscripciones SET estado='cancelada', fecha_cancelacion=datetime('now')
    WHERE usuario_id=? AND evento_id=? AND estado='activa'`).bind(usuario.id, id).run();
  return r.meta.changes ? json({ mensaje: 'Inscripción cancelada.' }) : error(404, 'No tienes inscripción activa.');
}

// GET /api/mis-inscripciones (RF-11)
async function misInscripciones(request, env) {
  const { usuario, respuesta } = await exigir(request, env, ['estudiante', 'docente']);
  if (respuesta) return respuesta;
  const { results } = await env.DB.prepare(`SELECT e.id,e.nombre,e.categoria,e.fecha_hora,e.lugar,e.estado AS estado_evento,
      e.fecha_hora < ${AHORA} AS pasado, i.fecha_inscripcion
    FROM inscripciones i JOIN eventos e ON e.id=i.evento_id
    WHERE i.usuario_id=? AND i.estado='activa' ORDER BY e.fecha_hora`).bind(usuario.id).all();
  return json(results);
}

// ---------- Enrutador ----------
async function api(request, env, url) {
  const m = request.method;
  const ruta = url.pathname.replace(/\/+$/, '');
  let x;

  if (ruta === '/api/auth/login' && m === 'POST') return login(request, env);
  if (ruta === '/api/auth/yo' && m === 'GET') return yo(request, env);
  if (ruta === '/api/mis-inscripciones' && m === 'GET') return misInscripciones(request, env);
  if (ruta === '/api/eventos') {
    if (m === 'GET') return listarEventos(request, env, url);
    if (m === 'POST') return crearEvento(request, env);
  }
  if ((x = ruta.match(/^\/api\/eventos\/(\d+)$/))) {
    const id = Number(x[1]);
    if (m === 'GET') return detalleEvento(env, id);
    if (m === 'PUT') return editarEvento(request, env, id);
    if (m === 'DELETE') return bajaEvento(request, env, id);
  }
  if ((x = ruta.match(/^\/api\/eventos\/(\d+)\/inscripcion$/))) {
    if (m === 'POST') return inscribirse(request, env, Number(x[1]));
    if (m === 'DELETE') return cancelarInscripcion(request, env, Number(x[1]));
  }
  if ((x = ruta.match(/^\/api\/eventos\/(\d+)\/inscritos$/)) && m === 'GET') return inscritos(request, env, Number(x[1]));

  return error(404, 'Ruta no encontrada.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      // La portada "/" muestra el catálogo (index.html)
      if (url.pathname.endsWith('/')) {
        url.pathname += 'index.html';
        return env.ASSETS.fetch(new Request(url, request));
      }
      return env.ASSETS.fetch(request);
    }
    if (!env.JWT_SECRET) return error(500, 'Falta configurar JWT_SECRET en Cloudflare.');
    try {
      return await api(request, env, url);
    } catch (e) {
      console.error(e);
      return error(500, 'Error interno del servidor.');
    }
  },
};
