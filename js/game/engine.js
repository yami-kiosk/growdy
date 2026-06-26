import {
  PHASES,
  WORKERS,
  SKILLS,
  TAX_TIERS,
  TICK_MS,
  SAVE_KEY,
  SAVE_VERSION,
  IMPOTENT_HP_RATIO,
  MIN_SWAP_DICKOIN,
  MAX_CPS,
  LEGACY_WORKER_IDS,
  LEGACY_SKILL_IDS,
  getPhase,
  getWorker,
  getSkill,
  GACHA_POOL,
  GACHA_MIN_PHASE,
  GACHA_SINGLE_COST,
  getGachaItem,
} from './config.js';

/**
 * @typedef {Object} GameState
 * @property {number} version
 * @property {number} phase
 * @property {number} hp
 * @property {number} dickoin
 * @property {number} growdy
 * @property {number} totalDickoinEarned
 * @property {number} totalClicks
 * @property {Record<string, number>} workers
 * @property {Record<string, number>} skills
 * @property {string|null} lastEvent
 * @property {number[]} pendingPhaseUps
 * @property {{ clickMult: number, passiveMult: number, until: number }} gachaBuffs
 * @property {number} gachaPulls
 * @property {number} lastSavedAt
 */

/** @returns {GameState} */
export function createInitialState() {
  const phase = getPhase(1);
  return {
    version: SAVE_VERSION,
    phase: 1,
    hp: phase.baseMaxHp,
    dickoin: 0,
    growdy: 0,
    totalDickoinEarned: 0,
    totalClicks: 0,
    workers: {},
    skills: {},
    lastEvent: null,
    pendingPhaseUps: [],
    gachaBuffs: { clickMult: 1, passiveMult: 1, until: 0 },
    gachaPulls: 0,
    lastSavedAt: Date.now(),
  };
}

/** @returns {GameState} */
export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION) return createInitialState();
    return normalizeState(parsed);
  } catch {
    return createInitialState();
  }
}

/** @param {GameState} state */
export function saveState(state) {
  state.lastSavedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

/** @param {Record<string, number>} workers */
function migrateWorkers(workers) {
  /** @type {Record<string, number>} */
  const migrated = {};
  for (const [id, count] of Object.entries(workers)) {
    const key = LEGACY_WORKER_IDS[id] ?? id;
    migrated[key] = (migrated[key] ?? 0) + count;
  }
  return migrated;
}

/** @param {Record<string, number>} skills */
function migrateSkills(skills) {
  /** @type {Record<string, number>} */
  const migrated = {};
  for (const [id, level] of Object.entries(skills)) {
    const key = LEGACY_SKILL_IDS[id] ?? id;
    migrated[key] = Math.max(migrated[key] ?? 0, level);
  }
  return migrated;
}

/** @param {Partial<GameState>} raw */
export function normalizeState(raw) {
  const base = createInitialState();
  const state = {
    ...base,
    ...raw,
    workers: migrateWorkers({ ...base.workers, ...(raw.workers ?? {}) }),
    skills: migrateSkills({ ...base.skills, ...(raw.skills ?? {}) }),
    pendingPhaseUps: Array.isArray(raw.pendingPhaseUps) ? [...raw.pendingPhaseUps] : [],
    gachaBuffs: {
      clickMult: 1,
      passiveMult: 1,
      until: 0,
      ...(raw.gachaBuffs ?? {}),
    },
    gachaPulls: raw.gachaPulls ?? 0,
  };
  state.phase = Math.min(Math.max(1, state.phase), PHASES.length);
  const maxHp = computeMaxHp(state);
  state.hp = Math.min(Math.max(0, state.hp), maxHp);
  state.dickoin = Math.max(0, state.dickoin);
  state.growdy = Math.max(0, state.growdy);
  return state;
}

/** @param {GameState} state */
function refreshGachaBuffs(state) {
  if (!state.gachaBuffs) {
    state.gachaBuffs = { clickMult: 1, passiveMult: 1, until: 0 };
    return;
  }
  if (state.gachaBuffs.until > 0 && Date.now() > state.gachaBuffs.until) {
    state.gachaBuffs.clickMult = 1;
    state.gachaBuffs.passiveMult = 1;
    state.gachaBuffs.until = 0;
  }
}

/** @param {GameState} state */
function getGachaMultipliers(state) {
  refreshGachaBuffs(state);
  return {
    click: state.gachaBuffs?.clickMult ?? 1,
    passive: state.gachaBuffs?.passiveMult ?? 1,
    active: (state.gachaBuffs?.until ?? 0) > Date.now(),
    expiresAt: state.gachaBuffs?.until ?? 0,
  };
}

/** @param {GameState} state @param {'click'|'passive'|'both'} type @param {number} mult @param {number} durationSec */
function applyGachaBuff(state, type, mult, durationSec) {
  if (!state.gachaBuffs) state.gachaBuffs = { clickMult: 1, passiveMult: 1, until: 0 };
  const now = Date.now();
  if (type === 'click' || type === 'both') {
    state.gachaBuffs.clickMult = mult;
  }
  if (type === 'passive' || type === 'both') {
    state.gachaBuffs.passiveMult = mult;
  }
  state.gachaBuffs.until = now + durationSec * 1000;
}

/** @param {GameState} state */
function computePassiveNoBuff(state) {
  const phase = getPhaseConfig(state);
  const phasePassive = state.phase >= 2 ? phase.basePassiveDickoin : 0;
  let workerPassive = 0;
  for (const w of WORKERS) {
    workerPassive += (state.workers[w.id] ?? 0) * w.dickoinPerSec;
  }
  return phasePassive + workerPassive;
}

function pickGachaItem() {
  const total = GACHA_POOL.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of GACHA_POOL) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return GACHA_POOL[0];
}

