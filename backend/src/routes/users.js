const express  = require('express');
const bcrypt   = require('bcryptjs');
const { body } = require('express-validator');
const { User, Role } = require('../models');
const { authenticate, logAction } = require('../middleware/auth');
const validate                   = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { active, role_id, deleted } = req.query;
    const where = {};
    if (deleted === 'true') {
      where.is_deleted = true;
    } else {
      where.is_deleted = false;
      if (active !== undefined) where.active = active === 'true';
    }
    if (role_id) where.role_id = role_id;

    const users = await User.findAll({
      where,
      include: [{ model: Role, as: 'role', attributes: ['id', 'name', 'description', 'permissions'] }],
      order: [['id', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Role, as: 'role' }],
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — crear usuario
router.post('/', [
  body('email').isEmail().withMessage('Debe ser un email válido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('role_id').isInt().withMessage('role_id debe ser un entero válido'),
  validate
], async (req, res) => {
  try {
    const {
      name, first_name, last_name, cedula, gender,
      email, password, role_id, color, is_verified, two_factor, active, permissions
    } = req.body;

    const displayName = name || `${first_name || ''} ${last_name || ''}`.trim();
    if (!displayName) {
      return res.status(400).json({ error: 'Nombre o combinación de nombres/apellidos es requerida' });
    }

    const exists = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (exists) return res.status(409).json({ error: 'El correo electrónico ya está registrado' });

    const passwordHash = await bcrypt.hash(password, 10);

    const assignedRole = await Role.findByPk(parseInt(role_id, 10));
    const rolePerms = Array.isArray(assignedRole?.permissions) ? assignedRole.permissions : [];
    const finalPerms = (Array.isArray(permissions) && permissions.length > 0) ? permissions : rolePerms;

    const user = await User.create({
      name: displayName,
      first_name: first_name || null,
      last_name: last_name || null,
      cedula: cedula || null,
      gender: gender || 'female',
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      role_id: parseInt(role_id, 10),
      color: color || '#2563eb',
      active: active !== undefined ? active : true,
      is_verified: is_verified !== undefined ? is_verified : true,
      two_factor: two_factor !== undefined ? two_factor : false,
      permissions: finalPerms,
      is_deleted: false,
    });

    await logAction(req.user.id, 'user_created', 'user', user.id, { name: displayName, email }, req.ip);
    const full = await User.findByPk(user.id, { include: [{ model: Role, as: 'role' }] });
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — editar usuario
router.put('/:id', [
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('password').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('role_id').optional().isInt().withMessage('role_id debe ser un entero válido'),
  validate
], async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const {
      name, first_name, last_name, cedula, gender,
      email, password, role_id, color, is_verified, two_factor, active, permissions
    } = req.body;

    const updates = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (cedula !== undefined) updates.cedula = cedula;
    if (gender !== undefined) updates.gender = gender;
    if (is_verified !== undefined) updates.is_verified = is_verified;
    if (two_factor !== undefined) updates.two_factor = two_factor;
    if (active !== undefined) updates.active = active;
    if (color) updates.color = color;
    if (role_id) {
      const newRoleId = parseInt(role_id, 10);
      updates.role_id = newRoleId;
      if (!permissions) {
        const assignedRole = await Role.findByPk(newRoleId);
        if (assignedRole && Array.isArray(assignedRole.permissions)) {
          updates.permissions = assignedRole.permissions;
        }
      }
    }
    if (permissions !== undefined) updates.permissions = permissions;

    if (name || first_name || last_name) {
      updates.name = name || `${first_name || user.first_name || ''} ${last_name || user.last_name || ''}`.trim();
    }

    if (email && email.toLowerCase() !== user.email) {
      const exists = await User.findOne({ where: { email: email.toLowerCase() } });
      if (exists) return res.status(409).json({ error: 'El email ya está en uso' });
      updates.email = email.toLowerCase().trim();
    }

    if (password && password.trim()) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    await user.update(updates);
    await logAction(req.user.id, 'user_updated', 'user', user.id, updates, req.ip);

    const full = await User.findByPk(user.id, { include: [{ model: Role, as: 'role' }] });
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/toggle-status — alternar activo/desactivado
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    await user.update({ active: !user.active });
    await logAction(req.user.id, user.active ? 'user_activated' : 'user_deactivated', 'user', user.id, null, req.ip);
    res.json({ message: `Usuario ${user.active ? 'activado' : 'desactivado'}`, active: user.active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:id/restore — restaurar usuario eliminado
router.post('/:id/restore', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    await user.update({ is_deleted: false, active: true });
    await logAction(req.user.id, 'user_restored', 'user', user.id, null, req.ip);
    res.json({ message: 'Usuario restaurado exitosamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id — soft delete o permanente
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (req.query.permanent === 'true') {
      await user.destroy();
      await logAction(req.user.id, 'user_deleted_permanently', 'user', user.id, null, req.ip);
      return res.json({ message: 'Usuario eliminado permanentemente' });
    }

    await user.update({ is_deleted: true, active: false });
    await logAction(req.user.id, 'user_soft_deleted', 'user', user.id, null, req.ip);
    res.json({ message: 'Usuario enviado a eliminados' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
