const express = require('express');
const { Counter, User, Service, Ticket } = require('../models');
const { authenticate, logAction }     = require('../middleware/auth');

const router = express.Router();

// GET /api/counters — público o con auth
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    if (req.query.service_id) where.service_id = req.query.service_id;

    const counters = await Counter.findAll({
      where,
      include: [
        { model: User,    as: 'agent',         attributes: ['id','name','color','email'], required: false },
        { model: Service, as: 'service',       attributes: ['id','name','prefix','color','icon','type'], required: false },
        { model: Ticket,  as: 'currentTicket', required: false },
      ],
      order: [['id', 'ASC']],
    });
    res.json(counters);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/counters/:id
router.get('/:id', async (req, res) => {
  try {
    const c = await Counter.findByPk(req.params.id, {
      include: [
        { model: User,    as: 'agent',         required: false },
        { model: Service, as: 'service',       required: false },
        { model: Ticket,  as: 'currentTicket', required: false },
      ],
    });
    if (!c) return res.status(404).json({ error: 'Mostrador no encontrado' });
    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/counters — crear mostrador
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, agent_id, service_id, status } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const c = await Counter.create({
      name: name.trim(),
      agent_id: agent_id || null,
      service_id: service_id || null,
      status: status || 'active',
      active: true
    });

    const full = await Counter.findByPk(c.id, {
      include: [
        { model: User,    as: 'agent' },
        { model: Service, as: 'service' }
      ]
    });

    await logAction(req.user.id, 'counter_created', 'counter', c.id, { name, service_id }, req.ip);
    res.status(201).json(full);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/counters/:id — actualizar mostrador
router.put('/:id', authenticate, async (req, res) => {
  try {
    const c = await Counter.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'Mostrador no encontrado' });

    const { name, agent_id, service_id, status, active } = req.body;
    await c.update({
      name: name ? name.trim() : c.name,
      agent_id: agent_id !== undefined ? (agent_id || null) : c.agent_id,
      service_id: service_id !== undefined ? (service_id || null) : c.service_id,
      status: status || c.status,
      active: active !== undefined ? active : c.active
    });

    const full = await Counter.findByPk(c.id, {
      include: [
        { model: User,    as: 'agent' },
        { model: Service, as: 'service' }
      ]
    });

    await logAction(req.user.id, 'counter_updated', 'counter', c.id, req.body, req.ip);
    res.json(full);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/counters/:id — activar/desactivar mostrador
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const c = await Counter.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'Mostrador no encontrado' });
    await c.update({ active: !c.active });
    await logAction(req.user.id, c.active ? 'counter_activated' : 'counter_deactivated', 'counter', c.id, null, req.ip);
    res.json({ message: `Mostrador ${c.active ? 'activado' : 'desactivado'}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/counters/:id/release — Liberar mostrador y finalizar jornada de operador por administrador
router.post('/:id/release', authenticate, async (req, res) => {
  try {
    const c = await Counter.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'Mostrador no encontrado' });

    const previousAgentId = c.agent_id;
    await c.update({
      agent_id: null,
      current_ticket_id: null,
      status: 'active'
    });

    const full = await Counter.findByPk(c.id, {
      include: [
        { model: User,    as: 'agent',         required: false },
        { model: Service, as: 'service',       required: false },
        { model: Ticket,  as: 'currentTicket', required: false },
      ]
    });

    await logAction(req.user.id, 'counter_released', 'counter', c.id, { previousAgentId }, req.ip);
    req.app.get('io')?.emit('counter:updated', full);

    res.json({ message: `Mostrador "${c.name}" liberado exitosamente.`, counter: full });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/counters/:id/pause — Alternar estado de pausa / receso en un mostrador
router.post('/:id/pause', authenticate, async (req, res) => {
  try {
    const c = await Counter.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'Mostrador no encontrado' });

    const newStatus = c.status === 'paused' ? 'active' : 'paused';
    await c.update({ status: newStatus });

    const full = await Counter.findByPk(c.id, {
      include: [
        { model: User,    as: 'agent',         required: false },
        { model: Service, as: 'service',       required: false },
        { model: Ticket,  as: 'currentTicket', required: false },
      ]
    });

    await logAction(req.user.id, newStatus === 'paused' ? 'counter_paused' : 'counter_resumed', 'counter', c.id, null, req.ip);
    req.app.get('io')?.emit('counter:updated', full);

    res.json({ message: `Mostrador "${c.name}" ${newStatus === 'paused' ? 'puesto en pausa/receso' : 'reanudado a disponible'}`, counter: full });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
