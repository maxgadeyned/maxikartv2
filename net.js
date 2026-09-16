/* MAXIKART — client multiplayer (Socket.IO → same server as the page) */
(function () {
  const MAX_PLAYERS = 4;
  const STATE_HZ = 30;
  const STATE_MS = 1000 / STATE_HZ;

  const Net = {
    role: null,
    socket: null,
    roomCode: null,
    localId: null,
    localName: 'RACER',
    players: new Map(),
    remoteStates: new Map(),
    lobbyCbs: [],
    startCbs: [],
    discCbs: [],
    pingMs: 0,
    _lastSend: 0,
    _raceLive: false,
    _pingSentAt: 0,
    _pingTimer: null,
    _intentionalLeave: false
  };

  function ensurePageOk() {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') return true;
    alert('Open MAXIKART via the server URL.\n\nLocal: START MAXIKART.bat → http://127.0.0.1:8765\nOnline: your Render https://….onrender.com link');
    return false;
  }

  function playerName() {
    const el = document.getElementById('lbPlayerName') || document.getElementById('joinPlayerName');
    const n = (el && el.value) || localStorage.getItem('kartPlayerName') || 'RACER';
    return String(n).toUpperCase().slice(0, 12) || 'RACER';
  }

  function emitLobby() {
    const list = getPlayers();
    Net.lobbyCbs.forEach(cb => { try { cb(list, Net.roomCode); } catch (e) {} });
    refreshLobbyDOM(list);
  }

  function allPlayersReady() {
    if (Net.players.size === 0) return false;
    for (const p of Net.players.values()) if (!p.ready) return false;
    return true;
  }

  function refreshLobbyDOM(list) {
    const el = document.getElementById('netPlayerList');
    const codeEl = document.getElementById('netRoomCode');
    const pingEl = document.getElementById('netPing');
    const statusEl = document.getElementById('netLobbyStatus');
    const readyCount = list.filter(p => p.ready).length;
    if (codeEl) codeEl.textContent = Net.roomCode || '----';
    if (pingEl) pingEl.textContent = Net.pingMs ? (Net.pingMs + ' ms') : '—';
    if (statusEl) {
      if (!Net.role) statusEl.textContent = 'Connecting…';
      else if (Net.role === 'host') {
        statusEl.textContent = list.length <= 1
          ? (list[0] && list[0].ready ? 'Ready — waiting for racers…' : 'Mark ready when you’re set')
          : `${readyCount}/${list.length} ready`;
      } else {
        statusEl.textContent = `${readyCount}/${list.length} ready — waiting for host`;
      }
    }
    if (el) {
      el.innerHTML = list.map(p =>
        `<div class="net-player-row${p.you ? ' you' : ''}${p.ready ? ' ready' : ''}">
          <span class="net-slot">P${p.slot + 1}</span>
          <span class="net-name">${p.name}${p.you ? ' (YOU)' : ''}</span>
          ${p.host ? '<span class="net-host-tag">HOST</span>' : ''}
          <span class="net-ready-tag${p.ready ? ' on' : ''}">${p.ready ? 'READY' : 'NOT READY'}</span>
        </div>`
      ).join('');
    }
    const local = Net.players.get(Net.localId);
    const readyBtn = document.getElementById('netReadyBtn');
    if (readyBtn) {
      readyBtn.style.display = Net.role ? '' : 'none';
      readyBtn.textContent = (local && local.ready) ? '✓ READY' : 'READY UP';
      readyBtn.classList.toggle('ready-on', !!(local && local.ready));
    }
    const startBtn = document.getElementById('netStartBtn');
    if (startBtn) {
      const canStart = Net.role === 'host' && allPlayersReady();
      startBtn.style.display = Net.role === 'host' ? '' : 'none';
      startBtn.disabled = !canStart;
      startBtn.classList.toggle('disabled', !canStart);
    }
    const hostSettings = document.getElementById('lobbyHostSettings');
    const guestSummary = document.getElementById('lobbyGuestSummary');
    if (hostSettings) hostSettings.style.display = Net.role === 'host' ? '' : 'none';
    if (guestSummary) guestSummary.style.display = Net.role === 'client' ? '' : 'none';
    refreshLobbySettingsUI();
  }

  function applyRoster(players) {
    Net.players.clear();
    (players || []).forEach(p => {
      Net.players.set(p.id, {
        id: p.id, name: p.name, slot: p.slot, host: !!p.host, ready: !!p.ready,
        look: p.look || null
      });
    });
    emitLobby();
  }

  function currentSettingsPayload() {
    return {
      t: 'settings',
      map: typeof activeMapIndex === 'number' ? activeMapIndex : 0,
      laps: typeof maxLaps === 'number' ? maxLaps : 3,
      night: !!(window.settings && settings.night),
      weather: (window.settings && settings.weather) || 'clear',
      items: !(window.settings && settings.items === false)
    };
  }

  function applyLobbySettings(cfg) {
    if (!cfg) return;
    if (typeof activeMapIndex !== 'undefined' && cfg.map != null) activeMapIndex = cfg.map | 0;
    if (typeof setLaps === 'function' && cfg.laps != null) setLaps(cfg.laps | 0 || 3);
    if (window.settings) {
      if (cfg.night != null) settings.night = !!cfg.night;
      if (cfg.weather != null) settings.weather = cfg.weather;
      if (cfg.items != null) settings.items = !!cfg.items;
      if (typeof saveConfig === 'function') saveConfig();
    }
    if (typeof syncMapDisplays === 'function') syncMapDisplays();
    document.querySelectorAll('.weather-display').forEach(el => {
      const label = (window.RaceKit ? window.RaceKit.getWeather((window.settings && settings.weather) || 'clear').label : ((window.settings && settings.weather) || 'clear'));
      el.textContent = String(label).toUpperCase();
    });
    const nightLobby = document.getElementById('setup-night-lobby');
    if (nightLobby) nightLobby.checked = !!(window.settings && settings.night);
    const itemsLobby = document.getElementById('setup-items');
    if (itemsLobby) itemsLobby.checked = !(window.settings && settings.items === false);
    updateGuestConfigText();
  }

  function updateGuestConfigText() {
    const el = document.getElementById('lobbyGuestConfig');
    if (!el) return;
    const mapName = (typeof MAPS !== 'undefined' && MAPS[activeMapIndex]) ? MAPS[activeMapIndex].name : 'TRACK';
    const weather = (window.RaceKit ? window.RaceKit.getWeather((settings && settings.weather) || 'clear').label : ((settings && settings.weather) || 'clear'));
    el.textContent = `${mapName} · ${maxLaps} lap${maxLaps === 1 ? '' : 's'} · ${weather.toUpperCase()}${settings && settings.night ? ' · NIGHT' : ''}${(settings && settings.items !== false) ? ' · ITEMS' : ''}`;
  }

  function refreshLobbySettingsUI() {
    if (typeof syncMapDisplays === 'function') syncMapDisplays();
    if (typeof setLaps === 'function') setLaps(typeof maxLaps === 'number' ? maxLaps : 3);
    const nightLobby = document.getElementById('setup-night-lobby');
    if (nightLobby && window.settings) nightLobby.checked = !!settings.night;
    const itemsEl = document.getElementById('setup-items');
    if (itemsEl && window.settings) itemsEl.checked = settings.items !== false;
    const nameEl = document.getElementById('lobbyHostName');
    if (nameEl && Net.role === 'host') nameEl.value = Net.localName || playerName();
    document.querySelectorAll('.weather-display').forEach(el => {
      const label = (window.RaceKit ? window.RaceKit.getWeather((window.settings && settings.weather) || 'clear').label : ((window.settings && settings.weather) || 'clear'));
      el.textContent = String(label).toUpperCase();
    });
    updateGuestConfigText();
  }

  function syncLobbySettings() {
    if (Net.role !== 'host') return;
    send(currentSettingsPayload());
    updateGuestConfigText();
  }

  function markRaceEnded() {
    Net._raceLive = false;
    Net.remoteStates.clear();
  }

  function returnToLobby() {
    if (!Net.role) return;
    send({ t: 'lobby' });
  }

  function getPlayers() {
    return [...Net.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map(p => ({
        id: p.id, name: p.name, slot: p.slot, host: !!p.host, ready: !!p.ready,
        look: p.look || null,
        you: p.id === Net.localId
      }));
  }

  function currentLook() {
    if (window.Cosmetics && typeof window.Cosmetics.getNetworkLook === 'function') {
      return window.Cosmetics.getNetworkLook();
    }
    return null;
  }

  function send(obj) {
    if (!Net.socket || !Net.socket.connected) return;
    Net.socket.emit('msg', obj);
  }

  function ingestRemoteState(data) {
    if (!data.id || data.id === Net.localId) return;
    let st = Net.remoteStates.get(data.id);
    if (!st) {
      st = {
        id: data.id, name: data.name || 'RACER',
        x: data.x, y: data.y, z: data.z, h: data.h,
        tx: data.x, ty: data.y, tz: data.z, th: data.h,
        sf: data.sf || 0, ho: data.ho || 0, tho: data.ho || 0,
        lap: data.lap || 1, fin: !!data.fin, ft: data.ft != null ? data.ft : null
      };
      Net.remoteStates.set(data.id, st);
    } else {
      st.name = data.name || st.name;
      st.tx = data.x; st.ty = data.y; st.tz = data.z; st.th = data.h;
      st.sf = data.sf || 0; st.tho = data.ho || 0;
      st.lap = data.lap || 1; st.fin = !!data.fin;
      st.ft = data.ft != null ? data.ft : null;
    }
  }

  function handleMsg(data) {
    if (!data || !data.t) return;

    if (data.t === 'joined') {
      Net.role = data.role;
      Net.localId = data.id;
      Net.roomCode = data.code;
      applyRoster(data.players);
      if (data.settings) applyLobbySettings(data.settings);
      if (Net.role === 'host') syncLobbySettings();
      startPing();
      return;
    }

    if (data.t === 'roster') {
      if (data.code) Net.roomCode = data.code;
      applyRoster(data.players);
      return;
    }

    if (data.t === 'settings') {
      applyLobbySettings(data);
      return;
    }

    if (data.t === 'start') {
      Net._raceLive = true;
      Net.startCbs.forEach(cb => { try { cb(data); } catch (e) {} });
      return;
    }

    if (data.t === 'lobby') {
      markRaceEnded();
      if (data.players) applyRoster(data.players);
      if (data.settings) applyLobbySettings(data.settings);
      if (typeof enterOnlineLobbyUI === 'function') enterOnlineLobbyUI();
      emitLobby();
      return;
    }

    if (data.t === 's') {
      ingestRemoteState(data);
      return;
    }

    if (data.t === 'pong') {
      if (Net._pingSentAt) {
        Net.pingMs = Math.max(1, Math.round(performance.now() - Net._pingSentAt));
        const pingEl = document.getElementById('netPing');
        if (pingEl) pingEl.textContent = Net.pingMs + ' ms';
        const hudPing = document.getElementById('hudNetPing');
        if (hudPing) hudPing.textContent = Net.pingMs + ' ms';
      }
      return;
    }

    if (data.t === 'reject') {
      alert(data.reason || 'Could not join');
      if (!Net.localId) {
        leave();
        navTo('menu-multi');
      }
      return;
    }

    if (data.t === 'bye') {
      const reason = data.reason || 'Disconnected';
      cleanup(false);
      alert(reason);
      if (typeof quitToMenu === 'function' && typeof gameState !== 'undefined' && gameState !== 'menu') quitToMenu();
      else navTo('menu-multi');
    }
  }

  function startPing() {
    if (Net._pingTimer) clearInterval(Net._pingTimer);
    Net._pingTimer = setInterval(() => {
      if (!Net.socket || !Net.socket.connected) return;
      Net._pingSentAt = performance.now();
      send({ t: 'ping', n: Net._pingSentAt });
    }, 2000);
  }

  function cleanup(sendBye) {
    Net._intentionalLeave = true;
    if (Net._pingTimer) { clearInterval(Net._pingTimer); Net._pingTimer = null; }
    if (sendBye && Net.socket && Net.socket.connected) {
      try { Net.socket.emit('msg', { t: 'bye' }); } catch (e) {}
    }
    if (Net.socket) {
      try {
        Net.socket.removeAllListeners();
        Net.socket.disconnect();
      } catch (e) {}
    }
    Net.socket = null;
    Net.role = null;
    Net.roomCode = null;
    Net.localId = null;
    Net.players.clear();
    Net.remoteStates.clear();
    Net._raceLive = false;
    Net.pingMs = 0;
    Net._intentionalLeave = false;
    emitLobby();
  }

  function leave() { cleanup(true); }

  function connectSocket() {
    return new Promise((resolve, reject) => {
      if (typeof io === 'undefined') {
        reject(new Error('socket.io missing'));
        return;
      }
      const socket = io({
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        timeout: 20000,
        forceNew: true
      });
      Net.socket = socket;
      let settled = false;

      socket.on('connect', () => {
        if (settled) return;
        settled = true;
        resolve(socket);
      });

      socket.on('msg', handleMsg);

      socket.on('connect_error', (err) => {
        if (settled) return;
        settled = true;
        reject(err || new Error('connect_error'));
      });

      socket.on('disconnect', () => {
        if (Net._intentionalLeave) return;
        if (!Net.role) return;
        const was = Net.role;
        cleanup(false);
        Net.discCbs.forEach(cb => { try { cb(); } catch (e) {} });
        alert('Lost connection to the game server.');
        if (was && typeof quitToMenu === 'function' && typeof gameState !== 'undefined' && gameState !== 'menu') quitToMenu();
        else navTo('menu-multi');
      });
    });
  }

  function showLobbyShell(asHost, code) {
    navTo('menu-lobby');
    const statusEl = document.getElementById('netLobbyStatus');
    if (statusEl) statusEl.textContent = 'Connecting…';
    const codeEl = document.getElementById('netRoomCode');
    if (codeEl) codeEl.textContent = code || '----';
    const hostSettings = document.getElementById('lobbyHostSettings');
    const guestSummary = document.getElementById('lobbyGuestSummary');
    if (hostSettings) hostSettings.style.display = asHost ? '' : 'none';
    if (guestSummary) guestSummary.style.display = asHost ? 'none' : '';
    const startBtn = document.getElementById('netStartBtn');
    if (startBtn) startBtn.style.display = asHost ? '' : 'none';
    refreshLobbySettingsUI();
  }

  function hostRoom() {
    leave();
    if (!ensurePageOk()) return;
    Net.localName = playerName();
    showLobbyShell(true, '----');
    connectSocket()
      .then(() => send({ t: 'create', name: Net.localName, look: currentLook() }))
      .catch(() => {
        alert('Could not reach the game server.\n\nWait for Render to finish deploying, hard-refresh (Ctrl+F5), then try again.\n\nLocal: use START MAXIKART.bat → http://127.0.0.1:8765');
        leave();
        navTo('menu-multi');
      });
  }

  function joinRoom(code) {
    leave();
    if (!ensurePageOk()) return;
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (clean.length !== 4) {
      alert('Enter a 4-character room code');
      return;
    }
    const joinNameEl = document.getElementById('joinPlayerName');
    if (joinNameEl && joinNameEl.value) {
      Net.localName = String(joinNameEl.value).toUpperCase().slice(0, 12) || 'RACER';
      localStorage.setItem('kartPlayerName', Net.localName);
    } else {
      Net.localName = playerName();
    }
    showLobbyShell(false, clean);
    connectSocket()
      .then(() => send({ t: 'join', code: clean, name: Net.localName, look: currentLook() }))
      .catch(() => {
        alert('Could not reach the game server. Open the same Render/local URL as the host.');
        leave();
        navTo('menu-join');
      });
  }

  function setLocalName(raw) {
    const name = String(raw || 'RACER').toUpperCase().slice(0, 12) || 'RACER';
    Net.localName = name;
    localStorage.setItem('kartPlayerName', name);
    ['lbPlayerName', 'joinPlayerName', 'lobbyHostName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = name;
    });
    const p = Net.players.get(Net.localId);
    if (p) p.name = name;
    send({ t: 'rename', name });
    send({ t: 'look', look: currentLook() });
    emitLobby();
  }

  function syncLook() {
    if (!Net.role) return;
    const look = currentLook();
    const p = Net.players.get(Net.localId);
    if (p) p.look = look;
    send({ t: 'look', look });
  }

  function setReady(ready) {
    const p = Net.players.get(Net.localId);
    if (p) p.ready = !!ready;
    send({ t: 'ready', ready: !!ready });
    emitLobby();
  }

  function toggleReady() {
    const p = Net.players.get(Net.localId);
    setReady(!(p && p.ready));
  }

  function startRace() {
    if (Net.role !== 'host') return;
    if (!allPlayersReady()) {
      alert('Everyone must ready up before starting.');
      emitLobby();
      return;
    }
    syncLobbySettings();
    send({ t: 'start' });
  }

  function pushLocalState(state) {
    if (!Net.role || !Net._raceLive) return;
    const now = performance.now();
    if (now - Net._lastSend < STATE_MS) return;
    Net._lastSend = now;
    send({
      t: 's',
      id: Net.localId,
      name: Net.localName,
      x: +state.x.toFixed(2),
      y: +state.y.toFixed(2),
      z: +state.z.toFixed(2),
      h: +state.h.toFixed(3),
      sf: +((state.sf || 0).toFixed(1)),
      ho: +((state.ho || 0).toFixed(2)),
      lap: state.lap || 1,
      fin: !!state.fin,
      ft: state.ft != null ? +Number(state.ft).toFixed(2) : null
    });
  }

  function tickRemotes(dt) {
    const alpha = Math.min(1, dt * 18);
    Net.remoteStates.forEach(st => {
      st.x = st.x + (st.tx - st.x) * alpha;
      st.y = st.y + (st.ty - st.y) * alpha;
      st.z = st.z + (st.tz - st.z) * alpha;
      let dh = st.th - st.h;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      st.h += dh * alpha;
      st.ho = st.ho + (st.tho - st.ho) * alpha;
    });
  }

  window.Net = {
    hostRoom, joinRoom, leave, startRace, setLocalName, toggleReady, setReady, syncLook,
    pushLocalState, getRemoteStates: () => Net.remoteStates, getPlayers,
    getLocalSlot: () => {
      const p = Net.players.get(Net.localId);
      return p ? p.slot : 0;
    },
    isOnline: () => !!Net.role,
    isHost: () => Net.role === 'host',
    inRace: () => Net._raceLive,
    getPing: () => Net.pingMs,
    onLobbyUpdate: (cb) => Net.lobbyCbs.push(cb),
    onRaceStart: (cb) => Net.startCbs.push(cb),
    onDisconnected: (cb) => Net.discCbs.push(cb),
    tickRemotes,
    getRoomCode: () => Net.roomCode,
    syncLobbySettings, refreshLobbySettingsUI, returnToLobby, markRaceEnded,
    MAX_PLAYERS
  };

  window.Net.onRaceStart(function (cfg) {
    if (typeof activeMapIndex !== 'undefined') activeMapIndex = cfg.map | 0;
    if (typeof setLaps === 'function') setLaps(cfg.laps | 0 || 3);
    if (window.settings) {
      settings.night = !!cfg.night;
      settings.weather = cfg.weather || 'clear';
      settings.items = cfg.items !== false;
      if (typeof saveConfig === 'function') saveConfig();
    }
    document.querySelectorAll('.weather-display').forEach(el => {
      const label = (window.RaceKit ? window.RaceKit.getWeather(settings.weather).label : settings.weather);
      el.textContent = String(label).toUpperCase();
    });
    if (typeof startGame === 'function') startGame('online');
  });

  (function prefNames() {
    const saved = localStorage.getItem('kartPlayerName') || '';
    ['hostPlayerName', 'joinPlayerName', 'lbPlayerName', 'lobbyHostName'].forEach(id => {
      const el = document.getElementById(id);
      if (el && saved && !el.value) el.value = saved;
    });
  })();
})();
