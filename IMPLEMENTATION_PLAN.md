# Plan de Implementación por Fases — Mi Turno v2.x

> Documento de planificación técnica detallado para el equipo de desarrollo.
> Cada fase incluye tareas específicas, archivos a modificar, dependencias y criterios de éxito.

**Versión base:** 2.0.0 ✅ Completada  
**Metodología:** Iterativa por fase — cada versión es desplegable de forma independiente

---

## Resumen de Fases

| Fase | Versión | Enfoque | Estimado | Complejidad |
|------|---------|---------|----------|-------------|
| [Fase 0](#fase-0--deuda-técnica-base-prerequisito) | pre-2.1 | Deuda técnica crítica | 3–5 días | 🟡 Media |
| [Fase 1](#fase-1--v210-estabilización-y-ux) | v2.1.0 | UX y estabilización | 8–12 días | 🟢 Baja |
| [Fase 2](#fase-2--v220-funcionalidades-avanzadas) | v2.2.0 | Citas, Reportes, Seguridad | 20–30 días | 🔴 Alta |
| [Fase 3](#fase-3--v230-integraciones-y-plataforma) | v2.3.0 | PWA, Hardware, AI | 30–45 días | 🔴 Alta |
| [Fase 4](#fase-4--v300-plataforma-saas) | v3.0.0 | Multi-tenancy / SaaS | 60–90 días | 🔴🔴 Muy Alta |

---

## FASE 0 — Deuda Técnica Base (Prerequisito)
> ⚠️ Esta fase debe completarse ANTES de iniciar cualquier otra. Son mejoras de seguridad y robustez críticas.

**Duración estimada:** 3–5 días  
**Riesgo si se omite:** Vulnerabilidades en producción, datos corruptos bajo carga

### 0.1 Rate Limiting en API Pública

**Descripción:** Proteger los endpoints sin autenticación (quiosco) contra abuso.

**Archivos a modificar:**
- `backend/package.json` — agregar dependencia `express-rate-limit`
- `backend/src/server.js` — montar middleware de rate limit

**Implementación:**
```js
// backend/src/server.js
const rateLimit = require('express-rate-limit');

const kioskLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minuto
  max: 30,                   // máximo 30 requests por IP por minuto
  message: { error: 'Demasiadas solicitudes. Espere un momento.' }
});

// Aplicar solo a endpoints públicos del quiosco
app.use('/api/tickets/create', kioskLimiter);
app.use('/api/tickets/lookup', kioskLimiter);
app.use('/api/tickets/last-issued', kioskLimiter);
app.use('/api/services', kioskLimiter);
```

**Criterio de éxito:** Un mismo IP no puede generar más de 30 tickets por minuto.

---

### 0.2 Validación de Entradas con express-validator

**Descripción:** Sanitizar y validar todos los campos de entrada antes de llegar al ORM.

**Archivos a modificar:**
- `backend/package.json` — agregar `express-validator`
- `backend/src/routes/tickets.js` — validar `service_id`, `is_preferential`
- `backend/src/routes/services.js` — validar `name`, `prefix`, `color`, `daily_limit`
- `backend/src/routes/users.js` — validar `email`, `password`, `role_id`
- `backend/src/middleware/validate.js` — **NUEVO** middleware genérico de validación

**Implementación del middleware:**
```js
// backend/src/middleware/validate.js
const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Datos inválidos', details: errors.array() });
  }
  next();
};
```

**Criterio de éxito:** Inputs maliciosos o incompletos retornan 422 con detalle del error.

---

### 0.3 Índices de Base de Datos

**Descripción:** Agregar índices en columnas frecuentemente filtradas para mejorar rendimiento.

**Archivos a modificar:**
- `backend/src/models/Ticket.js` — agregar indexes

```js
// Ticket.js - en las opciones del modelo
{
  tableName: 'tickets',
  indexes: [
    { fields: ['created_at'] },
    { fields: ['status'] },
    { fields: ['service_id'] },
    { fields: ['service_id', 'status'] },  // índice compuesto para cola
    { fields: ['created_at', 'status'] },  // para reportes diarios
  ]
}
```

**Criterio de éxito:** Queries de cola y reportes ejecutan < 50ms con 10,000 tickets.

---

### 0.4 Reconexión Automática Socket.io (Cliente)

**Descripción:** El cliente debe reconectarse automáticamente si pierde conexión sin recargar.

**Archivos a modificar:**
- `frontend/app.js` — mejorar configuración del socket client

```js
// frontend/app.js
const socket = io(BACKEND_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
});

socket.on('reconnect', (attempt) => {
  console.log(`Socket reconectado en intento ${attempt}`);
  // Re-suscribir a salas si aplica
  if (window.__MT_ROOM) socket.emit('join_display');
});

socket.on('reconnect_failed', () => {
  MT.toast('Conexión perdida con el servidor. Recargue la página.', 'error');
});
```

**Criterio de éxito:** La pantalla pública se recupera sola de caídas de red < 60 segundos.

---

### 0.5 Refresh Token para Sesiones de Jornada

**Descripción:** Evitar que la sesión del agente expire en medio de la jornada laboral.

**Archivos a modificar:**
- `backend/src/routes/auth.js` — endpoint `/api/auth/refresh`
- `frontend/app.js` — interceptor en MT.api para detectar 401 y refrescar

```js
// backend/src/routes/auth.js
router.post('/refresh', authenticate, async (req, res) => {
  const newToken = jwt.sign(
    { id: req.user.id, role_id: req.user.role_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '24h' }
  );
  res.json({ token: newToken });
});
```

**Criterio de éxito:** Un agente puede trabajar toda la jornada sin ser deslogueado.

---

## FASE 1 — v2.1.0: Estabilización y UX
**Duración estimada:** 8–12 días  
**Dependencia:** Fase 0 completada  
**Objetivo:** Sistema más robusto y fácil de usar en el día a día

---

### 1.1 Quiosco — Timeout de Inactividad

**Archivo:** `frontend/kiosk.html`

**Descripción:** Si el usuario no interactúa durante N segundos, el quiosco vuelve al estado inicial automáticamente. Configurable desde Settings.

**Implementación:**
```js
// En kiosk.html <script>
const INACTIVITY_MS = 45000; // 45 segundos (configurable desde settings)
let inactivityTimer = null;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // Cerrar modales abiertos
    document.getElementById('receipt-modal').style.display = 'none';
    document.getElementById('reprint-modal').style.display = 'none';
    // Resetear estado preferencial
    if (isPreferentialActive) togglePreferential();
    // Mostrar pantalla de espera con animación
    showIdleScreen();
  }, INACTIVITY_MS);
}

document.addEventListener('click', resetInactivityTimer);
document.addEventListener('touchstart', resetInactivityTimer);
document.addEventListener('keydown', resetInactivityTimer);
```

**Nueva configuración en BD (settings):**
```
key: 'kiosk_inactivity_timeout', value: '45', type: 'number'
```

**Archivos a modificar:**
- `frontend/kiosk.html` — lógica de timeout e idle screen
- `backend/src/seeders/seed.js` — agregar setting kiosk_inactivity_timeout

---

### 1.2 Quiosco — Pantalla de Sin Servicios

**Archivo:** `frontend/kiosk.html`

**Descripción:** Estado visual amigable cuando no hay servicios activos.

```js
function renderNoServices() {
  document.getElementById('services-grid').innerHTML = `
    <div class="no-services-state">
      <div class="no-services-icon">⏸️</div>
      <h2>Atención momentáneamente suspendida</h2>
      <p>En este momento no hay áreas de servicio disponibles.<br>
         Por favor acérquese al módulo de orientación.</p>
    </div>
  `;
}
```

---

### 1.3 Panel de Agente — Filtros de Cola y Atajos de Teclado

**Archivo:** `frontend/call.html`

**Descripción:**
1. Barra de filtros en la cola (Todos / Normal / Preferencial / Derivado)
2. Atajos de teclado globales para agentes de escritorio

**Atajos de teclado a implementar:**

| Atajo | Acción |
|-------|--------|
| `Space` | Llamar siguiente turno |
| `A` | Marcar atendido (turno actual) |
| `U` | Marcar ausente (turno actual) |
| `R` | Recallar turno actual |
| `Esc` | Cerrar modal abierto |

```js
// frontend/call.html
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); callNext(); }
  if (e.key === 'a' || e.key === 'A') markAttended();
  if (e.key === 'u' || e.key === 'U') markAbsent();
  if (e.key === 'r' || e.key === 'R') recallTicket();
  if (e.key === 'Escape') closeAllModals();
});
```

**Filtros de cola:**
```html
<div class="queue-filters">
  <button class="filter-btn active" data-filter="all">Todos</button>
  <button class="filter-btn" data-filter="preferential">⭐ Preferenciales</button>
  <button class="filter-btn" data-filter="transferred">↩ Derivados</button>
  <button class="filter-btn" data-filter="normal">Normal</button>
</div>
```

---

### 1.4 Pantalla Pública — Multi-mostrador y Logo de Empresa

**Archivo:** `frontend/display.html`

**Descripción:**
1. Panel "En Atención" muestra todos los mostradores activos (no solo el último)
2. Logo de la empresa en la cabecera cargado desde settings

**Cambio en el endpoint screen-flow:**
La respuesta ya incluye `attending` como array. El frontend necesita renderizar todos:

```js
// display.html - función de renderizado
function renderAttending(list) {
  const container = document.getElementById('attending-panel');
  if (!list.length) {
    container.innerHTML = '<div class="no-attending">Ningún turno en atención</div>';
    return;
  }
  container.innerHTML = list.map(t => `
    <div class="attending-card">
      <div class="at-number">${t.number}</div>
      <div class="at-counter">${t.counter?.name || 'Mostrador'}</div>
      <div class="at-service" style="color:${t.service?.color}">${t.service?.name}</div>
      <div class="at-agent">${t.agent?.name || ''}</div>
    </div>
  `).join('');
}
```

---

### 1.5 Administración — Exportar Reportes a CSV

**Archivos a modificar:**
- `backend/src/routes/reports.js` — agregar parámetro `?format=csv`
- `frontend/dashboard.html` — botón de exportar

**Backend:**
```js
// reports.js
router.get('/daily', authenticate, async (req, res) => {
  // ... lógica existente ...
  
  if (req.query.format === 'csv') {
    const rows = [
      ['Servicio', 'Total', 'Promedio Espera (min)', 'Promedio Atención (min)'],
      ...byService.map(s => [
        s.service?.name,
        s.total,
        Math.round(s.avg_wait || 0),
        Math.round(s.avg_attend || 0)
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=reporte-${dateStr}.csv`);
    return res.send('\uFEFF' + csv); // BOM para Excel
  }
  
  res.json({ date: dateStr, stats: statusMap, byService, hourly });
});
```

---

### 1.6 Backend — Tests Unitarios Críticos

**Nuevos archivos:**
- `backend/src/__tests__/tickets.test.js`
- `backend/src/__tests__/services.test.js`
- `backend/src/__tests__/auth.test.js`

**Dependencias a agregar:**
```json
"devDependencies": {
  "jest": "^29.0.0",
  "supertest": "^7.0.0"
}
```

**Scripts:**
```json
"scripts": {
  "test": "jest --coverage",
  "test:watch": "jest --watch"
}
```

**Casos de prueba prioritarios:**
- `POST /api/tickets/create` — con service_id válido e inválido
- `POST /api/tickets/call-next` — verificar orden de prioridad
- `GET /api/tickets/lookup` — búsqueda por código
- `POST /api/services` — validar prefijo único
- `DELETE /api/services/:id` — verificar limpieza en cascada
- `POST /api/auth/login` — credenciales correctas e incorrectas

---

### Criterios de Éxito — Fase 1

- [ ] El quiosco vuelve solo al inicio tras 45 seg de inactividad
- [ ] Los agentes pueden llamar turno con la barra espaciadora
- [ ] La pantalla pública muestra todos los mostradores activos simultáneamente
- [ ] Los reportes se pueden descargar como CSV desde el navegador
- [ ] Suite de tests pasa con >60% de cobertura en rutas críticas

---

## FASE 2 — v2.2.0: Funcionalidades Avanzadas
**Duración estimada:** 20–30 días  
**Dependencia:** Fase 1 completada  
**Objetivo:** Diferenciación competitiva y casos de uso empresariales avanzados

---

### 2.1 Módulo de Reserva de Citas

Esta es la funcionalidad de mayor complejidad de la fase.

#### 2.1.1 Modelo de Datos — Appointment

**Nuevo archivo:** `backend/src/models/Appointment.js`

```js
const Appointment = sequelize.define('Appointment', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  service_id:     { type: DataTypes.INTEGER, allowNull: false },
  client_name:    { type: DataTypes.STRING(120), allowNull: false },
  client_phone:   { type: DataTypes.STRING(30), allowNull: true },
  client_email:   { type: DataTypes.STRING(180), allowNull: true },
  scheduled_date: { type: DataTypes.DATEONLY, allowNull: false },
  scheduled_time: { type: DataTypes.TIME, allowNull: false },
  status:         { type: DataTypes.ENUM('pending', 'confirmed', 'converted', 'cancelled', 'absent'),
                    defaultValue: 'pending' },
  ticket_id:      { type: DataTypes.INTEGER, allowNull: true }, // FK al ticket generado
  confirmation_code: { type: DataTypes.STRING(10), allowNull: false }, // código único 6 dígitos
  notes:          { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'appointments' });
```

#### 2.1.2 Nuevas Rutas API

**Nuevo archivo:** `backend/src/routes/appointments.js`

```
GET  /api/appointments              — listar citas del día [auth]
GET  /api/appointments/:code        — buscar cita por código [público]
POST /api/appointments              — crear reserva [público]
PUT  /api/appointments/:id          — editar cita [auth]
POST /api/appointments/:id/convert  — convertir cita en ticket [auth/quiosco]
POST /api/appointments/:id/cancel   — cancelar cita [auth]
GET  /api/appointments/availability — disponibilidad por servicio/fecha [público]
```

#### 2.1.3 Nueva Vista — Reservas

**Nuevo archivo:** `frontend/appointments.html`

Vista accesible sin login para que el cliente reserve su cita:
- Selección de servicio
- Selección de fecha (solo días hábiles) y hora (slots disponibles)
- Formulario: nombre, teléfono, email
- Confirmación con código QR y código alfanumérico
- Vista admin para gestionar reservas del día

#### 2.1.4 Integración con Quiosco

En `kiosk.html`, agregar opción "Tengo una cita":
- El cliente ingresa su código de confirmación
- El sistema busca la cita y la convierte en ticket con prioridad 1 (derivado)
- El ticket aparece en la cola del agente como "Cita confirmada"

---

### 2.2 Notificaciones WhatsApp/SMS

**Dependencias nuevas:**
```json
"twilio": "^5.0.0"
```

**Nuevo archivo:** `backend/src/services/notifications.js`

```js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

async function sendWhatsApp(to, message) {
  return client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${to}`,
    body: message
  });
}

// Plantillas de mensajes
const templates = {
  appointmentConfirmed: (code, date, service) =>
    `✅ Tu cita en *Mi Turno* fue confirmada.\n📋 Código: *${code}*\n📅 ${date}\n🏢 ${service}\nPresenta este código en el quiosco.`,
  
  turnComing: (number, position) =>
    `🔔 Tu turno *${number}* está próximo. Quedan aproximadamente *${position}* turnos antes que el tuyo.`,
  
  turnCalled: (number, counter) =>
    `📢 ¡Tu turno *${number}* está siendo llamado! Dirígete al *${counter}*.`
};
```

**Nuevas variables de entorno:**
```env
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=+14155238886
NOTIFICATIONS_ENABLED=false
NOTIFY_THRESHOLD=3   # notificar cuando quedan N turnos
```

---

### 2.3 Dashboard con Gráficas (Chart.js)

**Archivo:** `frontend/dashboard.html`

**Dependencia CDN:**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

**Gráficas a implementar:**

| Gráfica | Tipo | Datos |
|---------|------|-------|
| Turnos por hora del día | Barras | hourly del reporte daily |
| Estado de turnos | Dona | byStatus del reporte daily |
| Comparativa semanal | Línea | 7 llamadas al reporte daily |
| Ranking de agentes | Barras horizontales | nuevo endpoint /api/reports/agents |

**Nuevo endpoint:**
```
GET /api/reports/agents?date=YYYY-MM-DD
```
Retorna: agente, turnos_atendidos, tiempo_promedio_espera, tiempo_promedio_atencion

---

### 2.4 Exportación PDF de Reportes

**Dependencia nueva:**
```json
"puppeteer": "^22.0.0"
```

**Nuevo endpoint:**
```
GET /api/reports/daily/pdf?date=YYYY-MM-DD
```

El backend genera el HTML del reporte, lo renderiza con Puppeteer y retorna un PDF con:
- Logo de la empresa (desde settings)
- Tabla de datos por servicio
- Gráficas incrustadas (imágenes generadas con Chart.js en canvas)
- Pie de página con fecha y firma digital

> **Alternativa sin Puppeteer:** Usar `jsPDF` en el frontend para generar el PDF desde el navegador.  
> Esta opción es más ligera pero con menos control de diseño.

---

### 2.5 Autenticación 2FA (TOTP)

**El modelo User ya tiene el campo `two_factor: Boolean`.**

**Dependencias nuevas:**
```json
"otplib": "^12.0.0",
"qrcode": "^1.5.0"
```

**Flujo de activación:**
1. Admin activa 2FA para su cuenta en `settings.html`
2. Backend genera secret TOTP y devuelve QR code como data URL
3. Usuario escanea con Google Authenticator / Authy
4. Confirma con código de 6 dígitos para activar

**Nuevas columnas en `users`:**
```js
two_factor_secret: { type: DataTypes.STRING(60), allowNull: true }
```

**Nuevo endpoint:**
```
POST /api/auth/2fa/setup    — generar secret y QR [auth]
POST /api/auth/2fa/verify   — verificar código y activar [auth]
POST /api/auth/2fa/login    — validar código en el login [público con token temporal]
DELETE /api/auth/2fa        — desactivar 2FA [auth]
```

---

### 2.6 Permisos Granulares — roles.html

**Nuevo archivo:** `frontend/roles.html`

Vista para que el admin configure qué puede ver/hacer cada rol:

```js
// Estructura de permisos (ya en JSONB en la BD)
const PERMISSION_MATRIX = {
  tickets:  ['view', 'call', 'attend', 'transfer', 'cancel'],
  services: ['view', 'create', 'edit', 'delete'],
  counters: ['view', 'create', 'edit', 'delete'],
  users:    ['view', 'create', 'edit', 'delete'],
  reports:  ['view', 'export'],
  settings: ['view', 'edit'],
};
```

El middleware `authenticate` ya puede verificar `req.user.permissions` para restringir acciones.

---

### 2.7 Multi-Sucursal

Esta es la funcionalidad de mayor impacto en el schema de la BD.

#### Nuevo Modelo: Branch

```js
const Branch = sequelize.define('Branch', {
  id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:    { type: DataTypes.STRING(120), allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: true },
  phone:   { type: DataTypes.STRING(30), allowNull: true },
  active:  { type: DataTypes.BOOLEAN, defaultValue: true },
  config:  { type: DataTypes.JSONB, defaultValue: {} }, // config específica de sucursal
}, { tableName: 'branches' });
```

#### Impacto en modelos existentes

Agregar `branch_id` a: `Service`, `Counter`, `User`, `Ticket`

> ⚠️ **Importante:** Esta es una migración de esquema destructiva. Requiere migración de datos.  
> Usar Sequelize Migrations (no sync) para este cambio.

#### Quiosco multi-sucursal

```
/kiosk.html?branch=1   — muestra solo los servicios de la sucursal 1
/display.html?branch=1 — muestra solo los turnos de la sucursal 1
```

**Backend: parámetro de filtro por branch_id en todos los endpoints afectados.**

---

### Criterios de Éxito — Fase 2

- [ ] Clientes pueden reservar cita desde un formulario web sin login
- [ ] Los turnos con cita previa se identifican en la cola del agente
- [ ] El dashboard muestra al menos 3 gráficas interactivas con Chart.js
- [ ] Los reportes se pueden descargar como PDF desde el navegador
- [ ] Un admin puede activar 2FA con Google Authenticator
- [ ] El sistema soporta al menos 2 sucursales con datos aislados por branch

---

## FASE 3 — v2.3.0: Integraciones y Plataforma
**Duración estimada:** 30–45 días  
**Dependencia:** Fase 2 completada  
**Objetivo:** Expansión a hardware físico, móvil y ecosistema de integraciones

---

### 3.1 PWA — Progressive Web App

#### 3.1.1 Service Worker para Quiosco Offline

**Nuevos archivos:**
- `frontend/sw.js` — Service Worker
- `frontend/manifest.json` — Web App Manifest

```json
// manifest.json
{
  "name": "Mi Turno — Quiosco",
  "short_name": "MiTurno",
  "start_url": "/kiosk.html",
  "display": "fullscreen",
  "background_color": "#0a1628",
  "theme_color": "#38bdf8",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Estrategia de caché del Service Worker:**
- Cache-first: assets estáticos (CSS, JS, fonts, imágenes)
- Network-first: llamadas a la API
- Fallback offline: mostrar página de "Sin conexión" amigable

#### 3.1.2 App de Agente Responsive

**Archivo:** `frontend/call.html`

Hacer la vista completamente responsive para smartphones/tablets:
- Breakpoint mobile: cola en lista vertical compacta
- Botones más grandes para uso táctil
- Gestos swipe: swipe derecha = llamar, swipe izquierda = ausente

---

### 3.2 Impresión Térmica Directa (WebUSB)

**Descripción:** Control directo de la impresora sin depender del diálogo del navegador.

**Archivos nuevos:**
- `frontend/lib/thermal-printer.js` — Driver WebUSB para ESC/POS

```js
// thermal-printer.js
class ThermalPrinter {
  constructor() { this.device = null; }

  async connect() {
    this.device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x0519 }, // Star Micronics
        { vendorId: 0x1504 }, // Bixolon
      ]
    });
    await this.device.open();
    await this.device.selectConfiguration(1);
    await this.device.claimInterface(0);
  }

  async print(commands) {
    const ESC = 0x1B;
    // Construir buffer ESC/POS
    const buffer = buildEscPosBuffer(commands);
    await this.device.transferOut(1, buffer);
  }

  async cut() {
    await this.device.transferOut(1, new Uint8Array([0x1D, 0x56, 0x41, 0x10]));
  }
}
```

**Integración en kiosk.html:**
- Botón "Conectar Impresora" en el panel de configuración del quiosco
- Si hay impresora conectada vía WebUSB, la usa; sino, hace window.print() como fallback

---

### 3.3 API Pública Documentada (Swagger)

**Dependencia nueva:**
```json
"swagger-jsdoc": "^6.0.0",
"swagger-ui-express": "^5.0.0"
```

**Nuevo archivo:** `backend/src/config/swagger.js`

**Nueva ruta:**
```
GET /api/docs  — Swagger UI interactiva
GET /api/docs.json — OpenAPI 3.0 JSON
```

**Ejemplo de anotación:**
```js
/**
 * @swagger
 * /api/tickets/create:
 *   post:
 *     summary: Crear un nuevo turno
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service_id]
 *             properties:
 *               service_id: { type: integer, example: 1 }
 *               is_preferential: { type: boolean, example: false }
 *               preferential_reason: { type: string, example: "Discapacidad" }
 *     responses:
 *       201:
 *         description: Turno creado exitosamente
 */
