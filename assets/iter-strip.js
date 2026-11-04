'use strict';
// Живой режим ленты итераций на главной: строки сменяются каждые ~1 с,
// у каждой своё время, секундомер и счётчики растут, пульс показывает работу.
// Без этого файла (или при prefers-reduced-motion) блок остаётся статичным:
// строки едут CSS-анимацией, кнопка паузы скрыта.
(() => {
  const strip = document.querySelector('[data-iter-strip]');
  if (!strip) return;
  const track = strip.querySelector('[data-iter-track]');
  if (!track) return;

  const toggle = strip.querySelector('[data-iter-toggle]');
  const statusNode = strip.querySelector('[data-iter-status]');
  const clockNode = strip.querySelector('[data-iter-clock]');
  const stepNode = strip.querySelector('[data-iter-step]');
  const checksNode = strip.querySelector('[data-iter-checks]');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  // Шаги сборки сайта: источник, описание и сколько шаг держится на экране.
  // Часть строк — фоновая активность («просто так»), она тоже занимает время.
  const STEPS = [
    { src: 'разметка', text: '121 страница: заголовки, ссылки и id на месте', ms: 1200 },
    { src: 'ссылки', text: 'внутренние ссылки: битых нет', ms: 900 },
    { src: 'контраст', text: 'светлая и тёмная темы держат 4.5:1', ms: 1100 },
    { src: 'axe', text: 'прогоняю страницы в двух темах и на телефоне', ms: 1400 },
    { src: 'поиск', text: 'индекс знает про 122 записи', ms: 800 },
    { src: 'стенды', text: '26 стендов на месте, 45 связей в графе', ms: 1000 },
    { src: 'кеш', text: 'service worker: старые версии вычищены', ms: 700 },
    { src: 'стили', text: 'course.css: один селектор — одно правило', ms: 900 },
    { src: 'карточки', text: 'OG-карточки пересобраны, размеры сходятся', ms: 1300 },
    { src: 'чистка', text: 'мёртвые правила удалены, а не спрятаны', ms: 1000 },
    { src: 'браузер', text: 'шапка не прыгает, кнопки держат фокус', ms: 1200 },
    { src: 'ревью', text: 'правка ушла в ветку, CI собирает проверки', ms: 1500 },
    { src: 'отчёт', text: 'журнал изменений обновлён, версия поднята', ms: 800 },
    { src: 'очередь', text: 'в очереди — таббар в стендах', ms: 1100 }
  ];
  const WINDOW = 5;          // сколько строк видно в окне
  const MAX_CHECKS = 99;     // счётчик не растёт бесконечно

  let paused = false;
  let cursor = 0;
  let checks = 0;
  let steps = 1;
  let elapsed = 0;
  let active = null;
  let tickTimer = 0;
  let clockTimer = 0;

  const pad = value => String(value).padStart(2, '0');
  const clockText = ms => {
    const total = Math.max(0, Math.round(ms / 1000));
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  };
  const durationText = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' с';

  function part(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function makeRow(step, state) {
    const row = document.createElement('li');
    row.className = 'iter-line is-new';
    row.dataset.state = state;
    row.append(part('span', 'iter-mark', state === 'work' ? '→' : '✓'));
    row.querySelector('.iter-mark').setAttribute('aria-hidden', 'true');
    row.append(part('span', 'iter-src', step.src));
    row.append(part('span', 'iter-text', step.text));
    const time = part('time', 'iter-time', '');
    row.append(time);
    if (state === 'work') {
      const bar = part('span', 'iter-bar', '');
      bar.setAttribute('aria-hidden', 'true');
      bar.style.setProperty('--iter-tick', step.ms + 'ms');
      row.append(bar);
    }
    row._started = performance.now();
    return row;
  }

  function paintCounters() {
    if (stepNode) stepNode.textContent = pad(steps);
    if (checksNode) checksNode.textContent = String(checks);
  }

  function paintClock() {
    if (clockNode) clockNode.textContent = clockText(elapsed);
  }

  function trim() {
    const rows = Array.from(track.querySelectorAll('.iter-line')).filter(row => !row.classList.contains('is-out'));
    const extra = rows.length - WINDOW;
    if (extra <= 0) return;
    for (const row of rows.slice(0, extra)) {
      row.classList.add('is-out');
      window.setTimeout(() => row.remove(), 220);
    }
  }

  function finish(row) {
    if (!row || !row.isConnected) return;
    row.dataset.state = 'done';
    row.classList.remove('is-new');
    const mark = row.querySelector('.iter-mark');
    if (mark) mark.textContent = '✓';
    const time = row.querySelector('.iter-time');
    if (time) time.textContent = durationText(Math.max(500, performance.now() - (row._started || 0)));
    const bar = row.querySelector('.iter-bar');
    if (bar) bar.remove();
    checks = Math.min(MAX_CHECKS, checks + 1);
    steps = Math.min(99, steps + 1);
    paintCounters();
  }

  function schedule(delay) {
    window.clearTimeout(tickTimer);
    if (paused || document.hidden) return;
    tickTimer = window.setTimeout(advance, delay);
  }

  function advance() {
    if (paused || document.hidden) return;
    finish(active);
    const step = STEPS[cursor % STEPS.length];
    cursor += 1;
    active = makeRow(step, 'work');
    track.append(active);
    trim();
    const fresh = active;
    window.setTimeout(() => fresh.classList.remove('is-new'), 300);
    schedule(step.ms);
  }

  function restartBar(row) {
    const bar = row && row.querySelector('.iter-bar');
    if (!bar) return;
    bar.replaceWith(bar.cloneNode(false));   // копия наследует --iter-tick и запускает анимацию заново
  }

  function setPaused(next) {
    paused = next;
    strip.classList.toggle('is-paused', paused);
    if (statusNode) statusNode.textContent = paused ? 'на паузе' : 'работа идёт';
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.textContent = paused ? 'продолжить' : 'пауза';
    }
    window.clearTimeout(tickTimer);
    if (paused) return;
    if (active) {
      active._started = performance.now();
      restartBar(active);
    }
    schedule(active ? STEPS[(cursor - 1 + STEPS.length) % STEPS.length].ms : 800);
  }

  function startClock() {
    window.clearInterval(clockTimer);
    clockTimer = window.setInterval(() => {
      if (paused || document.hidden) return;
      elapsed += 1000;
      paintClock();
    }, 1000);
  }

  function boot() {
    // Статический список из разметки: берём последние завершённые строки,
    // вторую копию (для бесшовного круга) выбрасываем — она нужна только CSS.
    const seeds = Array.from(track.children).filter(row => !row.hasAttribute('data-iter-copy') && row.dataset.state === 'done');
    track.textContent = '';
    for (const row of seeds.slice(-(WINDOW - 1))) {
      row.classList.remove('is-new', 'is-out');
      track.append(row);
    }
    checks = seeds.length;
    paintCounters();
    paintClock();
    strip.classList.add('is-live');
    startClock();
    advance();               // первый шаг виден сразу, без пустого окна
  }

  if (toggle) {
    toggle.addEventListener('click', () => setPaused(!paused));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(tickTimer);
      return;
    }
    if (paused || !strip.classList.contains('is-live')) return;
    if (active) {
      active._started = performance.now();
      restartBar(active);
    }
    schedule(600);
  });

  if (reduceMotion && reduceMotion.matches) return;   // статичная лента, кнопки нет
  if (!('requestAnimationFrame' in window)) return;
  boot();
})();
