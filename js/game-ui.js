import { initBurnerWalletUi, refreshWalletBadgeGrowdy, openWalletModal } from './wallet-ui.js';
import { getBurnerAddress, formatAddress } from './wallet.js';
import { MIN_SWAP_DICKOIN, getPhase, getPhaseImage, GACHA_POOL, GACHA_MIN_PHASE, GACHA_SINGLE_COST, PHASES } from './game/config.js';
import {
  tick,
  click,
  buyWorker,
  buySkill,
  getWorkerCost,
  getSkillCost,
  swapDickoin,
  liquidate,
  rollGacha,
  canRollGacha,
  getDerivedStats,
  TICK_MS,
  WORKERS,
  SKILLS,
} from './game/engine.js';
import {
  flushCloudSave,
  getCloudSaveStatus,
  isCloudConfigured,
  loadGameState,
  onCloudSaveStatus,
  persistGameState,
  resetGameState,
} from './game/persist.js';
import { formatNum, formatPct, formatRunway } from './game/format.js';
import { playMoan, playFart, playHooray, unlockAudio } from './game/sfx.js';
import { initMusicPlayerFromDom } from './game/music.js';

/** @type {import('./game/engine.js').GameState} */
let state;
const walletAddress = getBurnerAddress();

function saveProgress() {
  persistGameState(walletAddress, state);
}
let lastTick = performance.now();
let saveTimer = 0;
let toastTimer = 0;
let phaseModalOpen = false;
/** @type {'up' | 'impotent'} */
let phaseModalMode = 'up';

const els = {
  phaseName: document.getElementById('phaseName'),
  phaseTagline: document.getElementById('phaseTagline'),
  phaseProgressBar: document.getElementById('phaseProgressBar'),
  phaseProgressText: document.getElementById('phaseProgressText'),
  hpFill: document.getElementById('hpFill'),
  hpText: document.getElementById('hpText'),
  burnRow: document.getElementById('burnRow'),
  runwayRow: document.getElementById('runwayRow'),
  lengthStat: document.getElementById('lengthStat'),
  clickStat: document.getElementById('clickStat'),
  passiveStat: document.getElementById('passiveStat'),
  clicksStat: document.getElementById('clicksStat'),
  dickoinStat: document.getElementById('dickoinStat'),
  growdyStat: document.getElementById('growdyStat'),
  clickZone: document.getElementById('clickZone'),
  gameCharacter: document.getElementById('gameCharacter'),
  floatLayer: document.getElementById('floatLayer'),
  gameToast: document.getElementById('gameToast'),
  workerList: document.getElementById('workerList'),
  skillList: document.getElementById('skillList'),
  p2eLock: document.getElementById('p2eLock'),
  p2ePanel: document.getElementById('p2ePanel'),
  taxTierLabel: document.getElementById('taxTierLabel'),
  taxRateLabel: document.getElementById('taxRateLabel'),
  swapAmount: document.getElementById('swapAmount'),
  swapPreview: document.getElementById('swapPreview'),
  swapBtn: document.getElementById('swapBtn'),
  swapMaxBtn: document.getElementById('swapMaxBtn'),
  liquidateBtn: document.getElementById('liquidateBtn'),
  phaseModal: document.getElementById('phaseModal'),
  phaseModalCard: document.getElementById('phaseModalCard'),
  phaseModalBackdrop: document.getElementById('phaseModalBackdrop'),
  phaseModalBadge: document.getElementById('phaseModalBadge'),
  phaseModalImg: document.getElementById('phaseModalImg'),
  phaseModalTitle: document.getElementById('phaseModalTitle'),
  phaseModalDesc: document.getElementById('phaseModalDesc'),
  phaseModalPerks: document.getElementById('phaseModalPerks'),
  phaseModalBtn: document.getElementById('phaseModalBtn'),
  gachaLock: document.getElementById('gachaLock'),
  gachaPanel: document.getElementById('gachaPanel'),
  gachaBuffStatus: document.getElementById('gachaBuffStatus'),
  gachaSingleBtn: document.getElementById('gachaSingleBtn'),
  gachaRates: document.getElementById('gachaRates'),
  gachaResults: document.getElementById('gachaResults'),
  gachaResultList: document.getElementById('gachaResultList'),
  settingsCloudStatus: document.getElementById('settingsCloudStatus'),
  settingsWalletAddr: document.getElementById('settingsWalletAddr'),
  settingsOpenWalletBtn: document.getElementById('settingsOpenWalletBtn'),
  settingsExportKeyBtn: document.getElementById('settingsExportKeyBtn'),
  settingsResetConfirm: document.getElementById('settingsResetConfirm'),
  settingsResetBtn: document.getElementById('settingsResetBtn'),
};

