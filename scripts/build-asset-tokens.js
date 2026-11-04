'use strict';
/* Версии статики в разметке: node scripts/build-asset-tokens.js [--write|--check]
   Без флага печатает сводку.

   Раньше версии у JS проставлялись руками и разъехались: у одной страницы
   `?v=20261104r4`, у соседней `?v=20261028ab`, а CSS подключался вообще без
   версии и жил за кэшем. Теперь токен — это хэш содержимого файла: он
   считается здесь и проверяется в CI. `--check` падает, если разметка
   отстала от файлов, поэтому «забыл поднять версию» видно сразу. */
const fs = require('node:fs');
const path = require('node:path');
const { LAYERS } = require('./lib/css-layers');
const { assetUrl, version, ROOT } = require('./lib/asset-version');

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.arena']);

/* Только статика сайта: внешние адреса, картинки и JSON не версионируем —
   у них своя жизнь (изображения редко меняются, JSON обновляют сборщики). */
const ASSET = /((?:\.\.\/)*\/?assets\/[\w./-]+\.(?:js|css))(\?v=[^"'\s>]*)?/g;

function pages(dir = '.', acc = []) {
  for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (dir === '.' && SKIP_DIRS.has(item.name)) continue;
    const relative = dir === '.' ? item.name : dir + '/' + item.name;
    if (item.isDirectory()) pages(relative, acc);
    else if (item.name.endsWith('.html')) acc.push(relative);
  }
  return acc;
}

const stale = [];
let rewritten = 0;
let references = 0;

for (const file of pages()) {
  const full = path.join(ROOT, file);
  const source = fs.readFileSync(full, 'utf8');
  const next = source.replace(ASSET, (match, reference, query) => {
    const expected = assetUrl(reference);
    references += 1;
    if (match === expected) return match;
    stale.push(file + ': ' + match + ' → ' + expected);
    return expected;
  });
  if (next !== source) {
    rewritten += 1;
    if (write) fs.writeFileSync(full, next);
  }
}

if (check) {
  if (stale.length) {
    console.error('build-asset-tokens: разметка отстала от файлов статики (' + stale.length + '):\n  ' + stale.slice(0, 20).join('\n  '));
    if (stale.length > 20) console.error('  … ещё ' + (stale.length - 20));
    console.error('Запустите: node scripts/build-asset-tokens.js --write');
    process.exit(1);
  }
  console.log('Asset tokens: ' + references + ' ссылок на статику совпадают с содержимым файлов');
} else if (write) {
  console.log('Asset tokens: обновлено файлов ' + rewritten + ', ссылок ' + references);
} else {
  console.log('Asset tokens: ссылок ' + references + ', отстают ' + stale.length + (stale.length ? ' — запустите --write' : ''));
  for (const file of ['assets/shell.js', ...LAYERS]) {
    console.log('  ' + file + ' → ' + version(file));
  }
}
