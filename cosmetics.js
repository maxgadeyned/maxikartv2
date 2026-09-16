// =========================================================
// MAXIKART — Cosmetics catalog & inventory
// Purely visual. Never writes gameplay stats. Looks only.
// =========================================================

const RARITY = {
  common:    { label: 'Common',    color: '#9aa0a6', weight: 38 },
  uncommon:  { label: 'Uncommon',  color: '#3ecf6a', weight: 24 },
  rare:      { label: 'Rare',      color: '#3d9dff', weight: 18 },
  epic:      { label: 'Epic',      color: '#b34dff', weight: 12 },
  legendary: { label: 'Legendary', color: '#ffb238', weight: 6 },
  mythic:    { label: 'Mythic',    color: '#ff3d7a', weight: 2 }
};

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

// Payloads may only touch appearance fields:
// bodyColor, finish, glow, bodyScale, bodySilhouette, decals, wheelColor,
// driverHelmet, accentColor, decalGlowRing, chromeShimmer/mythicTrail flags.
const ITEM_CATALOG = [
  // BUILD — silhouette / decals only (same physics for every build)
  { id: 'build_stock',    category: 'build', rarity: 'common',    name: 'Stock Frame',
    payload: { bodyScale: { x: 1, y: 1, z: 1 }, bodySilhouette: 'stock', decalSpoiler: false, decalStripes: false } },
  { id: 'build_stripes',  category: 'build', rarity: 'uncommon',  name: 'Track Stripes',
    payload: { bodyScale: { x: 1, y: 1, z: 1 }, bodySilhouette: 'stock', decalSpoiler: false, decalStripes: true } },
  { id: 'build_wide',     category: 'build', rarity: 'rare',      name: 'Wide Body',
    payload: { bodyScale: { x: 1.18, y: 1, z: 1.05 }, bodySilhouette: 'wide', decalSpoiler: false, decalStripes: false } },
  { id: 'build_low',      category: 'build', rarity: 'epic',      name: 'Low Rider',
    payload: { bodyScale: { x: 1.05, y: 0.78, z: 1.12 }, bodySilhouette: 'low', decalSpoiler: false, decalStripes: true } },
  { id: 'build_spoiler',  category: 'build', rarity: 'legendary', name: 'Rear Spoiler Kit',
    payload: { bodyScale: { x: 1, y: 1, z: 1.08 }, bodySilhouette: 'wing', decalSpoiler: true, decalStripes: true } },
  { id: 'build_apex',     category: 'build', rarity: 'mythic',    name: 'Apex Prototype',
    payload: { bodyScale: { x: 1.18, y: 0.85, z: 1.15 }, bodySilhouette: 'apex', decalSpoiler: true, decalStripes: true } },
  { id: 'build_sprint',   category: 'build', rarity: 'rare',      name: 'Sprint Chassis',
    payload: { bodyScale: { x: 0.95, y: 0.92, z: 1.08 }, bodySilhouette: 'sprint', decalSpoiler: false, decalStripes: true } },
  { id: 'build_tank',     category: 'build', rarity: 'epic',      name: 'Tank Frame',
    payload: { bodyScale: { x: 1.22, y: 1.08, z: 1.0 }, bodySilhouette: 'tank', decalSpoiler: true, decalStripes: false } },

  // COLOUR
  { id: 'colour_teal',    category: 'colour', rarity: 'common',    name: 'Factory Teal',
    payload: { bodyColor: '#228b7a', finish: 'matte', glow: '#37c6b0' } },
  { id: 'colour_grey',    category: 'colour', rarity: 'common',    name: 'Steel Grey',
    payload: { bodyColor: '#6b7280', finish: 'matte', glow: '#9ca3af' } },
  { id: 'colour_cobalt',  category: 'colour', rarity: 'uncommon',  name: 'Cobalt Gloss',
    payload: { bodyColor: '#20a4f3', finish: 'gloss', glow: '#20a4f3' } },
  { id: 'colour_crimson', category: 'colour', rarity: 'uncommon',  name: 'Crimson Gloss',
    payload: { bodyColor: '#e2413a', finish: 'gloss', glow: '#ff5f3d' } },
  { id: 'colour_violet',  category: 'colour', rarity: 'rare',      name: 'Violet Storm',
    payload: { bodyColor: '#7c3aed', finish: 'gloss', glow: '#9400d3' } },
  { id: 'colour_lime',    category: 'colour', rarity: 'rare',      name: 'Toxic Lime',
    payload: { bodyColor: '#a3e635', finish: 'gloss', glow: '#a3e635' } },
  { id: 'colour_gold',    category: 'colour', rarity: 'epic',      name: 'Gold Metallic',
    payload: { bodyColor: '#ffd700', finish: 'metallic', glow: '#ffae00' } },
  { id: 'colour_space',   category: 'colour', rarity: 'epic',      name: 'Deep Space',
    payload: { bodyColor: '#1e1b4b', finish: 'metallic', glow: '#37e6c8' } },
  { id: 'colour_chrome',  category: 'colour', rarity: 'legendary', name: 'Chrome Elite',
    payload: { bodyColor: '#e5e4e2', finish: 'chrome', glow: '#ffffff' } },
  { id: 'colour_prism',   category: 'colour', rarity: 'mythic',    name: 'Prism Chrome',
    payload: { bodyColor: '#e5e4e2', finish: 'chrome', glow: '#ff2ec4' } },
  { id: 'colour_sunrise', category: 'colour', rarity: 'uncommon',  name: 'Sunrise Orange',
    payload: { bodyColor: '#f97316', finish: 'gloss', glow: '#fb923c' } },
  { id: 'colour_midnight',category: 'colour', rarity: 'rare',      name: 'Midnight Blue',
    payload: { bodyColor: '#0f172a', finish: 'metallic', glow: '#38bdf8' } },

  // WHEELS
  { id: 'wheels_stock',   category: 'wheels', rarity: 'common',    name: 'Stock Black',
    payload: { wheelColor: '#111111' } },
  { id: 'wheels_chrome',  category: 'wheels', rarity: 'uncommon',  name: 'Chrome Rim',
    payload: { wheelColor: '#cfd3d6' } },
  { id: 'wheels_red',     category: 'wheels', rarity: 'uncommon',  name: 'Red Accent',
    payload: { wheelColor: '#e2413a' } },
  { id: 'wheels_teal',    category: 'wheels', rarity: 'rare',      name: 'Neon Teal',
    payload: { wheelColor: '#37e6c8' } },
  { id: 'wheels_gold',    category: 'wheels', rarity: 'epic',      name: 'Gold Spokes',
    payload: { wheelColor: '#ffd700' } },
  { id: 'wheels_prism',   category: 'wheels', rarity: 'legendary', name: 'Prism White',
    payload: { wheelColor: '#f4f1ea' } },
  { id: 'wheels_void',    category: 'wheels', rarity: 'mythic',    name: 'Void Purple',
    payload: { wheelColor: '#2e1065' } },
  { id: 'wheels_ice',     category: 'wheels', rarity: 'rare',      name: 'Ice Blue',
    payload: { wheelColor: '#7dd3fc' } },

  // DRIVER
  { id: 'driver_rookie',  category: 'driver', rarity: 'common',    name: 'Rookie Helmet',
    payload: { driverHelmet: '#374151' } },
  { id: 'driver_white',   category: 'driver', rarity: 'common',    name: 'Pearl White',
    payload: { driverHelmet: '#f5f5f4' } },
  { id: 'driver_ash',     category: 'driver', rarity: 'common',    name: 'Ash Grey',
    payload: { driverHelmet: '#6b7280' } },
  { id: 'driver_blue',    category: 'driver', rarity: 'uncommon',  name: 'Blue Racer',
    payload: { driverHelmet: '#1d4ed8' } },
  { id: 'driver_forest',  category: 'driver', rarity: 'uncommon',  name: 'Forest Pilot',
    payload: { driverHelmet: '#166534' } },
  { id: 'driver_sky',     category: 'driver', rarity: 'uncommon',  name: 'Sky Cap',
    payload: { driverHelmet: '#38bdf8' } },
  { id: 'driver_sand',    category: 'driver', rarity: 'uncommon',  name: 'Desert Sand',
    payload: { driverHelmet: '#d6a56a' } },
  { id: 'driver_crimson', category: 'driver', rarity: 'rare',      name: 'Crimson Ace',
    payload: { driverHelmet: '#dc2626' } },
  { id: 'driver_violet',  category: 'driver', rarity: 'rare',      name: 'Violet Shade',
    payload: { driverHelmet: '#7c3aed' } },
  { id: 'driver_teal',    category: 'driver', rarity: 'rare',      name: 'Teal Visor',
    payload: { driverHelmet: '#0d9488' } },
  { id: 'driver_pink',    category: 'driver', rarity: 'rare',      name: 'Hot Pink',
    payload: { driverHelmet: '#db2777' } },
  { id: 'driver_navy',    category: 'driver', rarity: 'rare',      name: 'Navy Command',
    payload: { driverHelmet: '#1e3a5f' } },
  { id: 'driver_gold',    category: 'driver', rarity: 'epic',      name: 'Gold Champion',
    payload: { driverHelmet: '#eab308' } },
  { id: 'driver_lime',    category: 'driver', rarity: 'epic',      name: 'Acid Lime',
    payload: { driverHelmet: '#84cc16' } },
  { id: 'driver_orange',  category: 'driver', rarity: 'epic',      name: 'Blaze Orange',
    payload: { driverHelmet: '#ea580c' } },
  { id: 'driver_indigo',  category: 'driver', rarity: 'epic',      name: 'Indigo Night',
    payload: { driverHelmet: '#4338ca' } },
  { id: 'driver_chrome',  category: 'driver', rarity: 'legendary', name: 'Chrome Visor',
    payload: { driverHelmet: '#e5e4e2' } },
  { id: 'driver_blood',   category: 'driver', rarity: 'legendary', name: 'Blood Ruby',
    payload: { driverHelmet: '#9f1239' } },
  { id: 'driver_ice',     category: 'driver', rarity: 'legendary', name: 'Glacier Ice',
    payload: { driverHelmet: '#a5f3fc' } },
  { id: 'driver_flame',   category: 'driver', rarity: 'mythic',    name: 'Mythic Flame',
    payload: { driverHelmet: '#ff5f3d' } },
  { id: 'driver_void',    category: 'driver', rarity: 'mythic',    name: 'Void Matte',
    payload: { driverHelmet: '#0a0a0b' } },
  { id: 'driver_prism',   category: 'driver', rarity: 'mythic',    name: 'Prism Halo',
    payload: { driverHelmet: '#f0abfc' } },

  // ACCENT
  { id: 'accent_none',    category: 'accent', rarity: 'common',    name: 'No Accent',
    payload: { accentColor: null, decalGlowRing: false } },
  { id: 'accent_ember',   category: 'accent', rarity: 'uncommon',  name: 'Ember Ring',
    payload: { accentColor: '#ff5f3d', decalGlowRing: true } },
  { id: 'accent_aqua',    category: 'accent', rarity: 'rare',      name: 'Aqua Halo',
    payload: { accentColor: '#22d3ee', decalGlowRing: true } },
  { id: 'accent_royal',   category: 'accent', rarity: 'epic',      name: 'Royal Pulse',
    payload: { accentColor: '#a78bfa', decalGlowRing: true } },
  { id: 'accent_solar',   category: 'accent', rarity: 'legendary', name: 'Solar Flare',
    payload: { accentColor: '#fbbf24', decalGlowRing: true } },
  { id: 'accent_myth',    category: 'accent', rarity: 'mythic',    name: 'Mythic Aura',
    payload: { accentColor: '#ff3d7a', decalGlowRing: true } }
];

