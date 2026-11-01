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
      countNode.textContent = value;
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
    // smooth stagger: animate visibility, container height follows gently
    if (timeline) {
      const rows = [...timeline.children];
      rows.forEach((row, i)=>{
        const rowTag = row.dataset.tag;
        const shouldShow = tag==='all' || rowTag===tag;
        // stagger 40ms per item for fluid motion
        setTimeout(()=>{
          if (shouldShow) row.removeAttribute('data-filtered');
          else row.setAttribute('data-filtered','true');
        }, i*32);
      });
    }
    // highlight ticker active
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
