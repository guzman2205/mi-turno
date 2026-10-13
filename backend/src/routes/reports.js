const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { Ticket, Service, Counter, User, sequelize } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const start = new Date(dateStr); start.setHours(0,0,0,0);
    const end   = new Date(dateStr); end.setHours(23,59,59,999);
    const where = { created_at: { [Op.between]: [start, end] } };

    const [byStatus, byService, hourly] = await Promise.all([
      // By status
      Ticket.findAll({
        where,
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      // By service
      Ticket.findAll({
        where,
        attributes: [
          'service_id',
          [fn('COUNT', col('Ticket.id')), 'total'],
          [fn('AVG', col('wait_minutes')), 'avg_wait'],
          [fn('AVG', col('attend_minutes')), 'avg_attend'],
        ],
        include: [{ model: Service, as: 'service', attributes: ['name','color','prefix'] }],
        group: ['service_id', 'service.id'],
        raw: true,
        nest: true,
      }),
      // By hour
      Ticket.findAll({
        where,
        attributes: [
          [fn('DATE_PART', 'hour', col('created_at')), 'hour'],
          [fn('COUNT', col('id')), 'count'],
        ],
        group: [fn('DATE_PART', 'hour', col('created_at'))],
        order: [[fn('DATE_PART', 'hour', col('created_at')), 'ASC']],
        raw: true,
      }),
    ]);

    const statusMap = { waiting:0, attending:0, attended:0, absent:0, cancelled:0, total:0 };
    byStatus.forEach(r => {
      statusMap[r.status] = parseInt(r.count);
      statusMap.total += parseInt(r.count);
    });

    if (req.query.format === 'csv') {
      const rows = [
        ['Servicio', 'Prefijo', 'Total Turnos', 'Promedio Espera (min)', 'Promedio Atención (min)'],
        ...byService.map(s => [
          `"${s.service?.name || 'General'}"`,
          `"${s.service?.prefix || ''}"`,
          s.total || 0,
          Math.round(s.avg_wait || 0),
          Math.round(s.avg_attend || 0)
        ])
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=reporte-diario-${dateStr}.csv`);
      return res.send('\uFEFF' + csv);
    }

    res.json({ date: dateStr, stats: statusMap, byService, hourly });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/monthly?year=YYYY&month=MM
router.get('/monthly', async (req, res) => {
  try {
    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59);
    const where = { created_at: { [Op.between]: [start, end] } };

    const [byDay, summary] = await Promise.all([
      Ticket.findAll({
        where,
        attributes: [
          [fn('DATE', col('created_at')), 'day'],
          [fn('COUNT', col('id')), 'total'],
          [fn('SUM', literal("CASE WHEN status='attended' THEN 1 ELSE 0 END")), 'attended'],
          [fn('SUM', literal("CASE WHEN status='absent' THEN 1 ELSE 0 END")),   'absent'],
        ],
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      Ticket.findAll({
        where,
        attributes: [
          [fn('COUNT', col('id')), 'total'],
          [fn('AVG', col('wait_minutes')),   'avg_wait'],
          [fn('AVG', col('attend_minutes')), 'avg_attend'],
        ],
        raw: true,
      }),
    ]);

    res.json({ year, month, byDay, summary: summary[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
