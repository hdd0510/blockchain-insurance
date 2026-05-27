const { Router } = require('express');
const {
  listVerifications,
  getVerification,
  autoVerify,
  manualAnswer,
  registerHospital,
  getRegistryStatus,
  listHospitalCatalog,
} = require('../controllers/hospital-controller');
const authMiddleware = require('../middleware/auth-middleware');
const {
  requireAdmin,
  requireHospital,
  requireVerificationViewer,
} = require('../middleware/role-middleware');

const router = Router();

// Public-ish (token-protected) endpoint used by the oracle service to
// fetch a verdict synchronously. No JWT auth so the oracle daemon does
// not need to maintain a session.
router.post('/verify', autoVerify);

// Admin-only registry status check (public on-chain anyway, but exposed for UI).
router.get('/registry/:wallet', getRegistryStatus);
router.get('/catalog', listHospitalCatalog);

// Authenticated endpoints
router.use(authMiddleware);
router.get('/verifications', requireVerificationViewer, listVerifications);
router.get('/verifications/:id', requireVerificationViewer, getVerification);
router.post('/verifications/:id/manual', requireHospital, manualAnswer);
router.post('/register', requireAdmin, registerHospital);

module.exports = router;
