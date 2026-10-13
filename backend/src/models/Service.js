const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Service = sequelize.define('Service', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  name: {
    type:      DataTypes.STRING(120),
    allowNull: false,
  },
  prefix: {
    type:      DataTypes.STRING(10),
    allowNull: false,
    comment:   'Prefijo del ticket (CG, PED, LAB...)',
  },
  color: {
    type:         DataTypes.STRING(10),
    defaultValue: '#2563eb',
  },
  icon: {
    type:         DataTypes.STRING(60),
    defaultValue: 'fa-ticket',
  },
  active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  description: {
    type:         DataTypes.TEXT,
    defaultValue: '',
  },
  daily_limit: {
    type:         DataTypes.INTEGER,
    defaultValue: 0,
    comment:      '0 = sin límite',
  },
  sequence_start: {
    type:         DataTypes.INTEGER,
    defaultValue: 1,
    comment:      'Número inicial de la secuencia (ej: 1, 100)',
  },
  current_number: {
    type:         DataTypes.INTEGER,
    defaultValue: 0,
    comment:      'Último número emitido',
  },
  type: {
    type:         DataTypes.STRING(20),
    defaultValue: 'service',
    comment:      'service = Atención Pública / General, administrative = Oficina Administrativa',
  },
}, {
  tableName: 'services',
  indexes: [
    { unique: true, fields: ['prefix'] }
  ]
});

module.exports = Service;