// Matching sets = cosmetic flex only. No stat perks.
const COSMETIC_SETS = [
  {
    id: 'factory', name: 'Factory Spec',
    items: { build: 'build_stock', colour: 'colour_teal', wheels: 'wheels_stock', driver: 'driver_rookie', accent: 'accent_none' },
    perk: { label: 'Look complete — cosmetics only' }
  },
  {
    id: 'street', name: 'Street Heat',
    items: { build: 'build_stripes', colour: 'colour_crimson', wheels: 'wheels_red', driver: 'driver_crimson', accent: 'accent_ember' },
    perk: { label: 'Look complete — cosmetics only' }
  },
  {
    id: 'neon', name: 'Neon Circuit',
    items: { build: 'build_wide', colour: 'colour_violet', wheels: 'wheels_teal', driver: 'driver_blue', accent: 'accent_aqua' },
    perk: { label: 'Look complete — cosmetics only' }
  },
  {
    id: 'gold', name: 'Golden Hour',
    items: { build: 'build_low', colour: 'colour_gold', wheels: 'wheels_gold', driver: 'driver_gold', accent: 'accent_solar' },
    perk: { label: 'Look complete — cosmetics only' }
  },
  {
    id: 'chrome', name: 'Chrome Legion',
    items: { build: 'build_spoiler', colour: 'colour_chrome', wheels: 'wheels_prism', driver: 'driver_chrome', accent: 'accent_royal' },
    perk: { label: 'Look complete — cosmetics only' }
  },
  {
    id: 'apex', name: 'Apex Mythic',
    items: { build: 'build_apex', colour: 'colour_prism', wheels: 'wheels_void', driver: 'driver_flame', accent: 'accent_myth' },
    perk: { label: 'Look complete — cosmetics only' }
  },
  {
    id: 'sprint', name: 'Sprint Squad',
    items: { build: 'build_sprint', colour: 'colour_sunrise', wheels: 'wheels_ice', driver: 'driver_forest', accent: 'accent_aqua' },
    perk: { label: 'Look complete — cosmetics only' }
  }
];

