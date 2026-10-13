const { DataTypes } = require('sequelize');
const sequelize     = require('../config/db');

const Webhook = sequelize.define('Webhook', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  url: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  events: {
    type:         DataTypes.JSON, // e.g. ["ticket.created", "ticket.called", "ticket.attended"]
    defaultValue: ["ticket.created", "ticket.called", "ticket.attended"],
  },
  secret: {
    type:      DataTypes.STRING(80),
    allowNull: true,
  },
  active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_triggered_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'webhooks'
});

module.exports = Webhook;
