/* ==========================================================================
   FAQ · фильтр по вопросам, деплинки и печать
   Работает без зависимостей и без сети: только DOM страницы справки.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.faq-tools');
  if (!root) return;

  var input = document.getElementById('faq-filter');
  var status = document.getElementById('faq-status');
  var sections = Array.prototype.slice.call(document.querySelectorAll('.ui-section'))
    .filter(function (s) { return s.querySelector('.faq'); });
  var all = Array.prototype.slice.call(document.querySelectorAll('.faq details'));
  var total = all.length;

  /* «Ответ» / «ответа» / «ответов» — считаем по последним двум цифрам. */
  function plural(n, one, few, many) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  function question(items) {
    return items + ' ' + plural(items, 'вопрос', 'вопроса', 'вопросов');
  }

  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Кэшируем текст ответов: фильтр срабатывает на каждый ввод. */
  all.forEach(function (item) {
    item.dataset.faqText = normalize(item.textContent || '');
    item.dataset.faqOpen = item.open ? '1' : '';
  });

  var empty = document.createElement('p');
  empty.className = 'faq-empty';
  empty.hidden = true;
  empty.textContent = 'Ни одного вопроса по этому слову. Попробуйте короче: «vlan», «бандл», «оценка» — или откройте карту сайта.';
  /* Сообщение живёт рядом с полем поиска, а не внутри скрываемой секции. */
  root.after(empty);

  function setStatus(shown, query) {
    if (!status) return;
    if (!query) {
      status.textContent = total + ' ' + plural(total, 'вопрос', 'вопроса', 'вопросов') + ' в шести разделах';
      return;
    }
    if (!shown) {
      status.textContent = 'ничего не найдено';
      return;
    }
    status.textContent = 'найдено ' + question(shown);
  }

  function filter(raw) {
    var query = normalize(raw);
    var shown = 0;

    all.forEach(function (item) {
      var match = !query || item.dataset.faqText.indexOf(query) !== -1;
      item.hidden = !match;
      if (match) shown += 1;
      if (!query && item.dataset.faqOpen !== '1') item.open = false;
    });

    sections.forEach(function (section) {
      var visible = section.querySelectorAll('.faq details:not([hidden])').length;
      section.hidden = !visible;
    });

    empty.hidden = !(query && shown === 0);
    setStatus(shown, query);
  }

  if (input) {
    input.addEventListener('input', function () { filter(input.value); });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && input.value) {
        event.stopPropagation();
        input.value = '';
        filter('');
      }
    });
    /* «/» фокусирует поле, как в поиске сайта, но не перехватывает набор в других полях. */
    document.addEventListener('keydown', function (event) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      var tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) return;
      event.preventDefault();
      input.focus();
    });
  }

  /* ---------- деплинки: #faq-xp открывает нужный ответ ---------- */
  function openFromHash() {
    var id = location.hash.slice(1);
    if (!id) return;
    var item = document.getElementById(id);
    if (!item || !item.closest('.faq')) return;
    all.forEach(function (other) { other.classList.remove('is-target'); });
    item.open = true;
    item.classList.add('is-target');
    item.scrollIntoView({ block: 'center' });
  }

  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  /* ---------- ссылка на вопрос: копируем адрес, состояние показываем словами ---------- */
  all.forEach(function (item) {
    var link = item.querySelector('.faq-anchor a');
    if (!link) return;
    link.addEventListener('click', function () {
      var url = location.origin + location.pathname + '#' + item.id;
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(url).then(function () {
        link.textContent = 'ссылка скопирована';
        setTimeout(function () { link.textContent = 'ссылка на вопрос'; }, 2000);
      }).catch(function () {});
    });
  });

  /* ---------- печать: закрытые ответы иначе не попадут на бумагу ---------- */
  var printed = [];
  window.addEventListener('beforeprint', function () {
    printed = all.filter(function (item) { return item.open; });
    all.forEach(function (item) { item.open = true; });
  });
  window.addEventListener('afterprint', function () {
    all.forEach(function (item) { item.open = printed.indexOf(item) !== -1; });
  });
})();
