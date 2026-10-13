const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Ticket = sequelize.define('Ticket', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  number: {
    type:      DataTypes.STRING(20),
    allowNull: false,
    comment:   'e.g. CG-001, P-CG-001',
  },
  service_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
  },
  counter_id: {
    type:    DataTypes.INTEGER,
    allowNull: true,
  },
  agent_id: {
    type:    DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type:         DataTypes.ENUM('waiting', 'calling', 'attending', 'attended', 'absent', 'cancelled'),
    defaultValue: 'waiting',
  },
  priority: {
    type:         DataTypes.SMALLINT,
    defaultValue: 0,
    comment:      '0 = normal, 1 = derivado, 2 = preferencial (discapacidad)',
  },
  is_preferential: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false,
  },
  preferential_reason: {
    type:      DataTypes.STRING(80),
    allowNull: true,
  },
  transferred_from_service_id: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  transferred_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  client_name: {
    type:    DataTypes.STRING(120),
    allowNull: true,
  },
  notes: {
    type:    DataTypes.TEXT,
    allowNull: true,
  },
  called_at: {
    type:    DataTypes.DATE,
    allowNull: true,
  },
  attended_at: {
    type:    DataTypes.DATE,
    allowNull: true,
  },
  wait_minutes: {
    type:    DataTypes.INTEGER,
    allowNull: true,
  },
  attend_minutes: {
    type:    DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'tickets',
  indexes: [
    { fields: ['created_at'] },
    { fields: ['status'] },
    { fields: ['service_id'] },
    { fields: ['service_id', 'status'] },
    { fields: ['created_at', 'status'] },
    { fields: ['priority', 'created_at'] },
  ]
});

module.exports = Ticket;
