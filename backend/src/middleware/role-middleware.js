/**
 * Middleware factories for role-based access control.
 * Must be used AFTER authMiddleware so req.user is populated.
 */

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireCustomer(req, res, next) {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customer access required' });
  }
  next();
}

function requireHospital(req, res, next) {
  if (!req.user || req.user.role !== 'hospital') {
    return res.status(403).json({ error: 'Hospital access required' });
  }
  next();
}

function requireInsurer(req, res, next) {
  if (!req.user || req.user.role !== 'insurer') {
    return res.status(403).json({ error: 'Insurer access required' });
  }
  next();
}

function requireAdminOrHospital(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'hospital')) {
    return res.status(403).json({ error: 'Admin or hospital access required' });
  }
  next();
}

function requireClaimsOperator(req, res, next) {
  if (!req.user || !['admin', 'insurer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin or insurer access required' });
  }
  next();
}

function requireVerificationViewer(req, res, next) {
  if (!req.user || !['admin', 'insurer', 'hospital'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Verification access required' });
  }
  next();
}

module.exports = {
  requireAdmin,
  requireCustomer,
  requireHospital,
  requireInsurer,
  requireAdminOrHospital,
  requireClaimsOperator,
  requireVerificationViewer,
};
