import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const srcDir = 'assets';
const destDir = 'dist/assets';

if (!existsSync('dist')) {
  console.error('copy-static: dist/ not found — run vite build first');
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });

for (const name of readdirSync(srcDir)) {
  const src = join(srcDir, name);
  const dest = join(destDir, name);
  if (statSync(src).isDirectory()) {
    cpSync(src, dest, { recursive: true });
  } else {
    cpSync(src, dest);
  }
}

console.log('copy-static: synced assets/ → dist/assets/');