/** @param {GameState} state @param {import('./config.js').GachaItem} item */
function applyGachaReward(state, item) {
  const phase = getPhaseConfig(state);
  const basePassive = computePassiveNoBuff(state);
  switch (item.id) {
    case 'zonk_nothing':
      return 'Zonk — nothing';
    case 'zonk_dust': {
      const amount = Math.floor(Math.random() * 2) + 1;
      state.dickoin += amount;
      state.totalDickoinEarned += amount;
      return `+${amount} dickoin dust`;
    }
    case 'dickoin_pouch': {
      const amount = Math.floor(phase.baseClickDickoin * 1.5 + basePassive * 0.5 + 2);
      state.dickoin += amount;
      state.totalDickoinEarned += amount;
      return `+${amount} dickoin`;
    }
    case 'hp_drip': {
      const maxHp = computeMaxHp(state);
      const heal = Math.max(1, Math.floor(maxHp * 0.05));
      state.hp = Math.min(state.hp + heal, maxHp);
      return `+${heal} IMPOTENT`;
    }
    case 'click_frenzy':
      applyGachaBuff(state, 'click', 1.15, 30);
      return '1.15× click · 30s';
    case 'idle_rush':
      applyGachaBuff(state, 'passive', 1.1, 30);
      return '1.1× passive · 30s';
    case 'growdy_rebate':
      state.growdy += 3;
      return '+3 $GROWDY back';
    case 'mega_cache': {
      const amount = Math.floor(phase.basePassiveDickoin * 12 + phase.baseClickDickoin * 4 + state.phase * 5);
      state.dickoin += amount;
      state.totalDickoinEarned += amount;
      return `+${amount} dickoin jackpot`;
    }
    case 'golden_grow':
      applyGachaBuff(state, 'both', 1.3, 45);
      return '1.3× all · 45s';
    default:
      return item.name;
  }
}

/** @returns {number} */
export function getGachaCost() {
  return GACHA_SINGLE_COST;
}

/** @param {GameState} state */
export function canRollGacha(state) {
  if (state.phase < GACHA_MIN_PHASE) return false;
  return state.growdy >= GACHA_SINGLE_COST;
}

/**
 * @param {GameState} state
 * @returns {{ ok: boolean, results: Array<{ id: string, name: string, rarity: string, detail: string }> }}
 */
export function rollGacha(state) {
  if (state.phase < GACHA_MIN_PHASE || state.growdy < GACHA_SINGLE_COST) {
    return { ok: false, results: [] };
  }

  state.growdy -= GACHA_SINGLE_COST;
  const item = pickGachaItem();
  const detail = applyGachaReward(state, item);
  const results = [{ id: item.id, name: item.name, rarity: item.rarity, detail }];

  state.gachaPulls = (state.gachaPulls ?? 0) + 1;
  state.lastEvent = 'gacha:1';
  return { ok: true, results };
}

/** @param {GameState} state */
export function getPhaseConfig(state) {
  return getPhase(state.phase);
}

/** @param {GameState} state */
function skillLevel(state, id) {
  return state.skills[id] ?? 0;
}

/** @param {GameState} state */
export function computeMaxHp(state) {
  const phase = getPhaseConfig(state);
  const staminaLv = skillLevel(state, 'guild_raids');
  const bonus = 1 + staminaLv * 0.1;
  return Math.floor(phase.baseMaxHp * bonus);
}

