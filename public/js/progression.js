// Persistent Save State (Zeny, Kafra Upgrades, Monster Card Album, Remembered Pick)
// & Rarity-Scaled Level-Up Card Generator with Exact Before » After Stat Diffs

import { CLASSES, ZONES, SKILLS, PASSIVES, CARDS, KAFRA_UPGRADES, RARITIES } from './data.js?v=2';

const SAVE_KEY = 'ragnarok_survivors_save_v1';

export class MetaState {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          zeny: Number(parsed.zeny || 0),
          kafra: parsed.kafra || {},
          ownedCards: Array.isArray(parsed.ownedCards) ? parsed.ownedCards : [],
          slottedCards: Array.isArray(parsed.slottedCards) ? parsed.slottedCards.slice(0, 2) : [],
          pick: {
            classId: parsed.pick?.classId || 'lord_knight',
            gender: parsed.pick?.gender === 'female' ? 'female' : 'male',
            zoneId: parsed.pick?.zoneId || 'prt_fild08'
          },
          bestTimes: parsed.bestTimes || {}
        };
      }
    } catch (_) {}
    return {
      zeny: 60, // Starter Zeny gift from Kafra
      kafra: {},
      ownedCards: [],
      slottedCards: [],
      pick: { classId: 'lord_knight', gender: 'male', zoneId: 'prt_fild08' },
      bestTimes: {}
    };
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (_) {}
  }

  setPick(patch) {
    Object.assign(this.data.pick, patch);
    this.save();
  }

  addZeny(amount) {
    this.data.zeny = Math.max(0, Math.floor(this.data.zeny + amount));
    this.save();
  }

  unlockCard(cardId) {
    if (!this.data.ownedCards.includes(cardId)) {
      this.data.ownedCards.push(cardId);
      if (this.data.slottedCards.length < 2) {
        this.data.slottedCards.push(cardId);
      }
      this.save();
      return true;
    }
    return false;
  }

  toggleSlotCard(cardId) {
    if (!this.data.ownedCards.includes(cardId)) return;
    const idx = this.data.slottedCards.indexOf(cardId);
    if (idx >= 0) {
      this.data.slottedCards.splice(idx, 1);
    } else {
      if (this.data.slottedCards.length >= 2) {
        this.data.slottedCards.shift();
      }
      this.data.slottedCards.push(cardId);
    }
    this.save();
  }

  craftCard(cardId) {
    const def = CARDS.find((c) => c.id === cardId);
    if (!def || this.data.ownedCards.includes(cardId)) return false;
    if (this.data.zeny < def.cost) return false;
    this.data.zeny -= def.cost;
    this.unlockCard(cardId);
    return true;
  }

  getKafraCost(upDef) {
    const rank = this.data.kafra[upDef.id] || 0;
    return Math.round(upDef.baseCost * Math.pow(1.55, rank));
  }

  buyKafra(upId) {
    const def = KAFRA_UPGRADES.find((u) => u.id === upId);
    if (!def) return false;
    const rank = this.data.kafra[upId] || 0;
    if (rank >= def.maxRank) return false;
    const cost = this.getKafraCost(def);
    if (this.data.zeny < cost) return false;
    this.data.zeny -= cost;
    this.data.kafra[upId] = rank + 1;
    this.save();
    return true;
  }

  refundKafra() {
    let refund = 0;
    for (const def of KAFRA_UPGRADES) {
      const rank = this.data.kafra[def.id] || 0;
      for (let r = 0; r < rank; r++) {
        refund += Math.round(def.baseCost * Math.pow(1.55, r));
      }
    }
    this.data.kafra = {};
    this.data.zeny += refund;
    this.save();
  }

  computeAccountBonuses() {
    const b = {
      dmgMult: 1.0,
      hpMult: 1.0,
      speedMult: 1.0,
      hasteMult: 1.0,
      areaMult: 1.0,
      critChance: 0,
      critMult: 1.75,
      armor: 0,
      regen: 0.8,
      dodge: 0,
      zenyMult: 1.0,
      xpMult: 1.0,
      magnetMult: 1.0,
      bossDmgMult: 1.0,
      mobilityHaste: 0,
      bonusCount: 0,
      lifeOnHit: 0,
      iframeBonus: 0
    };
    for (const def of KAFRA_UPGRADES) {
      const r = this.data.kafra[def.id] || 0;
      if (r > 0) def.apply(b, r);
    }
    for (const cid of this.data.slottedCards) {
      const c = CARDS.find((x) => x.id === cid);
      if (c) c.apply(b);
    }
    return b;
  }
}

/**
 * Computes effective stats for an active skill state
 */
