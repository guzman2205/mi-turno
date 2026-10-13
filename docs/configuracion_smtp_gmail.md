# 📧 Guía de Configuración de Correo SMTP con Gmail / Google Workspace

Esta guía contiene las instrucciones paso a paso para configurar el envío automático de correos electrónicos de confirmación de citas en el sistema **Mi Turno**.

---

## 📋 Prerrequisitos

1. Una cuenta de correo de **Gmail** o **Google Workspace** (ejemplo: `citas@empresa.com` o `tu_correo@gmail.com`).
2. Acceso a la configuración de seguridad de la cuenta de Google.

---

## 🔑 Paso 1: Activar la Verificación en Dos Pasos (2FA)

Google requiere que la verificación en dos pasos esté activada para poder generar contraseñas de aplicación seguras.

1. Ve a la página de **[Seguridad de tu cuenta de Google](https://myaccount.google.com/security)**.
2. En la sección *"Cómo inicias sesión en Google"*, haz clic en **Verificación en dos pasos**.
3. Sigue las instrucciones para vincular tu teléfono celular y activa la función.

---

## 🔐 Paso 2: Generar una "Contraseña de Aplicación"

Una contraseña de aplicación es un código seguro de 16 caracteres que le otorga permiso al sistema **Mi Turno** para enviar correos sin revelar la contraseña principal de tu cuenta.

1. Ingresa directamente a **[Contraseñas de aplicaciones de Google](https://myaccount.google.com/apppasswords)**.
2. En el campo *"Nombre de la app"*, escribe: **`Mi Turno - Citas`**.
3. Haz clic en el botón **Crear**.
4. Aparecerá una ventana flotante con una contraseña de **16 caracteres** (ejemplo: `abcd efgh ijkl mnop`).
5. **Copia este código de 16 caracteres** (puedes omitir los espacios).

---

## ⚙️ Paso 3: Configurar el archivo `.env` del Proyecto

Abre el archivo **`.env`** ubicado en la carpeta raíz del proyecto **Mi Turno** y agrega o modifica las siguientes variables de entorno:

```env
# ── CONFIGURACIÓN DE CORREO SMTP (GMAIL) ─────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM="Mi Turno - Gestión de Citas" <tu_correo@gmail.com>
```

> ⚠️ **Atención:**  
> - En `SMTP_USER`, coloca tu dirección de correo completa.
> - En `SMTP_PASS`, pega la contraseña de aplicación de 16 caracteres **sin espacios**.

---

## 🔄 Paso 4: Reiniciar el Servidor Backend

Para que Node.js reconozca las nuevas credenciales de correo:

### Si utilizas Docker Compose (PowerShell):
```powershell
docker compose restart backend
```

### Si ejecutas el backend con Node directamente:
Reinicia la terminal o consola donde ejecutas `npm start` o `npm run dev`.

---

## 🧪 Paso 5: Probar el Envío de Correos

1. Ingresa al módulo **Reserva de Citas** en tu navegador (`http://localhost/appointments.html`).
2. Agenda una nueva cita ingresando un correo electrónico real.
3. Al hacer clic en *"Agendar Cita y Enviar Correo"*, el sistema enviará la confirmación HTML con el código de reserva de 6 dígitos directo a la bandeja de entrada del usuario.
