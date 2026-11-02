/* ==========================================================================
   itsliventsev · feed.js — открытый журнал разработки на главной.

   Источник данных — снимок assets/data/activity.json: его собирает
   scripts/build-activity.js в GitHub Actions при каждом пуше в main.
   Почему не прямой запрос к API из браузера: лимит 60 запросов в час на IP
   выбивается за пару посетителей, блок пустеет и в консоль летит ошибка.
   Прямой запрос остался фолбэком (локальная разработка без снимка).

   Компонент всегда деградирует до ссылки на историю репозитория.
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
  const SNAPSHOT_URL = '/assets/data/activity.json';
  const CACHE_KEY = 'itsliventsev:activity:v2';
  const FRESH_MS = 15 * 60 * 1000;
  const days = 14;
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
    const text = String(message).toLowerCase();
    const tags = [];
    if (/^(feat|add|redesign|ui|build)|интерфейс|layout|компонент/.test(text)) tags.push('frontend');
    if (/design|css|style|token|типограф|оформлен|дизайн/.test(text)) tags.push('design');
    if (/docs?|content|text|article|post|материал|текст|статья|заметк|контент/.test(text)) tags.push('content');
    if (/fix|bug|hotfix|исправ|регресс|ошибк|perf/.test(text)) tags.push('fix');
    if (!tags.length) tags.push('frontend');
    return [...new Set(tags)].slice(0, 2);
  };
  const TAG_LABEL = { frontend: '#frontend', design: '#design', content: '#content', fix: '#fix' };
  const STATUS = { frontend: 'в работе', design: 'готово', content: 'готово', fix: 'исправлено' };

  let state = { items: [], total: 0, days: null, latest: null, generated: '', error: false };
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
    if (!reduceMotion) {
      [...list.children].forEach((row, index) => {
        row.animate?.([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 260, delay: Math.min(index * 40, 240), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
      });
    }
  }

  function bucketFromItems(items) {
    const out = Array(days).fill(0);
    const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    items.forEach(item => {
      const date = new Date(item.date);
      if (Number.isNaN(date.getTime())) return;
      const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      const diff = Math.round((today - day) / 86400000);
      if (diff >= 0 && diff < days) out[days - 1 - diff] += 1;
    });
    return out;
  }

  function renderChart() {
    if (!chart) return;
    const buckets = state.days
      ? state.days.slice(-days).map(entry => entry.count)
      : bucketFromItems(state.items);
    while (buckets.length < days) buckets.unshift(0);
    const max = Math.max(...buckets, 1);
    const total = buckets.reduce((sum, value) => sum + value, 0);
    chart.innerHTML = buckets.map((value, index) => {
      const height = value ? Math.max(8, Math.round((value / max) * 100)) : 3;
      const label = value + ' ' + plural(value, 'коммит', 'коммита', 'коммитов');
      return '<i data-height="' + height + '"' + (index === days - 1 ? ' data-today=""' : '')
        + (value ? '' : ' data-empty=""') + ' title="' + label + '"></i>';
    }).join('');
    [...chart.children].forEach(bar => bar.style.setProperty('--h', bar.dataset.height + '%'));
    chart.setAttribute('aria-label', 'Коммиты за 14 дней: ' + total);
    if (totalNode) totalNode.textContent = String(total);
    if (!reduceMotion) {
      [...chart.children].forEach((bar, index) => {
        bar.animate?.([{ transform: 'scaleY(0.15)' }, { transform: 'scaleY(1)' }],
          { duration: 340, delay: index * 24, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
      });
    }
  }

  function render() {
    if (countNode && !state.error) {
      countNode.textContent = String(state.total || state.items.length || 0);
      countNode.setAttribute('aria-label', (state.total || state.items.length) + ' ' + plural(state.total || state.items.length, 'коммит', 'коммита', 'коммитов') + ' за 30 дней');
    }
    if (state.latest) {
      if (dateNode) { dateNode.dateTime = state.latest.date.slice(0, 10); dateNode.textContent = dayLabel(state.latest.date); }
      if (shaNode) shaNode.textContent = state.latest.sha;
      if (commitLink) commitLink.href = state.latest.url;
    }
    renderChart();
    renderList();
  }

  function normalize(item) {
    const title = String(item.title || 'без описания');
    return {
      sha: String(item.sha || '').slice(0, 7),
      url: item.url || '',
      title,
      date: item.date || '',
      tags: Array.isArray(item.tags) && item.tags.length ? item.tags : tagsOf(title)
    };
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.commits) || Date.now() - parsed.at > FRESH_MS) return null;
      return parsed.payload;
    } catch (error) { return null; }
  }
  function writeCache(payload) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), commits: payload.commits, payload })); } catch (error) { /* quota/private */ }
  }

  function apply(payload, origin) {
    state.items = (payload.commits || []).map(normalize);
    state.total = Number(payload.total) || state.items.length;
    state.days = Array.isArray(payload.days) ? payload.days : null;
    state.generated = payload.generated || '';
    state.latest = state.items[0] || null;
    state.error = false;
    render();
    const word = plural(state.total, 'коммит', 'коммита', 'коммитов');
    setStatus(origin === 'cache'
      ? 'Показан сохранённый снимок истории: ' + state.total + ' ' + word + ' за 30 дней.'
      : 'История из основной ветки GitHub: ' + state.total + ' ' + word + ' за 30 дней. Merge-коммиты и служебные сборки не считаются.');
  }

  function fail() {
    state.error = true;
    state.items = [];
    state.days = null;
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
  if (cached && cached.commits) apply(cached, 'cache');

  // 1. Снимок с того же домена — основной путь.
  fetch(SNAPSHOT_URL, { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw new Error('snapshot ' + response.status); return response.json(); })
    .then(payload => {
      if (!payload || !Array.isArray(payload.commits)) throw new Error('unexpected snapshot');
      writeCache(payload);
      apply(payload, 'snapshot');
    })
    // 2. Прямой запрос к API — только если снимка нет (локальная разработка).
    .catch(() => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const url = new URL('https://api.github.com/repos/ItsLiventsev/itsliventsev.github.io/commits');
      url.searchParams.set('sha', 'main');
      url.searchParams.set('since', since);
      url.searchParams.set('per_page', '100');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      return fetch(url, { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
        .then(response => { if (!response.ok) throw new Error('GitHub API ' + response.status); return response.json(); })
        .then(data => {
          if (!Array.isArray(data)) throw new Error('unexpected payload');
          const commits = data.map(commit => ({
            sha: String(commit.sha || ''),
            title: String(commit.commit?.message || '').split('\n')[0].trim(),
            date: commit.commit?.committer?.date || commit.commit?.author?.date || '',
            url: 'https://github.com/ItsLiventsev/itsliventsev.github.io/commit/' + commit.sha
          }));
          const payload = { generated: new Date().toISOString(), total: commits.length, commits };
          writeCache(payload);
          apply(payload, 'api');
        })
        .finally(() => clearTimeout(timer));
    })
    .catch(() => { if (!cached) fail(); else setStatus('Снимок истории обновляется — показан сохранённый.'); });
})();
