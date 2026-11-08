const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verificarSesion } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password)
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios.' });
  const u = db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo);
  if (!u || !bcrypt.compareSync(password, u.password_hash))
    return res.status(401).json({ mensaje: 'Credenciales incorrectas.' });
  const token = jwt.sign({ id: u.id, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol } });
});

router.get('/yo', verificarSesion, (req, res) => {
  const u = db.prepare('SELECT id,nombre,correo,rol FROM usuarios WHERE id = ?').get(req.usuario.id);
  res.json(u);
});

module.exports = router;