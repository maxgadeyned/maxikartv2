/* Persistent JSON store for accounts + global time-trial boards */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'maxikart-store.json');
const LEADERBOARD_SIZE = 10;
const ALLOWED_MAPS = new Set(['neon', 'tiburtina', 'knot', 'ridge']);
const ALLOWED_LAPS = new Set([1, 3, 5]);

/** Soft floor so blatant packet cheats don't top the board (seconds). */
const MIN_TIME = { 1: 18, 3: 55, 5: 95 };

function emptyStore() {
  return { users: {}, boards: {}, updatedAt: Date.now() };
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  try {
    ensureDir();
    if (!fs.existsSync(STORE_PATH)) return emptyStore();
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!raw || typeof raw !== 'object') return emptyStore();
    if (!raw.users || typeof raw.users !== 'object') raw.users = {};
    if (!raw.boards || typeof raw.boards !== 'object') raw.boards = {};
    return raw;
  } catch (_e) {
    return emptyStore();
  }
}

let cache = load();

function save() {
  ensureDir();
  cache.updatedAt = Date.now();
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

function boardKey(mapId, laps) {
  return `${mapId}_${laps}`;
}

function sanitizeName(raw) {
  return String(raw || 'RACER').toUpperCase().replace(/[^A-Z0-9_\- ]/g, '').trim().slice(0, 12) || 'RACER';
}

function newId(prefix) {
  return prefix + crypto.randomBytes(8).toString('hex');
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    provider: u.provider,
    createdAt: u.createdAt
  };
}

function hashSecret(secret, salt) {
  return crypto.scryptSync(String(secret), salt, 32).toString('hex');
}

function findByName(name) {
  const n = sanitizeName(name);
  return Object.values(cache.users).find(u => u.name === n) || null;
}

function validatePassword(password) {
  const p = String(password || '');
  if (p.length < 4 || p.length > 64) {
    const err = new Error('bad-password');
    err.code = 'bad-password';
    throw err;
  }
  return p;
}

function createUser(name, password) {
  const clean = sanitizeName(name);
  if (clean.length < 2) {
    const err = new Error('bad-name');
    err.code = 'bad-name';
    throw err;
  }
  if (findByName(clean)) {
    const err = new Error('name-taken');
    err.code = 'name-taken';
    throw err;
  }
  const pass = validatePassword(password);
  const salt = crypto.randomBytes(8).toString('hex');
  const user = {
    id: newId('u_'),
    provider: 'password',
    name: clean,
    passSalt: salt,
    passHash: hashSecret(pass, salt),
    createdAt: Date.now()
  };
  cache.users[user.id] = user;
  save();
  return user;
}

function loginUser(name, password) {
  const user = findByName(name);
  if (!user) {
    const err = new Error('bad-login');
    err.code = 'bad-login';
    throw err;
  }
  const pass = String(password || '');
  // Password accounts
  if (user.passHash && user.passSalt) {
    if (hashSecret(pass, user.passSalt) !== user.passHash) {
      const err = new Error('bad-login');
      err.code = 'bad-login';
      throw err;
    }
    return user;
  }
  // Legacy PIN accounts (from earlier build)
  if (user.pinHash && user.pinSalt) {
    if (hashSecret(pass, user.pinSalt) !== user.pinHash) {
      const err = new Error('bad-login');
      err.code = 'bad-login';
      throw err;
    }
    return user;
  }
  const err = new Error('bad-login');
  err.code = 'bad-login';
  throw err;
}

function getUser(id) {
  return cache.users[id] || null;
}

function setUserName(userId, name) {
  const user = cache.users[userId];
  if (!user) return null;
  const clean = sanitizeName(name);
  const other = findByName(clean);
  if (other && other.id !== userId) {
    const err = new Error('name-taken');
    err.code = 'name-taken';
    throw err;
  }
  user.name = clean;
  save();
  return user;
}

function getBoard(mapId, laps) {
  if (!ALLOWED_MAPS.has(mapId) || !ALLOWED_LAPS.has(laps | 0)) return [];
  const key = boardKey(mapId, laps | 0);
  const board = cache.boards[key];
  return Array.isArray(board) ? board.slice(0, LEADERBOARD_SIZE) : [];
}

function submitTime(userId, mapId, laps, time) {
  const user = cache.users[userId];
  if (!user) {
    const err = new Error('auth');
    err.code = 'auth';
    throw err;
  }
  laps = laps | 0;
  time = Number(time);
  if (!ALLOWED_MAPS.has(mapId) || !ALLOWED_LAPS.has(laps)) {
    const err = new Error('bad-board');
    err.code = 'bad-board';
    throw err;
  }
  if (!Number.isFinite(time) || time <= 0 || time > 3600) {
    const err = new Error('bad-time');
    err.code = 'bad-time';
    throw err;
  }
  const floor = MIN_TIME[laps] || 15;
  if (time < floor) {
    const err = new Error('time-too-fast');
    err.code = 'time-too-fast';
    throw err;
  }

  const key = boardKey(mapId, laps);
  const board = Array.isArray(cache.boards[key]) ? cache.boards[key].slice() : [];
  const entry = {
    name: user.name,
    time: Math.round(time * 100) / 100,
    date: new Date().toISOString().slice(0, 10),
    userId: user.id
  };

  // Keep best time per user on this board
  const existingIdx = board.findIndex(e => e.userId === user.id);
  if (existingIdx >= 0) {
    if (board[existingIdx].time <= entry.time) {
      return { rank: board.findIndex(e => e.userId === user.id) + 1, improved: false, board: board.slice(0, LEADERBOARD_SIZE) };
    }
    board[existingIdx] = entry;
  } else {
    board.push(entry);
  }
  board.sort((a, b) => a.time - b.time);
  cache.boards[key] = board.slice(0, LEADERBOARD_SIZE);
  save();
  const rank = cache.boards[key].findIndex(e => e.userId === user.id) + 1;
  return {
    rank: rank > 0 ? rank : null,
    improved: true,
    board: cache.boards[key]
  };
}

module.exports = {
  LEADERBOARD_SIZE,
  ALLOWED_MAPS,
  ALLOWED_LAPS,
  publicUser,
  createUser,
  loginUser,
  getUser,
  setUserName,
  getBoard,
  submitTime,
  sanitizeName
};