```

---

### 3.4 Webhooks para Integraciones Externas

**Descripción:** Permitir que sistemas externos se suscriban a eventos del sistema.

**Nuevo modelo:** `Webhook`
```js
{
  id, url, events (JSONB array), secret, active, last_triggered_at
}
```

**Nuevo endpoint:**
```
GET/POST/PUT/DELETE /api/webhooks [auth admin]
```

**Evento de disparo:**
```js
// backend/src/services/webhooks.js
async function dispatch(event, payload) {
  const hooks = await Webhook.findAll({ where: { active: true } });
  hooks.filter(h => h.events.includes(event)).forEach(hook => {
    const sig = crypto.createHmac('sha256', hook.secret)
                      .update(JSON.stringify(payload)).digest('hex');
    fetch(hook.url, {
      method: 'POST',
      headers: { 'X-MiTurno-Signature': sig, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data: payload, timestamp: new Date() })
    }).catch(console.error);
  });
}
```

**Eventos disponibles:** `ticket.created`, `ticket.called`, `ticket.attended`, `ticket.absent`

---

### 3.5 Inteligencia Artificial — ETA y Predicción

**Descripción:** Calcular el tiempo estimado de espera para mostrar al cliente en el quiosco.

#### Cálculo de ETA

```js
// backend/src/services/eta.js
async function calculateETA(serviceId, position) {
  const today = new Date(); today.setHours(0,0,0,0);
  
  // Calcular tiempo promedio de atención de los últimos 30 días
  const stats = await Ticket.findOne({
    where: {
      service_id: serviceId,
      status: 'attended',
      attend_minutes: { [Op.not]: null },
      created_at: { [Op.gte]: subDays(today, 30) }
    },
    attributes: [[fn('AVG', col('attend_minutes')), 'avg_attend']],
    raw: true
  });

  const avgMinutes = Math.ceil(parseFloat(stats?.avg_attend) || 5);
  const etaMinutes = avgMinutes * position;

  return {
    estimated_minutes: etaMinutes,
    position_in_queue: position,
    avg_attend_time: avgMinutes,
    confidence: position < 5 ? 'high' : 'medium'
  };
}
```

**Cambio en ticket modal del quiosco:**
- Mostrar "Tiempo estimado de espera: ~X minutos" debajo del número de turno

#### Detección de Horas Pico

```js
// Nuevo endpoint
GET /api/reports/peak-hours?service_id=1

