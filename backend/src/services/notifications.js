/**
 * Servicio Centralizado de Notificaciones SMS / WhatsApp / Email
 */

async function sendSMS(toPhone, message) {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
    console.log(`[SMS Simulation] Para: ${toPhone} | Mensaje: ${message}`);
    return { success: true, simulated: true };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    const res = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toPhone
    });
    return { success: true, sid: res.sid };
  } catch (err) {
    console.warn('[SMS Error]:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendWhatsApp(toPhone, message) {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
    console.log(`[WhatsApp Simulation] Para: ${toPhone} | Mensaje: ${message}`);
    return { success: true, simulated: true };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    const res = await client.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM || '+14155238886'}`,
      to: `whatsapp:${toPhone}`
    });
    return { success: true, sid: res.sid };
  } catch (err) {
    console.warn('[WhatsApp Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// Plantillas de notificaciones
const templates = {
  appointmentConfirmed: (code, date, time, serviceName) =>
    `✅ Su cita en *Mi turno* fue confirmada.\n📋 Código: *${code}*\n📅 Fecha: ${date} a las ${time}\n🏢 Área: ${serviceName}\nPresente este código en el quiosco al llegar.`,

  turnApproaching: (ticketNumber, position) =>
    `🔔 Su turno *${ticketNumber}* está próximo. Quedan aproximadamente *${position}* turnos en espera.`,

  turnCalled: (ticketNumber, counterName) =>
    `📢 ¡Atención! Su turno *${ticketNumber}* está siendo llamado en el *${counterName}*. Por favor diríjase al mostrador.`
};

module.exports = {
  sendSMS,
  sendWhatsApp,
  templates
};
