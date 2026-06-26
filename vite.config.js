import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

const CLEAN_ROUTES = {
  '/game': '/game.html',
  '/token': '/tokenomics.html',
  '/faq': '/faq.html',
  '/about': '/about.html',
  '/gameplay': '/how-to-play.html',
  '/roadmap': '/roadmap.html',
};

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        game: resolve(root, 'game.html'),
        tokenomics: resolve(root, 'tokenomics.html'),
        faq: resolve(root, 'faq.html'),
        about: resolve(root, 'about.html'),
        'how-to-play': resolve(root, 'how-to-play.html'),
        roadmap: resolve(root, 'roadmap.html'),
      },
    },
  },
  plugins: [
    {
      name: 'growdy-clean-urls',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (!req.url || req.method !== 'GET') return next();

          const [pathname, search = ''] = req.url.split('?');
          const cleanPath = pathname.replace(/\/$/, '') || '/';
          const target = CLEAN_ROUTES[cleanPath];

          if (target) {
            req.url = search ? `${target}?${search}` : target;
          }

          next();
        });
      },
    },
  ],
});
