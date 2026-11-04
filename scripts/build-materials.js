#!/usr/bin/env node
/* ==========================================================================
   Сборщик раздела «Учебные материалы».

   Источник правды:
     assets/data/knowledge/materials.json   дерево: разделы → группы → темы
     assets/data/knowledge/materials/*.md   сами материалы (frontmatter + Markdown)

   Что пишется:
     blog/materials.html              указатель разделов и тем
     blog/materials/<id>.html         страница материала с левым wiki-меню

   Контракты (AGENTS.md):
     - ноль рантайм-зависимостей: меню раскрывается нативным <details>, скрипт
       не нужен ни для навигации, ни для чтения;
     - только токены и классы kn-*, без инлайн-стилей;
     - персональных данных нет: в материалах только темы, теория и задачи.

   Связи с заметками: в тексте материала ссылка [[kn-dns]] открывает заметку
   раздела «Заметки», обратный переход — блок «Связанные заметки» на странице
   материала. Направление обратное графу: список, а не карта.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const critical = require('./lib/critical-knowledge');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'assets/data/knowledge');
const MD_DIR = path.join(DATA_DIR, 'materials');
const TREE = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'materials.json'), 'utf8'));
const NOTES_JSON = path.join(DATA_DIR, 'notes.json');
const SITE = 'https://itsliventsev.github.io';
const CHECK_ONLY = process.argv.includes('--check');
const problems = [];

/* ─────────────────────────── утилиты ─────────────────────────── */
/* Описание попадает в <meta name="description"> и в JSON-LD: длиннее 165
   символов поисковик обрезает сам, поэтому режем по границе слова заранее. */
