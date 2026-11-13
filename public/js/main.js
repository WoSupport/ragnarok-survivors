// Application Entry: Pick Screen, Live Pedestal Preview, HUD, Rarity Cards, Kafra Shop & Card Album

import { CLASSES, ZONES, SKILLS, PASSIVES, MOB_DB, CARDS, KAFRA_UPGRADES } from './data.js?v=2';
import { AudioManager } from './audio.js?v=2';
import { AssetStore, resolveAssetUrl } from './assets.js?v=2';
import { MetaState, generateUpgradeOffer } from './progression.js?v=2';
import { SurvivorsEngine } from './engine.js?v=3';

const assets = new AssetStore();
const audio = new AudioManager();
const meta = new MetaState();

const el = (id) => document.getElementById(id);

let currentOffer = [];
let previewPose = 'idle_s';
let previewAnimMs = 0;
let previewLastTs = performance.now();
let bannerTimeout = null;

const engine = new SurvivorsEngine(
  el('game-canvas'),
  el('minimap-canvas'),
  assets,
  audio,
  meta,
  {
    onHudSync: syncHud,
    onLevelUp: openLevelUpModal,
    onPickCard: chooseUpgradeCard,
    onPauseChange: togglePauseModal,
    onGameOver: openResultsModal,
    onReturnToMenu: returnToMenu,
    onBanner: showBanner,
    onCardLooted: (cardId, isNew) => {
      const def = CARDS.find((c) => c.id === cardId);
      if (def) {
        showBanner(isNew ? `✦ NEW CARD OBTAINED: ${def.name}! ✦` : `✦ ${def.name} (+80z Duplicate) ✦`);
      }
    }
  }
);

async function boot() {
  const fill = el('loading-bar-fill');
  const status = el('loading-status');

  try {
    status.textContent = 'Reading Midgard asset manifest...';
    fill.style.width = '20%';
    const manifest = await assets.loadManifest();
    audio.init(manifest);

    // Apply authentic Ragnarok Online cursor if available
    if (manifest.ui?.cursor?.[0]) {
      document.body.style.cursor = `url('${resolveAssetUrl(manifest.ui.cursor[0])}') 1 1, auto`;
    }

    const pick = meta.data.pick;
    const startZone = ZONES.find((z) => z.id === pick.zoneId) || ZONES[0];

    status.textContent = `Loading ${pick.classId.replace('_', ' ')} & ${startZone.name}...`;
    fill.style.width = '45%';
    await Promise.all([
      assets.preloadHero(pick.classId, pick.gender),
      assets.preloadZoneMenuPreview(startZone, (p) => {
        fill.style.width = `${Math.round(45 + p * 55)}%`;
      })
    ]);
  } catch (err) {
    console.error('[Ragnarok Survivors] Non-fatal boot warning:', err);
    status.textContent = 'Opening Prontera Gate...';
  }

  bindUiEvents();
  renderMenuUI();
  updateAudioButtonLabel();

  el('loading-screen').classList.remove('active');
  el('menu-screen').classList.add('active');
  audio.playBgm('title');

  requestAnimationFrame(renderHeroPedestalLoop);
  engine.tick();
}

