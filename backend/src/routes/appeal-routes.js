const { Router } = require('express');
const {
  fileAppeal,
  listAppeals,
  getAppealByClaim,
  reviewAppeal,
} = require('../controllers/appeal-controller');
const authMiddleware = require('../middleware/auth-middleware');
const {
  requireClaimsOperator,
  requireCustomer,
} = require('../middleware/role-middleware');

const router = Router();
router.use(authMiddleware);

router.get('/', listAppeals);
router.post('/', requireCustomer, fileAppeal);
router.get('/:claimId', getAppealByClaim);
router.post('/:claimId/review', requireClaimsOperator, reviewAppeal);

module.exports = router;
