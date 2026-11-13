// Authentic Ragnarok Online Classes, Skills, Passives, Zones, Monsters, Cards & Kafra Meta Upgrades

export const CLASSES = [
  {
    id: 'lord_knight',
    jobId: 4008,
    name: 'Lord Knight',
    role: 'Frontline Cleaver · Sword & Spear',
    desc: 'Armored vanguard of Prontera Chivalry. Sweeps entire packs together with Bowling Bash shockwaves and skewers MVPs with Spiral Pierce.',
    starterSkill: 'bowling_bash',
    signatureSkills: ['bowling_bash', 'magnum_break', 'spiral_pierce'],
    mobility: {
      name: 'Charge Attack',
      icon: 5,
      cd: 5.5,
      type: 'charge',
      desc: 'Rushes toward the cursor, slamming through enemies for 220% ATK and stunning them briefly.'
    },
    stats: { hp: 620, sp: 120, speed: 178, atk: 1.12, haste: 1.0, crit: 0.10, armor: 6 }
  },
  {
    id: 'high_wizard',
    jobId: 4010,
    name: 'High Wizard',
    role: 'Archmage of Geffen · Elemental AoE',
    desc: 'Master of catastrophic elemental magic. Blankets the battlefield in Storm Gust blizzards, Meteor Storms, and Lord of Vermilion lightning.',
    starterSkill: 'fire_bolt',
    signatureSkills: ['fire_bolt', 'storm_gust', 'lord_of_vermilion', 'meteor_storm'],
    mobility: {
      name: 'Energy Blink',
      icon: 26,
      cd: 5.0,
      type: 'blink',
      desc: 'Teleports instantly toward the cursor, detonating a frost-arcane nova at both origin and arrival.'
    },
    stats: { hp: 430, sp: 220, speed: 172, atk: 1.24, haste: 1.08, crit: 0.12, armor: 2 }
  },
  {
    id: 'sniper',
    jobId: 4012,
    name: 'Sniper',
    role: 'Payon Marksman · Bow & Falcon',
    desc: 'Agile ranged specialist accompanied by a loyal Hunting Falcon. Fires piercing Double Strafe volleys while Blitz Beat dives onto packs.',
    starterSkill: 'double_strafe',
    signatureSkills: ['double_strafe', 'arrow_shower', 'blitz_beat'],
    mobility: {
      name: 'Wind Walk Vault',
      icon: 380,
      cd: 4.8,
      type: 'vault',
      desc: 'Vaults swiftly toward the cursor, dropping an explosive Claymore Trap behind and boosting Move Speed for 3s.'
    },
    stats: { hp: 470, sp: 150, speed: 196, atk: 1.10, haste: 1.16, crit: 0.22, armor: 3 }
  },
  {
    id: 'assassin_cross',
    jobId: 4013,
    name: 'Assassin Cross',
    role: 'Morroc Guillotine · Critical & Poison',
    desc: 'Relentless shadow blade wielding twin-hit Katars. Shreds bosses with rapid Sonic Blow flurries, purple crits, and Meteor Assault.',
    starterSkill: 'sonic_blow',
    signatureSkills: ['sonic_blow', 'meteor_assault'],
    mobility: {
      name: 'Shadow Leap',
      icon: 150,
      cd: 4.4,
      type: 'shadow',
      desc: 'Dashes through monsters toward the cursor in a Deadly Poison cloud, granting +35% Crit Chance for 3s.'
    },
    stats: { hp: 490, sp: 140, speed: 204, atk: 1.15, haste: 1.18, crit: 0.28, armor: 3 }
  },
  {
    id: 'high_priest',
    jobId: 4009,
    name: 'High Priest',
    role: 'Prontera Exorcist · Holy & Sustain',
    desc: 'Radiant vessel of Odin. Burns Undead and Demons on giant Magnus Exorcismus rune grids while Sanctuary heals and repels hordes.',
    starterSkill: 'holy_light',
    signatureSkills: ['holy_light', 'magnus_exorcismus', 'sanctuary'],
    mobility: {
      name: 'Angelic Glide',
      icon: 29,
      cd: 5.2,
      type: 'holy_dash',
      desc: 'Glides forward on wings of light, healing 12% Max HP and radiating a Ruwach holy shockwave.'
    },
    stats: { hp: 560, sp: 200, speed: 180, atk: 1.08, haste: 1.06, crit: 0.12, armor: 5 }
  },
  {
    id: 'champion',
    jobId: 4016,
    name: 'Champion',
    role: 'Spirit Monk · Spheres & Guillotine Fist',
    desc: '5 Spirit Spheres orbit your body at all times, firing piercing chi bolts and unleashing screen-shaking Asura Guillotine Fists.',
    starterSkill: 'spirit_sphere',
    signatureSkills: ['spirit_sphere', 'asura_strike', 'magnum_break'],
    mobility: {
      name: 'Body Relocation (Snap)',
      icon: 264,
      cd: 4.2,
      type: 'snap',
      desc: 'Instant Monk Snap to the cursor, leaving a chi shockwave on arrival.'
    },
    stats: { hp: 580, sp: 175, speed: 190, atk: 1.18, haste: 1.05, crit: 0.16, armor: 5 }
  }
];

