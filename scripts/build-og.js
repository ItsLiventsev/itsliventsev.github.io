/* ==========================================================================
   build-og.js — сборка OG-картинок 1200×630 (PNG) из SVG через @resvg/resvg-js.
   Запуск: node scripts/build-og.js
   TTF-шрифты берутся из .ogbuild/node_modules (@expo-google-fonts/*, dev-only);
   resvg не умеет woff/woff2, поэтому именно TTF. Кириллица обязательна.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { Resvg } = require(path.join(__dirname, '..', '.ogbuild', 'node_modules', '@resvg', 'resvg-js'));

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const F = path.join(ROOT, '.ogbuild', 'node_modules', '@expo-google-fonts');
const FONT_FILES = [
  path.join(F, 'inter', '400Regular', 'Inter_400Regular.ttf'),
  path.join(F, 'inter', '500Medium', 'Inter_500Medium.ttf'),
  path.join(F, 'inter', '800ExtraBold', 'Inter_800ExtraBold.ttf'),
  path.join(F, 'jetbrains-mono', '400Regular', 'JetBrainsMono_400Regular.ttf'),
  path.join(F, 'jetbrains-mono', '500Medium', 'JetBrainsMono_500Medium.ttf'),
  path.join(F, 'jetbrains-mono', '700Bold', 'JetBrainsMono_700Bold.ttf'),
];
FONT_FILES.forEach((f) => { if (!fs.existsSync(f)) throw new Error('нет шрифта: ' + f); });

const INK = '#f5f7fa';
const BG = '#0b0e11';
const LINE = '#232b34';
const ACCENT = '#5b9dff';
const ACCENT_2 = '#86b6ff';
const MUTED = '#8a95a1';
const FAINT = '#5f6b79';

/* Плоский OG в языке стендов: тёмный фон, 1px сетка, моно-глифы. */
function flatOg(o) {
  const glyphs = o.glyphs.map((g) =>
    `<text x="${g.x}" y="${g.y}" font-family="'JetBrains Mono',monospace" font-size="${g.s}" font-weight="700" fill="${g.c || ACCENT}" opacity="${g.o}">${g.t}</text>`
  ).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M36 0H0V36" fill="none" stroke="${LINE}" stroke-width="1" opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  ${glyphs}
  <rect x="96" y="176" width="132" height="132" rx="0" fill="none" stroke="${ACCENT}" stroke-width="2"/>
  <path d="M128 218l22 24-22 24" fill="none" stroke="${ACCENT}" stroke-width="8" stroke-linecap="square" stroke-linejoin="miter"/>
  <line x1="162" y1="266" x2="202" y2="266" stroke="${INK}" stroke-width="8" stroke-linecap="square"/>
  <text x="262" y="248" font-family="Inter,system-ui,sans-serif" font-size="86" font-weight="800" fill="${INK}">${o.title}</text>
  <text x="264" y="296" font-family="'JetBrains Mono',monospace" font-size="27" font-weight="500" fill="${ACCENT_2}">${o.kicker}</text>
  <rect x="96" y="430" width="1008" height="2" fill="${LINE}"/>
  <text x="96" y="492" font-family="'JetBrains Mono',monospace" font-size="26" font-weight="500" fill="${MUTED}">${o.tags}</text>
  <text x="96" y="536" font-family="'JetBrains Mono',monospace" font-size="21" font-weight="400" fill="${FAINT}">itsliventsev.github.io${o.url}</text>
</svg>`;
}

const variants = [
  {
    svg: 'og-stands.svg', png: 'og-stands.png',
    markup: flatOg({
      title: 'СетьПолис',
      kicker: '// учебная вселенная · настройка сетевой инфраструктуры',
      tags: 'терминал · VLAN · маршрутизация · NAT · 5 спринтов · 15 работ',
      url: '/stands',
      glyphs: [
        { t: '/', x: 905, y: 330, s: 430, o: 0.10 },
        { t: '#', x: 640, y: 560, s: 300, o: 0.07 },
        { t: '{ }', x: 1080, y: 150, s: 170, o: 0.08, c: ACCENT_2 },
      ],
    }),
  },
  {
    svg: 'og-ops.svg', png: 'og-ops.png',
    markup: flatOg({
      title: 'ДатаПолис',
      kicker: '// сервисный центр · эксплуатация и администрирование',
      tags: 'SLA · инциденты · изменения · дежурства · 5 спринтов · 16 работ',
      url: '/stands/ops',
      glyphs: [
        { t: '$', x: 905, y: 330, s: 400, o: 0.10 },
        { t: '#', x: 640, y: 560, s: 300, o: 0.07 },
        { t: '>_', x: 1060, y: 150, s: 150, o: 0.08, c: ACCENT_2 },
      ],
    }),
  },
];

for (const v of variants) {
  fs.writeFileSync(path.join(ASSETS, v.svg), v.markup);
  const r = new Resvg(v.markup, { font: { fontFiles: FONT_FILES, loadSystemFonts: false } });
  const png = r.render().asPng();
  fs.writeFileSync(path.join(ASSETS, v.png), png);
  console.log(v.png + ' — ' + png.length + ' байт');
}
