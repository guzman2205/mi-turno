const express = require('express');
const { Setting } = require('../models');
const { authenticate, logAction } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings — público para que kiosko y display tengan config
router.get('/', async (req, res) => {
  try {
    const list = await Setting.findAll();
    const settings = {};
    list.forEach(s => { settings[s.key] = s.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — actualizar configuración (autenticado)
router.put('/', authenticate, async (req, res) => {
  try {
    const updates = req.body; // { app_name: 'Mi turno', announcement_speed: '10', ... }
    for (const [key, value] of Object.entries(updates)) {
      const existing = await Setting.findOne({ where: { key } });
      if (existing) {
        await existing.update({ value: String(value) });
      } else {
        await Setting.create({ key, value: String(value) });
      }
    }
    await logAction(req.user.id, 'settings_updated', 'setting', null, updates, req.ip);
    req.app.get('io')?.emit('settings:update', updates);
    res.json({ message: 'Configuración guardada correctamente', settings: updates });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
