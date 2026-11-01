/* Static regression harness for the Workspace rebuild. Zero dependencies, Node >=18. */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const failures = [];
function ok(value, message) { if (value) pass++; else { fail++; failures.push(message); } }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }
function walk(dir, pattern) {
  const output = [];
  for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (!['.git', 'node_modules', '__pycache__'].includes(item.name)) output.push(...walk(relative, pattern));
    } else if (pattern.test(item.name)) output.push(relative.replace(/\\/g, '/'));
  }
  return output;
}
const html = walk('.', /\.html$/);
const contentPages = html;
const stands = html.filter(file => file.startsWith('stands/'));
const cssFiles = walk('assets', /\.css$/);
const jsFiles = walk('assets', /\.js$/);

/* Every public route receives the same shell without replacing SEO/content. */
ok(html.length === 75, 'ожидалось 75 HTML-страниц, получено ' + html.length);
ok(stands.length === 52, 'ожидалось 52 учебных маршрута, получено ' + stands.length);
for (const file of contentPages) {
  const source = read(file);
  ok(source.includes('/assets/workspace-tokens.css?v=20261101r1'), file + ': отсутствуют новые токены');
  ok(source.includes('/assets/workspace.css?v=20261101r1'), file + ': отсутствует новая система компонентов');
  ok(source.includes('/assets/workspace-learning.css?v=20261101r1'), file + ': отсутствуют учебные паттерны LMS');
  ok(source.includes('assets/workspace.js?v=20261101r1'), file + ': отсутствует общий workspace shell');
  ok((source.match(/<main\b/g) || []).length === 1, file + ': ожидался ровно один main');
  ok((source.match(/<h1\b/g) || []).length === 1, file + ': ожидался ровно один H1');
  ok(source.includes('lang="ru"'), file + ': не задан язык документа');
  ok(!/href="[^\"]*(?:site\.css|shared-chrome\.css|soft-shell\.css|tw-(?:compiled|fallback)\.css|stands\.css|ops\.css|office\.css)/.test(source), file + ': подключена прежняя визуальная система');
  ok(source.includes('family=Manrope:') && !source.includes('DM+Serif+Display'), file + ': шрифтовая загрузка не соответствует новой системе');
  ok(!source.includes('class="ambient"') && !source.includes('class="floating-elements"'), file + ': осталась декоративная разметка старого дизайна');
}

/* New token and component contracts. */
const tokens = read('assets/workspace-tokens.css');
const ui = read('assets/workspace.css');
const homeUi = read('assets/workspace-home.css');
const learningUi = read('assets/workspace-learning.css');
const shell = read('assets/workspace.js');
ok(tokens.includes('prefers-reduced-motion'), 'workspace tokens: нет режима reduced motion');
for (const name of ['--ws-canvas', '--ws-surface', '--ws-ink', '--ws-accent', '--ws-space-2', '--ws-space-4', '--ws-space-6', '--ws-space-8', '--ws-r-1', '--ws-r-2', '--ws-r-3', '--ws-r-4', '--ws-shadow-sm', '--ws-shadow-md', '--ws-shadow-lg']) {
  ok(tokens.includes(name), 'workspace tokens: отсутствует ' + name);
}
for (const component of ['.ws-shell', '.ws-sidebar', '.ws-nav-link', '.ws-topbar', '.ws-breadcrumbs', '.ws-search-dialog', '[data-ws-surface]', '[data-ws-action]', '.ws-overlay', '.ws-mode-compact']) {
  ok(ui.includes(component), 'workspace.css: отсутствует контракт ' + component);
}
for (const module of ['.ws-home-hero', '.ws-learning-grid', '.ws-course-card', '.ws-dashboard-grid', '.ws-skill-grid', '.ws-resource-grid', '.ws-experience-grid']) {
  ok(homeUi.includes(module), 'workspace-home.css: отсутствует блок dashboard ' + module);
}
for (const behavior of ['aria-current', 'aria-expanded', 'workspace-rail', 'search-index.json', "event.key.toLowerCase() === 'k'", "event.key === '/'", "event.key === 'Escape'"]) {
  ok(shell.includes(behavior), 'workspace.js: отсутствует функциональный контракт ' + behavior);
}
ok(!shell.includes("mark.textContent = 'i'") && !ui.includes('.ws-brand-mark'), 'в общей навигации остался монограммный I вместо ника');
const homePage = read('index.html');
ok(homePage.includes('Обучаю будущих') && homePage.includes('сети и системное администрирование') && homePage.includes('технологии искусственного интеллекта') && !homePage.includes('Ваше пространство'), 'главная должна спокойно представлять автора и его профессиональные направления');
ok(homePage.indexOf('ws-dashboard-grid') < homePage.indexOf('learning-title'), 'персональный профиль и проекты должны идти до блока пространств');
const learningDirectory = read('stands/index.html');
for (const feature of ['СетьПолис', 'ОфисПолис', 'ДатаПолис', '41', 'ws-learning-hero', 'ws-journey-grid', 'ws-ecosystem-grid']) {
  ok(learningDirectory.includes(feature), 'stands/index.html: отсутствует блок нового каталога ' + feature);
}
ok(learningDirectory.includes('<title>Пространства · itsliventsev</title>') && learningDirectory.includes('<h1 id="learning-title">Пространства</h1>'), 'каталог должен называться «Пространства»');
ok(read('projects.html').includes('ws-project-grid-balanced') && !read('projects.html').includes('ws-project-placeholder'), 'каталог проектов не должен заполняться пустыми заглушками');
ok(ui.includes('[data-ws-article-layout]') && ui.includes('[data-ws-article-content]'), 'workspace.css: отсутствуют стили читабельной статьи');
ok(ui.includes('overflow-x: hidden') && ui.includes('.ws-collapse { inset-inline-end: 9px') && ui.includes('.ws-mode-compact .ws-collapse { inset-block-start: auto'), 'sidebar должна быть без горизонтальной прокрутки, а кнопка — видимой и внутри рейла в обоих режимах');
ok(read('index.html').includes('data-target="5">5</span>') && read('assets/site.js').includes('let current = parseInt(el.textContent, 10) || 0'), 'счётчики профиля не должны показывать временный ноль до прокрутки');
ok(!/\.(?:site-header|site-nav|global-sidebar|hero-title|card|p-card)\b/.test(ui), 'новая система обращается к старым CSS-классам');
ok(!/\.(?:site-header|site-nav|global-sidebar|hero-title|card|p-card)\b/.test(homeUi), 'новый dashboard обращается к старым CSS-классам');
ok(!/\.(?:site-header|site-nav|global-sidebar|hero-title|card|p-card|lab-panel|flat-btn|task-item|q-item|st-topbar)\b/.test(learningUi), 'новые LMS-паттерны обращаются к старым CSS-классам');
for (const obsolete of ['assets/site.css', 'assets/shared-chrome.css', 'assets/soft-shell.css', 'assets/stands.css', 'assets/ops.css', 'assets/office.css', 'assets/tw-compiled.css', 'assets/tw-fallback.css']) {
  ok(!exists(obsolete), 'осталась старая stylesheet-архитектура: ' + obsolete);
}

/* Client-side generated article template and lesson generator must emit the new UI. */
const adminTemplate = read('assets/admin.js');
for (const pathFragment of ['assets/workspace-tokens.css?v=20261101r1', 'assets/workspace.css?v=20261101r1', 'assets/workspace-learning.css?v=20261101r1', 'assets/workspace.js?v=20261101r1']) {
  ok(adminTemplate.includes(pathFragment), 'admin.js: динамический материал не подключает ' + pathFragment);
}
const officeBuilder = read('scripts/build-office.js');
ok(officeBuilder.includes('assets/workspace-tokens.css?v=20261101r1') && officeBuilder.includes('assets/workspace-learning.css?v=20261101r1') && officeBuilder.includes('assets/workspace.js?v=20261101r1'), 'build-office.js: генератор не создаёт страницы на новом shell');
ok(exists('REDESIGN_PLAN.md') && read('REDESIGN_PLAN.md').includes('Workspace / Learning OS'), 'нет плана архитектуры REDESIGN_PLAN.md');

/* Local search, page links, file formats and script syntax. */
let index = [];
try { index = JSON.parse(read('assets/search-index.json')); ok(true); }
catch (error) { ok(false, 'search-index.json невалиден: ' + error.message); }
ok(index.length === 72, 'ожидалось 72 записи в поиске, получено ' + index.length);
const urls = new Set();
for (const item of index) {
  ok(item.title && item.category && item.url?.startsWith('/'), 'неполная запись поискового индекса');
  ok(!urls.has(item.url), 'дублируется URL в поиске: ' + item.url); urls.add(item.url);
}
for (const file of jsFiles) {
  const result = cp.spawnSync('node', ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
  ok(result.status === 0, 'node --check ' + file + ': ' + result.stderr.trim());
}
for (const file of cssFiles) {
  const source = read(file);
  ok((source.match(/{/g) || []).length === (source.match(/}/g) || []).length, file + ': несбалансированные блоки CSS');
}
for (const file of walk('.', /\.json$/)) {
  try { JSON.parse(read(file)); ok(true); } catch (error) { ok(false, file + ': невалидный JSON ' + error.message); }
}
for (const file of html) {
  const source = read(file);
  const refs = [...source.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)].map(match => match[1]);
  for (const ref of refs) {
    if (/['+\s]/.test(ref) || /^https?:|^mailto:|^tel:|^data:|^javascript:/.test(ref)) continue;
    const target = path.normalize(ref.startsWith('/') ? ref.slice(1) : path.join(path.dirname(file), ref));
    ok(exists(target), file + ': локальная ссылка отсутствует: ' + ref);
  }
}

/* Keep interactive learning features and generated content data intact. */
for (const asset of ['dom-kit.js', 'stands.js', 'ops-engine.js', 'ops-hub.js', 'office-engine.js', 'office-hub.js', 'office-kit.js', 'lab-kit.js', 'rewards-page.js', 'standings.js']) {
  ok(exists('assets/' + asset), 'потерян движок учебного пространства: ' + asset);
}
const sitemap = read('sitemap.xml');
ok((sitemap.match(/<loc>[^<]+<\/loc>/g) || []).length === 71, 'ожидалось 71 URL в sitemap.xml');
ok(read('stands/index.html').includes('Три самостоятельные практики'), 'потеряно описание трёх направлений каталога');
ok(read('stands/office/index.html').includes('office-hub.js'), 'потерян хаб ОфисПолис');
ok(read('stands/ops/index.html').includes('ops-hub.js'), 'потерян хаб ДатаПолис');

console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail) { console.error(failures.slice(0, 100).join('\n')); process.exit(1); }
