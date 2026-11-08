PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL CHECK (rol IN ('estudiante','docente','administrador')),
  creado_en     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  categoria   TEXT NOT NULL CHECK (categoria IN ('deportivo','cultural')),
  descripcion TEXT NOT NULL,
  fecha_hora  TEXT NOT NULL,
  lugar       TEXT NOT NULL,
  cupo_maximo INTEGER NOT NULL CHECK (cupo_maximo > 0),
  imagen_url  TEXT,
  organizador TEXT,
  estado      TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','baja')),
  creado_por  INTEGER REFERENCES usuarios(id),
  creado_en   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inscripciones (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
  evento_id         INTEGER NOT NULL REFERENCES eventos(id),
  estado            TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cancelada')),
  fecha_inscripcion TEXT DEFAULT (datetime('now')),
  fecha_cancelacion TEXT
);

-- Una sola inscripción ACTIVA por usuario y evento
CREATE UNIQUE INDEX IF NOT EXISTS ux_inscripcion_activa
  ON inscripciones (usuario_id, evento_id) WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS ix_eventos_fecha ON eventos (fecha_hora);
CREATE INDEX IF NOT EXISTS ix_insc_evento   ON inscripciones (evento_id, estado);

-- Cupos disponibles se calculan, no se guardan (evita datos desincronizados)
CREATE VIEW IF NOT EXISTS v_eventos_cupos AS
SELECT e.*,
       e.cupo_maximo - COUNT(i.id) AS cupos_disponibles
FROM eventos e
LEFT JOIN inscripciones i ON i.evento_id = e.id AND i.estado = 'activa'
GROUP BY e.id;
