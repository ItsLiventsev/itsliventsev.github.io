/* Shared, local-first navigation search for the static site. */
(function () {
  'use strict';
  if (document.querySelector('.site-search-dialog')) return;

  var searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"></circle><path d="m16 16 4.2 4.2"></path></svg>';
  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'site-search-trigger';
  trigger.setAttribute('aria-label', 'Поиск по сайту');
  trigger.innerHTML = searchIcon + '<span class="search-caption">Поиск</span><kbd>⌘ K</kbd>';

  var target = document.body.classList.contains('flat-scope')
    ? document.querySelector('.st-topnav')
    : document.querySelector('.header-actions');
  if (!target) target = document.querySelector('.header-actions') || document.querySelector('.st-topnav');
  if (target) target.prepend(trigger);
  if (!target) return;

  var dialog = document.createElement('dialog');
  dialog.className = 'site-search-dialog';
  dialog.setAttribute('aria-label', 'Поиск по сайту');
  dialog.innerHTML = '<form class="site-search-form" method="dialog">'
    + searchIcon
    + '<input class="site-search-input" type="search" autocomplete="off" placeholder="Найти статью, проект или практику…" aria-label="Поисковый запрос">'
    + '<button class="site-search-close" type="submit" aria-label="Закрыть поиск">×</button>'
    + '</form><div class="site-search-hint">Поиск по статьям, заметкам, проектам и учебным материалам</div>'
    + '<div class="site-search-results" role="listbox" aria-label="Результаты поиска"><div class="site-search-empty">Начните вводить запрос</div></div>';
  document.body.appendChild(dialog);

  var input = dialog.querySelector('.site-search-input');
  var results = dialog.querySelector('.site-search-results');
  var entries = null;
  var loading = false;

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('ru-RU').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function open() {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    window.setTimeout(function () { input.focus(); }, 0);
    if (!entries && !loading) loadIndex();
  }
  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    trigger.focus();
  }
  function loadIndex() {
    loading = true;
    fetch('/assets/search-index.json', { credentials: 'same-origin' })
      .then(function (response) { if (!response.ok) throw new Error('index unavailable'); return response.json(); })
      .then(function (data) { entries = Array.isArray(data) ? data : []; loading = false; render(input.value); })
      .catch(function () { loading = false; results.innerHTML = '<div class="site-search-empty">Поиск временно недоступен. Можно воспользоваться картой сайта.</div>'; });
  }
  function render(query) {
    if (!entries) {
      results.innerHTML = '<div class="site-search-empty">Загружаем индекс…</div>';
      return;
    }
    var terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) {
      results.innerHTML = '<div class="site-search-empty">Начните вводить запрос</div>';
      return;
    }
    var matches = entries.map(function (entry) {
      var title = normalize(entry.title), category = normalize(entry.category), content = normalize(entry.content);
      var matched = 0;
      var score = terms.reduce(function (sum, term) {
        if (title.includes(term)) { matched++; return sum + (title.startsWith(term) ? 8 : 5); }
        if (category.includes(term)) { matched++; return sum + 3; }
        if (content.includes(term)) { matched++; return sum + 1; }
        return sum;
      }, 0);
      return { entry: entry, score: score, matched: matched };
    }).filter(function (result) { return result.matched === terms.length; })
      .sort(function (a, b) { return b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'ru'); })
      .slice(0, 9);
    if (!matches.length) {
      results.innerHTML = '<div class="site-search-empty">Ничего не найдено. Попробуйте изменить запрос.</div>';
      return;
    }
    results.innerHTML = matches.map(function (match) {
      var e = match.entry;
      var snippet = (e.description || e.content || '').slice(0, 150);
      return '<a class="site-search-result" role="option" href="' + escapeHtml(e.url) + '">'
        + '<div class="site-search-result-title">' + escapeHtml(e.title) + '</div>'
        + '<div class="site-search-result-meta">' + escapeHtml(e.category) + (snippet ? ' · ' + escapeHtml(snippet) : '') + '</div></a>';
    }).join('');
  }

  trigger.addEventListener('click', open);
  dialog.querySelector('.site-search-form').addEventListener('submit', function (event) { event.preventDefault(); close(); });
  dialog.querySelector('.site-search-close').addEventListener('click', close);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) close(); });
  input.addEventListener('input', function () { render(input.value); });
  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) close(); else open();
    } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey
      && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
      && !document.activeElement.isContentEditable) {
      event.preventDefault(); open();
    }
  });
})();
