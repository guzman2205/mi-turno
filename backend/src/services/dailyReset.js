const { Op } = require('sequelize');
const { sequelize, Service, Counter, Ticket } = require('../models');

/**
 * Función que ejecuta el reinicio diario automático de colas y correlativos (00:00 AM)
 */
async function performDailyReset(io = null) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Cancelar/Expirar turnos no atendidos de jornadas anteriores
    const [expiredCount] = await Ticket.update(
      {
        status: 'cancelled',
        notes: 'Expirado automáticamente al inicio de la nueva jornada'
      },
      {
        where: {
          status: ['waiting', 'calling', 'attending'],
          created_at: { [Op.lt]: today }
        }
      }
    );

    // 2. Liberar todos los mostradores/ventanillas
    await Counter.update(
      { status: 'active', current_ticket_id: null },
      { where: {} }
    );

    // 3. Reiniciar la secuencia de correlativos de todos los servicios a (sequence_start - 1)
    const services = await Service.findAll();
    for (const s of services) {
      const startNum = s.sequence_start || 1;
      await s.update({ current_number: startNum - 1 });
    }

    console.log(`🌅 [Reinicio Diario 00:00 AM] Jornada reiniciada exitosamente. ${expiredCount} turnos previos expirados.`);

    if (io) {
      io.emit('ticket:attended', null);
      io.emit('ticket:new', null);
      io.emit('services:changed', null);
    }

    return { success: true, expiredCount };
  } catch (err) {
    console.error('❌ Error en el reinicio diario automático:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Programa la ejecución del reinicio diario a las 00:00:00 AM exactas
 */
function scheduleDailyReset(io) {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const msToMidnight = nextMidnight.getTime() - now.getTime();

  console.log(`⏰ Reinicio diario programado en ${(msToMidnight / 3600000).toFixed(2)} horas (A las 00:00 AM).`);

  setTimeout(() => {
    performDailyReset(io);
    // Repetir cada 24 horas a partir de las 00:00
    setInterval(() => performDailyReset(io), 24 * 60 * 60 * 1000);
  }, msToMidnight);
}

module.exports = { performDailyReset, scheduleDailyReset };
