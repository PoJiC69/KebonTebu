```markdown
# KEBONTEBU Server — SQLite persistence

What I changed:
- Persist users (balances), rooms, players, and bets into server/data.db using SQLite.
- Added SQL migration file init_db.sql and a migrate.js helper.
- Socket events and REST endpoints now operate against the database.

How to run:
1. Install dependencies:
   - cd server
   - npm install

2. Apply migrations (creates server/data.db):
   - npm run migrate
   (or migrations are applied automatically on server start)

3. Start server:
   - npm start
   Server will listen on http://localhost:3000

Notes:
- This is still a prototype. For production you'd use a proper DB server (Postgres), connection pooling, transactions, and secure auth.
- If you run multiple server instances you must switch to a central DB and handle concurrency/transactions carefully.
```