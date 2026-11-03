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

  /* ——— граф: координаты из разметки и подсветка рёбер ——— */
  function initGraph() {
    const stage = document.querySelector('[data-kn-graph]');
    if (!stage) return;
    const nodes = [...stage.querySelectorAll('.kn-node')];
    const lines = [...stage.querySelectorAll('.kn-graph-svg line')];
    nodes.forEach((node) => {
      node.style.setProperty('left', node.getAttribute('style-x') + '%');
      node.style.setProperty('top', node.getAttribute('style-y') + '%');
      node.removeAttribute('style-x');
      node.removeAttribute('style-y');
    });

    const byId = new Map(nodes.map((node) => [node.dataset.node, node]));
    const highlight = (id) => {
      lines.forEach((line) => {
        const active = id && (line.dataset.from === id || line.dataset.to === id);
        line.dataset.active = active ? 'true' : 'false';
      });
      nodes.forEach((node) => {
        const related = !id || node.dataset.node === id
          || lines.some((line) => (line.dataset.from === id && line.dataset.to === node.dataset.node)
            || (line.dataset.to === id && line.dataset.from === node.dataset.node));
        node.dataset.dim = related ? 'false' : 'true';
      });
    };
    nodes.forEach((node) => {
      node.addEventListener('mouseenter', () => highlight(node.dataset.node));
      node.addEventListener('focus', () => highlight(node.dataset.node));
      node.addEventListener('mouseleave', () => highlight(null));
      node.addEventListener('blur', () => highlight(null));
    });
    const counter = document.querySelector('[data-graph-count]');
    if (counter) counter.textContent = nodes.length + ' ' + (nodes.length % 10 === 1 && nodes.length % 100 !== 11 ? 'узел' : 'узлов');
    highlight(null);

    /* Глубина ссылки: /blog/graph.html#note-id выделяет узел сразу. */
    if (location.hash) {
      const target = byId.get(location.hash.slice(1));
      if (target) highlight(target.dataset.node);
    }
  }

  initFilters();
  initGraph();
})();
