/* Static Workspace shell. The lesson engines and their storage contracts are not touched. */
(function () {
  'use strict';
  if (document.documentElement.dataset.workspaceReady === 'true') return;
  const body = document.body;
  const pathname = location.pathname.replace(/\/$/, '') || '/';
  const learningArea = pathname.startsWith('/stands/office') ? 'office' : pathname.startsWith('/stands/ops') ? 'operations' : pathname.startsWith('/stands/') && pathname !== '/stands/index.html' ? 'network' : 'general';
  body.dataset.wsArea = learningArea;
  const cleanLabel = value => String(value || '').replace(/\s+/g, ' ').trim();
  const sentenceCase = value => {
    const label = cleanLabel(value);
    return label ? label.charAt(0).toLocaleUpperCase('ru-RU') + label.slice(1) : '';
  };
  const pathTitle = () => {
    const h1 = document.querySelector('main h1');
    const heading = h1 && cleanLabel(h1.innerText || h1.textContent);
    if (heading) return sentenceCase(heading);
    const routes = {
      '/404.html': 'Страница не найдена', '/projects.html': 'Проекты',
      '/articles.html': 'Статьи', '/blog.html': 'Заметки', '/archive.html': 'Архив',
      '/faq.html': 'Справка', '/sitemap.html': 'Карта сайта', '/admin.html': 'Панель преподавателя',
      '/stands/index.html': 'Пространства', '/stands/office/index.html': 'ОфисПолис',
      '/stands/ops/index.html': 'ДатаПолис', '/stands/setpolis.html': 'СетьПолис'
    };
    if (routes[pathname]) return routes[pathname];
    const metaTitle = document.querySelector('meta[property="og:title"]')?.content || document.title;
    const safeTitle = cleanLabel(metaTitle.split(/\s+[·|—–]\s+/)[0]);
    return safeTitle && !/^itsliventsev$/i.test(safeTitle) ? sentenceCase(safeTitle) : 'Раздел';
  };
  const isHome = pathname === '/' || pathname === '/index.html';
  const pathSegments = pathname.split('/').filter(Boolean).filter(part => part !== 'index.html');
  const isNestedPage = pathSegments.length > 1;
  const currentTitle = isHome ? 'Главная' : pathTitle();
  const root = document.querySelector('[data-workspace-root], .page-wrap, .st-wrap') || document.querySelector('main')?.parentElement || body;
  const contextBar = document.querySelector('.st-topbar');
  const oldHeader = document.querySelector('.site-header, .st-global-header');
  const themeButton = document.querySelector('.theme-toggle');
  const languageButton = document.querySelector('.lang-btn');
  const readingMeter = document.querySelector('#read-percent');
  if (languageButton) languageButton.classList.add('ws-lang');
  const crumbs = root.querySelector('.st-crumbs, [aria-label="Хлебные крошки"]');
  const main = root.querySelector('#main-content, main');
  function addSectionNavigation() {
    if (!main) return;
    const headings = [...main.querySelectorAll('h2')].filter(heading => {
      if (heading.closest('details, dialog, [role="dialog"], [hidden], [aria-hidden="true"]')) return false;
      return cleanLabel(heading.innerText || heading.textContent).length > 1;
    });
    const seen = new Set();
    const sectionGroup = document.createElement('div');
    sectionGroup.className = 'ws-nav-group'; sectionGroup.dataset.variant='onpage'; sectionGroup.dataset.wsOnPageNav='true';
    const sectionCaption = document.createElement('p');
    sectionCaption.className = 'ws-sidebar-caption'; sectionCaption.textContent = 'На этой странице';
    sectionGroup.appendChild(sectionCaption);
    const sectionNav = document.createElement('nav');
    sectionNav.className = 'ws-section-nav ws-nav'; sectionNav.setAttribute('aria-label', 'На этой странице');
    headings.forEach((heading, index) => {
      let id = heading.id;
      if (!id) {
        const base = cleanLabel(heading.textContent).toLocaleLowerCase('ru-RU')
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е')
          .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section-' + (index + 1);
        id = base; let suffix = 2;
        while (document.getElementById(id) || seen.has(id)) id = base + '-' + suffix++;
        heading.id = id;
      }
      heading.setAttribute('data-ws-section-target', 'true');
      if (seen.has(id)) return;
      seen.add(id);
      const link = document.createElement('a');
      link.className = 'ws-section-link'; link.href = '#' + id;
      link.textContent = sentenceCase(heading.innerText || heading.textContent);
      sectionNav.appendChild(link);
    });
    if (seen.size > 1) { sectionGroup.appendChild(sectionNav); sidebar.appendChild(sectionGroup); if (sidebar._attachIndicator) sidebar._attachIndicator(sectionNav); }
  }
  function generatedBreadcrumbs() {
    if (!isNestedPage) return null;
    const items = [];
    const first = pathSegments[0];
    if (first === 'projects') items.push(['Проекты', '/projects.html']);
    else if (first === 'articles') items.push(['Статьи', '/articles.html']);
    else if (first === 'blog') items.push(['Заметки', '/blog.html']);
    else if (first === 'archive') items.push(['Архив', '/archive.html']);
    else if (first === 'stands') {
      items.push(['Пространства', '/stands/index.html']);
      if (pathSegments[1] === 'ops') items.push(['ДатаПолис', '/stands/ops/index.html']);
      else if (pathSegments[1] === 'office') items.push(['ОфисПолис', '/stands/office/index.html']);
    }
    while (items.length > 1 && items[items.length - 1][0].toLocaleLowerCase('ru-RU') === currentTitle.toLocaleLowerCase('ru-RU')) items.pop();
    if (!items.length) return null;
    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'ws-breadcrumbs'; breadcrumb.setAttribute('aria-label', 'Хлебные крошки');
    items.forEach(([label, href]) => {
      const link = document.createElement('a'); link.href = href; link.textContent = label; breadcrumb.appendChild(link);
      const separator = document.createElement('span'); separator.setAttribute('aria-hidden', 'true'); separator.textContent = '›'; breadcrumb.appendChild(separator);
    });
    const current = document.createElement('span'); current.setAttribute('aria-current', 'page'); current.textContent = currentTitle;
    breadcrumb.appendChild(current);
    return breadcrumb;
  }
  const iconByGlyph = { '↗': 'arrow-up-right', '→': 'arrow-right', '←': 'arrow-left', '↓': 'arrow-down', '↧': 'arrow-down', '↑': 'arrow-up', '▾': 'chevron-down', '▸': 'chevron-right', '⌘': 'network', '▤': 'document', '◉': 'server', '◈': 'award', '⌖': 'compass', '◷': 'archive', '⇄': 'operations', '★': 'star', '✓': 'check', '✕': 'close', '↥': 'upload', '↻': 'refresh', 'ⓘ': 'info' };
  const iconMarkup = (name, className = 'ws-inline-icon') => '<svg class="' + className + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#' + name + '"></use></svg>';
  document.querySelectorAll('[aria-hidden="true"]').forEach(node => {
    const glyph = node.textContent.trim();
    if (!node.children.length && iconByGlyph[glyph]) node.innerHTML = iconMarkup(iconByGlyph[glyph]);
  });
  document.querySelectorAll('.ws-resource-icon, .ws-course-icon').forEach(node => {
    const glyph = node.textContent.trim();
    if (iconByGlyph[glyph]) { node.setAttribute('aria-hidden', 'true'); node.innerHTML = iconMarkup(iconByGlyph[glyph]); }
  });
  const linkArrow = { '↗': 'arrow-up-right', '→': 'arrow-right', '←': 'arrow-left', '↓': 'arrow-down', '↑': 'arrow-up', '↥': 'upload', '↧': 'arrow-down', '↻': 'refresh' };
  document.querySelectorAll('a, button').forEach(control => {
    for (const node of [...control.childNodes].reverse()) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const match = /^(.*?)(\s*)(↗|→|←|↓|↑|↥|↧|↻)(\s*)$/u.exec(node.nodeValue);
      if (!match) { if (node.nodeValue.trim()) break; else continue; }
      node.nodeValue = match[1] + match[2];
      const template = document.createElement('template'); template.innerHTML = iconMarkup(linkArrow[match[3]]);
      control.insertBefore(template.content.firstElementChild, node.nextSibling);
      break;
    }
  });
  document.querySelectorAll('.arrow, .chevron, .skills-summary-chevron').forEach(node => {
    const glyph = node.textContent.trim();
    if (iconByGlyph[glyph]) {
      const name = iconByGlyph[glyph]; node.setAttribute('aria-hidden', 'true'); node.setAttribute('data-ws-icon', name); node.innerHTML = iconMarkup(name);
    }
  });

  const icons = { overview: 'home', learning: 'document', projects: 'projects', articles: 'document', notes: 'notes', archive: 'archive', help: 'help', map: 'map' };
  const navItems = [
    { label: 'Обзор', href: '/', icon: 'overview', test: p => p === '/' || p === '/index.html' },
    { label: 'Пространства', href: '/stands/index.html', icon: 'learning', test: p => p.startsWith('/stands/') },
    { label: 'Проекты', href: '/projects.html', icon: 'projects', test: p => p === '/projects.html' || p.startsWith('/projects/') },
    { label: 'Статьи', href: '/articles.html', icon: 'articles', test: p => p === '/articles.html' || p.startsWith('/articles/') },
    { label: 'Заметки', href: '/blog.html', icon: 'notes', test: p => p === '/blog.html' || p.startsWith('/blog/') },
    { label: 'Архив', href: '/archive.html', icon: 'archive', test: p => p === '/archive.html' || p.startsWith('/archive/') },
    { label: 'Справка', href: '/faq.html', icon: 'help', test: p => p === '/faq.html' },
    { label: 'Карта сайта', href: '/sitemap.html', icon: 'map', test: p => p === '/sitemap.html' }
  ];

  const shell = document.createElement('div');
  shell.className = 'ws-shell';
  const sidebar = document.createElement('aside');
  sidebar.className = 'ws-sidebar';
  sidebar.id = 'workspace-navigation';
  sidebar.setAttribute('aria-label', 'Основная навигация сайта');
  const sidebarHead = document.createElement('div');
  sidebarHead.className = 'ws-sidebar-head';
  const brand = document.createElement('a');
  brand.className = 'ws-sidebar-brand'; brand.dataset.wsSidebarBrand = 'true'; brand.href = '/'; brand.textContent = 'itsliventsev';
  brand.setAttribute('aria-label', 'itsliventsev — главная страница');
  const collapse = document.createElement('button');
  collapse.type = 'button'; collapse.className = 'ws-collapse'; collapse.setAttribute('aria-label', 'Свернуть навигацию'); collapse.setAttribute('aria-expanded', 'true'); collapse.innerHTML = iconMarkup('chevron-left');
  sidebarHead.append(brand, collapse);
  sidebar.appendChild(sidebarHead);
  // — Agentic redesign: three visually separated pill groups with moving indicator
  function attachIndicator(navEl) {
    const indicator = document.createElement('div');
    indicator.className = 'ws-nav-indicator';
    indicator.setAttribute('aria-hidden','true');
    navEl.prepend(indicator);
    let active = navEl.querySelector('[aria-current="page"]');
    const links = [...navEl.querySelectorAll('.ws-nav-link, .ws-section-link')];
    if (!links.length) return;
    function moveTo(el) {
      if (!el || !navEl.contains(el)) return;
      const top = el.offsetTop;
      const h = el.offsetHeight;
      indicator.style.transform = 'translateY(' + top + 'px)';
      indicator.style.height = h + 'px';
      navEl.classList.add('is-indicator-active');
    }
    function leave() {
      if (active) moveTo(active); else { indicator.style.opacity='0'; navEl.classList.remove('is-indicator-active'); }
    }
    if (active) requestAnimationFrame(()=> moveTo(active));
    links.forEach(link=>{
      link.addEventListener('mouseenter', ()=> { link.classList.add('is-hovered'); moveTo(link); });
      link.addEventListener('mouseleave', ()=> { link.classList.remove('is-hovered'); });
      link.addEventListener('focus', ()=> moveTo(link));
    });
    navEl.addEventListener('mouseleave', leave);
    navEl.addEventListener('focusout', ()=> { setTimeout(leave, 10); });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(()=> { if (active) moveTo(active); });
      ro.observe(navEl);
    }
  }
  const generalGroup = document.createElement('div'); generalGroup.className='ws-nav-group'; generalGroup.dataset.variant='general';
  const caption = document.createElement('p'); caption.className='ws-sidebar-caption'; caption.textContent='Общее меню'; generalGroup.appendChild(caption);
  const nav = document.createElement('nav'); nav.className='ws-nav'; nav.setAttribute('aria-label', 'Основные разделы');
  navItems.forEach(item => {
    const link = document.createElement('a'); link.href=item.href; link.className='ws-nav-link';
    if (item.test(pathname)) link.setAttribute('aria-current','page');
    const icon=document.createElement('span'); icon.className='ws-nav-icon'; icon.setAttribute('aria-hidden','true'); icon.innerHTML=iconMarkup(icons[item.icon]);
    const label=document.createElement('span'); label.className='ws-nav-label'; label.textContent=item.label;
    link.append(icon,label); nav.appendChild(link);
  });
  generalGroup.appendChild(nav);
  sidebar.appendChild(generalGroup);
  attachIndicator(nav);

  const learningGroup = document.createElement('div'); learningGroup.className='ws-nav-group ws-learning-links'; learningGroup.dataset.variant='directions';
  learningGroup.innerHTML = '<p class="ws-sidebar-caption">Направления</p><nav class="ws-nav" aria-label="Направления"><a class="ws-nav-link" href="/stands/setpolis.html"' + (pathname === '/stands/setpolis.html' ? ' aria-current="page"' : '') + '><span class="ws-nav-dot ws-dot-violet" aria-hidden="true"></span><span class="ws-nav-label">СетьПолис</span></a><a class="ws-nav-link" href="/stands/office/index.html"' + (pathname.startsWith('/stands/office') ? ' aria-current="page"' : '') + '><span class="ws-nav-dot ws-dot-orange" aria-hidden="true"></span><span class="ws-nav-label">ОфисПолис</span></a><a class="ws-nav-link" href="/stands/ops/index.html"' + (pathname.startsWith('/stands/ops') ? ' aria-current="page"' : '') + '><span class="ws-nav-dot ws-dot-blue" aria-hidden="true"></span><span class="ws-nav-label">ДатаПолис</span></a></nav>';
  const learningNavInner = learningGroup.querySelector('.ws-nav');
  sidebar.appendChild(learningGroup);
  attachIndicator(learningNavInner);
  sidebar._attachIndicator = attachIndicator;
  // original section nav will be added after this as third group
  addSectionNavigation();
  const sidebarBottom = document.createElement('div'); sidebarBottom.className = 'ws-sidebar-bottom';
  sidebarBottom.innerHTML = '<div class="ws-sidebar-card"><strong>Портфолио</strong><p>Проекты, публикации и практические материалы.</p></div>';
  sidebar.appendChild(sidebarBottom);

  const workspace = document.createElement('div'); workspace.className = 'ws-workspace';
  const topbar = document.createElement('header'); topbar.className = 'ws-topbar';
  const topContext = document.createElement('div'); topContext.className = 'ws-topbar-context';
  const menu = document.createElement('button'); menu.type = 'button'; menu.className = 'ws-icon-button ws-mobile-menu'; menu.setAttribute('aria-label', 'Открыть меню'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-controls', sidebar.id); menu.innerHTML = iconMarkup('menu');
  topContext.appendChild(menu);
  const breadcrumb = isNestedPage ? (crumbs || generatedBreadcrumbs()) : null;
  if (breadcrumb) {
    breadcrumb.className = 'ws-breadcrumbs';
    breadcrumb.querySelectorAll('a, [aria-current="page"]').forEach(item => { item.textContent = sentenceCase(item.textContent); });
    topContext.appendChild(breadcrumb);
  } else {
    topContext.dataset.wsTopLevel = 'true';
    topbar.dataset.wsTopLevel = 'true';
    if (crumbs) crumbs.remove();
  }
  topbar.appendChild(topContext);
  const actions = document.createElement('div'); actions.className = 'ws-topbar-actions';
  const searchButton = document.createElement('button'); searchButton.type = 'button'; searchButton.className = 'ws-search-trigger';
  searchButton.innerHTML = '<span class="ws-search-icon" aria-hidden="true">' + iconMarkup('search') + '</span><span class="ws-search-label">Поиск по материалам</span><kbd>Ctrl K</kbd>';
  actions.appendChild(searchButton);
  if (languageButton) actions.appendChild(languageButton);
  if (readingMeter) actions.appendChild(readingMeter);
  if (themeButton) {
    themeButton.className = 'theme-toggle ws-icon-button';
    themeButton.innerHTML = iconMarkup('moon', 'ws-theme-indicator');
    actions.appendChild(themeButton);
  } else {
    const theme = document.createElement('button'); theme.type = 'button'; theme.className = 'theme-toggle ws-icon-button'; theme.setAttribute('aria-label', 'Переключить тему'); theme.setAttribute('aria-pressed', document.documentElement.dataset.theme === 'dark' ? 'true' : 'false'); theme.innerHTML = iconMarkup('moon', 'ws-theme-indicator');
    actions.appendChild(theme);
  }
  if (!document.documentElement.classList.contains('js-enabled')) {
    actions.querySelector('.theme-toggle')?.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
      try { localStorage.setItem('itsliventsev-theme', dark ? 'dark' : 'light'); } catch (error) { /* приватный режим */ }
      const metaColor = document.querySelector('meta[name="theme-color"]');
      if (metaColor) metaColor.setAttribute('content', dark ? '#15161d' : '#f3f4f7');
      const button = actions.querySelector('.theme-toggle');
      button?.setAttribute('aria-pressed', dark ? 'true' : 'false');
      button?.setAttribute('aria-label', dark ? 'включить светлую тему' : 'включить тёмную тему');
    });
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
    main.querySelectorAll('.st-section-num').forEach(el => el.setAttribute('data-ws-index', 'true'));
    main.querySelectorAll('.drop-cap').forEach(el => el.setAttribute('data-ws-dropcap', 'true'));
    main.querySelectorAll('.fn-ref').forEach(el => el.setAttribute('data-ws-article-reference', 'true'));
    main.querySelectorAll('table').forEach(table => {
      table.setAttribute('data-ws-table', 'true');
      if (!table.parentElement?.hasAttribute('data-ws-table-wrap')) {
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-ws-table-wrap', 'true');
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });
    if (pathname === '/projects.html') {
      main.dataset.wsProjects = 'true';
      main.querySelector('.ws-page-heading')?.setAttribute('data-ws-project-intro', 'true');
    }
    if (pathname === '/archive.html') {
      main.dataset.wsArchive = 'true';
      main.querySelectorAll('.notice').forEach(notice => { notice.dataset.wsCallout = 'true'; notice.dataset.wsTone = 'info'; });
      main.querySelectorAll('details > summary').forEach(summary => {
        summary.setAttribute('data-ws-archive-summary', 'true');
        const meta = summary.lastElementChild;
        meta?.setAttribute('data-ws-archive-meta', 'true');
        meta?.querySelectorAll('span').forEach(item => {
          if (/^\d+$/.test(item.textContent.trim())) item.setAttribute('data-ws-archive-count', 'true');
        });
      });
    }
    if (pathname === '/stands/glossary.html') {
      main.dataset.wsGlossary = 'true';
      main.querySelector('.glossary-toolbar')?.setAttribute('data-ws-glossary-toolbar', 'true');
      main.querySelector('.glossary-filters')?.setAttribute('data-ws-glossary-filters', 'true');
      main.querySelector('.glossary-toc')?.setAttribute('data-ws-glossary-toc', 'true');
      main.querySelector('.glossary-status')?.setAttribute('data-ws-glossary-status', 'true');
      main.querySelector('.glossary-empty')?.setAttribute('data-ws-glossary-empty', 'true');
      main.querySelectorAll('.glossary-item').forEach(el => el.setAttribute('data-ws-glossary-term', 'true'));
      main.querySelectorAll('.glossary-grid').forEach(el => el.setAttribute('data-ws-glossary-grid', 'true'));
      main.querySelectorAll('.glossary-legend').forEach(el => el.setAttribute('data-ws-glossary-legend', 'true'));
    }
    if (pathname === '/projects/esports.html') {
      main.dataset.wsEsports = 'true';
      const hooks = {
        '.esp-hero': 'data-ws-esports-hero', '.esp-hero-main': 'data-ws-esports-intro',
        '.esp-badges': 'data-ws-esports-badges', '.hero-panel': 'data-ws-esports-visual',
        '.hero-orb': 'data-ws-esports-orb', '.hero-orb.o1': 'data-ws-esports-orbit-a',
        '.hero-orb.o2': 'data-ws-esports-orbit-b', '.hero-orb.o3': 'data-ws-esports-orbit-c', '.hero-orb.o4': 'data-ws-esports-orbit-d',
        '.hero-controller': 'data-ws-esports-controller', '.hero-panel-tag': 'data-ws-esports-tag',
        '.hero-title': 'data-ws-esports-title', '.hero-lead': 'data-ws-esports-lead',
        '.esp-section': 'data-ws-esports-section', '.esp-stat': 'data-ws-esports-stat',
        '.esp-stat-num': 'data-ws-esports-stat-value', '.esp-stat-label': 'data-ws-esports-stat-label',
        '.esp-label': 'data-ws-esports-kicker', '.esp-title': 'data-ws-esports-heading',
        '.esp-timeline': 'data-ws-esports-timeline', '.esp-tl-item': 'data-ws-esports-event',
        '.esp-tl-date': 'data-ws-esports-date', '.esp-tl-title': 'data-ws-esports-event-title',
        '.esp-tl-desc': 'data-ws-esports-event-copy', '.light-band': 'data-ws-esports-band',
        '.light-card': 'data-ws-esports-card', '.color-band': 'data-ws-esports-callout',
        '.p-status-row': 'data-ws-esports-status-row', '.p-counter': 'data-ws-esports-meta',
        '.split-bar': 'data-ws-esports-split', '.seg-theory': 'data-ws-esports-theory',
        '.seg-practice': 'data-ws-esports-practice', '.result-done': 'data-ws-esports-outcome-success',
        '.result-growth': 'data-ws-esports-outcome-neutral'
      };
      Object.entries(hooks).forEach(([selector, attribute]) => main.querySelectorAll(selector).forEach(el => el.setAttribute(attribute, 'true')));
      main.querySelectorAll('.p-card').forEach(el => el.setAttribute('data-ws-esports-card', 'true'));
    }
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
      main.querySelectorAll('.chart-group').forEach(el => {
        el.dataset.wsChartGroup = 'true';
        el.dataset.wsChartDirection = /(?:^|\s)flex-col(?:\s|$)/.test(el.className) ? 'column' : 'row';
      });
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
  const lastModified = new Date(document.lastModified);
  if (!Number.isNaN(lastModified.getTime())) {
    const pad = value => String(value).padStart(2, '0');
    const dateTime = lastModified.getFullYear() + '-' + pad(lastModified.getMonth() + 1) + '-' + pad(lastModified.getDate());
    const visibleDate = lastModified.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    document.querySelectorAll('time[data-footer-updated]').forEach(el => {
      el.dateTime = dateTime; el.textContent = 'Обновлено: ' + visibleDate; el.setAttribute('aria-label', 'Страница обновлена ' + visibleDate);
    });
  }
  let topButton = document.getElementById('to-top');
  if (!topButton) {
    topButton = document.createElement('button'); topButton.id = 'to-top'; topButton.type = 'button'; topButton.className = 'ws-to-top';
    topButton.setAttribute('aria-label', 'Наверх'); topButton.title = 'Наверх'; topButton.innerHTML = iconMarkup('arrow-up'); body.appendChild(topButton);
    const updateTopButton = () => topButton.classList.toggle('show', window.scrollY > 500);
    window.addEventListener('scroll', updateTopButton, { passive: true }); updateTopButton();
    topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  }
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
    const wasOpen = sidebar.dataset.open === 'true';
    sidebar.dataset.open = open ? 'true' : 'false'; overlay.dataset.open = open ? 'true' : 'false';
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.documentElement.classList.toggle('ws-mode-drawer', open);
    workspace.toggleAttribute('inert', open);
    if (open) {
      sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true');
      sidebar.querySelector('a[href]')?.focus();
    } else {
      sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal');
      if (wasOpen && sidebar.contains(document.activeElement)) menu.focus();
    }
  }
  menu.addEventListener('click', () => setDrawer(menu.getAttribute('aria-expanded') !== 'true'));
  sidebar.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || sidebar.dataset.open !== 'true') return;
    const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled])')].filter(el => el.getClientRects().length);
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
  });
  overlay.addEventListener('click', () => { setDrawer(false); menu.focus(); });
  sidebar.addEventListener('click', event => { if (event.target.closest('a')) setDrawer(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { setDrawer(false); menu.focus(); } });
  if (sidebar.querySelector('.ws-section-nav')) {
    const sectionLinks = [...sidebar.querySelectorAll('.ws-section-link')];
    const setActiveSection = id => sectionLinks.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const sectionTargets = sectionLinks.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
    setActiveSection(location.hash.slice(1));
    window.addEventListener('hashchange', () => setActiveSection(location.hash.slice(1)));
    if ('IntersectionObserver' in window) {
      const sectionObserver = new IntersectionObserver(entries => {
        const current = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (current) setActiveSection(current.target.id);
      }, { rootMargin: '-14% 0px -68% 0px', threshold: 0 });
      sectionTargets.forEach(target => sectionObserver.observe(target));
    }
  }
  // v4: scroll reveal — set --reveal-index for stagger (Orchestrator)
  try {
    const sections = [...document.querySelectorAll('.ws-section, .ws-dashboard-grid, .ws-home-hero')];
    sections.forEach((el, i) => el.style.setProperty('--reveal-index', String(i)));
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-revealed'); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      sections.forEach(s => io.observe(s));
    }
  } catch(_){}

  // v4: keyboard arrow nav for sidebar groups
  try {
    document.querySelectorAll('.ws-nav-group').forEach(group => {
      const links = [...group.querySelectorAll('.ws-nav-link, .ws-section-link')];
      group.addEventListener('keydown', e => {
        if (!['ArrowDown','ArrowUp'].includes(e.key)) return;
        const idx = links.indexOf(document.activeElement);
        if (idx === -1) return;
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? (idx+1)%links.length : (idx-1+links.length)%links.length;
        links[next].focus();
      });
    });
  } catch(_){}

  collapse.addEventListener('click', () => {
    const compact = document.documentElement.classList.toggle('ws-mode-compact');
    try { localStorage.setItem('workspace-rail', compact ? 'compact' : 'expanded'); } catch (error) { /* private browsing */ }
    collapse.setAttribute('aria-expanded', compact ? 'false' : 'true');
    collapse.setAttribute('aria-label', compact ? 'Развернуть навигацию' : 'Свернуть навигацию');
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 940) setDrawer(false); }, { passive: true });

  const searchDialog = document.createElement('dialog'); searchDialog.className = 'ws-search-dialog'; searchDialog.setAttribute('aria-label', 'Поиск по сайту — cmdk palette (Ctrl+K)');
  searchDialog.innerHTML = '<form class="ws-search-form" method="dialog"><span class="ws-search-icon" aria-hidden="true">' + iconMarkup('search') + '</span><input class="ws-search-input" type="search" placeholder="Поиск или > команды — начните печатать…" aria-label="Поисковый запрос" autocomplete="off"><button class="ws-icon-button" type="submit" aria-label="Закрыть поиск">' + iconMarkup('close') + '</button></form><div class="ws-search-results" role="listbox" aria-label="Результаты поиска"></div><div class="ws-search-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> навигация · <kbd>↵</kbd> открыть · <kbd>Esc</kbd> закрыть</span><span data-ws-search-hint>Введите запрос</span></div>';
  body.appendChild(searchDialog);
  const searchInput = searchDialog.querySelector('.ws-search-input'); const searchResults = searchDialog.querySelector('.ws-search-results'); const searchHint = searchDialog.querySelector('[data-ws-search-hint]');
  let searchData = null, loading = false, activeIndex = -1;
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function highlight(text, terms){ if(!text) return ''; var out=escapeHtml(text); terms.forEach(function(t){ if(t.length<2) return; var safe=t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); out=out.replace(new RegExp('('+safe+')','gi'),'<mark>$1</mark>'); }); return out; }
  function setActive(n){ var els=Array.from(searchResults.querySelectorAll('.ws-search-result')); if(!els.length){ activeIndex=-1; return; } activeIndex=Math.max(0,Math.min(n,els.length-1)); els.forEach(function(el,i){ el.classList.toggle('is-active',i===activeIndex); el.setAttribute('aria-selected',i===activeIndex?'true':'false'); if(i===activeIndex) el.scrollIntoView({block:'nearest'}); }); }
  function normalize(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function openSearch() { if (searchDialog.open) { searchInput.focus(); return; } if (searchDialog.showModal) searchDialog.showModal(); else searchDialog.setAttribute('open', ''); searchInput.focus(); searchInput.select(); if (!searchData && !loading) { loading = true; searchResults.innerHTML = '<div class="ws-empty"><div class="ws-empty-icon" aria-hidden="true">' + iconMarkup('search') + '</div>Загружаем индекс…</div>'; fetch('/assets/search-index.json').then(function(r){ return r.json(); }).then(function(data){ searchData=Array.isArray(data)?data:(data.items||[]); loading=false; renderSearch(searchInput.value); }).catch(function(){ loading=false; searchResults.innerHTML='<div class="ws-empty"><div class="ws-empty-icon" aria-hidden="true">' + iconMarkup('close') + '</div>Индекс поиска недоступен.</div>'; }); } }

  /* ── v14: command palette actions (prefix > ) ── */
  var CMD_ACTIONS = [
    {id:'go-projects', label:'Перейти в Проекты', desc:'Открыть /projects.html', icon:'projects', hotkey:'G P', run:function(){ location.href='/projects.html'; }},
    {id:'go-articles', label:'Перейти в Статьи', desc:'Открыть /articles.html', icon:'document', hotkey:'G A', run:function(){ location.href='/articles.html'; }},
    {id:'go-notes', label:'Перейти в Заметки', desc:'Открыть /blog.html', icon:'notes', hotkey:'G N', run:function(){ location.href='/blog.html'; }},
    {id:'go-archive', label:'Перейти в Архив', desc:'Открыть /archive.html', icon:'archive', hotkey:'G H', run:function(){ location.href='/archive.html'; }},
    {id:'toggle-theme', label:'Переключить тему', desc:'Светлая ↔ тёмная', icon:'moon', hotkey:'T', run:function(){ var btn=document.querySelector('.theme-toggle'); if(btn) btn.click(); else { var d=document.documentElement; if(d.dataset.theme==='dark') delete d.dataset.theme; else d.dataset.theme='dark'; } }},
    {id:'toggle-compact', label:'Свернуть боковую панель', desc:'Компактный режим навигации', icon:'chevron-left', hotkey:'[', run:function(){ var b=document.querySelector('.ws-collapse'); if(b) b.click(); }},
    {id:'clear-kanban', label:'Сбросить канбан', desc:'Очистить локальный порядок колонок', icon:'close', run:function(){ try{ localStorage.removeItem('ws:kanban:order:v13'); }catch(e){} location.reload(); }},
    {id:'run-a11y', label:'Запустить a11y аудит', desc:'axe-core проверка страницы', icon:'search', hotkey:'Alt+Shift+A', run:function(){ var ev=new KeyboardEvent('keydown',{key:'a',altKey:true,shiftKey:true}); document.dispatchEvent(ev); }},
    {id:'copy-link', label:'Копировать ссылку', desc:'Скопировать URL страницы', icon:'document', run:function(){ navigator.clipboard && navigator.clipboard.writeText(location.href); }},
    {id:'scroll-top', label:'Наверх страницы', desc:'Плавная прокрутка', icon:'arrow-up', run:function(){ window.scrollTo({top:0, behavior:'smooth'}); }},
  ];
  function renderCommands(filter){
    var terms = filter.toLocaleLowerCase('ru-RU').trim().replace(/^>/,'').trim().split(/\s+/).filter(Boolean);
    var scored = CMD_ACTIONS.map(function(a){ var hay=(a.label+' '+a.desc).toLocaleLowerCase('ru-RU'); var score= terms.length? 0 : 1; terms.forEach(function(t){ if(hay.indexOf(t)!==-1) score+=1; else score=-1; }); return {a:a, score:score}; }).filter(function(x){ return x.score>=0; });
    searchResults.replaceChildren();
    if(!scored.length){ var empty=document.createElement('div'); empty.className='ws-empty'; empty.textContent='Команд не найдено — попробуйте: go-projects, toggle-theme, clear-kanban.'; searchResults.appendChild(empty); if(searchHint) searchHint.textContent='0 команд'; activeIndex=-1; return; }
    var cap=document.createElement('div'); cap.className='ws-search-group-caption'; cap.textContent='Команды'; searchResults.appendChild(cap);
    scored.forEach(function(entry){
      var act=entry.a;
      var link=document.createElement('a'); link.className='ws-search-result'; link.href='#'; link.setAttribute('role','option'); link.setAttribute('data-cmd', act.id);
      var ic=document.createElement('span'); ic.className='ws-search-result-ic'; ic.innerHTML=iconMarkup(act.icon);
      var body=document.createElement('span'); body.className='ws-search-result-body';
      var title=document.createElement('strong'); title.textContent=act.label;
      var meta=document.createElement('small'); meta.textContent=act.desc + (act.hotkey ? ' · ' + act.hotkey : '');
      body.append(title, meta);
      var pill=document.createElement('span'); pill.className='ws-search-result-meta'; pill.textContent= act.hotkey || '↵';
      link.append(ic, body, pill);
      link.addEventListener('click', function(e){ e.preventDefault(); var found=CMD_ACTIONS.find(function(x){ return x.id===act.id; }); if(found) { searchDialog.close && searchDialog.close(); found.run(); } });
      searchResults.appendChild(link);
    });
    if(searchHint) searchHint.textContent=scored.length+' команд';
    activeIndex=-1; setActive(0);
  }

  function renderSearch(query) {
    if (query.trim().startsWith('>')) { renderCommands(query); return; }
    if (!searchData) return;
    var terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) {
      // v16: show recent pages + quick actions when empty
      var recents = window.__wsRecentPages || [];
      var html = '<div class="ws-search-recent" aria-label="Недавние страницы">';
      if (recents.length > 1) {
        recents.slice(1,6).forEach(function(p){
          var label = p.replace(/^\//,'') || 'Главная';
          if (label.length > 28) label = label.slice(0,28)+'…';
          html += '<a href="'+ p.replace(/"/g,'&quot;') +'"><span>'+ label +'</span><small>↗</small></a>';
        });
        html += '</div>';
      } else { html=''; }
      searchResults.innerHTML = html + '<div class="ws-empty"><div class="ws-empty-icon" aria-hidden="true">' + iconMarkup('search') + '</div>Начните вводить запрос — проекты, статьи, заметки<br><small style="color:var(--ws-muted);margin-top:6px;display:block;">Попробуйте <kbd>></kbd> для команд · <kbd>↑</kbd><kbd>↓</kbd> навигация · <kbd>Esc</kbd> закрыть</small></div>';
      if (searchHint) searchHint.textContent = recents.length>1 ? (recents.length-1)+' недавних' : 'Введите запрос';
      activeIndex=-1; return; }
    var scored = searchData.map(function(item){ var title=normalize(item.title), category=normalize(item.category), content=normalize(item.content); var score=0; for(var _ti=0; _ti<terms.length; _ti++){ var term=terms[_ti]; if(title.indexOf(term)!==-1) score+= title.indexOf(term)===0?8:5; else if(category.indexOf(term)!==-1) score+=3; else if(content.indexOf(term)!==-1) score+=1; else return null; } return {item:item,score:score}; }).filter(Boolean).sort(function(a,b){ return b.score-a.score; }).slice(0,20);
    searchResults.replaceChildren();
    if(!scored.length){ var empty=document.createElement('div'); empty.className='ws-empty'; empty.innerHTML='<div class="ws-empty-icon" aria-hidden="true">' + iconMarkup('search') + '</div>Совпадений нет по запросу «' + escapeHtml(query.slice(0,48)) + '»<br><small style="color:var(--ws-muted);margin-top:6px;display:block;">Попробуйте другое сочетание.</small>'; searchResults.appendChild(empty); if(searchHint) searchHint.textContent='0 результатов'; activeIndex=-1; return; }
    if(searchHint) searchHint.textContent=scored.length+' результатов';
    var groups={}; scored.forEach(function(x){ var cat=(x.item.category||'Другое').toString().trim()||'Другое'; if(!groups[cat]) groups[cat]=[]; groups[cat].push(x); });
    Object.keys(groups).forEach(function(cat){ var cap=document.createElement('div'); cap.className='ws-search-group-caption'; cap.textContent=cat; searchResults.appendChild(cap); groups[cat].forEach(function(entry){ var item=entry.item; var link=document.createElement('a'); link.className='ws-search-result'; link.setAttribute('role','option'); link.href=item.url; var ic=document.createElement('span'); ic.className='ws-search-result-ic'; ic.setAttribute('aria-hidden','true'); var lk=(item.category||'').toString().toLocaleLowerCase('ru-RU'); var iconKey=lk.indexOf('проект')!==-1?'projects':lk.indexOf('стать')!==-1?'document':lk.indexOf('замет')!==-1?'notes':'search'; ic.innerHTML=iconMarkup(iconKey); var body=document.createElement('span'); body.className='ws-search-result-body'; var title=document.createElement('strong'); title.innerHTML=highlight(item.title||item.url, terms); var meta=document.createElement('small'); meta.innerHTML=highlight([item.category, item.description||item.content||''].filter(Boolean).join(' · ').slice(0,200), terms); body.append(title,meta); var pill=document.createElement('span'); pill.className='ws-search-result-meta'; pill.textContent=(item.category||'').slice(0,18); if(!(item.category||'').trim()) pill.style.display='none'; link.append(ic, body, pill); searchResults.appendChild(link); }); });
    activeIndex=-1; setActive(0);
  }
  searchButton.addEventListener('click', openSearch);
  searchInput.addEventListener('input', function(){ renderSearch(searchInput.value); });
  searchInput.addEventListener('keydown', function(e){ var els=Array.from(searchResults.querySelectorAll('.ws-search-result')); if(e.key==='ArrowDown'){ e.preventDefault(); setActive(activeIndex+1); } else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(activeIndex-1); } else if(e.key==='Enter'){ if(activeIndex>=0 && els[activeIndex]){ e.preventDefault(); var cmd=els[activeIndex].getAttribute('data-cmd'); if(cmd){ var act=CMD_ACTIONS.find(function(x){ return x.id===cmd; }); if(act) { searchDialog.close && searchDialog.close(); act.run(); } return; } var href=els[activeIndex].getAttribute('href'); if(href && href!=='#') window.location.href=href; else els[activeIndex].click(); } else if(els.length===1){ e.preventDefault(); var only=els[0]; var ocmd=only.getAttribute('data-cmd'); if(ocmd){ var a2=CMD_ACTIONS.find(function(x){ return x.id===ocmd; }); if(a2) { searchDialog.close && searchDialog.close(); a2.run(); } } else if(only.getAttribute('href') && only.getAttribute('href')!=='#') window.location.href=only.getAttribute('href'); else only.click(); } } });
  searchDialog.addEventListener('click', function(event){ if(event.target===searchDialog) searchDialog.close && searchDialog.close(); });
  searchDialog.addEventListener('close', function(){ if(searchHint) searchHint.textContent='Введите запрос'; });
  searchDialog.querySelector('form').addEventListener('submit', function(event){ event.preventDefault(); var els=Array.from(searchResults.querySelectorAll('.ws-search-result')); if(activeIndex>=0 && els[activeIndex]) window.location.href=els[activeIndex].getAttribute('href'); else if(els.length) window.location.href=els[0].getAttribute('href'); else if(searchDialog.close) searchDialog.close(); });
  document.addEventListener('keydown', function(e){ if((e.ctrlKey||e.metaKey) && e.key.toLocaleLowerCase()==='k'){ e.preventDefault(); openSearch(); } });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    else if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); openSearch(); }
  });



  /* ── v13: offline banner + shell state ── */
  (function initOffline(){
    var banner = document.createElement('div');
    banner.className = 'ws-offline-banner';
    banner.setAttribute('role','status');
    banner.setAttribute('aria-live','polite');
    banner.innerHTML = '<span aria-hidden="true">◉</span> Нет соединения — показываем сохранённую версию. <button type="button">Обновить</button>';
    var btn = banner.querySelector('button');
    btn.addEventListener('click', function(){ location.reload(); });
    var shell = document.querySelector('.ws-shell') || document.body;
    // insert as first child of body for sticky
    if (document.body.firstChild) document.body.insertBefore(banner, document.body.firstChild);
    else document.body.appendChild(banner);
    function sync(){
      var online = navigator.onLine;
      banner.classList.toggle('is-visible', !online);
      document.documentElement.classList.toggle('is-offline', !online);
      if (shell) shell.classList.toggle('is-offline', !online);
      try { localStorage.setItem('ws:offline:last', JSON.stringify({online: online, at: new Date().toISOString()})); } catch(e){}
    }
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  })();

  /* ── Aceternity 3D tilt: mouse tracking + glare ── */
  (function initTilt(){
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
    var SELECTOR = '.ws-course-card, .ws-project-card[data-status], .ws-panel, #stack .ws-skill-card';
    var cards = document.querySelectorAll(SELECTOR);
    if (!cards.length) {
      // retry after decorate injects some cards
      document.addEventListener('DOMContentLoaded', function(){
        cards = document.querySelectorAll(SELECTOR);
        bind(cards);
      });
    } else bind(cards);
    function bind(list){
      list.forEach(function(card){
        if (card.hasAttribute('data-tilt')) return;
        card.setAttribute('data-tilt','');
        if (!card.querySelector('.ws-tilt-glare')) {
          var glare = document.createElement('span');
          glare.className = 'ws-tilt-glare';
          glare.setAttribute('aria-hidden','true');
          card.appendChild(glare);
        }
        card.style.transformStyle = 'preserve-3d';
        card.addEventListener('mousemove', onMove);
        card.addEventListener('mouseleave', onLeave);
        card.addEventListener('mouseenter', function(){ card.style.transition = 'transform 120ms ease'; });
      });
    }
    function onMove(e){
      var card = e.currentTarget;
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var px = (x / rect.width) - 0.5;
      var py = (y / rect.height) - 0.5;
      var rotY = px * 7;
      var rotX = -py * 7;
      card.style.setProperty('--mx', (x/rect.width*100).toFixed(1)+'%');
      card.style.setProperty('--my', (y/rect.height*100).toFixed(1)+'%');
      card.style.transform = 'perspective(900px) rotateX('+rotX.toFixed(2)+'deg) rotateY('+rotY.toFixed(2)+'deg) translateZ(0)';
    }
    function onLeave(e){
      var card = e.currentTarget;
      card.style.transform = '';
      card.style.transition = 'transform 420ms cubic-bezier(.2,.8,.2,1)';
    }
    // Observe dynamically added cards (e.g. activity kanban)
    if (window.MutationObserver) {
      var obs = new MutationObserver(function(muts){
        muts.forEach(function(m){
          m.addedNodes && Array.prototype.forEach.call(m.addedNodes, function(n){
            if (n.nodeType!==1) return;
            if (n.matches && n.matches(SELECTOR)) bind([n]);
            var inner = n.querySelectorAll ? n.querySelectorAll(SELECTOR) : [];
            if (inner.length) bind(inner);
          });
        });
      });
      obs.observe(document.body, {childList:true, subtree:true});
    }
  })();



  /* ── v15: reading progress + scroll-spy polish + copy pre + lightbox ── */
  (function initReading(){
    var bar = document.querySelector('.ws-read-progress');
    if (!bar) { bar = document.createElement('div'); bar.className='ws-read-progress'; bar.setAttribute('aria-hidden','true'); document.body.prepend(bar); }
    var ticking=false;
    function upd(){
      ticking=false;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      document.documentElement.style.setProperty('--read-progress', p.toFixed(4));
      // to-top visibility
      var topBtn = document.getElementById('to-top');
      if (topBtn) topBtn.classList.toggle('is-visible', window.scrollY > 320); topBtn.classList.toggle('show', window.scrollY > 320, window.scrollY > 320);
      // scroll-spy fallback (if no IntersectionObserver for sections)
      if (!('IntersectionObserver' in window)) {
        var sections = document.querySelectorAll('.ws-section[id], section[id], h2[id], h3[id]');
        var cur=null, minD=Infinity;
        sections.forEach(function(s){ var d=Math.abs(s.getBoundingClientRect().top - 80); if(d < minD){ minD=d; cur=s; } });
        if (cur && cur.id) {
          document.querySelectorAll('.ws-section-nav a').forEach(function(a){ a.classList.toggle('is-active', a.getAttribute('href')==='#'+cur.id); });
        }
      }
    }
    window.addEventListener('scroll', function(){ if(!ticking){ ticking=true; requestAnimationFrame(upd); } }, {passive:true});
    upd();
  })();
  (function initCopyPre(){
    document.querySelectorAll('.ws-content pre').forEach(function(pre){
      if (pre.querySelector('.ws-copy-btn')) return;
      pre.style.position='relative';
      var btn=document.createElement('button'); btn.type='button'; btn.className='ws-copy-btn'; btn.textContent='Копировать';
      btn.addEventListener('click', function(){
        var code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function(){
          btn.textContent='Скопировано ✓'; btn.classList.add('is-copied'); setTimeout(function(){ btn.textContent='Копировать'; btn.classList.remove('is-copied'); }, 1600);
        }).catch(function(){
          var r=document.createRange(); r.selectNodeContents(pre); var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy'); sel.removeAllRanges();
          btn.textContent='Скопировано ✓'; setTimeout(function(){ btn.textContent='Копировать'; }, 1600);
        });
      });
      pre.appendChild(btn);
    });
  })();
  (function initLightbox(){
    var imgs = document.querySelectorAll('.ws-content img:not([data-no-lightbox])');
    if (!imgs.length) return;
    var dlg=document.createElement('dialog'); dlg.className='ws-lightbox'; dlg.innerHTML='<img alt=""><div class="ws-lightbox-caption"></div>';
    var dlgImg=dlg.querySelector('img'), cap=dlg.querySelector('.ws-lightbox-caption');
    document.body.appendChild(dlg);
    imgs.forEach(function(img){
      img.style.cursor='zoom-in';
      img.addEventListener('click', function(){
        dlgImg.src=img.src; dlgImg.alt=img.alt||''; cap.textContent=img.alt||img.title||''; cap.style.display= cap.textContent ? '' : 'none';
        if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open','');
      });
    });
    dlg.addEventListener('click', function(e){ if(e.target===dlg) dlg.close && dlg.close(); });
  })();


  /* ── v16: recent pages (localStorage) for cmdk ── */
  (function initRecent(){
    try {
      var KEY='ws:recent:v16';
      var cur = location.pathname;
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(list)) list=[];
      // dedupe current, push front, cap 12
      list = [cur].concat(list.filter(function(p){ return p!==cur; })).slice(0,12);
      localStorage.setItem(KEY, JSON.stringify(list));
      window.__wsRecentPages = list;
    } catch(e){ window.__wsRecentPages=[]; }
  })();

  /* ── v16: view-transition navigation (progressive) ── */
  (function initViewTransition(){
    if (!('startViewTransition' in document)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      try {
        var u = new URL(a.href, location.origin);
        if (u.origin !== location.origin) return;
        if (u.pathname === location.pathname && u.hash) return; // anchor
        if (a.target === '_blank' || a.hasAttribute('download')) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        document.startViewTransition(function(){
          location.href = u.pathname + u.search + u.hash;
        });
      } catch(e){}
    });
  })();

  /* ── v13: prefetch as <link rel="prefetch"> (auditable) ── */
  (function initPrefetch(){
    var seen = new Set();
    function prefetch(href){
      if (!href || seen.has(href)) return;
      try {
        var u = new URL(href, location.origin);
        if (u.origin !== location.origin) return;
        if (!/\.html$/.test(u.pathname) && u.pathname !== '/' && !u.pathname.endsWith('/')) return;
        seen.add(href);
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = u.pathname + u.search;
        link.as = 'document';
        document.head.appendChild(link);
        fetch(u.pathname, {method:'GET', credentials:'same-origin'}).catch(()=>{});
        // mark for visual debug
        document.querySelectorAll('a[href="'+ u.pathname.replace(/"/g, '\\"') +'"]').forEach(function(a){ a.setAttribute('data-prefetched','true'); });
      } catch(e){}
    }
    document.addEventListener('mouseover', function(e){
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && a.href) prefetch(a.getAttribute('href'));
    }, {passive:true});
    document.addEventListener('focusin', function(e){
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && a.href) prefetch(a.getAttribute('href'));
    });
  })();

  function decorate(scope) {
    const all = selector => [
      ...(scope.matches && scope.matches(selector) ? [scope] : []),
      ...scope.querySelectorAll(selector)
    ];
    const components = ['.card', '.p-card', '.pub-card', '.note-card', '.lab-panel', '.st-panel', '.op-panel', '.office-panel', '.admin-card', '.bento-cell', '.zone', '.project-card', '.sign-card', '.step-card', '.esp-section', '.accordion', '.wiki-group', '.quest-card', '.sla-stat', '.ticket-card', '.notice'];
    all('#profile-gate').forEach(el => el.setAttribute('data-ws-profile-gate', 'true'));
    all('#profile-form').forEach(el => el.setAttribute('data-ws-profile-form', 'true'));
    all('.flat-field').forEach(el => el.setAttribute('data-ws-field', el.querySelector('#mascot-picker-host') ? 'mascot' : 'true'));
    all('#mascot-picker-host').forEach(el => el.setAttribute('data-ws-mascot-host', 'true'));
    all('.mascot-pick').forEach(el => el.setAttribute('data-ws-mascot-picker', 'true'));
    all('.flat-caption').forEach(el => el.setAttribute('data-ws-caption', 'true'));
    all('#profile-form button[type="submit"]').forEach(el => { el.setAttribute('data-ws-profile-submit', 'true'); el.setAttribute('data-ws-action', 'primary'); });
    all('#cab-dashboard').forEach(el => el.setAttribute('data-ws-dashboard', 'true'));
    all('.cab-grid').forEach(el => el.setAttribute('data-ws-dashboard-grid', 'true'));
    all('.cab-grid > aside').forEach(el => el.setAttribute('data-ws-profile-summary', 'true'));
    all('.cab-grid > section').forEach(el => el.setAttribute('data-ws-quest-panel', 'true'));
    all('#profile-change').forEach(el => el.setAttribute('data-ws-profile-edit', 'true'));
    all('#cab-id-card').forEach(el => el.setAttribute('data-ws-id-card', 'true'));
    all('.id-card-top').forEach(el => el.setAttribute('data-ws-id-header', 'true'));
    all('.id-stats > .id-collapse').forEach(el => el.setAttribute('data-ws-stat-list', 'true'));
    all('.id-stat').forEach(el => el.setAttribute('data-ws-id-stat', 'true'));
    all('.id-level').forEach(el => el.setAttribute('data-ws-id-level', 'true'));
    all('.id-level > .id-collapse').forEach(el => el.setAttribute('data-ws-id-level-content', 'true'));
    all('.id-level .flat-row').forEach(el => el.setAttribute('data-ws-profile-actions', 'true'));
    all('.roadmap-overview').forEach(el => el.setAttribute('data-ws-roadmap-overview', 'true'));
    all('.roadmap-meter').forEach(el => el.setAttribute('data-ws-roadmap-meter', 'true'));
    all('.quest-card').forEach(el => el.setAttribute('data-ws-quest-card', 'true'));
    all('.quest-glyph').forEach(el => el.setAttribute('data-ws-quest-icon', 'true'));
    all('.quest-side').forEach(el => el.setAttribute('data-ws-quest-meta', 'true'));
    all('.greet-card').forEach(el => el.setAttribute('data-ws-greeting', 'true'));
    all('.greet-mascot').forEach(el => el.setAttribute('data-ws-greeting-icon', 'true'));
    all('.greet-body').forEach(el => el.setAttribute('data-ws-greeting-body', 'true'));
    all('.greet-actions').forEach(el => el.setAttribute('data-ws-greeting-actions', 'true'));
    all(components.join(',')).forEach(el => el.setAttribute('data-ws-surface', 'true'));
    all('.st-hero, .uni-hero').forEach(el => el.setAttribute('data-ws-hero', 'true'));
    all('.st-hero-index').forEach(el => el.setAttribute('data-ws-index', 'true'));
    all('.flat-profile').forEach(el => el.setAttribute('data-ws-profile', 'true'));
    all('.fp-spacer').forEach(el => el.setAttribute('data-ws-spacer', 'true'));
    all('.zone-head, .st-section-head').forEach(el => el.setAttribute('data-ws-section-head', 'true'));
    all('.bento-grid, .glossary-grid').forEach(el => el.setAttribute('data-ws-grid', 'true'));
    all('.grid').forEach(el => {
      const classes = String(el.className || '');
      const tokens = classes.split(/\s+/);
      const baseClass = tokens.find(token => token.startsWith('grid-cols-'));
      const dimensions = { base: baseClass ? baseClass.slice('grid-cols-'.length) : '1' };
      for (const breakpoint of ['sm', 'md', 'lg']) {
        const responsiveClass = tokens.find(token => token.startsWith(breakpoint + ':grid-cols-'));
        if (responsiveClass) dimensions[breakpoint] = responsiveClass.slice((breakpoint + ':grid-cols-').length);
      }
      el.setAttribute('data-ws-grid', 'utility');
      el.style.setProperty('--ws-grid-base', dimensions.base);
      for (const breakpoint of ['sm', 'md', 'lg']) if (dimensions[breakpoint]) {
        el.setAttribute('data-ws-grid-' + breakpoint, dimensions[breakpoint]);
        el.style.setProperty('--ws-grid-' + breakpoint, dimensions[breakpoint]);
      }
    });
    all('.flex').forEach(el => {
      const classes = String(el.className || '');
      el.setAttribute('data-ws-flex', 'true');
      if (/\bflex-col\b/.test(classes)) el.setAttribute('data-ws-direction', 'column');
      else if (/\bflex-row\b/.test(classes)) el.setAttribute('data-ws-direction', 'row');
      if (/\bflex-nowrap\b/.test(classes)) el.setAttribute('data-ws-wrap', 'nowrap');
      else if (/\bflex-wrap\b/.test(classes)) el.setAttribute('data-ws-wrap', 'wrap');
      if (/\bjustify-between\b/.test(classes)) el.setAttribute('data-ws-justify', 'between');
      else if (/\bjustify-center\b/.test(classes)) el.setAttribute('data-ws-justify', 'center');
      else if (/\bjustify-end\b/.test(classes)) el.setAttribute('data-ws-justify', 'end');
      if (/\bitems-start\b/.test(classes)) el.setAttribute('data-ws-align', 'start');
      else if (/\bitems-center\b/.test(classes)) el.setAttribute('data-ws-align', 'center');
      else if (/\bitems-end\b/.test(classes)) el.setAttribute('data-ws-align', 'end');
      else if (/\bitems-baseline\b/.test(classes)) el.setAttribute('data-ws-align', 'baseline');
    });
    all('.flex-1').forEach(el => el.setAttribute('data-ws-grow', 'true'));
    all('.min-w-0').forEach(el => el.setAttribute('data-ws-min-width', 'true'));
    all('.shrink-0').forEach(el => el.setAttribute('data-ws-no-shrink', 'true'));
    all('[data-ws-chart-fill]').forEach(el => {
      const value = Number(el.dataset.wsChartFill);
      if (Number.isFinite(value)) el.style.setProperty('--ws-chart-fill', String(Math.min(100, Math.max(0, value))));
    });
    all('.notice-label').forEach(el => el.setAttribute('data-ws-notice-label', 'true'));
    all('.notice, .callout').forEach(el => {
      el.dataset.wsCallout = 'true';
      const classes = typeof el.className === 'string' ? el.className : '';
      if (/notice-info|callout-info/.test(classes)) el.dataset.wsTone = 'info';
      else if (/notice-warn|callout-warn/.test(classes)) el.dataset.wsTone = 'warm';
      else if (/notice-error|callout-error/.test(classes)) el.dataset.wsTone = 'danger';
    });
    all('.mat-row').forEach(el => el.setAttribute('data-ws-row', 'true'));
    all('.mat-dot').forEach(el => el.setAttribute('data-ws-dot', 'true'));
    all('.wiki-links .mono').forEach(el => el.setAttribute('data-ws-index', 'true'));
    all('.wiki-layout').forEach(el => el.setAttribute('data-ws-layout', 'wiki'));
    all('.wiki-nav').forEach(el => el.setAttribute('data-ws-wiki-nav', 'true'));
    all('.wiki-links').forEach(el => el.setAttribute('data-ws-wiki-links', 'true'));
    all('.article-meta').forEach(el => el.setAttribute('data-ws-meta', 'true'));
    all('.flat-row, .step-card').forEach(el => el.setAttribute('data-ws-row', 'true'));
    all('.lab-progress, .xp-bar, .lg-bar, .quest-progress').forEach(el => el.setAttribute('data-ws-progress', 'true'));
    all('.lp-head').forEach(el => el.setAttribute('data-ws-panel-head', 'true'));
    all('.lp-body').forEach(el => el.setAttribute('data-ws-panel-body', 'true'));
    all('.lab-layout, .ops-board, .flat-grid--cards, .lab-steps').forEach(el => el.setAttribute('data-ws-grid', 'cards'));
    all('.cmd-duo, .plus-minus, .rca-fields').forEach(el => el.setAttribute('data-ws-grid', 'two'));
    all('.task-list, .lab-checks, .st-goals, .ops-legend-list').forEach(el => el.setAttribute('data-ws-stack', 'true'));
    all('.task-item, .cmd-row, .ticket-card, .ticket').forEach(el => el.setAttribute('data-ws-row', 'true'));
    all('.q-item').forEach(el => el.setAttribute('data-ws-surface', 'true'));
    all('.q-opts').forEach(el => el.setAttribute('data-ws-options', 'true'));
    all('.q-opt').forEach(el => el.setAttribute('data-ws-option', 'true'));
    all('.mc-speech').forEach(el => el.setAttribute('data-ws-message', 'true'));
    all('.mc-bubble').forEach(el => el.setAttribute('data-ws-bubble', 'true'));
    all('.task-body').forEach(el => el.setAttribute('data-ws-task-body', 'true'));
    all('.task-hint').forEach(el => el.setAttribute('data-ws-task-hint', 'true'));
    all('.task-title').forEach(el => el.setAttribute('data-ws-task-title', 'true'));
    all('.xp-meta').forEach(el => el.setAttribute('data-ws-progress-label', 'true'));
    all('.is-active').forEach(el => el.setAttribute('data-ws-active', 'true'));
    all('.task-item.is-done, .q-opt.is-ok').forEach(el => el.setAttribute('data-ws-state', 'complete'));
    all('.q-opt.is-bad').forEach(el => el.setAttribute('data-ws-state', 'error'));
    all('.is-disabled').forEach(el => el.setAttribute('data-ws-state', 'locked'));
    all('.theory-block, .reflect-item, .cmd-col, .rca-fields > div').forEach(el => el.setAttribute('data-ws-inset', 'true'));
    all('.lab-terminal, .lab-editor, .term-screen, .lt-screen').forEach(el => el.setAttribute('data-ws-console', 'true'));
    all('.st-modal, .st-modal-box').forEach(el => el.setAttribute('data-ws-modal', 'true'));
    all('.st-details, details').forEach(el => el.setAttribute('data-ws-disclosure', 'true'));
    all('.lk-progress-strip, .ops-statusbar').forEach(el => el.setAttribute('data-ws-progress-strip', 'true'));
    all('table').forEach(el => el.setAttribute('data-ws-table', 'true'));
    all('[role="tablist"]').forEach(el => el.setAttribute('data-ws-tabs', 'true'));
    all('button').forEach(el => {
      el.setAttribute('data-ws-control', 'true');
      if (/\b(btn|flat-btn|primary)\b/.test(el.className)) el.setAttribute('data-ws-action', /\b(btn-primary|btn-main|primary)\b/.test(el.className) ? 'primary' : 'secondary');
    });
    all('a').forEach(el => { if (/\b(btn|flat-btn|quick-bubble|ws-button)\b/.test(el.className)) el.setAttribute('data-ws-action', /\b(btn-primary|btn-main|primary)\b/.test(el.className) ? 'primary' : 'secondary'); });
    all('.pill, .chip, .badge, .p-tag, .kind-badge, .flat-badge, .p-status, .sev, .tag-hash, .ws-tag, .gl-term-tag').forEach(el => {
      const classes = typeof el.className === 'string' ? el.className : '';
      el.setAttribute('data-ws-tag', 'true');
      if (/pill-blue|ws-tag-blue/.test(classes)) el.dataset.wsTone = 'info';
      else if (/pill-amber|pill-orange|ws-tag-orange|tag-verm|tag-orange|tag-pink/.test(classes)) el.dataset.wsTone = 'warm';
      else if (/pill-red|tag-red/.test(classes)) el.dataset.wsTone = 'danger';
      else if (/pill-neutral|p-status-neutral|p-status-archive/.test(classes)) el.dataset.wsTone = 'neutral';
      else if (/ws-tag-green|gl-term-new|pill-green|tag-green/.test(classes)) el.dataset.wsTone = 'success';
      else if (/ws-tag-purple|tag-purple/.test(classes)) el.dataset.wsTone = 'accent';
      else if (/gl-term-tag/.test(classes)) el.dataset.wsTone = 'neutral';
      if (/p-status-ready|is-complete|is-done|status-ok|ws-tag-green|gl-term-new/.test(classes)) el.setAttribute('data-ws-state', 'complete');
      else if (/p-status-soon|is-locked|status-wait/.test(classes)) el.setAttribute('data-ws-state', 'locked');
      else if (/is-active|p-status-new/.test(classes)) el.setAttribute('data-ws-state', 'active');
    });
  }
  decorate(root);
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) decorate(node); })));
  observer.observe(root, { childList: true, subtree: true });
})();

// PWA registration — offline stands (v8)
if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}
