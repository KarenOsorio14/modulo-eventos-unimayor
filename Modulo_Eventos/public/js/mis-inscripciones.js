// Mis inscripciones y cancelación (RF-11, RF-12, RN-07)
document.addEventListener('DOMContentLoaded', () => {
  const usuario = exigirSesion(['estudiante', 'docente']);
  if (!usuario) return;
  const contenido = document.getElementById('contenido');
  const aviso = el('div', { 'aria-live': 'polite' });
  const zona = el('div');

  contenido.replaceChildren(
    migas([['Inicio', '/'], ['Bienestar'], ['Eventos', '/'], ['Mis inscripciones']]),
    el('div', { class: 'titulo-fila' },
      el('div', {}, el('h1', { class: 'titulo' }, 'Mis inscripciones'),
        el('p', { class: 'subtitulo' }, 'Eventos a los que estás inscrito.'))),
    aviso, zona);

  function estadoFila(i) {
    if (i.estado_evento === 'baja') return el('span', { class: 'pastilla roja' }, 'Evento cancelado');
    if (i.pasado) return el('span', { class: 'pastilla gris' }, 'Finalizado');
    return el('span', { class: 'pastilla verde' }, 'Inscrito');
  }

  async function cancelar(i) {
    const ok = await confirmar({
      titulo: '¿Cancelar tu inscripción?',
      texto: `Vas a cancelar tu inscripción a “${i.nombre}”. El cupo quedará disponible de inmediato para otras personas (RN-07).`,
      detalle: `${fechaCorta(i.fecha_hora)} · ${i.lugar}`,
      aceptar: 'Sí, cancelar', cancelar: 'Mantener inscripción', peligro: true,
    });
    if (!ok) return;
    try {
      await api(`/eventos/${i.id}/inscripcion`, { metodo: 'DELETE' });
      aviso.replaceChildren(el('div', { class: 'aviso ok' }, `Cancelaste tu inscripción a “${i.nombre}”. El cupo quedó libre.`));
    } catch (e) {
      aviso.replaceChildren(el('div', { class: 'aviso error' }, e.message));
    }
    cargar();
  }

  async function cargar() {
    let lista;
    try { lista = await api('/mis-inscripciones'); } catch (e) {
      zona.replaceChildren(el('div', { class: 'aviso error' }, e.message)); return;
    }
    if (!lista.length) {
      zona.replaceChildren(el('div', { class: 'vacio' },
        el('div', { class: 'icono' }, el('img', { src: '/img/logo-unimayor.png', alt: '' })),
        el('h2', {}, 'Aún no tienes inscripciones'),
        el('p', {}, 'Explora el catálogo y inscríbete a los eventos que te interesen.'),
        el('a', { class: 'btn', href: '/' }, 'Ver eventos')));
      return;
    }
    zona.replaceChildren(el('div', { class: 'tabla-caja' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Evento', 'Categoría', 'Fecha y hora', 'Lugar', 'Estado', 'Acción'].map(t => el('th', { scope: 'col' }, t)))),
      el('tbody', {}, lista.map(i => {
        const activa = i.estado_evento === 'activo' && !i.pasado;
        return el('tr', { class: activa ? '' : 'inactiva' },
          el('td', { class: 'fuerte' }, activa ? el('a', { href: `/evento.html?id=${i.id}`, style: { textDecoration: 'none' } }, i.nombre) : i.nombre),
          el('td', {}, el('span', { class: 'pastilla azul' }, nombreCategoria(i.categoria))),
          el('td', {}, fechaCorta(i.fecha_hora)),
          el('td', {}, i.lugar),
          el('td', {}, estadoFila(i)),
          el('td', {}, activa
            ? el('button', { class: 'enlace rojo', type: 'button', onclick: () => cancelar(i) }, 'Cancelar inscripción')
            : '—'));
      })))));
  }

  cargar();
});
