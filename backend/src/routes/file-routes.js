const { Router } = require('express');
const { uploadFiles, getFile, getByCid } = require('../controllers/file-controller');
const authMiddleware = require('../middleware/auth-middleware');

const router = Router();

// Public IPFS CID lookup so on-chain `evidenceHash` consumers can verify content.
router.get('/ipfs/:cid', getByCid);

// All other file routes require authentication
router.use(authMiddleware);
router.post('/upload', uploadFiles);
router.get('/:id', getFile);

module.exports = router;
