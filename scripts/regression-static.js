/* Регрессионный харнесс статики (zero-deps, node >=18). Запуск: node /tmp/domtest/regression-static.js */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION = '20261031ad';
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function walk(dir, re) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '.ogbuild' && e.name !== '.git' && e.name !== 'node_modules') out.push(...walk(p, re)); }
    else if (re.test(e.name)) out.push(p);
  }
  return out;
}
const allHtml = walk('.', /\.html$/);
const standsHtml = allHtml.filter(f => f.startsWith('stands/'));
const rootHtml = allHtml.filter(f => !f.startsWith('stands/'));

/* 1. Инвентарь */
ok(allHtml.length === 73, 'HTML страниц должно быть 73, фактически ' + allHtml.length);
ok(standsHtml.length === 50, 'stands-страниц 50, фактически ' + standsHtml.length);

/* 2. Версия ассетов */
for (const f of allHtml) {
  const s = read(f);
  ok(!s.includes('?v=20261028z') && !s.includes('?v=20261028aa') && !s.includes('?v=20261028ab') && !s.includes('?v=20261028ac') && !s.includes('?v=20261028ad') && !s.includes('?v=20261028ae') && !s.includes('?v=20261028af') && !s.includes('?v=20261031aa'), f + ': устаревшая версия ассета');
  const local = s.match(/(?:src|href)="(?:\.\.\/)*assets\/[^"]+\?v=([^"]+)"/g) || [];
  for (const m of local) ok(m.includes('?v=' + VERSION), f + ': версия не ' + VERSION + ' в ' + m);
}

/* 3. Запрещённые коды в видимом UI (только HTML; комментарии в JS не считаются) */
for (const f of allHtml) {
  const s = read(f).replace(/<!--[\s\S]*?-->/g, '');
  ok(!s.includes('ПМ.01'), f + ': ПМ.01 в разметке');
  ok(!/МДК[.\s]?\d/.test(s), f + ': МДК в разметке');
}

/* 4. stands/: ноль внешних ссылок в UI (<a href=http...>) */
for (const f of standsHtml) {
  const anchors = read(f).match(/<a\s[^>]*href="https?:[^"]*"/g) || [];
  ok(anchors.length === 0, f + ': внешняя ссылка в UI stands');
}

/* 5. node --check всех JS */
for (const f of walk('assets', /\.js$/)) {
  const r = cp.spawnSync('node', ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
  ok(r.status === 0, 'node --check ' + f + ' :: ' + r.stderr.trim());
}

/* 6. Баланс скобок CSS */
for (const f of walk('assets', /\.css$/)) {
  const s = read(f);
  ok((s.match(/{/g) || []).length === (s.match(/}/g) || []).length, f + ': дисбаланс фигурных скобок');
}

/* 7. JSON валиден */
for (const f of walk('.', /\.json$/)) {
  try { JSON.parse(read(f)); ok(true); } catch (e) { ok(false, f + ': битый JSON ' + e.message); }
}

/* 8. Реестры: длины и соответствие файлам */
const standsJs = read('assets/stands.js');
const opsHub = read('assets/ops-hub.js');
function questBlock(src) {
  const a = src.indexOf('var QUESTS = [');
  const b = src.indexOf('];', a);
  return src.slice(a, b);
}
const officeHub = read('assets/office-hub.js');
const q1 = (questBlock(standsJs).match(/id: '[^']+'/g) || []);
const q2 = (questBlock(opsHub).match(/id: '[^']+'/g) || []);
const q3 = (questBlock(officeHub).match(/id: '[^']+'/g) || []);
ok(q1.length === 15, 'QUEST stands.js = 15, фактически ' + q1.length);
ok(q2.length === 16, 'QUEST ops-hub.js = 16, фактически ' + q2.length);
ok(q3.length === 10, 'QUEST office-hub.js = 10, фактически ' + q3.length);
for (const m of q1) {
  const id = m.match(/'([^']+)'/)[1];
  const href = (questBlock(standsJs).match(new RegExp("id: '" + id + "',[\\s\\S]*?href: '([^']+)'")) || [])[1];
  ok(exists('stands/' + (href || id + '.html')), 'файл реестра stands отсутствует: ' + id);
}
for (const m of q2) {
  const id = m.match(/'([^']+)'/)[1];
  const href = (questBlock(opsHub).match(new RegExp("id: '" + id + "',[\\s\\S]*?href: '([^']+)'")) || [])[1];
  ok(exists('stands/ops/' + (href || id + '.html')), 'файл реестра ops отсутствует: ' + id);
}
for (const m of q3) {
  const id = m.match(/'([^']+)'/)[1];
  const href = (questBlock(officeHub).match(new RegExp("id: '" + id + "',[\\s\\S]*?href: '([^']+)'")) || [])[1];
  ok(exists('stands/office/' + (href || id + '.html')), 'файл реестра office отсутствует: ' + id);
}

/* 9. Sitemap */
const sm = read('sitemap.xml');
const locs = (sm.match(/<loc>[^<]+<\/loc>/g) || []).map(l => l.replace(/<\/?loc>/g, ''));
ok(locs.length === 69, 'sitemap URL = 67, фактически ' + locs.length);
ok(!/(404|admin|league)/.test(sm), 'sitemap содержит 404/admin/league');
for (const u of locs) {
  const rel = u.replace('https://itsliventsev.github.io/', '').replace(/^$/, 'index.html');
  const file = rel.endsWith('/') ? rel + 'index.html' : rel;
  ok(exists(file), 'sitemap ссылается на отсутствующий файл: ' + file);
}

/* 10. Общие токены и алиасы */
const siteCss = read('assets/site.css'), stCss = read('assets/stands.css'), opsCss = read('assets/ops.css');
for (const t of ['--page-max', '--page-gutter', '--space-section']) {
  ok(siteCss.includes(t + ':'), 'site.css: нет токена ' + t);
  ok(stCss.includes('--st-' + t.slice(2) + ':'), 'stands.css: нет алиаса --st-' + t.slice(2));
}
ok(!stCss.includes('min(1180px'), 'stands.css: осталась хардкод-ширина 1180px');

/* 11. reduced-motion во всех CSS */
for (const [n, s] of [['site.css', siteCss], ['stands.css', stCss], ['ops.css', opsCss]]) {
  ok(s.includes('prefers-reduced-motion'), n + ': нет prefers-reduced-motion');
}
/* ambient-слой удалён: никаких движущихся глифов и пузырей */
ok(!stCss.includes('.st-ambient') && !standsJs.includes('initAmbient') && !siteCss.includes('flow-bubble'), 'ambient-слой не удалён до конца');

/* 12. OG-картинки по вселенным */
ok(exists('assets/og.png') && exists('assets/og-stands.png') && exists('assets/og-ops.png') && exists('assets/og-office.png'), 'OG PNG отсутствуют');
for (const f of standsHtml.filter(f => f.startsWith('stands/office/'))) {
  const c = read(f);
  ok(c.includes('assets/og-office.png'), f + ': не подключена og-office.png');
  ok(!c.includes('og-ops.png') && !c.includes('og-stands.png'), f + ': чужая OG на office-странице');
}
for (const f of standsHtml.filter(f => f.startsWith('stands/ops/'))) {
  ok(read(f).includes('assets/og-ops.png'), f + ': не подключена og-ops.png');
}
for (const f of standsHtml.filter(f => !f.startsWith('stands/ops/') && !f.startsWith('stands/office/'))) {
  const c = read(f);
  if (c.includes('og:image')) ok(c.includes('assets/og-stands.png'), f + ': не подключена og-stands.png');
}
for (const f of rootHtml) {
  if (f === 'projects/glossary.html') continue; // noindex-редирект на единый словарь
  ok(read(f).includes('assets/og.png'), f + ': корневая OG потеряна');
}

/* 13. Футер: слот на каждой странице с футером */
for (const f of allHtml) {
  const s = read(f);
  if (s.includes('<footer')) ok(s.includes('data-footer-updated'), f + ': нет слота «обновлено»');
}
ok(standsJs.includes('initFooterDate') && read('assets/site.js').includes('data-footer-updated'), 'нет JS-заполнения даты футера');

/* 14. dom-kit: порядок и делегирование */
const engines = ['stands.js', 'ops-hub.js', 'ops-kit.js', 'office-hub.js', 'office-kit.js', 'lab-kit.js', 'league-page.js', 'submissions.js'];
for (const e of engines) ok(read('assets/' + e).includes('window.DOMKIT.esc'), e + ': не делегирует esc в DOMKIT');
ok(exists('assets/dom-kit.js'), 'нет assets/dom-kit.js');
const engineRe = /(stands|ops-hub|ops-kit|office-hub|office-kit|lab-kit|league-page|submissions)\.js/;
for (const f of allHtml) {
  const s = read(f);
  if (!engineRe.test(s)) continue;
  const dk = s.search(/dom-kit\.js/);
  const firstEngine = Math.min(...engines.map(e => { const i = s.indexOf(e + '.js'); return i < 0 ? Infinity : i; }));
  ok(dk >= 0 && dk < firstEngine, f + ': dom-kit отсутствует или загружается после движка');
}
/* реестр dom-kit-страниц = 37 stands + admin */
const dkPages = allHtml.filter(f => read(f).includes('dom-kit.js'));
ok(dkPages.length === 50, 'dom-kit подключён на 50 страницах (49 stands + admin), фактически ' + dkPages.length);

/* 15. Нарратив */
ok(read('stands/index.html').includes('uni-flow'), 'нет схемы вселенных uni-flow');
ok(read('stands/index.html').includes('office/index.html') && read('stands/index.html').includes('три вселенные'), 'хаб не переведён на три вселенные');
ok(read('stands/office/index.html').includes('ops-legend'), 'нет легенды бюро на входе ОфисПолиса');
ok(read('stands/office/index.html').includes('office-hub.js'), 'хаб ОфисПолиса не подключает office-hub.js');
ok(read('stands/ops/index.html').includes('ops-legend'), 'нет легенды SLA на входе ДатаПолиса');
ok(read('404.html').includes('error-mascot') && read('404.html').includes('mascots.js'), '404 без маскота');
ok(standsJs.includes('emptyHtml'), 'stands.js: нет emptyHtml с маскотом');
ok(opsHub.includes('rv-empty--mascot'), 'ops-hub: пустое состояние без маскота');

/* 16. Шрифты и анимации */
for (const f of allHtml) {
  const s = read(f);
  if (s.includes('fonts.googleapis.com')) ok(s.includes('preconnect') && s.includes('rel="preload"'), f + ': нет preconnect/preload шрифтов');
}
ok(!siteCss.includes('font-weight: 750'), 'остался несуществующий вес 750');
ok(!standsJs.includes('startViewTransition') && !read('assets/site.js').includes('startViewTransition'), 'View Transitions не выключены в JS');
ok(stCss.includes('st-topnav::-webkit-scrollbar') && stCss.includes('overflow-x: auto'), 'мобильная навигация без горизонтального скролла');

/* 17. Доступность и канон */
for (const f of allHtml) {
  const s = read(f);
  ok(s.includes('lang="ru"'), f + ': нет lang="ru"');
  ok(s.includes('skip-link') && s.includes('#main-content'), f + ': нет skip-link');
}
ok(/--st-faint:\s*#828d9a/.test(stCss), 'контраст faint тёмной темы откатился');
const eng = read('assets/ops-engine.js');
ok(eng.includes('P1: 30') && eng.includes('P2: 60') && eng.includes('P3: 240') && eng.includes('P4: 1440'), 'SLA-канон нарушен');
const lgJs = read('assets/league.js');
ok(lgJs.includes('var INITIAL_PRP = 5;') && lgJs.includes('var PRP_CAP = 20;'), 'PRP-канон 5/кап 20 нарушен');
ok(lgJs.includes('earnPrp(r.reviewer.id, 1,') && lgJs.includes('function spendPrp'), 'PRP +1/−1 (earn/spend) нарушен');

/* 18. Локальные ссылки не битые */
for (const f of allHtml) {
  const s = read(f);
  const refs = [...s.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)].map(m => m[1]);
  for (let r of refs) {
    if (/['+\s]/.test(r)) continue; // JS-шаблоны вида blog/' + esc(p.file) + '
    if (/^https?:|^mailto:|^tel:|^data:/.test(r)) continue;
    const target = path.normalize(path.join(path.dirname(f), r));
    ok(exists(target), f + ': битая ссылка ' + r);
  }
}

/* 19. Tailwind CDN + fallback на корневых страницах, которые его используют */
for (const f of rootHtml) {
  const s = read(f);
  if (s.includes('cdn.tailwindcss.com')) ok(s.includes('tw-failed') && exists('assets/tw-fallback.css'), f + ': нет fallback Tailwind');
}


/* 20. ОфисПолис: изоляция, движок, единое меню */
const offEng = read('assets/office-engine.js');
const offKit = read('assets/office-kit.js');
ok(/profile: 'office-profile'/.test(offEng) && /ledger: 'office-ledger'/.test(offEng) && /submissions: 'office-submissions'/.test(offEng), 'ключи OFFICE не изолированы префиксом office-');
ok(!/ops-profile|stands-submissions/.test(offEng), 'office-engine пересекается с чужими ключами');
ok(offEng.includes("schema: 'office-bundle/1'") && offKit.includes("schema: 'office-submission/1'"), 'схемы office-артефактов потеряны');
ok(offKit.includes("'officekit:'") && offKit.includes('#office-data') && offKit.includes('OFFICE.award'), 'office-kit не использует officekit:/OFFICE');
for (const f of walk('stands/office', /\.html$/)) {
  const c = read(f);
  ok(c.includes('office.css') && c.includes('office-scope') && c.includes('data-accent="amber"'), f + ': нет office-scope/amber');
  ok(c.includes('dom-kit.js'), f + ': без dom-kit');
  ok(!c.includes('ПМ.01') && !/МДК[.\s]?\d/.test(c.replace(/<!--[\s\S]*?-->/g, '')), f + ': запрещённый код в UI');
  const nav = c.match(/<nav class="st-topnav"[\s\S]*?<\/nav>/)[0];
  ok(nav.includes('href="../index.html"') && nav.includes('вселенные'), f + ': нет общего пункта «вселенные»');
  ok(nav.includes('glossary.html') && nav.includes('teams.html'), f + ': меню без словаря/команд');
}
/* единое меню: пункт «вселенные» во всех stands-страницах с топнавом */
for (const f of standsHtml) {
  if (f === 'stands/index.html') continue; // хаб вселенных сам является точкой входа
  const c = read(f);
  if (!c.includes('st-topnav')) continue;
  const nav = c.match(/<nav class="st-topnav"[\s\S]*?<\/nav>/)[0];
  ok(/вселенные/.test(nav), f + ': в меню нет пункта «вселенные»');
}
/* 10 работ с валидным встроенным JSON и обязательными блоками */
for (const f of walk('stands/office', /office-.*\.html$/)) {
  if (f.endsWith('index.html')) continue;
  const c = read(f);
  const a = c.indexOf('id="office-data">') + 'id="office-data">'.length;
  const b = c.indexOf('</script>', a);
  const cfg = JSON.parse(c.slice(a, b));
  ok(cfg.tasks.length >= 6 && cfg.quiz.length === 4 && cfg.theory.length >= 3 && cfg.reference.length >= 5, f + ': неполный контент работы');
  ok(cfg.sprintTitle && cfg.story && cfg.who, f + ': нет брифа/маскота');
}


/* 21. Motion-система: токены, запрещённые свойства, общий хром */
const sharedCss = read('assets/shared-chrome.css');
const siteJs = read('assets/site.js');
ok(/--ease-standard:\s*cubic-bezier\(\.2, ?\.7, ?\.2, ?1\)/.test(siteCss), 'нет токена --ease-standard');
ok(siteCss.includes('--dur-fast: 120ms') && siteCss.includes('--dur-base: 220ms')
  && siteCss.includes('--dur-slow: 380ms') && siteCss.includes('--dur-slower: 600ms'), 'нет полной шкалы --dur-*');
ok(siteCss.includes('--ease-exit') && siteCss.includes('--ease-emphasized'), 'нет кривых входа/выхода');
ok(stCss.includes('--st-dur-base: var(--dur-base)') && stCss.includes('--st-ease-exit: var(--ease-exit)'), 'в stands.css нет motion-алиасов');
ok(siteCss.includes('--header-h-sm') && siteCss.includes('--header-h-md') && siteCss.includes('--header-h-lg'), 'нет токенов высоты шапки');
/* никаких числовых длительностей в transition — только var(--dur-*) или 0s/none */
for (const [n, c] of [['site.css', siteCss], ['stands.css', stCss], ['ops.css', opsCss], ['shared-chrome.css', sharedCss]]) {
  c.split('\n').forEach((line, i) => {
    if (line.includes('transition') && /(?<![\w-])\d*\.?\d+s/.test(line)) {
      ok(false, n + ':' + (i + 1) + ' числовая длительность в transition: ' + line.trim().slice(0, 80));
    }
  });
}
/* запрещённые для переходов свойства: layout двигается только transform'ом */
for (const [n, c] of [['site.css', siteCss], ['stands.css', stCss], ['ops.css', opsCss], ['shared-chrome.css', sharedCss]]) {
  c.split('\n').forEach((line, i) => {
    if (/transition[^;]*(?<![\w-])(width|height|top|left|right|bottom|max-height)(?![\w-])/.test(line)) {
      ok(false, n + ':' + (i + 1) + ' transition геометрии: ' + line.trim().slice(0, 80));
    }
  });
}
/* прогресс-бары живут на scaleX(var(--p)), а не на width */
ok(/\.xp-bar i[^{]*\{[^}]*scaleX\(var\(--p/.test(stCss), 'xp-bar не переведён на scaleX(var(--p))');
ok(!/style\.width/.test(read('assets/stands.js') + read('assets/ops-kit.js') + read('assets/office-kit.js') + read('assets/lab-kit.js')), 'JS всё ещё анимирует style.width');
/* Межстраничные анимации выключены целиком */
ok(!sharedCss.includes('@view-transition') && !sharedCss.includes('view-transition-name'), 'View Transitions хрома не удалены');
/* общий хром подключён на всех страницах после остальных стилей
   (редирект-заглушка projects/glossary.html живёт без общих ассетов) */
const chromePages = allHtml.filter(f => f !== 'projects/glossary.html'
  && read(f).includes('assets/shared-chrome.css') && read(f).includes('assets/shared-chrome.js'));
ok(chromePages.length === allHtml.length - 1, 'shared-chrome подключён не на всех страницах кроме заглушки: ' + (allHtml.length - 1 - chromePages.length));
for (const f of allHtml) {
  const c = read(f);
  if (!c.includes('assets/shared-chrome.css')) continue;
  const chromePos = c.indexOf('shared-chrome.css');
  const scopePos = Math.max(c.indexOf('stands.css'), c.indexOf('site.css'));
  ok(chromePos > scopePos, f + ': shared-chrome.css должен идти после scope-стилей');
}
/* reduced-motion: глобальный сброс и точечные гарантии видимости */
ok(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*animation-duration: ?\.01ms/.test(siteCss), 'нет глобального reduced-motion сброса');
ok(sharedCss.includes('skeleton-pulse') && /prefers-reduced-motion[\s\S]*skeleton::after/.test(sharedCss), 'skeleton не глушится при reduced-motion');
/* мобильное меню — оверлей, а не перестройка шапки */
ok(/@media \(max-width: 880px\)[\s\S]*\.js-enabled \.site-nav[\s\S]*position: fixed/.test(siteCss), 'мобильное меню не стало fixed-оверлеем');
ok(!/transition:[^;]*max-height/.test(siteCss), 'остался max-height-переход меню');
/* липкий профиль и компактная пилюля */
ok(stCss.includes('position: sticky') && stCss.includes('.is-compact'), 'нет липкого профиля/компактного состояния');
/* скелетоны и резерв высот JS-контейнеров */
ok(sharedCss.includes('.skeleton') && /#board[^{]*\{[^}]*min-height/.test(sharedCss), 'нет резерва высот JS-блоков');
/* систем появления при загрузке больше нет: контент виден сразу */
ok(!siteJs.includes(".reveal") && !siteJs.includes("data-mark") && !siteJs.includes(".magnetic"), 'site.js: остались мёртвые системы reveal/data-mark/magnetic');
ok(!standsJs.includes('initReveal'), 'stands.js: initReveal не удалён');
ok(!siteCss.includes('js-enabled .reveal') && !siteCss.includes('.js-enabled .stagger'), 'site.css: остались скрытые состояния reveal/stagger');
ok(!stCss.includes('.reveal'), 'stands.css: остались правила .reveal');
ok(!siteCss.includes('.chart-bar { height: var(--h); transform: scaleY(0)'), 'site.css: график снова прячется до reveal');


/* 22. Статичный рендер: межстраничных и входных анимаций нет вообще */
ok(!exists('assets/flow.js') && !exists('assets/flow.css'), 'flow-файлы не удалены');
for (const f of allHtml) {
  const c = read(f);
  ok(!c.includes('flow.css') && !c.includes('flow.js'), f + ': подключены flow-ассеты');
  ok(!c.includes('data-flow') && !c.includes('data-mark'), f + ': остались атрибуты входных анимаций');
  ok(!/class="[^"]*\b(reveal|stagger)\b/.test(c), f + ': остались классы reveal/stagger');
  ok(!/class="hero-title[^"]*text-(?:3xl|4xl|5xl|6xl)/.test(c), f + ': hero-title с Tailwind-размером вместо единого токена');
}
/* в CSS не осталось входных/фоновых keyframes: список удалённых систем */
const motionCss = siteCss + stCss + opsCss + sharedCss;
for (const kf of ['page-in', 'note-in', 'pub-in', 'marquee-scroll', 'status-pulse', 'emoji-float',
  'glyph-drift', 'glyph-float', 'orb-drift', 'nav-hero-anim', 'mc-float', 'mc-blink', 'mc-wave',
  'dot-pulse', 'cursor-blink', 'plate-ring', 'ps-ping', 'flow-glyph-drift', 'flow-bubble-float',
  'flow-rise', 'flow-pop', 'flow-modal-in', 'flow-menu-in']) {
  ok(!motionCss.includes('@keyframes ' + kf), 'CSS: остался keyframes ' + kf);
}
/* бесконечных фоновых анимаций нет: infinite остаётся только у функциональных
   индикаторов (загрузка/лоадер) — skeleton/spin */
for (const line of (siteCss + '\n' + stCss).split('\n')) {
  if (/animation:[^;]*infinite/.test(line)) {
    ok(/skeleton|spin|party/.test(line), 'site/stands: декоративная infinite-анимация: ' + line.trim().slice(0, 80));
  }
}
/* отсутствие VT-именования во всех CSS */
ok(!siteCss.includes('view-transition') && !stCss.includes('view-transition'), 'CSS: остались view-transition правила');
/* tw-fallback — базовый слой: работает без маркера .tw-failed */
const twFb = read('assets/tw-fallback.css');
ok(!twFb.includes('html.tw-failed .'), 'tw-fallback всё ещё требует маркер .tw-failed');
ok(twFb.includes('.grid {') && twFb.includes('.flex {'), 'tw-fallback: нет базовых display-утилит');
ok(twFb.includes('space-y-3'), 'tw-fallback: нет вертикального ритма space-y');
/* загрузчик Tailwind: таймаут 3с (маркер .tw-failed остаётся) */
for (const f of rootHtml) {
  const c = read(f);
  if (c.includes('cdn.tailwindcss.com')) ok(c.includes('},3000)'), f + ': таймаут Tailwind не 3с');
}

/* 23. Единый глоссарий, тренажёры netsys, навигация FAQ */
const stubHtml = read('projects/glossary.html');
ok(stubHtml.includes('http-equiv="refresh"') && stubHtml.includes('noindex'), 'projects/glossary.html: не редирект-заглушка');
ok(stubHtml.includes('stands/glossary.html'), 'заглушка не ссылается на единый словарь');
ok(!sm.includes('projects/glossary'), 'sitemap.xml всё ещё содержит заглушку');
ok(read('projects.html').includes('href="stands/glossary.html"'), 'projects.html: карточка глоссария не ведёт в единый словарь');
const glCount = (read('stands/glossary.html').match(/class="glossary-item"/g) || []).length;
ok(glCount === 74, 'терминов в едином глоссарии должно быть 74, фактически ' + glCount);
const glAll = read('stands/glossary.html');
for (const term of ['VPN', 'контейнеризация', 'первичный ключ (PK)']) {
  ok(glAll.includes(term), 'в глоссарии нет термина: ' + term);
}
ok(read('projects.html').includes('netsys_trainer') && read('sitemap.html').includes('netsys_trainer'), 'тренажёры netsys не встроены в проекты/карту');
ok(read('projects.html').includes('3 из 6 доступно'), 'projects.html: счётчик зоны 01 не обновлён');
ok(JSON.parse(read('feed-counts.json')).projects === 4, 'feed-counts: projects должен быть 4');
ok(read('faq.html').includes('href="#faq-start"') && read('faq.html').includes('глоссарий · 74 термина'), 'faq.html: нет оглавления или обновлённой кнопки');
/* важное «выше»: hero-действия на projects и faq на первом экране */
ok(/hero-lead[\s\S]{0,600}?href="stands\/index.html" class="btn btn-primary btn-sm"/.test(read('projects.html')), 'projects.html: нет hero-кнопки стендов');
ok(read('faq.html').includes('btn btn-primary btn-sm" href="stands/index.html"'), 'faq.html: нет верхней кнопки стендов');

/* 24. Дизайн-качество: AA-контраст акцентов, нет стекла, тело от 16px */
for (const cf of ['site.css', 'stands.css', 'ops.css', 'office.css', 'shared-chrome.css', 'tw-fallback.css']) {
  ok(!read('assets/' + cf).includes('backdrop-filter'), cf + ': остался backdrop-filter (стекло)');
}
ok(!siteCss.includes('.text-gradient') && !read('projects/esports.html').includes('text-gradient'), 'градиентный текст не удалён');
ok(siteCss.includes('--fs-body: 1rem'), 'тело меньше 16px');
ok(siteCss.includes('--accent: #c2410c'), 'оранжевый акцент не AA (светлая тема)');
ok(siteCss.includes(':root[data-theme="dark"] .btn-primary'), 'тёмная тема: нет тёмного текста на главных кнопках');
ok(stCss.includes('--st-accent: #0f766e'), 'teal стендов не AA в светлой теме');
ok(!siteCss.includes('wght@300') && read('index.html').includes('Inter:wght@400;500;600;700;800'), 'Inter: лишнее начертание 300');
for (const f of allHtml) {
  const c = read(f);
  ok(!c.includes('wght@300'), f + ': шрифтовая строка со стартом 300');
  ok(!c.includes('?v=20261031ac') && !c.includes('?v=20261031ab'), f + ': не поднята версия ассетов');
}

/* 25. Связка лига ↔ команды ↔ биржа ↔ ДатаПолис */
const lgNew = read('assets/league.js');
ok(lgNew.includes("claims: 'league-claims'") && lgNew.includes('REWARDS'), 'league.js: нет биржи привилегий');
ok(lgNew.includes("'point-wipe'") && lgNew.includes("'rescue'") && lgNew.includes("'grade-plus'"), 'league.js: нет наград «точка/двойка/четвертная»');
ok(lgNew.includes('function createClaim') && lgNew.includes('function cancelClaim') && lgNew.includes('function refundClaim') && lgNew.includes('function setClaimStatus'), 'league.js: API ордеров (создание/отмена/возврат/решение) неполон');
ok(lgNew.includes("claim.status !== 'local'") && lgNew.includes("claim.status !== 'rejected'"), 'league.js: семантика отмены/возврата ордеров нарушена');
ok(lgNew.includes("bonus трайба".replace('bonus','бонус')) || lgNew.includes('бонус трайба'), 'league.js: нет PRP-бонуса за ревью своему трайбу');
ok(lgNew.includes('standingsSnapshot') && lgNew.includes("schema: 'standings/1'"), 'league.js: нет снапшота стенда');
ok(lgNew.includes("'league-bundle/3'"), 'league.js: бандлы не v3');
ok(lgNew.includes("'streak-7'") && lgNew.includes("'tribe-mentor'") && lgNew.includes('mentorReviews >= 3'), 'league.js: нет достижений за серию входов и наставничество');
ok(lgNew.includes('checks[\'tribe-mentor\']'), 'league.js: tribe-mentor не в checks');
ok(lgNew.includes('report.claims++'), 'league.js: importBundle не мерджит ордера');
const std = read('assets/standings.js');
ok(std.includes('standings/standings.json') && std.includes('standings/1'), 'standings.js: неверный источник стенда');
ok(std.includes('CACHE_TTL') && std.includes('cached ? cached.data : null'), 'standings.js: нет кэша и stale-fallback');
ok(read('stands/rewards.html').includes('rewards-page.js') && read('stands/rewards.html').includes('data-standings="claims"'), 'rewards.html: не подключены движок биржи и общий список');
ok(read('stands/teams.html').includes('data-standings="tribes"') && read('stands/teams.html').includes('data-standings="members"'), 'teams.html: нет живого командного зачёта');
ok(read('stands/league.html').includes('data-standings="tribes"'), 'league.html: нет публичного стенда');
ok(read('stands/index.html').includes('rewards.html') && read('stands/index.html').includes('ops/crew-ops.html'), 'stands/index.html: нет блока общей экономики');
ok(read('assets/submissions.js').includes("'standings', 'standings.json'"), 'submissions.js: публикация стенда не на standings/standings.json');
ok(read('admin.html').includes('standings-publish') && read('admin.html').includes('claims-tbody'), 'admin.html: нет публикации стенда и карточки ордеров');
ok(read('assets/submissions.js').includes("renderClaims();") && read('assets/submissions.js').includes("league-bundle\\/[123]"), 'submissions.js: ордера не обновляются после импорта бандлов v3');
ok(read('assets/rewards-page.js').includes('data-cancel'), 'rewards-page.js: нет кнопки отмены ордера');
ok(read('assets/league-page.js').includes('rewardSpend') && read('assets/league-page.js').includes('rewards.html'), 'league-page.js: журнал биржи без названий или нет ссылки на биржу');
ok(read('assets/league-page.js').includes('ordersInWork'), 'league-page.js: нет статуса ордеров на странице лиги');
ok(read('admin.html').includes('assets/ops-engine.js'), 'admin.html: ops-engine не подключён для снапшота ДатаПолиса');
const oe = read('assets/ops-engine.js');
ok(oe.includes('CREW_OPS') && oe.includes('closeCrewOp') && oe.includes('ops-crew-points'), 'ops-engine.js: нет командных операций');
ok(oe.includes('crewop:') && oe.includes("W' + w"), 'ops-engine.js: нет недельного дедупа операций');
ok(oe.includes("'ops-bundle/2'") && oe.includes('crewsSnapshot'), 'ops-engine.js: бандл ops не v2 или нет снапшота экипажей');
ok(read('stands/ops/crew-ops.html').includes('ops-hub.js') && read('stands/ops/crew-ops.html').includes('crew-ops-root'), 'crew-ops.html: не подключён движок кабинета');
ok(read('stands/ops/index.html').includes('crew-ops.html'), 'ops/index.html: нет входа на операции экипажа');
for (const term of ['биржа привилегий', 'ордер', 'операция экипажа', 'очки экипажа', 'стенд лиги']) {
  ok(read('stands/glossary.html').includes(term), 'в глоссарии нет термина: ' + term);
}
ok(read('faq.html').includes('faq-rewards') && read('faq.html').includes('06 · технические требования'), 'faq.html: нет раздела наград или сбита нумерация');
ok(read('sitemap.html').includes('stands/rewards.html') && read('sitemap.html').includes('stands/ops/crew-ops.html'), 'sitemap.html: нет биржи или операций экипажа');
ok(read('stands/teams.html').includes('живой командный зачёт (04) подгружается'), 'teams.html: noscript-бар не предупреждает о живом разделе');
ok(read('stands/league.html').includes('list-lead st-mt-4') && !read('stands/league.html').includes('style="font-size:1rem;"'), 'league.html: inline-стили в блоке стенда');
ok(read('stands/index.html').includes('биржей') && read('stands/index.html').includes('операции экипажа: смена вахты'), 'stands/index.html: карточки вселенных без новых механик');

console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail) { console.log(fails.slice(0, 40).join('\n')); process.exit(1); }