function bindUiEvents() {
  // Gender toggle
  el('btn-gender-male').addEventListener('click', () => setGender('male'));
  el('btn-gender-female').addEventListener('click', () => setGender('female'));

  // Randomize pick
  el('btn-randomize').addEventListener('click', async () => {
    const rndClass = CLASSES[Math.floor(Math.random() * CLASSES.length)].id;
    const rndGender = Math.random() < 0.5 ? 'male' : 'female';
    const rndZone = ZONES[Math.floor(Math.random() * ZONES.length)].id;
    meta.setPick({ classId: rndClass, gender: rndGender, zoneId: rndZone });
    renderMenuUI();
    await assets.preloadHero(rndClass, rndGender);
    assets.preloadZoneMenuPreview(ZONES.find((z) => z.id === rndZone));
  });

  // Preview pose buttons
  document.querySelectorAll('.pose-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pose-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      previewPose = btn.dataset.pose;
      previewAnimMs = 0;
    });
  });

  // Enter World (Button + Enter Key on Menu)
  el('btn-enter-world').addEventListener('click', launchSelectedRun);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && el('menu-screen').classList.contains('active') && !isAnyMetaModalOpen()) {
      launchSelectedRun();
    }
  });

  // Audio toggles
  el('btn-audio-toggle').addEventListener('click', () => {
    audio.toggle();
    updateAudioButtonLabel();
  });
  el('btn-pause-audio').addEventListener('click', () => {
    audio.toggle();
    updateAudioButtonLabel();
  });

  // Kafra Shop Modal
  el('btn-open-kafra').addEventListener('click', openKafraModal);
  el('btn-close-kafra').addEventListener('click', () => el('kafra-modal').classList.remove('active'));
  el('btn-done-kafra').addEventListener('click', () => el('kafra-modal').classList.remove('active'));
  el('btn-reset-kafra').addEventListener('click', () => {
    meta.refundKafra();
    renderKafraModal();
    renderMenuUI();
  });

  // Card Album Modal
  el('btn-open-cards').addEventListener('click', openCardsModal);
  el('btn-manage-slots').addEventListener('click', openCardsModal);
  el('btn-close-cards').addEventListener('click', () => el('cards-modal').classList.remove('active'));

  // Reroll Level-up Cards
  el('btn-reroll').addEventListener('click', () => {
    if (!engine.run) return;
    const cost = getRerollCost();
    if (meta.data.zeny < cost) return;
    meta.addZeny(-cost);
    engine.run.rerollsUsed += 1;
    audio.playSfx('coin', 0.35, 40);
    openLevelUpModal();
  });

  // Pause & Results buttons
  el('btn-resume').addEventListener('click', () => engine.setPaused(false));
  el('btn-abandon').addEventListener('click', () => {
    el('pause-modal').classList.remove('active');
    returnToMenu();
  });
  el('btn-play-again').addEventListener('click', returnToMenu);

  // Mobility slot click + Minimap controls
  el('hud-mobility-slot').addEventListener('click', () => engine.triggerMobility());
  el('btn-mm-zoom-in').addEventListener('click', () => {
    engine.mmZoom = Math.min(2.5, +(engine.mmZoom + 0.35).toFixed(2));
  });
  el('btn-mm-zoom-out').addEventListener('click', () => {
    engine.mmZoom = Math.max(1.0, +(engine.mmZoom - 0.35).toFixed(2));
  });
  el('btn-mm-toggle').addEventListener('click', () => {
    el('minimap-body').classList.toggle('hidden');
  });

  // Mobile Touch Controls
  setupTouchControls();
}

function setupTouchControls() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;

  const joy = el('touch-joystick');
  const knob = el('touch-knob');
  const dashBtn = el('touch-dash-btn');
  joy.classList.remove('hidden');
  dashBtn.classList.remove('hidden');

  let activeId = null;
  const maxR = 38;

  joy.addEventListener('pointerdown', (e) => {
    activeId = e.pointerId;
    try {
      joy.setPointerCapture(e.pointerId);
    } catch (_) {}
    updateStick(e);
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId === activeId) updateStick(e);
  });
  const resetStick = (e) => {
    if (e.pointerId === activeId) {
      activeId = null;
      engine.touchVec.x = 0;
      engine.touchVec.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
    }
  };
  joy.addEventListener('pointerup', resetStick);
  joy.addEventListener('pointercancel', resetStick);

  function updateStick(e) {
    const rect = joy.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(maxR, len);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    knob.style.transform = `translate(${nx}px, ${ny}px)`;
    engine.touchVec.x = nx / maxR;
    engine.touchVec.y = ny / maxR;
  }

  dashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    engine.triggerMobility();
  });
}

