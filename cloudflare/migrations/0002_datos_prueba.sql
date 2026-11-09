-- Usuarios y eventos de prueba. Contraseña de todos: Prueba123
-- (cifrada con PBKDF2-SHA256, 100.000 iteraciones)
INSERT OR IGNORE INTO usuarios (nombre, correo, password_hash, rol) VALUES
  ('Administrador de prueba', 'admin@prueba.edu.co', 'pbkdf2$100000$aD87HUrDEIv2c1qDEWUEYg==$NdakU6w1spSTO/6zbaLKXuXjm6ZjDhUFT6siaETHW+s=', 'administrador'),
  ('Estudiante de prueba',    'est@prueba.edu.co',   'pbkdf2$100000$aD87HUrDEIv2c1qDEWUEYg==$NdakU6w1spSTO/6zbaLKXuXjm6ZjDhUFT6siaETHW+s=', 'estudiante'),
  ('Docente de prueba',       'doc@prueba.edu.co',   'pbkdf2$100000$aD87HUrDEIv2c1qDEWUEYg==$NdakU6w1spSTO/6zbaLKXuXjm6ZjDhUFT6siaETHW+s=', 'docente');

-- Eventos con fechas relativas al día en que se aplica la migración (hora de Colombia, UTC-5)
INSERT INTO eventos (nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, organizador, creado_por)
SELECT 'Copa Honor UNIMAYOR 2026', 'deportivo', 'Torneo interno. Participa con tu equipo o asiste como público. Las inscripciones se confirman al instante y el cupo se descuenta en el momento de la solicitud.',
       strftime('%Y-%m-%d', 'now', '-5 hours', '+5 days') || 'T08:00', 'Coliseo Universitario', 40, 'Bienestar Institucional',
       (SELECT id FROM usuarios WHERE correo = 'admin@prueba.edu.co')
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Copa Honor UNIMAYOR 2026');

INSERT INTO eventos (nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, organizador, creado_por)
SELECT 'Música en Movimiento', 'cultural', '3ra. versión del taller de música y laboratorio sonoro, abierto a toda la comunidad universitaria.',
       strftime('%Y-%m-%d', 'now', '-5 hours', '+7 days') || 'T16:00', 'Auditorio principal', 40, 'Bienestar Institucional',
       (SELECT id FROM usuarios WHERE correo = 'admin@prueba.edu.co')
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Música en Movimiento');

INSERT INTO eventos (nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, organizador, creado_por)
SELECT 'Campeonato de Voleibol Mixto', 'deportivo', 'Campeonato inter-programas en equipos mixtos.',
       strftime('%Y-%m-%d', 'now', '-5 hours', '+9 days') || 'T09:00', 'Cancha múltiple', 1, 'Bienestar Institucional',
       (SELECT id FROM usuarios WHERE correo = 'admin@prueba.edu.co')
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Campeonato de Voleibol Mixto');

INSERT INTO eventos (nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, organizador, creado_por)
SELECT 'Presentación de Danza Folclórica', 'cultural', 'Muestra cultural del grupo de danzas de la institución.',
       strftime('%Y-%m-%d', 'now', '-5 hours', '+11 days') || 'T18:00', 'Auditorio principal', 40, 'Bienestar Institucional',
       (SELECT id FROM usuarios WHERE correo = 'admin@prueba.edu.co')
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Presentación de Danza Folclórica');

INSERT INTO eventos (nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, organizador, creado_por)
SELECT 'Cine Foro: Cortometrajes Caucanos', 'cultural', 'Ciclo de cine con conversatorio al final de cada función.',
       strftime('%Y-%m-%d', 'now', '-5 hours', '+14 days') || 'T16:00', 'Sala de audiovisuales', 30, 'Bienestar Institucional',
       (SELECT id FROM usuarios WHERE correo = 'admin@prueba.edu.co')
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Cine Foro: Cortometrajes Caucanos');

INSERT INTO eventos (nombre, categoria, descripcion, fecha_hora, lugar, cupo_maximo, organizador, creado_por)
SELECT 'Torneo de Fútbol Sala', 'deportivo', 'Torneo interno interfacultades.',
       strftime('%Y-%m-%d', 'now', '-5 hours', '+16 days') || 'T08:00', 'Coliseo Universitario', 40, 'Bienestar Institucional',
       (SELECT id FROM usuarios WHERE correo = 'admin@prueba.edu.co')
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Torneo de Fútbol Sala');