export const SKILLS = {
  bowling_bash: {
    id: 'bowling_bash',
    name: 'Bowling Bash',
    evolvedName: 'Lord’s Crimson Tempest',
    evolveReq: 'aura_blade',
    icon: 62,
    sfx: 'bowling_bash',
    color: '#fbbf24',
    desc: 'Cleaves dense shockwaves into the nearest pack, knocking monsters into each other for chain impact damage.',
    baseDmg: 38,
    baseCd: 1.45,
    baseCount: 1,
    baseRadius: 88,
    kind: 'cleave'
  },
  magnum_break: {
    id: 'magnum_break',
    name: 'Magnum Break',
    evolvedName: 'Solaris Volcano',
    evolveReq: 'aura_blade',
    icon: 7,
    sfx: 'magnum_break',
    color: '#f97316',
    desc: 'Detonates a 360° fiery shockwave around your hero, igniting the ground and pushing swarmers away.',
    baseDmg: 42,
    baseCd: 2.8,
    baseCount: 1,
    baseRadius: 125,
    kind: 'nova'
  },
  spiral_pierce: {
    id: 'spiral_pierce',
    name: 'Spiral Pierce',
    evolvedName: 'Dragon Breath Lance',
    evolveReq: 'blessing',
    icon: 397,
    sfx: 'spiral_pierce',
    color: '#60a5fa',
    desc: 'Hurls heavy spiral lances toward the highest-HP enemy, piercing every monster in a line.',
    baseDmg: 64,
    baseCd: 2.2,
    baseCount: 1,
    baseRadius: 34,
    kind: 'lance'
  },
  fire_bolt: {
    id: 'fire_bolt',
    name: 'Fire Bolt',
    evolvedName: 'Crimson Hellfire Pillar',
    evolveReq: 'blessing',
    icon: 19,
    sfx: 'arrow_hit',
    color: '#ef4444',
    desc: 'Rains rapid multi-hit fire bolts onto nearby monsters with crisp splash sparks.',
    baseDmg: 26,
    baseCd: 1.15,
    baseCount: 2,
    baseRadius: 56,
    kind: 'bolts'
  },
  storm_gust: {
    id: 'storm_gust',
    name: 'Storm Gust',
    evolvedName: 'Absolute Zero Blizzard',
    evolveReq: 'improve_conc',
    icon: 89,
    sfx: 'storm_gust',
    color: '#38bdf8',
    desc: 'Summons an iconic RO swirling ice vortex that pulses cold damage, chills movement by 45%, and freezes foes.',
    baseDmg: 24,
    baseCd: 4.2,
    baseCount: 1,
    baseRadius: 132,
    kind: 'vortex'
  },
  lord_of_vermilion: {
    id: 'lord_of_vermilion',
    name: 'Lord of Vermilion',
    evolvedName: 'Thor’s Judgment Tempest',
    evolveReq: 'kyrie_eleison',
    icon: 85,
    sfx: 'thunderstorm',
    color: '#fde047',
    desc: 'Calls down crackling 4-burst thunderbolts across surrounding enemy clusters.',
    baseDmg: 46,
    baseCd: 3.6,
    baseCount: 3,
    baseRadius: 96,
    kind: 'lightning'
  },
  meteor_storm: {
    id: 'meteor_storm',
    name: 'Meteor Storm',
    evolvedName: 'Ragnarok Starfall',
    evolveReq: 'aura_blade',
    icon: 83,
    sfx: 'meteor_storm',
    color: '#fb7185',
    desc: 'Drops giant blazing meteors from the sky that explode on impact and leave burning embers.',
    baseDmg: 68,
    baseCd: 3.9,
    baseCount: 2,
    baseRadius: 105,
    kind: 'meteor'
  },
  double_strafe: {
    id: 'double_strafe',
    name: 'Double Strafe',
    evolvedName: 'Sharp Shooting Barrage',
    evolveReq: 'improve_conc',
    icon: 46,
    sfx: 'arrow_hit',
    color: '#a3e635',
    desc: 'Fires twin high-velocity arrows with bonus Critical chance that pierce cleanly at high levels.',
    baseDmg: 25,
    baseCd: 0.92,
    baseCount: 2,
    baseRadius: 22,
    kind: 'arrows'
  },
  arrow_shower: {
    id: 'arrow_shower',
    name: 'Arrow Shower',
    evolvedName: 'Arrow Storm',
    evolveReq: 'gloria',
    icon: 47,
    sfx: 'arrow_hit',
    color: '#84cc16',
    desc: 'Arcs a wide hail of arrows over dense monster waves, striking every foe in the target circle.',
    baseDmg: 36,
    baseCd: 2.3,
    baseCount: 1,
    baseRadius: 112,
    kind: 'shower'
  },
  blitz_beat: {
    id: 'blitz_beat',
    name: 'Blitz Beat (Falcon)',
    evolvedName: 'Falcon Assault',
    evolveReq: 'gloria',
    icon: 129,
    sfx: 'blitz_beat',
    color: '#fef08a',
    desc: 'Your Hunting Falcon swoops down from above onto enemy clusters with 5 rapid armor-ignoring strikes.',
    baseDmg: 44,
    baseCd: 2.7,
    baseCount: 1,
    baseRadius: 86,
    kind: 'falcon'
  },
  sonic_blow: {
    id: 'sonic_blow',
    name: 'Sonic Blow',
    evolvedName: 'Enchant Deadly Cross Impact',
    evolveReq: 'gloria',
    icon: 136,
    sfx: 'sonic_blow',
    color: '#c084fc',
    desc: 'Dashes an 8-hit shadow katar flurry across nearby foes with elevated Critical multiplier.',
    baseDmg: 34,
    baseCd: 1.35,
    baseCount: 1,
    baseRadius: 84,
    kind: 'flurry'
  },
  meteor_assault: {
    id: 'meteor_assault',
    name: 'Meteor Assault',
    evolvedName: 'Rolling Guillotine',
    evolveReq: 'inc_agi',
    icon: 406,
    sfx: 'bash',
    color: '#e11d48',
    desc: 'Unleashes whirling katar blades around you, inflicting stacking Bleed damage over 3s.',
    baseDmg: 35,
    baseCd: 2.0,
    baseCount: 1,
    baseRadius: 110,
    kind: 'spin'
  },
  holy_light: {
    id: 'holy_light',
    name: 'Holy Light',
    evolvedName: 'Adoramus',
    evolveReq: 'blessing',
    icon: 156,
    sfx: 'blessing',
    color: '#fef9c3',
    desc: 'Smites monsters with pillars of pure light (+35% bonus damage vs Undead & Shadow monsters).',
    baseDmg: 34,
    baseCd: 1.2,
    baseCount: 2,
    baseRadius: 60,
    kind: 'smite'
  },
  magnus_exorcismus: {
    id: 'magnus_exorcismus',
    name: 'Magnus Exorcismus',
    evolvedName: 'Grand Cross of Valhalla',
    evolveReq: 'angelus',
    icon: 79,
    sfx: 'magnus',
    color: '#fde68a',
    desc: 'Inscribes a sacred Grand Cross rune grid on the ground that sears every monster stepping inside.',
    baseDmg: 28,
    baseCd: 4.5,
    baseCount: 1,
    baseRadius: 138,
    kind: 'rune_grid'
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'Sanctuary',
    evolvedName: 'Highness Sanctuary',
    evolveReq: 'angelus',
    icon: 70,
    sfx: 'sanctuary',
    color: '#34d399',
    desc: 'Consecrates an emerald ring that heals your HP while pulsing holy knockback damage to enemies.',
    baseDmg: 24,
    baseCd: 4.8,
    baseCount: 1,
    baseRadius: 118,
    kind: 'sanctuary'
  },
  spirit_sphere: {
    id: 'spirit_sphere',
    name: 'Throw Spirit Sphere',
    evolvedName: 'Zen Gates of Hell',
    evolveReq: 'call_spirits',
    icon: 267,
    sfx: 'hit2',
    color: '#67e8f9',
    desc: 'Orbiting Spirit Spheres damage enemies on contact AND fire piercing chi orbs outward.',
    baseDmg: 28,
    baseCd: 1.18,
    baseCount: 2,
    baseRadius: 78,
    kind: 'spheres'
  },
  asura_strike: {
    id: 'asura_strike',
    name: 'Guillotine Fist (Asura)',
    evolvedName: 'Supreme Asura Strike',
    evolveReq: 'blessing',
    icon: 270,
    sfx: 'magnum_break',
    color: '#facc15',
    desc: 'Channels overwhelming Spirit fury onto the strongest nearby foe, erupting in a colossal shockwave.',
    baseDmg: 125,
    baseCd: 5.0,
    baseCount: 1,
    baseRadius: 136,
    kind: 'asura'
  }
};

