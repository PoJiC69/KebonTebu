// server/routes/auth_refresh.js
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { runAsync, getAsync, runInTransaction } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const ACCESS_TTL = process.env.ACCESS_TTL_SECONDS ? Number(process.env.ACCESS_TTL_SECONDS) : 30; // e.g. 30s access token for safety in prod set to 60-300
const REFRESH_TTL_DAYS = process.env.REFRESH_TTL_DAYS ? Number(process.env.REFRESH_TTL_DAYS) : 30;

// helper: issue access token
function issueAccessToken(username, role) {
  return jwt.sign({ username, role }, JWT_SECRET, { expiresIn: `${ACCESS_TTL}s` });
}

// create refresh token record and return token_id (opaque token)
async function createRefreshToken(username) {
  const tokenId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  await runAsync(`INSERT INTO refresh_tokens(token_id, username, expires_at, revoked) VALUES(?, ?, ?, 0)`, [tokenId, username, expiresAt]);
  return tokenId;
}

// POST /auth/refresh { refresh_token_id }
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });
    const row = await getAsync(`SELECT token_id, username, expires_at, revoked FROM refresh_tokens WHERE token_id = ?`, [refresh_token]);
    if (!row) return res.status(401).json({ error: 'invalid refresh token' });
    if (row.revoked) return res.status(401).json({ error: 'token revoked' });
    if (new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'refresh token expired' });
    // OK: issue new access token (optionally rotate refresh token)
    const accessToken = issueAccessToken(row.username, /* role unknown here - get from users table if needed */ 'player');
    return res.json({ access_token: accessToken });
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /auth/password-reset-request { username } -> generate token, mail out (mailing not included)
router.post('/password-reset-request', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await runAsync(`INSERT INTO password_resets(token, username, expires_at, used) VALUES(?, ?, ?, 0)`, [token, username, expiresAt]);
    // TODO: send email with token link (out of scope) — return token in response for dev/testing
    return res.json({ ok: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /auth/password-reset { token, new_password }
router.post('/password-reset', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'token and new_password required' });
    const row = await getAsync(`SELECT token, username, expires_at, used FROM password_resets WHERE token = ?`, [token]);
    if (!row) return res.status(400).json({ error: 'invalid token' });
    if (row.used) return res.status(400).json({ error: 'token already used' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'token expired' });
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(new_password, 10);
    await runInTransaction(async () => {
      await runAsync(`UPDATE users SET password_hash = ? WHERE username = ?`, [hash, row.username]);
      await runAsync(`UPDATE password_resets SET used = 1 WHERE token = ?`, [token]);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;