function isAnyMetaModalOpen() {
  return el('kafra-modal').classList.contains('active') || el('cards-modal').classList.contains('active');
}

function updateAudioButtonLabel() {
  el('btn-audio-toggle').textContent = audio.enabled ? '🔊 Audio: ON' : '🔇 Audio: OFF';
}

async function setGender(gender) {
  meta.setPick({ gender });
  renderMenuUI();
  await assets.preloadHero(meta.data.pick.classId, gender);
}

function renderMenuUI() {
  const pick = meta.data.pick;
  const selectedClass = CLASSES.find((c) => c.id === pick.classId) || CLASSES[0];
  const selectedZone = ZONES.find((z) => z.id === pick.zoneId) || ZONES[0];

  el('menu-zeny-count').textContent = meta.data.zeny.toLocaleString();
  el('menu-card-count').textContent = `${meta.data.ownedCards.length}/${CARDS.length}`;

  el('btn-gender-male').classList.toggle('active', pick.gender === 'male');
  el('btn-gender-female').classList.toggle('active', pick.gender === 'female');

  // Render Class List
  const classListEl = el('class-list');
  classListEl.innerHTML = '';
  for (const cls of CLASSES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `class-item ${cls.id === selectedClass.id ? 'active' : ''}`;
    btn.innerHTML = `
      <img src="assets/icons/job/${cls.jobId}.png" alt="${cls.name}" />
      <div>
        <div class="class-item-name">${cls.name}</div>
        <div class="class-item-tag">${cls.role}</div>
      </div>
    `;
    btn.addEventListener('click', async () => {
      meta.setPick({ classId: cls.id });
      renderMenuUI();
      await assets.preloadHero(cls.id, meta.data.pick.gender);
    });
    classListEl.appendChild(btn);
  }

  // Render Slotted Cards Summary
  el('slotted-count').textContent = `${meta.data.slottedCards.length}/2`;
  const slotRow = el('menu-slotted-cards');
  slotRow.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const cid = meta.data.slottedCards[i];
    const cdef = CARDS.find((c) => c.id === cid);
    const chip = document.createElement('div');
    chip.className = `slotted-mini-chip ${cdef ? 'filled' : ''}`;
    chip.innerHTML = cdef
      ? `<img src="assets/icons/item/4001.png" class="inline-icon" alt="" /><span>${cdef.name}</span>`
      : `<span>+ Empty Card Slot</span>`;
    chip.addEventListener('click', openCardsModal);
    slotRow.appendChild(chip);
  }

  // Render Center Pedestal Kit Details
  const starterDef = SKILLS[selectedClass.starterSkill];
  el('preview-job-icon').src = `assets/icons/job/${selectedClass.jobId}.png`;
  el('preview-class-name').textContent = selectedClass.name;
  el('preview-class-role').textContent = selectedClass.role;
  el('preview-class-desc').textContent = selectedClass.desc;
  el('preview-start-icon').src = `assets/icons/skill/${starterDef.icon}.png`;
  el('preview-start-name').textContent = starterDef.name;
  el('preview-mob-icon').src = `assets/icons/skill/${selectedClass.mobility.icon}.png`;
  el('preview-mob-name').textContent = selectedClass.mobility.name;

  const acc = meta.computeAccountBonuses();
  el('preview-stat-bars').innerHTML = `
    <div class="mini-stat-pill"><span>Max HP</span><b>${Math.round(selectedClass.stats.hp * acc.hpMult)}</b></div>
    <div class="mini-stat-pill"><span>Move Spd</span><b>${Math.round(selectedClass.stats.speed * acc.speedMult)}</b></div>
    <div class="mini-stat-pill"><span>Crit %</span><b>${Math.round((selectedClass.stats.crit + acc.critChance) * 100)}%</b></div>
    <div class="mini-stat-pill"><span>Armor</span><b>${selectedClass.stats.armor + acc.armor}</b></div>
  `;

  // Render Zone List
  const zoneListEl = el('zone-list');
  zoneListEl.innerHTML = '';
  for (const z of ZONES) {
    const bestSec = meta.data.bestTimes[z.id] || 0;
    const bestStr = bestSec > 0 ? `Best ${formatClock(bestSec)}` : z.tier;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `zone-item ${z.id === selectedZone.id ? 'active' : ''}`;
    btn.innerHTML = `
      <img src="assets/maps/${z.id}_minimap.png" alt="${z.name}" class="zone-thumb" />
      <div>
        <div class="zone-item-title">${z.name}</div>
        <div class="zone-item-sub">${z.id}</div>
      </div>
      <span class="zone-tier-badge">${bestStr}</span>
    `;
    btn.addEventListener('click', async () => {
      meta.setPick({ zoneId: z.id });
      renderMenuUI();
      await assets.preloadZoneMenuPreview(z);
    });
    zoneListEl.appendChild(btn);
  }

  // Selected Zone Details
  const mobTags = selectedZone.mobs
    .map((id) => `<span class="zone-mob-tag">${MOB_DB[id]?.name || id}</span>`)
    .join('');
  const bossTags = selectedZone.bosses
    .map((b) => `<span class="zone-mob-tag mvp">★ ${MOB_DB[b.mobId]?.name}</span>`)
    .join('');

  el('zone-detail-card').innerHTML = `
    <div class="zone-detail-title">${selectedZone.name} (${selectedZone.tier})</div>
    <div>${selectedZone.desc}</div>
    <div class="zone-mob-row">${mobTags}${bossTags}</div>
  `;
}

