/* Public repository activity summary for the homepage. No token, no third-party dependency. */
(function () {
  'use strict';

  const root = document.querySelector('[data-ws-activity]');
  if (!root) return;

  const countNode = root.querySelector('[data-ws-activity-count]');
  const dateNode = root.querySelector('[data-ws-activity-date]');
  const shaNode = root.querySelector('[data-ws-activity-sha]');
  const commitLink = root.querySelector('[data-ws-activity-commit]');
  const statusNode = root.querySelector('[data-ws-activity-status]');
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
      count: number => number >= 100 ? 'Не менее 100 коммитов за 30 дней' : `${number} коммитов за 30 дней`
    },
    en: {
      loading: 'Checking the public GitHub history…',
      cached: 'Showing a saved GitHub snapshot; it will refresh on the next request.',
      ready: 'Data received from the main GitHub branch.',
      error: 'The summary is temporarily unavailable; the full history is linked here.',
      empty: 'No commits in the last 30 days.',
      stale: 'The request failed; showing the saved GitHub snapshot.',
      count: number => number >= 100 ? 'At least 100 commits in 30 days' : `${number} commits in 30 days`
    }
  };

  let currentData = null;
  let currentState = 'loading';
  const language = () => window.I18N && window.I18N.lang && window.I18N.lang() === 'en' ? 'en' : 'ru';
  const words = () => labels[language()];

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
    if (shaNode) shaNode.textContent = latest ? latest.sha.slice(0, 7) : '—';
    if (commitLink) commitLink.href = latest ? `https://github.com/ItsLiventsev/itsliventsev.github.io/commit/${latest.sha}` : historyUrl;
    setState(state || (data.count ? 'ready' : 'empty'));
  }

  function readCache() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (!saved || !Number.isFinite(saved.savedAt) || !saved.data || !Number.isInteger(saved.data.count) || saved.data.count < 0) return null;
      if (Date.now() - saved.savedAt > staleForMs) return null;
      const latest = saved.data.latest;
      if (latest && (!/^[a-f0-9]{40}$/i.test(latest.sha) || Number.isNaN(Date.parse(latest.date)))) return null;
      return { data: saved.data, age: Date.now() - saved.savedAt };
    } catch (_) {
      return null;
    }
  }

  function saveCache(data) {
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) {}
  }

  function parseCommits(commits) {
    if (!Array.isArray(commits)) throw new TypeError('Unexpected GitHub response');
    const parsed = commits.map(item => {
      const date = item && item.commit && ((item.commit.committer && item.commit.committer.date) || (item.commit.author && item.commit.author.date));
      return item && /^[a-f0-9]{40}$/i.test(item.sha || '') && date && !Number.isNaN(Date.parse(date))
        ? { sha: item.sha, date: new Date(date).toISOString() }
        : null;
    }).filter(Boolean);
    return { count: parsed.length, latest: parsed[0] || null };
  }

  async function loadActivity() {
    const since = new Date(Date.now() - windowMs).toISOString();
    const url = new URL(apiUrl);
    url.searchParams.set('sha', 'main');
    url.searchParams.set('since', since);
    url.searchParams.set('per_page', '100');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
      const data = parseCommits(await response.json());
      saveCache(data);
      render(data, data.count ? 'ready' : 'empty');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  const cached = readCache();
  if (cached) {
    const state = cached.age < freshForMs ? 'cached' : 'stale';
    render(cached.data, state);
    if (state === 'cached') return;
  } else {
    setState('loading');
  }

  loadActivity().catch(() => {
    if (currentData) setState('stale');
    else setState('error');
  });

  window.addEventListener('itsliventsev:languagechange', () => {
    if (currentData) render(currentData, currentState);
    else setState(currentState);
  });
})();
