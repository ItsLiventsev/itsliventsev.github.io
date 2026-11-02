/* Optional DOM regression test: NODE_PATH=/path/to/node_modules node scripts/test-reading.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('assets/home-reading.js', 'utf8');
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
const blog = [{ status: 'published', file: 'note.html', title: '<img src=x>', date: '2026-10-01', excerpt: 'Заметка' }, { status: 'draft', file: 'draft.html', title: 'Черновик' }, { status: 'published', file: '../evil.html', title: 'Неверная ссылка' }];
const articles = [{ status: 'published', file: 'article.html', title: 'Статья', date: '2024', excerpt: 'Образование' }];
function setup(fetch) {
  const dom = new JSDOM(html, { url: 'https://site.test/', runScripts: 'outside-only' });
  dom.window.fetch = fetch;
  dom.window.eval(script);
  return dom;
}
const response = data => ({ ok: true, json: async () => data });
(async () => {
  let dom = setup(async url => response(url.startsWith('/blog/') ? blog : articles));
  await wait();
  let doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.ws-reading-row').length, 2);
  assert.equal(doc.querySelector('.ws-reading-row strong').textContent, '<img src=x>');
  assert.equal(doc.querySelector('.ws-reading-list img'), null);
  assert.equal(doc.querySelector('.ws-reading-row').getAttribute('href'), '/blog/note.html');
  assert.equal(doc.querySelector('.ws-reading-row').dataset.readingKind, 'blog');
  doc.querySelector('[data-reading-filter="articles"]').click();
  assert.equal(doc.querySelectorAll('.ws-reading-row').length, 1);
  assert.equal(doc.querySelector('.ws-reading-row strong').textContent, 'Статья');
  assert.equal(doc.querySelector('.ws-reading-row').dataset.readingKind, 'articles');
  assert.equal(doc.querySelector('[data-reading-filter="articles"]').getAttribute('aria-pressed'), 'true');
  dom.window.I18N = { lang: () => 'en' };
  dom.window.dispatchEvent(new dom.window.Event('itsliventsev:languagechange'));
  assert.equal(doc.querySelector('.ws-reading-type').textContent, 'Article');
  dom.window.close();
  dom = setup(async url => url.startsWith('/blog/') ? response(blog) : { ok: false });
  await wait(); doc = dom.window.document;
  assert.match(doc.querySelector('.ws-reading-status').textContent, /Часть/);
  doc.querySelector('[data-reading-filter="articles"]').click();
  assert.match(doc.querySelector('.ws-reading-status').textContent, /недоступен/);
  assert.equal(doc.querySelector('.ws-reading-fallback').getAttribute('href'), '/articles.html');
  dom.window.close();
  dom = setup(async () => { throw new Error('offline'); });
  await wait(); doc = dom.window.document;
  assert.match(doc.querySelector('.ws-reading-status').textContent, /недоступен/);
  assert.equal(doc.querySelector('.ws-reading-fallback').getAttribute('href'), '/sitemap.html');
  dom.window.close();
  console.log('Editorial shelf: filters, validation, languages and unavailable sources OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
