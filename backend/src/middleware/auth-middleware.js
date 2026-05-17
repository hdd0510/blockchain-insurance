const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Verify JWT from Authorization: Bearer <token> header.
 * Attaches req.user = { id, wallet, role } on success.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }

  const user = await User.findByPk(payload.id);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = { id: user.id, wallet: user.wallet_address, role: user.role };
  next();
}

module.exports = authMiddleware;
