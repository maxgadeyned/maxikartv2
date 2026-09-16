// ---------- Configuration & LocalStorage ----------
const defaultSettings = { 
  keys: { accel: 'w', brake: 's', left: 'a', right: 'd', drift: ' ', item: 'e', cam: 'f', rear: 'b', restart: 'r' }, 
  sound: true, auto: false, night: false, ghost: true, finish: 'matte', glow: '#37c6b0', items: true,
  bodyColor: '#228b7a', bodyScale: { x: 1, y: 1, z: 1 }, decalSpoiler: false, decalStripes: false,
  wheelColor: '#111111', driverHelmet: '#374151',
  mythicTrail: false, chromeShimmer: false, boostDurationMult: 1, glowBoost: 1, setBonusId: null,
  weather: 'clear', vehicleClass: 'balanced', bodySilhouette: 'stock',
  accentColor: null, decalGlowRing: false,
  volumes: { master: 100, engine: 100, skid: 100, ui: 100, sfx: 100, ambience: 100 }
};

let settings = JSON.parse(localStorage.getItem('kartSettings')) || defaultSettings;
if (!settings.keys) settings.keys = defaultSettings.keys;
Object.keys(defaultSettings).forEach(k => { if (settings[k] === undefined) settings[k] = defaultSettings[k]; });
Object.keys(defaultSettings.keys).forEach(k => { if (!settings.keys[k]) settings.keys[k] = defaultSettings.keys[k]; });
if (!settings.volumes) settings.volumes = { ...defaultSettings.volumes };
Object.keys(defaultSettings.volumes).forEach(k => {
  if (settings.volumes[k] === undefined || settings.volumes[k] === null) settings.volumes[k] = defaultSettings.volumes[k];
});

/** 0–1 gain for a sound category (respects master mute + sliders). */
function audioVol(cat) {
  if (!settings.sound) return 0;
  const v = settings.volumes || defaultSettings.volumes;
  const master = Math.max(0, Math.min(100, Number(v.master != null ? v.master : 100))) / 100;
  const local = Math.max(0, Math.min(100, Number(v[cat] != null ? v[cat] : 100))) / 100;
  return master * local;
}
window.audioVol = audioVol;

function setVolume(cat, value) {
  if (!settings.volumes) settings.volumes = { ...defaultSettings.volumes };
  settings.volumes[cat] = Math.max(0, Math.min(100, Number(value) | 0));
  saveConfig();
  const pct = document.getElementById('vol-' + cat + '-pct');
  if (pct) pct.textContent = settings.volumes[cat] + '%';
  const slider = document.getElementById('vol-' + cat);
  if (slider && Number(slider.value) !== settings.volumes[cat]) slider.value = settings.volumes[cat];
}
window.setVolume = setVolume;

function refreshVolumeUI() {
  if (!settings.volumes) return;
  Object.keys(defaultSettings.volumes).forEach(cat => {
    const slider = document.getElementById('vol-' + cat);
    const pct = document.getElementById('vol-' + cat + '-pct');
    const val = settings.volumes[cat] != null ? settings.volumes[cat] : 100;
    if (slider) slider.value = val;
    if (pct) pct.textContent = val + '%';
  });
}

let maxLaps = 3;
let bestTime = null;
let ghostData = [];

// ---------- Map Registry ----------
const MAPS = [
  { 
    id: 'neon', name: 'NEON LABYRINTH', shortcuts: [0.33, 0.66], accent: '#37e6c8',
    points: [
      new THREE.Vector3(0, 0, 280), new THREE.Vector3(220, 0, 250), new THREE.Vector3(280, 0, 80), new THREE.Vector3(120, 0, -20),      
      new THREE.Vector3(260, 0, -120), new THREE.Vector3(180, 0, -260), new THREE.Vector3(40, 0, -280), new THREE.Vector3(80, 0, -100),      
      new THREE.Vector3(-50, 0, 80), new THREE.Vector3(50, 0, 180), new THREE.Vector3(-80, 0, 200), new THREE.Vector3(-180, 0, 50),      
      new THREE.Vector3(-60, 0, -80), new THREE.Vector3(-220, 0, -240), new THREE.Vector3(-280, 0, -80), new THREE.Vector3(-240, 0, 180),     
      new THREE.Vector3(-100, 0, 280)
    ]
  },
  { 
    id: 'tiburtina', name: 'TIBURTINA SPRINT', accent: '#f2c14e',
    points: [
      new THREE.Vector3(0, 0, 300), new THREE.Vector3(80, 0, 280), new THREE.Vector3(150, 0, 180),
      new THREE.Vector3(80, 0, 80), new THREE.Vector3(200, 0, 0), new THREE.Vector3(300, 0, 100),
      new THREE.Vector3(400, 0, 0), new THREE.Vector3(300, 0, -100), new THREE.Vector3(400, 0, -200),
      new THREE.Vector3(250, 0, -300), new THREE.Vector3(100, 0, -200), new THREE.Vector3(0, 0, -300),
      new THREE.Vector3(-100, 0, -200), new THREE.Vector3(-250, 0, -300), new THREE.Vector3(-400, 0, -200),
      new THREE.Vector3(-300, 0, -100), new THREE.Vector3(-400, 0, 0), new THREE.Vector3(-300, 0, 100),
      new THREE.Vector3(-200, 0, 0), new THREE.Vector3(-80, 0, 80), new THREE.Vector3(-150, 0, 180),
      new THREE.Vector3(-80, 0, 280)
    ]
  },
  {
    id: 'knot', name: 'KNOT CIRCUIT', shortcuts: [0.55], accent: '#e2413a',
    points: [
      new THREE.Vector3(50, 0, 50),
      new THREE.Vector3(50, 0, -50),     
      new THREE.Vector3(25, 0, -100),
      new THREE.Vector3(0, 0, -150),     
      new THREE.Vector3(-50, 0, -250),
      new THREE.Vector3(-150, 0, -300),
      new THREE.Vector3(-250, 0, -200),
      new THREE.Vector3(-200, 0, -100),
      new THREE.Vector3(-100, 15, -100),
      new THREE.Vector3(0, 35, -150),    
      new THREE.Vector3(100, 15, -200),
      new THREE.Vector3(250, 0, -250),
      new THREE.Vector3(450, 0, -150),
      new THREE.Vector3(500, 0, 50),
      new THREE.Vector3(400, 0, 250),
      new THREE.Vector3(300, 0, 300),
      new THREE.Vector3(200, 0, 250),    
      new THREE.Vector3(100, 0, 200),
      new THREE.Vector3(0, 0, 250),
      new THREE.Vector3(-100, 0, 350),
      new THREE.Vector3(-50, 15, 450),   
      new THREE.Vector3(100, 30, 350),
      new THREE.Vector3(200, 35, 250),   
      new THREE.Vector3(200, 35, 100),
      new THREE.Vector3(150, 35, 0),
      new THREE.Vector3(50, 35, -50),    
      new THREE.Vector3(-50, 15, -50),
      new THREE.Vector3(-100, 0, 0),
      new THREE.Vector3(-50, 0, 100),
      new THREE.Vector3(25, 0, 100)
    ]
  },
  {
    id: 'ridge', name: 'RIDGE RUN', accent: '#78b4ff',
    points: [
      new THREE.Vector3(0, 0, 320), new THREE.Vector3(140, 0, 300), new THREE.Vector3(260, 8, 200),
      new THREE.Vector3(300, 20, 60), new THREE.Vector3(220, 35, -80), new THREE.Vector3(80, 42, -160),
      new THREE.Vector3(-40, 38, -220), new THREE.Vector3(-180, 20, -180), new THREE.Vector3(-280, 5, -60),
      new THREE.Vector3(-300, 0, 80), new THREE.Vector3(-200, 0, 200), new THREE.Vector3(-60, 0, 280),
      new THREE.Vector3(40, 12, 180), new THREE.Vector3(120, 18, 100)
    ],
    shortcuts: [0.42, 0.78]
  }
];

let activeMapIndex = 0;

function sampleMapPath(map, segments) {
  if (!map || !map.points || map.points.length < 2) return [];
  if (typeof THREE !== 'undefined' && THREE.CatmullRomCurve3) {
    const curve = new THREE.CatmullRomCurve3(map.points, true);
    return curve.getPoints(segments || 120);
  }
  return map.points.slice();
}

function paintTrackPreview(canvas, map) {
  if (!canvas || !map) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const accent = map.accent || '#37e6c8';
  const pts = sampleMapPath(map, 140);
  if (!pts.length) return;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  pts.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  });
  const tW = Math.max(40, maxX - minX);
  const tH = Math.max(40, maxZ - minZ);
  const pad = 36;
  const scale = Math.min((w - pad * 2) / tW, (h - pad * 2) / tH);
  const ox = w * 0.5 - (minX + tW * 0.5) * scale;
  const oy = h * 0.46 - (minZ + tH * 0.5) * scale;
  const project = (p) => ({ x: p.x * scale + ox, y: p.z * scale + oy });

  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#12151b');
  bg.addColorStop(1, '#08090c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, w * 0.55);
  glow.addColorStop(0, accent + '33');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // soft terrain blobs
  ctx.fillStyle = 'rgba(28, 51, 37, 0.35)';
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const rx = w * 0.5 + Math.cos(ang) * w * 0.28;
    const ry = h * 0.45 + Math.sin(ang) * h * 0.22;
    ctx.beginPath();
    ctx.ellipse(rx, ry, 18 + (i % 3) * 8, 10 + (i % 2) * 6, ang, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawn = pts.map(project);
  const trackWidth = Math.max(10, Math.min(22, 14 * scale / 0.35));

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  drawn.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = trackWidth + 6;
  ctx.stroke();

  ctx.strokeStyle = '#2a2d35';
  ctx.lineWidth = trackWidth;
  ctx.stroke();

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(1.5, trackWidth * 0.14);
  ctx.setLineDash([6, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // start/finish marker
  const a = drawn[0];
  const b = drawn[Math.min(4, drawn.length - 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const hw = trackWidth * 0.55;
  ctx.strokeStyle = '#f2f0e9';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.x - nx * hw, a.y - ny * hw);
  ctx.lineTo(a.x + nx * hw, a.y + ny * hw);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function paintAllTrackCardPreviews() {
  document.querySelectorAll('.track-card').forEach(card => {
    const idx = Number(card.dataset.map);
    const canvas = card.querySelector('.track-card-preview');
    if (!canvas || !MAPS[idx]) return;
    paintTrackPreview(canvas, MAPS[idx]);
  });
}

function syncMapDisplays() {
  const name = MAPS[activeMapIndex].name;
  ['ttMapDisplay','hostMapDisplay','freeMapDisplay','ttSummary','lobbyMapDisplay'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerText = name;
  });
  document.querySelectorAll('.track-card').forEach(card => {
    const idx = Number(card.dataset.map);
    card.classList.toggle('selected', idx === activeMapIndex);
  });
}

function selectMap(index) {
  if (index < 0 || index >= MAPS.length) return;
  activeMapIndex = index;
  syncMapDisplays();
}

function cycleMap(dir) {
  activeMapIndex = (activeMapIndex + dir + MAPS.length) % MAPS.length;
  syncMapDisplays();
}

function refreshTTOptionsSummary() {
  const name = MAPS[activeMapIndex] ? MAPS[activeMapIndex].name : 'TRACK';
  const sum = document.getElementById('ttSummary');
  if (sum) sum.innerText = name;

  const nightVal = document.getElementById('ttNightValue');
  const nightTile = document.getElementById('ttNightTile');
  if (nightVal) nightVal.textContent = settings.night ? 'ON' : 'OFF';
  if (nightTile) nightTile.classList.toggle('on', !!settings.night);

  const ghostVal = document.getElementById('ttGhostValue');
  const ghostTile = document.getElementById('ttGhostTile');
  if (ghostVal) ghostVal.textContent = settings.ghost ? 'ON' : 'OFF';
  if (ghostTile) ghostTile.classList.toggle('on', !!settings.ghost);

  const weatherLabel = (window.RaceKit ? window.RaceKit.getWeather(settings.weather || 'clear').label : (settings.weather || 'clear'));
  document.querySelectorAll('.weather-display').forEach(el => {
    el.textContent = String(weatherLabel).toUpperCase();
  });
}

function toggleTTOption(key) {
  if (key !== 'night' && key !== 'ghost') return;
  toggleSetting(key, !settings[key]);
  refreshTTOptionsSummary();
}

function cycleWeather(dir) {
  const order = ['clear', 'rain', 'fog'];
  let i = order.indexOf(settings.weather || 'clear');
  i = (i + dir + order.length) % order.length;
  settings.weather = order[i];
  saveConfig();
  document.querySelectorAll('.weather-display').forEach(el => {
    const label = (window.RaceKit ? window.RaceKit.getWeather(settings.weather).label : settings.weather);
    el.textContent = label.toUpperCase();
  });
  if (window.applyWeatherEffects) window.applyWeatherEffects();
}

window.playerRacePlace = 1;
window.hitstopTimer = 0;
window.raceHazards = { bananas: [], shells: [], fakeBoxes: [] };
window.replayBuffer = [];
window.replaying = false;


window.cameraView = 'chase';
window.lastCameraView = 'chase';
window.lookBehind = false;
window.lastLookBehind = false;

function formatKey(k) { return k === ' ' ? 'SPACE' : k.toUpperCase(); }
function formatTime(t) { const m = Math.floor(t / 60); const s = (t % 60).toFixed(2).padStart(5, '0'); return `${m}:${s}`; }

function refreshKeybindUI() {
  Object.keys(settings.keys).forEach(action => {
    const btn = document.getElementById(`bind-${action}`);
    if (btn) btn.innerText = formatKey(settings.keys[action]);
  });
  const guide = document.getElementById('hudKeyGuide');
  if (guide) guide.innerHTML = `ESC: PAUSE | ${formatKey(settings.keys.item)}: USE ITEM<br>${formatKey(settings.keys.cam)}: CAM | ${formatKey(settings.keys.rear)}: LOOK BACK`;
  const pBtn = document.getElementById('pauseRestartBtn');
  if (pBtn) pBtn.innerText = `Restart Race (${formatKey(settings.keys.restart)})`;
}

document.getElementById('toggle-sound').checked = settings.sound;
const setupNight = document.getElementById('setup-night'); if (setupNight) setupNight.checked = settings.night;
const freeNight = document.getElementById('setup-night-free'); if (freeNight) freeNight.checked = settings.night;
const hostNight = document.getElementById('setup-night-host'); if (hostNight) hostNight.checked = settings.night;
const setupGhost = document.getElementById('setup-ghost'); if (setupGhost) setupGhost.checked = settings.ghost;
document.getElementById('setup-items').checked = settings.items;
refreshKeybindUI();
syncMapDisplays();
paintAllTrackCardPreviews();
refreshTTOptionsSummary();

function saveConfig() { localStorage.setItem('kartSettings', JSON.stringify(settings)); }

function setLaps(n) {
  maxLaps = n;
  document.querySelectorAll('.lap-btn').forEach(btn => btn.classList.remove('active'));
  const main = document.getElementById('btn-lap-' + n); if (main) main.classList.add('active');
  const host = document.getElementById('btn-lap-' + n + '-host'); if (host) host.classList.add('active');
  const lobby = document.getElementById('btn-lap-' + n + '-lobby'); if (lobby) lobby.classList.add('active');
}

function setFinish(type, el) {
  settings.finish = type; saveConfig();
  el.parentElement.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  if (window.applyCustomization) window.applyCustomization();
}

function setGlow(hex, el) {
  settings.glow = hex; saveConfig();
  el.parentElement.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  if (window.applyCustomization) window.applyCustomization();
}

function playUIChime() {
  const vol = audioVol('ui');
  if (vol <= 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.05 * vol, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.08);
  } catch(e) {}
}

function playWarningBuzz() {
  const vol = audioVol('sfx');
  if (vol <= 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(140, ctx.currentTime);
    gain.gain.setValueAtTime(0.08 * vol, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.2);
  } catch(e) {}
}

// Whoosh + rarity-scaled chime for loot box reveals
function playLootReveal(rarity) {
  const vol = audioVol('sfx');
  if (vol <= 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const rank = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }[rarity] || 0;

    // Whoosh: filtered noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.28);
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2200 + rank * 400, t + 0.22);
    bp.Q.value = 0.7;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, t);
    nGain.gain.exponentialRampToValueAtTime((0.12 + rank * 0.02) * vol, t + 0.04);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    noise.connect(bp).connect(nGain).connect(ctx.destination);
    noise.start(t); noise.stop(t + 0.3);

    // Chime stack — more notes / higher pitch for rarer pulls
    const base = 523.25 + rank * 60;
    const notes = 2 + Math.min(4, rank);
    for (let i = 0; i < notes; i++) {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = rank >= 4 ? 'triangle' : 'sine';
      const freq = base * Math.pow(1.25, i);
      const start = t + 0.12 + i * (0.07 - rank * 0.005);
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.exponentialRampToValueAtTime((0.06 + rank * 0.012) * vol, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.35 + rank * 0.05);
      osc.connect(g).connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.5 + rank * 0.08);
    }
  } catch (e) {}
}
window.playLootReveal = playLootReveal;

// ---------- UI State Machine ----------
let gameState = 'menu'; let previousState = 'menu'; let gameMode = 'free';
let onlineMenuOpen = false;
let raceTime = 0; let currentLap = 1; 
let nextCheckpointIndex = 0; let lastFinishDot = 0;
let currentRunGhostData = [];
let lapSplits = []; let lapTimer = 0;

function navTo(targetId) { 
  document.querySelectorAll('.menu-overlay').forEach(el => el.classList.remove('active')); 
  document.getElementById(targetId).classList.add('active');
  if (targetId === 'menu-tt-track') {
    syncMapDisplays();
    paintAllTrackCardPreviews();
  }
  if (targetId === 'menu-tt-options') refreshTTOptionsSummary();
}

