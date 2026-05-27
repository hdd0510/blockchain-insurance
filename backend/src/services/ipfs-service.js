const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Mock IPFS service (Section 2.1 of the v2 feedback).
 *
 * Implements the *interface* of an IPFS storage layer without running
 * an actual IPFS node:
 *
 *   - `pinFile(buffer | path)` returns a deterministic CID derived from
 *      the SHA-256 of the file's contents, base32-encoded with the same
 *      "Qm..." prefix shape used by IPFS v0 CIDs. Same bytes always
 *      produce the same CID, which is the property we care about for
 *      on-chain `evidenceHash` verification.
 *   - `readByCid(cid)` streams back the file content.
 *
 * Real deployments can swap this out for `pinata`, `web3.storage`,
 * or an `ipfs-http-client` instance; the controller surface is the same.
 *
 * Storage location: `backend/ipfs/<cid>` so it's separate from the
 * legacy `backend/uploads/` directory and easy to flush.
 */

const IPFS_DIR = path.join(__dirname, '../../ipfs');
if (!fs.existsSync(IPFS_DIR)) {
  fs.mkdirSync(IPFS_DIR, { recursive: true });
}

const META_DIR = path.join(IPFS_DIR, '_meta');
if (!fs.existsSync(META_DIR)) {
  fs.mkdirSync(META_DIR, { recursive: true });
}

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

function computeCid(buffer) {
  const sha = crypto.createHash('sha256').update(buffer).digest();
  // Mimic the shape "Qm..." (CIDv0) so downstream code displays it nicely.
  return 'Qm' + base32Encode(sha).slice(0, 44);
}

function contentHashHex(buffer) {
  return '0x' + crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Pin a file. Accepts either a Buffer or a path to a file on disk.
 * Returns { cid, contentHash, size }.
 */
function pinFile({ buffer, sourcePath, originalName, mimeType }) {
  let buf = buffer;
  if (!buf && sourcePath) {
    buf = fs.readFileSync(sourcePath);
  }
  if (!buf) {
    throw new Error('ipfs-service: pinFile requires buffer or sourcePath');
  }

  const cid = computeCid(buf);
  const contentHash = contentHashHex(buf);
  const dest = path.join(IPFS_DIR, cid);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, buf);
  }
  // Sidecar metadata so we can serve with the right mime type later.
  const metaPath = path.join(META_DIR, `${cid}.json`);
  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          cid,
          originalName: originalName || null,
          mimeType: mimeType || 'application/octet-stream',
          contentHash,
          size: buf.length,
          pinnedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }
  return { cid, contentHash, size: buf.length };
}

function readMetadata(cid) {
  const metaPath = path.join(META_DIR, `${cid}.json`);
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
}

function readByCid(cid) {
  const filePath = path.join(IPFS_DIR, cid);
  if (!fs.existsSync(filePath)) return null;
  return {
    stream: fs.createReadStream(filePath),
    metadata: readMetadata(cid) || {},
    size: fs.statSync(filePath).size,
  };
}

function existsCid(cid) {
  return fs.existsSync(path.join(IPFS_DIR, cid));
}

module.exports = {
  pinFile,
  readByCid,
  existsCid,
  readMetadata,
  contentHashHex,
  computeCid,
};
