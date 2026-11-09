// Carga usuarios y eventos de prueba. Se puede correr varias veces sin duplicar datos.
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db');

const hash = bcrypt.hashSync('Prueba123', 10);
const u = db.prepare('INSERT OR IGNORE INTO usuarios (nombre,correo,password_hash,rol) VALUES (?,?,?,?)');
u.run('Administrador de prueba', 'admin@prueba.edu.co', hash, 'administrador');
u.run('Estudiante de prueba', 'est@prueba.edu.co', hash, 'estudiante');
u.run('Docente de prueba', 'doc@prueba.edu.co', hash, 'docente');
const adminId = db.prepare("SELECT id FROM usuarios WHERE correo='admin@prueba.edu.co'").get().id;

// Fechas relativas a hoy, para que los eventos siempre estén vigentes
const enDias = (d, hora) => {
  const f = new Date(); f.setDate(f.getDate() + d);
  const p = n => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${hora}`;
};

const { n } = db.prepare('SELECT COUNT(*) AS n FROM eventos').get();
if (n === 0) {
  const e = db.prepare(`INSERT INTO eventos
    (nombre,categoria,descripcion,fecha_hora,lugar,cupo_maximo,organizador,creado_por)
    VALUES (?,?,?,?,?,?,?,?)`);
  const eventos = [
    ['Copa Honor UNIMAYOR 2026', 'deportivo', 'Torneo interno. Participa con tu equipo o asiste como público. Las inscripciones se confirman al instante y el cupo se descuenta en el momento de la solicitud.', enDias(5, '08:00'), 'Coliseo Universitario', 40, 'Bienestar Institucional'],
    ['Música en Movimiento', 'cultural', '3ra. versión del taller de música y laboratorio sonoro, abierto a toda la comunidad universitaria.', enDias(7, '16:00'), 'Auditorio principal', 40, 'Bienestar Institucional'],
    ['Campeonato de Voleibol Mixto', 'deportivo', 'Campeonato inter-programas en equipos mixtos.', enDias(9, '09:00'), 'Cancha múltiple', 1, 'Bienestar Institucional'],
    ['Presentación de Danza Folclórica', 'cultural', 'Muestra cultural del grupo de danzas de la institución.', enDias(11, '18:00'), 'Auditorio principal', 40, 'Bienestar Institucional'],
    ['Cine Foro: Cortometrajes Caucanos', 'cultural', 'Ciclo de cine con conversatorio al final de cada función.', enDias(14, '16:00'), 'Sala de audiovisuales', 30, 'Bienestar Institucional'],
    ['Torneo de Fútbol Sala', 'deportivo', 'Torneo interno interfacultades.', enDias(16, '08:00'), 'Coliseo Universitario', 40, 'Bienestar Institucional'],
  ];
  for (const ev of eventos) e.run(...ev, adminId);
}

console.log('Datos de prueba cargados');
