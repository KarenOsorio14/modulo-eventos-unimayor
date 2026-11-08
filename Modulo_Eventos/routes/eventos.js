const router = require('express').Router();
const db = require('../db');
const { verificarSesion, soloRol } = require('../middleware/auth');

// Listar vigentes con filtros (RF-03, 04, 06)
router.get('/', (req, res) => {
  const { categoria, fecha } = req.query;
  let sql = `SELECT * FROM v_eventos_cupos
             WHERE estado='activo' AND fecha_hora >= datetime('now','localtime')`;
  const p = [];
  if (categoria) { sql += ' AND categoria = ?'; p.push(categoria); }
  if (fecha)     { sql += ' AND substr(fecha_hora,1,10) = ?'; p.push(fecha); }
  sql += ' ORDER BY fecha_hora';
  res.json(db.prepare(sql).all(...p));
});

router.get('/:id', (req, res) => {
  const ev = db.prepare('SELECT * FROM v_eventos_cupos WHERE id=? AND estado=\'activo\'').get(req.params.id);
  if (!ev) return res.status(404).json({ mensaje: 'El evento no existe.' });
  res.json(ev);
});

// Crear (admin)
router.post('/', verificarSesion, soloRol('administrador'), (req, res) => {
  const { nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, imagen_url, organizador } = req.body;
  if (!nombre || !categoria || !descripcion || !fecha_hora || !lugar || !(cupo_maximo > 0))
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios o son inválidos.' });
  if (!['deportivo','cultural'].includes(categoria))
    return res.status(400).json({ mensaje: 'Categoría inválida.' });
  const r = db.prepare(`INSERT INTO eventos
    (nombre,categoria,descripcion,fecha_hora,lugar,cupo_maximo,imagen_url,organizador,creado_por)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, imagen_url, organizador, req.usuario.id);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Editar (admin)
router.put('/:id', verificarSesion, soloRol('administrador'), (req, res) => {
  const { nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, imagen_url, organizador } = req.body;
  const r = db.prepare(`UPDATE eventos SET nombre=?,categoria=?,descripcion=?,fecha_hora=?,
    lugar=?,cupo_maximo=?,imagen_url=?,organizador=? WHERE id=?`)
    .run(nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, imagen_url, organizador, req.params.id);
  if (!r.changes) return res.status(404).json({ mensaje: 'El evento no existe.' });
  res.json({ mensaje: 'Evento actualizado.' });
});

// Baja (admin)
router.delete('/:id', verificarSesion, soloRol('administrador'), (req, res) => {
  const r = db.prepare("UPDATE eventos SET estado='baja' WHERE id=?").run(req.params.id);
  if (!r.changes) return res.status(404).json({ mensaje: 'El evento no existe.' });
  res.json({ mensaje: 'Evento dado de baja.' });
});

// Inscritos (admin, RF-13)
router.get('/:id/inscritos', verificarSesion, soloRol('administrador'), (req, res) => {
  const lista = db.prepare(`SELECT u.nombre,u.correo,i.fecha_inscripcion
    FROM inscripciones i JOIN usuarios u ON u.id=i.usuario_id
    WHERE i.evento_id=? AND i.estado='activa'`).all(req.params.id);
  res.json({ cantidad: lista.length, inscritos: lista });
});

module.exports = router;