function openSettings() { 
  document.getElementById('bindWarningText').innerText = "";
  refreshVolumeUI();
  if (gameMode === 'online' && (onlineMenuOpen || gameState === 'playing' || gameState === 'countdown' || gameState === 'spectating')) {
    // Keep the race simulating while settings are open
    onlineMenuOpen = true;
    clearDriveInput();
    navTo('menu-settings');
    return;
  }
  previousState = gameState; gameState = 'settings'; 
  navTo('menu-settings'); 
}

function closeSettings() { 
  if (awaitingBind) {
    document.getElementById(`bind-${awaitingBind}`).innerText = formatKey(settings.keys[awaitingBind]);
    document.getElementById(`bind-${awaitingBind}`).classList.remove('waiting');
    awaitingBind = null;
  }
  document.getElementById('bindWarningText').innerText = "";
  saveConfig();
  if (gameMode === 'online' && onlineMenuOpen) {
    updateOnlineRestartUI();
    navTo('menu-pause');
    return;
  }
  gameState = previousState; 
  if (gameState === 'paused') navTo('menu-pause'); else navTo('menu-main'); 
}

function pauseGame() {
  if (gameMode === 'online') {
    openOnlineMenu();
    return;
  }
  if (gameState !== 'playing' && gameState !== 'countdown' && gameState !== 'spectating' && gameState !== 'intro') return;
  window._pausedFromSpectate = gameState === 'spectating';
  previousState = gameState;
  gameState = 'paused';
  updateOnlineRestartUI();
  navTo('menu-pause');
  if (window.suspendGameAudio) window.suspendGameAudio();
}
function resumeGame() {
  if (gameMode === 'online') {
    closeOnlineMenu();
    return;
  }
  gameState = window._pausedFromSpectate ? 'spectating' : previousState;
  if (gameState === 'paused' || gameState === 'menu' || gameState === 'settings') gameState = 'playing';
  window._pausedFromSpectate = false;
  document.querySelectorAll('.menu-overlay').forEach(el => el.classList.remove('active'));
  if (gameState === 'spectating') {
    const ui = document.getElementById('spectateUI');
    if (ui) ui.style.display = 'flex';
  }
  if (window.resumeGameAudio) window.resumeGameAudio();
}
function quitToMenu() {
  onlineMenuOpen = false;
  clearRaceIntro();
  gameState = 'menu';
  document.getElementById('hud').style.display = 'none';
  hideSpectateUI();
  if (window.Net && Net.isOnline()) Net.leave();
  navTo('menu-main');
  const coinChip = document.getElementById('coinChip');
  if (coinChip) coinChip.classList.remove('in-race');
  if (window.clearAIRacers) window.clearAIRacers();
  if (window.clearNetRemotes) window.clearNetRemotes();
  if (window.clearHazards) window.clearHazards();
  if (window.suspendGameAudio) window.suspendGameAudio();
}

function restartRace() {
  if (gameMode === 'online') return;
  startGame(gameMode, { skipIntro: true });
}

function updateOnlineRestartUI() {
  const online = gameMode === 'online';
  ['pauseRestartBtn', 'finishRaceAgainBtn', 'resultsAgainBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = online ? 'none' : '';
  });
  const title = document.getElementById('pauseTitle');
  if (title) title.textContent = online ? 'MENU' : 'PAUSED';
  const resumeBtn = document.getElementById('pauseResumeBtn');
  if (resumeBtn) {
    resumeBtn.innerHTML = online
      ? '<span class="btn-ico">▶</span>Back to Race'
      : '<span class="btn-ico">▶</span>Resume';
  }
  const guide = document.getElementById('hudKeyGuide');
  if (guide && online) {
    guide.innerHTML = `ESC: MENU | ${formatKey(settings.keys.item)}: USE ITEM<br>${formatKey(settings.keys.cam)}: CAM | ${formatKey(settings.keys.rear)}: LOOK BACK`;
  }
}

function clearDriveInput() {
  inputState.accel = false;
  inputState.brake = false;
  inputState.left = false;
  inputState.right = false;
  inputState.drift = false;
  window.lookBehind = false;
}

/** Online: ESC opens a live overlay — race keeps simulating (no freeze). */
function openOnlineMenu() {
  if (gameMode !== 'online') return;
  if (gameState !== 'playing' && gameState !== 'countdown' && gameState !== 'spectating') return;
  onlineMenuOpen = true;
  clearDriveInput();
  updateOnlineRestartUI();
  navTo('menu-pause');
}

function closeOnlineMenu() {
  if (!onlineMenuOpen) return;
  onlineMenuOpen = false;
  document.querySelectorAll('.menu-overlay').forEach(el => el.classList.remove('active'));
  if (gameState === 'spectating') {
    const ui = document.getElementById('spectateUI');
    if (ui) ui.style.display = 'flex';
  }
}

function startGame(mode, opts) {
  if (document.activeElement) document.activeElement.blur();
  gameMode = mode;
  const skipIntro = !!(opts && opts.skipIntro);

  const mapId = MAPS[activeMapIndex].id;
  bestTime = localStorage.getItem(`kartBest_${mapId}_${maxLaps}`) ? parseFloat(localStorage.getItem(`kartBest_${mapId}_${maxLaps}`)) : null;
  ghostData = JSON.parse(localStorage.getItem(`kartGhost_${mapId}_${maxLaps}`)) || [];

  document.querySelectorAll('.menu-overlay').forEach(el => el.classList.remove('active'));
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('timerContainer').style.display = (mode === 'timed' || mode === 'multiplayer' || mode === 'online') ? 'flex' : 'none';
  document.getElementById('bestVal').textContent = bestTime ? formatTime(bestTime) : '--:--.--';
  document.getElementById('lapVal').textContent = mode === 'free' ? '∞' : `1/${maxLaps}`;
  const lapContainer = document.getElementById('lapContainer');
  if (lapContainer) lapContainer.style.display = mode === 'free' ? 'none' : '';

  const placeEl = document.getElementById('placeVal');
  if (placeEl) placeEl.parentElement.style.display = (mode === 'multiplayer' || mode === 'online') ? '' : 'none';

  const netPingWrap = document.getElementById('hudNetPingWrap');
  if (netPingWrap) netPingWrap.style.display = mode === 'online' ? '' : 'none';
  const legend = document.getElementById('minimapLegend');
  if (legend) legend.innerHTML = mode === 'online' ? '● You &nbsp; ● Racers &nbsp; ■ Box' : '● You &nbsp; ● AI &nbsp; ■ Box';
  
  const spawnItems = ((mode === 'multiplayer' || mode === 'online') && settings.items !== false);
  document.getElementById('hudItemSlot').style.display = spawnItems ? 'flex' : 'none';
  document.getElementById('hudItemSlot').innerText = '';
  document.getElementById('hudItemSlot').classList.remove('spinning');
  
  if (settings.sound && window.initAudio) window.initAudio();
  if (window.buildTrack) window.buildTrack(MAPS[activeMapIndex].points, spawnItems);

  if (window.clearHazards) window.clearHazards();
  if (window.clearAIRacers) window.clearAIRacers();
  if (window.clearNetRemotes) window.clearNetRemotes();
  if (mode === 'online') {
    // Real players only — no AI filler (keeps latency clean)
    if (window.syncNetRemotes) window.syncNetRemotes();
  } else if ((mode === 'multiplayer') && window.spawnAIRacers) {
    window.spawnAIRacers(3);
  }
  
  window.kart.speedForward = 0; window.kart.velocity.set(0,0,0);
  window.kart.boostTimer = 0; window.kart.isDrifting = false; 
  window.kart.driftTime = 0; window.kart.driftDir = 0; window.kart.driftTier = 1; window.kart.lastDriftTier = 1;
  window.kart.hopOffset = 0; 
  window.kart.hopVelY = 0;
  window.kart.grounded = true;
  window.kart.item = null;
  window.kart.shieldTimer = 0;
  window.kart.spinTimer = 0;
  window.kart.finished = false;
  window.playerRacePlace = 1;
  window.replayBuffer = [];
  window.replaying = false;
  window.hitstopTimer = 0;
  window._resultsShown = false;
  window._firstFinishAt = null;
  hideSpectateUI();

  // Always reset base handling before weather (prevents permanent speed decay on restart)
  window.kart.maxSpeed = 38;
  window.kart.accel = 26;
  window.kart.brakeAccel = 32;
  window.kart.steerRate = 1.3;
  window.kart.driftSteerRate = 1.4;
  window.kart.gripLateral = 14;
  window.kart.grassMaxSpeed = 16;
  window.kart.reverseMaxSpeed = -12;

  if (window.applyWeatherEffects) window.applyWeatherEffects();
  if (window._weatherMods) {
    window.kart.gripLateral *= window._weatherMods.gripMult;
    window.kart.maxSpeed *= window._weatherMods.speedMult;
  }

  const coinChip = document.getElementById('coinChip');
  if (coinChip) coinChip.classList.add('in-race');

  // --- GRID SPAWN SYSTEM ---
  const gridSlot = (mode === 'online' && window.Net) ? Net.getLocalSlot() : 0;
  const spawn = getGridSpawn(gridSlot);
  window.kart.pos.copy(spawn.pos);
  window.trackStartHeading = spawn.heading;
  window.kart.heading = spawn.heading;
  if (mode === 'online' && window.placeNetRemotesOnGrid) window.placeNetRemotesOnGrid();
  // -------------------------
  
  if (window.renderer && window.skidTarget) {
    window.renderer.setRenderTarget(window.skidTarget);
    window.renderer.setClearColor(0x000000, 0); window.renderer.clear();
    window.renderer.setRenderTarget(null);
  }

  raceTime = 0; lapTimer = 0; currentLap = 1; nextCheckpointIndex = 0; currentRunGhostData = []; lapSplits = [];
  window.crossedStartLine = false; 
  window.raceTainted = false;
  
  const vecX = window.kart.pos.x - window.trackStartPos.x;
  const vecZ = window.kart.pos.z - window.trackStartPos.z;
  lastFinishDot = vecX * window.trackTangent.x + vecZ * window.trackTangent.z;
  
  if (window.applyLightingMode) window.applyLightingMode(settings.night);
  const pauseMap = document.getElementById('pauseMapInfo');
  if (pauseMap) pauseMap.textContent = MAPS[activeMapIndex].name + ' · ' + maxLaps + ' LAP' + (maxLaps>1?'S':'');
  updateOnlineRestartUI();
  if (mode === 'timed' || mode === 'multiplayer' || mode === 'online') {
    if (skipIntro) {
      clearRaceIntro();
      document.getElementById('hud').style.display = 'flex';
      gameState = 'countdown';
      startCountdown();
    } else {
      document.getElementById('hud').style.display = 'none';
      gameState = 'intro';
      beginRaceIntro();
    }
  } else {
    gameState = 'playing';
  }
}

/** Grid spawn for a 0-based race slot (matches local + remote placement). */
function getGridSpawn(slot) {
  const gridPosition = (slot | 0) + 1;
  const spacingBack = 20 + (gridPosition - 1) * 15;
  let spawnIndex = window.pts.length - spacingBack;
  if (spawnIndex < 0) spawnIndex = window.pts.length + spawnIndex;
  const spawnPt = window.pts[spawnIndex];
  const nextPt = window.pts[(spawnIndex + 1) % window.pts.length];
  const spawnFw = new THREE.Vector3().subVectors(nextPt, spawnPt).normalize();
  const spawnRight = new THREE.Vector3(spawnFw.z, 0, -spawnFw.x).normalize();
  const lateralStagger = (gridPosition % 2 === 0) ? -4 : 4;
  const pos = spawnPt.clone().add(spawnRight.multiplyScalar(lateralStagger));
  pos.y += 0.5;
  return { pos, heading: Math.atan2(spawnFw.x, spawnFw.z), fw: spawnFw };
}
window.getGridSpawn = getGridSpawn;

function clearRaceIntro() {
  const ri = window.raceIntro;
  if (ri && ri.baseFov != null && window._raceCam) {
    window._raceCam.fov = ri.baseFov;
    window._raceCam.updateProjectionMatrix();
  }
  window.raceIntro = null;
  const ui = document.getElementById('raceIntroUI');
  if (ui) {
    ui.style.display = 'none';
    ui.classList.remove('show', 'hide-out');
  }
}

function buildIntroRacerRows() {
  if (gameMode === 'online' && window.Net && Net.getPlayers) {
    return Net.getPlayers().map(p => ({
      name: p.name || 'RACER',
      col: (p.look && p.look.bodyColor) || '#37e6c8',
      slot: p.slot | 0,
      you: !!p.you
    }));
  }
  const youName = localStorage.getItem('kartPlayerName') || 'YOU';
  const youCol = (window.settings && settings.bodyColor) || '#37e6c8';
  const rows = [{ name: youName, col: youCol, slot: 0, you: true }];
  if (gameMode === 'multiplayer' && window.aiRacers && window.aiRacers.length) {
    window.aiRacers.forEach((ai, i) => {
      const hex = ((ai.color >>> 0) & 0xffffff).toString(16).padStart(6, '0');
      rows.push({ name: ai.name || ('AI ' + (i + 1)), col: '#' + hex, slot: i + 1, you: false });
    });
  }
  return rows;
}

function beginRaceIntro() {
  clearRaceIntro();
  if (!window.pts || !window.pts.length) {
    document.getElementById('hud').style.display = 'flex';
    gameState = 'countdown';
    startCountdown();
    return;
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, sumY = 0;
  window.pts.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    sumY += p.y;
  });
  const center = new THREE.Vector3((minX + maxX) * 0.5, sumY / window.pts.length, (minZ + maxZ) * 0.5);
  const span = Math.max(80, Math.max(maxX - minX, maxZ - minZ));
  const start = getGridSpawn(0);
  const weatherLabel = window.RaceKit
    ? window.RaceKit.getWeather((settings && settings.weather) || 'clear').label
    : ((settings && settings.weather) || 'clear');

  const mapEl = document.getElementById('raceIntroMapName');
  const metaEl = document.getElementById('raceIntroMeta');
  const listEl = document.getElementById('raceIntroRacers');
  const ui = document.getElementById('raceIntroUI');
  if (mapEl) mapEl.textContent = MAPS[activeMapIndex].name;
  if (metaEl) {
    metaEl.textContent = `${maxLaps} LAP${maxLaps > 1 ? 'S' : ''} · ${String(weatherLabel).toUpperCase()}${settings.night ? ' · NIGHT' : ''}`;
  }
  if (listEl) {
    const players = buildIntroRacerRows();
    listEl.innerHTML = players.map((p, i) => {
      return `<div class="race-intro-racer${p.you ? ' you' : ''}" style="--racer-col:${p.col};animation-delay:${0.28 + i * 0.07}s">
        <span class="race-intro-swatch"></span>
        <span class="race-intro-racer-meta">
          <span class="race-intro-slot">P${(p.slot | 0) + 1}${p.you ? ' · YOU' : ''}</span>
          <span class="race-intro-name">${p.name || 'RACER'}</span>
        </span>
      </div>`;
    }).join('');
  }
  if (ui) {
    ui.style.display = 'flex';
    ui.classList.remove('hide-out');
    void ui.offsetWidth;
    ui.classList.add('show');
  }

  window.raceIntro = {
    t: 0,
    phase: 'preview',
    center,
    // High overview looking down at the circuit — close enough that ground fills the shot
    radius: span * 0.36,
    height: Math.max(52, span * 0.22),
    angle: Math.atan2(window.kart.pos.x - center.x, window.kart.pos.z - center.z) + 0.6,
    startPos: start.pos.clone(),
    startHeading: start.heading,
    previewDur: 4.0,
    lineupDur: 1.7,
    povDur: 1.35,
    snap: true,
    baseFov: null
  };
}

function updateRaceIntro(dt) {
  const ri = window.raceIntro;
  if (!ri || gameState !== 'intro') return;
  ri.t += dt;

  const previewEnd = ri.previewDur;
  const lineupEnd = previewEnd + ri.lineupDur;
  const povEnd = lineupEnd + ri.povDur;

  if (ri.t < previewEnd) {
    ri.phase = 'preview';
    ri.angle += dt * 0.38;
  } else if (ri.t < lineupEnd) {
    if (ri.phase !== 'lineup') ri.phase = 'lineup';
  } else if (ri.t < povEnd) {
    if (ri.phase !== 'pov') {
      ri.phase = 'pov';
      const ui = document.getElementById('raceIntroUI');
      if (ui) ui.classList.add('hide-out');
    }
  } else {
    clearRaceIntro();
    document.getElementById('hud').style.display = 'flex';
    gameState = 'countdown';
    startCountdown();
  }
}

