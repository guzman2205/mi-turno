# CHANGELOG — Mi Turno Sistema de Gestión de Turnos

Todos los cambios notables de este proyecto están documentados aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/).
Versiones siguen [Semantic Versioning](https://semver.org/).

---

## [2.2.0] — 2026-10-09 — Notificaciones SMTP Gmail, Pantalla de Flyers y Concurrencia Atómica

### Agregado — Correo Electrónico SMTP y Reenvío de Confirmaciones
- NUEVO: Integración SMTP Gmail con `nodemailer` y sanitización automática de claves de Google de 16 caracteres (`email.js`)
- NUEVO: Botón de "✉️ Reenviar Correo" en la agenda de secretaría (`appointments.html`) y en la tarjeta de confirmación de cita
- NUEVO: Endpoint `POST /api/appointments/:id/resend-email` para reenvíos con opción de modificar o confirmar la dirección del destinatario

### Agregado — Pantalla Pública de Anuncios y Flyers (display_announcements.html)
- NUEVO: Vista de presentación pública Fullscreen HD (`display_announcements.html`) para Smart TVs y tótems publicitarios
- NUEVO: Carrusel interactivo de afiches, flyers promocionales y videos institucionales con barra de progreso animada
- NUEVO: Detección inteligente y proxy streaming de enlaces en la nube (*Nextcloud, ownCloud, Google Drive, Dropbox*) en `/api/media/proxy`
- NUEVO: Botón de acceso directo `🎬 Pantalla Anuncios` en la barra superior (`topbar-actions` en `app.js`)

### Agregado — Atención Fluidificada en Secretaría
- NUEVO: Botón `✅ Atendido` en las tarjetas de citas para marcar el encuentro como completado con distintivo destacado en verde (`a.status === 'completed'`)
- NUEVO: Botón `⏩ Atendido y Llamar Próximo` para finalizar la cita actual e iniciar automáticamente la llamada del siguiente usuario en la cola
- NUEVO: Endpoint `POST /api/appointments/:id/finish` para registrar la finalización de citas
- NUEVO: Integración del tono de llamada de turno extraído en alta fidelidad desde video MP4 (`assets/chime_custom.mp3`)

### Mejorado — Concurrencia Atómica y Transacciones en Base de Datos
- MEJORADO: Bloqueo exclusivo de filas (`Transaction.LOCK.UPDATE`) en la creación de turnos (`POST /api/tickets/create`) e ingreso de citas (`POST /api/appointments/:id/convert`) para garantizar correlativos 100% secuenciales sin duplicidad en ráfagas de solicitudes
- MEJORADO: Transacción atómica con bloqueo de fila en `POST /api/tickets/call-next` para prevenir el llamado doble accidental entre mostradores concurrentes
- MEJORADO: Cambio de puerto del frontend a `8088` (`FRONTEND_PORT=8088`) para evitar colisiones de red con IIS/servidores locales en Windows

### Corregido
- CORREGIDO: Inestabilidad en la barra lateral (sidebar) corregida con renderizado estático ininterrumpido de todos los módulos de gestión
- CORREGIDO: Ajuste de escala `object-fit: contain` para visualizar el 100% de la imagen de afiches y flyers sin recortar encabezados o texto
- CORREGIDO: Filtro de citas por departamento (`department_id`) en la agenda de secretaría
- CORREGIDO: Eliminación del constraint `NOT NULL` en `service_id` de la tabla `appointments`

---

## [2.0.0] — 2026-10-06 — Lanzamiento Plataforma Empresarial

Esta versión representa una reestructuración completa del proyecto, pasando de
una herramienta de nicho hospitalario a una plataforma de gestión de turnos
adaptable a cualquier empresa de servicios.

### BREAKING CHANGES
- Renombrado del proyecto: HospiTurno → Mi Turno
- Módulo "Servicios Médicos" renombrado a "Servicios" (diseño agnóstico de industria)
- Estructura de archivos reorganizada: todos los archivos movidos a sus rutas correctas
  (frontend/ y backend/src/) eliminando archivos sueltos en la raíz

### Agregado — Quiosco (kiosk.html)
- NUEVO: Impresión automática del ticket térmico al generar el turno
  - Se ejecuta window.print() con delay de 400ms al mostrar el modal
  - Formato optimizado para impresoras POS 80mm con @media print
- NUEVO: Modal de Reimprimir Turno
  - Búsqueda de turno por código (ej: A-001, P-B-002) con Enter como atajo
  - Botón de carga rápida del último turno emitido en el día
  - Vista previa del turno encontrado antes de reimprimir
  - Diferenciación visual entre turnos normales (azul) y preferenciales (ámbar)
- NUEVO: Footer de Quiosco con botón "Reimprimir Turno" siempre visible
- MEJORADO: Función fillPrintTicket() extraída para reutilización en reimpresión

### Agregado — Backend API
- NUEVO: GET /api/tickets/last-issued
  - Retorna el último turno emitido en el día actual
  - Utilizado por el quiosco para reimpresión rápida sin búsqueda
- NUEVO: GET /api/tickets/lookup?query=
  - Búsqueda de turno por número/código parcial (case-insensitive, iLike)
  - Restringido a tickets del día actual para evitar confusiones
- NUEVO: PATCH /api/services/:id/toggle-status
  - Endpoint dedicado para activar/desactivar servicio sin eliminar datos
- NUEVO: DELETE /api/services/:id con limpieza en cascada
  - Desvincula mostradores asociados antes de eliminar
  - Destruye tickets asociados para mantener integridad referencial
  - Emite evento WebSocket services:deleted al eliminar

### Agregado — Servicios (services.html)
- NUEVO: Botón "Eliminar" en cada tarjeta de servicio con confirmación
- NUEVO: Modal de confirmación antes de eliminación permanente
- NUEVO: Botones "Nuevo" y "Editar" ahora funcionales (corregido)
- MEJORADO: Tarjetas de servicios rediseñadas con botones internos en cuadrícula 2x2
  - Los botones ya no exceden el espacio de las tarjetas
  - Botones: Editar | Activar/Desactivar | Reiniciar Secuencia | Eliminar

### Agregado — Landing / Login (login.html)
- NUEVO: Diseño completamente rediseñado con panel dividido 40/60
- NUEVO: Mascota del sistema integrada (imagen IA generada)
- NUEVO: Panel izquierdo con estadísticas del sistema y características
- NUEVO: Identidad visual "Mi Turno" con tagline y slogan
- MEJORADO: Tipografía y colores alineados con el design system

### Mejorado — Formulario de Usuarios (users.html)
- MEJORADO: Campos del formulario reorganizados en cuadrícula de 3 columnas
  - Los campos se muestran lado a lado en lugar de apilados verticalmente
  - Mejor uso del espacio horizontal en pantallas grandes

### Mejorado — Sidebar y Navegación (styles.css)
- MEJORADO: Sidebar configurado como position: fixed
  - El menú lateral permanece estático durante el scroll de la vista principal
  - Scroll independiente del contenido principal
  - Apariencia y movilidad completamente independiente al resto de la página
- AGREGADO: Helpers CSS para cuadrícula de formularios (grid 2 y 3 columnas)
- AGREGADO: Cache-busting version query (?v=2.0) en todos los archivos CSS/JS

### Corregido
- CORREGIDO: Botones "Editar" y "Nuevo" en módulo de Servicios no abrían modal
- CORREGIDO: Inconsistencia entre el nombre "Servicios Médicos" y el nuevo enfoque empresarial
- CORREGIDO: Tarjetas de servicio excedían límites del contenedor en pantallas pequeñas

---

## [1.5.0] — 2026-10-06 — Turnos Preferenciales y Derivaciones

### Agregado
- NUEVO: Sistema completo de turnos preferenciales en el quiosco
  - Banner toggle en el quiosco para activar atención preferencial
  - Categorías: Discapacidad, Adulto Mayor, Embarazada, Condición Especial
  - Chips seleccionables con razón de preferencia
  - Prefijo "P-" en el número del ticket preferencial
- NUEVO: Sistema de prioridad de 3 niveles
  - 0 = Normal (FIFO estándar)
  - 1 = Derivado (atendido antes que nuevos ordinarios)
  - 2 = Preferencial (máxima prioridad, FIFO entre sí)
- NUEVO: Derivación/Transferencia de turnos entre servicios
  - Agente puede derivar turno a otro servicio desde el panel de agente
  - El turno mantiene historial del servicio de origen (transferred_from_service_id)
  - La prioridad sube automáticamente al derivar (de 0 a 1)
  - Los preferenciales mantienen su nivel 2 al derivar
- NUEVO: Badge "Preferencial" en el modal del ticket del quiosco
- NUEVO: Indicador visual en pantalla pública para turnos preferenciales
- NUEVO: Indicador en cola de agente para diferenciar tipos de turno
- NUEVO: Campos en modelo Ticket: priority, is_preferential, preferential_reason,
  transferred_from_service_id, transferred_at

### Mejorado
- MEJORADO: Endpoint POST /api/tickets/call-next con lógica FIFO ponderada
  - Ordena por priority DESC, luego created_at ASC
  - Soporta ticket_id específico para llamar turno seleccionado manualmente
- MEJORADO: GET /api/tickets/screen-flow incluye turnos preferenciales y derivados
- MEJORADO: Chime de sonido diferenciado para turnos preferenciales

---

## [1.4.0] — 2026-10-06 — Síntesis de Voz y Pantalla Pública

### Agregado
- NUEVO: Text-to-Speech (TTS) en pantalla pública usando Web Speech API
- NUEVO: Mensaje de voz configurable en settings.html
  - Variable en base de datos: tts_message_template
  - Soporta placeholders: {number}, {service}, {counter}
- NUEVO: Overlay de llamada animada en display.html
  - Efecto pantalla completa al llamar un turno
  - Animación con número de turno en grande
  - Se desactiva automáticamente después de 6 segundos
- NUEVO: Panel de anuncios en pantalla pública
  - Mensajes desplazantes configurables desde settings
  - Prioridad y tipo de anuncio
- NUEVO: Reloj digital en tiempo real en display.html
- NUEVO: Historial de últimos 6 turnos atendidos

### Mejorado
- MEJORADO: Diseño de display.html optimizado para pantallas Full HD
- MEJORADO: Columnas de "En Atención" y "Próximos" balanceadas

---

## [1.3.0] — 2026-10-06 — Reportes y Métricas

### Agregado
- NUEVO: Módulo de reportes en backend
- NUEVO: GET /api/reports/daily — Reporte del día por estado y servicio
  - Incluye distribución por hora (heatmap de demanda)
  - Tiempo promedio de espera y atención por servicio
- NUEVO: GET /api/reports/monthly — Reporte mensual por día
  - Totales, atendidos y ausentes por día del mes
  - Promedios de espera y atención
- NUEVO: Dashboard con KPIs en tiempo real
  - Total de turnos del día
  - Turnos en espera activos
  - Tasa de atención (%)
  - Tiempo promedio de espera

---

## [1.2.0] — 2026-10-06 — Gestión Avanzada de Servicios

### Agregado
- NUEVO: Configuración de secuencia de inicio por servicio (sequence_start)
- NUEVO: Límite diario de turnos por servicio (daily_limit, 0=ilimitado)
- NUEVO: Endpoint POST /api/services/:id/reset-sequence
- NUEVO: Campo current_number rastreado en tiempo real en el modelo Service
- NUEVO: Color e ícono personalizables por servicio (Font Awesome)
- NUEVO: Prefijo único por servicio para el código del ticket

### Mejorado
- MEJORADO: Validación de prefijo único al crear y editar servicios
- MEJORADO: Notificación WebSocket services:changed en todos los CRUD de servicios

---

## [1.1.0] — 2026-10-06 — Autenticación y Roles

### Agregado
- NUEVO: Sistema de autenticación JWT completo
- NUEVO: Roles con permisos granulares en JSONB
- NUEVO: Middleware authenticate para proteger endpoints sensibles
- NUEVO: logAction() para auditoría en system_logs
- NUEVO: Soft delete en usuarios (is_deleted flag)
- NUEVO: Hash de contraseñas con bcryptjs (hooks Sequelize beforeCreate/beforeUpdate)
- NUEVO: Endpoint GET /api/auth/me para perfil del usuario autenticado
- NUEVO: Gestión de usuarios (users.html) con formulario completo:
  nombre, apellido, cédula, género, email, rol, color de agente

---

## [1.0.0] — 2026-10-06 — Versión Inicial

### Agregado
- NUEVO: Arquitectura base con Docker Compose (3 servicios)
  - PostgreSQL 16 Alpine con volumen persistente
  - Node.js / Express API en puerto 3000
  - Nginx Alpine como proxy reverso en puerto 80
- NUEVO: Modelos de base de datos con Sequelize ORM
  - Ticket, Service, Counter, User, Role, Announcement, Setting, SystemLog
  - Asociaciones y relaciones entre modelos
- NUEVO: Seeder inicial con datos de demostración
  - Usuario administrador por defecto
  - Servicios de ejemplo (configurables)
  - Mostradores de ejemplo
- NUEVO: API REST completa con 10 módulos de rutas
- NUEVO: Quiosco básico de toma de turnos (kiosk.html)
- NUEVO: Panel básico de agente (call.html)
- NUEVO: Pantalla pública inicial (display.html)
- NUEVO: Socket.io para comunicación en tiempo real
- NUEVO: MT SDK compartido en app.js (MT.api, MT.socket, MT.toast, MT.playChime)
- NUEVO: Design system en styles.css con modo oscuro glassmorfismo
- NUEVO: Tipografía Google Fonts: Outfit (headings) + Inter (body)

