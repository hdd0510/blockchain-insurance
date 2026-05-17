const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { ClaimFile, Claim } = require('../models');

// Store uploads under backend/uploads/ with timestamp-prefixed filenames
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

// Max 10 files, 10 MB each
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array('files', 10);

/**
 * POST /files/upload  [customer]
 * Body (multipart): files[], claim_id
 * Records each uploaded file in claim_files table.
 */
async function uploadFiles(req, res) {
  // Wrap multer in a promise to use async/await
  await new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const { claim_id } = req.body;
  if (!claim_id) {
    return res.status(400).json({ error: 'claim_id is required' });
  }

  const claim = await Claim.findByPk(claim_id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  // Customers can only upload to their own claims
  if (req.user.role === 'customer' &&
      claim.claimant_wallet !== req.user.wallet.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const records = await ClaimFile.bulkCreate(
    req.files.map((f) => ({
      claim_id: parseInt(claim_id, 10),
      file_name: f.originalname,
      file_size: f.size,
      mime_type: f.mimetype,
      stored_path: f.path,
    }))
  );

  return res.status(201).json(records);
}

/**
 * GET /files/:id
 * Stream the file to the client with correct content-type.
 */
async function getFile(req, res) {
  const record = await ClaimFile.findByPk(req.params.id);
  if (!record) return res.status(404).json({ error: 'File not found' });

  // Customers can only access files of their own claims
  if (req.user.role === 'customer') {
    const claim = await Claim.findByPk(record.claim_id);
    if (!claim || claim.claimant_wallet !== req.user.wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  if (!fs.existsSync(record.stored_path)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  res.setHeader('Content-Type', record.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${record.file_name}"`);
  fs.createReadStream(record.stored_path).pipe(res);
}

module.exports = { uploadFiles, getFile };
