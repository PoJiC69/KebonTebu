const { allAsync, runAsync, getAsync, runInTransaction } = require('../db');

/**
 * Auto-refund worker:
 * - periodically scans rooms for existing bets and refunds if room created_at older than ROOM_IDLE_TIMEOUT_MS
 * - logs an event into game_round_events per refund
 */
const INTERVAL_MS = Number(process.env.REFUND_CHECK_INTERVAL_MS || 60000);
const ROOM_IDLE_TIMEOUT_MS = Number(process.env.ROOM_IDLE_TIMEOUT_MS || 300000); // 5 minutes

async function startAutoRefund(io) {
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - ROOM_IDLE_TIMEOUT_MS).toISOString();
      const rooms = await allAsync(`SELECT id FROM rooms WHERE created_at < ?`, [cutoff]);
      for (const r of rooms) {
        const bets = await allAsync(`SELECT username, amount FROM room_bets WHERE room_id = ? AND amount > 0`, [r.id]);
        if (!bets || bets.length === 0) continue;
        await runInTransaction(async () => {
          for (const b of bets) {
            await runAsync(`UPDATE users SET balance = balance + ? WHERE username = ?`, [b.amount, b.username]);
            await runAsync(
              `INSERT INTO game_round_events(round_id, room_id, username, event_type, payload) VALUES(?, ?, ?, ?, ?)`,
              [null, r.id, b.username, 'auto_refund', JSON.stringify({ amount: b.amount })]
            );
          }
          await runAsync(`DELETE FROM room_bets WHERE room_id = ?`, [r.id]);
        });
        // emit room_update (clients should refetch /lobby or rely on room_update)
        io.to(r.id).emit('room_update', { id: r.id });
        // notify balances
        for (const b of bets) {
          const user = await getAsync(`SELECT username, balance FROM users WHERE username = ?`, [b.username]);
          for (const [id, sock] of io.sockets.sockets) {
            try {
              const s = io.sockets.sockets.get(id);
              if (s && s.data && s.data.username === b.username) {
                s.emit('balance_update', { username: b.username, balance: user.balance });
              }
            } catch (e) {
              // ignore socket emission errors
            }
          }
        }
      }
    } catch (err) {
      console.error('auto_refund worker error', err);
    }
  }, INTERVAL_MS);
}

module.exports = { startAutoRefund };