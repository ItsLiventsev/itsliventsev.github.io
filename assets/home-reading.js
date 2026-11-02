/* Editorial shelf: published local manifests, progressively enhanced. */
(function () {
  'use strict';
  const root = document.querySelector('[data-ws-reading]');
  if (!root) return;
  const list = root.querySelector('[data-reading-list]');
  const filters = root.querySelector('.ws-reading-filters');
  const buttons = [...root.querySelectorAll('[data-reading-filter]')];
  const status = root.querySelector('.ws-reading-status');
  const sources = ['blog', 'articles'];
  const state = { blog: null, articles: null };
  let selected = 'all';
  const isEnglish = () => window.I18N && window.I18N.lang() === 'en';

  function parseItems(data, kind) {
    if (!Array.isArray(data)) throw new TypeError('Invalid publication index');
    return data.filter(item => item && item.status === 'published' && typeof item.title === 'string' && item.title.trim() && typeof item.file === 'string' && /^[a-z0-9][a-z0-9-]*\.html$/i.test(item.file)).map(item => ({
      kind, title: item.title, file: item.file,
      date: typeof item.date === 'string' && /^\d{4}(?:-\d{2}-\d{2})?$/.test(item.date) ? item.date : '',
      excerpt: typeof item.excerpt === 'string' ? item.excerpt : ''
    }));
  }
  function dateLabel(value) {
    if (/^\d{4}$/.test(value)) return value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const date = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '';
    return new Intl.DateTimeFormat(isEnglish() ? 'en' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  function render() {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readingFilter === selected)));
    const kinds = selected === 'all' ? sources : [selected];
    const items = kinds.flatMap(kind => state[kind] || []).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'ru')).slice(0, 4);
    list.replaceChildren();
    items.forEach(item => {
      const link = document.createElement('a'); link.className = 'ws-reading-row'; link.href = '/' + item.kind + '/' + item.file;
      const meta = document.createElement('span'); meta.className = 'ws-reading-meta';
      const type = document.createElement('span'); type.className = 'ws-reading-type'; type.textContent = item.kind === 'blog' ? (isEnglish() ? 'Note' : 'Заметка') : (isEnglish() ? 'Article' : 'Статья'); meta.appendChild(type);
      const label = dateLabel(item.date);
      if (label) { const time = document.createElement('time'); time.dateTime = item.date; time.textContent = label; meta.appendChild(time); }
      const title = document.createElement('strong'); title.textContent = item.title;
      const excerpt = document.createElement('span'); excerpt.className = 'ws-reading-excerpt'; excerpt.textContent = item.excerpt;
      const arrow = document.createElement('span'); arrow.className = 'ws-reading-arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗';
      link.append(meta, title, excerpt, arrow); list.appendChild(link);
    });
    const unavailable = kinds.some(kind => state[kind] === null);
    status.textContent = isEnglish() ? (unavailable ? (items.length ? 'Some publications are unavailable.' : 'This section is unavailable.') : items.length ? 'Showing: ' + items.length : 'No publications yet.') : (unavailable ? (items.length ? 'Часть публикаций сейчас недоступна.' : 'Раздел сейчас недоступен.') : items.length ? 'Показано: ' + items.length : 'Публикаций пока нет.');
    if (unavailable && !items.length) {
      const link = document.createElement('a'); link.className = 'ws-reading-fallback'; link.href = selected === 'articles' ? '/articles.html' : selected === 'blog' ? '/blog.html' : '/sitemap.html'; link.textContent = isEnglish() ? 'Browse sections →' : 'Перейти к разделам →'; list.appendChild(link);
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => { selected = button.dataset.readingFilter; render(); }));
  window.addEventListener('itsliventsev:languagechange', () => { if (!filters.hidden) render(); });
  Promise.allSettled(sources.map(async kind => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/' + kind + '/posts.json', { signal: controller.signal });
      if (!response.ok) throw new Error('Publication index unavailable');
      state[kind] = parseItems(await response.json(), kind);
    } finally { clearTimeout(timeout); }
  })).then(() => { filters.hidden = false; render(); });
})();