const CATEGORIES = ['build', 'colour', 'wheels', 'driver', 'accent'];
const DEFAULT_EQUIPPED = {
  build: 'build_stock', colour: 'colour_teal', wheels: 'wheels_stock',
  driver: 'driver_rookie', accent: 'accent_none'
};
const DEFAULT_OWNED = Object.values(DEFAULT_EQUIPPED);

function loadInventory() {
  let inv;
  try { inv = JSON.parse(localStorage.getItem('kartInventory')); } catch (e) { inv = null; }
  if (!inv || !Array.isArray(inv.owned) || !inv.equipped) {
    inv = { owned: [...DEFAULT_OWNED], equipped: { ...DEFAULT_EQUIPPED } };
  }
  DEFAULT_OWNED.forEach(id => { if (!inv.owned.includes(id)) inv.owned.push(id); });
  CATEGORIES.forEach(cat => { if (!inv.equipped[cat]) inv.equipped[cat] = DEFAULT_EQUIPPED[cat]; });
  return inv;
}

let inventory = loadInventory();
function saveInventory() { localStorage.setItem('kartInventory', JSON.stringify(inventory)); }

function findItem(id) { return ITEM_CATALOG.find(i => i.id === id); }
function isOwned(id) { return inventory.owned.includes(id); }
function isEquipped(id) {
  const item = findItem(id);
  return !!item && inventory.equipped[item.category] === id;
}

