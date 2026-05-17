const { Router } = require('express');
const { listPublicTransactions, getStats } = require('../controllers/public-controller');

const router = Router();

// Public — no auth required (transparency layer)
router.get('/transactions', listPublicTransactions);
router.get('/stats', getStats);

module.exports = router;
