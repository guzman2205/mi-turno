const { DataTypes } = require('sequelize');
const bcrypt        = require('bcryptjs');
const sequelize     = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  name: {
    type:      DataTypes.STRING(120),
    allowNull: false,
  },
  first_name: {
    type:      DataTypes.STRING(80),
    allowNull: true,
  },
  last_name: {
    type:      DataTypes.STRING(80),
    allowNull: true,
  },
  cedula: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },
  gender: {
    type:         DataTypes.STRING(20),
    defaultValue: 'female',
  },
  is_verified: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  two_factor: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false,
  },
  email: {
    type:      DataTypes.STRING(180),
    allowNull: false,
    validate:  { isEmail: true },
  },
  password_hash: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  role_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
  },
  active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  color: {
    type:         DataTypes.STRING(10),
    defaultValue: '#2563eb',
  },
  permissions: {
    type:         DataTypes.JSONB,
    defaultValue: [],
  },
  is_deleted: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['email'] }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash && !user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash') && !user.password_hash.startsWith('$2a$') && !user.password_hash.startsWith('$2b$')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 10);
      }
    },
  },
});

User.prototype.checkPassword = function(plain) {
  return bcrypt.compare(plain, this.password_hash);
};

User.prototype.toJSON = function() {
  const v = Object.assign({}, this.dataValues);
  delete v.password_hash;
  return v;
};

module.exports = User;