export const PASSIVES = {
  blessing: {
    id: 'blessing',
    name: 'Blessing',
    icon: 34,
    desc: 'Increases all Skill & Weapon Damage (STR / DEX / INT).',
    statLabel: 'Damage Bonus',
    perRank: 0.14,
    format: (v) => `+${Math.round(v * 100)}%`
  },
  inc_agi: {
    id: 'inc_agi',
    name: 'Increase AGI',
    icon: 29,
    desc: 'Boosts Movement Speed and Flee dodge chance.',
    statLabel: 'Move Speed',
    perRank: 0.10,
    format: (v) => `+${Math.round(v * 100)}%`
  },
  angelus: {
    id: 'angelus',
    name: 'Angelus',
    icon: 33,
    desc: 'Raises Maximum HP and grants flat VIT Armor + HP Regen.',
    statLabel: 'Max HP & Regen',
    perRank: 0.16,
    format: (v) => `+${Math.round(v * 100)}%`
  },
  improve_conc: {
    id: 'improve_conc',
    name: 'Improve Concentration',
    icon: 45,
    desc: 'Adds extra Projectiles / Targets (+1 at Lv.1, Lv.3, Lv.5).',
    statLabel: 'Bonus Targets',
    perRank: 1,
    format: (r) => `+${Math.ceil(r / 2)}`
  },
  gloria: {
    id: 'gloria',
    name: 'Gloria',
    icon: 75,
    desc: 'Boosts Critical Hit Rate (+7% per rank) and Critical Damage.',
    statLabel: 'Crit Chance',
    perRank: 0.07,
    format: (v) => `+${Math.round(v * 100)}%`
  },
  kyrie_eleison: {
    id: 'kyrie_eleison',
    name: 'Kyrie Eleison',
    icon: 73,
    desc: 'Reduces all Skill Cooldowns and periodically refreshes a barrier.',
    statLabel: 'Cooldown Haste',
    perRank: 0.09,
    format: (v) => `-${Math.round(v * 100)}% CD`
  },
  aura_blade: {
    id: 'aura_blade',
    name: 'Aura Blade',
    icon: 355,
    desc: 'Expands AoE & Slash Radius of all abilities.',
    statLabel: 'Area Size',
    perRank: 0.14,
    format: (v) => `+${Math.round(v * 100)}%`
  },
  call_spirits: {
    id: 'call_spirits',
    name: 'Magnificat & Spirits',
    icon: 261,
    desc: 'Expands Loot Magnet pickup range and boosts EXP gained.',
    statLabel: 'EXP & Magnet',
    perRank: 0.22,
    format: (v) => `+${Math.round(v * 100)}%`
  }
};

