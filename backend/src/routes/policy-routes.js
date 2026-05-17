const { Router } = require('express');
const { listPolicies, createPolicy, getPolicy, cancelPolicy } = require('../controllers/policy-controller');
const authMiddleware = require('../middleware/auth-middleware');
const { requireAdmin } = require('../middleware/role-middleware');

const router = Router();

// All policy routes require authentication
router.use(authMiddleware);

router.get('/', listPolicies);
router.post('/', requireAdmin, createPolicy);
router.get('/:id', getPolicy);
router.patch('/:id/cancel', requireAdmin, cancelPolicy);

module.exports = router;