function renderHeroPedestalLoop(ts) {
  const dt = ts - previewLastTs;
  previewLastTs = ts;
  previewAnimMs += dt;

  if (el('menu-screen').classList.contains('active')) {
    const pCanvas = el('preview-canvas');
    const pCtx = pCanvas.getContext('2d');
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

    const pick = meta.data.pick;
    const cx = pCanvas.width / 2;
    const cy = 195;

    // Golden Midgard Magic Circle under hero feet
    pCtx.save();
    pCtx.strokeStyle = 'rgba(243, 200, 95, 0.45)';
    pCtx.fillStyle = 'rgba(243, 200, 95, 0.10)';
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.ellipse(cx, cy + 4, 58, 22, 0, 0, Math.PI * 2);
    pCtx.fill();
    pCtx.stroke();
    pCtx.restore();

    const poses = assets.manifest?.heroes?.[pick.classId]?.[pick.gender];
    const spriteMeta = poses?.[previewPose] || poses?.idle_s;
    assets.drawSprite(pCtx, spriteMeta, previewAnimMs, cx, cy, { scale: 1.55, loop: true });

    // Orbiting Spirit Spheres on Champion preview!
    if (pick.classId === 'champion') {
      for (let i = 0; i < 5; i++) {
        const a = previewAnimMs * 0.003 + (i / 5) * Math.PI * 2;
        const ox = cx + Math.cos(a) * 64;
        const oy = cy - 34 + Math.sin(a) * 22;
        const g = pCtx.createRadialGradient(ox, oy, 2, ox, oy, 11);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, '#67e8f9');
        g.addColorStop(1, 'rgba(56, 189, 248, 0)');
        pCtx.fillStyle = g;
        pCtx.beginPath();
        pCtx.arc(ox, oy, 11, 0, Math.PI * 2);
        pCtx.fill();
      }
    }
  }

  requestAnimationFrame(renderHeroPedestalLoop);
}

