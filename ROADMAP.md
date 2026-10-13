# ROADMAP — Mi Turno Sistema de Gestión de Turnos

Estado del desarrollo y planificación de funcionalidades futuras.

**Versión actual:** 2.4.0
**Última actualización:** Octubre 2026

---

## Estado Actual del Sistema (v2.4.0)

### Completado al 100%

#### Backend / API, Correos & Seguridad
- [x] Express + Socket.io server con health checks
- [x] PostgreSQL 16 con Sequelize ORM y sync de esquema automático (`ensureDbColumns`)
- [x] Sistema de autenticación JWT con expiración configurable y Refresh Token (`/api/auth/refresh`)
- [x] Servicio de envío de correos electrónicos de confirmación (`email.js` + Nodemailer)
- [x] Rate limiting en endpoints públicos de quiosco (`express-rate-limit`)
- [x] Validación estricta y sanitización de entradas (`express-validator` + `validate.js`)
- [x] Índices de base de datos individuales y compuestos en modelos
- [x] Proxy multimedia backend (`/api/media/proxy`) para bypass de restricciones CSP
- [x] Notificaciones SMS / WhatsApp (`notifications.js`)
- [x] Motor de Webhooks en tiempo real con firma HMAC SHA-256 (`webhooks.js` + `/api/webhooks`)
- [x] Motor de cálculo de Tiempo Estimado de Espera (ETA) basado en historial (`eta.js`)
- [x] Suite de pruebas unitarias críticas con Jest + Supertest (`__tests__/`)

#### Quiosco (`kiosk.html`)
- [x] Flujo en 2 Pasos: Registro por Nombre, Cédula o Teléfono + Selección de Área de Servicio
- [x] Filtrado automático para mostrar únicamente servicios de atención pública general
- [x] Impresión automática de ticket térmico con nombre de usuario e indicador preferencial
- [x] Reimpresión mejorada: búsqueda por código/nombre y lista de turnos emitidos hoy por servicio
- [x] Modal "Tengo una Cita" para convertir reservas de 6 dígitos en turno presencial
- [x] Timeout de inactividad de 45 segundos con retorno automático a Paso 1

#### Panel de Agente / Operador (`call.html`)
- [x] Modal obligatorio de Apertura de Puesto / Inicio de Jornada al ingresar
- [x] Botones de cierre `✕` y `Cancelar` para navegación libre sin quedar atrapado
- [x] Botón `Finalizar Jornada` en la cabecera del puesto activo
- [x] Columna derecha expandida al 100% de altura con controles de filtro integrados
- [x] Pestañas `En Espera` vs `Historial Reciente` con fecha y hora completa (`07/10/2026 23:28`)
- [x] Priorización estricta de los turnos emitidos en el día actual
- [x] Botón dedicado *"Llamar por Nombre de Usuario"* y re-llamado directo
- [x] Atajos de teclado: Espacio, A, U, R, Esc

#### Pantallas TV Separadas (`display.html` y `display.html?type=administrative`)
- [x] Pantalla TV Pública (Atención General) vs Pantalla TV Administrativa (Oficinas/Citas)
- [x] Muestra el nombre del usuario (`Usuario: MARIA TERESA MENDEZ`) en la tarjeta principal
- [x] Cuadrícula multi-mostrador en 3 columnas (2x3)
- [x] Carrusel Multimedia Cíclico de fotos, videos y avisos con tiempo asignado por diapositiva
- [x] Generador de 5 Tonos de Campanada Sintetizados (Ding-Dong, Aeropuerto, Digital, Marimba, Melodía)
- [x] Ruteo silencioso en el panel de operador para emitir audio exclusivamente por la TV

#### Citas, Recepción y Gestión de Áreas
- [x] Panel de Recepción para Secretarias en `appointments.html` (*Marcar Presente*, *Llamar Cita*, *Registrar Visitante Walk-in*)
- [x] Envío de confirmaciones por e-mail y botón de *"Imprimir Comprobante de Cita"*
- [x] Clasificación de Áreas en `services.html`: `Servicio General / Público` vs `Oficina Administrativa`

---

## Próximas Funcionalidades (Visión v3.0.0 SaaS)

- [ ] Multi-tenancy: Soporte para múltiples empresas/sedes aisladas.
- [ ] Panel Super-Administrador para gestión de suscripciones.
- [ ] Integración con Stripe / MercadoPago para facturación recurrente.
