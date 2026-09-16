// =========================================================
// MAXIKART — Race systems: items, weather helpers.
// Pure data + helpers; game.js owns simulation.
// =========================================================

(function () {
  // Vehicle classes removed — cosmetics never change handling/speed.
  // Kept as empty stub so older calls don't crash.
  function applyVehicleClass(kart) {
    // no-op: all karts share the same base stats
    return null;
  }

  // ---------- Items ----------
  const ITEMS = {
    MUSHROOM:   { id: 'MUSHROOM',   icon: '🍄', label: 'Mushroom',   weight: 28 },
    GREEN_SHELL:{ id: 'GREEN_SHELL',icon: '🟢', label: 'Green Shell', weight: 22 },
    BANANA:     { id: 'BANANA',     icon: '🍌', label: 'Banana',     weight: 22 },
    SHIELD:     { id: 'SHIELD',     icon: '🛡️', label: 'Shield',     weight: 16 },
    FAKE_BOX:   { id: 'FAKE_BOX',   icon: '📦', label: 'Fake Box',   weight: 12 }
  };

  function rollItem(place) {
    // Behind → better odds on mushroom/shell; ahead → more banana/fake
    const entries = Object.values(ITEMS).map(it => {
      let w = it.weight;
      if (place >= 3) {
        if (it.id === 'MUSHROOM' || it.id === 'GREEN_SHELL') w *= 1.4;
      } else if (place === 1) {
        if (it.id === 'BANANA' || it.id === 'FAKE_BOX') w *= 1.35;
        if (it.id === 'MUSHROOM') w *= 0.6;
      }
      return { id: it.id, w };
    });
    const total = entries.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of entries) {
      if (r < e.w) return e.id;
      r -= e.w;
    }
    return 'MUSHROOM';
  }

  function itemIcon(id) {
    return (ITEMS[id] && ITEMS[id].icon) || '?';
  }

  // ---------- Weather modifiers ----------
  const WEATHER = {
    clear: { label: 'Clear', gripMult: 1, speedMult: 1, fogNear: 80, fogFar: 450, rain: false },
    rain:  { label: 'Rain',  gripMult: 0.82, speedMult: 0.97, fogNear: 40, fogFar: 220, rain: true },
    fog:   { label: 'Fog',   gripMult: 0.92, speedMult: 0.99, fogNear: 12, fogFar: 90, rain: false }
  };

  function getWeather(id) {
    return WEATHER[id] || WEATHER.clear;
  }

  window.RaceKit = {
    applyVehicleClass,
    ITEMS, rollItem, itemIcon,
    WEATHER, getWeather
  };
})();
