const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Claim = sequelize.define(
  'Claim',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // On-chain claim ID set after frontend submits transaction
    chain_claim_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    // FK to policies.id (MySQL)
    policy_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    claimant_wallet: {
      type: DataTypes.STRING(42),
      allowNull: false,
    },
    amount_eth: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    evidence_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'under_review',
        'needs_info',
        'approved',
        'rejected',
        'paid'
      ),
      allowNull: false,
      defaultValue: 'pending',
    },
    reject_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tx_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'claims',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = Claim;
