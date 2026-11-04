/* ==========================================================================
   itsliventsev · knowledge.js — фильтр ленты заметок и подсветка графа.

   Лента собрана статически (scripts/build-knowledge.js): без скриптов все
   карточки видны и доступны по ссылкам. Скрипт только добавляет фильтр по
   рубрике и связи «карточка ↔ кнопка фильтра».

   Граф: SVG-рёбра и узлы уже в разметке, координаты приходят из data-
   атрибутов. Скрипт переносит их в CSS-переменные и подсвечивает рёбра
   узла под курсором или фокусом. Ноль зависимостей, только DOM.
   ========================================================================== */
(function () {
  'use strict';

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* ——— фильтр ленты по рубрике ——— */
  function initFilters() {
    const filters = document.querySelector('[data-kn-filters]');
    const stream = document.querySelector('[data-kn-stream]');
    if (!filters || !stream) return;
    const buttons = [...filters.querySelectorAll('[data-kn-zone]')];
    const cards = [...stream.querySelectorAll('[data-kn-zone]')];
    const empty = document.querySelector('[data-kn-empty]');
    const status = document.querySelector('[data-catalog-status]');
    const input = document.querySelector('[data-kn-search]');

    function apply() {
      const zone = (buttons.find((button) => button.getAttribute('aria-pressed') === 'true') || buttons[0]).dataset.knZone;
      const query = input ? input.value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim() : '';
      let shown = 0;
      cards.forEach((card) => {
        const zoneOk = zone === 'all' || card.dataset.knZone === zone;
        const textOk = !query || card.textContent.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').includes(query);
        const visible = zoneOk && textOk;
        card.hidden = !visible;
        if (visible) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      if (status) {
        status.textContent = (zone === 'all' && !query)
          ? 'Показаны все заметки.'
          : (shown ? 'Найдено: ' + shown : 'Ничего не найдено. Попробуйте другой запрос.');
      }
    }

    buttons.forEach((button) => button.addEventListener('click', () => {
      buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      apply();
    }));
    if (input) {
      input.addEventListener('input', apply);
      const panel = input.closest('[data-catalog-search]');
      if (panel) panel.hidden = false;
      const clear = document.querySelector('[data-catalog-clear]');
      if (clear) {
        clear.hidden = false;
        clear.addEventListener('click', () => { input.value = ''; apply(); input.focus(); });
      }
    }
    apply();
  }

  /* ——— граф: живая схема связей ———
     Разметка приносит детерминированные «домашние» координаты (style-x/style-y)
     и готовые линии. Скрипт переносит узлы в абсолютные координаты поля,
     запускает мягкую физику (пружины по связям, отталкивание, притяжение
     к сектору своей рубрики) и добавляет подсветку окружения, перетаскивание
     и кнопки движения. Без скриптов остаётся статическая схема — навигация
     и таблица связей ниже работают в любом случае. */
  function initGraph() {
    const stage = document.querySelector('[data-kn-graph]');
    if (!stage) return;
    const field = stage.querySelector('[data-kn-graph-field]') || stage;
    const nodes = [...stage.querySelectorAll('.kn-node')];
    if (!nodes.length) return;
    const lines = [...stage.querySelectorAll('.kn-graph-svg line')];
    const svg = stage.querySelector('.kn-graph-svg');
    const filters = [...document.querySelectorAll('[data-graph-zone]')];
    const status = document.querySelector('[data-graph-status]');
    const toggle = document.querySelector('[data-graph-action="toggle"]');
    const reset = document.querySelector('[data-graph-action="reset"]');
    const byId = new Map(nodes.map((node) => [node.dataset.node, node]));
    const links = lines.map((line) => ({
      line,
      a: byId.get(line.dataset.from),
      b: byId.get(line.dataset.to),
    })).filter((link) => link.a && link.b);
    const neighbours = new Map(nodes.map((node) => [node.dataset.node, new Set()]));
    links.forEach((link) => {
      const from = link.a.dataset.node, to = link.b.dataset.node;
      if (!neighbours.has(from) || !neighbours.has(to)) return;
      neighbours.get(from).add(to);
      neighbours.get(to).add(from);
    });

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = stage.clientWidth || 800;
    let height = stage.clientHeight || 450;

    /* Состояние узла — в процентах поля, чтобы переживать ресайз без пересчёта. */
    const bodies = nodes.map((node) => {
      const x = parseFloat(node.getAttribute('style-x'));
      const y = parseFloat(node.getAttribute('style-y'));
      node.removeAttribute('style-x');
      node.removeAttribute('style-y');
      return {
        node,
        id: node.dataset.node,
        zone: node.dataset.zone || '',
        x, y, vx: 0, vy: 0,
        homeX: x, homeY: y, baseX: x, baseY: y,
        radius: node.dataset.rank === 'hub' ? 1.55 : node.dataset.rank === 'link' ? 1.2 : 1,
        pinned: false,
      };
    });
    const byBody = new Map(bodies.map((body) => [body.id, body]));
    const pairs = links.map((link) => ({ a: byBody.get(link.a.dataset.node), b: byBody.get(link.b.dataset.node), line: link.line }))
      .filter((pair) => pair.a && pair.b);

    const place = () => {
      bodies.forEach((body) => {
        body.node.style.setProperty('left', body.x.toFixed(2) + '%');
        body.node.style.setProperty('top', body.y.toFixed(2) + '%');
      });
      pairs.forEach((pair) => {
        pair.line.setAttribute('x1', pair.a.x.toFixed(2));
        pair.line.setAttribute('y1', pair.a.y.toFixed(2));
        pair.line.setAttribute('x2', pair.b.x.toFixed(2));
        pair.line.setAttribute('y2', pair.b.y.toFixed(2));
      });
    };
    /* ——— подсветка окружения ——— */
    let activeId = null;
    const highlight = (id) => {
      activeId = id;
      const near = id ? neighbours.get(id) : null;
      pairs.forEach((pair) => {
        const active = id && (pair.a.id === id || pair.b.id === id);
        pair.line.dataset.active = active ? 'true' : 'false';
        pair.line.dataset.muted = id && !active ? 'true' : 'false';
      });
      bodies.forEach((body) => {
        const related = !id || body.id === id || (near && near.has(body.id));
        body.node.dataset.dim = related ? 'false' : 'true';
        body.node.dataset.active = body.id === id ? 'true' : 'false';
      });
      /* Соседи слегка подтягиваются к активному узлу: видно, кто с кем связан. */
      if (id && running) bodies.forEach((body) => {
        if (near && near.has(body.id)) { body.vx += (byBody.get(id).x - body.x) * 0.02; body.vy += (byBody.get(id).y - body.y) * 0.02; }
      });
    };

    /* ——— физика ———
       Три силы и одно ограничение: пружины тянут связанные узлы друг к другу,
       отталкивание не даёт им слипнуться, «дом» возвращает узел в сектор его
       рубрики. Скорость гасится трением. Всё считается в процентах поля. */
    let running = !reduced;
    let frame = 0;
    let raf = null;
    const STEP = 0.016;
    function tick() {
      if (!running) return;
      frame++;
      /* Пружины: чем длиннее связь, тем сильнее тянет. */
      for (const pair of pairs) {
        const dx = pair.b.x - pair.a.x, dy = pair.b.y - pair.a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const rest = 18;
        const force = (dist - rest) * 0.0016;
        const ux = dx / dist, uy = dy / dist;
        pair.a.vx += ux * force * STEP * 60; pair.a.vy += uy * force * STEP * 60;
        pair.b.vx -= ux * force * STEP * 60; pair.b.vy -= uy * force * STEP * 60;
      }
      /* Отталкивание: только между близкими парами, иначе O(n²) съест кадры. */
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i], b = bodies[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > 260 || dist2 < 0.0001) continue;
          const dist = Math.sqrt(dist2);
          const push = (5 / dist) * 0.02;
          const ux = dx / dist, uy = dy / dist;
          a.vx -= ux * push; a.vy -= uy * push;
          b.vx += ux * push; b.vy += uy * push;
        }
      }
      /* Дом: слабое притяжение к своей позиции в секторе рубрики. */
      for (const body of bodies) {
        if (body.pinned) continue;
        body.vx += (body.homeX - body.x) * 0.0025;
        body.vy += (body.homeY - body.y) * 0.0025;
        body.vx *= 0.935; body.vy *= 0.935;
        body.x += body.vx; body.y += body.vy;
        body.x = Math.min(97, Math.max(3, body.x));
        body.y = Math.min(96, Math.max(4, body.y));
      }
      place();
      raf = requestAnimationFrame(tick);
    }
    const start = () => { if (raf || !running) return; raf = requestAnimationFrame(tick); };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };

    place();
    if (running) start();
    stage.dataset.motion = running ? 'on' : 'off';

    /* ——— перетаскивание: указатель и клавиатура ——— */
    let drag = null;
    const setFromPointer = (body, event) => {
      const rect = stage.getBoundingClientRect();
      body.x = Math.min(97, Math.max(3, ((event.clientX - rect.left) / rect.width) * 100));
      body.y = Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100));
      body.vx = 0; body.vy = 0;
      place();
    };
    nodes.forEach((node) => {
      const body = byBody.get(node.dataset.node);
      node.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        drag = body;
        body.pinned = true;
        node.dataset.dragging = 'true';
        node.setPointerCapture?.(event.pointerId);
        highlight(body.id);
      });
    });
    stage.addEventListener('pointermove', (event) => {
      if (!drag) return;
      event.preventDefault();
      setFromPointer(drag, event);
    });
    const release = () => {
      if (!drag) return;
      drag.pinned = false;
      /* Узел остаётся там, куда его положили: «дом» обновляется, иначе физика
         утащит его обратно в сектор и раскладка пользователя не сохранится. */
      drag.homeX = drag.x; drag.homeY = drag.y;
      drag.node.dataset.dragging = 'false';
      announce('Узел закреплён: «' + drag.node.textContent.trim() + '». Кнопка «собрать заново» вернёт раскладку.');
      drag = null;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    /* Клавиатура: узел — ссылка, поэтому Enter открывает заметку, а стрелки
       с Shift двигают его по полю (иначе перетаскивание недоступно без мыши). */
    const moveByKey = (body, dx, dy) => {
      body.x = Math.min(97, Math.max(3, body.x + dx));
      body.y = Math.min(96, Math.max(4, body.y + dy));
      body.homeX = body.x; body.homeY = body.y;
      place();
    };
    nodes.forEach((node) => {
      const body = byBody.get(node.dataset.node);
      node.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 4 : 1.2;
        const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const delta = map[event.key];
        if (!delta || !event.shiftKey) return;
        event.preventDefault();
        moveByKey(body, delta[0], delta[1]);
        announce(body.node.textContent.trim() + ' — сдвинуто');
      });
      node.addEventListener('mouseenter', () => highlight(body.id));
      node.addEventListener('focus', () => highlight(body.id));
      node.addEventListener('mouseleave', () => highlight(activeFromHash()));
      node.addEventListener('blur', () => highlight(activeFromHash()));
    });

    /* ——— фильтр по рубрике ——— */
    const applyFilter = (zone) => {
      let shown = 0;
      bodies.forEach((body) => {
        const visible = zone === 'all' || body.zone === zone;
        body.node.hidden = !visible;
        if (!visible) return;
        shown++;
      });
      pairs.forEach((pair) => {
        const visible = (zone === 'all' || pair.a.zone === zone || pair.b.zone === zone);
        pair.line.dataset.hidden = visible ? 'false' : 'true';
      });
      stage.dataset.filter = zone;
      const many = (n) => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'узел' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'узла' : 'узлов');
      if (status) status.textContent = zone === 'all'
        ? 'Показаны все узлы: ' + many(shown) + ', ' + pairs.length + ' ' + (pairs.length % 10 === 1 && pairs.length % 100 !== 11 ? 'связь' : pairs.length % 10 >= 2 && pairs.length % 10 <= 4 && (pairs.length % 100 < 10 || pairs.length % 100 >= 20) ? 'связи' : 'связей') + '.'
        : 'Рубрика: ' + many(shown) + '; связи с другими рубриками остаются на месте.';
    };
    filters.forEach((button) => button.addEventListener('click', () => {
      filters.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      applyFilter(button.dataset.graphZone);
    }));
    if (filters.length) applyFilter('all');

    /* ——— движение ——— */
    const setRunning = (next) => {
      running = next && !reduced;
      stage.dataset.motion = running ? 'on' : 'off';
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(!running));
        toggle.textContent = running ? 'движение: включено' : 'движение: пауза';
      }
      if (running) start(); else stop();
    };
    if (toggle) {
      if (reduced) {
        toggle.disabled = true;
        toggle.textContent = 'движение: выключено в системе';
      }
      toggle.addEventListener('click', () => setRunning(!running));
    }
    if (reset) {
      reset.addEventListener('click', () => {
        bodies.forEach((body) => {
          /* baseX/baseY — позиция из разметки: к ней возвращает «собрать
             заново», а homeX/homeY мог изменить пользователь перетаскиванием. */
          body.x = body.baseX; body.y = body.baseY;
          body.homeX = body.baseX; body.homeY = body.baseY;
          body.vx = 0; body.vy = 0; body.pinned = false;
        });
        place();
        announce('Узлы вернулись на места.');
      });
    }

    const counter = document.querySelector('[data-graph-count]');
    if (counter) counter.textContent = nodes.length + ' ' + (nodes.length % 10 === 1 && nodes.length % 100 !== 11 ? 'узел' : 'узлов');
    const announce = (text) => { if (status) status.textContent = text; };

    /* Ссылка вида /blog/graph.html#note-id подсвечивает окружение заметки. */
    function activeFromHash() {
      if (!location.hash) return null;
      const target = byId.get(location.hash.slice(1));
      return target ? target.dataset.node : null;
    }
    const fromHash = activeFromHash();
    if (fromHash) {
      highlight(fromHash);
      const target = byId.get(fromHash);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: false });
    } else {
      highlight(null);
    }

    /* Ресайз: проценты остаются, пиксельные линии пересчитывать не нужно,
       но при смене размеров поля узлы не должны «выпрыгивать» — place() хватает. */
    if (window.ResizeObserver) {
      new ResizeObserver(() => { width = stage.clientWidth || width; height = stage.clientHeight || height; place(); }).observe(stage);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (running) start();
    });
  }

  initFilters();
  initGraph();
})();
