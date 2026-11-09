# Módulo de Gestión de Eventos – Unimayor

**Demo en línea:** https://modulo-eventos-unimayor.kd1.workers.dev

Prototipo de módulo web de eventos deportivos y culturales de la Institución Universitaria Colegio Mayor del Cauca. Proyecto del equipo **FunAcorn** para Gestión de Proyectos Informáticos.

Permite consultar el catálogo de eventos sin iniciar sesión, filtrar por categoría y fecha, inscribirse con control de cupos y administrar los eventos.

## Equipo

| Integrante | Rol |
| --- | --- |
| Isabella Velasco Idrobo | Gerente de proyecto |
| Kevin Camilo Sepúlveda Meneses | Desarrollo frontend y backend |
| Karen Dayana Osorio Calambaz | Diseño UX/UI |
| Silvana Manquillo Quira | Pruebas (QA) |

## Tecnologías

- **Frontend:** HTML, CSS y JavaScript puro (sin frameworks).
- **Backend:** Node.js con Express (API REST).
- **Base de datos:** SQLite con better-sqlite3.
- **Autenticación:** JWT y contraseñas cifradas con bcrypt.

## Cómo correrlo

Requisitos: [Node.js](https://nodejs.org) 20 o superior.

```bash
cd Modulo_Eventos
npm install
cp .env.example .env      # en Windows: copy .env.example .env
node seed.js              # crea la base de datos con usuarios y eventos de prueba
npm start
```

Abre <http://localhost:3000>.

`node seed.js` se puede correr varias veces: no duplica los datos. Para empezar de cero, borra `eventos.db` y vuelve a correrlo.

### Usuarios de prueba

Todos usan la contraseña `Prueba123`.

| Rol | Correo |
| --- | --- |
| Estudiante | est@prueba.edu.co |
| Docente | doc@prueba.edu.co |
| Administrador | admin@prueba.edu.co |

## Versión en línea (Cloudflare)

La carpeta `cloudflare/` tiene la misma API adaptada a **Cloudflare Workers** con la base de datos **D1** (también SQLite). Usa las mismas páginas de `Modulo_Eventos/public`.

Diferencias con la versión Node:
- **Contraseñas:** PBKDF2-SHA256 con la Web Crypto API en lugar de bcrypt (Workers no corre módulos nativos).
- **Sin sobrecupos:** D1 no tiene transacciones interactivas, así que la verificación del cupo y el registro se hacen en una sola sentencia `INSERT … SELECT`, que es atómica. Probado con 20 inscripciones simultáneas a un evento de 1 cupo: solo una se acepta.
- **Hora:** se usa la hora de Colombia (UTC-5).

### Desplegar

Requisitos: una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).

```bash
cd cloudflare
npm install
npx wrangler login                        # abre el navegador para autorizar
npx wrangler d1 create modulo-eventos-db  # copia el database_id en wrangler.jsonc
npm run db:remota                         # crea las tablas y los datos de prueba
npm run deploy                            # publica y muestra la dirección .workers.dev
npx wrangler secret put JWT_SECRET        # escribe una clave larga y secreta
```

Para probarlo en tu computador: copia `.dev.vars.example` como `.dev.vars`, corre `npm run db:local` y después `npm run dev`.

## Páginas

| Página | Qué hace | Requerimientos |
| --- | --- | --- |
| `index.html` | Catálogo con filtros por categoría y fecha, y búsqueda | RF-03, RF-04, RF-06, CU-01 |
| `evento.html` | Detalle, cupos e inscripción | RF-05 a RF-10, CU-02 |
| `login.html` | Inicio de sesión; vuelve al evento que se estaba viendo | RF-01 |
| `mis-inscripciones.html` | Inscripciones del usuario y cancelación | RF-11, RF-12 |
| `admin.html` | Panel, crear, editar, dar de baja y ver inscritos | RF-13, RF-14, CU-03 |

## API

| Método | Ruta | Acceso | Función |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Público | Iniciar sesión y recibir el token |
| GET | `/api/auth/yo` | Autenticado | Datos y rol del usuario actual |
| GET | `/api/eventos?categoria=&fecha=` | Público | Eventos vigentes con filtros y cupos (`?todos=1` solo administrador) |
| GET | `/api/eventos/:id` | Público | Detalle de un evento |
| POST | `/api/eventos/:id/inscripcion` | Estudiante, docente | Inscribirse (valida cupo, duplicado y fecha) |
| DELETE | `/api/eventos/:id/inscripcion` | Estudiante, docente | Cancelar la inscripción y liberar el cupo |
| GET | `/api/mis-inscripciones` | Estudiante, docente | Eventos en los que está inscrito |
| POST | `/api/eventos` | Administrador | Crear evento |
| PUT | `/api/eventos/:id` | Administrador | Editar evento |
| DELETE | `/api/eventos/:id` | Administrador | Dar de baja (no borra las inscripciones) |
| GET | `/api/eventos/:id/inscritos` | Administrador | Cantidad y lista de inscritos |

## Reglas importantes

- **Sin sobrecupos (RNF-03):** verificar el cupo y registrar la inscripción ocurren en una sola transacción. Probado con 20 inscripciones simultáneas a un evento de 1 cupo: solo una se acepta.
- **Una inscripción activa por persona y evento (RN-02):** índice único en la base de datos.
- **Eventos pasados no admiten inscripciones (RN-04).**
- **Solo el administrador gestiona eventos (RN-06).**
- **Dar de baja no borra inscripciones (RF-14):** el evento sale del catálogo y en "Mis inscripciones" aparece como cancelado.