/** @param {GameState} state */
export function computeClickPower(state) {
  refreshGachaBuffs(state);
  const phase = getPhaseConfig(state);
  const gripLv = skillLevel(state, 'growth_access');
  const buff = state.gachaBuffs?.clickMult ?? 1;
  return phase.baseClickDickoin * (1 + gripLv * 0.25) * buff;
}

/** @param {GameState} state */
export function computePassiveDickoin(state) {
  refreshGachaBuffs(state);
  const phase = getPhaseConfig(state);
  const phasePassive = state.phase >= 2 ? phase.basePassiveDickoin : 0;
  let workerPassive = 0;
  for (const w of WORKERS) {
    workerPassive += (state.workers[w.id] ?? 0) * w.dickoinPerSec;
  }
  const buff = state.gachaBuffs?.passiveMult ?? 1;
  return (phasePassive + workerPassive) * buff;
}

/** @param {GameState} state */
export function computeHpSustain(state) {
  let sustain = 0;
  for (const w of WORKERS) {
    sustain += (state.workers[w.id] ?? 0) * w.hpPerSec;
  }
  return sustain;
}

/** @param {GameState} state */
export function computeBurnRate(state) {
  return getPhaseConfig(state).burnRate;
}

/** @param {GameState} state */
export function computeNetHpPerSec(state) {
  return computeHpSustain(state) - computeBurnRate(state);
}

/** @param {GameState} state */
export function computeRunwaySec(state) {
  const net = computeNetHpPerSec(state);
  const burn = computeBurnRate(state);
  if (burn <= 0) return Infinity;
  if (net >= 0) return Infinity;
  return state.hp / Math.abs(net);
}

/** @param {GameState} state */
export function computeLength(state) {
  const phase = getPhaseConfig(state);
  const clickBonus = Math.log10(state.totalClicks + 10) * 0.05;
  return phase.lengthMultiplier * (1 + clickBonus);
}

/** @param {GameState} state */
export function getTaxRate(state) {
  let rate = 0.8;
  for (const tier of TAX_TIERS) {
    if (state.growdy >= tier.minGrowdy) rate = tier.rate;
  }
  return rate;
}

/** @param {GameState} state */
export function getCurrentTaxTier(state) {
  let tier = TAX_TIERS[0];
  for (const t of TAX_TIERS) {
    if (state.growdy >= t.minGrowdy) tier = t;
  }
  return tier;
}

/** @param {GameState} state @returns {boolean} */
function shouldGoImpotent(state) {
  if (computeBurnRate(state) <= 0) return false;
  return state.hp <= 1;
}

/** @param {GameState} state @returns {boolean} */
function checkPhaseUnlock(state) {
  if (!state.pendingPhaseUps) state.pendingPhaseUps = [];
  let leveled = false;

  while (state.phase < PHASES.length) {
    const next = getPhase(state.phase + 1);
    if (state.totalDickoinEarned >= next.unlockTotalDickoin) {
      state.phase += 1;
      state.pendingPhaseUps.push(state.phase);
      leveled = true;
      const maxHp = computeMaxHp(state);
      state.hp = Math.min(state.hp + maxHp * 0.25, maxHp);
    } else {
      break;
    }
  }

  return leveled;
}

/** @param {GameState} state */
function applyImpotent(state) {
  if (state.phase <= 2) {
    state.hp = computeMaxHp(state);
    state.lastEvent = 'hp_refill';
    return;
  }

  const droppedFrom = state.phase;
  state.phase = Math.max(1, state.phase - 1);

  // Reset progress to this phase's threshold — must re-earn dickoin to climb again
  state.totalDickoinEarned = getPhase(state.phase).unlockTotalDickoin;

  state.pendingPhaseUps = (state.pendingPhaseUps ?? []).filter((p) => p <= state.phase);

  const maxHp = computeMaxHp(state);
  state.hp = maxHp * IMPOTENT_HP_RATIO;
  state.lastEvent = `impotent:${state.phase}:${droppedFrom}`;
}

/** @type {number[]} */
const clickTimestamps = [];

/** @param {number} [now] @returns {boolean} */
export function tryConsumeClick(now = Date.now()) {
  const windowMs = 1000;
  while (clickTimestamps.length && clickTimestamps[0] <= now - windowMs) {
    clickTimestamps.shift();
  }
  if (clickTimestamps.length >= MAX_CPS) return false;
  clickTimestamps.push(now);
  return true;
}

/** @param {GameState} state */
export function click(state) {
  if (!tryConsumeClick()) return 0;

  const gain = computeClickPower(state);
  state.dickoin += gain;
  state.totalDickoinEarned += gain;
  state.totalClicks += 1;
  state.hp = Math.min(state.hp + gain * 0.05, computeMaxHp(state));
  const leveled = checkPhaseUnlock(state);
  state.lastEvent = leveled ? 'phase_up' : 'click';
  return gain;
}

