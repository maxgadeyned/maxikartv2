/* MAXIKART — WebSocket room server
   Local:  npm start  →  http://127.0.0.1:8765
   Online: deploy this same app to Render (Web Service). Everyone opens that URL.
*/
const os = require('os');
const express = require('express');
const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.PORT) || 8765;
const MAX_PLAYERS = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const app = express();
app.use(express.static(__dirname));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = app.listen(PORT, '0.0.0.0', () => {
  const lan = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
    }
  }
  console.log('');
  console.log('  MAXIKART server on port', PORT);
  console.log('  Local:  http://127.0.0.1:' + PORT);
  if (lan[0]) console.log('  LAN:    http://' + lan[0] + ':' + PORT);
  console.log('  Deploy this folder to Render for online play.');
  console.log('');
});

/** @typedef {{ id: string, name: string, slot: number, host: boolean, ready: boolean }} Player */
/** @typedef {{
 *   code: string,
 *   hostId: string,
 *   players: Map<string, Player>,
 *   sockets: Map<string, import('ws').WebSocket>,
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

function send(ws, obj) {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(obj)); } catch (e) {}
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

function broadcast(room, obj, exceptId) {
  room.sockets.forEach((ws, id) => {
    if (id === exceptId) return;
    send(ws, obj);
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
  broadcast(room, { t: 'bye', reason: reason || 'Room closed' });
  room.sockets.forEach((ws) => {
    try { ws.close(); } catch (e) {}
  });
  rooms.delete(code);
  console.log('room closed', code, reason || '');
}

function leave(ws, reason) {
  const code = ws.mkCode;
  const id = ws.mkId;
  if (!code || !id) return;
  const room = rooms.get(code);
  if (!room) return;

  room.sockets.delete(id);
  room.players.delete(id);
  ws.mkCode = null;
  ws.mkId = null;
  console.log('leave', code, id, reason || '');

  if (id === room.hostId || room.players.size === 0) {
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

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.mkId = null;
  ws.mkCode = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch (e) { return; }
    if (!msg || !msg.t) return;

    if (msg.t === 'ping') {
      send(ws, { t: 'pong', n: msg.n });
      return;
    }

    if (msg.t === 'create') {
      if (ws.mkCode) leave(ws, 'recreate');
      const name = String(msg.name || 'RACER').toUpperCase().slice(0, 12) || 'RACER';
      const code = makeCode();
      const id = 'H-' + randomUUID().slice(0, 8);
      /** @type {Room} */
      const room = {
        code,
        hostId: id,
        players: new Map(),
        sockets: new Map(),
        settings: {
          map: 0,
          laps: 3,
          night: false,
          weather: 'clear',
          items: true
        },
        racing: false
      };
      room.players.set(id, { id, name, slot: 0, host: true, ready: false });
      room.sockets.set(id, ws);
      rooms.set(code, room);
      ws.mkId = id;
      ws.mkCode = code;
      console.log('create', code, id);
      send(ws, {
        t: 'joined',
        role: 'host',
        id,
        code,
        players: roster(room),
        settings: room.settings
      });
      return;
    }

    if (msg.t === 'join') {
      if (ws.mkCode) leave(ws, 'rejoin');
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      const room = rooms.get(code);
      if (!room) {
        send(ws, { t: 'reject', reason: 'Room not found. Host must create the room first.' });
        return;
      }
      if (room.racing) {
        send(ws, { t: 'reject', reason: 'Race already started.' });
        return;
      }
      if (room.players.size >= MAX_PLAYERS) {
        send(ws, { t: 'reject', reason: 'Room full' });
        return;
      }
      const slot = freeSlot(room);
      if (slot < 0) {
        send(ws, { t: 'reject', reason: 'Room full' });
        return;
      }
      const id = 'P-' + randomUUID().slice(0, 8);
      const name = String(msg.name || 'RACER').toUpperCase().slice(0, 12) || 'RACER';
      room.players.set(id, { id, name, slot, host: false, ready: false });
      room.sockets.set(id, ws);
      ws.mkId = id;
      ws.mkCode = code;
      console.log('join', code, id);
      send(ws, {
        t: 'joined',
        role: 'client',
        id,
        code,
        players: roster(room),
        settings: room.settings
      });
      pushRoster(room);
      return;
    }

    const room = ws.mkCode ? rooms.get(ws.mkCode) : null;
    if (!room || !ws.mkId) return;
    const me = room.players.get(ws.mkId);
    if (!me) return;

    if (msg.t === 'ready') {
      me.ready = !!msg.ready;
      pushRoster(room);
      return;
    }

    if (msg.t === 'rename') {
      me.name = String(msg.name || 'RACER').toUpperCase().slice(0, 12) || 'RACER';
      pushRoster(room);
      return;
    }

    if (msg.t === 'settings') {
      if (ws.mkId !== room.hostId) return;
      room.settings = {
        map: msg.map | 0,
        laps: (msg.laps | 0) || 3,
        night: !!msg.night,
        weather: msg.weather || 'clear',
        items: msg.items !== false
      };
      broadcast(room, { t: 'settings', ...room.settings });
      return;
    }

    if (msg.t === 'start') {
      if (ws.mkId !== room.hostId) return;
      if (!allReady(room)) {
        send(ws, { t: 'reject', reason: 'Everyone must ready up before starting.' });
        return;
      }
      room.racing = true;
      room.players.forEach(p => { p.ready = false; });
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
      // Anyone can request return; host forces it for all
      if (ws.mkId === room.hostId || msg.force) {
        room.racing = false;
        room.players.forEach(p => { p.ready = false; });
        broadcast(room, { t: 'lobby', settings: room.settings, players: roster(room) });
      } else {
        // Guest asks host path: treat as request — auto-return for simplicity
        room.racing = false;
        room.players.forEach(p => { p.ready = false; });
        broadcast(room, { t: 'lobby', settings: room.settings, players: roster(room) });
      }
      return;
    }

    if (msg.t === 's') {
      // Relay kart state to everyone else
      const payload = Object.assign({}, msg, { id: ws.mkId, name: me.name });
      broadcast(room, payload, ws.mkId);
      return;
    }

    if (msg.t === 'bye') {
      leave(ws, 'bye');
      try { ws.close(); } catch (e) {}
    }
  });

  ws.on('close', () => leave(ws, 'close'));
  ws.on('error', () => leave(ws, 'error'));
});

// Drop dead sockets
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      leave(ws, 'timeout');
      try { return ws.terminate(); } catch (e) { return; }
    }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  });
}, 25000);
