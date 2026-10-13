# Mi Turno - Sistema de Gestión de Turnos (v2.4.0)

Plataforma web completa y empresarial para la gestión de colas, turnos y atención al cliente/usuario, adaptable a cualquier empresa de servicios: clínicas, hospitales, bancos, municipalidades, oficinas de atención ciudadana, tiendas y más.

---

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Stack Tecnológico](#stack-tecnológico)
- [Módulos y Funcionalidades](#módulos-y-funcionalidades)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación y Configuración](#instalación-y-configuración)
- [Variables de Entorno](#variables-de-entorno)
- [API Reference](#api-reference)
- [Modelos de Base de Datos](#modelos-de-base-de-datos)
- [WebSockets (Tiempo Real)](#websockets-tiempo-real)
- [Credenciales por Defecto](#credenciales-por-defecto)

---

## Descripción General

**Mi Turno** es un sistema empresarial de gestión de filas, citas y atención de usuarios desarrollado con arquitectura web multi-vista desacoplada en Node.js, PostgreSQL y Nginx. Permite a cualquier organización administrar la atención mediante:

- **Quiosco de autoservicio en 2 Pasos** — Registro por Nombre, Cédula o Teléfono + Selección de Área de Servicio.
- **Panel del Operador con Apertura de Puesto** — Modal de inicio de jornada, panel libre de distracciones con columna derecha expandida, re-llamado e historial.
- **Pantalla TV Pública y Pantalla TV Administrativa Separadas** — Transmisión por separado para áreas generales de atención y para oficinas/citas administrativas.
- **Carrusel de Anuncios Multimedia Cíclico** — Transmisión automatizada de fotos, videos y avisos institucionales para pantallas TV de 55".
- **Reserva de Citas y Panel de Recepción (Secretaría)** — Agendamiento previo con envío de confirmaciones por correo e-mail, comprobante imprimible y registro de visitantes presenciales (Walk-in).

---

## Stack Tecnológico

### Backend
| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Node.js | >=20.0.0 | Runtime |
| Express | ^4.19.2 | Framework HTTP |
| Socket.io | ^4.7.5 | WebSockets tiempo real |
| Sequelize | ^6.37.3 | ORM |
| PostgreSQL | 16 | Base de datos relacional |
| Nodemailer | ^6.9.13 | Envío de correos de confirmación |
| express-rate-limit | ^7.3.0 | Seguridad y Rate Limiting |
| express-validator | ^7.1.0 | Validación estricta de entradas |
| JSON Web Token | ^9.0.2 | Autenticación |
| bcryptjs | ^2.4.3 | Encriptación de contraseñas |

### Frontend
| Tecnología | Uso |
|-----------|-----|
| HTML5 / CSS3 / Vanilla JS | Estructura, estilos y lógica modular |
| Chart.js ^4.4.0 | Gráficas analíticas interactivas |
| Socket.io Client ^4.7.5 | Sincronización en tiempo real |
| Font Awesome 6.5 | Iconografía institucional |
| Web Speech API | Síntesis de voz para llamado de turnos (TTS) |
| Web Audio API | Generador de 5 tonos de campanada sintetizados |
| PWA Service Worker | Instalación en tablets y soporte fuera de línea |

---

## Módulos y Funcionalidades

### 1. Quiosco de Autoservicio (`kiosk.html`)
- **Flujo en 2 Pasos:**
  - **Paso 1:** Registro del usuario (Nombre, Cédula o Teléfono) e indicación de atención preferencial (*Discapacidad, Adulto Mayor, Embarazada, Condición Especial*).
  - **Paso 2:** Selección del Área de Servicio requerida (filtrado para atención pública).
- **Reimpresión de Turnos Mejorada:** Búsqueda por número o nombre y pestaña para explorar turnos emitidos en el día por área de servicio.
- **Confirmación de Cita ("Tengo una Cita"):** Ingreso de código de 6 dígitos para emitir e imprimir ticket presencial.
- **Predicción de Espera (ETA):** Cálculo del tiempo estimado de espera mostrado en el boleto.
- **Timeout de Inactividad:** Retorno automático al Paso 1 tras 45 segundos de inactividad.

### 2. Panel del Operador (`call.html`)
- **Modal de Apertura de Puesto / Inicio de Jornada:** Selección obligatoria de Área de Servicio, Mostrador y Modo de Voz al ingresar.
- **Botonera Limpia:** Inhabilitación de llamados accidentales si el puesto no está activo, botón *"Cambiar Puesto"* y *"Finalizar Jornada"*.
- **Opciones de Llamado:**
  - Botón principal *"Llamar por Nombre de Usuario"* e individuales en cada fila.
  - Selector de modo de voz (*Por Nombre*, *Por Número de Turno* o *Ambos*).
  - Botón de **Repetir llamada** sincronizado con la pantalla TV pública/administrativa.
- **Historial Reciente:** Pestañas `En Espera` vs `Historial Reciente (Atendidos / Ausentes)` con botón de **Re-llamar** directo.
- Derivación/transferencia de turnos entre áreas de servicio.

### 3. Pantallas TV Separadas (`display.html` y `display.html?type=administrative`)
- **Pantalla TV Pública:** Transmite únicamente llamados de la cola general de atención.
- **Pantalla TV Administrativa:** Transmite únicamente llamadas formales de oficinas y citas administrativas.
- **Tarjeta Hero & Grilla Multi-Mostrador:** Visualización del nombre del usuario (`Usuario: MARIA TERESA MENDEZ`) y grilla inferior en 3 columnas (2x3).
- **Carrusel Multimedia Cíclico:** Transmisión automatizada de imágenes, videos MP4 y tarjetas informativas con tiempo programado por diapositiva.
- **5 Tonos de Campanada Sintetizados:** Ding-Dong Clásico, Aeropuerto, Beep Digital, Marimba y Melodía Fanfarria.

### 4. Reserva de Citas y Panel de Recepción (`appointments.html`)
- **Envío de Correo Electrónico:** Confirmación automática con código de 6 dígitos e instrucciones.
- **Impresión de Comprobante:** Botón *"Imprimir Comprobante de Cita"* para tiques térmicos/estándar.
- **Panel de Secretaría:**
  - Agenda del día ordenada por hora programada.
  - Botón *"Marcar Presente en Recepción"*.
  - Botón *"Llamar a Cita"* formal por nombre y oficina.
  - Botón *"Registrar Visitante (Sin Cita)"* para ingresar usuarios presenciales (Walk-in).

### 5. Gestión de Áreas de Servicio (`services.html`)
- Clasificación de áreas mediante el selector **Tipo de Área**: `Atención Pública / General` vs `Oficina Administrativa`.

---

## Estructura del Proyecto

```
gestion de turno/
├── .env
├── .env.example
├── docker-compose.yml
├── README.md
├── CHANGELOG.md
├── ROADMAP.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── config/db.js
│       ├── middleware/
│       │   ├── auth.js
│       │   └── validate.js
│       ├── models/
│       │   ├── index.js
│       │   ├── Announcement.js
│       │   ├── Appointment.js
│       │   ├── Counter.js
│       │   ├── Role.js
│       │   ├── Service.js
│       │   ├── Setting.js
│       │   ├── SystemLog.js
│       │   ├── Ticket.js
│       │   ├── User.js
│       │   └── Webhook.js
│       ├── routes/
│       │   ├── announcements.js
│       │   ├── appointments.js
│       │   ├── auth.js
│       │   ├── counters.js
│       │   ├── logs.js
│       │   ├── reports.js
│       │   ├── roles.js
│       │   ├── services.js
│       │   ├── settings.js
│       │   ├── tickets.js
│       │   ├── users.js
│       │   └── webhooks.js
│       ├── services/
│       │   ├── email.js
│       │   ├── eta.js
│       │   ├── notifications.js
│       │   └── webhooks.js
│       └── seeders/seed.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── app.js
    ├── sw.js
    ├── manifest.json
    ├── styles.css
    ├── mascot.jpg
    ├── login.html
    ├── dashboard.html
    ├── kiosk.html
    ├── call.html
    ├── display.html
    ├── appointments.html
    ├── services.html
    ├── counters.html
    ├── users.html
    ├── roles.html
    ├── reports.html
    ├── announcements.html
    ├── settings.html
    └── logs.html
```

---

## URLs del Sistema

| Módulo | URL |
|------|-----|
| Login / Inicio | http://localhost:8088/login.html |
| Tablero de Control | http://localhost:8088/dashboard.html |
| Panel del Operador | http://localhost:8088/call.html |
| Pantalla TV Pública | http://localhost:8088/display.html |
| Pantalla TV Administrativa | http://localhost:8088/display.html?type=administrative |
| Quiosco de Clientes | http://localhost:8088/kiosk.html |
| Reserva de Citas / Recepción | http://localhost:8088/appointments.html |
| Gestión de Roles | http://localhost:8088/roles.html |
| Reportes | http://localhost:8088/reports.html |
| Auditoría y Logs | http://localhost:8088/logs.html |
| API Health Check | http://localhost:8088/api/health |

---

## Credenciales por Defecto

| Campo | Valor |
|-------|-------|
| Email | `admin@miturno.com` |
| Password | `admin123` |
| Rol | Administrador |

---

## Licencia

Licencia Propietaria Comercial © 2026 — Todos los Derechos Reservados (Guzman-Tech / Jose Alberto Guzman).  
Para adquisiciones, licencias SaaS o contratos de implementación, contacte a `aguzman0522@gmail.com`.