// Retorna distribución histórica por hora para planificación de personal
```

---

### Criterios de Éxito — Fase 3

- [ ] El quiosco es instalable como PWA en tablets Android/iOS
- [ ] La impresora térmica puede conectarse vía USB sin diálogo del navegador
- [ ] La documentación Swagger está disponible en /api/docs
- [ ] Al menos 1 sistema externo puede recibir eventos vía webhook
- [ ] El ticket del quiosco muestra el tiempo estimado de espera

---

## FASE 4 — v3.0.0: Plataforma SaaS
**Duración estimada:** 60–90 días  
**Dependencia:** Fases 1–3 completadas  
**Objetivo:** Producto comercializable a múltiples empresas

---

### 4.1 Arquitectura Multi-Tenancy

**Estrategia recomendada:** Schema-per-tenant en PostgreSQL (aislamiento máximo)

```
Database: miturno_saas
  Schema: public       → tablas de plataforma (tenants, billing, plans)
  Schema: tenant_acme  → tablas del cliente ACME
  Schema: tenant_xyz   → tablas del cliente XYZ
  ...
```

**Alternativa más simple:** Row-level tenancy con `tenant_id` en todas las tablas.  
- Más fácil de implementar pero requiere disciplina estricta en todos los queries.
- Riesgo de data leak si se olvida el filtro en algún endpoint.

**Recomendación:** Empezar con row-level y migrar a schema-per-tenant cuando supere 50 tenants.

#### Modelo Tenant

```js
const Tenant = sequelize.define('Tenant', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slug:        { type: DataTypes.STRING(60), unique: true }, // para subdominios: acme.miturno.com
  name:        { type: DataTypes.STRING(180) },
  plan:        { type: DataTypes.ENUM('free', 'basic', 'pro', 'enterprise'), defaultValue: 'free' },
  status:      { type: DataTypes.ENUM('active', 'suspended', 'cancelled'), defaultValue: 'active' },
  trial_ends:  { type: DataTypes.DATE },
  limits:      { type: DataTypes.JSONB }, // { max_users, max_services, max_counters }
  billing:     { type: DataTypes.JSONB }, // datos de facturación
  custom_domain: { type: DataTypes.STRING(255), allowNull: true },
}, { tableName: 'tenants' });
```

---

### 4.2 Panel Super-Administrador

**Nueva vista:** `frontend/superadmin.html`

Accesible solo para el rol `superadmin` (nivel por encima de admin).

**Funcionalidades:**
- Listar todos los tenants con estado y plan
- Crear/suspender/cancelar tenants
- Impersonar usuario de cualquier tenant para soporte
- Métricas globales: tickets procesados, uptime, revenue
- Gestión de planes y límites

---

### 4.3 Sistema de Suscripciones

**Integración con:** Stripe o MercadoPago (para Latinoamérica)

**Nuevo archivo:** `backend/src/services/billing.js`

```js
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const PLANS = {
  free:       { price: 0,    limits: { users: 2, services: 3, counters: 2 } },
  basic:      { price: 29,   limits: { users: 5, services: 10, counters: 5 } },
  pro:        { price: 79,   limits: { users: 20, services: 30, counters: 15 } },
  enterprise: { price: 199,  limits: { users: Infinity, services: Infinity, counters: Infinity } },
};
```

**Webhooks de Stripe:**
- `invoice.paid` → activar/renovar suscripción
- `invoice.payment_failed` → suspender tenant tras gracia de 7 días
- `customer.subscription.deleted` → cancelar tenant

---

### 4.4 White-Label y Custom Domains

**Nginx config dinámica para subdominios:**
```nginx
# Wildcard subdomain routing
server {
  listen 80;
  server_name ~^(?<tenant>[^.]+)\.miturno\.com$;
  
  location / {
    proxy_pass http://frontend;
    add_header X-Tenant $tenant;
  }
  
  location /api/ {
    proxy_pass http://backend;
    proxy_set_header X-Tenant-Slug $tenant;
  }
}
```

**El backend identifica el tenant por el header `X-Tenant-Slug` y filtra todos los datos.**

---

### Criterios de Éxito — Fase 4

- [ ] Un cliente puede registrarse, pagar y tener el sistema funcionando en < 5 minutos
- [ ] Los datos de cada tenant están completamente aislados
- [ ] El panel superadmin permite gestionar todos los clientes desde un solo lugar
- [ ] Stripe/MercadoPago procesa pagos automáticos y renueva/suspende subscripciones
- [ ] Los clientes Enterprise pueden usar su propio dominio (white-label)

---

## Orden de Implementación Recomendado

```
Semana 1-2   → Fase 0 (Deuda técnica — CRÍTICO)
Semana 3-5   → Fase 1.1 a 1.4 (UX: timeout, filtros, multi-mostrador, exportar CSV)
Semana 6     → Fase 1.5 a 1.6 (Tests y polish)
              → TAG: v2.1.0 ✅ Deploy
