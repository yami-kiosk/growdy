/**
 * @param {number} n
 * @param {number} [digits]
 */
export function formatNum(n, digits = 1) {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(digits)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(digits)}K`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (abs >= 100) return Math.floor(n).toLocaleString();
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/**
 * @param {number} n
 */
export function formatPct(n) {
  return `${Math.round(n * 100)}%`;
}

/**
 * @param {number} sec
 */
export function formatRunway(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '0s';
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
  return `${Math.floor(sec)}s`;
}
