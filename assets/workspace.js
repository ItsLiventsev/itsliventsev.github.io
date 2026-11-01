/* Static Workspace shell. The lesson engines and their storage contracts are not touched. */
(function () {
  'use strict';
  if (document.documentElement.dataset.workspaceReady === 'true') return;
  const body = document.body;
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  const learningArea = pathname.startsWith('/stands/office') ? 'office' : pathname.startsWith('/stands/ops') ? 'operations' : pathname.startsWith('/stands/') && pathname !== '/stands/index.html' ? 'network' : 'general';
  body.dataset.wsArea = learningArea;
  const pathTitle = () => {
    const h1 = document.querySelector('main h1');
    if (h1 && (h1.innerText || h1.textContent).trim()) return (h1.innerText || h1.textContent).trim().replace(/\s+/g, ' ');
    return ({
      '/': 'Обзор', '/404.html': 'Страница не найдена', '/projects.html': 'Проекты',
      '/articles.html': 'Статьи', '/blog.html': 'Заметки', '/archive.html': 'База знаний',
      '/faq.html': 'Справка', '/sitemap.html': 'Карта сайта', '/admin.html': 'Панель преподавателя'
    })[pathname] || decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'Обзор').replace(/\.html$/, '').replace(/[-_]/g, ' ');
  };
  const currentTitle = pathTitle();
  const root = document.querySelector('[data-workspace-root], .page-wrap, .st-wrap') || document.querySelector('main')?.parentElement || body;
  const contextBar = document.querySelector('.st-topbar');
  const oldHeader = document.querySelector('.site-header, .st-global-header');
  const logo = oldHeader?.querySelector('.logo');
  const themeButton = document.querySelector('.theme-toggle');
  const languageButton = document.querySelector('.lang-btn');
  const readingMeter = document.querySelector('#read-percent');
  if (languageButton) languageButton.classList.add('ws-lang');
  const crumbs = root.querySelector('.st-crumbs, [aria-label="Хлебные крошки"]');
  const main = root.querySelector('#main-content, main');

  const icons = {
    overview: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    learning: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h8"/>',
    projects: '<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="13" width="8" height="7" rx="2"/><rect x="13" y="13" width="8" height="7" rx="2"/>',
    articles: '<path d="M5 3h11l3 3v15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 14h8M8 18h5M16 3v4h4"/>',
    notes: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    archive: '<path d="M4 4h16v4H4zM6 8v12h12V8M10 12h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.6 1.3c-.8 1-2.2 1.4-2.2 3M12 17h.01"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'
  };
  const navItems = [
    { label: 'Обзор', href: '/', icon: 'overview', test: p => p === '/' || p === '/index.html' },
    { label: 'Пространства', href: '/stands/index.html', icon: 'learning', test: p => p.startsWith('/stands/') },
    { label: 'Проекты', href: '/projects.html', icon: 'projects', test: p => p === '/projects.html' || p.startsWith('/projects/') },
    { label: 'Статьи', href: '/articles.html', icon: 'articles', test: p => p === '/articles.html' || p.startsWith('/articles/') },
    { label: 'Заметки', href: '/blog.html', icon: 'notes', test: p => p === '/blog.html' || p.startsWith('/blog/') },
    { label: 'База знаний', href: '/archive.html', icon: 'archive', test: p => p === '/archive.html' || p.startsWith('/archive/') },
    { label: 'Справка', href: '/faq.html', icon: 'help', test: p => p === '/faq.html' },
    { label: 'Карта сайта', href: '/sitemap.html', icon: 'map', test: p => p === '/sitemap.html' }
  ];

  const shell = document.createElement('div');
  shell.className = 'ws-shell';
  const sidebar = document.createElement('aside');
  sidebar.className = 'ws-sidebar';
  sidebar.id = 'workspace-navigation';
  sidebar.setAttribute('aria-label', 'Навигация по workspace');
  const brand = document.createElement('div');
  brand.className = 'ws-brand';
  if (logo) {
    logo.querySelector('.arrow')?.remove();
    logo.classList.add('ws-brand-logo');
    if (logo.matches('a')) brand.appendChild(logo);
    else {
      const brandLink = document.createElement('a');
      brandLink.href = '/'; brandLink.className = 'ws-brand-name';
      brandLink.appendChild(logo); brand.appendChild(brandLink);
    }
  } else {
    const brandLink = document.createElement('a');
    brandLink.href = '/'; brandLink.className = 'ws-brand-name'; brandLink.textContent = 'itsliventsev';
    brand.appendChild(brandLink);
  }
  if (!brand.querySelector('.ws-brand-name') && logo?.matches('a')) logo.classList.add('ws-brand-name');
  sidebar.appendChild(brand);
  const caption = document.createElement('p');
  caption.className = 'ws-sidebar-caption'; caption.textContent = 'РАБОЧЕЕ ПРОСТРАНСТВО'; sidebar.appendChild(caption);
  const nav = document.createElement('nav'); nav.className = 'ws-nav'; nav.setAttribute('aria-label', 'Основные разделы');
  navItems.forEach(item => {
    const link = document.createElement('a'); link.href = item.href; link.className = 'ws-nav-link';
    if (item.test(pathname)) link.setAttribute('aria-current', 'page');
    const icon = document.createElement('span'); icon.className = 'ws-nav-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24">' + icons[item.icon] + '</svg>';
    const label = document.createElement('span'); label.className = 'ws-nav-label'; label.textContent = item.label;
    link.append(icon, label); nav.appendChild(link);
  });
  sidebar.appendChild(nav);
  const learningNav = document.createElement('div'); learningNav.className = 'ws-learning-links';
  learningNav.innerHTML = '<p class="ws-sidebar-caption">НАПРАВЛЕНИЯ</p>'
    + '<a class="ws-nav-link" href="/stands/setpolis.html"><span class="ws-nav-dot ws-dot-violet"></span><span class="ws-nav-label">СетьПолис</span></a>'
    + '<a class="ws-nav-link" href="/stands/office/index.html"><span class="ws-nav-dot ws-dot-orange"></span><span class="ws-nav-label">ОфисПолис</span></a>'
    + '<a class="ws-nav-link" href="/stands/ops/index.html"><span class="ws-nav-dot ws-dot-blue"></span><span class="ws-nav-label">ДатаПолис</span></a>';
  sidebar.appendChild(learningNav);
  const sidebarBottom = document.createElement('div'); sidebarBottom.className = 'ws-sidebar-bottom';
  sidebarBottom.innerHTML = '<div class="ws-sidebar-card"><strong>Портфолио</strong><p>Проекты, публикации и практические материалы.</p></div>';
  sidebar.appendChild(sidebarBottom);
  const collapse = document.createElement('button'); collapse.type = 'button'; collapse.className = 'ws-collapse'; collapse.setAttribute('aria-label', 'Свернуть навигацию'); collapse.setAttribute('aria-expanded', 'true'); collapse.innerHTML = '<span aria-hidden="true">‹</span>'; sidebar.appendChild(collapse);

  const workspace = document.createElement('div'); workspace.className = 'ws-workspace';
  const topbar = document.createElement('header'); topbar.className = 'ws-topbar';
  const topContext = document.createElement('div'); topContext.className = 'ws-topbar-context';
  const menu = document.createElement('button'); menu.type = 'button'; menu.className = 'ws-icon-button ws-mobile-menu'; menu.setAttribute('aria-label', 'Открыть меню'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-controls', sidebar.id); menu.innerHTML = '<span aria-hidden="true">☰</span>';
  topContext.appendChild(menu);
  if (crumbs) {
    crumbs.className = 'ws-breadcrumbs';
    topContext.appendChild(crumbs);
  } else {
    const crumb = document.createElement('span'); crumb.className = 'ws-breadcrumbs'; crumb.setAttribute('aria-label', 'Текущий раздел'); crumb.innerHTML = '<span aria-current="page"></span>';
    crumb.firstElementChild.textContent = currentTitle; topContext.appendChild(crumb);
  }
  topbar.appendChild(topContext);
  const actions = document.createElement('div'); actions.className = 'ws-topbar-actions';
  const searchButton = document.createElement('button'); searchButton.type = 'button'; searchButton.className = 'ws-search-trigger'; searchButton.setAttribute('aria-label', 'Поиск по сайту');
  searchButton.innerHTML = '<span aria-hidden="true">⌕</span><span class="ws-search-label">Поиск по материалам</span><kbd>⌘ K</kbd>';
  actions.appendChild(searchButton);
  if (languageButton) actions.appendChild(languageButton);
  if (readingMeter) actions.appendChild(readingMeter);
  if (themeButton) {
    themeButton.className = 'theme-toggle ws-icon-button';
    themeButton.innerHTML = '<span class="ws-theme-indicator" aria-hidden="true">◐</span>';
    actions.appendChild(themeButton);
  } else {
    const theme = document.createElement('button'); theme.type = 'button'; theme.className = 'theme-toggle ws-icon-button'; theme.setAttribute('aria-label', 'Переключить тему'); theme.setAttribute('aria-pressed', document.documentElement.dataset.theme === 'dark' ? 'true' : 'false'); theme.innerHTML = '<span aria-hidden="true">◐</span>'; actions.appendChild(theme);
  }
  topbar.appendChild(actions); workspace.appendChild(topbar);

  if (contextBar) {
    contextBar.className = 'ws-context-nav';
    const inner = contextBar.querySelector('.st-topbar-in'); if (inner) inner.className = 'ws-context-inner';
    const contextBrand = contextBar.querySelector('.st-brand'); if (contextBrand) contextBrand.remove();
    const contextLinks = contextBar.querySelector('.st-topnav'); if (contextLinks) contextLinks.className = 'ws-context-links';
    const contextTheme = contextBar.querySelector('.theme-toggle'); if (contextTheme) { contextTheme.remove(); if (!actions.querySelector('.theme-toggle')) actions.appendChild(contextTheme); }
    workspace.appendChild(contextBar);
  }

  if (oldHeader) oldHeader.remove();
  root.classList.remove('page-wrap', 'st-wrap');
  root.classList.add('ws-page-content');
  if (main) {
    main.classList.add('ws-content');
    if (pathname.startsWith('/articles/') || pathname.startsWith('/blog/') || pathname.startsWith('/projects/')) {
      main.dataset.wsEditorial = pathname.startsWith('/articles/') ? 'article' : pathname.startsWith('/blog/') ? 'note' : 'case-study';
      const editorialHeader = main.querySelector('.prose-head');
      if (editorialHeader) editorialHeader.dataset.wsArticleHeader = 'true';
      const authorList = main.querySelector('.article-authors');
      if (authorList) authorList.dataset.wsArticleAuthors = 'true';
      main.querySelectorAll('.author-chip').forEach(el => { el.dataset.wsArticleAuthor = 'true'; });
      const editorialAbstract = editorialHeader?.nextElementSibling;
      if (pathname.startsWith('/articles/') && editorialAbstract) editorialAbstract.dataset.wsArticleAbstract = 'true';
      const articleLayout = [...main.children].find(el => el.querySelector('#toc') && el.querySelector('article'));
      if (articleLayout) {
        articleLayout.dataset.wsArticleLayout = 'true';
        articleLayout.querySelector('aside')?.setAttribute('data-ws-article-toc', 'true');
        articleLayout.querySelector('article')?.setAttribute('data-ws-article-content', 'true');
      }
      main.querySelectorAll('.callout, .notice').forEach(el => { el.dataset.wsCallout = 'true'; });
      main.querySelectorAll('.range-seg').forEach(el => { el.dataset.wsRangeBar = 'true'; el.dataset.wsTone = /orange-500/.test(el.className) ? 'warm' : 'cool'; });
      main.querySelectorAll('.relative').forEach(el => { if (el.querySelector('.range-seg')) el.dataset.wsRangeTrack = 'true'; });
      main.querySelectorAll('ol.list-none, ul.list-none').forEach(el => { el.dataset.wsListStyle = 'none'; });
      main.querySelectorAll('ol.list-decimal').forEach(el => { el.dataset.wsListStyle = 'decimal'; });
      main.querySelectorAll('.chart-group').forEach(el => { el.dataset.wsChartGroup = 'true'; });
      main.querySelectorAll('.chart-bar').forEach(el => { el.dataset.wsChartBar = 'true'; el.dataset.wsTone = /bg-orange-400/.test(el.className) ? 'warm-soft' : /bg-orange-500/.test(el.className) ? 'warm' : 'cool'; });
      main.querySelectorAll('.chart-label').forEach(el => { el.dataset.wsChartLabel = 'true'; });
    }
  }
  root.querySelectorAll('footer').forEach(el => { el.className = 'ws-footer'; });
  document.querySelector('.skip-link')?.classList.add('ws-skip-link');
  root.querySelectorAll('.ambient, .bg-glyphs, .floating-elements, .giant-word, .title-mark, #title-mark').forEach(el => el.setAttribute('data-ws-decoration', 'true'));
  workspace.appendChild(root);
  shell.append(sidebar, workspace);
  body.appendChild(shell);
  body.classList.add('ws-ready');
  document.documentElement.dataset.workspaceReady = 'true';
  let savedRail = 'expanded';
  try { savedRail = localStorage.getItem('workspace-rail') || 'expanded'; } catch (error) { /* private browsing */ }
  const startCompact = savedRail === 'compact';
  document.documentElement.classList.toggle('ws-mode-compact', startCompact);
  collapse.setAttribute('aria-expanded', startCompact ? 'false' : 'true');
  collapse.setAttribute('aria-label', startCompact ? 'Развернуть навигацию' : 'Свернуть навигацию');

  const overlay = document.createElement('div'); overlay.className = 'ws-overlay'; overlay.setAttribute('aria-hidden', 'true'); body.appendChild(overlay);
  function setDrawer(open) {
    sidebar.dataset.open = open ? 'true' : 'false'; overlay.dataset.open = open ? 'true' : 'false';
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.documentElement.classList.toggle('ws-mode-drawer', open);
  }
  menu.addEventListener('click', () => setDrawer(menu.getAttribute('aria-expanded') !== 'true'));
  overlay.addEventListener('click', () => { setDrawer(false); menu.focus(); });
  sidebar.addEventListener('click', event => { if (event.target.closest('a')) setDrawer(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setDrawer(false); menu.focus(); } });
  collapse.addEventListener('click', () => {
    const compact = document.documentElement.classList.toggle('ws-mode-compact');
    try { localStorage.setItem('workspace-rail', compact ? 'compact' : 'expanded'); } catch (error) { /* private browsing */ }
    collapse.setAttribute('aria-expanded', compact ? 'false' : 'true');
    collapse.setAttribute('aria-label', compact ? 'Развернуть навигацию' : 'Свернуть навигацию');
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 940) setDrawer(false); }, { passive: true });

  const searchDialog = document.createElement('dialog'); searchDialog.className = 'ws-search-dialog'; searchDialog.setAttribute('aria-label', 'Поиск по сайту');
  searchDialog.innerHTML = '<form class="ws-search-form" method="dialog"><span aria-hidden="true">⌕</span><input class="ws-search-input" type="search" placeholder="Статья, проект или учебный модуль…" aria-label="Поисковый запрос" autocomplete="off"><button class="ws-icon-button" type="submit" aria-label="Закрыть поиск">×</button></form><div class="ws-search-results" role="listbox"><div class="ws-empty">Начните вводить запрос</div></div>';
  body.appendChild(searchDialog);
  const searchInput = searchDialog.querySelector('.ws-search-input'); const searchResults = searchDialog.querySelector('.ws-search-results');
  let searchData = null, loading = false;
  function normalize(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function openSearch() { if (searchDialog.showModal) searchDialog.showModal(); else searchDialog.setAttribute('open', ''); searchInput.focus(); if (!searchData && !loading) { loading = true; fetch('/assets/search-index.json').then(r => r.json()).then(data => { searchData = data; loading = false; renderSearch(searchInput.value); }).catch(() => { loading = false; searchResults.innerHTML = '<div class="ws-empty">Индекс поиска недоступен</div>'; }); } }
  function renderSearch(query) {
    if (!searchData) return;
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) { searchResults.innerHTML = '<div class="ws-empty">Начните вводить запрос</div>'; return; }
    const matches = searchData.map(item => {
      const title = normalize(item.title), category = normalize(item.category), content = normalize(item.content);
      let score = 0; for (const term of terms) { if (title.includes(term)) score += title.startsWith(term) ? 8 : 5; else if (category.includes(term)) score += 3; else if (content.includes(term)) score += 1; else return null; }
      return { item, score };
    }).filter(Boolean).sort((a,b) => b.score-a.score).slice(0,10);
    searchResults.replaceChildren();
    if (!matches.length) { const empty = document.createElement('div'); empty.className = 'ws-empty'; empty.textContent = 'Совпадений нет — попробуйте другой запрос.'; searchResults.appendChild(empty); return; }
    matches.forEach(({ item }) => { const link = document.createElement('a'); link.className = 'ws-search-result'; link.role = 'option'; link.href = item.url; const title = document.createElement('strong'); title.textContent = item.title; const meta = document.createElement('small'); meta.textContent = [item.category, item.description || item.content].filter(Boolean).join(' · ').slice(0, 180); link.append(title, meta); searchResults.appendChild(link); });
  }
  searchButton.addEventListener('click', openSearch);
  searchInput.addEventListener('input', () => renderSearch(searchInput.value));
  searchDialog.addEventListener('click', event => { if (event.target === searchDialog) searchDialog.close?.(); });
  searchDialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); searchDialog.close?.(); });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    else if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); openSearch(); }
  });

  function decorate(scope) {
    const components = ['.card', '.p-card', '.pub-card', '.note-card', '.lab-panel', '.st-panel', '.op-panel', '.office-panel', '.admin-card', '.bento-cell', '.zone', '.project-card', '.sign-card', '.step-card', '.esp-section', '.accordion', '.wiki-group', '.quest-card', '.sla-stat', '.ticket-card', '.notice'];
    scope.querySelectorAll(components.join(',')).forEach(el => el.setAttribute('data-ws-surface', 'true'));
    scope.querySelectorAll('.st-hero, .uni-hero').forEach(el => el.setAttribute('data-ws-hero', 'true'));
    scope.querySelectorAll('.st-hero-index').forEach(el => el.setAttribute('data-ws-index', 'true'));
    scope.querySelectorAll('.flat-profile').forEach(el => el.setAttribute('data-ws-profile', 'true'));
    scope.querySelectorAll('.fp-spacer').forEach(el => el.setAttribute('data-ws-spacer', 'true'));
    scope.querySelectorAll('.zone-head, .st-section-head').forEach(el => el.setAttribute('data-ws-section-head', 'true'));
    scope.querySelectorAll('.bento-grid, .glossary-grid').forEach(el => el.setAttribute('data-ws-grid', 'true'));
    scope.querySelectorAll('.grid').forEach(el => {
      const classes = String(el.className || '');
      const dimensions = { base: classes.match(/(?:^|\s)grid-cols-(\d+)/)?.[1] || '1' };
      for (const breakpoint of ['sm', 'md', 'lg']) {
        const match = classes.match(new RegExp('(?:^|\\s)' + breakpoint + ':grid-cols-(\\d+)'));
        if (match) dimensions[breakpoint] = match[1];
      }
      el.setAttribute('data-ws-grid', 'utility');
      el.style.setProperty('--ws-grid-base', dimensions.base);
      for (const breakpoint of ['sm', 'md', 'lg']) if (dimensions[breakpoint]) {
        el.setAttribute('data-ws-grid-' + breakpoint, dimensions[breakpoint]);
        el.style.setProperty('--ws-grid-' + breakpoint, dimensions[breakpoint]);
      }
    });
    scope.querySelectorAll('.flex').forEach(el => {
      el.setAttribute('data-ws-flex', 'true');
      if (/\bjustify-between\b/.test(el.className)) el.setAttribute('data-ws-justify', 'between');
      if (/\bitems-start\b/.test(el.className)) el.setAttribute('data-ws-align', 'start');
      if (/\bitems-center\b/.test(el.className)) el.setAttribute('data-ws-align', 'center');
    });
    scope.querySelectorAll('.flex-1').forEach(el => el.setAttribute('data-ws-grow', 'true'));
    scope.querySelectorAll('.min-w-0').forEach(el => el.setAttribute('data-ws-min-width', 'true'));
    scope.querySelectorAll('.shrink-0').forEach(el => el.setAttribute('data-ws-no-shrink', 'true'));
    scope.querySelectorAll('.notice-label').forEach(el => el.setAttribute('data-ws-notice-label', 'true'));
    scope.querySelectorAll('.mat-row').forEach(el => el.setAttribute('data-ws-row', 'true'));
    scope.querySelectorAll('.mat-dot').forEach(el => el.setAttribute('data-ws-dot', 'true'));
    scope.querySelectorAll('.wiki-links .mono').forEach(el => el.setAttribute('data-ws-index', 'true'));
    scope.querySelectorAll('.wiki-layout').forEach(el => el.setAttribute('data-ws-layout', 'wiki'));
    scope.querySelectorAll('.wiki-nav').forEach(el => el.setAttribute('data-ws-wiki-nav', 'true'));
    scope.querySelectorAll('.wiki-links').forEach(el => el.setAttribute('data-ws-wiki-links', 'true'));
    scope.querySelectorAll('.article-meta').forEach(el => el.setAttribute('data-ws-meta', 'true'));
    scope.querySelectorAll('.flat-row, .step-card').forEach(el => el.setAttribute('data-ws-row', 'true'));
    scope.querySelectorAll('.lab-progress, .xp-bar, .lg-bar, .quest-progress').forEach(el => el.setAttribute('data-ws-progress', 'true'));
    scope.querySelectorAll('.lp-head').forEach(el => el.setAttribute('data-ws-panel-head', 'true'));
    scope.querySelectorAll('.lp-body').forEach(el => el.setAttribute('data-ws-panel-body', 'true'));
    scope.querySelectorAll('.lab-layout, .ops-board, .flat-grid--cards, .lab-steps').forEach(el => el.setAttribute('data-ws-grid', 'cards'));
    scope.querySelectorAll('.cmd-duo, .plus-minus, .rca-fields').forEach(el => el.setAttribute('data-ws-grid', 'two'));
    scope.querySelectorAll('.task-list, .lab-checks, .st-goals, .ops-legend-list').forEach(el => el.setAttribute('data-ws-stack', 'true'));
    scope.querySelectorAll('.task-item, .cmd-row, .ticket-card, .ticket').forEach(el => el.setAttribute('data-ws-row', 'true'));
    scope.querySelectorAll('.q-item').forEach(el => el.setAttribute('data-ws-surface', 'true'));
    scope.querySelectorAll('.q-opts').forEach(el => el.setAttribute('data-ws-options', 'true'));
    scope.querySelectorAll('.q-opt').forEach(el => el.setAttribute('data-ws-option', 'true'));
    scope.querySelectorAll('.mc-speech').forEach(el => el.setAttribute('data-ws-message', 'true'));
    scope.querySelectorAll('.mc-bubble').forEach(el => el.setAttribute('data-ws-bubble', 'true'));
    scope.querySelectorAll('.task-body').forEach(el => el.setAttribute('data-ws-task-body', 'true'));
    scope.querySelectorAll('.task-hint').forEach(el => el.setAttribute('data-ws-task-hint', 'true'));
    scope.querySelectorAll('.task-title').forEach(el => el.setAttribute('data-ws-task-title', 'true'));
    scope.querySelectorAll('.xp-meta').forEach(el => el.setAttribute('data-ws-progress-label', 'true'));
    scope.querySelectorAll('.is-active').forEach(el => el.setAttribute('data-ws-active', 'true'));
    scope.querySelectorAll('.task-item.is-done, .q-opt.is-ok').forEach(el => el.setAttribute('data-ws-state', 'complete'));
    scope.querySelectorAll('.q-opt.is-bad').forEach(el => el.setAttribute('data-ws-state', 'error'));
    scope.querySelectorAll('.is-disabled').forEach(el => el.setAttribute('data-ws-state', 'locked'));
    scope.querySelectorAll('.theory-block, .reflect-item, .cmd-col, .rca-fields > div').forEach(el => el.setAttribute('data-ws-inset', 'true'));
    scope.querySelectorAll('.lab-terminal, .lab-editor, .term-screen, .lt-screen').forEach(el => el.setAttribute('data-ws-console', 'true'));
    scope.querySelectorAll('.st-modal, .st-modal-box').forEach(el => el.setAttribute('data-ws-modal', 'true'));
    scope.querySelectorAll('.st-details, details').forEach(el => el.setAttribute('data-ws-disclosure', 'true'));
    scope.querySelectorAll('.lk-progress-strip, .ops-statusbar').forEach(el => el.setAttribute('data-ws-progress-strip', 'true'));
    scope.querySelectorAll('table').forEach(el => el.setAttribute('data-ws-table', 'true'));
    scope.querySelectorAll('[role="tablist"]').forEach(el => el.setAttribute('data-ws-tabs', 'true'));
    scope.querySelectorAll('button').forEach(el => {
      el.setAttribute('data-ws-control', 'true');
      if (/\b(btn|flat-btn|primary)\b/.test(el.className)) el.setAttribute('data-ws-action', /\b(btn-primary|btn-main|primary)\b/.test(el.className) ? 'primary' : 'secondary');
    });
    scope.querySelectorAll('a').forEach(el => { if (/\b(btn|flat-btn|quick-bubble|ws-button)\b/.test(el.className)) el.setAttribute('data-ws-action', /\b(btn-primary|btn-main|primary)\b/.test(el.className) ? 'primary' : 'secondary'); });
    scope.querySelectorAll('.pill, .chip, .badge, .p-tag, .kind-badge, .flat-badge, .p-status, .sev, .tag-hash').forEach(el => {
      el.setAttribute('data-ws-tag', 'true');
      if (/p-status-ready|is-complete|is-done|status-ok/.test(el.className)) el.setAttribute('data-ws-state', 'complete');
      else if (/p-status-soon|is-locked|status-wait/.test(el.className)) el.setAttribute('data-ws-state', 'locked');
      else if (/is-active|p-status-new/.test(el.className)) el.setAttribute('data-ws-state', 'active');
    });
  }
  decorate(root);
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) decorate(node); })));
  observer.observe(root, { childList: true, subtree: true });
})();
