const express  = require('express');
const { body } = require('express-validator');
const { Op }   = require('sequelize');
const sequelize = require('../config/db');
const { Appointment, Service, Department, Ticket } = require('../models');
const { authenticate, logAction }       = require('../middleware/auth');
const validate                         = require('../middleware/validate');
const { sendWhatsApp, templates }      = require('../services/notifications');
const { sendAppointmentEmail }         = require('../services/email');

const router = express.Router();

function generateConfirmationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/appointments — Listar citas (autenticado)
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, service_id, department_id, status } = req.query;
    const where = {};
    if (date) where.scheduled_date = date;
    if (department_id) {
      where.department_id = department_id;
    } else if (service_id) {
      where[Op.or] = [{ service_id: service_id }, { department_id: service_id }];
    }
    if (status) where.status = status;

    const list = await Appointment.findAll({
      where,
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'prefix', 'color'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code', 'color'] }
      ],
      order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']]
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments/lookup/:code — Buscar cita por código de confirmación (público)
router.get('/lookup/:code', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const appt = await Appointment.findOne({
      where: { confirmation_code: code },
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'prefix', 'color'] },
        { model: Department, as: 'department', attributes: ['id', 'name', 'code', 'color'] }
      ]
    });

    if (!appt) {
      return res.status(404).json({ error: `No se encontró ninguna reserva con el código "${code}"` });
    }
    res.json(appt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments — Crear nueva cita de atención (público)
router.post('/', [
  body('service_id').optional({ nullable: true }).isInt().withMessage('service_id debe ser entero'),
  body('department_id').optional({ nullable: true }).isInt().withMessage('department_id debe ser entero'),
  body('client_name').notEmpty().withMessage('El nombre es requerido').trim(),
  body('scheduled_date').isDate().withMessage('Fecha inválida (YYYY-MM-DD)'),
  body('scheduled_time').notEmpty().withMessage('La hora es requerida'),
  body('client_email').optional({ nullable: true }).isEmail().withMessage('Email inválido'),
  validate
], async (req, res) => {
  try {
    const { service_id, department_id, client_name, client_phone, client_email, scheduled_date, scheduled_time, notes } = req.body;

    let targetService = null;
    let targetDepartment = null;

    if (department_id) {
      targetDepartment = await Department.findByPk(department_id);
      if (!targetDepartment || !targetDepartment.active) {
        return res.status(400).json({ error: 'El departamento seleccionado no está activo' });
      }
    } else if (service_id) {
      targetService = await Service.findByPk(service_id);
      if (!targetService || !targetService.active) {
        return res.status(400).json({ error: 'El servicio seleccionado no está activo' });
      }
    } else {
      return res.status(400).json({ error: 'Debe seleccionar un departamento o área de servicio' });
    }

    let confirmation_code = generateConfirmationCode();
    let exists = await Appointment.findOne({ where: { confirmation_code } });
    while (exists) {
      confirmation_code = generateConfirmationCode();
      exists = await Appointment.findOne({ where: { confirmation_code } });
    }

    const appt = await Appointment.create({
      service_id: targetService ? targetService.id : null,
      department_id: targetDepartment ? targetDepartment.id : null,
      client_name: client_name.trim(),
      client_phone: client_phone || null,
      client_email: client_email ? client_email.trim().toLowerCase() : null,
      scheduled_date,
      scheduled_time,
      confirmation_code,
      status: 'confirmed',
      notes: notes || null,
    });

    const full = await Appointment.findByPk(appt.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Department, as: 'department' }
      ]
    });

    const destinationName = full.department ? full.department.name : full.service ? full.service.name : 'Oficina Administrativa';

    if (client_email) {
      await sendAppointmentEmail(full, destinationName).catch((err) => {
        console.error('❌ Error enviando e-mail de cita:', err.message);
      });
    }

    if (client_phone) {
      const msg = templates.appointmentConfirmed(confirmation_code, scheduled_date, scheduled_time, destinationName);
      sendWhatsApp(client_phone, msg).catch(() => {});
    }

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/checkin — Marcar recepción de cita presencial ("Presente en Recepción")
router.post('/:id/checkin', authenticate, async (req, res) => {
  try {
    const appt = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Department, as: 'department' }
      ]
    });

    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    await appt.update({ status: 'checked_in' });
    await logAction(req.user.id, 'appointment_checkin', 'appointment', appt.id, null, req.ip);

    req.app.get('io')?.emit('appointment:update', appt);

    res.json({ message: 'Usuario marcado como presente en recepción', appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/call — Llamado formal de cita administrativa por la secretaria
router.post('/:id/call', authenticate, async (req, res) => {
  try {
    const appt = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Department, as: 'department' }
      ]
    });

    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    await appt.update({ status: 'called' });

    const officeName = req.body.office_name || appt.department?.name || appt.service?.name || 'Oficina Administrativa';
    const doorLocation = req.body.door_location || appt.department?.location || '';

    let fullDestination = officeName;
    if (doorLocation) {
      fullDestination = `${officeName} — ${doorLocation}`;
    }

    const virtualTicket = {
      id: `appt-${appt.id}`,
      number: `CITA-${appt.confirmation_code}`,
      client_name: appt.client_name,
      is_preferential: false,
      service: { name: fullDestination, type: 'administrative' },
      counter: { name: fullDestination }
    };

    const payload = {
      ticket: virtualTicket,
      counter: { name: fullDestination },
      callByMode: 'name'
    };

    req.app.get('io')?.emit('ticket:called', payload);
    req.app.get('io')?.emit('appointment:update', appt);
    await logAction(req.user.id, 'appointment_called', 'appointment', appt.id, { officeName }, req.ip);

    res.json({ message: 'Cita llamada formalmente', appointment: appt, officeName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/convert — Convertir cita en ticket presencial (quiosco/recepción) con transacción atómica
router.post('/:id/convert', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const appt = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Department, as: 'department' }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!appt) {
      await t.rollback();
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    if (appt.status === 'converted') {
      await t.rollback();
      return res.status(400).json({ error: 'Esta cita ya fue convertida en turno previamente' });
    }

    let service = appt.service;
    if (!service) {
      service = await Service.findOne({ where: { active: true }, transaction: t, lock: t.LOCK.UPDATE });
    }

    if (!service) {
      await t.rollback();
      return res.status(400).json({ error: 'No hay un servicio activo para asignar el turno' });
    }

    let nextNum = (service.current_number || 0) + 1;
    if (nextNum < (service.sequence_start || 1)) nextNum = service.sequence_start || 1;
    await service.update({ current_number: nextNum }, { transaction: t });

    const prefix = appt.department ? appt.department.code : service.prefix;
    const number = `C-${prefix}-${String(nextNum).padStart(3, '0')}`;

    const ticket = await Ticket.create({
      number,
      service_id: service.id,
      priority: 1, // Prioridad superior a ordinario por ser cita previa
      client_name: appt.client_name,
      notes: `Cita Programada ${appt.scheduled_date} ${appt.scheduled_time} (Código: ${appt.confirmation_code})`,
      status: 'waiting',
    }, { transaction: t });

    await appt.update({
      status: 'converted',
      ticket_id: ticket.id
    }, { transaction: t });

    await t.commit();

    const fullTicket = await Ticket.findByPk(ticket.id, {
      include: [{ model: Service, as: 'service' }]
    });

    req.app.get('io')?.emit('ticket:new', fullTicket);

    res.json({ message: 'Cita convertida en turno presencial', ticket: fullTicket, appointment: appt });
  } catch (err) {
    await t.rollback().catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/finish — Marcar cita como completada/atendida
router.post('/:id/finish', authenticate, async (req, res) => {
  try {
    const appt = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Department, as: 'department' }
      ]
    });

    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    await appt.update({ status: 'completed' });
    await logAction(req.user.id, 'appointment_completed', 'appointment', appt.id, null, req.ip);
    req.app.get('io')?.emit('appointment:update', appt);

    res.json({ message: 'Cita marcada como completada / atendida', appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/cancel — Cancelar cita (autenticado)
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const appt = await Appointment.findByPk(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    await appt.update({ status: 'cancelled' });
    await logAction(req.user.id, 'appointment_cancelled', 'appointment', appt.id, null, req.ip);

    res.json({ message: 'Cita cancelada exitosamente', appointment: appt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/resend-email — Reenviar correo electrónico de confirmación
router.post('/:id/resend-email', authenticate, async (req, res) => {
  try {
    const appt = await Appointment.findByPk(req.params.id, {
      include: [
        { model: Service, as: 'service' },
        { model: Department, as: 'department' }
      ]
    });

    if (!appt) return res.status(404).json({ error: 'Cita no encontrada' });

    const targetEmail = req.body.email ? req.body.email.trim().toLowerCase() : appt.client_email;
    if (!targetEmail) {
      return res.status(400).json({ error: 'La cita no tiene un correo electrónico registrado' });
    }

    if (req.body.email && req.body.email.trim().toLowerCase() !== appt.client_email) {
      await appt.update({ client_email: targetEmail });
    }

    const destinationName = appt.department ? appt.department.name : appt.service ? appt.service.name : 'Oficina Administrativa';

    const success = await sendAppointmentEmail(appt, destinationName);

    if (success) {
      await logAction(req.user.id, 'appointment_email_resent', 'appointment', appt.id, { email: targetEmail }, req.ip);
      res.json({ message: `Correo de confirmación reenviado exitosamente a ${targetEmail}`, appointment: appt });
    } else {
      res.status(500).json({ error: 'No se pudo enviar el correo electrónico. Verifique la configuración SMTP.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
