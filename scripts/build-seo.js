#!/usr/bin/env node
/* ==========================================================================
   SEO-сборщик статического сайта.
   Идемпотентно обогащает <head> всех индексируемых HTML и генерирует:
     - sitemap.xml  (абсолютные URL, приоритеты, lastmod из дат постов)
     - feed.xml     (RSS 2.0: заметки + статьи)
   Встраиваемый блок помечен маркерами SEO:AUTO — повторный запуск
   заменяет блок, а не дублирует теги. Ручные og:/twitter: meta удаляются
   и пересобираются внутри блока.
   Запуск: node scripts/build-seo.js  (локально и в GitHub Actions)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = (process.env.SITE_URL || 'https://itsliventsev.github.io').replace(/\/$/, '');
const BLOCK_START = '<!-- SEO:AUTO:START -->';
const BLOCK_END = '<!-- SEO:AUTO:END -->';

// Страницы, которые не должны попадать в индекс и получать разметку
// 404/admin — служебные; stands/league.html — персональные данные студентов
const NOINDEX = new Set(['404.html', 'admin.html', 'stands/league.html']);

// Явный <meta name="robots" content="noindex"> на странице тоже исключает её из индекса и sitemap
function isNoindex(html) {
  return /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
}

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const abs = (rel) => SITE_URL + '/' + rel.replace(/^index\.html$/, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function walk(dir) {
  if (!fs.existsSync(path.join(ROOT, dir))) return [];
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name.startsWith('.') ? [] : walk(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

function meta(html, name) {
  const re = new RegExp(
    '<meta\\s+(?:name="' + name + '"\\s+content="([^"]*)"|content="([^"]*)"\\s+name="' + name + '")', 'i'
  );
  const m = html.match(re);
  return m ? (m[1] || m[2] || '').trim() : '';
}

// Даты публикаций из posts.json (+ запасной разбор meta post-date)
function loadPostDates() {
  const map = new Map();
  for (const idx of ['blog/posts.json', 'articles/posts.json']) {
    const fp = path.join(ROOT, idx);
    if (!fs.existsSync(fp)) continue;
    const dir = idx.split('/')[0];
    for (const post of JSON.parse(fs.readFileSync(fp, 'utf8'))) {
      if (post.status === 'draft' || !post.date) continue;
      map.set(dir + '/' + post.file, { date: String(post.date), tags: post.tags || [], type: post.type || '' });
    }
  }
  return map;
}
const postDates = loadPostDates();

function pageInfo(rel, html) {
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [, ''])[1].trim();
  const headline = title.replace(/\s*·\s*itsliventsev\s*$/, '');
  const description = meta(html, 'description');
  const tags = (meta(html, 'post-tags') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const postDate = meta(html, 'post-date') || (postDates.get(rel) || {}).date || '';
  const normDate = postDate ? (postDate.length === 4 ? postDate + '-01-01' : postDate) : '';
  const dir = rel.includes('/') ? rel.split('/')[0] : '';

  let type = 'website';          // og:type
  let schema = 'CollectionPage'; // JSON-LD
  if (dir === 'blog') { type = 'article'; schema = 'BlogPosting'; }
  else if (dir === 'articles' || dir === 'archive' || rel.startsWith('projects/')) {
    type = 'article'; schema = 'Article';
  } else if (dir === 'stands' && rel !== 'stands/index.html') {
    type = 'article'; schema = 'Article'; // лабораторный стенд — материал-инструкция
  } else if (rel === 'index.html') { schema = 'Home'; }

  // Хлебные крошки
  const sectionNames = { blog: 'заметки', articles: 'статьи', archive: 'архив', projects: 'проекты' };
  const crumbs = [{ name: 'главная', url: SITE_URL + '/' }];
  if (dir === 'stands') {
    // раздел практик: главная → проекты → портал вселенных → вселенная → страница
    crumbs.push({ name: 'проекты', url: SITE_URL + '/projects.html' });
    crumbs.push({ name: 'учебные вселенные', url: SITE_URL + '/stands/index.html' });
    if (rel.startsWith('stands/ops/')) {
      crumbs.push({ name: 'ДатаПолис', url: SITE_URL + '/stands/ops/index.html' });
      if (rel !== 'stands/ops/index.html') crumbs.push({ name: headline, url: abs(rel) });
    } else if (rel !== 'stands/index.html') {
      crumbs.push({ name: headline, url: abs(rel) });
    }
  } else if (dir) {
    crumbs.push({ name: sectionNames[dir] || dir, url: SITE_URL + '/' + dir + '.html' });
    crumbs.push({ name: headline, url: abs(rel) });
  }
  return { title, headline, description, tags, date: normDate, type, schema, crumbs, dir };
}

function jsonLd(rel, info) {
  const url = abs(rel);
  const person = {
    '@type': 'Person', name: 'itsliventsev', url: SITE_URL + '/',
    sameAs: ['https://github.com/ItsLiventsev'],
  };
  const graphs = [];

  if (info.schema === 'Home') {
    graphs.push({
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: 'itsliventsev', url: SITE_URL + '/', description: info.description,
      inLanguage: 'ru-RU', publisher: { '@type': 'Person', name: 'itsliventsev' },
    });
    graphs.push({ '@context': 'https://schema.org', ...person, jobTitle: 'мастер производственного обучения' });
  } else if (info.schema === 'CollectionPage') {
    graphs.push({
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: info.headline, description: info.description, url, inLanguage: 'ru-RU',
      isPartOf: { '@type': 'WebSite', name: 'itsliventsev', url: SITE_URL + '/' },
    });
  } else {
    const node = {
      '@context': 'https://schema.org', '@type': info.schema,
      headline: info.headline, description: info.description, url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: 'ru-RU', author: person, publisher: { '@type': 'Person', name: 'itsliventsev' },
      image: SITE_URL + '/assets/og.png',
    };
    if (info.date) { node.datePublished = info.date; node.dateModified = info.date; }
    if (info.tags.length) node.keywords = info.tags.join(', ');
    if (info.schema === 'Article' && rel.startsWith('articles/')) node.articleSection = 'Образование';
    graphs.push(node);
  }

  if (info.crumbs.length > 1) {
    graphs.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: info.crumbs.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: c.name, item: c.url,
      })),
    });
  }
  return graphs.map((g) => '<script type="application/ld+json">' + JSON.stringify(g, null, 0) + '</script>').join('\n  ');
}

function buildBlock(rel, info) {
  const url = abs(rel);
  const img = SITE_URL + '/assets/og.png';
  const lines = [BLOCK_START];
  lines.push(`<link rel="canonical" href="${url}">`);
  lines.push('<link rel="icon" type="image/png" sizes="192x192" href="' + SITE_URL + '/assets/icon-192.png">');
  lines.push('<link rel="apple-touch-icon" href="' + SITE_URL + '/assets/apple-touch-icon.png">');
  lines.push('<link rel="manifest" href="' + SITE_URL + '/site.webmanifest">');
  lines.push('<link rel="alternate" type="application/rss+xml" title="itsliventsev · заметки и статьи" href="' + SITE_URL + '/feed.xml">');

  // Open Graph
  lines.push(`<meta property="og:type" content="${info.type}">`);
  lines.push('<meta property="og:site_name" content="itsliventsev">');
  lines.push('<meta property="og:locale" content="ru_RU">');
  lines.push(`<meta property="og:title" content="${esc(info.title)}">`);
  lines.push(`<meta property="og:description" content="${esc(info.description)}">`);
  lines.push(`<meta property="og:url" content="${url}">`);
  lines.push(`<meta property="og:image" content="${img}">`);
  lines.push('<meta property="og:image:type" content="image/png">');
  lines.push('<meta property="og:image:width" content="1200">');
  lines.push('<meta property="og:image:height" content="630">');
  if (info.type === 'article' && info.date) lines.push(`<meta property="article:published_time" content="${info.date}">`);
  info.tags.forEach((t) => lines.push(`<meta property="article:tag" content="${esc(t)}">`));

  // Twitter
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  lines.push(`<meta name="twitter:title" content="${esc(info.title)}">`);
  lines.push(`<meta name="twitter:description" content="${esc(info.description)}">`);
  lines.push(`<meta name="twitter:image" content="${img}">`);

  lines.push(jsonLd(rel, info));
  lines.push(BLOCK_END);
  return lines.join('\n  ');
}

function stripAutoAndSocial(html) {
  // Удаляем предыдущий авто-блок
  const reBlock = new RegExp('[ \\t]*' + BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' + BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?', 'g');
  let out = html.replace(reBlock, '');
  // Удаляем ручные OG/Twitter meta — они полностью пересобираются в блоке
  out = out.replace(/[ \t]*<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\n?/g, '');
  // Старый canonical (если появится при ручной правке)
  out = out.replace(/[ \t]*<link\s+rel="canonical"[^>]*>\n?/g, '');
  return out;
}

const pages = walk('.').map((p) => p.replace(/^\.\//, ''));
const sitemapEntries = [];

for (const rel of pages) {
  let html = read(rel);
  if (NOINDEX.has(rel) || isNoindex(html)) continue;

  const info = pageInfo(rel, html);
  if (!info.description) {
    console.warn('! без description:', rel);
  }
  html = stripAutoAndSocial(html);
  const block = buildBlock(rel, info);
  if (!html.includes('</head>')) throw new Error('нет </head>: ' + rel);
  html = html.replace('</head>', '  ' + block + '\n</head>');
  write(rel, html);

  // Данные для sitemap: приоритет по типу страницы
  const priority = rel === 'index.html' ? '1.0'
    : !rel.includes('/') ? '0.8'
    : '0.7';
  const changefreq = !rel.includes('/') ? 'weekly' : 'yearly';
  sitemapEntries.push({ rel, url: abs(rel), date: info.date, priority, changefreq });
}

/* ---------- sitemap.xml ---------- */
const today = new Date().toISOString().slice(0, 10);
// lastmod хаба = самая свежая дата среди его дочерних страниц
const latestByDir = {};
for (const e of sitemapEntries) {
  if (!e.date) continue;
  const d = e.rel.includes('/') ? e.rel.split('/')[0] : '';
  if (d && (!latestByDir[d] || e.date > latestByDir[d])) latestByDir[d] = e.date;
}
const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapEntries
    .sort((a, b) => (a.rel === 'index.html' ? -1 : b.rel === 'index.html' ? 1 : a.rel.localeCompare(b.rel)))
    .map((e) => {
      const lastmod = e.date || (e.rel.endsWith('.html') && !e.rel.includes('/')
        ? (latestByDir[Object.keys(latestByDir).find((d) => e.rel.startsWith(d))] || today)
        : '');
      return [
        '  <url>',
        `    <loc>${esc(e.url)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        '  </url>',
      ].filter(Boolean).join('\n');
    }),
  '</urlset>', ''].join('\n');
write('sitemap.xml', sitemap);

/* ---------- feed.xml (RSS 2.0) ---------- */
function rfc822(d) {
  const dt = new Date(d.length === 4 ? d + '-01-01T00:00:00Z' : d + 'T12:00:00Z');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getUTCDay()]}, ${String(dt.getUTCDate()).padStart(2, '0')} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()} 12:00:00 GMT`;
}
const feedItems = [];
for (const idx of ['blog/posts.json', 'articles/posts.json']) {
  const fp = path.join(ROOT, idx);
  if (!fs.existsSync(fp)) continue;
  const dir = idx.split('/')[0];
  for (const p of JSON.parse(fs.readFileSync(fp, 'utf8'))) {
    if (p.status === 'draft') continue;
    feedItems.push({
      title: p.title, desc: p.excerpt || '', date: String(p.date),
      url: SITE_URL + '/' + dir + '/' + p.file, dir,
    });
  }
}
feedItems.sort((a, b) => b.date.localeCompare(a.date));
const rss = ['<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '  <channel>',
  '    <title>itsliventsev — заметки и статьи</title>',
  `    <link>${SITE_URL}/</link>`,
  '    <description>Заметки, статьи и учебные материалы по сетям, системному администрированию и IT-образованию.</description>',
  '    <language>ru-RU</language>',
  `    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>`,
  ...feedItems.map((i) => [
    '    <item>',
    `      <title>${esc(i.title)}</title>`,
    `      <link>${esc(i.url)}</link>`,
    `      <guid isPermaLink="true">${esc(i.url)}</guid>`,
    `      <pubDate>${rfc822(i.date)}</pubDate>`,
    `      <category>${esc(i.dir === 'blog' ? 'заметки' : 'статьи')}</category>`,
    `      <description>${esc(i.desc)}</description>`,
    '    </item>',
  ].join('\n')),
  '  </channel>',
  '</rss>', ''].join('\n');
write('feed.xml', rss);

console.log(`SEO: обработано страниц ${sitemapEntries.length}, sitemap.xml и feed.xml обновлены (${SITE_URL})`);
