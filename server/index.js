// server/index.js - complete server with JWT auth, admin exports, seeded shuffle (audit), host-only, normalized payouts, transactional bets/settlement
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runAsync, getAsync, allAsync, runInTransaction } = require('./db');
const evaluators = require('./evaluators');
const utils = require('./utils');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// env config
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-admin-token';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// apply migrations if init sql exists
const initSqlPath = path.join(__dirname, 'init_db.sql');
if (fs.existsSync(initSqlPath)) {
  const initSql = fs.readFileSync(initSqlPath, 'utf8');
  const statements = initSql
    .split(/;\s*[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  (async () => {
    try {
      for (const stmt of statements) {
        await runAsync(stmt);
      }
      console.log('DB initialized/migrations applied.');
    } catch (err) {
      console.error('DB init error:', err);
    }
  })();
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// helper DB wrappers
async function ensureUser(username, passwordHash = null, role = 'player') {
  if (!username) return;
  if (passwordHash) {
    await runAsync(
      `INSERT OR IGNORE INTO users(username, password_hash, role, balance) VALUES(?, ?, ?, ?)`,
      [username, passwordHash, role, 1000]
    );
  } else {
    await runAsync(
      `INSERT OR IGNORE INTO users(username, balance) VALUES(?, ?)`,
      [username, 1000]
    );
  }
}

async function getUser(username) {
  return getAsync(`SELECT username, password_hash, role, balance FROM users WHERE username = ?`, [username]);
}

async function updateBalance(username, newBalance) {
  await runAsync(`UPDATE users SET balance = ? WHERE username = ?`, [Math.floor(newBalance), username]);
}

async function changeBalance(username, delta) {
  const u = await getUser(username);
  if (!u) throw new Error('user not found');
  const nb = (u.balance || 0) + Math.floor(delta);
  await updateBalance(username, nb);
  return nb;
}

async function createRoomInDb(id, name, host) {
  await runAsync(`INSERT INTO rooms(id, name, host) VALUES(?, ?, ?)`, [id, name, host]);
  await runAsync(`INSERT OR IGNORE INTO room_players(room_id, username) VALUES(?, ?)`, [id, host]);
  await runAsync(`INSERT OR IGNORE INTO room_bets(room_id, username, amount) VALUES(?, ?, ?)`, [id, host, 0]);
}

async function deleteRoomFromDb(id) {
  await runAsync(`DELETE FROM rooms WHERE id = ?`, [id]);
}

async function addPlayerToRoom(roomId, username) {
  await runAsync(`INSERT OR IGNORE INTO room_players(room_id, username) VALUES(?, ?)`, [roomId, username]);
  await runAsync(`INSERT OR IGNORE INTO room_bets(room_id, username, amount) VALUES(?, ?, ?)`, [roomId, username, 0]);
}

async function removePlayerFromRoom(roomId, username) {
  await runAsync(`DELETE FROM room_players WHERE room_id = ? AND username = ?`, [roomId, username]);
  await runAsync(`DELETE FROM room_bets WHERE room_id = ? AND username = ?`, [roomId, username]);
}

async function setBet(roomId, username, amount) {
  await runAsync(`INSERT OR REPLACE INTO room_bets(room_id, username, amount) VALUES(?, ?, ?)`, [roomId, username, Math.floor(amount)]);
}

async function getRoom(roomId) {
  const row = await getAsync(`SELECT id, name, host FROM rooms WHERE id = ?`, [roomId]);
  if (!row) return null;
  const players = await allAsync(`SELECT username FROM room_players WHERE room_id = ?`, [roomId]);
  const betsRows = await allAsync(`SELECT username, amount FROM room_bets WHERE room_id = ?`, [roomId]);
  const bets = {};
  betsRows.forEach(r => { bets[r.username] = r.amount; });
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    players: players.map(p => p.username),
    bets
  };
}

async function listRooms() {
  const rows = await allAsync(`SELECT id, name, host FROM rooms ORDER BY created_at DESC`);
  const result = [];
  for (const r of rows) {
    const players = await allAsync(`SELECT username FROM room_players WHERE room_id = ?`, [r.id]);
    const betsRows = await allAsync(`SELECT username, amount FROM room_bets WHERE room_id = ?`, [r.id]);
    const bets = {};
    betsRows.forEach(b => { bets[b.username] = b.amount; });
    result.push({
      id: r.id,
      name: r.name,
      host: r.host,
      players: players.map(p => p.username),
      bets
    });
  }
  return result;
}

// --- AUTH endpoints: signup & login (JWT) ---
app.post('/auth/signup', async (req, res) => {
  try {
    const { username, password, admin_token } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const uname = username.trim();
    const existing = await getUser(uname);
    if (existing) return res.status(400).json({ error: 'user already exists' });
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const role = (admin_token && admin_token === ADMIN_TOKEN) ? 'admin' : 'player';
    await ensureUser(uname, hash, role);
    const user = await getUser(uname);
    const token = jwt.sign({ username: uname, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: uname, balance: user.balance, role });
  } catch (err) {
    console.error('signup error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const u = await getUser(username.trim());
    if (!u || !u.password_hash) return res.status(400).json({ error: 'invalid credentials' });
    const ok = bcrypt.compareSync(password, u.password_hash);
    if (!ok) return res.status(400).json({ error: 'invalid credentials' });
    const token = jwt.sign({ username: u.username, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: u.username, balance: u.balance, role: u.role });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// wallet & rooms endpoints
app.get('/wallet/:username', async (req, res) => {
  const u = req.params.username;
  const user = await getUser(u);
  res.json({ username: u, balance: user ? user.balance : 0 });
});

app.get('/rooms', async (req, res) => {
  const rooms = await listRooms();
  res.json(rooms);
});

// get round by id (including payouts normalized)
app.get('/round/:roundId', async (req, res) => {
  const id = req.params.roundId;
  const row = await getAsync(`SELECT * FROM game_rounds WHERE id = ?`, [id]);
  if (!row) return res.status(404).json({ error: 'round not found' });
  const payouts = await allAsync(`SELECT username, amount FROM round_payouts WHERE round_id = ?`, [id]);
  const out = {
    id: row.id,
    room_id: row.room_id,
    game_type: row.game_type,
    seed: row.seed,
    deals: JSON.parse(row.deals || '[]'),
    evaluations: JSON.parse(row.evaluations || '{}'),
    winners: JSON.parse(row.winners || '[]'),
    bets_snapshot: JSON.parse(row.bets_snapshot || '{}'),
    payouts: payouts.reduce((acc, p) => { acc[p.username] = p.amount; return acc; }, {}),
    created_at: row.created_at
  };
  res.json(out);
});

// Admin export endpoint
function adminAuthMiddleware(req, res, next) {
  const adminToken = req.header('x-admin-token');
  if (adminToken && adminToken === ADMIN_TOKEN) {
    return next();
  }
  const auth = req.header('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload && payload.role === 'admin') return next();
    } catch (e) {}
  }
  return res.status(403).json({ error: 'admin auth required' });
}

app.get('/admin/rounds', adminAuthMiddleware, async (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  const rows = await allAsync(`SELECT id, room_id, game_type, seed, deals, evaluations, winners, bets_snapshot, created_at FROM game_rounds ORDER BY created_at DESC`);
  if (format === 'csv') {
    const header = ['id','room_id','game_type','seed','winners','bets_snapshot','created_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      // retrieve payouts normalized for row
      const payouts = await allAsync(`SELECT username, amount FROM round_payouts WHERE round_id = ?`, [r.id]);
      const payoutsObj = payouts.reduce((acc,p)=>{ acc[p.username]=p.amount; return acc; }, {});
      const winners = r.winners ? JSON.stringify(JSON.parse(r.winners)) : '[]';
      const bets = r.bets_snapshot ? JSON.stringify(JSON.parse(r.bets_snapshot)) : '{}';
      const payoutsStr = JSON.stringify(payoutsObj);
      const rowCells = [
        `"${r.id}"`,
        `"${r.room_id || ''}"`,
        `"${r.game_type || ''}"`,
        `"${r.seed || ''}"`,
        `"${winners.replace(/"/g, '""')}"`,
        `"${bets.replace(/"/g, '""')}"`,
        `"${payoutsStr.replace(/"/g, '""')}"`,
        `"${r.created_at}"`
      ];
      lines.push(rowCells.join(','));
    }
    res.header('Content-Type', 'text/csv');
    res.send(lines.join('\n'));
  } else {
    const out = [];
    for (const r of rows) {
      const payouts = await allAsync(`SELECT username, amount FROM round_payouts WHERE round_id = ?`, [r.id]);
      const payoutsObj = payouts.reduce((acc,p)=>{ acc[p.username]=p.amount; return acc; }, {});
      out.push({
        id: r.id, room_id: r.room_id, game_type: r.game_type, seed: r.seed,
        deals: JSON.parse(r.deals || '[]'),
        evaluations: JSON.parse(r.evaluations || '{}'),
        winners: JSON.parse(r.winners || '[]'),
        bets_snapshot: JSON.parse(r.bets_snapshot || '{}'),
        payouts: payoutsObj,
        created_at: r.created_at
      });
    }
    res.json(out);
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// --- Socket.io: JWT-based auth + socket handlers ---
io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('auth', async (token) => {
    try {
      if (!token) {
        socket.emit('error', { message: 'no auth token' });
        return;
      }
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload || !payload.username) {
        socket.emit('error', { message: 'invalid token' });
        return;
      }
      const username = payload.username;
      socket.data.username = username;
      socket.data.role = payload.role || 'player';
      await ensureUser(username); // ensure exists
      const user = await getUser(username);
      socket.join('lobby_global');
      const rooms = await listRooms();
      socket.emit('lobby_rooms', rooms);
      socket.emit('balance_update', { username, balance: user.balance });
      io.to('lobby_global').emit('presence', { user: username, online: true });
      console.log('authenticated socket', username);
    } catch (err) {
      console.error('socket auth error', err.message || err);
      socket.emit('error', { message: 'auth failed' });
    }
  });

  // create_room
  socket.on('create_room', async ({ roomName }) => {
    try {
      const username = socket.data.username || 'guest';
      await ensureUser(username);
      const id = 'room_' + Math.random().toString(36).substring(2, 9);
      const roomN = roomName || `Room ${id}`;
      await createRoomInDb(id, roomN, username);
      const rooms = await listRooms();
      io.to('lobby_global').emit('lobby_rooms', rooms);
      const room = await getRoom(id);
      io.to(id).emit('room_update', room);
      socket.join(id);
      console.log('room created', room);
    } catch (err) {
      console.error('create_room error', err);
      socket.emit('error', { message: 'create_room failed' });
    }
  });

  // join_room
  socket.on('join_room', async ({ roomId }) => {
    try {
      const username = socket.data.username || 'guest';
      const r = await getRoom(roomId);
      if (!r) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      await ensureUser(username);
      await addPlayerToRoom(roomId, username);
      const rooms = await listRooms();
      io.to('lobby_global').emit('lobby_rooms', rooms);
      const room = await getRoom(roomId);
      io.to(roomId).emit('room_update', room);
      socket.join(roomId);
      console.log(username, 'joined', roomId);
    } catch (err) {
      console.error('join_room error', err);
      socket.emit('error', { message: 'join_room failed' });
    }
  });

  // leave_room
  socket.on('leave_room', async ({ roomId }) => {
    try {
      const username = socket.data.username || 'guest';
      const room = await getRoom(roomId);
      if (!room) return;
      await removePlayerFromRoom(roomId, username);
      const after = await getRoom(roomId);
      if (!after || (after.players && after.players.length === 0)) {
        await deleteRoomFromDb(roomId);
      } else {
        if (room.host === username) {
          const newRoom = await getRoom(roomId);
          const newHost = newRoom.players[0];
          await runAsync(`UPDATE rooms SET host = ? WHERE id = ?`, [newHost, roomId]);
        }
      }
      const rooms = await listRooms();
      io.to('lobby_global').emit('lobby_rooms', rooms);
      const roomNow = await getRoom(roomId);
      io.to(roomId).emit('room_update', roomNow || {});
      socket.leave(roomId);
      console.log(username, 'left', roomId);
    } catch (err) {
      console.error('leave_room error', err);
    }
  });

  // place_bet (transactional)
  socket.on('place_bet', async ({ roomId, amount }) => {
    const username = socket.data.username || 'guest';
    try {
      await runInTransaction(async () => {
        const am = Math.floor(Number(amount) || 0);
        if (am <= 0) throw new Error('Amount must be > 0');
        const user = await getUser(username);
        if (!user || (user.balance || 0) < am) throw new Error('Insufficient balance');
        await changeBalance(username, -am);
        const existing = await getAsync(`SELECT amount FROM room_bets WHERE room_id = ? AND username = ?`, [roomId, username]);
        const newBet = (existing ? existing.amount : 0) + am;
        await setBet(roomId, username, newBet);
      });
      const room = await getRoom(roomId);
      io.to(roomId).emit('room_update', room);
      socket.emit('bet_placed', { roomId, username, amount: room && room.bets ? (room.bets[username] || 0) : 0 });
      const updatedUser = await getUser(username);
      socket.emit('balance_update', { username, balance: updatedUser.balance });
      console.log(`${username} placed bet ${amount} in ${roomId}`);
    } catch (err) {
      console.error('place_bet error (transaction):', err);
      socket.emit('bet_error', { message: err.message || 'place_bet failed' });
    }
  });

  // host-check helper
  async function ensureCallerIsHost(socket, roomId) {
    const username = socket.data.username;
    const room = await getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (room.host !== username) throw new Error('Only host can start the game');
    return room;
  }

  // start_game_poker (host-only, transactional + audit + normalized payouts)
  socket.on('start_game_poker', async ({ roomId }) => {
    try {
      await ensureCallerIsHost(socket, roomId);

      const txResult = await runInTransaction(async () => {
        const room = await getRoom(roomId);
        if (!room) throw new Error('Room not found');
        const players = room.players;
        const bets = room.bets || {};

        const suits = ['♠','♥','♦','♣'];
        const ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
        const deck = [];
        for (const s of suits) for (const r of ranks) deck.push(r + s);

        const seed = crypto.randomBytes(16).toString('hex');
        const shuffledDeck = utils.shuffleWithSeed(deck, seed);

        const deals = {};
        for (let i = 0; i < players.length; i++) {
          deals[players[i]] = shuffledDeck.slice(i*5, i*5 + 5);
        }
        const deckRemaining = shuffledDeck.slice(players.length*5);

        const evaluations = {};
        for (const p of players) evaluations[p] = evaluators.evaluatePokerHand(deals[p]);

        let bestEval = null;
        let winners = [];
        for (const p of players) {
          const ev = evaluations[p];
          if (!bestEval) { bestEval = ev; winners = [p]; }
          else {
            const cmp = evaluators.compareEval(ev, bestEval);
            if (cmp > 0) { bestEval = ev; winners = [p]; }
            else if (cmp === 0) winners.push(p);
          }
        }

        const pot = Object.values(bets || {}).reduce((a,b) => a + (Number(b)||0), 0);
        const payouts = {};
        if (winners.length > 0 && pot > 0) {
          const share = Math.floor(pot / winners.length);
          for (const w of winners) {
            await changeBalance(w, share);
            payouts[w] = share;
            await runAsync(`INSERT OR REPLACE INTO round_payouts(round_id, username, amount) VALUES(?, ?, ?)`, ['temp_round', w, share]);
          }
        }

        // clear temp round_payouts: we'll insert real after round row created
        await runAsync(`DELETE FROM round_payouts WHERE round_id = ?`, ['temp_round']);

        // clear bets
        await runAsync(`DELETE FROM room_bets WHERE room_id = ?`, [roomId]);

        const roundId = 'round_' + Math.random().toString(36).substring(2, 10);
        await runAsync(
          `INSERT INTO game_rounds(id, room_id, game_type, seed, deals, evaluations, winners, bets_snapshot)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            roundId,
            roomId,
            'poker',
            seed,
            JSON.stringify(deals),
            JSON.stringify(evaluations),
            JSON.stringify(winners),
            JSON.stringify(bets)
          ]
        );

        // insert normalized payouts
        for (const [u, amt] of Object.entries(payouts)) {
          await runAsync(`INSERT INTO round_payouts(round_id, username, amount) VALUES(?, ?, ?)`, [roundId, u, amt]);
        }

        return { roundId, seed, deals, evaluations, winners, deckRemaining, betsSnapshot: bets, payouts };
      });

      const roomAfter = await getRoom(roomId);
      io.to(roomId).emit('room_update', roomAfter || {});
      io.to(roomId).emit('poker_result', txResult);

      // emit balance updates
      const users = await allAsync(`SELECT username, balance FROM users`);
      for (const u of users) {
        for (const [id, sock] of io.sockets.sockets) {
          try {
            const s = io.sockets.sockets.get(id);
            if (s && s.data && s.data.username === u.username) {
              s.emit('balance_update', { username: u.username, balance: u.balance });
            }
          } catch (e) {}
        }
      }

      console.log('poker_result in', roomId, 'winners:', txResult.winners);
    } catch (err) {
      console.error('start_game_poker error (host/transaction):', err);
      socket.emit('error', { message: err.message || 'start_game_poker failed' });
    }
  });

  // start_game_qiuqiu (host-only, transactional + audit + normalized payouts)
  socket.on('start_game_qiuqiu', async ({ roomId }) => {
    try {
      await ensureCallerIsHost(socket, roomId);

      const txResult = await runInTransaction(async () => {
        const room = await getRoom(roomId);
        if (!room) throw new Error('Room not found');
        const players = room.players;
        const bets = room.bets || {};

        const suits = ['♠','♥','♦','♣'];
        const ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
        const deck = [];
        for (const s of suits) for (const r of ranks) deck.push(r + s);

        const seed = crypto.randomBytes(16).toString('hex');
        const shuffledDeck = utils.shuffleWithSeed(deck, seed);

        const deals = {};
        for (let i = 0; i < players.length; i++) {
          deals[players[i]] = shuffledDeck.slice(i*3, i*3 + 3);
        }
        const deckRemaining = shuffledDeck.slice(players.length*3);

        const evaluations = {};
        for (const p of players) evaluations[p] = evaluators.evaluateQiuQiuHand(deals[p]);

        let bestEval = null;
        let winners = [];
        for (const p of players) {
          const ev = evaluations[p];
          if (!bestEval) { bestEval = ev; winners = [p]; }
          else {
            const cmp = evaluators.compareNiuEval(ev, bestEval);
            if (cmp > 0) { bestEval = ev; winners = [p]; }
            else if (cmp === 0) winners.push(p);
          }
        }

        const pot = Object.values(bets || {}).reduce((a,b) => a + (Number(b)||0), 0);
        const payouts = {};
        if (winners.length > 0 && pot > 0) {
          const share = Math.floor(pot / winners.length);
          for (const w of winners) {
            await changeBalance(w, share);
            payouts[w] = share;
          }
        }

        await runAsync(`DELETE FROM room_bets WHERE room_id = ?`, [roomId]);

        const roundId = 'round_' + Math.random().toString(36).substring(2, 10);
        await runAsync(
          `INSERT INTO game_rounds(id, room_id, game_type, seed, deals, evaluations, winners, bets_snapshot)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            roundId,
            roomId,
            'qiuqiu',
            seed,
            JSON.stringify(deals),
            JSON.stringify(evaluations),
            JSON.stringify(winners),
            JSON.stringify(bets)
          ]
        );

        for (const [u, amt] of Object.entries(payouts)) {
          await runAsync(`INSERT INTO round_payouts(round_id, username, amount) VALUES(?, ?, ?)`, [roundId, u, amt]);
        }

        return { roundId, seed, deals, evaluations, winners, deckRemaining, betsSnapshot: bets, payouts };
      });

      const roomAfter = await getRoom(roomId);
      io.to(roomId).emit('room_update', roomAfter || {});
      io.to(roomId).emit('qiuqiu_result', txResult);

      const users = await allAsync(`SELECT username, balance FROM users`);
      for (const u of users) {
        for (const [id, sock] of io.sockets.sockets) {
          try {
            const s = io.sockets.sockets.get(id);
            if (s && s.data && s.data.username === u.username) {
              s.emit('balance_update', { username: u.username, balance: u.balance });
            }
          } catch (e) {}
        }
      }

      console.log('qiuqiu_result in', roomId, 'winners:', txResult.winners);
    } catch (err) {
      console.error('start_game_qiuqiu error (host/transaction):', err);
      socket.emit('error', { message: err.message || 'start_game_qiuqiu failed' });
    }
  });

  // start_game_samgong (host-only, transactional + audit + normalized payouts)
  socket.on('start_game_samgong', async ({ roomId }) => {
    try {
      await ensureCallerIsHost(socket, roomId);

      const txResult = await runInTransaction(async () => {
        const room = await getRoom(roomId);
        if (!room) throw new Error('Room not found');
        const players = room.players;
        const bets = room.bets || {};

        const suits = ['♠','♥','♦','♣'];
        const ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
        const deck = [];
        for (const s of suits) for (const r of ranks) deck.push(r + s);

        const seed = crypto.randomBytes(16).toString('hex');
        const shuffledDeck = utils.shuffleWithSeed(deck, seed);

        const deals = {};
        for (let i = 0; i < players.length; i++) {
          deals[players[i]] = shuffledDeck.slice(i*3, i*3 + 3);
        }
        const deckRemaining = shuffledDeck.slice(players.length*3);

        const evaluations = {};
        for (const p of players) evaluations[p] = evaluators.evaluateSamgongHand(deals[p]);

        let bestEval = null;
        let winners = [];
        for (const p of players) {
          const ev = evaluations[p];
          if (!bestEval) { bestEval = ev; winners = [p]; }
          else {
            const cmp = evaluators.compareSamgongEval(ev, bestEval);
            if (cmp > 0) { bestEval = ev; winners = [p]; }
            else if (cmp === 0) winners.push(p);
          }
        }

        const pot = Object.values(bets || {}).reduce((a,b) => a + (Number(b)||0), 0);
        const payouts = {};
        if (winners.length > 0 && pot > 0) {
          const share = Math.floor(pot / winners.length);
          for (const w of winners) {
            await changeBalance(w, share);
            payouts[w] = share;
          }
        }

        await runAsync(`DELETE FROM room_bets WHERE room_id = ?`, [roomId]);

        const roundId = 'round_' + Math.random().toString(36).substring(2, 10);
        await runAsync(
          `INSERT INTO game_rounds(id, room_id, game_type, seed, deals, evaluations, winners, bets_snapshot)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            roundId,
            roomId,
            'samgong',
            seed,
            JSON.stringify(deals),
            JSON.stringify(evaluations),
            JSON.stringify(winners),
            JSON.stringify(bets)
          ]
        );

        for (const [u, amt] of Object.entries(payouts)) {
          await runAsync(`INSERT INTO round_payouts(round_id, username, amount) VALUES(?, ?, ?)`, [roundId, u, amt]);
        }

        return { roundId, seed, deals, evaluations, winners, deckRemaining, betsSnapshot: bets, payouts };
      });

      const roomAfter = await getRoom(roomId);
      io.to(roomId).emit('room_update', roomAfter || {});
      io.to(roomId).emit('samgong_result', txResult);

      const users = await allAsync(`SELECT username, balance FROM users`);
      for (const u of users) {
        for (const [id, sock] of io.sockets.sockets) {
          try {
            const s = io.sockets.sockets.get(id);
            if (s && s.data && s.data.username === u.username) {
              s.emit('balance_update', { username: u.username, balance: u.balance });
            }
          } catch (e) {}
        }
      }

      console.log('samgong_result in', roomId, 'winners:', txResult.winners);
    } catch (err) {
      console.error('start_game_samgong error (host/transaction):', err);
      socket.emit('error', { message: err.message || 'start_game_samgong failed' });
    }
  });

  socket.on('disconnect', async () => {
    const username = socket.data.username;
    if (username) {
      io.to('lobby_global').emit('presence', { user: username, online: false });
      const rooms = await listRooms();
      for (const room of rooms) {
        if (room.players.includes(username)) {
          await removePlayerFromRoom(room.id, username);
          const after = await getRoom(room.id);
          if (!after || after.players.length === 0) {
            await deleteRoomFromDb(room.id);
          } else {
            if (room.host === username) {
              const newRoom = await getRoom(room.id);
              const newHost = newRoom.players[0];
              await runAsync(`UPDATE rooms SET host = ? WHERE id = ?`, [newHost, room.id]);
            }
            const roomNow = await getRoom(room.id);
            io.to(room.id).emit('room_update', roomNow || {});
          }
        }
      }
      const roomsNow = await listRooms();
      io.to('lobby_global').emit('lobby_rooms', roomsNow);
    }
    console.log('disconnect', socket.id);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});