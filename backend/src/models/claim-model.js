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
        'oracle_verified',
        'needs_info',
        'approved',
        'paid',
        'rejected',
        'appealed',
        'appeal_reviewing',
        'appeal_accepted',
        'appeal_rejected',
        'expired'
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
    // v2 fields (multi-sig, oracle, hospital)
    patient_id_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
    hospital_wallet: {
      type: DataTypes.STRING(42),
      allowNull: true,
    },
    approvals_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    threshold_required: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    oracle_request_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    oracle_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    oracle_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Auto-expire if claim sits in non-terminal state past this time.
    timeout_at: {
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
