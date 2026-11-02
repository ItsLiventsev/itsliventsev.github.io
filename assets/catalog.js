/* Local, progressively enhanced search: existing type filters remain the source of the list. */
(function () {
  'use strict';
  const panel = document.querySelector('[data-catalog-search]');
  if (!panel) return;
  const input = panel.querySelector('input');
  const clear = panel.querySelector('[data-catalog-clear]');
  const status = panel.querySelector('[data-catalog-status]');
  const lists = [...document.querySelectorAll('.ws-project-grid, #pub-list, #note-grid')];
  const selector = '.ws-project-card, .ws-publication-row, .ws-note-card';
  const normalize = text => text.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  function update() {
    const query = normalize(input.value);
    const words = query.split(' ').filter(Boolean);
    const cards = lists.flatMap(list => [...list.querySelectorAll(selector)]);
    let matches = 0;
    cards.forEach(card => {
      const content = normalize(card.textContent);
      const visible = words.every(word => content.includes(word));
      card.classList.toggle('catalog-filtered-out', !visible);
      if (visible) matches++;
    });
    clear.hidden = !query;
    status.textContent = query && cards.length ? (matches ? 'Найдено: ' + matches : 'Ничего не найдено. Попробуйте другой запрос.') : '';
  }
  panel.hidden = false;
  input.addEventListener('input', update);
  clear.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
  lists.forEach(list => new MutationObserver(update).observe(list, { childList: true }));
  update();
})();
