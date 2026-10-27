/* ==========================================================================
   Персональная страница учебной лиги (stands/league.html)
   Рендерит уровень/XP, лестницу, награды, матрицу навыков ФГОС, рейтинг
   проверяющего, мои работы, таблицу трайбов, хакатоны и перенос бандлов.
   Всё локально (localStorage), сервер не требуется. noindex на странице.
   ========================================================================== */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(iso) {
    try { return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return iso || '—'; }
  }
  function bar(percent, label) {
    var p = Math.max(0, Math.min(100, Math.round(percent)));
    return '<div class="lg-bar-row"><span class="lg-bar-label">' + esc(label || '') + '</span>' +
      '<span class="lg-bar"><span class="lg-bar-fill" style="width:' + p + '%"></span></span>' +
      '<span class="lg-bar-val">' + p + '%</span></div>';
  }
  function standName(id) { return id === 'dhcp-alt' ? 'DHCP · ALT' : id === 'switch-ovs' ? 'Open vSwitch' : id; }

  var profile = null;

  function loadProfile() {
    try { profile = JSON.parse(localStorage.getItem('stands-profile')); } catch (e) { profile = null; }
    if (!profile || !profile.name || !profile.group) {
      location.href = 'index.html';
      return null;
    }
    return profile;
  }

  /* ----------------------------- 01 · уровень ----------------------------- */
  function renderLevel() {
    var t = LEAGUE.totals(profile.id);
    var lv = t.level;
    var tribe = LEAGUE.TRIBES.filter(function (x) { return x.id === profile.tribeId; })[0];
    $('lg-name').textContent = profile.name;
    $('lg-group').textContent = profile.group + ' · ' + (tribe ? tribe.name : 'трайн не назначен');
    $('lg-tribe').textContent = tribe ? tribe.glyph + ' · ' + tribe.name : 'трайн: —';

    $('lg-level-card').innerHTML =
      '<div class="lg-level-top">' +
        '<div><p class="flat-kicker" style="margin:0;">текущий уровень</p>' +
        '<p class="lg-level-title">L' + lv.level + ' · ' + esc(lv.title) + '</p></div>' +
        '<div class="lg-coins"><span class="lg-coins-num">' + t.coins + '</span><span class="lg-coins-cap">неткоинов</span></div>' +
      '</div>' +
      bar(lv.progress, lv.next ? 'до L' + (lv.level + 1) + ' «' + lv.next + '» · ' + lv.into + '/' + lv.span + ' XP' : 'максимальный уровень') +
      '<p class="admin-hint" style="margin-bottom:0;">всего опыта: <strong>' + t.xp + ' XP</strong>' +
      (lv.next ? ' · следующий уровень «' + esc(lv.next) + '»' : '') + '</p>';
  }

  /* ----------------------------- 02 · лестница ----------------------------- */
  function renderLadder() {
    var xp = LEAGUE.totals(profile.id).xp;
    $('lg-ladder').innerHTML = LEAGUE.LEVELS.map(function (l) {
      var reached = xp >= l.need;
      return '<div class="lg-step ' + (reached ? 'is-reached' : '') + '">' +
        '<span class="lg-step-lv">L' + l.level + '</span>' +
        '<span class="lg-step-name">' + esc(l.title) + '</span>' +
        '<span class="lg-step-need">' + l.need + ' XP</span>' +
        (reached ? '<span class="lg-step-mark">✓</span>' : '<span class="lg-step-mark off">·</span>') +
        '</div>';
    }).join('');
  }

  /* ----------------------------- 03 · награды и журнал ----------------------------- */
  function renderLedger() {
    var awardNames = {
      login: 'ежедневный вход', submit: 'сдача лабораторной', standReady: 'стенд на 100%',
      autotests: 'все автотесты', quizPerfect: 'тест без ошибок',
      review: 'взаимная оценка', expertReview: 'экспертная оценка'
    };
    $('lg-awards').innerHTML = Object.keys(LEAGUE.AWARDS).map(function (k) {
      var a = LEAGUE.AWARDS[k];
      return '<div class="lg-award"><strong>+' + a.xp + ' XP</strong>' +
        '<span class="lg-award-coins">+' + a.coins + ' ◈</span>' +
        '<span class="lg-award-note">' + esc(awardNames[k] || a.note) + '</span></div>';
    }).join('');
    var rows = LEAGUE.ledger().filter(function (e) { return e.profileId === profile.id; })
      .sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); }).slice(0, 25);
    $('lg-ledger').innerHTML = rows.length ? rows.map(function (e) {
      return '<tr><td class="mono">' + fmt(e.at) + '</td><td>' + esc(awardNames[e.type] || e.note || e.type) + '</td>' +
        '<td class="mono">' + esc(e.standId ? standName(e.standId) : '—') + '</td>' +
        '<td class="mono">+' + (e.xp || 0) + '</td><td class="mono">+' + (e.coins || 0) + ' ◈</td></tr>';
    }).join('') : '<tr><td colspan="5" class="admin-hint" style="padding:1rem;">// событий пока нет — выполните лабораторную на стенде</td></tr>';
  }

  /* ----------------------------- 04 · матрица ФГОС ----------------------------- */
  function renderSkills() {
    var rows = LEAGUE.skillsMatrix(profile.id);
    if (!rows.length) {
      $('lg-skills').innerHTML = '<p class="admin-hint" style="margin:0;">Модуль навыков не загружен.</p>';
      return;
    }
    var anySubmission = LEAGUE.submissions().some(function (s) { return s.student.id === profile.id; });
    $('lg-skills').innerHTML = rows.map(function (r) {
      var title = (window.FGOS && FGOS.byCode(r.code) || {}).title || r.title || '';
      return '<div class="lg-skill"><code>' + esc(r.code) + '</code>' +
        '<span class="lg-skill-title">' + esc(title) + '</span>' +
        bar(anySubmission ? r.percent : 0) +
        '<span class="lg-skill-stands">' + r.stands.map(standName).join(' + ') + '</span></div>';
    }).join('');
  }

  /* ----------------------------- 05 · рейтинг проверяющего ----------------------------- */
  function renderReviewer() {
    var r = LEAGUE.reviewerRating(profile.id);
    if (!r) {
      $('lg-reviewer').innerHTML =
        '<p class="admin-hint" style="margin:0;">Вы ещё не проверяли чужие работы. Откройте стенд, выберите работу однокурсника ' +
        'в блоке взаимной оценки и оставьте развёрнутое ревью — здесь появятся четыре оси рейтинга.</p>';
      return;
    }
    var axes = [
      ['fairness', 'справедливость', 'близость оценки к результату автопроверки'],
      ['kindness', 'доброжелательность', 'тон и лексика комментариев'],
      ['engagement', 'заинтересованность', 'глубина и подробность разбора'],
      ['punctuality', 'пунктуальность', 'скорость проверки после сдачи']
    ];
    $('lg-reviewer').innerHTML =
      '<div class="lg-rv-head"><div><p class="flat-kicker" style="margin:0;">интегральный рейтинг</p>' +
      '<p class="lg-rv-overall">' + r.overall + '<span class="lg-rv-of">/100</span></p></div>' +
      '<span class="flat-badge is-ready">проверок: ' + r.count + '</span></div>' +
      axes.map(function (a) { return bar(r[a[0]], a[1] + ' — ' + a[2]); }).join('');
  }

  /* ----------------------------- 06 · мои работы ----------------------------- */
  function renderSubs() {
    var rows = LEAGUE.submissions().filter(function (s) { return s.student.id === profile.id; })
      .sort(function (a, b) { return (b.submittedAt || '').localeCompare(a.submittedAt || ''); });
    $('lg-subs').innerHTML = rows.length ? rows.map(function (s) {
      var revs = LEAGUE.reviewsFor(s.id);
      var code = LEAGUE.encodeSubmission(s);
      var auto = s.autotests ? s.autotests.passed + '/' + s.autotests.total : '—';
      return '<tr><td>' + esc(s.standTitle || standName(s.standId)) + '</td>' +
        '<td class="mono">' + fmt(s.submittedAt) + '</td>' +
        '<td class="mono">' + (s.result && s.result.score != null ? s.result.score + '%' : '—') + '</td>' +
        '<td class="mono">' + auto + '</td>' +
        '<td class="mono">' + revs.length + '</td>' +
        '<td><button class="flat-btn ghost lg-copy" type="button" data-code="' + esc(code) + '">код ↧</button></td></tr>';
    }).join('') : '<tr><td colspan="6" class="admin-hint" style="padding:1rem;">// работ пока нет — откройте стенд из каталога</td></tr>';

    document.querySelectorAll('.lg-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.dataset.code;
        var done = function () { btn.textContent = 'скопировано ✓'; setTimeout(function () { btn.textContent = 'код ↧'; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done);
        else {
          var ta = document.createElement('textarea');
          ta.value = code; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (e) {}
          ta.remove(); done();
        }
      });
    });
  }

  /* ----------------------------- 07 · трайбы ----------------------------- */
  function renderStandings() {
    $('lg-standings').innerHTML = LEAGUE.tribeStandings().map(function (row, i) {
      var mine = row.tribe.id === profile.tribeId;
      return '<tr' + (mine ? ' class="lg-row-mine"' : '') + '><td class="mono">' + (i + 1) + '</td>' +
        '<td><span class="lg-glyph" style="color:' + row.tribe.color + ';">' + row.tribe.glyph + '</span> ' +
        esc(row.tribe.name) + (mine ? ' <small>(ваш трайн)</small>' : '') + '</td>' +
        '<td class="mono">' + row.members + '</td><td class="mono"><strong>' + row.xp + ' XP</strong></td></tr>';
    }).join('');
  }

  /* ----------------------------- 08 · хакатоны ----------------------------- */
  function renderHacks() {
    var label = { done: 'завершён', active: 'идёт сейчас', future: 'планируется' };
    $('lg-hacks').innerHTML = LEAGUE.HACKATHONS.map(function (h) {
      return '<div class="lg-hack is-' + h.status + '">' +
        '<span class="flat-badge ' + (h.status === 'active' ? 'is-run' : h.status === 'done' ? 'is-ready' : 'is-soon') + '">' + label[h.status] + '</span>' +
        '<div><strong>' + esc(h.title) + '</strong>' +
        '<p class="admin-hint" style="margin:.25rem 0 0;">' + esc(h.task) + '</p></div>' +
        '<span class="mono lg-hack-date">' + esc(h.date) + '</span></div>';
    }).join('');
  }

  /* ----------------------------- 09 · бандлы ----------------------------- */
  function downloadBundle() {
    var bundle = LEAGUE.exportBundle();
    var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'league-bundle_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    dataMsg('Бандл экспортирован: перенесите его на другое устройство и импортируйте там.');
  }
  function importBundle(file) {
    file.text().then(function (txt) {
      var report = LEAGUE.importBundle(JSON.parse(txt));
      dataMsg('Импортировано: работ ' + report.submissions + ', оценок ' + report.reviews +
        ', presence ' + report.presence + ', событий опыта ' + report.ledger + '.');
      renderAll();
    }).catch(function (e) { dataMsg('Не удалось импортировать бандл: ' + e.message, true); });
  }
  function resetDemo() {
    if (!confirm('Убрать демо-однокурсников и их работы? Ваши личные данные и прогресс сохранятся.')) return;
    var keep = function (x) { return !x.demo; };
    localStorage.setItem(LEAGUE.KEYS.submissions, JSON.stringify(LEAGUE.submissions().filter(keep)));
    localStorage.setItem(LEAGUE.KEYS.reviews, JSON.stringify(LEAGUE.reviews().filter(keep)));
    var pres = JSON.parse(localStorage.getItem(LEAGUE.KEYS.presence) || '{}');
    Object.keys(pres).forEach(function (id) { if (pres[id].demo) delete pres[id]; });
    localStorage.setItem(LEAGUE.KEYS.presence, JSON.stringify(pres));
    var demoIds = {};
    (JSON.parse(localStorage.getItem('league-demo-data') || '{}').students || []).forEach(function (s) { demoIds[s.id] = true; });
    localStorage.setItem(LEAGUE.KEYS.ledger, JSON.stringify(LEAGUE.ledger().filter(function (e) { return !demoIds[e.profileId]; })));
    localStorage.removeItem('league-demo-data');
    localStorage.removeItem(LEAGUE.KEYS.demo);
    dataMsg('Демо-данные удалены, ваш профиль и прогресс на месте.');
    renderAll();
  }
  function dataMsg(text, isErr) {
    var el = $('lg-data-msg');
    el.textContent = text;
    el.style.color = isErr ? 'var(--st-bad, #f87171)' : '';
  }

  function renderAll() {
    renderLevel(); renderLadder(); renderLedger(); renderSkills();
    renderReviewer(); renderSubs(); renderStandings(); renderHacks();
  }

  function init() {
    if (!loadProfile()) return;
    renderAll();
    $('lg-change').addEventListener('click', function () { location.href = 'index.html'; });
    $('lg-export').addEventListener('click', downloadBundle);
    $('lg-import').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importBundle(f);
      e.target.value = '';
    });
    $('lg-reset').addEventListener('click', resetDemo);
    window.addEventListener('storage', function (e) {
      if (!e.key) return;
      if (e.key.indexOf('league-') === 0 || e.key === 'stands-profile' || e.key === 'stands-submissions') renderAll();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
