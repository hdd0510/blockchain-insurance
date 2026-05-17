const User = require('./user-model');
const Policy = require('./policy-model');
const Claim = require('./claim-model');
const ClaimFile = require('./claim-file-model');

// Policy → Claims (one-to-many)
Policy.hasMany(Claim, { foreignKey: 'policy_id', as: 'claims' });
Claim.belongsTo(Policy, { foreignKey: 'policy_id', as: 'policy' });

// Claim → ClaimFiles (one-to-many)
Claim.hasMany(ClaimFile, { foreignKey: 'claim_id', as: 'files' });
ClaimFile.belongsTo(Claim, { foreignKey: 'claim_id', as: 'claim' });

module.exports = { User, Policy, Claim, ClaimFile };
