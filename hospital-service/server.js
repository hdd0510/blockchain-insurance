const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'insurance_db',
  waitForConnections: true,
  connectionLimit: 5,
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/hospital/records/match', async (req, res) => {
  const expected = process.env.HOSPITAL_API_TOKEN;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (expected && expected !== provided) {
    return res.status(401).json({ error: 'Invalid hospital API token' });
  }

  const { hospital_wallet, patient_id_hash, chain_claim_id, oracle_request_id } = req.body || {};
  if (!hospital_wallet || !patient_id_hash) {
    return res.status(400).json({ error: 'hospital_wallet and patient_id_hash are required' });
  }

  const [rows] = await pool.execute(
    `SELECT id, hospital_wallet, patient_id_hash, patient_name, record_number, diagnosis,
            treatment_date, discharge_date, claimable, coverage_amount_eth, note
       FROM hospital_records
      WHERE hospital_wallet = ? AND patient_id_hash = ?
      ORDER BY updated_at DESC
      LIMIT 1`,
    [hospital_wallet.toLowerCase(), patient_id_hash]
  );

  const record = rows[0] || null;
  const matched = !!record;
  const note = matched
    ? `Hospital service matched record ${record.record_number}; waiting for manual review.`
    : 'No matching hospital record in external hospital service.';

  res.json({
    matched,
    note,
    hospital_wallet: hospital_wallet.toLowerCase(),
    patient_id_hash,
    chain_claim_id: chain_claim_id || null,
    oracle_request_id: oracle_request_id || null,
    record,
  });
});

const port = Number(process.env.HOSPITAL_SERVICE_PORT || 3002);
app.listen(port, () => {
  console.log(`[hospital-service] listening on ${port}`);
});
