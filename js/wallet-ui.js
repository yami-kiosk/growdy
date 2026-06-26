import {
  exportSecretKeyBase58,
  fetchWalletBalances,
  formatAddress,
  formatGrowdyAmount,
  getBurnerAddress,
  getBurnerWallet,
} from './wallet.js';

/** @type {(() => void)|null} */
let openWalletModalFn = null;

/** Open wallet modal from settings or elsewhere. */
export function openWalletModal() {
  openWalletModalFn?.();
}

/** @type {ReturnType<typeof setInterval>|null} */
let inGamePollTimer = null;

function ensureWalletModal() {
  if (document.getElementById('walletModal')) return;

  const modal = document.createElement('div');
  modal.id = 'walletModal';
  modal.className = 'wallet-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="wallet-modal-backdrop" id="walletModalBackdrop"></div>
    <div class="wallet-modal-card" role="dialog" aria-modal="true" aria-labelledby="walletModalTitle">
      <button type="button" class="wallet-modal-close" id="walletModalClose" aria-label="Close">✕</button>
      <p class="wallet-modal-badge">🔥 Burner Wallet</p>
      <h2 class="wallet-modal-title" id="walletModalTitle">Your Wallet</h2>
      <p class="wallet-modal-desc">Your Solana burner wallet — holds on-chain $GROWDY & SOL. Export the key to use Phantom or Solflare.</p>

      <div class="wallet-modal-info">
        <p><strong>In-game $GROWDY</strong> is earned inside the game (swap dickoin). It lives in your save, not on-chain.</p>
        <p><strong>On-chain $GROWDY</strong> is the real token in this wallet — buy on Pump.fun, trade on DEX.</p>
      </div>

      <div class="wallet-modal-row">
        <span class="wallet-modal-label">Address</span>
        <code class="wallet-modal-address" id="walletModalAddress"></code>
        <button type="button" class="wallet-modal-copy" id="walletCopyAddress">Copy</button>
      </div>

      <div class="wallet-modal-balances">
        <div class="wallet-modal-balance">
          <span class="wallet-modal-label">$GROWDY on-chain</span>
          <strong class="wallet-modal-value wallet-modal-value--yellow" id="walletGrowdyOnChain">…</strong>
        </div>
        <div class="wallet-modal-balance" id="walletInGameRow" hidden>
          <span class="wallet-modal-label">$GROWDY in-game</span>
          <strong class="wallet-modal-value wallet-modal-value--yellow" id="walletGrowdyInGame">0</strong>
        </div>
        <div class="wallet-modal-balance">
          <span class="wallet-modal-label">SOL (gas)</span>
          <strong class="wallet-modal-value" id="walletSolBalance">…</strong>
        </div>
      </div>

      <p class="wallet-modal-status" id="walletBalanceStatus" hidden></p>

      <div class="wallet-modal-actions">
        <button type="button" class="wallet-modal-btn" id="walletRefreshBtn">↻ Refresh</button>
        <button type="button" class="wallet-modal-btn wallet-modal-btn--primary" id="walletExportBtn">Export Secret Key</button>
      </div>

      <div class="wallet-modal-export" id="walletExportPanel" hidden>
        <p class="wallet-modal-warning">
          ⚠️ Never share your secret key. Anyone with it can steal your funds.
        </p>
        <label class="wallet-modal-confirm-label" for="walletExportConfirm">
          Type <strong>EXPORT</strong> to confirm
        </label>
        <input type="text" class="wallet-modal-confirm-input" id="walletExportConfirm" autocomplete="off" spellcheck="false" />
        <button type="button" class="wallet-modal-btn wallet-modal-btn--danger" id="walletExportConfirmBtn" disabled>
          Copy Secret Key
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

/** @param {WalletUiOptions} [options] */
export function initBurnerWalletUi(options = {}) {
  getBurnerWallet();

  const walletBtn = document.getElementById('burnerWallet');
  const walletAddressEl = document.querySelector('.wallet-address');
  const address = getBurnerAddress();

  if (walletAddressEl) walletAddressEl.textContent = formatAddress(address);
  if (walletBtn) {
    walletBtn.title = 'Open burner wallet';
    walletBtn.setAttribute('aria-haspopup', 'dialog');
  }

  if (options.getInGameGrowdy && walletBtn && !walletBtn.querySelector('.wallet-growdy-pill')) {
    const pill = document.createElement('span');
    pill.className = 'wallet-growdy-pill';
    pill.setAttribute('aria-hidden', 'true');
    walletBtn.insertBefore(pill, walletBtn.querySelector('.wallet-address'));
    pill.textContent = formatGrowdyAmount(options.getInGameGrowdy());
  }

  ensureWalletModal();

  const modal = document.getElementById('walletModal');
  const backdrop = document.getElementById('walletModalBackdrop');
  const closeBtn = document.getElementById('walletModalClose');
  const addressEl = document.getElementById('walletModalAddress');
  const copyAddressBtn = document.getElementById('walletCopyAddress');
  const growdyOnChainEl = document.getElementById('walletGrowdyOnChain');
  const growdyInGameEl = document.getElementById('walletGrowdyInGame');
  const inGameRow = document.getElementById('walletInGameRow');
  const solEl = document.getElementById('walletSolBalance');
  const statusEl = document.getElementById('walletBalanceStatus');
  const refreshBtn = document.getElementById('walletRefreshBtn');
  const exportBtn = document.getElementById('walletExportBtn');
  const exportPanel = document.getElementById('walletExportPanel');
  const exportConfirmInput = /** @type {HTMLInputElement|null} */ (document.getElementById('walletExportConfirm'));
  const exportConfirmBtn = document.getElementById('walletExportConfirmBtn');

  if (!modal || !addressEl) return;

  addressEl.textContent = address;

  if (options.getInGameGrowdy && inGameRow && growdyInGameEl) {
    inGameRow.hidden = false;
  }

  function updateInGameBalance() {
    if (!options.getInGameGrowdy || !growdyInGameEl) return;
    growdyInGameEl.textContent = formatGrowdyAmount(options.getInGameGrowdy());
  }

  function stopInGamePoll() {
    if (inGamePollTimer) {
      clearInterval(inGamePollTimer);
      inGamePollTimer = null;
    }
  }

  function resetExportPanel() {
    if (exportPanel) exportPanel.hidden = true;
    if (exportConfirmInput) {
      exportConfirmInput.value = '';
    }
    if (exportConfirmBtn) exportConfirmBtn.disabled = true;
  }

  async function refreshBalances() {
    if (growdyOnChainEl) growdyOnChainEl.textContent = '…';
    if (solEl) solEl.textContent = '…';
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.classList.remove('is-error');
    }

    updateInGameBalance();

    const balances = await fetchWalletBalances(address);

    if (balances.status === 'error') {
      if (growdyOnChainEl) growdyOnChainEl.textContent = '—';
      if (solEl) solEl.textContent = '—';
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = 'On-chain balance unavailable right now. In-game $GROWDY still works. Tap Refresh to retry.';
        statusEl.classList.add('is-error');
      }
      return;
    }

    if (growdyOnChainEl) growdyOnChainEl.textContent = formatGrowdyAmount(balances.growdyOnChain);
    if (solEl) solEl.textContent = balances.sol != null ? balances.sol.toFixed(4) : '—';
  }

  function openModal() {
    modal.hidden = false;
    document.body.classList.add('wallet-modal-active');
    resetExportPanel();
    refreshBalances();
    stopInGamePoll();
    if (options.getInGameGrowdy) {
      inGamePollTimer = setInterval(updateInGameBalance, 1000);
    }
    closeBtn?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('wallet-modal-active');
    resetExportPanel();
    stopInGamePoll();
  }

  walletBtn?.addEventListener('click', openModal);
  backdrop?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);

  openWalletModalFn = openModal;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  copyAddressBtn?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(address);
    if (copyAddressBtn) copyAddressBtn.textContent = 'Copied!';
    setTimeout(() => {
      if (copyAddressBtn) copyAddressBtn.textContent = 'Copy';
    }, 1500);
  });

  refreshBtn?.addEventListener('click', () => refreshBalances());

  exportBtn?.addEventListener('click', () => {
    if (exportPanel) exportPanel.hidden = false;
    exportConfirmInput?.focus();
  });

  exportConfirmInput?.addEventListener('input', () => {
    if (exportConfirmBtn) {
      exportConfirmBtn.disabled = exportConfirmInput.value.trim() !== 'EXPORT';
    }
  });

  exportConfirmBtn?.addEventListener('click', async () => {
    if (exportConfirmInput?.value.trim() !== 'EXPORT') return;

    const secret = exportSecretKeyBase58();
    await navigator.clipboard.writeText(secret);

    if (exportConfirmBtn) {
      exportConfirmBtn.textContent = 'Copied to clipboard!';
      exportConfirmBtn.disabled = true;
    }

    setTimeout(() => {
      if (exportConfirmBtn) exportConfirmBtn.textContent = 'Copy Secret Key';
      resetExportPanel();
    }, 2000);
  });
}

/** Call from game render loop to keep badge in sync (optional). */
export function refreshWalletBadgeGrowdy(getInGameGrowdy) {
  const el = document.querySelector('.wallet-growdy-pill');
  if (!el || !getInGameGrowdy) return;
  el.textContent = formatGrowdyAmount(getInGameGrowdy());
}