#!/usr/bin/env node
/* ==========================================================================
   Снимок истории основной ветки для блока «Сайт собирается итерациями».

   Зачем файл, а не прямой запрос из браузера:
   • api.github.com без токена даёт 60 запросов в час на IP — у посетителей
     лимит выбивается мгновенно, блок пустеет и в консоль летит ошибка;
   • снимок отдаётся с того же домена, кэшируется сервис-воркером и работает
     офлайн, как остальной сайт;
   • цифры остаются настоящими: данные берутся из GitHub Actions при каждом
     пуше в main и при ежедневном расписании.

   Запуск локально:  node scripts/build-activity.js
   С токеном (выше лимит):  GITHUB_TOKEN=... node scripts/build-activity.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const OWNER = process.env.ACTIVITY_OWNER || 'ItsLiventsev';
const REPO = process.env.ACTIVITY_REPO || 'itsliventsev.github.io';
const BRANCH = process.env.ACTIVITY_BRANCH || 'main';
const WINDOW_DAYS = 30;
const MAX_PAGES = 4;
const PER_PAGE = 100;
const COMMITS_KEPT = 60;
// Содержательные коммиты: merge-ветки и служебные сборки индексов не считаем,
// иначе график показывает работу бота, а не правки сайта.
const BOT_LOGINS = ['github-actions[bot]', 'dependabot[bot]'];
const BOT_NAMES = ['github-actions[bot]', 'github-actions'];
const OUT = path.join(process.cwd(), 'assets', 'data', 'activity.json');

const DAY_MS = 86400000;

function utcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isoDay(dayMs) {
  return new Date(dayMs).toISOString().slice(0, 10);
}

async function getJson(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'itsliventsev-site-activity',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('GitHub API ' + response.status + ' на ' + url);
    return await response.json();
  } catch (error) {
    // В некоторых песочницах у Node нет выхода в сеть, а у curl есть.
    // В GitHub Actions всегда работает первый путь, это лишь локальный фолбэк.
    return JSON.parse(curlJson(url, headers));
  }
}

function curlJson(url, headers) {
  const { execFileSync } = require('child_process');
  const args = ['-sS', '--max-time', '30'];
  Object.entries(headers).forEach(([name, value]) => args.push('-H', name + ': ' + value));
  args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

async function collect() {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();
  const commits = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/commits'
      + '?sha=' + BRANCH + '&since=' + encodeURIComponent(since)
      + '&per_page=' + PER_PAGE + '&page=' + page;
    const batch = await getJson(url);
    if (!Array.isArray(batch)) throw new Error('неожиданный ответ API');
    commits.push(...batch);
    if (batch.length < PER_PAGE) break;
    if (page === MAX_PAGES) truncated = true;
  }
  return { commits, truncated };
}

function isWork(commit, title) {
  if (/^merge\b/i.test(title)) return false;
  const login = String(commit.author?.login || '');
  const name = String(commit.commit?.author?.name || '');
  if (BOT_LOGINS.includes(login) || BOT_NAMES.includes(name)) return false;
  return true;
}

function normalize(commit) {
  const message = String(commit.commit?.message || '').split('\n')[0].trim();
  const date = commit.commit?.committer?.date || commit.commit?.author?.date || '';
  return {
    sha: String(commit.sha || '').slice(0, 7),
    full: String(commit.sha || ''),
    title: message || 'без описания',
    date,
    url: 'https://github.com/' + OWNER + '/' + REPO + '/commit/' + commit.sha,
  };
}

function buildDays(commits) {
  const today = utcDay(new Date());
  const days = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    days.push({ date: isoDay(today - offset * DAY_MS), count: 0 });
  }
  const index = new Map(days.map((entry, position) => [entry.date, position]));
  commits.forEach(commit => {
    const date = new Date(commit.date);
    if (Number.isNaN(date.getTime())) return;
    const position = index.get(isoDay(utcDay(date)));
    if (position !== undefined) days[position].count += 1;
  });
  return days;
}

(async () => {
  try {
    const { commits, truncated } = await collect();
    const items = commits
      .filter(commit => isWork(commit, String(commit.commit?.message || '').split('\n')[0].trim()))
      .map(normalize)
      .filter(item => item.date);
    const days = buildDays(items);
    const payload = {
      generated: new Date().toISOString(),
      repo: OWNER + '/' + REPO,
      branch: BRANCH,
      window: WINDOW_DAYS,
      total: items.length,
      truncated,
      days,
      commits: items.slice(0, COMMITS_KEPT).map(({ full, ...rest }) => rest),
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const next = JSON.stringify(payload, null, 2) + '\n';
    const previous = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    const previousData = previous ? JSON.parse(previous) : null;
    const sameCommits = previousData
      && JSON.stringify(previousData.commits) === JSON.stringify(payload.commits)
      && JSON.stringify(previousData.days) === JSON.stringify(payload.days);
    if (sameCommits) {
      // Освежаем только отметку времени, чтобы файл не шумел в диффе.
      payload.generated = previousData.generated;
      fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
      console.log('activity: без изменений — ' + payload.total + ' коммитов за ' + WINDOW_DAYS + ' дней');
      return;
    }
    fs.writeFileSync(OUT, next);
    console.log('activity: ' + payload.total + ' коммитов за ' + WINDOW_DAYS + ' дней, файл ' + path.relative(process.cwd(), OUT));
  } catch (error) {
    console.error('activity: ' + error.message);
    if (fs.existsSync(OUT)) {
      console.log('activity: оставляю предыдущий снимок');
      process.exit(0);
    }
    process.exit(1);
  }
})();
