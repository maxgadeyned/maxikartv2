/* MAXIKART server-side anticheat — never trust the client. */
'use strict';

// Gameplay caps from game.js (base 38 + boost 9) + slack for lag / float error
const MAX_SPEED = 55;
const MIN_SPEED = -15;
const MAX_SPEED_UPS = 60; // units/sec horizontal
const MAX_Y = 120;
const MIN_Y = -30;
const WORLD_LIMIT = 900;
const MAX_HOP = 8;
const MIN_LAP_INTERVAL_MS = 6000;
const MIN_RACE_MS_PER_LAP = 5000;
const STATE_HZ_MAX = 40;
const STATE_MIN_INTERVAL_MS = 1000 / STATE_HZ_MAX;
const MAX_STRIKES = 12;
const MAX_MSG_KEYS = 16;

const ALLOWED_WEATHER = new Set(['clear', 'rain', 'fog']);

function num(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function createTracker() {
  return {
    x: null,
    y: null,
    z: null,
    lap: 1,
    fin: false,
    ft: null,
    lastStateAt: 0,
    lastLapAt: 0,
    raceStartedAt: 0,
    strikes: 0,
    lastWarn: 0,
    msgTimes: []
  };
}

function strike(tracker, reason, soft) {
  tracker.strikes += soft ? 0.5 : 1;
  const now = Date.now();
  if (now - tracker.lastWarn > 2000) {
    tracker.lastWarn = now;
    console.log('anticheat', reason, 'strikes=', tracker.strikes.toFixed(1));
  }
  return tracker.strikes >= MAX_STRIKES;
}

/** Rate-limit any inbound message (~80/s burst ok, sustained lower). */
function rateOk(tracker, now) {
  tracker.msgTimes.push(now);
  while (tracker.msgTimes.length && now - tracker.msgTimes[0] > 1000) {
    tracker.msgTimes.shift();
  }
  return tracker.msgTimes.length <= 80;
}

function sanitizeSettings(msg) {
  const map = clamp(msg.map | 0, 0, 3);
  const laps = [1, 3, 5].includes(msg.laps | 0) ? (msg.laps | 0) : 3;
  const weather = ALLOWED_WEATHER.has(msg.weather) ? msg.weather : 'clear';
  return {
    map,
    laps,
    night: !!msg.night,
    weather,
    items: msg.items !== false
  };
}

function sanitizeName(name) {
  return String(name || 'RACER')
    .toUpperCase()
    .replace(/[^A-Z0-9 _\-]/g, '')
    .slice(0, 12) || 'RACER';
}

/**
 * Validate + sanitize a state packet.
 * @returns {{ ok: true, packet: object } | { ok: false, kick: boolean, reason: string }}
 */
function validateState(msg, tracker, room) {
  if (!room || !room.racing) {
    return { ok: false, kick: false, reason: 'state-outside-race' };
  }
  if (!msg || typeof msg !== 'object') {
    return { ok: false, kick: strike(tracker, 'bad-object'), reason: 'bad-object' };
  }
  if (Object.keys(msg).length > MAX_MSG_KEYS) {
    return { ok: false, kick: strike(tracker, 'too-many-keys'), reason: 'too-many-keys' };
  }

  const now = Date.now();
  if (tracker.lastStateAt && now - tracker.lastStateAt < STATE_MIN_INTERVAL_MS - 2) {
    // Drop flood, soft strike
    strike(tracker, 'state-flood', true);
    return { ok: false, kick: tracker.strikes >= MAX_STRIKES, reason: 'state-flood' };
  }

  if (!num(msg.x) || !num(msg.y) || !num(msg.z) || !num(msg.h)) {
    return { ok: false, kick: strike(tracker, 'nan-pos'), reason: 'nan-pos' };
  }
  if (!num(msg.sf)) {
    return { ok: false, kick: strike(tracker, 'nan-speed'), reason: 'nan-speed' };
  }

  let x = msg.x, y = msg.y, z = msg.z, h = msg.h, sf = msg.sf;
  let ho = num(msg.ho) ? msg.ho : 0;
  let lap = (msg.lap | 0) || 1;
  let fin = !!msg.fin;
  let ft = msg.ft == null ? null : Number(msg.ft);

  // Speed spoof
  if (sf > MAX_SPEED || sf < MIN_SPEED) {
    if (strike(tracker, 'speed-cap ' + sf)) {
      return { ok: false, kick: true, reason: 'speed-cap' };
    }
    sf = clamp(sf, MIN_SPEED, MAX_SPEED);
  }

  // World bounds (teleport far away / fly hack)
  if (Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT || y > MAX_Y || y < MIN_Y) {
    return { ok: false, kick: strike(tracker, 'oob'), reason: 'oob' };
  }
  if (Math.abs(ho) > MAX_HOP) {
    if (strike(tracker, 'hop', true)) return { ok: false, kick: true, reason: 'hop' };
    ho = clamp(ho, -MAX_HOP, MAX_HOP);
  }
  if (!Number.isFinite(h)) {
    return { ok: false, kick: strike(tracker, 'bad-heading'), reason: 'bad-heading' };
  }
  h = ((h + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  // Movement vs time (teleport / speedhack without changing sf)
  if (tracker.x != null && tracker.lastStateAt) {
    const dt = Math.max(0.016, (now - tracker.lastStateAt) / 1000);
    const dx = x - tracker.x;
    const dy = y - tracker.y;
    const dz = z - tracker.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxDist = MAX_SPEED_UPS * dt * 1.85; // lag slack
    if (dist > maxDist && dist > 8) {
      if (strike(tracker, 'teleport dist=' + dist.toFixed(1) + ' max=' + maxDist.toFixed(1))) {
        return { ok: false, kick: true, reason: 'teleport' };
      }
      // Reject packet — don't broadcast cheat position
      return { ok: false, kick: false, reason: 'teleport' };
    }
    if (Math.abs(dy) > MAX_SPEED_UPS * dt * 2 + 15) {
      if (strike(tracker, 'y-teleport', true)) {
        return { ok: false, kick: true, reason: 'y-teleport' };
      }
      return { ok: false, kick: false, reason: 'y-teleport' };
    }
  }

  const maxLaps = (room.settings && room.settings.laps) || 3;

  // Lap can only stay or +1, never skip / go backwards
  if (lap < 1) lap = 1;
  if (lap > maxLaps + 1) {
    if (strike(tracker, 'lap-overflow ' + lap)) {
      return { ok: false, kick: true, reason: 'lap-overflow' };
    }
    lap = Math.min(lap, maxLaps + 1);
  }
  if (tracker.lap != null && lap < tracker.lap) {
    if (strike(tracker, 'lap-rewind')) {
      return { ok: false, kick: true, reason: 'lap-rewind' };
    }
    lap = tracker.lap;
  }
  if (tracker.lap != null && lap > tracker.lap + 1) {
    if (strike(tracker, 'lap-skip')) {
      return { ok: false, kick: true, reason: 'lap-skip' };
    }
    lap = tracker.lap;
  }
  if (tracker.lap != null && lap === tracker.lap + 1) {
    if (tracker.lastLapAt && now - tracker.lastLapAt < MIN_LAP_INTERVAL_MS) {
      if (strike(tracker, 'lap-too-fast')) {
        return { ok: false, kick: true, reason: 'lap-too-fast' };
      }
      lap = tracker.lap;
      fin = tracker.fin;
      ft = tracker.ft;
    } else {
      tracker.lastLapAt = now;
    }
  }

  // Finish rules
  if (fin) {
    if (lap < maxLaps && tracker.lap < maxLaps) {
      // finishing before last lap
      if (strike(tracker, 'early-finish')) {
        return { ok: false, kick: true, reason: 'early-finish' };
      }
      fin = false;
      ft = null;
    }
    const minFt = (maxLaps * MIN_RACE_MS_PER_LAP) / 1000;
    if (ft != null && (!num(ft) || ft < minFt * 0.5)) {
      if (strike(tracker, 'finish-time')) {
        return { ok: false, kick: true, reason: 'finish-time' };
      }
      fin = tracker.fin;
      ft = tracker.ft;
    }
    if (tracker.fin && tracker.ft != null && ft != null && ft < tracker.ft - 0.05) {
      // can't improve finish time after finishing
      ft = tracker.ft;
    }
    if (tracker.raceStartedAt) {
      const elapsed = (now - tracker.raceStartedAt) / 1000;
      if (ft != null && ft > elapsed + 2) {
        ft = elapsed;
      }
    }
  } else if (tracker.fin) {
    // once finished, stay finished
    fin = true;
    ft = tracker.ft;
  }

  if (ft != null && !num(ft)) ft = null;
  if (ft != null) ft = +ft.toFixed(2);

  tracker.x = x;
  tracker.y = y;
  tracker.z = z;
  tracker.lap = lap;
  tracker.fin = fin;
  tracker.ft = ft;
  tracker.lastStateAt = now;

  return {
    ok: true,
    packet: {
      t: 's',
      x: +x.toFixed(2),
      y: +y.toFixed(2),
      z: +z.toFixed(2),
      h: +h.toFixed(3),
      sf: +sf.toFixed(1),
      ho: +ho.toFixed(2),
      lap,
      fin,
      ft
    }
  };
}

function onRaceStart(tracker) {
  const now = Date.now();
  tracker.x = null;
  tracker.y = null;
  tracker.z = null;
  tracker.lap = 1;
  tracker.fin = false;
  tracker.ft = null;
  tracker.lastStateAt = 0;
  tracker.lastLapAt = now;
  tracker.raceStartedAt = now;
  tracker.strikes = 0;
  tracker.msgTimes = [];
}

function onLobby(tracker) {
  tracker.x = null;
  tracker.y = null;
  tracker.z = null;
  tracker.lap = 1;
  tracker.fin = false;
  tracker.ft = null;
  tracker.lastStateAt = 0;
  tracker.raceStartedAt = 0;
  tracker.strikes = 0;
}

module.exports = {
  createTracker,
  rateOk,
  sanitizeSettings,
  sanitizeName,
  validateState,
  onRaceStart,
  onLobby,
  MAX_STRIKES
};
