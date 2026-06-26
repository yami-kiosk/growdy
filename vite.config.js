import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

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
});
