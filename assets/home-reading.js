/* ==========================================================================
   itsliventsev · home-reading.js — the home page library shelf.
   Reads the local publication manifests (blog/posts.json, articles/posts.json)
   and renders the four newest entries. Plain DOM, escaped text, honest
   empty and error states.
   ========================================================================== */
(function () {
  'use strict';
  const root = document.querySelector('[data-reading-shelf]');
  if (!root) return;
  const list = root.querySelector('[data-reading-list]');
  const filters = root.querySelector('[data-reading-filters]');
  const buttons = [...root.querySelectorAll('[data-reading-filter]')];
  const status = root.querySelector('.ui-reading-status');
  if (!list) return;
  const sources = ['blog', 'articles'];
  const state = { blog: null, articles: null };
  let selected = 'all';

  function parseItems(data, kind) {
    if (!Array.isArray(data)) throw new TypeError('invalid index');
    return data.filter(item => item && item.status === 'published'
      && typeof item.title === 'string' && item.title.trim()
      && typeof item.file === 'string' && /^[a-z0-9][a-z0-9-]*\.html$/i.test(item.file))
      .map(item => ({
        kind,
        title: item.title,
        file: item.file,
        date: typeof item.date === 'string' && /^\d{4}(?:-\d{2}-\d{2})?$/.test(item.date) ? item.date : '',
        excerpt: typeof item.excerpt === 'string' ? item.excerpt : ''
      }));
  }
  function dateLabel(value) {
    if (/^\d{4}$/.test(value)) return value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const date = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  function render() {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readingFilter === selected)));
    const kinds = selected === 'all' ? sources : [selected];
    const items = kinds.flatMap(kind => state[kind] || [])
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'ru'))
      .slice(0, 4);
    list.replaceChildren();
    items.forEach(item => {
      const link = document.createElement('a');
      link.className = 'ui-reading-row';
      link.href = '/' + item.kind + '/' + item.file;
      const meta = document.createElement('span');
      meta.className = 'ui-reading-meta';
      const type = document.createElement('span');
      type.className = 'ui-reading-type';
      type.textContent = item.kind === 'blog' ? 'заметка' : 'статья';
      meta.append(type);
      const label = dateLabel(item.date);
      if (label) {
        const time = document.createElement('time');
        time.dateTime = item.date;
        time.textContent = label;
        meta.append(time);
      }
      const title = document.createElement('strong');
      title.textContent = item.title;
      const excerpt = document.createElement('span');
      excerpt.className = 'ui-reading-excerpt';
      excerpt.textContent = item.excerpt;
      link.append(meta, title, excerpt);
      list.append(link);
    });
    const unavailable = kinds.some(kind => state[kind] === null);
    if (status) status.textContent = unavailable
      ? (items.length ? 'Часть публикаций сейчас недоступна.' : 'Раздел сейчас недоступен.')
      : (items.length ? 'Показано ' + items.length + ' из последних публикаций.' : 'Публикаций пока нет.');
    if (unavailable && !items.length) {
      const link = document.createElement('a');
      link.className = 'ui-inline-link';
      link.href = selected === 'articles' ? '/articles.html' : selected === 'blog' ? '/blog.html' : '/sitemap.html';
      link.textContent = 'Открыть разделы →';
      list.append(link);
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => { selected = button.dataset.readingFilter; render(); }));

  Promise.allSettled(sources.map(async kind => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/' + kind + '/posts.json', { signal: controller.signal });
      if (!response.ok) throw new Error('index unavailable');
      state[kind] = parseItems(await response.json(), kind);
    } catch (error) {
      state[kind] = null;
    } finally {
      clearTimeout(timeout);
    }
  })).then(render);
})();
