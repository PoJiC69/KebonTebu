// Add at top near other requires
const { securityMiddleware } = require('./middleware/security');
const authTokensRouter = require('./routes/auth_tokens');
const { startAutoRefund } = require('./jobs/auto_refund');

// ... after creating express app:
securityMiddleware(app);

// mount auth tokens router in addition to existing auth routes
app.use('/auth', authTokensRouter);

// later, after io created and server listening:
startAutoRefund(io);