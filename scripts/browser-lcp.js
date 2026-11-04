/* Cold LCP measurements, optionally paired with an earlier site at BASELINE_URL.
   The CI uses fresh contexts, a fixed viewport and the same throttling for both.
   This reports measurements, not a pass/fail performance claim. */
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const baseline = process.env.BASELINE_URL;
const args = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = line => { console.log(line); if (process.env.GITHUB_ACTIONS === 'true') console.log('::notice title=LCP::' + line); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args, headless: true });
  async function sample(origin, viewport, route) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
    try {
      await context.addInitScript(() => {
        window.__lcpEntries = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__lcpEntries.push({ time: entry.startTime, element: entry.element?.tagName || '' });
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      // Don't let an external API or an evolving activity snapshot skew comparisons.
      await context.route('https://api.github.com/**', route => route.abort());
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 100, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const response = await page.goto(origin + route, { waitUntil: 'load', timeout: 30000 });
      assert(response && response.ok(), route + ': navigation failed');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => window.__lcpEntries.length > 0, null, { timeout: 10000 });
      await page.waitForTimeout(1500);
      const entry = await page.evaluate(() => window.__lcpEntries.at(-1));
      assert(Number.isFinite(entry.time) && entry.time > 0, route + ': no LCP');
      return entry;
    } finally { await context.close(); }
  }
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      // Alternate order to limit bias from a warming runner. No shared browser cache.
      if (baseline) {
        const before = [], after = [];
        for (let i = 0; i < 3; i++) {
          for (const [label, origin] of (i % 2 ? [['after', base], ['before', baseline]] : [['before', baseline], ['after', base]])) {
            (label === 'before' ? before : after).push((await sample(origin, viewport, '/')).time);
          }
        }
        report(`LCP ${viewport.width}px / baseline ms [${before.map(Math.round).join(', ')}], current ms [${after.map(Math.round).join(', ')}]; median ${Math.round(median(before))} → ${Math.round(median(after))} ms`);
      } else {
        const value = await sample(base, viewport, '/');
        report(`LCP ${viewport.width}px / current: ${Math.round(value.time)} ms (${value.element}), no baseline`);
      }
      for (const route of ['/blog/kn-dns.html', '/stands/lab-vlan-cisco.html', '/projects/esports.html']) {
        const value = await sample(base, viewport, route);
        report(`LCP ${viewport.width}px ${route}: ${Math.round(value.time)} ms (${value.element})`);
      }
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
