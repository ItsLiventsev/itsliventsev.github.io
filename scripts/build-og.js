/* ==========================================================================
   build-og.js — OG-карточки 1200×630 (SVG + PNG) в языке сайта.

   Раньше карточки рисовались в старом тёмно-синем языке стендов и собирались
   руками на машине разработчика: пять PNG лежали в assets, а скрипт умел три.
   Теперь шаблон один и повторяет герой страницы-кейса — бумажная подложка,
   чернильный заголовок Golos, глиняный акцент и карточка фактов справа, —
   а число на карточке берётся из данных репозитория, а не пишется руками.

   Запуск:            node scripts/build-og.js
   Только проверка:   node scripts/build-og.js --check   (ненулевой код при дрейфе)

   Зависимости — только для сборки, в репозитории их нет (`.ogbuild/` в .gitignore):
     npm install --prefix .ogbuild @resvg/resvg-js @expo-google-fonts/golos-text \
                 @expo-google-fonts/literata @expo-google-fonts/jetbrains-mono
   Пути можно переопределить: OG_DEPS (каталог с node_modules), OG_FONTS (каталог
   с пакетами @expo-google-fonts). Именно так карточки собирает CI.
   resvg не читает woff/woff2, поэтому берутся TTF из npm-пакетов.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const CHECK = process.argv.includes('--check');
const DEPS = process.env.OG_DEPS || path.join(ROOT, '.ogbuild');
const FONTS = process.env.OG_FONTS || path.join(DEPS, 'node_modules', '@expo-google-fonts');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

let Resvg;
try {
  ({ Resvg } = require(path.join(DEPS, 'node_modules', '@resvg', 'resvg-js')));
} catch (error) {
  console.error('build-og: нет @resvg/resvg-js в ' + DEPS);
  console.error('  npm install --prefix ' + path.relative(ROOT, DEPS) + ' @resvg/resvg-js @expo-google-fonts/golos-text @expo-google-fonts/literata @expo-google-fonts/jetbrains-mono');
  process.exit(1);
}

const font = (pkg, file) => path.join(FONTS, pkg, file);
const FONT_FILES = [
  font('golos-text', '400Regular/GolosText_400Regular.ttf'),
  font('golos-text', '500Medium/GolosText_500Medium.ttf'),
  font('golos-text', '700Bold/GolosText_700Bold.ttf'),
  font('literata', '400Regular/Literata_400Regular.ttf'),
  font('jetbrains-mono', '500Medium/JetBrainsMono_500Medium.ttf'),
];
FONT_FILES.forEach((file) => { if (!fs.existsSync(file)) throw new Error('build-og: нет шрифта ' + file); });

/* Палитра — ровно токены из assets/tokens.css: карточки не должны жить
   в отдельной вселенной, иначе пост в соцсети выглядит как другой сайт. */
const TOKENS = {
  paper: '#efeee9',
  surface: '#ffffff',
  ink: '#14130e',
  ink2: '#35332c',
  muted: '#5d5a52',
  faint: '#6f6c63',
  line: '#e5e3dc',
  lineStrong: '#d2cfc6',
  accent: '#a8391d',
  accentHover: '#872c14',
};
const W = 1200;
const H = 630;
const PAD = 88;
const esc = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* Сколько чего на сайте — из самих данных. Карточка «43 заметки» не должна
   пережить появление сорок четвёртой. */
function facts() {
  const registry = JSON.parse(read('assets/data/knowledge/registry.json'));
  const topics = JSON.parse(read('assets/data/topics.json'));
  const sitemap = read('sitemap.xml');
  return {
    notes: registry.notes,
    edges: registry.edges.length,
    stands: new Set((topics.pairs || []).map((pair) => pair.practice)).size,
    bridges: (topics.pairs || []).length,
    pages: (sitemap.match(/<loc>/g) || []).length,
  };
}

/* Шаблон повторяет герой страницы-кейса: слева заголовок и лид, справа
   карточка фактов (`aside.case-facts`), внизу — мета и адрес. */
