const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Announcement = sequelize.define('Announcement', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  title: {
    type:      DataTypes.STRING(200),
    allowNull: false,
  },
  body: {
    type:      DataTypes.TEXT,
    allowNull: false,
  },
  active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  priority: {
    type:         DataTypes.SMALLINT,
    defaultValue: 0,
  },
  media_url: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  media_type: {
    type:         DataTypes.STRING(20),
    defaultValue: 'image', // 'image', 'video', 'text'
  },
  duration_seconds: {
    type:         DataTypes.INTEGER,
    defaultValue: 15,
  },
}, { tableName: 'announcements' });

module.exports = Announcement;
