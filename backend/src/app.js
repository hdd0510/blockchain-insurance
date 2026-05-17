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

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// --- Global error handler (works with express-async-errors) ---
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// --- Start server ---
const PORT = process.env.PORT || 3001;

sequelize
  .sync({ alter: false })
  .then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err.message);
    process.exit(1);
  });

module.exports = app;
