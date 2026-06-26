import { isPjaxRoute, normalizePath } from './routes.js';

/** @type {((path: string) => void)|null} */
let onPageSwap = null;

/** @param {{ onPageSwap?: (path: string) => void }} [options] */
export function initClientNavigation(options = {}) {
  onPageSwap = options.onPageSwap ?? null;

  document.addEventListener('click', (event) => {
    const anchor = /** @type {HTMLAnchorElement|null} */ (
      event.target instanceof Element ? event.target.closest('a[href]') : null
    );
    if (!shouldHandle(anchor, event)) return;

    event.preventDefault();
    const path = normalizePath(anchor.getAttribute('href') || '/');
    navigateTo(path);
  });

  window.addEventListener('popstate', () => {
    navigateTo(normalizePath(window.location.pathname), { push: false });
  });
}

/**
 * @param {HTMLAnchorElement|null} anchor
 * @param {MouseEvent} event
 */
function shouldHandle(anchor, event) {
  if (!anchor) return false;
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return false;

  const path = normalizePath(url.pathname);
  if (path === normalizePath(window.location.pathname)) return false;

  return isPjaxRoute(path) && isPjaxRoute(window.location.pathname);
}

/**
 * @param {string} path
 * @param {{ push?: boolean }} [options]
 */
async function navigateTo(path, options = {}) {
  const normalized = normalizePath(path);
  const { push = true } = options;

  if (!isPjaxRoute(normalized)) {
    window.location.href = normalized === '/' ? '/' : normalized;
    return;
  }

  if (normalized === normalizePath(window.location.pathname) && push) return;

  try {
    const response = await fetch(normalized, {
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextPage = doc.querySelector('.page');
    const currentPage = document.querySelector('.page');

    if (!nextPage || !currentPage) {
      window.location.href = normalized;
      return;
    }

    currentPage.replaceWith(nextPage);
    document.title = doc.title;

    if (push) {
      history.pushState({ pjax: true }, '', normalized);
    }

    onPageSwap?.(normalized);
    window.scrollTo(0, 0);
  } catch {
    window.location.href = normalized;
  }
}

/** @param {string} path */
export function updateNavActive(path) {
  const current = normalizePath(path);

  document.querySelectorAll('.nav a').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkPath = normalizePath(href);
    if (link.classList.contains('nav-play-mobile')) {
      link.classList.remove('active');
      return;
    }
    link.classList.toggle('active', linkPath === current);
  });
}
