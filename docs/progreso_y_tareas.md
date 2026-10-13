# 📋 Estado del Proyecto: Mi turno — Control y Seguimiento

**Fecha de actualización:** 09 de Octubre de 2026  
**Nombre oficial del proyecto:** **Mi turno**  
**Arquitectura base:** Node.js (Express + Socket.io) + PostgreSQL 16 + Nginx + Docker Compose + PWA  

---

## 📍 Estado Actual del Desarrollo

El proyecto ha completado exitosamente la **Versión v2.2.0** con mejoras de concurrencia atómica, envío de e-mails SMTP con Gmail, reenvío de confirmaciones, pantalla pública de flyers promocionales HD y atención fluidificada en secretaría.

Se realizaron transacciones con bloqueo exclusivo de fila en PostgreSQL (`Transaction.LOCK.UPDATE`), garantizando que en entornos con ráfagas concurrentes de peticiones no se produzcan números de ticket duplicados ni colisiones de datos.

---

## ✅ Actividades Realizadas (100% Completadas)

### 1. Concurrencia Atómica y Transacciones en BD
- [x] **Transacciones con Bloqueo de Fila (`Transaction.LOCK.UPDATE`):**
  - Implementado en `POST /api/tickets/create` para que el incremento del correlativo por servicio sea 100% atómico e inmune a peticiones simultáneas.
  - Implementado en `POST /api/appointments/:id/convert` para evitar conversiones dobles de citas a turnos.
  - Implementado en `POST /api/tickets/call-next` para garantizar que dos mostradores concurrentes no puedan llamar al mismo turno en esperas simultáneas.

### 2. Notificaciones SMTP Gmail y Reenvío de Confirmaciones
- [x] **Integración SMTP con Gmail (`email.js`):** Soporte para credenciales Google con sanitización automática de claves de aplicación de 16 caracteres.
- [x] **Reenvío de Confirmaciones:** Endpoint `POST /api/appointments/:id/resend-email` y botones de reenvío instantáneo en la agenda de secretaría y confirmación de reserva.
- [x] **Documentación SMTP:** Guía paso a paso en `docs/configuracion_smtp_gmail.md`.

### 3. Pantalla Pública de Flyers y Presentación HD
- [x] **Pantalla de Flyers (`display_announcements.html`):** Pantalla en pantalla completa para Smart TVs y tótems publicitarios que proyecta afiches, flyers y videos promocionales en carrusel animado con barra de progreso.
- [x] **Proxy Inteligente en Nube (`/api/media/proxy`):** Detección y conversión automática de enlaces públicos compartidos de *Nextcloud, ownCloud, Google Drive y Dropbox*.
- [x] **Preservación de Aspecto (`object-fit: contain`):** Los flyers verticales se muestran 100% completos sin recortar títulos ni horarios.

### 4. Atención Fluidificada en Secretaría
- [x] **Botones de Flujo Rápido:** `✅ Atendido` y `⏩ Atendido y Llamar Próximo` en la agenda de secretaría (`appointments.html`) con actualización inmediata de estado a `completed` y tarjeta en verde.
- [x] **Endpoint de Finalización:** `POST /api/appointments/:id/finish` para marcar citas como completadas.
- [x] **Tono Institucional de Llamado:** Extraído en alta fidelidad de video MP4 (`frontend/assets/chime_custom.mp3`) e integrado al sistema de audio.

---

## 📊 Matriz de Módulos y Rutas

| Módulo | Ruta Frontend | API REST | Estado |
|---|---|---|:---:|
| Tablero de Control | `dashboard.html` | `/api/tickets/stats`, `/api/counters` | ✅ 100% |
| Panel de Llamadas | `call.html` | `/api/tickets/call-next`, `/:id/recall`, `/:id/transfer` | ✅ 100% |
| Pantalla TV Pública | `display.html` | `/api/tickets/screen-flow`, `/api/media/proxy` | ✅ 100% |
| Pantalla TV Administrativa | `display.html?type=administrative` | `/api/tickets/screen-flow`, `/api/media/proxy` | ✅ 100% |
| Pantalla de Anuncios / Flyers | `display_announcements.html` | `/api/announcements`, `/api/media/proxy` | ✅ 100% |
| Quiosco de Clientes | `kiosk.html` | `/api/services`, `/api/tickets/create`, `/lookup` | ✅ 100% |
| Reserva de Citas / Recepción | `appointments.html` | `/api/appointments`, `/:id/checkin`, `/:id/call`, `/:id/finish`, `/:id/resend-email` | ✅ 100% |
| Mostradores | `counters.html` | `/api/counters` | ✅ 100% |
| Áreas de Servicio | `services.html` | `/api/services` | ✅ 100% |
| Usuarios y Personal | `users.html` | `/api/users` | ✅ 100% |
| Permisos y Roles | `roles.html` | `/api/roles` | ✅ 100% |
| Reportes y Métricas | `reports.html` | `/api/reports/daily`, `/api/reports/monthly` | ✅ 100% |
| Anuncios en Pantalla | `announcements.html` | `/api/announcements` | ✅ 100% |
| Ajustes del Sistema | `settings.html` | `/api/settings` | ✅ 100% |
| Auditoría y Logs | `logs.html` | `/api/logs` | ✅ 100% |
