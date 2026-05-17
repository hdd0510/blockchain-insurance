const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * GET /auth/nonce?wallet=0x...
 * Find or create user by wallet address, return nonce for signing.
 */
async function getNonce(req, res) {
  const { wallet } = req.query;
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const normalizedWallet = wallet.toLowerCase();
  const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

  const [user] = await User.findOrCreate({
    where: { wallet_address: normalizedWallet },
    defaults: { wallet_address: normalizedWallet, nonce, role: 'customer' },
  });

  // Refresh nonce each request to prevent replay attacks
  await user.update({ nonce });

  return res.json({ nonce: user.nonce });
}

/**
 * POST /auth/login
 * Body: { wallet, signature }
 * Verify MetaMask signature against stored nonce, issue JWT.
 */
async function login(req, res) {
  const { wallet, signature } = req.body;
  if (!wallet || !signature) {
    return res.status(400).json({ error: 'wallet and signature are required' });
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const normalizedWallet = wallet.toLowerCase();
  const user = await User.findOne({ where: { wallet_address: normalizedWallet } });
  if (!user) {
    return res.status(404).json({ error: 'Wallet not registered, call /auth/nonce first' });
  }

  // Reconstruct the message the frontend signed
  const message = `Sign in to Insurance App: ${user.nonce}`;

  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid signature format' });
  }

  if (recoveredAddress.toLowerCase() !== normalizedWallet) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  // Rotate nonce after successful login
  const newNonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
  await user.update({ nonce: newNonce });

  const token = jwt.sign(
    { id: user.id, wallet: user.wallet_address, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      wallet: user.wallet_address,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  });
}

/**
 * GET /auth/me
 * Return current authenticated user.
 */
async function getMe(req, res) {
  const { User: UserModel } = require('../models');
  const user = await UserModel.findByPk(req.user.id, {
    attributes: ['id', 'wallet_address', 'full_name', 'email', 'phone', 'role', 'created_at'],
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
}

module.exports = { getNonce, login, getMe };
