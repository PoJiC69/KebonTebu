```markdown
# KEBONTEBU — Staging / Security & UX Patch

This patch adds:
- TLS reverse proxy (Caddy) + docker-compose for staging.
- Express security middleware: helmet, rate limiting, body size limits, XSS clean.
- Refresh token flow (rotate & revoke), password reset endpoints (dev returns token), DB migrations.
- Auto-refund background job for idle rooms.
- Commit-reveal helper for RNG audit (HMAC commit).
- Client (Flutter) token persist + refresh + reconnection/resume.
- Simple animated playing card widget for UI polish.

Important notes
- Do NOT commit secrets (JWT_SECRET, ADMIN_TOKEN, SERVER_HMAC_SECRET, EMAIL_FOR_LETSENCRYPT) — use environment variables or Docker secrets.
- Caddy will provision TLS certificates automatically only for resolvable public domains.
- For local dev you can skip Caddy and run server directly (no TLS).

Quick start (local dev)
1. In server folder:
   - npm install
   - npm run migrate
   - export JWT_SECRET="choose_a_secret" ADMIN_TOKEN="choose_admin_token" SERVER_HMAC_SECRET="hmac_secret"
   - NODE_ENV=development node index.js

2. To run staging with Caddy (public domain required):
   - Copy deploy/Caddyfile and set your.domain.tld
   - Create .env file with JWT_SECRET, ADMIN_TOKEN, SERVER_HMAC_SECRET, EMAIL_FOR_LETSENCRYPT
   - cd deploy
   - docker compose -f docker-compose.caddy.yml up --build

Client (Flutter)
- Update serverBase in lib/main.dart to your staging address (https://your.domain.tld).
- On app start call await Provider.of<SocketService>(context, listen:false).loadSavedTokens();
- Use login/signup flows to receive access_token & refresh_token from server.
- Client auto refreshes access token when socket reports auth failure.

Testing flows
- Signup > save tokens > connect socket
- Place bet > host idle > after ROOM_IDLE_TIMEOUT_MS auto refund occurs
- Refresh token: POST /auth/refresh with JSON { "refresh_token": "<id>" }
- Password reset: POST /auth/password-reset-request { username } returns reset token in dev; then POST /auth/password-reset { token, new_password }

Next steps (recommended)
- Integrate email sending for password reset (SMTP/SendGrid).
- Use Docker secrets or a secret manager (Vault) in production for env secrets.
- Add Sentry and prometheus metrics.
- Migrate SQLite -> Postgres and add socket.io Redis adapter for horizontal scaling.
```