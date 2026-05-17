const { Router } = require('express');
const {
  listClaims,
  createClaim,
  getClaim,
  approveClaim,
  rejectClaim,
  updateStatus,
} = require('../controllers/claim-controller');
const authMiddleware = require('../middleware/auth-middleware');
const { requireAdmin, requireCustomer } = require('../middleware/role-middleware');

const router = Router();

// All claim routes require authentication
router.use(authMiddleware);

router.get('/', listClaims);
router.post('/', requireCustomer, createClaim);
router.get('/:id', getClaim);
router.patch('/:id/approve', requireAdmin, approveClaim);
router.patch('/:id/reject', requireAdmin, rejectClaim);
router.patch('/:id/status', requireAdmin, updateStatus);

module.exports = router;