function card(o) {
  const t = TOKENS;
  const size = o.size || 66;
  const TITLE_Y = 232;
  const TITLE_STEP = Math.round(size * 1.08);
  const titleLines = o.title.map((line, index) =>
    `<text x="${PAD}" y="${TITLE_Y + index * TITLE_STEP}" font-family="Golos Text" font-size="${size}" font-weight="700" fill="${t.ink}" letter-spacing="-1.8">${esc(line)}</text>`
  ).join('\n  ');
  const ledeY = TITLE_Y + (o.title.length - 1) * TITLE_STEP + 58;
  const lede = (o.lede || []).map((line, index) =>
    `<text x="${PAD}" y="${ledeY + index * 36}" font-family="Literata" font-size="25" fill="${t.ink2}">${esc(line)}</text>`
  ).join('\n  ');
  const metaY = 482;
  const factRows = o.facts.slice(0, 3).map((fact, index) => {
    const top = 128 + index * 132;
    /* Длинное значение («VLAN · NAT») не должно вылезать из карточки:
       кегль уменьшается, а базовая линия остаётся на месте. */
    const valueSize = fact.value.length > 6 ? 32 : 46;
    return `<line x1="756" y1="${top}" x2="1112" y2="${top}" stroke="${t.line}" stroke-width="1"/>
  <text x="792" y="${top + 58}" font-family="Golos Text" font-size="${valueSize}" font-weight="700" fill="${t.accent}">${esc(fact.value)}</text>
  <text x="792" y="${top + 96}" font-family="'JetBrains Mono'" font-size="16" fill="${t.muted}" letter-spacing="1.6">${esc(fact.label.toUpperCase())}</text>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${t.paper}"/>

  <text x="${PAD}" y="74" font-family="Golos Text" font-size="26" font-weight="700" fill="${t.ink}">itsliventsev<tspan fill="${t.accent}">.</tspan></text>
  <text x="${PAD + 196}" y="74" font-family="'JetBrains Mono'" font-size="15" fill="${t.faint}" letter-spacing="2.4">СЕТИ · СИСТЕМЫ · ПРАКТИКА</text>
  <line x1="${PAD}" y1="104" x2="${W - PAD}" y2="104" stroke="${t.lineStrong}" stroke-width="1"/>

  <text x="${PAD}" y="170" font-family="'JetBrains Mono'" font-size="15" fill="${t.accent}" letter-spacing="3">${esc(o.eyebrow.toUpperCase())}</text>
  ${titleLines}
  ${lede}

  <line x1="${PAD}" y1="${metaY - 34}" x2="700" y2="${metaY - 34}" stroke="${t.lineStrong}" stroke-width="1"/>
  <text x="${PAD}" y="${metaY}" font-family="'JetBrains Mono'" font-size="18" fill="${t.muted}" letter-spacing="0.8">${esc(o.meta)}</text>
  <text x="${PAD}" y="${H - 56}" font-family="'JetBrains Mono'" font-size="17" fill="${t.faint}">itsliventsev.github.io${esc(o.path)}</text>

  <rect x="756" y="128" width="356" height="396" rx="22" fill="${t.surface}" stroke="${t.line}" stroke-width="1"/>
  ${factRows}
</svg>`;
}

const counts = facts();
const variants = [
  {
    svg: 'og.svg', png: 'og.png',
    card: {
      eyebrow: 'портфолио · учебная платформа',
      title: ['Портфолио', 'и учебная платформа'],
      size: 56,
      lede: ['Сети, системы и практика:', 'заметки, стенды и разбор кейсов.'],
      meta: 'заметки · стенды · кейсы · статьи',
      path: '/',
      facts: [
        { value: String(counts.notes), label: 'заметки базы знаний' },
        { value: String(counts.stands), label: 'учебных стендов' },
        { value: String(counts.bridges), label: 'связей: теория и практика' },
      ],
    },
  },
  {
    svg: 'og-notes.svg', png: 'og-notes.png',
    card: {
      eyebrow: 'база знаний · заметки',
      title: ['База знаний', 'по сетям и системам'],
      size: 62,
      lede: ['Короткие заметки с источниками:', 'от VLAN до бэкапов и мониторинга.'],
      meta: 'заметки · рубрики · граф связей',
      path: '/blog.html',
      facts: [
        { value: String(counts.notes), label: 'заметки' },
        { value: '6', label: 'рубрик' },
        { value: String(counts.edges), label: 'связей на графе' },
      ],
    },
  },
  {
    svg: 'og-stands.svg', png: 'og-stands.png',
    card: {
      eyebrow: 'учебная вселенная · СетьПолис',
      title: ['СетьПолис', 'инфраструктура'],
      lede: ['Пятнадцать работ: VLAN, маршрутизация,', 'NAT, диагностика и защита.'],
      meta: 'терминал · VLAN · NAT · 15 работ',
      path: '/stands/',
      facts: [
        { value: '15', label: 'работ' },
        { value: '5', label: 'спринтов' },
        { value: 'VLAN · NAT', label: 'темы стендов' },
      ],
    },
  },
  {
    svg: 'og-ops.svg', png: 'og-ops.png',
    card: {
      eyebrow: 'учебная вселенная · ДатаПолис',
      title: ['ДатаПолис', 'эксплуатация'],
      lede: ['Шестнадцать работ сервисного центра:', 'SLA, инциденты, изменения.'],
      meta: 'SLA · инциденты · изменения · 16 работ',
      path: '/stands/ops/',
      facts: [
        { value: '16', label: 'работ' },
        { value: '5', label: 'спринтов' },
        { value: 'SLA', label: 'дежурства и разбор' },
      ],
    },
  },
  {
    svg: 'og-office.svg', png: 'og-office.png',
    card: {
      eyebrow: 'учебная вселенная · ОфисПолис',
      title: ['ОфисПолис', 'документы и таблицы'],
      size: 62,
      lede: ['Десять работ бюро оператора ЭВМ:', 'Writer, Calc, Impress и Base.'],
      meta: 'Writer · Calc · Impress · Base · 10 работ',
      path: '/stands/office/',
      facts: [
        { value: '10', label: 'работ' },
        { value: '5', label: 'спринтов' },
        { value: '4', label: 'редактора пакета' },
      ],
    },
  },
];

const render = (svg) => new Resvg(svg, {
  font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Golos Text' },
}).render().asPng();

let drift = 0;
for (const variant of variants) {
  const svg = card(variant.card);
  const png = render(svg);
  for (const [file, next] of [[variant.svg, Buffer.from(svg)], [variant.png, Buffer.from(png)]]) {
    const target = path.join(ASSETS, file);
    const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const same = current && current.equals(next);
    if (same) continue;
    if (CHECK) {
      drift++;
      console.log('✗ ' + file + (current ? ' — устарел' : ' — отсутствует'));
    } else {
      fs.writeFileSync(target, next);
      console.log(file + ' — ' + next.length + ' байт');
    }
  }
}

if (CHECK) {
  if (drift) {
    console.log('build-og --check: ' + drift + ' файлов расходятся. Пересоберите: node scripts/build-og.js');
    process.exit(1);
  }
  console.log('build-og --check: ' + variants.length + ' карточек совпадают с шаблоном');
}