function getActiveSet() {
  return COSMETIC_SETS.find(set =>
    CATEGORIES.every(cat => !set.items[cat] || inventory.equipped[cat] === set.items[cat])
  ) || null;
}

function getSetProgress(set) {
  let owned = 0, equipped = 0, total = 0;
  CATEGORIES.forEach(cat => {
    if (!set.items[cat]) return;
    total++;
    if (isOwned(set.items[cat])) owned++;
    if (inventory.equipped[cat] === set.items[cat]) equipped++;
  });
  return { owned, equipped, total };
}

function anyMythicEquipped() {
  return CATEGORIES.some(cat => {
    const item = findItem(inventory.equipped[cat]);
    return item && item.rarity === 'mythic';
  });
}

function refreshSetBonus() {
  // Strip any leftover P2W fields from older saves
  settings.boostDurationMult = 1;
  settings.glowBoost = 1;
  delete settings.vehicleClass;

  const active = getActiveSet();
  settings.setBonusId = active ? active.id : null;
  // Visual-only flourishes (no speed/handling)
  settings.mythicTrail = anyMythicEquipped();
  settings.chromeShimmer = settings.finish === 'chrome';
  saveConfig();

  const badge = document.getElementById('setBonusBadge');
  if (badge) {
    if (active) {
      badge.style.display = '';
      badge.innerHTML = `<strong>${active.name}</strong> — ${active.perk.label}`;
    } else {
      badge.style.display = 'none';
      badge.textContent = '';
    }
  }
  const setsEl = document.getElementById('garageSetsPanel');
  if (setsEl && window.Cosmetics) renderSetsPanel(setsEl);
}

