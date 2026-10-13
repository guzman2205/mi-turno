const express  = require('express');
const { body } = require('express-validator');
const { Department, Appointment } = require('../models');
const { authenticate, logAction }  = require('../middleware/auth');
const validate                    = require('../middleware/validate');

const router = express.Router();

// GET /api/departments — listar departamentos (público / con auth)
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    const list = await Department.findAll({ where, order: [['id', 'ASC']] });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/departments/:id
router.get('/:id', async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Departamento no encontrado' });
    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/departments — crear departamento
router.post('/', [
  authenticate,
  body('name').notEmpty().withMessage('El nombre es requerido').trim(),
  body('code').notEmpty().withMessage('El código es requerido').isLength({ max: 10 }).trim(),
  validate
], async (req, res) => {
  try {
    const { name, code, description, color, icon, location, active } = req.body;
    const exists = await Department.findOne({ where: { code: code.toUpperCase().trim() } });
    if (exists) return res.status(409).json({ error: `El código "${code}" ya está registrado` });

    const dept = await Department.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: description || '',
      color: color || '#0284c7',
      icon: icon || 'building-user',
      location: location || '',
      active: active !== undefined ? active : true,
    });

    await logAction(req.user.id, 'department_created', 'department', dept.id, { name, code }, req.ip);
    req.app.get('io')?.emit('departments:changed', dept);

    res.status(201).json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/departments/:id — editar departamento
router.put('/:id', authenticate, async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Departamento no encontrado' });

    const { name, code, description, color, icon, location, active } = req.body;

    if (code && code.toUpperCase().trim() !== dept.code) {
      const exists = await Department.findOne({ where: { code: code.toUpperCase().trim() } });
      if (exists) return res.status(409).json({ error: `El código "${code}" ya está en uso` });
    }

    await dept.update({
      name: name ? name.trim() : dept.name,
      code: code ? code.toUpperCase().trim() : dept.code,
      description: description ?? dept.description,
      color: color ?? dept.color,
      icon: icon ?? dept.icon,
      location: location ?? dept.location,
      active: active !== undefined ? active : dept.active,
    });

    await logAction(req.user.id, 'department_updated', 'department', dept.id, req.body, req.ip);
    req.app.get('io')?.emit('departments:changed', dept);

    res.json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/departments/:id — eliminar departamento
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Departamento no encontrado' });

    const deptId = dept.id;
    const deptName = dept.name;

    await Appointment.update({ department_id: null }, { where: { department_id: deptId } });
    await dept.destroy();

    await logAction(req.user.id, 'department_deleted', 'department', deptId, { name: deptName }, req.ip);
    req.app.get('io')?.emit('departments:changed', { id: deptId, deleted: true });

    res.json({ message: `Departamento "${deptName}" eliminado exitosamente`, id: deptId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
