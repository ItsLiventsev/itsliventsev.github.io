#!/usr/bin/env node
/* ==========================================================================
   Сборщик базы знаний «Заметки».

   Источник правды — assets/data/knowledge/notes.json (заметки с метаданными,
   связями и Markdown-телом) и taxonomy.json (рубрики и словарь тегов).
   С --collect источником становятся Markdown-файлы assets/data/knowledge/notes/*.md
   с YAML-фронтматтером: из них пересобирается notes.json.

   Что пишется:
     blog/<id>.html                  страница заметки (тело, «Связанные», «Источники»)
     blog/topics.html                указатель рубрик
     blog/topics/<zone>.html         страница рубрики
     blog.html                       лента заметок между маркерами KN:AUTO
     blog/posts.json                 манифест ленты (его читает главная)
     feed-counts.json                счётчики навигации
     assets/data/knowledge/registry.json  машинный индекс связей

   Контракты (AGENTS.md): без рантайм-зависимостей, только классы kn-*,
   без инлайн-стилей, SEO-блок между SEO:AUTO собирается scripts/build-seo.js.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const related = require('./lib/related');
const critical = require('./lib/critical-knowledge');
const materials = require('./build-materials');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'assets/data/knowledge');
const MD_DIR = path.join(DATA_DIR, 'notes');
const NOTES_JSON = path.join(DATA_DIR, 'notes.json');
const TAXONOMY = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'taxonomy.json'), 'utf8'));
const SITE = 'https://itsliventsev.github.io';
const COLLECT = process.argv.includes('--collect');
const CHECK_ONLY = process.argv.includes('--check');
const problems = [];

/* ─────────────────────────── утилиты ─────────────────────────── */
const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
/* Версия статики в разметке — хэш содержимого файла (scripts/lib/asset-version.js):
   шаблоны пишут пути без `?v=`, штамп добавляет версию при записи. */
const { stamp } = require('./lib/asset-version');
const write = (file, body) => {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, stamp(body));
};
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
  'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const humanDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + ' ' + y;
};
/* Короткие поля (лид, определение) — обычный текст без разметки, но авторы
   ставят в них `code`: сохраняем его как <code>, экранируя остальное. */
