/**
 * Offline balance tuner v2 — target P1→P2 ~45-60min @1tap/s, P2→P6 3-4 days no skill
 */

const IMPOTENT_HP_RATIO = 0.5;

function makePhases(overrides = {}) {
  const base = [
    { id: 1, burnRate: 0, baseMaxHp: 100, baseClickDickoin: 1, basePassiveDickoin: 0, unlockTotalDickoin: 0 },
    { id: 2, burnRate: 0, baseMaxHp: 120, baseClickDickoin: 2, basePassiveDickoin: 0.5, unlockTotalDickoin: 100 },
    { id: 3, burnRate: 2, baseMaxHp: 150, baseClickDickoin: 4, basePassiveDickoin: 1.5, unlockTotalDickoin: 750 },
    { id: 4, burnRate: 5, baseMaxHp: 200, baseClickDickoin: 8, basePassiveDickoin: 4, unlockTotalDickoin: 5000 },
    { id: 5, burnRate: 10, baseMaxHp: 280, baseClickDickoin: 15, basePassiveDickoin: 10, unlockTotalDickoin: 35000 },
    { id: 6, burnRate: 18, baseMaxHp: 400, baseClickDickoin: 30, basePassiveDickoin: 25, unlockTotalDickoin: 200000 },
  ];
  return base.map((p) => ({ ...p, ...(overrides[p.id] ?? {}) }));
}

function makeWorkers(overrides = {}) {
  const base = [
    { id: 'pump', baseCost: 25, costMult: 1.15, dickoinPerSec: 0.5, hpPerSec: 0, minPhase: 1 },
    { id: 'trim', baseCost: 120, costMult: 1.17, dickoinPerSec: 2, hpPerSec: 0.2, minPhase: 2 },
    { id: 'stretch', baseCost: 600, costMult: 1.18, dickoinPerSec: 8, hpPerSec: 0.5, minPhase: 3 },
    { id: 'skin', baseCost: 4000, costMult: 1.2, dickoinPerSec: 35, hpPerSec: 1.5, minPhase: 4 },
    { id: 'raid', baseCost: 25000, costMult: 1.22, dickoinPerSec: 150, hpPerSec: 3, minPhase: 5 },
  ];
  return base.map((w) => ({ ...w, ...(overrides[w.id] ?? {}) }));
}

function makeSkills() {
  return [
    { id: 'growth', baseCost: 50, costMult: 1.35, maxLevel: 20, minPhase: 1 },
    { id: 'guild', baseCost: 80, costMult: 1.4, maxLevel: 15, minPhase: 2 },
  ];
}

function getPhase(phases, id) {
  return phases.find((p) => p.id === id) ?? phases[0];
}

function computeMaxHp(phases, state) {
  const phase = getPhase(phases, state.phase);
  const guildLv = state.skills.guild ?? 0;
  return Math.floor(phase.baseMaxHp * (1 + guildLv * 0.1));
}

function computeClick(phases, state) {
  const phase = getPhase(phases, state.phase);
  const growthLv = state.skills.growth ?? 0;
  return phase.baseClickDickoin * (1 + growthLv * 0.25);
}

function computePassive(phases, workers, state) {
  const phase = getPhase(phases, state.phase);
  const phasePassive = state.phase >= 2 ? phase.basePassiveDickoin : 0;
  let workerPassive = 0;
  for (const w of workers) workerPassive += (state.workers[w.id] ?? 0) * w.dickoinPerSec;
  return phasePassive + workerPassive;
}

function computeHpSustain(workers, state) {
  let s = 0;
  for (const w of workers) s += (state.workers[w.id] ?? 0) * w.hpPerSec;
  return s;
}

function workerCost(workers, state, id) {
  const w = workers.find((x) => x.id === id);
  return Math.floor(w.baseCost * w.costMult ** (state.workers[id] ?? 0));
}

function skillCost(skills, state, id) {
  const s = skills.find((x) => x.id === id);
  const lv = state.skills[id] ?? 0;
  if (lv >= s.maxLevel) return Infinity;
  return Math.floor(s.baseCost * s.costMult ** lv);
}

function autoBuyWorkers(workers, state) {
  let bought = true;
  while (bought) {
    bought = false;
    let best = null;
    for (const w of workers) {
      if (state.phase < w.minPhase) continue;
      const cost = workerCost(workers, state, w.id);
      if (state.dickoin < cost) continue;
      const roi = w.dickoinPerSec / cost;
      if (!best || roi > best.roi) best = { id: w.id, cost };
    }
    if (best) {
      state.dickoin -= best.cost;
      state.workers[best.id] = (state.workers[best.id] ?? 0) + 1;
      bought = true;
    }
  }
}

