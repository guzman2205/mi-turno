require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Role, User, Service, Counter, Ticket, Announcement, Setting, SystemLog } = require('../models');

async function seed() {
  try {
    console.log('🔄 Sincronizando base de datos...');
    await sequelize.sync();
    console.log('✅ Tablas sincronizadas.');

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({
      where: { name: 'admin' },
      defaults: {
        description: 'Administrador del sistema con acceso total',
        permissions: ['*']
      }
    });

    const [agentRole] = await Role.findOrCreate({
      where: { name: 'agent' },
      defaults: {
        description: 'Operador de mostrador / ventanilla',
        permissions: ['tickets:call', 'tickets:attend', 'tickets:view', 'counters:view']
      }
    });

    const [receptionRole] = await Role.findOrCreate({
      where: { name: 'receptionist' },
      defaults: {
        description: 'Recepción y emisión de tickets',
        permissions: ['tickets:create', 'tickets:view', 'kiosk:access']
      }
    });

    console.log('✅ Roles creados.');

    // 2. Users (Hashed explicitly with bcrypt)
    const adminPassHash = await bcrypt.hash('admin123', 10);
    const agentPassHash = await bcrypt.hash('agente123', 10);

    // Admin user
    let adminUser = await User.findOne({ where: { email: 'admin@miturno.com' } });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Administrador Principal',
        email: 'admin@miturno.com',
        password_hash: adminPassHash,
        role_id: adminRole.id,
        active: true
      });
    } else {
      await adminUser.update({ password_hash: adminPassHash, active: true });
    }

    // Agent 1
    let agentUser1 = await User.findOne({ where: { email: 'agente1@miturno.com' } });
    if (!agentUser1) {
      agentUser1 = await User.create({
        name: 'Dra. Elena Ramos',
        email: 'agente1@miturno.com',
        password_hash: agentPassHash,
        role_id: agentRole.id,
        active: true
      });
    } else {
      await agentUser1.update({ password_hash: agentPassHash, active: true });
    }

    // Agent 2
    let agentUser2 = await User.findOne({ where: { email: 'agente2@miturno.com' } });
    if (!agentUser2) {
      agentUser2 = await User.create({
        name: 'Lic. Carlos Mendoza',
        email: 'agente2@miturno.com',
        password_hash: agentPassHash,
        role_id: agentRole.id,
        active: true
      });
    } else {
      await agentUser2.update({ password_hash: agentPassHash, active: true });
    }

    console.log('✅ Usuarios creados con contraseñas encriptadas.');

    // 3. Services (Configurados para cualquier empresa de servicios)
    const servicesData = [
      { name: 'Atención al Cliente', prefix: 'ATC', color: '#0284c7', icon: 'headset',        active: true },
      { name: 'Caja y Cobranzas',    prefix: 'CAJ', color: '#10b981', icon: 'cash-register',  active: true },
      { name: 'Trámites y Asesoría', prefix: 'TRA', color: '#8b5cf6', icon: 'file-lines',     active: true },
      { name: 'Soporte Técnico',     prefix: 'SOP', color: '#f59e0b', icon: 'wrench',         active: true },
      { name: 'Ventas y Contratos',  prefix: 'VEN', color: '#06b6d4', icon: 'briefcase',      active: true },
      { name: 'Consultas Médicas',   prefix: 'MED', color: '#ec4899', icon: 'stethoscope',    active: true }
    ];

    const createdServices = [];
    for (const s of servicesData) {
      let svc = await Service.findOne({ where: { prefix: s.prefix } });
      if (!svc) {
        svc = await Service.create(s);
      }
      createdServices.push(svc);
    }
    console.log('✅ Servicios creados.');

    // 4. Counters (Mostradores)
    const countersData = [
      { name: 'Mostrador 1 - Consulta General', agent_id: agentUser1.id, service_id: createdServices[0].id, status: 'active' },
      { name: 'Mostrador 2 - Pediatría',        agent_id: agentUser2.id, service_id: createdServices[1].id, status: 'active' },
      { name: 'Mostrador 3 - Laboratorio',      agent_id: null,           service_id: createdServices[2].id, status: 'active' },
      { name: 'Mostrador 4 - Farmacia',         agent_id: null,           service_id: createdServices[4].id, status: 'active' }
    ];

    const createdCounters = [];
    for (const c of countersData) {
      let counter = await Counter.findOne({ where: { name: c.name } });
      if (!counter) {
        counter = await Counter.create(c);
      }
      createdCounters.push(counter);
    }
    console.log('✅ Mostradores creados.');

    // 5. Settings
    const settingsData = {
      app_name: 'Mi turno',
      hospital_name: 'Centro de Atención Médica Integral',
      announcement_speed: '12',
      voice_enabled: 'true',
      ticket_prefix: 'MT',
      primary_color: '#0284c7',
      welcome_message: 'Bienvenido al sistema de atención de turnos',
      tts_template_normal: 'Turno {turno}, por favor proceder a {ventanilla}.',
      tts_template_preferential: 'Atención. Turno preferencial {turno}, por favor proceder a {ventanilla}.',
      voice_token_translation: 'Turno',
      tts_rate: '0.9',
      tts_repeats: '1',
      tts_chime_enabled: 'true'
    };

    for (const [key, value] of Object.entries(settingsData)) {
      const existing = await Setting.findOne({ where: { key } });
      if (!existing) {
        await Setting.create({ key, value });
      }
    }
    console.log('✅ Configuraciones creadas.');

    // 6. Announcements
    const announcementsData = [
      { title: 'Bienvenida', body: 'Bienvenido a Mi turno. Por favor tome su turno en el quiosco y espere ser llamado en pantalla.', active: true },
      { title: 'Atención Prioritaria', body: 'Pacientes con discapacidad, adultos mayores y embarazadas tienen atención prioritaria.', active: true },
      { title: 'Horarios', body: 'Horario de atención general de Lunes a Viernes de 7:00 AM a 6:00 PM.', active: true }
    ];

    for (const a of announcementsData) {
      const existing = await Announcement.findOne({ where: { title: a.title } });
      if (!existing) {
        await Announcement.create(a);
      }
    }
    console.log('✅ Anuncios creados.');

    // 7. Initial Tickets demo
    const ticketCount = await Ticket.count();
    if (ticketCount === 0) {
      const now = new Date();

      await Ticket.create({
        number: 'CG-001',
        service_id: createdServices[0].id,
        counter_id: createdCounters[0].id,
        agent_id: agentUser1.id,
        status: 'attended',
        created_at: new Date(now.getTime() - 40 * 60000),
        called_at: new Date(now.getTime() - 35 * 60000),
        attended_at: new Date(now.getTime() - 20 * 60000),
        wait_minutes: 5,
        attend_minutes: 15
      });

      const attendingTicket = await Ticket.create({
        number: 'CG-002',
        service_id: createdServices[0].id,
        counter_id: createdCounters[0].id,
        agent_id: agentUser1.id,
        status: 'attending',
        created_at: new Date(now.getTime() - 15 * 60000),
        called_at: new Date(now.getTime() - 3 * 60000),
        wait_minutes: 12
      });
      await createdCounters[0].update({ current_ticket_id: attendingTicket.id, status: 'busy' });

      // Turno preferencial en espera
      await Ticket.create({
        number: 'P-CG-003',
        service_id: createdServices[0].id,
        priority: 2,
        is_preferential: true,
        preferential_reason: 'Discapacidad',
        status: 'waiting',
        created_at: new Date(now.getTime() - 10 * 60000)
      });

      // Turnos ordinarios en espera
      await Ticket.create({
        number: 'PED-002',
        service_id: createdServices[1].id,
        status: 'waiting',
        created_at: new Date(now.getTime() - 6 * 60000)
      });

      await Ticket.create({
        number: 'LAB-001',
        service_id: createdServices[2].id,
        status: 'waiting',
        created_at: new Date(now.getTime() - 4 * 60000)
      });

      console.log('✅ Tickets iniciales de demostración creados.');
    }

    console.log('🎉 Seed completado exitosamente.');
  } catch (error) {
    console.error('❌ Error en el seed:', error);
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0));
}

module.exports = seed;
