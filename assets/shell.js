/* ==========================================================================
   itsliventsev · shell.js — the single navigation/behaviour layer (v12, 2026)
   Builds the masthead, editorial margin (table of contents), mobile drawer and
   tab bar, the search palette, theme control and reading utilities.
   No dependencies. Everything degrades to plain HTML without JavaScript.
   Lesson engines keep working: this file only attaches semantic hooks to the
   markup they generate, it never rewrites their state.
   ========================================================================== */
(function () {
  'use strict';
  if (document.documentElement.dataset.uiReady === 'true') return;
  const doc = document;
  const body = doc.body;
  const dcl = doc.documentElement;
  const path = location.pathname.replace(/\/$/, '') || '/';
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const THEME_KEY = 'itsliventsev-theme';

  /* ——— area accent for the three learning universes ——— */
  const area = path.startsWith('/stands/office') ? 'office'
    : path.startsWith('/stands/ops') ? 'operations'
    : path.startsWith('/stands/') && path !== '/stands/index.html' ? 'network'
    : 'general';
  body.dataset.area = area;

  const svg = (name, cls = 'ui-icon') => '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + name + '"></use></svg>';

  /* ——— theme ——— */
  const themeMeta = () => doc.querySelector('meta[name="theme-color"]');
  function paintTheme(theme) {
    if (theme === 'dark') dcl.dataset.theme = 'dark'; else delete dcl.dataset.theme;
    const meta = themeMeta();
    /* Цвет оболочки браузера — из токена --u-paper: раньше здесь жили литералы
       #131210 и #f6f2e9, которые разъехались с палитрой (#121109 / #efeee9). */
    if (meta) {
      const paper = getComputedStyle(dcl).getPropertyValue('--u-paper').trim();
      meta.setAttribute('content', paper || (theme === 'dark' ? '#121109' : '#efeee9'));
    }
    doc.querySelectorAll('[data-ui-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      const label = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  }
  function toggleTheme() {
    const next = dcl.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* private mode */ }
    paintTheme(next);
    /* Тема применяется сразу (атрибут читается синхронно), а мягкость даёт
       короткий переход цветов: класс u-theme-switch включает его на 340 мс. */
    if (reduceMotion()) return;
    dcl.classList.add('u-theme-switch');
    window.setTimeout(() => dcl.classList.remove('u-theme-switch'), 340);
  }
  paintTheme(dcl.dataset.theme === 'dark' ? 'dark' : 'light');
  window.addEventListener('storage', event => {
    if (event.key === THEME_KEY) paintTheme(event.newValue === 'dark' ? 'dark' : 'light');
  });
  /* Системная тема — тема по умолчанию. Пока пользователь не выбрал свою
     (в localStorage пусто), страница следует за prefers-color-scheme и
     перекрашивается, если ОС переключила режим на ходу. */
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (systemDark && systemDark.addEventListener) {
    systemDark.addEventListener('change', event => {
      let chosen = '';
      try { chosen = localStorage.getItem(THEME_KEY) || ''; } catch (error) { chosen = ''; }
      if (chosen === 'dark' || chosen === 'light') return;
      paintTheme(event.matches ? 'dark' : 'light');
    });
  }

  /* ——— navigation model ——— */
  const navItems = [
    { label: 'Обзор', href: '/', icon: 'home', test: p => p === '/' || p === '/index.html' },
    { label: 'Пространства', href: '/stands/index.html', icon: 'network', test: p => p.startsWith('/stands/') },
    { label: 'Проекты', href: '/projects.html', icon: 'projects', test: p => p === '/projects.html' || p.startsWith('/projects/') },
    { label: 'Статьи', href: '/articles.html', icon: 'document', test: p => p === '/articles.html' || p.startsWith('/articles/') },
    { label: 'Заметки', href: '/blog.html', icon: 'notes', test: p => p === '/blog.html' || p.startsWith('/blog/') },
    { label: 'Архив', href: '/archive.html', icon: 'archive', test: p => p === '/archive.html' || p.startsWith('/archive/') },
    { label: 'Справка', href: '/faq.html', icon: 'help', test: p => p === '/faq.html' }
  ];
  const universes = [
    { label: 'СетьПолис', href: '/stands/setpolis.html', tone: 'net' },
    { label: 'ОфисПолис', href: '/stands/office/index.html', tone: 'office' },
    { label: 'ДатаПолис', href: '/stands/ops/index.html', tone: 'ops' }
  ];
  const isCurrent = test => { try { return test(path); } catch (error) { return false; } };

  /* ——— legacy chrome removal ——— */
  doc.querySelectorAll('.site-header, .st-global-header, .bg-glyphs, .floating-elements, .ambient, .giant-word, .title-mark, #title-mark, .scroll-progress, .icon-moon, .site-nav').forEach(node => node.remove());
  // Old page chrome carried stray global navigation; drop it before wrapping.
  doc.querySelectorAll('body > .site-nav, body > .header-actions, body > .theme-toggle, body > .lang-btn').forEach(node => node.remove());

  const mainCandidate = doc.querySelector('main#main-content, main');
  let root = doc.querySelector('[data-ui-root], [data-workspace-root], .page-wrap, .st-wrap');
  if (!root && mainCandidate) {
    const parent = mainCandidate.parentElement;
    root = parent && parent !== body ? parent : mainCandidate;
  }
  if (!root || root === body) {
    // Documents without any wrapper: create one so the grid keeps a column.
    root = doc.createElement('div');
    [...body.children].filter(node => !node.matches('.skip-link, .ui-masthead, script, .ui-drawer, .ui-overlay, .ui-tabbar')).forEach(node => root.append(node));
    body.append(root);
  }
  const main = root.querySelector('main#main-content, main') || mainCandidate;
  if (!root.dataset.uiRoot) root.dataset.uiRoot = 'true';

  /* ——— masthead ——— */
  const masthead = doc.createElement('header');
  masthead.className = 'ui-masthead';
  masthead.innerHTML = [
    '<div class="ui-masthead-inner">',
    '  <a class="ui-brand" href="/">',
    '    <span class="ui-brand-word">itsliventsev<span class="ui-brand-dot">.</span></span>',
    '    <span class="ui-brand-role">сети · системы · практика</span>',
    '    <span class="sr-only">— на главную</span>',
    '  </a>',
    '  <nav class="ui-nav" aria-label="Разделы сайта">',
    navItems.map(item => '<a class="ui-navlink" href="' + item.href + '"' + (isCurrent(item.test) ? ' aria-current="page"' : '') + '>' + item.label + '</a>').join(''),
    '  </nav>',
    '  <div class="ui-actions">',
    '    <button class="ui-search-open" type="button" aria-label="Поиск по материалам, Ctrl K" aria-haspopup="dialog">' + svg('search') + '<span>Поиск</span><kbd>Ctrl K</kbd></button>',
    '    <button class="ui-iconbtn ui-theme" type="button" data-ui-theme-toggle aria-pressed="false" aria-label="Включить тёмную тему">' + svg('moon') + '</button>',
    '    <button class="ui-iconbtn ui-menu-open" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="ui-drawer">' + svg('menu') + '</button>',
    '  </div>',
    '</div>'
  ].join('');
  /* Ссылка «перейти к содержанию» — часть баннера, а не «контент вне ориентиров»:
     переносим её в шапку (она там же первая в порядке обхода) и только потом
     ставим шапку в начало документа. */
  const skipLink = body.querySelector('.skip-link');
  if (skipLink) masthead.prepend(skipLink);
  body.prepend(masthead);

  /* ——— breadcrumbs for nested routes ——— */
  const segments = path.split('/').filter(Boolean).filter(part => part !== 'index.html');
  const sectionCrumbs = {
    stands: ['Пространства', '/stands/index.html'],
    projects: ['Проекты', '/projects.html'],
    articles: ['Статьи', '/articles.html'],
    blog: ['Заметки', '/blog.html'],
    archive: ['Архив', '/archive.html']
  };
  const h1 = main && main.querySelector('h1');
  const title = clean(h1 ? (h1.innerText || h1.textContent) : '') || clean((doc.title || '').split(/[·|—–]/)[0]);
  if (main && segments.length > 1 && sectionCrumbs[segments[0]]) {
    const crumbs = doc.createElement('nav');
    crumbs.className = 'ui-crumbs';
    crumbs.setAttribute('aria-label', 'Хлебные крошки');
    const [parentLabel, parentHref] = sectionCrumbs[segments[0]];
    const trail = [['Главная', '/'], [parentLabel, parentHref]];
    if (segments[0] === 'stands' && segments[1] === 'ops') trail.push(['ДатаПолис', '/stands/ops/index.html']);
    if (segments[0] === 'stands' && segments[1] === 'office') trail.push(['ОфисПолис', '/stands/office/index.html']);
    crumbs.innerHTML = trail.map(([label, href]) => '<a href="' + href + '">' + label + '</a><span aria-hidden="true">/</span>').join('')
      + '<span aria-current="page">' + (title.length > 48 ? title.slice(0, 46).trim() + '…' : title) + '</span>';
    main.prepend(crumbs);
  }

  /* ——— editorial margin: table of contents built from real headings ——— */
  const toc = doc.createElement('aside');
  toc.className = 'ui-toc';
  toc.id = 'ui-toc';
  toc.setAttribute('aria-label', 'На этой странице');
  const sectionWord = count => {
    const mod10 = count % 10, mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'раздел';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'раздела';
    return 'разделов';
  };
  const slug = value => clean(value).toLocaleLowerCase('ru-RU')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48);
  const headings = main ? [...main.querySelectorAll('h2')].filter(el => {
    if (el.closest('details, dialog, [role="dialog"], [hidden], [aria-hidden="true"], .ui-toc, nav')) return false;
    return clean(el.textContent).length > 1;
  }) : [];
  const used = new Set([...doc.querySelectorAll('[id]')].map(el => el.id));
  const sectionLinks = [];
  headings.forEach((heading, index) => {
    let id = heading.id;
    if (!id) {
      const base = slug(heading.textContent) || 'razdel-' + (index + 1);
      id = base;
      let suffix = 2;
      while (used.has(id)) { id = base + '-' + suffix++; }
      heading.id = id;
    }
    used.add(id);
    if (sectionLinks.some(link => link.hash === '#' + id)) return;
    const label = [...heading.childNodes]
      .map(node => clean(node.textContent))
      .filter(Boolean)
      .join(' ');
    sectionLinks.push({ id, label: label || clean(heading.textContent), hash: '#' + id });
  });
  /* The home page is a showcase: its own tiles already act as the index. */
  const wantsToc = !main || !main.querySelector('.home-hero');
  if (wantsToc && sectionLinks.length >= 2) {
    toc.innerHTML = '<p class="ui-toc-title">На этой странице</p><ul class="ui-toc-list">'
      + sectionLinks.map(link => '<li><a class="ui-toc-link" href="' + link.hash + '">' + link.label + '</a></li>').join('')
      + '</ul><div class="ui-toc-meta">' + sectionLinks.length + ' ' + sectionWord(sectionLinks.length)
      + '<br><a href="/sitemap.html">Карта сайта →</a></div>';
    body.dataset.hasToc = 'true';
  }

  /* ——— shell grid ——— */
  const shell = doc.createElement('div');
  shell.className = 'ui-shell';
  shell.dataset.toc = body.dataset.hasToc === 'true' ? 'true' : 'false';
  const page = doc.createElement('div');
  page.className = 'ui-page';
  body.insertBefore(shell, root);
  shell.append(page);
  if (shell.dataset.toc === 'true') shell.append(toc);
  page.append(root);

  /* ——— contextual sub navigation of a universe ——— */
  /* Полоса раздела вселенной берётся из запасной шапки страницы: сам <nav>
     становится подбаром. Раньше он заворачивался в новый <nav> с тем же именем
     — два одинаковых ориентира навигации на страницу (landmark-unique). */
  const legacyBar = doc.querySelector('.st-topbar');
  /* Ссылки раздела стендов повторяются в меню: на телефоне подбар скрыт
     (course.css, ≤820 px), чтобы у всех страниц был один сценарий — шапка,
     таббар и меню, — а разделы вселенной остаются доступны из «Ещё». */
  let standLinks = [];
  if (legacyBar) {
    const legacyNav = legacyBar.querySelector('nav');
    if (legacyNav) {
      legacyNav.classList.add('ui-subbar', 'ui-subbar-nav');
      legacyNav.dataset.uiSubbar = '';
      if (!legacyNav.getAttribute('aria-label')) legacyNav.setAttribute('aria-label', 'Навигация раздела');
      legacyNav.querySelectorAll('.theme-toggle, .icon-moon, .icon-sun, .st-nav-admin').forEach(node => node.remove());
      standLinks = [...legacyNav.querySelectorAll('a[href]')].map(link => [
        clean(link.textContent),
        link.getAttribute('href'),
        link.getAttribute('aria-current') === 'page'
      ]);
      page.insertBefore(legacyNav, root);
    }
    legacyBar.remove();
  }
  // Old duplicated breadcrumb bars: the shell builds one trail per page.
  root.querySelectorAll('.st-crumbs, .crumbs, [aria-label="Хлебные крошки"]').forEach(node => {
    if (!node.classList.contains('ui-crumbs')) node.remove();
  });

  /* ——— footer ——— */
  root.querySelectorAll('footer, .st-footer').forEach(footer => {
    footer.classList.add('ui-footer');
    footer.querySelectorAll('.ws-inline-icon').forEach(icon => icon.classList.add('ui-inline-icon'));
  });
  const lastModified = new Date(doc.lastModified);
  if (!Number.isNaN(lastModified.getTime())) {
    const pad = value => String(value).padStart(2, '0');
    const iso = lastModified.getFullYear() + '-' + pad(lastModified.getMonth() + 1) + '-' + pad(lastModified.getDate());
    const visible = lastModified.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    root.querySelectorAll('time[data-footer-updated]').forEach(el => {
      el.dateTime = iso;
      el.textContent = 'Обновлено ' + visible;
    });
  }

  /* ——— mobile drawer + tab bar ——— */
  const drawer = doc.createElement('div');
  drawer.className = 'ui-drawer';
  drawer.id = 'ui-drawer';
  drawer.dataset.open = 'false';
  drawer.setAttribute('aria-label', 'Меню сайта');
  const drawerGroups = [
    ...(standLinks.length ? [['Раздел стендов', standLinks]] : []),
    ['Разделы', navItems.map(item => [item.label, item.href, isCurrent(item.test)])],
    ['Практика', universes.map(item => [item.label, item.href, path.startsWith(item.href.replace(/\/index\.html$/, ''))])],
    ['Ещё', [['Карта сайта', '/sitemap.html', path === '/sitemap.html'], ['RSS-лента', '/feed.xml', false], ['Панель преподавателя', '/admin.html', path === '/admin.html']]]
  ];
  drawer.innerHTML = '<div class="ui-drawer-head"><span class="ui-brand-word">itsliventsev<span class="ui-brand-dot">.</span></span>'
    + '<button class="ui-iconbtn" type="button" data-ui-drawer-close aria-label="Закрыть меню">' + svg('close') + '</button></div>'
    + drawerGroups.map(([caption, links]) => '<div class="ui-drawer-group"><p class="ui-drawer-caption">' + caption + '</p>'
      + links.map(([label, href, current]) => '<a class="ui-drawer-link" href="' + href + '"' + (current ? ' aria-current="page"' : '') + '>' + label + '<span>↗</span></a>').join('')
      + '</div>').join('');
  const overlay = doc.createElement('div');
  overlay.className = 'ui-overlay';
  overlay.dataset.open = 'false';
  overlay.setAttribute('aria-hidden', 'true');
  body.append(drawer, overlay);

  const tabbar = doc.createElement('nav');
  tabbar.className = 'ui-tabbar';
  tabbar.setAttribute('aria-label', 'Быстрая навигация');
  /* Пять пунктов — один сценарий на всех страницах: ровно один активный.
     То, что живёт только в меню (справка, карта, архив, панель), помечает
     активным «Ещё» — иначе на этих страницах таббар «молчит». */
  const morePaths = ['/faq.html', '/sitemap.html', '/archive.html', '/admin.html'];
  const tabs = [
    ['/', 'home', 'Обзор', p => p === '/' || p === '/index.html'],
    ['/stands/index.html', 'network', 'Практика', p => p.startsWith('/stands/')],
    ['/articles.html', 'document', 'Статьи', p => p.startsWith('/articles') || p === '/blog.html' || p.startsWith('/blog/')],
    ['/projects.html', 'projects', 'Проекты', p => p === '/projects.html' || p.startsWith('/projects/')],
    ['#ui-menu', 'menu', 'Ещё', p => morePaths.includes(p)]
  ];
  tabbar.innerHTML = tabs.map(([href, icon, label, test]) => '<a href="' + href + '"' + (isCurrent(test) ? ' aria-current="page"' : '') + '>' + svg(icon) + '<span>' + label + '</span></a>').join('');
  body.append(tabbar);
  tabbar.querySelector('a[href="#ui-menu"]').addEventListener('click', event => { event.preventDefault(); setDrawer(true); });

  const menuButton = masthead.querySelector('.ui-menu-open');
  let lastFocus = null;
  function setDrawer(open) {
    drawer.dataset.open = open ? 'true' : 'false';
    overlay.dataset.open = open ? 'true' : 'false';
    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    page.toggleAttribute('inert', open);
    tabbar.toggleAttribute('inert', open);
    if (open) {
      lastFocus = doc.activeElement;
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.querySelector('a[href], button')?.focus();
    } else {
      drawer.removeAttribute('role');
      drawer.removeAttribute('aria-modal');
      if (lastFocus && drawer.contains(doc.activeElement) === false && page.contains(lastFocus)) { /* focus already restored below */ }
      if (lastFocus && !page.contains(doc.activeElement) && doc.activeElement !== menuButton) (lastFocus.focus ? lastFocus : menuButton).focus();
    }
  }
  menuButton.addEventListener('click', () => setDrawer(drawer.dataset.open !== 'true'));
  overlay.addEventListener('click', () => { setDrawer(false); menuButton.focus(); });
  drawer.querySelector('[data-ui-drawer-close]').addEventListener('click', () => { setDrawer(false); menuButton.focus(); });
  drawer.addEventListener('click', event => { if (event.target.closest('a')) setDrawer(false); });
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawer.dataset.open === 'true') { setDrawer(false); menuButton.focus(); }
    if (event.key === 'Tab' && drawer.dataset.open === 'true') {
      const focusable = [...drawer.querySelectorAll('a[href], button:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 820 && drawer.dataset.open === 'true') setDrawer(false); }, { passive: true });

  /* ——— theme buttons ——— */
  doc.querySelectorAll('[data-ui-theme-toggle], .theme-toggle').forEach(button => {
    button.dataset.uiThemeToggle = '';
    button.classList.add('ui-iconbtn', 'ui-theme');
    button.innerHTML = svg('moon');
    button.addEventListener('click', event => { event.preventDefault(); toggleTheme(); });
  });
  doc.querySelectorAll('.lang-btn').forEach(button => { button.classList.add('ui-btn', 'ui-btn--sm'); masthead.querySelector('.ui-actions').insertBefore(button, masthead.querySelector('.ui-theme')); });

  /* ——— search palette ——— */
  const dialog = doc.createElement('dialog');
  dialog.className = 'ui-search';
  dialog.setAttribute('aria-label', 'Поиск по материалам');
  dialog.innerHTML = '<form class="ui-search-form" method="dialog">' + svg('search')
    + '<input class="ui-search-input" type="search" placeholder="Тема, раздел или > команда" aria-label="Поисковый запрос" autocomplete="off">'
    + '<button class="ui-iconbtn" type="button" aria-label="Закрыть поиск">' + svg('close') + '</button></form>'
    + '<div class="ui-search-results" role="listbox" aria-label="Результаты поиска"></div>'
    + '<div class="ui-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> выбор · <kbd>↵</kbd> открыть · <kbd>Esc</kbd> закрыть</span><span data-ui-search-hint>Начните печатать</span></div>';
  body.append(dialog);
  const input = dialog.querySelector('.ui-search-input');
  const results = dialog.querySelector('.ui-search-results');
  const hint = dialog.querySelector('[data-ui-search-hint]');
  hint.setAttribute('aria-live', 'polite');
  let index = null, loadingIndex = false, active = -1;

  const commands = [
    { id: 'go-projects', label: 'Перейти в «Проекты»', desc: '/projects.html', icon: 'projects', run: () => { location.href = '/projects.html'; } },
    { id: 'go-articles', label: 'Перейти в «Статьи»', desc: '/articles.html', icon: 'document', run: () => { location.href = '/articles.html'; } },
    { id: 'go-notes', label: 'Перейти в «Заметки»', desc: '/blog.html', icon: 'notes', run: () => { location.href = '/blog.html'; } },
    { id: 'go-archive', label: 'Перейти в «Архив»', desc: '/archive.html', icon: 'archive', run: () => { location.href = '/archive.html'; } },
    { id: 'toggle-theme', label: 'Переключить тему', desc: 'светлая ↔ тёмная', icon: 'moon', run: toggleTheme },
    { id: 'copy-link', label: 'Скопировать ссылку страницы', desc: 'в буфер обмена', icon: 'document', run: () => { if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(() => {}); } },
    { id: 'scroll-top', label: 'Наверх страницы', desc: 'к началу', icon: 'arrow-up', run: () => window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }) }
  ];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const localUrl = value => {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value, location.origin);
      return url.origin === location.origin ? url.pathname + url.search + url.hash : null;
    } catch (error) { return null; }
  };
  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  /* Поиск прощает опечатки: «во lan» находит VLAN, «комутатор» — коммутатор.
     Сравнение идёт по словарю индекса, а не по всему тексту: расстояние
     считается только для слов длиной от четырёх символов, поэтому ввод
     не тормозит. Одна правка — вставка, удаление, замена или перестановка. */
  const withinOneEdit = (a, b) => {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (long.length - short.length > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < short.length && j < long.length) {
      if (short[i] === long[j]) { i += 1; j += 1; continue; }
      edits += 1;
      if (edits > 1) return false;
      if (short.length === long.length) {
        if (short[i + 1] === long[j + 1]) { i += 2; j += 2; continue; } // перестановка
        i += 1; j += 1; continue;                                        // замена
      }
      j += 1;                                                            // вставка в длинном
    }
    return edits + (short.length - i) + (long.length - j) <= 1;
  };
  const vocabularyOf = items => {
    const words = new Set();
    items.forEach(item => {
      [item.title, item.category, item.tags].forEach(source => {
        if (!source) return;
        normalize(Array.isArray(source) ? source.join(' ') : source).split(' ').forEach(word => {
          if (word.length >= 4) words.add(word);
        });
      });
    });
    return [...words];
  };
  let vocabulary = null;
  const suggestTerms = terms => {
    if (!vocabulary) return terms;
    return terms.map(term => {
    if (term.length < 4) return term;
    if (vocabulary.some(word => word === term || (word.startsWith(term) && word.length - term.length <= 1))) return term;
    const close = vocabulary.find(word => Math.abs(word.length - term.length) <= 1 && withinOneEdit(term, word));
    return close || term;
    });
  };

  function setActive(next) {
    const items = [...results.querySelectorAll('.ui-search-result')];
    if (!items.length) { active = -1; return; }
    active = Math.max(0, Math.min(next, items.length - 1));
    items.forEach((item, i) => {
      item.classList.toggle('is-active', i === active);
      item.setAttribute('aria-selected', i === active ? 'true' : 'false');
      if (i === active) item.scrollIntoView({ block: 'nearest' });
    });
    hint.textContent = (active + 1) + ' из ' + items.length;
  }
  function renderCommands(query) {
    const terms = normalize(query.replace(/^>/, '')).split(' ').filter(Boolean);
    const found = commands.filter(command => terms.every(term => normalize(command.id + ' ' + command.label + ' ' + command.desc).includes(term)));
    results.replaceChildren();
    if (!found.length) {
      results.innerHTML = '<div class="ui-empty">Команда не найдена. Попробуйте go-projects, toggle-theme или copy-link.</div>';
      hint.textContent = '0 команд';
      active = -1;
      return;
    }
    const caption = doc.createElement('div');
    caption.className = 'ui-search-group-caption';
    caption.textContent = 'Команды';
    results.append(caption);
    found.forEach(command => {
      const link = doc.createElement('a');
      link.className = 'ui-search-result';
      link.href = '#';
      link.setAttribute('role', 'option');
      link.setAttribute('data-cmd', command.id);
      link.innerHTML = svg(command.icon) + '<span><strong>' + esc(command.label) + '</strong><small>' + esc(command.desc) + '</small></span><span class="ui-search-result-meta">↵</span>';
      link.addEventListener('click', event => { event.preventDefault(); dialog.close(); command.run(); });
      results.append(link);
    });
    hint.textContent = found.length + ' команд';
    setActive(0);
  }
  function renderSearch(query) {
    if (query.trim().startsWith('>')) { renderCommands(query); return; }
    if (!index) return;
    const terms = normalize(query).split(' ').filter(Boolean);
    const scored = index.map(item => {
      const title = normalize(item.title), category = normalize(item.category), content = normalize(item.content + ' ' + item.description);
      let score = 0;
      terms.forEach(term => {
        if (title.includes(term)) score += 6;
        else if (category.includes(term)) score += 3;
        else if (content.includes(term)) score += 1;
      });
      return { item, score };
    }).filter(entry => entry.score > 0 || !terms.length)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'ru'))
      .slice(0, 8);
    results.replaceChildren();
    if (!scored.length) {
      /* Второй проход по словарю: одна опечатка в слове не должна превращать
         поиск в «ничего не найдено». Подсказка честная — показываем, что искали. */
      const fixed = vocabulary ? suggestTerms(terms) : terms;
      const changed = fixed.some((term, i) => term !== terms[i]);
      if (changed) {
        const retry = index.map(item => {
          const title = normalize(item.title), category = normalize(item.category), content = normalize(item.content + ' ' + item.description);
          let score = 0;
          fixed.forEach(term => {
            if (title.includes(term)) score += 6;
            else if (category.includes(term)) score += 3;
            else if (content.includes(term)) score += 1;
          });
          return { item, score };
        }).filter(entry => entry.score > 0)
          .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'ru'))
          .slice(0, 8);
        if (retry.length) {
          const note = doc.createElement('div');
          note.className = 'ui-search-group-caption';
          note.textContent = 'Возможно, вы имели в виду: ' + fixed.join(' ');
          results.append(note);
          retry.forEach(({ item }) => {
            const link = doc.createElement('a');
            link.className = 'ui-search-result';
            link.href = localUrl(item.url);
            link.setAttribute('role', 'option');
            link.innerHTML = svg('arrow-right') + '<span><strong>' + esc(item.title) + '</strong><small>' + esc(item.category || '') + (item.description ? ' · ' + esc(item.description) : '') + '</small></span><span class="ui-search-result-meta">↵</span>';
            results.append(link);
          });
          hint.textContent = 'Похоже на «' + fixed.join(' ') + '»';
          setActive(0);
          return;
        }
      }
      results.innerHTML = '<div class="ui-empty">Ничего не найдено. Попробуйте «сети», «документы» или команду <code>&gt; go-projects</code>.</div>';
      hint.textContent = 'Нет результатов';
      active = -1;
      return;
    }
    scored.forEach(({ item }) => {
      const link = doc.createElement('a');
      link.className = 'ui-search-result';
      link.href = localUrl(item.url);
      link.setAttribute('role', 'option');
      link.innerHTML = svg('arrow-right') + '<span><strong>' + esc(item.title) + '</strong><small>' + esc(item.category || '') + (item.description ? ' · ' + esc(item.description) : '') + '</small></span><span class="ui-search-result-meta">↵</span>';
      results.append(link);
    });
    hint.textContent = scored.length + ' результатов';
    setActive(0);
  }
  function openSearch() {
    if (dialog.open) { input.focus(); return; }
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    input.focus();
    input.select();
    if (index) { renderSearch(input.value); return; }
    if (loadingIndex) return;
    loadingIndex = true;
    results.innerHTML = '<div class="ui-empty">Загружаю индекс…</div>';
    fetch('/assets/search-index.json')
      .then(response => { if (!response.ok) throw new Error('index'); return response.json(); })
      .then(data => {
        const items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
        index = items.filter(item => item && typeof item.title === 'string' && localUrl(item.url));
        vocabulary = vocabularyOf(index);
        loadingIndex = false;
        renderSearch(input.value);
      })
      .catch(() => {
        loadingIndex = false;
        results.innerHTML = '<div class="ui-empty">Индекс недоступен. Разделы открываются из меню.</div>';
      });
  }
  masthead.querySelector('.ui-search-open').addEventListener('click', openSearch);
  const closeSearch = () => {
    if (dialog.open && dialog.close) dialog.close();
    else dialog.removeAttribute('open');
    const trigger = masthead.querySelector('.ui-search-open');
    if (trigger) trigger.focus();
  };
  dialog.querySelector('[aria-label="Закрыть поиск"]').addEventListener('click', closeSearch);
  input.addEventListener('input', () => renderSearch(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeSearch(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(active + 1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(active - 1); }
    if (event.key === 'Enter' && active >= 0) {
      const item = results.querySelectorAll('.ui-search-result')[active];
      if (item) { event.preventDefault(); item.click(); }
    }
  });
  doc.addEventListener('keydown', event => {
    const typing = /input|textarea|select/i.test(event.target.tagName) || event.target.isContentEditable;
    if ((event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing)) {
      event.preventDefault();
      openSearch();
    }
  });

  /* ——— table of contents: active section ——— */
  if (shell.dataset.toc === 'true' && 'IntersectionObserver' in window) {
    const links = [...toc.querySelectorAll('.ui-toc-link')];
    const mark = id => links.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const targets = links.map(link => doc.getElementById(link.hash.slice(1))).filter(Boolean);
    const spy = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) mark(visible.target.id);
    }, { rootMargin: '-18% 0px -70% 0px', threshold: 0 });
    targets.forEach(target => spy.observe(target));
    if (location.hash) mark(location.hash.slice(1));
  }

  /* ——— back to top ——— */
  let toTop = doc.querySelector('#to-top, [data-ui-to-top]');
  if (!toTop) {
    toTop = doc.createElement('button');
    toTop.type = 'button';
    toTop.className = 'ui-to-top';
    toTop.setAttribute('aria-label', 'Наверх');
    toTop.title = 'Наверх';
    toTop.innerHTML = svg('arrow-up');
    body.append(toTop);
  }
  toTop.classList.add('ui-to-top');
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }));
  let toTopTick = false;
  const mastheadBar = doc.querySelector('.ui-masthead');
  const updateToTop = () => {
    toTop.classList.toggle('show', window.scrollY > 520);
    /* Шапка липкая и непрозрачная: линия снизу отделяет её от текста, который уезжает под неё. */
    if (mastheadBar) mastheadBar.classList.toggle('is-scrolled', window.scrollY > 8);
    toTopTick = false;
  };
  window.addEventListener('scroll', () => { if (!toTopTick) { toTopTick = true; requestAnimationFrame(updateToTop); } }, { passive: true });
  updateToTop();

  /* ——— counters used on the home page ——— */
  doc.querySelectorAll('[data-count-to]').forEach(node => {
    const target = parseInt(node.dataset.countTo, 10);
    if (!Number.isFinite(target) || reduceMotion()) { node.textContent = String(Number.isFinite(target) ? target : node.textContent); return; }
    const start = performance.now();
    const step = now => {
      const progress = Math.min(1, (now - start) / 700);
      node.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  /* ——— scroll reveal ———
     Лёгкое движение только у блоков ниже первого экрана: сдвиг на 14px без
     изменения прозрачности, поэтому контраст и замеры axe не страдают.
     Блоки с липкими рельсами и первым экраном не трогаем вовсе. */
  if ('IntersectionObserver' in window && !reduceMotion()) {
    const fold = window.innerHeight;
    const explicit = [...doc.querySelectorAll('[data-ui-reveal]')];
    const auto = [...doc.querySelectorAll('main > section, main > article > section')]
      .filter(node => !node.matches('[data-ui-reveal]'))
      .filter(node => !node.querySelector('.ui-rail, .ui-toc, [data-ui-sticky], .sticky'))
      .filter(node => node.getBoundingClientRect().top > fold * 0.9);
    const revealables = [...explicit.slice(0, 3), ...auto.slice(0, 12)];
    if (revealables.length) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); io.unobserve(entry.target); } });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.04 });
      revealables.forEach(node => { node.classList.add('ui-reveal'); io.observe(node); });
    }
  }

  /* Лента итераций на главной живёт в assets/iter-strip.js: она сама ведёт
     паузу, секундомер и очередь шагов, поэтому здесь её поведения нет. */

  /* ——— code blocks: keyboard-focusable, copy action ——— */
  main?.querySelectorAll('pre').forEach(pre => {
    if (!pre.hasAttribute('tabindex')) pre.setAttribute('tabindex', '0');
    if (pre.querySelector('[data-ui-copy]')) return;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'ui-btn ui-btn--sm ui-copy';
    button.dataset.uiCopy = '';
    button.textContent = 'Копировать';
    button.addEventListener('click', () => {
      const text = pre.querySelector('code')?.innerText ?? pre.innerText;
      const done = () => { button.textContent = 'Скопировано'; window.setTimeout(() => { button.textContent = 'Копировать'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(() => {});
    });
    pre.append(button);
  });

  /* ——— wide tables get a labelled scroll container ——— */
  main?.querySelectorAll('table').forEach(table => {
    table.dataset.wsTable = 'true';
    if (table.parentElement?.hasAttribute('data-ui-table-wrap')) return;
    const wrap = doc.createElement('div');
    wrap.dataset.uiTableWrap = 'true';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Таблица, горизонтальная прокрутка');
    table.parentNode.insertBefore(wrap, table);
    wrap.append(table);
  });

  /* ——— prefetch internal documents on intent ——— */
  const prefetched = new Set();
  function prefetch(href) {
    if (!href || prefetched.has(href) || prefetched.size > 24) return;
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin) return;
      if (!/\.html$/.test(url.pathname) && url.pathname !== '/' && !url.pathname.endsWith('/')) return;
      prefetched.add(href);
      const link = doc.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = url.pathname;
      doc.head.append(link);
    } catch (error) { /* ignore */ }
  }
  doc.addEventListener('pointerover', event => { const a = event.target.closest?.('a[href]'); if (a) prefetch(a.getAttribute('href')); }, { passive: true });
  doc.addEventListener('focusin', event => { const a = event.target.closest?.('a[href]'); if (a) prefetch(a.getAttribute('href')); });

  /* ======================================================================
     Lesson runtime hooks. Engines render their own markup; this adapter only
     names the parts (surface, row, state…) so one stylesheet can theme them.
     ====================================================================== */
  function decorate(scope) {
    if (!scope || scope.nodeType !== 1) return;
    const all = selector => scope.matches(selector) ? [scope, ...scope.querySelectorAll(selector)] : [...scope.querySelectorAll(selector)];
    const attr = (selector, name, value = 'true') => all(selector).forEach(el => el.setAttribute(name, value));
    const surfaces = '.card, .p-card, .pub-card, .note-card, .lab-panel, .st-panel, .op-panel, .office-panel, .admin-card, .quest-card, .esp-section, .wiki-group, .ticket-card, .notice';
    attr(surfaces, 'data-ws-surface');
    attr('#profile-gate', 'data-ws-profile-gate');
    attr('#profile-form', 'data-ws-profile-form');
    all('.flat-field').forEach(el => el.setAttribute('data-ws-field', el.querySelector('#mascot-picker-host') ? 'mascot' : 'true'));
    attr('#profile-form button[type="submit"]', 'data-ws-action', 'primary');
    attr('#cab-dashboard', 'data-ws-dashboard');
    attr('.cab-grid', 'data-ws-dashboard-grid');
    attr('.cab-grid > aside', 'data-ws-profile-summary');
    attr('.cab-grid > section', 'data-ws-quest-panel');
    attr('.roadmap-overview', 'data-ws-roadmap-overview');
    attr('.roadmap-meter', 'data-ws-roadmap-meter');
    attr('.quest-glyph', 'data-ws-quest-icon');
    attr('.quest-side', 'data-ws-quest-meta');
    attr('.greet-card', 'data-ws-greeting');
    attr('.greet-mascot', 'data-ws-greeting-icon');
    attr('.greet-body', 'data-ws-greeting-body');
    attr('.st-hero, .uni-hero', 'data-ws-hero');
    attr('.st-hero-index', 'data-ws-index');
    attr('.flat-profile', 'data-ws-profile');
    attr('.zone-head, .st-section-head', 'data-ws-section-head');
    attr('.bento-grid, .glossary-grid', 'data-ws-grid');
    all('.grid').forEach(el => {
      const tokens = String(el.className || '').split(/\s+/);
      const base = tokens.find(token => token.startsWith('grid-cols-'));
      el.setAttribute('data-ws-grid', 'utility');
      el.style.setProperty('--ws-grid-base', base ? base.slice('grid-cols-'.length) : '1');
    });
    all('.flex').forEach(el => {
      const classes = String(el.className || '');
      el.setAttribute('data-ws-flex', 'true');
      if (/\bflex-col\b/.test(classes)) el.setAttribute('data-ws-direction', 'column');
      if (/\bflex-wrap\b/.test(classes)) el.setAttribute('data-ws-wrap', 'wrap');
      if (/\bjustify-between\b/.test(classes)) el.setAttribute('data-ws-justify', 'between');
      if (/\bjustify-center\b/.test(classes)) el.setAttribute('data-ws-justify', 'center');
      if (/\bitems-center\b/.test(classes)) el.setAttribute('data-ws-align', 'center');
      if (/\bitems-start\b/.test(classes)) el.setAttribute('data-ws-align', 'start');
    });
    attr('.min-w-0', 'data-ws-min-width');
    attr('.shrink-0', 'data-ws-no-shrink');
    all('.notice, .callout').forEach(el => {
      el.dataset.wsCallout = 'true';
      const classes = String(el.className || '');
      el.dataset.wsTone = /error|danger/.test(classes) ? 'danger' : /warn/.test(classes) ? 'warm' : /info/.test(classes) ? 'info' : 'neutral';
    });
    attr('.wiki-layout', 'data-ws-layout', 'wiki');
    attr('.wiki-nav', 'data-ws-wiki-nav');
    attr('.article-meta', 'data-ws-meta');
    attr('.flat-row, .step-card, .mat-row', 'data-ws-row');
    attr('.lab-progress, .xp-bar, .lg-bar, .quest-progress', 'data-ws-progress');
    /* Полосы прогресса получают значение из данных, а не из inline-стиля:
       <i data-ws-value="42"> → --p: 0.42 (наследуется заливкой). Статическая
       проверка запрещает inline-стили в шаблонах, поэтому вход один — атрибут. */
    all('[data-ws-value]').forEach(el => {
      const raw = Number(String(el.getAttribute('data-ws-value')).replace('%', '').replace(',', '.'));
      if (!Number.isFinite(raw)) return;
      el.style.setProperty('--p', String(Math.max(0, Math.min(100, raw)) / 100));
    });
    attr('.lp-head', 'data-ws-panel-head');
    attr('.lp-body', 'data-ws-panel-body');
    attr('.lab-layout, .ops-board, .lab-steps', 'data-ws-grid', 'cards');
    attr('.cmd-duo, .plus-minus, .rca-fields', 'data-ws-grid', 'two');
    attr('.task-list, .lab-checks, .st-goals', 'data-ws-stack');
    attr('.task-item, .cmd-row, .ticket', 'data-ws-row');
    attr('.q-item', 'data-ws-surface');
    attr('.q-opts', 'data-ws-options');
    attr('.q-opt', 'data-ws-option');
    attr('.mc-speech', 'data-ws-message');
    attr('.task-body', 'data-ws-task-body');
    attr('.task-hint', 'data-ws-task-hint');
    attr('.task-title', 'data-ws-task-title');
    attr('.is-active', 'data-ws-active');
    attr('.task-item.is-done, .q-opt.is-ok', 'data-ws-state', 'complete');
    attr('.q-opt.is-bad', 'data-ws-state', 'error');
    attr('.is-disabled', 'data-ws-state', 'locked');
    attr('.theory-block, .reflect-item, .cmd-col', 'data-ws-inset');
    attr('.lab-terminal, .lab-editor, .term-screen, .lt-screen', 'data-ws-console');
    attr('.st-modal, .st-modal-box', 'data-ws-modal');
    attr('.lk-progress-strip, .ops-statusbar', 'data-ws-progress-strip');
    attr('[role="tablist"]', 'data-ws-tabs');
    all('button').forEach(el => {
      el.setAttribute('data-ws-control', 'true');
      if (/\b(btn|flat-btn|primary)\b/.test(el.className)) el.setAttribute('data-ws-action', /\b(btn-primary|btn-main|primary)\b/.test(el.className) ? 'primary' : 'secondary');
    });
    all('a').forEach(el => { if (/\b(btn|flat-btn|quick-bubble|ws-button)\b/.test(el.className)) el.setAttribute('data-ws-action', 'secondary'); });
    all('.pill, .chip, .badge, .p-tag, .kind-badge, .flat-badge, .p-status, .sev, .tag-hash, .ws-tag, .gl-term-tag').forEach(el => {
      const classes = String(el.className || '');
      el.setAttribute('data-ws-tag', 'true');
      if (/green|ok|complete|gl-term-new/.test(classes)) { el.dataset.wsTone = 'success'; el.dataset.wsState = 'complete'; }
      else if (/red|error|danger/.test(classes)) el.dataset.wsTone = 'danger';
      else if (/amber|orange|warm|verm/.test(classes)) el.dataset.wsTone = 'warm';
      else if (/blue|info/.test(classes)) el.dataset.wsTone = 'info';
      else if (/purple|violet/.test(classes)) el.dataset.wsTone = 'accent';
      if (/soon|locked|wait/.test(classes)) el.dataset.wsState = 'locked';
      else if (/active|new/.test(classes)) el.dataset.wsState = 'active';
    });
  }
  decorate(root);
  if ('MutationObserver' in window) {
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) decorate(node);
    })));
    observer.observe(root, { childList: true, subtree: true });
  }

  body.classList.add('ui-ready');
  dcl.dataset.uiReady = 'true';

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
})();
