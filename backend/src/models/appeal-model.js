const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Off-chain mirror of the on-chain appeal struct in ClaimsProcessor v2.
 * Stores readable reason, reviewer wallet, and the resolution outcome so
 * the frontend doesn't need to decode on-chain bytes for every request.
 */
const Appeal = sequelize.define(
  'Appeal',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    claim_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    chain_claim_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    appellant_wallet: {
      type: DataTypes.STRING(42),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('filed', 'reviewing', 'accepted', 'rejected'),
      allowNull: false,
      defaultValue: 'filed',
    },
    reviewed_by_wallets: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    resolution_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tx_hash_filed: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
    tx_hash_resolved: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
    filed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'appeals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['claim_id'] },
      { fields: ['appellant_wallet'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = Appeal;
