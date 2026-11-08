const bcrypt = require('bcrypt');
const db = require('./db');

const hash = bcrypt.hashSync('Prueba123', 10);
const u = db.prepare('INSERT OR IGNORE INTO usuarios (nombre,correo,password_hash,rol) VALUES (?,?,?,?)');
u.run('Admin Prueba', 'admin@prueba.edu.co', hash, 'administrador');
u.run('Estudiante Prueba', 'est@prueba.edu.co', hash, 'estudiante');
u.run('Docente Prueba', 'doc@prueba.edu.co', hash, 'docente');

const e = db.prepare(`INSERT INTO eventos
 (nombre,categoria,descripcion,fecha_hora,lugar,cupo_maximo,organizador,creado_por)
 VALUES (?,?,?,?,?,?,?,1)`);
e.run('Torneo de fútbol sala','deportivo','Torneo interfacultades','2026-11-20T15:00','Coliseo',20,'Bienestar');
e.run('Noche de teatro','cultural','Obra estudiantil','2026-11-25T18:00','Auditorio',1,'Cultura');

console.log('Datos de prueba cargados');