Semana 7-9   → Fase 2.1 (Reserva de citas — el de más esfuerzo)
Semana 10-11 → Fase 2.3 + 2.4 (Dashboard Chart.js + PDF)
Semana 12    → Fase 2.5 + 2.6 (2FA + Roles UI)
Semana 13-14 → Fase 2.7 (Multi-sucursal — requiere migración de BD)
              → TAG: v2.2.0 ✅ Deploy
Semana 15-17 → Fase 3.1 (PWA + Service Worker)
Semana 18-19 → Fase 3.2 (WebUSB para impresoras)
Semana 20-21 → Fase 3.3 + 3.4 (Swagger + Webhooks)
Semana 22-24 → Fase 3.5 (AI/ETA)
              → TAG: v2.3.0 ✅ Deploy
Semana 25-36 → Fase 4 (SaaS — requiere equipo expandido)
              → TAG: v3.0.0 ✅ Deploy
```

---

## Dependencias entre Fases

```
Fase 0 (Deuda)
  └── Fase 1 (UX)
        └── Fase 2 (Avanzado)
              ├── 2.7 Multi-sucursal → requiere Sequelize Migrations (de Fase 0)
              └── Fase 3 (Integraciones)
                    └── Fase 4 (SaaS)
                          └── 4.4 White-label → requiere 2.7 Multi-sucursal
```

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Migración BD Multi-Sucursal rompe datos existentes | Alta | Crítico | Usar Sequelize Migrations + backup obligatorio antes |
| WebUSB no soportado en todos los navegadores | Media | Medio | Mantener window.print() como fallback siempre |
| TTS en display requiere interacción manual | Alta | Bajo | Documentar en onboarding + botón "Activar Sonido" visible |
| Stripe no disponible en todos los países | Media | Alto | Integrar MercadoPago como alternativa para LATAM |
| Puppeteer aumenta el tamaño del contenedor Docker | Media | Medio | Usar servicio externo (gotenberg) o jsPDF en cliente |
| Multi-tenancy introduce complejidad en todos los queries | Alta | Alto | Crear helper middleware que inyecte tenant_id automáticamente |
```
