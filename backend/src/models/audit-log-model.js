const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Off-chain audit trail (Section 2.6 of the v2 feedback).
 * Every write that mutates a policy / claim / appeal / hospital
 * verification logs an entry here so admins can answer "who did what when".
 *
 * Why off-chain: cheap to query, can store free-form metadata, complements
 * the on-chain events that are the source of truth for money movements.
 */
const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    user_wallet: {
      type: DataTypes.STRING(42),
      allowNull: true,
    },
    user_role: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    old_value: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    new_value: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    tx_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['entity_type', 'entity_id'] },
      { fields: ['user_wallet'] },
      { fields: ['action'] },
    ],
  }
);

module.exports = AuditLog;
