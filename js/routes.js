/** @type {Record<string, string>} */
export const ROUTE_FILES = {
  '/': 'index.html',
  '/game': 'game.html',
  '/token': 'tokenomics.html',
  '/faq': 'faq.html',
  '/about': 'about.html',
  '/gameplay': 'how-to-play.html',
  '/roadmap': 'roadmap.html',
};

/** @type {Record<string, string>} */
export const FILE_ROUTES = Object.fromEntries(
  Object.entries(ROUTE_FILES).map(([route, file]) => [file, route]),
);

/** Pages that share main.js and support in-place navigation (music keeps playing). */
export const PJAX_ROUTES = new Set(['/', '/token', '/faq', '/about', '/gameplay', '/roadmap']);

/** @param {string} pathOrFile */
export function normalizePath(pathOrFile) {
  const raw = pathOrFile.split('?')[0].split('#')[0] || '/';
  if (raw.endsWith('.html')) {
    const file = raw.startsWith('/') ? raw.slice(1) : raw;
    return FILE_ROUTES[file] ?? raw;
  }
  if (raw === '' || raw === '/') return '/';
  return raw.replace(/\/$/, '') || '/';
}

/** @param {string} path */
export function isPjaxRoute(path) {
  return PJAX_ROUTES.has(normalizePath(path));
}
