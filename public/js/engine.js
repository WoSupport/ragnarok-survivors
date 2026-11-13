// Core Gameplay, Auto-Combat, Wave Spawner, Boss AI, Loot & Authentic RO Canvas Renderer

import { CLASSES, SKILLS, MOB_DB, ZONES } from './data.js?v=2';
import { computeSkillStats } from './progression.js?v=2';

export class SurvivorsEngine {
  constructor(canvas, minimapCanvas, assets, audio, meta, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mmCanvas = minimapCanvas;
    this.mmCtx = minimapCanvas.getContext('2d');
    this.assets = assets;
    this.audio = audio;
    this.meta = meta;
    this.cb = callbacks;

    this.state = 'menu'; // 'menu' | 'playing' | 'levelup' | 'paused' | 'gameover'
    this.zoom = 1.05;
    this.tiltY = 0.92; // Classic RO slight isometric foreshortening (C toggles 1.0 <-> 0.84)
    this.mmZoom = 1.0;

    this.keys = new Set();
    this.touchVec = { x: 0, y: 0 };
    this.mouseScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.mouseWorld = { x: 0, y: 0 };

    this.run = null;
    this.lastTs = performance.now();
    this.shakeTime = 0;
    this.shakeMag = 0;

    this.bindInputs();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys.add(k);

      if (this.state === 'playing') {
        if (k === ' ') {
          e.preventDefault();
          this.triggerHop();
        } else if (k === 'f') {
          e.preventDefault();
          this.triggerMobility();
        } else if (k === 'c') {
          this.tiltY = this.tiltY < 0.9 ? 1.0 : 0.83;
          this.cb.onBanner(this.tiltY < 0.9 ? 'Camera: Classic RO Isometric Tilt' : 'Camera: Top-Down Tactical');
        } else if (e.key === 'Escape') {
          this.setPaused(true);
        }
      } else if (this.state === 'paused') {
        if (e.key === 'Escape') this.setPaused(false);
      } else if (this.state === 'levelup') {
        if (k === '1') this.cb.onPickCard(0);
        if (k === '2') this.cb.onPickCard(1);
        if (k === '3') this.cb.onPickCard(2);
      } else if (this.state === 'gameover') {
        if (e.key === 'Enter') this.cb.onReturnToMenu();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    window.addEventListener('pointermove', (e) => {
      this.mouseScreen.x = e.clientX;
      this.mouseScreen.y = e.clientY;
    });

    window.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      this.zoom = Math.max(0.72, Math.min(1.5, this.zoom + delta));
    }, { passive: true });
  }

  startRun(classId, gender, zoneId) {
    const classDef = CLASSES.find((c) => c.id === classId) || CLASSES[0];
    const zoneDef = ZONES.find((z) => z.id === zoneId) || ZONES[0];
    const acc = this.meta.computeAccountBonuses();

    const hero = {
      classId: classDef.id,
      classDef,
      gender,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      dirAngle: Math.PI / 2,
      pose: 'idle_s',
      flipX: false,
      animMs: 0,
      castPoseTimer: 0,
      zHop: 0,
      zVel: 0,

      level: 1,
      xp: 0,
      xpNext: 36,
      pendingLevels: 0,

      hp: 100,
      maxHp: 100,
      sp: classDef.stats.sp,
      maxSp: classDef.stats.sp,
      barrier: 0,
      barrierTimer: 0,
      iframeTimer: 0,
      speedBuffTimer: 0,
      critBuffTimer: 0,
      mobilityCd: 0,
      hitCounter: 0,
      runDmgBonus: 0,

      skills: {
        [classDef.starterSkill]: {
          level: 1,
          powerBonus: 0,
          evolved: false,
          timer: 0.25,
          totalDmg: 0
        }
      },
      passives: {},
      passiveTotals: {},
      acc
    };

    this.run = {
      zone: zoneDef,
      hero,
      time: 0,
      kills: 0,
      zenyEarned: 0,
      rerollsUsed: 0,
      cardsFound: [],
      dpsWindow: [],
      currentDps: 0,

      enemies: [],
      projectiles: [],
      groundZones: [],
      telegraphs: [],
      loots: [],
      effects: [],
      floatingTexts: [],
      props: this.generateProps(),

      spawnTimer: 0.4,
      bossIdx: 0,
      endlessBossTimer: 360,
      sphereAngle: 0
    };

    this.recalcHeroStats(true);
    this.state = 'playing';
    this.audio.playBgm(zoneDef.id);
    this.cb.onBanner(`Entering ${zoneDef.name}`);
  }

  generateProps() {
    // Subtle decorative shrines / crystals scattered around world for spatial landmarks
    const props = [];
    for (let i = 0; i < 42; i++) {
      const ang = (i / 42) * Math.PI * 2 + (i % 5) * 0.4;
      const dist = 340 + ((i * 197) % 1900);
      props.push({
        x: Math.cos(ang) * dist,
        y: Math.sin(ang) * dist,
        kind: i % 6 === 0 ? 'pylon' : 'stone',
        used: false
      });
    }
    return props;
  }

  recalcHeroStats(fullHeal = false) {
    if (!this.run) return;
    const h = this.run.hero;
    const base = h.classDef.stats;
    const acc = h.acc;
    const pt = h.passiveTotals;

    const prevMax = h.maxHp || 1;
    h.hpMult = acc.hpMult + (pt.angelus || 0);
    h.maxHp = Math.round(base.hp * h.hpMult);
    if (fullHeal) {
      h.hp = h.maxHp;
    } else if (h.maxHp > prevMax) {
      h.hp = Math.min(h.maxHp, h.hp + (h.maxHp - prevMax));
    }

    h.dmgMult = base.atk * (acc.dmgMult + (pt.blessing || 0) + h.runDmgBonus);
    h.speed = base.speed * (acc.speedMult + (pt.inc_agi || 0)) * (h.speedBuffTimer > 0 ? 1.32 : 1.0);
    h.dodge = Math.min(0.55, acc.dodge + (pt.inc_agi || 0) * 0.45);
    h.hasteMult = base.haste * (acc.hasteMult + (pt.kyrie_eleison || 0));
    h.areaMult = acc.areaMult + (pt.aura_blade || 0);
    h.critChance = Math.min(0.85, base.crit + acc.critChance + (pt.gloria || 0) + (h.critBuffTimer > 0 ? 0.35 : 0));
    h.critMult = acc.critMult + (pt.gloria || 0) * 0.8;
    h.armor = base.armor + acc.armor + (h.passives.angelus || 0) * 2;
    h.regen = acc.regen + (h.passives.angelus || 0) * 1.4;
    h.bonusCount = acc.bonusCount + Math.ceil((h.passives.improve_conc || 0) / 2);
    h.magnetRadius = 108 * (acc.magnetMult + (pt.call_spirits || 0));
    h.xpMult = acc.xpMult + (pt.call_spirits || 0) * 0.65;
  }

  setPaused(flag) {
    if (flag && this.state === 'playing') {
      this.state = 'paused';
      this.cb.onPauseChange(true);
    } else if (!flag && this.state === 'paused') {
      this.state = 'playing';
      this.cb.onPauseChange(false);
    }
  }

  triggerHop() {
    const h = this.run?.hero;
    if (!h || h.zHop > 1) return;
    h.zVel = 240;
  }

  triggerMobility() {
    const r = this.run;
    if (!r) return;
    const h = r.hero;
    if (h.level < 5 || h.mobilityCd > 0) return;

    const mob = h.classDef.mobility;
    const cd = mob.cd * (1 - (h.acc.mobilityHaste || 0));
    h.mobilityCd = Math.max(1.8, cd);

    // Aim toward cursor (or current movement angle if cursor on top of hero)
    const dx = this.mouseWorld.x - h.x;
    const dy = this.mouseWorld.y - h.y;
    const dist = Math.hypot(dx, dy);
    const ang = dist > 14 ? Math.atan2(dy, dx) : h.dirAngle;
    const travel = Math.min(250, Math.max(155, dist));

    const startX = h.x;
    const startY = h.y;
    const endX = h.x + Math.cos(ang) * travel;
    const endY = h.y + Math.sin(ang) * travel;

    h.iframeTimer = Math.max(h.iframeTimer, 0.45);
    h.sp = Math.min(h.maxSp, h.sp + 18);

    // Afterimage trail
    for (let i = 0; i <= 4; i++) {
      const f = i / 4;
      r.effects.push({
        kind: 'ring',
        x: startX + (endX - startX) * f,
        y: startY + (endY - startY) * f,
        r: 18 + i * 6,
        maxR: 48,
        color: '#fde047',
        t: 0,
        dur: 0.32
      });
    }

    if (mob.type === 'charge') {
      this.audio.playSfx('bash', 0.42, 40);
      this.damageLine(startX, startY, endX, endY, 64, Math.round(72 * h.dmgMult), h.classDef.starterSkill, 0.8);
    } else if (mob.type === 'blink') {
      this.audio.playSfx('teleport', 0.45, 40);
      this.damageCircle(startX, startY, 95, Math.round(55 * h.dmgMult), h.classDef.starterSkill, '#38bdf8');
      this.damageCircle(endX, endY, 110, Math.round(68 * h.dmgMult), h.classDef.starterSkill, '#38bdf8');
    } else if (mob.type === 'vault') {
      this.audio.playSfx('inc_agi', 0.4, 40);
      h.speedBuffTimer = 3.2;
      r.groundZones.push({
        kind: 'trap',
        x: startX,
        y: startY,
        r: 92,
        dmg: Math.round(85 * h.dmgMult),
        skillId: h.classDef.starterSkill,
        t: 0,
        dur: 0.65,
        tickTimer: 0.25,
        tickRate: 0.5,
        color: '#f97316'
      });
      this.recalcHeroStats();
    } else if (mob.type === 'shadow') {
      this.audio.playSfx('cloaking', 0.45, 40);
      h.critBuffTimer = 3.2;
      this.damageLine(startX, startY, endX, endY, 60, Math.round(62 * h.dmgMult), h.classDef.starterSkill, 0, true);
      this.recalcHeroStats();
    } else if (mob.type === 'holy_dash') {
      this.audio.playSfx('heal', 0.42, 40);
      const healAmt = Math.round(h.maxHp * 0.12);
      h.hp = Math.min(h.maxHp, h.hp + healAmt);
      this.addFloatingText(endX, endY - 36, `+${healAmt}`, '#4ade80', true);
      this.damageCircle(endX, endY, 118, Math.round(60 * h.dmgMult), h.classDef.starterSkill, '#fde68a');
    } else {
      // Monk Snap
      this.audio.playSfx('teleport', 0.45, 40);
      this.damageCircle(endX, endY, 112, Math.round(78 * h.dmgMult), h.classDef.starterSkill, '#67e8f9');
    }

    h.x = endX;
    h.y = endY;
    h.zVel = 140;
  }

  shake(mag, dur = 0.2) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTs) / 1000);
    this.lastTs = now;

    if (this.state === 'playing' && this.run) {
      this.updateRun(dt);
    }
    this.render(dt);
    requestAnimationFrame(() => this.tick());
  }

  updateRun(dt) {
    const r = this.run;
    const h = r.hero;
    r.time += dt;
    r.sphereAngle += dt * 3.1;

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeMag = 0;
    }

    // Update cursor world position
    this.mouseWorld.x = h.x + (this.mouseScreen.x - this.viewW / 2) / this.zoom;
    this.mouseWorld.y = h.y + (this.mouseScreen.y - this.viewH / 2) / (this.zoom * this.tiltY);

    // Buff & cooldown timers
    if (h.iframeTimer > 0) h.iframeTimer -= dt;
    if (h.mobilityCd > 0) h.mobilityCd = Math.max(0, h.mobilityCd - dt);
    if (h.castPoseTimer > 0) h.castPoseTimer -= dt;

    let recalcNeeded = false;
    if (h.speedBuffTimer > 0) {
      h.speedBuffTimer -= dt;
      if (h.speedBuffTimer <= 0) recalcNeeded = true;
    }
    if (h.critBuffTimer > 0) {
      h.critBuffTimer -= dt;
      if (h.critBuffTimer <= 0) recalcNeeded = true;
    }
    if (recalcNeeded) this.recalcHeroStats();

    // Passive Regen & Kyrie Eleison Barrier
    if (h.hp < h.maxHp && h.hp > 0) {
      h.hp = Math.min(h.maxHp, h.hp + h.regen * dt);
    }
    h.sp = Math.min(h.maxSp, h.sp + 6 * dt);

    const kyrieRank = h.passives.kyrie_eleison || 0;
    if (kyrieRank > 0) {
      h.barrierTimer -= dt;
      if (h.barrierTimer <= 0) {
        h.barrierTimer = Math.max(6, 12 - kyrieRank);
        h.barrier = Math.round(h.maxHp * (0.08 + kyrieRank * 0.03));
        this.audio.playSfx('kyrie', 0.26, 500);
      }
    }

    // Hop physics
    if (h.zHop > 0 || h.zVel !== 0) {
      h.zHop += h.zVel * dt;
      h.zVel -= 760 * dt;
      if (h.zHop <= 0) {
        h.zHop = 0;
        h.zVel = 0;
      }
    }

    // Hero Movement (WASD / Arrows / Touch Joystick)
    let mx = this.touchVec.x;
    let my = this.touchVec.y;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;

    const mLen = Math.hypot(mx, my);
    if (mLen > 0.01) {
      mx /= mLen;
      my /= mLen;
      h.vx = mx * h.speed;
      h.vy = my * h.speed;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.dirAngle = Math.atan2(my, mx);
      h.animMs += dt * 1000 * (h.speed / 175);
      this.updateHeroDirectionPose(mx, my, true);
    } else {
      h.vx = 0;
      h.vy = 0;
      h.animMs += dt * 1000;
      this.updateHeroDirectionPose(Math.cos(h.dirAngle), Math.sin(h.dirAngle), false);
    }

    // Check Shrine Pylons in world (interactive RO Odin Shrines for burst heal/magnet!)
    for (const p of r.props) {
      if (p.kind === 'pylon' && !p.used && Math.hypot(p.x - h.x, p.y - h.y) < 42) {
        p.used = true;
        this.audio.playSfx('blessing', 0.4, 100);
        const heal = Math.round(h.maxHp * 0.25);
        h.hp = Math.min(h.maxHp, h.hp + heal);
        this.addFloatingText(h.x, h.y - 44, `SHRINE BLESSING +${heal}`, '#fde047', true);
        // Magnetize all gems on map!
        for (const l of r.loots) l.magnetized = true;
        r.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 16, maxR: 150, color: '#fde047', t: 0, dur: 0.55 });
      }
    }

    // Champion / Spirit Sphere orbital contact damage
    if (h.skills.spirit_sphere || h.classId === 'champion') {
      const spState = h.skills.spirit_sphere;
      const orbCount = spState ? Math.min(7, 3 + spState.level) : 5;
      const orbR = 62 * h.areaMult;
      const contactDmg = Math.round((spState ? 14 + spState.level * 5 : 14) * h.dmgMult);
      for (let i = 0; i < orbCount; i++) {
        const a = r.sphereAngle + (i / orbCount) * Math.PI * 2;
        const ox = h.x + Math.cos(a) * orbR;
        const oy = h.y + Math.sin(a) * orbR;
        for (const e of r.enemies) {
          if (e.dead || (e.sphereHitCd || 0) > 0) continue;
          if (Math.hypot(e.x - ox, e.y - oy) < e.radius + 16) {
            e.sphereHitCd = 0.35;
            this.hitEnemy(e, contactDmg, 'spirit_sphere', 45, Math.atan2(e.y - h.y, e.x - h.x));
          }
        }
      }
    }

    // Auto-Cast Active Skills
    for (const [sid, st] of Object.entries(h.skills)) {
      st.timer -= dt;
      if (st.timer <= 0) {
        const def = SKILLS[sid];
        const calc = computeSkillStats(def, st, h);
        const fired = this.castSkill(def, st, calc);
        st.timer = fired ? calc.cd : 0.18;
      }
    }

    // Update Projectiles, Ground Zones, Boss Telegraphs, Enemies, Loots, Effects
    this.updateProjectiles(dt);
    this.updateGroundZones(dt);
    this.updateTelegraphs(dt);
    this.updateSpawner(dt);
    this.updateEnemies(dt);
    this.updateLoots(dt);
    this.updateEffects(dt);

    // Rolling 4-second DPS meter
    const cutoff = r.time - 4.0;
    while (r.dpsWindow.length > 0 && r.dpsWindow[0].t < cutoff) {
      r.dpsWindow.shift();
    }
    const sumDmg = r.dpsWindow.reduce((s, x) => s + x.d, 0);
    r.currentDps = Math.round(sumDmg / Math.min(4.0, Math.max(1.0, r.time)));

    // Level-up trigger
    if (h.pendingLevels > 0 && this.state === 'playing') {
      h.pendingLevels -= 1;
      this.state = 'levelup';
      this.cb.onLevelUp();
    }
  }

  updateHeroDirectionPose(dx, dy, moving) {
    const h = this.run.hero;
    if (h.castPoseTimer > 0) return;

    if (!moving) {
      h.pose = dy < -0.25 ? 'idle_n' : 'idle_s';
      h.flipX = dx > 0.15;
      return;
    }
    // Map (dx, dy) into 8-direction RO walk sprites (walk_s, walk_sw, walk_w, walk_nw, walk_n + flipX)
    const absX = Math.abs(dx);
    h.flipX = dx > 0.08;
    if (absX < 0.34) {
      h.pose = dy < 0 ? 'walk_n' : 'walk_s';
      h.flipX = false;
    } else if (dy > 0.34) {
      h.pose = 'walk_sw';
    } else if (dy < -0.34) {
      h.pose = 'walk_nw';
    } else {
      h.pose = 'walk_w';
    }
  }

  findNearestEnemies(x, y, count = 1, maxRange = 620) {
    const alive = [];
    for (const e of this.run.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= maxRange) alive.push({ e, d });
    }
    alive.sort((a, b) => a.d - b.d);
    return alive.slice(0, count).map((x) => x.e);
  }

  findStrongestEnemy(x, y, maxRange = 640) {
    let best = null;
    let bestScore = -1;
    for (const e of this.run.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > maxRange) continue;
      const score = e.hp * (e.isBoss ? 5 : 1) - d * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  castSkill(def, st, calc) {
    const r = this.run;
    const h = r.hero;
    const targets = this.findNearestEnemies(h.x, h.y, Math.max(1, calc.count), 580);
    if (targets.length === 0 && def.kind !== 'sanctuary' && def.kind !== 'nova' && def.kind !== 'spin') {
      return false;
    }

    if (def.sfx) this.audio.playSfx(def.sfx, 0.28, 120);

    switch (def.kind) {
      case 'cleave': {
        // Bowling Bash: sweeping arcs toward closest pack(s) with knockback collision!
        h.pose = h.dirAngle < 0 ? 'atk_n' : 'atk_s';
        h.castPoseTimer = 0.24;
        h.animMs = 0;
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          const ang = tgt ? Math.atan2(tgt.y - h.y, tgt.x - h.x) : h.dirAngle + i * 1.1;
          const cx = h.x + Math.cos(ang) * (calc.radius * 0.68);
          const cy = h.y + Math.sin(ang) * (calc.radius * 0.68);
          r.effects.push({ kind: 'slash_arc', x: h.x, y: h.y, ang, r: calc.radius, color: st.evolved ? '#f43f5e' : '#fbbf24', t: 0, dur: 0.26 });
          this.damageCircle(cx, cy, calc.radius, calc.dmg, def.id, null, 135);
        }
        return true;
      }

      case 'nova': {
        // Magnum Break: 360° fiery shockwave + burning ring
        h.pose = 'atk_s';
        h.castPoseTimer = 0.24;
        this.damageCircle(h.x, h.y, calc.radius, calc.dmg, def.id, '#f97316', 155);
        r.groundZones.push({
          kind: 'fire',
          x: h.x,
          y: h.y,
          r: calc.radius * 0.92,
          dmg: Math.max(8, Math.round(calc.dmg * 0.32)),
          skillId: def.id,
          t: 0,
          dur: 2.2,
          tickTimer: 0.4,
          tickRate: 0.45,
          color: '#fb923c'
        });
        return true;
      }

      case 'lance': {
        // Spiral Pierce: heavy piercing lance toward highest-HP target
        const bossTgt = this.findStrongestEnemy(h.x, h.y, 620) || targets[0];
        if (!bossTgt) return false;
        h.pose = 'atk_s';
        h.castPoseTimer = 0.22;
        const baseAng = Math.atan2(bossTgt.y - h.y, bossTgt.x - h.x);
        for (let i = 0; i < calc.count; i++) {
          const spread = (i - (calc.count - 1) / 2) * 0.14;
          const a = baseAng + spread;
          r.projectiles.push({
            kind: 'lance',
            x: h.x,
            y: h.y,
            vx: Math.cos(a) * 640,
            vy: Math.sin(a) * 640,
            ang: a,
            r: calc.radius,
            dmg: calc.dmg,
            pierce: 99,
            hitSet: new Set(),
            skillId: def.id,
            color: st.evolved ? '#f43f5e' : '#60a5fa',
            life: 0.95
          });
        }
        return true;
      }

      case 'bolts':
      case 'smite': {
        // Fire Bolt / Holy Light: multi-target elemental pillars
        h.pose = 'cast_s';
        h.castPoseTimer = 0.22;
        const isHoly = def.kind === 'smite';
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          if (!tgt) continue;
          r.effects.push({
            kind: isHoly ? 'holy_pillar' : 'fire_pillar',
            x: tgt.x,
            y: tgt.y,
            r: calc.radius,
            color: def.color,
            t: 0,
            dur: 0.34
          });
          this.damageCircle(tgt.x, tgt.y, calc.radius, calc.dmg, def.id, null, 30, false, isHoly);
        }
        return true;
      }

      case 'vortex': {
        // Storm Gust: swirling blizzard circle slowing & freezing foes
        h.pose = 'cast_s';
        h.castPoseTimer = 0.28;
        for (let i = 0; i < Math.min(2, calc.count); i++) {
          const tgt = targets[i % targets.length];
          const gx = tgt ? tgt.x : h.x + (Math.random() - 0.5) * 180;
          const gy = tgt ? tgt.y : h.y + (Math.random() - 0.5) * 180;
          r.groundZones.push({
            kind: 'storm_gust',
            x: gx,
            y: gy,
            r: calc.radius,
            dmg: calc.dmg,
            skillId: def.id,
            t: 0,
            dur: 3.4,
            tickTimer: 0.1,
            tickRate: 0.45,
            chill: true,
            color: '#38bdf8'
          });
        }
        return true;
      }

      case 'lightning': {
        // Lord of Vermilion: thunderbolts across enemy packs
        h.pose = 'cast_s';
        h.castPoseTimer = 0.26;
        this.shake(4, 0.16);
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          const lx = (tgt ? tgt.x : h.x) + (i > 0 ? (Math.random() - 0.5) * 65 : 0);
          const ly = (tgt ? tgt.y : h.y) + (i > 0 ? (Math.random() - 0.5) * 65 : 0);
          r.effects.push({ kind: 'lightning', x: lx, y: ly, r: calc.radius, color: '#fde047', t: 0, dur: 0.38 });
          this.damageCircle(lx, ly, calc.radius, calc.dmg, def.id, null, 40);
        }
        return true;
      }

      case 'meteor': {
        // Meteor Storm: falling meteors that detonate into flame pools
        h.pose = 'cast_s';
        h.castPoseTimer = 0.25;
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          const mx = (tgt ? tgt.x : h.x) + (Math.random() - 0.5) * 70;
          const my = (tgt ? tgt.y : h.y) + (Math.random() - 0.5) * 70;
          r.telegraphs.push({
            friendly: true,
            kind: 'meteor_fall',
            x: mx,
            y: my,
            r: calc.radius,
            dmg: calc.dmg,
            skillId: def.id,
            t: 0,
            dur: 0.42 + i * 0.14
          });
        }
        return true;
      }

      case 'arrows': {
        // Double Strafe: twin piercing high-crit arrows
        const tgt = targets[0];
        if (!tgt) return false;
        const baseAng = Math.atan2(tgt.y - h.y, tgt.x - h.x);
        const totalArrows = calc.count + 1;
        for (let i = 0; i < totalArrows; i++) {
          const spread = (i - (totalArrows - 1) / 2) * 0.09;
          const a = baseAng + spread;
          r.projectiles.push({
            kind: 'arrow',
            x: h.x,
            y: h.y,
            vx: Math.cos(a) * 720,
            vy: Math.sin(a) * 720,
            ang: a,
            r: 18,
            dmg: calc.dmg,
            pierce: 1 + Math.floor(st.level / 2) + (st.evolved ? 3 : 0),
            hitSet: new Set(),
            skillId: def.id,
            color: '#bef264',
            life: 0.9
          });
        }
        return true;
      }

      case 'shower': {
        // Arrow Shower: wide volley circle
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          if (!tgt) continue;
          r.effects.push({ kind: 'arrow_rain', x: tgt.x, y: tgt.y, r: calc.radius, color: '#a3e635', t: 0, dur: 0.42 });
          this.damageCircle(tgt.x, tgt.y, calc.radius, calc.dmg, def.id, null, 55);
        }
        return true;
      }

      case 'falcon': {
        // Blitz Beat: Hunting Falcon swooping down onto clusters!
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          if (!tgt) continue;
          r.effects.push({ kind: 'falcon_dive', x: tgt.x, y: tgt.y, r: calc.radius, color: '#fef08a', t: 0, dur: 0.44 });
          this.damageCircle(tgt.x, tgt.y, calc.radius, calc.dmg, def.id, null, 65);
        }
        return true;
      }

      case 'flurry': {
        // Sonic Blow: violet cross-slash flurries on nearest foes
        h.pose = 'atk_s';
        h.castPoseTimer = 0.22;
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          if (!tgt) continue;
          r.effects.push({ kind: 'cross_slash', x: tgt.x, y: tgt.y, r: calc.radius, color: '#c084fc', t: 0, dur: 0.30 });
          this.damageCircle(tgt.x, tgt.y, calc.radius, calc.dmg, def.id, null, 35, true);
        }
        return true;
      }

      case 'spin': {
        // Meteor Assault: spinning crimson blade ring + bleed
        h.pose = 'atk_s';
        h.castPoseTimer = 0.22;
        r.effects.push({ kind: 'blade_spin', x: h.x, y: h.y, r: calc.radius, color: '#fb7185', t: 0, dur: 0.32 });
        this.damageCircle(h.x, h.y, calc.radius, calc.dmg, def.id, null, 70, true);
        return true;
      }

      case 'rune_grid': {
        // Magnus Exorcismus: Iconic RO 3x3 glowing Grand Cross Rune Grid!
        h.pose = 'cast_s';
        h.castPoseTimer = 0.28;
        const tgt = targets[0];
        const gx = tgt ? tgt.x : h.x;
        const gy = tgt ? tgt.y : h.y;
        r.groundZones.push({
          kind: 'magnus',
          x: gx,
          y: gy,
          r: calc.radius,
          dmg: calc.dmg,
          skillId: def.id,
          t: 0,
          dur: 3.8,
          tickTimer: 0.1,
          tickRate: 0.5,
          holy: true,
          color: '#fde68a'
        });
        return true;
      }

      case 'sanctuary': {
        // Sanctuary: Emerald healing + monster-repelling ring around hero
        h.pose = 'cast_s';
        h.castPoseTimer = 0.25;
        r.groundZones.push({
          kind: 'sanctuary',
          x: h.x,
          y: h.y,
          r: calc.radius,
          dmg: calc.dmg,
          heal: Math.max(8, Math.round(h.maxHp * 0.035)),
          skillId: def.id,
          t: 0,
          dur: 3.6,
          tickTimer: 0.15,
          tickRate: 0.6,
          holy: true,
          color: '#34d399'
        });
        return true;
      }

      case 'spheres': {
        // Throw Spirit Sphere: fires piercing chi orbs from orbiting spheres
        for (let i = 0; i < calc.count; i++) {
          const tgt = targets[i % targets.length];
          if (!tgt) continue;
          const a = Math.atan2(tgt.y - h.y, tgt.x - h.x) + (i - (calc.count - 1) / 2) * 0.08;
          r.projectiles.push({
            kind: 'sphere',
            x: h.x + Math.cos(r.sphereAngle + i) * 42,
            y: h.y + Math.sin(r.sphereAngle + i) * 42,
            vx: Math.cos(a) * 590,
            vy: Math.sin(a) * 590,
            ang: a,
            r: 20,
            dmg: calc.dmg,
            pierce: 2 + Math.floor(st.level / 2),
            hitSet: new Set(),
            skillId: def.id,
            color: '#67e8f9',
            life: 1.05
          });
        }
        return true;
      }

      case 'asura': {
        // Guillotine Fist (Asura Strike): Colossal burst + Kanji flash!
        const boss = this.findStrongestEnemy(h.x, h.y, 460) || targets[0];
        if (!boss) return false;
        h.pose = 'atk_s';
        h.castPoseTimer = 0.35;
        this.shake(9, 0.28);
        r.effects.push({ kind: 'asura_kanji', x: boss.x, y: boss.y, r: calc.radius, color: '#facc15', t: 0, dur: 0.62 });
        this.damageCircle(boss.x, boss.y, calc.radius, calc.dmg, def.id, '#facc15', 190);
        return true;
      }
    }
    return false;
  }

  damageCircle(cx, cy, radius, baseDmg, skillId, ringColor = null, knockback = 45, bleed = false, isHoly = false) {
    const r = this.run;
    if (ringColor) {
      r.effects.push({ kind: 'ring', x: cx, y: cy, r: 16, maxR: radius, color: ringColor, t: 0, dur: 0.28 });
    }
    for (const e of r.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d <= radius + e.radius) {
        let dmg = baseDmg;
        if (isHoly && e.def.undead) dmg = Math.round(dmg * 1.35);
        const ang = Math.atan2(e.y - cy, e.x - cx);
        this.hitEnemy(e, dmg, skillId, knockback, ang);
        if (bleed && !e.dead) {
          e.bleedTimer = 2.6;
          e.bleedDmg = Math.max(4, Math.round(baseDmg * 0.22));
        }
      }
    }
  }

  damageLine(x1, y1, x2, y2, width, baseDmg, skillId, stunDur = 0, bleed = false) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy || 1;
    for (const e of this.run.enemies) {
      if (e.dead) continue;
      const t = Math.max(0, Math.min(1, ((e.x - x1) * dx + (e.y - y1) * dy) / lenSq));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      if (Math.hypot(e.x - px, e.y - py) <= width + e.radius) {
        this.hitEnemy(e, baseDmg, skillId, 95, Math.atan2(dy, dx));
        if (stunDur > 0) e.stunTimer = Math.max(e.stunTimer || 0, stunDur);
        if (bleed) {
          e.bleedTimer = 3.0;
          e.bleedDmg = Math.max(5, Math.round(baseDmg * 0.25));
        }
      }
    }
  }

  hitEnemy(e, rawDmg, skillId, knockback = 40, ang = 0) {
    if (e.dead) return;
    const r = this.run;
    const h = r.hero;

    let dmg = rawDmg;
    if (e.isBoss) dmg = Math.round(dmg * h.acc.bossDmgMult);

    const isCrit = Math.random() < h.critChance;
    if (isCrit) {
      dmg = Math.round(dmg * h.critMult);
    }
    // Slight classic RO damage variance (+/- 6%)
    dmg = Math.max(1, Math.round(dmg * (0.94 + Math.random() * 0.12)));

    e.hp -= dmg;
    e.flashTimer = 0.11;

    // Dracula Card Life-on-Hit
    if (h.acc.lifeOnHit > 0) {
      h.hitCounter++;
      if (h.hitCounter >= 12) {
        h.hitCounter = 0;
        h.hp = Math.min(h.maxHp, h.hp + h.acc.lifeOnHit);
      }
    }

    // Track skill damage & rolling DPS
    if (skillId && h.skills[skillId]) {
      h.skills[skillId].totalDmg += dmg;
    }
    r.dpsWindow.push({ t: r.time, d: dmg });

    // Knockback (reduced on bosses)
    const kb = e.isBoss ? knockback * 0.12 : knockback;
    e.x += Math.cos(ang) * kb * 0.28;
    e.y += Math.sin(ang) * kb * 0.28;

    this.addFloatingText(
      e.x + (Math.random() - 0.5) * 18,
      e.y - e.heightOffset,
      `${dmg}`,
      isCrit ? '#fde047' : '#ffffff',
      isCrit
    );

    if (e.hp <= 0) {
      this.killEnemy(e);
    }
  }

  killEnemy(e) {
    e.dead = true;
    e.deadTimer = 0;
    const r = this.run;
    r.kills += 1;

    if (e.mobId === 1002 || e.mobId === 1031 || e.mobId === 1090) {
      this.audio.playSfx('poring_die', 0.22, 180);
    } else {
      this.audio.playSfx('hit1', 0.20, 140);
    }

    // Drop EXP Crystal
    const xpVal = Math.round(e.def.xp * r.zone.mult);
    const xpIcon = xpVal >= 80 ? 984 : xpVal >= 22 ? 985 : 909;
    r.loots.push({
      kind: 'xp',
      x: e.x,
      y: e.y,
      val: xpVal,
      icon: xpIcon,
      magnetized: false
    });

    // Chance for Zeny Coin or Potion
    const roll = Math.random();
    if (e.isBoss) {
      const zenyAmt = Math.round((e.def.mvp ? 95 : 45) * r.zone.mult * r.hero.acc.zenyMult);
      r.loots.push({ kind: 'zeny', x: e.x - 18, y: e.y + 8, val: zenyAmt, icon: 7539, magnetized: true });
      r.loots.push({ kind: 'chest', x: e.x + 18, y: e.y + 8, val: 1, icon: 603, magnetized: false });
      r.loots.push({ kind: 'potion', x: e.x, y: e.y + 22, val: 0.45, icon: 607, magnetized: false });

      if (e.def.mvp) {
        this.audio.playSfx('mvp', 0.55, 50);
        r.effects.push({ kind: 'mvp_sign', x: e.x, y: e.y - 45, t: 0, dur: 2.6 });
        this.cb.onBanner(`MVP DEFEATED: ${e.def.name}!`);
      }

      // Authentic RO Monster Card drop chance (45% on MVP, 28% on Mini-Boss)
      const cardChance = e.def.mvp ? 0.55 : 0.32;
      if (e.def.cardId && Math.random() < cardChance) {
        r.loots.push({ kind: 'card', x: e.x, y: e.y - 12, cardId: e.def.cardId, icon: 4001, magnetized: false });
      }
    } else if (roll < 0.085) {
      const zenyAmt = Math.max(2, Math.round((3 + Math.random() * 4) * r.zone.mult * r.hero.acc.zenyMult));
      r.loots.push({ kind: 'zeny', x: e.x + 6, y: e.y, val: zenyAmt, icon: 7539, magnetized: false });
    } else if (roll < 0.112) {
      const isWhite = Math.random() < 0.25;
      r.loots.push({ kind: 'potion', x: e.x - 6, y: e.y, val: isWhite ? 0.28 : 0.14, icon: isWhite ? 504 : 501, magnetized: false });
    }
  }

  updateProjectiles(dt) {
    const r = this.run;
    for (let i = r.projectiles.length - 1; i >= 0; i--) {
      const p = r.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        r.projectiles.splice(i, 1);
        continue;
      }

      if (p.hostile) {
        const h = r.hero;
        if (Math.hypot(p.x - h.x, p.y - h.y) < p.r + 18) {
          this.damageHero(p.dmg);
          r.projectiles.splice(i, 1);
        }
        continue;
      }

      for (const e of r.enemies) {
        if (e.dead || p.hitSet.has(e)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) <= p.r + e.radius) {
          p.hitSet.add(e);
          this.hitEnemy(e, p.dmg, p.skillId, 38, p.ang);
          p.pierce -= 1;
          if (p.pierce <= 0) break;
        }
      }
      if (p.pierce <= 0) {
        r.projectiles.splice(i, 1);
      }
    }
  }

  updateGroundZones(dt) {
    const r = this.run;
    const h = r.hero;
    for (let i = r.groundZones.length - 1; i >= 0; i--) {
      const g = r.groundZones[i];
      g.t += dt;
      g.tickTimer -= dt;
      if (g.tickTimer <= 0) {
        g.tickTimer = g.tickRate;
        if (g.kind === 'sanctuary' && Math.hypot(h.x - g.x, h.y - g.y) <= g.r + 22) {
          h.hp = Math.min(h.maxHp, h.hp + g.heal);
          this.addFloatingText(h.x, h.y - 38, `+${g.heal}`, '#4ade80', false);
        }
        for (const e of r.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - g.x, e.y - g.y) <= g.r + e.radius) {
            let dmg = g.dmg;
            if (g.holy && e.def.undead) dmg = Math.round(dmg * 1.4);
            this.hitEnemy(e, dmg, g.skillId, g.kind === 'sanctuary' ? 75 : 18, Math.atan2(e.y - g.y, e.x - g.x));
            if (g.chill) e.chillTimer = 1.4;
          }
        }
      }
      if (g.t >= g.dur) {
        r.groundZones.splice(i, 1);
      }
    }
  }

  updateTelegraphs(dt) {
    const r = this.run;
    const h = r.hero;
    for (let i = r.telegraphs.length - 1; i >= 0; i--) {
      const tg = r.telegraphs[i];
      tg.t += dt;
      if (tg.t >= tg.dur) {
        if (tg.friendly) {
          // Meteor impact!
          this.shake(5, 0.18);
          r.effects.push({ kind: 'fire_pillar', x: tg.x, y: tg.y, r: tg.r, color: '#fb7185', t: 0, dur: 0.4 });
          this.damageCircle(tg.x, tg.y, tg.r, tg.dmg, tg.skillId, '#f43f5e', 95);
        } else {
          // Boss AoE cast finishes!
          r.effects.push({ kind: 'ring', x: tg.x, y: tg.y, r: 14, maxR: tg.r, color: '#ef4444', t: 0, dur: 0.34 });
          if (Math.hypot(h.x - tg.x, h.y - tg.y) <= tg.r + 14 && h.zHop < 16) {
            this.damageHero(tg.dmg);
          }
        }
        r.telegraphs.splice(i, 1);
      }
    }
  }

  updateSpawner(dt) {
    const r = this.run;
    const z = r.zone;
    const minutes = r.time / 60;

    // Scheduled Bosses & MVPs
    if (r.bossIdx < z.bosses.length && r.time >= z.bosses[r.bossIdx].time) {
      const bSpec = z.bosses[r.bossIdx];
      r.bossIdx += 1;
      this.spawnMonster(bSpec.mobId, true);
    } else if (r.bossIdx >= z.bosses.length && r.time >= r.endlessBossTimer) {
      r.endlessBossTimer += 95;
      const lastBoss = z.bosses[z.bosses.length - 1];
      this.spawnMonster(lastBoss.mobId, true);
    }

    // Continuous Wave Escalation
    r.spawnTimer -= dt;
    if (r.spawnTimer <= 0) {
      const activeAlive = r.enemies.reduce((c, e) => c + (e.dead ? 0 : 1), 0);
      const cap = Math.min(185, Math.floor(34 + minutes * 32));
      if (activeAlive < cap) {
        const batch = Math.min(7, 2 + Math.floor(minutes * 1.4));
        const maxUnlockIdx = Math.min(z.mobs.length - 1, Math.floor(r.time / 38));
        for (let i = 0; i < batch; i++) {
          const pickIdx = Math.floor(Math.random() * (maxUnlockIdx + 1));
          this.spawnMonster(z.mobs[pickIdx], false);
        }
      }
      r.spawnTimer = Math.max(0.28, 1.05 - minutes * 0.12);
    }
  }

  spawnMonster(mobId, isBoss = false) {
    const r = this.run;
    const h = r.hero;
    const def = MOB_DB[mobId];
    if (!def) return;

    const ang = Math.random() * Math.PI * 2;
    const dist = isBoss ? 410 : 470 + Math.random() * 140;
    const x = h.x + Math.cos(ang) * dist;
    const y = h.y + Math.sin(ang) * dist;

    const timeScale = 1 + (r.time / 60) * 0.34;
    const maxHp = Math.round(def.hp * r.zone.mult * timeScale);

    const enemy = {
      mobId,
      def,
      isBoss: Boolean(isBoss || def.mvp || def.miniBoss),
      x,
      y,
      hp: maxHp,
      maxHp,
      speed: def.speed * (0.95 + Math.random() * 0.1),
      dmg: Math.round(def.dmg * r.zone.mult * (1 + (r.time / 60) * 0.18)),
      radius: (def.mvp ? 34 : def.miniBoss ? 28 : 20) * (def.scale || 1),
      heightOffset: def.mvp ? 66 : 42,
      animMs: Math.random() * 500,
      atkTimer: 0,
      castCd: 5.2,
      aliveTime: 0,
      enraged: false,
      dead: false,
      deadTimer: 0,
      flashTimer: 0,
      chillTimer: 0,
      stunTimer: 0,
      bleedTimer: 0,
      bleedTick: 0.5,
      bleedDmg: 0,
      contactCd: 0
    };

    r.enemies.push(enemy);
    if (enemy.isBoss) {
      this.audio.playSfx('mvp', 0.36, 100);
      this.cb.onBanner(`⚠ ${def.mvp ? 'MVP' : 'MINI-BOSS'} APPEARED: ${def.name}!`);
    }
  }

  updateEnemies(dt) {
    const r = this.run;
    const h = r.hero;

    for (let i = r.enemies.length - 1; i >= 0; i--) {
      const e = r.enemies[i];
      if (e.dead) {
        e.deadTimer += dt;
        if (e.deadTimer >= 0.55) {
          r.enemies.splice(i, 1);
        }
        continue;
      }

      e.aliveTime += dt;
      e.animMs += dt * 1000;
      if (e.flashTimer > 0) e.flashTimer -= dt;
      if (e.chillTimer > 0) e.chillTimer -= dt;
      if (e.stunTimer > 0) e.stunTimer -= dt;
      if (e.contactCd > 0) e.contactCd -= dt;
      if (e.sphereHitCd > 0) e.sphereHitCd -= dt;
      if (e.atkTimer > 0) e.atkTimer -= dt;

      if (e.bleedTimer > 0) {
        e.bleedTimer -= dt;
        e.bleedTick -= dt;
        if (e.bleedTick <= 0) {
          e.bleedTick = 0.55;
          this.hitEnemy(e, e.bleedDmg, null, 0, 0);
          if (e.dead) continue;
        }
      }

      const dx = h.x - e.x;
      const dy = h.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Relocate non-boss monsters that fell super far behind camera
      if (!e.isBoss && dist > 1100) {
        const ang = Math.random() * Math.PI * 2;
        e.x = h.x + Math.cos(ang) * 520;
        e.y = h.y + Math.sin(ang) * 520;
        continue;
      }

      // Boss Enrage & Telegraphed AoE Spells (prevents infinite passive kiting!)
      if (e.isBoss) {
        if (!e.enraged && e.aliveTime >= 48) {
          e.enraged = true;
          e.speed *= 1.32;
          e.dmg = Math.round(e.dmg * 1.28);
          this.cb.onBanner(`${e.def.name} has ENRAGED!`);
        }
        e.castCd -= dt;
        if (e.castCd <= 0 && dist < 480) {
          e.castCd = e.enraged ? 3.4 : 5.2;
          e.atkTimer = 0.55;
          // Place telegraphed red RO spell circle ahead of hero's movement!
          const leadX = h.x + h.vx * 0.45;
          const leadY = h.y + h.vy * 0.45;
          r.telegraphs.push({
            friendly: false,
            x: leadX,
            y: leadY,
            r: e.def.mvp ? 98 : 78,
            dmg: Math.round(e.dmg * 1.35),
            t: 0,
            dur: e.enraged ? 0.95 : 1.25
          });
        }
      }

      if (e.stunTimer <= 0) {
        const chillMult = e.chillTimer > 0 ? 0.55 : 1.0;
        const spd = e.speed * chillMult;
        e.x += (dx / dist) * spd * dt;
        e.y += (dy / dist) * spd * dt;
      }

      // Soft separation vs adjacent monsters so hordes look like a real swarm, not a single pixel
      for (let j = Math.max(0, i - 6); j < i; j++) {
        const o = r.enemies[j];
        if (o.dead) continue;
        const sx = e.x - o.x;
        const sy = e.y - o.y;
        const sd = Math.hypot(sx, sy) || 0.1;
        const minSep = (e.radius + o.radius) * 0.68;
        if (sd < minSep) {
          const push = (minSep - sd) * 0.32;
          e.x += (sx / sd) * push;
          e.y += (sy / sd) * push;
          o.x -= (sx / sd) * push;
          o.y -= (sy / sd) * push;
        }
      }

      // Contact melee hit on Hero
      if (dist <= e.radius + 17 && e.contactCd <= 0) {
        e.contactCd = 0.72;
        e.atkTimer = 0.4;
        this.damageHero(e.dmg);
      }
    }
  }

  damageHero(rawDmg) {
    const r = this.run;
    const h = r.hero;
    if (h.iframeTimer > 0 || this.state !== 'playing') return;

    // Flee dodge roll!
    if (Math.random() < h.dodge) {
      this.addFloatingText(h.x, h.y - 46, 'FLEE!', '#93c5fd', false);
      return;
    }

    let dmg = Math.max(2, Math.round(rawDmg - h.armor));
    if (h.barrier > 0) {
      const absorbed = Math.min(h.barrier, dmg);
      h.barrier -= absorbed;
      dmg -= absorbed;
      if (dmg <= 0) {
        this.addFloatingText(h.x, h.y - 44, 'GUARD', '#60a5fa', false);
        h.iframeTimer = 0.22;
        return;
      }
    }

    h.hp = Math.max(0, h.hp - dmg);
    h.iframeTimer = 0.28 + (h.acc.iframeBonus || 0);
    this.shake(6, 0.18);
    this.audio.playSfx('hit2', 0.34, 100);
    this.addFloatingText(h.x, h.y - 42, `-${dmg}`, '#f87171', true);

    if (h.hp <= 0) {
      h.pose = 'dead';
      this.finishRun(false);
    }
  }

  updateLoots(dt) {
    const r = this.run;
    const h = r.hero;

    for (let i = r.loots.length - 1; i >= 0; i--) {
      const l = r.loots[i];
      const dx = h.x - l.x;
      const dy = h.y - l.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (l.kind === 'xp' || l.kind === 'zeny') {
        if (dist <= h.magnetRadius) l.magnetized = true;
      } else if (dist <= 62) {
        l.magnetized = true;
      }

      if (l.magnetized) {
        const pullSpd = 540;
        l.x += (dx / dist) * pullSpd * dt;
        l.y += (dy / dist) * pullSpd * dt;
      }

      if (dist <= 26) {
        this.collectLoot(l);
        r.loots.splice(i, 1);
      }
    }
  }

  collectLoot(l) {
    const r = this.run;
    const h = r.hero;

    if (l.kind === 'xp') {
      h.xp += l.val * h.xpMult;
      while (h.xp >= h.xpNext) {
        h.xp -= h.xpNext;
        h.level += 1;
        h.xpNext = Math.round(h.xpNext * 1.24 + 18);
        h.pendingLevels += 1;
        h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.12));
        this.audio.playSfx('levelup', 0.50, 100);
        r.effects.push({ kind: 'levelup_halo', x: h.x, y: h.y, t: 0, dur: 1.35 });
        if (h.level === 5) {
          this.cb.onBanner(`⚡ [F] ${h.classDef.mobility.name} UNLOCKED!`);
        }
      }
    } else if (l.kind === 'zeny') {
      this.audio.playSfx('coin', 0.28, 80);
      r.zenyEarned += l.val;
      this.meta.addZeny(l.val);
      this.addFloatingText(h.x, h.y - 34, `+${l.val}z`, '#fde047', false);
    } else if (l.kind === 'potion') {
      this.audio.playSfx('potion', 0.36, 100);
      const heal = Math.round(h.maxHp * l.val);
      h.hp = Math.min(h.maxHp, h.hp + heal);
      this.addFloatingText(h.x, h.y - 38, `+${heal} HP`, '#4ade80', true);
    } else if (l.kind === 'chest') {
      this.audio.playSfx('levelup', 0.45, 80);
      h.pendingLevels += 1;
      this.addFloatingText(h.x, h.y - 48, 'OLD BLUE BOX!', '#60a5fa', true);
    } else if (l.kind === 'card') {
      this.audio.playSfx('mvp', 0.55, 50);
      const isNew = this.meta.unlockCard(l.cardId);
      r.cardsFound.push({ cardId: l.cardId, isNew });
      if (!isNew) {
        this.meta.addZeny(80);
        r.zenyEarned += 80;
      }
      this.cb.onCardLooted(l.cardId, isNew);
    }
  }

  updateEffects(dt) {
    const r = this.run;
    for (let i = r.effects.length - 1; i >= 0; i--) {
      r.effects[i].t += dt;
      if (r.effects[i].t >= r.effects[i].dur) r.effects.splice(i, 1);
    }
    for (let i = r.floatingTexts.length - 1; i >= 0; i--) {
      const ft = r.floatingTexts[i];
      ft.t += dt;
      ft.y -= 36 * dt;
      if (ft.t >= ft.dur) r.floatingTexts.splice(i, 1);
    }
  }

  addFloatingText(x, y, text, color = '#ffffff', big = false) {
    if (!this.run) return;
    if (this.run.floatingTexts.length > 90) this.run.floatingTexts.shift();
    this.run.floatingTexts.push({ x, y, text, color, big, t: 0, dur: big ? 0.85 : 0.62 });
  }

  finishRun(victory = false) {
    this.state = 'gameover';
    const r = this.run;
    const prevBest = this.meta.data.bestTimes[r.zone.id] || 0;
    if (r.time > prevBest) {
      this.meta.data.bestTimes[r.zone.id] = Math.floor(r.time);
      this.meta.save();
    }
    this.cb.onGameOver(r, victory);
  }

  /* =========================================================
     Rendering Pipeline (World Ground, Shadows, Y-Sorted Billboards, VFX, RO HUD Bars & Minimap)
     ========================================================= */
  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    if (!this.run) {
      this.renderMenuBackdrop(ctx);
      ctx.restore();
      return;
    }

    const r = this.run;
    const h = r.hero;

    const sx = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - 0.5) * this.shakeMag * 2 : 0;

    const toScreen = (wx, wy) => ({
      x: this.viewW / 2 + (wx - h.x) * this.zoom + sx,
      y: this.viewH / 2 + (wy - h.y) * this.zoom * this.tiltY + sy
    });

    // 1. Tiled Authentic RO Ground Map
    this.renderGround(ctx, r.zone.id, h.x, h.y, sx, sy);

    // 2. Ground Skill Zones & Boss Cast Telegraphs
    this.renderGroundZones(ctx, toScreen);
    this.renderTelegraphs(ctx, toScreen);

    // 3. World Landmarks & Loot Drops
    this.renderPropsAndLoot(ctx, toScreen);

    // 4. Y-Sorted Entities (Monsters + Hero + Spirit Spheres)
    const drawList = [];
    for (const e of r.enemies) {
      const sp = toScreen(e.x, e.y);
      if (sp.x < -160 || sp.x > this.viewW + 160 || sp.y < -180 || sp.y > this.viewH + 180) continue;
      drawList.push({ y: e.y, type: 'enemy', e, sp });
    }
    drawList.push({ y: h.y, type: 'hero', sp: toScreen(h.x, h.y) });
    drawList.sort((a, b) => a.y - b.y);

    for (const item of drawList) {
      if (item.type === 'enemy') {
        this.renderEnemy(ctx, item.e, item.sp);
      } else {
        this.renderHero(ctx, h, item.sp);
      }
    }

    // 5. Projectiles, Spell Effects & Classic RO Damage Numbers
    this.renderProjectiles(ctx, toScreen);
    this.renderEffects(ctx, toScreen);
    this.renderFloatingTexts(ctx, toScreen);

    // Zone Atmospheric Vignette
    if (r.zone.tint) {
      ctx.fillStyle = r.zone.tint;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    ctx.restore();

    // Update Minimap & DOM HUD
    this.renderMinimap();
    this.cb.onHudSync(r);
  }

  renderMenuBackdrop(ctx) {
    const zoneId = this.meta.data.pick.zoneId || 'prt_fild08';
    const t = performance.now() * 0.022;
    this.renderGround(ctx, zoneId, t, t * 0.55, 0, 0);
    ctx.fillStyle = 'rgba(10, 15, 24, 0.42)';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  renderGround(ctx, zoneId, camX, camY, sx, sy) {
    const tile = this.assets.bakeGroundCanvas(zoneId);
    const tw = tile.width * this.zoom;
    const th = tile.height * this.zoom * this.tiltY;

    const ox = (((-camX * this.zoom + this.viewW / 2) % tw) + tw) % tw;
    const oy = (((-camY * this.zoom * this.tiltY + this.viewH / 2) % th) + th) % th;

    for (let y = oy - th; y < this.viewH + th; y += th) {
      for (let x = ox - tw; x < this.viewW + tw; x += tw) {
        ctx.drawImage(tile, x + sx, y + sy, tw + 1, th + 1);
      }
    }
  }

  renderGroundZones(ctx, toScreen) {
    for (const g of this.run.groundZones) {
      const p = toScreen(g.x, g.y);
      const rx = g.r * this.zoom;
      const ry = g.r * this.zoom * this.tiltY;
      const fade = Math.min(1, (g.dur - g.t) * 2);

      ctx.save();
      ctx.globalAlpha = 0.55 * fade;
      ctx.translate(p.x, p.y);

      if (g.kind === 'magnus') {
        // Iconic RO Grand Cross 3x3 Sacred Rune Grid
        ctx.strokeStyle = '#fde047';
        ctx.fillStyle = 'rgba(254, 240, 138, 0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const w = rx * 1.3;
        const h = ry * 1.3;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.beginPath();
        ctx.moveTo(-w / 6, -h / 2); ctx.lineTo(-w / 6, h / 2);
        ctx.moveTo(w / 6, -h / 2); ctx.lineTo(w / 6, h / 2);
        ctx.moveTo(-w / 2, -h / 6); ctx.lineTo(w / 2, -h / 6);
        ctx.moveTo(-w / 2, h / 6); ctx.lineTo(w / 2, h / 6);
        ctx.stroke();
      } else if (g.kind === 'sanctuary') {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.20)';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Inner healing cross
        ctx.fillStyle = 'rgba(167, 243, 208, 0.55)';
        ctx.fillRect(-7, -ry * 0.45, 14, ry * 0.9);
        ctx.fillRect(-rx * 0.45, -6, rx * 0.9, 12);
      } else if (g.kind === 'storm_gust') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Swirling blizzard shards
        for (let k = 0; k < 6; k++) {
          const a = g.t * 5 + (k * Math.PI) / 3;
          const sx = Math.cos(a) * rx * 0.65;
          const sy = Math.sin(a) * ry * 0.65;
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(sx - 3, sy - 9, 6, 14);
        }
      } else {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.20)';
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  renderTelegraphs(ctx, toScreen) {
    for (const tg of this.run.telegraphs) {
      const p = toScreen(tg.x, tg.y);
      const prog = Math.min(1, tg.t / tg.dur);
      const rx = tg.r * this.zoom;
      const ry = tg.r * this.zoom * this.tiltY;

      ctx.save();
      ctx.translate(p.x, p.y);
      if (tg.friendly) {
        // Falling Meteor shadow + fireball streak!
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * prog, ry * prog, 0, 0, Math.PI * 2);
        ctx.stroke();

        const fallOffset = (1 - prog) * 260;
        ctx.fillStyle = '#fb7185';
        ctx.beginPath();
        ctx.arc(fallOffset * 0.45, -fallOffset, 15 * this.zoom, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Hostile Boss Red Cast Warning Circle
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(239, 68, 68, 0.36)';
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * prog, ry * prog, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  renderPropsAndLoot(ctx, toScreen) {
    const r = this.run;
    const bob = Math.sin(r.time * 4.5) * 3;

    // Odin Shrines
    for (const p of r.props) {
      if (p.kind !== 'pylon') continue;
      const sp = toScreen(p.x, p.y);
      if (sp.x < -60 || sp.x > this.viewW + 60 || sp.y < -60 || sp.y > this.viewH + 60) continue;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.fillStyle = p.used ? 'rgba(100, 116, 139, 0.5)' : 'rgba(250, 204, 21, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24 * this.zoom, 14 * this.zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.used ? '#64748b' : '#fde047';
      ctx.fillRect(-6, -28, 12, 28);
      if (!p.used) {
        ctx.font = '700 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef9c3';
        ctx.fillText('SHRINE', 0, -34);
      }
      ctx.restore();
    }

    // Authentic RO Item Icons on Ground
    for (const l of r.loots) {
      const sp = toScreen(l.x, l.y);
      if (sp.x < -40 || sp.x > this.viewW + 40 || sp.y < -40 || sp.y > this.viewH + 40) continue;
      const img = this.assets.getImage(`assets/icons/item/${l.icon}.png`);
      const size = (l.kind === 'chest' || l.kind === 'card' ? 28 : 20) * this.zoom;

      ctx.save();
      ctx.translate(sp.x, sp.y);
      if (l.kind === 'card' || l.kind === 'chest') {
        ctx.fillStyle = l.kind === 'card' ? 'rgba(250, 204, 21, 0.45)' : 'rgba(96, 165, 250, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 2, size * 0.7, size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (img) {
        ctx.drawImage(img, -size / 2, -size + bob, size, size);
      } else {
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(0, -6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  renderEnemy(ctx, e, sp) {
    const mobPoses = this.assets.manifest?.mobs?.[String(e.mobId)];
    const poseKey = e.dead ? 'dead' : e.atkTimer > 0 ? 'atk' : 'walk';
    const meta = mobPoses?.[poseKey] || mobPoses?.walk || mobPoses?.idle;

    const flipX = this.run.hero.x > e.x;
    const scale = (e.def.scale || 1) * this.zoom;
    const alpha = e.dead ? Math.max(0, 1 - e.deadTimer / 0.55) : 1;
    const tint = e.flashTimer > 0
      ? 'rgba(255, 255, 255, 0.65)'
      : e.chillTimer > 0
        ? 'rgba(56, 189, 248, 0.42)'
        : e.enraged
          ? 'rgba(239, 68, 68, 0.32)'
          : null;

    if (e.isBoss && !e.dead) {
      ctx.save();
      ctx.strokeStyle = e.enraged ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, e.radius * this.zoom, e.radius * this.zoom * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.assets.drawSprite(ctx, meta, e.dead ? e.deadTimer * 1000 : e.animMs, sp.x, sp.y, {
      flipX,
      scale,
      alpha,
      loop: !e.dead,
      tint
    });

    // Damaged Monster mini HP bar
    if (!e.dead && (e.hp < e.maxHp || e.isBoss)) {
      const bw = (e.isBoss ? 58 : 32) * this.zoom;
      const bh = e.isBoss ? 5 : 3.5;
      const bx = sp.x - bw / 2;
      const by = sp.y + 7;
      ctx.fillStyle = '#111827';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = e.isBoss ? '#f59e0b' : '#ef4444';
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
    }
  }

  renderHero(ctx, h, sp) {
    const heroPoses = this.assets.manifest?.heroes?.[h.classId]?.[h.gender];
    const meta = heroPoses?.[h.pose] || heroPoses?.idle_s;

    // Kyrie Eleison Barrier shimmer
    if (h.barrier > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(191, 219, 254, 0.78)';
      ctx.fillStyle = 'rgba(147, 197, 253, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y - 26 * this.zoom, 28 * this.zoom, 38 * this.zoom, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    this.assets.drawSprite(ctx, meta, h.animMs, sp.x, sp.y, {
      flipX: h.flipX,
      scale: 1.06 * this.zoom,
      alpha: h.iframeTimer > 0.12 ? 0.78 : 1,
      loop: h.pose !== 'dead',
      zHop: h.zHop * this.zoom
    });

    // Orbiting Monk Spirit Spheres
    if (h.skills.spirit_sphere || h.classId === 'champion') {
      const spState = h.skills.spirit_sphere;
      const orbCount = spState ? Math.min(7, 3 + spState.level) : 5;
      const orbR = 62 * h.areaMult * this.zoom;
      for (let i = 0; i < orbCount; i++) {
        const a = this.run.sphereAngle + (i / orbCount) * Math.PI * 2;
        const ox = sp.x + Math.cos(a) * orbR;
        const oy = sp.y - 16 * this.zoom + Math.sin(a) * orbR * this.tiltY;
        ctx.save();
        const grad = ctx.createRadialGradient(ox, oy, 2, ox, oy, 10 * this.zoom);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.45, '#67e8f9');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ox, oy, 10 * this.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Authentic Classic RO Foot HP / SP Bar directly beneath player!
    const barW = 54;
    const bx = Math.round(sp.x - barW / 2);
    const by = Math.round(sp.y + 8);
    ctx.fillStyle = '#101820';
    ctx.fillRect(bx - 1, by - 1, barW + 2, 9);
    ctx.fillStyle = '#19d44e';
    ctx.fillRect(bx, by, barW * Math.max(0, h.hp / h.maxHp), 4);
    ctx.fillStyle = '#2e86ff';
    ctx.fillRect(bx, by + 4, barW * Math.max(0, h.sp / h.maxSp), 3);
  }

  renderProjectiles(ctx, toScreen) {
    for (const p of this.run.projectiles) {
      const sp = toScreen(p.x, p.y);
      ctx.save();
      ctx.translate(sp.x, sp.y - 16 * this.zoom);
      ctx.rotate(p.ang);

      if (p.kind === 'arrow') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * this.zoom;
        ctx.beginPath();
        ctx.moveTo(-14 * this.zoom, 0);
        ctx.lineTo(14 * this.zoom, 0);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(16 * this.zoom, 0);
        ctx.lineTo(8 * this.zoom, -4 * this.zoom);
        ctx.lineTo(8 * this.zoom, 4 * this.zoom);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'lance') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(26 * this.zoom, 0);
        ctx.lineTo(-20 * this.zoom, -7 * this.zoom);
        ctx.lineTo(-14 * this.zoom, 0);
        ctx.lineTo(-20 * this.zoom, 7 * this.zoom);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 8 * this.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  renderEffects(ctx, toScreen) {
    for (const ef of this.run.effects) {
      const p = toScreen(ef.x, ef.y);
      const prog = Math.min(1, ef.t / ef.dur);
      const fade = 1 - prog;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = fade;

      if (ef.kind === 'ring') {
        const rad = (ef.r + (ef.maxR - ef.r) * prog) * this.zoom;
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, rad, rad * this.tiltY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ef.kind === 'slash_arc') {
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 7 * this.zoom;
        ctx.beginPath();
        ctx.arc(0, -14 * this.zoom, ef.r * this.zoom * (0.65 + prog * 0.35), ef.ang - 1.05, ef.ang + 1.05);
        ctx.stroke();
      } else if (ef.kind === 'fire_pillar' || ef.kind === 'holy_pillar') {
        const w = ef.r * 0.72 * this.zoom;
        const h = 150 * this.zoom;
        const grad = ctx.createLinearGradient(0, 0, 0, -h);
        grad.addColorStop(0, ef.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-w / 2, -h, w, h);
      } else if (ef.kind === 'lightning') {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo((Math.random() - 0.5) * 30, -210 * this.zoom);
        ctx.lineTo((Math.random() - 0.5) * 24, -100 * this.zoom);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, ef.r * this.zoom * prog, ef.r * this.zoom * this.tiltY * prog, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ef.kind === 'cross_slash') {
        const s = ef.r * 0.75 * this.zoom;
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-s, -s - 15); ctx.lineTo(s, s - 15);
        ctx.moveTo(s, -s - 15); ctx.lineTo(-s, s - 15);
        ctx.stroke();
      } else if (ef.kind === 'blade_spin') {
        const rad = ef.r * this.zoom;
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(0, -14 * this.zoom, rad, rad * this.tiltY, prog * 5, 0, Math.PI * 1.65);
        ctx.stroke();
      } else if (ef.kind === 'arrow_rain') {
        ctx.strokeStyle = ef.color;
        ctx.lineWidth = 2;
        for (let k = 0; k < 8; k++) {
          const ox = ((k * 37) % (ef.r * 1.4)) - ef.r * 0.7;
          const oy = ((k * 23) % (ef.r * 0.8)) - ef.r * 0.4;
          ctx.beginPath();
          ctx.moveTo(ox + 18, oy - 75 * (1 - prog));
          ctx.lineTo(ox, oy);
          ctx.stroke();
        }
      } else if (ef.kind === 'falcon_dive') {
        const fx = (1 - prog) * -85;
        const fy = (1 - prog) * -130 - 16;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(fx + 18, fy + 10);
        ctx.lineTo(fx - 20, fy - 14);
        ctx.lineTo(fx - 4, fy + 2);
        ctx.lineTo(fx - 18, fy + 16);
        ctx.closePath();
        ctx.fill();
      } else if (ef.kind === 'asura_kanji') {
        ctx.font = `900 ${Math.round(54 * this.zoom)}px serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 4;
        ctx.strokeText('覇', 0, -28 * this.zoom);
        ctx.fillText('覇', 0, -28 * this.zoom);
      } else if (ef.kind === 'levelup_halo') {
        ctx.font = '800 18px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde047';
        ctx.fillText('✦ LEVEL UP! ✦', 0, -68 - prog * 28);
      } else if (ef.kind === 'mvp_sign') {
        ctx.globalAlpha = Math.min(1, fade * 1.5);
        ctx.font = '900 28px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 5;
        ctx.strokeText('★ MVP! ★', 0, -24 - prog * 22);
        ctx.fillStyle = '#fde047';
        ctx.fillText('★ MVP! ★', 0, -24 - prog * 22);
      }

      ctx.restore();
    }
  }

  renderFloatingTexts(ctx, toScreen) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of this.run.floatingTexts) {
      const p = toScreen(ft.x, ft.y);
      ctx.globalAlpha = Math.max(0, 1 - ft.t / ft.dur);
      ctx.font = ft.big ? '800 16px "JetBrains Mono", monospace' : '700 12.5px "JetBrains Mono", monospace';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, p.x, p.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, p.x, p.y);
    }
    ctx.restore();
  }

  renderMinimap() {
    const r = this.run;
    const ctx = this.mmCtx;
    const w = this.mmCanvas.width;
    const h = this.mmCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw authentic overhead RO Map image centered around player
    const mmSrc = this.assets.manifest?.maps?.[r.zone.id]?.minimap;
    const mmImg = this.assets.getImage(mmSrc);
    if (mmImg) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.drawImage(mmImg, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);
    }

    const scale = 0.085 * this.mmZoom;
    const cx = w / 2;
    const cy = h / 2;

    // Shrines (Yellow diamonds)
    for (const p of r.props) {
      if (p.kind !== 'pylon' || p.used) continue;
      const mx = cx + (p.x - r.hero.x) * scale;
      const my = cy + (p.y - r.hero.y) * scale;
      if (mx < 4 || mx > w - 4 || my < 4 || my > h - 4) continue;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(mx - 2.5, my - 2.5, 5, 5);
    }

    // Chests & Cards (Blue/Gold blips)
    for (const l of r.loots) {
      if (l.kind !== 'chest' && l.kind !== 'card') continue;
      const mx = cx + (l.x - r.hero.x) * scale;
      const my = cy + (l.y - r.hero.y) * scale;
      if (mx < 4 || mx > w - 4 || my < 4 || my > h - 4) continue;
      ctx.fillStyle = l.kind === 'card' ? '#fbbf24' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Monsters & Red Skull Bosses
    for (const e of r.enemies) {
      if (e.dead) continue;
      const mx = cx + (e.x - r.hero.x) * scale;
      const my = cy + (e.y - r.hero.y) * scale;
      if (mx < 3 || mx > w - 3 || my < 3 || my > h - 3) continue;
      ctx.fillStyle = e.isBoss ? '#facc15' : '#ef4444';
      const rad = e.isBoss ? 4.5 : 1.8;
      ctx.beginPath();
      ctx.arc(mx, my, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hero Center Arrow
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