export const MOB_DB = {
  // South Prontera Field
  1002: { name: 'Poring', hp: 38, speed: 68, dmg: 8, scale: 1.0, xp: 8 },
  1063: { name: 'Lunatic', hp: 46, speed: 86, dmg: 9, scale: 1.0, xp: 9 },
  1007: { name: 'Fabre', hp: 52, speed: 74, dmg: 10, scale: 1.0, xp: 10 },
  1052: { name: 'Rocker', hp: 78, speed: 82, dmg: 13, scale: 1.05, xp: 13 },
  1031: { name: 'Poporing', hp: 105, speed: 78, dmg: 15, scale: 1.05, xp: 16 },
  1090: { name: 'Mastering', hp: 1450, speed: 92, dmg: 26, scale: 1.35, xp: 160, miniBoss: true, cardId: 4001 },
  1096: { name: 'Angeling', hp: 2300, speed: 104, dmg: 32, scale: 1.35, xp: 240, miniBoss: true, cardId: 4047 },
  1086: { name: 'Golden Thief Bug', hp: 4800, speed: 108, dmg: 38, scale: 1.45, xp: 500, mvp: true, cardId: 4128 },

  // Payon Cave (Undead)
  1015: { name: 'Zombie', hp: 68, speed: 66, dmg: 12, scale: 1.0, xp: 11, undead: true },
  1076: { name: 'Skeleton', hp: 82, speed: 86, dmg: 14, scale: 1.0, xp: 13, undead: true },
  1026: { name: 'Munak', hp: 112, speed: 88, dmg: 17, scale: 1.0, xp: 16, undead: true },
  1188: { name: 'Bongun', hp: 140, speed: 92, dmg: 19, scale: 1.05, xp: 19, undead: true },
  1170: { name: 'Sohee', hp: 165, speed: 102, dmg: 22, scale: 1.05, xp: 22, undead: true },
  1115: { name: 'Eddga', hp: 3100, speed: 106, dmg: 36, scale: 1.38, xp: 320, mvp: true, cardId: 4058 },
  1150: { name: 'Moonlight Flower', hp: 6200, speed: 122, dmg: 44, scale: 1.4, xp: 620, mvp: true, cardId: 4131 },

  // Morroc Pyramids
  1005: { name: 'Familiar', hp: 64, speed: 112, dmg: 13, scale: 1.0, xp: 12, undead: true },
  1041: { name: 'Mummy', hp: 115, speed: 78, dmg: 18, scale: 1.05, xp: 16, undead: true },
  1032: { name: 'Verit', hp: 132, speed: 96, dmg: 19, scale: 1.0, xp: 18, undead: true },
  1029: { name: 'Isis', hp: 175, speed: 100, dmg: 23, scale: 1.1, xp: 23, undead: true },
  1149: { name: 'Minorous', hp: 230, speed: 94, dmg: 28, scale: 1.18, xp: 28 },
  1159: { name: 'Phreeoni', hp: 4100, speed: 105, dmg: 42, scale: 1.4, xp: 400, mvp: true, cardId: 4121 },
  1038: { name: 'Osiris', hp: 7800, speed: 116, dmg: 50, scale: 1.42, xp: 750, mvp: true, undead: true, cardId: 4092 },

  // Geffen Nightmare Dungeon
  1179: { name: 'Whisper', hp: 80, speed: 104, dmg: 16, scale: 1.0, xp: 14, undead: true },
  1036: { name: 'Ghoul', hp: 145, speed: 80, dmg: 22, scale: 1.05, xp: 19, undead: true },
  1143: { name: 'Marionette', hp: 165, speed: 98, dmg: 24, scale: 1.05, xp: 22, undead: true },
  1109: { name: 'Deviruchi', hp: 195, speed: 114, dmg: 26, scale: 1.0, xp: 25, undead: true },
  1061: { name: 'Nightmare', hp: 255, speed: 124, dmg: 30, scale: 1.15, xp: 32, undead: true },
  1389: { name: 'Dracula', hp: 5200, speed: 118, dmg: 46, scale: 1.4, xp: 480, mvp: true, undead: true, cardId: 4134 },
  1046: { name: 'Doppelganger', hp: 9200, speed: 130, dmg: 56, scale: 1.35, xp: 900, mvp: true, undead: true, cardId: 4142 },

  // Orc Village & Dungeon
  1023: { name: 'Orc Warrior', hp: 125, speed: 94, dmg: 20, scale: 1.05, xp: 17 },
  1273: { name: 'Orc Lady', hp: 145, speed: 104, dmg: 22, scale: 1.05, xp: 19 },
  1189: { name: 'Orc Archer', hp: 160, speed: 92, dmg: 25, scale: 1.05, xp: 22 },
  1152: { name: 'Orc Skeleton', hp: 195, speed: 98, dmg: 27, scale: 1.08, xp: 26, undead: true },
  1213: { name: 'High Orc', hp: 280, speed: 106, dmg: 34, scale: 1.18, xp: 35 },
  1087: { name: 'Orc Hero', hp: 5800, speed: 115, dmg: 50, scale: 1.42, xp: 550, mvp: true, cardId: 4035 },
  1190: { name: 'Orc Lord', hp: 10500, speed: 122, dmg: 60, scale: 1.48, xp: 1000, mvp: true, cardId: 4058 },

  // Glast Heim Chivalry
  1163: { name: 'Raydric', hp: 180, speed: 102, dmg: 26, scale: 1.08, xp: 24, undead: true },
  1276: { name: 'Raydric Archer', hp: 165, speed: 98, dmg: 28, scale: 1.05, xp: 25, undead: true },
  1132: { name: 'Khalitzburg', hp: 235, speed: 100, dmg: 31, scale: 1.12, xp: 30, undead: true },
  1208: { name: 'Wanderer', hp: 275, speed: 128, dmg: 35, scale: 1.1, xp: 36, undead: true },
  1219: { name: 'Abysmal Knight', hp: 380, speed: 108, dmg: 42, scale: 1.24, xp: 46, undead: true },
  1268: { name: 'Bloody Knight', hp: 4600, speed: 114, dmg: 48, scale: 1.32, xp: 450, miniBoss: true, undead: true, cardId: 4140 },
  1039: { name: 'Baphomet', hp: 11500, speed: 126, dmg: 64, scale: 1.5, xp: 1200, mvp: true, undead: true, cardId: 4147 },
  1272: { name: 'Dark Lord', hp: 14500, speed: 122, dmg: 70, scale: 1.5, xp: 1500, mvp: true, undead: true, cardId: 4140 }
};