function raceIntroCamera(camera, camTargetPos, camTargetLook) {
  const ri = window.raceIntro;
  if (!ri) return false;
  window._raceCam = camera;

  if (ri.baseFov == null) ri.baseFov = camera.fov;

  let idealPos, idealLook;
  if (ri.phase === 'preview') {
    // High orbit looking down at the track so the map fills the frame
    idealPos = new THREE.Vector3(
      ri.center.x + Math.sin(ri.angle) * ri.radius,
      ri.center.y + ri.height,
      ri.center.z + Math.cos(ri.angle) * ri.radius
    );
    idealLook = new THREE.Vector3(ri.center.x, ri.center.y + 1.5, ri.center.z);
    if (camera.fov !== 62) {
      camera.fov = 62;
      camera.updateProjectionMatrix();
    }
  } else if (ri.phase === 'lineup') {
    const fw = new THREE.Vector3(Math.sin(ri.startHeading), 0, Math.cos(ri.startHeading));
    idealPos = ri.startPos.clone().add(fw.clone().multiplyScalar(-22)).add(new THREE.Vector3(0, 10, 0));
    idealLook = ri.startPos.clone().add(fw.clone().multiplyScalar(22)).add(new THREE.Vector3(0, 1.2, 0));
    if (camera.fov !== ri.baseFov) {
      camera.fov = ri.baseFov;
      camera.updateProjectionMatrix();
    }
  } else {
    const followPos = window.kart.pos.clone().add(new THREE.Vector3(0, window.kart.hopOffset, 0));
    const fw = new THREE.Vector3(Math.sin(window.kart.heading), 0, Math.cos(window.kart.heading));
    idealPos = followPos.clone().add(fw.clone().multiplyScalar(-4.5)).add(new THREE.Vector3(0, 4.2, 0));
    idealLook = followPos.clone().add(fw.clone().multiplyScalar(6)).add(new THREE.Vector3(0, 0.5, 0));
    if (camera.fov !== ri.baseFov) {
      camera.fov = ri.baseFov;
      camera.updateProjectionMatrix();
    }
  }

  if (ri.snap) {
    camTargetPos.copy(idealPos);
    camTargetLook.copy(idealLook);
    ri.snap = false;
  } else {
    const blend = ri.phase === 'preview' ? 0.1 : (ri.phase === 'lineup' ? 0.07 : 0.14);
    camTargetPos.lerp(idealPos, blend);
    camTargetLook.lerp(idealLook, blend + 0.02);
  }

  camera.position.copy(camTargetPos);
  camera.lookAt(camTargetLook);
  return true;
}
window.beginRaceIntro = beginRaceIntro;
window.clearRaceIntro = clearRaceIntro;
window.updateRaceIntro = updateRaceIntro;
window.raceIntroCamera = raceIntroCamera;

/** Online: end race UI and bring everyone back to the same room lobby (keep connections). */
function returnToOnlineLobby() {
  if (window.Net && Net.isOnline()) {
    Net.returnToLobby();
  } else {
    quitToMenu();
  }
}

function enterOnlineLobbyUI() {
  onlineMenuOpen = false;
  clearRaceIntro();
  gameState = 'menu';
  document.getElementById('hud').style.display = 'none';
  window.replaying = false;
  hideSpectateUI();
  const coinChip = document.getElementById('coinChip');
  if (coinChip) coinChip.classList.remove('in-race');
  if (window.clearAIRacers) window.clearAIRacers();
  if (window.clearNetRemotes) window.clearNetRemotes();
  if (window.clearHazards) window.clearHazards();
  if (window.suspendGameAudio) window.suspendGameAudio();
  if (window.Net && Net.markRaceEnded) Net.markRaceEnded();
  if (window.Net && Net.refreshLobbySettingsUI) Net.refreshLobbySettingsUI();
  navTo('menu-lobby');
}
window.enterOnlineLobbyUI = enterOnlineLobbyUI;
window.returnToOnlineLobby = returnToOnlineLobby;

