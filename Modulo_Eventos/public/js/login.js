// Inicio de sesión (RF-01 · CU-02 flujo alterno A1: tras iniciar sesión regresa al evento)
document.addEventListener('DOMContentLoaded', async () => {
  const contenido = document.getElementById('contenido');
  const params = new URLSearchParams(location.search);
  // Solo se permite volver a una ruta interna del sitio
  const volver = /^\/(?!\/)/.test(params.get('volver') || '') ? params.get('volver') : null;

  if (Sesion.usuario()) { location.href = volver || '/'; return; }

  // Si viene de un evento, se muestra a qué evento se va a inscribir
  let avisoEvento = null;
  const idEvento = volver && new URLSearchParams(volver.split('?')[1] || '').get('id');
  if (volver?.startsWith('/evento.html') && idEvento) {
    try {
      const ev = await api('/eventos/' + Number(idEvento));
      avisoEvento = el('div', { class: 'aviso info' }, `Para inscribirte a “${ev.nombre}” primero inicia sesión. Al terminar volverás al evento.`);
    } catch { /* si el evento no existe, se omite el aviso */ }
  }

  const error = el('div', { role: 'alert' });
  const correo = el('input', { id: 'correo', type: 'email', name: 'correo', required: true, autocomplete: 'username', placeholder: 'nombre@unimayor.edu.co' });
  const clave = el('input', { id: 'clave', type: 'password', name: 'password', required: true, autocomplete: 'current-password', placeholder: '••••••••' });
  const boton = el('button', { class: 'btn btn-bloque', type: 'submit' }, 'Ingresar');

  const form = el('form', { novalidate: true, onsubmit: async e => {
    e.preventDefault();
    error.replaceChildren();
    if (!correo.value.trim() || !clave.value) {
      error.replaceChildren(el('div', { class: 'aviso error' }, 'Escribe tu correo institucional y tu contraseña.'));
      return;
    }
    boton.disabled = true; boton.textContent = 'Ingresando…';
    try {
      const r = await api('/auth/login', { metodo: 'POST', datos: { correo: correo.value.trim(), password: clave.value } });
      Sesion.guardar(r);
      location.href = volver || (r.usuario.rol === 'administrador' ? '/admin.html' : '/');
    } catch (err) {
      error.replaceChildren(el('div', { class: 'aviso error' }, err.message));
      boton.disabled = false; boton.textContent = 'Ingresar';
      clave.value = ''; clave.focus();
    }
  } },
    el('div', { class: 'campo' }, el('label', { for: 'correo' }, 'Correo institucional ', el('span', { class: 'req' }, '*')), correo),
    el('div', { class: 'campo' }, el('label', { for: 'clave' }, 'Contraseña ', el('span', { class: 'req' }, '*')), clave),
    boton);

  contenido.replaceChildren(
    migas([['Inicio', '/'], ['Iniciar sesión']]),
    el('div', { class: 'panel login' },
      el('img', { class: 'logo', src: '/img/logo-unimayor-amarillo.png', alt: 'Logo Unimayor' }),
      el('h1', {}, 'Iniciar sesión'),
      el('p', { class: 'nota' }, 'Usa tus credenciales institucionales de UNIMAYOR'),
      avisoEvento, error, form,
      el('p', { class: 'pie-nota' }, 'Entorno de demostración: la autenticación es propia del prototipo.'),
      el('div', { class: 'credenciales' },
        el('b', {}, 'Usuarios de prueba'), ' (contraseña ', el('code', {}, 'Prueba123'), '):',
        el('br'), 'Estudiante: ', el('code', {}, 'est@prueba.edu.co'),
        el('br'), 'Docente: ', el('code', {}, 'doc@prueba.edu.co'),
        el('br'), 'Administrador: ', el('code', {}, 'admin@prueba.edu.co'))));
  correo.focus();
});
