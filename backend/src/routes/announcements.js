const express = require('express');
const { Announcement } = require('../models');
const { authenticate, logAction } = require('../middleware/auth');

const router = express.Router();

// GET /api/announcements (público para display/pantalla y quiosco)
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.active !== undefined) {
      where.active = req.query.active === 'true';
    }
    const list = await Announcement.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/announcements (autenticado)
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, body, active, media_url, media_type, duration_seconds } = req.body;
    const ann = await Announcement.create({
      title,
      body,
      active: active !== undefined ? active : true,
      media_url: media_url || null,
      media_type: media_type || 'image',
      duration_seconds: parseInt(duration_seconds, 10) || 15
    });
    req.app.get('io')?.emit('announcement:update', ann);
    await logAction(req.user.id, 'announcement_created', 'announcement', ann.id, { title }, req.ip);
    res.status(201).json(ann);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/announcements/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const ann = await Announcement.findByPk(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Anuncio no encontrado' });
    const { title, body, active, media_url, media_type, duration_seconds } = req.body;
    await ann.update({
      title: title ?? ann.title,
      body: body ?? ann.body,
      active: active !== undefined ? active : ann.active,
      media_url: media_url !== undefined ? media_url : ann.media_url,
      media_type: media_type ?? ann.media_type,
      duration_seconds: duration_seconds ? parseInt(duration_seconds, 10) : ann.duration_seconds
    });
    req.app.get('io')?.emit('announcement:update', ann);
    await logAction(req.user.id, 'announcement_updated', 'announcement', ann.id, { title }, req.ip);
    res.json(ann);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/announcements/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const ann = await Announcement.findByPk(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Anuncio no encontrado' });
    await ann.destroy();
    req.app.get('io')?.emit('announcement:update', { id: req.params.id, deleted: true });
    await logAction(req.user.id, 'announcement_deleted', 'announcement', ann.id, null, req.ip);
    res.json({ message: 'Anuncio eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
