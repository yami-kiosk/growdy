import { PHASES, SKILLS, WORKERS, getPhase } from '../js/game/config.js';
import {
  createInitialState,
  tick,
  click,
  buyWorker,
  buySkill,
  getWorkerCost,
  getSkillCost,
  computePassiveDickoin,
  computeClickPower,
  computeMaxHp,
} from '../js/game/engine.js';

const fmt = (sec) => {
  if (!isFinite(sec)) return '∞';
  if (sec < 60) return `${sec.toFixed(0)}s`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)} min`;
  if (sec < 86400) return `${(sec / 3600).toFixed(1)} hr`;
  return `${(sec / 86400).toFixed(1)} days`;
};

function autoBuyWorkers(state) {
  let bought = true;
  while (bought) {
    bought = false;
    let best = null;
    for (const w of WORKERS) {
      if (state.phase < w.minPhase) continue;
      const cost = getWorkerCost(state, w.id);
      if (state.dickoin < cost) continue;
      const roi = w.dickoinPerSec / cost;
      if (!best || roi > best.roi) best = { id: w.id, cost, roi };
    }
    if (best) {
      state.dickoin -= best.cost;
      state.workers[best.id] = (state.workers[best.id] ?? 0) + 1;
      bought = true;
    }
  }
}

function autoBuySkills(state, mode) {
  if (mode === 'none') return;
  for (const s of SKILLS) {
    if (state.phase < s.minPhase) continue;
    const lv = state.skills[s.id] ?? 0;
    if (lv >= s.maxLevel) continue;
    const cost = getSkillCost(state, s.id);
    if (!isFinite(cost)) continue;
    let want = mode === 'asap';
    if (mode === 'smart') {
      if (s.id === 'guild_raids' && state.phase < 3) want = false;
      else if (state.dickoin >= cost * 2) want = true;
      else want = false;
    }
    if (want && state.dickoin >= cost) {
      state.dickoin -= cost;
      state.skills[s.id] = lv + 1;
    }
  }
}

function runSim({ cps = 0, workers = false, skills = 'none', maxSec = 86400 * 14 }) {
  const state = createInitialState();
  let t = 0;
  let clickAcc = 0;
  let impotent = 0;
  const reached = { 1: 0 };
  let skillSpend = 0;
  let workerSpend = 0;

  while (state.phase < 6 && t < maxSec) {
    if (workers) autoBuyWorkers(state);
    autoBuySkills(state, skills);

    tick(state, 0.1);
    clickAcc += cps * 0.1;
    while (clickAcc >= 1) {
      click(state);
      clickAcc -= 1;
      if (workers) autoBuyWorkers(state);
      autoBuySkills(state, skills);
    }

    if (state.lastEvent?.startsWith('impotent:')) impotent += 1;
    if (state.lastEvent?.startsWith('phase_up') && !reached[state.phase]) {
      reached[state.phase] = t;
    }

    t += 0.1;
  }
  if (state.phase === 6 && !reached[6]) reached[6] = t;

  const segments = {};
  for (let p = 2; p <= 6; p++) {
    segments[`${p - 1}→${p}`] =
      reached[p] != null ? (reached[p] - (reached[p - 1] ?? 0)) : null;
  }

  return { t, reached, segments, impotent, phase: state.phase, skills: state.skills, workers: state.workers };
}

// P2 AFK yo-yo test
{
  const s = createInitialState();
  s.phase = 2;
  s.totalDickoinEarned = 100;
  s.hp = computeMaxHp(s);
  let imp = 0;
  const changes = [];
  for (let i = 0; i < 86400 * 10; i++) {
    const prev = s.phase;
    tick(s, 1);
    if (s.phase !== prev) changes.push({ t: i + 1, prev, next: s.phase, earned: Math.floor(s.totalDickoinEarned) });
    if (s.lastEvent?.startsWith('impotent:')) imp++;
  }
  console.log('P2 AFK 10 days: final P' + s.phase, 'earned', Math.floor(s.totalDickoinEarned), 'impotent', imp);
  console.log('  first 8 phase changes:', changes.slice(0, 8));
}

console.log('\n=== RINGKASAN PROGRESSION ===\n');

const profiles = [
  { name: 'Pure click ~2 tap/s, tanpa beli apa-apa', cps: 2 },
  { name: 'Pure click ~5 tap/s, tanpa beli', cps: 5 },
  { name: 'Casual ~1 tap/s + beli worker kalau cukup', cps: 1, workers: true },
  { name: 'Average ~2 tap/s + worker', cps: 2, workers: true },
  { name: 'Active ~3 tap/s + worker', cps: 3, workers: true },
  { name: 'Active ~3 tap/s + worker + skill (beli ASAP)', cps: 3, workers: true, skills: 'asap' },
  { name: 'Active ~3 tap/s + worker + skill (smart)', cps: 3, workers: true, skills: 'smart' },
  { name: 'Hardcore ~6 tap/s + worker + skill ASAP', cps: 6, workers: true, skills: 'asap' },
];

for (const p of profiles) {
  const r = runSim(p);
  console.log(`【${p.name}】`);
  if (r.phase < 6) {
    console.log(`  Stuck di P${r.phase} setelah ${fmt(r.t)} | impotent: ${r.impotent}x`);
  } else {
    console.log(`  P1→P6 total: ${fmt(r.t)} | impotent: ${r.impotent}x`);
  }
  for (const seg of ['1→2', '2→3', '3→4', '4→5', '5→6']) {
    const d = r.segments[seg];
    console.log(`  ${seg}: ${d != null ? fmt(d) : '—'}`);
  }
  if (p.skills && p.skills !== 'none' && r.phase >= 6) {
    console.log(`  Skill akhir: Growth L${r.skills.growth_access ?? 0}, Guild L${r.skills.guild_raids ?? 0}`);
  }
  console.log('');
}

console.log('=== SKILL COST REFERENCE ===');
for (const sk of SKILLS) {
  let total = 0;
  for (let lv = 0; lv < sk.maxLevel; lv++) total += Math.floor(sk.baseCost * sk.costMult ** lv);
  console.log(`${sk.name}: L1=${sk.baseCost}, max L${sk.maxLevel} total=${total.toLocaleString()} dickoin`);
}

console.log('\n=== DICKOIN PER SEGMENT ===');
for (let i = 1; i < 6; i++) {
  const need = getPhase(i + 1).unlockTotalDickoin - getPhase(i).unlockTotalDickoin;
  console.log(`P${i}→P${i + 1}: ${need.toLocaleString()} dickoin`);
}
