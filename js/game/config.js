/** @typedef {'workers' | 'skills' | 'p2e'} GameTab */

/**
 * @typedef {Object} PhaseConfig
 * @property {number} id
 * @property {string} name
 * @property {string} tagline
 * @property {number} lengthMultiplier
 * @property {number} burnRate
 * @property {number} baseMaxHp
 * @property {number} baseClickDickoin
 * @property {number} basePassiveDickoin
 * @property {boolean} swapUnlocked
 * @property {number} unlockTotalDickoin
 * @property {string} visualKey
 */

/**
 * @typedef {Object} WorkerConfig
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} baseCost
 * @property {number} costMult
 * @property {number} dickoinPerSec
 * @property {number} hpPerSec
 * @property {number} minPhase
 */

/**
 * @typedef {Object} SkillConfig
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} baseCost
 * @property {number} costMult
 * @property {number} maxLevel
 * @property {'click' | 'passive' | 'hp' | 'tax'} effect
 * @property {number} effectPerLevel
 * @property {number} minPhase
 */

/**
 * @typedef {Object} TaxTier
 * @property {number} minGrowdy
 * @property {number} rate
 * @property {string} label
 */

export const TICK_MS = 100;
export const MAX_CPS = 9;
export const SAVE_KEY = 'growdy_game_save';
export const SAVE_VERSION = 2;

/** @type {PhaseConfig[]} */
export const PHASES = [
  {
    id: 1,
    name: 'Uncut',
    tagline: 'Fresh spawn — still in the wrapper.',
    lengthMultiplier: 1,
    burnRate: 0,
    baseMaxHp: 100,
    baseClickDickoin: 0.18,
    basePassiveDickoin: 0,
    swapUnlocked: false,
    unlockTotalDickoin: 0,
    visualKey: 'phase1',
  },
  {
    id: 2,
    name: 'The Trim',
    tagline: 'Circumcised look. Swap unlocks — burn starts here.',
    lengthMultiplier: 1,
    burnRate: 1,
    baseMaxHp: 130,
    baseClickDickoin: 0.38,
    basePassiveDickoin: 0.08,
    swapUnlocked: true,
    unlockTotalDickoin: 2_700,
    visualKey: 'phase2',
  },
  {
    id: 3,
    name: 'Stretching',
    tagline: 'Length increases. Burn intensifies.',
    lengthMultiplier: 1.35,
    burnRate: 1.8,
    baseMaxHp: 150,
    baseClickDickoin: 0.75,
    basePassiveDickoin: 0.22,
    swapUnlocked: true,
    unlockTotalDickoin: 300_000,
    visualKey: 'phase3',
  },
  {
    id: 4,
    name: 'Extended',
    tagline: 'Even longer. Higher burn, bigger rewards.',
    lengthMultiplier: 1.75,
    burnRate: 4.5,
    baseMaxHp: 200,
    baseClickDickoin: 1.5,
    basePassiveDickoin: 0.58,
    swapUnlocked: true,
    unlockTotalDickoin: 2_500_000,
    visualKey: 'phase4',
  },
  {
    id: 5,
    name: 'Full Bush',
    tagline: 'Testicle hair unlocked. Mid-late prestige.',
    lengthMultiplier: 2.2,
    burnRate: 9,
    baseMaxHp: 280,
    baseClickDickoin: 2.8,
    basePassiveDickoin: 1.45,
    swapUnlocked: true,
    unlockTotalDickoin: 19_000_000,
    visualKey: 'phase5',
  },
  {
    id: 6,
    name: 'Legend',
    tagline: 'Absurd length. Season Exit eligible.',
    lengthMultiplier: 3,
    burnRate: 16,
    baseMaxHp: 400,
    baseClickDickoin: 5.5,
    basePassiveDickoin: 3.6,
    swapUnlocked: true,
    unlockTotalDickoin: 110_000_000,
    visualKey: 'phase6',
  },
];

/**
 * Phase unlock gates — worker/skill levels (+ in-game $GROWDY for late phases).
 * @type {Record<number, { etaLabel?: string, workers?: Record<string, number>, skills?: Record<string, number>, minGrowdy?: number }>}
 */
