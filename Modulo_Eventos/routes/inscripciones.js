const router = require('express').Router();
const db = require('../db');
const { verificarSesion, soloRol } = require('../middleware/auth');

const inscribir = db.transaction((usuarioId, eventoId) => {
  const ev = db.prepare('SELECT cupo_maximo,fecha_hora,estado FROM eventos WHERE id=?').get(eventoId);
  if (!ev || ev.estado !== 'activo')
    return { ok: false, codigo: 404, mensaje: 'El evento no existe.' };
  if (new Date(ev.fecha_hora) < new Date())
    return { ok: false, codigo: 409, mensaje: 'El evento ya pasó.' };
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM inscripciones WHERE evento_id=? AND estado='activa'").get(eventoId);
  if (n >= ev.cupo_maximo)
    return { ok: false, codigo: 409, mensaje: 'Cupo agotado.' };
  try {
    db.prepare('INSERT INTO inscripciones (usuario_id,evento_id) VALUES (?,?)').run(usuarioId, eventoId);
  } catch {
    return { ok: false, codigo: 409, mensaje: 'Ya estás inscrito.' };
  }
  return { ok: true, cupos: ev.cupo_maximo - n - 1 };
});

const roles = soloRol('estudiante', 'docente');

router.post('/eventos/:id/inscripcion', verificarSesion, roles, (req, res) => {
  const r = inscribir(req.usuario.id, Number(req.params.id));
  if (!r.ok) return res.status(r.codigo).json({ mensaje: r.mensaje });
  res.status(201).json({ mensaje: 'Inscripción exitosa.', cupos_disponibles: r.cupos });
});

router.delete('/eventos/:id/inscripcion', verificarSesion, roles, (req, res) => {
  const r = db.prepare(`UPDATE inscripciones SET estado='cancelada', fecha_cancelacion=datetime('now')
    WHERE usuario_id=? AND evento_id=? AND estado='activa'`).run(req.usuario.id, req.params.id);
  if (!r.changes) return res.status(404).json({ mensaje: 'No tienes inscripción activa.' });
  res.json({ mensaje: 'Inscripción cancelada.' });
});

router.get('/mis-inscripciones', verificarSesion, roles, (req, res) => {
  res.json(db.prepare(`SELECT e.id,e.nombre,e.categoria,e.fecha_hora,e.lugar,i.fecha_inscripcion
    FROM inscripciones i JOIN eventos e ON e.id=i.evento_id
    WHERE i.usuario_id=? AND i.estado='activa' ORDER BY e.fecha_hora`).all(req.usuario.id));
});

module.exports = router;