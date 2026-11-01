/* Shared local navigation, responsive LMS-style rail, and site-wide search. */
(function () {
  'use strict';
  if (document.querySelector('.site-search-dialog')) return;
  document.documentElement.classList.add('has-soft-shell');

  var iconPaths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    projects: '<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="13" width="8" height="7" rx="2"/><rect x="13" y="13" width="8" height="7" rx="2"/>',
    articles: '<path d="M5 3h11l3 3v15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 14h8M8 18h5M16 3v4h4"/>',
    notes: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    archive: '<path d="M4 4h16v4H4zM6 8v12h12V8M10 12h4"/>',
    practice: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h5M8 16h8"/><path d="m15 12 2 2 4-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.6 1.3c-.8 1-2.2 1.4-2.2 3M12 17h.01"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'
  };
  var navItems = [
    { label: 'Обзор', href: '/', icon: 'home', active: function (p) { return p === '/'; } },
    { label: 'Проекты', href: '/projects.html', icon: 'projects', active: function (p) { return p.indexOf('/projects') === 0; } },
    { label: 'Статьи', href: '/articles.html', icon: 'articles', active: function (p) { return p.indexOf('/articles') === 0; } },
    { label: 'Заметки', href: '/blog.html', icon: 'notes', active: function (p) { return p.indexOf('/blog') === 0; } },
    { label: 'База знаний', href: '/archive.html', icon: 'archive', active: function (p) { return p.indexOf('/archive') === 0; } },
    { label: 'Учебная практика', href: '/stands/index.html', icon: 'practice', active: function (p) { return p.indexOf('/stands') === 0; } },
    { label: 'Справка', href: '/faq.html', icon: 'help', active: function (p) { return p.indexOf('/faq') === 0; } },
    { label: 'Карта сайта', href: '/sitemap.html', icon: 'map', active: function (p) { return p.indexOf('/sitemap') === 0; } }
  ];
  var path = location.pathname.replace(/\/$/, '') || '/';
  var sidebar = document.createElement('aside');
  sidebar.className = 'global-sidebar';
  sidebar.setAttribute('aria-label', 'Основная навигация');
  sidebar.innerHTML = '<a class="global-sidebar-brand" href="/" aria-label="itsliventsev — на главную">'
    + '<span class="global-sidebar-mark" aria-hidden="true">i</span><span>itsliventsev</span></a>'
    + '<p class="global-sidebar-caption">Разделы</p><nav class="global-sidebar-nav"></nav>'
    + '<div class="global-sidebar-footer"><div class="global-sidebar-note">Материалы, проекты и учебная практика<br>в одном пространстве</div></div>';
  var nav = sidebar.querySelector('.global-sidebar-nav');
  navItems.forEach(function (item) {
    var link = document.createElement('a');
    link.className = 'global-sidebar-link';
    link.href = item.href;
    link.title = item.label;
    link.setAttribute('aria-label', item.label);
    if (item.active(path)) link.setAttribute('aria-current', 'page');
    link.innerHTML = '<span class="global-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + iconPaths[item.icon] + '</svg></span><span>' + item.label + '</span>';
    nav.appendChild(link);
  });
  var overlay = document.createElement('div');
  overlay.className = 'global-sidebar-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(overlay);
  document.body.appendChild(sidebar);

  var isLearning = document.body.classList.contains('flat-scope');
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'global-nav-toggle';
  toggle.setAttribute('aria-label', 'Открыть меню разделов');
  var desktopAtStart = window.matchMedia('(min-width: 960px)').matches;
  toggle.setAttribute('aria-expanded', desktopAtStart ? 'true' : 'false');
  toggle.setAttribute('aria-label', desktopAtStart ? 'Свернуть меню разделов' : 'Открыть меню разделов');
  toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  var toggleHost = isLearning ? document.querySelector('.st-topbar-in') : document.querySelector('.header-actions');
  if (toggleHost) toggleHost.prepend(toggle);
  function setSidebar(open) {
    var mobile = window.matchMedia('(max-width: 959px)').matches;
    sidebar.classList.toggle('is-open', open && mobile);
    overlay.classList.toggle('is-open', open && mobile);
    document.documentElement.classList.toggle('global-menu-open', open && mobile);
    document.documentElement.classList.toggle('sidebar-collapsed', !open && !mobile);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? (mobile ? 'Закрыть меню разделов' : 'Свернуть меню разделов') : (mobile ? 'Открыть меню разделов' : 'Развернуть меню разделов'));
  }
  toggle.addEventListener('click', function () { setSidebar(toggle.getAttribute('aria-expanded') !== 'true'); });
  overlay.addEventListener('click', function () { setSidebar(false); toggle.focus(); });
  sidebar.addEventListener('click', function (event) {
    if (event.target.closest('a')) setSidebar(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setSidebar(false); toggle.focus(); }
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 959) {
      sidebar.classList.remove('is-open'); overlay.classList.remove('is-open');
      document.documentElement.classList.remove('global-menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Свернуть меню разделов');
    } else {
      document.documentElement.classList.remove('sidebar-collapsed');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Открыть меню разделов');
    }
  }, { passive: true });

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
