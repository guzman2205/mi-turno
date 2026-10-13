# 🏗️ Plan de Arquitectura — Hospiturno v2 (Dockerizado)

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | HTML + CSS + Vanilla JS (servido por Nginx) |
| **Backend** | Node.js 20 + Express 4 + Socket.io |
| **Base de datos** | PostgreSQL 16 |
| **ORM** | Sequelize 6 |
| **Auth** | JWT (jsonwebtoken) + bcrypt |
| **Tiempo real** | Socket.io (display y llamadas en vivo) |
| **Contenedores** | Docker Compose v3 |

---

## Estructura de Directorios

```
gestion de turno/
├── docker-compose.yml          ← Orquesta todos los servicios
├── .env                        ← Variables de entorno
├── .env.example
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           ← Entry point
│       ├── config/
│       │   └── db.js           ← Conexión PostgreSQL
│       ├── models/
│       │   ├── index.js
│       │   ├── User.js
│       │   ├── Role.js
│       │   ├── Service.js
│       │   ├── Counter.js
│       │   ├── Ticket.js
│       │   └── Announcement.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── users.js
│       │   ├── roles.js
│       │   ├── services.js
│       │   ├── counters.js
│       │   ├── tickets.js
│       │   ├── announcements.js
│       │   ├── reports.js
│       │   └── settings.js
│       ├── middleware/
│       │   └── auth.js         ← JWT middleware
│       └── seeders/
│           └── seed.js         ← Datos iniciales
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── styles.css
    ├── app.js                  ← API client + utils
    ├── login.html
    ├── dashboard.html
    ├── kiosk.html              ← Quiosco cliente
    ├── display.html            ← Pantalla TV pública
    ├── call.html               ← Panel del agente
    ├── counters.html
    ├── services.html
    ├── users.html
    ├── roles.html
    ├── announcements.html
    ├── reports.html
    ├── settings.html
    └── logs.html
```

---

## Servicios Docker

```yaml
services:
  postgres    → puerto 5432 (datos persistentes en volumen)
  backend     → puerto 3000 (API REST + Socket.io)
  frontend    → puerto 80   (Nginx sirviendo archivos estáticos)
```

---

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | /api/auth/login | Autenticación |
| GET  | /api/auth/me | Usuario actual |
| GET/POST | /api/users | Usuarios |
| PUT/DELETE | /api/users/:id | Editar/eliminar usuario |
| GET/POST | /api/roles | Roles |
| GET/POST | /api/services | Servicios |
| GET/POST | /api/counters | Mostradores |
| GET/POST | /api/tickets | Tickets/Turnos |
| POST | /api/tickets/call-next | Llamar siguiente turno |
| POST | /api/tickets/mark-absent | Marcar ausente |
| GET  | /api/tickets/queue | Cola actual |
| GET/POST | /api/announcements | Anuncios |
| GET  | /api/reports/daily | Reporte del día |
| GET  | /api/reports/monthly | Reporte mensual |
| GET/PUT | /api/settings | Configuración |
| GET  | /api/logs | Eventos del sistema |

---

## Esquema de Base de Datos

```sql
roles        → id, name, description, permissions (jsonb)
users        → id, name, email, password_hash, role_id, active
services     → id, name, prefix, color, icon, active
counters     → id, name, agent_id, service_id, status
tickets      → id, number, service_id, counter_id, agent_id, status, 
               created_at, called_at, attended_at
announcements→ id, title, body, active, created_at
settings     → id, key, value (key-value store)
system_logs  → id, user_id, action, details, ip, created_at
```

---

## Eventos Socket.io (Tiempo Real)

| Evento | Descripción |
|---|---|
| `ticket:new` | Nuevo turno generado en quiosco |
| `ticket:called` | Turno llamado a mostrador |
| `ticket:attended` | Turno marcado como atendido |
| `ticket:absent` | Turno marcado como ausente |
| `counter:update` | Estado del mostrador actualizado |
| `display:refresh` | Refrescar pantalla pública |
