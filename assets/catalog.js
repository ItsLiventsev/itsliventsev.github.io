/* Каталог: поиск и фильтр по рубрике — один контракт на все витрины.
 *
 * До этого у трёх каталогов было три реализации: «Проекты» искали через этот
 * файл, «Статьи» фильтровали себя инлайновым скриптом по `data-type-filter`,
 * а лента заметок — своим кодом в `knowledge.js` по `data-kn-zone`. Поведение
 * расходилось: где-то пустой результат гасил список, где-то нет; поиск и
 * фильтр не складывались; статус говорил разными словами.
 *
 * Контракт (разметка задаёт данные, скрипт только показывает):
 *   [data-catalog-search] — панель поиска: input + [data-catalog-clear];
 *   [data-catalog-filter] — чипы, значение = тег («all» — без фильтра);
 *   [data-catalog-list]   — контейнер списка (их может быть несколько);
 *   [data-catalog-tags]   — элемент списка; теги через пробел;
 *   [data-catalog-status] — строка состояния (aria-live в разметке);
 *   [data-catalog-empty]  — заглушка «под этот фильтр ничего нет»;
 *   [data-catalog-group]  — раздел вокруг части списка: пустой раздел
 *                           сворачивается вместе со своим заголовком.
 *
 * Фильтр и поиск складываются: чип сужает список, запрос сужает остаток.
 */
(function () {
  'use strict';

  /* Разметку читаем на каждый проход, а не один раз при загрузке: «Статьи»
     рисуют и строки, и чипы уже после того, как скрипт отработал, — при
     связывании обработчиков «на месте» такие чипы оставались мёртвыми. */
  const chipNodes = () => [...document.querySelectorAll('[data-catalog-filter]')];
  const listNodes = () => [...document.querySelectorAll('[data-catalog-list]')];
  const statusNode = () => document.querySelector('[data-catalog-status]');
  const emptyNode = () => document.querySelector('[data-catalog-empty]');
  const panelNode = () => document.querySelector('[data-catalog-search]');
  const groupNodes = () => [...document.querySelectorAll('[data-catalog-group]')];

  if (!listNodes().length && !chipNodes().length && !panelNode()) return;

  const normalize = text => String(text || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const items = () => {
    const lists = listNodes();
    return lists.length
      ? lists.flatMap(list => [...list.querySelectorAll('[data-catalog-tags]')])
      : [...document.querySelectorAll('[data-catalog-tags]')];
  };

  let active = 'all';

  function update() {
    const panel = panelNode();
    const input = panel ? panel.querySelector('input') : null;
    const clear = panel ? panel.querySelector('[data-catalog-clear]') : null;
    const status = statusNode();
    const empty = emptyNode();
    const chips = chipNodes();
    const query = input ? normalize(input.value) : '';
    const words = query.split(' ').filter(Boolean);
    const tag = chips.length ? active : 'all';
    const all = items();
    let shown = 0;

    for (const item of all) {
      const tags = normalize(item.dataset.catalogTags).split(' ').filter(Boolean);
      const tagOk = tag === 'all' || tags.includes(tag);
      const textOk = !words.length || words.every(word => normalize(item.textContent).includes(word));
      const visible = tagOk && textOk;
      if (item.hidden === visible) item.hidden = !visible;
      if (visible) shown++;
    }

    /* Раздел, в котором после фильтра не осталось ни одной карточки, целиком
       уходит вместе с заголовком — иначе на странице висят пустые секции. */
    for (const group of groupNodes()) {
      const inside = all.filter(item => group.contains(item));
      if (!inside.length) continue;
      const anyVisible = inside.some(item => !item.hidden);
      if (group.hidden !== !anyVisible) group.hidden = !anyVisible;
    }

    for (const chip of chips) chip.setAttribute('aria-pressed', String((chip.dataset.catalogFilter || 'all') === tag));
    const filtered = tag !== 'all' || words.length;
    if (clear) clear.hidden = !query;
    /* Заглушка — про фильтр, а не про загрузку: пока список пуст целиком,
       честнее оставить «Загружаю список…» из разметки. */
    if (empty) empty.hidden = !(filtered && shown === 0 && all.length > 0);

    if (status) {
      const text = !filtered || !all.length
        ? ''
        : shown
          ? 'Найдено: ' + shown
          : 'Ничего не найдено. Попробуйте другой запрос.';
      /* Пишем только изменения: иначе правка текста сама будит наблюдатель. */
      if (status.textContent !== text) status.textContent = text;
    }
  }

  const panel = panelNode();
  if (panel) panel.hidden = false;

  /* Делегирование вместо привязки к найденным чипам: активным может быть один
     в группе, а групп и перерисовок на странице бывает несколько. */
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const clear = target && target.closest('[data-catalog-clear]');
    if (clear) {
      const field = panelNode() && panelNode().querySelector('input');
      if (field) { field.value = ''; update(); field.focus(); }
      return;
    }
    const chip = target && target.closest('[data-catalog-filter]');
    if (!chip) return;
    active = chip.dataset.catalogFilter || 'all';
    update();
  });

  document.addEventListener('input', event => {
    const field = event.target;
    const bar = panelNode();
    if (!bar || !field || field !== bar.querySelector('input')) return;
    update();
  });

  /* Списки и чипы дорисовывают скрипты (статьи из posts.json) — держим фильтр,
     статус и aria-pressed в согласии с тем, что реально лежит в разметке. */
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    Promise.resolve().then(() => { queued = false; update(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  update();
})();
