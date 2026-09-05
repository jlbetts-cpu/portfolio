import { chromium } from '/tmp/claude-0/-home-user/79ec7a48-7fc9-53b7-8531-63853d88b158/scratchpad/pw/node_modules/playwright/index.mjs';
export const URL = process.env.DI_URL || 'http://127.0.0.1:4611/index.html';
export const VIEWPORTS = [[1440, 900], [1512, 850], [1280, 720], [1024, 768], [1920, 1080], [390, 844], [320, 640]];
export async function browser() { return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
export async function open(b, w, h, opts = {}) {
  const pg = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  await pg.goto(URL); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await pg.waitForTimeout(600);
  return pg;
}
export function report(name, ok, detail) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) process.exitCode = 1; }
