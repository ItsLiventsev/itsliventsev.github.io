'use strict';
// Живая лента итераций на главной: node scripts/test-iter-strip.js
// Проверяет assets/iter-strip.js в настоящем DOM (jsdom): шаги сменяются,
// время и счётчики растут, пауза останавливает движение, при
// prefers-reduced-motion блок остаётся статичным.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'assets/iter-strip.js'), 'utf8');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function build({ reduce = false } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  // jsdom не знает про медиазапросы — подменяем ровно то, что нужно движку.
  window.matchMedia = query => ({
    media: query,
    matches: reduce && /prefers-reduced-motion: reduce/.test(query),
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  });
  window.eval(script);
  const strip = window.document.querySelector('[data-iter-strip]');
  const track = strip.querySelector('[data-iter-track]');
  return {
    dom,
    strip,
    track,
    toggle: strip.querySelector('[data-iter-toggle]'),
    clock: strip.querySelector('[data-iter-clock]'),
    status: strip.querySelector('[data-iter-status]'),
    step: strip.querySelector('[data-iter-step]'),
    checks: strip.querySelector('[data-iter-checks]'),
    rows: () => Array.from(track.querySelectorAll('.iter-line')),
    work: () => Array.from(track.querySelectorAll('.iter-line[data-state="work"]'))
  };
}

(async () => {
  /* ——— обычный режим: живая лента ——— */
  const live = build();
  assert(live.strip.classList.contains('is-live'), 'без класса is-live лента не переходит в живой режим');
  assert.equal(live.work().length, 1, 'в окне должен быть ровно один текущий шаг');
  assert(live.rows().length <= 5, 'в окне не больше пяти строк, получено ' + live.rows().length);
  assert(!live.track.querySelector('[data-iter-copy]'), 'вторая копия списка нужна только CSS-анимации');
  const startChecks = Number(live.checks.textContent);
  const startStep = live.step.textContent;
  assert.equal(live.status.textContent, 'работа идёт', 'статус должен сообщать, что работа идёт');
  assert.equal(live.clock.textContent, '00:00', 'секундомер стартует с нуля');

  const firstWork = live.work()[0];
  const seeds = new Set(live.rows().filter(row => row.dataset.state === 'done'));
  await sleep(1600);           // первый шаг длится 1200 мс
  const fresh = live.rows().filter(row => !seeds.has(row) && row.dataset.state === 'done');
  assert(fresh.length >= 1, 'после первого шага должен появиться завершённый шаг из очереди');
  assert(/^\d,\d с$/.test(fresh[0].querySelector('.iter-time').textContent),
    'у завершённого шага должно появиться измеренное время: ' + fresh[0].querySelector('.iter-time').textContent);
  assert.equal(firstWork.dataset.state, 'done', 'отработавший шаг переходит в «готово»');
  assert(!firstWork.querySelector('.iter-bar'), 'полоска прогресса снимается с готового шага');
  assert(live.rows().length <= 5, 'окно не должно разрастаться: ' + live.rows().length);
  assert.equal(Number(live.checks.textContent), startChecks + 1, 'счётчик проверок растёт на каждом шаге');
  assert.notEqual(live.step.textContent, startStep, 'номер итерации должен увеличиваться');
  assert(/^00:0[1-9]$/.test(live.clock.textContent), 'секундомер должен идти: ' + live.clock.textContent);
  assert.equal(live.work().length, 1, 'новый текущий шаг ровно один');

  /* ——— пауза: движение замирает, aria-pressed честный ——— */
  live.toggle.click();
  assert.equal(live.toggle.getAttribute('aria-pressed'), 'true', 'пауза должна выставлять aria-pressed="true"');
  assert.equal(live.toggle.textContent, 'продолжить', 'подпись кнопки меняется на «продолжить»');
  assert.equal(live.status.textContent, 'на паузе', 'статус должен сообщать о паузе');
  assert(live.strip.classList.contains('is-paused'), 'класс is-paused останавливает анимации');
  const frozenStep = live.work()[0];
  const frozenChecks = live.checks.textContent;
  const frozenClock = live.clock.textContent;
  await sleep(1600);
  assert.equal(live.work()[0], frozenStep, 'на паузе текущий шаг не меняется');
  assert.equal(live.checks.textContent, frozenChecks, 'на паузе счётчик проверок стоит');
  assert.equal(live.clock.textContent, frozenClock, 'на паузе секундомер стоит');

  /* ——— продолжение: работа возвращается ——— */
  live.toggle.click();
  assert.equal(live.toggle.getAttribute('aria-pressed'), 'false', 'продолжение снимает aria-pressed');
  assert.equal(live.status.textContent, 'работа идёт', 'статус возвращается к работе');
  await sleep(1600);
  assert.equal(Number(live.checks.textContent), Number(frozenChecks) + 1, 'после продолжения шаги снова идут');
  live.dom.window.close();

  /* ——— reduced motion: статичный список без счётчиков ——— */
  const still = build({ reduce: true });
  assert(!still.strip.classList.contains('is-live'), 'при reduced-motion живой режим не включается');
  assert.equal(still.rows().length, 18, 'при reduced-motion остаются обе копии статичного списка');
  assert.equal(still.clock.textContent, '00:00', 'секундомер при reduced-motion не идёт');
  assert.equal(still.toggle.getAttribute('aria-pressed'), 'false', 'кнопка паузы не переключается сама');
  still.dom.window.close();

  console.log('Iter strip: live steps, clock, counters, pause and reduced-motion OK');
})().catch(error => {
  // Открытые окна jsdom держат таймеры движка — выходим явно, иначе шаг зависнет.
  console.error('Iter strip: ' + (error && error.message));
  process.exit(1);
});
