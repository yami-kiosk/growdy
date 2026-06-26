import { getBurnerWallet, getBurnerAddress } from './wallet.js';
import { initBurnerWalletUi } from './wallet-ui.js';
import { initMusicPlayerFromDom } from './game/music.js';
import { initOnlinePresence } from './presence.js';

initMusicPlayerFromDom();
initBurnerWalletUi();

const wallet = getBurnerWallet();
const address = getBurnerAddress();

initOnlinePresence({
  walletAddress: address,
  page: document.getElementById('onlineNow') ? 'landing' : 'site',
  badgeEl: document.getElementById('onlineNow'),
});

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const nav = document.querySelector('.nav');
const copyCaBtn = document.getElementById('copyCa');
const contractAddressEl = document.getElementById('contractAddress');

if (copyCaBtn && contractAddressEl) {
  const copyLabel = copyCaBtn.querySelector('.token-ca-copy-label');

  copyCaBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(contractAddressEl.textContent.trim());
    copyCaBtn.classList.add('copied');
      if (copyLabel) copyLabel.textContent = 'Copied!';
    setTimeout(() => {
      copyCaBtn.classList.remove('copied');
      if (copyLabel) copyLabel.textContent = 'Copy CA';
    }, 1500);
  });
}

document.querySelectorAll('.alloc-wallet-copy').forEach((btn) => {
  const label = btn.querySelector('.alloc-wallet-copy-label');
  const addrEl = btn.closest('.alloc-wallet')?.querySelector('.alloc-wallet-addr');

  btn.addEventListener('click', async () => {
    const full = btn.dataset.copyAddress?.trim();
    if (!full) return;

    await navigator.clipboard.writeText(full);
    btn.classList.add('copied');
    if (label) label.textContent = 'Copied!';
    if (addrEl) addrEl.textContent = 'Copied!';

    setTimeout(() => {
      btn.classList.remove('copied');
      if (label) label.textContent = 'Copy';
      if (addrEl) addrEl.textContent = 'GRoW…qpqz';
    }, 1500);
  });
});

if (mobileMenuBtn && nav) {
  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    mobileMenuBtn.classList.toggle('is-open', isOpen);
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      mobileMenuBtn.classList.remove('is-open');
    });
  });
}

document.querySelectorAll('.faq-entry').forEach(entry => {
  entry.addEventListener('toggle', () => {
    if (!entry.open) return;
    document.querySelectorAll('.faq-entry').forEach(other => {
      if (other !== entry) other.open = false;
    });
  });
});

function initGridParallax() {
  const grid = document.querySelector('.bg-grid');
  if (!grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  document.addEventListener('mousemove', (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 16;
    targetY = (e.clientY / window.innerHeight - 0.5) * 16;
  });

  function tick() {
    currentX += (targetX - currentX) * 0.06;
    currentY += (targetY - currentY) * 0.06;
    grid.style.transform = `translate(${currentX}px, ${currentY}px)`;
    requestAnimationFrame(tick);
  }

  tick();
}

initGridParallax();

export { wallet, address };
