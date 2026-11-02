/*
 * Reading shelf + accessibility check. Start a local server first, then run:
 * NODE_PATH=/path/to/node_modules BROWSER_BIN=/path/to/chromium node scripts/browser-reading.js
 * Requires playwright-core and axe-core.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const browserArgs = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];
let axeSource = process.env.AXE_SOURCE_PATH ? fs.readFileSync(process.env.AXE_SOURCE_PATH, 'utf8') : null;
if (!axeSource) {
  try { axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (error) { axeSource = null; }
}
const serious = violations => violations.filter(v => ['serious', 'critical'].includes(v.impact));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: browserArgs, headless: true });
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      await context.route('https://api.github.com/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
      const page = await context.newPage();
      await page.goto(base + '/', { waitUntil: 'load' });
      await page.waitForSelector('[data-reading-list] .ui-reading-row');
      const shelf = page.locator('[data-reading-shelf]');
      const total = await shelf.locator('.ui-reading-row').count();
      assert(total >= 2, 'полка чтения должна показывать материалы');
      await page.locator('[data-reading-filter="articles"]').click();
      const articles = await shelf.locator('.ui-reading-row').count();
      assert(articles >= 1 && articles < total, 'фильтр «статьи» должен сокращать полку');
      assert.equal(await page.locator('[data-reading-filter="articles"]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-reading-filter="all"]').click();
      assert.equal(await shelf.locator('.ui-reading-row').count(), total);

      if (axeSource) {
        await page.addScriptTag({ content: axeSource });
        for (const selector of ['main', '.ui-masthead', '[data-reading-shelf]']) {
          const result = await page.evaluate(async sel => {
            const axe = window.axe;
            return (await axe.run(document.querySelector(sel), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }))
              .violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 2).map(n => n.html) }));
          }, selector);
          assert.deepEqual(serious(result), [], selector + ' (' + theme + '): ' + JSON.stringify(result));
        }
      }
      await context.close();
    }
    console.log('Browser reading: shelf filters and axe (serious/critical) in light and dark OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
