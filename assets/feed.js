/* ==========================================================================
   itsliventsev · feed.js — open development log for the home page.
   Reads the public GitHub API (no token, no server), renders the last
   changes with hashtags, a 30-day counter and a 14-day bar chart.
   The component always degrades to a link to the repository history.
   ========================================================================== */
(function () {
  'use strict';
  const root = document.querySelector('[data-activity]');
  if (!root) return;
  const list = root.querySelector('[data-activity-list]');
  const status = root.querySelector('[data-activity-status]');
  const countNode = root.querySelector('[data-activity-count]');
  const totalNode = root.querySelector('[data-activity-total]');
  const dateNode = root.querySelector('[data-activity-date]');
  const shaNode = root.querySelector('[data-activity-sha]');
  const commitLink = root.querySelector('[data-activity-commit]');
  const chart = root.querySelector('[data-activity-chart]');
  const filters = [...root.querySelectorAll('[data-impact]')];
  const historyUrl = 'https://github.com/ItsLiventsev/itsliventsev.github.io/commits/main';
  const CACHE_KEY = 'itsliventsev:activity:v1';
  const FRESH_MS = 15 * 60 * 1000;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const plural = (n, one, few, many) => {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  };
  const stamp = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + ' мин';
    if (diff < 86400) return Math.round(diff / 3600) + ' ч';
    if (diff < 86400 * 7) return Math.round(diff / 86400) + ' дн';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };
  const dayLabel = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };
  const tagsOf = message => {
    const text = message.toLowerCase();
    const tags = [];
    if (/^(feat|add|redesign|ui|build)|интерфейс|layout|компонент/.test(text)) tags.push('frontend');
    if (/design|css|style|token|типограф|оформлен|дизайн/.test(text)) tags.push('design');
    if (/docs?|content|text|article|post|материал|текст|статья|заметк|контент/.test(text)) tags.push('content');
    if (/fix|bug|hotfix|исправ|регресс|ошибк/.test(text)) tags.push('fix');
    if (!tags.length) tags.push('frontend');
    return [...new Set(tags)].slice(0, 2);
  };
  const TAG_LABEL = { frontend: '#frontend', design: '#design', content: '#content', fix: '#fix' };
  const STATUS = { frontend: 'в работе', design: 'готово', content: 'готово', fix: 'исправлено' };

  let state = { items: [], count: 0, latest: null, error: false };
  let selected = 'all';

  function setStatus(text) { if (status) status.textContent = text; }

  function renderList() {
    if (!list) return;
    const items = state.items.filter(item => selected === 'all' || item.tags.includes(selected)).slice(0, 7);
    list.setAttribute('role', items.length ? 'list' : 'group');
    if (!items.length) {
      list.innerHTML = '<p class="feed-empty">' + (state.error
        ? 'История сейчас недоступна. <a href="' + historyUrl + '" target="_blank" rel="noopener">Открыть GitHub ↗</a>'
        : 'По этому фильтру изменений нет.') + '</p>';
      return;
    }
    list.innerHTML = items.map(item => {
      const tag = item.tags[0];
      return '<article class="feed-item" role="listitem">'
        + '<span class="feed-when"><time datetime="' + esc(item.date) + '" title="' + esc(dayLabel(item.date)) + '">' + esc(stamp(item.date)) + '</time></span>'
        + '<div class="feed-body"><h3>' + esc(item.title) + '</h3>'
        + '<div class="feed-tags">'
        + item.tags.map(name => '<span class="ui-tag' + (name === 'fix' ? ' ui-tag--ok' : '') + '">' + TAG_LABEL[name] + '</span>').join('')
        + '<span class="ui-tag">' + STATUS[tag] + '</span>'
        + '<a class="feed-commit" href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.sha) + ' ↗</a>'
        + '</div></div></article>';
    }).join('');
  }

  function renderChart(commits) {
    if (!chart) return;
    const days = 14;
    const buckets = Array(days).fill(0);
    const dayMs = 86400000;
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    commits.forEach(commit => {
      const date = new Date(commit.date);
      if (Number.isNaN(date.getTime())) return;
      const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      const diff = Math.round((today - day) / dayMs);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
    });
    const max = Math.max(...buckets, 1);
    const total = buckets.reduce((sum, value) => sum + value, 0);
    const truncated = commits.length >= 100;
    chart.innerHTML = buckets.map((value, index) => {
      const height = Math.max(4, Math.round((value / max) * 100));
      return '<i data-height="' + height + '"' + (index === days - 1 ? ' data-today=""' : '') + ' title="' + value + ' ' + plural(value, 'коммит', 'коммита', 'коммитов') + '"></i>';
    }).join('');
    [...chart.children].forEach(bar => bar.style.setProperty('--h', bar.dataset.height + '%'));
    chart.setAttribute('aria-label', 'Коммиты за 14 дней: ' + (truncated ? 'не менее ' : '') + total);
    if (totalNode) totalNode.textContent = (truncated ? '≥ ' : '') + total;
    if (!reduceMotion) {
      [...chart.children].forEach((bar, index) => {
        bar.animate?.([{ transform: 'scaleY(0.2)' }, { transform: 'scaleY(1)' }], { duration: 320, delay: index * 22, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
      });
    }
  }

  function render() {
    if (countNode && !state.error) countNode.textContent = state.count >= 100 ? '100+' : String(state.count);
    if (countNode && countNode.textContent !== '—') countNode.setAttribute('aria-label', state.count + ' ' + plural(state.count, 'коммит', 'коммита', 'коммитов') + ' за 30 дней');
    if (state.latest) {
      if (dateNode) { dateNode.dateTime = state.latest.date.slice(0, 10); dateNode.textContent = dayLabel(state.latest.date); }
      if (shaNode) shaNode.textContent = state.latest.sha;
      if (commitLink) commitLink.href = state.latest.url;
    }
    renderChart(state.commits || []);
    renderList();
  }

  function normalize(commit) {
    const message = String(commit.commit?.message || '').split('\n')[0].trim();
    return {
      sha: String(commit.sha || '').slice(0, 7),
      url: 'https://github.com/ItsLiventsev/itsliventsev.github.io/commit/' + commit.sha,
      title: message || 'без описания',
      date: commit.commit?.committer?.date || commit.commit?.author?.date || '',
      tags: tagsOf(message)
    };
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.commits) || Date.now() - parsed.at > FRESH_MS) return null;
      return parsed.commits;
    } catch (error) { return null; }
  }
  function writeCache(commits) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), commits })); } catch (error) { /* quota/private */ }
  }

  function applyCommits(commits, cached) {
    state.commits = commits;
    state.items = commits.map(normalize);
    state.count = commits.length;
    state.latest = state.items[0] || null;
    state.error = false;
    render();
    setStatus(cached
      ? 'Показан сохранённый снимок GitHub за последние 30 дней.'
      : 'Данные получены из основной ветки GitHub: ' + commits.length + ' ' + plural(commits.length, 'коммит', 'коммита', 'коммитов') + ' за 30 дней.');
  }

  function fail() {
    state.error = true;
    state.commits = [];
    render();
    if (countNode) countNode.textContent = '—';
    if (totalNode) totalNode.textContent = '—';
    setStatus('Сводка временно недоступна — история открывается по ссылке выше.');
    renderList();
  }

  filters.forEach(button => {
    button.addEventListener('click', () => {
      selected = button.dataset.impact;
      filters.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      renderList();
    });
  });

  const cached = readCache();
  if (cached && cached.length) applyCommits(cached, true);

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const url = new URL('https://api.github.com/repos/ItsLiventsev/itsliventsev.github.io/commits');
  url.searchParams.set('sha', 'main');
  url.searchParams.set('since', since);
  url.searchParams.set('per_page', '100');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  fetch(url, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
    .then(response => { if (!response.ok) throw new Error('GitHub API ' + response.status); return response.json(); })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('unexpected payload');
      writeCache(data);
      applyCommits(data, false);
    })
    .catch(() => { if (!cached) fail(); else setStatus('Запрос не прошёл — показан сохранённый снимок GitHub.'); })
    .finally(() => clearTimeout(timer));
})();