async function launchSelectedRun() {
  const pick = meta.data.pick;
  const zoneDef = ZONES.find((z) => z.id === pick.zoneId) || ZONES[0];

  el('menu-screen').classList.remove('active');
  el('loading-screen').classList.add('active');
  el('loading-status').textContent = `Warping via Kafra to ${zoneDef.name}...`;
  el('loading-bar-fill').style.width = '50%';

  try {
    await assets.preloadHero(pick.classId, pick.gender);
    await assets.preloadZone(zoneDef, (p) => {
      el('loading-bar-fill').style.width = `${Math.round(50 + p * 50)}%`;
    });
  } catch (err) {
    console.warn('[Ragnarok Survivors] Non-fatal warp preload warning:', err);
  }

  el('loading-screen').classList.remove('active');
  el('hud-layer').classList.remove('hidden');

  const cls = CLASSES.find((c) => c.id === pick.classId) || CLASSES[0];
  el('hud-char-title').textContent = cls.name;
  el('hud-zone-badge').textContent = zoneDef.id;
  el('minimap-title').textContent = zoneDef.name;
  el('hud-mobility-icon').src = `assets/icons/skill/${cls.mobility.icon}.png`;

  engine.startRun(pick.classId, pick.gender, pick.zoneId);
}

function syncHud(r) {
  const h = r.hero;
  el('hud-hp-fill').style.width = `${Math.max(0, (h.hp / h.maxHp) * 100)}%`;
  el('hud-hp-text').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}${h.barrier > 0 ? ` (+${h.barrier})` : ''}`;

  el('hud-sp-fill').style.width = `${Math.max(0, (h.sp / h.maxSp) * 100)}%`;
  el('hud-sp-text').textContent = `${Math.floor(h.sp)} / ${h.maxSp}`;

  el('hud-level').textContent = h.level;
  const expPct = Math.min(100, Math.floor((h.xp / h.xpNext) * 100));
  el('hud-exp-fill').style.width = `${expPct}%`;
  el('hud-exp-text').textContent = `${expPct}%`;

  el('hud-kills').textContent = r.kills.toLocaleString();
  el('hud-zeny').textContent = r.zenyEarned.toLocaleString();
  el('hud-dps').textContent = r.currentDps.toLocaleString();

  el('hud-timer').textContent = formatClock(Math.floor(r.time));
  el('hud-wave-label').textContent = `Wave ${1 + Math.floor(r.time / 35)}`;

  // Active Boss Bar
  const activeBoss = r.enemies.find((e) => !e.dead && e.isBoss);
  const bossWrap = el('boss-bar-wrap');
  if (activeBoss) {
    bossWrap.classList.remove('hidden');
    el('boss-name-label').textContent = activeBoss.def.name;
    el('boss-enrage-tag').classList.toggle('hidden', !activeBoss.enraged);
    el('boss-hp-fill').style.width = `${Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100)}%`;
    el('boss-hp-text').textContent = `${Math.max(0, Math.ceil(activeBoss.hp)).toLocaleString()} / ${activeBoss.maxHp.toLocaleString()}`;
  } else {
    bossWrap.classList.add('hidden');
  }

  // Mobility [F] Slot
  const mobSlot = el('hud-mobility-slot');
  const mobLock = el('hud-mobility-lock');
  const mobSweep = el('hud-mobility-cd');
  if (h.level < 5) {
    mobSlot.classList.add('locked');
    mobLock.classList.remove('hidden');
    mobSweep.style.height = '0%';
  } else {
    mobSlot.classList.remove('locked');
    mobLock.classList.add('hidden');
    const maxCd = h.classDef.mobility.cd * (1 - (h.acc.mobilityHaste || 0));
    const pct = h.mobilityCd > 0 ? Math.min(100, (h.mobilityCd / maxCd) * 100) : 0;
    mobSweep.style.height = `${pct}%`;
  }

  // Active & Passive Hotbars (throttled DOM diffing)
  const actKey = Object.entries(h.skills).map(([k, v]) => `${k}:${v.level}:${v.evolved ? 1 : 0}`).join('|');
  const actContainer = el('hud-active-slots');
  if (actContainer.dataset.sig !== actKey) {
    actContainer.dataset.sig = actKey;
    actContainer.innerHTML = '';
    const entries = Object.entries(h.skills);
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      if (entries[i]) {
        const [sid, st] = entries[i];
        const def = SKILLS[sid];
        slot.className = `hotbar-slot filled ${st.evolved ? 'evolved' : ''}`;
        slot.title = st.evolved ? def.evolvedName : def.name;
        slot.innerHTML = `<img src="assets/icons/skill/${def.icon}.png" alt="" /><span class="slot-lvl">${st.evolved ? '★' : `L${st.level}`}</span>`;
      } else {
        slot.className = 'hotbar-slot';
      }
      actContainer.appendChild(slot);
    }
  }

  const pasKey = Object.entries(h.passives).map(([k, v]) => `${k}:${v}`).join('|');
  const pasContainer = el('hud-passive-slots');
  if (pasContainer.dataset.sig !== pasKey) {
    pasContainer.dataset.sig = pasKey;
    pasContainer.innerHTML = '';
    const entries = Object.entries(h.passives);
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      if (entries[i]) {
        const [pid, rank] = entries[i];
        const pdef = PASSIVES[pid];
        slot.className = 'hotbar-slot filled';
        slot.title = pdef.name;
        slot.innerHTML = `<img src="assets/icons/skill/${pdef.icon}.png" alt="" /><span class="slot-lvl">L${rank}</span>`;
      } else {
        slot.className = 'hotbar-slot';
      }
      pasContainer.appendChild(slot);
    }
  }
}

function getRerollCost() {
  const freeRerolls = meta.data.kafra.arsenal || 0;
  const used = engine.run?.rerollsUsed || 0;
  if (used < freeRerolls) return 0;
  return 20 + (used - freeRerolls) * 15;
}

function openLevelUpModal() {
  if (!engine.run) return;
  currentOffer = generateUpgradeOffer(engine.run);
  const row = el('upgrade-cards-row');
  row.innerHTML = '';

  currentOffer.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'upgrade-card';
    cardEl.dataset.rarity = card.rarity.id;

    const diffsHtml = card.diffs
      .map(
        (d) => `
      <div class="diff-line">
        <span>${d.label}</span>
        <span>${d.before} <span class="diff-arrow">» ${d.after}</span></span>
      </div>`
      )
      .join('');

    cardEl.innerHTML = `
      <div class="card-top-meta">
        <span class="card-rarity-label">${card.rarity.label}</span>
        <span class="card-hotkey-badge">[${idx + 1}]</span>
      </div>
      <div class="card-skill-head">
        <div class="card-icon-frame"><img src="${card.icon}" alt="" /></div>
        <div>
          <h3 class="card-title">${card.title}</h3>
          <div class="card-level-tag">${card.levelTag}</div>
        </div>
      </div>
      <p class="card-desc">${card.desc}</p>
      <div class="card-diffs">${diffsHtml}</div>
    `;

    // Azeroth Survivors 3D Tilt toward cursor on hover!
    cardEl.addEventListener('pointermove', (e) => {
      const rect = cardEl.getBoundingClientRect();
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
      cardEl.style.transform = `translateY(-5px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    });
    cardEl.addEventListener('pointerleave', () => {
      cardEl.style.transform = '';
    });

    cardEl.addEventListener('click', () => chooseUpgradeCard(idx));
    row.appendChild(cardEl);
  });

  const cost = getRerollCost();
  const rerollBtn = el('btn-reroll');
  el('reroll-cost').textContent = cost === 0 ? 'FREE' : `${cost}`;
  rerollBtn.disabled = meta.data.zeny < cost;

  el('levelup-modal').classList.add('active');
}

