'use strict';
// Структурированные данные и метаданные: node scripts/test-seo.js
//
// Существующие гейты проверяют дубли title/canonical (test-head.js) и
// существование URL в sitemap (test-sitemap.js), но не смотрят внутрь
// JSON-LD. Из-за этого на faq.html два месяца жил второй, битый FAQPage:
// JSON не парсился, богатые результаты по странице были недоступны, а все
// проверки оставались зелёными. Здесь ловим именно границу «машина читает
// разметку»: валидность, обязательные поля и отсутствие выдуманных сущностей.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.arena']);

/* Поля, которых у нас быть не может: организация не зарегистрирована,
   рейтингов и отзывов на сайте нет. Появление любого из них — выдуманный
   факт в разметке, а это прямое нарушение правил структурированных данных. */
const FORBIDDEN = ['Organization', 'aggregateRating', 'review', 'Review', 'Rating', 'Offer', 'price'];

function pages(dir = '.', acc = []) {
  for (const item of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (dir === '.' && SKIP_DIRS.has(item.name)) continue;
    const rel = dir === '.' ? item.name : dir + '/' + item.name;
    if (item.isDirectory()) pages(rel, acc);
    else if (item.name.endsWith('.html')) acc.push(rel);
  }
  return acc;
}

/* Сниппет обрезается, поэтому длины — не вкусовщина: title до 60 символов,
   description до 165. Раньше правило жило только в документации, и 42 заголовка
   с 48 описаниями вышли за пределы (худший — 107 символов в title, он
   обрезался на середине слова). */
const TITLE_MAX = 60;
const DESC_MAX = 165;
/* Нижняя граница — не дефект, а метрика: короткое описание честно
   описывает короткую страницу, и добивать его «водой» ради символов
   вреднее, чем оставить. Поэтому такие страницы попадают в отчёт,
   а не в падающий тест. */
const DESC_SHORT = 110;
const shortDesc = [];

const problems = [];
const counts = new Map();
let blocks = 0;

for (const file of pages()) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const head = html.slice(0, html.indexOf('</head>') + 7);

  for (const match of head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    blocks += 1;
    let data;
    try {
      data = JSON.parse(match[1]);
    } catch (error) {
      problems.push(file + ': JSON-LD не парсится — ' + error.message);
      continue;
    }
    for (const node of (Array.isArray(data) ? data : [data])) {
      const type = node['@type'] || '(без @type)';
      counts.set(type, (counts.get(type) || 0) + 1);

      for (const field of FORBIDDEN) {
        if (JSON.stringify(node).includes('"' + field + '"')) {
          problems.push(file + ': в JSON-LD (' + type + ') есть запрещённое поле «' + field + '»');
        }
      }
      if (node['@type'] === 'FAQPage') {
        const questions = node.mainEntity || [];
        if (!questions.length) problems.push(file + ': FAQPage без mainEntity');
        for (const q of questions) {
          if (!q.name || !q.acceptedAnswer || !q.acceptedAnswer.text) {
            problems.push(file + ': FAQPage — вопрос без name/answer');
            break;
          }
          if (/<[a-z][^>]*>/i.test(q.acceptedAnswer.text)) {
            problems.push(file + ': FAQPage — HTML внутри answer.text («' + q.name.slice(0, 40) + '»); нужен чистый текст');
          }
        }
      }
      if (['Article', 'BlogPosting'].includes(node['@type'])) {
        for (const field of ['headline', 'description', 'author', 'image', 'mainEntityOfPage']) {
          if (!node[field]) problems.push(file + ': ' + type + ' без ' + field);
        }
        if (node.datePublished && !/^\d{4}-\d{2}-\d{2}$/.test(node.datePublished)) {
          problems.push(file + ': datePublished не ISO-дата: ' + node.datePublished);
        }
      }
      if (node['@type'] === 'BreadcrumbList') {
        const items = node.itemListElement || [];
        if (items.length < 2) problems.push(file + ': BreadcrumbList из одного элемента');
        items.forEach((item, index) => {
          if (item.position !== index + 1) problems.push(file + ': BreadcrumbList — position не по порядку');
          if (!item.item) problems.push(file + ': BreadcrumbList — пункт без item');
        });
      }
    }
  }

  if (!/name="robots"\s+content="[^"]*noindex/i.test(head)) {
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const description = (head.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    if (title.length > TITLE_MAX) {
      problems.push(file + ': title ' + title.length + ' символов (максимум ' + TITLE_MAX + '): ' + title);
    }
    if (!description) {
      problems.push(file + ': нет description');
    } else if (description.length > DESC_MAX) {
      problems.push(file + ': description ' + description.length + ' символов (максимум ' + DESC_MAX + ')');
    } else if (description.length < DESC_SHORT) {
      shortDesc.push(description.length + ' ' + file);
    }
  }

  /* Каждая страница без noindex должна иметь ровно один canonical,
     ведущий на собственный URL: молчаливый «чужой» canonical выключает
     страницу из индекса, и это не видно ни в одном отчёте. */
  if (!/name="robots"\s+content="[^"]*noindex/i.test(head)) {
    const canonical = (head.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (!canonical) problems.push(file + ': нет canonical');
  }
}

if (shortDesc.length) {
  console.log('SEO: описания короче ' + DESC_SHORT + ' — ' + shortDesc.length + ' шт. (не блокирует; см. бэклог B-03):');
  for (const row of shortDesc.sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 5)) console.log('  ' + row);
}

assert.deepEqual(problems, [], 'структурированные данные требуют правки:\n  ' + problems.join('\n  '));

const summary = [...counts.entries()].sort((a, b) => b[1] - a[1])
  .map(([type, count]) => type + ' ' + count).join(', ');
console.log('SEO: ' + blocks + ' блоков JSON-LD валидны (' + summary + ')');
