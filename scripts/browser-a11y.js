/*
 * Accessibility gate for the whole site (U-10).
 *
 * Раньше axe запускался только на полке чтения и в нескольких страницах, а
 * остальные 120+ маршрутов не проверялись вовсе: сломанный заголовок, пустая
 * кнопка или невидимый в тёмной теме текст жили до чьей-то жалобы.
 *
 * Что делает:
 *   1. обходит все контентные страницы (редиректы-заглушки пропускает);
 *   2. ждёт, пока оболочка и движки стендов дорисуют разметку (body.ui-ready);
 *   3. прогоняет axe по WCAG 2.0/2.1/2.2 A и AA;
 *   4. повторяет прогон в тёмной теме на выборке страниц — палитра вторая, и
 *      контраст в ней проверяется отдельно.
 *
 * Гейт: `serious` и `critical` валят сборку. `moderate` и `minor` печатаются
 * как отчёт (это, как правило, best practice вроде «все ссылки в ориентирах»),
 * чтобы гейт не краснел от стилистики.
 *
 * Запуск: python3 -m http.server 8000 & затем
 *   NODE_PATH=/path/to/node_modules BROWSER_BIN=/path/to/chromium node scripts/browser-a11y.js
 * Флаги: --page=/blog/kn-vlan.html (одна страница), --limit=10, --json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const browserArgs = process.env.BROWSER_ARGS ? JSON.parse(process.env.BROWSER_ARGS) : ['--no-sandbox'];
const only = (process.argv.find(arg => arg.startsWith('--page=')) || '').split('=')[1];
const limit = Number((process.argv.find(arg => arg.startsWith('--limit=')) || '').split('=')[1] || 0);
const asJson = process.argv.includes('--json');
const BLOCKING = new Set(['serious', 'critical']);

function axeSource() {
  if (process.env.AXE_SOURCE_PATH) return fs.readFileSync(process.env.AXE_SOURCE_PATH, 'utf8');
  return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
}

/* Все страницы, кроме редиректов: они не показывают свой интерфейс. */
function contentPages() {
  const pages = [];
  (function walk(dir) {
    for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (['.git', 'node_modules', '__pycache__', '.arena'].includes(item.name)) continue;
      const relative = dir === '.' ? item.name : dir + '/' + item.name;
      if (item.isDirectory()) walk(relative);
      else if (/\.html$/.test(item.name)) {
        const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
        if (!/http-equiv="refresh"/i.test(source)) pages.push('/' + relative);
      }
    }
  })('.');
  return pages.sort();
}

/* Тёмная тема — не только «другая палитра»: проверяем и системную тему,
   которую shell.js включает по prefers-color-scheme. */
const DARK_SAMPLE = [
  '/', '/blog.html', '/blog/kn-vlan.html', '/blog/graph.html', '/projects.html',
  '/articles.html', '/archive.html', '/faq.html', '/sitemap.html',
  '/stands/index.html', '/stands/setpolis.html', '/stands/league.html',
  '/stands/lab-vlan-cisco.html', '/stands/office/index.html', '/stands/ops/index.html',
  '/stands/ops/ops-web.html', '/stands/glossary.html',
];

async function scan(page, path, theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.dataset.uiReady === 'true', null, { timeout: 8000 }).catch(() => {});
  const result = await page.evaluate(async () => {
    const run = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return {
      violations: run.violations.map(item => ({
        id: item.id,
        impact: item.impact,
        help: item.help,
        helpUrl: item.helpUrl,
        nodes: item.nodes.slice(0, 4).map(node => ({ target: node.target.join(' '), html: node.html.slice(0, 120) })),
        count: item.nodes.length,
      })),
    };
  });
  return result.violations;
}

(async () => {
  const pages = only ? [only] : contentPages();
  const list = limit ? pages.slice(0, limit) : pages;
  /* Гейт, который ничего не проверил, — хуже отсутствия гейта: молчаливое
     «0 страниц, 0 нарушений» выглядит как успех. */
  if (!list.length || (!only && !limit && list.length < 100)) {
    console.error('a11y: список страниц подозрительно мал (' + list.length + ') — проверьте ROOT и запуск');
    process.exit(1);
  }
  const axe = axeSource();
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_BIN, args: browserArgs, headless: true });
  const report = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
    await context.addInitScript({ content: axe });
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.dismiss());
    page.on('pageerror', () => {});

    for (const route of list) {
      report.push({ route, theme: 'light', violations: await scan(page, route, 'light') });
    }
    const darkRoutes = only ? [] : DARK_SAMPLE.filter(route => pages.includes(route));
    for (const route of darkRoutes) {
      report.push({ route, theme: 'dark', violations: await scan(page, route, 'dark') });
    }
  } finally {
    await browser.close();
  }

  const blocking = report.flatMap(entry => entry.violations.filter(item => BLOCKING.has(item.impact)).map(item => ({ ...item, route: entry.route, theme: entry.theme })));
  const advisory = report.flatMap(entry => entry.violations.filter(item => !BLOCKING.has(item.impact)).map(item => ({ ...item, route: entry.route, theme: entry.theme })));
  const byRule = new Map();
  for (const item of report.flatMap(entry => entry.violations.map(violation => ({ ...violation, theme: entry.theme })))) {
    const key = item.id + ' · ' + item.impact;
    if (!byRule.has(key)) byRule.set(key, { nodes: 0, help: item.help });
    byRule.get(key).nodes += item.count;
  }

  /* Полный отчёт кладём рядом с логом: аннотация CI обрезает узлы, а разбираться
     с контрастом нужно по конкретному селектору и цвету. */
  if (!asJson) {
    fs.writeFileSync(path.join(ROOT, 'a11y-report.json'), JSON.stringify({ pages: list.length, blocking, advisory }, null, 1));
  }

  if (asJson) {
    console.log(JSON.stringify({ pages: list.length, dark: report.filter(entry => entry.theme === 'dark').length, blocking, advisory }, null, 1));
  } else {
    for (const [key, info] of [...byRule.entries()].sort((a, b) => b[1].nodes - a[1].nodes)) {
      console.log(key.padEnd(46) + ' узлов: ' + String(info.nodes).padStart(3) + ' · ' + info.help);
    }
    if (advisory.length) {
      const seen = new Set();
      for (const item of advisory.slice(0, 8)) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        console.log('  совет: ' + item.id + ' [' + item.impact + '] ' + item.route + ' (' + item.theme + ') — ' + (item.nodes[0] ? item.nodes[0].target : ''));
      }
    }
    for (const item of blocking.slice(0, 12)) {
      console.log('\n✗ ' + item.id + ' [' + item.impact + '] ' + item.route + ' (' + item.theme + ') — ' + item.help + '\n    ' + item.helpUrl);
      for (const node of item.nodes) console.log('    ' + node.target + '  » ' + node.html);
    }
    console.log('\na11y: ' + list.length + ' страниц светлой темы + ' + report.filter(entry => entry.theme === 'dark').length
      + ' тёмной · блокирующих нарушений: ' + blocking.length + ' · советы: ' + advisory.length);
  }

  if (blocking.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