function initNav() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const nav = document.querySelector('.nav');
  if (!mobileMenuBtn || !nav) return;

  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    mobileMenuBtn.classList.toggle('is-open', isOpen);
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      mobileMenuBtn.classList.remove('is-open');
    });
  });
}

function initTabs() {
  document.querySelectorAll('.game-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.game-tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.game-panel').forEach((panel) => {
        const show = panel.id === `panel-${name}`;
        panel.classList.toggle('active', show);
        panel.hidden = !show;
      });
    });
  });
}

function showToast(message) {
  if (!els.gameToast || !message) return;
  els.gameToast.textContent = message;
  els.gameToast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.gameToast.classList.remove('visible'), 2800);
}

function getPhasePerks(phaseId) {
  const phase = getPhase(phaseId);
  const perks = [
    `Length ×${phase.lengthMultiplier.toFixed(2)}`,
    `Click power: ${phase.baseClickDickoin} dickoin`,
  ];

  if (phaseId >= 2) perks.push(`Passive: +${phase.basePassiveDickoin}/s dickoin`);
  if (phase.swapUnlocked) perks.push('Swap dickoin → $GROWDY unlocked');
  if (phase.burnRate > 0) perks.push(`Burn rate: ${phase.burnRate} IMPOTENT/s`);
  else perks.push('Safe zone — zero burn');
  if (phaseId === 5) perks.push('Testicle hair growth unlocked');
  if (phaseId === 6) perks.push('Season Exit eligible');

  return perks;
}

function openPhaseModal() {
  if (!els.phaseModal) return;
  els.phaseModal.hidden = false;
  els.clickZone?.classList.add('is-modal-open');
  document.body.classList.add('phase-modal-active');
  els.phaseModalBtn?.focus();
}

function showPhaseModal(phaseId) {
  if (!els.phaseModal) return;

  playHooray();

  const phase = getPhase(phaseId);
  phaseModalOpen = true;
  phaseModalMode = 'up';

  els.phaseModalCard?.classList.remove('is-impotent');
  if (els.phaseModalBadge) els.phaseModalBadge.textContent = 'Phase Up!';
  if (els.phaseModalBtn) els.phaseModalBtn.textContent = "Let's Grow!";

  if (els.phaseModalImg) {
    els.phaseModalImg.src = getPhaseImage(phaseId);
    els.phaseModalImg.alt = `Phase ${phaseId} — ${phase.name}`;
  }
  if (els.phaseModalTitle) {
    els.phaseModalTitle.textContent = `Phase ${phaseId} — ${phase.name}`;
  }
  if (els.phaseModalDesc) els.phaseModalDesc.textContent = phase.tagline;
  if (els.phaseModalPerks) {
    els.phaseModalPerks.innerHTML = getPhasePerks(phaseId)
      .map((perk) => `<li>${perk}</li>`)
      .join('');
  }

  openPhaseModal();
}