function chooseUpgradeCard(idx) {
  if (engine.state !== 'levelup') return;
  const card = currentOffer[idx];
  if (!card) return;

  card.apply();
  engine.recalcHeroStats();
  el('levelup-modal').classList.remove('active');

  if (engine.run.hero.pendingLevels > 0) {
    engine.run.hero.pendingLevels -= 1;
    openLevelUpModal();
  } else {
    engine.state = 'playing';
  }
}

function togglePauseModal(paused) {
  const modal = el('pause-modal');
  if (paused && engine.run) {
    const h = engine.run.hero;
    el('pause-stats-grid').innerHTML = `
      <div class="pause-stat-cell"><span>Damage Mult</span><b>${Math.round(h.dmgMult * 100)}%</b></div>
      <div class="pause-stat-cell"><span>Cooldown Haste</span><b>${Math.round(h.hasteMult * 100)}%</b></div>
      <div class="pause-stat-cell"><span>Crit Chance</span><b>${Math.round(h.critChance * 100)}%</b></div>
      <div class="pause-stat-cell"><span>Move Speed</span><b>${Math.round(h.speed)}</b></div>
      <div class="pause-stat-cell"><span>Armor / Flee</span><b>${h.armor} / ${Math.round(h.dodge * 100)}%</b></div>
      <div class="pause-stat-cell"><span>HP Regen</span><b>+${h.regen.toFixed(1)}/s</b></div>
    `;
    modal.classList.add('active');
  } else {
    modal.classList.remove('active');
  }
}

