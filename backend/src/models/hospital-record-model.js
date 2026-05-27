const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HospitalRecord = sequelize.define(
  'HospitalRecord',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    hospital_wallet: {
      type: DataTypes.STRING(42),
      allowNull: false,
    },
    patient_id_hash: {
      type: DataTypes.STRING(66),
      allowNull: false,
    },
    patient_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    record_number: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    diagnosis: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    treatment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    discharge_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    claimable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    coverage_amount_eth: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'hospital_records',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['hospital_wallet'] },
      { fields: ['patient_id_hash'] },
      { fields: ['record_number'], unique: true },
    ],
  }
);

module.exports = HospitalRecord;
