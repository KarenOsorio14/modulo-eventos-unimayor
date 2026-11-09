// Catálogo público de eventos (RF-03, RF-04, RF-06 · CU-01)
document.addEventListener('DOMContentLoaded', async () => {
  const contenido = document.getElementById('contenido');
  const params = new URLSearchParams(location.search);
  const estado = { categoria: '', fecha: '', q: (params.get('q') || '').trim() };
  const usuario = Sesion.usuario();

  const chips = [['', 'Todos'], ['deportivo', 'Deportivos'], ['cultural', 'Culturales']].map(([valor, texto]) =>
    el('button', { type: 'button', class: 'chip' + (valor === '' ? ' activo' : ''), 'aria-pressed': String(valor === ''), 'data-valor': valor,
      onclick: () => { estado.categoria = valor; marcarChips(); cargar(); } }, texto));
  const marcarChips = () => chips.forEach(c => {
    const on = c.dataset.valor === estado.categoria;
    c.classList.toggle('activo', on);
    c.setAttribute('aria-pressed', String(on));
  });

  const selectFecha = el('select', { id: 'filtro-fecha', onchange: () => { estado.fecha = selectFecha.value; cargar(); } },
    el('option', { value: '' }, 'Cualquier fecha'));
  const conteo = el('p', { class: 'conteo', 'aria-live': 'polite' });
  const lista = el('div');
  const avisoBusqueda = el('div');

  contenido.replaceChildren(
    migas([['Inicio', '/'], ['Bienestar'], ['Eventos']]),
    el('div', { class: 'titulo-fila' },
      el('div', {},
        el('h1', { class: 'titulo' }, 'Eventos'),
        el('p', { class: 'subtitulo' }, 'Eventos deportivos y culturales vigentes en un solo lugar. Consulta sin iniciar sesión; para inscribirte necesitas tu cuenta institucional.')),
      usuario?.rol === 'administrador' ? el('a', { class: 'btn', href: '/admin.html' }, 'Administrar eventos') : null),
    el('div', { class: 'filtros' },
      el('div', { class: 'filtro', role: 'group', 'aria-label': 'Categoría' }, el('span', {}, 'Categoría:'), chips),
      el('div', { class: 'filtro' }, el('label', { for: 'filtro-fecha' }, 'Fecha:'), selectFecha)),
    avisoBusqueda, conteo, lista);

  // Opciones del filtro de fecha: los días que tienen eventos vigentes
  try {
    const todos = await api('/eventos');
    [...new Set(todos.map(e => e.fecha_hora.slice(0, 10)))].forEach(dia => {
      const texto = fechaLarga(dia + 'T00:00');
      selectFecha.append(el('option', { value: dia }, texto[0].toUpperCase() + texto.slice(1)));
    });
  } catch { /* el catálogo mostrará el error al cargar */ }

  function limpiar() {
    estado.categoria = ''; estado.fecha = ''; estado.q = '';
    selectFecha.value = '';
    document.getElementById('buscar-global').value = '';
    history.replaceState(null, '', '/');
    marcarChips(); cargar();
  }

  async function cargar() {
    const consulta = new URLSearchParams();
    if (estado.categoria) consulta.set('categoria', estado.categoria);
    if (estado.fecha) consulta.set('fecha', estado.fecha);
    lista.replaceChildren(el('p', { class: 'cargando' }, 'Cargando eventos…'));
    let eventos;
    try {
      eventos = await api('/eventos' + (consulta.toString() ? '?' + consulta : ''));
    } catch (e) {
      conteo.textContent = '';
      lista.replaceChildren(el('div', { class: 'aviso error' }, e.message));
      return;
    }
    if (estado.q) {
      const t = estado.q.toLowerCase();
      eventos = eventos.filter(e => [e.nombre, e.descripcion, e.lugar].some(x => (x || '').toLowerCase().includes(t)));
    }
    avisoBusqueda.replaceChildren(estado.q
      ? el('div', { class: 'aviso info' }, `Resultados para “${estado.q}”. `, el('button', { class: 'enlace', type: 'button', onclick: limpiar }, 'Quitar búsqueda'))
      : '');
    conteo.textContent = eventos.length === 1 ? '1 evento vigente' : `${eventos.length} eventos vigentes`;
    if (!eventos.length) {
      lista.replaceChildren(el('div', { class: 'vacio' },
        el('div', { class: 'icono' }, el('img', { src: '/img/logo-unimayor.png', alt: '' })),
        el('h2', {}, 'Ningún evento cumple los filtros seleccionados'),
        el('p', {}, 'Prueba con otra categoría u otra fecha.'),
        el('button', { class: 'btn btn-borde', type: 'button', onclick: limpiar }, 'Limpiar filtros')));
      return;
    }
    lista.replaceChildren(el('div', { class: 'rejilla' }, eventos.map(tarjeta)));
  }

  function tarjeta(ev) {
    const url = `/evento.html?id=${ev.id}`;
    const agotado = ev.cupos_disponibles <= 0;
    let accion = null;
    if (usuario?.rol !== 'administrador') {
      accion = agotado
        ? el('span', { class: 'btn inactivo', 'aria-disabled': 'true' }, 'Sin cupo')
        : el('a', { class: 'btn', href: url + '#inscripcion' }, 'Inscribirme');
    }
    return el('article', { class: 'tarjeta' },
      el('a', { href: url, 'aria-label': 'Ver ' + ev.nombre, style: { textDecoration: 'none' } }, afiche(ev)),
      el('div', { class: 'cuerpo' },
        el('h3', {}, ev.nombre),
        el('div', { class: 'dato' }, icono('calendario'), fechaCorta(ev.fecha_hora)),
        el('div', { class: 'dato' }, icono('lugar'), ev.lugar),
        el('div', { style: { marginTop: '6px' } }, pastillaCupos(ev)),
        el('div', { class: 'acciones', style: accion ? null : { gridTemplateColumns: '1fr' } },
          el('a', { class: 'btn btn-borde', href: url }, 'Ver evento'), accion)));
  }

  cargar();
});
