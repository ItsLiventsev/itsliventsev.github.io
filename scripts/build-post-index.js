#!/usr/bin/env node
/* ==========================================================================
   Сборщик индексов постов для заметок и статей.
   Сканирует blog/*.html и articles/*.html, вытаскивает из каждого файла
   <title>, meta description и служебные meta post-* и пишет posts.json
   рядом с папкой. Запускается локально (`node scripts/build-post-index.js`)
   и автоматически в GitHub Actions после каждого пуша, меняющего посты.

   Конвенция meta-тегов в head поста (все, кроме title/description, опциональны):
     <meta name="post-date"     content="2026-10-26">   // или просто "2026"
     <meta name="post-type"     content="note">         // тип записи
     <meta name="post-tags"     content="пары,сети">    // через запятую
     <meta name="post-readtime" content="2 мин">
     <meta name="post-source"   content="сборник ...">  // только для статей
     <meta name="post-excerpt"  content="...">          // перекрывает description
     <meta name="post-status"   content="draft">        // draft исключается из индекса
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SECTIONS = [
  { dir: 'blog', out: 'blog/posts.json' },
  { dir: 'articles', out: 'articles/posts.json' },
];

function meta(html, name) {
  const re = new RegExp(
    '<meta\\s+(?:name="' + name + '"\\s+content="([^"]*)"|content="([^"]*)"\\s+name="' + name + '")',
    'i'
  );
  const m = html.match(re);
  return (m ? (m[1] || m[2]) : '').trim();
}

function collect(sectionDir) {
  if (!fs.existsSync(sectionDir)) return [];
  return fs.readdirSync(sectionDir)
    .filter((f) => f.endsWith('.html'))
    .map((file) => {
      const html = fs.readFileSync(path.join(sectionDir, file), 'utf8');
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = (titleMatch ? titleMatch[1] : file.replace(/\.html$/, ''))
        .replace(/\s*[·•|]\s*itsliventsev\s*$/i, '')
        .trim();
      const tags = meta(html, 'post-tags')
        .split(',').map((t) => t.trim()).filter(Boolean);
      return {
        slug: file.replace(/\.html$/, ''),
        file,
        title,
        excerpt: meta(html, 'post-excerpt') || meta(html, 'description'),
        date: meta(html, 'post-date'),
        type: meta(html, 'post-type') || 'note',
        tags,
        readtime: meta(html, 'post-readtime'),
        source: meta(html, 'post-source'),
        status: meta(html, 'post-status') || 'published',
      };
    })
    .filter((p) => p.status !== 'draft')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

let changed = 0;
for (const section of SECTIONS) {
  const posts = collect(path.join(ROOT, section.dir));
  const json = JSON.stringify(posts, null, 2) + '\n';
  const outPath = path.join(ROOT, section.out);
  const old = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (old !== json) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json);
    changed++;
    console.log(`обновлён ${section.out}: ${posts.length} запис(ь/и)`);
  } else {
    console.log(`${section.out}: без изменений (${posts.length} запис(ь/и))`);
  }
}

/* ---------- Сводный счётчик разделов для баблов навигации ---------- */
function countHtml(dir, { exclude = [] } = {}) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return 0;
  return fs.readdirSync(full)
    .filter((f) => f.endsWith('.html') && !exclude.includes(f)).length;
}

const counts = {
  blog: collect(path.join(ROOT, 'blog')).length,
  articles: collect(path.join(ROOT, 'articles')).length,
  // глоссарий — служебная страница, в счётчик проектов не идёт;
  // каталог виртуальных стендов stands/ и внешняя серия тренажёров
  // netsys_trainer — две отдельные карточки на projects.html
  projects: countHtml('projects', { exclude: ['glossary.html'] }) + 2,
  archive: countHtml('archive'),
};
const countsPath = path.join(ROOT, 'feed-counts.json');
const countsJson = JSON.stringify(counts, null, 2) + '\n';
const countsOld = fs.existsSync(countsPath) ? fs.readFileSync(countsPath, 'utf8') : '';
if (countsOld !== countsJson) {
  fs.writeFileSync(countsPath, countsJson);
  changed++;
  console.log('обновлён feed-counts.json:', JSON.stringify(counts));
} else {
  console.log('feed-counts.json: без изменений', JSON.stringify(counts));
}
console.log(changed ? `Готово: обновлено файлов — ${changed}.` : 'Готово: всё актуально.');
