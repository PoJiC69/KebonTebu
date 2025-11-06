const crypto = require('crypto');

function hmacCommit(seed, secret) {
  return crypto.createHmac('sha256', secret).update(seed).digest('hex');
}

module.exports = { hmacCommit };