function openResultsModal(run) {
  const survived = Math.floor(run.time);
  const victory = survived >= 300;
  const badge = el('results-badge');
  badge.textContent = victory ? '★ VALHALLA SURVIVOR! ★' : 'DEFEATED IN BATTLE';
  badge.classList.toggle('victory', victory);

  el('results-headline').textContent = victory
    ? `Triumph in ${run.zone.name}!`
    : `Fallen in ${run.zone.name}`;
  el('results-subline').textContent = `${run.hero.classDef.name} · Base Lv.${run.hero.level} · Survived ${formatClock(survived)}`;

  el('results-stats-list').innerHTML = `
    <div class="res-stat-row"><span>Monsters Slain</span><b>${run.kills.toLocaleString()}</b></div>
    <div class="res-stat-row"><span>Base Level Reached</span><b>Lv.${run.hero.level}</b></div>
    <div class="res-stat-row"><span>Zeny Looted (Saved)</span><b>+${run.zenyEarned.toLocaleString()} Z</b></div>
    <div class="res-stat-row"><span>Account Total Zeny</span><b>${meta.data.zeny.toLocaleString()} Z</b></div>
  `;

  // Skill Damage Breakdown
  const skillEntries = Object.entries(run.hero.skills)
    .map(([sid, st]) => ({ def: SKILLS[sid], st, dmg: st.totalDmg }))
    .sort((a, b) => b.dmg - a.dmg);
  const maxDmg = Math.max(1, skillEntries[0]?.dmg || 1);

  el('results-dmg-bars').innerHTML = skillEntries
    .map(
      (s) => `
      <div class="dmg-row">
        <div class="dmg-row-top">
          <img src="assets/icons/skill/${s.def.icon}.png" alt="" />
          <span>${s.st.evolved ? s.def.evolvedName : s.def.name}</span>
          <span class="dmg-row-val">${s.dmg.toLocaleString()}</span>
        </div>
        <div class="dmg-bar-bg">
          <div class="dmg-bar-fg" style="width:${Math.round((s.dmg / maxDmg) * 100)}%"></div>
        </div>
      </div>`
    )
    .join('');

  // Cards Obtained
  const cardsBox = el('results-cards-found');
  if (run.cardsFound.length > 0) {
    cardsBox.classList.remove('hidden');
    el('results-cards-list').innerHTML = run.cardsFound
      .map((cf) => {
        const def = CARDS.find((c) => c.id === cf.cardId);
        return `<span class="zone-mob-tag mvp">🃏 ${def?.name || cf.cardId} ${cf.isNew ? '(NEW!)' : ''}</span>`;
      })
      .join('');
  } else {
    cardsBox.classList.add('hidden');
  }

  el('results-modal').classList.add('active');
}

