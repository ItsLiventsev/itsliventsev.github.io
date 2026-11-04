/* Check the first screen while non-critical sheets are deliberately stalled. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const args = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];
const capture = () => {
  const selectors = ['.home-hero', '.home-hero h1', '.home-lede', '.home-actions', '.home-stats', '.home-stats li'];
  return Object.fromEntries(selectors.map((selector) => {
    const element = document.querySelector(selector), style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return [selector, { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      display: style.display, color: style.color, background: style.backgroundColor, fontSize: style.fontSize, lineHeight: style.lineHeight }];
  }));
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args, headless: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      for (const colorScheme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport, colorScheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        try {
          await context.route('**/assets/fonts/**', route => route.abort()); // eliminate font swapping from the comparison
          await context.route(/\/assets\/(?:tokens|pages|home)\.css(?:\?.*)?$/, async route => { await pending; await route.continue(); });
          const page = await context.newPage();
          await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('body.ui-ready');
          const before = await page.evaluate(capture);
          release();
          await page.waitForFunction(() => [...document.querySelectorAll('link[onload]')].every(link => link.media === 'all'));
          const after = await page.evaluate(capture);
          for (const selector of Object.keys(before)) {
            for (const prop of Object.keys(before[selector])) {
              const a = before[selector][prop], b = after[selector][prop];
              if (typeof a === 'number') assert(Math.abs(a - b) <= 1, `${viewport.width} ${colorScheme} ${selector} ${prop}: ${a} → ${b}`);
              else assert.equal(a, b, `${viewport.width} ${colorScheme} ${selector} ${prop}`);
            }
          }
          console.log(`Critical CSS: ${viewport.width}px ${colorScheme}, hero before/after styles match`);
        } finally { release(); await context.close(); }
      }
      // The noscript stylesheets must restore the complete appearance without JS.
      const context = await browser.newContext({ viewport, javaScriptEnabled: false, serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        await page.goto(base + '/', { waitUntil: 'load' });
        assert.equal(await page.locator('.home-stats').evaluate(el => getComputedStyle(el).display), 'grid');
        assert.equal(await page.locator('.home-paths').evaluate(el => getComputedStyle(el).display), 'grid');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