export const ZONES = [
  {
    id: 'prt_fild08',
    name: 'South Prontera Field',
    tier: 'Tier I · Lv.1+',
    mult: 1.0,
    tint: 'rgba(180, 230, 140, 0.05)',
    desc: 'Sunlit emerald meadows south of Prontera Gate. Ideal proving ground teeming with Porings, Rockers, and the Golden Thief Bug.',
    mobs: [1002, 1063, 1007, 1052, 1031],
    bosses: [
      { time: 75, mobId: 1090 },
      { time: 165, mobId: 1096 },
      { time: 270, mobId: 1086 }
    ]
  },
  {
    id: 'pay_dun00',
    name: 'Payon Haunted Cave',
    tier: 'Tier II · Undead',
    mult: 1.2,
    tint: 'rgba(90, 125, 195, 0.12)',
    desc: 'Lantern-lit limestone caverns beneath Archer Village. Swarms of Munaks, Bonguns, Sohees, and the Nine-Tailed MVP Moonlight Flower.',
    mobs: [1015, 1076, 1026, 1188, 1170],
    bosses: [
      { time: 80, mobId: 1115 },
      { time: 210, mobId: 1150 }
    ]
  },
  {
    id: 'moc_pryd01',
    name: 'Morroc Pyramids',
    tier: 'Tier III · Tomb',
    mult: 1.38,
    tint: 'rgba(218, 165, 85, 0.10)',
    desc: 'Ancient sandstone labyrinth in Sograt Desert. Fast Familiars, towering Minorouses, Phreeoni, and the Undead King Osiris.',
    mobs: [1005, 1041, 1032, 1029, 1149],
    bosses: [
      { time: 85, mobId: 1159 },
      { time: 220, mobId: 1038 }
    ]
  },
  {
    id: 'gef_dun01',
    name: 'Geffen Nightmare Depths',
    tier: 'Tier IV · Demon',
    mult: 1.58,
    tint: 'rgba(95, 70, 145, 0.14)',
    desc: 'Subterranean ruins beneath Geffen Tower. Relentless Deviruchis, Nightmares, Dracula, and the blade-blurred Doppelganger.',
    mobs: [1179, 1036, 1143, 1109, 1061],
    bosses: [
      { time: 85, mobId: 1389 },
      { time: 225, mobId: 1046 }
    ]
  },
  {
    id: 'gef_fild10',
    name: 'Orc Village Warfront',
    tier: 'Tier V · Brute',
    mult: 1.8,
    tint: 'rgba(165, 120, 75, 0.10)',
    desc: 'Fierce tribal stronghold of High Orcs and Orc Archers commanded by the twin warlords Orc Hero and Orc Lord.',
    mobs: [1023, 1273, 1189, 1152, 1213],
    bosses: [
      { time: 85, mobId: 1087 },
      { time: 225, mobId: 1190 }
    ]
  },
  {
    id: 'gl_knt01',
    name: 'Glast Heim Chivalry',
    tier: 'Tier VI · Abyss',
    mult: 2.15,
    tint: 'rgba(55, 75, 110, 0.18)',
    desc: 'Cursed halls of King Schmitz’s fallen order. Raydrics, Wanderers, Abysmal Knights, Bloody Knight, Baphomet, and Dark Lord.',
    mobs: [1163, 1276, 1132, 1208, 1219],
    bosses: [
      { time: 75, mobId: 1268 },
      { time: 180, mobId: 1039 },
      { time: 300, mobId: 1272 }
    ]
  }
];

