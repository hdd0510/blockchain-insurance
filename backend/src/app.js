require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const sequelize = require('./config/database');
require('./models'); // register all models + associations

const authRoutes = require('./routes/auth-routes');
const policyRoutes = require('./routes/policy-routes');
const claimRoutes = require('./routes/claim-routes');
const fileRoutes = require('./routes/file-routes');
const publicRoutes = require('./routes/public-routes');
const appealRoutes = require('./routes/appeal-routes');
const hospitalRoutes = require('./routes/hospital-routes');
const auditRoutes = require('./routes/audit-routes');

const app = express();

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const ipfsDir = path.join(__dirname, '../ipfs');
if (!fs.existsSync(ipfsDir)) {
  fs.mkdirSync(ipfsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/appeals', appealRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/audit-logs', auditRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
const START_ORACLE = process.env.START_ORACLE_INPROCESS !== 'false';

sequelize
  .sync({ alter: true })
  .then(async () => {
    console.log('Database synced');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Boot the oracle daemon in-process so a single `npm start` runs the
    // full demo. Set START_ORACLE_INPROCESS=false to opt out (e.g. when
    // running the daemon as its own process for prod).
    if (START_ORACLE) {
      try {
        const oracle = require('./services/oracle-service');
        await oracle.start();
      } catch (err) {
        console.warn('[oracle-service] disabled:', err.message);
      }
    }
  })
  .catch((err) => {
    console.error('Failed to sync database:', err.message);
    process.exit(1);
  });

module.exports = app;
