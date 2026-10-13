const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Department = sequelize.define('Department', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  name: {
    type:      DataTypes.STRING(120),
    allowNull: false,
  },
  code: {
    type:      DataTypes.STRING(10),
    allowNull: false,
  },
  description: {
    type:         DataTypes.TEXT,
    defaultValue: '',
  },
  color: {
    type:         DataTypes.STRING(10),
    defaultValue: '#0284c7',
  },
  icon: {
    type:         DataTypes.STRING(60),
    defaultValue: 'building-user',
  },
  location: {
    type:         DataTypes.STRING(120),
    defaultValue: '',
    comment:      'Ubicación física o puerta de destino (ej: Puerta 5 - Piso 2)',
  },
  active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'departments',
  indexes: [
    { unique: true, fields: ['code'] }
  ]
});

module.exports = Department;