function showImpotentModal(newPhaseId, oldPhaseId) {
  if (!els.phaseModal) return;

  const phase = getPhase(newPhaseId);
  const oldPhase = getPhase(oldPhaseId);
  const nextPhase = newPhaseId < PHASES.length ? getPhase(newPhaseId + 1) : null;

  phaseModalOpen = true;
  phaseModalMode = 'impotent';

  els.phaseModalCard?.classList.add('is-impotent');
  if (els.phaseModalBadge) els.phaseModalBadge.textContent = '💀 IMPOTENT';
  if (els.phaseModalBtn) els.phaseModalBtn.textContent = 'Back to Grind';

  if (els.phaseModalImg) {
    els.phaseModalImg.src = getPhaseImage(newPhaseId);
    els.phaseModalImg.alt = `Phase ${newPhaseId} — ${phase.name}`;
  }
  if (els.phaseModalTitle) {
    els.phaseModalTitle.textContent = `Phase ${oldPhaseId} → Phase ${newPhaseId}`;
  }
  if (els.phaseModalDesc) {
    els.phaseModalDesc.textContent =
      `IMPOTENT bar empty! You fell from ${oldPhase.name} back to ${phase.name}. Grind dickoin to climb again.`;
  }
  if (els.phaseModalPerks) {
    const perks = [
      `Now: ${phase.name} — ${phase.tagline}`,
      phase.burnRate > 0
        ? `Burn: ${phase.burnRate} IMPOTENT/s`
        : 'Safe zone — zero burn',
    ];
    if (nextPhase) {
      perks.push(`Re-unlock Phase ${newPhaseId + 1}: earn ${formatNum(nextPhase.unlockTotalDickoin)} dickoin total`);
    }
    els.phaseModalPerks.innerHTML = perks.map((perk) => `<li>${perk}</li>`).join('');
  }

  openPhaseModal();
}

function closePhaseModal() {
  if (!els.phaseModal) return;
  phaseModalOpen = false;
  els.phaseModal.hidden = true;
  els.clickZone?.classList.remove('is-modal-open');
  document.body.classList.remove('phase-modal-active');
  processPhaseUpQueue();
}

function processPhaseUpQueue() {
  if (phaseModalOpen || !state.pendingPhaseUps?.length) return;

  const phaseId = state.pendingPhaseUps.shift();
  updateCharacterVisual();
  showPhaseModal(phaseId);
  saveProgress();
}

function initPhaseModal() {
  els.phaseModalBtn?.addEventListener('click', closePhaseModal);
  els.phaseModalBackdrop?.addEventListener('click', closePhaseModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && phaseModalOpen) closePhaseModal();
  });
}

function handleEventMessage() {
  const ev = state.lastEvent;
  if (!ev) return;

  if (ev.startsWith('impotent:')) {
    const [, newPhase, oldPhase] = ev.split(':');
    updateCharacterVisual();
    showImpotentModal(Number(newPhase), Number(oldPhase));
  } else if (ev === 'phase_up') {
    updateCharacterVisual();
  } else if (ev === 'liquidate') {
    showToast('🚨 Liquidated all dickoin → IMPOTENT bar');
  } else if (ev.startsWith('swap:')) {
    showToast(`Swapped → ${formatNum(Number(ev.split(':')[1]))} $GROWDY`);
  } else if (ev.startsWith('gacha:')) {
    showToast(`🎰 Gacha ×${ev.split(':')[1]} — good luck…`);
  }
}

