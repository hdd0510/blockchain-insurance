const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Policy = sequelize.define(
  'Policy',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // On-chain policy ID returned from createPolicy()
    chain_policy_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    customer_wallet: {
      type: DataTypes.STRING(42),
      allowNull: false,
    },
    policy_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    premium_eth: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    max_coverage_eth: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'cancelled'),
      allowNull: false,
      defaultValue: 'active',
    },
    tx_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
    },
  },
  {
    tableName: 'policies',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = Policy;
