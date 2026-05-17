const { Router } = require('express');
const { uploadFiles, getFile } = require('../controllers/file-controller');
const authMiddleware = require('../middleware/auth-middleware');

const router = Router();

// All file routes require authentication
router.use(authMiddleware);

// multipart/form-data handled inside uploadFiles controller via multer
router.post('/upload', uploadFiles);
router.get('/:id', getFile);

module.exports = router;
