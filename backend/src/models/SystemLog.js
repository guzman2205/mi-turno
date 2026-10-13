const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const SystemLog = sequelize.define('SystemLog', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  user_id: {
    type:    DataTypes.INTEGER,
    allowNull: true,
  },
  action: {
    type:      DataTypes.STRING(120),
    allowNull: false,
  },
  entity: {
    type:    DataTypes.STRING(60),
    allowNull: true,
    comment: 'e.g. ticket, user, counter',
  },
  entity_id: {
    type:    DataTypes.INTEGER,
    allowNull: true,
  },
  details: {
    type:    DataTypes.JSONB,
    allowNull: true,
  },
  ip: {
    type:    DataTypes.STRING(45),
    allowNull: true,
  },
}, { tableName: 'system_logs', updatedAt: false });

module.exports = SystemLog;
