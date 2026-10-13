const sequelize    = require('../config/db');
const Role         = require('./Role');
const User         = require('./User');
const Service      = require('./Service');
const Counter      = require('./Counter');
const Ticket       = require('./Ticket');
const Announcement = require('./Announcement');
const Setting      = require('./Setting');
const SystemLog    = require('./SystemLog');
const Appointment  = require('./Appointment');
const Department   = require('./Department');
const Webhook      = require('./Webhook');

// ── Associations ──────────────────────────────────────────────────────────
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User,   { foreignKey: 'role_id', as: 'users' });

Counter.belongsTo(User,    { foreignKey: 'agent_id',          as: 'agent' });
Counter.belongsTo(Service, { foreignKey: 'service_id',        as: 'service' });
Counter.belongsTo(Ticket,  { foreignKey: 'current_ticket_id', as: 'currentTicket', constraints: false });

Ticket.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Ticket.belongsTo(Service, { foreignKey: 'transferred_from_service_id', as: 'transferredFrom' });
Ticket.belongsTo(Counter, { foreignKey: 'counter_id', as: 'counter' });
Ticket.belongsTo(User,    { foreignKey: 'agent_id',   as: 'agent' });

Appointment.belongsTo(Service,    { foreignKey: 'service_id',    as: 'service' });
Appointment.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
Appointment.belongsTo(Ticket,     { foreignKey: 'ticket_id',     as: 'ticket' });

Department.hasMany(Appointment,  { foreignKey: 'department_id', as: 'appointments' });

SystemLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  Role,
  User,
  Service,
  Counter,
  Ticket,
  Announcement,
  Setting,
  SystemLog,
  Appointment,
  Department,
  Webhook,
};
