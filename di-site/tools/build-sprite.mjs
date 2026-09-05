// Builds assets/icons.svg from Phosphor (regular) — only the icons the pages use. Run after changing the list.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const ICONS = ['x', 'check', 'envelope-simple', 'phone', 'sun', 'moon'];
let out = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">';
for (const name of ICONS) {
  const svg = await readFile(path.join(root, 'tools/node_modules/@phosphor-icons/core/assets/regular', `${name}.svg`), 'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="[^"]*"/g, '').trim();
  out += `<symbol id="i-${name}" viewBox="0 0 256 256">${inner}</symbol>`;
}
out += '</svg>';
await writeFile(path.join(root, 'assets/icons.svg'), out + '\n');
console.log('icons.svg:', ICONS.join(', '));