const rich = (value) => esc(value).replace(/`([^`]+)`/g, '<code>$1</code>');
const shortDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return String(d).padStart(2, '0') + '.' + String(m).padStart(2, '0') + '.' + y;
};
const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
};

/* ─────────────────────────── фронтматтер ───────────────────────────
   Мини-YAML: скаляры, inline-списки [a, b], блочные списки «- значение» и
   списки объектов с вложенными полями. Полный YAML не нужен — и не тянет
   зависимость в статический сайт. */
function parseFrontmatter(source, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error(file + ': нет фронтматтера');
  const [, head, body] = match;
  const lines = head.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (!lines.length) throw new Error(file + ': пустой фронтматтер');
  const indentOf = (line) => line.match(/^ */)[0].length;
  const scalar = (raw) => {
    let value = String(raw).trim();
    if (!value) return null;
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map((part) => scalar(part));
    }
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^-?\d+$/.test(value)) return Number(value);
    return value;
  };
  const KEY = /^([A-Za-z0-9_-]+):\s*(.*)$/;
  let i = 0;
  const parseBlock = (baseIndent) => {
    if (lines[i].trim().startsWith('- ')) {
      const array = [];
      while (i < lines.length && indentOf(lines[i]) === baseIndent && lines[i].trim().startsWith('- ')) {
        const content = lines[i].trim().slice(2).trim();
        i++;
        if (KEY.test(content) && !content.startsWith('[')) {
          const first = KEY.exec(content);
          const item = {};
          if (first[2]) item[first[1]] = scalar(first[2]);
          else if (i < lines.length && indentOf(lines[i]) > baseIndent) item[first[1]] = parseBlock(indentOf(lines[i]));
          while (i < lines.length && indentOf(lines[i]) > baseIndent && !lines[i].trim().startsWith('- ')) {
            const key = KEY.exec(lines[i].trim());
            const lineIndent = indentOf(lines[i]);
            i++;
            if (!key) continue;
            if (key[2]) item[key[1]] = scalar(key[2]);
            else if (i < lines.length && indentOf(lines[i]) > lineIndent) item[key[1]] = parseBlock(indentOf(lines[i]));
            else item[key[1]] = null;
          }
          array.push(item);
        } else {
          array.push(scalar(content));
        }
      }
      return array;
    }
    const object = {};
    while (i < lines.length && indentOf(lines[i]) >= baseIndent) {
      const key = KEY.exec(lines[i].trim());
      const lineIndent = indentOf(lines[i]);
      i++;
      if (!key) continue;
      if (key[2]) object[key[1]] = scalar(key[2]);
      else if (i < lines.length && indentOf(lines[i]) > lineIndent) object[key[1]] = parseBlock(indentOf(lines[i]));
      else object[key[1]] = null;
    }
    return object;
  };
  const meta = parseBlock(indentOf(lines[0]));
  return { meta, body: body.trim() };
}

function collectFromMarkdown() {
  if (!fs.existsSync(MD_DIR)) throw new Error('нет каталога ' + path.relative(ROOT, MD_DIR));
  const notes = fs.readdirSync(MD_DIR).filter((f) => f.endsWith('.md')).sort().map((file) => {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(MD_DIR, file), 'utf8'), file);
    if (!meta.id) meta.id = file.replace(/\.md$/, '');
    meta.body = body;
    return meta;
  });
  const json = JSON.stringify({ version: 1, notes }, null, 2) + '\n';
  const changed = !fs.existsSync(NOTES_JSON) || fs.readFileSync(NOTES_JSON, 'utf8') !== json;
  write('assets/data/knowledge/notes.json', json);
  console.log('notes.json ' + (changed ? 'пересобран' : 'без изменений') + ': ' + notes.length + ' заметок');
  return notes;
}

/* ─────────────────────────── валидация ─────────────────────────── */
const ZONES = new Map(TAXONOMY.zones.map((zone) => [zone.id, zone]));
const TAGS = new Set(Object.keys(TAXONOMY.tags));
const REQUIRED = ['id', 'title', 'zone', 'date', 'summary', 'excerpt', 'readtime'];
/* Иллюстраций у заметок нет намеренно: обложка из генератора отвлекала от
   текста и удваивала вес страницы. Карточка в ленте — типографская, поэтому
   вместо картинки показывается крупный номер рубрики и первый абзац. */
const CARD_NUM = new Map(TAXONOMY.zones.map((zone) => [zone.id, zone.num]));

function validate(notes) {
  const ids = new Set(notes.map((note) => note.id));
  if (ids.size !== notes.length) problems.push('повторяющиеся id заметок');
  const slugs = new Set();
  for (const note of notes) {
    const where = note.id || '(без id)';
    for (const field of REQUIRED) {
      if (!note[field]) problems.push(where + ': нет поля ' + field);
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(note.id || '')) problems.push(where + ': id должен быть латиницей в kebab-case');
    if (slugs.has(note.id)) problems.push(where + ': id занят');
    slugs.add(note.id);
    if (!ZONES.has(note.zone)) problems.push(where + ': неизвестная рубрика ' + note.zone);
    const tags = Array.isArray(note.tags) ? note.tags : [];
    if (tags.length < 3 || tags.length > 7) problems.push(where + ': тегов должно быть 3–7, сейчас ' + tags.length);
    for (const tag of tags) if (!TAGS.has(tag)) problems.push(where + ': тег «' + tag + '» отсутствует в taxonomy.json');
    const related = Array.isArray(note.related) ? note.related : [];
    if (related.length < 2) problems.push(where + ': нужно минимум 2 связанные заметки');
    for (const ref of related) {
      if (!ids.has(ref)) problems.push(where + ': связь с несуществующей заметкой ' + ref);
      if (ref === note.id) problems.push(where + ': ссылка на себя в related');
    }
    const sources = Array.isArray(note.sources) ? note.sources : [];
    if (sources.length < 2) problems.push(where + ': нужно минимум 2 источника');
    sources.forEach((source, i) => {
      if (!source || !source.title || !source.url || !source.accessed) problems.push(where + ': источник ' + (i + 1) + ' без title/url/accessed');
      else if (!/^https?:\/\//.test(source.url)) problems.push(where + ': источник ' + (i + 1) + ' не начинается с http');
    });
    if (note.ai !== true && note.ai !== false) problems.push(where + ': поле ai обязательно (true/false)');
    /* Плашку о машинной обработке ставит генератор в шапке и первым блоком
       тела — это свойство шаблона, а не текст автора. Поэтому здесь важно
       только то, что флаг выставлен: без него плашки не будет вовсе. */
    if (!note.body || note.body.length < 300) problems.push(where + ': тело короче 300 символов');
    /* Опечатка в имени блока не должна стоить заметке визуального материала:
       блоки, которых нет в тексте и в {{ключ}}, собираются в конец — это
       допустимо, но неиспользованный ключ почти всегда означает ошибку. */
    const keys = (note.visuals || []).map((visual) => visual.key).filter(Boolean);
    const placed = new Set([...String(note.body || '').matchAll(/\{\{([a-z0-9-]+)\}\}/g)].map((match) => match[1]));
    for (const key of placed) if (!keys.includes(key)) problems.push(where + ': в тексте есть {{' + key + '}}, но такого визуального блока нет');
    for (const visual of note.visuals || []) {
      if (!visual.type) problems.push(where + ': визуальный блок без type');
      if (!['table', 'terms', 'kanban', 'facts'].includes(visual.type)) problems.push(where + ': неизвестный визуальный блок ' + visual.type);
    }
    const linked = [...related];
    for (const match of String(note.body).matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)) linked.push(match[1]);
    for (const ref of linked) if (!ids.has(ref)) problems.push(where + ': ссылка [[ ' + ref + ' ]] ведёт в пустоту');
  }
}

/* ─────────────────────────── Markdown ─────────────────────────── */
function inline(text, notesById) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => '<code>' + code + '</code>');
  out = out.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
    const target = notesById.get(id);
    const href = '/blog/' + id + '.html';
    if (!target) return '<span>' + esc(label || id) + '</span>';
    return '<a class="kn-ref" href="' + href + '">' + esc(label || target.title) + '</a>';
  });
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+|\/[^)\s]+)\)/g,
    (_, label, href) => '<a href="' + href + '"' + (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(«"])__([^_]+)__/g, '$1<em>$2</em>');
  return out;
}

function renderVisual(visual, note) {
  if (visual.type === 'table') {
    const head = (visual.head || []).map((cell) => '<th scope="col">' + esc(cell) + '</th>').join('');
    const rows = (visual.rows || []).map((row) => '<tr>' + row.map((cell, i) =>
      (i === 0 ? '<th scope="row">' + esc(cell) + '</th>' : '<td>' + esc(cell) + '</td>')).join('') + '</tr>').join('');
    return '<div class="kn-table-wrap"><table class="kn-table">'
      + '<thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody>'
      + (visual.caption ? '<caption>' + esc(visual.caption) + '</caption>' : '')
      + '</table></div>';
  }
  if (visual.type === 'terms') {
    const items = (visual.items || []).map((item) => '<div class="kn-term"><dt>' + esc(item.term) + '</dt><dd>' + esc(item.def) + '</dd></div>').join('');
    return '<dl class="kn-terms">' + items + '</dl>';
  }
  if (visual.type === 'facts') {
    const items = (visual.items || []).map((item) => '<dt>' + esc(item.label) + '</dt><dd>' + esc(item.value) + '</dd>').join('');
    return '<dl class="kn-facts">' + items + '</dl>';
  }
  if (visual.type === 'kanban') {
    const lanes = (visual.lanes || []).map((lane) => {
      const tiles = (lane.items || []).map((tile) => '<div class="kn-tile"'
        + (tile.state ? ' data-state="' + esc(tile.state) + '"' : '') + '>'
        + '<strong>' + esc(tile.title) + '</strong>' + (tile.text ? esc(tile.text) : '') + '</div>').join('');
      return '<div class="kn-lane"><p class="kn-lane-head">' + esc(lane.title)
        + '<em>' + String((lane.items || []).length) + '</em></p>' + tiles + '</div>';
    }).join('');
    return '<div class="kn-kanban">' + lanes + '</div>';
  }
  return '';
}

/* Транслитерация заголовка в якорь: кириллица в href допустима, но длинные
   русские id неудобно копировать и они ломаются в старых клиентах. Поэтому
   простая таблица, без зависимостей. */
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};
function headingSlug(text) {
  const plain = String(text).replace(/[*`_]/g, '').replace(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g, '$1').toLowerCase();
  const latin = plain.replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? ch).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return latin || 'razdel';
}

