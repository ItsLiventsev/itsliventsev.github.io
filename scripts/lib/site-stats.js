'use strict';
/* Единственный источник чисел главной: и разметка, и проверка считают их здесь.
   Раньше «41 работа» и «52 маршрута» были вписаны руками, скрипта не было вовсе —
   поэтому числа расходились с сайтом и никто этого не замечал. */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

/* Страницы раздела практики, которые не являются заданием: хабы, служебные
   экраны лиги и словарь. Всё остальное — работа: лабораторная или модуль. */
const SERVICE_PAGES = new Set([
  'stands/index.html',
  'stands/glossary.html',
  'stands/league.html',
  'stands/teams.html',
  'stands/rewards.html',
  'stands/setpolis.html',
  'stands/office/index.html',
  'stands/office/rewards.html',
  'stands/ops/index.html',
  'stands/ops/rewards.html'
]);

const UNIVERSES = ['stands/setpolis.html', 'stands/office/index.html', 'stands/ops/index.html'];

function walk(dir, acc = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return acc;
  for (const item of fs.readdirSync(full, { withFileTypes: true })) {
    const relative = path.posix.join(dir, item.name);
    if (item.isDirectory()) walk(relative, acc);
    else if (item.name.endsWith('.html')) acc.push(relative);
  }
  return acc;
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function stats() {
  const routes = walk('stands');
  const works = routes.filter(file => !SERVICE_PAGES.has(file));
  const glossary = read('stands/glossary.html');
  const terms = (glossary.match(/class="glossary-item"/g) || []).length;
  const notes = walk('blog').filter(file => /^blog\/kn-[a-z0-9-]+\.html$/.test(file));
  return {
    universes: UNIVERSES.filter(file => fs.existsSync(path.join(ROOT, file))).length,
    works: works.length,
    routes: routes.length,
    terms,
    notes: notes.length,
    /* для отчёта и проверок: что именно посчитали */
    worksFiles: works,
    universeFiles: UNIVERSES
  };
}

module.exports = { stats, UNIVERSES, SERVICE_PAGES };

if (require.main === module) {
  const value = stats();
  console.log(JSON.stringify({
    universes: value.universes, works: value.works, routes: value.routes,
    terms: value.terms, notes: value.notes
  }, null, 1));
}
