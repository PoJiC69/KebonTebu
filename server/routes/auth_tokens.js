const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { runAsync, getAsync, runInTransaction } = require('../db');
const bcrypt = require('bcryptjs');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TTL_SECONDS || 300); // 5 minutes
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);

// issue access token
function issueAccessToken(username, role) {
  return jwt.sign({ username, role }, JWT_SECRET, { expiresIn: `${ACCESS_TTL_SECONDS}s` });
}

async function createRefreshToken(username) {
  const tokenId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  await runAsync(`INSERT INTO refresh_tokens(token_id, username, expires_at, revoked) VALUES(?, ?, ?, 0)`, [tokenId, username, expiresAt]);
  return tokenId;
}

// POST /auth/refresh { refresh_token }
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
    const row = await getAsync(`SELECT token_id, username, expires_at, revoked FROM refresh_tokens WHERE token_id = ?`, [refresh_token]);
    if (!row) return res.status(401).json({ error: 'invalid_refresh' });
    if (row.revoked) return res.status(401).json({ error: 'revoked' });
    if (new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'expired' });

    await runInTransaction(async () => {
      await runAsync(`UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?`, [refresh_token]);
      const newToken = await createRefreshToken(row.username);
      const user = await getAsync(`SELECT username, role FROM users WHERE username = ?`, [row.username]);
      const access = issueAccessToken(user.username, user.role || 'player');
      res.json({ access_token: access, refresh_token: newToken, expires_in: ACCESS_TTL_SECONDS });
    });
  } catch (err) {
    console.error('refresh error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /auth/revoke { refresh_token }
router.post('/revoke', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
    await runAsync(`UPDATE refresh_tokens SET revoked = 1 WHERE token_id = ?`, [refresh_token]);
    res.json({ ok: true });
  } catch (err) {
    console.error('revoke error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// password reset request - dev returns token, prod should send email
router.post('/password-reset-request', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await runAsync(`INSERT INTO password_resets(token, username, expires_at, used) VALUES(?, ?, ?, 0)`, [token, username, expiresAt]);
    // TODO: send email in production.
    res.json({ ok: true, reset_token: token });
  } catch (err) {
    console.error('password-reset-request', err);
    res.status(500).json({ error: 'internal' });
  }
});

// password reset
router.post('/password-reset', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'token and new_password required' });
    const row = await getAsync(`SELECT token, username, expires_at, used FROM password_resets WHERE token = ?`, [token]);
    if (!row) return res.status(400).json({ error: 'invalid_token' });
    if (row.used) return res.status(400).json({ error: 'token_used' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'token_expired' });
    const hash = bcrypt.hashSync(new_password, 10);
    await runInTransaction(async () => {
      await runAsync(`UPDATE users SET password_hash = ? WHERE username = ?`, [hash, row.username]);
      await runAsync(`UPDATE password_resets SET used = 1 WHERE token = ?`, [token]);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('password-reset', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;