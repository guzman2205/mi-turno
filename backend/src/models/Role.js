const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Role = sequelize.define('Role', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  name: {
    type:      DataTypes.STRING(60),
    allowNull: false,
  },
  description: {
    type:         DataTypes.STRING(255),
    defaultValue: '',
  },
  permissions: {
    type:         DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array de strings: e.g. ["users.view","tickets.call"]',
  },
}, {
  tableName: 'roles',
  indexes: [
    { unique: true, fields: ['name'] }
  ]
});

module.exports = Role;
