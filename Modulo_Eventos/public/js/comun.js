// Funciones compartidas por todas las páginas: sesión, llamadas a la API,
// encabezado, pie de página y formato de fechas.
// Los datos que vienen del servidor se insertan con textContent (nunca innerHTML)
// para evitar inyección de código.

// ---------- Sesión ----------
const Sesion = {
  obtener() {
    try { return JSON.parse(localStorage.getItem('sesion')) || null; } catch { return null; }
  },
  guardar(datos) { localStorage.setItem('sesion', JSON.stringify(datos)); },
  cerrar() { localStorage.removeItem('sesion'); },
  usuario() { return this.obtener()?.usuario || null; },
};

// ---------- API ----------
// Centraliza los fetch y agrega el token automáticamente.
async function api(ruta, { metodo = 'GET', datos } = {}) {
  const opciones = { method: metodo, headers: {} };
  const sesion = Sesion.obtener();
  if (sesion?.token) opciones.headers.Authorization = 'Bearer ' + sesion.token;
  if (datos !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos);
  }
  let respuesta;
  try {
    respuesta = await fetch('/api' + ruta, opciones);
  } catch {
    throw Object.assign(new Error('No se pudo conectar con el servidor.'), { estado: 0 });
  }
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401 && sesion) {
    // Token vencido o inválido: se cierra la sesión y se pide iniciar de nuevo
    Sesion.cerrar();
    irALogin();
    return new Promise(() => {});
  }
  if (!respuesta.ok) {
    throw Object.assign(new Error(cuerpo.mensaje || 'Ocurrió un error.'), { estado: respuesta.status, errores: cuerpo.errores });
  }
  return cuerpo;
}

function irALogin() {
  const volver = location.pathname + location.search;
  location.href = '/login.html?volver=' + encodeURIComponent(volver);
}

// Exige sesión (y opcionalmente un rol) para ver la página
function exigirSesion(roles) {
  const u = Sesion.usuario();
  if (!u) { irALogin(); return null; }
  if (roles && !roles.includes(u.rol)) { location.href = '/'; return null; }
  return u;
}

// ---------- Crear elementos de forma segura ----------
function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else if (clave === 'style' && typeof valor === 'object') Object.assign(nodo.style, valor);
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

