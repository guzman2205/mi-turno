const express    = require('express');
const { body, param } = require('express-validator');
const { Op }     = require('sequelize');
const sequelize  = require('../config/db');
const { Ticket, Service, Counter, User } = require('../models');
const { authenticate, logAction }        = require('../middleware/auth');
const validate                           = require('../middleware/validate');
const { dispatchWebhook }                = require('../services/webhooks');
const { calculateETA }                   = require('../services/eta');

const router = express.Router();

// ── GET /api/tickets/screen-flow — Flujo completo para Pantalla TV ─────────────
// Retorna: 
// 1. attending: turnos actualmente en ventanilla
// 2. upcoming: próximos turnos a ser llamados en espera (prioridad + FIFO)
// 3. attended: últimos turnos atendidos
router.get('/screen-flow', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. En atención o llamando
    const attending = await Ticket.findAll({
      where: {
        status: ['calling', 'attending'],
        created_at: { [Op.gte]: today }
      },
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'color', 'prefix'] },
        { model: Counter, as: 'counter', attributes: ['id', 'name'] },
        { model: User,    as: 'agent',   attributes: ['id', 'name'] },
      ],
      order: [['called_at', 'DESC']],
    });

    // 2. Próximos en ser llamados (ordenados por prioridad DESC, luego por llegada ASC)
    const upcoming = await Ticket.findAll({
      where: {
        status: 'waiting',
        created_at: { [Op.gte]: today }
      },
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'color', 'prefix'] },
        { model: Service, as: 'transferredFrom', attributes: ['id', 'name', 'prefix'] },
      ],
      order: [
        ['priority', 'DESC'],   // 2 = Preferencial, 1 = Derivado/Transferido, 0 = Normal
        ['created_at', 'ASC']   // En empate, quien llegó primero
      ],
      limit: 8,
    });

    // 3. Últimos atendidos recientemente
    const attended = await Ticket.findAll({
      where: {
        status: 'attended',
        created_at: { [Op.gte]: today }
      },
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'color', 'prefix'] },
        { model: Counter, as: 'counter', attributes: ['id', 'name'] },
      ],
      order: [['attended_at', 'DESC']],
      limit: 6,
    });

    res.json({ attending, upcoming, attended });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/queue — cola actual
