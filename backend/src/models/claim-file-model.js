const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClaimFile = sequelize.define(
  'ClaimFile',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // FK to claims.id
    claim_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    // Absolute path on disk under backend/uploads/ (kept for backward compat).
    stored_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // Section 2.1: file goes to IPFS-like service; we keep the CID + sha256
    // hash so the on-chain `evidenceHash` can be verified later.
    ipfs_cid: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    content_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
  },
  {
    tableName: 'claim_files',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

module.exports = ClaimFile;
