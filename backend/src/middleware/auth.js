const jwt  = require('jsonwebtoken');
const { User, Role, SystemLog } = require('../models');

// ── Verify JWT ──────────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id, {
      include: [{ model: Role, as: 'role' }],
    });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario no autorizado' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// ── Permission guard ────────────────────────────────────────────────────
const authorize = (...perms) => (req, res, next) => {
  const userPerms = req.user?.role?.permissions || [];
  // Admin has all permissions
  if (userPerms.includes('*')) return next();
  const hasAll = perms.every(p => userPerms.includes(p));
  if (!hasAll) {
    return res.status(403).json({ error: 'Permiso denegado' });
  }
  next();
};

// ── Log helper ──────────────────────────────────────────────────────────
const logAction = async (userId, action, entity = null, entityId = null, details = null, ip = null) => {
  try {
    await SystemLog.create({ user_id: userId, action, entity, entity_id: entityId, details, ip });
  } catch (_) { /* non-critical */ }
};

module.exports = { authenticate, authorize, logAction };