router.get('/queue', async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      where: { status: ['waiting', 'calling', 'attending'] },
      include: [
        { model: Service, as: 'service', attributes: ['id','name','color','prefix'] },
        { model: Service, as: 'transferredFrom', attributes: ['id','name','prefix'] },
        { model: Counter, as: 'counter', attributes: ['id','name'] },
        { model: User,    as: 'agent',   attributes: ['id','name'] },
      ],
      order: [
        ['priority', 'DESC'],
        ['created_at', 'ASC']
      ],
    });
    res.json(tickets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/last-issued — último turno emitido hoy (para reimpresión rápida)
router.get('/last-issued', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ticket = await Ticket.findOne({
      where: { created_at: { [Op.gte]: today } },
      include: [{ model: Service, as: 'service', attributes: ['id', 'name', 'color', 'prefix'] }],
      order: [['id', 'DESC']]
    });

    if (!ticket) return res.status(404).json({ error: 'No se encontraron turnos emitidos hoy' });
    res.json(ticket);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/today-by-service — listado de turnos emitidos hoy para reimpresión por servicio
router.get('/today-by-service', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { service_id } = req.query;

    const where = { created_at: { [Op.gte]: today } };
    if (service_id) where.service_id = service_id;

    const tickets = await Ticket.findAll({
      where,
      include: [{ model: Service, as: 'service', attributes: ['id', 'name', 'color', 'prefix'] }],
      order: [['id', 'DESC']],
      limit: 100
    });

    res.json(tickets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/lookup — buscar turno por código, número o nombre de usuario para reimpresión
router.get('/lookup', async (req, res) => {
  try {
    const query = req.query.query ? req.query.query.trim().toUpperCase() : '';
    if (!query) return res.status(400).json({ error: 'Debe ingresar un número de turno o nombre de cliente' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ticket = await Ticket.findOne({
      where: {
        [Op.or]: [
          { number: { [Op.iLike]: `%${query}%` } },
          { client_name: { [Op.iLike]: `%${query}%` } }
        ],
        created_at: { [Op.gte]: today }
      },
      include: [{ model: Service, as: 'service', attributes: ['id', 'name', 'color', 'prefix'] }],
      order: [['id', 'DESC']]
    });

    if (!ticket) return res.status(404).json({ error: `No se encontró ningún turno reciente para "${query}"` });
    res.json(ticket);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets/stats — estadísticas del día (autenticado)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const counts = await Ticket.findAll({
      where: { created_at: { [Op.gte]: today } },
      attributes: ['status', [require('sequelize').fn('COUNT','*'), 'count']],
      group: ['status'],
      raw: true,
    });
    const stats = { waiting:0, calling:0, attending:0, attended:0, absent:0, cancelled:0, total:0, preferential: 0 };
    counts.forEach(r => {
      stats[r.status] = parseInt(r.count);
      stats.total += parseInt(r.count);
    });

    stats.preferential = await Ticket.count({
      where: {
        created_at: { [Op.gte]: today },
        is_preferential: true
      }
    });

    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/tickets — listado general (autenticado)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, service_id, date } = req.query;
    const where = {};
    if (status) where.status = status.includes(',') ? status.split(',') : status;
    if (service_id) where.service_id = service_id;
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
        const e = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
        where.created_at = { [Op.between]: [d, e] };
      }
    }
    const tickets = await Ticket.findAll({
      where,
      include: [
        { model: Service, as: 'service', attributes: ['id','name','color','prefix'] },
        { model: Service, as: 'transferredFrom', attributes: ['id','name','prefix'] },
        { model: Counter, as: 'counter', attributes: ['id','name'] },
        { model: User,    as: 'agent',   attributes: ['id','name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 500,
    });
    res.json(tickets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tickets/create — crear turno (quiosco/recepción) con soporte PREFERENCIAL y bloqueo de fila atómico (evita números duplicados)
router.post('/create', [
  body('service_id').isInt().withMessage('service_id es requerido y debe ser un número entero'),
  body('client_name').optional({ nullable: true }).trim(),
  body('is_preferential').optional().isBoolean().withMessage('is_preferential debe ser booleano'),
  body('priority').optional().isInt({ min: 0, max: 2 }).withMessage('priority debe ser entre 0 y 2'),
  validate
], async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { service_id, client_name, is_preferential, preferential_reason, priority } = req.body;
    if (!service_id) {
      await t.rollback();
      return res.status(400).json({ error: 'service_id requerido' });
    }

    // Bloqueo exclusivo de fila (LOCK.UPDATE) para garantía atómica de correlativo
    const service = await Service.findByPk(service_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!service || !service.active) {
      await t.rollback();
      return res.status(400).json({ error: 'Servicio no disponible' });
    }

    // Generar correlativo incremental atómico
    let nextNum = (service.current_number || 0) + 1;
    if (nextNum < (service.sequence_start || 1)) {
      nextNum = service.sequence_start || 1;
    }
    await service.update({ current_number: nextNum }, { transaction: t });

    // Si es preferencial, añadimos prefijo "P-" y nivel de prioridad 2
    const prefFlag = is_preferential === true || is_preferential === 'true';
    const numberPrefix = prefFlag ? `P-${service.prefix}` : service.prefix;
    const number = `${numberPrefix}-${String(nextNum).padStart(3, '0')}`;
    const finalPriority = prefFlag ? 2 : (priority || 0);

    const ticket = await Ticket.create({
      number,
      service_id,
      priority: finalPriority,
      is_preferential: prefFlag,
      preferential_reason: prefFlag ? (preferential_reason || 'Discapacidad / Condición Especial') : null,
      client_name: client_name || null,
      status: 'waiting',
    }, { transaction: t });

    await t.commit();

    const full = await Ticket.findByPk(ticket.id, {
      include: [{ model: Service, as: 'service' }],
    });

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const waitingCount = await Ticket.count({
      where: { service_id, status: 'waiting', created_at: { [Op.gte]: todayStart } }
    });
    const eta = await calculateETA(service_id, waitingCount);

    const resultObj = Object.assign({}, full.toJSON(), { eta });

    req.app.get('io')?.emit('ticket:new', full);
    dispatchWebhook('ticket.created', full).catch(() => {});

    res.status(201).json(resultObj);
  } catch (err) {
    await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/call-next — llamar siguiente turno (prioridad preferencial + derivado + FIFO) con bloqueo de fila para evitar llamado doble
router.post('/call-next', [
  authenticate,
  body('counter_id').isInt().withMessage('counter_id es requerido y debe ser un número entero'),
  body('service_id').optional({ nullable: true }).isInt().withMessage('service_id debe ser un número entero'),
  body('ticket_id').optional({ nullable: true }).isInt().withMessage('ticket_id debe ser un número entero'),
  validate
], async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { counter_id, service_id, ticket_id } = req.body;
    if (!counter_id) {
      await t.rollback();
      return res.status(400).json({ error: 'counter_id requerido' });
    }

    const counter = await Counter.findByPk(counter_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!counter) {
      await t.rollback();
      return res.status(404).json({ error: 'Mostrador no encontrado' });
    }

    // Mark current attending ticket as attended
    if (counter.current_ticket_id) {
      const prev = await Ticket.findByPk(counter.current_ticket_id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (prev && prev.status === 'attending') {
        const attendMins = prev.called_at
          ? Math.round((Date.now() - new Date(prev.called_at).getTime()) / 60000)
          : null;
        await prev.update({ status: 'attended', attended_at: new Date(), attend_minutes: attendMins }, { transaction: t });
        req.app.get('io')?.emit('ticket:attended', prev);
      }
    }

    let next;

    if (ticket_id) {
      next = await Ticket.findOne({
        where: { id: ticket_id },
        include: [
          { model: Service, as: 'service' },
          { model: Service, as: 'transferredFrom' },
        ],
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!next) {
        await t.rollback();
        return res.status(404).json({ error: 'Turno no encontrado' });
      }
    } else {
      const targetServiceId = service_id || counter.service_id;
      const whereNext = { status: 'waiting' };
      if (targetServiceId) whereNext.service_id = targetServiceId;

      next = await Ticket.findOne({
        where: whereNext,
        order: [
          ['priority', 'DESC'],
          ['created_at', 'ASC']
        ],
        include: [
          { model: Service, as: 'service' },
          { model: Service, as: 'transferredFrom' },
        ],
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!next) {
        await counter.update({ status: 'active', current_ticket_id: null }, { transaction: t });
        await t.commit();
        return res.json({ message: 'No hay turnos en espera', ticket: null });
      }
    }

    const calledAt = new Date();
    const waitMins = Math.round((calledAt - new Date(next.created_at)) / 60000);

    await next.update({
      status:        'attending',
      counter_id:    counter_id,
      agent_id:      req.user.id,
      called_at:     calledAt,
      wait_minutes:  waitMins,
    }, { transaction: t });

    await counter.update({ status: 'busy', current_ticket_id: next.id, agent_id: req.user.id }, { transaction: t });

    await t.commit();

    const full = await Ticket.findByPk(next.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Service, as: 'transferredFrom' },
        { model: Counter, as: 'counter' },
        { model: User,    as: 'agent', attributes: ['id','name'] },
      ],
    });

    const payload = {
      ticket: full,
      counter: { id: counter_id, name: counter.name },
      callByMode: req.body.callByMode || null
    };

    req.app.get('io')?.emit('ticket:called', payload);
    dispatchWebhook('ticket.called', payload).catch(() => {});
    await logAction(req.user.id, 'ticket_called', 'ticket', next.id, { counter_id, specific: !!ticket_id }, req.ip);

    res.json({ ticket: full });
  } catch (err) {
    await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});


// POST /api/tickets/:id/transfer — Derivar/Transferir turno a otra área de servicio
router.post('/:id/transfer', [
  authenticate,
  param('id').isInt().withMessage('ID de ticket debe ser un entero'),
  body('to_service_id').isInt().withMessage('to_service_id es requerido y debe ser un entero'),
  body('priority').optional({ nullable: true }).isInt({ min: 0, max: 2 }),
  validate
], async (req, res) => {
  try {
    const { to_service_id, notes, priority } = req.body;
    if (!to_service_id) return res.status(400).json({ error: 'to_service_id requerido' });

    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const targetService = await Service.findByPk(to_service_id);
    if (!targetService) return res.status(404).json({ error: 'Servicio de destino no encontrado' });

    const originalServiceId = ticket.service_id;

    // Liberar mostrador actual si estaba en él
    if (ticket.counter_id) {
      await Counter.update(
        { status: 'active', current_ticket_id: null },
        { where: { id: ticket.counter_id } }
      );
    }

    // Regla de prioridad:
    // Si ya era preferencial (2), conserva nivel 2.
    // Si era normal, sube a nivel 1 (Derivado: atendido antes que nuevos ordinarios pero después de preferenciales)
    const newPriority = ticket.is_preferential ? 2 : (priority !== undefined ? priority : 1);

    await ticket.update({
      transferred_from_service_id: originalServiceId,
      transferred_at: new Date(),
      service_id: to_service_id,
      status: 'waiting',
      counter_id: null,
      agent_id: null,
      priority: newPriority,
      notes: notes ? (ticket.notes ? `${ticket.notes} | ${notes}` : notes) : ticket.notes,
    });

    const updated = await Ticket.findByPk(ticket.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Service, as: 'transferredFrom' },
      ],
    });

    // Notificar en tiempo real que hay un turno transferido listo en la nueva cola
    req.app.get('io')?.emit('ticket:transferred', updated);
    req.app.get('io')?.emit('ticket:new', updated);

    await logAction(req.user.id, 'ticket_transferred', 'ticket', ticket.id, {
      from_service_id: originalServiceId,
      to_service_id
    }, req.ip);

    res.json({ message: 'Turno transferido con éxito a la nueva área', ticket: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets/:id/absent — marcar ausente
router.post('/:id/absent', authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    await ticket.update({ status: 'absent', attended_at: new Date() });
    
    // Liberar mostrador
    if (ticket.counter_id) {
      await Counter.update({ status: 'active', current_ticket_id: null }, { where: { id: ticket.counter_id } });
    }

    req.app.get('io')?.emit('ticket:absent', ticket);
    await logAction(req.user.id, 'ticket_absent', 'ticket', ticket.id, null, req.ip);
    res.json(ticket);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tickets/:id/finish — terminar atención
router.post('/:id/finish', authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    const attendMins = ticket.called_at
      ? Math.round((Date.now() - new Date(ticket.called_at).getTime()) / 60000)
      : null;
    await ticket.update({ status: 'attended', attended_at: new Date(), attend_minutes: attendMins, notes: req.body.notes });
    // Free counter
    if (ticket.counter_id) {
      await Counter.update({ status: 'active', current_ticket_id: null }, { where: { id: ticket.counter_id } });
    }
    req.app.get('io')?.emit('ticket:attended', ticket);
    await logAction(req.user.id, 'ticket_finished', 'ticket', ticket.id, null, req.ip);
    res.json(ticket);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/tickets/:id — cancelar
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    await ticket.update({ status: 'cancelled' });
    await logAction(req.user.id, 'ticket_cancelled', 'ticket', ticket.id, null, req.ip);
    res.json({ message: 'Ticket cancelado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tickets/:id/recall — repetir llamada de turno a mostrador (Pantalla TV + Voces)
router.post('/:id/recall', authenticate, async (req, res) => {
  try {
    const { counter_id } = req.body;
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Service, as: 'transferredFrom' },
        { model: Counter, as: 'counter' },
        { model: User,    as: 'agent', attributes: ['id','name'] },
      ],
    });

    if (!ticket) return res.status(404).json({ error: 'Turno no encontrado' });

    let counterName = ticket.counter?.name || 'Ventanilla';
    if (counter_id) {
      const counter = await Counter.findByPk(counter_id);
      if (counter) counterName = counter.name;
    }

    // Actualizar estado a atendiendo si el turno re-llamado estuviera marcado como ausente o finalizado
    if (['absent', 'attended'].includes(ticket.status)) {
      await ticket.update({
        status: 'attending',
        called_at: new Date(),
        counter_id: counter_id || ticket.counter_id
      });
      if (counter_id) {
        await Counter.update({ status: 'busy', current_ticket_id: ticket.id, agent_id: req.user.id }, { where: { id: counter_id } });
      }
    }

    const payload = {
      ticket,
      counter: { id: counter_id || ticket.counter_id, name: counterName },
      callByMode: req.body.callByMode || null
    };

    req.app.get('io')?.emit('ticket:called', payload);
    dispatchWebhook('ticket.called', payload).catch(() => {});
    await logAction(req.user.id, 'ticket_recalled', 'ticket', ticket.id, { counter_id, counterName }, req.ip);

    res.json({ message: 'Llamada repetida exitosamente', ticket, counterName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/tickets/reset-daily-queue — Restablecer la cola del día e inhabilitar llamadas activas previas
router.post('/reset-daily-queue', authenticate, async (req, res) => {
  try {
    await Counter.update({ status: 'active', current_ticket_id: null }, { where: {} });
    await logAction(req.user.id, 'queue_reset', 'ticket', null, null, req.ip);
    req.app.get('io')?.emit('ticket:attended', null);
    res.json({ message: 'Mostradores y cola de atención restablecida para inicio de jornada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
