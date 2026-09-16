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

const PORT = Number(process.env.PORT) || 8765;
const MAX_PLAYERS = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BUILD = 'sio-ac1';

const app = express();
app.use(express.static(__dirname));
app.get('/health', (_req, res) => res.json({ ok: true, build: BUILD }));
app.get('/version', (_req, res) => res.json({
  ok: true,
  build: BUILD,
  commit: process.env.RENDER_GIT_COMMIT || 'local'
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingInterval: 20000,
  pingTimeout: 25000
});

/** @typedef {{ id: string, name: string, slot: number, host: boolean, ready: boolean }} Player */
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
      ready: p.ready
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

function leave(socket, reason) {
  const code = socket.data.mkCode;
  const id = socket.id;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;

  const wasHost = room.hostId === id;
  room.players.delete(id);
  socket.data.mkCode = null;
  socket.leave(code);
  console.log('leave', code, id, reason || '');

  if (wasHost || room.players.size === 0) {
    destroyRoom(code, 'Host left');
    return;
  }
  pushRoster(room);
}

function allReady(room) {
  if (room.players.size < 1) return false;
  for (const p of room.players.values()) {
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
        id: socket.id, name, slot: 0, host: true, ready: false
      });
      rooms.set(code, room);
      socket.data.mkCode = code;
      socket.data.ac = AC.createTracker();
      socket.join(code);
      console.log('create', code, socket.id);
      emit(socket, {
        t: 'joined',
        role: 'host',
        id: socket.id,
        code,
        players: roster(room),
        settings: room.settings
      });
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
      if (room.players.size >= MAX_PLAYERS) {
        emit(socket, { t: 'reject', reason: 'Room full' });
        return;
      }
      const slot = freeSlot(room);
      if (slot < 0) {
        emit(socket, { t: 'reject', reason: 'Room full' });
        return;
      }
      const name = AC.sanitizeName(msg.name);
      room.players.set(socket.id, {
        id: socket.id, name, slot, host: false, ready: false
      });
      socket.data.mkCode = code;
      socket.data.ac = AC.createTracker();
      socket.join(code);
      console.log('join', code, socket.id);
      emit(socket, {
        t: 'joined',
        role: 'client',
        id: socket.id,
        code,
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

    if (msg.t === 'bye') {
      leave(socket, 'bye');
      socket.disconnect(true);
      return;
    }

    // Unknown packet types are ignored (modified clients can't invent commands)
  });

  socket.on('disconnect', (reason) => leave(socket, reason));
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
    }
  }
  console.log('');
  console.log('  MAXIKART server on port', PORT, '(' + BUILD + ')');
  console.log('  Local:  http://127.0.0.1:' + PORT);
  if (lan[0]) console.log('  LAN:    http://' + lan[0] + ':' + PORT);
  console.log('');
});
