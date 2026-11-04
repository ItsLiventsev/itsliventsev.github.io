'use strict';
// Карта сайта и лента ведут на живые страницы: node scripts/test-sitemap.js
//
// build-seo --check сверяет файлы с контентом, но не проверяет, что каждый URL
// существует и что лента не ссылается на удалённую заметку. Один удалённый файл
// даёт 404 из поиска, и заметить это можно только руками.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://itsliventsev.github.io';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

/* URL сайта → путь в репозитории: '/' это index.html, хвостовой слэш — index.html каталога. */
function fileOf(url) {
  assert(url.startsWith(SITE), 'чужой домен в карте сайта: ' + url);
  let rel = url.slice(SITE.length).replace(/^\//, '');
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  return rel;
}

const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert(locs.length > 100, 'карта сайта подозрительно мала: ' + locs.length);

const missing = [];
for (const url of locs) {
  const rel = fileOf(url);
  if (!fs.existsSync(path.join(ROOT, rel))) missing.push(url + ' → ' + rel);
}
assert.deepEqual(missing, [], 'в карте сайта есть несуществующие страницы:\n  ' + missing.join('\n  '));

/* lastmod — только ISO-дата: «сегодня» из старой версии сборщика ломало сортировку
   и делало файл нестабильным. */
const badDates = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)]
  .map(match => match[1]).filter(value => !/^\d{4}-\d{2}-\d{2}$/.test(value));
assert.deepEqual(badDates, [], 'lastmod должен быть датой ISO: ' + badDates.slice(0, 5).join(', '));

/* Ни одна страница с noindex не должна светиться в карте сайта. */
const noindexInSitemap = locs.filter(url => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(read(fileOf(url))));
assert.deepEqual(noindexInSitemap, [], 'страницы с noindex попали в карту сайта: ' + noindexInSitemap.join(', '));

/* Лента: ссылки на заметки и статьи должны существовать, дата — RFC 822. */
const feed = read('feed.xml');
const links = [...feed.matchAll(/<link>([^<]+)<\/link>/g)].map(match => match[1]).filter(url => url !== SITE + '/');
const deadLinks = links.filter(url => !fs.existsSync(path.join(ROOT, fileOf(url))));
assert.deepEqual(deadLinks, [], 'лента ссылается на удалённые страницы: ' + deadLinks.join(', '));
assert(links.length > 20, 'в ленте подозрительно мало материалов: ' + links.length);

const dates = [...feed.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map(match => match[1]);
const badPubDates = dates.filter(value => !/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value));
assert.deepEqual(badPubDates, [], 'pubDate должен быть в формате RFC 822: ' + badPubDates.slice(0, 5).join(' | '));

console.log('Sitemap: ' + locs.length + ' URL существуют, ' + links.length + ' материалов в ленте на месте');
