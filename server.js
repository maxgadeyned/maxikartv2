/* MAXIKART — Socket.IO room server (works on Render via polling fallback)
   Local:  npm start  →  http://127.0.0.1:8765
   Online: deploy to Render; everyone opens the https://….onrender.com URL
*/
const http = require('http');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');
const { randomUUID } = require('crypto');
const AC = require('./anticheat');
const Store = require('./store');
const Auth = require('./auth');

const PORT = Number(process.env.PORT) || 8765;
const MAX_PLAYERS = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BUILD = 'sio-net4';
const RESUME_GRACE_MS = 15000;
const DEV_USERNAMES = String(process.env.DEV_USERNAMES || '')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);

function isDevUsername(name) {
  const n = String(name || '').trim().toUpperCase();
  return !!n && DEV_USERNAMES.includes(n);
}

function publicUser(user) {
  const pub = Store.publicUser(user);
  if (pub) pub.devTools = isDevUsername(user && user.name);
  return pub;
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(__dirname));
app.get('/api/config', (_req, res) => {
  const info = Store.persistenceInfo();
  res.json({
    ok: true,
    build: BUILD,
    persistence: info.mode,
    durable: info.durable,
    databaseUrlSet: info.databaseUrlSet,
    storeError: info.error,
    warning: info.mode === 'file'
      ? 'Ephemeral file storage — accounts and leaderboards reset on deploy. Set DATABASE_URL (Neon) on Render.'
      : null
  });
});

app.get('/health', (_req, res) => {
  const info = Store.persistenceInfo();
  res.json({
    ok: true,
    build: BUILD,
    persistence: info.mode,
    databaseUrlSet: info.databaseUrlSet,
    storeError: info.error
  });
});
app.get('/version', (_req, res) => {
  const info = Store.persistenceInfo();
  res.json({
    ok: true,
    build: BUILD,
    commit: process.env.RENDER_GIT_COMMIT || 'local',
    persistence: info.mode,
    databaseUrlSet: info.databaseUrlSet,
    storeError: info.error
  });
});

function authedUser(req) {
  const token = Auth.readBearer(req);
  const uid = Auth.verifySession(token);
  if (!uid) return null;
  return Store.getUser(uid);
}

app.get('/api/me', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'auth' });
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const user = Store.createUser(req.body && req.body.name, req.body && req.body.password);
    const token = Auth.signSession(user.id);
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.code || e.message || 'register-failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const user = Store.loginUser(req.body && req.body.name, req.body && req.body.password);
    const token = Auth.signSession(user.id);
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.code || e.message || 'login-failed' });
  }
});

app.post('/api/account/name', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'auth' });
  try {
    const updated = Store.setUserName(user.id, req.body && req.body.name);
    res.json({ ok: true, user: publicUser(updated) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.code || e.message || 'name-failed' });
  }
});

app.post('/api/economy/claim', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'auth' });
  try {
    const updated = Store.claimCoins(user.id, req.body && req.body.localCoins);
    res.json({ ok: true, user: publicUser(updated) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.code || e.message || 'claim-failed' });
  }
});

app.post('/api/economy/earn', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'auth' });
  try {
    const updated = Store.addCoins(user.id, req.body && req.body.amount, req.body && req.body.reason);
    res.json({ ok: true, user: publicUser(updated) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.code || e.message || 'earn-failed' });
  }
});

app.post('/api/economy/spend', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'auth' });
  try {
    const updated = Store.spendCoins(user.id, req.body && req.body.amount);
    res.json({ ok: true, user: publicUser(updated) });
  } catch (e) {
    const code = e.code || e.message || 'spend-failed';
    res.status(code === 'insufficient' ? 402 : 400).json({ ok: false, error: code });
  }
});

app.get('/api/leaderboard', (req, res) => {
  const mapId = String(req.query.map || 'neon');
  const laps = parseInt(req.query.laps, 10) || 3;
  if (!Store.ALLOWED_MAPS.has(mapId) || !Store.ALLOWED_LAPS.has(laps)) {
    return res.status(400).json({ ok: false, error: 'bad-board' });
  }
  const board = Store.getBoard(mapId, laps).map((e, i) => ({
    rank: i + 1,
    name: e.name,
    time: e.time,
    date: e.date
  }));
  res.json({ ok: true, map: mapId, laps, board });
});

