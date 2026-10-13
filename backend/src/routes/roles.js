const express = require('express');
const { Role }    = require('../models');
const { authenticate, logAction } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/roles
router.get('/', async (req, res) => {
  try {
    const roles = await Role.findAll({ order: [['id', 'ASC']] });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/roles/:id
router.get('/:id', async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/roles
router.post('/', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const role = await Role.create({ name, description, permissions: permissions || [] });
    await logAction(req.user.id, 'role_created', 'role', role.id, { name }, req.ip);
    res.status(201).json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/roles/:id
router.put('/:id', async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
    const { name, description, permissions } = req.body;
    await role.update({
      name: name ?? role.name,
      description: description ?? role.description,
      permissions: permissions ?? role.permissions
    });
    await logAction(req.user.id, 'role_updated', 'role', role.id, { name }, req.ip);
    res.json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
    if (['admin', 'agent'].includes(role.name.toLowerCase())) {
      return res.status(400).json({ error: 'No se pueden eliminar los roles base del sistema' });
    }
    await role.destroy();
    await logAction(req.user.id, 'role_deleted', 'role', role.id, { name: role.name }, req.ip);
    res.json({ message: 'Rol eliminado con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
