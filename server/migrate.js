// migrate.js - run the init_db.sql to create tables
const fs = require('fs');
const path = require('path');
const { runAsync } = require('./db');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'init_db.sql'), 'utf8');
    // sqlite3 does not support executing multiple statements via run; split by semicolon safely
    const statements = sql
      .split(/;\s*[\r\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      await runAsync(stmt);
    }
    console.log('Migrations applied.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();