const express  = require('express');
const { body } = require('express-validator');
const { Service, Counter, Ticket } = require('../models');
const { authenticate, logAction } = require('../middleware/auth');
const validate                   = require('../middleware/validate');

const router = express.Router();

// GET /api/services — público para quiosco y display
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    if (req.query.type) where.type = req.query.type;
    const services = await Service.findAll({ where, order: [['id', 'ASC']] });
    res.json(services);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/services/:id
router.get('/:id', async (req, res) => {
  try {
    const s = await Service.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/services — crear área de servicio (autenticado)
router.post('/', [
  authenticate,
  body('name').notEmpty().withMessage('El nombre es requerido').trim(),
  body('prefix').notEmpty().withMessage('El prefijo es requerido').isLength({ max: 10 }).withMessage('El prefijo no puede exceder 10 caracteres').trim(),
  body('daily_limit').optional().isInt({ min: 0 }).withMessage('daily_limit debe ser un entero >= 0'),
  body('sequence_start').optional().isInt({ min: 1 }).withMessage('sequence_start debe ser un entero >= 1'),
  validate
], async (req, res) => {
  try {
    const { name, prefix, color, icon, description, daily_limit, sequence_start, type } = req.body;

    const exists = await Service.findOne({ where: { prefix: prefix.toUpperCase().trim() } });
    if (exists) return res.status(409).json({ error: 'El prefijo ya existe' });

    const startNum = parseInt(sequence_start, 10) || 1;

    const s = await Service.create({
      name: name.trim(),
      prefix: prefix.toUpperCase().trim(),
      color: color || '#0284c7',
      icon: icon || 'stethoscope',
      description: description || '',
      daily_limit: parseInt(daily_limit, 10) || 0,
      sequence_start: startNum,
      current_number: startNum - 1,
      type: type || 'service',
      active: true
    });

    await logAction(req.user.id, 'service_created', 'service', s.id, { name, prefix }, req.ip);
    req.app.get('io')?.emit('services:changed', s);
    res.status(201).json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/services/:id — editar área de servicio y secuencia (autenticado)
router.put('/:id', [
  authenticate,
  body('name').optional().notEmpty().withMessage('El nombre no puede estar vacío').trim(),
  body('prefix').optional().notEmpty().isLength({ max: 10 }).trim(),
  body('daily_limit').optional().isInt({ min: 0 }),
  body('sequence_start').optional().isInt({ min: 1 }),
  body('current_number').optional().isInt({ min: 0 }),
  validate
], async (req, res) => {
  try {
    const s = await Service.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Servicio no encontrado' });

    const { name, prefix, color, icon, description, active, daily_limit, sequence_start, current_number, type } = req.body;

    // Si cambia prefijo, validar que no choque
    if (prefix && prefix.toUpperCase().trim() !== s.prefix) {
      const exists = await Service.findOne({ where: { prefix: prefix.toUpperCase().trim() } });
      if (exists) return res.status(409).json({ error: 'El prefijo ya está en uso' });
    }

    await s.update({
      name: name ?? s.name,
      prefix: prefix ? prefix.toUpperCase().trim() : s.prefix,
      color: color ?? s.color,
      icon: icon ?? s.icon,
      description: description ?? s.description,
      active: active !== undefined ? active : s.active,
      daily_limit: daily_limit !== undefined ? parseInt(daily_limit, 10) : s.daily_limit,
      sequence_start: sequence_start !== undefined ? parseInt(sequence_start, 10) : s.sequence_start,
      current_number: current_number !== undefined ? parseInt(current_number, 10) : s.current_number,
      type: type ?? s.type
    });

    await logAction(req.user.id, 'service_updated', 'service', s.id, req.body, req.ip);
    req.app.get('io')?.emit('services:changed', s);
    res.json(s);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/services/:id/reset-sequence — reiniciar secuencia de turnos (autenticado)
router.post('/:id/reset-sequence', [
  authenticate,
  body('sequence_start').optional().isInt({ min: 1 }),
  validate
], async (req, res) => {
  try {
    const s = await Service.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Servicio no encontrado' });

    const newStart = req.body.sequence_start !== undefined ? parseInt(req.body.sequence_start, 10) : s.sequence_start;
    await s.update({
      sequence_start: newStart,
      current_number: newStart - 1
    });

    await logAction(req.user.id, 'service_sequence_reset', 'service', s.id, { sequence_start: newStart }, req.ip);
    req.app.get('io')?.emit('services:changed', s);
    res.json({ message: `Secuencia reiniciada a partir de ${newStart}`, service: s });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/services/:id/toggle-status — activar o desactivar servicio (autenticado)
router.patch('/:id/toggle-status', authenticate, async (req, res) => {
  try {
    const s = await Service.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Servicio no encontrado' });
    await s.update({ active: !s.active });
    await logAction(req.user.id, s.active ? 'service_activated' : 'service_deactivated', 'service', s.id, null, req.ip);
    req.app.get('io')?.emit('services:changed', s);
    res.json({ message: `Servicio ${s.active ? 'activado' : 'desactivado'}`, active: s.active, service: s });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/services/:id — eliminar permanentemente el servicio (autenticado)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const s = await Service.findByPk(req.params.id);
    if (!s) return res.status(404).json({ error: 'Servicio no encontrado' });

    // Retrocompatibilidad: si query toggle=true, solo cambia de estado
    if (req.query.toggle === 'true') {
      await s.update({ active: !s.active });
      await logAction(req.user.id, s.active ? 'service_activated' : 'service_deactivated', 'service', s.id, null, req.ip);
      req.app.get('io')?.emit('services:changed', s);
      return res.json({ message: `Servicio ${s.active ? 'activado' : 'desactivado'}`, active: s.active });
    }

    const serviceId = s.id;
    const serviceName = s.name;

    // Desvincular mostradores asociados a este servicio
    await Counter.update({ service_id: null }, { where: { service_id: serviceId } });

    // Eliminar tickets asociados a este servicio para mantener integridad referencial
    await Ticket.destroy({ where: { service_id: serviceId } });

    // Eliminar el servicio
    await s.destroy();

    await logAction(req.user.id, 'service_deleted', 'service', serviceId, { name: serviceName }, req.ip);
    req.app.get('io')?.emit('services:deleted', { id: serviceId });
    req.app.get('io')?.emit('services:changed', { id: serviceId, deleted: true });

    res.json({ message: `Servicio "${serviceName}" eliminado exitosamente`, id: serviceId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
