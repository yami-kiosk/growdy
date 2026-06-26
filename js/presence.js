import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const MIN_VISIBLE = 10;
const PRESENCE_WINDOW_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 45 * 1000;
const POLL_MS = 60 * 1000;

/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let client = null;

function getClient() {
  if (!url || !anonKey) return null;
  if (!client) client = createClient(url, anonKey);
  return client;
}

/** @type {HTMLElement|null} */
let badgeElement = null;
/** @type {(() => Promise<void>)|null} */
let refreshBadgeCount = null;

/**
 * @param {HTMLElement|null} badgeEl
 * @param {number} count
 */
function renderBadge(badgeEl, count) {
  const el = badgeEl ?? badgeElement;
  if (!el) return;

  if (count < MIN_VISIBLE) {
    el.hidden = true;
    return;
  }

  const countEl = el.querySelector('.online-now-count');
  if (countEl) countEl.textContent = String(count);
  el.hidden = false;
}

/**
 * @param {string} walletAddress
 * @param {string} page
 */
async function sendHeartbeat(walletAddress, page) {
  const supabase = getClient();
  if (!supabase || !walletAddress) return;

  await supabase.from('player_presence').upsert(
    {
      wallet_address: walletAddress,
      page,
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'wallet_address' },
  );
}

/** @returns {Promise<number>} */
async function fetchOnlineCount() {
  const supabase = getClient();
  if (!supabase) return 0;

  const cutoff = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('player_presence')
    .select('*', { count: 'exact', head: true })
    .gte('last_seen', cutoff);

  if (error || count == null) return 0;
  return count;
}

/**
 * @param {{ walletAddress: string, page?: string, badgeEl?: HTMLElement|null }} options
 */
export function initOnlinePresence({ walletAddress, page = 'site', badgeEl = null }) {
  const supabase = getClient();
  if (!supabase || !walletAddress) return;

  badgeElement = badgeEl ?? badgeElement;

  let heartbeatTimer = null;
  let pollTimer = null;

  const pulse = () => {
    sendHeartbeat(walletAddress, page);
  };

  const refreshCount = async () => {
    const count = await fetchOnlineCount();
    renderBadge(null, count);
  };

  refreshBadgeCount = refreshCount;

  const startHeartbeat = () => {
    if (heartbeatTimer) return;
    pulse();
    heartbeatTimer = window.setInterval(pulse, HEARTBEAT_MS);
  };

  const stopHeartbeat = () => {
    if (!heartbeatTimer) return;
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  startHeartbeat();
  refreshCount();
  pollTimer = window.setInterval(refreshCount, POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startHeartbeat();
      pulse();
      refreshCount();
    } else {
      stopHeartbeat();
    }
  });

  window.addEventListener('pagehide', stopHeartbeat);
  window.addEventListener('beforeunload', stopHeartbeat);

  return () => {
    stopHeartbeat();
    if (pollTimer) window.clearInterval(pollTimer);
  };
}

export function isPresenceEnabled() {
  return Boolean(getClient());
}

/** @param {HTMLElement|null} badgeEl */
export function setOnlineBadgeElement(badgeEl) {
  badgeElement = badgeEl;
  refreshBadgeCount?.();
}
