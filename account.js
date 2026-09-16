/* Account — guest play + Google / PIN login, saved racer name */
(function () {
  const SESSION_KEY = 'kartSession';
  const NAME_KEY = 'kartPlayerName';

  const Account = {
    user: null,
    token: null,
    googleClientId: null,
    googleReady: false,
    _cfgLoaded: false
  };

  function apiBase() {
    return '';
  }

  function headers(auth) {
    const h = { 'Content-Type': 'application/json' };
    if (auth && Account.token) h.Authorization = 'Bearer ' + Account.token;
    return h;
  }

  async function api(path, opts) {
    const res = await fetch(apiBase() + path, opts);
    let body = null;
    try { body = await res.json(); } catch (_e) { body = null; }
    return { res, body };
  }

  function loadSession() {
    Account.token = localStorage.getItem(SESSION_KEY) || null;
  }

  function saveSession(token, user) {
    Account.token = token || null;
    Account.user = user || null;
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
    if (user && user.name) applyNameLocally(user.name);
    refreshAccountUI();
    syncNameInputs();
  }

  function applyNameLocally(name) {
    const clean = String(name || 'RACER').toUpperCase().replace(/[^A-Z0-9_\- ]/g, '').trim().slice(0, 12) || 'RACER';
    localStorage.setItem(NAME_KEY, clean);
    if (window.Leaderboards && Leaderboards.setPlayerName) Leaderboards.setPlayerName(clean);
    return clean;
  }

  function getName() {
    if (Account.user && Account.user.name) return Account.user.name;
    return localStorage.getItem(NAME_KEY) || 'RACER';
  }

  function syncNameInputs() {
    const name = getName();
    ['lbPlayerName', 'joinPlayerName', 'lobbyHostName', 'hostPlayerName', 'accountNameInput', 'accountNameInputGuest', 'accountRegName', 'accountLoginName'].forEach(id => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = name;
    });
  }

  function isSignedIn() {
    return !!(Account.token && Account.user);
  }

  async function loadConfig() {
    try {
      const { body } = await api('/api/config');
      if (body && body.ok) {
        Account.googleClientId = body.googleClientId || null;
        Account._cfgLoaded = true;
        if (Account.googleClientId) ensureGoogleScript();
      }
    } catch (_e) {
      Account._cfgLoaded = true;
    }
    refreshAccountUI();
  }

  async function refreshMe() {
    loadSession();
    if (!Account.token) {
      Account.user = null;
      refreshAccountUI();
      return;
    }
    try {
      const { res, body } = await api('/api/me', { headers: headers(true) });
      if (res.ok && body && body.user) {
        Account.user = body.user;
        applyNameLocally(body.user.name);
      } else {
        saveSession(null, null);
      }
    } catch (_e) {
      /* keep token; server may be waking */
    }
    refreshAccountUI();
    syncNameInputs();
  }

  function ensureGoogleScript() {
    if (document.getElementById('gisScript')) return;
    const s = document.createElement('script');
    s.id = 'gisScript';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      Account.googleReady = true;
      renderGoogleButton();
    };
    document.head.appendChild(s);
  }

  function renderGoogleButton() {
    const host = document.getElementById('googleSignInBtn');
    if (!host || !Account.googleClientId || !window.google || !google.accounts || !google.accounts.id) return;
    host.innerHTML = '';
    google.accounts.id.initialize({
      client_id: Account.googleClientId,
      callback: handleGoogleCredential
    });
    google.accounts.id.renderButton(host, {
      theme: 'filled_black',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: 280
    });
  }

  async function handleGoogleCredential(response) {
    try {
      const { res, body } = await api('/api/auth/google', {
        method: 'POST',
        headers: headers(false),
        body: JSON.stringify({ credential: response.credential })
      });
      if (!res.ok || !body || !body.ok) {
        alert(accountError(body && body.error));
        return;
      }
      saveSession(body.token, body.user);
      if (window.playUIChime) playUIChime();
    } catch (_e) {
      alert('Could not reach account server.');
    }
  }

  function accountError(code) {
    const map = {
      'name-taken': 'That racer name is taken.',
      'bad-pin': 'PIN must be 4–6 digits.',
      'bad-login': 'Wrong name or PIN.',
      'google-disabled': 'Google sign-in is not configured on the server yet.',
      'bad-google-token': 'Google login failed. Try again.',
      auth: 'Please sign in first.',
      'time-too-fast': 'Time rejected by anticheat.'
    };
    return map[code] || ('Error: ' + (code || 'unknown'));
  }

  async function registerPin() {
    const nameEl = document.getElementById('accountRegName');
    const pinEl = document.getElementById('accountRegPin');
    const name = nameEl ? nameEl.value : '';
    const pin = pinEl ? pinEl.value : '';
    try {
      const { res, body } = await api('/api/auth/register', {
        method: 'POST',
        headers: headers(false),
        body: JSON.stringify({ name, pin })
      });
      if (!res.ok || !body || !body.ok) {
        alert(accountError(body && body.error));
        return;
      }
      saveSession(body.token, body.user);
      if (pinEl) pinEl.value = '';
      if (window.playUIChime) playUIChime();
    } catch (_e) {
      alert('Could not reach account server.');
    }
  }

  async function loginPin() {
    const nameEl = document.getElementById('accountLoginName');
    const pinEl = document.getElementById('accountLoginPin');
    const name = nameEl ? nameEl.value : getName();
    const pin = pinEl ? pinEl.value : '';
    try {
      const { res, body } = await api('/api/auth/login', {
        method: 'POST',
        headers: headers(false),
        body: JSON.stringify({ name, pin })
      });
      if (!res.ok || !body || !body.ok) {
        alert(accountError(body && body.error));
        return;
      }
      saveSession(body.token, body.user);
      if (pinEl) pinEl.value = '';
      if (window.playUIChime) playUIChime();
    } catch (_e) {
      alert('Could not reach account server.');
    }
  }

  async function saveDisplayName() {
    const input = document.getElementById('accountNameInput') || document.getElementById('accountNameInputGuest');
    const name = input ? input.value : getName();
    if (!isSignedIn()) {
      applyNameLocally(name);
      syncNameInputs();
      refreshAccountUI();
      if (window.playUIChime) playUIChime();
      return;
    }
    try {
      const { res, body } = await api('/api/account/name', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ name })
      });
      if (!res.ok || !body || !body.ok) {
        alert(accountError(body && body.error));
        return;
      }
      Account.user = body.user;
      applyNameLocally(body.user.name);
      syncNameInputs();
      refreshAccountUI();
      if (window.playUIChime) playUIChime();
    } catch (_e) {
      alert('Could not save name.');
    }
  }

  function signOut() {
    saveSession(null, null);
    refreshAccountUI();
    if (window.playUIChime) playUIChime();
  }

  function continueAsGuest() {
    if (window.playUIChime) playUIChime();
    if (typeof navTo === 'function') navTo('menu-main');
  }

  function refreshAccountUI() {
    const status = document.getElementById('accountStatus');
    const signed = document.getElementById('accountSignedPanel');
    const guest = document.getElementById('accountGuestPanel');
    const googleWrap = document.getElementById('accountGoogleWrap');
    const nameInput = document.getElementById('accountNameInput');
    const chip = document.getElementById('accountChip');

    if (nameInput && document.activeElement !== nameInput) nameInput.value = getName();
    const guestName = document.getElementById('accountNameInputGuest');
    if (guestName && document.activeElement !== guestName) guestName.value = getName();

    if (status) {
      if (isSignedIn()) {
        status.textContent = 'Signed in · ' + Account.user.name;
        status.classList.add('on');
      } else {
        status.textContent = 'Playing as guest — scores stay on this device until you sign in';
        status.classList.remove('on');
      }
    }
    if (signed) signed.style.display = isSignedIn() ? '' : 'none';
    if (guest) guest.style.display = isSignedIn() ? 'none' : '';
    if (googleWrap) {
      googleWrap.style.display = (!isSignedIn() && Account.googleClientId) ? '' : 'none';
      if (!isSignedIn() && Account.googleClientId && Account.googleReady) renderGoogleButton();
    }
    if (chip) {
      chip.textContent = isSignedIn() ? Account.user.name : 'GUEST';
      chip.classList.toggle('signed', isSignedIn());
    }

    const noGoogle = document.getElementById('accountNoGoogleHint');
    if (noGoogle) {
      noGoogle.style.display = (!isSignedIn() && Account._cfgLoaded && !Account.googleClientId) ? '' : 'none';
    }
  }

  async function fetchGlobalBoard(mapId, laps) {
    const { res, body } = await api(`/api/leaderboard?map=${encodeURIComponent(mapId)}&laps=${laps | 0}`);
    if (!res.ok || !body || !body.ok) throw new Error((body && body.error) || 'lb-failed');
    return body.board || [];
  }

  async function submitGlobal(mapId, laps, time) {
    if (!isSignedIn()) return { ok: false, error: 'auth' };
    const { res, body } = await api('/api/leaderboard/submit', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ map: mapId, laps, time })
    });
    if (!res.ok || !body || !body.ok) return { ok: false, error: (body && body.error) || 'submit-failed' };
    return body;
  }

  window.Account = {
    getName,
    isSignedIn: () => isSignedIn(),
    getUser: () => Account.user,
    refresh: refreshMe,
    refreshUI: refreshAccountUI,
    registerPin,
    loginPin,
    saveDisplayName,
    signOut,
    continueAsGuest,
    syncNameInputs,
    fetchGlobalBoard,
    submitGlobal,
    applyNameLocally
  };

  loadSession();
  loadConfig().then(refreshMe);
  window.addEventListener('DOMContentLoaded', () => {
    syncNameInputs();
    refreshAccountUI();
  });
  // Menus may already be in DOM (scripts at end of body)
  syncNameInputs();
  refreshAccountUI();

  const accountMenu = document.getElementById('menu-account');
  if (accountMenu) {
    const obs = new MutationObserver(() => {
      if (accountMenu.classList.contains('active')) {
        refreshMe();
        refreshAccountUI();
        if (Account.googleClientId && Account.googleReady) renderGoogleButton();
      }
    });
    obs.observe(accountMenu, { attributes: true, attributeFilter: ['class'] });
  }
})();
