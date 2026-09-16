// =========================================================
// MAXIKART — Garage UI
// Self-contained: own THREE.Scene/camera/renderer for the
// preview kart. Never touches the race scene, physics, or
// render loop in game.js. Reads/writes cosmetics via the
// window.Cosmetics API defined in cosmetics.js.
// =========================================================

(function() {
  let activeCategory = 'build';

  // ---------------- Preview scene (visual-only kart) ----------------
  const canvas = document.getElementById('garageCanvas');
  const previewScene = new THREE.Scene();
  previewScene.background = null;

  const previewCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  previewCamera.position.set(0, 2.35, 7.0);
  previewCamera.lookAt(0, 0.55, 0);

  const previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const pHemi = new THREE.HemisphereLight(0xaeb8ff, 0x11131a, 1.0);
  previewScene.add(pHemi);
  const pKey = new THREE.DirectionalLight(0xffffff, 1.4);
  pKey.position.set(3, 5, 4); previewScene.add(pKey);
  const pRim = new THREE.DirectionalLight(0x37e6c8, 0.8);
  pRim.position.set(-4, 2, -3); previewScene.add(pRim);

  const previewGroup = new THREE.Group();
  previewScene.add(previewGroup);

  function createRacingChassisGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-1.42, 0.06);
    s.lineTo(1.05, 0.06);
    s.lineTo(1.48, 0.16);
    s.quadraticCurveTo(1.15, 0.46, 0.55, 0.5);
    s.lineTo(0.22, 0.48);
    s.lineTo(0.02, 0.34);
    s.lineTo(-0.5, 0.34);
    s.lineTo(-0.68, 0.56);
    s.lineTo(-1.2, 0.6);
    s.lineTo(-1.42, 0.38);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 1.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 8
    });
    geo.translate(0, 0, -0.6);
    geo.rotateY(-Math.PI / 2);
    return geo;
  }

  const pBodyMat = new THREE.MeshStandardMaterial({ color: 0x228b7a, roughness: 0.4, metalness: 0.1, emissive: 0xffae00, emissiveIntensity: 0 });
  const pBody = new THREE.Group();
  const pHull = new THREE.Mesh(createRacingChassisGeometry(), pBodyMat);
  pHull.castShadow = true; pBody.add(pHull);
  [-1, 1].forEach(side => {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.15, 10), pBodyMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.72, 0.28, -0.15);
    pBody.add(pod);
  });
  const pSplitter = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.35), pBodyMat);
  pSplitter.position.set(0, 0.1, 1.28);
  pBody.add(pSplitter);
  pBody.position.y = 0.22;
  previewGroup.add(pBody);

  const pCockpit = new THREE.Group();
  const pCockpitMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.55 });
  const pCockpitPod = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.34, 8), pCockpitMat);
  pCockpitPod.position.set(0, 0.02, 0); pCockpit.add(pCockpitPod);
  const pCockpitTrimMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.4, metalness: 0.3 });
  const pCockpitTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 8), pCockpitTrimMat);
  pCockpitTrim.position.set(0, -0.16, 0); pCockpit.add(pCockpitTrim);
  const pWindshieldMat = new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.55 });
  const pWindshield = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.32, 0.04), pWindshieldMat);
  pWindshield.position.set(0, 0.18, 0.38); pWindshield.rotation.x = -0.55; pCockpit.add(pWindshield);
  pCockpit.position.set(0, 0.78, -0.15); previewGroup.add(pCockpit);

  const pShoulderMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5 });
  const pShoulders = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.32), pShoulderMat);
  pShoulders.position.set(0, 0.93, -0.12); previewGroup.add(pShoulders);

  const pWheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const pWheels = [[-0.85, 0.35, 1.0], [0.85, 0.35, 1.0], [-0.85, 0.35, -1.0], [0.85, 0.35, -1.0]].map(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), pWheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, y, z); previewGroup.add(w); return w;
  });
  const pHubcapMat = new THREE.MeshStandardMaterial({ color: 0xd7dadd, roughness: 0.3, metalness: 0.6 });
  pWheels.forEach(w => {
    const capSign = w.position.x > 0 ? 1 : -1;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), pHubcapMat);
    cap.rotation.z = Math.PI / 2; cap.position.set(w.position.x + capSign * 0.16, w.position.y, w.position.z);
    previewGroup.add(cap);
  });

  const pExhaustMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  [-0.4, 0.4].forEach(x => {
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), pExhaustMat);
    e.rotation.x = Math.PI / 2; e.position.set(x, 0.3, -1.35); previewGroup.add(e);
  });

  const pAccentMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 });
  const pRearLip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.12), pAccentMat);
  pRearLip.position.set(0, 0.28, -1.35); previewGroup.add(pRearLip);

  const pUnderglow = new THREE.PointLight(0x37c6b0, 2.5, 4);
  pUnderglow.position.set(0, 0.15, 0); previewGroup.add(pUnderglow);

  const pSpoilerGroup = new THREE.Group();
  const pSpoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  pSpoilerWing.position.set(0, 1.05, -1.25); pSpoilerGroup.add(pSpoilerWing);
  [-0.6, 0.6].forEach(sx => {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    strut.position.set(sx, 0.78, -1.25); pSpoilerGroup.add(strut);
  });
  previewGroup.add(pSpoilerGroup);

  const pStripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const pStripesGroup = new THREE.Group();
  [-0.22, 0.22].forEach(sx => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 1.35), pStripeMat);
    stripe.position.set(sx, 0.72, 0.55); pStripesGroup.add(stripe);
  });
  previewGroup.add(pStripesGroup);

  const pHelmetMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.4 });
  const pHelmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), pHelmetMat);
  pHelmet.position.set(0, 1.02, -0.12); previewGroup.add(pHelmet);
  const pVisor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.05), new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.1 }));
  pVisor.position.set(0, 1.02, 0.06); previewGroup.add(pVisor);

  function refreshPreviewAppearance() {
    const bc = settings.bodyColor || '#228b7a';
    if (settings.finish === 'matte') { pBodyMat.roughness = 0.9; pBodyMat.metalness = 0.0; }
    else if (settings.finish === 'gloss') { pBodyMat.roughness = 0.1; pBodyMat.metalness = 0.1; }
    else if (settings.finish === 'metallic') { pBodyMat.roughness = 0.3; pBodyMat.metalness = 0.8; }
    else if (settings.finish === 'chrome') { pBodyMat.roughness = 0.05; pBodyMat.metalness = 1.0; }
    pBodyMat.color.set(bc);
    if (settings.accentColor) pUnderglow.color.set(settings.accentColor);
    else pUnderglow.color.set(settings.glow || '#37c6b0');
    pUnderglow.intensity = 2.5 * (settings.decalGlowRing ? 1.25 : 1);
    pWheelMat.color.set(settings.wheelColor || '#111111');
    pHelmetMat.color.set(settings.driverHelmet || '#374151');
    const bs = settings.bodyScale || { x: 1, y: 1, z: 1 };
    pBody.scale.set(bs.x, bs.y, bs.z);
    pSpoilerGroup.visible = !!settings.decalSpoiler;
    pStripesGroup.visible = !!settings.decalStripes;
  }

  // ---------------- Idle spin + drag-to-rotate ----------------
  let rotationY = 0.6;
  let dragging = false; let lastX = 0; let dragVelocity = 0;

  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointerleave', () => { dragging = false; });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    dragVelocity = dx * 0.01;
    rotationY += dragVelocity;
  });

  function resizePreview() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    canvas.width = w;
    canvas.height = h;
    previewRenderer.setSize(w, h, false);
    previewCamera.aspect = w / Math.max(1, h);
    previewCamera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resizePreview);

  let lastT = performance.now();
  function animatePreview(t) {
    requestAnimationFrame(animatePreview);
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (!document.getElementById('menu-garage').classList.contains('active')) return;

    if (!dragging) {
      dragVelocity *= (1 - Math.min(1, dt * 4));
      rotationY += dragVelocity + dt * 0.35; // gentle idle turn
    }
    previewGroup.rotation.y = rotationY;
    previewGroup.position.y = Math.sin(t * 0.0015) * 0.04;

    // Garage chrome shimmer preview
    if (settings.finish === 'chrome') {
      const shimmer = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.006));
      pBodyMat.emissive.setHex(0xffffff);
      pBodyMat.emissiveIntensity = shimmer * 0.35;
    } else {
      pBodyMat.emissiveIntensity = 0;
    }

    previewRenderer.render(previewScene, previewCamera);
  }
  requestAnimationFrame(animatePreview);

  // ---------------- Tabs + item grid ----------------
  const tabsEl = document.getElementById('garageTabs');
  const gridEl = document.getElementById('garageGrid');
  const CATEGORY_LABELS = { build: 'Build', colour: 'Colour', wheels: 'Wheels', driver: 'Driver', accent: 'Accent' };

  function renderTabs() {
    tabsEl.innerHTML = '';
    window.Cosmetics.CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'garage-tab' + (cat === activeCategory ? ' active' : '');
      btn.textContent = CATEGORY_LABELS[cat] || cat;
      btn.onclick = () => { playUIChime(); activeCategory = cat; renderTabs(); renderGrid(); };
      tabsEl.appendChild(btn);
    });
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    const items = window.Cosmetics.itemsByCategory(activeCategory);
    items.forEach(item => {
      const owned = window.Cosmetics.isOwned(item.id);
      const equipped = window.Cosmetics.isEquipped(item.id);
      const rarity = window.Cosmetics.RARITY[item.rarity];

      const card = document.createElement('div');
      card.className = 'item-card' + (owned ? '' : ' locked') + (equipped ? ' equipped' : '');
      card.style.setProperty('--rarity-color', rarity.color);

      card.innerHTML = `
        <div class="item-swatch">${owned ? '' : '<span class="lock-ico">🔒</span>'}</div>
        <div class="item-name">${item.name}</div>
        <div class="item-rarity">${rarity.label}</div>
        ${item.payload.bodySilhouette ? `<div class="item-class">Style: ${item.payload.bodySilhouette}</div>` : ''}
        ${equipped ? '<div class="equipped-tag">EQUIPPED</div>' : ''}
      `;
      const swatch = card.querySelector('.item-swatch');
      swatch.style.background = swatchColorFor(item);

      if (owned && !equipped) {
        card.onclick = () => { playUIChime(); window.Cosmetics.equipItem(item.id); refreshPreviewAppearance(); renderGrid(); };
      }
      gridEl.appendChild(card);
    });
  }

  function swatchColorFor(item) {
    const p = item.payload;
    if (p.bodyColor) return p.bodyColor;
    if (p.wheelColor) return p.wheelColor;
    if (p.driverHelmet) return p.driverHelmet;
    if (p.accentColor) return p.accentColor;
    return '#2b2d33';
  }

  // Re-render whenever the garage menu is opened, so equip/lock state stays fresh.
  const garageMenu = document.getElementById('menu-garage');
  const observer = new MutationObserver(() => {
    if (garageMenu.classList.contains('active')) {
      resizePreview(); refreshPreviewAppearance(); renderTabs(); renderGrid();
      if (window.Cosmetics && window.Cosmetics.renderSetsPanel) {
        window.Cosmetics.renderSetsPanel(document.getElementById('garageSetsPanel'));
      }
    }
  });
  observer.observe(garageMenu, { attributes: true, attributeFilter: ['class'] });

  resizePreview(); refreshPreviewAppearance(); renderTabs(); renderGrid();
  if (window.Cosmetics && window.Cosmetics.renderSetsPanel) {
    window.Cosmetics.renderSetsPanel(document.getElementById('garageSetsPanel'));
  }
})();
