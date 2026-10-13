const { Op, fn, col } = require('sequelize');
const { Ticket } = require('../models');

/**
 * Calcula el tiempo estimado de espera (ETA) para un ticket basado en su posición en cola y el promedio histórico de atención del servicio.
 */
async function calculateETA(serviceId, positionInQueue) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Obtener promedio de atención del servicio en los últimos 30 días
    const stats = await Ticket.findOne({
      where: {
        service_id: serviceId,
        status: 'attended',
        attend_minutes: { [Op.not]: null }
      },
      attributes: [[fn('AVG', col('attend_minutes')), 'avg_attend']],
      raw: true
    });

    const avgMinutes = Math.max(3, Math.ceil(parseFloat(stats?.avg_attend) || 5));
    const estimatedWaitMinutes = avgMinutes * Math.max(1, positionInQueue);

    return {
      estimated_minutes: estimatedWaitMinutes,
      position_in_queue: positionInQueue,
      avg_attend_minutes: avgMinutes,
      confidence: positionInQueue < 5 ? 'alta' : 'media'
    };
  } catch (err) {
    console.warn('[ETA Calculation Error]:', err.message);
    return {
      estimated_minutes: 5 * Math.max(1, positionInQueue),
      position_in_queue: positionInQueue,
      avg_attend_minutes: 5,
      confidence: 'estimada'
    };
  }
}

module.exports = {
  calculateETA
};