export const PHASE_GATES = {
  2: {
    etaLabel: '~8 min',
    workers: { pump_station: 5 },
    skills: { growth_access: 5 },
  },
  3: {
    etaLabel: '~2h 12m',
    workers: { pump_station: 33, trim_clinic: 12, stretch_unit: 1 },
    skills: { growth_access: 20, guild_raids: 6 },
  },
  4: {
    etaLabel: '~4h 49m',
    workers: { pump_station: 20, trim_clinic: 20, stretch_unit: 25 },
    skills: { growth_access: 20, guild_raids: 15 },
  },
  5: {
    etaLabel: '~12h 42m',
    minGrowdy: 7_200_000,
    workers: { pump_station: 20, trim_clinic: 20, stretch_unit: 25, skin_forge: 28 },
    skills: { growth_access: 20, guild_raids: 15 },
  },
  6: {
    etaLabel: 'Endgame',
    workers: { pump_station: 45, trim_clinic: 25, stretch_unit: 35, skin_forge: 30, raid_squad: 5 },
    skills: { growth_access: 20, guild_raids: 15 },
  },
};

/** @type {WorkerConfig[]} */
export const WORKERS = [
  {
    id: 'pump_station',
    name: 'Pump Station',
    description: 'Core grow crew — pumps out dickoin while you tap.',
    baseCost: 95,
    costMult: 1.18,
    dickoinPerSec: 0.045,
    hpPerSec: 0,
    minPhase: 1,
  },
  {
    id: 'trim_clinic',
    name: 'Trim Clinic',
    description: 'Post-trim care unit — passive dickoin after Phase 2.',
    baseCost: 420,
    costMult: 1.2,
    dickoinPerSec: 0.17,
    hpPerSec: 0.2,
    minPhase: 2,
  },
  {
    id: 'stretch_unit',
    name: 'Stretch Unit',
    description: 'Length ops team — dickoin output through the burn phases.',
    baseCost: 2_200,
    costMult: 1.21,
    dickoinPerSec: 0.68,
    hpPerSec: 0.5,
    minPhase: 3,
  },
  {
    id: 'skin_forge',
    name: 'Skin Forge',
    description: 'Mint phase skins — boosted dickoin rate at scale.',
    baseCost: 14_000,
    costMult: 1.23,
    dickoinPerSec: 3,
    hpPerSec: 1.5,
    minPhase: 4,
  },
  {
    id: 'raid_squad',
    name: 'Raid Squad',
    description: 'Guild raid crew — elite dickoin & IMPOTENT sustain.',
    baseCost: 85_000,
    costMult: 1.25,
    dickoinPerSec: 13,
    hpPerSec: 3,
    minPhase: 5,
  },
];

/** @type {SkillConfig[]} */
export const SKILLS = [
  {
    id: 'growth_access',
    name: 'Growth Access',
    description: 'Hold $GROWDY, break into Phase 4–6 — +25% click dickoin per level.',
    baseCost: 175,
    costMult: 1.36,
    maxLevel: 20,
    effect: 'click',
    effectPerLevel: 0.18,
    minPhase: 1,
  },
  {
    id: 'guild_raids',
    name: 'Guild Raids',
    description: 'Raid prep — +10% max IMPOTENT bar per level for burn survival.',
    baseCost: 310,
    costMult: 1.4,
    maxLevel: 15,
    effect: 'hp',
    effectPerLevel: 0.1,
    minPhase: 2,
  },
];

/** Maps old worker ids from earlier builds → current ids */
export const LEGACY_WORKER_IDS = {
  intern: 'pump_station',
  nurse: 'trim_clinic',
  coach: 'stretch_unit',
  surgeon: 'skin_forge',
  influencer: 'raid_squad',
  hand: 'pump_station',
  lube: 'trim_clinic',
  stretcher: 'stretch_unit',
  trimmer: 'skin_forge',
  bush_groomer: 'raid_squad',
};

/** Maps old skill ids → current ids */
export const LEGACY_SKILL_IDS = {
  grip: 'growth_access',
  passive: 'skin_mint',
  trading: 'dao_governance',
  stamina: 'guild_raids',
};

/** @type {TaxTier[]} */
export const TAX_TIERS = [
  { minGrowdy: 0, rate: 0.8, label: '0 $GROWDY → 80% tax' },
  { minGrowdy: 1, rate: 0.5, label: '1–1K → 50% tax' },
  { minGrowdy: 1_000, rate: 0.25, label: '1K–10K → 25% tax' },
  { minGrowdy: 10_000, rate: 0.1, label: '10K+ → 10% tax' },
];

