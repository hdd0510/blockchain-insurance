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
    // Absolute path on disk under backend/uploads/
    stored_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
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
