/* Run alongside browser-smoke.js with playwright-core and axe-core installed. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const axe = require('axe-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'], headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.route('https://api.github.com/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.goto(base + '/', { waitUntil: 'load' });
    const shelf = page.locator('[data-ws-reading]');
    await shelf.locator('[data-reading-filter="all"]').waitFor({ state: 'visible' });
    assert.equal(await shelf.locator('.ws-reading-row').count(), 2);
    await page.addScriptTag({ content: axe.source });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const paths = page.locator('.ws-pathways-grid a');
      assert.equal(await paths.count(), 4);
      for (const href of ['#practice', '#reading-title', '#projects', '#resources']) {
        assert.equal(await page.locator('.ws-pathways-grid a[href="' + href + '"]').count(), 1);
        assert.equal(await page.locator(href).count(), 1);
      }
      await page.locator('.ws-pathways').scrollIntoViewIfNeeded();
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
        const pathViolations = await page.evaluate(async () => (await axe.run(document.querySelector('.ws-pathways'))).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ html: n.html, summary: n.failureSummary })) })));
        assert.equal(pathViolations.length, 0, 'pathways accessibility in ' + theme + ': ' + JSON.stringify(pathViolations));
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await paths.first().focus();
      assert.equal(await paths.first().evaluate(el => document.activeElement === el), true);
      for (const filter of ['all', 'blog', 'articles']) {
        await shelf.locator('[data-reading-filter="' + filter + '"]').click();
        assert.equal(await shelf.locator('.ws-reading-row').count(), filter === 'all' ? 2 : 1);
        assert.equal(await shelf.locator('[data-reading-filter="' + filter + '"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        const violations = await page.evaluate(async () => (await axe.run(document.querySelector('[data-ws-reading]'))).violations.map(v => v.id));
        assert.deepEqual(violations, [], 'editorial shelf accessibility');
      }
    }
    await page.evaluate(() => window.I18N.toggle());
    assert.equal(await page.locator('#pathways-title').textContent(), 'What would you like to find?');
    await page.locator('.ws-pathway-practice').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => location.hash), '#practice');
    console.log('Browser pathways and editorial shelf: filters, mobile/desktop overflow and axe OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
