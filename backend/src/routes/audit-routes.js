const { Router } = require('express');
const { listAuditLogs, listForEntity } = require('../controllers/audit-controller');
const authMiddleware = require('../middleware/auth-middleware');
const { requireAdmin } = require('../middleware/role-middleware');

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin);

router.get('/', listAuditLogs);
router.get('/entity/:type/:id', listForEntity);

module.exports = router;