export const CARDS = [
  { id: 4001, name: 'Poring Card', cost: 120, bonusText: '+12% Dodge Chance & +20% Zeny Dropped', apply: (s) => { s.dodge += 0.12; s.zenyMult += 0.20; } },
  { id: 4035, name: 'Hydra Card', cost: 240, bonusText: '+18% All Skill & Weapon Damage', apply: (s) => { s.dmgMult += 0.18; } },
  { id: 4092, name: 'Skeleton Worker Card', cost: 260, bonusText: '+15% Damage & +15% Area Size', apply: (s) => { s.dmgMult += 0.15; s.areaMult += 0.15; } },
  { id: 4058, name: 'Thara Frog Card', cost: 220, bonusText: '+8 Flat Armor & +20% Max HP', apply: (s) => { s.armor += 8; s.hpMult += 0.20; } },
  { id: 4047, name: 'Ghostring Card', cost: 340, bonusText: '+4.5 HP/sec Regeneration & Brief Invulnerability Window', apply: (s) => { s.regen += 4.5; s.iframeBonus += 0.25; } },
  { id: 4140, name: 'Abysmal Knight Card', cost: 420, bonusText: '+35% Bonus Damage to Mini-Bosses & MVPs', apply: (s) => { s.bossDmgMult += 0.35; } },
  { id: 4128, name: 'Golden Thief Bug Card', cost: 380, bonusText: '+60% EXP/Loot Magnet Radius & +15% EXP Gain', apply: (s) => { s.magnetMult += 0.60; s.xpMult += 0.15; } },
  { id: 4131, name: 'Moonlight Flower Card', cost: 400, bonusText: '+24% Movement Speed & -20% [F] Mobility Cooldown', apply: (s) => { s.speedMult += 0.24; s.mobilityHaste += 0.20; } },
  { id: 4142, name: 'Doppelganger Card', cost: 460, bonusText: '+22% Attack & Skill Cast Haste', apply: (s) => { s.hasteMult += 0.22; } },
  { id: 4147, name: 'Baphomet Card', cost: 520, bonusText: '+1 Bonus Target/Projectile on All Multi-Skills & +18% Area', apply: (s) => { s.bonusCount += 1; s.areaMult += 0.18; } },
  { id: 4134, name: 'Dracula Card', cost: 440, bonusText: 'Heals 2 HP every 12 Enemy Hits (Crimson Leech)', apply: (s) => { s.lifeOnHit += 2; } },
  { id: 4121, name: 'Phreeoni Card', cost: 360, bonusText: '+16% Critical Chance & +35% Critical Damage', apply: (s) => { s.critChance += 0.16; s.critMult += 0.35; } }
];