const ICONOS = {
  calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  lugar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  buscar: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>',
  apps: '<svg viewBox="0 0 24 24" fill="#004884" aria-hidden="true"><circle cx="5" cy="5" r="2.2"/><circle cx="12" cy="5" r="2.2"/><circle cx="19" cy="5" r="2.2"/><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="12" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
// Marca GOV.CO (texto blanco con el chulo de colores sobre la "g")
const LOGO_GOVCO = '<svg viewBox="0 0 112 30" width="100" height="27" aria-hidden="true">'
  + '<circle cx="10" cy="14" r="7" fill="none" stroke="#fff" stroke-width="3.2"/>'
  + '<path d="M17 8v12a7 7 0 0 1-12.5 4.3" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>'
  + '<path d="M6.2 13.4l3 3 3.6-5.2" fill="none" stroke="#f5c400" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M12.8 11.2l2.4-3.4" stroke="#3ab0e6" stroke-width="2.6" stroke-linecap="round"/>'
  + '<path d="M15.2 7.8l2-2.9" stroke="#e8312f" stroke-width="2.6" stroke-linecap="round"/>'
  + '<text x="22" y="21" fill="#fff" font-family="Montserrat, Nunito, Arial, sans-serif" font-size="21" font-weight="500" letter-spacing="1">ov.co</text></svg>';

function icono(nombre) {
  const span = document.createElement('span');
  span.innerHTML = ICONOS[nombre]; // contenido fijo, no viene del usuario
  return span.firstChild;
}

// ---------- Fechas (formato colombiano) ----------
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-11-20T15:00" -> Date en hora local
function aFecha(texto) {
  const [d, h = '00:00'] = String(texto).replace(' ', 'T').split('T');
  const [a, m, dia] = d.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  return new Date(a, m - 1, dia, hh || 0, mm || 0);
}
function hora12(f) {
  const h = f.getHours(), m = String(f.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}
// "Sáb 24 oct · 8:00 a. m."
function fechaCorta(texto) {
  const f = aFecha(texto);
  return `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]} · ${hora12(f)}`;
}
// "sábado 24 de octubre"
function fechaLarga(texto) {
  const f = aFecha(texto);
  return `${DIAS_LARGOS[f.getDay()]} ${f.getDate()} de ${MESES_LARGOS[f.getMonth()]}`;
}
// Fechas de registro guardadas por SQLite en UTC ("2026-11-09 00:11:46")
function fechaRegistro(texto) {
  if (!texto) return '';
  const f = new Date(String(texto).replace(' ', 'T') + 'Z');
  return `${f.getDate()} ${MESES[f.getMonth()]} · ${hora12(f)}`;
}

const nombreCategoria = c => (c === 'deportivo' ? 'Deportivo' : 'Cultural');
const nombreRol = r => ({ estudiante: 'Estudiante', docente: 'Docente', administrador: 'Administrador' }[r] || r);

// ---------- Afiche del evento ----------
// Si el evento tiene imagen, se usa de fondo; si no, un degradado según la categoría.
function afiche(ev, { grande = false } = {}) {
  const nodo = el('div', { class: `afiche ${ev.categoria}${grande ? ' grande' : ''}` },
    el('span', { class: 'etiqueta' }, nombreCategoria(ev.categoria)),
    el(grande ? 'p' : 'p', { class: 'nombre' }, ev.nombre),
    ev.organizador ? el('div', { class: 'sub' }, ev.organizador) : null,
  );
  if (ev.imagen_url && /^(https:\/\/|\/img\/)/.test(ev.imagen_url)) {
    // Si la foto no carga, queda de respaldo el degradado de la categoría
    nodo.classList.add('con-imagen');
    nodo.style.backgroundImage = `url("${encodeURI(ev.imagen_url)}"), ${DEGRADADOS[ev.categoria] || DEGRADADOS.deportivo}`;
  }
  return nodo;
}

const DEGRADADOS = {
  deportivo: 'linear-gradient(135deg, #0b2a5c 0%, #0b5cab 100%)',
  cultural: 'linear-gradient(135deg, #4a1450 0%, #a51c5b 55%, #f5a700 100%)',
};

// Pastilla de cupos: verde, últimos cupos (≤ 5) o agotado
function pastillaCupos(ev) {
  const libres = ev.cupos_disponibles;
  if (libres <= 0) return el('span', { class: 'pastilla gris' }, 'Cupo agotado');
  if (libres <= 5) return el('span', { class: 'pastilla ambar' }, libres === 1 ? '¡Último cupo!' : `¡Últimos ${libres} cupos!`);
  return el('span', { class: 'pastilla verde' }, `${libres} cupos disponibles`);
}

// ---------- Ventana de confirmación ----------
function confirmar({ titulo, texto, detalle, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false }) {
  return new Promise(resolver => {
    const cerrar = valor => { fondo.remove(); document.removeEventListener('keydown', teclas); resolver(valor); };
    const teclas = e => { if (e.key === 'Escape') cerrar(false); };
    const btnAceptar = el('button', { class: 'btn' + (peligro ? ' btn-rojo' : ''), onclick: () => cerrar(true) }, aceptar);
    const fondo = el('div', { class: 'modal-fondo', onclick: e => { if (e.target === fondo) cerrar(false); } },
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-titulo' },
        el('h2', { id: 'modal-titulo' }, titulo),
        el('p', {}, texto),
        detalle ? el('p', { style: { color: '#55657a', fontSize: '13px' } }, detalle) : null,
        el('div', { class: 'botones' },
          el('button', { class: 'btn btn-borde', onclick: () => cerrar(false) }, cancelar),
          btnAceptar)));
    document.addEventListener('keydown', teclas);
    document.body.append(fondo);
    btnAceptar.focus();
  });
}

// ---------- Encabezado y pie ----------
function pintarEncabezado() {
  const destino = document.getElementById('encabezado');
  if (!destino) return;
  const flecha = '<svg class="flecha" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  destino.innerHTML = `
    <div class="govco"><div class="contenedor">
      <a class="govco-logo" href="https://www.gov.co" aria-label="Portal del Estado colombiano GOV.CO">${LOGO_GOVCO}</a>
      <div class="govco-der">
        <span class="govco-apps" aria-hidden="true">${ICONOS.apps}</span>
        <span class="govco-idioma">EN</span>
      </div>
    </div></div>
    <header class="encabezado"><div class="contenedor">
      <a class="marca" href="/" aria-label="Institución Universitaria Colegio Mayor del Cauca – Eventos">
        <img src="/img/logo-unimayor-amarillo.png" alt="">
        <span><span class="t1">INSTITUCIÓN UNIVERSITARIA</span><span class="t2">COLEGIO MAYOR DEL CAUCA</span></span>
      </a>
      <div class="encabezado-der">
        <form class="buscador" action="/" role="search">
          <label class="sr" for="buscar-global">Buscar eventos</label>
          <input id="buscar-global" name="q" placeholder="Buscar en UNIMAYOR" autocomplete="off">
          <button type="submit" aria-label="Buscar">${ICONOS.buscar}</button>
        </form>
        <div class="sesion" id="zona-sesion"></div>
      </div>
    </div></header>
    <nav class="menu-inst" aria-label="Menú institucional"><div class="contenedor">
      <div class="fila1"><a href="/">Inicio</a><a href="#">Transparencia y Acceso a la Información Pública</a><a href="#">Atención y servicio al ciudadano</a><a href="#">Participa</a><a href="#">Directorio</a><a href="#">Correo</a></div>
      <div class="fila2"><a href="#">INSTITUCIONAL ${flecha}</a><a href="#">OFERTA ACADÉMICA ${flecha}</a><a href="#">ADMISIONES ${flecha}</a><a href="#">INVESTIGACIONES</a><a href="#">RELACIONAMIENTO CON EL ENTORNO</a><a href="#">UNIMAYOR VIRTUAL</a></div>
    </div></nav>`;

  const q = new URLSearchParams(location.search).get('q');
  if (q) destino.querySelector('#buscar-global').value = q;

  const zona = destino.querySelector('#zona-sesion');
  const u = Sesion.usuario();
  if (!u) {
    zona.append(el('a', { class: 'btn btn-borde', href: '/login.html' + (location.pathname === '/login.html' ? '' : '?volver=' + encodeURIComponent(location.pathname + location.search)) }, 'Iniciar sesión'));
    return;
  }
  const menu = el('div', { class: 'menu-usuario oculto', id: 'menu-usuario' },
    el('div', { class: 'quien' }, el('b', {}, u.nombre), u.correo),
    el('a', { href: '/' }, 'Catálogo de eventos'),
    u.rol === 'administrador'
      ? el('a', { href: '/admin.html' }, 'Administración de eventos')
      : el('a', { href: '/mis-inscripciones.html' }, 'Mis inscripciones'),
    el('button', { type: 'button', onclick: () => { Sesion.cerrar(); location.href = '/'; } }, 'Cerrar sesión'));
  const boton = el('button', {
    class: 'usuario-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false',
    onclick: e => {
      e.stopPropagation();
      const abierto = menu.classList.toggle('oculto') === false;
      boton.setAttribute('aria-expanded', String(abierto));
    },
  }, nombreRol(u.rol), el('span', { class: 'avatar', 'aria-hidden': 'true' }, (u.nombre || '?').trim()[0].toUpperCase()));
  document.addEventListener('click', () => { menu.classList.add('oculto'); boton.setAttribute('aria-expanded', 'false'); });
  zona.append(boton, menu);
}

function pintarPie() {
  const destino = document.getElementById('pie');
  if (!destino) return;
  destino.innerHTML = `
    <footer>
      <div class="pie"><div class="contenedor"><div class="tarjeta-pie">
        <h2>INSTITUCIÓN UNIVERSITARIA COLEGIO MAYOR DEL CAUCA</h2>
        <p>Claustro Encarnación Cra. 5 # 5 - 40 Popayán, Colombia • Código Postal 190003</p>
        <p>Teléfono Conmutador: +57 (602) 8274178 • Línea Gratuita: 01-8000-931018 ext 1</p>
        <p>Correo Institucional: institucional@unimayor.edu.co</p>
        <p>Horario de Atención Presencial: Lunes a viernes de 8:00 a.m. – 6:00 p.m.</p>
        <div class="redes"><span>● @unimayor</span><span>● @unimayor</span><span>● @unimayor</span><span>● @colmayorcauca</span><span>● @unimayor_oficial</span></div>
      </div></div></div>
      <div class="pie-govco"><div class="contenedor">GOV.CO</div></div>
    </footer>`;
}

// Migas de pan: [['Inicio','/'], ['Bienestar'], ['Eventos','/'], ['Actual']]
function migas(items) {
  const nav = el('nav', { class: 'migas', 'aria-label': 'Ruta de navegación' });
  items.forEach(([texto, enlace], i) => {
    if (i) nav.append(' › ');
    const ultimo = i === items.length - 1;
    nav.append(ultimo ? el('b', { 'aria-current': 'page' }, texto) : enlace ? el('a', { href: enlace }, texto) : texto);
  });
  return nav;
}

document.addEventListener('DOMContentLoaded', () => { pintarEncabezado(); pintarPie(); });
