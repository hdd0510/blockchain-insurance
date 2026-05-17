const { Router } = require('express');
const { getNonce, login, getMe } = require('../controllers/auth-controller');
const authMiddleware = require('../middleware/auth-middleware');

const router = Router();

// Public routes — no auth needed
router.get('/nonce', getNonce);
router.post('/login', login);

// Protected route
router.get('/me', authMiddleware, getMe);

module.exports = router;
