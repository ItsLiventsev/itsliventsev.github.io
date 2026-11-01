/* Static regression harness for SOFT SHELL. Zero deps; run with Node >=18. */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION = '20261031bf';
let pass = 0, fail = 0;
const failures = [];
function ok(condition, message) { if (condition) pass++; else { fail++; failures.push(message); } }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function walk(dir, pattern) {
  const result = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', '__pycache__'].includes(entry.name)) result.push(...walk(rel, pattern));
    } else if (pattern.test(entry.name)) result.push(rel.replace(/\\/g, '/'));
  }
  return result;
}
const html = walk('.', /\.html$/);
const pages = html.filter(file => file !== 'projects/glossary.html');
const stands = html.filter(file => file.startsWith('stands/'));
const cssFiles = walk('assets', /\.css$/);
const jsFiles = walk('assets', /\.js$/);

/* Inventory + shared shell coverage. */
ok(html.length === 75, 'ожидалось 75 HTML-страниц, получено ' + html.length);
ok(stands.length === 52, 'ожидалось 52 страницы учебных практик, получено ' + stands.length);
for (const file of pages) {
  const source = read(file);
  ok(source.includes('/assets/soft-shell.css?v=20261101'), file + ': нет общей визуальной системы');
  ok(source.includes('/assets/soft-shell.js?v=20261101'), file + ': нет общего shell JS');
  ok((source.match(/<main\b/g) || []).length === 1, file + ': ожидался один main');
  ok((source.match(/<h1\b/g) || []).length === 1, file + ': ожидался один H1');
  ok(source.includes('lang="ru"'), file + ': не задан язык документа');
  ok(source.includes('skip-link') && source.includes('href="#main-content"'), file + ': нет skip link');
  ok(source.includes('meta name="theme-color"'), file + ': нет theme-color');
  ok(!source.includes('#11151b'), file + ': theme-color тёмной темы не синхронизирован');
  ok(source.includes('family=Manrope:') && source.includes('family=DM+Serif+Display'), file + ': нет новых гарнитур Manrope / DM Serif Display');
  ok(!/family=(?:Golos\+Text|Source\+Serif\+4|Unbounded)/.test(source), file + ': осталась устаревшая гарнитура');
  ok(!/class="(?:ambient|bg-glyphs|giant-word)|id="title-mark"/.test(source) && !source.includes('~/itsliventsev'), file + ': осталась терминальная декорация/маркер');
  ok(source.split('/assets/soft-shell.css?v=20261101').length === 2, file + ': soft-shell.css подключён не ровно один раз');
  ok(source.split('/assets/soft-shell.js?v=20261101').length === 2, file + ': soft-shell.js подключён не ровно один раз');
}

/* Styles: final tokens, component contracts, breakpoints, keyboard and motion. */
const shellCss = read('assets/soft-shell.css');
const shellJs = read('assets/soft-shell.js');
const adminTemplate = read('assets/admin.js');
ok(adminTemplate.includes('family=Manrope:') && adminTemplate.includes('family=DM+Serif+Display'), 'admin.js: динамические статьи используют старые шрифты');
ok(adminTemplate.includes('assets/soft-shell.css?v=20261101') && adminTemplate.includes('assets/soft-shell.js?v=20261101'), 'admin.js: динамическим статьям не подключён общий shell');
ok(!adminTemplate.includes('class="ambient"') && !adminTemplate.includes('family=Golos+Text') && !adminTemplate.includes('#11151b'), 'admin.js: остался старый стиль/тема в динамических статьях');
for (const token of [
  '--bg: #f4f6fa;', '--surface: #fff;', '--accent: #5868c8;',
  '--radius: 20px;', '--radius-lg: 26px;', '--shadow-card:', '--shadow-hover:',
  '--font-sans: \'Manrope\'', '--font-display: \'DM Serif Display\''
]) ok(shellCss.includes(token), 'soft-shell.css: отсутствует токен ' + token);
for (const contract of [
  '.global-sidebar', '.global-sidebar-link[aria-current="page"]', '.sidebar-collapsed',
  '.global-sidebar-overlay', '.bento-home > .hero', '.site-search-dialog',
  '.prose-neo .toc-link', '::selection', 'prefers-reduced-motion',
  '@media (max-width: 959px)', 'translateY(-3px)', 'scale(.97)'
]) ok(shellCss.includes(contract), 'soft-shell.css: отсутствует UI-контракт ' + contract);
for (const contract of [
  'global-sidebar-nav', 'aria-current', 'aria-expanded', 'setSidebar',
  "event.key === 'Escape'", "event.key.toLowerCase() === 'k'",
  "event.key === '/'", '/assets/search-index.json'
]) ok(shellJs.includes(contract), 'soft-shell.js: отсутствует навигационный контракт ' + contract);

/* Local search index — root-relative links work both on GitHub Pages and preview. */
let searchIndex;
try { searchIndex = JSON.parse(read('assets/search-index.json')); ok(true); }
catch (error) { searchIndex = []; ok(false, 'search-index.json невалиден: ' + error.message); }
ok(searchIndex.length === 72, 'ожидалось 72 документа в поиске, получено ' + searchIndex.length);
const searchUrls = new Set();
for (const record of searchIndex) {
  ok(record.title && record.url && record.url.startsWith('/') && record.category, 'неполная запись локального поискового индекса');
  ok(!searchUrls.has(record.url), 'повтор URL в индексе: ' + record.url);
  searchUrls.add(record.url);
}
ok(!searchIndex.some(record => /admin|404|glossary переехал/i.test(record.title)), 'в поиске есть служебный экран/редирект');

/* Validate script syntax, balanced CSS, JSON, and local links. */
for (const file of jsFiles) {
  const result = cp.spawnSync('node', ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
  ok(result.status === 0, 'node --check ' + file + ': ' + result.stderr.trim());
}
for (const file of cssFiles) {
  const source = read(file);
  ok((source.match(/{/g) || []).length === (source.match(/}/g) || []).length, file + ': несбалансированные CSS-блоки');
}
for (const file of walk('.', /\.json$/)) {
  try { JSON.parse(read(file)); ok(true); }
  catch (error) { ok(false, file + ': невалидный JSON ' + error.message); }
}
for (const file of html) {
  const source = read(file);
  const refs = [...source.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)].map(match => match[1]);
  for (const ref of refs) {
    if (/['+\\s]/.test(ref) || /^https?:|^mailto:|^tel:|^data:/.test(ref)) continue;
    const target = path.normalize(ref.startsWith('/') ? ref.slice(1) : path.join(path.dirname(file), ref));
    ok(exists(target), file + ': локальная ссылка не существует: ' + ref);
  }
}

/* Product behavior that the visual refresh must not regress. */
const domPages = html.filter(file => read(file).includes('dom-kit.js'));
ok(domPages.length === 52, 'ожидалось 52 страницы с dom-kit, получено ' + domPages.length);
ok(read('assets/dom-kit.js').includes('window.DOMKIT') || read('assets/dom-kit.js').includes('DOMKIT'), 'dom-kit отсутствует');
for (const engine of ['stands.js', 'ops-engine.js', 'ops-hub.js', 'office-engine.js', 'office-hub.js', 'rewards-page.js', 'standings.js']) {
  ok(exists('assets/' + engine), 'потерян учебный движок assets/' + engine);
}
for (const file of stands) {
  const source = read(file);
  ok(source.includes('data-theme') || source.includes('theme-toggle'), file + ': не сохранено управление темой');
  ok(!/<a\s[^>]*href="https?:/.test(source), file + ': внешняя ссылка внутри учебного интерфейса');
}
const sitemap = read('sitemap.xml');
const sitemapUrls = (sitemap.match(/<loc>[^<]+<\/loc>/g) || []);
ok(sitemapUrls.length === 71, 'ожидалось 71 URL в sitemap.xml, получено ' + sitemapUrls.length);
ok(read('stands/index.html').includes('uni-flow'), 'потерян обзорный поток учебных вселенных');
ok(read('stands/office/index.html').includes('office-hub.js'), 'ОфисПолис потерял hub-движок');
ok(read('stands/ops/index.html').includes('ops-hub.js'), 'ДатаПолис потерял hub-движок');
ok(read('AUDIT_REPORT.md').includes('полная пересборка интерфейса'), 'аудит не обновлён');
ok(read('docs/design-system.md').includes('Soft Shell / 2026') && read('docs/design-system.md').includes('Sidebar'), 'дизайн-система не обновлена');

console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail) { console.log(failures.slice(0, 60).join('\\n')); process.exit(1); }
