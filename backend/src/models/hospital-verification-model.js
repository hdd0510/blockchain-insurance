const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Hospital-side audit of each verification request the Oracle relayed.
 * The off-chain oracle service writes one row per VerificationRequested
 * event so admins can audit the path: smart contract -> oracle -> hospital -> oracle -> smart contract.
 */
const HospitalVerification = sequelize.define(
  'HospitalVerification',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    claim_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    chain_claim_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    oracle_request_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    hospital_wallet: {
      type: DataTypes.STRING(42),
      allowNull: false,
    },
    patient_id_hash: {
      type: DataTypes.STRING(66),
      allowNull: false,
    },
    patient_id_plain: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    result: {
      type: DataTypes.ENUM('pending', 'verified', 'not_verified', 'error'),
      allowNull: false,
      defaultValue: 'pending',
    },
    status: {
      type: DataTypes.ENUM(
        'pending_manual',
        'verified',
        'not_verified',
        'fulfilled',
        'fulfill_failed'
      ),
      allowNull: false,
      defaultValue: 'pending_manual',
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source_record_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reviewed_by_wallet: {
      type: DataTypes.STRING(42),
      allowNull: true,
    },
    manual_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    requested_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    oracle_tx_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
  },
  {
    tableName: 'hospital_verifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['claim_id'] },
      { fields: ['hospital_wallet'] },
      { fields: ['oracle_request_id'], unique: true },
      { fields: ['result'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = HospitalVerification;
