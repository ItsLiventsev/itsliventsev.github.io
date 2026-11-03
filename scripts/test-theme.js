/* Theme default regression test (jsdom required):
   NODE_PATH=/path/to/node_modules node scripts/test-theme.js

   Правило: пока пользователь не выбрал тему сам, сайт следует системной
   настройке (prefers-color-scheme). Как только в localStorage лежит выбор,
   он главнее системы — и при загрузке, и при живом переключении ОС. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const KEY = 'itsliventsev-theme';
const shell = fs.readFileSync('assets/shell.js', 'utf8');
const page = fs.readFileSync('index.html', 'utf8');
const headScript = page.match(/<script>\(function\(\)\{try\{var s=localStorage\.getItem\("itsliventsev-theme"\)[\s\S]*?<\/script>/);
assert(headScript, 'в <head> главной нет инлайн-скрипта темы');

function media({ dark, onChange }) {
  return query => ({
    matches: /prefers-color-scheme: dark/.test(query) ? dark : /reduce/.test(query),
    addEventListener: (type, handler) => { if (type === 'change') onChange.push(handler); },
    removeEventListener() {}
  });
}

/* ——— 1. первый заход: системная тема становится темой сайта ——— */
for (const [dark, expected] of [[true, 'dark'], [false, undefined]]) {
  const dom = new JSDOM(
    `<!doctype html><html lang="ru"><head><meta name="theme-color" content="#f6f2e9">${headScript[0]}</head><body></body></html>`,
    { url: 'https://site.test/', runScripts: 'dangerously', beforeParse(window) { window.matchMedia = media({ dark, onChange: [] }); } }
  );
  const theme = dom.window.document.documentElement.dataset.theme;
  assert.equal(theme, expected, `системная тема ${dark ? 'dark' : 'light'} не применилась: получено ${theme}`);
  assert.equal(dom.window.document.querySelector('meta[name="theme-color"]').getAttribute('content'), dark ? '#131210' : '#f6f2e9', 'theme-color не совпадает с темой');
  dom.window.close();
}

/* ——— 2. выбор пользователя главнее системы ——— */
for (const [stored, systemDark, expected] of [['light', true, undefined], ['dark', false, 'dark']]) {
  const dom = new JSDOM(
    `<!doctype html><html lang="ru"><head>${headScript[0]}</head><body></body></html>`,
    {
      url: 'https://site.test/', runScripts: 'dangerously',
      beforeParse(window) {
        window.localStorage.setItem(KEY, stored);
        window.matchMedia = media({ dark: systemDark, onChange: [] });
      }
    }
  );
  assert.equal(dom.window.document.documentElement.dataset.theme, expected, `сохранённая тема ${stored} перебита системной`);
  dom.window.close();
}

/* ——— 3. живое переключение ОС: следуем, пока выбора нет, и молчим, когда он есть ——— */
function shellDom(stored) {
  const handlers = [];
  const dom = new JSDOM('<!doctype html><html lang="ru"><head><title>Тест темы</title></head><body><main id="main-content"><h1>Тест</h1></main></body></html>',
    { url: 'https://site.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = media({ dark: false, onChange: handlers });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.requestAnimationFrame = cb => setTimeout(cb, 0);
  w.fetch = async () => ({ ok: false, json: async () => [] });
  if (stored) w.localStorage.setItem(KEY, stored);
  w.eval(shell);
  return { dom, w, handlers };
}

{
  const { dom, w, handlers } = shellDom(null);
  assert(handlers.length, 'shell.js не слушает prefers-color-scheme');
  assert.notEqual(w.document.documentElement.dataset.theme, 'dark', 'без выбора и без системы тема должна быть светлой');
  handlers.forEach(handler => handler({ matches: true }));
  assert.equal(w.document.documentElement.dataset.theme, 'dark', 'система переключилась в тёмную — сайт не последовал');
  handlers.forEach(handler => handler({ matches: false }));
  assert.notEqual(w.document.documentElement.dataset.theme, 'dark', 'система вернулась в светлую — сайт остался тёмным');
  dom.window.close();
}
{
  const { dom, w, handlers } = shellDom('light');
  handlers.forEach(handler => handler({ matches: true }));
  assert.notEqual(w.document.documentElement.dataset.theme, 'dark', 'сохранённый светлый выбор перебит системной темой');
  dom.window.close();
}

console.log('Theme: system preference is the default, explicit choice wins, live OS switch is followed');
