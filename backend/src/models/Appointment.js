const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Appointment = sequelize.define('Appointment', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  service_id: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  department_id: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  client_name: {
    type:      DataTypes.STRING(120),
    allowNull: false,
  },
  client_phone: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },
  client_email: {
    type:      DataTypes.STRING(180),
    allowNull: true,
  },
  scheduled_date: {
    type:      DataTypes.DATEONLY,
    allowNull: false,
  },
  scheduled_time: {
    type:      DataTypes.STRING(10), // e.g. "09:30"
    allowNull: false,
  },
  status: {
    type:         DataTypes.STRING(30),
    defaultValue: 'confirmed',
  },
  confirmation_code: {
    type:      DataTypes.STRING(10),
    allowNull: false,
    unique:    true,
  },
  ticket_id: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  notes: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'appointments',
  indexes: [
    { fields: ['scheduled_date'] },
    { fields: ['confirmation_code'] },
    { fields: ['service_id', 'scheduled_date'] },
  ]
});

module.exports = Appointment;
