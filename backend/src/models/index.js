const User = require('./user-model');
const Policy = require('./policy-model');
const Claim = require('./claim-model');
const ClaimFile = require('./claim-file-model');
const Appeal = require('./appeal-model');
const HospitalVerification = require('./hospital-verification-model');
const HospitalRecord = require('./hospital-record-model');
const AuditLog = require('./audit-log-model');

// Policy <-> Claim
Policy.hasMany(Claim, { foreignKey: 'policy_id', as: 'claims' });
Claim.belongsTo(Policy, { foreignKey: 'policy_id', as: 'policy' });

// Claim <-> ClaimFile
Claim.hasMany(ClaimFile, { foreignKey: 'claim_id', as: 'files' });
ClaimFile.belongsTo(Claim, { foreignKey: 'claim_id', as: 'claim' });

// Claim <-> Appeal
Claim.hasOne(Appeal, { foreignKey: 'claim_id', as: 'appeal' });
Appeal.belongsTo(Claim, { foreignKey: 'claim_id', as: 'claim' });

// Claim <-> HospitalVerification (one claim can have many verification rounds
// because appeals re-trigger the oracle).
Claim.hasMany(HospitalVerification, { foreignKey: 'claim_id', as: 'verifications' });
HospitalVerification.belongsTo(Claim, { foreignKey: 'claim_id', as: 'claim' });
HospitalVerification.belongsTo(HospitalRecord, {
  foreignKey: 'source_record_id',
  as: 'sourceRecord',
});
HospitalRecord.hasMany(HospitalVerification, {
  foreignKey: 'source_record_id',
  as: 'verifications',
});

module.exports = {
  User,
  Policy,
  Claim,
  ClaimFile,
  Appeal,
  HospitalVerification,
  HospitalRecord,
  AuditLog,
};