function autoBuySkills(skills, state) {
  for (const s of skills) {
    if (state.phase < s.minPhase) continue;
    let cost = skillCost(skills, state, s.id);
    while (state.dickoin >= cost && (state.skills[s.id] ?? 0) < s.maxLevel) {
      state.dickoin -= cost;
      state.skills[s.id] = (state.skills[s.id] ?? 0) + 1;
      cost = skillCost(skills, state, s.id);
    }
  }
}

function tryPhaseUp(phases, state, reached, t) {
  while (state.phase < 6) {
    const next = getPhase(phases, state.phase + 1);
    if (state.totalDickoinEarned >= next.unlockTotalDickoin) {
      state.phase++;
      state.hp = Math.min(state.hp + computeMaxHp(phases, state) * 0.25, computeMaxHp(phases, state));
      if (!reached[state.phase]) reached[state.phase] = t;
    } else break;
  }
}

function simulate(cfg, { cps = 2, buyWorkers = true, buySkills = false, maxSec = 86400 * 14 }) {
  const phases = makePhases(cfg.phaseOverrides);
  const workers = makeWorkers(cfg.workerOverrides);
  const skills = makeSkills();

  const state = { phase: 1, hp: phases[0].baseMaxHp, dickoin: 0, totalDickoinEarned: 0, workers: {}, skills: {} };
  let t = 0, clickAcc = 0, impotent = 0;
  const reached = { 1: 0 };

  while (state.phase < 6 && t < maxSec) {
    if (buyWorkers) autoBuyWorkers(workers, state);
    if (buySkills) autoBuySkills(skills, state);

    const passive = computePassive(phases, workers, state) * 0.1;
    if (passive > 0) { state.dickoin += passive; state.totalDickoinEarned += passive; }

    const burn = getPhase(phases, state.phase).burnRate;
    state.hp += (computeHpSustain(workers, state) - burn) * 0.1;
    const maxHp = computeMaxHp(phases, state);
    if (state.hp > maxHp) state.hp = maxHp;

    if (burn > 0 && state.hp <= 1) {
      if (state.phase <= 2) state.hp = maxHp;
      else {
        state.phase -= 1;
        state.totalDickoinEarned = getPhase(phases, state.phase).unlockTotalDickoin;
        state.hp = computeMaxHp(phases, state) * IMPOTENT_HP_RATIO;
        impotent++;
      }
    } else tryPhaseUp(phases, state, reached, t);

    clickAcc += cps * 0.1;
    while (clickAcc >= 1) {
      const gain = computeClick(phases, state);
      state.dickoin += gain;
      state.totalDickoinEarned += gain;
      state.hp = Math.min(state.hp + gain * 0.05, computeMaxHp(phases, state));
      clickAcc -= 1;
      if (buyWorkers) autoBuyWorkers(workers, state);
      if (buySkills) autoBuySkills(skills, state);
      tryPhaseUp(phases, state, reached, t);
    }
    t += 0.1;
  }
  if (state.phase === 6 && !reached[6]) reached[6] = t;
  return { t, reached, impotent, phase: state.phase };
}

const fmt = (sec) => {
  if (!isFinite(sec)) return '∞';
  if (sec < 3600) return `${(sec / 60).toFixed(0)} min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} hr`;
  return `${(sec / 86400).toFixed(2)} days`;
};

function buildCfg(unlocks, inc) {
  return {
    phaseOverrides: {
      1: { baseClickDickoin: 1 * inc.click, unlockTotalDickoin: 0 },
      2: { baseClickDickoin: 2 * inc.click, basePassiveDickoin: 0.5 * inc.passive, unlockTotalDickoin: unlocks[2] },
      3: { baseClickDickoin: 4 * inc.click, basePassiveDickoin: 1.5 * inc.passive, burnRate: 1.8, unlockTotalDickoin: unlocks[3] },
      4: { baseClickDickoin: 8 * inc.click, basePassiveDickoin: 4 * inc.passive, burnRate: 4.5, unlockTotalDickoin: unlocks[4] },
      5: { baseClickDickoin: 15 * inc.click, basePassiveDickoin: 10 * inc.passive, burnRate: 9, unlockTotalDickoin: unlocks[5] },
      6: { baseClickDickoin: 30 * inc.click, basePassiveDickoin: 25 * inc.passive, burnRate: 16, unlockTotalDickoin: unlocks[6] },
    },
    workerOverrides: {
      pump: { dickoinPerSec: 0.5 * inc.workerD, baseCost: 25 * inc.workerC, costMult: 1.16 },
      trim: { dickoinPerSec: 2 * inc.workerD, baseCost: 120 * inc.workerC, costMult: 1.18 },
      stretch: { dickoinPerSec: 8 * inc.workerD, baseCost: 600 * inc.workerC, costMult: 1.19 },
      skin: { dickoinPerSec: 35 * inc.workerD, baseCost: 4000 * inc.workerC, costMult: 1.21 },
      raid: { dickoinPerSec: 150 * inc.workerD, baseCost: 25000 * inc.workerC, costMult: 1.23 },
    },
  };
}

