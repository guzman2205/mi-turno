const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Counter = sequelize.define('Counter', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  name: {
    type:      DataTypes.STRING(80),
    allowNull: false,
  },
  agent_id: {
    type:         DataTypes.INTEGER,
    allowNull:    true,
    comment:      'FK → users.id',
  },
  service_id: {
    type:         DataTypes.INTEGER,
    allowNull:    true,
    comment:      'FK → services.id (Servicio asignado a este mostrador)',
  },
  status: {
    type:         DataTypes.STRING(30),
    defaultValue: 'active',
  },
  current_ticket_id: {
    type:    DataTypes.INTEGER,
    allowNull: true,
  },
  active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, { tableName: 'counters' });

module.exports = Counter;