app.post('/api/leaderboard/submit', (req, res) => {
  const user = authedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'auth' });
  try {
    const mapId = String(req.body && req.body.map);
    const laps = parseInt(req.body && req.body.laps, 10);
    const time = Number(req.body && req.body.time);
    const result = Store.submitTime(user.id, mapId, laps, time);
    res.json({
      ok: true,
      rank: result.rank,
      improved: result.improved,
      board: result.board.map((e, i) => ({
        rank: i + 1,
        name: e.name,
        time: e.time,
        date: e.date
      }))
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.code || e.message || 'submit-failed' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingInterval: 20000,
  pingTimeout: 25000
});

/** @typedef {{ id: string, name: string, slot: number, host: boolean, ready: boolean, look?: object, resume?: string, disconnectedAt?: number|null }} Player */
/** @typedef {{
 *   code: string,
 *   hostId: string,
 *   players: Map<string, Player>,
 *   settings: { map: number, laps: number, night: boolean, weather: string, items: boolean },
 *   racing: boolean
 * }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();

function makeCode() {
  for (let attempt = 0; attempt < 40; attempt++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    if (!rooms.has(c)) return c;
  }
  return randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
}

function roster(room) {
  return [...room.players.values()]
    .sort((a, b) => a.slot - b.slot)
    .map(p => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      host: p.host,
      ready: p.ready,
      look: p.look || null,
      disconnected: !!p.disconnectedAt
    }));
}

function emit(socket, obj) {
  socket.emit('msg', obj);
}

function broadcast(room, obj, exceptId) {
  room.players.forEach((_p, id) => {
    if (id === exceptId) return;
    const s = io.sockets.sockets.get(id);
    if (s) emit(s, obj);
  });
}

function pushRoster(room) {
  broadcast(room, { t: 'roster', code: room.code, players: roster(room) });
}

function freeSlot(room) {
  const used = new Set([...room.players.values()].map(p => p.slot));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return -1;
}

function promoteHost(room) {
  const next = [...room.players.values()]
    .filter(p => !p.disconnectedAt)
    .sort((a, b) => a.slot - b.slot)[0]
    || [...room.players.values()].sort((a, b) => a.slot - b.slot)[0];
  if (!next) return null;
  room.hostId = next.id;
  room.players.forEach(p => { p.host = p.id === next.id; });
  return next;
}

function destroyRoom(code, reason) {
  const room = rooms.get(code);
  if (!room) return;
  rooms.delete(code);
  room.players.forEach((_p, id) => {
    const s = io.sockets.sockets.get(id);
    if (s) {
      emit(s, { t: 'bye', reason: reason || 'Room closed' });
      s.data.mkCode = null;
      try { s.disconnect(true); } catch (e) {}
    }
  });
  console.log('room closed', code, reason || '');
}

function finalizeLeave(room, id, reason) {
  if (!room || !room.players.has(id)) return;
  const wasHost = room.hostId === id;
  room.players.delete(id);
  console.log('leave', room.code, id, reason || '');

  if (room.players.size === 0) {
    rooms.delete(room.code);
    console.log('room closed', room.code, 'empty');
    return;
  }

  if (wasHost) {
    const next = promoteHost(room);
    if (next) {
      broadcast(room, { t: 'host', id: next.id, name: next.name });
      console.log('host →', room.code, next.id);
    }
  }
  pushRoster(room);
}

function leave(socket, reason) {
  const code = socket.data.mkCode;
  const id = socket.id;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;

  const player = room.players.get(id);
  socket.data.mkCode = null;
  try { socket.leave(code); } catch (_e) {}

  // Soft leave: keep seat briefly so a refresh/reconnect can resume
  if (player && reason !== 'bye' && reason !== 'recreate' && reason !== 'rejoin' && !(reason || '').startsWith('anticheat:')) {
    const wasHost = room.hostId === id;
    player.disconnectedAt = Date.now();
    player.ready = false;
    player.host = false;
    if (wasHost) {
      const next = promoteHost(room);
      if (next) {
        broadcast(room, { t: 'host', id: next.id, name: next.name });
        console.log('host →', room.code, next.id, '(soft)');
      }
    }
    pushRoster(room);
    setTimeout(() => {
      const r = rooms.get(code);
      if (!r) return;
      const p = r.players.get(id);
      if (!p || !p.disconnectedAt) return;
      if (Date.now() - p.disconnectedAt < RESUME_GRACE_MS - 500) return;
      finalizeLeave(r, id, 'timeout');
    }, RESUME_GRACE_MS);
    return;
  }

  finalizeLeave(room, id, reason);
}

function allReady(room) {
  const active = [...room.players.values()].filter(p => !p.disconnectedAt);
  if (active.length < 1) return false;
  for (const p of active) {
    if (!p.ready) return false;
  }
  return true;
}

function kickCheater(socket, reason) {
  console.log('kick', socket.id, reason);
  emit(socket, { t: 'reject', reason: 'Anticheat: illegal movement (' + reason + ')' });
  leave(socket, 'anticheat:' + reason);
  try { socket.disconnect(true); } catch (e) {}
}

io.on('connection', (socket) => {
  socket.data.mkCode = null;
  socket.data.ac = AC.createTracker();
  console.log('connect', socket.id, socket.conn.transport.name);

  socket.on('msg', (msg) => {
    if (!msg || typeof msg !== 'object' || !msg.t) return;
    if (typeof msg.t !== 'string' || msg.t.length > 24) return;

    const now = Date.now();
    if (!AC.rateOk(socket.data.ac, now)) {
      if (socket.data.ac.strikes >= AC.MAX_STRIKES) {
        kickCheater(socket, 'flood');
      }
      return;
    }

    if (msg.t === 'ping') {
      emit(socket, { t: 'pong', n: msg.n });
      return;
    }

    if (msg.t === 'create') {
      if (socket.data.mkCode) leave(socket, 'recreate');
      const name = AC.sanitizeName(msg.name);
      const look = AC.sanitizeLook(msg.look);
      const code = makeCode();
      /** @type {Room} */
      const room = {
        code,
        hostId: socket.id,
        players: new Map(),
        settings: { map: 0, laps: 3, night: false, weather: 'clear', items: true },
        racing: false
      };
      room.players.set(socket.id, {
        id: socket.id, name, slot: 0, host: true, ready: false, look,
        resume: randomUUID().replace(/-/g, '').slice(0, 12),
        disconnectedAt: null
      });
      rooms.set(code, room);
      socket.data.mkCode = code;
      socket.data.ac = AC.createTracker();
      socket.join(code);
      console.log('create', code, socket.id);
      const me = room.players.get(socket.id);
      emit(socket, {
        t: 'joined',
        role: 'host',
        id: socket.id,
        code,
        resume: me.resume,
        players: roster(room),
        settings: room.settings
      });
      return;
    }

    if (msg.t === 'resume') {
      if (socket.data.mkCode) leave(socket, 'rejoin');
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const token = String(msg.resume || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
      const room = rooms.get(code);
      if (!room || !token) {
        emit(socket, { t: 'reject', reason: 'Could not resume — room gone.' });
        return;
      }
      let oldId = null;
      let player = null;
      for (const [id, p] of room.players) {
        if (p.resume === token) { oldId = id; player = p; break; }
      }
      if (!player || !player.disconnectedAt) {
        emit(socket, { t: 'reject', reason: 'Resume expired. Rejoin from lobby.' });
        return;
      }
      room.players.delete(oldId);
      player.id = socket.id;
      player.disconnectedAt = null;
      player.ready = false;
      if (room.hostId === oldId) room.hostId = socket.id;
      player.host = room.hostId === socket.id;
      room.players.set(socket.id, player);
      socket.data.mkCode = code;
      socket.data.ac = AC.createTracker();
      if (room.racing) AC.onRaceStart(socket.data.ac);
      socket.join(code);
      console.log('resume', code, oldId, '→', socket.id);
      emit(socket, {
        t: 'joined',
        role: player.host ? 'host' : 'client',
        id: socket.id,
        code,
        resume: player.resume,
        racing: !!room.racing,
        players: roster(room),
        settings: room.settings
      });
      if (player.host) broadcast(room, { t: 'host', id: socket.id, name: player.name }, socket.id);
      pushRoster(room);
      return;
    }

    if (msg.t === 'join') {
      if (socket.data.mkCode) leave(socket, 'rejoin');
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const room = rooms.get(code);
      if (!room) {
        emit(socket, { t: 'reject', reason: 'Room not found. Host must create the room first.' });
        return;
      }
      if (room.racing) {
        emit(socket, { t: 'reject', reason: 'Race already started.' });
        return;
      }
      const liveCount = [...room.players.values()].filter(p => !p.disconnectedAt).length;
      if (liveCount >= MAX_PLAYERS) {
        emit(socket, { t: 'reject', reason: 'Room full' });
        return;
      }
      const slot = freeSlot(room);
      if (slot < 0) {
        emit(socket, { t: 'reject', reason: 'Room full' });
        return;
      }
      const name = AC.sanitizeName(msg.name);
      const look = AC.sanitizeLook(msg.look);
      room.players.set(socket.id, {
        id: socket.id, name, slot, host: false, ready: false, look,
        resume: randomUUID().replace(/-/g, '').slice(0, 12),
        disconnectedAt: null
      });
      socket.data.mkCode = code;
      socket.data.ac = AC.createTracker();
      socket.join(code);
      console.log('join', code, socket.id);
      const me = room.players.get(socket.id);
      emit(socket, {
        t: 'joined',
        role: 'client',
        id: socket.id,
        code,
        resume: me.resume,
        players: roster(room),
        settings: room.settings
      });
      pushRoster(room);
      return;
    }

    const room = socket.data.mkCode ? rooms.get(socket.data.mkCode) : null;
    if (!room) return;
    const me = room.players.get(socket.id);
    if (!me) return;

    if (msg.t === 'ready') {
      me.ready = !!msg.ready;
      pushRoster(room);
      return;
    }

    if (msg.t === 'rename') {
      me.name = AC.sanitizeName(msg.name);
      pushRoster(room);
      return;
    }

    if (msg.t === 'look') {
      if (room.racing) return;
      me.look = AC.sanitizeLook(msg.look);
      pushRoster(room);
      return;
    }

    if (msg.t === 'settings') {
      if (socket.id !== room.hostId) return;
      if (room.racing) return;
      room.settings = AC.sanitizeSettings(msg);
      broadcast(room, { t: 'settings', ...room.settings });
      return;
    }

    if (msg.t === 'start') {
      if (socket.id !== room.hostId) return;
      if (!allReady(room)) {
        emit(socket, { t: 'reject', reason: 'Everyone must ready up before starting.' });
        return;
      }
      room.racing = true;
      room.players.forEach(p => { p.ready = false; });
      // Reset anticheat trackers for all racers
      room.players.forEach((_p, id) => {
        const s = io.sockets.sockets.get(id);
        if (s && s.data.ac) AC.onRaceStart(s.data.ac);
      });
      broadcast(room, {
        t: 'start',
        map: room.settings.map,
        laps: room.settings.laps,
        night: room.settings.night,
        weather: room.settings.weather,
        items: room.settings.items,
        players: roster(room)
      });
      return;
    }

    if (msg.t === 'lobby') {
      room.racing = false;
      room.players.forEach(p => { p.ready = false; });
      room.players.forEach((_p, id) => {
        const s = io.sockets.sockets.get(id);
        if (s && s.data.ac) AC.onLobby(s.data.ac);
      });
      broadcast(room, { t: 'lobby', settings: room.settings, players: roster(room) });
      return;
    }

    if (msg.t === 's') {
      const result = AC.validateState(msg, socket.data.ac, room);
      if (!result.ok) {
        if (result.kick) kickCheater(socket, result.reason);
        return;
      }
      // Server stamps identity — client cannot spoof id/name
      broadcast(room, Object.assign({}, result.packet, {
        id: socket.id,
        name: me.name
      }), socket.id);
      return;
    }

    if (msg.t === 'hz') {
      if (!room.racing || !room.settings.items) return;
      const packet = AC.sanitizeHazard(msg);
      if (!packet) return;
      packet.owner = socket.id;
      broadcast(room, packet, socket.id);
      return;
    }

    if (msg.t === 'hzgone') {
      if (!room.racing) return;
      const packet = AC.sanitizeHzGone(msg);
      if (!packet) return;
      packet.by = socket.id;
      broadcast(room, packet, socket.id);
      return;
    }

    if (msg.t === 'spin') {
      if (!room.racing || !room.settings.items) return;
      const packet = AC.sanitizeSpin(msg);
      if (!packet) return;
      if (!room.players.has(packet.target)) return;
      packet.from = socket.id;
      // Deliver to target (and optionally others for FX); target applies the hit
      const targetSock = io.sockets.sockets.get(packet.target);
      if (targetSock) emit(targetSock, packet);
      return;
    }

    if (msg.t === 'bye') {
      leave(socket, 'bye');
      socket.disconnect(true);
      return;
    }

    // Unknown packet types are ignored (modified clients can't invent commands)
  });

  socket.on('disconnect', (reason) => leave(socket, reason));
});

async function boot() {
  await Store.init();

  server.listen(PORT, '0.0.0.0', () => {
    const lan = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const n of list || []) {
        if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
      }
    }
    console.log('');
    console.log('  MAXIKART server on port', PORT, '(' + BUILD + ')');
    console.log('  Storage:', Store.persistenceMode());
    console.log('  Local:  http://127.0.0.1:' + PORT);
    if (lan[0]) console.log('  LAN:    http://' + lan[0] + ':' + PORT);
    console.log('');
  });
}

boot();
