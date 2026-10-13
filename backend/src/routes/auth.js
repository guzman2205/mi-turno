const express  = require('express');
const jwt      = require('jsonwebtoken');
const { body } = require('express-validator');
const { User, Role }            = require('../models');
const { authenticate, logAction } = require('../middleware/auth');
const validate                  = require('../middleware/validate');

const router = express.Router();

function formatUserPayload(user) {
  const roleName = String(user.role?.name || '').toLowerCase().trim();
  const roleId = Number(user.role?.id || user.role_id || 1);

  const rolePerms = Array.isArray(user.role?.permissions) ? user.role.permissions : [];
  const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
  const combinedPerms = Array.from(new Set([...rolePerms, ...userPerms]));

  const isRoleAdmin = roleId === 1 || roleName.includes('admin') || roleName.includes('administrador') || combinedPerms.includes('*');
  const finalPermissions = isRoleAdmin ? ['*'] : combinedPerms;

  return {
    id:       user.id,
    name:     user.name,
    email:    user.email,
    color:    user.color,
    initials: user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    role: {
      id:          roleId,
      name:        user.role?.name || (isRoleAdmin ? 'Administrador' : 'Agente'),
      permissions: finalPermissions,
    },
  };
}

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Debe proporcionar un correo electrónico válido'),
  body('password').notEmpty().withMessage('La contraseña es requerida'),
  validate
], async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      include: [{ model: Role, as: 'role' }],
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await user.checkPassword(password);
    if (!valid) {
      await logAction(null, 'login_failed', 'user', user.id, { email }, req.ip);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role?.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '24h' }
    );

    await logAction(user.id, 'login', 'user', user.id, null, req.ip);

    res.json({
      token,
      user: formatUserPayload(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/refresh — Renovar JWT de sesión para evitar expiración en jornada
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const newToken = jwt.sign(
      { id: req.user.id, email: req.user.email, role: req.user.role?.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '24h' }
    );

    res.json({
      token: newToken,
      user: formatUserPayload(req.user),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al renovar token de sesión' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: formatUserPayload(req.user),
  });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await logAction(req.user.id, 'logout', 'user', req.user.id, null, req.ip);
  res.json({ message: 'Sesión cerrada' });
});

module.exports = router;
