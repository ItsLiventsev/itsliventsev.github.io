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
// The standalone offline fallback must work without the workspace shell.
const contentPages = html.filter(file => file !== 'assets/offline.html');
const stands = html.filter(file => file.startsWith('stands/'));
const cssFiles = walk('assets', /\.css$/);
const jsFiles = walk('assets', /\.js$/);

/* Every public route receives the same shell without replacing SEO/content. */
ok(contentPages.length === 76, 'ожидалось 76 HTML-страниц, получено ' + contentPages.length);
ok(exists('assets/offline.html'), 'нет автономной страницы для офлайн-перехода');
ok(stands.length === 52, 'ожидалось 52 учебных маршрута, получено ' + stands.length);
for (const file of contentPages) {
  const source = read(file);
  ok(source.includes('/assets/workspace-tokens.css?v=20261101r4'), file + ': отсутствуют новые токены');
  ok(source.includes('/assets/workspace.css?v=20261101r6'), file + ': отсутствует новая система компонентов');
  ok(source.includes('/assets/workspace-learning.css?v=20261101r6'), file + ': отсутствуют учебные паттерны LMS');
  ok(source.includes('assets/workspace.js?v=20261101r6'), file + ': отсутствует общий workspace shell');
  ok((source.match(/<main\b/g) || []).length === 1, file + ': ожидался ровно один main');
  ok((source.match(/<h1\b/g) || []).length === 1, file + ': ожидался ровно один H1');
  ok(source.includes('lang="ru"'), file + ': не задан язык документа');
  ok(source.includes('skip-link'), file + ': нет ссылки перехода к основному содержимому');
  ok(/<nav\b/.test(source), file + ': нет семантического элемента навигации');
  if (file !== 'projects/glossary.html') ok(/<time\b[^>]*data-footer-updated/.test(source), file + ': нет семантической даты обновления');
  for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    ok(/\balt="/.test(tag) && /\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag) && /\bloading="lazy"/.test(tag), file + ': изображению нужны alt, размеры и lazy loading');
  }
  ok(!/href="[^\"]*(?:site\.css|shared-chrome\.css|soft-shell\.css|tw-(?:compiled|fallback)\.css|stands\.css|ops\.css|office\.css)/.test(source), file + ': подключена прежняя визуальная система');
  ok(source.includes('/assets/fonts/manrope-cyrillic-wght-normal.woff2') && !source.includes('fonts.googleapis.com') && !source.includes('DM+Serif+Display'), file + ': локальные шрифты не подключены или осталась внешняя загрузка Google Fonts');
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
function tokenColor(name) { return tokens.match(new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})'))?.[1]; }
function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(a, b) { const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l1 + .05) / (l2 + .05); }
for (const [fg, bg] of [['--ws-ink','--ws-canvas'],['--ws-ink-soft','--ws-canvas'],['--ws-muted','--ws-canvas'],['--ws-faint','--ws-canvas'],['--ws-accent','--ws-canvas'],['--ws-green','--ws-green-wash'],['--ws-blue','--ws-blue-wash'],['--ws-orange','--ws-orange-wash'],['--ws-red','--ws-red-wash']]) {
  const a = tokenColor(fg), b = tokenColor(bg); ok(a && b && contrast(a, b) >= 4.5, 'контраст пары ' + fg + ' / ' + bg + ' ниже WCAG AA');
}
const darkStart = tokens.indexOf(':root[data-theme="dark"]');
const darkEnd = tokens.indexOf('}', darkStart);
const darkTokens = darkStart >= 0 && darkEnd > darkStart ? tokens.slice(darkStart, darkEnd) : '';
const darkColor = name => darkTokens.match(new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})'))?.[1];
ok(darkColor('--ws-faint') && darkColor('--ws-surface') && contrast(darkColor('--ws-faint'), darkColor('--ws-surface')) >= 4.5, 'тёмный faint-текст должен сохранять контраст WCAG AA');
for (const component of ['.ws-shell', '.ws-sidebar', '.ws-nav-link', '.ws-topbar', '.ws-breadcrumbs', '.ws-search-dialog', '[data-ws-surface]', '[data-ws-action]', '.ws-overlay', '.ws-mode-compact']) {
  ok(ui.includes(component), 'workspace.css: отсутствует контракт ' + component);
}
for (const module of ['.ws-home-hero', '.ws-learning-grid', '.ws-course-card', '.ws-dashboard-grid', '.ws-skill-grid', '.ws-resource-grid', '.ws-experience-grid']) {
  ok(homeUi.includes(module), 'workspace-home.css: отсутствует блок dashboard ' + module);
}
for (const hook of ['data-ws-profile-gate', 'data-ws-profile-form', 'data-ws-dashboard-grid', 'data-ws-id-card', 'data-ws-quest-card', 'data-ws-greeting']) {
  ok(shell.includes(hook) && learningUi.includes('[' + hook + ']'), 'кабинет стажёра не размечен новыми компонентными токенами: ' + hook);
}
ok(read('stands/setpolis.html').includes('role="group" aria-labelledby="mascot-label"') && read('stands/setpolis.html').includes('assets/stands.js?v=20261101r4'), 'выбор маскота должен иметь доступное групповое имя, а профильный скрипт — актуальный cache bust');
ok(ui.includes('.ws-mode-compact .ws-section-nav') && ui.includes('display: none;'), 'свёрнутый desktop sidebar не должен показывать обрезанную навигацию по секциям');
ok(shell.includes('class="ws-search-label">Поиск по материалам</span><kbd>Ctrl K</kbd>') && !shell.includes("searchButton.setAttribute('aria-label'"), 'имя кнопки поиска должно формироваться из видимой подписи и подсказки клавиатуры');
ok(read('stands/setpolis.html').includes('<h2>роадмап практики · пять спринтов</h2>'), 'раздел роадмапа должен задавать корректный порядок заголовков');
for (const behavior of ['aria-current', 'aria-expanded', 'workspace-rail', 'search-index.json', 'IntersectionObserver', '.ws-section-nav', 'scroll-margin-top', "event.key.toLowerCase() === 'k'", "event.key === '/'", "event.key === 'Escape'"]) {
  ok(shell.includes(behavior) || ui.includes(behavior), 'workspace shell: отсутствует функциональный контракт ' + behavior);
}
ok(exists('assets/icons.svg') && ['arrow-up-right', 'network', 'document', 'server', 'search', 'moon'].every(id => read('assets/icons.svg').includes('id="' + id + '"')), 'неполный общий SVG-спрайт иконок');
ok(ui.includes('.scroll-progress { display: none !important; }') && ui.includes('body.ws-ready #to-top.show'), 'верхний прогресс-штрих должен быть убран, кнопка «Наверх» появляется после прокрутки');
ok(!read('assets/shared-chrome.js').includes('window.scrollTo(0, start + delta * eased)'), 'обработчик якорей не должен перехватывать нативную историю и smooth-scroll браузера');
ok(!shell.includes("mark.textContent = 'i'") && !ui.includes('.ws-brand-mark'), 'в общей навигации остался монограммный I вместо ника');
ok(ui.includes(':root[data-theme="dark"] :is([data-ws-action="primary"], .ws-button-primary)') && ui.includes('color: var(--ws-canvas) !important'), 'dark-mode primary controls need readable text contrast');
const homePage = read('index.html');
const activityScript = read('assets/home-activity.js');
ok(homePage.includes('id="activity"') && homePage.includes('data-ws-activity-count') && homePage.includes('Сайт развивается итерациями'), 'на главной нужен внизу прозрачный блок итерационной работы и реальной активности');
ok(homePage.includes('assets/home-activity.js?v=20261101r1') && homePage.includes('assets/i18n.js?v=20261101activity1') && homePage.includes('workspace-home.css?v=20261101r6') && read('stands/index.html').includes('workspace-home.css?v=20261101r6'), 'главная и каталог должны загружать актуальные ресурсы activity-компонента');
ok(activityScript.includes('api.github.com/repos/ItsLiventsev/itsliventsev.github.io/commits') && activityScript.includes("url.searchParams.set('sha', 'main')") && activityScript.includes("url.searchParams.set('since', since)"), 'счётчик должен получать историю коммитов основной ветки за скользящие 30 дней');
ok(activityScript.includes("url.searchParams.set('per_page', '100')") && activityScript.includes("'100+'" ) && activityScript.includes('sessionStorage') && activityScript.includes('freshForMs'), 'счётчик должен консервативно обозначать лимит и кэшировать запрос без постоянного хранилища');
ok(activityScript.includes("setState('error')") && activityScript.includes('historyUrl') && homePage.includes('data-ws-activity-history'), 'при недоступности GitHub сводка должна деградировать без потери прямой ссылки на историю');
ok(homeUi.includes('[data-ws-activity-card]') && homeUi.includes('[data-ws-activity-metrics]') && homeUi.includes('@media (max-width: 800px)'), 'activity panel должен использовать дизайн-токены Workspace и адаптивную сетку');
ok(homePage.includes("activity_title:'Сайт развивается итерациями'") && homePage.includes("activity_title:'The site evolves by iteration'") && read('assets/i18n.js').includes("itsliventsev:languagechange"), 'activity panel должен переводиться и обновлять динамический статус при смене языка');
ok(homePage.includes('Помогаю студентам') && homePage.includes('осваивать сети и системы') && homePage.includes('изучаю постепенно') && !homePage.includes('<strong>СПО</strong>') && !homePage.includes('<strong>IT</strong>') && !homePage.includes('Ваше пространство'), 'главная должна спокойно и конкретно представлять автора без бессмысленно выделенных сокращений');
ok(homePage.indexOf('ws-dashboard-grid') < homePage.indexOf('learning-title'), 'персональный профиль и проекты должны идти до блока пространств');
ok(shell.includes('wsSidebarBrand') && (shell.includes('РАЗДЕЛЫ САЙТА') || shell.includes('Общее меню')) && shell.includes("label: 'Архив'"), 'у боковой навигации должен быть брендинг, непустая шапка и согласованные названия разделов');
ok(shell.indexOf('generalGroup') >= 0 && shell.indexOf('generalGroup') < shell.indexOf('addSectionNavigation();') && shell.includes('ws-nav-indicator'), 'оглавление нельзя инициализировать до создания sidebar: иначе shell падает с ReferenceError');
ok(homeUi.includes('.ws-button-primary {') && homeUi.includes('color: #fff !important'), 'основная кнопка должна сохранять контрастную подпись даже при общих стилях ссылок');
ok(shell.includes('isNestedPage') && !shell.includes('decodeURIComponent(pathname'), 'верхнеуровневые страницы не должны повторять заголовок, а fallback не должен показывать pathname');
ok(shell.includes('generatedBreadcrumbs') && shell.includes('На этой странице'), 'контекстная навигация должна строить breadcrumbs и оглавление текущей страницы');
ok(read('archive.html').includes('<span class="ht-word">Архив</span>') && read('archive.html').includes('Учебные программы и методика'), 'архив должен использовать единый регистр и новые названия категорий');
ok(read('projects/esports.html').includes('data-ws-esports-strip') && !read('projects/esports.html').includes('marquee-content'), 'список дисциплин в киберспорте не должен дублироваться');
ok(learningUi.includes('[data-ws-esports-hero]') && learningUi.includes('[data-ws-esports-strip]'), 'странице киберспорта нужны компоненты новой системы');
ok(ui.includes('[data-ws-callout]') && ui.includes('[data-ws-archive-summary]'), 'общая архитектура должна оформлять дисклеймеры и адаптивные архивные карточки');
for (const id of ['about', 'projects', 'practice', 'resources', 'experience', 'contact', 'activity']) {
  ok(homePage.includes('id="' + id + '"'), 'главная: отсутствует якорь локальной навигации ' + id);
}
ok(shell.includes("main.querySelectorAll('h2')") && shell.includes('addSectionNavigation') && shell.includes('ws-section-link'), 'оглавление должно динамически собираться из заголовков текущей страницы');
for (const font of ['manrope-cyrillic-wght-normal.woff2', 'manrope-latin-wght-normal.woff2', 'jetbrains-mono-cyrillic-wght-normal.woff2', 'jetbrains-mono-latin-wght-normal.woff2']) {
  ok(exists('assets/fonts/' + font) && tokens.includes(font), 'локальный набор шрифтов неполон: ' + font);
}
const learningDirectory = read('stands/index.html');
for (const feature of ['СетьПолис', 'ОфисПолис', 'ДатаПолис', '41', 'ws-learning-hero', 'ws-journey-grid', 'ws-ecosystem-grid']) {
  ok(learningDirectory.includes(feature), 'stands/index.html: отсутствует блок нового каталога ' + feature);
}
ok(learningDirectory.includes('<title>Пространства · itsliventsev</title>') && learningDirectory.includes('<h1 id="learning-title">Пространства</h1>'), 'каталог должен называться «Пространства»');
ok(read('projects.html').includes('ws-project-grid-balanced') && !read('projects.html').includes('ws-project-placeholder'), 'каталог проектов не должен заполняться пустыми заглушками');
ok(ui.includes('[data-ws-article-layout]') && ui.includes('[data-ws-article-content]'), 'workspace.css: отсутствуют стили читабельной статьи');
ok(ui.includes('overflow-x: hidden') && ui.includes('.ws-sidebar-head') && ui.includes('.ws-mode-compact .ws-collapse { transform: rotate(180deg)'), 'sidebar должна быть без горизонтальной прокрутки, а кнопка сворачивания — видимой в шапке рейла и корректно поворачиваться в компактном режиме');
ok(read('index.html').includes('data-target="5">5</span>') && read('assets/site.js').includes('let current = parseInt(el.textContent, 10) || 0'), 'счётчики профиля не должны показывать временный ноль до прокрутки');
ok(!/\.(?:site-header|site-nav|global-sidebar|hero-title|card|p-card)\b/.test(ui), 'новая система обращается к старым CSS-классам');
ok(!/\.(?:site-header|site-nav|global-sidebar|hero-title|card|p-card)\b/.test(homeUi), 'новый dashboard обращается к старым CSS-классам');
ok(!/\.(?:site-header|site-nav|global-sidebar|hero-title|card|p-card|lab-panel|flat-btn|task-item|q-item|st-topbar)\b/.test(learningUi), 'новые LMS-паттерны обращаются к старым CSS-классам');
for (const obsolete of ['assets/site.css', 'assets/shared-chrome.css', 'assets/soft-shell.css', 'assets/stands.css', 'assets/ops.css', 'assets/office.css', 'assets/tw-compiled.css', 'assets/tw-fallback.css']) {
  ok(!exists(obsolete), 'осталась старая stylesheet-архитектура: ' + obsolete);
}

