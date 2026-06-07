// scripts/copy-assets.js
// 把 src/ 下的非 TS 资源（JSON/SQL/HTML/CSS/JS）复制到 dist/
// 跟 local-llm-doctor 同套脚本模式
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC = join(__dirname, '..', 'src');
const DIST = join(__dirname, '..', 'dist');

const EXTENSIONS = ['.json', '.sql', '.html', '.css', '.js', '.svg', '.png'];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

function copyAll() {
  if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
  const files = walk(SRC);
  let count = 0;
  for (const file of files) {
    const rel = relative(SRC, file);
    const dest = join(DIST, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file, dest);
    count++;
  }
  console.log(`[copy-assets] copied ${count} file(s) from src/ to dist/`);
}

copyAll();