export function computeSkillStats(skillDef, state, hero) {
  const rank = state ? state.level : 1;
  const powerBonus = state ? state.powerBonus : 0;
  const evolved = Boolean(state && state.evolved);

  const dmgScale = (1 + (rank - 1) * 0.28 + powerBonus) * (evolved ? 1.55 : 1.0);
  const dmg = Math.round(skillDef.baseDmg * dmgScale * hero.dmgMult);

  const cdRaw = skillDef.baseCd * Math.pow(0.92, rank - 1) * (evolved ? 0.76 : 1.0);
  const cd = Math.max(0.26, cdRaw / hero.hasteMult);

  const extraFromRank = Math.floor((rank - 1) / 2) + (evolved ? 1 : 0);
  const count = skillDef.baseCount + extraFromRank + hero.bonusCount;

  const radius = Math.round(skillDef.baseRadius * (1 + (rank - 1) * 0.08 + (evolved ? 0.25 : 0)) * hero.areaMult);

  return { dmg, cd, count, radius };
}

function rollRarity(luckBonus = 0) {
  const pool = RARITIES.map((r, idx) => ({
    ...r,
    w: idx >= 2 ? r.weight * (1 + luckBonus) : r.weight
  }));
  const total = pool.reduce((s, r) => s + r.w, 0);
  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= r.w;
    if (roll <= 0) return r;
  }
  return pool[0];
}

/**
 * Generates 3 Upgrade Cards with Azeroth Survivors rarity colors & exact Before » After diffs
 */
export function generateUpgradeOffer(run) {
  const hero = run.hero;
  const classDef = CLASSES.find((c) => c.id === hero.classId);
  const candidates = [];

  const activeIds = Object.keys(hero.skills);
  const passiveIds = Object.keys(hero.passives);
  const activeFull = activeIds.length >= 6;
  const passiveFull = passiveIds.length >= 6;

  // 1. Check Transcendent Skill Evolutions (Lv.5+ Skill + Matching Passive Owned)
  for (const sid of activeIds) {
    const st = hero.skills[sid];
    const def = SKILLS[sid];
    if (st.level >= 5 && !st.evolved && def.evolveReq && hero.passives[def.evolveReq] > 0) {
      const cur = computeSkillStats(def, st, hero);
      const nxt = computeSkillStats(def, { ...st, level: st.level + 1, evolved: true }, hero);
      candidates.push({
        weight: 45,
        forceRarity: RARITIES[4], // MVP Mythic Gold
        kind: 'evolve',
        id: sid,
        icon: `assets/icons/skill/${def.icon}.png`,
        title: def.evolvedName,
        levelTag: `TRANSCENDENT EVOLUTION`,
        desc: `Awakens ${def.name} into ${def.evolvedName}! Dramatically amplifies power, speed, and AoE.`,
        diffs: [
          { label: 'Damage', before: `${cur.dmg}`, after: `${nxt.dmg}` },
          { label: 'Cooldown', before: `${cur.cd.toFixed(2)}s`, after: `${nxt.cd.toFixed(2)}s` },
          { label: 'Targets / Casts', before: `${cur.count}`, after: `${nxt.count}` }
        ],
        apply: () => {
          st.level += 1;
          st.evolved = true;
        }
      });
    }
  }

  // 2. Existing Active Skills (Lv < 8)
  for (const sid of activeIds) {
    const st = hero.skills[sid];
    const def = SKILLS[sid];
    if (st.level < 8) {
      const isSig = classDef.signatureSkills.includes(sid);
      candidates.push({
        weight: isSig ? 22 : 16,
        kind: 'skill_up',
        id: sid,
        def,
        st
      });
    }
  }

  // 3. New Active Skills (if < 6 slots)
  if (!activeFull) {
    for (const [sid, def] of Object.entries(SKILLS)) {
      if (hero.skills[sid]) continue;
      const isSig = classDef.signatureSkills.includes(sid);
      candidates.push({
        weight: isSig ? 24 : 9, // Favor own RO class kit while allowing wild cross-class builds!
        kind: 'skill_new',
        id: sid,
        def
      });
    }
  }

  // 4. Passives (existing < 5 or new if < 6 slots)
  for (const [pid, pdef] of Object.entries(PASSIVES)) {
    const rank = hero.passives[pid] || 0;
    if (rank > 0 && rank < 5) {
      candidates.push({ weight: 15, kind: 'passive_up', id: pid, pdef, rank });
    } else if (rank === 0 && !passiveFull) {
      // Boost weight if it unlocks an owned skill's evolution!
      const unlocksEvo = activeIds.some((sid) => SKILLS[sid].evolveReq === pid);
      candidates.push({ weight: unlocksEvo ? 20 : 11, kind: 'passive_new', id: pid, pdef, rank: 0 });
    }
  }

  const chosen = [];
  const pool = [...candidates];
  const luckBonus = (hero.passives.gloria || 0) * 0.15;

  while (chosen.length < 3 && pool.length > 0) {
    const totalW = pool.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * totalW;
    let pickIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        pickIdx = i;
        break;
      }
    }
    const item = pool.splice(pickIdx, 1)[0];
    chosen.push(materializeCard(item, hero, luckBonus));
  }

  // Fallback Yggdrasil Blessing if every slot maxed
  while (chosen.length < 3) {
    chosen.push({
      rarity: RARITIES[2],
      icon: 'assets/icons/item/607.png',
      title: 'Yggdrasil Blessing',
      levelTag: 'Instant Miracle',
      desc: 'Restores 60% Max HP immediately and permanently grants +10% All Damage for this run.',
      diffs: [
        { label: 'Heal HP', before: `${Math.round(hero.hp)}`, after: `${Math.min(hero.maxHp, Math.round(hero.hp + hero.maxHp * 0.6))}` },
        { label: 'Damage Mult', before: `${Math.round(hero.dmgMult * 100)}%`, after: `${Math.round((hero.dmgMult + 0.1) * 100)}%` }
      ],
      apply: () => {
        hero.runDmgBonus += 0.10;
        run.recalcHeroStats();
        hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.6);
      }
    });
  }

  return chosen;
}

