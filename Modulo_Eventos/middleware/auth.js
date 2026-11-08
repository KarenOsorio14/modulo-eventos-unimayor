const jwt = require('jsonwebtoken');

function verificarSesion(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ mensaje: 'Debes iniciar sesión.' });
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET); // {id, rol}
    next();
  } catch {
    res.status(401).json({ mensaje: 'Sesión inválida o expirada.' });
  }
}

const soloRol = (...roles) => (req, res, next) =>
  roles.includes(req.usuario.rol)
    ? next()
    : res.status(403).json({ mensaje: 'No tienes permiso.' });

module.exports = { verificarSesion, soloRol };