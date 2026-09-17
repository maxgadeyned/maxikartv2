// =========================================================
// MAXIKART — Coin economy, loot boxes, daily rewards,
// pity counter, and local per-map leaderboards.
// Never touches physics or race logic.
// =========================================================

(function() {
  const LOOTBOX_COST = 150;
  const PITY_THRESHOLD = 10; // guaranteed rare+ every N opens without rare+
  const DAILY_LOGIN_BASE = 75;
  const DAILY_CHALLENGE_REWARD = 120;
  const LEADERBOARD_SIZE = 10;

  const MAP_PAYOUT = { neon: 40, tiburtina: 55, knot: 70, overpass: 75 };
  const MAP_PAR_TIME = { neon: 95, tiburtina: 130, knot: 150, overpass: 145 };
  const DUPLICATE_REFUND = { common: 15, uncommon: 30, rare: 60, epic: 120, legendary: 300, mythic: 800 };

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------------- Wallet ----------------
  function loadCoins() {
    const v = parseInt(localStorage.getItem('kartCoins'), 10);
    return Number.isFinite(v) ? v : 0;
  }
  let coins = loadCoins();
  function saveCoins() { localStorage.setItem('kartCoins', String(coins)); refreshCoinUI(); }
  function addCoins(n) { coins = Math.max(0, coins + Math.round(n)); saveCoins(); }
  function spendCoins(n) { if (coins < n) return false; coins -= n; saveCoins(); return true; }

  function refreshCoinUI() {
    document.querySelectorAll('.coin-value').forEach(el => el.textContent = coins.toLocaleString());
    const openBtn = document.getElementById('lootOpenBtn');
    if (openBtn) openBtn.classList.toggle('disabled', coins < LOOTBOX_COST);
    refreshPityUI();
    refreshDailyUI();
  }

  // ---------------- Pity ----------------
  function loadPity() {
    const v = parseInt(localStorage.getItem('kartPity'), 10);
    return Number.isFinite(v) ? v : 0;
  }
  let pityCount = loadPity();
  function savePity() { localStorage.setItem('kartPity', String(pityCount)); refreshPityUI(); }

  function refreshPityUI() {
    const el = document.getElementById('pityCounter');
    if (!el) return;
    const left = Math.max(0, PITY_THRESHOLD - pityCount);
    el.textContent = left === 0
      ? 'Pity ready — next box is Rare+'
      : `Pity: ${pityCount}/${PITY_THRESHOLD} (Rare+ in ${left})`;
  }

  // ---------------- Daily login + challenge ----------------
  function loadDaily() {
    let d;
    try { d = JSON.parse(localStorage.getItem('kartDaily')); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') {
      d = { lastLogin: null, streak: 0, challengeDate: null, challengeDone: false, challengeId: null };
    }
    return d;
  }
  let daily = loadDaily();
  function saveDaily() { localStorage.setItem('kartDaily', JSON.stringify(daily)); }

  const CHALLENGES = [
    { id: 'any_tt', label: 'Finish any Time Trial', check: (r) => r.mode === 'timed' && !r.tainted },
    { id: 'neon_tt', label: 'Finish Time Trial on Neon Labyrinth', check: (r) => r.mode === 'timed' && !r.tainted && r.mapId === 'neon' },
    { id: 'fast_finish', label: 'Finish a Time Trial under 2:30', check: (r) => r.mode === 'timed' && !r.tainted && r.time < 150 },
    { id: 'triple_lap', label: 'Complete a 3-lap Time Trial', check: (r) => r.mode === 'timed' && !r.tainted && r.laps === 3 }
  ];

  function pickDailyChallenge() {
    const idx = (new Date().getDate() + new Date().getMonth() * 31) % CHALLENGES.length;
    return CHALLENGES[idx];
  }

  function ensureDailyChallenge() {
    const today = todayKey();
    if (daily.challengeDate !== today) {
      daily.challengeDate = today;
      daily.challengeDone = false;
      daily.challengeId = pickDailyChallenge().id;
      saveDaily();
    }
  }

  function getChallenge() {
    ensureDailyChallenge();
    return CHALLENGES.find(c => c.id === daily.challengeId) || CHALLENGES[0];
  }

  function claimDailyLogin() {
    const today = todayKey();
    if (daily.lastLogin === today) return { ok: false, reason: 'already' };

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    daily.streak = (daily.lastLogin === yKey) ? (daily.streak || 0) + 1 : 1;
    daily.lastLogin = today;
    saveDaily();

    const bonus = DAILY_LOGIN_BASE + Math.min(75, (daily.streak - 1) * 15);
    addCoins(bonus);
    if (window.playUIChime) window.playUIChime();
    refreshDailyUI();
    return { ok: true, amount: bonus, streak: daily.streak };
  }

  function tryCompleteChallenge(result) {
    ensureDailyChallenge();
    if (daily.challengeDone) return;
    const ch = getChallenge();
    if (!ch.check(result)) return;
    daily.challengeDone = true;
    saveDaily();
    addCoins(DAILY_CHALLENGE_REWARD);
    refreshDailyUI();
    const note = document.getElementById('finishCoinsEarned');
    if (note) {
      const prev = note.textContent || '';
      note.textContent = (prev ? prev + ' · ' : '') + `Daily challenge +${DAILY_CHALLENGE_REWARD}`;
    }
  }

  function refreshDailyUI() {
    ensureDailyChallenge();
    const today = todayKey();
    const loginBtn = document.getElementById('dailyLoginBtn');
    const loginStatus = document.getElementById('dailyLoginStatus');
    const challengeEl = document.getElementById('dailyChallengeText');
    const challengeStatus = document.getElementById('dailyChallengeStatus');
    const streakEl = document.getElementById('dailyStreak');

    if (streakEl) streakEl.textContent = `Streak: ${daily.streak || 0} day${(daily.streak || 0) === 1 ? '' : 's'}`;

    if (loginBtn) {
      const claimed = daily.lastLogin === today;
      loginBtn.classList.toggle('disabled', claimed);
      loginBtn.textContent = claimed ? 'Login Bonus Claimed' : `Claim Daily Login (+${DAILY_LOGIN_BASE}+)`;
    }
    if (loginStatus) {
      loginStatus.textContent = daily.lastLogin === today
        ? `Claimed today · streak ${daily.streak}`
        : 'Ready to claim';
    }
    const ch = getChallenge();
    if (challengeEl) challengeEl.textContent = ch.label + ` — +${DAILY_CHALLENGE_REWARD} 🪙`;
    if (challengeStatus) {
      challengeStatus.textContent = daily.challengeDone ? 'COMPLETE' : 'In progress';
      challengeStatus.className = 'daily-status' + (daily.challengeDone ? ' done' : '');
    }
  }

  // ---------------- Payout on race finish ----------------
  const sessionFinishCounts = {};

  function computePayout(mapId, time, laps) {
    const base = MAP_PAYOUT[mapId] || 40;
    const par = (MAP_PAR_TIME[mapId] || 100) * (laps / 3);
    const ratio = par / Math.max(0.01, time);

    let mult;
    if (ratio >= 1.15) mult = 3.0;
    else if (ratio >= 1.0) mult = 2.0;
    else if (ratio >= 0.85) mult = 1.4;
    else if (ratio >= 0.7) mult = 1.0;
    else mult = 0.5;

    const key = mapId + '_' + laps;
    const count = sessionFinishCounts[key] || 0;
    sessionFinishCounts[key] = count + 1;
    const farmDecay = count > 2 ? Math.max(0.4, 1 - (count - 2) * 0.15) : 1;

    return Math.max(1, Math.round(base * mult * farmDecay));
  }

  window.onRaceFinish = function(result) {
    tryCompleteChallenge(result);

    if (result.mode !== 'timed') return;
    const note = document.getElementById('finishCoinsEarned');
    if (result.tainted) {
      if (note) note.textContent = 'Run invalid — no coins (track cut detected)';
      return;
    }
    const payout = computePayout(result.mapId, result.time, result.laps);
    addCoins(payout);
    if (note) {
      const extra = note.textContent && note.textContent.indexOf('Daily') >= 0 ? ' · ' + note.textContent : '';
      note.textContent = `+${payout} coins earned` + extra;
    }
  };

  // ---------------- Loot boxes + pity ----------------
  function rollRarity(forceRarePlus) {
    const table = window.Cosmetics.RARITY;
    const rank = window.Cosmetics.RARITY_RANK;
    let entries = Object.entries(table);
    if (forceRarePlus) {
      entries = entries.filter(([key]) => rank[key] >= rank.rare);
    }
    const total = entries.reduce((s, [, r]) => s + r.weight, 0);
    let roll = Math.random() * total;
    for (const [key, r] of entries) {
      if (roll < r.weight) return key;
      roll -= r.weight;
    }
    return entries[entries.length - 1][0];
  }

  function openLootBox() {
    if (!spendCoins(LOOTBOX_COST)) return null;
    const forcePity = pityCount >= PITY_THRESHOLD - 1;
    const rarity = rollRarity(forcePity);
    const rank = window.Cosmetics.RARITY_RANK[rarity] || 0;

    if (rank >= window.Cosmetics.RARITY_RANK.rare) pityCount = 0;
    else pityCount += 1;
    savePity();

    // Prefer categories the player is missing pieces in (better customization progression)
    const cats = window.Cosmetics.CATEGORIES;
    const missing = cats.map(cat => ({
      cat,
      need: window.Cosmetics.itemsByCategory(cat).filter(i => i.rarity === rarity && !window.Cosmetics.isOwned(i.id)).length
    })).filter(c => c.need > 0);
    let pool = window.Cosmetics.ITEM_CATALOG.filter(i => i.rarity === rarity);
    if (missing.length && Math.random() < 0.65) {
      const pick = missing[Math.floor(Math.random() * missing.length)].cat;
      const focused = pool.filter(i => i.category === pick);
      if (focused.length) pool = focused;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    const alreadyOwned = window.Cosmetics.isOwned(item.id);
    let dupeRefund = 0;
    if (alreadyOwned) {
      dupeRefund = DUPLICATE_REFUND[rarity] || 0;
      addCoins(dupeRefund);
    } else {
      window.Cosmetics.grantItem(item.id);
    }
    return { item, rarity, alreadyOwned, dupeRefund, pity: forcePity };
  }

  // ---------------- Reveal UI (CS-style case roller) ----------------
  const SLOT_LABELS = {
    build: 'Chassis',
    colour: 'Paint',
    wheels: 'Wheels',
    driver: 'Helmet',
    accent: 'Accent'
  };
  const CASE_CARD_W = 108;
  const CASE_GAP = 8;
  const CASE_STEP = CASE_CARD_W + CASE_GAP;
  const CASE_WIN_INDEX = 38;
  const CASE_STRIP_LEN = 48;

  let revealBusy = false;
  let caseTickTimer = 0;

  function categoryLabel(cat) {
    return SLOT_LABELS[cat] || String(cat || 'Item').toUpperCase();
  }

  function pickFillerItem(excludeId) {
    const catalog = window.Cosmetics.ITEM_CATALOG;
    let guard = 0;
    while (guard++ < 40) {
      const item = catalog[Math.floor(Math.random() * catalog.length)];
      if (item && item.id !== excludeId) return item;
    }
    return catalog[0];
  }

  function buildCaseCard(item, isWinner) {
    const rarity = window.Cosmetics.RARITY[item.rarity] || window.Cosmetics.RARITY.common;
    const el = document.createElement('div');
    el.className = 'case-card' + (isWinner ? ' winner' : '');
    el.style.setProperty('--rarity-color', rarity.color);
    el.innerHTML =
      `<div class="case-card-cat">${categoryLabel(item.category)}</div>` +
      `<div class="case-card-swatch" style="background:${swatchColorFor(item)}"></div>` +
      `<div class="case-card-name">${item.name}</div>` +
      `<div class="case-card-rarity">${rarity.label}</div>`;
    return el;
  }

  function playCaseTick() {
    const vol = window.audioVol ? window.audioVol('ui') : 0.4;
    if (vol <= 0) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880 + Math.random() * 220;
      gain.gain.setValueAtTime(0.035 * vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  }

  function resetCaseUI() {
    clearTimeout(caseTickTimer);
    caseTickTimer = 0;
    const idle = document.getElementById('caseIdle');
    const roller = document.getElementById('caseRoller');
    const track = document.getElementById('caseTrack');
    const reveal = document.getElementById('lootReveal');
    const icon = document.getElementById('lootBoxIcon');
    if (idle) idle.hidden = false;
    if (roller) roller.hidden = true;
    if (track) {
      track.style.transition = 'none';
      track.style.transform = 'translate3d(0,0,0)';
      track.innerHTML = '';
    }
    if (reveal) reveal.className = 'loot-reveal';
    if (icon) icon.classList.remove('shaking');
  }

  function showCaseResult(result) {
    const reveal = document.getElementById('lootReveal');
    if (!reveal) return;
    if (window.playLootReveal) window.playLootReveal(result.rarity);

    const rarity = window.Cosmetics.RARITY[result.rarity];
    const slotEl = document.getElementById('revealSlot');
    if (slotEl) slotEl.textContent = categoryLabel(result.item.category).toUpperCase();
    document.getElementById('revealRarity').textContent = rarity.label + (result.pity ? ' (PITY)' : '');
    document.getElementById('revealRarity').style.color = rarity.color;
    document.getElementById('revealSwatch').style.background = swatchColorFor(result.item);
    document.getElementById('revealSwatch').style.setProperty('--rarity-color', rarity.color);
    document.getElementById('revealName').textContent = result.item.name;
    document.getElementById('revealDupe').textContent = result.alreadyOwned
      ? `Duplicate — converted to +${result.dupeRefund} coins`
      : 'NEW ITEM UNLOCKED';
    reveal.className = 'loot-reveal show rarity-' + result.rarity;
  }

  function openBoxUI() {
    if (revealBusy) return;
    if (coins < LOOTBOX_COST) { flashInsufficientFunds(); return; }

    const idle = document.getElementById('caseIdle');
    const roller = document.getElementById('caseRoller');
    const track = document.getElementById('caseTrack');
    const reveal = document.getElementById('lootReveal');
    const icon = document.getElementById('lootBoxIcon');
    if (!track || !roller || !reveal) return;

    revealBusy = true;
    reveal.className = 'loot-reveal';
    if (icon) icon.classList.add('shaking');

    const result = openLootBox();
    if (!result) {
      revealBusy = false;
      if (icon) icon.classList.remove('shaking');
      refreshCoinUI();
      return;
    }

    const strip = [];
    for (let i = 0; i < CASE_STRIP_LEN; i++) {
      strip.push(i === CASE_WIN_INDEX ? result.item : pickFillerItem(result.item.id));
    }
    track.innerHTML = '';
    strip.forEach((item, i) => track.appendChild(buildCaseCard(item, i === CASE_WIN_INDEX)));

    setTimeout(() => {
      if (idle) idle.hidden = true;
      roller.hidden = false;
      if (icon) icon.classList.remove('shaking');

      const windowEl = roller.querySelector('.case-window');
      const winW = (windowEl && windowEl.clientWidth) || roller.clientWidth || 560;
      const jitter = (Math.random() - 0.5) * (CASE_CARD_W * 0.5);
      const targetX = (winW / 2) - (CASE_WIN_INDEX * CASE_STEP + CASE_CARD_W / 2) - jitter;
      const duration = 5200;

      track.style.transition = 'none';
      track.style.transform = 'translate3d(0px,0,0)';
      void track.offsetWidth;

      // Slow tick while spinning
      let tickDelay = 55;
      clearTimeout(caseTickTimer);
      const scheduleTick = () => {
        caseTickTimer = setTimeout(() => {
          playCaseTick();
          tickDelay = Math.min(180, tickDelay + 8);
          scheduleTick();
        }, tickDelay);
      };
      scheduleTick();

      requestAnimationFrame(() => {
        track.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.7, 0.1, 1)`;
        track.style.transform = `translate3d(${targetX}px,0,0)`;
      });

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(caseTickTimer);
        caseTickTimer = 0;
        const finalX = (winW / 2) - (CASE_WIN_INDEX * CASE_STEP + CASE_CARD_W / 2);
        track.style.transition = 'transform 180ms ease-out';
        track.style.transform = `translate3d(${finalX}px,0,0)`;
        showCaseResult(result);
        setTimeout(() => {
          resetCaseUI();
          revealBusy = false;
          refreshCoinUI();
        }, 2800);
      };

      const onEnd = (e) => {
        if (e && e.propertyName && e.propertyName !== 'transform') return;
        if (e && e.target !== track) return;
        track.removeEventListener('transitionend', onEnd);
        finish();
      };
      track.addEventListener('transitionend', onEnd);
      setTimeout(() => {
        track.removeEventListener('transitionend', onEnd);
        finish();
      }, duration + 450);
    }, 380);
  }

  function swatchColorFor(item) {
    const p = item.payload || {};
    if (p.bodyColor) return p.bodyColor;
    if (p.wheelColor) return p.wheelColor;
    if (p.driverHelmet) return p.driverHelmet;
    if (p.accentColor) return p.accentColor;
    if (item.category === 'build') return '#37e6c8';
    return '#2b2d33';
  }

  function flashInsufficientFunds() {
    if (window.playWarningBuzz) window.playWarningBuzz();
    const btn = document.getElementById('lootOpenBtn');
    if (!btn) return;
    btn.classList.add('shaking');
    setTimeout(() => btn.classList.remove('shaking'), 350);
  }

  // ---------------- Leaderboards (local + global) ----------------
  const LB_MAPS = [
    { id: 'neon', name: 'NEON LABYRINTH' },
    { id: 'tiburtina', name: 'TIBURTINA SPRINT' },
    { id: 'knot', name: 'KNOT CIRCUIT' },
    { id: 'overpass', name: 'OVERPASS' }
  ];
  const LB_LAPS = [1, 3, 5];
  let lbMapIndex = 0;
  let lbLapIndex = 1; // default 3 laps

  function lbKey(mapId, laps) { return `kartLB_${mapId}_${laps}`; }

  function loadBoard(mapId, laps) {
    try {
      const raw = JSON.parse(localStorage.getItem(lbKey(mapId, laps)));
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  function saveBoard(mapId, laps, board) {
    localStorage.setItem(lbKey(mapId, laps), JSON.stringify(board.slice(0, LEADERBOARD_SIZE)));
  }

  function getPlayerName() {
    if (window.Account && Account.getName) return Account.getName();
    let name = localStorage.getItem('kartPlayerName');
    if (!name) {
      name = 'RACER';
      localStorage.setItem('kartPlayerName', name);
    }
    return name;
  }

  function setPlayerName(name) {
    const clean = String(name || 'RACER').trim().slice(0, 12).toUpperCase() || 'RACER';
    localStorage.setItem('kartPlayerName', clean);
    if (window.Account && Account.syncNameInputs) Account.syncNameInputs();
    return clean;
  }

  function submitLeaderboard(mapId, laps, time) {
    if (!Number.isFinite(time) || time <= 0) return Promise.resolve(null);
    const board = loadBoard(mapId, laps);
    const entry = { name: getPlayerName(), time, date: todayKey() };
    board.push(entry);
    board.sort((a, b) => a.time - b.time);
    const trimmed = board.slice(0, LEADERBOARD_SIZE);
    saveBoard(mapId, laps, trimmed);
    const localRank = trimmed.findIndex(e => e === entry || (e.name === entry.name && e.time === entry.time && e.date === entry.date)) + 1;
    const localOk = localRank > 0 && localRank <= LEADERBOARD_SIZE ? localRank : null;

    if (window.Account && Account.isSignedIn && Account.isSignedIn() && Account.submitGlobal) {
      return Account.submitGlobal(mapId, laps, time).then(result => {
        if (result && result.ok && result.rank) return result.rank;
        return localOk;
      }).catch(() => localOk);
    }
    return Promise.resolve(localOk);
  }

  function paintBoardRows(list, board, emptyMsg) {
    if (!board.length) {
      list.innerHTML = `<div class="lb-empty">${emptyMsg}</div>`;
      return;
    }
    list.innerHTML = board.map((e, i) => `
      <div class="lb-row">
        <span class="lb-rank">#${e.rank || (i + 1)}</span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-time">${typeof formatTime === 'function' ? formatTime(e.time) : e.time.toFixed(2)}</span>
      </div>
    `).join('');
  }

  function syncLbSelectors() {
    const map = LB_MAPS[lbMapIndex] || LB_MAPS[0];
    const laps = LB_LAPS[lbLapIndex] || 3;
    const mapEl = document.getElementById('lbMapDisplay');
    const lapEl = document.getElementById('lbLapDisplay');
    if (mapEl) mapEl.textContent = map.name;
    if (lapEl) lapEl.textContent = laps + (laps === 1 ? ' LAP' : ' LAPS');
  }

  function cycleLbMap(dir) {
    lbMapIndex = (lbMapIndex + dir + LB_MAPS.length) % LB_MAPS.length;
    syncLbSelectors();
    renderLeaderboardUI();
  }

  function cycleLbLaps(dir) {
    lbLapIndex = (lbLapIndex + dir + LB_LAPS.length) % LB_LAPS.length;
    syncLbSelectors();
    renderLeaderboardUI();
  }

  async function renderLeaderboardUI() {
    const list = document.getElementById('lbList');
    const scope = document.getElementById('lbScopeNote');
    if (!list) return;
    syncLbSelectors();
    const map = LB_MAPS[lbMapIndex] || LB_MAPS[0];
    const laps = LB_LAPS[lbLapIndex] || 3;
    list.innerHTML = '<div class="lb-empty">Loading…</div>';
    if (scope) scope.textContent = 'GLOBAL';

    try {
      if (window.Account && Account.fetchGlobalBoard) {
        const board = await Account.fetchGlobalBoard(map.id, laps);
        if (scope) scope.textContent = 'GLOBAL';
        paintBoardRows(list, board, 'No global times yet — sign in and finish a Time Trial!');
        return;
      }
    } catch (_e) {
      /* fall through to local */
    }

    if (scope) scope.textContent = 'LOCAL (offline)';
    paintBoardRows(list, loadBoard(map.id, laps), 'No times yet — finish a Time Trial!');
  }

  window.Leaderboards = {
    submit: submitLeaderboard,
    get: loadBoard,
    render: renderLeaderboardUI,
    getPlayerName, setPlayerName,
    cycleMap: cycleLbMap,
    cycleLaps: cycleLbLaps
  };

  window.Economy = {
    LOOTBOX_COST, PITY_THRESHOLD,
    getCoins: () => coins, addCoins, spendCoins, computePayout,
    openLootBox, openBoxUI, refreshCoinUI,
    claimDailyLogin, refreshDailyUI, getPity: () => pityCount
  };

  document.getElementById('lootBoxPrice').textContent = LOOTBOX_COST;
  refreshCoinUI();
  refreshDailyUI();

  window.DevTools = {
    isLocal() {
      const h = (location.hostname || '').toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
    },
    /** Localhost, or signed-in account flagged by server (DEV_USERNAMES). */
    isAllowed() {
      if (this.isLocal()) return true;
      const u = window.Account && Account.getUser && Account.getUser();
      return !!(u && u.devTools);
    },
    refreshUI() {
      const devSection = document.getElementById('devToolsSection');
      if (devSection) devSection.style.display = this.isAllowed() ? '' : 'none';
    },
    unlockAll() {
      if (!this.isAllowed()) {
        const note = document.getElementById('devToolsNote');
        if (note) note.textContent = 'Dev tools locked — localhost or whitelisted account only.';
        return 0;
      }
      const n = window.Cosmetics && Cosmetics.unlockAllCosmetics
        ? Cosmetics.unlockAllCosmetics()
        : 0;
      if (window.Garage && Garage.refresh) Garage.refresh();
      const note = document.getElementById('devToolsNote');
      if (note) note.textContent = n > 0
        ? `Unlocked ${n} new cosmetics — check the Garage.`
        : 'All cosmetics already unlocked.';
      return n;
    },
    grantCoins(amount) {
      if (!this.isAllowed()) {
        const note = document.getElementById('devToolsNote');
        if (note) note.textContent = 'Dev tools locked — localhost or whitelisted account only.';
        return coins;
      }
      const n = Math.max(0, Math.round(Number(amount) || 0));
      addCoins(n);
      const note = document.getElementById('devToolsNote');
      if (note) note.textContent = `Added ${n.toLocaleString()} coins. Balance: ${coins.toLocaleString()}`;
      return coins;
    }
  };

  window.DevTools.refreshUI();
  document.addEventListener('account-updated', () => window.DevTools.refreshUI());

  // Refresh leaderboard / daily when menus open
  const lbMenu = document.getElementById('menu-leaderboard');
  if (lbMenu) {
    const obs = new MutationObserver(() => {
      if (lbMenu.classList.contains('active')) renderLeaderboardUI();
    });
    obs.observe(lbMenu, { attributes: true, attributeFilter: ['class'] });
  }
  const dailyMenu = document.getElementById('menu-daily');
  if (dailyMenu) {
    const obs = new MutationObserver(() => {
      if (dailyMenu.classList.contains('active')) refreshDailyUI();
    });
    obs.observe(dailyMenu, { attributes: true, attributeFilter: ['class'] });
  }
})();
