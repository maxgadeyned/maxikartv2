/* Accounts + global boards.
   - Local / no DB: JSON file under DATA_DIR (wiped on Render redeploy)
   - With DATABASE_URL: Postgres (survives deploys) — Neon/Supabase free works
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'maxikart-store.json');
const DATABASE_URL = process.env.DATABASE_URL || '';
const LEADERBOARD_SIZE = 10;
const ALLOWED_MAPS = new Set(['neon', 'tiburtina', 'knot', 'overpass']);
const ALLOWED_LAPS = new Set([1, 3, 5]);
const MIN_TIME = { 1: 18, 3: 55, 5: 95 };

let pool = null;
let ready = false;
let saveTimer = null;
let saving = null;
let lastStoreError = null;

function emptyStore() {
  return { users: {}, boards: {}, updatedAt: Date.now() };
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFile() {
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

function saveFile() {
  ensureDir();
  cache.updatedAt = Date.now();
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

let cache = emptyStore();

function persistenceMode() {
  return pool ? 'postgres' : 'file';
}

function persistenceInfo() {
  const mode = persistenceMode();
  const hasUrl = !!DATABASE_URL;
  return {
    mode,
    durable: mode === 'postgres',
    databaseUrlSet: hasUrl,
    error: mode === 'file' ? (lastStoreError || (hasUrl ? 'postgres-connect-failed' : 'DATABASE_URL not set')) : null
  };
}

async function init() {
  lastStoreError = null;
  if (!DATABASE_URL) {
    cache = loadFile();
    ready = true;
    lastStoreError = 'DATABASE_URL not set';
    const onRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID);
    if (onRender) {
      console.error('[store] WARNING: No DATABASE_URL on Render — accounts/leaderboards RESET on every deploy.');
      console.error('[store] Add a Neon/Supabase Postgres URL as DATABASE_URL in the Render dashboard.');
    } else {
      console.log('[store] Using local JSON file (set DATABASE_URL for durable cloud storage)');
    }
    return;
  }
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 8000
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maxikart_store (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);
    const res = await pool.query('SELECT data FROM maxikart_store WHERE id = $1', ['main']);
    if (res.rows[0] && res.rows[0].data) {
      const raw = res.rows[0].data;
      cache = {
        users: raw.users && typeof raw.users === 'object' ? raw.users : {},
        boards: raw.boards && typeof raw.boards === 'object' ? raw.boards : {},
        updatedAt: raw.updatedAt || Date.now()
      };
    } else {
      const fileData = loadFile();
      cache = fileData;
      await persistPostgres(true);
    }
    ready = true;
    lastStoreError = null;
    console.log('[store] Using Postgres (DATABASE_URL) — data survives deploys');
  } catch (err) {
    lastStoreError = String(err && err.message ? err.message : err).slice(0, 240);
    console.error('[store] Postgres unavailable, falling back to file:', lastStoreError);
    if (pool) {
      try { await pool.end(); } catch (_e) {}
      pool = null;
    }
    cache = loadFile();
    ready = true;
  }
}

async function persistPostgres(force) {
  if (!pool) return;
  cache.updatedAt = Date.now();
  const payload = JSON.stringify({
    users: cache.users,
    boards: cache.boards,
    updatedAt: cache.updatedAt
  });
  await pool.query(
    `INSERT INTO maxikart_store (id, data, updated_at)
     VALUES ('main', $1::jsonb, $2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
    [payload, cache.updatedAt]
  );
}

function save() {
  cache.updatedAt = Date.now();
  if (!pool) {
    saveFile();
    return;
  }
  // Debounce Postgres writes so rapid submits don't stampede
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const job = persistPostgres().catch(err => {
      console.error('[store] Postgres save failed:', err.message || err);
    });
    saving = job.finally(() => { if (saving === job) saving = null; });
  }, 80);
}

async function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pool) await persistPostgres();
  else saveFile();
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
  if (user.passHash && user.passSalt) {
    if (hashSecret(pass, user.passSalt) !== user.passHash) {
      const err = new Error('bad-login');
      err.code = 'bad-login';
      throw err;
    }
    return user;
  }
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
  init,
  flush,
  ready: () => ready,
  persistenceMode,
  persistenceInfo,
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