function materializeCard(item, hero, luckBonus) {
  if (item.kind === 'evolve') {
    return {
      rarity: item.forceRarity,
      icon: item.icon,
      title: item.title,
      levelTag: item.levelTag,
      desc: item.desc,
      diffs: item.diffs,
      apply: item.apply
    };
  }

  const rarity = rollRarity(luckBonus);
  const bonusPower = (rarity.mult - 1.0) * 0.42;

  if (item.kind === 'skill_new') {
    const def = item.def;
    const previewState = { level: 1, powerBonus: bonusPower, evolved: false };
    const st = computeSkillStats(def, previewState, hero);
    return {
      rarity,
      icon: `assets/icons/skill/${def.icon}.png`,
      title: def.name,
      levelTag: 'NEW SKILL · Lv.1',
      desc: def.desc,
      diffs: [
        { label: 'Damage', before: '0', after: `${st.dmg}` },
        { label: 'Cooldown', before: '—', after: `${st.cd.toFixed(2)}s` },
        { label: 'Targets', before: '0', after: `${st.count}` }
      ],
      apply: () => {
        hero.skills[def.id] = { level: 1, powerBonus: bonusPower, evolved: false, timer: 0.15, totalDmg: 0 };
      }
    };
  }

  if (item.kind === 'skill_up') {
    const { def, st } = item;
    const cur = computeSkillStats(def, st, hero);
    const nextState = { ...st, level: st.level + 1, powerBonus: st.powerBonus + bonusPower };
    const nxt = computeSkillStats(def, nextState, hero);
    const diffs = [
      { label: 'Damage', before: `${cur.dmg}`, after: `${nxt.dmg}` },
      { label: 'Cooldown', before: `${cur.cd.toFixed(2)}s`, after: `${nxt.cd.toFixed(2)}s` }
    ];
    if (nxt.count > cur.count) {
      diffs.push({ label: 'Targets', before: `${cur.count}`, after: `${nxt.count}` });
    } else {
      diffs.push({ label: 'Area Radius', before: `${cur.radius}`, after: `${nxt.radius}` });
    }
    return {
      rarity,
      icon: `assets/icons/skill/${def.icon}.png`,
      title: st.evolved ? def.evolvedName : def.name,
      levelTag: `Lv.${st.level} » Lv.${st.level + 1}`,
      desc: def.desc,
      diffs,
      apply: () => {
        st.level += 1;
        st.powerBonus += bonusPower;
      }
    };
  }

  // Passives
  const { pdef, rank } = item;
  const gain = pdef.id === 'improve_conc' ? 1 : pdef.perRank * rarity.mult;
  const curVal = hero.passiveTotals?.[pdef.id] || 0;
  const nxtVal = curVal + gain;

  return {
    rarity,
    icon: `assets/icons/skill/${pdef.icon}.png`,
    title: pdef.name,
    levelTag: rank === 0 ? 'NEW PASSIVE · Lv.1' : `Lv.${rank} » Lv.${rank + 1}`,
    desc: pdef.desc,
    diffs: [
      {
        label: pdef.statLabel,
        before: rank === 0 ? '+0%' : pdef.format(curVal),
        after: pdef.format(nxtVal)
      }
    ],
    apply: () => {
      hero.passives[pdef.id] = rank + 1;
      hero.passiveTotals[pdef.id] = nxtVal;
    }
  };
}
