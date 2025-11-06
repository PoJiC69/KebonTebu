const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const bodyParser = require('body-parser');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

function securityMiddleware(app) {
  // Security headers
  app.use(helmet());

  // CORS - allow list via env var (comma separated), default allow all (dev)
  const allowed = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
  app.use(cors({ origin: allowed, credentials: true }));

  // Body parsing limits
  app.use(bodyParser.json({ limit: process.env.BODY_LIMIT || '100kb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || '100kb' }));

  // Basic XSS cleanup
  app.use(xss());

  // Rate limiting (tune via env)
  const apiLimiter = rateLimit({
    windowMs: Number(process.env.RATE_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_MAX || 200),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  // Apply to sensitive endpoints
  app.use('/auth/', apiLimiter);
  app.use('/api/', apiLimiter);
  app.use('/admin/', apiLimiter);
}

// helper to validate express-validator results
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'validation_failed', details: errors.array() });
  }
  next();
}

module.exports = { securityMiddleware, validateRequest, body };