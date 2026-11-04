'use strict';
/*
 * Раскладка pages.css по семействам страниц.
 *
 * Общий слой pages.css грузится всеми 140 маршрутами, хотя часть его правил
 * нужна только главной, а часть — только кейсам и статьям. Скрипт находит
 * компоненты правил (объединения по общим классам) и переносит в отдельный
 * файл только те, чьи классы встречаются исключительно на страницах этого
 * семейства: ни одно правило компонента не остаётся в общем слое, поэтому
 * порядок каскада не меняется.
 *
 *   node scripts/split-css-families.js            — отчёт, ничего не пишет
 *   node scripts/split-css-families.js --write    — переписать файлы и ссылки
 */
const fs = require('node:fs');
const path = require('node:path');
const { parse, classesOf, pageClasses, routes, components, classUsers } = require('./lib/css-split');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(ROOT, file), text);
const bytes = (text) => Buffer.byteLength(text, 'utf8');

const SHARED_SHEET = 'assets/pages.css';
const WRITE = process.argv.includes('--write');

const FAMILIES = [
  {
    sheet: 'assets/home.css',
    name: 'home.css',
    title: 'главная: герой, числа, плитки маршрутов, лента итераций, журнал',
    matches: (file) => file === 'index.html'
  },
  {
    sheet: 'assets/cases.css',
    name: 'cases.css',
    title: 'кейсы и статьи: шаблон разбора, факты, схемы, вердикт',
    matches: (file) => file.startsWith('projects/') || file.startsWith('articles/')
  }
];

if (WRITE && FAMILIES.some((family) => fs.existsSync(path.join(ROOT, family.sheet)))) {
  throw new Error('Семейные слои уже существуют: повторная раскладка запрещена');
}

/* ——— Кто какие классы использует ——— */

/* Страницы, которым нужны стили класса: разметка плюс классы, которые
   создают подключённые на странице скрипты. */


/* ——— Разбор общего слоя ——— */

const source = read(SHARED_SHEET);
const { units } = parse(source);
const names = new Set(units.flatMap((unit) => [...classesOf(unit.selector)]));
const users = classUsers(ROOT, names);

const moved = new Map(FAMILIES.map((family) => [family.sheet, []]));
const stay = [];
const rows = [];

for (const group of components(units)) {
  const classes = new Set();
  for (const index of group) for (const name of classesOf(units[index].selector)) classes.add(name);
  const audience = new Set();
  for (const name of classes) for (const file of users.get(name) || []) audience.add(file);
  const family = classes.size && audience.size
    ? FAMILIES.find((candidate) => [...audience].every((file) => candidate.matches(file)))
    : null;
  if (family) {
    moved.get(family.sheet).push(...group);
    rows.push({ sheet: family.sheet, rules: group.length, pages: audience.size, classes: [...classes].sort() });
  } else {
    stay.push(...group);
  }
}

/* ——— Сборка текста ——— */

/* Правила печатаются в исходном порядке; соседние правила одного @media
   снова собираются в один блок. */
function render(list) {
  let out = '';
  let open = null;
  let depth = 0;
  const shut = () => { if (open) { out += '}\n'.repeat(depth) + '\n'; open = null; depth = 0; } };
  for (const unit of list) {
    if (unit.comment) out += unit.comment.trimEnd() + '\n';
    if (unit.wrappers.length) {
      /* Обёртки (@media) снова собираются в один блок, когда правила идут подряд. */
      const prelude = unit.wrappers.join(' · ');
      if (open !== prelude) { shut(); out += unit.wrappers.map((wrapper) => wrapper + ' {\n').join(''); open = prelude; depth = unit.wrappers.length; }
      out += '  ' + unit.selector + ' { ' + unit.body.trim().replace(/\s+/g, ' ') + ' }\n';
    } else {
      shut();
      out += unit.selector + ' {' + unit.body + '}\n\n';
    }
  }
  shut();
  return out.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
}

const banner = '/* ==========================================================================\n';
const headEnd = source.indexOf('*/') + 2;
const sharedHeader = source.slice(0, headEnd) + '\n\n';
const stayed = units.filter((unit) => stay.includes(unit.index));
const keptText = sharedHeader + render(stayed);

const familyTexts = new Map();
const changes = new Map();

for (const family of FAMILIES) {
  const indices = moved.get(family.sheet).sort((a, b) => a - b);
  if (!indices.length) continue;
  const text = banner +
    '   itsliventsev · ' + family.name + '\n' +
    '   ' + family.title + '\n' +
    '   Вынесено из pages.css: правила нужны только этому семейству страниц.\n' +
    '   Порядок правил сохранён — каскад внутри семейства не меняется.\n' +
    '   ========================================================================== */\n\n' +
    render(indices.map((index) => units[index]));
  const audience = new Set();
  for (const index of indices) {
    for (const name of classesOf(units[index].selector)) for (const file of users.get(name) || []) audience.add(file);
  }
  familyTexts.set(family.sheet, text);
  console.log(family.sheet + ': правил ' + indices.length + ', страниц ' + audience.size + ', ' + bytes(text) + ' Б');
  if (WRITE) {
    if (fs.existsSync(path.join(ROOT, family.sheet))) throw new Error(family.sheet + ' уже существует: повторная раскладка запрещена');
    changes.set(family.sheet, text);
    for (const file of audience) {
      const html = changes.get(file) || read(file);
      if (html.includes('/' + family.sheet)) continue;
      const anchor = /<link rel="stylesheet" href="\/assets\/pages\.css[^"]*">/;
      if (!anchor.test(html)) throw new Error(file + ': нет ссылки на pages.css');
      changes.set(file, html.replace(anchor, (match) => match + '<link rel="stylesheet" href="/' + family.sheet + '?v=00000000">'));
    }
  }
}

/* ——— Проверка: ни одно правило не потерялось по дороге ———
   Рендер пересобирает @media-обёртки, и именно здесь однажды пропали
   reduced-motion-блоки. Поэтому результат разбирается заново и сверяется
   с исходником как мультимножество «селектор + объявления + обёртки». */
function fingerprint(css) {
  const { units: parsed } = parse(css);
  const counts = new Map();
  for (const unit of parsed) {
    const key = unit.wrappers.join('>') + '|' + unit.selector.replace(/\s+/g, ' ') + '|' + unit.body.trim().replace(/\s+/g, ' ');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function fail(message) {
  console.error('split-css-families: ' + message);
  process.exit(1);
}

const before = fingerprint(source);
const after = fingerprint(keptText + '\n' + [...familyTexts.values()].join('\n'));
for (const [key, count] of before) {
  const survived = after.get(key) || 0;
  if (survived < count) fail('правило потерялось или изменилось: ' + key.slice(0, 90));
}
for (const [key, count] of after) {
  if ((before.get(key) || 0) < count) fail('в слоях появилось лишнее правило: ' + key.slice(0, 90));
}

console.log(SHARED_SHEET + ': правил ' + stayed.length + ', ' + bytes(keptText) + ' Б (было ' + bytes(source) + ' Б)');
if (WRITE) {
  changes.set(SHARED_SHEET, keptText);
  for (const [file, text] of changes) write(file, text);
}
else console.log('\n(dry run: ничего не записано, добавьте --write)');
