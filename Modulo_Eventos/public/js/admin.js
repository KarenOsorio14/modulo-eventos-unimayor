// Administración de eventos (RF-13, RF-14 · CU-03). Solo para el rol administrador (RN-06).
// Vistas: #  (panel) · #crear · #editar/ID · #inscritos/ID
document.addEventListener('DOMContentLoaded', () => {
  const usuario = exigirSesion(['administrador']);
  if (!usuario) return;
  const contenido = document.getElementById('contenido');
  let mensaje = null; // aviso que se muestra una vez al volver al panel
  let filtroCategoria = '';

  const RUTA = [['Inicio', '/'], ['Bienestar'], ['Eventos', '/']];

  function estadoEvento(ev) {
    if (ev.estado === 'baja') return el('span', { class: 'pastilla roja' }, 'Dado de baja');
    if (ev.pasado_admin) return el('span', { class: 'pastilla gris' }, 'Finalizado');
    if (ev.cupos_disponibles <= 0) return el('span', { class: 'pastilla gris' }, 'Cupo agotado');
    return el('span', { class: 'pastilla verde' }, 'Con cupo');
  }

  async function obtenerEventos() {
    const ahora = new Date();
    const lista = await api('/eventos?todos=1');
    lista.forEach(e => { e.pasado_admin = aFecha(e.fecha_hora) < ahora; });
    return lista;
  }

  // ---------- Panel ----------
  async function panel() {
    contenido.replaceChildren(el('p', { class: 'cargando' }, 'Cargando eventos…'));
    let eventos;
    try { eventos = await obtenerEventos(); } catch (e) {
      contenido.replaceChildren(el('div', { class: 'aviso error' }, e.message)); return;
    }
    const enCatalogo = eventos.filter(e => e.estado === 'activo' && !e.pasado_admin);
    const totalInscripciones = eventos.filter(e => e.estado === 'activo').reduce((s, e) => s + e.inscritos, 0);
    const agotados = enCatalogo.filter(e => e.cupos_disponibles <= 0).length;

    const cuerpoTabla = el('tbody');
    const chips = [['', 'Todos'], ['deportivo', 'Deportivos'], ['cultural', 'Culturales']].map(([v, t]) =>
      el('button', { type: 'button', class: 'chip' + (v === filtroCategoria ? ' activo' : ''), 'aria-pressed': String(v === filtroCategoria),
        onclick: () => { filtroCategoria = v; chips.forEach(c => { const on = c === chipDe(v); c.classList.toggle('activo', on); c.setAttribute('aria-pressed', String(on)); }); filas(); } }, t));
    const chipDe = v => chips[['', 'deportivo', 'cultural'].indexOf(v)];

    function filas() {
      // Primero los vigentes, después los finalizados y los dados de baja
      const orden = e => (e.estado === 'baja' ? 2 : e.pasado_admin ? 1 : 0);
      const visibles = eventos.filter(e => !filtroCategoria || e.categoria === filtroCategoria)
        .sort((a, b) => orden(a) - orden(b) || a.fecha_hora.localeCompare(b.fecha_hora));
      if (!visibles.length) {
        cuerpoTabla.replaceChildren(el('tr', {}, el('td', { colspan: '7', style: { textAlign: 'center', color: '#55657a' } }, 'No hay eventos en esta categoría.')));
        return;
      }
      cuerpoTabla.replaceChildren(...visibles.map(ev => {
        const activo = ev.estado === 'activo';
        return el('tr', { class: activo ? '' : 'inactiva' },
          el('td', { class: 'fuerte' }, ev.nombre),
          el('td', {}, el('span', { class: 'pastilla azul' }, nombreCategoria(ev.categoria))),
          el('td', { style: { whiteSpace: 'nowrap' } }, fechaCorta(ev.fecha_hora)),
          el('td', {}, ev.lugar),
          el('td', { class: 'fuerte', style: { whiteSpace: 'nowrap' } }, `${ev.inscritos} / ${ev.cupo_maximo}`),
          el('td', {}, estadoEvento(ev)),
          el('td', {}, el('div', { class: 'acciones-fila' },
            el('a', { class: 'enlace', href: `#inscritos/${ev.id}` }, 'Ver inscritos'),
            activo ? el('a', { class: 'enlace', href: `#editar/${ev.id}` }, 'Editar') : null,
            activo ? el('button', { class: 'enlace rojo', type: 'button', onclick: () => darDeBaja(ev) }, 'Dar de baja') : null)));
      }));
    }

    contenido.replaceChildren(
      migas([...RUTA, ['Administración']]),
      el('div', { class: 'titulo-fila' },
        el('div', {}, el('h1', { class: 'titulo' }, 'Administración de eventos'),
          el('p', { class: 'subtitulo' }, 'Crea, edita y da de baja eventos del catálogo.')),
        el('a', { class: 'btn', href: '#crear' }, '+ Crear evento')),
      mensaje ? el('div', { class: 'aviso ok', role: 'status' }, mensaje) : '',
      el('div', { class: 'estadisticas' },
        el('div', { class: 'estadistica' }, el('b', {}, enCatalogo.length), el('span', {}, 'Eventos en el catálogo')),
        el('div', { class: 'estadistica' }, el('b', {}, totalInscripciones), el('span', {}, 'Inscripciones registradas')),
        el('div', { class: 'estadistica' }, el('b', {}, agotados), el('span', {}, 'Eventos con cupo agotado'))),
      el('div', { class: 'filtro', style: { marginBottom: '16px' }, role: 'group', 'aria-label': 'Categoría' }, chips),
      el('div', { class: 'tabla-caja' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Evento', 'Categoría', 'Fecha y hora', 'Lugar', 'Inscritos', 'Estado', 'Acciones'].map(t => el('th', { scope: 'col' }, t)))),
        cuerpoTabla)));
    mensaje = null;
    filas();
  }

  async function darDeBaja(ev) {
    const ok = await confirmar({
      titulo: '¿Dar de baja este evento?',
      texto: `“${ev.nombre}” se retirará del catálogo. Las personas inscritas (${ev.inscritos}) dejarán de verlo como disponible.`,
      detalle: 'Sus inscripciones no se borran (RF-14): quedan registradas como evento cancelado.',
      aceptar: 'Dar de baja', peligro: true,
    });
    if (!ok) return;
    try {
      await api('/eventos/' + ev.id, { metodo: 'DELETE' });
      mensaje = `“${ev.nombre}” fue dado de baja del catálogo.`;
    } catch (e) { mensaje = null; alert(e.message); }
    panel();
  }

  // ---------- Crear y editar ----------
  async function formulario(idEditar) {
    let ev = null;
    if (idEditar) {
      try { ev = (await obtenerEventos()).find(e => e.id === idEditar && e.estado === 'activo'); } catch { /* sin datos */ }
      if (!ev) { mensaje = null; location.hash = ''; return; }
    }
    const titulo = ev ? 'Editar evento' : 'Crear evento';
    const avisoGeneral = el('div', { role: 'alert' });
    const campos = {};

    function campo(nombre, etiqueta, control, { requerido = true, ancho = false, ayuda } = {}) {
      control.id = 'f-' + nombre; control.name = nombre;
      const error = el('span', { class: 'error', id: 'e-' + nombre });
      const caja = el('div', { class: 'campo' + (ancho ? ' ancho' : '') },
        el('label', { for: control.id }, etiqueta, requerido ? el('span', { class: 'req' }, ' *') : null),
        control, ayuda ? el('span', { class: 'ayuda' }, ayuda) : null, error);
      campos[nombre] = { caja, control, error };
      return caja;
    }
    const valor = c => (ev ? ev[c] ?? '' : '');
    const selectCategoria = el('select', {},
      el('option', { value: '' }, 'Selecciona Deportivo o Cultural'),
      el('option', { value: 'deportivo' }, 'Deportivo'),
      el('option', { value: 'cultural' }, 'Cultural'));
    selectCategoria.value = valor('categoria');

    const boton = el('button', { class: 'btn', type: 'submit' }, ev ? 'Guardar cambios' : 'Publicar evento');
    const form = el('form', { class: 'form-tarjeta', novalidate: true, onsubmit: guardar },
      el('div', { class: 'form-rejilla' },
        campo('nombre', 'Nombre del evento', el('input', { value: valor('nombre'), placeholder: 'Ej. Torneo Interno de Baloncesto', maxlength: '120' })),
        campo('cupo_maximo', 'Cupo máximo', el('input', { type: 'number', min: '1', step: '1', value: valor('cupo_maximo'), placeholder: 'Número de cupos' }),
          ev ? { ayuda: `Hay ${ev.inscritos} inscripciones activas: el cupo no puede ser menor.` } : {}),
        campo('categoria', 'Categoría', selectCategoria),
        campo('organizador', 'Organizador', el('input', { value: valor('organizador'), placeholder: 'Ej. Bienestar Institucional' }), { requerido: false }),
        campo('fecha_hora', 'Fecha y hora', el('input', { type: 'datetime-local', value: valor('fecha_hora') })),
        campo('imagen_url', 'Imagen del evento (enlace)', el('input', { type: 'url', value: valor('imagen_url'), placeholder: 'https://… (JPG o PNG)' }),
          { requerido: false, ayuda: 'Opcional. Si no hay imagen se usa el afiche de la categoría.' }),
        campo('lugar', 'Lugar', el('input', { value: valor('lugar'), placeholder: 'Ej. Coliseo Universitario' })),
        el('div'),
        campo('descripcion', 'Descripción', el('textarea', { placeholder: 'Describe el evento: de qué se trata, quién puede participar…' }, valor('descripcion')), { ancho: true })),
      el('div', { class: 'form-acciones' },
        el('a', { class: 'btn btn-borde', href: '#' }, 'Cancelar'), boton));

    async function guardar(e) {
      e.preventDefault();
      Object.values(campos).forEach(c => { c.caja.classList.remove('con-error'); c.error.textContent = ''; c.control.removeAttribute('aria-invalid'); });
      avisoGeneral.replaceChildren();
      const datos = Object.fromEntries(Object.entries(campos).map(([k, c]) => [k, c.control.value]));
      boton.disabled = true;
      try {
        await api(ev ? '/eventos/' + ev.id : '/eventos', { metodo: ev ? 'PUT' : 'POST', datos });
        mensaje = ev ? `Se guardaron los cambios de “${datos.nombre.trim()}”.` : `“${datos.nombre.trim()}” se publicó en el catálogo.`;
        location.hash = '';
      } catch (err) {
        boton.disabled = false;
        avisoGeneral.replaceChildren(el('div', { class: 'aviso error' }, '⚠ ' + err.message));
        for (const [k, msj] of Object.entries(err.errores || {})) {
          const c = campos[k]; if (!c) continue;
          c.caja.classList.add('con-error');
          c.control.setAttribute('aria-invalid', 'true');
          c.control.setAttribute('aria-describedby', c.error.id);
          c.error.textContent = '⚠ ' + msj;
        }
        window.scrollTo(0, 0);
      }
    }

    contenido.replaceChildren(
      migas([...RUTA, ['Administración', '#'], [titulo]]),
      el('div', { class: 'titulo-fila' }, el('div', {}, el('h1', { class: 'titulo' }, titulo),
        el('p', { class: 'subtitulo' }, ev ? 'Actualiza los datos del evento.' : 'Completa los datos para publicarlo en el catálogo.'))),
      avisoGeneral, form);
    campos.nombre.control.focus();
  }

  // ---------- Inscritos ----------
  async function inscritos(id) {
    let r;
    try { r = await api(`/eventos/${id}/inscritos`); } catch (e) {
      contenido.replaceChildren(el('div', { class: 'aviso error' }, e.message), el('a', { class: 'btn btn-borde', href: '#' }, 'Volver al panel'));
      return;
    }
    const ev = r.evento;
    contenido.replaceChildren(
      migas([...RUTA, ['Administración', '#'], ['Inscritos']]),
      el('div', { class: 'titulo-fila' },
        el('div', {}, el('h1', { class: 'titulo' }, 'Inscritos: ' + ev.nombre),
          el('p', { class: 'subtitulo' }, `${fechaCorta(ev.fecha_hora)} · ${ev.lugar}`)),
        el('a', { class: 'btn btn-borde', href: '#' }, 'Volver al panel')),
      ev.estado === 'baja' ? el('div', { class: 'aviso alerta' }, 'Este evento fue dado de baja. Sus inscripciones se conservan.') : '',
      el('div', { class: 'estadisticas' },
        el('div', { class: 'estadistica' }, el('b', {}, r.cantidad), el('span', {}, 'Personas inscritas')),
        el('div', { class: 'estadistica' }, el('b', {}, Math.max(ev.cupo_maximo - r.cantidad, 0)), el('span', {}, 'Cupos disponibles')),
        el('div', { class: 'estadistica' }, el('b', {}, ev.cupo_maximo), el('span', {}, 'Cupo máximo'))),
      r.cantidad
        ? el('div', { class: 'tabla-caja' }, el('table', {},
            el('thead', {}, el('tr', {}, ['#', 'Nombre', 'Rol', 'Correo institucional', 'Fecha de inscripción'].map(t => el('th', { scope: 'col' }, t)))),
            el('tbody', {}, r.inscritos.map((p, i) => el('tr', {},
              el('td', {}, i + 1),
              el('td', { class: 'fuerte' }, p.nombre),
              el('td', {}, el('span', { class: 'pastilla azul' }, nombreRol(p.rol))),
              el('td', {}, p.correo),
              el('td', {}, fechaRegistro(p.fecha_inscripcion)))))))
        : el('div', { class: 'vacio' }, el('h2', {}, 'Todavía no hay inscritos'), el('p', {}, 'Cuando alguien se inscriba aparecerá aquí.')));
  }

  function enrutar() {
    window.scrollTo(0, 0);
    const [vista, id] = location.hash.slice(1).split('/');
    if (vista === 'crear') formulario(null);
    else if (vista === 'editar' && Number(id)) formulario(Number(id));
    else if (vista === 'inscritos' && Number(id)) inscritos(Number(id));
    else panel();
  }
  window.addEventListener('hashchange', enrutar);
  enrutar();
});