export const IMPOTENT_HP_RATIO = 0.5;
export const MIN_SWAP_DICKOIN = 10;

/** @typedef {'zonk' | 'common' | 'rare' | 'epic' | 'legendary'} GachaRarity */

/**
 * @typedef {Object} GachaItem
 * @property {string} id
 * @property {string} name
 * @property {GachaRarity} rarity
 * @property {number} weight
 * @property {string} desc
 */

export const GACHA_MIN_PHASE = 2;
export const GACHA_SINGLE_COST = 50;

/** @type {GachaItem[]} */
export const GACHA_POOL = [
  { id: 'zonk_nothing', name: 'Nothing', rarity: 'zonk', weight: 40000, desc: 'Empty pull — zonk' },
  { id: 'zonk_dust', name: 'Dickoin Dust', rarity: 'zonk', weight: 15000, desc: 'A crumb of dickoin' },
  { id: 'dickoin_pouch', name: 'Dickoin Pouch', rarity: 'common', weight: 35000, desc: 'Tiny dickoin bundle' },
  { id: 'hp_drip', name: 'IMPOTENT Relief', rarity: 'common', weight: 8000, desc: 'Restore 5% max IMPOTENT bar' },
  { id: 'click_frenzy', name: 'Click Frenzy', rarity: 'rare', weight: 1500, desc: '1.15× click for 30s' },
  { id: 'idle_rush', name: 'Idle Rush', rarity: 'rare', weight: 200, desc: '1.1× passive for 30s' },
  { id: 'growdy_rebate', name: 'GROWDY Rebate', rarity: 'epic', weight: 40, desc: 'Refund 3 $GROWDY' },
  { id: 'mega_cache', name: 'Mega Cache', rarity: 'epic', weight: 8, desc: 'Small dickoin jackpot' },
  { id: 'golden_grow', name: 'Golden Grow', rarity: 'legendary', weight: 2, desc: '1.3× click & passive for 45s' },
];

export function getGachaItem(id) {
  return GACHA_POOL.find((g) => g.id === id);
}

export function getPhase(id) {
  return PHASES.find((p) => p.id === id) ?? PHASES[0];
}

export function getPhaseImage(phaseId) {
  return `assets/phase${phaseId}.png`;
}

export function getWorker(id) {
  return WORKERS.find((w) => w.id === id);
}

export function getSkill(id) {
  return SKILLS.find((s) => s.id === id);
}

/** @param {number} targetPhaseId */
export function getPhaseGate(targetPhaseId) {
  return PHASE_GATES[targetPhaseId] ?? null;
}

/**
 * @param {{ workers: Record<string, number>, skills: Record<string, number>, growdy: number }} state
 * @param {number} targetPhaseId
 */
export function getPhaseGateStatus(state, targetPhaseId) {
  const gate = getPhaseGate(targetPhaseId);
  if (!gate) {
    return { complete: true, progress: 1, met: 0, total: 0, items: [], etaLabel: null };
  }

  /** @type {{ type: string, id?: string, name: string, have: number, need: number, met: boolean }[]} */
  const items = [];
  let met = 0;
  let total = 0;

  for (const [id, need] of Object.entries(gate.workers ?? {})) {
    const have = state.workers[id] ?? 0;
    items.push({
      type: 'worker',
      id,
      name: getWorker(id)?.name ?? id,
      have,
      need,
      met: have >= need,
    });
    total += 1;
    if (have >= need) met += 1;
  }

  for (const [id, need] of Object.entries(gate.skills ?? {})) {
    const have = state.skills[id] ?? 0;
    items.push({
      type: 'skill',
      id,
      name: getSkill(id)?.name ?? id,
      have,
      need,
      met: have >= need,
    });
    total += 1;
    if (have >= need) met += 1;
  }

  if (gate.minGrowdy != null) {
    const have = state.growdy;
    items.push({
      type: 'growdy',
      name: '$GROWDY in-game',
      have,
      need: gate.minGrowdy,
      met: have >= gate.minGrowdy,
    });
    total += 1;
    if (have >= gate.minGrowdy) met += 1;
  }

  return {
    complete: total > 0 && met === total,
    progress: total ? met / total : 1,
    met,
    total,
    items,
    etaLabel: gate.etaLabel ?? null,
  };
}