function renderSetsPanel(el) {
  el.innerHTML = COSMETIC_SETS.map(set => {
    const p = getSetProgress(set);
    const active = getActiveSet() && getActiveSet().id === set.id;
    const pct = Math.round((p.owned / Math.max(1, p.total)) * 100);
    return `<div class="set-progress-card${active ? ' active' : ''}">
      <div class="set-progress-name">${set.name}${active ? ' ✓' : ''}</div>
      <div class="set-progress-bar"><div style="width:${pct}%"></div></div>
      <div class="set-progress-meta">${p.owned}/${p.total} owned · cosmetics only</div>
    </div>`;
  }).join('');
}

function equipItem(id) {
  const item = findItem(id);
  if (!item || !isOwned(id)) return false;
  inventory.equipped[item.category] = id;
  saveInventory();
  Object.assign(settings, item.payload);
  // Never allow payloads to sneak gameplay keys back in
  settings.boostDurationMult = 1;
  settings.glowBoost = 1;
  delete settings.vehicleClass;
  refreshSetBonus();
  if (window.applyCustomization) window.applyCustomization();
  if (window.Net && Net.syncLook) Net.syncLook();
  return true;
}

function grantItem(id) {
  if (!findItem(id) || isOwned(id)) return false;
  inventory.owned.push(id);
  saveInventory();
  return true;
}

/** Dev unlock — localhost or server-flagged account (Account.user.devTools). */
function unlockAllCosmetics() {
  const localHost = (() => {
    const h = (typeof location !== 'undefined' && location.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  })();
  const flagged = !!(window.Account && Account.getUser && Account.getUser() && Account.getUser().devTools);
  if (!localHost && !flagged) return 0;
  let n = 0;
  ITEM_CATALOG.forEach(item => {
    if (grantItem(item.id)) n++;
  });
  saveInventory();
  refreshSetBonus();
  if (window.Garage && typeof window.Garage.refresh === 'function') window.Garage.refresh();
  else if (typeof window.renderGarageGrid === 'function') window.renderGarageGrid();
  return n;
}

function applyEquippedToSettings() {
  CATEGORIES.forEach(cat => {
    const item = findItem(inventory.equipped[cat]);
    if (item) Object.assign(settings, item.payload);
  });
  settings.boostDurationMult = 1;
  settings.glowBoost = 1;
  delete settings.vehicleClass;
  refreshSetBonus();
}

/** Compact visual snapshot for multiplayer (looks only — no gameplay stats). */
function getNetworkLook() {
  applyEquippedToSettings();
  const bs = settings.bodyScale || { x: 1, y: 1, z: 1 };
  return {
    bodyColor: String(settings.bodyColor || '#228b7a').slice(0, 16),
    finish: ['matte', 'gloss', 'metallic', 'chrome'].includes(settings.finish) ? settings.finish : 'matte',
    glow: String(settings.glow || '#37c6b0').slice(0, 16),
    wheelColor: String(settings.wheelColor || '#111111').slice(0, 16),
    driverHelmet: String(settings.driverHelmet || '#374151').slice(0, 16),
    accentColor: settings.accentColor ? String(settings.accentColor).slice(0, 16) : null,
    bodyScale: {
      x: Math.max(0.7, Math.min(1.35, +bs.x || 1)),
      y: Math.max(0.7, Math.min(1.35, +bs.y || 1)),
      z: Math.max(0.7, Math.min(1.35, +bs.z || 1))
    },
    decalSpoiler: !!settings.decalSpoiler,
    decalStripes: !!settings.decalStripes,
    decalGlowRing: !!settings.decalGlowRing
  };
}

applyEquippedToSettings();
if (window.applyCustomization) window.applyCustomization();

window.Cosmetics = {
  RARITY, RARITY_RANK, ITEM_CATALOG, CATEGORIES, COSMETIC_SETS,
  getInventory: () => inventory,
  isOwned, isEquipped, equipItem, grantItem, unlockAllCosmetics,
  itemsByCategory: (cat) => ITEM_CATALOG.filter(i => i.category === cat),
  getActiveSet, refreshSetBonus, anyMythicEquipped,
  getSetProgress, renderSetsPanel, getNetworkLook
};