function clamp(text, limit) {
  const value = String(text || '').trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return (space > limit - 30 ? cut.slice(0, space) : cut).replace(/[\s,;:.—-]+$/, '') + '…';
}

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const write = (file, body) => {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
};
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
  'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const humanDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + ' ' + y;
};
const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
};
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};
const headingSlug = (text) => {
  const plain = String(text).replace(/[*`_]/g, '').replace(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g, '$1').toLowerCase();
  const latin = plain.replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return latin || 'razdel';
};

/* ─────────────────────────── frontmatter ─────────────────────────── */
function parseFrontmatter(source, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error(file + ': нет frontmatter между ---');
  const meta = {};
  let key = null;          // текущий ключ верхнего уровня
  let item = null;         // текущий элемент списка объектов (sources, goal)
  const flushItem = () => { if (item && key) { meta[key] = meta[key] || []; meta[key].push(item); } item = null; };
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    /* Новый элемент списка: «  - title: ...» — объект, «  - текст» — строка. */
    const listItem = /^\s+-\s+(.*)$/.exec(line);
    if (listItem && key) {
      const body = listItem[1];
      const pair = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(body);
      if (pair) { flushItem(); item = { [pair[1]]: scalar(pair[2]) }; continue; }
      flushItem();
      meta[key] = meta[key] || [];
      meta[key].push(scalar(body));
      continue;
    }
    /* Продолжение объекта: «    url: ...» */
    const nestedPair = /^\s{2,}([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);
    if (nestedPair && item) { item[nestedPair[1]] = scalar(nestedPair[2]); continue; }
    const pair = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    flushItem();
    key = pair[1];
    const raw = pair[2].trim();
    if (!raw) { meta[key] = []; continue; }
    if (raw.startsWith('[') && raw.endsWith(']')) {
      meta[key] = raw.slice(1, -1).split(',').map((part) => scalar(part.trim())).filter(Boolean);
    } else {
      meta[key] = scalar(raw);
    }
  }
  flushItem();
  return { meta, body: match[2] };
}
function scalar(raw) {
  const text = String(raw).trim().replace(/^["']|["']$/g, '');
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^\d+$/.test(text)) return Number(text);
  return text;
}

/* ─────────────────────────── Markdown ─────────────────────────── */
function inline(text, context) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => '<code>' + code + '</code>');
  /* Ссылка на заметку: [[kn-dns]] или [[kn-dns|подпись]]. */
  out = out.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
    const note = context.notes.get(id);
    if (!note) return esc(label || id);
    return '<a href="/blog/' + esc(id) + '.html">' + esc(label || note.title) + '</a>';
  });
  /* Ссылка на другой материал: {{tema|подпись}}. */
  out = out.replace(/\{\{([a-z0-9-]+)(?:\|([^\]]+))?\}\}/g, (_, id, label) => {
    const item = context.topics.get(id);
    if (!item) return esc(label || id);
    return '<a href="/blog/materials/' + esc(id) + '.html">' + esc(label || item.title) + '</a>';
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, label, url) => '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>');
  return out;
}

function renderBody(markdown, context) {
  const lines = String(markdown).split(/\r?\n/);
  const out = [];
  const anchors = [];
  let paragraph = [];
  let list = null;
  let inCode = false;
  let code = [];
  let table = null;
  const usedAnchors = new Set();

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push('<p>' + inline(paragraph.join(' '), context) + '</p>');
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push('<' + list.type + '>' + list.items
      .map((item) => '<li>' + inline(item, context) + '</li>').join('') + '</' + list.type + '>');
    list = null;
  };
  const flushTable = () => {
    if (!table) return;
    const head = '<tr>' + table.head.map((cell) => '<th scope="col">' + inline(cell, context) + '</th>').join('') + '</tr>';
    const rows = table.rows.map((row) => '<tr>'
      + row.map((cell, i) => (i === 0 ? '<th scope="row">' + inline(cell, context) + '</th>'
        : '<td>' + inline(cell, context) + '</td>')).join('') + '</tr>').join('');
    out.push('<div class="kn-table-wrap"><table class="kn-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>');
    table = null;
  };
  const flushAll = () => { flushParagraph(); flushList(); flushTable(); };

  for (const raw of lines) {
    if (/^```/.test(raw)) {
      if (inCode) { out.push('<pre class="kn-code"><code>' + esc(code.join('\n')) + '</code></pre>'); code = []; inCode = false; }
      else { flushAll(); inCode = true; }
      continue;
    }
    if (inCode) { code.push(raw); continue; }

    const row = /^\|(.+)\|$/.exec(raw.trim());
    if (row) {
      flushParagraph(); flushList();
      const cells = row[1].split('|').map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
      if (!table) table = { head: cells, rows: [] };
      else table.rows.push(cells);
      continue;
    }
    if (table) flushTable();

    const heading = /^(#{2,4})\s+(.*)$/.exec(raw);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2].trim();
      const base = headingSlug(text);
      let id = base, n = 2;
      while (usedAnchors.has(id)) id = base + '-' + n++;
      usedAnchors.add(id);
      if (level === 2) anchors.push({ id, text: text.replace(/[*`]/g, '') });
      out.push('<h' + level + ' id="' + esc(id) + '">' + inline(text, context) + '</h' + level + '>');
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(raw);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(bullet[1]);
      continue;
    }
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(raw);
    if (numbered) {
      flushParagraph();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(numbered[1]);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(raw);
    if (quote) {
      flushAll();
      out.push('<blockquote>' + inline(quote[1], context) + '</blockquote>');
      continue;
    }
    if (!raw.trim()) { flushAll(); continue; }
    paragraph.push(raw.trim());
  }
  flushAll();
  return { html: out.join('\n        '), anchors };
}

/* ─────────────────────────── шаблон страницы ─────────────────────────── */
const YEAR = 2026;

function head({ title, description }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#efeee9">
<meta name="color-scheme" content="light dark">
<script>(function(){try{var s=localStorage.getItem("itsliventsev-theme"),t=s==="dark"||s==="light"?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");var m=document.querySelector("meta[name=theme-color]");if(m)m.setAttribute("content","#121109");}}catch(e){}})();</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="preload" href="/assets/fonts/literata-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/golos-text-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
${critical.stylesheet('tokens', false)}
${critical.stylesheet('base', false)}
${critical.stylesheet('pages', false)}
${critical.stylesheet('knowledge', false)}
<!-- SEO:AUTO:START --><!-- SEO:AUTO:END -->
</head>`;
}

function footer() {
  return `<footer class="ui-footer">
    <span>© ${YEAR} itsliventsev · Учебные материалы</span>
    <nav aria-label="Служебная навигация"><a href="/index.html">Главная</a><a href="/blog.html">Заметки</a><a href="/blog/topics.html">Рубрики</a><a href="/feed.xml">RSS</a></nav>
    <time data-footer-updated></time>
  </footer>`;
}

/* Плоский список тем со ссылками на раздел и группу — из него строятся меню,
   счётчики, «соседние темы» и проверка ссылок. */
function flatten(sections) {
  const topics = new Map();
  const order = [];
  for (const section of sections) {
    for (const group of section.groups) {
      for (const id of group.items) {
        topics.set(id, { id, section, group });
        order.push(id);
      }
    }
  }
  return { topics, order };
}

/* Wiki-меню: раздел → группа (<details>) → темы. Текущая тема помечена
   aria-current, её группа раскрыта. Работает без скриптов: раскрытие делает
   сам браузер на <details>. */
function wikiNav(tree, activeId) {
  const sections = tree.sections.map((section) => {
    const groups = section.groups.map((group) => {
      const open = group.items.includes(activeId);
      const items = group.items.map((id) => {
        const item = tree.topicMeta.get(id);
        if (!item) return '';
        const current = id === activeId ? ' aria-current="page"' : '';
        return '<li><a href="/blog/materials/' + esc(id) + '.html"' + current + '>' + esc(item.title) + '</a></li>';
      }).join('');
      if (!items) return '';
      return '<li class="kn-wiki-group"><details' + (open ? ' open' : '') + '>'
        + '<summary>' + esc(group.title) + '<span>' + group.items.length + '</span></summary>'
        + '<ul>' + items + '</ul></details></li>';
    }).join('');
    if (!groups) return '';
    return '<li class="kn-wiki-section"><details' + (section.groups.some(group => group.items.includes(activeId)) || (!activeId && section === tree.sections[0]) ? ' open' : '') + '>'
      + '<summary><span class="kn-wiki-num">' + esc(section.num) + '</span>' + esc(section.title) + '</summary>'
      + '<ul>' + groups + '</ul></details></li>';
  }).join('');

  return `<nav class="kn-wiki" aria-label="Навигация по базе знаний">
      <details class="kn-wiki-disclosure" open>
        <summary class="kn-wiki-home">Темы и материалы <span>${tree.topicCount} ${plural(tree.topicCount, 'тема', 'темы', 'тем')}</span></summary>
        <a class="kn-wiki-all" href="/blog.html">Все заметки и материалы <span aria-hidden="true">→</span></a>
        <ul class="kn-wiki-tree">${sections}</ul>
      </details>
    </nav>`;
}

/* Содержание страницы: h2 материала плюс ссылка на возврат к оглавлению. */
function pageToc(anchors) {
  if (anchors.length < 3) return '';
  return `<nav class="kn-rail-card kn-minitoc-card" aria-label="Содержание страницы">
        <h2>На странице</h2>
        <ol class="kn-minitoc">
          ${anchors.map((a) => '<li><a href="#' + esc(a.id) + '">' + esc(a.text) + '</a></li>').join('\n          ')}
        </ol>
      </nav>`;
}

function topicPage(topic, tree) {
  const note = tree.topicMeta.get(topic.id);
  const body = renderBody(note.body, tree.context);
  const index = tree.order.indexOf(topic.id);
  const prev = tree.order[index - 1] ? tree.topicMeta.get(tree.order[index - 1]) : null;
  const next = tree.order[index + 1] ? tree.topicMeta.get(tree.order[index + 1]) : null;
  const notes = (note.notes || []).map((id) => tree.notesById.get(id)).filter(Boolean);
  const sameGroup = topic.group.items.map((id) => tree.topicMeta.get(id)).filter((item) => item && item.id !== topic.id);
  const sources = (note.sources || []).map((source) => '<li><a href="' + esc(source.url) + '" target="_blank" rel="noopener">'
    + esc(source.title) + '</a>'
    + (source.publisher ? '<small>' + esc(source.publisher) + '</small>' : '')
    + (source.accessed ? '<small>обращение: ' + esc(humanDate(source.accessed)) + '</small>' : '') + '</li>').join('\n          ');

  const aiNote = note.ai
    ? '<p class="kn-ai-note"><strong>Машинная обработка.</strong> Текст структурирован и собран с помощью ИИ на основе материалов автора: структура и формулировки — ассистента, содержание и терминология — авторские. Проверяйте команды и значения на своём стенде.</p>'
    : '';

  return `${head({ title: note.title + ' · itsliventsev', description: clamp(note.summary, 160) })}
<body class="ui-page kn-page-material">
<a class="skip-link" href="#main-content">перейти к содержанию</a>
<main id="main-content">
  <div class="kn-wiki-layout">
  ${wikiNav(tree, topic.id)}
  <article class="kn-wiki-doc">
    <nav class="kn-crumbs" aria-label="Хлебные крошки"><a href="/blog.html#materials">Материалы в заметках</a><span aria-hidden="true">/</span><a href="/blog.html#${esc(topic.section.id)}">${esc(topic.section.title)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(topic.group.title)}</span></nav>
    <header class="kn-note-head">
      <div class="kn-note-meta">
        <a class="ui-tag" href="/blog.html#${esc(topic.section.id)}">${esc(topic.section.num)} ${esc(topic.section.title)}</a>
        <span aria-hidden="true">·</span>
        <span>${esc(topic.group.title)}</span>
        <span aria-hidden="true">·</span>
        <time datetime="${esc(note.updated || note.date)}">обновлено ${esc(humanDate(note.updated || note.date))}</time>
        ${note.level ? '<span aria-hidden="true">·</span><span>' + esc(note.level) + '</span>' : ''}
        ${note.ai ? '<span class="kn-ai">текст структурирован с помощью ИИ</span>' : ''}
      </div>
      <h1>${esc(note.title)}</h1>
      <p class="kn-def">${esc(note.summary)}</p>
    </header>

    ${note.goal ? '<div class="kn-goal"><h2>Что вы будете уметь</h2><ul>' + (Array.isArray(note.goal) ? note.goal : [note.goal]).map((item) => '<li>' + inline(item, tree.context) + '</li>').join('') + '</ul></div>' : ''}

    <div class="kn-note-body">
      ${aiNote}
      ${body.html}
    </div>

    ${notes.length ? `<section class="kn-section" aria-labelledby="materials-notes">
      <div class="kn-group-head"><h2 id="materials-notes">Заметки по теме</h2><span>${notes.length} ${plural(notes.length, 'заметка', 'заметки', 'заметок')}</span></div>
      <ul class="kn-related">
        ${notes.map((item) => '<li><a href="/blog/' + esc(item.id) + '.html"><strong>' + esc(item.title) + '</strong><span>' + esc(item.excerpt) + '</span></a></li>').join('\n        ')}
      </ul>
    </section>` : ''}

    ${sameGroup.length ? `<section class="kn-section" aria-labelledby="materials-siblings">
      <div class="kn-group-head"><h2 id="materials-siblings">Рядом в разделе</h2><span>${esc(topic.group.title)}</span></div>
      <ul class="kn-related">
        ${sameGroup.map((item) => '<li><a href="/blog/materials/' + esc(item.id) + '.html"><strong>' + esc(item.title) + '</strong><span>' + esc(item.summary) + '</span></a></li>').join('\n        ')}
      </ul>
    </section>` : ''}

    ${sources ? `<section class="kn-section" aria-labelledby="materials-sources">
      <div class="kn-group-head"><h2 id="materials-sources">Источники</h2><span>${(note.sources || []).length} ${plural((note.sources || []).length, 'источник', 'источника', 'источников')}</span></div>
      <ol class="kn-sources">
          ${sources}
      </ol>
    </section>` : ''}

    <nav class="kn-pager" aria-label="Соседние темы">
      <a href="/blog.html#${esc(topic.section.id)}">раздел «${esc(topic.section.title)}»</a>
      <span>${next ? '<a href="/blog/materials/' + esc(next.id) + '.html">' + esc(next.title) + ' →</a>' : ''}${prev ? '<a href="/blog/materials/' + esc(prev.id) + '.html">← ' + esc(prev.title) + '</a>' : ''}</span>
    </nav>
  </article>
  </div>
  ${footer()}
</main>
<script src="/assets/shell.js" defer></script>
</body>
</html>
`;
}

/* Указатель: разделы карточками, внутри — группы и темы. Это и есть вход в
   раздел; левое меню на этой странице тоже есть, поэтому переход в тему
   возможен с любого уровня. */
function materialSections(tree) {
  return tree.sections.map((section) => {
    const groups = section.groups.map((group) => {
      const items = group.items.map((id) => tree.topicMeta.get(id)).filter(Boolean);
      if (!items.length) return '';
      return `<div class="kn-mat-group">
          <h4>${esc(group.title)}</h4>
          <ul class="kn-mat-list">
            ${items.map((item) => '<li><a href="/blog/materials/' + esc(item.id) + '.html"><strong>' + esc(item.title) + '</strong><span>' + esc(item.summary) + '</span></a></li>').join('\n            ')}
          </ul>
        </div>`;
    }).join('');
    const count = section.groups.reduce((sum, group) => sum + group.items.length, 0);
    return `<section class="kn-mat-section" id="${esc(section.id)}" aria-labelledby="mat-${esc(section.id)}">
      <div class="kn-group-head">
        <h3 id="mat-${esc(section.id)}"><span class="kn-wiki-num">${esc(section.num)}</span>${esc(section.title)}</h3>
        <span>${count} ${plural(count, 'тема', 'темы', 'тем')} · ${esc(section.short)}</span>
      </div>
      <p class="kn-mat-about">${esc(section.about)}</p>
      ${groups}
    </section>`;
  }).join('\n    ');
}

/* Старый адрес остаётся рабочим и ведёт к объединённому указателю. */
function indexPage() {
  return `${head({ title: 'Материалы переехали · Заметки', description: 'Учебные материалы теперь собраны вместе с заметками.' }).replace(critical.stylesheet('knowledge', false) + '\n', '').replace('</head>', '<meta name="robots" content="noindex, follow">\n<meta http-equiv="refresh" content="0; url=/blog.html#materials">\n<script>if(location.hash) location.replace("/blog.html" + location.hash);</script>\n</head>')}
<body>
<a class="skip-link" href="#main-content">перейти к содержанию</a>
<main id="main-content">
  <header class="ui-pagehead"><h1>Материалы теперь в заметках</h1>
    <p>Учебные материалы и заметки объединены в одной базе знаний.</p>
    <p><a class="ui-btn ui-btn--primary" href="/blog.html#materials">Открыть заметки и материалы</a></p>
  </header>
  ${footer()}
</main>
<script src="/assets/shell.js" defer></script>
</body>
</html>
`;
}

/* ─────────────────────────── проверки ─────────────────────────── */
function validate(tree, notes) {
  const ids = new Set();
  for (const section of tree.sections) {
    for (const group of section.groups) {
      for (const id of group.items) {
        if (ids.has(id)) problems.push(id + ': тема встречается в дереве дважды');
        ids.add(id);
      }
    }
  }
  for (const id of ids) {
    if (!fs.existsSync(path.join(MD_DIR, id + '.md'))) problems.push(id + ': в дереве есть, файла materials/' + id + '.md нет');
  }
  for (const file of fs.readdirSync(MD_DIR).filter((name) => name.endsWith('.md'))) {
    const id = file.replace(/\.md$/, '');
    if (!ids.has(id)) problems.push(id + ': файл есть, но темы нет в materials.json — материал не будет виден');
  }
  const noteIds = new Set(notes.map((note) => note.id));
  for (const [id, topic] of tree.topicMeta) {
    for (const field of ['title', 'summary', 'date', 'readtime']) {
      if (!topic[field]) problems.push(id + ': нет поля ' + field);
    }
    if (!topic.body || topic.body.length < 400) problems.push(id + ': тело короче 400 символов');
    for (const ref of topic.notes || []) {
      if (!noteIds.has(ref)) problems.push(id + ': ссылка на несуществующую заметку ' + ref);
    }
    for (const match of String(topic.body).matchAll(/\[\[([a-z0-9-]+)/g)) {
      if (!noteIds.has(match[1])) problems.push(id + ': в тексте [[ ' + match[1] + ' ]] — такой заметки нет');
    }
    for (const match of String(topic.body).matchAll(/\{\{([a-z0-9-]+)/g)) {
      if (!ids.has(match[1])) problems.push(id + ': в тексте {{ ' + match[1] + ' }} — такой темы нет');
    }
    if (!Array.isArray(topic.sources) || topic.sources.length < 1) problems.push(id + ': нужен хотя бы один источник');
    for (const source of topic.sources || []) {
      if (!source.title || !source.url) problems.push(id + ': источник без title/url');
    }
    if (topic.ai !== true && topic.ai !== false) problems.push(id + ': поле ai обязательно (true/false)');
  }
}

/* ─────────────────────────── main ─────────────────────────── */
function loadTree() {
  const notes = fs.existsSync(NOTES_JSON) ? JSON.parse(read('assets/data/knowledge/notes.json')).notes : [];
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const { topics, order } = flatten(TREE.sections);

  const topicMeta = new Map();
  if (fs.existsSync(MD_DIR)) {
    for (const file of fs.readdirSync(MD_DIR).filter((name) => name.endsWith('.md')).sort()) {
      const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(MD_DIR, file), 'utf8'), file);
      const id = file.replace(/\.md$/, '');
      meta.id = id;
      meta.body = body;
      topicMeta.set(id, meta);
    }
  }

  /* Заголовок темы берём из её файла: {{tema}} в тексте должен подписываться
     так же, как пункт меню, иначе ссылка остаётся без текста (axe: link-name). */
  for (const [id, item] of topics) {
    const meta = topicMeta.get(id);
    if (meta && meta.title) item.title = meta.title;
  }

  const tree = {
    sections: TREE.sections,
    topics,
    order,
    topicMeta,
    notesById,
    context: { notes: notesById, topics },
    topicCount: order.length,
    groupCount: TREE.sections.reduce((sum, section) => sum + section.groups.length, 0),
  };

  return { tree, notes };
}

function main() {
  const { tree, notes } = loadTree();
  const { topics, order, topicMeta } = tree;
  validate(tree, notes);
  if (problems.length) {
    console.error('build-materials: ' + problems.length + ' ошибок');
    problems.slice(0, 40).forEach((problem) => console.error('  ✗ ' + problem));
    process.exitCode = 1;
    return;
  }
  if (CHECK_ONLY) {
    console.log('build-materials --check: ' + tree.topicCount + ' тем, ошибок нет');
    return;
  }

  for (const id of order) {
    const topic = topics.get(id);
    write('blog/materials/' + id + '.html', topicPage(topic, tree));
  }
  write('blog/materials.html', indexPage(tree));

  const words = order.reduce((sum, id) => sum + String(topicMeta.get(id).body).split(/\s+/).length, 0);
  console.log('build-materials: ' + tree.topicCount + ' тем, ' + tree.sections.length + ' разделов, ~' + words + ' слов');
  for (const section of TREE.sections) {
    const count = section.groups.reduce((sum, group) => sum + group.items.length, 0);
    console.log('  · ' + section.num + ' ' + section.title + ' — ' + count + ' тем');
  }
}

if (require.main === module) main();
module.exports = { loadTree, wikiNav, materialSections };
