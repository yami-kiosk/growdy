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
export const MAX_CPS = 12;
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
    baseClickDickoin: 0.35,
    basePassiveDickoin: 0,
    swapUnlocked: false,
    unlockTotalDickoin: 0,
    visualKey: 'phase1',
  },
  {
    id: 2,
    name: 'The Trim',
    tagline: 'Circumcised look. Swap unlocks here.',
    lengthMultiplier: 1,
    burnRate: 0,
    baseMaxHp: 120,
    baseClickDickoin: 0.7,
    basePassiveDickoin: 0.14,
    swapUnlocked: true,
    unlockTotalDickoin: 2_700,
    visualKey: 'phase2',
  },
  {
    id: 3,
    name: 'Stretching',
    tagline: 'Length increases. Burn begins.',
    lengthMultiplier: 1.35,
    burnRate: 1.8,
    baseMaxHp: 150,
    baseClickDickoin: 1.4,
    basePassiveDickoin: 0.42,
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
    baseClickDickoin: 2.8,
    basePassiveDickoin: 1.12,
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
    baseClickDickoin: 5.25,
    basePassiveDickoin: 2.8,
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
    baseClickDickoin: 10.5,
    basePassiveDickoin: 7,
    swapUnlocked: true,
    unlockTotalDickoin: 110_000_000,
    visualKey: 'phase6',
  },
];

/** @type {WorkerConfig[]} */
export const WORKERS = [
  {
    id: 'pump_station',
    name: 'Pump Station',
    description: 'Core grow crew — pumps out dickoin while you tap.',
    baseCost: 63,
    costMult: 1.16,
    dickoinPerSec: 0.09,
    hpPerSec: 0,
    minPhase: 1,
  },
  {
    id: 'trim_clinic',
    name: 'Trim Clinic',
    description: 'Post-trim care unit — passive dickoin after Phase 2.',
    baseCost: 300,
    costMult: 1.18,
    dickoinPerSec: 0.36,
    hpPerSec: 0.2,
    minPhase: 2,
  },
  {
    id: 'stretch_unit',
    name: 'Stretch Unit',
    description: 'Length ops team — dickoin output through the burn phases.',
    baseCost: 1_500,
    costMult: 1.19,
    dickoinPerSec: 1.44,
    hpPerSec: 0.5,
    minPhase: 3,
  },
  {
    id: 'skin_forge',
    name: 'Skin Forge',
    description: 'Mint phase skins — boosted dickoin rate at scale.',
    baseCost: 10_000,
    costMult: 1.21,
    dickoinPerSec: 6.3,
    hpPerSec: 1.5,
    minPhase: 4,
  },
  {
    id: 'raid_squad',
    name: 'Raid Squad',
    description: 'Guild raid crew — elite dickoin & IMPOTENT sustain.',
    baseCost: 62_500,
    costMult: 1.23,
    dickoinPerSec: 27,
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
    baseCost: 200,
    costMult: 1.35,
    maxLevel: 20,
    effect: 'click',
    effectPerLevel: 0.25,
    minPhase: 1,
  },
  {
    id: 'guild_raids',
    name: 'Guild Raids',
    description: 'Raid prep — +10% max IMPOTENT bar per level for burn survival.',
    baseCost: 350,
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
