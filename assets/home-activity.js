/* Public repository activity + live feed dashboard. Zero deps, 2026. */
(function () {
  'use strict';
  const root = document.querySelector('[data-ws-activity]');
  if (!root) return;

  const countNode = root.querySelector('[data-ws-activity-count]');
  const dateNode = root.querySelector('[data-ws-activity-date]');
  const shaNode = root.querySelector('[data-ws-activity-sha]');
  const commitLink = root.querySelector('[data-ws-activity-commit]');
  const statusNode = root.querySelector('[data-ws-activity-status]');
  const chartGrid = root.querySelector('[data-ws-activity-chart-grid]');
  const chartTotal = root.querySelector('[data-ws-activity-chart-total]');
  const tickerTrack = root.querySelector('[data-ws-activity-ticker-track]');
  const timeline = root.querySelector('[data-ws-activity-timeline]');
  const filterButtons = root.querySelectorAll('[data-ws-activity-filter]');
  const filterEmpty = document.createElement('p');
  filterEmpty.className = 'ws-activity-filter-empty';
  filterEmpty.hidden = true;
  filterEmpty.setAttribute('role', 'status');
  if (timeline) timeline.after(filterEmpty);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  // ── v13: scroll-reveal for course/skill/resource cards ──
  (function initReveal(){
    var els = document.querySelectorAll('.ws-course-card, #stack .ws-skill-card, .ws-resource-grid a, .ws-contact-grid a, [data-ws-activity-card], [data-ws-activity-feed]');
    if (!els.length || !('IntersectionObserver' in window)) return;
    els.forEach(function(el,i){ el.classList.add('ws-reveal'); el.style.setProperty('--reveal-index', String(i % 6)); });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, {threshold: 0.12, rootMargin: '0px 0px -40px 0px'});
    els.forEach(function(el){ io.observe(el); });
  })();

  const historyUrl = 'https://github.com/ItsLiventsev/itsliventsev.github.io/commits/main';
  // v16: skeleton helpers
  function setSkeleton(on){
    var card = root.querySelector('[data-ws-activity-card]');
    if (!card) return;
    card.classList.toggle('is-loading', !!on);
    if (on) { if (countNode) countNode.classList.add('ws-skeleton','ws-skeleton--text'); if (dateNode) dateNode.classList.add('ws-skeleton','ws-skeleton--text'); if (chartGrid) chartGrid.classList.add('ws-skeleton'); }
    else { [countNode,dateNode,chartGrid].forEach(function(el){ if(el) el.classList.remove('ws-skeleton','ws-skeleton--text','ws-skeleton--heading','ws-skeleton--card'); }); }
  }

  const apiUrl = 'https://api.github.com/repos/ItsLiventsev/itsliventsev.github.io/commits';
  const cacheKey = 'itsliventsev-home-activity-v2';
  const freshForMs = 15 * 60 * 1000;
  const staleForMs = 24 * 60 * 60 * 1000;
  const windowMs = 30 * 24 * 60 * 60 * 1000;

  const labels = {
    ru: {
      loading: 'Сверяю открытую историю GitHub…',
      cached: 'Показываю сохранённый снимок GitHub; обновлю его при следующем запросе.',
      ready: 'Данные получены из основной ветки GitHub.',
      error: 'Сводка временно недоступна; полная история открывается по ссылке.',
      empty: 'За последние 30 дней коммитов нет.',
      stale: 'Запрос не прошёл; показываю сохранённый снимок GitHub.',
      count: n => n >= 100 ? 'Не менее 100 коммитов за 30 дней' : `${n} коммитов за 30 дней`,
      statuses: { done: '✅ Готово', progress: '🔄 В процессе', review: '⏳ На проверке' },
      feedTitle: {
        'ui-refresh': { ru: 'Мягкий редизайн главной', en: 'Soft redesign of the home' },
        'feed-ticker': { ru: 'Бегущая строка хештегов готова', en: 'Hashtag ticker ready' },
        'nav-indicator': { ru: 'Индикатор навигации следует за курсором', en: 'Nav indicator follows cursor' },
        'chart': { ru: 'Спарклайн коммитов подключён к GitHub API', en: 'Commit sparkline connected to GitHub API' },
        'bento': { ru: 'Bento-сетка выровнена к 16px радиусу', en: 'Bento grid aligned to 16px radius' },
        'a11y': { ru: 'Проверена доступность клавиатуры и контраст', en: 'Keyboard a11y and contrast checked' },
        'perf': { ru: 'Оптимизированы тени и анимации', en: 'Shadows and animations optimized' },
        'content': { ru: 'Обновлены формулировки СетьПолис', en: 'SetPolis copy updated' },
        'timeline': { ru: 'Timeline получил живой статус-точки', en: 'Timeline got live status dots' },
        'docs': { ru: 'AGENT_PLAN описан для оркестрации', en: 'AGENT_PLAN described for orchestration' }
      }
    },
    en: {
      loading: 'Checking the public GitHub history…',
      cached: 'Showing a saved GitHub snapshot; it will refresh on the next request.',
      ready: 'Data received from the main GitHub branch.',
      error: 'The summary is temporarily unavailable; the full history is linked here.',
      empty: 'No commits in the last 30 days.',
      stale: 'The request failed; showing the saved GitHub snapshot.',
      count: n => n >= 100 ? 'At least 100 commits in 30 days' : `${n} commits in 30 days`,
      statuses: { done: '✅ Done', progress: '🔄 In progress', review: '⏳ Review' },
      feedTitle: {
        'ui-refresh': { ru: 'Мягкий редизайн главной', en: 'Soft redesign of the home' },
        'feed-ticker': { ru: 'Бегущая строка хештегов готова', en: 'Hashtag ticker ready' },
        'nav-indicator': { ru: 'Индикатор навигации следует за курсором', en: 'Nav indicator follows cursor' },
        'chart': { ru: 'Спарклайн коммитов подключён к GitHub API', en: 'Commit sparkline connected to GitHub API' },
        'bento': { ru: 'Bento-сетка выровнена к 16px радиусу', en: 'Bento grid aligned to 16px radius' },
        'a11y': { ru: 'Проверена доступность клавиатуры и контраст', en: 'Keyboard a11y and contrast checked' },
        'perf': { ru: 'Оптимизированы тени и анимации', en: 'Shadows and animations optimized' },
        'content': { ru: 'Обновлены формулировки СетьПолис', en: 'SetPolis copy updated' },
        'timeline': { ru: 'Timeline получил живой статус-точки', en: 'Timeline got live status dots' },
        'docs': { ru: 'AGENT_PLAN описан для оркестрации', en: 'AGENT_PLAN described for orchestration' }
      }
    }
  };

  const language = () => window.I18N && window.I18N.lang && window.I18N.lang() === 'en' ? 'en' : 'ru';
  const words = () => labels[language()];
  let currentData = null;
  let currentState = 'loading';
  let activeFilter = 'all';
  setSkeleton(true);

  function statusLabel(kind) {
    const s = words().statuses;
    return s[kind] || s.done;
  }
  function titleOf(entry) {
    const dict = words().feedTitle[entry.id];
    if (!dict) return entry.title || entry.id;
    return language()==='en' ? dict.en : dict.ru;
  }
  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const locale = language() === 'en' ? 'en' : 'ru-RU';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  function setState(state) {
    currentState = state;
    root.dataset.wsActivityState = state;
    root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    const card = root.querySelector('[data-ws-activity-card]');
    if (card) { card.dataset.wsActivityState = state; card.setAttribute('aria-busy', String(state === 'loading')); }
    setSkeleton(state === 'loading');
    if (statusNode) statusNode.textContent = words()[state] || words().error;
  }
  function render(data, state) {
    currentData = data;
    const value = data.count >= 100 ? '100+' : String(data.count);
    if (countNode) {
      if (data.count >= 100) countNode.textContent = value;
      else if(window.__wsAnimateNumber) window.__wsAnimateNumber(countNode, data.count); else countNode.textContent = value;
      countNode.setAttribute('aria-label', words().count(data.count));
    }
    const latest = data.latest;
    if (dateNode) {
      dateNode.textContent = latest ? formatDate(latest.date) : '—';
      if (latest) dateNode.dateTime = latest.date;
      else dateNode.removeAttribute('datetime');
    }
    if (shaNode) shaNode.textContent = latest ? latest.sha.slice(0,7) : '—';
    if (commitLink) commitLink.href = latest ? `https://github.com/ItsLiventsev/itsliventsev.github.io/commit/${latest.sha}` : historyUrl;
    setState(state || (data.count ? 'ready' : 'empty'));
    // The chart describes 14 days; its total is computed in renderChart.
  }

  // — chart: 14-day sparkline (Recharts-like bars)
  let commitsCache = [];
  function renderChart(commits) {
    if (!chartGrid) return;
    const days = 14;
    const buckets = Array(days).fill(0);
    const now = Date.now();
    const dayMs = 24*60*60*1000;
    commits.forEach(c => {
      const d = new Date(c.date).getTime();
      const diff = Math.floor((now - d)/dayMs);
      if (diff >=0 && diff < days) buckets[days-1 - diff] += 1;
    });
    const series = buckets;
    const max = Math.max(...series, 1);
    chartGrid.innerHTML = '';
    if (!commits.length && (currentState === 'loading' || currentState === 'error')) {
      if (chartTotal) chartTotal.textContent = '—';
      return;
    }
    const total = series.reduce((sum, count) => sum + count, 0);
    if (chartTotal) chartTotal.textContent = (currentState === 'loading' || currentState === 'error') ? '—' : `${total} ${language() === 'en' ? 'commits' : 'коммитов'}`;
    series.forEach((v, i) => {
      const bar = document.createElement('div');
      bar.setAttribute('data-ws-activity-bar','true');
      if (i===days-1) bar.setAttribute('data-today','true');
      const h = Math.max(8, Math.round((v/max)*100));
      bar.style.height = h + '%';
      bar.style.minHeight = '8px';
      bar.title = `${v} ${language()==='en' ? 'commits' : 'коммитов'}`;
      bar.setAttribute('aria-hidden', 'true');
      bar.setAttribute('data-tip', bar.title); chartGrid.appendChild(bar);
    });
    // Animate in staggered if not reduced
    if (!reduceMotion) {
      [...chartGrid.children].forEach((el, idx) => {
        el.style.opacity='0';
        el.style.transform='scaleY(.5)';
        el.style.transformOrigin='bottom';
        setTimeout(()=>{ el.style.transition='transform 500ms cubic-bezier(.2,.8,.2,1), opacity 400ms'; el.style.opacity='1'; el.style.transform='scaleY(1)'; }, idx*40);
      });
    }
  }


  // Kanban view toggle + renderer (autonomous polish v8)
  const kanbanRoot = root.querySelector('[data-ws-activity-kanban]');
  const viewButtons = root.querySelectorAll('[data-ws-view]');
  const kanbanLists = {
    review: root.querySelector('[data-kanban-list="review"]'),
    progress: root.querySelector('[data-kanban-list="progress"]'),
    done: root.querySelector('[data-kanban-list="done"]')
  };

  const kanbanCounts = {
    review: root.querySelector('[data-kanban-count="review"]'),
    progress: root.querySelector('[data-kanban-count="progress"]'),
    done: root.querySelector('[data-kanban-count="done"]')
  };

  // ── v13: Kanban drag-n-drop (native HTML5, no deps, persists to localStorage) ──
  (function initKanbanDnD(){
    if (!kanbanRoot || !kanbanLists.review) return;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var STORAGE_KEY = 'ws:kanban:order:v13';
    function persist(){
      try {
        var payload = {};
        Object.keys(kanbanLists).forEach(function(k){
          var list = kanbanLists[k];
          if (!list) return;
          payload[k] = Array.from(list.querySelectorAll('[data-kanban-card]')).map(function(card){ return card.getAttribute('data-kanban-id') || card.textContent.trim().slice(0,64); });
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({at: new Date().toISOString(), payload: payload}));
      } catch(e){}
    }
    function makeDraggable(card){
      if (!card || card.getAttribute('draggable') === 'true') return;
      card.setAttribute('draggable','true');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-grabbed','false');
      card.setAttribute('data-kanban-card','true');
      if (!card.getAttribute('data-kanban-id')) card.setAttribute('data-kanban-id', 'k-'+Math.random().toString(36).slice(2,8));
      var controls = document.createElement('div');
      controls.className = 'ws-kanban-move';
      ['left', 'right'].forEach(function(direction){
        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.kanbanMove = direction;
        button.textContent = direction === 'left' ? '←' : '→';
        button.addEventListener('click', function(){
          moveCard(card, direction === 'left' ? -1 : 1);
          var fallback = controls.querySelector('[data-kanban-move="' + (direction === 'left' ? 'right' : 'left') + '"]');
          (button.disabled && fallback ? fallback : button).focus();
        });
        controls.appendChild(button);
      });
      card.appendChild(controls);
      updateMoveControls();
      card.addEventListener('dragstart', function(e){
        card.classList.add('is-dragging');
        card.setAttribute('aria-grabbed','true');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-kanban-id'));
        setTimeout(function(){ card.style.opacity='.6'; }, 0);
      });
      card.addEventListener('dragend', function(){
        card.classList.remove('is-dragging');
        card.setAttribute('aria-grabbed','false');
        card.style.opacity='';
        document.querySelectorAll('.ws-kanban-col').forEach(function(c){ c.classList.remove('is-drop-target'); });
        persist();
      });
      // Keyboard: Ctrl+Arrow moves the focused card between columns.
      card.addEventListener('keydown', function(e){
        if (e.target !== card || !(e.ctrlKey && (e.key==='ArrowRight' || e.key==='ArrowLeft' || e.key==='ArrowUp' || e.key==='ArrowDown'))) return;
        e.preventDefault();
        moveCard(card, (e.key==='ArrowRight' || e.key==='ArrowDown') ? 1 : -1);
        card.focus();
      });
    }
    function moveCard(card, direction){
      var cols = ['review', 'progress', 'done'];
      var current = cols.findIndex(function(key){ return kanbanLists[key] && kanbanLists[key].contains(card); });
      var next = current + direction;
      if (current < 0 || next < 0 || next >= cols.length || !kanbanLists[cols[next]]) return;
      kanbanLists[cols[next]].appendChild(card);
      updateCounts();
      updateMoveControls();
      persist();
    }
    function updateMoveControls(){
      var cols = ['review', 'progress', 'done'];
      var labels = language() === 'en' ? ['Favorites', 'Review', 'Changes'] : ['Избранное', 'Изучить', 'Изменения'];
      cols.forEach(function(key, index){
        if (!kanbanLists[key]) return;
        kanbanLists[key].querySelectorAll('[data-kanban-card]').forEach(function(card){
          ['left', 'right'].forEach(function(direction){
            var button = card.querySelector('[data-kanban-move="'+direction+'"]');
            if (!button) return;
            var target = index + (direction === 'left' ? -1 : 1);
            button.disabled = target < 0 || target >= cols.length;
            var title = labels[target] || labels[index];
            button.setAttribute('aria-label', (language() === 'en' ? 'Move to ' : 'Переместить в «') + title + (language() === 'en' ? '' : '»'));
          });
        });
      });
    }

    function updateCounts(){
      Object.keys(kanbanLists).forEach(function(k){
        var list = kanbanLists[k]; var cnt = kanbanCounts[k];
        if (!list || !cnt) return;
        cnt.textContent = String(list.querySelectorAll('[data-kanban-card]').length);
      });
    }
    // Enhance existing cards
    document.querySelectorAll('[data-kanban-list] [data-ws-timeline-item], [data-kanban-list] .ws-timeline-item, [data-kanban-list] [role="listitem"]')
      .forEach(function(el){ el.setAttribute('data-kanban-card','true'); makeDraggable(el); });
    // Observe future cards rendered by home-activity
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        Array.prototype.forEach.call(m.addedNodes||[], function(n){
          if (!n.querySelectorAll) return;
          if (n.matches && n.matches('[data-kanban-card], [data-ws-timeline-item]')) makeDraggable(n);
          n.querySelectorAll && n.querySelectorAll('[data-ws-timeline-item], [role="listitem"], .ws-kanban-card').forEach(makeDraggable);
        });
      });
    });
    if (kanbanRoot) mo.observe(kanbanRoot, {childList:true, subtree:true});
    // Columns as drop targets
    Object.values(kanbanLists).forEach(function(col){
      if (!col) return;
      col.classList.add('ws-kanban-col');
      // Ensure header has count styling if missing
      if (!col.querySelector('.ws-kanban-col-header')) {
        // header already in markup; just ensure class
      }
      col.addEventListener('dragover', function(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; col.classList.add('is-drop-target'); });
      col.addEventListener('dragleave', function(e){ if (!col.contains(e.relatedTarget)) col.classList.remove('is-drop-target'); });
      col.addEventListener('drop', function(e){
        e.preventDefault();
        col.classList.remove('is-drop-target');
        var id = e.dataTransfer.getData('text/plain');
        var card = id && document.querySelector('[data-kanban-id="'+ id.replace(/"/g,'\\"') +'"]');
        if (card) {
          // Insert before closest card under cursor
          var after = null;
          var cards = Array.from(col.querySelectorAll('[data-kanban-card]'));
          var y = e.clientY;
          for (var i=0;i<cards.length;i++){
            var r = cards[i].getBoundingClientRect();
            if (y < r.top + r.height/2) { after = cards[i]; break; }
          }
          if (after) col.insertBefore(card, after);
          else col.appendChild(card);
          updateCounts();
          updateMoveControls();
          persist();
        }
      });
    });

  // Storage events are delivered to other tabs; actually apply the saved order.
  window.addEventListener('storage', function(event) {
    if (event.key === STORAGE_KEY && feedData.length) renderKanban(feedData);
  });

  // ── v14: number ticker для метрик (countNode) ──
  (function initTicker(){
    if (!countNode) return;
    function animateNumber(el, to){
      if (!el || isNaN(to)) return;
      var from = 0;
      var m = el.textContent.match(/\d+/);
      if (m) from = parseInt(m[0],10) || 0;
      if (from === to || reduceMotion) { el.textContent = to; return; }
      var start = performance.now(), dur = 900;
      function frame(now){
        var p = Math.min(1, (now - start)/dur);
        var eased = 1 - Math.pow(1 - p, 3);
        var cur = Math.round(from + (to - from)*eased);
        el.textContent = String(cur);
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    // expose for dashboard fetch
    window.__wsAnimateNumber = animateNumber;
  })();

    updateCounts();
  })();

  function renderKanban(items) {
    if (!kanbanRoot || !kanbanLists.review) return;
    const groups = { review: [], progress: [], done: [] };
    items.forEach(it => { const g = groups[it.status] ? it.status : 'done'; groups[g].push(it); });
    Object.keys(groups).forEach(k => {
      const list = kanbanLists[k];
      const cnt = kanbanCounts[k];
      if (cnt) cnt.textContent = '('+groups[k].length+')';
      if (!list) return;
      list.innerHTML = groups[k].map(it => {
        const tagColor = { frontend:'var(--ws-blue-wash)', design:'var(--ws-violet-wash)', infra:'var(--ws-green-wash)', bugfix:'var(--ws-red-wash)', content:'var(--ws-mustard-wash)', ops:'var(--ws-slate-wash)' }[it.tag] || 'var(--ws-surface)';
        return '<div data-kanban-card data-kanban-id="'+it.id+'" role="listitem" data-ws-surface style="padding:8px 10px; border-radius:10px; background:'+tagColor+'; border:1px solid var(--ws-line); display:grid; gap:4px;"><span style="font-size:10px; font-weight:600; color:var(--ws-muted);">#'+it.tag+' · '+it.time+'</span><strong style="font-size:12px; line-height:1.3;">'+escapeHtml(titleOf(it))+'</strong></div>';
      }).join('');
    });
    // Restore the saved board arrangement without changing the feed.
    try {
      const saved = JSON.parse(localStorage.getItem('ws:kanban:order:v13') || 'null');
      if (saved && saved.payload) Object.keys(kanbanLists).forEach(key => {
        const list = kanbanLists[key];
        if (!list || !Array.isArray(saved.payload[key])) return;
        saved.payload[key].forEach(id => {
          const card = [...kanbanRoot.querySelectorAll('[data-kanban-card]')].find(el => el.dataset.kanbanId === id);
          if (card) list.appendChild(card);
        });
      });
    } catch (_) {}
    Object.keys(kanbanLists).forEach(key => {
      if (kanbanCounts[key] && kanbanLists[key]) kanbanCounts[key].textContent = String(kanbanLists[key].querySelectorAll('[data-kanban-card]').length);
    });
  }
  if (viewButtons.length) {
    viewButtons.forEach(btn => btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-ws-view');
      viewButtons.forEach(b => b.setAttribute('aria-pressed', String(b===btn)));
      if (kanbanRoot) {
        const isKanban = view==='kanban';
        kanbanRoot.hidden = !isKanban;
        kanbanRoot.classList.toggle('is-visible', isKanban);
        if (timeline) timeline.style.display = isKanban ? 'none' : 'grid';
        const ticker = root.querySelector('[data-ws-activity-ticker]');
        if (ticker) ticker.style.display = isKanban ? 'none' : 'block';
        updateFilterEmpty();
      }
    }));
  }

  // — ticker + timeline renderer
  let feedData = [];
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  }
  function classifyCommit(title) {
    if (/fix|исправ|ошиб|баг/i.test(title)) return 'bugfix';
    if (/design|style|css|дизайн|оформл|визуал/i.test(title)) return 'design';
    if (/content|docs|текст|материал|документ/i.test(title)) return 'content';
    if (/frontend|интерфейс|ui|верстк|навигац/i.test(title)) return 'frontend';
    return 'update';
  }
  function showTimelineMessage(message) {
    if (!timeline) return;
    timeline.replaceChildren();
    const item = document.createElement('div');
    item.setAttribute('role', 'listitem');
    item.textContent = message;
    timeline.appendChild(item);
  }
  function updateFeed(commits) {
    feedData = commits.filter(commit => commit && /^[a-f0-9]{40}$/i.test(commit.sha || '') && typeof commit.title === 'string' && commit.title && !Number.isNaN(Date.parse(commit.date))).slice(0, 15).map(commit => ({
      id: commit.sha, title: commit.title, tag: classifyCommit(commit.title),
      status: 'done', time: formatDate(commit.date), date: commit.date
    }));
    renderTicker(); renderTimeline(); renderKanban(feedData); updateFilterEmpty();
    if (!feedData.length) showTimelineMessage(language() === 'en' ? 'No recent changes.' : 'За последние 30 дней изменений нет.');
  }
  function renderTicker() {
    if (!tickerTrack) return;
    tickerTrack.innerHTML='';
    // duplicate for infinite marquee
    const doubled = [...feedData, ...feedData];
    doubled.forEach((item, idx) => {
      const pill = document.createElement('button');
      pill.type='button';
      // The second copy is only for the visual loop, not another tab stop.
      if (idx >= feedData.length) { pill.setAttribute('aria-hidden', 'true'); pill.tabIndex = -1; }
      pill.setAttribute('data-ws-activity-pill','true');
      pill.setAttribute('data-tone', item.tag);
      pill.dataset.tag=item.tag;
      pill.dataset.status=item.status;
      const toneLabel = '#' + item.tag;
      pill.innerHTML = `<b>${toneLabel}</b> ${statusLabel(item.status)} <em>${item.time}</em>`;
      pill.addEventListener('click', ()=> setFilter(item.tag));
      // staggered entrance only first set
      if (!reduceMotion) pill.style.animationDelay = (idx*40)+'ms';
      tickerTrack.appendChild(pill);
    });
  }
  function renderTimeline() {
    if (!timeline) return;
    timeline.innerHTML='';
    feedData.forEach((item, idx) => {
      const row = document.createElement('div');
      row.setAttribute('role','listitem');
      row.setAttribute('data-ws-activity-item','true');
      row.dataset.status=item.status;
      row.dataset.tag=item.tag;
      row.style.animationDelay = (idx*60)+'ms';
      if (activeFilter!=='all' && item.tag!==activeFilter) row.setAttribute('data-filtered','true');
      row.innerHTML = `
        <div data-ws-activity-item-line aria-hidden="true"></div>
        <div data-ws-activity-item-body>
          <div data-ws-activity-item-meta>
            <span data-ws-activity-tag role="button" tabindex="0" data-tag="${item.tag}">#${item.tag}</span>
            <span data-ws-activity-status data-kind="${item.status}">${statusLabel(item.status)}</span>
          </div>
          <strong><a href="https://github.com/ItsLiventsev/itsliventsev.github.io/commit/${item.id}" target="_blank" rel="noopener">${escapeHtml(titleOf(item))}</a></strong>
          <small>GitHub · ${item.id.slice(0,7)}</small>
        </div>
        <time data-ws-activity-item-time>${item.time}</time>
      `;
      const tagEl = row.querySelector('[data-ws-activity-tag]');
      tagEl.addEventListener('click', ()=> setFilter(item.tag));
      tagEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); setFilter(item.tag);} });
      timeline.appendChild(row);
    });
  }
  function updateFilterEmpty() {
    const noMatches = feedData.length > 0 && activeFilter !== 'all' && !feedData.some(item => item.tag === activeFilter);
    filterEmpty.hidden = !noMatches || (kanbanRoot && !kanbanRoot.hidden);
    filterEmpty.textContent = language() === 'en' ? 'No changes for this filter.' : 'По этому фильтру изменений нет.';
  }
  let filterAnimation = 0;
  function setFilter(tag) {
    const animation = ++filterAnimation;
    const startHeight = timeline && !reduceMotion ? timeline.getBoundingClientRect().height : 0;
    activeFilter = tag;
    updateFilterEmpty();
    filterButtons.forEach(btn=>{
      const f = btn.getAttribute('data-filter');
      btn.setAttribute('aria-pressed', f===tag ? 'true' : 'false');
    });
    if (timeline && feedData.length) {
      // Measure the natural height after filtering, then animate from the current
      // height. A newer filter supersedes the pending animation and cleanup.
      timeline.style.transition = 'none';
      timeline.style.height = '';
      timeline.style.overflow = '';
      [...timeline.children].forEach(row => {
        row.toggleAttribute('data-filtered', tag !== 'all' && row.dataset.tag !== tag);
        if (row.hasAttribute('data-filtered')) row.setAttribute('data-filtered', 'true');
      });
      const endHeight = timeline.getBoundingClientRect().height;
      if (!reduceMotion && startHeight && Math.abs(startHeight - endHeight) > 1) {
        timeline.style.overflow = 'hidden';
        timeline.style.height = startHeight + 'px';
        void timeline.offsetHeight;
        timeline.style.transition = 'height 340ms cubic-bezier(.2,.8,.2,1)';
        let finished = false;
        requestAnimationFrame(() => {
          if (!finished && animation === filterAnimation) timeline.style.height = endHeight + 'px';
        });
        const finish = () => {
          finished = true;
          timeline.removeEventListener('transitionend', onEnd);
          if (animation !== filterAnimation) return;
          timeline.style.height = '';
          timeline.style.overflow = '';
          timeline.style.transition = '';
        };
        const onEnd = event => {
          if (event.target === timeline && event.propertyName === 'height') finish();
        };
        timeline.addEventListener('transitionend', onEnd);
        // Also release the fixed height if the browser suppresses transitions.
        setTimeout(finish, 1500);
      } else {
        timeline.style.height = '';
        timeline.style.overflow = '';
        timeline.style.transition = '';
      }
    }
    if (tickerTrack) {
      [...tickerTrack.children].forEach(pill=>{
        if (tag==='all') pill.removeAttribute('data-active');
        else pill.toggleAttribute('data-active', pill.dataset.tag===tag);
      });
    }
  }
  filterButtons.forEach(btn=>{
    btn.addEventListener('click', ()=> setFilter(btn.getAttribute('data-filter')));
  });

  function readCache() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (!saved || !Number.isFinite(saved.savedAt) || !saved.data || !Number.isInteger(saved.data.count) || saved.data.count<0) return null;
      if (Date.now() - saved.savedAt > staleForMs) return null;
      const latest = saved.data.latest;
      if (latest && (!/^[a-f0-9]{40}$/i.test(latest.sha) || Number.isNaN(Date.parse(latest.date)))) return null;
      if (Array.isArray(saved.commits)) commitsCache = saved.commits;
      return { data: saved.data, age: Date.now() - saved.savedAt };
    } catch (_) { return null; }
  }
  function saveCache(data, commits) {
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data, commits })); } catch (_) {}
  }
  function parseCommits(commits) {
    if (!Array.isArray(commits)) throw new TypeError('Unexpected GitHub response');
    const parsed = commits.map(item=>{
      const date = item && item.commit && ((item.commit.committer && item.commit.committer.date) || (item.commit.author && item.commit.author.date));
      return item && /^[a-f0-9]{40}$/i.test(item.sha||'') && date && !Number.isNaN(Date.parse(date)) ? { sha:item.sha, date: new Date(date).toISOString(), title: String(item.commit.message || '').split('\n')[0].slice(0, 200) } : null;
    }).filter(Boolean);
    commitsCache = parsed;
    return { count: parsed.length, latest: parsed[0]||null };
  }
  async function loadActivity() {
    const since = new Date(Date.now() - windowMs).toISOString();
    const url = new URL(apiUrl);
    url.searchParams.set('sha', 'main');
    url.searchParams.set('since', since);
    url.searchParams.set('per_page', '100');
    const controller = new AbortController();
    const timeout = setTimeout(()=> controller.abort(), 8000);
    try {
      const response = await fetch(url.toString(), { headers:{ Accept:'application/vnd.github+json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`GitHub API ${response.status}`);
      const data = parseCommits(await response.json());
      saveCache(data, commitsCache);
      render(data, data.count ? 'ready' : 'empty');
      renderChart(commitsCache);
      updateFeed(commitsCache);
    } finally { clearTimeout(timeout); }
  }

  // initial paint
  renderTicker();
  showTimelineMessage(language() === 'en' ? 'Loading changes…' : 'Загружаю изменения…');
  renderKanban(feedData);
  renderChart([]);
  // — animated cycle (Agent-Motion: sequential highlight + dash flow)
  // v18: цикл — мягкий подсвет активного шага, без дерганий
  const cycleEl = root.querySelector('[data-ws-activity-cycle]');
  if (cycleEl && !reduceMotion) {
    const pills = [...cycleEl.querySelectorAll('span:not([aria-hidden])')];
    let idx = 0;
    const tick = ()=>{
      pills.forEach((p,i)=>{
        const active = i===idx;
        p.style.transform = active ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)';
        p.style.boxShadow = active ? '0 4px 12px rgba(16,24,40,.12)' : 'none';
        p.style.filter = active ? 'brightness(1.04)' : 'brightness(1)';
      });
      idx = (idx+1)%pills.length;
    };
    tick();
    setInterval(tick, 1600);
  }


  const cached = readCache();
  if (cached) {
    const state = cached.age < freshForMs ? 'cached' : 'stale';
    render(cached.data, state);
    renderChart(commitsCache);
    updateFeed(commitsCache);
  } else setState('loading');

  if (!cached || cached.age >= freshForMs) loadActivity().catch(()=>{
    if (currentData) setState('stale');
    else { setState('error'); showTimelineMessage(language() === 'en' ? 'Changes are temporarily unavailable.' : 'Не удалось загрузить изменения.'); }
    renderChart(commitsCache);
  });

  window.addEventListener('itsliventsev:languagechange', ()=>{
    if (currentData) render(currentData, currentState); else setState(currentState);
    if (currentData) updateFeed(commitsCache);
    else showTimelineMessage(currentState === 'loading' ? (language() === 'en' ? 'Loading changes…' : 'Загружаю изменения…') : (language() === 'en' ? 'Changes are temporarily unavailable.' : 'Не удалось загрузить изменения.'));
    renderChart(commitsCache);
  });

})();