/* Client-side generated article template and lesson generator must emit the new UI. */
const adminTemplate = read('assets/admin.js');
for (const pathFragment of ['assets/workspace-tokens.css?v=20261101r4', 'assets/workspace.css?v=20261101r6', 'assets/workspace-learning.css?v=20261101r6', 'assets/workspace.js?v=20261101r6']) {
  ok(adminTemplate.includes(pathFragment), 'admin.js: динамический материал не подключает ' + pathFragment);
}
const officeBuilder = read('scripts/build-office.js');
ok(officeBuilder.includes('assets/workspace-tokens.css?v=20261101r4') && officeBuilder.includes('assets/workspace.css?v=20261101r6') && officeBuilder.includes('assets/workspace-learning.css?v=20261101r6') && officeBuilder.includes('assets/workspace.js?v=20261101r6'), 'build-office.js: генератор не создаёт страницы на новом shell');
for (const [name, template] of [['admin.js', adminTemplate], ['build-office.js', officeBuilder]]) {
  ok(template.includes('/assets/fonts/manrope-cyrillic-wght-normal.woff2') && !template.includes('fonts.googleapis.com'), name + ': generated pages must use local fonts without Google Fonts');
}
ok(exists('REDESIGN_PLAN.md') && read('REDESIGN_PLAN.md').includes('Workspace / Learning OS'), 'нет плана архитектуры REDESIGN_PLAN.md');

/* Local search, page links, file formats and script syntax. */
let index = [];
try { index = JSON.parse(read('assets/search-index.json')); ok(true); }
catch (error) { ok(false, 'search-index.json невалиден: ' + error.message); }
ok(index.length === 72 || index.length === 73, 'ожидалось 72 записи в поиске, получено ' + index.length);
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
ok((sitemap.match(/<loc>[^<]+<\/loc>/g) || []).length === 71 || (sitemap.match(/<loc>[^<]+<\/loc>/g) || []).length === 72, 'ожидалось 71 URL в sitemap.xml');
ok(read('stands/index.html').includes('Три самостоятельные практики'), 'потеряно описание трёх направлений каталога');
ok(read('stands/office/index.html').includes('office-hub.js'), 'потерян хаб ОфисПолис');
ok(read('stands/ops/index.html').includes('ops-hub.js'), 'потерян хаб ДатаПолис');

console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail) { console.error(failures.slice(0, 100).join('\n')); process.exit(1); }