function renderBody(markdown, note, notesById) {
  const visuals = note.visuals || [];
  const used = new Set();
  const usedAnchors = new Set();
  const sectionAnchors = [];
  const takeVisual = (key) => {
    const visual = visuals.find((item) => !used.has(item) && (item.key || item.type) === key);
    if (!visual) return '';
    used.add(visual);
    return renderVisual(visual, note);
  };
  let source = String(markdown).replace(/\{\{([a-z0-9-]+)\}\}/gi, (_, key) => '\n\n@@VIZ:' + key + '@@\n\n');
  const lines = source.split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let inCode = false;
  let codeLines = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push('<p>' + inline(paragraph.join(' '), notesById) + '</p>');
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push('<' + list.type + '>' + list.items.map((item) => '<li>' + inline(item, notesById) + '</li>').join('') + '</' + list.type + '>');
    list = null;
  };
  const flushAll = () => { flushParagraph(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      if (inCode) {
        out.push('<pre><code>' + esc(codeLines.join('\n')) + '</code></pre>');
        codeLines = [];
        inCode = false;
      } else { flushAll(); inCode = true; }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    if (!line.trim()) { flushAll(); continue; }

    const viz = /^@@VIZ:([a-z0-9-]+)@@$/.exec(line.trim());
    if (viz) { flushAll(); out.push(takeVisual(viz[1])); continue; }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2];
      const slug = headingSlug(text);
      /* Якорь нужен конспекту в рельсе: он ведёт к разделу, а не к странице
         целиком. Первый повтор темы получает суффикс, чтобы id не дублились. */
      if (level === 2) {
        let id = slug; let n = 2;
        while (usedAnchors.has(id)) { id = slug + '-' + n; n++; }
        usedAnchors.add(id);
        sectionAnchors.push({ id, text: text.replace(/[*`_]/g, ''), level });
        out.push('<h2 id="' + id + '">' + inline(text, notesById) + '</h2>');
      } else {
        out.push('<h' + level + '>' + inline(text, notesById) + '</h' + level + '>');
      }
      continue;
    }
    if (/^>\s?/.test(line)) { flushAll(); out.push('<blockquote><p>' + inline(line.replace(/^>\s?/, ''), notesById) + '</p></blockquote>'); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushAll(); out.push('<hr>'); continue; }

    /* pipe-таблица: строка «| a | b |» + разделитель «|---|» */
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      flushAll();
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      i--;
      out.push('<div class="kn-table-wrap"><table class="kn-table"><thead><tr>'
        + head.map((cell) => '<th scope="col">' + inline(cell, notesById) + '</th>').join('')
        + '</tr></thead><tbody>'
        + rows.map((row) => '<tr>' + row.map((cell, index) => (index === 0
          ? '<th scope="row">' + inline(cell, notesById) + '</th>'
          : '<td>' + inline(cell, notesById) + '</td>')).join('') + '</tr>').join('')
        + '</tbody></table></div>');
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(bullet[1]);
      continue;
    }
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(numbered[1]);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushAll();
  /* визуальные блоки, которые автор не поставил в текст, идут перед связями */
  for (const visual of visuals) if (!used.has(visual)) out.push(renderVisual(visual, note));
  return { html: out.join('\n        '), anchors: sectionAnchors };
}

/* ─────────────────────────── страница заметки ─────────────────────────── */
const YEAR = 2026;
const order = (note) => String(note.date) + '-' + String(note.id);

function head({ title, description, canonical, extraMeta, criticalNote = false }) {
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
${extraMeta || ''}
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="preload" href="/assets/fonts/literata-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/golos-text-cyrillic-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
${criticalNote ? critical.criticalBlock() + '\n' : ''}${critical.stylesheet('tokens', criticalNote)}
${critical.stylesheet('base', false)}
${critical.stylesheet('pages', criticalNote)}
${critical.stylesheet('knowledge', criticalNote)}
${canonical || '<!-- SEO:AUTO:START --><!-- SEO:AUTO:END -->'}
</head>`;
}

function footer(label) {
  return `<footer class="ui-footer">
    <span>© ${YEAR} itsliventsev · ${esc(label)}</span>
    <nav aria-label="Служебная навигация"><a href="/index.html">Главная</a><a href="/blog.html">Заметки</a><a href="/blog/topics.html">Рубрики</a><a href="/blog.html#materials">Материалы в заметках</a><a href="/feed.xml">RSS</a></nav>
    <time data-footer-updated></time>
  </footer>`;
}

function relatedCard(note, notesById) {
  return '<li><a href="/blog/' + note.id + '.html"><strong>' + esc(note.title) + '</strong><span>'
    + esc(note.excerpt) + '</span></a></li>';
}

function backlinksOf(note, notes) {
  return notes.filter((other) => other.id !== note.id
    && ((other.related || []).includes(note.id) || String(other.body).includes('[[' + note.id))).map((other) => other.id);
}

function notePage(note, notes, notesById, index, registry) {
  const page = renderNotePage(note, notes, notesById, index, registry);
  /* Мост «теория ↔ практика»: блок ссылок на стенды вставляет общий модуль,
     тот же, что собирает обратные ссылки на стендах (scripts/lib/related.js). */
  return related.withNoteBlock(page, note.id);
}

function renderNotePage(note, notes, notesById, index, registry) {
  const body = renderBody(note.body, note, notesById);
  const related = (note.related || []).map((id) => notesById.get(id)).filter(Boolean);
  const backlinks = backlinksOf(note, notes).map((id) => notesById.get(id)).filter(Boolean);
  const zone = ZONES.get(note.zone);
  const prev = notes[index - 1];
  const next = notes[index + 1];
  const neighbours = [];
  if (next) neighbours.push('<a href="/blog/' + next.id + '.html">' + esc(next.title) + ' →</a>');
  if (prev) neighbours.push('<a href="/blog/' + prev.id + '.html">← ' + esc(prev.title) + '</a>');

  const aiNote = note.ai
    ? '<p class="kn-ai-note"><strong>Машинная обработка.</strong> Текст структурирован и оптимизирован с помощью ИИ: структура, формулировки и визуальные блоки собраны ассистентом, источники и наблюдения — авторские. Даты обращения к источникам указаны.</p>'
    : '';

  const sources = (note.sources || []).map((source) => '<li><a href="' + esc(source.url) + '" target="_blank" rel="noopener">'
    + esc(source.title) + '</a>'
    + (source.publisher ? '<small>' + esc(source.publisher) + '</small>' : '')
    + '<small>обращение: ' + esc(humanDate(source.accessed)) + '</small></li>').join('');

  /* Обложек нет — превью заметки в соцсетях собирает build-seo.js
     из общей карточки сайта. */

  return `${head({
    criticalNote: true,
    title: note.title + ' · itsliventsev',
    description: note.summary,
    canonical: '<!-- SEO:AUTO:START --><!-- SEO:AUTO:END -->',
    extraMeta: [
      '<meta name="post-date" content="' + esc(note.date) + '">',
      '<meta name="post-type" content="note">',
      '<meta name="post-tags" content="' + esc((note.tags || []).join(',')) + '">',
      '<meta name="post-readtime" content="' + esc(note.readtime) + '">',
      '<meta name="post-excerpt" content="' + esc(note.excerpt) + '">',
      '<meta name="kn-zone" content="' + esc(note.zone) + '">',
      '<meta name="kn-ai" content="' + (note.ai ? 'machine-assisted' : 'human') + '">',
    ].filter(Boolean).join('\n'),
  })}
<body>
<a class="skip-link" href="#main-content">перейти к содержанию</a>
<main id="main-content">
  <article class="kn-note">
    <div>
      <header class="kn-note-head">
        <div class="kn-note-meta">
          <a class="ui-tag" href="/blog/topics/${esc(note.zone)}.html">${esc(zone.title)}</a>
          <span aria-hidden="true">·</span>
          <time datetime="${esc(note.date)}">${esc(humanDate(note.date))}</time>
          ${note.updated ? '<span aria-hidden="true">·</span><span>обновлено ' + esc(shortDate(note.updated)) + '</span>' : ''}
          <span aria-hidden="true">·</span>
          <span>${esc(note.readtime)}</span>
          ${note.ai ? '<span class="kn-ai">текст структурирован с помощью ИИ</span>' : ''}
        </div>
        <h1>${esc(note.title)}</h1>
        <p class="kn-def">${rich(note.summary)}</p>
      </header>

      <div class="kn-note-body">
        ${aiNote}
        ${body.html}
      </div>

      <section class="kn-section" aria-labelledby="related-title">
        <div class="kn-group-head"><h2 id="related-title">Связанные заметки</h2><span>${related.length} ${plural(related.length, 'связь', 'связи', 'связей')}</span></div>
        <ul class="kn-related">
          ${related.map((item) => relatedCard(item, notesById)).join('\n          ')}
        </ul>
        ${backlinks.length ? '<div class="kn-backlinks"><p>Обратные ссылки</p><ul>'
          + backlinks.map((item) => '<li><a href="/blog/' + item.id + '.html">' + esc(item.title) + '</a> — ссылается на эту заметку</li>').join('')
          + '</ul></div>' : ''}
      </section>

      <section class="kn-section" aria-labelledby="sources-title">
        <div class="kn-group-head"><h2 id="sources-title">Источники</h2><span>${(note.sources || []).length} ${plural((note.sources || []).length, 'источник', 'источника', 'источников')}</span></div>
        <ol class="kn-sources">
          ${sources}
        </ol>
      </section>

      <nav class="kn-pager" aria-label="Соседние заметки">
        <a href="/blog/topics/${esc(note.zone)}.html">все заметки рубрики «${esc(zone.title)}»</a>
        <span>${neighbours.join('')}</span>
      </nav>
    </div>

    <aside class="kn-rail" aria-label="Конспект заметки">
      <div class="kn-rail-card kn-rail-summary">
        <h2>Конспект</h2>
        <p>${esc(zone.title)} · ${String(index + 1).padStart(2, '0')} из ${notes.length} · ${esc(note.readtime)}</p>
        <ol class="kn-minitoc">
          ${body.anchors.map((anchor) => '<li><a href="#' + esc(anchor.id) + '">' + esc(anchor.text) + '</a></li>').join('\n          ')}
        </ol>
      </div>
      <div class="kn-rail-card">
        <h2>Теги</h2>
        <ul class="kn-tagcloud">
          ${(note.tags || []).map((tag) => '<li><a href="/blog/topics.html#' + esc(tag) + '">' + esc(tag) + '</a></li>').join('')}
        </ul>
      </div>
      <div class="kn-rail-card">
        <h2>Куда дальше</h2>
        <ul class="kn-rail-list">
          <li><a href="/blog/topics.html"><span>каталог</span>все рубрики</a></li>
          <li><a href="/blog.html"><span>лента</span>все заметки</a></li>
        </ul>
      </div>
    </aside>
  </article>
  ${footer('Заметки')}
</main>
<script src="/assets/knowledge.js" defer></script>
<script src="/assets/shell.js" defer></script>
</body>
</html>
`;
}


/* Раскладка карточек: каждая строка сетки должна быть заполнена целиком.
   Ширины идут ритмом 8+4, 4+4+4, 4+8, 4+4+4, а остаток последней строки
   забирает её первая карточка — иначе в ленте появляется дырка справа. */
/* Ширины, которые реально выпускает ритм: 12, 8 и 6 колонок. Класс для узких
   карточек (4 колонки) существовал в CSS, но сборщик его не создавал, а лента
   из трёх узких карточек в строке не читается — он удалён вместе с правилами. */
const WIDTH_CLASS = { 12: 'flat', 8: 'wide', 6: 'half' };
function packSizes(count) {
  if (!count) return [];
  const rhythm = [8, 4, 4, 4, 6, 6, 4, 8, 4, 4, 4, 12];
  const widths = [];
  let fill = 0;
  let rowStart = 0;
  for (let i = 0; i < count; i++) {
    if (fill === 0) rowStart = i;
    const remain = 12 - fill;
    const want = rhythm[i % rhythm.length];
    const width = want <= remain ? want : remain;
    widths.push(width);
    fill = (fill + width) % 12;
  }
  if (fill !== 0) widths[rowStart] += 12 - fill;
  return widths.map((width) => WIDTH_CLASS[width] || 'normal');
}

/* ─────────────────────────── рубрики и граф ─────────────────────────── */
function topicCard(note) {
  const sizeClass = String(note.size || '').split(' ')
    .filter((part) => part && part !== 'normal')
    .map((part) => ' kn-card--' + part).join('');
  return `<a class="kn-card${sizeClass}" data-kn-zone="${esc(note.zone)}" data-catalog-tags="${esc(note.zone)}" href="/blog/${esc(note.id)}.html">
        <span class="kn-card-body">
          <span class="kn-card-zone"><span class="kn-card-num" aria-hidden="true">${esc(CARD_NUM.get(note.zone) || '')}</span>${esc(ZONES.get(note.zone).title)}</span>
          <span class="kn-card-title">${esc(note.title)}</span>
          <span class="kn-card-excerpt">${esc(note.excerpt)}</span>
          <span class="kn-card-meta"><time datetime="${esc(note.date)}">${esc(shortDate(note.date))}</time><span aria-hidden="true">·</span><span>${esc(note.readtime)}</span>${note.ai ? '<span class="kn-ai">ии-структура</span>' : ''}</span>
        </span>
      </a>`;
}

function topicsIndex(notes, counts) {
  const rows = TAXONOMY.zones.map((zone) => `<li><a class="kn-topic-row" href="/blog/topics/${esc(zone.id)}.html">
          <span class="kn-zone-num">${esc(zone.num)}</span>
          <span><strong>${esc(zone.title)}</strong><small>${esc(zone.about)}</small></span>
          <span class="kn-zone-count">${counts.get(zone.id) || 0} ${plural(counts.get(zone.id) || 0, 'заметка', 'заметки', 'заметок')}</span>
        </a></li>`).join('\n        ');
  const tagCounts = new Map();
  for (const note of notes) for (const tag of note.tags || []) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  const cloud = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
    .map(([tag, count]) => '<li><a href="#' + esc(tag) + '">' + esc(tag) + ' <em>' + count + '</em></a></li>').join('');

  return `${head({
    title: 'Рубрики заметок · itsliventsev',
    description: 'Шесть рубрик базы знаний: сети, Linux и службы, базы данных, хранение, эксплуатация и практика обучения. Каждая рубрика собирает заметки по одной теме.',
    canonical: '<!-- SEO:AUTO:START --><!-- SEO:AUTO:END -->',
  })}
<body>
<a class="skip-link" href="#main-content">перейти к содержанию</a>
<main id="main-content">
  <header class="ui-pagehead">
    <p class="ui-eyebrow">база знаний · указатель</p>
    <h1>Рубрики</h1>
    <p>Шесть постоянных рубрик: у каждой свой вопрос, на который она отвечает. Заметка попадает ровно в одну рубрику — так каталог остаётся каталогом, а не свалкой тегов.</p>
    <div class="ui-pagehead-meta"><span>${notes.length} ${plural(notes.length, 'заметка', 'заметки', 'заметок')}</span><span>${TAXONOMY.zones.length} рубрик</span><span><a href="/blog.html#materials">материалы в заметках</a></span></div>
  </header>

  <ul class="kn-topic-list">
        ${rows}
  </ul>

  <section class="ui-section" aria-labelledby="tags-title">
    <div class="ui-section-head"><h2 id="tags-title">Теги</h2><span class="ui-kicker">оттенки внутри рубрик</span></div>
    <ul class="kn-tagcloud">${cloud}</ul>
    <div class="kn-table-wrap">
      <table class="kn-table">
        <thead><tr><th scope="col">тег</th><th scope="col">что означает</th><th scope="col">заметок</th></tr></thead>
        <tbody>
          ${Object.entries(TAXONOMY.tags).map(([tag, meaning]) => '<tr id="' + esc(tag) + '"><th scope="row">' + esc(tag) + '</th><td>'
            + esc(meaning) + '</td><td>' + (tagCounts.get(tag) || 0) + '</td></tr>').join('\n          ')}
        </tbody>
      </table>
    </div>
  </section>
  ${footer('Заметки')}
</main>
<script src="/assets/shell.js" defer></script>
</body>
</html>
`;
}

function zonePage(zone, notes) {
  const items = notes.filter((note) => note.zone === zone.id);
  return `${head({
    title: zone.title + ' — заметки · itsliventsev',
    description: zone.description,
    canonical: '<!-- SEO:AUTO:START --><!-- SEO:AUTO:END -->',
  })}
<body>
<a class="skip-link" href="#main-content">перейти к содержанию</a>
<main id="main-content">
  <header class="kn-head">
    <p class="ui-eyebrow">рубрика ${esc(zone.num)} · заметки</p>
    <h1>${esc(zone.title)}</h1>
    <p class="kn-head-lede">${esc(zone.about)}</p>
    <div class="ui-pagehead-meta"><span>${items.length} ${plural(items.length, 'заметка', 'заметки', 'заметок')}</span><span><a href="/blog/topics.html">все рубрики</a></span><span><a href="/blog.html#materials">материалы в заметках</a></span></div>
  </header>

  <div class="kn-stream">
      ${items.map((note, index) => topicCard(Object.assign({}, note, { size: packSizes(items.length)[index] }))).join('\n      ')}
  </div>
  ${items.length ? '' : '<p class="kn-empty">В этой рубрике пока нет заметок.</p>'}

  <div class="ui-callout"><strong>Как читать рубрику.</strong> ${esc(zone.about)} Внутри заметок ссылки ведут на соседние темы: рубрика показывает границу темы, связи — переходы между темами.</div>
  ${footer('Заметки · ' + zone.title)}
</main>
<script src="/assets/shell.js" defer></script>
</body>
</html>
`;
}

/* ─────────────────────────── лента blog.html ─────────────────────────── */
function streamMarkup(notes, registry, counts) {
  const { tree: materialTree } = materials.loadTree();
  const entries = notes.map(note => ({ kind: 'note', date: note.date, title: note.title, note }));
  for (const section of materialTree.sections) {
    for (const group of section.groups) for (const id of group.items) {
      const topic = materialTree.topicMeta.get(id);
      const zones = [...new Set((topic.notes || []).map(id => materialTree.notesById.get(id)?.zone).filter(Boolean))];
      entries.push({ kind: 'material', date: topic.date, title: topic.title, topic, section, zones });
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'ru'));
  const latestUpdated = entries.reduce((best, entry) => {
    const item = entry.note || entry.topic;
    return String(item.updated || item.date) > String(best.updated || best.date) ? item : best;
  }, notes[0]);
  const sizes = packSizes(entries.length);
  const firstSection = new Set();
  const cards = entries.map((entry, index) => {
    if (entry.kind === 'note') return topicCard(Object.assign({}, entry.note, { size: sizes[index] }));
    const { topic, section, zones } = entry;
    const sizeClass = String(sizes[index] || '').split(' ').filter(part => part && part !== 'normal').map(part => ' kn-card--' + part).join('');
    const anchor = firstSection.has(section.id) ? '' : ' id="' + esc(section.id) + '"';
    const headingAnchor = anchor ? ' id="mat-' + esc(section.id) + '"' : '';
    firstSection.add(section.id);
    return `<a class="kn-card${sizeClass}"${anchor} data-catalog-tags="${esc(zones.join(' '))}" href="/blog/materials/${esc(topic.id)}.html">
        <span class="kn-card-body">
          <span class="kn-card-zone"${headingAnchor}>Учебный материал · ${esc(section.title)}</span>
          <span class="kn-card-title">${esc(topic.title)}</span>
          <span class="kn-card-excerpt">${esc(topic.summary)}</span>
          <span class="kn-card-meta"><time datetime="${esc(topic.date)}">${esc(shortDate(topic.date))}</time><span aria-hidden="true">·</span><span>${esc(topic.readtime)}</span>${topic.ai ? '<span class="kn-ai">ии-структура</span>' : ''}</span>
        </span>
      </a>`;
  }).join('\n      ');
  /* Фильтр ленты — общий контракт каталога (assets/catalog.js), а не свой код. */
  const filters = ['<button class="catalog-filter" type="button" aria-pressed="true" data-catalog-filter="all">Все</button>']
    .concat(TAXONOMY.zones.filter((zone) => counts.get(zone.id)).map((zone) =>
      '<button class="catalog-filter" type="button" aria-pressed="false" data-catalog-filter="' + esc(zone.id) + '">'
      + esc(zone.title) + '</button>')).join('');

  return `<!-- KN:AUTO:START · сборка scripts/build-knowledge.js -->
  <div class="kn-wiki-layout kn-unified-layout">
    ${materials.wikiNav(materialTree, '')}
    <div class="kn-wiki-doc kn-unified-content">
  <div class="kn-head">
    <p class="ui-eyebrow">база знаний · лента</p>
    <h1>Заметки</h1>
    <p class="kn-head-lede">Заметки и учебные материалы собраны вместе. Рабочий блокнот сетевого администратора: как устроены протоколы и службы, что показывает диагностика, как ведут себя базы данных и что делать, когда что-то отказывает. Каждая заметка ссылается на соседние — из связей собирается база знаний, а не архив страниц.</p>
    <div class="ui-pagehead-meta">
      <span><b>${entries.length}</b> ${plural(entries.length, 'запись', 'записи', 'записей')} · ${notes.length} ${plural(notes.length, 'заметка', 'заметки', 'заметок')} и ${materialTree.topicCount} учебных ${plural(materialTree.topicCount, 'тема', 'темы', 'тем')}</span>
      <span>${TAXONOMY.zones.length} рубрик</span>
      <span>${registry.edges.length} ${plural(registry.edges.length, 'связь', 'связи', 'связей')}</span>
      <span>обновлено ${shortDate(String(latestUpdated.updated || latestUpdated.date))}</span>
    </div>
  </div>
  <div class="kn-group-head" id="materials"><h2 id="materials-title">Все записи</h2><span>по дате, затем по названию · ${entries.length} ${plural(entries.length, 'запись', 'записи', 'записей')}</span></div>

  <div class="catalog-toolbar">
    <div class="catalog-search" data-catalog-search hidden>
      <label for="note-query">Поиск по заметкам и материалам</label>
      <div class="ui-search-field">
        <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/assets/icons.svg#search"></use></svg>
        <input id="note-query" type="search" placeholder="Слово, тема или тег" autocomplete="off">
      </div>
      <button type="button" data-catalog-clear hidden>Очистить</button>
    </div>
    <div class="kn-rail-row">
      <div class="kn-filterbar" data-catalog-filters role="group" aria-label="Рубрика">${filters}</div>
      <nav class="kn-mini" aria-label="Карта базы знаний"><a href="/blog/topics.html">рубрики</a><a href="/feed.xml">RSS</a></nav>
    </div>
    <p class="catalog-status" data-catalog-status role="status" aria-live="polite"></p>
  </div>

  <div class="kn-stream" data-kn-stream data-catalog-list>
      ${cards}
  </div>
  <p class="kn-empty" data-catalog-empty hidden>По этому фильтру записей нет. <a href="/blog/topics.html">Открыть рубрики</a>.</p>

    </div>
  </div>
  <!-- KN:AUTO:END -->`;
}

/* ─────────────────────── blog.html: обновление файла ─────────────────────── */
function updateBlogPage(notes, registry, counts) {
  const file = 'blog.html';
  const source = read(file);
  const start = '<!-- KN:AUTO:START';
  const end = '<!-- KN:AUTO:END -->';
  const block = streamMarkup(notes, registry, counts);
  let next;
  if (source.includes(start) && source.includes(end)) {
    next = source.replace(new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), block);
  } else {
    throw new Error('blog.html: нет маркеров KN:AUTO — лента не куда вставлять');
  }
  if (next !== source) write(file, next);
  return next !== source;
}

/* ─────────────────────────── манифесты ─────────────────────────── */
function updatePosts(notes) {
  const file = 'blog/posts.json';
  const existing = fs.existsSync(path.join(ROOT, file)) ? JSON.parse(read(file)) : [];
  const manual = existing.filter((post) => !notes.some((note) => note.id === post.slug))
    /* Редирект-заглушки не публикации: их URL жив, но записи в ленте больше нет. */
    .filter((post) => {
      const file = path.join(ROOT, 'blog', post.file || '');
      return fs.existsSync(file) && !/http-equiv="refresh"/i.test(fs.readFileSync(file, 'utf8'));
    });
  const generated = notes.slice().sort((a, b) => b.date.localeCompare(a.date)).map((note) => ({
    slug: note.id,
    file: note.id + '.html',
    title: note.title,
    excerpt: note.excerpt,
    date: note.date,
    type: 'note',
    tags: note.tags,
    readtime: note.readtime,
    source: '',
    status: 'published',
  }));
  const merged = generated.concat(manual).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const json = JSON.stringify(merged, null, 2) + '\n';
  const changed = !fs.existsSync(path.join(ROOT, file)) || read(file) !== json;
  if (changed) write(file, json);
  return merged;
}

/* Счётчик раздела — это число публикаций, а не файлов в папке: в blog/ лежат
   ещё редирект-заглушки переехавших заметок, и подсчёт по файлам давал 59
   вместо 45. Источник истины — тот же список, что попадает в posts.json
   (scripts/build-post-index.js считает так же). */
function updateFeedCounts(blogPosts) {
  const file = 'feed-counts.json';
  const counts = fs.existsSync(path.join(ROOT, file)) ? JSON.parse(read(file)) : {};
  const next = Object.assign({}, counts, { blog: blogPosts });
  const json = JSON.stringify(next, null, 2) + '\n';
  const changed = read(file) !== json;
  if (changed) write(file, json);
  return next;
}

/* ─────────────────────────── main ─────────────────────────── */
function main() {
  const notes = COLLECT ? collectFromMarkdown()
    : JSON.parse(fs.readFileSync(NOTES_JSON, 'utf8')).notes;
  validate(notes);
  if (problems.length) {
    console.error('build-knowledge: ' + problems.length + ' ошибок');
    problems.slice(0, 40).forEach((problem) => console.error('  ✗ ' + problem));
    process.exitCode = 1;
    return;
  }
  if (CHECK_ONLY) {
    console.log('build-knowledge --check: ' + notes.length + ' заметок, ошибок нет');
    return;
  }

  const notesById = new Map(notes.map((note) => [note.id, note]));
  const sorted = notes.slice().sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const edges = [];
  for (const note of notes) {
    const targets = new Set();
    for (const ref of note.related || []) targets.add(ref);
    for (const match of String(note.body).matchAll(/\[\[([a-z0-9-]+)/g)) targets.add(match[1]);
    targets.delete(note.id);
    for (const target of targets) edges.push({ from: note.id, to: target });
  }
  const sources = notes.reduce((sum, note) => sum + (note.sources || []).length, 0);
  const registry = {
    generated: new Date().toISOString().slice(0, 10),
    notes: sorted.length,
    sources,
    edges,
    backlinks: Object.fromEntries(notes.map((note) => [note.id, edges.filter((edge) => edge.to === note.id).map((edge) => edge.from)])),
  };
  const counts = new Map();
  for (const note of notes) counts.set(note.zone, (counts.get(note.zone) || 0) + 1);

  write('assets/data/knowledge/registry.json', JSON.stringify(registry, null, 2) + '\n');

  /* порядок страницы: от старых к новым — «запись 01» в паспорте растёт со временем,
     а соседние записи листаются как страницы блокнота. */
  const chronicle = notes.slice().sort((a, b) => order(a).localeCompare(order(b)));
  chronicle.forEach((note, index) => {
    write('blog/' + note.id + '.html', notePage(note, chronicle, notesById, index, registry));
  });
  write('blog/topics.html', topicsIndex(sorted, counts));
  TAXONOMY.zones.forEach((zone) => write('blog/topics/' + zone.id + '.html', zonePage(zone, sorted)));

  const blogChanged = updateBlogPage(sorted, registry, counts);
  const posts = updatePosts(sorted);
  const feed = updateFeedCounts(posts.length);

  console.log('build-knowledge: ' + sorted.length + ' заметок, ' + edges.length + ' связей, '
    + sources + ' источников, ' + counts.size + ' рубрик');
  console.log('  blog.html: ' + (blogChanged ? 'лента пересобрана' : 'без изменений')
    + '; posts.json: ' + posts.length + ' записей; feed-counts.blog: ' + feed.blog);
  for (const note of sorted) {
    const words = String(note.body).split(/\s+/).length;
    console.log('  · ' + note.id + ' — "' + note.title + '", ~' + words + ' слов, связи: '
      + (edges.filter((edge) => edge.from === note.id).length) + ', обратные: '
      + registry.backlinks[note.id].length);
  }
}

main();
