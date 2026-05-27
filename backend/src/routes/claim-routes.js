const { Router } = require('express');
const {
  listClaims,
  createClaim,
  getClaim,
  getClaimChainState,
  signApproval,
  rejectClaim,
  updateStatus,
  escalateClaim,
  syncClaim,
} = require('../controllers/claim-controller');
const authMiddleware = require('../middleware/auth-middleware');
const {
  requireClaimsOperator,
  requireCustomer,
} = require('../middleware/role-middleware');

const router = Router();
router.use(authMiddleware);

router.get('/', listClaims);
router.post('/', requireCustomer, createClaim);
router.get('/:id', getClaim);
router.get('/:id/chain', getClaimChainState);
router.post('/:id/sign', requireClaimsOperator, signApproval);
router.post('/:id/sync', syncClaim);
router.post('/:id/escalate', escalateClaim);
router.patch('/:id/reject', requireClaimsOperator, rejectClaim);
router.patch('/:id/status', requireClaimsOperator, updateStatus);

module.exports = router;
