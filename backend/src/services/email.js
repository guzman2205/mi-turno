let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.log('[Email] Nodemailer no cargado. Los correos se simularán en consola.');
}

/**
 * Servicio de Envío de Correos Electrónicos
 * Envía confirmaciones formales de citas agendadas
 */
async function sendAppointmentEmail(appointment, serviceName) {
  if (!appointment || !appointment.client_email) {
    console.log('[Email] Cita sin correo de destinatario.');
    return false;
  }

  const emailHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const emailPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const emailUser = (process.env.SMTP_USER || '').trim();
  const emailPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const emailFrom = process.env.SMTP_FROM || `"Mi Turno - Gestión de Citas" <${emailUser || 'citas@miturno.com'}>`;

  // Fix UTC date offset shift for YYYY-MM-DD
  const rawDateStr = appointment.scheduled_date || appointment.appointment_date || '';
  let dateFormatted = rawDateStr;
  if (rawDateStr && rawDateStr.includes('-')) {
    const [year, month, day] = rawDateStr.split('-');
    const localDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    dateFormatted = localDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.9; }
        .body { padding: 32px 28px; }
        .code-box { background: #e0f2fe; border: 2px dashed #0284c7; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }
        .code-number { font-size: 32px; font-weight: 900; color: #0369a1; letter-spacing: 4px; font-family: monospace; }
        .info-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .info-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .info-table td.label { font-weight: 700; color: #64748b; width: 40%; }
        .info-table td.value { font-weight: 800; color: #0f172a; text-align: right; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Mi turno</h1>
          <p>Confirmación Formal de Cita Administrativa</p>
        </div>
        <div class="body">
          <p style="font-size: 16px; font-weight: 700;">Estimado/a <strong>${appointment.client_name}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            Su cita ha sido agendada exitosamente en nuestro sistema. A continuación le compartimos los detalles de su encuentro:
          </p>

          <div class="code-box">
            <span style="font-size: 12px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 1px;">Código de Confirmación</span>
            <div class="code-number">${appointment.confirmation_code}</div>
          </div>

          <table class="info-table">
            <tr>
              <td class="label">Área / Oficina:</td>
              <td class="value">${serviceName || 'Oficina Administrativa'}</td>
            </tr>
            <tr>
              <td class="label">Fecha Programada:</td>
              <td class="value">${dateFormatted}</td>
            </tr>
            <tr>
              <td class="label">Hora Programada:</td>
              <td class="value">${appointment.appointment_time || appointment.scheduled_time || '10:00'} hrs</td>
            </tr>
            <tr>
              <td class="label">Estado:</td>
              <td class="value" style="color: #10b981;">Confirmada</td>
            </tr>
          </table>

          <p style="font-size: 13px; color: #64748b; margin-top: 24px; line-height: 1.5;">
            📌 <strong>Instrucciones de llegada:</strong> Al llegar al edificio, diríjase a la recepción administrativa y presente su código <strong>${appointment.confirmation_code}</strong> o nombre a la secretaria para marcar su llegada y ser llamado a la oficina.
          </p>
        </div>
        <div class="footer">
          2026© Mi Turno - Sistema de Gestión e Información. Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    if (nodemailer && emailUser && emailPass) {
      console.log(`[Email Transporter] Preparando envío con cuenta Gmail/SMTP (${emailUser})...`);

      const transporterOpts = {
        auth: { user: emailUser, pass: emailPass },
        tls: { rejectUnauthorized: false }
      };

      if (emailHost.includes('gmail')) {
        transporterOpts.service = 'gmail';
      } else {
        transporterOpts.host = emailHost;
        transporterOpts.port = emailPort;
        transporterOpts.secure = emailPort === 465;
      }

      const transporter = nodemailer.createTransport(transporterOpts);

      const info = await transporter.sendMail({
        from: emailFrom,
        to: appointment.client_email,
        subject: `Confirmación de Cita (${appointment.confirmation_code}) — Mi turno`,
        html: htmlContent,
      });

      console.log(`✅ [Email Exitoso] Correo de confirmación enviado a ${appointment.client_email}. MessageID: ${info.messageId}`);
      return true;
    } else {
      console.log(`⚠️ [Email Simulación] Cita confirmada para ${appointment.client_name} (${appointment.client_email}). Código: ${appointment.confirmation_code}`);
      return true;
    }
  } catch (err) {
    console.error('❌ [Email Error Detallado]:', err.message || err);
    return false;
  }
}

module.exports = { sendAppointmentEmail };
