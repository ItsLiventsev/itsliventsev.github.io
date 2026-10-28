/* Регрессионный харнесс статики (zero-deps, node >=18). Запуск: node /tmp/domtest/regression-static.js */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION = '20261028ae';
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
ok(allHtml.length === 70, 'HTML страниц должно быть 70, фактически ' + allHtml.length);
ok(standsHtml.length === 48, 'stands-страниц 48, фактически ' + standsHtml.length);

/* 2. Версия ассетов */
for (const f of allHtml) {
  const s = read(f);
  ok(!s.includes('?v=20261028z') && !s.includes('?v=20261028aa') && !s.includes('?v=20261028ab') && !s.includes('?v=20261028ac') && !s.includes('?v=20261028ad'), f + ': устаревшая версия ассета');
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
ok(locs.length === 67, 'sitemap URL = 67, фактически ' + locs.length);
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
ok(stCss.includes('.st-ambient { display: none; }'), 'ambient не отключается при reduced-motion');
ok(/\.st-ambient\s*{[^}]*pointer-events:\s*none/.test(stCss), 'ambient без pointer-events:none');
ok(standsJs.includes("aria-hidden") && standsJs.includes('initAmbient'), 'ambient не aria-hidden/не инициализируется');

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
for (const f of rootHtml) ok(read(f).includes('assets/og.png'), f + ': корневая OG потеряна');

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
ok(dkPages.length === 48, 'dom-kit подключён на 48 страницах (47 stands + admin), фактически ' + dkPages.length);

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
ok(standsJs.includes('startViewTransition'), 'stands.js: нет View Transitions с фолбэком');
ok(read('assets/site.js').includes('startViewTransition'), 'site.js: нет View Transitions');
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
const lg = read('assets/league.js');
ok(lg.includes('var INITIAL_PRP = 5;') && lg.includes('var PRP_CAP = 20;'), 'PRP-канон 5/кап 20 нарушен');
ok(lg.includes('earnPrp(r.reviewer.id, 1,') && lg.includes('function spendPrp'), 'PRP +1/−1 (earn/spend) нарушен');

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
const flowCss = read('assets/flow.css');
for (const [n, c] of [['site.css', siteCss], ['stands.css', stCss], ['ops.css', opsCss], ['shared-chrome.css', sharedCss], ['flow.css', flowCss]]) {
  c.split('\n').forEach((line, i) => {
    if (line.includes('transition') && /(?<![\w-])\d*\.?\d+s/.test(line)) {
      ok(false, n + ':' + (i + 1) + ' числовая длительность в transition: ' + line.trim().slice(0, 80));
    }
  });
}
/* запрещённые для переходов свойства: layout двигается только transform'ом */
for (const [n, c] of [['site.css', siteCss], ['stands.css', stCss], ['ops.css', opsCss], ['shared-chrome.css', sharedCss], ['flow.css', flowCss]]) {
  c.split('\n').forEach((line, i) => {
    if (/transition[^;]*(?<![\w-])(width|height|top|left|right|bottom|max-height)(?![\w-])/.test(line)) {
      ok(false, n + ':' + (i + 1) + ' transition геометрии: ' + line.trim().slice(0, 80));
    }
  });
}
/* прогресс-бары живут на scaleX(var(--p)), а не на width */
ok(/\.xp-bar i[^{]*\{[^}]*scaleX\(var\(--p/.test(stCss), 'xp-bar не переведён на scaleX(var(--p))');
ok(!/style\.width/.test(read('assets/stands.js') + read('assets/ops-kit.js') + read('assets/office-kit.js') + read('assets/lab-kit.js')), 'JS всё ещё анимирует style.width');
/* View Transitions и именованные элементы хрома */
ok(sharedCss.includes('@view-transition') && sharedCss.includes('view-transition-name: chrome-brand')
  && sharedCss.includes('view-transition-name: chrome-theme'), 'нет View Transitions хрома');
/* общий хром подключён на всех страницах после остальных стилей */
const chromePages = allHtml.filter(f => read(f).includes('assets/shared-chrome.css') && read(f).includes('assets/shared-chrome.js'));
ok(chromePages.length === allHtml.length, 'shared-chrome подключён не на всех страницах: ' + (allHtml.length - chromePages.length));
for (const f of allHtml) {
  const c = read(f);
  const chromePos = c.indexOf('shared-chrome.css');
  const scopePos = Math.max(c.indexOf('stands.css'), c.indexOf('site.css'));
  ok(chromePos > scopePos, f + ': shared-chrome.css должен идти после scope-стилей');
  ok(c.indexOf('flow.css') > chromePos, f + ': flow.css должен идти после shared-chrome.css');
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
/* стаггер через --i, не через таймерные d-классы */
ok(siteJs.includes("--i") && siteCss.includes('calc(var(--i, 0) * 40ms)'), 'стаггер не переведён на --i');


/* 22. Flow-motion 2026: токены, наследование, только композитор-свойства */
ok(flowCss.includes('--ease-spring') && flowCss.includes('--flow-glass')
  && flowCss.includes('--flow-rise') && flowCss.includes('--flow-step'), 'flow.css: нет полного набора flow-токенов');
ok(stCss.includes('--st-dur-base') && flowCss.includes('var(--dur-slow)'), 'flow не наследует базовые dur-токены');
/* keyframes flow.css не двигают layout: только transform/opacity/filter/clip-path */
const keyframeBlocks = flowCss.match(/@keyframes[^{]+\{[\s\S]*?\n\}/g) || [];
ok(keyframeBlocks.length >= 5, 'flow.css: ожидались 5+ keyframes, фактически ' + keyframeBlocks.length);
for (const block of keyframeBlocks) {
  ok(!/(?<![\w-])(width|height|top|left|right|bottom|margin|padding)(?![\w-])\s*:/.test(block),
    'flow keyframe двигает геометрию: ' + block.split('{')[0].trim());
}
/* пословный сплит с защитой от вложенных тегов и reduced-motion */
const flowJs = read('assets/flow.js');
ok(flowJs.includes("querySelector('*')") && flowJs.includes("data-flow-words"), 'flow.js: нет безопасного сплита слов');
ok(flowJs.includes("prefers-reduced-motion") && flowJs.includes("(pointer: fine)"), 'flow.js: нет guard reduced-motion/pointer:fine');
ok(flowJs.includes("aria-hidden") && flowJs.includes("pointer-events") === false, 'flow.js: инжект ambient без aria-hidden');
/* подключение flow последним на всех страницах */
const flowPages = allHtml.filter(f => {
  const c = read(f);
  return c.includes('assets/flow.css') && c.includes('assets/flow.js');
});
ok(flowPages.length === allHtml.length, 'flow подключён не на всех страницах: ' + (allHtml.length - flowPages.length));
for (const f of allHtml) {
  const c = read(f);
  ok(c.indexOf('flow.css') > c.indexOf('shared-chrome.css'), f + ': flow.css должен идти после shared-chrome.css');
  ok(c.indexOf('flow.js') > c.indexOf('shared-chrome.js'), f + ': flow.js должен идти после shared-chrome.js');
}
/* пословные заголовки на трёх хабах, маска — на главной */
ok(read('stands/ops/index.html').includes('data-flow-words')
  && read('stands/office/index.html').includes('data-flow-words')
  && read('stands/index.html').includes('data-flow-words'), 'хабы без data-flow-words');
ok(read('index.html').includes('data-flow="mask"') && read('index.html').includes('data-flow-group'), 'главная без mask/flow-group');
/* reduced-motion в flow.css гасит и вход, и ambient, и модалки */
ok(/prefers-reduced-motion[\s\S]*data-flow[\s\S]*transform: none/.test(flowCss), 'flow.css: reduced-motion не сбрасывает data-flow');
ok(/prefers-reduced-motion[\s\S]*st-ambient[\s\S]*display: none/.test(flowCss), 'flow.css: ambient не отключается при reduced-motion');

console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail) { console.log(fails.slice(0, 40).join('\n')); process.exit(1); }
