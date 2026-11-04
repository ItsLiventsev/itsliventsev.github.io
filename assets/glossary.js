/* Словарь практик: живой фильтр терминов и тренажёр «проверь себя».
   Zero-dep, подключается только на stands/glossary.html.

   Фильтр: ищем по тексту карточки и по вселенной, скрываем пустые разделы,
   результат уходит в role=status.
   Тренажёр: десять случайных терминов, к каждому четыре определения — одно
   верное и три из словаря. Ответ разбирается сразу: показываем полное
   определение и объясняем промах. Лучший результат живёт в localStorage,
   сервер не нужен. Без JS страница остаётся обычным словарём. */
(function () {
  'use strict';

  var doc = document;

  /* ——— 1. Фильтр ——— */
  function initFilter() {
    var input = doc.getElementById('glossary-search');
    if (!input) return;
    var heads = Array.prototype.slice.call(doc.querySelectorAll('.st-section-head'));
    var grids = Array.prototype.slice.call(doc.querySelectorAll('dl.glossary-grid'));
    var filters = Array.prototype.slice.call(doc.querySelectorAll('[data-ws-glossary-filter]'));
    var status = doc.getElementById('glossary-status');
    var empty = doc.getElementById('glossary-empty');
    var total = doc.querySelectorAll('.glossary-item').length;
    var activeFilter = 'all';

    function render() {
      var q = input.value.trim().toLocaleLowerCase('ru');
      var shown = 0;
      grids.forEach(function (dl, idx) {
        var sectionCount = 0;
        dl.querySelectorAll('.glossary-item').forEach(function (item) {
          var text = item.textContent.toLocaleLowerCase('ru');
          var universeMatch = activeFilter === 'all' || text.indexOf(activeFilter.toLocaleLowerCase('ru')) !== -1;
          var textMatch = !q || text.indexOf(q) !== -1;
          var hit = universeMatch && textMatch;
          item.hidden = !hit;
          if (hit) sectionCount++;
        });
        if (heads[idx]) heads[idx].hidden = sectionCount === 0;
        dl.hidden = sectionCount === 0;
        shown += sectionCount;
      });
      if (empty) empty.hidden = shown !== 0;
      if (status) status.textContent = (q || activeFilter !== 'all') ? ('найдено: ' + shown + ' из ' + total) : '';
    }

    input.addEventListener('input', render);
    filters.forEach(function (button) {
      button.addEventListener('click', function () {
        activeFilter = button.getAttribute('data-ws-glossary-filter');
        filters.forEach(function (other) { other.setAttribute('aria-pressed', other === button ? 'true' : 'false'); });
        render();
      });
    });
  }

  /* ——— 2. Тренажёр ——— */
  var ROUND = 10;
  var STORE_KEY = 'itsliventsev-drill-v1';
  var OPTION_LIMIT = 150;

  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  /* Определение в варианте ответа обрезаем по границе слова: читать четыре
     абзаца на мобильном — работа, а терять смысл нельзя. Полный текст
     показываем после ответа. */
  function shorten(text, limit) {
    var value = clean(text);
    if (value.length <= limit) return value;
    var cut = value.slice(0, limit);
    var space = cut.lastIndexOf(' ');
    if (space > limit * 0.6) cut = cut.slice(0, space);
    return cut.replace(/[.,;:—–-]+$/, '') + '…';
  }

  function readItems() {
    var items = [];
    Array.prototype.forEach.call(doc.querySelectorAll('dl.glossary-grid'), function (dl, groupIdx) {
      var head = dl.previousElementSibling;
      while (head && !/st-section-head/.test(head.className || '')) head = head.previousElementSibling;
      var title = head ? clean((head.querySelector('h2') || {}).textContent) : '';
      Array.prototype.forEach.call(dl.querySelectorAll('.glossary-item'), function (item) {
        var dt = item.querySelector('dt');
        var dd = item.querySelector('dd');
        if (!dt || !dd) return;
        var label = dt.cloneNode(true);
        Array.prototype.forEach.call(label.querySelectorAll('.gl-term-tag'), function (tag) { tag.remove(); });
        var term = clean(label.textContent);
        var def = clean(dd.textContent);
        if (!term || !def) return;
        var tag = dt.querySelector('.gl-term-tag');
        items.push({
          term: term,
          def: def,
          universe: tag && !tag.classList.contains('gl-term-new') ? clean(tag.textContent) : '',
          group: groupIdx,
          title: title
        });
      });
    });
    return items;
  }

  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /* Три неверных определения: сначала из того же раздела — так варианты
     не подсказывают ответ очевидной тематикой. Если рядом мало терминов,
     добираем из остального словаря. */
  function buildOptions(question, items) {
    var near = shuffle(items.filter(function (item) {
      return item !== question && item.group === question.group;
    }));
    var far = shuffle(items.filter(function (item) {
      return item !== question && item.group !== question.group;
    }));
    var pool = near.concat(far).filter(function (item) { return item.def !== question.def; });
    var options = [];
    var seen = {};
    seen[question.def] = true;
    for (var i = 0; i < pool.length && options.length < 3; i++) {
      if (seen[pool[i].def]) continue;
      seen[pool[i].def] = true;
      options.push({ text: shorten(pool[i].def, OPTION_LIMIT), full: pool[i].def, correct: false });
    }
    options.push({ text: shorten(question.def, OPTION_LIMIT), full: question.def, correct: true });
    return shuffle(options);
  }

  function loadBest() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var value = raw ? JSON.parse(raw) : null;
      if (!value || typeof value.right !== 'number' || typeof value.total !== 'number') return null;
      return value;
    } catch (e) { return null; }
  }

  function saveBest(right, total) {
    try {
      var best = loadBest();
      if (!best || right > best.right) {
        localStorage.setItem(STORE_KEY, JSON.stringify({ right: right, total: total }));
        return { right: right, total: total, fresh: true };
      }
      return best;
    } catch (e) { return null; }
  }

  function initDrill() {
    var zone = doc.querySelector('[data-drill-zone]');
    var panel = doc.querySelector('[data-drill]');
    var trigger = doc.querySelector('[data-drill-open]');
    if (!zone || !panel || !trigger) return;

    var items = readItems();
    if (items.length < 4) return;

    var count = panel.querySelector('[data-drill-count]');
    var dots = panel.querySelector('[data-drill-dots]');
    var termBox = panel.querySelector('[data-drill-term]');
    var optionsBox = panel.querySelector('[data-drill-options]');
    var verdict = panel.querySelector('[data-drill-verdict]');
    var next = panel.querySelector('[data-drill-next]');
    var again = panel.querySelector('[data-drill-again]');
    var bestBox = panel.querySelector('[data-drill-best]');
    var close = panel.querySelector('[data-drill-close]');

    var questions = [];
    var index = 0;
    var right = 0;
    var answered = false;
    var finished = false;

    zone.hidden = false;
    trigger.hidden = false;

    function showBest() {
      if (!bestBox) return;
      var best = loadBest();
      bestBox.textContent = best ? ('лучший результат: ' + best.right + ' из ' + best.total) : '';
    }

    function paintDots() {
      if (!dots) return;
      dots.innerHTML = '';
      questions.forEach(function (question, i) {
        var dot = doc.createElement('i');
        dot.setAttribute('data-dot', '');
        if (i < index) dot.setAttribute('data-state', 'done');
        else if (i === index && !finished) dot.setAttribute('data-state', 'now');
        dots.appendChild(dot);
      });
    }

    function start() {
      questions = shuffle(items).slice(0, Math.min(ROUND, items.length));
      index = 0;
      right = 0;
      finished = false;
      panel.hidden = false;
      showBest();
      render();
    }

    function render() {
      var question = questions[index];
      if (!question) return finish();
      answered = false;
      finished = false;
      if (count) count.textContent = (index + 1) + ' / ' + questions.length;
      if (termBox) {
        termBox.textContent = question.term;
        termBox.setAttribute('data-universe', question.universe || 'словарь');
      }
      if (verdict) {
        verdict.textContent = 'выберите верное определение';
        verdict.removeAttribute('data-state');
      }
      if (next) next.hidden = true;
      if (again) again.hidden = true;
      if (optionsBox) {
        optionsBox.innerHTML = '';
        buildOptions(question, items).forEach(function (option, i) {
          var button = doc.createElement('button');
          button.type = 'button';
          button.className = 'gl-drill-option';
          button.setAttribute('data-drill-option', '');
          if (option.correct) button.setAttribute('data-correct', 'true');
          var key = doc.createElement('span');
          key.className = 'gl-drill-key';
          key.textContent = String(i + 1);
          var text = doc.createElement('span');
          text.className = 'gl-drill-def';
          text.textContent = option.text;
          button.appendChild(key);
          button.appendChild(text);
          button.addEventListener('click', function () { answer(button); });
          optionsBox.appendChild(button);
        });
      }
      paintDots();
    }

    function answer(button) {
      if (answered || finished) return;
      answered = true;
      var question = questions[index];
      var ok = button.getAttribute('data-correct') === 'true';
      if (ok) right++;
      Array.prototype.forEach.call(optionsBox.querySelectorAll('[data-drill-option]'), function (option) {
        option.disabled = true;
        if (option.getAttribute('data-correct') === 'true') option.setAttribute('data-state', 'right');
        else if (option === button) option.setAttribute('data-state', 'wrong');
      });
      if (verdict) {
        verdict.setAttribute('data-state', ok ? 'right' : 'wrong');
        verdict.textContent = (ok ? 'верно. ' : 'мимо. ') + question.term + ' — ' + question.def;
      }
      if (next) next.hidden = false;
      paintDots();
    }

    function finish() {
      finished = true;
      var best = saveBest(right, questions.length);
      if (count) count.textContent = right + ' из ' + questions.length;
      if (termBox) {
        termBox.textContent = 'круг закрыт';
        termBox.removeAttribute('data-universe');
      }
      if (optionsBox) optionsBox.innerHTML = '';
      if (verdict) {
        verdict.setAttribute('data-state', right >= Math.ceil(questions.length * 0.7) ? 'right' : 'wrong');
        verdict.textContent = right === questions.length
          ? 'чисто: все ' + questions.length + ' терминов угаданы без промаха.'
          : 'угадано ' + right + ' из ' + questions.length + '. Лучшее можно побить — раунд собирается заново из всего словаря.';
      }
      if (next) next.hidden = true;
      if (again) again.hidden = false;
      if (bestBox) {
        bestBox.textContent = best ? ('лучший результат: ' + best.right + ' из ' + best.total) : '';
      }
      paintDots();
      if (again) again.focus();
    }

    function open() {
      start();
      if (typeof panel.scrollIntoView === 'function') {
        try { panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { panel.scrollIntoView(); }
      }
      var first = optionsBox && optionsBox.querySelector('[data-drill-option]');
      if (first) first.focus();
    }

    function shut() {
      panel.hidden = true;
      trigger.focus();
    }

    trigger.addEventListener('click', open);
    if (close) close.addEventListener('click', shut);
    if (next) next.addEventListener('click', function () { index++; render(); });
    if (again) again.addEventListener('click', start);

    /* Клавиши 1–4 отвечают за вариант, Escape закрывает тренажёр: мышкой
       на десяти вопросах подряд работать медленно. */
    panel.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); shut(); return; }
      var digit = parseInt(event.key, 10);
      if (!(digit >= 1 && digit <= 4) || answered || finished) return;
      var option = optionsBox && optionsBox.querySelectorAll('[data-drill-option]')[digit - 1];
      if (option) { event.preventDefault(); answer(option); }
    });
  }

  function boot() {
    initFilter();
    initDrill();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
