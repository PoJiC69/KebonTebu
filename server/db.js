// server/db.js - simple sqlite helper with Promise wrappers and transactions
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data.db');

const db = new sqlite3.Database(DB_PATH);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/**
 * Run a function inside a database transaction. The provided asyncFn can
 * call runAsync/getAsync/allAsync repeatedly. On success COMMIT is executed,
 * on error ROLLBACK is executed and the error is re-thrown.
 */
async function runInTransaction(asyncFn) {
  await runAsync('BEGIN TRANSACTION');
  try {
    const res = await asyncFn();
    await runAsync('COMMIT');
    return res;
  } catch (err) {
    try {
      await runAsync('ROLLBACK');
    } catch (rbErr) {
      console.error('ROLLBACK failed', rbErr);
    }
    throw err;
  }
}

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync,
  runInTransaction,
  DB_PATH
};