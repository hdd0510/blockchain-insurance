const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    wallet_address: {
      type: DataTypes.STRING(42),
      allowNull: false,
      unique: true,
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('admin', 'customer', 'hospital', 'insurer'),
      allowNull: false,
      defaultValue: 'customer',
    },
    hospital_name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    // Random string used as MetaMask sign challenge
    nonce: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: () => Math.random().toString(36).substring(2) + Date.now().toString(36),
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = User;
