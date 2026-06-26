import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const STORAGE_KEY = 'growdy_burner_wallet';

/** @type {Keypair|null} */
let cachedWallet = null;

/** Solana mainnet — $GROWDY mint (same as tokenomics page). */
export const GROWDY_MINT = 'HMJKARkqpNxKfxF6kAayrGCBozcupHX3GrZ8bhvWpuMp';

/** Public mainnet RPCs — no API key required (browser-safe reads). */
const RPC_URLS = [
  'https://solana-rpc.publicnode.com',
  'https://rpc.solanatracker.io/public',
  'https://solana.api.onfinality.io/public',
  'https://api.mainnet-beta.solana.com',
];

/** @param {unknown} err */
function toFriendlyRpcError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/403|api key|not allowed|unauthorized/i.test(raw)) {
    return 'RPC provider blocked the request. Retrying another node…';
  }
  if (/429|rate limit|too many/i.test(raw)) {
    return 'RPC rate limit hit. Wait a moment and tap Refresh.';
  }
  if (/fetch failed|network|timeout/i.test(raw)) {
    return 'Network error. Check your connection and try Refresh.';
  }
  return 'Could not load on-chain balance. Tap Refresh to retry.';
}

/** @returns {Keypair|null} */
function loadStoredKeypair() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const { secretKey } = parsed;
    if (!Array.isArray(secretKey) || secretKey.length !== 64) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const bytes = Uint8Array.from(secretKey);
    const keypair = Keypair.fromSecretKey(bytes);
    if (keypair.publicKey.toBase58().length < 32) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return keypair;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/** @param {Keypair} keypair */
function persistKeypair(keypair) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ secretKey: Array.from(keypair.secretKey) }),
  );
}

/** Get or create the browser burner wallet (single instance per page). */
export function getBurnerWallet() {
  if (cachedWallet) return cachedWallet;

  const stored = loadStoredKeypair();
  if (stored) {
    cachedWallet = stored;
    return cachedWallet;
  }

  const keypair = Keypair.generate();
  persistKeypair(keypair);
  cachedWallet = keypair;
  return cachedWallet;
}

export function getBurnerAddress() {
  return getBurnerWallet().publicKey.toBase58();
}

/** Base58 secret key — import into Phantom / Solflare. */
export function exportSecretKeyBase58() {
  return bs58.encode(getBurnerWallet().secretKey);
}

/** JSON byte array — matches localStorage backup format. */
export function exportSecretKeyJson() {
  return JSON.stringify(Array.from(getBurnerWallet().secretKey));
}

export function formatAddress(address, chars = 4) {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/** @param {number|null|undefined} amount */
export function formatGrowdyAmount(amount) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  if (amount === 0) return '0';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 10_000) return `${Math.round(amount).toLocaleString('en-US')}`;
  if (amount >= 1) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return amount.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/**
 * @typedef {Object} WalletBalances
 * @property {number|null} growdyOnChain
 * @property {number|null} sol
 * @property {'ok'|'error'} status
 * @property {string} [error]
 */

/** @param {string} [ownerAddress] @returns {Promise<WalletBalances>} */
export async function fetchWalletBalances(ownerAddress = getBurnerAddress()) {
  const result = /** @type {WalletBalances} */ ({
    growdyOnChain: null,
    sol: null,
    status: 'ok',
  });

  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(GROWDY_MINT);
  /** @type {Error|null} */
  let lastError = null;

  for (const rpcUrl of RPC_URLS) {
    try {
      const connection = new Connection(rpcUrl, 'confirmed');

      const [solLamports, tokenAccounts] = await Promise.all([
        connection.getBalance(owner, 'confirmed'),
        connection.getParsedTokenAccountsByOwner(owner, { mint }, 'confirmed'),
      ]);

      result.sol = solLamports / 1e9;

      if (tokenAccounts.value.length > 0) {
        const info = tokenAccounts.value[0].account.data.parsed?.info;
        const ui = info?.tokenAmount?.uiAmount;
        result.growdyOnChain = typeof ui === 'number' ? ui : Number(info?.tokenAmount?.uiAmountString ?? 0);
      } else {
        result.growdyOnChain = 0;
      }

      return result;
    } catch (err) {
      lastError = new Error(toFriendlyRpcError(err));
    }
  }

  result.status = 'error';
  result.error = lastError?.message ?? 'Could not load on-chain balance. Tap Refresh to retry.';
  return result;
}
