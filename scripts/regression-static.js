/* Static regression harness for the v12 «Мастерская» shell. Zero dependencies, Node >= 18.
   It asserts the contracts the rest of the project relies on: one shell, one token layer,
   no legacy assets, accessible landmarks and honest data components. */
'use strict';
const fs = require('fs');
const path = require('path');
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
      if (!['.git', 'node_modules', '__pycache__', '.arena'].includes(item.name)) output.push(...walk(relative, pattern));
    } else if (pattern.test(item.name)) output.push(relative.replace(/\\/g, '/'));
  }
  return output;
}
const html = walk('.', /\.html$/);
const contentPages = html.filter(file => file !== 'assets/offline.html');
const stands = html.filter(file => file.startsWith('stands/'));

ok(contentPages.length === 75, 'ожидалось 75 контентных HTML-страниц, получено ' + contentPages.length);
ok(stands.length === 52, 'ожидалось 52 учебных маршрута, получено ' + stands.length);
ok(exists('assets/offline.html'), 'нет автономной страницы для офлайн-перехода');

/* ── каждая страница: один shell, одни токены, никакого legacy ── */
for (const file of contentPages) {
  const source = read(file);
  ok(source.includes('/assets/tokens.css'), file + ': не подключены дизайн-токены');
  ok(source.includes('/assets/base.css'), file + ': не подключён базовый слой');
  ok(source.includes('/assets/pages.css'), file + ': не подключён слой страниц');
  ok(source.includes('/assets/shell.js'), file + ': не подключён общий shell');
  ok((source.match(/<main\b/g) || []).length === 1, file + ': ожидался ровно один main');
  ok((source.match(/<h1\b/g) || []).length === 1, file + ': ожидался ровно один H1');
  ok(source.includes('lang="ru"'), file + ': не задан язык документа');
  ok(source.includes('skip-link'), file + ': нет ссылки перехода к содержимому');
  ok(/<nav\b/.test(source), file + ': нет семантической навигации');
  ok(!/\sstyle="/.test(source), file + ': остались inline-стили');
  ok(!/assets\/(?:workspace[^"']*|site\.js|shared-chrome\.js|i18n\.js|home-activity\.js|catalog\.css|stands\.css|ops\.css|office\.css)/.test(source), file + ': подключён удалённый legacy-ассет');
  ok(!source.includes('fonts.googleapis.com') && !source.includes('DM+Serif+Display'), file + ': осталась внешняя загрузка шрифтов');
  ok(source.includes('/assets/fonts/literata-cyrillic-wght-normal.woff2') && source.includes('/assets/fonts/golos-text-cyrillic-wght-normal.woff2'), file + ': не предзагружены Literata и Golos Text');
  ok(!source.includes('class="ambient"') && !source.includes('class="floating-elements"') && !source.includes('scroll-progress'), file + ': осталась декоративная разметка старого дизайна');
  ok(!/class="[^"]*\b(?:glass|backdrop-blur)\b/.test(source), file + ': glassmorphism в разметке');
  for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    ok(/\balt="/.test(tag) && /\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag) && /\bloading="lazy"/.test(tag), file + ': изображению нужны alt, размеры и lazy loading');
  }
  if (file.startsWith('stands/')) {
    ok(source.includes('/assets/course.css'), file + ': учебная страница без course.css');
    if (file !== 'stands/index.html') ok(/data-ws-|class="(?:st-|ops-|office-|lab-|league-)/.test(source), file + ': учебная страница без хуков course.css');
  }
  if (file.includes('/') && file !== 'projects/glossary.html') {
    ok(/<time\b[^>]*data-footer-updated/.test(source) || file.startsWith('archive/'), file + ': нет семантической даты обновления');
  }
}

/* ── токены ── */
const tokens = read('assets/tokens.css');
ok(tokens.includes('prefers-reduced-motion'), 'token layer: нет режима reduced motion');
for (const name of ['--u-paper', '--u-surface', '--u-ink', '--u-ink-2', '--u-muted', '--u-accent', '--u-line', '--u-font-display', '--u-font-ui', '--u-font-mono', '--u-fs-4xl', '--u-s4', '--u-s8', '--u-r-xs', '--u-r-md', '--u-r-lg']) {
  ok(tokens.includes(name), 'token layer: отсутствует ' + name);
}
ok(!/--u-font-(?:ui|display):[^;]*(Inter|Roboto|Arial|system-ui)/i.test(tokens), 'в качестве основных шрифтов выбран запрещённый стек');
ok(/--u-font-ui:\s*"Golos Text"/.test(tokens) && /--u-font-display:\s*"Golos (Display|Text)"/.test(tokens), 'интерфейс и заголовки должны быть на Golos');
ok(/--u-font-serif:\s*"Literata"/.test(tokens), 'длинный текст должен остаться на Literata');
ok(!tokens.includes('workspace.css'), 'в токенах остались ссылки на удалённый файл');
function tokenColor(name) { return tokens.match(new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})'))?.[1]; }
function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(a, b) { const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l1 + .05) / (l2 + .05); }
for (const [fg, bg] of [['--u-ink', '--u-paper'], ['--u-ink-2', '--u-paper'], ['--u-muted', '--u-paper'], ['--u-faint', '--u-paper'], ['--u-accent', '--u-paper'], ['--u-ok', '--u-ok-soft'], ['--u-info', '--u-info-soft'], ['--u-warn', '--u-warn-soft'], ['--u-danger', '--u-danger-soft'], ['--u-net', '--u-net-soft'], ['--u-office', '--u-office-soft'], ['--u-ops', '--u-ops-soft']]) {
  const a = tokenColor(fg), b = tokenColor(bg);
  ok(a && b && contrast(a, b) >= 4.5, 'контраст пары ' + fg + ' / ' + bg + ' ниже WCAG AA');
}

/* ── слои CSS ── */
const base = read('assets/base.css');
const pages = read('assets/pages.css');
for (const contract of ['.ui-masthead', '.ui-navlink', '.ui-drawer', '.ui-tabbar', 'dialog.ui-search', '.ui-crumbs', '.ui-footer', '.ui-btn', '.skip-link', ':focus-visible']) {
  ok(base.includes(contract), 'base.css: отсутствует контракт ' + contract);
}
for (const contract of ['.home-hero', '.bento', '.catalog-row', '.editorial', '.faq', '.map-grid', '.archive-cat', '.glossary-grid', '.case-facts', '.feed-item', '.ui-section']) {
  ok(pages.includes(contract), 'pages.css: отсутствует контракт ' + contract);
}
ok(!/!important/.test(base) || (base.match(/!important/g) || []).length < 12, 'в базовом слое слишком много !important');
ok((base + pages).match(/backdrop-filter/g) === null, 'стеклянный блюр не должен использоваться');
ok(!/linear-gradient\([^)]*(?:#6d28d9|#7c3aed|#8b5cf6|#4f46e5)/i.test(base + pages), 'фиолетово-синие градиенты запрещены');
const courseStyles = read('assets/course.css');
ok(courseStyles.includes('[data-ws-hero]') && courseStyles.includes('[data-ws-surface]'), 'course.css не покрывает учебные поверхности');

/* ── скрипты ── */
const shell = read('assets/shell.js');
for (const behavior of ['aria-current', 'aria-expanded', 'IntersectionObserver', 'search-index.json', "'Escape'", 'data-ui-theme-toggle', 'ui-toc', 'ui-drawer', 'ui-tabbar', 'matchMedia']) {
  ok(shell.includes(behavior), 'shell.js: отсутствует функциональный контракт ' + behavior);
}
ok(shell.includes("doc.querySelector('.st-topbar')") && !/root\.querySelector\('\.st-topbar'\)/.test(shell), 'shell.js должен искать верхнюю полосу в документе, а не в контенте');
const feed = read('assets/feed.js');
for (const behavior of ['/assets/data/activity.json', 'api.github.com/repos/ItsLiventsev/itsliventsev.github.io/commits', "per_page', '100'", 'sessionStorage', 'itsliventsev:activity:v2', 'data-activity-chart', 'data-activity-commit', 'data-activity-count', 'data-activity-total']) {
  ok(feed.includes(behavior), 'feed.js: отсутствует контракт ' + behavior);
}
ok(feed.includes("since") && feed.includes('Date.now'), 'feed.js должен запрашивать скользящее окно, а не всю историю');
ok(feed.indexOf('/assets/data/activity.json') < feed.indexOf('api.github.com'), 'feed.js должен сначала читать снимок, а к API идти только как к фолбэку');

/* Снимок активности: 30 дней, 14 последних на графике, только содержательные коммиты */
const activity = JSON.parse(read('assets/data/activity.json'));
ok(activity && Array.isArray(activity.days) && activity.days.length === 30, 'activity.json должен содержать 30 дней истории');
ok(Array.isArray(activity.commits) && activity.commits.length > 0 && activity.commits.length <= 60, 'activity.json хранит 1–60 последних коммитов');
ok(activity.commits.every(c => /^[0-9a-f]{7}$/.test(c.sha) && /^https:\/\/github\.com\//.test(c.url) && c.date && c.title), 'каждый коммит в снимке имеет sha, url, дату и заголовок');
ok(activity.commits.every(c => !/^merge\b/i.test(c.title)), 'в снимке нет merge-коммитов');
ok(activity.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isInteger(d.count)), 'дни в снимке — ISO-даты со счётчиком');
ok(activity.total >= activity.days.reduce((sum, d) => sum + d.count, 0) - 30, 'total согласован со счётчиками по дням');
const reading = read('assets/home-reading.js');
for (const behavior of ['data-reading-shelf', 'data-reading-list', 'data-reading-filter', 'published']) {
  ok(reading.includes(behavior), 'home-reading.js: отсутствует контракт ' + behavior);
}
ok(reading.includes("const sources = ['blog', 'articles']") && reading.includes("/^[a-z0-9][a-z0-9-]*\\.html$/i"), 'home-reading.js должен валидировать источник и имя файла');
const catalog = read('assets/catalog.js');
ok(catalog.includes('.catalog-row') && catalog.includes('card.hidden'), 'catalog.js не соответствует разметке каталога');

/* ── удалённые ассеты не должны существовать ── */
for (const dead of ['assets/workspace.css', 'assets/workspace-tokens.css', 'assets/workspace-home.css', 'assets/workspace-learning.css', 'assets/catalog.css', 'assets/shared-chrome.js', 'assets/site.js', 'assets/home-activity.js', 'assets/workspace.js', 'assets/i18n.js']) {
  ok(!exists(dead), 'удалённый ассет всё ещё в репозитории: ' + dead);
}

/* ── шрифты ── */
for (const font of ['literata-cyrillic-wght-normal.woff2', 'literata-latin-wght-normal.woff2', 'golos-text-cyrillic-wght-normal.woff2', 'golos-text-latin-wght-normal.woff2', 'jetbrains-mono-cyrillic-wght-normal.woff2']) {
  ok(exists('assets/fonts/' + font), 'локальный набор шрифтов неполон: ' + font);
}

/* ── содержимое ключевых страниц ── */
const home = read('index.html');
ok(home.includes('data-activity') && home.includes('data-activity-list') && home.includes('data-activity-chart'), 'на главной нет живой ленты активности');
ok(home.includes('data-reading-shelf') && home.includes('data-reading-list'), 'на главной нет полки чтения');
for (const id of ['about', 'projects', 'practice', 'resources', 'contact', 'activity']) ok(home.includes('id="' + id + '"'), 'главная: отсутствует секция #' + id);
ok(read('stands/index.html').includes('<h1') && read('stands/index.html').includes('Три самостоятельные практики'), 'каталог пространств потерял заголовок или вводную');
ok(read('projects.html').includes('data-catalog-list'), 'projects.html: нет каталога карточек');
ok(read('projects.html').includes('data-catalog-status') || read('articles.html').includes('data-catalog-status'), 'каталог без области статуса фильтра');
ok(read('faq.html').includes('01 · С чего начать'), 'FAQ потерял нумерованные разделы');
/* Справка: каждый <details> обязан иметь настоящий текст ответа и свой id для деплинка.
   Пустые аккордеоны уже случались — теперь это ловится тестом, а не глазами. */
{
  const faq = read('faq.html');
  const items = [...faq.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)];
  ok(items.length >= 17, 'справка: потерялись вопросы (найдено ' + items.length + ')');
  const stripped = items.map(([, attrs, body]) => ({
    id: (/id="([^"]+)"/.exec(attrs) || [])[1] || '',
    summary: (/<summary>([^<]+)<\/summary>/.exec(body) || [])[1] || '',
    answer: body.replace(/<summary>[\s\S]*?<\/summary>/, '').replace(/<p class="faq-anchor">[\s\S]*?<\/p>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
  for (const item of stripped) {
    ok(item.id.startsWith('faq-'), 'справка: вопрос без id для деплинка — ' + item.summary.slice(0, 40));
    ok(item.summary.length > 6, 'справка: пустой вопрос в аккордеоне');
    ok(item.answer.length > 80, 'справка: пустой или слишком короткий ответ — ' + item.summary.slice(0, 40));
  }
  ok(new Set(stripped.map(i => i.id)).size === stripped.length, 'справка: повторяющиеся id вопросов');
  ok(faq.includes('FAQ:LD:START') && faq.includes('"@type":"FAQPage"'), 'справка: нет FAQPage-разметки');
  const ld = JSON.parse(/FAQ:LD:START -->\n  <script type="application\/ld\+json">(.*?)<\/script>/.exec(faq)[1]);
  ok(ld.mainEntity.length === stripped.length, 'справка: FAQPage размечен не для всех вопросов');
  ok(ld.mainEntity.every(q => q.acceptedAnswer.text.length > 80), 'справка: в FAQPage пустые ответы');
  ok(ld.mainEntity.every(q => stripped.some(i => i.summary.startsWith(q.name.slice(0, 30)))), 'справка: FAQPage спрашивает не о том, что на странице');
  ok(faq.includes('id="faq-filter"') && faq.includes('assets/faq.js'), 'справка: пропал фильтр вопросов или его скрипт');
}
ok(read('archive.html').includes('Учебные программы и методика') && read('archive.html').includes('поз.'), 'архив должен сохранять категории и счётчики позиций');
ok(read('sitemap.html').includes('map-group') && read('sitemap.html').includes('учебные вселенные'), 'карта сайта потеряла группы');
ok(read('404.html').includes('not-found'), 'страница 404 не оформлена');
ok(!exists('agent-plan.html'), 'внутренняя служебная страница плана не должна публиковаться');

/* ── генераторы и SW должны ссылаться на новую систему ── */
const admin = read('assets/admin.js');
ok(admin.includes('assets/tokens.css') && admin.includes('assets/shell.js') && !admin.includes('workspace.css'), 'генератор постов не переведён на новую систему');
const office = read('scripts/build-office.js');
ok(office.includes('assets/tokens.css') && office.includes('assets/shell.js') && !office.includes('workspace.css'), 'генератор ОфисПолиса не переведён на новую систему');
const sw = read('sw.js');
ok(sw.includes('/assets/tokens.css') && sw.includes('/assets/shell.js') && !sw.includes('workspace'), 'service worker кэширует удалённые ассеты');

/* ── поисковый индекс не должен расходиться с сайтом ──
   Индекс поддерживается вручную, поэтому проверяем его целостность: битые url,
   пустые поля и страницы, которые вообще не попали в поиск. Редиректы-заглушки
   (meta refresh) индексировать не нужно. */
const searchIndex = JSON.parse(read('assets/search-index.json'));
ok(searchIndex.length >= 70, 'поисковый индекс подозрительно мал: ' + searchIndex.length);
ok(new Set(searchIndex.map(i => i.url)).size === searchIndex.length, 'поисковый индекс: повторяющиеся url');
for (const item of searchIndex) {
  ok(!!item.title && !!item.description && !!item.category, 'поисковый индекс: пустые поля у ' + item.url);
  ok(!!item.content && item.content.length > 200, 'поисковый индекс: слишком короткий текст у ' + item.url);
  const target = item.url === '/' ? 'index.html' : item.url.replace(/^\//, '');
  ok(exists(target), 'поисковый индекс ведёт на несуществующую страницу: ' + item.url);
}
const indexed = new Set(searchIndex.map(i => (i.url === '/' ? 'index.html' : i.url.replace(/^\//, ''))));
for (const page of contentPages) {
  if (page === 'admin.html' || page === '404.html') continue;
  if (/http-equiv="refresh"/i.test(read(page))) continue;
  ok(indexed.has(page), 'страница отсутствует в поисковом индексе: ' + page);
}

console.log(`regression-static: ${pass} passed, ${fail} failed`);
if (fail) { for (const f of failures.slice(0, 40)) console.log('  ✗ ' + f); process.exitCode = 1; }
