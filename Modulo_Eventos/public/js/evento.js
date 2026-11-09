// Detalle del evento e inscripción (RF-05 a RF-10 · CU-02)
document.addEventListener('DOMContentLoaded', () => {
  const contenido = document.getElementById('contenido');
  const id = Number(new URLSearchParams(location.search).get('id'));
  const usuario = Sesion.usuario();
  const puedeInscribirse = usuario && ['estudiante', 'docente'].includes(usuario.rol);

  async function cargar(aviso) {
    let ev, inscrito = false;
    try {
      ev = await api('/eventos/' + id);
      if (puedeInscribirse) {
        const mias = await api('/mis-inscripciones');
        inscrito = mias.some(i => i.id === ev.id);
      }
    } catch (e) {
      contenido.replaceChildren(
        migas([['Inicio', '/'], ['Bienestar'], ['Eventos', '/'], ['Evento']]),
        el('div', { class: 'vacio' },
          el('div', { class: 'icono' }, el('img', { src: '/img/logo-unimayor.png', alt: '' })),
          el('h2', {}, e.estado === 404 ? 'Este evento no existe o ya no está disponible' : 'No se pudo cargar el evento'),
          el('p', {}, e.estado === 404 ? 'Puede que haya sido dado de baja del catálogo.' : e.message),
          el('a', { class: 'btn btn-borde', href: '/' }, 'Volver al catálogo')));
      return;
    }
    document.title = ev.nombre + ' | Unimayor';
    pintar(ev, inscrito, aviso);
  }

  function pintar(ev, inscrito, aviso) {
    const ocupados = ev.cupo_maximo - ev.cupos_disponibles;
    const porcentaje = Math.round((ocupados / ev.cupo_maximo) * 100);
    contenido.replaceChildren(
      migas([['Inicio', '/'], ['Bienestar'], ['Eventos', '/'], [ev.nombre]]),
      aviso || '',
      el('div', { class: 'detalle' },
        el('section', {},
          afiche(ev, { grande: true }),
          el('h1', {}, ev.nombre),
          el('div', { class: 'cajas' },
            el('div', { class: 'caja' }, el('small', {}, 'Categoría'), el('b', {}, nombreCategoria(ev.categoria))),
            el('div', { class: 'caja' }, el('small', {}, 'Fecha y hora'), el('b', {}, fechaCorta(ev.fecha_hora))),
            el('div', { class: 'caja' }, el('small', {}, 'Lugar'), el('b', {}, ev.lugar))),
          el('div', { class: 'cupos' },
            el('div', { class: 'fila' }, el('span', {}, 'Cupos'),
              el('span', {}, ev.cupos_disponibles <= 0 ? `0 de ${ev.cupo_maximo} cupos disponibles` : `${ev.cupos_disponibles} de ${ev.cupo_maximo} cupos disponibles`)),
            el('div', { class: 'barra', role: 'progressbar', 'aria-label': 'Cupos ocupados', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(porcentaje) },
              el('i', { style: { width: porcentaje + '%' } }))),
          el('h2', {}, 'Descripción'),
          el('p', { class: 'desc' }, ev.descripcion),
          ev.organizador ? el('p', { class: 'organiza' }, 'Organiza: ' + ev.organizador) : null),
        panelInscripcion(ev, inscrito)));
    if (location.hash === '#inscripcion') document.getElementById('inscripcion')?.scrollIntoView({ block: 'start' });
  }

  function panelInscripcion(ev, inscrito) {
    const panel = el('aside', { class: 'panel', id: 'inscripcion', 'aria-labelledby': 'titulo-insc' });
    const titulo = el('h2', { id: 'titulo-insc' }, 'Inscripción');

    if (ev.pasado) {
      panel.append(titulo, el('p', { class: 'nota' }, 'Este evento ya se realizó y no admite inscripciones.'),
        el('a', { class: 'btn btn-borde btn-bloque', href: '/' }, 'Ver otros eventos'));
    } else if (!usuario) {
      // RNF-05: solo se pide sesión al momento de inscribirse
      panel.append(titulo,
        el('p', { class: 'nota' }, 'Para inscribirte debes iniciar sesión con tus credenciales institucionales.'),
        ev.cupos_disponibles <= 0
          ? el('div', { class: 'aviso info' }, 'Este evento ya no tiene cupos disponibles.')
          : el('button', { class: 'btn btn-bloque', type: 'button', onclick: irALogin }, 'Inscribirme'),
        el('p', { class: 'pie-nota' }, 'Al iniciar sesión volverás a este evento.'));
    } else if (usuario.rol === 'administrador') {
      panel.append(titulo,
        el('p', { class: 'nota' }, 'Los administradores gestionan los eventos, pero no se inscriben (RN-06).'),
        el('a', { class: 'btn btn-bloque', href: `/admin.html#inscritos/${ev.id}` }, 'Ver inscritos'),
        el('a', { class: 'btn btn-borde btn-bloque', style: { marginTop: '10px' }, href: `/admin.html#editar/${ev.id}` }, 'Editar evento'));
    } else if (inscrito) {
      panel.append(titulo,
        el('div', { class: 'aviso alerta', style: { marginTop: '12px' } }, 'Ya estás inscrito en este evento. No se permite una segunda inscripción.'),
        el('a', { class: 'btn btn-borde btn-bloque', href: '/mis-inscripciones.html' }, 'Ver mis inscripciones'));
    } else if (ev.cupos_disponibles <= 0) {
      panel.append(titulo,
        el('div', { class: 'aviso info', style: { marginTop: '12px' } }, 'Este evento ya no tiene cupos disponibles. No se puede realizar la inscripción.'),
        el('button', { class: 'btn btn-bloque', type: 'button', disabled: true }, 'Sin cupos'));
    } else {
      const boton = el('button', { class: 'btn btn-bloque', type: 'submit' }, 'Confirmar inscripción');
      const form = el('form', { onsubmit: async e => {
        e.preventDefault();
        boton.disabled = true; boton.textContent = 'Inscribiendo…';
        try {
          const r = await api(`/eventos/${ev.id}/inscripcion`, { metodo: 'POST' });
          confirmacion(ev, r.cupos_disponibles);
        } catch (err) {
          // Cupo agotado mientras tanto, ya inscrito o evento no disponible: se recarga el detalle
          cargar(el('div', { class: 'aviso error', role: 'alert' }, '⚠ No se registró tu inscripción: ' + err.message +
            (err.message.includes('Cupo') ? ' Otra persona tomó el último cupo antes que tú.' : '')));
        }
      } },
        el('div', { class: 'campo' }, el('label', { for: 'insc-nombre' }, 'Nombre'), el('input', { id: 'insc-nombre', value: usuario.nombre, readonly: true })),
        el('div', { class: 'campo' }, el('label', { for: 'insc-correo' }, 'Correo institucional'), el('input', { id: 'insc-correo', value: usuario.correo, readonly: true })),
        boton);
      panel.append(titulo, el('p', { class: 'nota' }, 'Te inscribirás con tu cuenta institucional.'), form,
        el('p', { class: 'pie-nota' }, 'El cupo se descuenta en el momento de la solicitud.'));
    }
    return panel;
  }

  // RF-09: confirmación inmediata en pantalla
  function confirmacion(ev, cuposRestantes) {
    window.scrollTo(0, 0);
    contenido.replaceChildren(
      migas([['Inicio', '/'], ['Bienestar'], ['Eventos', '/'], ['Confirmación']]),
      el('div', { class: 'confirmacion', role: 'status' },
        el('div', { class: 'check' }, icono('check')),
        el('h1', {}, '¡Inscripción confirmada!'),
        el('p', { class: 'nota' }, 'Tu cupo quedó registrado. Se descontó 1 cupo del evento.'),
        el('div', { class: 'resumen' },
          el('div', {}, el('span', {}, 'Evento'), el('b', {}, ev.nombre)),
          el('div', {}, el('span', {}, 'Fecha y hora'), el('b', {}, fechaCorta(ev.fecha_hora))),
          el('div', {}, el('span', {}, 'Lugar'), el('b', {}, ev.lugar)),
          el('div', {}, el('span', {}, 'Inscrito como'), el('b', {}, `${usuario.nombre} (${nombreRol(usuario.rol)})`)),
          el('div', {}, el('span', {}, 'Cupos restantes'), el('b', {}, `${cuposRestantes} de ${ev.cupo_maximo}`))),
        el('div', { class: 'botones-centro' },
          el('a', { class: 'btn', href: '/mis-inscripciones.html' }, 'Ver mis inscripciones'),
          el('a', { class: 'btn btn-borde', href: '/' }, 'Volver al catálogo'))));
  }

  if (!id) { location.href = '/'; return; }
  cargar();
});
