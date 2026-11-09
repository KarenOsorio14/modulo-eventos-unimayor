const router = require('express').Router();
const db = require('../db');
const { verificarSesion, soloRol } = require('../middleware/auth');

// Fecha y hora actual en el mismo formato en que se guardan los eventos (AAAA-MM-DDTHH:MM)
const AHORA = "strftime('%Y-%m-%dT%H:%M','now','localtime')";
const soloAdmin = [verificarSesion, soloRol('administrador')];

// Valida los datos de un evento (CU-03 flujo alterno A1). Devuelve { errores, datos }.
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
  const fecha = new Date(datos.fecha_hora);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(datos.fecha_hora) || isNaN(fecha))
    errores.fecha_hora = 'Ingresa una fecha y hora válidas.';
  else if (exigirFuturo && fecha < new Date())
    errores.fecha_hora = 'La fecha ya pasó: no admitiría inscripciones (RN-04).';
  return { errores, datos };
}

const responderErrores = (res, errores) =>
  res.status(400).json({ mensaje: 'Datos incompletos o inválidos. Corrige los campos marcados.', errores });

// Listar eventos (RF-03, RF-04, RF-06).
// Público: solo vigentes. Con ?todos=1 (solo administrador): todos, incluidos los pasados y dados de baja.
router.get('/', (req, res, next) => {
  if (req.query.todos) return verificarSesion(req, res, () => soloRol('administrador')(req, res, next));
  next();
}, (req, res) => {
  const { categoria, fecha, todos } = req.query;
  let sql = `SELECT *, cupo_maximo - cupos_disponibles AS inscritos FROM v_eventos_cupos WHERE 1=1`;
  const p = [];
  if (!todos) sql += ` AND estado='activo' AND fecha_hora >= ${AHORA}`;
  if (categoria) { sql += ' AND categoria = ?'; p.push(categoria); }
  if (fecha)     { sql += ' AND substr(fecha_hora,1,10) = ?'; p.push(fecha); }
  sql += ' ORDER BY fecha_hora';
  res.json(db.prepare(sql).all(...p));
});

// Detalle (RF-05, RF-06)
router.get('/:id', (req, res) => {
  const ev = db.prepare(`SELECT *, cupo_maximo - cupos_disponibles AS inscritos,
      fecha_hora < ${AHORA} AS pasado
    FROM v_eventos_cupos WHERE id=? AND estado='activo'`).get(req.params.id);
  if (!ev) return res.status(404).json({ mensaje: 'El evento no existe.' });
  res.json(ev);
});

// Crear (admin, RF-14)
router.post('/', ...soloAdmin, (req, res) => {
  const { errores, datos: d } = validarEvento(req.body, { exigirFuturo: true });
  if (Object.keys(errores).length) return responderErrores(res, errores);
  const r = db.prepare(`INSERT INTO eventos
    (nombre,categoria,descripcion,fecha_hora,lugar,cupo_maximo,imagen_url,organizador,creado_por)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(d.nombre, d.categoria, d.descripcion, d.fecha_hora, d.lugar, d.cupo_maximo, d.imagen_url, d.organizador, req.usuario.id);
  res.status(201).json({ id: r.lastInsertRowid, mensaje: 'Evento publicado.' });
});

// Editar (admin, RF-14)
router.put('/:id', ...soloAdmin, (req, res) => {
  const actual = db.prepare('SELECT id FROM eventos WHERE id=?').get(req.params.id);
  if (!actual) return res.status(404).json({ mensaje: 'El evento no existe.' });
  const { errores, datos: d } = validarEvento(req.body, { exigirFuturo: false });
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id=? AND estado='activa'").get(req.params.id);
  if (!errores.cupo_maximo && d.cupo_maximo < n)
    errores.cupo_maximo = `El cupo no puede ser menor que las ${n} inscripciones activas.`;
  if (Object.keys(errores).length) return responderErrores(res, errores);
  db.prepare(`UPDATE eventos SET nombre=?,categoria=?,descripcion=?,fecha_hora=?,
    lugar=?,cupo_maximo=?,imagen_url=?,organizador=? WHERE id=?`)
    .run(d.nombre, d.categoria, d.descripcion, d.fecha_hora, d.lugar, d.cupo_maximo, d.imagen_url, d.organizador, req.params.id);
  res.json({ mensaje: 'Evento actualizado.' });
});

// Dar de baja (admin, RF-14): sale del catálogo, se conservan las inscripciones
router.delete('/:id', ...soloAdmin, (req, res) => {
  const r = db.prepare("UPDATE eventos SET estado='baja' WHERE id=? AND estado='activo'").run(req.params.id);
  if (!r.changes) return res.status(404).json({ mensaje: 'El evento no existe o ya fue dado de baja.' });
  res.json({ mensaje: 'Evento dado de baja.' });
});

// Inscritos (admin, RF-13)
router.get('/:id/inscritos', ...soloAdmin, (req, res) => {
  const ev = db.prepare('SELECT id,nombre,fecha_hora,lugar,cupo_maximo,estado FROM eventos WHERE id=?').get(req.params.id);
  if (!ev) return res.status(404).json({ mensaje: 'El evento no existe.' });
  const lista = db.prepare(`SELECT u.nombre,u.correo,u.rol,i.fecha_inscripcion
    FROM inscripciones i JOIN usuarios u ON u.id=i.usuario_id
    WHERE i.evento_id=? AND i.estado='activa' ORDER BY i.fecha_inscripcion`).all(req.params.id);
  res.json({ evento: ev, cantidad: lista.length, inscritos: lista });
});

module.exports = router;