function evalCfg(cfg) {
  const r0 = simulate(cfg, { cps: 1, buySkills: false, maxSec: 86400 * 14 });
  const r2 = simulate(cfg, { cps: 2, buySkills: false, maxSec: 86400 * 14 });
  const r2s = simulate(cfg, { cps: 2, buySkills: true, maxSec: 86400 * 14 });
  const p12_1 = r0.reached[2] ?? Infinity;
  const p26_2 = (r2.reached[6] ?? r2.t) - (r2.reached[2] ?? 0);
  const p26_2s = (r2s.reached[6] ?? r2s.t) - (r2s.reached[2] ?? 0);
  return { r0, r2, r2s, p12_1, p26_2, p26_2s };
}

const inc = { click: 0.35, passive: 0.28, workerD: 0.18, workerC: 2.5 };

const unlockGrid = [];
for (const p2 of [2700, 3000, 3600]) {
  for (const mult of [6, 7, 8, 9, 10, 11, 12]) {
    unlockGrid.push({
      2: p2,
      3: Math.round(55000 * mult * 0.55),
      4: Math.round(450000 * mult * 0.55),
      5: Math.round(3500000 * mult * 0.55),
      6: Math.round(20000000 * mult * 0.55),
    });
  }
}

let best = null;
for (const unlocks of unlockGrid) {
  const cfg = buildCfg(unlocks, inc);
  const e = evalCfg(cfg);
  if (e.r2.phase < 6 || e.r2s.phase < 6) continue;

  const mid = (x, lo, hi) => (x >= lo && x <= hi ? 0 : Math.min(Math.abs(x - lo), Math.abs(x - hi)));
  const loss =
    mid(e.p12_1, 45 * 60, 60 * 60) / 300 +
    mid(e.p26_2, 3 * 86400, 4 * 86400) / 7200 +
    mid(e.p26_2s, 2 * 86400, 3 * 86400) / 7200 +
    e.r2.impotent * 100 +
    e.r2s.impotent * 100;

  if (!best || loss < best.loss) best = { unlocks, inc, loss, e };
}

if (!best) {
  console.log('No candidate reached P6 — expanding search');
  process.exit(1);
}

console.log('=== BEST CONFIG ===');
console.log('Unlocks:', best.unlocks);
console.log('Income scale:', best.inc);
console.log('\n--- 1 tap/s, no skill ---');
console.log('P1→P2:', fmt(best.e.p12_1));
console.log('P2→P6:', fmt((best.e.r0.reached[6] ?? best.e.r0.t) - (best.e.r0.reached[2] ?? 0)));
console.log('Total:', fmt(best.e.r0.t), 'imp:', best.e.r0.impotent);

console.log('\n--- 2 tap/s, no skill ---');
console.log('P1→P2:', fmt(best.e.r2.reached[2]));
console.log('P2→P6:', fmt(best.e.p26_2));
console.log('Total:', fmt(best.e.r2.t), 'imp:', best.e.r2.impotent);
for (let p = 2; p <= 6; p++) {
  const prev = best.e.r2.reached[p - 1] ?? 0;
  const cur = best.e.r2.reached[p];
  if (cur) console.log(`  P${p - 1}→P${p}: ${fmt(cur - prev)}`);
}

console.log('\n--- 2 tap/s, with skill ---');
console.log('P1→P2:', fmt(best.e.r2s.reached[2]));
console.log('P2→P6:', fmt(best.e.p26_2s));
console.log('Total:', fmt(best.e.r2s.t), 'imp:', best.e.r2s.impotent);

console.log('\n--- Values for config.js ---');
const p = best.unlocks;
const i = best.inc;
console.log(`P2 unlock: ${p[2]}`);
console.log(`P3 unlock: ${p[3]}`);
console.log(`P4 unlock: ${p[4]}`);
console.log(`P5 unlock: ${p[5]}`);
console.log(`P6 unlock: ${p[6]}`);
console.log(`P1 click: ${(1 * i.click).toFixed(2)}`);
console.log(`P2 click/passive: ${(2 * i.click).toFixed(2)} / ${(0.5 * i.passive).toFixed(3)}`);
console.log(`Worker pump: ${(0.5 * i.workerD).toFixed(3)}/s cost ${Math.round(25 * i.workerC)}`);
