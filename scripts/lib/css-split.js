'use strict';
/*
 * Разбор CSS на единицы и раскладка правил по семействам страниц.
 *
 * Задача: pages.css грузится всеми 140 маршрутами, но треть его правил нужна
 * только главной, пятая часть — только кейсам. Разложить такие правила по
 * отдельным файлам можно лишь с гарантией, что ни одно правило компонента не
 * осталось в общем слое: иначе порядок каскада меняется и «поехавшее»
 * оформление всплывает только на одной странице.
 *
 * Поэтому правила объединяются в компоненты по общим классам, и компонент
 * переезжает целиком — все его правила и все его @media.
 */

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.arena', 'docs']);

/* ——— Разбор ——— */

/* Единица — одно правило верхнего уровня. Внутри @media блок разбивается
   на отдельные правила, каждое помнит свой prelude: так медиа-правила
   переезжают вместе с компонентом, а не тянут за собой соседей. */
function parse(css) {
  const units = [];
  const length = css.length;
  let i = 0;
  let pending = '';

  while (i < length) {
    /* комментарий или пробелы перед селектором */
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      const stop = end < 0 ? length : end + 2;
      pending += css.slice(i, stop) + '\n';
      i = stop;
      continue;
    }
    if (/\s/.test(css[i])) { pending += css[i]; i += 1; continue; }

    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();

    if (selector.startsWith('@media') || selector.startsWith('@supports')) {
      const close = matchBrace(css, open);
      const inner = css.slice(open + 1, close);
      const { units: nested } = parse(inner);
      for (const unit of nested) {
        units.push({
          wrappers: [selector, ...unit.wrappers],
          selector: unit.selector,
          body: unit.body,
          comment: unit.comment,
          index: units.length
        });
      }
      pending = '';
      i = close + 1;
      continue;
    }

    const close = matchBrace(css, open);
    units.push({
      wrappers: [],
      selector,
      body: css.slice(open + 1, close),
      comment: pending.trim() ? pending : '',
      index: units.length
    });
    pending = '';
    i = close + 1;
  }
  return { units, tail: pending };
}

function matchBrace(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

/* ——— Классы ——— */

function classesOf(selector) {
  const out = new Set();
  for (const match of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) out.add(match[1]);
  return out;
}

/* Класс, который приходит из разметки или из JS: их и ищем на страницах. */
function pageClasses(html) {
  const body = html.includes('<body') ? html.slice(html.indexOf('<body')) : html;
  const out = new Set();
  for (const match of body.matchAll(/class="([^"]*)"/g)) {
    for (const name of match[1].split(/\s+/)) if (name) out.add(name);
  }
  return out;
}

function routes(root, dir = '.', acc = []) {
  for (const item of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (dir === '.' && SKIP_DIRS.has(item.name)) continue;
    const relative = dir === '.' ? item.name : dir + '/' + item.name;
    if (item.isDirectory()) routes(root, relative, acc);
    else if (item.name.endsWith('.html')) acc.push(relative);
  }
  return acc;
}

/* ——— Компоненты ——— */

/* Юнион-файнд по классам: два правила попадают в один компонент, если у них
   есть общий класс. Компонент переезжает только целиком. */
function components(units) {
  const parent = new Map();
  const find = (value) => {
    let node = value;
    while (parent.get(node) !== node) node = parent.get(node);
    return node;
  };
  const union = (a, b) => {
    const rootA = find(a); const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  units.forEach((unit, index) => {
    const classes = [...classesOf(unit.selector)];
    const node = 'unit:' + index;
    parent.set(node, node);
    if (!classes.length) return;
    for (const name of classes) {
      const key = 'class:' + name;
      if (!parent.has(key)) parent.set(key, key);
      union(node, key);
    }
  });

  const groups = new Map();
  units.forEach((unit, index) => {
    const key = find('unit:' + index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });
  return [...groups.values()];
}

/* ——— Кто использует класс: разметка + скрипты ———

   Часть элементов рождается в JS: `.feed-list` на странице офиса, `.iter-*`
   на главной. Считать только разметку нельзя — правила уедут в чужой слой,
   и страница потеряет оформление без единой ошибки в консоли.

   Ссылки «только спросить» (`querySelector('.home-hero')`, `attr('.article-meta')`)
   стилей не требуют — такие классы перечислены явно. */
function scriptPages(root) {
  const byScript = new Map();
  for (const file of routes(root)) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/<script[^>]+src=["']\/?(assets\/[^"'?#]+)[^"']*["']/gi)) {
      if (!byScript.has(match[1])) byScript.set(match[1], new Set());
      byScript.get(match[1]).add(file);
    }
  }
  return byScript;
}

/* Консервативно учитываем каждое вхождение имени CSS-класса в скрипте:
   строка может быть HTML-шаблоном, аргументом classList или селектором. */
function classUsers(root, classNames) {
  const users = new Map();
  const add = (name, file) => {
    if (!users.has(name)) users.set(name, new Set());
    users.get(name).add(file);
  };
  for (const file of routes(root)) {
    for (const name of pageClasses(fs.readFileSync(path.join(root, file), 'utf8'))) add(name, file);
  }
  for (const [script, audience] of scriptPages(root)) {
    const source = fs.readFileSync(path.join(root, script), 'utf8');
    const words = new Set(source.match(/[A-Za-z][\w-]*/g) || []);
    for (const name of classNames) {
      if (words.has(name)) for (const file of audience) add(name, file);
    }
  }
  return users;
}

module.exports = { parse, classesOf, pageClasses, routes, components, classUsers };