function returnToMenu() {
  el('results-modal').classList.remove('active');
  el('pause-modal').classList.remove('active');
  el('levelup-modal').classList.remove('active');
  el('hud-layer').classList.add('hidden');

  engine.run = null;
  engine.state = 'menu';
  renderMenuUI();
  el('menu-screen').classList.add('active');
  audio.playBgm('title');
}

function openKafraModal() {
  renderKafraModal();
  el('kafra-modal').classList.add('active');
}

function renderKafraModal() {
  el('kafra-zeny-count').textContent = meta.data.zeny.toLocaleString();
  const grid = el('kafra-upgrades-grid');
  grid.innerHTML = '';

  for (const up of KAFRA_UPGRADES) {
    const rank = meta.data.kafra[up.id] || 0;
    const maxed = rank >= up.maxRank;
    const cost = meta.getKafraCost(up);
    const canAfford = meta.data.zeny >= cost;

    const card = document.createElement('div');
    card.className = 'kafra-card';
    card.innerHTML = `
      <div class="kafra-card-top">
        <img src="assets/icons/item/${up.icon}.png" alt="" />
        <div class="kafra-card-title">${up.name}</div>
        <div class="kafra-card-rank">${rank}/${up.maxRank}</div>
      </div>
      <div class="kafra-card-desc">${up.desc}</div>
      <button type="button" class="ro-btn ${maxed ? 'ro-btn-secondary' : 'ro-btn-primary'}" ${maxed || !canAfford ? 'disabled' : ''}>
        ${maxed ? 'MAXED' : `Upgrade · ${cost} Z`}
      </button>
    `;
    const btn = card.querySelector('button');
    btn.addEventListener('click', () => {
      if (meta.buyKafra(up.id)) {
        audio.playSfx('blessing', 0.36, 40);
        renderKafraModal();
        renderMenuUI();
      }
    });
    grid.appendChild(card);
  }
}

function openCardsModal() {
  renderCardsModal();
  el('cards-modal').classList.add('active');
}

function renderCardsModal() {
  el('album-zeny-count').textContent = meta.data.zeny.toLocaleString();
  const grid = el('card-album-grid');
  grid.innerHTML = '';

  for (const c of CARDS) {
    const owned = meta.data.ownedCards.includes(c.id);
    const slotted = meta.data.slottedCards.includes(c.id);
    const canCraft = !owned && meta.data.zeny >= c.cost;

    const elCard = document.createElement('div');
    elCard.className = `ro-illust-card ${owned ? 'owned' : 'locked'} ${slotted ? 'slotted' : ''}`;
    elCard.innerHTML = `
      <div class="ro-illust-art-wrap">
        <img src="assets/cards/${c.id}.png" alt="${c.name}" loading="lazy" />
        ${slotted ? '<span class="card-slotted-ribbon">SLOTTED</span>' : ''}
      </div>
      <div class="ro-illust-info">
        <div class="ro-illust-name">${c.name}</div>
        <div class="ro-illust-bonus">${c.bonusText}</div>
        ${
          owned
            ? `<button type="button" class="ro-btn ${slotted ? 'ro-btn-secondary' : 'ro-btn-primary'}">${slotted ? 'Unequip Slot' : 'Equip Card'}</button>`
            : `<button type="button" class="ro-btn ro-btn-secondary" ${canCraft ? '' : 'disabled'}>Craft · ${c.cost} Z</button>`
        }
      </div>
    `;
    const btn = elCard.querySelector('button');
    btn.addEventListener('click', () => {
      if (owned) {
        meta.toggleSlotCard(c.id);
        audio.playSfx('coin', 0.3, 40);
      } else if (meta.craftCard(c.id)) {
        audio.playSfx('mvp', 0.45, 40);
      }
      renderCardsModal();
      renderMenuUI();
    });
    grid.appendChild(elCard);
  }
}

function showBanner(msg) {
  const b = el('hud-banner');
  b.textContent = msg;
  b.classList.remove('hidden');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => b.classList.add('hidden'), 2800);
}

function formatClock(totalSec) {
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

boot();
