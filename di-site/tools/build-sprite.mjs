// Builds assets/icons.svg from Phosphor (regular) — only the icons the pages use. Run after changing the list.
// An entry [name, 'fill'] takes the solid weight instead: the strip's pause and play (2026-10-16), which sit small on a
// photograph and read as shapes, as Apple's do, where the outlined weight thinned to two hairlines.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const ICONS = ['x', 'check', 'envelope-simple', 'phone', 'sun', 'moon', 'arrow-left', 'arrow-right', 'list', ['pause', 'fill'], ['play', 'fill']];
let out = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">';
for (const entry of ICONS) {
  const [name, weight] = Array.isArray(entry) ? entry : [entry, 'regular'];
  const file = weight === 'regular' ? `${name}.svg` : `${name}-${weight}.svg`;
  const svg = await readFile(path.join(root, 'tools/node_modules/@phosphor-icons/core/assets', weight, file), 'utf8');
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="[^"]*"/g, '').trim();
  out += `<symbol id="i-${name}" viewBox="0 0 256 256">${inner}</symbol>`;
}
out += '</svg>';
await writeFile(path.join(root, 'assets/icons.svg'), out + '\n');
console.log('icons.svg:', ICONS.map(e => [].concat(e).join('/')).join(', '));