/** @param {GameState} state @param {string} workerId */
export function getWorkerCost(state, workerId) {
  const w = getWorker(workerId);
  if (!w) return Infinity;
  const owned = state.workers[workerId] ?? 0;
  return Math.floor(w.baseCost * w.costMult ** owned);
}

/** @param {GameState} state @param {string} workerId */
export function buyWorker(state, workerId) {
  const w = getWorker(workerId);
  if (!w || state.phase < w.minPhase) return false;
  const cost = getWorkerCost(state, workerId);
  if (state.dickoin < cost) return false;
  state.dickoin -= cost;
  state.workers[workerId] = (state.workers[workerId] ?? 0) + 1;
  state.lastEvent = `buy_worker:${workerId}`;
  return true;
}

/** @param {GameState} state @param {string} skillId */
export function getSkillCost(state, skillId) {
  const s = getSkill(skillId);
  if (!s) return Infinity;
  const level = state.skills[skillId] ?? 0;
  if (level >= s.maxLevel) return Infinity;
  return Math.floor(s.baseCost * s.costMult ** level);
}

/** @param {GameState} state @param {string} skillId */
export function buySkill(state, skillId) {
  const s = getSkill(skillId);
  if (!s || state.phase < s.minPhase) return false;
  const level = state.skills[skillId] ?? 0;
  if (level >= s.maxLevel) return false;
  const cost = getSkillCost(state, skillId);
  if (state.dickoin < cost) return false;
  state.dickoin -= cost;
  state.skills[skillId] = level + 1;
  state.lastEvent = `buy_skill:${skillId}`;
  return true;
}

/** @param {GameState} state @param {number} amount */
export function swapDickoin(state, amount) {
  const phase = getPhaseConfig(state);
  if (!phase.swapUnlocked || amount < MIN_SWAP_DICKOIN) return 0;
  if (state.dickoin < amount) return 0;
  const tax = getTaxRate(state);
  const received = amount * (1 - tax);
  state.dickoin -= amount;
  state.growdy += received;
  state.lastEvent = `swap:${received}`;
  return received;
}

/** @param {GameState} state */
export function liquidate(state) {
  if (state.dickoin <= 0) return 0;
  const converted = state.dickoin;
  state.hp = Math.min(state.hp + converted, computeMaxHp(state));
  state.dickoin = 0;
  state.lastEvent = 'liquidate';
  return converted;
}

/** @param {GameState} state @param {number} deltaSec */
export function tick(state, deltaSec) {
  refreshGachaBuffs(state);
  const passive = computePassiveDickoin(state) * deltaSec;
  if (passive > 0) {
    state.dickoin += passive;
    state.totalDickoinEarned += passive;
  }

  const netHp = computeNetHpPerSec(state) * deltaSec;
  state.hp += netHp;

  const maxHp = computeMaxHp(state);
  if (state.hp > maxHp) state.hp = maxHp;

  if (shouldGoImpotent(state)) {
    applyImpotent(state);
  } else if (checkPhaseUnlock(state)) {
    state.lastEvent = 'phase_up';
  }
}

/** @param {GameState} state */
export function getDerivedStats(state) {
  const phase = getPhaseConfig(state);
  const maxHp = computeMaxHp(state);
  const nextPhase = state.phase < PHASES.length ? getPhase(state.phase + 1) : null;
  const gacha = getGachaMultipliers(state);
  return {
    phase,
    nextPhase,
    maxHp,
    clickPower: computeClickPower(state),
    passiveDickoin: computePassiveDickoin(state),
    burnRate: computeBurnRate(state),
    hpSustain: computeHpSustain(state),
    netHpPerSec: computeNetHpPerSec(state),
    runwaySec: computeRunwaySec(state),
    length: computeLength(state),
    taxRate: getTaxRate(state),
    taxTier: getCurrentTaxTier(state),
    swapUnlocked: phase.swapUnlocked,
    gachaBuffActive: gacha.active,
    gachaClickMult: gacha.click,
    gachaPassiveMult: gacha.passive,
    gachaBuffExpiresAt: gacha.expiresAt,
    progressToNextPhase: nextPhase
      ? Math.min(1, state.totalDickoinEarned / nextPhase.unlockTotalDickoin)
      : 1,
    nextPhaseCost: nextPhase?.unlockTotalDickoin ?? null,
  };
}

export { TICK_MS, SAVE_KEY, WORKERS, SKILLS, GACHA_POOL };
