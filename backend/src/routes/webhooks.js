const express  = require('express');
const { body } = require('express-validator');
const Webhook  = require('../models/Webhook');
const { authenticate, logAction } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

// GET /api/webhooks
router.get('/', async (req, res) => {
  try {
    const list = await Webhook.findAll({ order: [['id', 'ASC']] });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks
router.post('/', [
  body('url').isURL().withMessage('Debe proporcionar una URL de destino válida'),
  validate
], async (req, res) => {
  try {
    const { url, events, secret, active } = req.body;
    const hook = await Webhook.create({
      url: url.trim(),
      events: Array.isArray(events) ? events : ["ticket.created", "ticket.called", "ticket.attended"],
      secret: secret ? secret.trim() : null,
      active: active !== undefined ? active : true,
    });
    await logAction(req.user.id, 'webhook_created', 'webhook', hook.id, { url }, req.ip);
    res.status(201).json(hook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', async (req, res) => {
  try {
    const hook = await Webhook.findByPk(req.params.id);
    if (!hook) return res.status(404).json({ error: 'Webhook no encontrado' });
    await hook.destroy();
    await logAction(req.user.id, 'webhook_deleted', 'webhook', req.params.id, null, req.ip);
    res.json({ message: 'Webhook eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