function playCountdownBeep(count) {
  const vol = audioVol('sfx');
  if (vol <= 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'square';
    let freq = 880; 
    if (count === 3) freq = 440; else if (count === 2) freq = 554.37; else if (count === 1) freq = 659.25;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08 * vol, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}

function startCountdown() {
  clearRaceIntro();
  const ui = document.getElementById('countdownUI'); const txt = document.getElementById('countdownText');
  ui.style.display = 'flex'; let count = 3; txt.innerText = count; txt.style.color = 'var(--ember)';
  playCountdownBeep(count);
  const timer = setInterval(() => {
    if(gameState === 'paused' || gameState === 'menu' || gameState === 'intro') { clearInterval(timer); ui.style.display = 'none'; return; }
    count--;
    if (count > 0) { 
      txt.innerText = count; txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = 'pop 1s ease-out infinite'; 
      playCountdownBeep(count);
    } 
    else if (count === 0) { 
      txt.innerText = 'GO!'; txt.style.color = 'var(--teal)'; gameState = 'playing'; 
      playCountdownBeep(count);
    } 
    else { clearInterval(timer); ui.style.display = 'none'; txt.style.color = 'var(--ember)'; }
  }, 1000);
}

function hideSpectateUI() {
  const el = document.getElementById('spectateUI');
  if (el) el.style.display = 'none';
  window.spectate = { active: false, index: 0 };
}

function refreshSpectateTargets() {
  const targets = [];
  if (window.aiRacers) {
    window.aiRacers.forEach(ai => {
      if (ai.mesh && ai.mesh.visible && !ai.finished) {
        targets.push({ kind: 'ai', ref: ai, name: ai.name || 'RACER' });
      }
    });
  }
  if (window.netRemotes) {
    window.netRemotes.forEach(r => {
      if (r.mesh && r.mesh.visible && !r.finished) {
        targets.push({ kind: 'net', ref: r, name: r.name || 'RACER' });
      }
    });
  }
  // If everyone else finished, still allow watching finished remotes/AI for a moment
  if (targets.length === 0) {
    if (window.aiRacers) {
      window.aiRacers.forEach(ai => {
        if (ai.mesh && ai.mesh.visible) targets.push({ kind: 'ai', ref: ai, name: ai.name || 'RACER' });
      });
    }
    if (window.netRemotes) {
      window.netRemotes.forEach(r => {
        if (r.mesh && r.mesh.visible) targets.push({ kind: 'net', ref: r, name: r.name || 'RACER' });
      });
    }
  }
  return targets;
}

function getSpectateFollow() {
  if (!window.spectate || !window.spectate.active) return null;
  const targets = refreshSpectateTargets();
  if (!targets.length) return null;
  if (window.spectate.index >= targets.length) window.spectate.index = 0;
  const t = targets[window.spectate.index];
  const nameEl = document.getElementById('spectateTargetName');
  if (nameEl) nameEl.textContent = t.name;
  return t.ref;
}

function cycleSpectate(dir) {
  if (!window.spectate || !window.spectate.active) return;
  const targets = refreshSpectateTargets();
  if (!targets.length) return;
  window.spectate.index = (window.spectate.index + dir + targets.length) % targets.length;
  getSpectateFollow();
  playUIChime();
}

function enterSpectateMode() {
  gameState = 'spectating';
  window.spectate = { active: true, index: 0 };
  if (!window._firstFinishAt) window._firstFinishAt = performance.now();
  document.querySelectorAll('.menu-overlay').forEach(el => el.classList.remove('active'));
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = 'flex';
  const ui = document.getElementById('spectateUI');
  if (ui) ui.style.display = 'flex';
  const place = window.playerRacePlace || 1;
  const placeEl = document.getElementById('spectatePlace');
  if (placeEl) placeEl.textContent = place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : place + 'th';
  getSpectateFollow();
}

function countRaceEntrants() {
  if (gameMode === 'online' && window.Net && Net.isOnline()) {
    return Math.max(1, Net.getPlayers().length);
  }
  // Local vs AI
  return 1 + (window.aiRacers ? window.aiRacers.length : 0);
}

function countFinishedRacers() {
  let n = window.kart && window.kart.finished ? 1 : 0;
  if (gameMode === 'online') {
    if (window.netRemotes) {
      window.netRemotes.forEach(r => { if (r.finished) n++; });
    }
    // Remotes may not be spawned yet for disconnected — use Net remote states as backup
    if (window.Net) {
      const states = Net.getRemoteStates();
      let remoteFin = 0;
      states.forEach(st => { if (st.fin) remoteFin++; });
      n = (window.kart && window.kart.finished ? 1 : 0) + remoteFin;
    }
  } else if (window.aiRacers) {
    window.aiRacers.forEach(ai => { if (ai.finished) n++; });
  }
  return n;
}

function buildRaceStandings() {
  const rows = [];
  const localName = (window.Net && Net.isOnline())
    ? (Net.getPlayers().find(p => p.you)?.name || 'YOU')
    : (localStorage.getItem('kartPlayerName') || 'YOU');

  rows.push({
    name: localName,
    time: window.kart.finishTime,
    finished: !!window.kart.finished,
    you: true
  });

  if (gameMode === 'online' && window.Net) {
    const seen = new Set();
    if (window.netRemotes) {
      window.netRemotes.forEach(r => {
        seen.add(r.id);
        rows.push({
          name: r.name || 'RACER',
          time: r.finishTime,
          finished: !!r.finished,
          you: false
        });
      });
    }
    Net.getPlayers().filter(p => !p.you).forEach(p => {
      if (seen.has(p.id)) return;
      const st = Net.getRemoteStates().get(p.id);
      rows.push({
        name: p.name || 'RACER',
        time: st && st.ft != null ? st.ft : null,
        finished: !!(st && st.fin),
        you: false
      });
    });
  } else if (window.aiRacers) {
    window.aiRacers.forEach(ai => {
      rows.push({
        name: ai.name || 'AI',
        time: ai.finishTime,
        finished: !!ai.finished,
        you: false
      });
    });
  }

  rows.sort((a, b) => {
    if (a.finished && b.finished) return (a.time || 0) - (b.time || 0);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return 0;
  });
  return rows;
}

function showRaceResults() {
  if (window._resultsShown) return;
  window._resultsShown = true;
  hideSpectateUI();
  gameState = 'finished';
  if (window.muteEnginesNow) window.muteEnginesNow();
  if (window.playFinishFanfare) window.playFinishFanfare();

  const rows = buildRaceStandings();
  const list = document.getElementById('resultsList');
  if (list) {
    list.innerHTML = rows.map((r, i) => {
      const rank = i + 1;
      const ord = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : rank + 'th';
      const timeStr = r.finished && r.time != null ? formatTime(r.time) : 'DNF';
      const podium = rank <= 3 ? ' p' + rank : '';
      const you = r.you ? ' you' : '';
      return `<div class="results-row${podium}${you}" style="animation-delay:${i * 0.12}s">
        <div class="results-rank">${ord}</div>
        <div class="results-name">${r.name}${r.you ? ' (YOU)' : ''}</div>
        <div class="results-time">${timeStr}</div>
      </div>`;
    }).join('');
  }

  const sub = document.getElementById('resultsSubtitle');
  if (sub) {
    const youRow = rows.findIndex(r => r.you);
    sub.textContent = youRow >= 0
      ? (`You placed ${youRow === 0 ? '1st' : youRow === 1 ? '2nd' : youRow === 2 ? '3rd' : (youRow + 1) + 'th'}`)
      : 'Final standings';
  }

  const lobbyBtn = document.getElementById('resultsLobbyBtn');
  const menuBtn = document.getElementById('resultsMenuBtn');
  const againBtn = document.getElementById('resultsAgainBtn');
  if (lobbyBtn) lobbyBtn.style.display = gameMode === 'online' ? '' : 'none';
  if (menuBtn) menuBtn.style.display = gameMode === 'online' ? 'none' : '';
  if (againBtn) againBtn.style.display = gameMode === 'online' ? 'none' : '';

  document.getElementById('hud').style.display = 'none';
  setTimeout(() => navTo('menu-results'), 400);
}

function checkRaceComplete() {
  if (window._resultsShown) return;
  if (gameMode !== 'online' && gameMode !== 'multiplayer') return;
  if (gameState !== 'spectating' && gameState !== 'playing' && gameState !== 'finished') return;
  // Only evaluate once local player has finished (or everyone somehow done)
  if (!window.kart.finished && countFinishedRacers() < countRaceEntrants()) return;

  const entrants = countRaceEntrants();
  const finished = countFinishedRacers();
  const timedOut = window._firstFinishAt && (performance.now() - window._firstFinishAt > 90000);

  if (finished >= entrants || timedOut) {
    showRaceResults();
  }
}
window.checkRaceComplete = checkRaceComplete;
window.cycleSpectate = cycleSpectate;
window.getSpectateFollow = getSpectateFollow;

function triggerFinish() {
  if (window.kart.finished) return;
  window.kart.finished = true;
  window.kart.finishTime = raceTime;
  window.kart.speedForward = 0;
  window.kart.boostTimer = 0;
  if (window.kart.velocity) window.kart.velocity.set(0, 0, 0);

  // Multiplayer / online → spectate until everyone is done
  if (gameMode === 'online' || gameMode === 'multiplayer') {
    if (window.updateRacePlaces) window.updateRacePlaces();
    if (window.playFinishFanfare) window.playFinishFanfare();
    enterSpectateMode();
    checkRaceComplete();
    return;
  }

  gameState = 'finished';
  if (window.muteEnginesNow) window.muteEnginesNow();
  if (window.playFinishFanfare) window.playFinishFanfare();

  document.getElementById('finalTimeDisplay').innerText = formatTime(raceTime);
  let splitHTML = ""; lapSplits.forEach((s, idx) => { splitHTML += `LAP ${idx+1}: ${formatTime(s)}<br>`; });
  document.getElementById('splitTimesDisplay').innerHTML = splitHTML;

  const mapId = MAPS[activeMapIndex].id;
  const finishNote = document.getElementById('finishBestNote');
  const place = window.playerRacePlace || 1;

  const mainMenuBtn = document.getElementById('finishMainMenuBtn');
  const raceAgainBtn = document.getElementById('finishRaceAgainBtn');
  if (mainMenuBtn) mainMenuBtn.style.display = '';
  if (raceAgainBtn) raceAgainBtn.style.display = '';
  
  if (gameMode === 'timed') {
    if (!bestTime || raceTime < bestTime) {
      bestTime = raceTime; localStorage.setItem(`kartBest_${mapId}_${maxLaps}`, bestTime);
      localStorage.setItem(`kartGhost_${mapId}_${maxLaps}`, JSON.stringify(currentRunGhostData));
      ghostData = currentRunGhostData; finishNote.innerText = "NEW BEST TIME!";
    } else { finishNote.innerText = ""; }
    if (window.Leaderboards && !window.raceTainted) {
      const lbNote = document.getElementById('finishLeaderboardNote');
      if (lbNote) lbNote.textContent = 'Saving…';
      Promise.resolve(window.Leaderboards.submit(mapId, maxLaps, raceTime)).then(rank => {
        if (!lbNote) return;
        if (rank) {
          const signed = window.Account && Account.isSignedIn && Account.isSignedIn();
          lbNote.textContent = signed ? `Global #${rank}` : `Local #${rank} · sign in to go global`;
        } else {
          lbNote.textContent = (window.Account && Account.isSignedIn && Account.isSignedIn())
            ? ''
            : 'Sign in on Account to post global times';
        }
      }).catch(() => {
        if (lbNote) lbNote.textContent = '';
      });
    } else {
      const lbNote = document.getElementById('finishLeaderboardNote');
      if (lbNote) lbNote.textContent = '';
    }
  } else {
    finishNote.innerText = "RACE OVER";
    const lbNote = document.getElementById('finishLeaderboardNote');
    if (lbNote) lbNote.textContent = '';
  }
  
  if (window.onRaceFinish) window.onRaceFinish({
    mapId, time: raceTime, laps: maxLaps, mode: gameMode,
    tainted: !!window.raceTainted, place
  });

  if (window.replayBuffer && window.replayBuffer.length > 10) {
    window.replaying = true;
    let ri = 0;
    const frames = window.replayBuffer.slice();
    const iv = setInterval(() => {
      if (!window.replaying || ri >= frames.length) {
        clearInterval(iv); window.replaying = false;
        return;
      }
      const f = frames[ri++];
      if (window.kart && f) {
        window.kart.pos.set(f.x, f.y, f.z);
        window.kart.heading = f.h;
        window.kart.hopOffset = f.ho || 0;
      }
    }, 100);
    setTimeout(() => { window.replaying = false; }, 5200);
  }
  
  setTimeout(() => { if (gameState === 'finished') navTo('menu-finish'); }, 1600); 
}


function showCheatNote() { window.raceTainted = true; const note = document.getElementById('cheatNote'); note.style.opacity = 1; setTimeout(() => { note.style.opacity = 0; }, 2500); }

// ---------- Input System ----------
const inputState = { accel: false, brake: false, left: false, right: false, drift: false };
let awaitingBind = null;

function listenForBind(action) { 
  awaitingBind = action; document.getElementById('bindWarningText').innerText = "";
  document.querySelectorAll('.keybind-btn').forEach(btn => { btn.classList.remove('waiting'); btn.classList.remove('conflict'); });
  const btn = document.getElementById(`bind-${action}`); btn.classList.add('waiting'); btn.innerText = 'PRESS KEY'; 
}

function toggleSetting(key, val) { 
  settings[key] = val; saveConfig(); 
  if(key==='sound' && val && window.initAudio) window.initAudio();
  if(key==='night' && window.applyLightingMode) window.applyLightingMode(val);
  
  if(key==='night') {
    const n1 = document.getElementById('setup-night'); if(n1) n1.checked = val;
    const n2 = document.getElementById('setup-night-free'); if(n2) n2.checked = val;
    const n3 = document.getElementById('setup-night-host'); if(n3) n3.checked = val;
    const n4 = document.getElementById('setup-night-lobby'); if(n4) n4.checked = val;
    refreshTTOptionsSummary();
  }
  if(key==='ghost') refreshTTOptionsSummary();
  if(key==='items') {
    const i1 = document.getElementById('setup-items'); if(i1) i1.checked = val;
  }
}

window.addEventListener('keydown', (e) => {
  const keyMap = e.key.toLowerCase();
  
  if (awaitingBind) {
    e.preventDefault(); const currentAction = awaitingBind; const warnEl = document.getElementById('bindWarningText');
    if (keyMap === 'escape') { document.getElementById(`bind-${currentAction}`).innerText = formatKey(settings.keys[currentAction]); document.getElementById(`bind-${currentAction}`).classList.remove('waiting'); awaitingBind = null; warnEl.innerText = ""; return; }
    const conflictingAction = Object.keys(settings.keys).find(act => act !== currentAction && settings.keys[act] === keyMap);
    if (conflictingAction) {
      playWarningBuzz(); warnEl.innerText = `KEY "${formatKey(keyMap)}" ALREADY BOUND TO ${conflictingAction.toUpperCase()}!`;
      const conflictBtn = document.getElementById(`bind-${conflictingAction}`); if (conflictBtn) { conflictBtn.classList.add('conflict'); setTimeout(() => conflictBtn.classList.remove('conflict'), 1200); } return;
    }
    settings.keys[currentAction] = keyMap; document.getElementById(`bind-${currentAction}`).innerText = formatKey(keyMap); document.getElementById(`bind-${currentAction}`).classList.remove('waiting'); awaitingBind = null; warnEl.innerText = ""; saveConfig(); refreshKeybindUI(); playUIChime(); return;
  }

  if (keyMap === 'escape') {
    if (gameMode === 'online') {
      if (onlineMenuOpen) {
        // If settings is open, go back to race menu; else close overlay
        const settingsOpen = document.getElementById('menu-settings')?.classList.contains('active');
        if (settingsOpen) closeSettings();
        else closeOnlineMenu();
      } else if (gameState === 'playing' || gameState === 'countdown' || gameState === 'spectating') {
        openOnlineMenu();
      }
      return;
    }
    if (gameState === 'playing' || gameState === 'countdown' || gameState === 'spectating' || gameState === 'intro') pauseGame();
    else if (gameState === 'paused') resumeGame();
    return;
  }
  if (gameMode === 'online' && onlineMenuOpen) return;
  if (gameState === 'spectating' && (keyMap === 'q' || keyMap === 'e')) {
    cycleSpectate(keyMap === 'e' ? 1 : -1);
    return;
  }
  if (keyMap === settings.keys.restart && (gameState === 'playing' || gameState === 'paused')) {
    if (gameMode === 'online') return;
    restartRace();
    return;
  }
  if (keyMap === settings.keys.cam) { window.cameraView = window.cameraView === 'fpv' ? 'chase' : 'fpv'; return; }
  if (keyMap === settings.keys.rear) { window.lookBehind = true; return; }
  if (keyMap === settings.keys.item && gameState === 'playing' && window.kart.item) {
    if (window.usePlayerItem) window.usePlayerItem();
  }

  if (gameState !== 'playing' && gameState !== 'countdown') return;
  if (keyMap === settings.keys.accel) inputState.accel = true; 
  if (keyMap === settings.keys.brake) inputState.brake = true;
  if (keyMap === settings.keys.left) inputState.left = true; 
  if (keyMap === settings.keys.right) inputState.right = true;
  if (keyMap === settings.keys.drift) { inputState.drift = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
  const keyMap = e.key.toLowerCase();
  if (keyMap === settings.keys.rear) { window.lookBehind = false; return; }
  if (keyMap === settings.keys.accel) inputState.accel = false; 
  if (keyMap === settings.keys.brake) inputState.brake = false;
  if (keyMap === settings.keys.left) inputState.left = false; 
  if (keyMap === settings.keys.right) inputState.right = false;
  if (keyMap === settings.keys.drift) { inputState.drift = false; e.preventDefault(); }
});

// ---------- Main Execution (IIFE) ----------
(function() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e0f12); scene.fog = new THREE.Fog(0x0e0f12, 60, 1000);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
  window.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  window.renderer.setSize(window.innerWidth, window.innerHeight); 
  window.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
  window.renderer.shadowMap.enabled = true;
  document.getElementById('stage').appendChild(window.renderer.domElement);

  const hemi = new THREE.HemisphereLight(0x8899bb, 0x141414, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(40, 60, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -300; sun.shadow.camera.right = 300; sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
  scene.add(sun);

  const headlight = new THREE.SpotLight(0xffffff, 0, 80, Math.PI / 4, 0.5, 2);
  headlight.position.set(0, 1, 1); headlight.target.position.set(0, 0, 5);
  scene.add(headlight); scene.add(headlight.target);
  
  window.raycaster = new THREE.Raycaster();

  window.applyLightingMode = function(isNight) {
    if (isNight) {
      scene.background.set(0x020305); scene.fog.color.set(0x020305);
      hemi.intensity = 0.1; sun.intensity = 0.05; headlight.intensity = 3.5;
    } else {
      scene.background.set(0x0e0f12); scene.fog.color.set(0x0e0f12);
      hemi.intensity = 0.9; sun.intensity = 1.1; headlight.intensity = 0;
    }
    window.applyWeatherEffects();
  };

  let rainParticles = null;
  window.applyWeatherEffects = function() {
    const w = window.RaceKit ? window.RaceKit.getWeather(settings.weather || 'clear') : { fogNear: 60, fogFar: 450, rain: false, gripMult: 1, speedMult: 1 };
    scene.fog.near = settings.night ? Math.min(40, w.fogNear) : w.fogNear;
    scene.fog.far = settings.night ? Math.min(180, w.fogFar) : w.fogFar;
    if (w.rain) {
      if (!rainParticles) {
        const geo = new THREE.BufferGeometry();
        const count = 1200;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          pos[i*3] = (Math.random()-0.5)*120;
          pos[i*3+1] = Math.random()*40;
          pos[i*3+2] = (Math.random()-0.5)*120;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        rainParticles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x88aacc, size: 0.15, transparent: true, opacity: 0.55 }));
        scene.add(rainParticles);
      }
      rainParticles.visible = true;
    } else if (rainParticles) {
      rainParticles.visible = false;
    }
    window._weatherMods = w;
  };

  function updateRain(dt) {
    if (!rainParticles || !rainParticles.visible || !window.kart) return;
    const arr = rainParticles.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i+1] -= 28 * dt;
      if (arr[i+1] < 0) {
        arr[i] = window.kart.pos.x + (Math.random()-0.5)*100;
        arr[i+1] = 25 + Math.random()*20;
        arr[i+2] = window.kart.pos.z + (Math.random()-0.5)*100;
      }
    }
    rainParticles.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- Audio Subsystem ----------
  let audioCtx, masterCompressor, engineOsc, engineFilter, engineGain, skidNoise, skidGain;
  let ghostOsc, ghostFilter, ghostGain, ghostPanner;

  window.suspendGameAudio = function() { if (audioCtx && audioCtx.state === 'running') audioCtx.suspend(); };
  window.resumeGameAudio = function() { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); };
  window.muteEnginesNow = function() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    try {
      engineGain.gain.cancelScheduledValues(t);
      engineGain.gain.setValueAtTime(0, t);
      skidGain.gain.cancelScheduledValues(t);
      skidGain.gain.setValueAtTime(0, t);
      if (ghostGain) { ghostGain.gain.cancelScheduledValues(t); ghostGain.gain.setValueAtTime(0, t); }
      if (window._engineLayer2) {
        window._engineLayer2.gain.gain.cancelScheduledValues(t);
        window._engineLayer2.gain.gain.setValueAtTime(0, t);
      }
      if (crowdGain) { crowdGain.gain.cancelScheduledValues(t); crowdGain.gain.setValueAtTime(0, t); }
    } catch (e) {}
  };

  window.initAudio = function() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    masterCompressor = audioCtx.createDynamicsCompressor();
    masterCompressor.threshold.value = -14; masterCompressor.knee.value = 10;
    masterCompressor.ratio.value = 4; masterCompressor.attack.value = 0.005; masterCompressor.release.value = 0.25;
    masterCompressor.connect(audioCtx.destination);
    
    engineOsc = audioCtx.createOscillator(); engineOsc.type = 'triangle'; 
    engineFilter = audioCtx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 200; 
    engineGain = audioCtx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(masterCompressor); engineOsc.start();
    
    const bufSize = audioCtx.sampleRate * 2; const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const output = buf.getChannelData(0); for (let i = 0; i < bufSize; i++) output[i] = Math.random() * 2 - 1;
    skidNoise = audioCtx.createBufferSource(); skidNoise.buffer = buf; skidNoise.loop = true;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1200;
    skidGain = audioCtx.createGain(); skidGain.gain.value = 0;
    skidNoise.connect(filter).connect(skidGain).connect(masterCompressor); skidNoise.start();

    ghostOsc = audioCtx.createOscillator(); ghostOsc.type = 'triangle';
    ghostFilter = audioCtx.createBiquadFilter(); ghostFilter.type = 'lowpass'; ghostFilter.frequency.value = 200;
    ghostGain = audioCtx.createGain(); ghostGain.gain.value = 0;
    ghostPanner = audioCtx.createPanner(); ghostPanner.panningModel = 'HRTF'; ghostPanner.distanceModel = 'inverse';
    ghostPanner.refDistance = 5; ghostPanner.maxDistance = 100;
    ghostOsc.connect(ghostFilter).connect(ghostGain).connect(ghostPanner).connect(masterCompressor);
    ghostOsc.start();
  };

  let engineOsc2, crowdGain, crowdNoise;
  const _oldInit = window.initAudio;
  window.initAudio = function() {
    const existed = !!audioCtx;
    _oldInit();
    if (existed || !audioCtx) return;
    engineOsc2 = audioCtx.createOscillator(); engineOsc2.type = 'sawtooth';
    const f2 = audioCtx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 400;
    const g2 = audioCtx.createGain(); g2.gain.value = 0;
    engineOsc2.connect(f2).connect(g2).connect(masterCompressor); engineOsc2.start();
    window._engineLayer2 = { osc: engineOsc2, filter: f2, gain: g2 };

    const cbuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const cd = cbuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random()*2-1) * 0.4;
    crowdNoise = audioCtx.createBufferSource(); crowdNoise.buffer = cbuf; crowdNoise.loop = true;
    const cf = audioCtx.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 600;
    crowdGain = audioCtx.createGain(); crowdGain.gain.value = 0;
    crowdNoise.connect(cf).connect(crowdGain).connect(masterCompressor); crowdNoise.start();
  };

  window.playBoostWhoosh = function() {
    const vol = audioVol('sfx');
    if (vol <= 0) return;
    try {
      const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.35);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t+0.28);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * vol, t+0.04); g.gain.exponentialRampToValueAtTime(0.001, t+0.35);
      src.connect(bp).connect(g).connect(ctx.destination); src.start(t);
    } catch(e) {}
  };

  window.playFinishFanfare = function() {
    const vol = audioVol('sfx');
    if (vol <= 0) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        const st = ctx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0.001, st); g.gain.exponentialRampToValueAtTime(0.1 * vol, st+0.03);
        g.gain.exponentialRampToValueAtTime(0.001, st+0.4);
        o.connect(g).connect(ctx.destination); o.start(st); o.stop(st+0.45);
      });
    } catch(e) {}
  };

  function updateAudio(dt, ghostSpeed) {
    if (!settings.sound || !audioCtx) return;
    const isActive = (gameState === 'playing' || gameState === 'countdown' || gameState === 'spectating' || gameState === 'intro');
    const speedRatio = isActive ? (Math.abs(window.kart.speedForward) / window.kart.maxSpeed) : 0;
    const engV = audioVol('engine');
    const skidV = audioVol('skid');
    const ambV = audioVol('ambience');
    // Engine base lowered 30% vs original (×0.7), then category/master sliders
    const engScale = 0.7 * engV;
    engineOsc.frequency.setTargetAtTime(30 + speedRatio * 80, audioCtx.currentTime, 0.1);
    engineFilter.frequency.setTargetAtTime(150 + speedRatio * 250, audioCtx.currentTime, 0.1);
    if (window._engineLayer2) {
      window._engineLayer2.osc.frequency.setTargetAtTime(55 + speedRatio * 110, audioCtx.currentTime, 0.1);
      const boost = (isActive && window.kart.boostTimer > 0) ? 0.04 : 0.015;
      window._engineLayer2.gain.gain.setTargetAtTime(isActive ? boost * speedRatio * engScale : 0, audioCtx.currentTime, 0.08);
    }
    if (crowdGain) {
      const wantCrowd = (gameMode === 'multiplayer' || gameMode === 'online') && gameState === 'playing';
      crowdGain.gain.setTargetAtTime(wantCrowd ? 0.025 * ambV : 0, audioCtx.currentTime, 0.3);
    }
    
    engineGain.gain.setTargetAtTime(isActive ? (0.015 + speedRatio * 0.035) * engScale : 0, audioCtx.currentTime, 0.08);
    skidGain.gain.setTargetAtTime((gameState === 'playing' && window.kart.isDrifting && window.kart.grounded) ? 0.1 * skidV : 0, audioCtx.currentTime, 0.05);

    const t = audioCtx.currentTime + 0.1;
    if (audioCtx.listener.positionX) {
      audioCtx.listener.positionX.linearRampToValueAtTime(camera.position.x, t);
      audioCtx.listener.positionY.linearRampToValueAtTime(camera.position.y, t);
      audioCtx.listener.positionZ.linearRampToValueAtTime(camera.position.z, t);
      const fw = new THREE.Vector3(); camera.getWorldDirection(fw);
      audioCtx.listener.forwardX.linearRampToValueAtTime(fw.x, t);
      audioCtx.listener.forwardY.linearRampToValueAtTime(fw.y, t);
      audioCtx.listener.forwardZ.linearRampToValueAtTime(fw.z, t);
    } else if (audioCtx.listener.setPosition) {
      audioCtx.listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
      const fw = new THREE.Vector3(); camera.getWorldDirection(fw);
      audioCtx.listener.setOrientation(fw.x, fw.y, fw.z, 0, 1, 0);
    }

    if (ghostGroup && ghostGroup.visible && isActive && settings.ghost) {
      if (ghostPanner.positionX) {
        ghostPanner.positionX.linearRampToValueAtTime(ghostGroup.position.x, t);
        ghostPanner.positionY.linearRampToValueAtTime(ghostGroup.position.y, t);
        ghostPanner.positionZ.linearRampToValueAtTime(ghostGroup.position.z, t);
      } else if (ghostPanner.setPosition) {
        ghostPanner.setPosition(ghostGroup.position.x, ghostGroup.position.y, ghostGroup.position.z);
      }
      const gSpeedRatio = Math.abs(ghostSpeed || 0) / window.kart.maxSpeed;
      ghostOsc.frequency.setTargetAtTime(30 + gSpeedRatio * 80, t, 0.1);
      ghostFilter.frequency.setTargetAtTime(150 + gSpeedRatio * 250, t, 0.1);
      ghostGain.gain.setTargetAtTime((0.01 + gSpeedRatio * 0.02) * engScale, t, 0.1);
    } else {
      ghostGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    }
  }

  // ---------- Dynamic Track Generation (FLAT BANKING) ----------
  const trackGroup = new THREE.Group(); scene.add(trackGroup);
  const TRACK_WIDTH = 32; 
  window.pts = []; window.wallPosts = []; window.boostPads = []; window.itemBoxes = [];
  let trackMesh, startLineGroup, instancedTrees;
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(3500, 3500), new THREE.MeshStandardMaterial({ color: 0x1c3325, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.02; grass.receiveShadow = true; scene.add(grass);

  window.buildTrack = function(curvePointsRaw, spawnItems = false) {
    trackGroup.clear(); window.wallPosts = []; window.boostPads = []; window.itemBoxes = [];
    if(instancedTrees) { scene.remove(instancedTrees); }

    const trackCurve = new THREE.CatmullRomCurve3(curvePointsRaw, true, 'centripetal', 0.5);
    const trackSegments = 1500; 
    window.pts = trackCurve.getPoints(trackSegments);
    
    // FIX: Force all generated nodes to stay at or above Y = 0 to prevent underground spline dipping
    window.pts.forEach(p => { if (p.y < 0) p.y = 0; });
    
    const positions = []; const indices = []; 
    
    for (let i = 0; i < window.pts.length; i++) {
      const pt = window.pts[i]; 
      const tangent = trackCurve.getTangent(i / (window.pts.length - 1));
      
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      
      const pLeft = pt.clone().add(right.clone().multiplyScalar(TRACK_WIDTH/2));
      const pRight = pt.clone().add(right.clone().multiplyScalar(-TRACK_WIDTH/2));
      positions.push(pLeft.x, pLeft.y, pLeft.z); positions.push(pRight.x, pRight.y, pRight.z);
      
      if (i < window.pts.length - 1) { 
        const row = i * 2; 
        indices.push(row, row + 1, row + 2); 
        indices.push(row + 1, row + 3, row + 2); 
      }
    }

    const trackGeo = new THREE.BufferGeometry(); 
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); 
    trackGeo.setIndex(indices); 
    trackGeo.computeVertexNormals();
    trackGeo.computeBoundingBox();
    trackGeo.computeBoundingSphere();
    trackMesh = new THREE.Mesh(trackGeo, new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.9, side: THREE.DoubleSide }));
    trackMesh.frustumCulled = false;
    trackMesh.receiveShadow = true; trackGroup.add(trackMesh);
    window.trackMesh = trackMesh;

    window.trackStartPos = window.pts[0]; 
    window.trackTangent = trackCurve.getTangent(0);
    window.trackStartHeading = Math.atan2(window.trackTangent.x, window.trackTangent.z);
    window.checkpoints = [ Math.floor(trackSegments * 0.25), Math.floor(trackSegments * 0.50), Math.floor(trackSegments * 0.75) ];

    startLineGroup = new THREE.Group();
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 14; col++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH/14, 1.5), new THREE.MeshBasicMaterial({ color: (row+col)%2===0 ? 0x111111 : 0xeeeeee, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set((col - 7 + 0.5) * (TRACK_WIDTH/14), 0.1, (row - 0.5) * 1.5); startLineGroup.add(m);
      }
    }
    startLineGroup.position.set(window.trackStartPos.x, window.trackStartPos.y + 0.05, window.trackStartPos.z); 
    
    const flatTangent = new THREE.Vector3(window.trackTangent.x, 0, window.trackTangent.z).normalize();
    startLineGroup.lookAt(window.trackStartPos.clone().add(flatTangent));
    trackGroup.add(startLineGroup);

    const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8b23d, emissive: 0xa8721d, emissiveIntensity: 1.5 });
    for (let i = 15; i < window.pts.length - 1; i += 8) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(window.pts[i].distanceTo(window.pts[i+1]) * 3, 0.04, 0.5), dashMat);
      dash.position.copy(window.pts[i]).lerp(window.pts[i+1], 0.5); 
      dash.position.y += 0.02; 
      dash.lookAt(window.pts[i+1]); 
      trackGroup.add(dash);
    }

    for (let i = 0; i < window.pts.length - 1; i += 18) {
      const pt = window.pts[i]; 
      const tangent = trackCurve.getTangent(i / (window.pts.length - 1));
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      [-1, 1].forEach(side => {
        const pSide = pt.clone().add(right.clone().multiplyScalar(side * (TRACK_WIDTH/2 - 0.5)));
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: (i/18) % 2 === 0 ? 0xff5f3d : 0xf2f0e9 }));
        post.position.set(pSide.x, pt.y + 0.6, pSide.z); post.castShadow = true; trackGroup.add(post);
        window.wallPosts.push({ x: pSide.x, y: pt.y, z: pSide.z });
      });
    }

    const padGeo = new THREE.BoxGeometry(TRACK_WIDTH, 0.04, 5);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x37c6b0, emissiveIntensity: 2.0 });
    
    const padIndices = [Math.floor(trackSegments * 0.15), Math.floor(trackSegments * 0.45), Math.floor(trackSegments * 0.85)];
    padIndices.forEach(idx => {
      const pt = window.pts[idx]; 
      const tangent = trackCurve.getTangent(idx / (window.pts.length - 1));
      const pad = new THREE.Mesh(padGeo, padMat); 
      pad.position.copy(pt); pad.position.y += 0.015; 
      pad.lookAt(pt.clone().add(tangent));
      trackGroup.add(pad); window.boostPads.push({ x: pt.x, y: pt.y, z: pt.z, r: 10 });
    });

    // Shortcut boost pads (inner line) when map defines shortcuts
    const mapDef = MAPS[activeMapIndex];
    if (mapDef && mapDef.shortcuts) {
      const shortMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffae00, emissiveIntensity: 2.2 });
      mapDef.shortcuts.forEach(frac => {
        const idx = Math.floor(trackSegments * frac);
        const pt = window.pts[idx];
        const tangent = trackCurve.getTangent(idx / (window.pts.length - 1));
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const shortPt = pt.clone().add(right.multiplyScalar(TRACK_WIDTH * 0.28));
        const pad = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH * 0.35, 0.05, 4), shortMat);
        pad.position.copy(shortPt); pad.position.y += 0.02;
        pad.lookAt(shortPt.clone().add(tangent));
        trackGroup.add(pad);
        window.boostPads.push({ x: shortPt.x, y: shortPt.y, z: shortPt.z, r: 7, shortcut: true });
      });
    }
    // Also give Neon/Tiburtina mild shortcut pads
    if (!mapDef.shortcuts) {
      const shortMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffae00, emissiveIntensity: 1.8 });
      [0.38, 0.72].forEach(frac => {
        const idx = Math.floor(trackSegments * frac);
        const pt = window.pts[idx];
        const tangent = trackCurve.getTangent(idx / (window.pts.length - 1));
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        const shortPt = pt.clone().add(right.multiplyScalar(TRACK_WIDTH * 0.3));
        const pad = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH * 0.3, 0.05, 3.5), shortMat);
        pad.position.copy(shortPt); pad.position.y += 0.02;
        pad.lookAt(shortPt.clone().add(tangent));
        trackGroup.add(pad);
        window.boostPads.push({ x: shortPt.x, y: shortPt.y, z: shortPt.z, r: 6, shortcut: true });
      });
    }

    if (spawnItems) {
      const itemIndices = [Math.floor(trackSegments * 0.22), Math.floor(trackSegments * 0.48), Math.floor(trackSegments * 0.72)];
      const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa500, transparent: true, opacity: 0.85 });
      
      itemIndices.forEach(idx => {
        const pt = window.pts[idx]; 
        const tangent = trackCurve.getTangent(idx / (window.pts.length - 1));
        const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
        [-0.6, 0, 0.6].forEach(offset => {
          const spawnPt = pt.clone().add(right.clone().multiplyScalar(offset * (TRACK_WIDTH/2 - 2)));
          const box = new THREE.Mesh(boxGeo, boxMat);
          box.position.set(spawnPt.x, pt.y + 1.5, spawnPt.z);
          trackGroup.add(box);
          window.itemBoxes.push({ mesh: box, pos: box.position, active: true, respawnTimer: 0 });
        });
      });
    }

    const treeGeo = new THREE.ConeGeometry(3, 8, 4); treeGeo.translate(0, 4, 0);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x183320, roughness: 1.0 });
    instancedTrees = new THREE.InstancedMesh(treeGeo, treeMat, 600);
    instancedTrees.castShadow = true; instancedTrees.receiveShadow = true;
    const dummy = new THREE.Object3D(); let treeCount = 0;
    for(let i=0; i<3000; i++) {
       const tx = (Math.random()-0.5)*1200; const tz = (Math.random()-0.5)*1200;
       let tooClose = false;
       for(let p of window.pts) { if(p.distanceToSquared(new THREE.Vector3(tx,0,tz)) < (TRACK_WIDTH/2 + 6)**2) { tooClose=true; break; } }
       if(!tooClose) {
           dummy.position.set(tx, 0, tz); dummy.rotation.y = Math.random() * Math.PI;
           dummy.scale.setScalar(0.8 + Math.random()*0.6); dummy.updateMatrix();
           instancedTrees.setMatrixAt(treeCount, dummy.matrix); treeCount++;
           if(treeCount >= 600) break;
       }
    }
    scene.add(instancedTrees);
  };

  // ---------- Render Target Skid Marks ----------
  const skidSize = 1400;
  window.skidTarget = new THREE.WebGLRenderTarget(2048, 2048, { format: THREE.RGBAFormat, transparent: true });
  const skidCam = new THREE.OrthographicCamera(-skidSize/2, skidSize/2, skidSize/2, -skidSize/2, 0, 10);
  skidCam.position.set(0, 5, 0); skidCam.lookAt(0,0,0);
  const skidScene = new THREE.Scene();

  const brushMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.15, depthWrite: false }));
  brushMesh.rotation.x = -Math.PI / 2; skidScene.add(brushMesh);

  const skidDisplay = new THREE.Mesh(new THREE.PlaneGeometry(skidSize, skidSize), new THREE.MeshBasicMaterial({ map: window.skidTarget.texture, transparent: true, depthWrite: false }));
  skidDisplay.rotation.x = -Math.PI / 2; skidDisplay.position.y = 0.002; scene.add(skidDisplay);

  function drawSkid(pos, heading) {
    brushMesh.position.set(pos.x, 0, pos.z);
    brushMesh.rotation.z = -heading;
    const autoClearCache = window.renderer.autoClear;
    window.renderer.autoClear = false;
    window.renderer.setRenderTarget(window.skidTarget);
    window.renderer.render(skidScene, skidCam);
    window.renderer.setRenderTarget(null);
    window.renderer.autoClear = autoClearCache;
  }

  // ---------- Particles ----------
  const sparks = [];
  const sparkMatBlue = new THREE.MeshStandardMaterial({ color: 0x4d9dff, emissive: 0x4d9dff, emissiveIntensity: 4, transparent: true });
  const sparkMatOrange = new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xffa500, emissiveIntensity: 4, transparent: true });
  const sparkMatPurple = new THREE.MeshStandardMaterial({ color: 0x9400d3, emissive: 0x9400d3, emissiveIntensity: 4, transparent: true });

  for (let i = 0; i < 30; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), sparkMatBlue.clone()); s.visible = false; scene.add(s); sparks.push({ mesh: s, life: 0, vel: new THREE.Vector3() });
  }
  let sparkCursor = 0;
  function emitSpark(pos, tier) {
    const s = sparks[sparkCursor]; sparkCursor = (sparkCursor + 1) % sparks.length;
    s.mesh.position.copy(pos); 
    s.mesh.position.y = window.kart.pos.y + window.kart.hopOffset + 0.15;
    
    let mat = sparkMatBlue;
    if (tier === 2) mat = sparkMatOrange;
    if (tier >= 3) mat = sparkMatPurple;
    s.mesh.material = mat;

    s.mesh.material.opacity = 1; s.mesh.visible = true; s.life = 0.4;
    s.vel.set((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5);
  }

  // --- Exhaust Flames + boost sparks ---
  const exhaustParticles = [];
  const exhaustFlameGeo = new THREE.ConeGeometry(0.22, 0.55, 6);
  exhaustFlameGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 64; i++) {
    const p = new THREE.Mesh(exhaustFlameGeo, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    p.visible = false; scene.add(p);
    exhaustParticles.push({ mesh: p, life: 0, maxLife: 0.25, vel: new THREE.Vector3(), kind: 'flame' });
  }
  const boostSparkParticles = [];
  const boostSparkGeo = new THREE.SphereGeometry(0.06, 5, 5);
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Mesh(boostSparkGeo, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    p.visible = false; scene.add(p);
    boostSparkParticles.push({ mesh: p, life: 0, maxLife: 0.35, vel: new THREE.Vector3() });
  }
  const mythicTrailParticles = [];
  const mythicTrailGeo = new THREE.SphereGeometry(0.12, 6, 6);
  for (let i = 0; i < 48; i++) {
    const p = new THREE.Mesh(mythicTrailGeo, new THREE.MeshBasicMaterial({
      color: 0xff3d7a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    p.visible = false; scene.add(p);
    mythicTrailParticles.push({ mesh: p, life: 0, maxLife: 0.55, vel: new THREE.Vector3() });
  }
  let exhaustCursor = 0, boostSparkCursor = 0, mythicTrailCursor = 0;
  
  function emitExhaust(pos, heading, tier) {
    const p = exhaustParticles[exhaustCursor]; exhaustCursor = (exhaustCursor + 1) % exhaustParticles.length;
    p.mesh.position.copy(pos);
    p.mesh.lookAt(pos.x - Math.sin(heading), pos.y, pos.z - Math.cos(heading));
    
    let hexColor = 0xffdd00;
    if (tier === 2) hexColor = 0xff5f3d;
    if (tier >= 3) hexColor = 0x37e6c8;
    p.mesh.material.color.setHex(hexColor);
    
    const s = 0.85 + Math.random() * 0.5 + tier * 0.12;
    p.mesh.scale.set(s * 0.7, s * 0.7, s * (1.2 + tier * 0.25));
    p.mesh.material.opacity = 1; p.mesh.visible = true;
    p.life = 0.18 + Math.random() * 0.12 + tier * 0.03; p.maxLife = p.life;
    
    const fw = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    p.vel.set(-fw.x * (14 + tier * 2) + (Math.random() - 0.5) * 5, 1.5 + Math.random() * 4, -fw.z * (14 + tier * 2) + (Math.random() - 0.5) * 5);

    // Ember sparks spit out with the flame
    if (Math.random() < 0.55) {
      const sp = boostSparkParticles[boostSparkCursor];
      boostSparkCursor = (boostSparkCursor + 1) % boostSparkParticles.length;
      sp.mesh.position.copy(pos);
      sp.mesh.material.color.setHex(tier >= 3 ? 0xaefcff : (tier === 2 ? 0xffae00 : 0xffee88));
      sp.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      sp.mesh.material.opacity = 1; sp.mesh.visible = true;
      sp.life = 0.25 + Math.random() * 0.2; sp.maxLife = sp.life;
      sp.vel.set(-fw.x * 8 + (Math.random() - 0.5) * 10, 2 + Math.random() * 8, -fw.z * 8 + (Math.random() - 0.5) * 10);
    }
  }

  function emitMythicTrail(pos, heading) {
    const p = mythicTrailParticles[mythicTrailCursor];
    mythicTrailCursor = (mythicTrailCursor + 1) % mythicTrailParticles.length;
    p.mesh.position.copy(pos);
    p.mesh.position.x += (Math.random() - 0.5) * 0.6;
    p.mesh.position.y += Math.random() * 0.4;
    p.mesh.position.z += (Math.random() - 0.5) * 0.6;
    const hueShift = Math.random();
    p.mesh.material.color.setRGB(1, 0.15 + hueShift * 0.35, 0.45 + hueShift * 0.4);
    p.mesh.scale.setScalar(0.8 + Math.random() * 1.1);
    p.mesh.material.opacity = 0.85; p.mesh.visible = true;
    p.life = 0.4 + Math.random() * 0.25; p.maxLife = p.life;
    const fw = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    p.vel.set(-fw.x * 2 + (Math.random() - 0.5) * 1.5, 0.5 + Math.random(), -fw.z * 2 + (Math.random() - 0.5) * 1.5);
  }

  // ---------- Post-Processing Bloom ----------
  const composer = new THREE.EffectComposer(window.renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85);
  bloomPass.threshold = 0.95; 
  bloomPass.strength = 1.0;
  composer.addPass(bloomPass);
  window.addEventListener('resize', () => { composer.setSize(window.innerWidth, window.innerHeight); });

  // ---------- Kart Models & Dynamic Customization ----------
  const kartGroup = new THREE.Group();

  // Racing chassis: side-silhouette extrude (wedge nose built in — not a bolted cone)
  function createRacingChassisGeometry() {
    const s = new THREE.Shape();
    // x = length (rear -, front +), y = height
    s.moveTo(-1.42, 0.06);
    s.lineTo(1.05, 0.06);
    s.lineTo(1.48, 0.16);                         // sharp front tip
    s.quadraticCurveTo(1.15, 0.46, 0.55, 0.5);     // hood slope
    s.lineTo(0.22, 0.48);
    s.lineTo(0.02, 0.34);                         // cockpit lip
    s.lineTo(-0.5, 0.34);                         // open cockpit floor
    s.lineTo(-0.68, 0.56);                        // rear bulkhead
    s.lineTo(-1.2, 0.6);                          // engine cover
    s.lineTo(-1.42, 0.38);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 1.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 8
    });
    geo.translate(0, 0, -0.6);
    geo.rotateY(-Math.PI / 2); // width on X, length on Z
    return geo;
  }

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x228b7a, roughness: 0.4, metalness: 0.1, emissive: 0xffae00, emissiveIntensity: 0 });
  const body = new THREE.Group();
  const hull = new THREE.Mesh(createRacingChassisGeometry(), bodyMat);
  hull.castShadow = true; hull.receiveShadow = true; body.add(hull);

  // Sidepods — classic race-car flanks
  [-1, 1].forEach(side => {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.15, 10), bodyMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.72, 0.28, -0.15);
    pod.castShadow = true;
    body.add(pod);
  });

  // Front splitter
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.35), bodyMat);
  splitter.position.set(0, 0.1, 1.28);
  splitter.castShadow = true;
  body.add(splitter);

  body.position.y = 0.22;
  kartGroup.add(body);
  
  const cockpit = new THREE.Group();
  const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.55 });
  const cockpitPod = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.34, 8), cockpitMat);
  cockpitPod.position.set(0, 0.02, 0); cockpitPod.castShadow = true; cockpit.add(cockpitPod);
  const cockpitTrimMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.4, metalness: 0.3 });
  const cockpitTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 8), cockpitTrimMat);
  cockpitTrim.position.set(0, -0.16, 0); cockpit.add(cockpitTrim);
  const windshieldMat = new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.55 });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.32, 0.04), windshieldMat);
  windshield.position.set(0, 0.18, 0.38); windshield.rotation.x = -0.55; cockpit.add(windshield);
  cockpit.position.set(0, 0.78, -0.15); kartGroup.add(cockpit);

  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5 });
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.32), shoulderMat);
  shoulders.position.set(0, 0.93, -0.12); shoulders.castShadow = true; kartGroup.add(shoulders);
  
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wheels = [[-0.85, 0.35, 1.0], [0.85, 0.35, 1.0], [-0.85, 0.35, -1.0], [0.85, 0.35, -1.0]].map(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, y, z); w.castShadow = true; kartGroup.add(w); return w;
  });
  const hubcapMat = new THREE.MeshStandardMaterial({ color: 0xd7dadd, roughness: 0.3, metalness: 0.6 });
  wheels.forEach(w => {
    const capSign = w.position.x > 0 ? 1 : -1;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), hubcapMat);
    cap.rotation.z = Math.PI / 2; cap.position.set(w.position.x + capSign * 0.16, w.position.y, w.position.z);
    kartGroup.add(cap);
  });

  const exhaustPipeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), exhaustPipeMat);
  exhaustL.rotation.x = Math.PI / 2; exhaustL.position.set(-0.4, 0.3, -1.35); kartGroup.add(exhaustL);
  const exhaustR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), exhaustPipeMat);
  exhaustR.rotation.x = Math.PI / 2; exhaustR.position.set(0.4, 0.3, -1.35); kartGroup.add(exhaustR);

  const accentMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 });
  const rearLip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.12), accentMat);
  rearLip.position.set(0, 0.28, -1.35); kartGroup.add(rearLip);

  const underglow = new THREE.PointLight(0x37c6b0, 2, 4);
  underglow.position.set(0, 0.2, 0); kartGroup.add(underglow);

  // ---- Cosmetic decoration parts (build/driver items toggle these) ----
  const spoilerMesh = new THREE.Group();
  const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  spoilerWing.position.set(0, 1.05, -1.25); spoilerMesh.add(spoilerWing);
  [-0.6, 0.6].forEach(sx => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    strut.position.set(sx, 0.78, -1.25); spoilerMesh.add(strut);
  });
  spoilerMesh.visible = false; spoilerMesh.traverse(c => { if (c.isMesh) c.castShadow = true; }); kartGroup.add(spoilerMesh);

  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const stripesMesh = new THREE.Group();
  [-0.22, 0.22].forEach(sx => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 1.35), stripeMat);
    stripe.position.set(sx, 0.72, 0.55); stripesMesh.add(stripe);
  });
  stripesMesh.visible = false; kartGroup.add(stripesMesh);

  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.4 });
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), helmetMat);
  helmet.position.set(0, 1.02, -0.12); helmet.castShadow = true; kartGroup.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.05), new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.1 }));
  visor.position.set(0, 1.02, 0.06); kartGroup.add(visor);

  scene.add(kartGroup);

  window.applyCustomization = function() {
    const bc = settings.bodyColor || '#228b7a';
    if (settings.finish === 'matte') { bodyMat.roughness = 0.9; bodyMat.metalness = 0.0; }
    else if (settings.finish === 'gloss') { bodyMat.roughness = 0.1; bodyMat.metalness = 0.1; }
    else if (settings.finish === 'metallic') { bodyMat.roughness = 0.3; bodyMat.metalness = 0.8; }
    else if (settings.finish === 'chrome') { bodyMat.roughness = 0.05; bodyMat.metalness = 1.0; }
    bodyMat.color.set(bc);
    const glowMult = 1;
    if (settings.accentColor) underglow.color.set(settings.accentColor);
    else underglow.color.set(settings.glow);
    underglow.intensity = 2 * (settings.decalGlowRing ? 1.25 : 1);
    underglow.distance = 4 + (settings.decalGlowRing ? 1.2 : 0);
    wheelMat.color.set(settings.wheelColor || '#111111');
    helmetMat.color.set(settings.driverHelmet || '#374151');
    const bs = settings.bodyScale || { x: 1, y: 1, z: 1 };
    body.scale.set(bs.x, bs.y, bs.z);
    spoilerMesh.visible = !!settings.decalSpoiler;
    stripesMesh.visible = !!settings.decalStripes;
    settings.chromeShimmer = settings.finish === 'chrome';
  };
  window.applyCustomization();

  const ghostGroup = kartGroup.clone();
  ghostGroup.traverse(c => { if(c.isMesh) { c.material = c.material.clone(); c.material.transparent=true; c.material.opacity=0.3; c.material.emissiveIntensity=0; c.castShadow=false; }});
  scene.add(ghostGroup);

  // ---------- Hazards + Items + Local AI racers ----------
  window.raceHazards = { bananas: [], shells: [], fakeBoxes: [] };

  function clearHazards() {
    const h = window.raceHazards;
    [...h.bananas, ...h.shells, ...h.fakeBoxes].forEach(o => { if (o.mesh) scene.remove(o.mesh); });
    h.bananas = []; h.shells = []; h.fakeBoxes = [];
  }
  window.clearHazards = clearHazards;

  function grantItemTo(target, place) {
    const id = window.RaceKit ? window.RaceKit.rollItem(place || 2) : 'MUSHROOM';
    target.item = id;
    return id;
  }

  function spinOut(target, secs) {
    if (target.shieldTimer && target.shieldTimer > 0) {
      target.shieldTimer = 0;
      return;
    }
    target.spinTimer = secs || 1.1;
    if (target === window.kart) {
      window.kart.speedForward *= 0.25;
      window.cameraShakeTimer = 0.35;
    } else {
      target.speed *= 0.3;
    }
  }

  function dropBanana(fromPos, heading, owner) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.4 })
    );
    mesh.scale.set(1, 0.55, 1.2);
    const fw = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    mesh.position.copy(fromPos).addScaledVector(fw, -2.2);
    mesh.position.y += 0.25;
    scene.add(mesh);
    window.raceHazards.bananas.push({ mesh, pos: mesh.position.clone(), life: 45, owner });
  }

  function fireShell(fromPos, heading, owner) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x3ecf6a, emissive: 0x1a7a3a, emissiveIntensity: 0.6 })
    );
    const fw = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    mesh.position.copy(fromPos).addScaledVector(fw, 2.5);
    mesh.position.y += 0.4;
    scene.add(mesh);
    window.raceHazards.shells.push({
      mesh, pos: mesh.position.clone(), vel: fw.multiplyScalar(48), life: 4.5, owner
    });
  }

  function dropFakeBox(fromPos, heading, owner) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa500, transparent: true, opacity: 0.85 })
    );
    const fw = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    mesh.position.copy(fromPos).addScaledVector(fw, -2.5);
    mesh.position.y += 1.2;
    scene.add(mesh);
    window.raceHazards.fakeBoxes.push({ mesh, pos: mesh.position.clone(), life: 50, owner });
  }

  function useItemFor(racer, isPlayer) {
    const item = racer.item;
    if (!item) return;
    racer.item = null;
    if (isPlayer) {
      const slot = document.getElementById('hudItemSlot');
      if (slot) { slot.innerText = ''; slot.classList.remove('spinning'); }
    }
    const pos = isPlayer ? window.kart.pos : racer.pos;
    const heading = isPlayer ? window.kart.heading : racer.heading;

    if (item === 'MUSHROOM') {
      if (isPlayer) {
        window.kart.lastDriftTier = 3;
        window.kart.boostDuration = 1.5;
        window.kart.boostTimer = window.kart.boostDuration;
        window.kart.speedForward = Math.min(window.kart.maxSpeed + 9, window.kart.speedForward + 9);
        window.cameraShakeTimer = 0.3;
      } else {
        racer.boostTimer = 1.4;
        racer.speed = Math.min(racer.baseSpeed + 14, racer.speed + 12);
      }
      if (window.playBoostWhoosh) window.playBoostWhoosh();
    } else if (item === 'GREEN_SHELL') {
      fireShell(pos, heading, isPlayer ? 'player' : racer);
    } else if (item === 'BANANA') {
      dropBanana(pos, heading, isPlayer ? 'player' : racer);
    } else if (item === 'SHIELD') {
      if (isPlayer) window.kart.shieldTimer = 5.5;
      else racer.shieldTimer = 5.5;
    } else if (item === 'FAKE_BOX') {
      dropFakeBox(pos, heading, isPlayer ? 'player' : racer);
    }
  }

  window.usePlayerItem = function() { useItemFor(window.kart, true); };

  function rouletteGrant(target, place, isPlayer) {
    const id = grantItemTo(target, place);
    if (isPlayer) {
      const slot = document.getElementById('hudItemSlot');
      if (!slot) return;
      slot.classList.add('spinning');
      const icons = window.RaceKit ? Object.values(window.RaceKit.ITEMS).map(i => i.icon) : ['🍄','🟢','🍌','🛡️','📦'];
      let n = 0;
      const iv = setInterval(() => {
        slot.innerText = icons[n % icons.length];
        n++;
        if (n > 12) {
          clearInterval(iv);
          slot.classList.remove('spinning');
          slot.innerText = window.RaceKit ? window.RaceKit.itemIcon(id) : '🍄';
        }
      }, 50);
    }
  }

  function updateHazards(dt) {
    const h = window.raceHazards;
    // bananas
    for (let i = h.bananas.length - 1; i >= 0; i--) {
      const b = h.bananas[i];
      b.life -= dt;
      if (b.life <= 0) { scene.remove(b.mesh); h.bananas.splice(i, 1); continue; }
      const hitPlayer = window.kart.pos.distanceTo(b.mesh.position) < 1.6 && window.kart.spinTimer <= 0;
      if (hitPlayer) { spinOut(window.kart, 1.0); scene.remove(b.mesh); h.bananas.splice(i, 1); continue; }
      for (const ai of aiRacers) {
        if (ai.finished) continue;
        if (ai.pos.distanceTo(b.mesh.position) < 1.6 && ai.spinTimer <= 0) {
          spinOut(ai, 1.0); scene.remove(b.mesh); h.bananas.splice(i, 1); break;
        }
      }
    }
    // shells
    for (let i = h.shells.length - 1; i >= 0; i--) {
      const s = h.shells[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.y += dt * 10;
      if (s.life <= 0) { scene.remove(s.mesh); h.shells.splice(i, 1); continue; }
      let removed = false;
      if (s.owner !== 'player' && window.kart.pos.distanceTo(s.mesh.position) < 1.8) {
        spinOut(window.kart, 1.2); removed = true;
      }
      for (const ai of aiRacers) {
        if (removed || ai.finished) continue;
        if (s.owner === ai) continue;
        if (ai.pos.distanceTo(s.mesh.position) < 1.8) { spinOut(ai, 1.2); removed = true; }
      }
      if (removed) { scene.remove(s.mesh); h.shells.splice(i, 1); }
    }
    // fake boxes
    for (let i = h.fakeBoxes.length - 1; i >= 0; i--) {
      const f = h.fakeBoxes[i];
      f.life -= dt;
      f.mesh.rotation.y += dt * 2;
      if (f.life <= 0) { scene.remove(f.mesh); h.fakeBoxes.splice(i, 1); continue; }
      if (window.kart.pos.distanceTo(f.mesh.position) < 2.2 && window.kart.spinTimer <= 0) {
        spinOut(window.kart, 1.3); scene.remove(f.mesh); h.fakeBoxes.splice(i, 1); continue;
      }
      for (const ai of aiRacers) {
        if (ai.finished) continue;
        if (ai.pos.distanceTo(f.mesh.position) < 2.2 && ai.spinTimer <= 0) {
          spinOut(ai, 1.3); scene.remove(f.mesh); h.fakeBoxes.splice(i, 1); break;
        }
      }
    }
  }

  const AI_COLORS = [0x3d9dff, 0xb34dff, 0x3ecf6a];
  const AI_NAMES = ['BLAZE', 'VOLT', 'NIX'];
  const NET_COLORS = [0xff6b4a, 0x3d9dff, 0xb34dff, 0x3ecf6a];
  const aiRacers = [];
  window.aiRacers = aiRacers;
  const netRemotes = [];
  window.netRemotes = netRemotes;

  function makeAIKart(colorHex) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.25 });
    const b = new THREE.Mesh(createRacingChassisGeometry(), mat);
    b.position.y = 0.22; b.castShadow = true; g.add(b);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    helm.position.set(0, 1.0, -0.1); g.add(helm);
    g.visible = false;
    scene.add(g);
    return g;
  }

  /** Full cosmetic kart for online remotes — same visual language as the local player. */
  function makeCustomKart(look) {
    const L = look || {};
    const g = new THREE.Group();
    const finish = L.finish || 'matte';
    let roughness = 0.4, metalness = 0.1;
    if (finish === 'matte') { roughness = 0.9; metalness = 0; }
    else if (finish === 'gloss') { roughness = 0.1; metalness = 0.1; }
    else if (finish === 'metallic') { roughness = 0.3; metalness = 0.8; }
    else if (finish === 'chrome') { roughness = 0.05; metalness = 1.0; }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: L.bodyColor || '#228b7a', roughness, metalness, emissive: 0xffffff, emissiveIntensity: 0
    });
    const body = new THREE.Group();
    const hull = new THREE.Mesh(createRacingChassisGeometry(), bodyMat);
    hull.castShadow = true; hull.receiveShadow = true; body.add(hull);
    [-1, 1].forEach(side => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.15, 10), bodyMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(side * 0.72, 0.28, -0.15);
      pod.castShadow = true;
      body.add(pod);
    });
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.35), bodyMat);
    splitter.position.set(0, 0.1, 1.28);
    body.add(splitter);
    body.position.y = 0.22;
    const bs = L.bodyScale || { x: 1, y: 1, z: 1 };
    body.scale.set(bs.x || 1, bs.y || 1, bs.z || 1);
    g.add(body);

    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.55 });
    const cockpit = new THREE.Group();
    const cockpitPod = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.34, 8), cockpitMat);
    cockpit.add(cockpitPod);
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.32, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.55 })
    );
    windshield.position.set(0, 0.18, 0.38); windshield.rotation.x = -0.55; cockpit.add(windshield);
    cockpit.position.set(0, 0.78, -0.15); g.add(cockpit);

    const shoulders = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.22, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5 })
    );
    shoulders.position.set(0, 0.93, -0.12); g.add(shoulders);

    const wheelMat = new THREE.MeshStandardMaterial({ color: L.wheelColor || '#111111' });
    [[-0.85, 0.35, 1.0], [0.85, 0.35, 1.0], [-0.85, 0.35, -1.0], [0.85, 0.35, -1.0]].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(x, y, z); w.castShadow = true; g.add(w);
    });

    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 10),
      new THREE.MeshStandardMaterial({ color: L.driverHelmet || '#374151', roughness: 0.4 })
    );
    helm.position.set(0, 1.02, -0.12); helm.castShadow = true; g.add(helm);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.11, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.1 })
    );
    visor.position.set(0, 1.02, 0.06); g.add(visor);

    if (L.decalSpoiler) {
      const spoiler = new THREE.Group();
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
      wing.position.set(0, 1.05, -1.25); spoiler.add(wing);
      [-0.6, 0.6].forEach(sx => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        strut.position.set(sx, 0.78, -1.25); spoiler.add(strut);
      });
      g.add(spoiler);
    }
    if (L.decalStripes) {
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
      [-0.22, 0.22].forEach(sx => {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 1.35), stripeMat);
        stripe.position.set(sx, 0.72, 0.55); g.add(stripe);
      });
    }

    const glowCol = L.accentColor || L.glow || '#37c6b0';
    const glow = new THREE.PointLight(glowCol, L.decalGlowRing ? 2.5 : 2, L.decalGlowRing ? 5.2 : 4);
    glow.position.set(0, 0.2, 0); g.add(glow);

    g.userData.bodyMat = bodyMat;
    g.visible = true;
    scene.add(g);
    return g;
  }

  function clearAIRacers() {
    aiRacers.forEach(ai => { scene.remove(ai.mesh); });
    aiRacers.length = 0;
  }

  function clearNetRemotes() {
    netRemotes.forEach(r => { scene.remove(r.mesh); });
    netRemotes.length = 0;
  }

  function syncNetRemotes() {
    clearNetRemotes();
    if (!window.Net || !Net.isOnline()) return;
    const players = Net.getPlayers().filter(p => !p.you);
    players.forEach((p, i) => {
      const mesh = makeCustomKart(p.look);
      netRemotes.push({
        id: p.id, name: p.name, slot: p.slot, look: p.look || null, mesh,
        pos: new THREE.Vector3(), heading: 0, hopOffset: 0,
        lap: 1, finished: false, finishTime: null, place: i + 2
      });
    });
    placeNetRemotesOnGrid();
  }

  function placeNetRemotesOnGrid() {
    if (!window.pts || !window.pts.length || !window.getGridSpawn) return;
    netRemotes.forEach(r => {
      const spawn = window.getGridSpawn(r.slot | 0);
      r.pos.copy(spawn.pos);
      r.heading = spawn.heading;
      r.hopOffset = 0;
      r.mesh.visible = true;
      r.mesh.position.copy(spawn.pos);
      const fw = new THREE.Vector3(Math.sin(spawn.heading), 0, Math.cos(spawn.heading));
      r.mesh.up.set(0, 1, 0);
      r.mesh.lookAt(r.mesh.position.clone().add(fw));
    });
  }
  window.placeNetRemotesOnGrid = placeNetRemotesOnGrid;

  function updateNetRemotes(dt) {
    if (gameMode !== 'online' || !window.Net) return;
    if (window.Net.tickRemotes) Net.tickRemotes(dt);
    const states = Net.getRemoteStates();
    const holdGrid = (gameState === 'intro' || gameState === 'countdown');
    for (const r of netRemotes) {
      const st = states.get(r.id);
      if (!st) {
        if (holdGrid) {
          r.mesh.visible = true;
          r.mesh.position.set(r.pos.x, r.pos.y + (r.hopOffset || 0), r.pos.z);
          const fw = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
          r.mesh.up.set(0, 1, 0);
          r.mesh.lookAt(r.mesh.position.clone().add(fw));
        } else {
          r.mesh.visible = false;
        }
        continue;
      }
      r.mesh.visible = true;
      r.pos.set(st.x, st.y, st.z);
      r.heading = st.h;
      r.hopOffset = st.ho || 0;
      r.lap = st.lap || 1;
      r.finished = !!st.fin;
      if (st.ft != null) r.finishTime = st.ft;
      if (st.name) r.name = st.name;
      r.mesh.position.set(st.x, st.y + (st.ho || 0), st.z);
      const fw = new THREE.Vector3(Math.sin(st.h), 0, Math.cos(st.h));
      r.mesh.up.set(0, 1, 0);
      r.mesh.lookAt(r.mesh.position.clone().add(fw));
    }
    if (gameState === 'playing' || gameState === 'countdown' || gameState === 'spectating' || gameState === 'intro') updateRacePlaces();
    if (window.checkRaceComplete) window.checkRaceComplete();
  }

  function spawnAIRacers(count) {
    clearAIRacers();
    if (!window.pts || window.pts.length < 4) return;
    for (let i = 0; i < count; i++) {
      const mesh = makeAIKart(AI_COLORS[i % AI_COLORS.length]);
      const spacingBack = 20 + (i + 1) * 15;
      let spawnIndex = window.pts.length - spacingBack;
      if (spawnIndex < 0) spawnIndex = window.pts.length + spawnIndex;
      const baseSpeed = 34 + i * 2 + Math.random() * 3;
      aiRacers.push({
        mesh, progress: spawnIndex, baseSpeed, speed: baseSpeed,
        color: AI_COLORS[i % AI_COLORS.length], name: AI_NAMES[i % AI_NAMES.length],
        pos: new THREE.Vector3(), heading: 0,
        lap: 1, item: null, shieldTimer: 0, spinTimer: 0, boostTimer: 0,
        finished: false, finishTime: null, place: i + 2,
        itemCooldown: 1.5 + Math.random(), latOffset: ((i % 2) ? 1 : -1) * (2.5 + i)
      });
      mesh.visible = true;
    }
  }
  window.spawnAIRacers = spawnAIRacers;
  window.clearAIRacers = clearAIRacers;
  window.clearNetRemotes = clearNetRemotes;
  window.syncNetRemotes = syncNetRemotes;

  function raceDist(lap, progress, n) {
    return (lap - 1) * n + progress;
  }

  function playerTrackProgress() {
    if (!window.pts || !window.pts.length) return 0;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < window.pts.length; i++) {
      const p = window.pts[i];
      const d = (window.kart.pos.x - p.x) ** 2 + (window.kart.pos.z - p.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function updateRacePlaces() {
    if (gameMode !== 'multiplayer' && gameMode !== 'online') return;
    const n = window.pts.length;
    const entries = [{
      id: 'player',
      dist: raceDist(currentLap, playerTrackProgress(), n) + (window.kart.finished ? 1e6 : 0),
      finished: !!window.kart.finished,
      finishTime: window.kart.finishTime || null
    }];
    aiRacers.forEach(ai => {
      entries.push({
        id: ai, dist: raceDist(ai.lap, ai.progress, n) + (ai.finished ? 1e6 : 0),
        finished: ai.finished, finishTime: ai.finishTime
      });
    });
    netRemotes.forEach(r => {
      if (!r.mesh.visible) return;
      const prog = nearestProgress(r.pos);
      entries.push({
        id: r,
        dist: raceDist(r.lap || 1, prog, n) + (r.finished ? 1e6 : 0),
        finished: !!r.finished,
        finishTime: r.finishTime || null
      });
    });
    entries.sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime || 0) - (b.finishTime || 0);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.dist - a.dist;
    });
    entries.forEach((e, i) => {
      if (e.id === 'player') window.playerRacePlace = i + 1;
      else e.id.place = i + 1;
    });
  }
  window.updateRacePlaces = updateRacePlaces;

  function nearestProgress(pos) {
    if (!window.pts || !window.pts.length) return 0;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < window.pts.length; i++) {
      const p = window.pts[i];
      const d = (pos.x - p.x) ** 2 + (pos.z - p.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function updateAIRacers(dt) {
    if (!window.pts || aiRacers.length === 0) return;
    if (gameState !== 'playing' && gameState !== 'countdown' && gameState !== 'spectating') return;
    const n = window.pts.length;
    const playerDist = raceDist(currentLap, playerTrackProgress(), n);

    for (const ai of aiRacers) {
      if (!ai.mesh.visible) continue;
      if (ai.finished) {
        ai.mesh.position.copy(ai.pos);
        continue;
      }

      ai.shieldTimer = Math.max(0, ai.shieldTimer - dt);
      ai.spinTimer = Math.max(0, ai.spinTimer - dt);
      ai.boostTimer = Math.max(0, ai.boostTimer - dt);
      ai.itemCooldown = Math.max(0, ai.itemCooldown - dt);

      // Rubber-band toward player
      const aiDist = raceDist(ai.lap, ai.progress, n);
      const delta = playerDist - aiDist;
      let target = ai.baseSpeed;
      if (delta > 40) target = ai.baseSpeed + Math.min(10, delta * 0.04);
      else if (delta < -50) target = ai.baseSpeed - Math.min(7, (-delta) * 0.03);
      if (ai.boostTimer > 0) target += 10;
      if (ai.spinTimer > 0) target *= 0.2;
      ai.speed += (target - ai.speed) * Math.min(1, dt * 2.5);

      let i0 = Math.floor(ai.progress) % n;
      let i1 = (i0 + 1) % n;
      let segLen = Math.max(0.5, window.pts[i0].distanceTo(window.pts[i1]));
      const prevProgress = ai.progress;
      if (gameState === 'playing' || gameState === 'spectating') ai.progress += (ai.speed * dt) / segLen;

      // Lap complete
      if (ai.progress >= n) {
        ai.progress -= n;
        // Require roughly completing a loop
        if (prevProgress > n * 0.7) {
          if (ai.lap < maxLaps) ai.lap++;
          else {
            ai.finished = true;
            ai.finishTime = raceTime;
          }
        }
      }

      i0 = Math.floor(ai.progress) % n;
      i1 = (i0 + 1) % n;
      const frac = ai.progress - Math.floor(ai.progress);
      const a = window.pts[i0], b = window.pts[i1];
      ai.pos.lerpVectors(a, b, frac);
      const fw = new THREE.Vector3().subVectors(b, a);
      if (fw.lengthSq() < 1e-6) fw.set(0, 0, 1); else fw.normalize();
      const right = new THREE.Vector3(fw.z, 0, -fw.x);
      // Racing line: slight apex bias
      const line = ai.latOffset + Math.sin(ai.progress * 0.08) * 1.2;
      ai.pos.addScaledVector(right, line);
      ai.heading = Math.atan2(fw.x, fw.z);
      ai.mesh.position.copy(ai.pos);
      ai.mesh.position.y += 0.1;
      if (ai.spinTimer > 0) ai.mesh.rotation.y += dt * 12;
      else ai.mesh.lookAt(ai.mesh.position.clone().add(fw));

      // Item pickup
      if (gameState === 'playing' && !ai.item && window.itemBoxes) {
        window.itemBoxes.forEach(box => {
          if (!box.active) return;
          if (ai.pos.distanceTo(box.pos) < 2.8) {
            box.active = false; box.mesh.visible = false; box.respawnTimer = 5;
            rouletteGrant(ai, ai.place, false);
          }
        });
      }

      // Use items
      if (gameState === 'playing' && ai.item && ai.itemCooldown <= 0 && ai.spinTimer <= 0) {
        const should = (ai.place >= 3 && (ai.item === 'MUSHROOM' || ai.item === 'GREEN_SHELL'))
          || (ai.place === 1 && (ai.item === 'BANANA' || ai.item === 'FAKE_BOX'))
          || (ai.item === 'SHIELD' && Math.random() < 0.4)
          || Math.random() < 0.015;
        if (should) {
          useItemFor(ai, false);
          ai.itemCooldown = 2.5 + Math.random() * 2;
        }
      }
    }
    updateRacePlaces();
    if (window.checkRaceComplete) window.checkRaceComplete();
  }

  // ---------- Strict Kart Physics & 3D Localized Raycasting ----------
  window.kart = {
    pos: new THREE.Vector3(), heading: 0, velocity: new THREE.Vector3(), speedForward: 0,
    hopOffset: 0, hopVelY: 0, grounded: true, isDrifting: false, driftDir: 0, driftTime: 0, boostTimer: 0,
    maxSpeed: 38, accel: 26, brakeAccel: 32, reverseMaxSpeed: -12, naturalDrag: 6.5,
    steerRate: 1.3, driftSteerRate: 1.4, airSteerRate: 0.35, grassMaxSpeed: 16,
    gripLateral: 14, driftGripLateral: 3.0, hopImpulse: 5.5, gravity: -18,
    minDriftTimeForBoost: 0.35, boostDuration: 1.0, boostTopSpeedBonus: 9, boostKick: 9,
    driftTier: 1, lastDriftTier: 1, item: null,
    shieldTimer: 0, spinTimer: 0, finished: false, finishTime: null
  };
  let spaceWasDown = false;

  function updateKart(dt) {
    window.kart.shieldTimer = Math.max(0, (window.kart.shieldTimer || 0) - dt);
    window.kart.spinTimer = Math.max(0, (window.kart.spinTimer || 0) - dt);
    const menuBlocksDrive = (gameMode === 'online' && onlineMenuOpen);
    const canDrive = (gameState === 'playing') && window.kart.spinTimer <= 0 && !window.kart.finished && !menuBlocksDrive;
    const throttle = canDrive ? ((inputState.accel || settings.auto) ? 1 : 0) : 0;
    const brake = canDrive ? (inputState.brake ? 1 : 0) : 0;
    const steerRaw = canDrive ? ((inputState.left ? -1 : 0) + (inputState.right ? 1 : 0)) : 0;
    if (window.kart.spinTimer > 0) {
      window.kart.heading += dt * 10;
      window.kart.speedForward *= (1 - Math.min(1, dt * 3));
    }

    // 1. ISOLATE LOCAL 3D PROXIMITY
    let minDist3D = Infinity; 
    let minDist2D = Infinity;
    let nearestIndex = 0;
    if (window.pts) {
      for (let i = 0; i < window.pts.length; i++) {
        let pt = window.pts[i];
        let d2 = (window.kart.pos.x - pt.x)**2 + (window.kart.pos.z - pt.z)**2;
        let d3 = d2 + (window.kart.pos.y - pt.y)**2;
        if (d3 < minDist3D) { minDist3D = d3; minDist2D = d2; nearestIndex = i; }
      }
    }

    let nearestPt3D = window.pts[nearestIndex];
    let currentlyOnTrack = minDist2D <= ((TRACK_WIDTH/2) + 2)**2; 
    
    let groundHeight = nearestPt3D ? nearestPt3D.y : window.kart.pos.y;
    let groundNormal = new THREE.Vector3(0, 1, 0);
    
    // 2. TARGETED RAYCAST FOR Y-SNAPPING ONLY
    if (window.trackMesh && nearestPt3D && currentlyOnTrack) {
      const origin = new THREE.Vector3(window.kart.pos.x, nearestPt3D.y + 15, window.kart.pos.z);
      window.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
      const hits = window.raycaster.intersectObject(window.trackMesh);
      
      if (hits.length > 0) {
        let bestHit = hits[0];
        let minDiff = Infinity;
        for (let h of hits) {
          let diff = Math.abs(h.point.y - nearestPt3D.y);
          if (diff < minDiff) { minDiff = diff; bestHit = h; }
        }
        if (minDiff < 20) { 
          groundHeight = bestHit.point.y;
          groundNormal.copy(bestHit.face.normal);
        }
      }
    } else if (!currentlyOnTrack) {
      groundHeight = THREE.MathUtils.lerp(window.kart.pos.y, 0, dt * 6);
    }
    
    window.kart.pos.y = groundHeight;

    if (throttle) { window.kart.speedForward += window.kart.accel * dt; } else if (brake) { window.kart.speedForward -= window.kart.brakeAccel * dt; } 
    else { window.kart.speedForward += (window.kart.speedForward > 0 ? -1 : (window.kart.speedForward < 0 ? 1 : 0)) * window.kart.naturalDrag * dt; if (Math.abs(window.kart.speedForward) < 0.05) window.kart.speedForward = 0; }
    
    window.kart.boostTimer = Math.max(0, window.kart.boostTimer - dt);
    
    let currentBonus = 0;
    if (window.kart.boostTimer > 0) {
       // Caps: base 38 → L1 41 (+3), L2 44 (+6), L3 47 (+9)
       currentBonus = window.kart.lastDriftTier === 3 ? 9 : (window.kart.lastDriftTier === 2 ? 6 : 3);
    }
    const effMax = window.kart.maxSpeed + currentBonus * (window.kart.boostTimer / (window.kart.boostDuration || 1));
    window.kart.speedForward = Math.max(window.kart.reverseMaxSpeed, Math.min(effMax, window.kart.speedForward));

    const steerInput = window.kart.speedForward < -0.15 ? -steerRaw : steerRaw;

    if (canDrive && inputState.drift && !spaceWasDown && window.kart.grounded && currentlyOnTrack) {
      window.kart.hopVelY = window.kart.hopImpulse; window.kart.grounded = false;
      if (steerInput !== 0) { window.kart.isDrifting = true; window.kart.driftDir = steerInput; window.kart.driftTime = 0; }
    }
    
    if (canDrive && inputState.drift && !window.kart.isDrifting && steerInput !== 0 && currentlyOnTrack) { 
      window.kart.isDrifting = true; window.kart.driftDir = steerInput; window.kart.driftTime = 0; 
    }
    
    if (window.kart.isDrifting && window.kart.grounded && !currentlyOnTrack) {
      window.kart.isDrifting = false; window.kart.driftDir = 0; window.kart.driftTime = 0; window.kart.driftTier = 1;
    }

    if ((!inputState.drift || !canDrive) && window.kart.isDrifting) {
      if (window.kart.driftTime >= window.kart.minDriftTimeForBoost) {
        if (window.kart.driftTime >= 1.5) { window.kart.driftTier = 3; window.kart.boostDuration = 1.5; }
        else if (window.kart.driftTime >= 0.7) { window.kart.driftTier = 2; window.kart.boostDuration = 1.2; }
        else { window.kart.driftTier = 1; window.kart.boostDuration = 1.0; }

        window.kart.lastDriftTier = window.kart.driftTier;
        window.kart.boostTimer = window.kart.boostDuration;
        
        let targetKick = window.kart.driftTier === 3 ? 9 : (window.kart.driftTier === 2 ? 6 : 3);
        let targetBonus = window.kart.driftTier === 3 ? 9 : (window.kart.driftTier === 2 ? 6 : 3);
        window.kart.speedForward = Math.min(window.kart.maxSpeed + targetBonus, window.kart.speedForward + targetKick);
        window.cameraShakeTimer = 0.15;
        if (window.playBoostWhoosh) window.playBoostWhoosh();
      }
      window.kart.isDrifting = false; window.kart.driftDir = 0; window.kart.driftTime = 0; window.kart.driftTier = 1;
    }
    
    if (window.kart.isDrifting) {
      window.kart.driftTime += dt;
      if (window.kart.driftTime >= 1.5) window.kart.driftTier = 3;
      else if (window.kart.driftTime >= 0.7) window.kart.driftTier = 2;
      else window.kart.driftTier = 1;
    }
    spaceWasDown = canDrive ? inputState.drift : false;

    let sRate, effSteer;
    if (!window.kart.grounded) { sRate = window.kart.airSteerRate; effSteer = window.kart.isDrifting ? window.kart.driftDir : steerInput; } 
    else if (window.kart.isDrifting) { sRate = window.kart.driftSteerRate; effSteer = steerInput === 0 ? window.kart.driftDir : (steerInput === window.kart.driftDir ? window.kart.driftDir * 1.3 : window.kart.driftDir * 0.35); } 
    else { sRate = window.kart.steerRate; effSteer = steerInput; }
    window.kart.heading -= effSteer * sRate * THREE.MathUtils.clamp(Math.abs(window.kart.speedForward) / window.kart.maxSpeed, 0.15, 1) * dt;

    const fw = new THREE.Vector3(Math.sin(window.kart.heading), 0, Math.cos(window.kart.heading));
    const rt = new THREE.Vector3(Math.cos(window.kart.heading), 0, -Math.sin(window.kart.heading));

    window.kart.velocity.add(rt.clone().multiplyScalar(-rt.dot(window.kart.velocity) * Math.min(1, (window.kart.isDrifting ? window.kart.driftGripLateral : window.kart.gripLateral) * dt)));
    window.kart.velocity.add(fw.clone().multiplyScalar((window.kart.speedForward - fw.dot(window.kart.velocity)) * Math.min(1, 10 * dt)));

    // Decoupled Jump Offset
    if (!window.kart.grounded) {
      window.kart.hopVelY += window.kart.gravity * dt; 
      window.kart.hopOffset += window.kart.hopVelY * dt;
      if (window.kart.hopOffset <= 0) { 
        window.kart.hopOffset = 0; 
        window.kart.hopVelY = 0; 
        window.kart.grounded = true; 
        window.cameraShakeTimer = 0.15; 
      }
    }

    window.kart.pos.x += window.kart.velocity.x * dt; window.kart.pos.z += window.kart.velocity.z * dt;

    for (let p of window.boostPads) {
      if (Math.abs(window.kart.pos.x - p.x) < p.r && Math.abs(window.kart.pos.z - p.z) < p.r && Math.abs(window.kart.pos.y - p.y) < 10) {
        if (!p._hitCool) {
          window.kart.lastDriftTier = 3; window.kart.boostDuration = 1.5;
          window.kart.boostTimer = window.kart.boostDuration;
          window.kart.speedForward = Math.min(window.kart.maxSpeed + 9, window.kart.speedForward + 9);
          window.cameraShakeTimer = 0.2;
          window.hitstopTimer = 0.06;
          if (window.playBoostWhoosh) window.playBoostWhoosh();
          p._hitCool = 0.8;
        }
      }
      if (p._hitCool) p._hitCool = Math.max(0, p._hitCool - dt);
    }
    
    if (gameMode === 'multiplayer' || gameMode === 'online') {
      window.itemBoxes.forEach(box => {
        if (box.active) {
          box.mesh.rotation.y += 2 * dt; box.mesh.rotation.x += 1 * dt;
          if (window.kart.pos.distanceTo(box.pos) < 2.5 && !window.kart.item && Math.abs(window.kart.pos.y - box.pos.y) < 10) {
            box.active = false; box.mesh.visible = false; box.respawnTimer = 5.0;
            rouletteGrant(window.kart, window.playerRacePlace || 2, true); playUIChime();
          }
        } else {
          box.respawnTimer -= dt;
          if (box.respawnTimer <= 0) { box.active = true; box.mesh.visible = true; }
        }
      });
    }

    for(let p of window.wallPosts) {
      const dx = window.kart.pos.x - p.x; const dz = window.kart.pos.z - p.z;
      const distSq = dx*dx + dz*dz;
      if(distSq < 1.44 && Math.abs(window.kart.pos.y - p.y) < 5) { 
        const dist = Math.sqrt(distSq); const nx = dx/dist; const nz = dz/dist;
        window.kart.pos.x = p.x + nx*1.2; window.kart.pos.z = p.z + nz*1.2;
        const dot = window.kart.velocity.x*nx + window.kart.velocity.z*nz;
        window.kart.velocity.x -= 1.5 * dot * nx; window.kart.velocity.z -= 1.5 * dot * nz;
        window.kart.speedForward *= 0.5; window.cameraShakeTimer = 0.25; 
      }
    }

    if (!currentlyOnTrack && window.kart.grounded) {
      const dragRate = 45;
      if (window.kart.speedForward > window.kart.grassMaxSpeed) window.kart.speedForward = Math.max(window.kart.grassMaxSpeed, window.kart.speedForward - dragRate * dt);
      else if (window.kart.speedForward < -window.kart.grassMaxSpeed) window.kart.speedForward = Math.min(-window.kart.grassMaxSpeed, window.kart.speedForward + dragRate * dt);
      
      const currentSpd = window.kart.velocity.length();
      if (currentSpd > window.kart.grassMaxSpeed) window.kart.velocity.setLength(Math.max(window.kart.grassMaxSpeed, currentSpd - dragRate * dt));
    } else if (window.kart.isDrifting && window.kart.grounded) {
      drawSkid(window.kart.pos.clone().add(fw.clone().multiplyScalar(-1.1)), window.kart.heading);
      if (Math.random() < 0.6) emitSpark(window.kart.pos.clone().add(fw.clone().multiplyScalar(-1.1)).add(rt.clone().multiplyScalar(window.kart.driftDir * 0.7)), window.kart.driftTier);
    }

    kartGroup.position.set(window.kart.pos.x, window.kart.pos.y + window.kart.hopOffset, window.kart.pos.z);
    
    const targetUp = window.kart.grounded ? groundNormal : new THREE.Vector3(0, 1, 0);
    kartGroup.up.lerp(targetUp, dt * 10);
    const slopeFw = fw.clone().projectOnPlane(kartGroup.up).normalize();
    kartGroup.lookAt(kartGroup.position.clone().add(slopeFw));

    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, window.kart.isDrifting ? -window.kart.driftDir * 0.18 : 0, 0.15);
    cockpit.rotation.z = body.rotation.z;

    const spin = window.kart.velocity.length() * dt * 4; wheels.forEach(w => w.rotation.x -= spin);
    
    if (window.kart.boostTimer > 0 && window.kart.grounded) {
      const backPos = window.kart.pos.clone().add(fw.clone().multiplyScalar(-1.4));
      backPos.y += window.kart.hopOffset + 0.3;
      emitExhaust(backPos.clone().add(rt.clone().multiplyScalar(-0.4)), window.kart.heading, window.kart.lastDriftTier);
      emitExhaust(backPos.clone().add(rt.clone().multiplyScalar(0.4)), window.kart.heading, window.kart.lastDriftTier);
    }

    if (settings.mythicTrail && gameState === 'playing' && Math.abs(window.kart.speedForward) > 8) {
      const trailPos = window.kart.pos.clone().add(fw.clone().multiplyScalar(-1.2));
      trailPos.y += window.kart.hopOffset + 0.35;
      if (Math.random() < 0.7) emitMythicTrail(trailPos, window.kart.heading);
    }

    // Chrome shimmer — pulsing specular highlight on body/nose/fenders
    if (settings.chromeShimmer || settings.finish === 'chrome') {
      const shimmer = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() * 0.006));
      bodyMat.emissive.setHex(0xffffff);
      bodyMat.emissiveIntensity = shimmer * 0.35;
    } else {
      bodyMat.emissiveIntensity = 0;
    }
  }
  
  // ---------- Race Logic & Ghost ----------
  let ghostSpeed = 0;
  function updateRaceLogic(dt) {
    if (gameState !== 'playing' && gameState !== 'countdown' && gameState !== 'spectating') return;
    
    if (gameState === 'playing' || gameState === 'spectating') {
      raceTime += dt;
      if (gameState === 'playing') lapTimer += dt;
    }

    if (gameMode === 'timed' && gameState === 'playing') {
      const frameIdx = Math.floor(raceTime * 10);
      if (frameIdx >= currentRunGhostData.length) currentRunGhostData.push({ x: window.kart.pos.x, y: window.kart.pos.y, z: window.kart.pos.z, h: window.kart.heading, s: window.kart.speedForward, ho: window.kart.hopOffset });
      
      if (ghostData.length > 0 && settings.ghost) {
        const gFrame = ghostData[Math.min(frameIdx, ghostData.length - 1)];
        ghostGroup.position.set(gFrame.x, gFrame.y + (gFrame.ho || 0), gFrame.z); 
        
        const ghostFw = new THREE.Vector3(Math.sin(gFrame.h), 0, Math.cos(gFrame.h));
        ghostGroup.up.set(0, 1, 0);
        ghostGroup.lookAt(ghostGroup.position.clone().add(ghostFw));
        
        ghostSpeed = gFrame.s || 0;
        ghostGroup.visible = true;
      } else { ghostGroup.visible = false; ghostSpeed = 0; }
    } else { ghostGroup.visible = false; }

    if (gameState === 'playing') {
      if (nextCheckpointIndex < window.checkpoints.length) {
        const cp = window.pts[window.checkpoints[nextCheckpointIndex]];
        const cpDistSq = (window.kart.pos.x - cp.x)**2 + (window.kart.pos.z - cp.z)**2;
        if (cpDistSq < (TRACK_WIDTH * 4.0)**2) {
          nextCheckpointIndex++;
        }
      }
      
      const vecX = window.kart.pos.x - window.trackStartPos.x;
      const vecZ = window.kart.pos.z - window.trackStartPos.z;
      const currentDot = vecX * window.trackTangent.x + vecZ * window.trackTangent.z;
      const distToStartSq = vecX*vecX + vecZ*vecZ;

      if (distToStartSq < (TRACK_WIDTH * 4.0)**2) {
        if (lastFinishDot < 0 && currentDot >= 0) {
          if (!window.crossedStartLine) {
            window.crossedStartLine = true;
          } else if (raceTime > 2.0 && gameMode !== 'free') {
            if (nextCheckpointIndex >= window.checkpoints.length) {
              lapSplits.push(lapTimer); lapTimer = 0;
              if (currentLap < maxLaps) { currentLap++; nextCheckpointIndex = 0; document.getElementById('lapVal').textContent = `${currentLap}/${maxLaps}`; }
              else { triggerFinish(); }
            } else { showCheatNote(); }
          }
        }
      }
      lastFinishDot = currentDot;
    }
  }

  // ---------- Dynamic Camera (Locked Rear-View Fix) ----------
  const camTargetPos = new THREE.Vector3(); const camTargetLook = new THREE.Vector3();
  camTargetPos.copy(camera.position); camTargetLook.copy(scene.position);
  window.cameraShakeTimer = 0;

  function updateCamera(dt) {
    if (gameState === 'intro' && window.raceIntroCamera && window.raceIntroCamera(camera, camTargetPos, camTargetLook)) {
      return;
    }
    const follow = (gameState === 'spectating' && window.getSpectateFollow) ? window.getSpectateFollow() : null;
    const followPos = follow
      ? new THREE.Vector3(follow.pos.x, follow.pos.y + (follow.hopOffset || 0.1), follow.pos.z)
      : window.kart.pos.clone().add(new THREE.Vector3(0, window.kart.hopOffset, 0));
    const followHeading = follow ? follow.heading : window.kart.heading;
    const fw = new THREE.Vector3(Math.sin(followHeading), 0, Math.cos(followHeading));
    let idealPos = new THREE.Vector3();
    let idealLook = new THREE.Vector3();
    let isFPV = (window.cameraView === 'fpv') && !follow;

    // Hide the driver's own helmet/visor in first-person so it doesn't sit
    // right in front of the lens and block the view.
    helmet.visible = !isFPV;
    visor.visible = !isFPV;

    const kartVisPos = followPos.clone();

    if (window.lookBehind && !follow) {
      const camDist = isFPV ? 0.2 : 4.5;
      const camHeight = isFPV ? 1.4 : 4.2;
      idealPos.copy(kartVisPos).add(fw.clone().multiplyScalar(camDist)).add(new THREE.Vector3(0, camHeight, 0));
      idealLook.copy(kartVisPos).add(fw.clone().multiplyScalar(-15)).add(new THREE.Vector3(0, isFPV ? 1.4 : 0.5, 0));
      
      camTargetPos.copy(idealPos); camTargetLook.copy(idealLook);
      camera.position.copy(camTargetPos); camera.lookAt(camTargetLook);
      return;
    } 

    if (isFPV) {
      idealPos.copy(kartVisPos).add(fw.clone().multiplyScalar(0.5)).add(new THREE.Vector3(0, 1.5, 0));

      idealLook.copy(kartVisPos).add(fw.clone().multiplyScalar(10)).add(new THREE.Vector3(0, 1.4, 0));
    } else {
      idealPos.copy(kartVisPos).add(fw.clone().multiplyScalar(-4.5)).add(new THREE.Vector3(0, 4.2, 0));
      idealLook.copy(kartVisPos).add(fw.clone().multiplyScalar(6)).add(new THREE.Vector3(0, 0.5, 0));
    }
    
    if (window.cameraShakeTimer > 0) {
      window.cameraShakeTimer -= dt;
      const shakeMag = isFPV ? 0.2 : 0.6; 
      idealPos.add(new THREE.Vector3((Math.random()-0.5)*shakeMag, (Math.random()-0.5)*shakeMag, (Math.random()-0.5)*shakeMag));
    }

    if (window.cameraView !== window.lastCameraView || window.lookBehind !== window.lastLookBehind) {
      camTargetPos.copy(idealPos); camTargetLook.copy(idealLook);
      window.lastCameraView = window.cameraView; window.lastLookBehind = window.lookBehind;
    } else {
      const posLerp = isFPV ? 30 : 8; const lookLerp = isFPV ? 40 : 12;
      camTargetPos.lerp(idealPos, dt * posLerp); camTargetLook.lerp(idealLook, dt * lookLerp);
    }

    camera.position.copy(camTargetPos); camera.lookAt(camTargetLook);

    const targetFOV = window.kart.boostTimer > 0 ? (isFPV ? 85 : 68) : (isFPV ? 75 : 62);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, dt * 5);
    camera.updateProjectionMatrix();

    headlight.position.copy(kartVisPos).add(new THREE.Vector3(0, 1.2, 0));
    headlight.target.position.copy(kartVisPos).add(fw.clone().multiplyScalar(10));
  }

  // ---------- HUD & Minimap ----------
  const mCtx = document.getElementById('minimap').getContext('2d');
  
  function updateHUD(dt) {
    document.getElementById('speedVal').textContent = Math.abs(window.kart.speedForward).toFixed(0);
    document.getElementById('speedBar').style.width = Math.min(100, (Math.abs(window.kart.speedForward) / window.kart.maxSpeed) * 100) + '%';
    
    const boostBadge = document.getElementById('boostBadge');
    if (window.kart.boostTimer > 0) {
      boostBadge.classList.add('active'); boostBadge.textContent = `BOOST LVL ${window.kart.lastDriftTier || 1}`;
    } else { boostBadge.classList.remove('active'); }
    
    if ((gameState === 'playing' || gameState === 'spectating') && (gameMode === 'timed' || gameMode === 'multiplayer' || gameMode === 'online')) { 
      document.getElementById('timerVal').textContent = formatTime(raceTime); 
    }
    const placeVal = document.getElementById('placeVal');
    if (placeVal && (gameMode === 'multiplayer' || gameMode === 'online')) {
      const pl = window.playerRacePlace || 1;
      placeVal.textContent = pl === 1 ? '1st' : pl === 2 ? '2nd' : pl === 3 ? '3rd' : pl + 'th';
    }
    // Shield indicator on boost badge area
    if (window.kart.shieldTimer > 0) {
      boostBadge.classList.add('active');
      boostBadge.textContent = 'SHIELD ' + window.kart.shieldTimer.toFixed(1) + 's';
    }

    if (!window.pts || window.pts.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    window.pts.forEach(p => { if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x; if(p.z < minZ) minZ = p.z; if(p.z > maxZ) maxZ = p.z; });
    const tW = maxX - minX, tH = maxZ - minZ; const mmScale = 140 / Math.max(tW, tH);
    const mmOffsetX = 102 - (minX + tW/2) * mmScale; const mmOffsetZ = 102 - (minZ + tH/2) * mmScale;

    mCtx.clearRect(0, 0, 204, 204);
    mCtx.lineWidth = TRACK_WIDTH * mmScale; mCtx.strokeStyle = '#2b2d33'; mCtx.lineCap = 'round'; mCtx.lineJoin = 'round';
    mCtx.beginPath();
    for(let i=0; i<window.pts.length; i++) {
       const mx = window.pts[i].x * mmScale + mmOffsetX; const mz = window.pts[i].z * mmScale + mmOffsetZ;
       if(i===0) mCtx.moveTo(mx, mz); else mCtx.lineTo(mx, mz);
    }
    mCtx.stroke(); mCtx.lineWidth = 1; mCtx.strokeStyle = '#e8b23d'; mCtx.stroke();
    
    if (ghostGroup.visible && settings.ghost) {
      mCtx.fillStyle = 'rgba(255,255,255,0.5)';
      mCtx.beginPath();
      mCtx.arc(ghostGroup.position.x * mmScale + mmOffsetX, ghostGroup.position.z * mmScale + mmOffsetZ, 4.5, 0, Math.PI*2);
      mCtx.fill();
    }
    
    if (gameMode === 'multiplayer' || gameMode === 'online') {
      window.itemBoxes.forEach(box => {
        if (box.active) {
          mCtx.fillStyle = '#ffd700';
          mCtx.beginPath();
          mCtx.arc(box.pos.x * mmScale + mmOffsetX, box.pos.z * mmScale + mmOffsetZ, 2.5, 0, Math.PI*2);
          mCtx.fill();
        }
      });
      // Other racers (local AI stand-ins)
      if (window.aiRacers) {
        window.aiRacers.forEach(ai => {
          if (!ai.mesh.visible) return;
          mCtx.fillStyle = '#' + (ai.color >>> 0).toString(16).padStart(6, '0');
          mCtx.beginPath();
          mCtx.arc(ai.pos.x * mmScale + mmOffsetX, ai.pos.z * mmScale + mmOffsetZ, 4, 0, Math.PI*2);
          mCtx.fill();
          mCtx.strokeStyle = 'rgba(0,0,0,0.5)';
          mCtx.lineWidth = 1;
          mCtx.stroke();
        });
      }
      if (window.netRemotes) {
        window.netRemotes.forEach(r => {
          if (!r.mesh.visible) return;
          mCtx.fillStyle = '#' + (r.color >>> 0).toString(16).padStart(6, '0');
          mCtx.beginPath();
          mCtx.arc(r.pos.x * mmScale + mmOffsetX, r.pos.z * mmScale + mmOffsetZ, 4, 0, Math.PI*2);
          mCtx.fill();
        });
      }
    }

    // Player — drawn last so it stays on top
    mCtx.fillStyle = '#ff5f3d';
    mCtx.beginPath();
    mCtx.arc(window.kart.pos.x * mmScale + mmOffsetX, window.kart.pos.z * mmScale + mmOffsetZ, 4.5, 0, Math.PI*2);
    mCtx.fill();
    // Heading tick
    const hx = Math.sin(window.kart.heading) * 7;
    const hz = Math.cos(window.kart.heading) * 7;
    mCtx.strokeStyle = '#ff5f3d';
    mCtx.lineWidth = 2;
    mCtx.beginPath();
    mCtx.moveTo(window.kart.pos.x * mmScale + mmOffsetX, window.kart.pos.z * mmScale + mmOffsetZ);
    mCtx.lineTo(window.kart.pos.x * mmScale + mmOffsetX + hx, window.kart.pos.z * mmScale + mmOffsetZ + hz);
    mCtx.stroke();
  }

  function updateSparks(dt) {
    for (const s of sparks) {
      if (!s.mesh.visible) continue;
      if (gameState === 'countdown' || gameState === 'intro') { s.life = 0; s.mesh.visible = false; continue; }
      s.life -= dt; if (s.life <= 0) { s.mesh.visible = false; continue; }
      s.vel.y -= 6 * dt; s.mesh.position.addScaledVector(s.vel, dt); s.mesh.material.opacity = Math.max(0, s.life / 0.4);
    }
    for (const p of exhaustParticles) {
      if (!p.mesh.visible) continue;
      if (gameState === 'countdown' || gameState === 'intro') { p.life = 0; p.mesh.visible = false; continue; }
      p.life -= dt; 
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      
      p.mesh.position.addScaledVector(p.vel, dt);
      const scale = p.life / p.maxLife;
      p.mesh.scale.set(0.55 * scale, 0.55 * scale, (1.4 + (1 - scale) * 0.6) * scale);
      p.mesh.material.opacity = scale;
    }
    for (const p of boostSparkParticles) {
      if (!p.mesh.visible) continue;
      if (gameState === 'countdown' || gameState === 'intro') { p.life = 0; p.mesh.visible = false; continue; }
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
      p.mesh.scale.setScalar(0.5 + p.life / p.maxLife);
    }
    for (const p of mythicTrailParticles) {
      if (!p.mesh.visible) continue;
      if (gameState === 'countdown' || gameState === 'intro') { p.life = 0; p.mesh.visible = false; continue; }
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.mesh.position.addScaledVector(p.vel, dt);
      const scale = p.life / p.maxLife;
      p.mesh.scale.setScalar(0.6 + scale * 1.2);
      p.mesh.material.opacity = scale * 0.85;
    }
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    let dt = Math.min(0.05, clock.getDelta());
    if (window.hitstopTimer > 0) {
      window.hitstopTimer -= dt;
      dt *= 0.15;
    }
    if (gameState === 'intro' || gameState === 'countdown' || gameState === 'playing' || gameState === 'finished' || gameState === 'spectating') {
      if (gameState === 'intro' && window.updateRaceIntro) window.updateRaceIntro(dt);
      if (!window.replaying) {
        updateKart(dt); updateRaceLogic(dt); updateAIRacers(dt); updateNetRemotes(dt); updateHazards(dt);
        if (gameMode === 'online' && window.Net && (gameState === 'playing' || gameState === 'countdown' || gameState === 'intro' || gameState === 'finished' || gameState === 'spectating')) {
          Net.pushLocalState({
            x: window.kart.pos.x, y: window.kart.pos.y, z: window.kart.pos.z,
            h: window.kart.heading, sf: window.kart.speedForward, ho: window.kart.hopOffset,
            lap: currentLap, fin: !!window.kart.finished, ft: window.kart.finishTime
          });
        }
        if (gameState === 'playing') {
          window.replayBuffer.push({
            x: window.kart.pos.x, y: window.kart.pos.y, z: window.kart.pos.z,
            h: window.kart.heading, ho: window.kart.hopOffset
          });
          if (window.replayBuffer.length > 50) window.replayBuffer.shift();
        }
      }
      updateSparks(dt); updateHUD(dt); updateAudio(dt, ghostSpeed); updateRain(dt);
    } else { if(window.updateAudio) updateAudio(0, 0); }
    updateCamera(dt);
    composer.render(dt);
  }
  animate();
})();
