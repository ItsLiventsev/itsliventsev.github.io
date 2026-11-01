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
  const apiUrl = 'https://api.github.com/repos/ItsLiventsev/itsliventsev.github.io/commits';
  const cacheKey = 'itsliventsev-home-activity-v1';
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

  // — feed mock data (Kokonut AI State like fast chips + Timeline)
  const feedSeed = [
    { id:'ui-refresh', tag:'frontend', status:'done', time:'2 мин назад', ago:2 },
    { id:'feed-ticker', tag:'design', status:'done', time:'18 мин назад', ago:18 },
    { id:'nav-indicator', tag:'frontend', status:'progress', time:'1 ч назад', ago:60 },
    { id:'chart', tag:'infra', status:'done', time:'3 ч назад', ago:180 },
    { id:'bento', tag:'design', status:'done', time:'сегодня 11:04', ago:300 },
    { id:'a11y', tag:'frontend', status:'review', time:'сегодня 09:30', ago:420 },
    { id:'perf', tag:'bugfix', status:'progress', time:'вчера', ago:900 },
    { id:'content', tag:'content', status:'done', time:'вчера', ago:1000 },
    { id:'timeline', tag:'ops', status:'done', time:'2 дня назад', ago:2880 },
    { id:'docs', tag:'infra', status:'review', time:'3 дня назад', ago:4320 }
  ];

  function statusLabel(kind) {
    const s = words().statuses;
    return s[kind] || s.done;
  }
  function titleOf(entry) {
    const dict = words().feedTitle[entry.id];
    if (!dict) return entry.id;
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
    if (statusNode) statusNode.textContent = words()[state] || words().error;
  }
  function render(data, state) {
    currentData = data;
    const value = data.count >= 100 ? '100+' : String(data.count);
    if (countNode) {
      if(window.__wsAnimateNumber) window.__wsAnimateNumber(countNode, parseInt(value,10)||0); else countNode.textContent = value;
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
    if (chartTotal) chartTotal.textContent = data.count ? `${data.count} за 30 дней` : '—';
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
    // if all zero (no data or fallback), synthesize gentle wave
    const maxB = Math.max(...buckets);
    const hasData = maxB > 0;
    let mock = [2,3,5,4,6,7,4,8,5,6,9,7,8,5];
    let series = hasData ? buckets : mock;
    let max = Math.max(...series,1);
    chartGrid.innerHTML = '';
    series.forEach((v, i) => {
      const bar = document.createElement('div');
      bar.setAttribute('data-ws-activity-bar','true');
      if (i===days-1) bar.setAttribute('data-today','true');
      const h = Math.max(8, Math.round((v/max)*100));
      bar.style.height = h + '%';
      bar.style.minHeight = '8px';
      bar.title = `${v} ${language()==='en' ? 'commits' : 'коммитов'}`;
      chartGrid.appendChild(bar);
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
      // Keyboard: Ctrl+Arrow to move between columns
      card.addEventListener('keydown', function(e){
        if (!(e.ctrlKey && (e.key==='ArrowRight' || e.key==='ArrowLeft' || e.key==='ArrowUp' || e.key==='ArrowDown'))) return;
        e.preventDefault();
        var cols = ['review','progress','done'];
        var curColKey = Object.keys(kanbanLists).find(function(k){ return kanbanLists[k] && kanbanLists[k].contains(card); });
        if (!curColKey) return;
        var idx = cols.indexOf(curColKey);
        var nextKey = null;
        if (e.key==='ArrowRight' || e.key==='ArrowDown') nextKey = cols[Math.min(idx+1, cols.length-1)];
        else nextKey = cols[Math.max(idx-1, 0)];
        if (nextKey && nextKey!==curColKey && kanbanLists[nextKey]) {
          kanbanLists[nextKey].appendChild(card);
          card.focus();
          updateCounts();
          persist();
        }
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
          persist();
        }
      });
    });

  // ── v14: BroadcastChannel для синхронизации канбана между вкладками ──
  (function initKanbanSync(){
    if (!('BroadcastChannel' in window) || !kanbanRoot) return;
    var ch = new BroadcastChannel('ws-kanban-v14');
    var STORAGE_KEY = 'ws:kanban:order:v13';
    ch.onmessage = function(ev){
      if (!ev.data || ev.data.type !== 'kanban:update') return;
      // другой таб переместил — показываем мягкий индикатор
      var note = root.querySelector('[data-ws-activity-status]');
      if (note) { var prev=note.textContent; note.textContent='Канбан обновлён в другой вкладке · '+ new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}); setTimeout(function(){ note.textContent=prev; }, 2500); }
    };
    var origPersist = window.__wsKanbanPersist || null;
    // Hook persist via mutation: observe storage
    window.addEventListener('storage', function(e){
      if (e.key === STORAGE_KEY) ch.postMessage({type:'kanban:update', at: Date.now()});
    });
    // Also post after local drop
    var _post = function(){ try{ ch.postMessage({type:'kanban:update', at: Date.now()}); }catch(e){} };
    // Wrap existing persist by listening to dragend globally
    document.addEventListener('dragend', function(){ setTimeout(_post, 80); });
  })();

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

  const kanbanCounts = {
    review: root.querySelector('[data-kanban-count="review"]'),
    progress: root.querySelector('[data-kanban-count="progress"]'),
    done: root.querySelector('[data-kanban-count="done"]')
  };
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
        return '<div data-ws-surface style="padding:8px 10px; border-radius:10px; background:'+tagColor+'; border:1px solid var(--ws-line); display:grid; gap:4px;"><span style="font-size:10px; font-weight:600; color:var(--ws-muted);">#'+it.tag+' · '+it.time+'</span><strong style="font-size:12px; line-height:1.3;">'+(words().feedTitle[it.id]?.[language()]||it.id)+'</strong><span style="font-size:10px; color:var(--ws-muted);">'+statusLabel(it.status)+'</span></div>';
      }).join('') || '<span style="font-size:11px; color:var(--ws-muted);">—</span>';
    });
  }
  if (viewButtons.length) {
    viewButtons.forEach(btn => btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-ws-view');
      viewButtons.forEach(b => b.setAttribute('aria-pressed', String(b===btn)));
      viewButtons.forEach(b => b.style.background = b===btn ? 'var(--ws-surface)' : 'transparent');
      if (kanbanRoot) {
        const isKanban = view==='kanban';
        kanbanRoot.hidden = !isKanban;
        kanbanRoot.style.display = isKanban ? 'grid' : 'none';
        if (timeline) timeline.style.display = isKanban ? 'none' : 'grid';
        const ticker = root.querySelector('[data-ws-activity-ticker]');
        if (ticker) ticker.style.display = isKanban ? 'none' : 'block';
      }
    }));
  }

  // — ticker + timeline renderer
  let feedData = feedSeed.map(s=>({ ...s, status:s.status })); // clone
  function renderTicker() {
    if (!tickerTrack) return;
    tickerTrack.innerHTML='';
    // duplicate for infinite marquee
    const doubled = [...feedData, ...feedData];
    doubled.forEach((item, idx) => {
      const pill = document.createElement('button');
      pill.type='button';
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
          <strong>${titleOf(item)}</strong>
          <small>${item.time} · итерация #${String(idx+1).padStart(2,'0')}</small>
        </div>
        <time data-ws-activity-item-time>${item.time}</time>
      `;
      const tagEl = row.querySelector('[data-ws-activity-tag]');
      tagEl.addEventListener('click', ()=> setFilter(item.tag));
      tagEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); setFilter(item.tag);} });
      timeline.appendChild(row);
    });
  }
  function setFilter(tag) {
    activeFilter = tag;
    filterButtons.forEach(btn=>{
      const f = btn.getAttribute('data-filter');
      btn.setAttribute('aria-pressed', f===tag ? 'true' : 'false');
    });
    // FLIP: animate container height smoothly, items stagger fade + scale without abrupt collapse
    if (timeline) {
      const prefersHeightAnim = !reduceMotion;
      const startH = timeline.offsetHeight;
      // Prepare: lock current height to avoid jump
      if (prefersHeightAnim) {
        timeline.style.overflow = 'hidden';
        timeline.style.height = startH + 'px';
        timeline.style.transition = 'height 420ms cubic-bezier(.2,.8,.2,1)';
      }
      const rows = [...timeline.children];
      // Apply filtered state instantly for measurement (no stagger for height)
      rows.forEach(row=>{
        const shouldShow = tag==='all' || row.dataset.tag===tag;
        if (shouldShow) row.removeAttribute('data-filtered');
        else row.setAttribute('data-filtered','true');
      });
      // Measure end height (force reflow)
      const endH = timeline.scrollHeight;
      if (prefersHeightAnim) {
        // Animate container height
        requestAnimationFrame(()=>{
          timeline.style.height = endH + 'px';
          // staggered item entrance: fade + scale
          rows.forEach((row, i)=>{
            if (row.hasAttribute('data-filtered')) return;
            row.style.opacity = '0';
            row.style.transform = 'translateY(6px) scale(.98)';
            setTimeout(()=>{
              row.style.transition = 'opacity 320ms ease '+(i*36)+'ms, transform 320ms cubic-bezier(.2,.8,.2,1) '+(i*36)+'ms';
              row.style.opacity = '1';
              row.style.transform = 'translateY(0) scale(1)';
            }, 16);
          });
        });
        const cleanup = ()=>{
          timeline.style.height = '';
          timeline.style.overflow = '';
          timeline.style.transition = '';
          rows.forEach(r=>{ r.style.opacity=''; r.style.transform=''; r.style.transition=''; });
          timeline.removeEventListener('transitionend', cleanup);
        };
        timeline.addEventListener('transitionend', cleanup);
        // fallback cleanup
        setTimeout(cleanup, 600);
      } else {
        // reduced motion: no animation
        rows.forEach(row=>{ row.style.opacity=''; row.style.transform=''; });
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

  // fast-changing simulation like Thinking Orbs
  let shuffleTimer=null;
  function startShuffle() {
    if (reduceMotion || !tickerTrack) return;
    shuffleTimer = setInterval(()=>{
      const pills = [...tickerTrack.children].slice(0, feedData.length); // first cycle only
      if (!pills.length) return;
      const idx = Math.floor(Math.random()*pills.length);
      const pill = pills[idx];
      const statuses = ['done','progress','review'];
      const current = pill.dataset.status;
      let next = statuses[Math.floor(Math.random()*statuses.length)];
      if (next===current) next = statuses[(statuses.indexOf(current)+1)%3];
      pill.dataset.status = next;
      pill.setAttribute('data-changing','true');
      pill.innerHTML = `<b>#${pill.dataset.tag}</b> ${statusLabel(next)} <em>${feedData[idx].time}</em>`;
      setTimeout(()=> pill.removeAttribute('data-changing'), 500);
      // sync feedData for timeline consistency occasionally
      if (Math.random() < .35) {
        feedData[idx].status = next;
        renderTimeline();
      }
    }, 2600);
  }

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
      return item && /^[a-f0-9]{40}$/i.test(item.sha||'') && date && !Number.isNaN(Date.parse(date)) ? { sha:item.sha, date: new Date(date).toISOString() } : null;
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
    } finally { clearTimeout(timeout); }
  }

  // initial paint
  renderTicker();
  renderTimeline();
  renderChart([]);
  // — animated cycle (Agent-Motion: sequential highlight + dash flow)
  const cycleEl = root.querySelector('[data-ws-activity-cycle]');
  if (cycleEl && !reduceMotion) {
    const steps = [...cycleEl.querySelectorAll('span:not([aria-hidden])')];
    let cycleIdx = 0;
    setInterval(()=>{
      steps.forEach((el,i)=> el.style.opacity = i===cycleIdx*2 ? '1' : i===cycleIdx*2+1 ? '1' : '.85');
      steps.forEach((el,i)=> { if(i%2===1) el.style.transform = cycleIdx*2===i-1 ? 'translateX(4px)' : 'translateX(0)'; });
      cycleEl.classList.toggle('is-active', cycleIdx===3);
      cycleIdx = (cycleIdx+1)%4;
    }, 1200);
  }

  startShuffle();

  const cached = readCache();
  if (cached) {
    const state = cached.age < freshForMs ? 'cached' : 'stale';
    render(cached.data, state);
    renderChart(commitsCache);
    if (state==='cached') return;
  } else setState('loading');

  loadActivity().catch(()=>{
    if (currentData) setState('stale');
    else setState('error');
    renderChart(commitsCache);
  });

  window.addEventListener('itsliventsev:languagechange', ()=>{
    if (currentData) render(currentData, currentState); else setState(currentState);
    renderTicker(); renderTimeline(); renderChart(commitsCache);
  });

  // pause ticker on prefers-reduced-motion live check
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && shuffleTimer) { clearInterval(shuffleTimer); shuffleTimer=null; }
    else if (!document.hidden && !shuffleTimer) startShuffle();
  });
})();
