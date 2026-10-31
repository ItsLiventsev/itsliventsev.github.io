/* Регрессионный харнесс статики (zero-deps, node >=18). Запуск: node /tmp/domtest/regression-static.js */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION = '20261031ay';
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
ok(allHtml.length === 75, 'HTML страниц должно быть 75, фактически ' + allHtml.length);
ok(standsHtml.length === 52, 'stands-страниц 52, фактически ' + standsHtml.length);

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
ok(locs.length === 71, 'sitemap URL = 71, фактически ' + locs.length);
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
ok(dkPages.length === 52, 'dom-kit подключён на 52 страницах (51 stands + admin), фактически ' + dkPages.length);

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
  ok(!s.includes('cdn.tailwindcss.com'), f + ': Tailwind Play CDN не убран из продакшена');
}


/* 20. ОфисПолис: изоляция, движок, единое меню */
const offEng = read('assets/office-engine.js');
const offKit = read('assets/office-kit.js');
ok(/profile: 'office-profile'/.test(offEng) && /ledger: 'office-ledger'/.test(offEng) && /submissions: 'office-submissions'/.test(offEng), 'ключи OFFICE не изолированы префиксом office-');
ok(!/ops-profile|stands-submissions/.test(offEng), 'office-engine пересекается с чужими ключами');
ok(offEng.includes("schema: 'office-bundle/2'") && offKit.includes("schema: 'office-submission/1'"), 'схемы office-артефактов потеряны');
ok(offEng.includes('REWARDS_OFFICE') && offEng.includes("'office-claims'") && offEng.includes('function createClaim') && offEng.includes('function cancelClaim') && offEng.includes('function refundClaim'), 'office-engine: биржа ОфисПолиса неполна');
ok(offEng.includes('function importBundle') && offEng.includes('migrating'), 'office-engine: нет переноса прогресса');
/* единый движок трёх бирж */
const rwp = read('assets/rewards-page.js');
ok(rwp.includes('UNIVERSES') && rwp.includes("data-rewards") && rwp.includes('league') && rwp.includes('ops') && rwp.includes('office'), 'rewards-page.js: не единый движок трёх бирж');
ok(rwp.includes('data-cancel') && rwp.includes('data-refund') && rwp.includes('data-reward'), 'rewards-page.js: нет ордерных действий');
ok(read('stands/rewards.html').includes('data-rewards="league"') && !read('stands/rewards.html').includes('rewards-page.js?v=20261031ae'), 'rewards.html: нет маркера вселенной');
ok(read('stands/ops/rewards.html').includes('data-rewards="ops"') && read('stands/ops/rewards.html').includes('data-standings="ops-claims"') && !read('stands/ops/rewards.html').includes('ops-rewards-page.js'), 'ops/rewards.html: не подключён единый движок');
ok(read('stands/office/rewards.html').includes('data-rewards="office"') && read('stands/office/rewards.html').includes('data-standings="office-claims"') && read('stands/office/rewards.html').includes('rewards-page.js'), 'office/rewards.html: не подключён единый движок');
ok(!read('stands/ops/rewards.html').includes('id="gate-form"'), 'ops/rewards.html: гейт-форма дублирует консоль (риск crash renderDashboard)');
ok(offKit.includes("'officekit:'") && offKit.includes('#office-data') && offKit.includes('OFFICE.award'), 'office-kit не использует officekit:/OFFICE');
for (const f of walk('stands/office', /\.html$/)) {
  const c = read(f);
  ok(c.includes('office.css') && c.includes('office-scope') && c.includes('data-accent="cocoa"'), f + ': нет office-scope/cocoa');
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
/* 24a. Стекло 2.0 (политика 2026, снят запрет владельцем): blur только
   с @supports-деградацией, -webkit-префиксом и полупрозрачной подложкой */
for (const cf of ['site.css', 'stands.css', 'ops.css', 'office.css', 'shared-chrome.css']) {
  const css = read('assets/' + cf);
  if (css.includes('backdrop-filter')) {
    ok(/@supports[^{]*backdrop-filter/.test(css), cf + ': backdrop-filter без @supports-деградации');
    ok(css.includes('-webkit-backdrop-filter'), cf + ': blur без -webkit- префикса');
    ok(css.includes('color-mix(in srgb'), cf + ': стекло без полупрозрачной подложки color-mix');
  }
}
ok(stCss.includes('--st-glass-blur: 14px'), 'stands.css: нет токена --st-glass-blur');
/* дизайн 2026 · волна 2: aurora, градиентные заголовки, свечение */
ok(stCss.includes('radial-gradient(52rem 30rem at 84% -6rem'), 'stands.css: нет aurora-фона вселенных');
ok(stCss.includes('background-clip: text') && stCss.includes('linear-gradient(96deg, var(--st-text) 46%'), 'stands.css: градиентные дисплейные заголовки потеряны');
ok(stCss.includes('left bottom / 100% 1px'), 'stands.css: нет градиентной линейки секций');
ok(stCss.includes('.st-topnav a:hover::after'), 'stands.css: нет выезжающего подчёркивания навигации');
ok(stCss.includes('.flat-btn:hover:not([disabled])') && stCss.includes('linear-gradient(135deg'), 'stands.css: кнопки без градиента и свечения');
ok(stCss.includes('.rw-balance, .resume-card'), 'stands.css: фичер-карточки без стекла');
ok(siteCss.includes('radial-gradient(60rem 34rem at 88% -8rem'), 'site.css: нет тёплого поля aurora');
ok(stCss.includes('.resume-card') && read('assets/shared-chrome.js').includes('stands-last-'), 'нет механики «продолжить с места»');
ok(stCss.includes('clamp(1.7rem, 4.6vw, 2.65rem)'), 'stands.css: hero-заголовок не масштабирован (дизайн 2026)');
ok(stCss.includes('.rw-card:hover') && stCss.includes('.ops-cocard:hover'), 'stands.css: нет микро-отклика карточек');
/* дизайн 2026 · волна 3: bento-хаб и микро-детали */
ok(read('stands/index.html').includes('bento-cell--wide') && read('stands/index.html').includes('экосистема практики'), 'stands/index.html: bento-хаб не собран');
ok(stCss.includes('.bento-cell:hover') && stCss.includes('grid-template-columns: repeat(6, 1fr)'), 'stands.css: нет стилей bento');
ok(stCss.includes('.flat-scope ::selection') && siteCss.includes('::selection'), 'нет акцентного выделения текста');
ok(stCss.includes('scrollbar-width: thin') && siteCss.includes('scrollbar-width: thin'), 'нет тонких скроллбаров');
ok(siteCss.includes('background: var(--neo-footer-bg);') && siteCss.includes('.site-footer {\n  display: flex;'), 'site.css: нео-футер утрачен (слой слит)');
/* дизайн 2026 · волна 4: баблы вместо квадратов + фиксы UX */
ok(stCss.includes('--st-radius: 14px') && !stCss.includes('--st-radius: 2px'), 'stands.css: радиус-революция не проведена (остались 2px)');
ok(stCss.includes('.flat-scope .st-topnav { scrollbar-width: none;'), 'stands.css: скроллбар навигации снова виден');
ok(/\.flat-btn\[disabled\] \{[^}]*color: var\(--st-faint\)/.test(stCss), 'stands.css: белый текст на disabled-кнопках биржи');
ok(stCss.includes('.flat-btn, .st-topnav a, .st-section-num,') && stCss.includes('border-radius: 999px'), 'stands.css: пилюли не применены');
ok(stCss.includes('.st-hero-index, .flat-index { border-radius: 1.25rem; }'), 'stands.css: hero-индекс не скруглён');
ok(siteCss.includes('--sk: 0') && siteCss.includes('translateY(calc(var(--sk) * -16px))'), 'site.css: кинетическая типографика не подключена');
ok(siteCss.includes('clamp(2.4rem, 7vw, 4.25rem)'), 'site.css: hero-заголовок не укрупнён (гигантизм текста)');
ok(siteCss.includes('radial-gradient(60rem 34rem at 88% -8rem, color-mix(in srgb, var(--accent) 8%, transparent)'), 'site.css: тёплое поле aurora утрачено');
ok(siteCss.includes('.brand-cursor, #title-mark, .cursor-green') && siteCss.includes('-webkit-text-fill-color: currentColor'), 'site.css: каретки/курсоры не исключены из градиента');
ok(siteCss.includes('.btn, .icon-btn, .chip, .faq-toc a { border-radius: 999px; }'), 'site.css: кнопки основной площадки не пилюли');
ok(read('assets/shared-chrome.js').includes("setProperty('--sk'") && read('assets/shared-chrome.js').includes('prefers-reduced-motion'), 'shared-chrome.js: нет кинетического скролл-движка');
/* дизайн 2026 · волна 5: контрастная пара, трёхцветный aurora, кинетические outline-слова */
/* дизайн 2026 · волна 6: NEO — нео-брутализм с нуля (бумага/чернила/жёсткие тени) */
ok(siteCss.includes("--font-sans: 'Golos Text'") && siteCss.includes("--font-display: 'Unbounded'"), 'site.css: нет пары NEO Unbounded+Golos Text');
ok(siteCss.includes('--neo-paper: #f4efe4') && siteCss.includes('--neo-ink: #1a160c') && siteCss.includes('--neo-leaf: #5f8552'), 'site.css: нет NEO-палитры (бумага/чернила/шалфей)');
ok(siteCss.includes('--neo-verm: #e4572e') && siteCss.includes('--neo-rose: #c2527a') && !siteCss.includes('d8f24b') && !siteCss.includes('4338ca'), 'site.css: жёлтый/синий не выведены из палитры');
ok(siteCss.includes(':root[data-theme="dark"] {\n  --neo-leaf: #7ba36a;') && siteCss.includes('--neo-paper: #14110a;'), 'site.css: нет тёмной NEO-темы');
ok(siteCss.includes('--radius: 16px') && siteCss.includes('--radius-pill: 999px'), 'site.css: нет casual-скруглений');
ok(siteCss.includes('--shadow-card: var(--neo-hard)') && siteCss.includes('6px 6px 0 0 #1a160c'), 'site.css: нет жёстких offset-теней');
ok(siteCss.includes('--border: #1a160c') && siteCss.includes('--border-strong: #1a160c'), 'site.css: чернильные рамки не включены');
ok(siteCss.includes('.btn:active') && siteCss.includes('transform: translate(2px, 2px)'), 'site.css: нет микро-взаимодействия нажатия кнопок');
ok(siteCss.includes('.btn-primary {\n  background: var(--neo-ink)') && siteCss.includes('.btn-primary:hover {\n  background: var(--neo-verm)'), 'site.css: primary-кнопка без перехода чернила->верм');
ok(!siteCss.includes('.ticker') , 'site.css: тикер не удалён');
ok(siteCss.includes("skewX(calc(var(--sk, 0) * -2.4deg + var(--sq, 0) * -3deg))"), 'site.css: hero без скоростного наклона --sq');
ok(siteCss.includes('.nf-code') && siteCss.includes('.nf-title') && read('404.html').includes('nf-code'), '404: нет новой композиции nf-code');
ok(siteCss.includes('.prose-neo h2') && siteCss.includes('::first-letter'), 'site.css: нет слоя чтения статьи');
ok(!read('index.html').includes('ticker') && !read('index.html').includes('hero-sub'), 'index.html: тикер или мелкая строка теглайна остались');
ok(read('assets/shared-chrome.js').includes("setProperty('--sq'") && read('assets/shared-chrome.js').includes('(y - lastY) / 90'), 'shared-chrome.js: нет скоростного канала --sq');
ok(stCss.includes('--st-radius: 14px'), 'stands.css: вселенные не переведены на стикер-радиус');
ok(stCss.includes("font-family: var(--font-display)") && stCss.includes('.zt-serif'), 'stands.css: заголовки вселенных без NEO-пары');
ok(!stCss.includes('#5b9dff') && !stCss.includes('#2b63c8') && !stCss.includes('#fbbf24') && !stCss.includes('#2563eb'), 'stands.css: синий/жёлтый не выведены из палитры стендов');
ok(stCss.includes('radial-gradient(var(--grid-dot') && siteCss.includes('.st-global-header .site-nav'), 'нет унификации: сито на стендах или mobile-правило общего header');
ok(!siteCss.includes('rgba(14, 165, 233, .07)') && !siteCss.includes('rgba(14, 165, 233, .08)'), 'site.css: небесное (синее) поле aurora не удалено');
ok(!siteCss.includes('.ht-serif') && siteCss.includes('.giant-word'), 'site.css: outline-слова есть, мёртвый ht-serif удалён');
ok(siteCss.includes('-webkit-text-stroke: 2px') && !siteCss.includes('-webkit-text-stroke: 1.5px') && siteCss.includes('calc((var(--sk, 0) - .5) * -90px)'), 'site.css: outline-слова без кинетики (дубль волны-5 жив)');

ok(stCss.includes('.flat-btn { background: var(--st-btn-bg); }') && stCss.includes('position: sticky;'), 'stands.css: кнопки не солидные или топбар не липкий');
ok(read('index.html').includes('ht-tagline') && read('index.html').includes('giant-word--right'), 'index.html: нет теглайна в большом тексте и outline-слов');
ok(read('blog.html').includes('ht-word') && read('articles.html').includes('ht-word'), 'blog/articles: заголовки не переведены на крупный ht-word');
ok(read('stands/index.html').includes('zt-serif'), 'stands/index.html: нет серифных акцентов зон');
for (const eng of ['assets/league.js', 'assets/ops-engine.js', 'assets/office-engine.js']) {
  ok(read(eng).includes('function loginStreak') && read(eng).includes('loginStreak: loginStreak'), eng + ': нет единой механики streak');
}
ok(read('assets/rewards-page.js').includes('rw-streak') && read('assets/league-page.js').includes('серия'), 'нет отображения серии входов');
ok(!siteCss.includes('.text-gradient') && !read('projects/esports.html').includes('text-gradient'), 'градиентный текст не удалён');
ok(siteCss.includes('--fs-body: 1rem'), 'тело меньше 16px');
ok(siteCss.includes('--accent: #c2410c'), 'оранжевый акцент не AA (светлая тема)');
ok(siteCss.includes(':root[data-theme="dark"] .btn-primary'), 'тёмная тема: нет тёмного текста на главных кнопках');
ok(stCss.includes('--st-accent: #0f766e'), 'teal стендов не AA в светлой теме');
ok(!siteCss.includes('wght@300') && read('index.html').includes('Unbounded:wght@500;700;900') && !read('index.html').includes('Inter:wght@') && !read('index.html').includes('Playfair'), 'NEO: старые гарнитуры Inter/Playfair не удалены из шрифтовой строки');
for (const f of allHtml) {
  const c = read(f);
  ok(!c.includes('wght@300'), f + ': шрифтовая строка со стартом 300');
  if (c.includes('fonts.googleapis.com')) ok(c.includes('Unbounded:wght@500;700;900') && c.includes('Golos+Text:wght@400'), f + ': нет пары NEO Unbounded+Golos Text');
  ok(!c.includes('?v=20261031ax') && !c.includes('?v=20261031aw') && !c.includes('?v=20261031av'), f + ': не поднята версия ассетов');
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
/* унифицированное меню: «биржа» в топнаве всех страниц СетьПолиса, ops и office */
for (const navPg of ['stands/setpolis.html', 'stands/league.html', 'stands/teams.html', 'stands/glossary.html', 'stands/rewards.html']) {
  const c = read(navPg);
  const nav = c.slice(c.indexOf('st-topnav'), c.indexOf('</nav>', c.indexOf('st-topnav')));
  ok(nav.includes('href="rewards.html"'), navPg + ': топнав без «биржи»');
}
for (const navPg of ['stands/ops/index.html', 'stands/ops/crew-ops.html', 'stands/ops/rewards.html']) {
  const c = read(navPg);
  const nav = c.slice(c.indexOf('st-topnav'), c.indexOf('</nav>', c.indexOf('st-topnav')));
  ok(nav.includes('href="rewards.html"'), navPg + ': топнав без «биржи»');
}
for (const navPg of ['stands/office/index.html', 'stands/office/rewards.html']) {
  const c = read(navPg);
  const nav = c.slice(c.indexOf('st-topnav'), c.indexOf('</nav>', c.indexOf('st-topnav')));
  ok(nav.includes('href="rewards.html"'), navPg + ': топнав без «биржи»');
}
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
ok(oe.includes("'ops-bundle/3'") && oe.includes('crewsSnapshot'), 'ops-engine.js: бандл ops не v3 или нет снапшота экипажей');
ok(oe.includes('REWARDS_OPS') && oe.includes('createOpsClaim') && oe.includes('cancelOpsClaim') && oe.includes('refundOpsClaim') && oe.includes('function importBundle'), 'ops-engine.js: биржа ДатаПолиса или импорт бандлов неполны');
ok(oe.includes('migrating') && oe.includes('ev.profileId = me.id'), 'ops-engine.js: перенос прогресса без перепривязки профиля');
ok(oe.includes("'ops-claims'"), 'ops-engine.js: нет хранилища ордеров ops-claims');
ok(read('stands/ops/rewards.html').includes('data-standings="ops-claims"') && read('stands/ops/rewards.html').includes('rewards-page.js'), 'ops/rewards.html: не подключены движок биржи и общий список');
ok(read('stands/ops/index.html').includes('href="rewards.html"') && read('stands/ops/crew-ops.html').includes('href="rewards.html"'), 'ops: нет навигации на биржу ДатаПолиса');
ok(read('admin.html').includes('ops-claims-tbody') && read('assets/submissions.js').includes('renderOpsClaims') && read('assets/submissions.js').includes('ops-bundle\\/[123]'), 'admin: нет приёма ордеров ДатаПолиса');
ok(read('admin.html').includes('office-claims-tbody') && read('assets/submissions.js').includes('renderOfficeClaims') && read('assets/submissions.js').includes('office-bundle\\/[12]'), 'admin: нет приёма ордеров ОфисПолиса');
ok(read('admin.html').includes('assets/office-engine.js'), 'admin.html: office-engine не подключён');
ok(read('assets/standings.js').includes('renderOfficeClaims') && read('assets/standings.js').includes('office-claims'), 'standings.js: нет блока офис-ордеров');
ok(read('assets/submissions.js').includes('snapshot.office'), 'submissions.js: office-ордера не публикуются в стенд');
ok(read('assets/standings.js').includes('renderDatapolisClaims'), 'standings.js: нет рендера ордеров ДатаПолиса');
ok(read('stands/ops/crew-ops.html').includes('ops-hub.js') && read('stands/ops/crew-ops.html').includes('crew-ops-root'), 'crew-ops.html: не подключён движок кабинета');
ok(read('stands/ops/crew-ops.html').includes('data-standings="ops-crews"') && read('stands/ops/crew-ops.html').includes('standings.js'), 'crew-ops.html: нет командного зачёта экипажей');
ok(read('assets/standings.js').includes('renderOpsCrews') && read('assets/standings.js').includes('opsCrewsTable'), 'standings.js: нет рендера экипажей ДатаПолиса');
ok(read('assets/ops-engine.js').includes('opsTitles'), 'ops-engine.js: снапшот без названий операций');
ok(read('stands/teams.html').includes('data-standings="ops-crews"'), 'teams.html: экипажи не показаны рядом с трайбами');
ok(read('stands/ops/index.html').includes('crew-ops.html'), 'ops/index.html: нет входа на операции экипажа');
for (const term of ['биржа привилегий', 'ордер', 'операция экипажа', 'очки экипажа', 'стенд лиги']) {
  ok(read('stands/glossary.html').includes(term), 'в глоссарии нет термина: ' + term);
}
ok(read('faq.html').includes('faq-rewards') && read('faq.html').includes('06 · технические требования'), 'faq.html: нет раздела наград или сбита нумерация');
ok(read('sitemap.html').includes('stands/rewards.html') && read('sitemap.html').includes('stands/ops/crew-ops.html'), 'sitemap.html: нет биржи или операций экипажа');
ok(read('stands/teams.html').includes('живой командный зачёт (04) подгружается'), 'teams.html: noscript-бар не предупреждает о живом разделе');
ok(read('stands/league.html').includes('list-lead st-mt-4') && !read('stands/league.html').includes('style="font-size:1rem;"'), 'league.html: inline-стили в блоке стенда');
ok(read('stands/index.html').includes('биржей') && read('stands/index.html').includes('операции экипажа: смена вахты'), 'stands/index.html: карточки вселенных без новых механик');

/* дизайн 2026 · волна 7: casual — блоки-цвета, ремап акцентов, буквицы */
ok(siteCss.includes('--neo-leaf-tint') && siteCss.includes('--neo-rose-tint') && siteCss.includes('.light-card {\n  background: linear-gradient'), 'site.css: нет цветных блоков (Craft-стиль)');
ok(siteCss.includes('.note-excerpt::first-letter') && siteCss.includes('.prose-neo > p:first-of-type'), 'site.css: нет буквиц и лида');
ok(siteCss.includes('.ht-tagline') && siteCss.includes('.ht-slash'), 'site.css: нет типографской композиции hero');
ok(siteCss.includes('body[data-accent="rust"]   { --accent: #cf4a18;'), 'site.css: rust-акцент не на коралле');
ok(siteCss.includes('body[data-accent="cocoa"]  { --accent: #96602a;') && siteCss.includes('body[data-accent="sage"]    { --accent: #4f7a44;'), 'site.css: нет акцентов cocoa/sage');
ok(siteCss.includes('--accent: #ff7a47;') && !siteCss.includes('#3b82f6'), 'site.css: синий не выведен из тёмной темы');
ok(siteCss.includes('.note-card[data-type="digest"]  { --note-accent: #c2410c; }'), 'site.css: синий не выведен из типов заметок');
ok(stCss.includes('--st-radius: 14px') && stCss.includes('border-radius: 999px'), 'stands.css: нет casual-пилюль');
for (const f of ['assets/site.css']) { const c = read(f); ok(!c.includes('Playfair'), f + ': остался Playfair'); }

/* дизайн 2026 · волна 8: унификация — общий header на стендах, проекты чисты */
let uniCnt = 0;
for (const f of standsHtml) if (read(f).includes('st-global-header')) uniCnt++;
ok(uniCnt === standsHtml.length, 'стенды с общим header: ' + uniCnt + ' из ' + standsHtml.length);
for (const f of standsHtml.filter(x => x.split('/').length === 3)) {
  ok(read(f).includes('href="../../index.html" class="logo"'), f + ': глобальный header без учёта глубины');
}
ok(stCss.includes('.flat-scope .site-header {\n  position: static;') && stCss.includes('.st-topbar {\n  position: sticky;'), 'stands.css: header/topbar не разведены по слоям');
ok(stCss.includes('--st-bg: #f4efe4') && stCss.includes('--st-bg: #14110a'), 'stands.css: фон стендов не переведён на бумагу NEO');
ok(stCss.includes('--st-win: #d6c9b2') && stCss.includes('--st-win: #6b5d45'), 'stands.css: Windows-метки не выведены из синего');
ok(stCss.includes('--st-accent: #a83a12') && stCss.includes('--st-accent: #ff8a54'), 'stands.css: дефолтный акцент не переведён на коралл');
ok(stCss.includes('--st-accent: #fb923c') && !stCss.includes('#fcd34d'), 'stands.css: янтарный (жёлтый) акцент офиса не переведён на оранжевый');
ok(stCss.includes('.uni-card--netpolis { --card-accent: #0f766e; }'), 'stands.css: карточка СетПолиса не на teal');
ok(!read('projects.html').includes('system-badge') && !read('projects.html').includes('#3b82f6') && !read('projects.html').includes('#2563eb'), 'projects.html: остались бейдж system:// или синие акценты');
ok(siteCss.includes('.tag-blue   { color: #cf4a18;'), 'site.css: tag-blue не перекрашен');

/* дизайн 2026 · волна 9: polish — находки аудита */
const twCompiled = exists('assets/tw-compiled.css') ? read('assets/tw-compiled.css') : '';
ok(twCompiled.includes('.flex{') && twCompiled.includes('grid-cols-\\[200px'), 'tw-compiled.css: сборка неполна');
let twCnt = 0;
for (const f of allHtml) if (read(f).includes('tw-compiled.css')) twCnt++;
ok(twCnt === 22, 'страниц с локальной сборкой Tailwind: ' + twCnt + ' из 22');
ok(siteCss.includes('overflow-x: clip') && siteCss.includes('@media (max-width: 640px) {\n  .giant-word { display: none; }'), 'site.css: нет мобильного overflow-clip/скрытия гигантов');
ok(siteCss.includes("--font-sans: 'Golos Text'") && siteCss.split("--font-sans:").length === 2, 'site.css: --font-sans определён не единожды');
ok(!siteCss.includes('-webkit-text-stroke: 1.5px'), 'site.css: mono-дубль .giant-word (волна 5) не вычищен');
ok(siteCss.split('.site-footer {').length === 2, 'site.css: .site-footer задан не единожды (старые слои живы)');
ok(siteCss.includes('--neo-footer-bg: #201b10'), 'site.css: тёмный футер не смягчён');
ok(siteCss.includes('color: var(--muted);\n  font-family: var(--font-mono);\n  font-size: var(--fs-micro);'), 'site.css: nav-wip не поднят по контрасту');
ok(stCss.includes('--st-hard-color: rgba(239, 232, 214, .3)') && !stCss.includes('rgba(0, 0, 0, .75)'), 'stands.css: тени тёмной темы не инвертированы');
ok(!read('stands/lab-dns-bind.html').includes('SSH'), 'lab-dns-bind.html: чужой title не вычищен (JSON-LD)');
ok(!read('stands/lab-dns-bind.html').includes('sudoers'), 'lab-dns-bind.html: чужое description не вычищено');
ok(read('assets/shared-chrome.js').includes("main.querySelector('#profile-gate')"), 'shared-chrome.js: нет скрытия формы при активной сессии');
ok(read('blog.html').includes('posts.length < 2'), 'blog.html: фильтры не скрываются при единственной записи');

/* дизайн 2026 · волна 10: system — акценты, i18n, пасхалки, перенос профиля */
let badAcc = 0;
for (const f of allHtml) {
  const c = read(f);
  if (/data-accent="(blue|amber|teal|cyan)"/.test(c)) badAcc++;
}
ok(badAcc === 0, 'страниц со старыми именами акцентов (blue/amber/teal/cyan): ' + badAcc);
ok(siteCss.includes('body[data-accent="sage"] .ambient .orb'), 'site.css: emerald-орб не переведён на sage');
ok(!siteCss.includes('data-accent="emerald"') && !siteCss.includes('data-accent="cyan"'), 'site.css: мёртвые селекторы cyan/emerald живы');
ok(exists('assets/i18n.js') && read('assets/i18n.js').includes('window.I18N') && read('assets/i18n.js').includes("itsliventsev-lang"), 'i18n.js: нет реестра или персиста языка');
ok(read('index.html').includes('window.I18N.register') && !read('index.html').includes('function toggleLang'), 'index.html: i18n-движок не вынесен из страницы');
ok(read('index.html').includes('assets/i18n.js?v=' + VERSION), 'index.html: i18n.js без версии или старой версии');
ok(read('assets/shared-chrome.js').includes('konami') && read('assets/shared-chrome.js').includes("querySelector('#logo, .logo')") && read('assets/shared-chrome.js').includes('bounce-click'), 'shared-chrome.js: пасхалки не в общем JS');
ok(!read('index.html').includes('party-mode'), 'index.html: inline-пасхалки не удалены');
ok(read('assets/rewards-page.js').includes('rw-io') && read('assets/rewards-page.js').includes("parsed.universe !== uni") && read('assets/rewards-page.js').includes('itsliventsev-' ) , 'rewards-page.js: нет экспорта/импорта профиля с валидацией');
ok(stCss.includes('.rw-io') && stCss.includes('.rw-io-btn'), 'stands.css: нет стилей блока переноса профиля');
ok(!read('assets/admin.js').includes('cdn.tailwindcss.com') && !read('assets/admin.js').includes('Inter:wght@') && read('assets/admin.js').includes('tw-compiled.css'), 'admin.js: шаблон генерируемых страниц остался на CDN/Inter');
ok(read('assets/admin.js').includes('Golos+Text'), 'admin.js: шаблон не переведён на пару NEO');
ok(siteCss.includes('::placeholder { color: var(--muted); opacity: 1; }') && siteCss.includes('@media (pointer: coarse)'), 'site.css: нет плейсхолдеров/тач-зон');
ok(stCss.includes('.flat-scope ::placeholder') && stCss.includes('min-height: 44px'), 'stands.css: нет плейсхолдеров/тач-зон');

/* дизайн 2026 · волна 11: inherit — единые h1, палитра вместо tailwind-цветов */
let dhCnt = 0, twColor = 0;
for (const f of allHtml) {
  const c = read(f);
  if (c.includes('dark-hero-title')) dhCnt++;
  if (/text-(blue|emerald|rose|red|indigo|purple|sky|amber|teal|cyan|yellow)-[0-9]{3}/.test(c)) twColor++;
}
ok(dhCnt === 0, 'страниц с мёртвым dark-hero-title: ' + dhCnt);
ok(twColor === 0, 'страниц с жёсткими tailwind-цветами: ' + twColor);
ok(!siteCss.includes('dark-hero-title'), 'site.css: мёртвые правила dark-hero-title не удалены');
for (const f of ['projects.html', 'archive.html', 'stands/index.html', 'projects/esports.html']) {
  ok(read(f).includes('ht-word'), f + ': заголовок не в едином приёме ht-word');
}
ok(read('articles.html').includes('class="stat-num"') && siteCss.includes('.stat-num'), 'articles: стат-цифры не в Unbounded');
ok(!read('articles.html').includes('text-blue-600') && !read('index.html').includes('text-emerald-600'), 'жёсткие цвета стат/маркеров не вычищены');
ok(siteCss.includes('.cursor-purple { color: #c2527a; }') && siteCss.includes('.cursor-orange { color: #96602a; }'), 'site.css: курсоры терминала не переведены на палитру');
ok(siteCss.includes('.scroll-progress {\n  height: 3px;\n  background: var(--neo-verm);'), 'site.css: прогресс чтения не в NEO');
ok(siteCss.includes('#to-top {\n  border-radius: var(--radius-sm);\n  border: 2px solid var(--neo-ink);'), 'site.css: кнопка наверх не в NEO');

/* дизайн 2026 · волна 11 (часть 2): полная зачистка старой палитры */
const staleHex = /(1e40af|3b82f6|2563eb|60a5fa|93c5fd|7c3aed|8b5cf6|6d28d9|a78bfa|818cf8|f59e0b|fbbf24|c4b5fd)/;
ok(!staleHex.test(siteCss), 'site.css: остались жёсткие hex старой (сине-фиолетово-жёлтой) палитры');
ok(!/rgba\((37, 99, 235|59, 130, 246|139, 92, 246|96, 165, 250|129, 140, 248|251, 191, 36|245, 158, 11)/.test(siteCss), 'site.css: остались rgba старой палитры');
ok(!staleHex.test(stCss), 'stands.css: остались hex старой палитры');
ok(siteCss.includes('.light-band {\n  background: var(--neo-surface);') && siteCss.includes('.color-band {\n  border-radius: var(--radius);\n  padding: clamp(1.5rem, 3vw, 2rem);\n  background: linear-gradient(135deg, var(--neo-leaf-tint), var(--neo-rose-tint));'), 'site.css: банды esports не переведены на NEO');
ok(siteCss.includes('radial-gradient(circle at 72% 18%, rgba(95, 133, 82, .4)') && siteCss.includes('box-shadow: var(--neo-hard);\n  display: flex;'), 'site.css: hero-panel не переведён на NEO-дуотон');
ok(siteCss.includes('--aur-violet: #c2527a;'), 'site.css: фиолетовое поле aurora не переведено на розу');
ok(siteCss.includes('.game-hs   { color: #96602a;') && siteCss.includes('.game-lol  { color: #cf4a18;'), 'site.css: игровые теги не в палитре');
ok(siteCss.includes('.split-bar .seg-theory { background: linear-gradient(90deg, #cf4a18, #96602a); }'), 'site.css: сплит-бар не в палитре');
ok(!siteCss.includes('text-indigo'), 'site.css: мёртвые tailwind-переопределения индиго живы');

/* дизайн 2026 · волна 12: typо — дисплейная типографика чтения */
const art = read('articles/praktiko-orientirovannoe-obuchenie-i-trudoustroystvo-vypusknikov.html');
ok(art.includes('<h1 class="article-title mb-6">') && !art.includes('md:text-[34px]'), 'статья: заголовок не переведён на article-title');
ok(siteCss.includes('.article-title {') && siteCss.includes('text-wrap: balance'), 'site.css: нет article-title с балансировкой строк');
ok(siteCss.includes('.zone-title, .esp-title, .p-title {\n  font-family: var(--font-display);'), 'site.css: заголовки секций/карточек не в дисплейной паре');
ok(siteCss.includes('.prose-neo p { text-wrap: pretty; }'), 'site.css: абзацы чтения без pretty');
ok(read('blog.html').includes('ht-word') && read('articles.html').includes('ht-word'), 'списки: ht-word утрачен');

/* дизайн 2026 · волна 13: buttons — единая система, ноль переливов */
ok(!siteCss.includes('--glow-accent') && !stCss.includes('--glow-accent'), 'глоу-переменная не удалена из CSS');
ok(!siteCss.includes('btn-gradient') && !siteCss.includes('linear-gradient(92deg, var(--accent)'), 'site.css: градиентная кнопка не удалена');
ok(!siteCss.includes('linear-gradient(115deg, var(--accent) 15%') && !siteCss.includes('#5b21b6'), 'site.css: хвост градиентной btn-primary (волна 5) жив');
ok(!siteCss.includes('0 12px 28px -12px color-mix(in srgb, var(--accent)') && !stCss.includes('0 12px 28px -12px color-mix(in srgb, var(--st-accent)'), 'глоу-хвост волны 4 на btn-primary/flat-btn жив');
ok(!stCss.includes('0 6px 18px -8px var(--st-accent)') && !stCss.includes('0 14px 30px -18px color-mix(in srgb, var(--st-accent)'), 'стенды: мягкие свечения кнопок/карточек наград живы');
ok(siteCss.includes('.quick-bubble {') && siteCss.includes('.quick-bubble:active { transform: translate(2px, 2px);'), 'site.css: quick-bubble не в единой системе нажатия');
ok(siteCss.includes('color: #fff !important;\n  box-shadow: var(--neo-hard-sm);\n}'), 'site.css: is-active фильтр без жёсткой тени');
ok(stCss.includes('.flat-btn:hover:not([disabled]),\n.flat-btn:focus-visible:not([disabled]) {\n  transform: translate(-2px, -2px);'), 'stands.css: нет финального слова каскада для flat-btn');
ok(stCss.includes('.theme-toggle:active { transform: translate(1px, 1px);'), 'stands.css: theme-toggle вне системы нажатия');
ok(siteCss.includes('.light-card:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 0 var(--neo-ink); }'), 'site.css: light-card hover не в NEO');
let twGrad = 0;
const gradBtn = /linear-gradient\([^)]*\)[^}]*;?\s*\n?\s*border[^:]*:[^;]*;/;
ok(!/(?:^|[},\\s])\\.(?:btn|btn-primary|btn-ghost|btn-danger|btn-lg|btn-sm|flat-btn|filter-btn)[^{}]*\\{[^{}]*linear-gradient/.test(siteCss + stCss), 'на кнопках остались градиентные фоны');

/* дизайн 2026 · волна 14: navigation-case в NEO, адаптация */
ok(!siteCss.includes('nav-glass'), 'site.css: стекло кейса навигации не вычищено');
ok(siteCss.split('blur(70px)').length === 2, 'site.css: blur-поля вне reduce-блока живы');
ok(siteCss.includes('.nav-hero-title {\n  font-family: var(--font-display);') && siteCss.includes('radial-gradient(22rem 12rem at 88% -6rem'), 'site.css: hero кейса не в NEO');
ok(siteCss.includes('.sign-card:hover { transform: translate(-3px, -3px); box-shadow: 7px 7px 0 0 var(--neo-ink); }'), 'site.css: карточки знаков не в NEO');
ok(siteCss.includes('box-shadow: var(--neo-hard-sm);\n  max-width: calc(100vw - 2rem);'), 'site.css: док-меню кейса не в NEO');
ok(siteCss.includes('.stair-badge.letter { background: var(--nav-graphite);') && siteCss.includes('--nav-mint-ink'), 'site.css: контрасты кейса не подняты');
ok(stCss.includes('.flat-scope :focus-visible'), 'stands.css: нет единого фокуса');
ok(siteCss.includes('env(safe-area-inset-bottom'), 'site.css: нет safe-area для фиксированного хрома');

/* дизайн 2026 · волна 15: inherit2 — инлайны, легенды, утилиты */
const stalePal = /#(3b82f6|2563eb|8b5cf6|a78bfa|c084fc|60a5fa|93c5fd|7c3aed|6d28d9|ec4899|f472b6|0ea5e9|f59e0b|fbbf24|10b981)/;
ok(!stalePal.test(siteCss), 'site.css: вернулась старая палитра (hex)');
let hexHtml = 0;
for (const f of allHtml) {
  if (stalePal.test(read(f))) hexHtml++;
}
ok(hexHtml === 0, 'страниц со старыми hex в разметке: ' + hexHtml);
ok(!read('projects/esports.html').includes('linear-gradient(92deg,#3b82f6'), 'esports: инлайновый градиент CTA не удалён');
ok(read('projects/esports.html').split('style="').length - 1 <= 20, 'esports: инлайны не сконвертированы в утилиты');
ok(read('sitemap.html').split('style="').length - 1 === 0, 'sitemap: инлайны color:var(--muted) не сконвертированы');
ok(siteCss.includes('.ink-muted { color: var(--muted); }') && siteCss.includes('.fs-1 { font-size: 1rem; }'), 'site.css: нет утилит наследственности');
ok(siteCss.includes('.note-card[data-type="extra"]   { --note-accent: #4f7a44; }') && !siteCss.includes('--note-accent: #34d399'), 'site.css: типы заметок не в NEO (тёмные варианты)');
ok(read('blog.html').includes('background:var(--neo-verm);"') && !read('blog.html').includes('background:#8b5cf6'), 'blog: легенда типов не синхронна с CSS');
ok(siteCss.includes('.faq-summary { font-size: 1.02rem;'), 'site.css: FAQ не укрупнён');
ok(stCss.includes('.uni-card--office { --card-accent: #96602a;'), 'stands.css: офис-карточка светлой темы не в какао');

ok(!read('stands/index.html').includes('system-badge') && !read('stands/index.html').includes('system://'), 'stands/index: бейдж system://training-universes не удалён');
ok(!siteCss.includes('.system-badge'), 'site.css: мёртвый CSS system-badge не удалён');

/* дизайн 2026 · волна 16: system-audit — контраст расчётом, типографика чтения */
function crLum(hex) {
  const h = hex.replace('#', '');
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(parseInt(h.slice(0, 2), 16)) + 0.7152 * f(parseInt(h.slice(2, 4), 16)) + 0.0722 * f(parseInt(h.slice(4, 6), 16));
}
function crRatio(a, b) {
  const [l1, l2] = [crLum(a), crLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
ok(crRatio('#f4efe4', '#1a160c') >= 7, 'контраст бумага/чернила < AAA');
ok(crRatio('#ffffff', '#cf4a18') >= 4.5 && crRatio('#ffffff', '#96602a') >= 4.5 && crRatio('#ffffff', '#4f7a44') >= 4.5, 'is-active фильтров: белый на акцентах < AA');
ok(crRatio('#1a160c', '#e4572e') >= 4.5, 'hover btn-primary (чернила на верм) < AA');
ok(crRatio('#f4efe4', '#1a160c') >= 4.5, 'btn-primary (бумага на чернилах) < AA');
ok(siteCss.includes('.btn-primary {\n  background: var(--neo-ink);') && siteCss.includes('.btn-ghost:hover { background: var(--neo-leaf-tint); }'), 'кнопки не переведены на AA-пары (чернильная primary, тинт-ghost)');
ok(siteCss.includes('.prose-measure { max-width: 40rem;'), 'длина строки чтения не приведена к редакционной норме');
ok(siteCss.includes('width: 2.75rem;\n  height: 2.75rem;'), 'to-top: тач-цель < 44px');
ok(siteCss.includes('animation-timeline: scroll(root block)') && siteCss.includes('@keyframes neo-scroll-progress'), 'нет CSS-first скролл-прогресса');
ok(!read('articles/praktiko-orientirovannoe-obuchenie-i-trudoustroystvo-vypusknikov.html').includes('text-[15px]'), 'статья: кегль 15px на мобиле не устранён');
ok(exists('docs/design-system.md') && read('docs/design-system.md').includes('Наследуемость'), 'docs/design-system.md отсутствует или неполон');

/* дизайн 2026 · волна 17: mechanics — reduce-safe прогресс, единый hover */
ok(/@media \(prefers-reduced-motion: reduce\) \{\n    \.scroll-progress \{ animation: none; \}\n  \}/.test(siteCss), 'site.css: прогресс не защищён от reduce-заморозки');
ok(read('assets/site.js').includes("CSS.supports('animation-timeline: scroll()')") && read('assets/site.js').includes('!cssDriven'), 'site.js: нет guard против дубля CSS-прогресса');
const upHover = siteCss.split('\n').filter(l => /:hover[^{]*\{[^}]*translateY\(-\dpx/.test(l));
ok(upHover.length === 0, 'site.css: hover-подъёмы вверх не унифицированы: ' + upHover.join(' | '));
ok(siteCss.includes('a.p-card:hover { transform: translate(-2px, -2px);') && siteCss.includes('.pub-card:hover {\n  transform: translate(-2px, -2px);'), 'site.css: карточки p/pub не в единой hover-механике');
ok(siteCss.includes('.esp-stat:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 0 var(--neo-ink);') && siteCss.includes('.step-card:hover { transform: translate(-2px, -2px);'), 'site.css: esp-stat/step-card не в единой hover-механике');
ok(!siteCss.includes('scale(1.03)') && !siteCss.includes('scale(1.08)'), 'site.css: «парящие» scale-hover не убраны');
ok(siteCss.includes('border-color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard); }\n.card:hover'), 'site.css: transition карточек теряет рамку/фон');


/* дизайн 2026 · волна 18: misprint-дисплей чтения, подложки зон/статей */
ok(siteCss.includes('.article-title {\n  text-shadow: 5px 5px 0 var(--neo-leaf);') && siteCss.includes('transform: translateX(calc(var(--sk, 0) * 10px)) skewX(calc(var(--sk, 0) * -1.2deg));'), 'site.css: заголовок статьи без листовой подложки/кинетики hero');
ok(siteCss.includes('font-size: clamp(1.9rem, 4.2vw, 2.7rem);') && /\.zone-title \{[^}]*font-weight: 900;[^}]*text-shadow: 5px 5px 0 var\(--neo-leaf\);/.test(siteCss), 'site.css: зоны не переведены на крупный дисплей с подложкой');
ok(/\.esp-title \{[^}]*font-weight: 900;[^}]*text-shadow: 4px 4px 0 var\(--neo-leaf\);/.test(siteCss), 'site.css: esp-секции без подложки');
ok(siteCss.includes('.zone-title .zt-serif, .esp-title .zt-serif, .article-title .zt-serif { text-shadow: none; }'), 'site.css: serif-вставки не изолированы от подложки');
ok(/\.prose-neo h2, \.prose-measure h2 \{[^}]*text-transform: lowercase;[^}]*text-shadow: 4px 4px 0 rgba\(216, 242, 75, \.5\);/.test(siteCss), 'site.css: секции чтения без misprint-базы');
ok(/@supports \(-webkit-text-stroke: 1px #000\) \{\s*\.prose-neo h2, \.prose-measure h2 \{\s*color: transparent;\s*-webkit-text-stroke: 1\.4px var\(--neo-ink\);/.test(siteCss) && siteCss.includes('-webkit-text-stroke: 0; }'), 'site.css: misprint без stroke-guard/fallback');
ok(/\(animation-timeline: view\(\)\)[\s\S]{0,700}prefers-reduced-motion[\s\S]{0,220}animation: none;/.test(siteCss), 'site.css: view()-reveal без reduce-исключения (урок 17)');
ok(/@media \(prefers-reduced-motion: reduce\) \{\s*\.article-title \{ animation: none; transform: none; \}\s*\}/.test(siteCss), 'site.css: заголовок статьи без reduce-сброса');

console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail) { console.log(fails.slice(0, 40).join('\n')); process.exit(1); }