export const KAFRA_UPGRADES = [
  { id: 'might', name: 'Oridecon Tempering', icon: 984, maxRank: 5, baseCost: 50, desc: '+8% Base Damage per rank', apply: (s, r) => { s.dmgMult += r * 0.08; } },
  { id: 'vitality', name: 'Elunium Plating', icon: 985, maxRank: 5, baseCost: 45, desc: '+12% Max HP & +2 Armor per rank', apply: (s, r) => { s.hpMult += r * 0.12; s.armor += r * 2; } },
  { id: 'haste', name: 'Awakening Potion', icon: 505, maxRank: 5, baseCost: 60, desc: '+6% Skill Cooldown Haste per rank', apply: (s, r) => { s.hasteMult += r * 0.06; } },
  { id: 'agility', name: 'Peco Riding Seal', icon: 608, maxRank: 5, baseCost: 45, desc: '+6% Movement Speed per rank', apply: (s, r) => { s.speedMult += r * 0.06; } },
  { id: 'crit', name: 'Critical Jur Polish', icon: 617, maxRank: 5, baseCost: 55, desc: '+4% Crit Rate & +10% Crit Damage per rank', apply: (s, r) => { s.critChance += r * 0.04; s.critMult += r * 0.10; } },
  { id: 'greed', name: 'Merchant Overcharge', icon: 7539, maxRank: 5, baseCost: 40, desc: '+15% Zeny & EXP gained per rank', apply: (s, r) => { s.zenyMult += r * 0.15; s.xpMult += r * 0.12; } },
  { id: 'sustain', name: 'Yggdrasil Dew', icon: 607, maxRank: 5, baseCost: 55, desc: '+1.5 HP/sec Passive Regen per rank', apply: (s, r) => { s.regen += r * 1.5; } },
  { id: 'arsenal', name: 'Old Blue Mastery', icon: 603, maxRank: 2, baseCost: 180, desc: '+1 Extra Reroll & +8% Area Size per rank', apply: (s, r) => { s.areaMult += r * 0.08; } }
];

export const RARITIES = [
  { id: 'common', label: 'Common', mult: 1.0, weight: 46 },
  { id: 'uncommon', label: 'Uncommon', mult: 1.24, weight: 30 },
  { id: 'rare', label: 'Rare', mult: 1.52, weight: 16 },
  { id: 'epic', label: 'Epic', mult: 1.88, weight: 7 },
  { id: 'mvp', label: 'MVP Mythic', mult: 2.35, weight: 1.5 }
];
