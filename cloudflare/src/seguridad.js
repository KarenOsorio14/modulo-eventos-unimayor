// Seguridad con la Web Crypto API (disponible en Cloudflare Workers sin librerías):
// - Contraseñas: PBKDF2-SHA256 con sal aleatoria (reemplaza a bcrypt).
// - Sesión: tokens JWT firmados con HMAC-SHA256 (reemplaza a jsonwebtoken).

const enc = new TextEncoder();

const aBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deBase64 = texto => Uint8Array.from(atob(texto), c => c.charCodeAt(0));
const aBase64Url = bytes => aBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64Url = texto => deBase64(texto.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((texto.length + 3) % 4));

// Comparación en tiempo constante para no filtrar información por tiempos de respuesta
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

// ---------- Contraseñas ----------
async function derivar(password, sal, iteraciones) {
  const clave = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, clave, 256));
}

// Formato guardado: pbkdf2$<iteraciones>$<sal base64>$<hash base64>
export async function cifrarPassword(password) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(password, sal, 100000);
  return `pbkdf2$100000$${aBase64(sal)}$${aBase64(hash)}`;
}

export async function verificarPassword(password, guardado) {
  const [tipo, iter, sal, hash] = String(guardado).split('$');
  if (tipo !== 'pbkdf2') return false;
  const calculado = await derivar(password, deBase64(sal), Number(iter));
  return iguales(calculado, deBase64(hash));
}

// ---------- JWT (HS256) ----------
const claveHmac = secreto =>
  crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function firmarToken(datos, secreto, segundos = 8 * 60 * 60) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = aBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const cuerpo = aBase64Url(enc.encode(JSON.stringify({ ...datos, iat: ahora, exp: ahora + segundos })));
  const firma = await crypto.subtle.sign('HMAC', await claveHmac(secreto), enc.encode(`${cabecera}.${cuerpo}`));
  return `${cabecera}.${cuerpo}.${aBase64Url(firma)}`;
}

// Devuelve los datos del token, o null si es inválido o expiró
export async function verificarToken(token, secreto) {
  const partes = String(token).split('.');
  if (partes.length !== 3) return null;
  const [cabecera, cuerpo, firma] = partes;
  try {
    const valida = await crypto.subtle.verify('HMAC', await claveHmac(secreto), deBase64Url(firma), enc.encode(`${cabecera}.${cuerpo}`));
    if (!valida) return null;
    if (JSON.parse(new TextDecoder().decode(deBase64Url(cabecera))).alg !== 'HS256') return null;
    const datos = JSON.parse(new TextDecoder().decode(deBase64Url(cuerpo)));
    if (!datos.exp || datos.exp < Date.now() / 1000) return null;
    return datos;
  } catch {
    return null;
  }
}
