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
 *   [data-catalog-empty]  — заглушка «под этот фильтр ничего нет».
 *
 * Фильтр и поиск складываются: чип сужает список, запрос сужает остаток.
 */
(function () {
  'use strict';

  const lists = [...document.querySelectorAll('[data-catalog-list]')];
  const chips = [...document.querySelectorAll('[data-catalog-filter]')];
  const panel = document.querySelector('[data-catalog-search]');
  const status = document.querySelector('[data-catalog-status]');
  const empty = document.querySelector('[data-catalog-empty]');
  if (!lists.length && !chips.length) return;

  const input = panel ? panel.querySelector('input') : null;
  const clear = panel ? panel.querySelector('[data-catalog-clear]') : null;
  const normalize = text => String(text || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

  const items = () => lists.length
    ? lists.flatMap(list => [...list.querySelectorAll('[data-catalog-tags]')])
    : [...document.querySelectorAll('[data-catalog-tags]')];

  let active = 'all';

  function update() {
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
      item.hidden = !visible;
      if (visible) shown++;
    }

    if (chips.length) {
      for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.catalogFilter === tag));
    }
    if (clear) clear.hidden = !query;
    if (empty) empty.hidden = shown > 0;

    if (status) {
      const filtered = tag !== 'all' || words.length;
      status.textContent = !filtered || !all.length
        ? ''
        : shown
          ? 'Найдено: ' + shown
          : 'Ничего не найдено. Попробуйте другой запрос.';
    }
  }

  /* Чипы: активным может быть один в группе. Групп на странице может быть
     несколько (например, разные списки) — тогда чип несёт data-catalog-group. */
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      active = chip.dataset.catalogFilter || 'all';
      update();
    });
  }

  if (panel) {
    panel.hidden = false;
    if (input) input.addEventListener('input', update);
    if (clear) {
      clear.addEventListener('click', () => {
        if (input) { input.value = ''; update(); input.focus(); }
      });
    }
  }

  /* Списки дорисовывают скрипты (статьи из posts.json) и лента — следим, чтобы
     фильтр и статус не отставали от разметки. */
  const observer = new MutationObserver(() => update());
  for (const list of lists) observer.observe(list, { childList: true });
  if (!lists.length) observer.observe(document.body, { childList: true, subtree: true });

  update();
})();
