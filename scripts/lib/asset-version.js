'use strict';
/* Версия статики: один источник для сборочных скриптов и проверки.
   Хэш считается по содержимому файла, поэтому «забыл поднять версию» больше
   не бывает: поменялся файл — поменялся адрес, и браузер берёт новый.

   Адрес берём от корня (`/assets/…`): страницы лежат на разной глубине, и
   относительный путь там считается по-разному. Service worker умеет отдавать
   версионированный адрес из прекеша по чистому пути — см. sw.js. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const hashes = new Map();

function fileOf(reference) {
  /* '/assets/x.js', '../../assets/x.js' и 'assets/x.js' — один и тот же файл. */
  const clean = String(reference).replace(/[?#].*$/, '').replace(/^(?:\.\.\/)+/, '').replace(/^\.\//, '');
  return clean.startsWith('/') ? clean.slice(1) : clean;
}

function version(reference) {
  const file = fileOf(reference);
  if (hashes.has(file)) return hashes.get(file);
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) throw new Error('нет файла статики: ' + file);
  const hash = crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex').slice(0, 8);
  hashes.set(file, hash);
  return hash;
}

function assetUrl(reference) {
  const file = fileOf(reference);
  return '/' + file + '?v=' + version(file);
}

/* Разметка собирается по шаблонам, где пути написаны без версии: штамп
   добавляет `?v=<хэш>` к каждой ссылке на JS/CSS. Так генератору не нужно
   знать про версии, а страница на диске всегда совпадает с файлами. */
const ASSET_REF = /((?:\.\.\/)*\/?assets\/[\w./-]+\.(?:js|css))(?:\?v=[^"'\s>]*)?/g;

function stamp(html) {
  return String(html).replace(ASSET_REF, (match, reference) => assetUrl(reference));
}

module.exports = { version, assetUrl, stamp, fileOf, ROOT };
