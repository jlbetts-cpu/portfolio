import { chromium } from '/tmp/claude-0/-home-user/79ec7a48-7fc9-53b7-8531-63853d88b158/scratchpad/pw/node_modules/playwright/index.mjs';
export const URL = process.env.DI_URL || 'http://127.0.0.1:4611/index.html';
export const VIEWPORTS = [[1440, 900], [1512, 850], [1280, 720], [1024, 768], [1920, 1080], [390, 844], [320, 640]];
export async function browser() { return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
export async function open(b, w, h, opts = {}) {
  const pg = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  // the newsletter popup opens by itself after 40% scroll and ten seconds, once a session, and sits over the page; every gate but the dialog gate starts with it already shown
  if (!opts.popup) await pg.addInitScript(() => { try { sessionStorage.setItem('di:nl-shown', '1'); } catch {} });
  // the theme is read from localStorage before first paint, so a gate that wants dark must set it before the page loads
  if (opts.theme) await pg.addInitScript((t) => { try { localStorage.setItem('di:theme', t); } catch {} }, opts.theme);
  // the curtain covers the page for the first second and locks scrolling while it is up; every gate but its own starts past it
  if (!opts.curtain) await pg.addInitScript(() => { try { sessionStorage.setItem('di:curtain', '1'); } catch {} });
  await pg.goto(URL); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await pg.waitForTimeout(600);
  return pg;
}
export function report(name, ok, detail) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) process.exitCode = 1; }
