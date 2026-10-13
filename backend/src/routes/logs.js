const express = require('express');
const { SystemLog, User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/logs
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, action, entity } = req.query;
    const where = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const { rows: logs, count } = await SystemLog.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    res.json({ logs, total: count, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
