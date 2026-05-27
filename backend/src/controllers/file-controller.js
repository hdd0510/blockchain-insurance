const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { ClaimFile, Claim } = require('../models');
const ipfs = require('../services/ipfs-service');
const { logAction } = require('../services/audit-service');

/**
 * File controller (Section 2.1 of v2 feedback).
 *
 * Evidence files now go to the mock IPFS service in `services/ipfs-service.js`.
 * Local disk is used only as a temporary multer landing zone and is removed
 * after the file has been pinned. Each ClaimFile row stores both the CID
 * and a sha256 content hash so the on-chain `evidenceHash` can be verified.
 */

// Multer keeps files in memory so we can pin them straight to IPFS without
// hitting disk. 10 MB ceiling matches v1.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).array('files', 10);

async function uploadFiles(req, res) {
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

  if (
    req.user.role === 'customer' &&
    claim.claimant_wallet !== req.user.wallet.toLowerCase()
  ) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const records = await ClaimFile.bulkCreate(
    req.files.map((f) => {
      const { cid, contentHash, size } = ipfs.pinFile({
        buffer: f.buffer,
        originalName: f.originalname,
        mimeType: f.mimetype,
      });
      return {
        claim_id: parseInt(claim_id, 10),
        file_name: f.originalname,
        file_size: size,
        mime_type: f.mimetype,
        stored_path: null,
        ipfs_cid: cid,
        content_hash: contentHash,
      };
    })
  );

  await logAction(req, {
    action: 'claim.file.upload',
    entityType: 'claim',
    entityId: claim.id,
    newValue: { count: records.length, cids: records.map((r) => r.ipfs_cid) },
  });

  return res.status(201).json(records);
}

/**
 * GET /files/:id
 * Streams the file content. Prefers IPFS CID, falls back to legacy disk path
 * if a record was created before the IPFS migration.
 */
async function getFile(req, res) {
  const record = await ClaimFile.findByPk(req.params.id);
  if (!record) return res.status(404).json({ error: 'File not found' });

  if (req.user.role === 'customer') {
    const claim = await Claim.findByPk(record.claim_id);
    if (!claim || claim.claimant_wallet !== req.user.wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.setHeader('Content-Type', record.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${record.file_name}"`);

  if (record.ipfs_cid) {
    const ipfsRes = ipfs.readByCid(record.ipfs_cid);
    if (!ipfsRes) return res.status(404).json({ error: 'File not in IPFS' });
    return ipfsRes.stream.pipe(res);
  }

  if (record.stored_path && fs.existsSync(record.stored_path)) {
    return fs.createReadStream(record.stored_path).pipe(res);
  }
  return res.status(404).json({ error: 'File not found on storage' });
}

/**
 * GET /api/files/ipfs/:cid
 * Public read by CID (Section 2.1: the on-chain hash is the source of truth;
 * anyone can fetch the content to re-verify it).
 */
async function getByCid(req, res) {
  const { cid } = req.params;
  const ipfsRes = ipfs.readByCid(cid);
  if (!ipfsRes) return res.status(404).json({ error: 'CID not found' });
  res.setHeader('Content-Type', ipfsRes.metadata.mimeType || 'application/octet-stream');
  if (ipfsRes.metadata.originalName) {
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${ipfsRes.metadata.originalName}"`
    );
  }
  return ipfsRes.stream.pipe(res);
}

module.exports = { uploadFiles, getFile, getByCid };
