/* ==========================================================================
   STANDINGS · публичный стенд лиги (stands/standings.json в репозитории)
   Преподаватель собирает обезличенную сводку из импортированных бандлов
   и публикует её одной кнопкой (Contents API + PAT). Все остальные читают
   файл без токена: общий рейтинг трайбов, участников и статусы ордеров
   видны с любого устройства и живут на GitHub, а не в одном браузере.
   Кэш в localStorage на 10 минут, при ошибке сети отдаём последний снимок.
   UMD: браузер и Node (юнит-проверки).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.STANDINGS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Глобальный объект внутри фабрики: window в браузере, globalThis в Node */
  var root = typeof self !== 'undefined' ? self : globalThis;

  var CACHE_KEY = 'standings-cache-v1';
  var CACHE_TTL = 10 * 60 * 1000;

  var memory = {};
  var storage = (typeof localStorage !== 'undefined') ? localStorage : {
    getItem: function (k) { return k in memory ? memory[k] : null; },
    setItem: function (k, v) { memory[k] = String(v); },
    removeItem: function (k) { delete memory[k]; }
  };

  function repoCfg() {
    return (root.LEAGUE && LEAGUE.REPO_CONFIG) ||
      { owner: 'ItsLiventsev', repo: 'itsliventsev.github.io', branch: 'main' };
  }
  function snapshotUrl() {
    var cfg = repoCfg();
    return 'https://raw.githubusercontent.com/' + cfg.owner + '/' + cfg.repo + '/' + cfg.branch +
      '/standings/standings.json?t=' + Date.now();
  }

  function readCache() {
    try { return JSON.parse(storage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function writeCache(data) {
    try { storage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* приватный режим */ }
  }

  /* Свежий снапшот: сеть → кэш по TTL → устаревший кэш → null */
  function fetchSnapshot(force) {
    var cached = readCache();
    var fresh = cached && (Date.now() - cached.at) < CACHE_TTL;
    if (fresh && !force) return Promise.resolve(cached.data);
    if (typeof fetch !== 'function') return Promise.resolve(cached ? cached.data : null);
    return fetch(snapshotUrl(), { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (!data || data.schema !== 'standings/1') throw new Error('неверный schema');
        writeCache(data);
        return data;
      })
      .catch(function () { return cached ? cached.data : null; });
  }

  function esc(v) {
    if (root.DOMKIT && DOMKIT.esc) return DOMKIT.esc(v);
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v) { return typeof v === 'number' ? v : 0; }
  function tribeName(id, snap) {
    var rows = (snap && snap.setpolis && snap.setpolis.tribes) || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i].name;
    return 'вне трайба';
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return iso || ''; }
  }

  /* ----------------------------- Рендеры ----------------------------- */

  function emptyState(hint) {
    return '<div class="std-empty">' +
      '<p class="std-empty-title">// стенда пока нет</p>' +
      '<p class="std-empty-hint">' + esc(hint || 'преподаватель опубликует общий рейтинг после первого импорта работ: админка → «журнал работ» → импорт бандлов → «опубликовать стенд лиги»') + '</p></div>';
  }

  function metaLine(snap) {
    if (!snap) return '';
    return '<p class="std-meta">снимок от ' + esc(fmtDate(snap.generatedAt)) + ' · период: ' + esc(snap.period || '—') +
      (snap.totals ? ' · в системе: ' + num(snap.totals.works) + ' работ и ' + num(snap.totals.reviews) + ' рецензий' : '') + '</p>';
  }

  function tribesTable(snap) {
    var rows = (snap && snap.setpolis && snap.setpolis.tribes) || [];
    if (!rows.length) return emptyState();
    var max = Math.max.apply(null, rows.map(function (r) { return num(r.xp); })) || 1;
    var medals = ['🥇', '🥈', '🥉'];
    return '<div class="std-table-wrap"><table class="std-table">' +
      '<thead><tr><th>трайб</th><th>опыт</th><th>неткоины</th><th>работ</th><th>состав</th><th class="std-col-bar">копилка опыта</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var head = medals[i] ? '<span aria-hidden="true">' + medals[i] + '</span> ' : (i + 1) + '. ';
        return '<tr>' +
          '<td class="std-place">' + head + esc(r.name || r.id) + '</td>' +
          '<td class="mono">' + num(r.xp) + '</td>' +
          '<td class="mono">' + num(r.coins) + ' ◈</td>' +
          '<td class="mono">' + num(r.works) + '</td>' +
          '<td class="mono">' + num(r.members) + '</td>' +
          '<td class="std-col-bar"><span class="std-bar"><span class="std-bar-fill" style="--p:' + (num(r.xp) / max).toFixed(3) + '"></span></span></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function membersTable(snap, opts) {
    opts = opts || {};
    var rows = ((snap && snap.setpolis && snap.setpolis.members) || []).slice(0, opts.limit || 20);
    if (!rows.length) return emptyState();
    return '<div class="std-table-wrap"><table class="std-table">' +
      '<thead><tr><th>#</th><th>участник</th><th>трайб</th><th>ур.</th><th>XP</th><th>◈</th><th>PRP</th><th>работ</th><th>ревью</th></tr></thead><tbody>' +
      rows.map(function (m, i) {
        return '<tr>' +
          '<td class="mono std-place">' + (i + 1) + '</td>' +
          '<td class="std-handle">' + esc(m.handle || '—') + '</td>' +
          '<td class="mono">' + esc(tribeName(m.tribeId, snap).replace('Трайб «', '«').replace('»', '»')) + '</td>' +
          '<td class="mono">' + num(m.level) + '</td>' +
          '<td class="mono">' + num(m.xp) + '</td>' +
          '<td class="mono">' + num(m.coins) + '</td>' +
          '<td class="mono">' + num(m.prp) + '</td>' +
          '<td class="mono">' + num(m.works) + '</td>' +
          '<td class="mono">' + num(m.reviews) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  var REWARD_TITLES = {
    'hint': 'подсказка преподавателя', 'board-pass': 'час без доски', 'deadline': 'дедлайн +1 день',
    'point-wipe': 'не ставить точку', 'rescue': 'спасательная круглая', 'topic-first': 'первый выбор темы',
    'grade-plus': '+1 балл к четвертной'
  };
  /* Каталог лиги — первоисточник; локальная карта — фолбэк для Node/кэша */
  function rewardTitle(id) {
    return (root.LEAGUE && LEAGUE.REWARDS && LEAGUE.REWARDS[id] && LEAGUE.REWARDS[id].title) || REWARD_TITLES[id] || id;
  }
  function claimsList(snap) {
    var rows = (snap && snap.claims) || [];
    if (!rows.length) return '<p class="std-empty-hint">ордеров ещё не было — обменяйте неткоины на <a href="rewards.html">бирже привилегий</a>.</p>';
    return '<ul class="std-claims">' + rows.map(function (c) {
      var cls = c.status === 'approved' ? 'is-ok' : c.status === 'rejected' ? 'is-bad' : 'is-wait';
      var label = c.status === 'approved' ? 'выдано' : c.status === 'rejected' ? 'отклонено' : c.status === 'refunded' ? 'возвращено' : 'ждёт подтверждения';
      return '<li class="std-claim ' + cls + '"><span class="mono">' + esc(c.handle || '') + '</span>' +
        '<span>' + esc(rewardTitle(c.rewardId)) + '</span>' +
        '<span class="std-claim-status">' + label + '</span></li>';
    }).join('') + '</ul>';
  }

  /* Ордера ДатаПолиса (snap.datapolis.claims): решения преподавателя по бирже эксплуатации */
  function datapolisClaimsList(snap) {
    var dp = snap && snap.datapolis;
    var rows = (dp && dp.claims) || [];
    if (!rows.length) return '<p class="std-empty-hint">ордеров ДатаПолиса ещё не было — обменяйте неткоины эксплуатации на <a href="ops/rewards.html">бирже ДатаПолиса</a>.</p>';
    var titles = {
      'ticket-pick': 'первый выбор заявки', 'mentor-hint': 'подсказка наставника',
      'deadline-plus': '+1 день на задачу спринта', 'point-wipe': 'не ставить точку',
      'standby-skip': 'выход из дежурства', 'rescue': 'спасательная круглая',
      'grade-plus': '+1 балл к четвертной'
    };
    function title(id) {
      return (root.OPS && OPS.REWARDS_OPS && OPS.REWARDS_OPS[id] && OPS.REWARDS_OPS[id].title) || titles[id] || id;
    }
    return '<ul class="std-claims">' + rows.map(function (c) {
      var cls = c.status === 'approved' ? 'is-ok' : c.status === 'rejected' ? 'is-bad' : 'is-wait';
      var label = c.status === 'approved' ? 'выдано' : c.status === 'rejected' ? 'отклонено' : c.status === 'refunded' ? 'возвращено' : 'ждёт подтверждения';
      return '<li class="std-claim ' + cls + '"><span class="mono">' + esc(c.handle || '') + '</span>' +
        '<span>' + esc(title(c.rewardId)) + '</span>' +
        '<span class="std-claim-status">' + label + '</span></li>';
    }).join('') + '</ul>';
  }

  /* Экипажи ДатаПолиса: очки команд и проведённые операции (snap.datapolis) */
  function opsCrewsTable(snap) {
    var dp = snap && snap.datapolis;
    if (!dp || !dp.crews || !dp.crews.length) return '';
    var max = Math.max.apply(null, dp.crews.map(function (c) { return num(c.points); })) || 1;
    var medals = ['🥇', '🥈', '🥉'];
    var opsLine = '';
    if (dp.opsDone) {
      var parts = Object.keys(dp.opsDone).map(function (id) {
        var title = (dp.opsTitles && dp.opsTitles[id]) || id;
        return esc(title) + ' ×' + dp.opsDone[id];
      });
      if (parts.length) opsLine = '<p class="std-meta" style="margin-top:var(--st-sp-3);">операций проведено: ' + parts.join(' · ') + '</p>';
    }
    var table = '<div class="std-table-wrap"><table class="std-table">' +
      '<thead><tr><th>экипаж</th><th>очков</th><th class="std-col-bar">копилка экипажа</th></tr></thead><tbody>' +
      dp.crews.slice().sort(function (a, b) { return b.points - a.points; }).map(function (c, i) {
        var head = medals[i] ? '<span aria-hidden="true">' + medals[i] + '</span> ' : (i + 1) + '. ';
        return '<tr>' +
          '<td class="std-place">' + head + esc(c.name || c.id) + '</td>' +
          '<td class="mono">' + num(c.points) + '</td>' +
          '<td class="std-col-bar"><span class="std-bar" aria-hidden="true"><span class="std-bar-fill" style="--p:' + (num(c.points) / max).toFixed(3) + '"></span></span></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
    return '<p class="list-lead"><strong>экипажи ДатаПолиса · очки за операции</strong></p>' + table + opsLine;
  }

  /* Декларативные блоки: <div data-standings="tribes|members|claims" data-standings-limit="10"></div> */
  function hydrate(snap) {
    var nodes = document.querySelectorAll('[data-standings]');
    Array.prototype.forEach.call(nodes, function (el) {
      var kind = el.getAttribute('data-standings');
      var limit = parseInt(el.getAttribute('data-standings-limit') || '0', 10);
      if (kind === 'tribes') el.innerHTML = tribesTable(snap);
      else if (kind === 'members') el.innerHTML = membersTable(snap, { limit: limit || 20 });
      else if (kind === 'claims') el.innerHTML = claimsList(snap);
      else if (kind === 'ops-crews') el.innerHTML = opsCrewsTable(snap);
      else if (kind === 'ops-claims') el.innerHTML = datapolisClaimsList(snap);
      else if (kind === 'meta') el.innerHTML = snap ? metaLine(snap) : '';
      el.classList.add('std-ready');
    });
  }

  function autoInit(force) {
    if (typeof document === 'undefined' || !document.querySelector) return Promise.resolve(null);
    if (!document.querySelector('[data-standings]')) return Promise.resolve(null);
    return fetchSnapshot(force).then(function (snap) {
      hydrate(snap);
      return snap;
    });
  }

  return {
    CACHE_KEY: CACHE_KEY,
    snapshotUrl: snapshotUrl,
    fetchSnapshot: fetchSnapshot,
    renderTribes: tribesTable,
    renderMembers: membersTable,
    renderClaims: claimsList,
    renderOpsCrews: opsCrewsTable,
    renderDatapolisClaims: datapolisClaimsList,
    hydrate: hydrate,
    autoInit: autoInit,
    REWARD_TITLES: REWARD_TITLES
  };
});
