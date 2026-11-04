'use strict';
// Один сценарий мобильной навигации: node scripts/test-tabbar.js
// Таббар на всех страницах — один и тот же (пять пунктов, одна активная метка),
// а собственная шапка стендов не превращается во вторую навигацию: на телефоне
// подбар скрыт, и его ссылки приходят в меню группой «Раздел стендов».
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'assets/shell.js'), 'utf8');
const TABS = ['Обзор', 'Практика', 'Статьи', 'Проекты', 'Ещё'];

function render(file, url) {
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
    url: 'https://site.test' + url, runScripts: 'outside-only', pretendToBeVisual: true
  });
  const window = dom.window;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.eval(shell);
  return window.document;
}
const tabs = doc => [...doc.querySelectorAll('.ui-tabbar a')].map(link => link.textContent.trim());
const current = doc => [...doc.querySelectorAll('.ui-tabbar a[aria-current="page"]')].map(link => link.textContent.trim());
const group = (doc, caption) => [...doc.querySelectorAll('.ui-drawer-group')]
  .find(node => node.querySelector('.ui-drawer-caption')?.textContent === caption);
const hrefs = node => [...node.querySelectorAll('a')].map(link => link.getAttribute('href'));

/* 1. Стенд: та же панель, что и на сайте, плюс разделы вселенной в меню */
const stand = render('stands/lab-vlan-cisco.html', '/stands/lab-vlan-cisco.html');
assert.deepEqual(tabs(stand), TABS, 'таббар стенда должен совпадать с общим: ' + tabs(stand).join(', '));
assert.deepEqual(current(stand), ['Практика'], 'на стенде активен пункт «Практика»');
assert.equal(stand.querySelectorAll('.ui-tabbar').length, 1, 'таббар на странице ровно один');
assert.equal(stand.querySelector('.ui-tabbar').getAttribute('aria-label'), 'Быстрая навигация',
  'у таббара должно быть имя для скринридера');

const subbar = stand.querySelector('.ui-subbar');
assert(subbar && subbar.hasAttribute('data-ui-subbar'), 'подбар раздела должен быть помечен data-ui-subbar');
const subbarLinks = [...subbar.querySelectorAll('a')];
assert(subbarLinks.length >= 5, 'в подбаре мало ссылок раздела: ' + subbarLinks.length);
const standGroup = group(stand, 'Раздел стендов');
assert(standGroup, 'в меню стенда нет группы «Раздел стендов»');
assert.deepEqual(hrefs(standGroup), hrefs(subbar), 'меню должно повторять ссылки подбара один в один');
assert(group(stand, 'Разделы') && group(stand, 'Практика') && group(stand, 'Ещё'),
  'общие группы меню должны остаться рядом');
assert(!subbar.querySelector('.st-nav-admin'), 'служебную ссылку «преподавателю» в меню не тащим');

/* 2. Остальные страницы: тот же таббар, без группы стендов */
for (const [file, url, expected] of [
  ['index.html', '/', 'Обзор'],
  ['blog/kn-vlan.html', '/blog/kn-vlan.html', 'Статьи'],
  ['articles.html', '/articles.html', 'Статьи'],
  ['projects.html', '/projects.html', 'Проекты'],
  ['archive.html', '/archive.html', 'Ещё'],
  ['faq.html', '/faq.html', 'Ещё'],
  ['sitemap.html', '/sitemap.html', 'Ещё'],
  ['stands/index.html', '/stands/index.html', 'Практика']
]) {
  const doc = render(file, url);
  assert.deepEqual(tabs(doc), TABS, url + ': таббар должен быть одинаковым на всём сайте');
  assert.deepEqual(current(doc), [expected], url + ': активный пункт — ' + expected);
  assert.equal(group(doc, 'Раздел стендов'), undefined, url + ': группы стендов здесь быть не должно');
}

/* 3. Разметка страниц не дублирует панель: её строит только оболочка */
const pages = fs.readdirSync(ROOT).filter(name => name.endsWith('.html'));
for (const name of pages) {
  assert(!fs.readFileSync(path.join(ROOT, name), 'utf8').includes('class="ui-tabbar"'),
    name + ': таббар захардкожен в разметке, его собирает shell.js');
}

console.log('Tabbar: five destinations, one current mark, stand sections fold into the menu OK');