function spawnFloat(amount, clientX, clientY) {
  if (!els.floatLayer || !els.clickZone) return;
  const rect = els.floatLayer.getBoundingClientRect();
  const x = clientX - rect.left + (Math.random() - 0.5) * 14;
  const y = clientY - rect.top + (Math.random() - 0.5) * 10;

  const el = document.createElement('span');
  el.className = 'game-float';
  el.textContent = `+${formatNum(amount)}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  els.floatLayer.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

function updateCharacterVisual() {
  if (!els.gameCharacter) return;
  els.gameCharacter.src = getPhaseImage(state.phase);
  els.gameCharacter.alt = `Phase ${state.phase}`;
}

function buildWorkerShop() {
  if (!els.workerList || els.workerList.dataset.built) return;
  els.workerList.innerHTML = '';

  for (const w of WORKERS) {
    const item = document.createElement('div');
    item.className = 'game-shop-item';
    item.dataset.workerItem = w.id;
    item.innerHTML = `
      <div class="game-shop-head">
        <span class="game-shop-name">${w.name}</span>
        <span class="game-shop-level">×0</span>
      </div>
      <p class="game-shop-desc">${w.description} (+${w.dickoinPerSec}/s dickoin${w.hpPerSec ? `, +${w.hpPerSec} IMPOTENT/s` : ''})</p>
      <button type="button" class="game-shop-buy" data-worker="${w.id}">Hire</button>
    `;
    els.workerList.appendChild(item);
  }

  els.workerList.dataset.built = '1';
}

function updateWorkerShop() {
  if (!els.workerList) return;
  buildWorkerShop();

  for (const w of WORKERS) {
    const item = els.workerList.querySelector(`[data-worker-item="${w.id}"]`);
    if (!item) continue;

    const owned = state.workers[w.id] ?? 0;
    const cost = getWorkerCost(state, w.id);
    const locked = state.phase < w.minPhase;
    const canBuy = !locked && state.dickoin >= cost;
    const btn = item.querySelector('[data-worker]');
    const levelEl = item.querySelector('.game-shop-level');

    if (levelEl) levelEl.textContent = `×${owned}`;
    item.classList.toggle('locked', locked);

    if (btn) {
      btn.textContent = locked ? `Unlock Phase ${w.minPhase}` : `Hire · ${formatNum(cost)}`;
      btn.disabled = !canBuy;
    }
  }
}

function buildSkillShop() {
  if (!els.skillList || els.skillList.dataset.built) return;
  els.skillList.innerHTML = '';

  for (const s of SKILLS) {
    const item = document.createElement('div');
    item.className = 'game-shop-item';
    item.dataset.skillItem = s.id;
    item.innerHTML = `
      <div class="game-shop-head">
        <span class="game-shop-name">${s.name}</span>
        <span class="game-shop-level">Lv 0/${s.maxLevel}</span>
      </div>
      <p class="game-shop-desc">${s.description}</p>
      <button type="button" class="game-shop-buy" data-skill="${s.id}">Upgrade</button>
    `;
    els.skillList.appendChild(item);
  }

  els.skillList.dataset.built = '1';
}

function updateSkillShop() {
  if (!els.skillList) return;
  buildSkillShop();

  for (const s of SKILLS) {
    const item = els.skillList.querySelector(`[data-skill-item="${s.id}"]`);
    if (!item) continue;

    const level = state.skills[s.id] ?? 0;
    const maxed = level >= s.maxLevel;
    const cost = getSkillCost(state, s.id);
    const locked = state.phase < s.minPhase;
    const canBuy = !locked && !maxed && state.dickoin >= cost;
    const btn = item.querySelector('[data-skill]');
    const levelEl = item.querySelector('.game-shop-level');

    if (levelEl) levelEl.textContent = `Lv ${level}/${s.maxLevel}`;
    item.classList.toggle('locked', locked);

    if (btn) {
      btn.textContent = locked ? `Unlock Phase ${s.minPhase}` : maxed ? 'MAX' : `Upgrade · ${formatNum(cost)}`;
      btn.disabled = !canBuy;
    }
  }
}

function updateSwapPreview() {
  const stats = getDerivedStats(state);
  const amount = Number(els.swapAmount?.value) || 0;
  const received = stats.swapUnlocked ? amount * (1 - stats.taxRate) : 0;
  if (els.swapPreview) els.swapPreview.textContent = formatNum(received);
  if (els.swapBtn) els.swapBtn.disabled = !stats.swapUnlocked || amount < MIN_SWAP_DICKOIN || amount > state.dickoin;
}

function renderGachaRates() {
  if (!els.gachaRates || els.gachaRates.dataset.ready) return;
  const total = GACHA_POOL.reduce((sum, item) => sum + item.weight, 0);
  els.gachaRates.innerHTML = GACHA_POOL.map((item) => {
    const pct = ((item.weight / total) * 100);
    const pctLabel = pct >= 1 ? pct.toFixed(1) : pct.toFixed(3);
    return `<li><span class="game-gacha-rate-name game-gacha-rate-name--${item.rarity}">${item.name}</span><span>${pctLabel}%</span></li>`;
  }).join('');
  els.gachaRates.dataset.ready = '1';
}

function renderGachaResults(results) {
  if (!els.gachaResults || !els.gachaResultList || !results?.length) return;
  els.gachaResults.hidden = false;
  els.gachaResultList.innerHTML = results.map((r) => `
    <li>
      <span class="game-gacha-rate-name game-gacha-rate-name--${r.rarity}">${r.name}</span>
      <span class="game-gacha-result-detail">${r.detail}</span>
    </li>
  `).join('');
}

function renderGacha() {
  const stats = getDerivedStats(state);
  const locked = state.phase < GACHA_MIN_PHASE;

  if (els.gachaLock) els.gachaLock.hidden = !locked;
  if (els.gachaPanel) els.gachaPanel.hidden = locked;

  renderGachaRates();

  if (els.gachaBuffStatus) {
    if (stats.gachaBuffActive) {
      const secs = Math.max(0, Math.ceil((stats.gachaBuffExpiresAt - Date.now()) / 1000));
      const parts = [];
      if (stats.gachaClickMult > 1) parts.push(`${stats.gachaClickMult}× click`);
      if (stats.gachaPassiveMult > 1) parts.push(`${stats.gachaPassiveMult}× passive`);
      els.gachaBuffStatus.textContent = `⚡ Buff active: ${parts.join(' · ')} · ${secs}s left`;
      els.gachaBuffStatus.hidden = false;
    } else {
      els.gachaBuffStatus.hidden = true;
    }
  }

  if (els.gachaSingleBtn) {
    els.gachaSingleBtn.disabled = locked || !canRollGacha(state);
    els.gachaSingleBtn.textContent = `Pull ×1 · ${GACHA_SINGLE_COST} $GROWDY`;
  }
}

function renderP2e() {
  const stats = getDerivedStats(state);
  const locked = !stats.swapUnlocked;

  if (els.p2eLock) els.p2eLock.hidden = !locked;
  if (els.p2ePanel) els.p2ePanel.hidden = locked;
  if (els.taxTierLabel) els.taxTierLabel.textContent = stats.taxTier.label;
  if (els.taxRateLabel) els.taxRateLabel.textContent = formatPct(stats.taxRate);
  updateSwapPreview();
}

function render() {
  const stats = getDerivedStats(state);
  const hpPct = stats.maxHp > 0 ? (state.hp / stats.maxHp) * 100 : 0;

  if (els.phaseName) els.phaseName.textContent = `Phase ${stats.phase.id} — ${stats.phase.name}`;
  if (els.phaseTagline) els.phaseTagline.textContent = stats.phase.tagline;
  if (els.phaseProgressBar) els.phaseProgressBar.style.width = `${stats.progressToNextPhase * 100}%`;

  if (els.phaseProgressText) {
    els.phaseProgressText.textContent = stats.nextPhase
      ? `${formatNum(state.totalDickoinEarned)} / ${formatNum(stats.nextPhaseCost)} dickoin earned`
      : 'Max phase reached — Season Exit eligible';
  }

  if (els.hpFill) els.hpFill.style.width = `${Math.max(0, Math.min(100, hpPct))}%`;
  if (els.hpText) els.hpText.textContent = `${formatNum(state.hp, 0)} / ${formatNum(stats.maxHp, 0)}`;

  if (els.burnRow) {
    els.burnRow.textContent = stats.burnRate > 0
      ? `Burn: ${formatNum(stats.burnRate)}/s · Sustain: +${formatNum(stats.hpSustain)}/s · Net: ${formatNum(stats.netHpPerSec)}/s`
      : 'Burn: 0/s · Safe zone';
  }

  if (els.runwayRow) {
    els.runwayRow.textContent = Number.isFinite(stats.runwaySec)
      ? `Runway: ${formatRunway(stats.runwaySec)}`
      : 'Runway: ∞';
  }

  if (els.lengthStat) els.lengthStat.textContent = `${stats.length.toFixed(2)}×`;
  if (els.clickStat) els.clickStat.textContent = formatNum(stats.clickPower);
  if (els.passiveStat) els.passiveStat.textContent = `${formatNum(stats.passiveDickoin)}/s`;
  if (els.clicksStat) els.clicksStat.textContent = formatNum(state.totalClicks, 0);
  if (els.dickoinStat) els.dickoinStat.textContent = formatNum(state.dickoin);
  if (els.growdyStat) els.growdyStat.textContent = formatNum(state.growdy);

  if (els.liquidateBtn) els.liquidateBtn.disabled = state.dickoin <= 0;

  updateCharacterVisual();
  handleEventMessage();
  processPhaseUpQueue();
  state.lastEvent = null;

  updateWorkerShop();
  updateSkillShop();
  renderGacha();
  renderP2e();
  refreshWalletBadgeGrowdy(() => state.growdy);
}

function gameLoop(now) {
  const delta = Math.min((now - lastTick) / 1000, 0.25);
  lastTick = now;

  tick(state, delta);
  render();

  saveTimer += delta;
  if (saveTimer >= 5) {
    saveProgress();
    saveTimer = 0;
  }

  setTimeout(() => requestAnimationFrame(gameLoop), TICK_MS);
}

function renderCloudStatus() {
  if (!els.settingsCloudStatus) return;

  const status = getCloudSaveStatus();
  const labels = {
    idle: 'Checking cloud save…',
    syncing: 'Saving to cloud…',
    synced: isCloudConfigured()
      ? '☁️ Cloud save active — progress synced to your wallet address.'
      : '💾 Local save only — add Supabase keys to enable cloud sync.',
    local: '💾 Local save only — add Supabase keys (.env.local) to enable cloud sync.',
    error: '⚠️ Cloud save failed — progress still saved in this browser. Will retry on next save.',
  };

  els.settingsCloudStatus.textContent = labels[status] ?? labels.local;
}

function initSettings() {
  if (els.settingsWalletAddr) {
    els.settingsWalletAddr.textContent = formatAddress(walletAddress, 6);
  }

  renderCloudStatus();
  onCloudSaveStatus(renderCloudStatus);

  els.settingsOpenWalletBtn?.addEventListener('click', () => openWalletModal());

  els.settingsExportKeyBtn?.addEventListener('click', () => {
    openWalletModal();
    document.getElementById('walletExportBtn')?.click();
  });

  els.settingsResetConfirm?.addEventListener('input', () => {
    if (els.settingsResetBtn && els.settingsResetConfirm) {
      els.settingsResetBtn.disabled = els.settingsResetConfirm.value.trim() !== 'RESET';
    }
  });

  els.settingsResetBtn?.addEventListener('click', async () => {
    if (els.settingsResetConfirm?.value.trim() !== 'RESET') return;

    state = await resetGameState(walletAddress);
    if (els.settingsResetConfirm) els.settingsResetConfirm.value = '';
    if (els.settingsResetBtn) els.settingsResetBtn.disabled = true;
    showToast('Progress wiped — fresh start!');
    updateCharacterVisual();
    render();
  });
}

function initActions() {
  const unlockOnce = () => unlockAudio();
  els.clickZone?.addEventListener('pointerdown', unlockOnce, { once: true });

  els.clickZone?.addEventListener('click', (e) => {
    if (phaseModalOpen) return;
    const gain = click(state);
    if (gain <= 0) return;
    playFart();
    spawnFloat(gain, e.clientX, e.clientY);
    render();
  });

  els.liquidateBtn?.addEventListener('click', () => {
    if (liquidate(state) > 0) {
      saveProgress();
      render();
    }
  });

  els.swapAmount?.addEventListener('input', updateSwapPreview);

  els.swapBtn?.addEventListener('click', () => {
    const amount = Number(els.swapAmount.value) || 0;
    if (swapDickoin(state, amount) > 0) {
      saveProgress();
      render();
    }
  });

  els.swapMaxBtn?.addEventListener('click', () => {
    if (state.dickoin >= MIN_SWAP_DICKOIN) {
      els.swapAmount.value = String(Math.floor(state.dickoin));
      updateSwapPreview();
      if (swapDickoin(state, Math.floor(state.dickoin)) > 0) {
        saveProgress();
        render();
      }
    }
  });

  els.gachaSingleBtn?.addEventListener('click', () => {
    const { ok, results } = rollGacha(state);
    if (ok) {
      playMoan();
      renderGachaResults(results);
      saveProgress();
      render();
    }
  });

  els.workerList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-worker]');
    if (!btn || btn.disabled) return;
    if (buyWorker(state, btn.dataset.worker)) {
      playMoan();
      saveProgress();
      render();
    }
  });

  els.skillList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-skill]');
    if (!btn || btn.disabled) return;
    if (buySkill(state, btn.dataset.skill)) {
      playMoan();
      saveProgress();
      render();
    }
  });
}

async function boot() {
  initMusicPlayerFromDom();
  state = await loadGameState(walletAddress);
  initBurnerWalletUi({ getInGameGrowdy: () => state.growdy });

  initNav();
  initTabs();
  initPhaseModal();
  initSettings();
  initActions();
  updateCharacterVisual();
  render();
  requestAnimationFrame(gameLoop);
}

boot();

window.addEventListener('beforeunload', () => {
  flushCloudSave(walletAddress, state);
});
