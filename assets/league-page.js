/* ==========================================================================
   Персональная страница учебной лиги (stands/league.html)
   Рендерит уровень/XP, лестницу, награды, матрицу навыков ФГОС, рейтинг
   проверяющего, мои работы, таблицу трайбов и перенос бандлов.
   Всё локально (localStorage), сервер не требуется. noindex на странице.
   ========================================================================== */
(function () {
  'use strict';

  var $ = window.DOMKIT.$;  // общий хелпер: dom-kit.js
  var esc = window.DOMKIT.esc;  // единое экранирование: dom-kit.js
  function fmt(iso) {
    try { return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return iso || '—'; }
  }
  function bar(percent, label) {
    var p = Math.max(0, Math.min(100, Math.round(percent)));
    return '<div class="lg-bar-row"><span class="lg-bar-label">' + esc(label || '') + '</span>' +
      '<span class="lg-bar"><span class="lg-bar-fill" style="--p:' + (p / 100) + '"></span></span>' +
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

  function mascot(id, size) {
    return window.MASCOTS ? window.MASCOTS.svg(id || 'raccoon', { size: size || 40, floating: false }) : '';
  }

  /* ----------------------------- 01 · уровень ----------------------------- */
  function renderLevel() {
    var t = LEAGUE.totals(profile.id);
    var lv = t.level;
    var ordersInWork = LEAGUE.myClaims
      ? LEAGUE.myClaims(profile.id).filter(function (c) { return c.status === 'local' || c.status === 'rejected'; }).length
      : 0;
    var tribe = LEAGUE.TRIBES.filter(function (x) { return x.id === profile.tribeId; })[0];
    var handle = LEAGUE.handleFor(profile);
    $('lg-name').textContent = profile.name;
    $('lg-group').textContent = profile.group + ' · ' + (tribe ? tribe.name : 'трайн не назначен');
    $('lg-tribe').textContent = (tribe ? tribe.glyph + ' · ' + tribe.name : 'трайн: —') + ' · ' + handle.text;

    $('lg-level-card').innerHTML =
      '<div class="lg-level-top">' +
        '<div class="lg-id-row">' + mascot(profile.mascotId, 56) +
          '<div><p class="flat-kicker">текущий уровень · ' + esc(handle.text) + '</p>' +
          '<p class="lg-level-title">L' + lv.level + ' · ' + esc(lv.title) + '</p></div></div>' +
        '<div class="lg-coins-row">' +
          '<div class="lg-coins"><span class="lg-coins-num">' + t.coins + '</span><span class="lg-coins-cap">неткоинов</span></div>' +
          '<div class="lg-coins"><span class="lg-coins-num">' + LEAGUE.prpBalance(profile.id) +
            '</span><span class="lg-coins-cap">PRP</span></div>' +
        '</div>' +
      '</div>' +
      bar(lv.progress, lv.next ? 'до L' + (lv.level + 1) + ' «' + lv.next + '» · ' + lv.into + '/' + lv.span + ' XP' : 'максимальный уровень') +
      '<p class="admin-hint">всего опыта: <strong>' + t.xp + ' XP</strong>' +
      (lv.next ? ' · следующий уровень «' + esc(lv.next) + '»' : '') +
      ' · PRP тратятся при сдаче на взаимную проверку и возвращаются за проверку работ коллег' +
      ' · обменяй неткоины на <a href="rewards.html">бирже привилегий</a>' +
      (ordersInWork ? ' · ордеров в работе: ' + ordersInWork : '') +
      '</p>';
  }

  /* ----------------------------- 06 · достижения ----------------------------- */
  function renderAchievements() {
    var box = $('lg-achievements');
    if (!box) return;
    var list = LEAGUE.achievements(profile.id);
    var unlocked = list.filter(function (a) { return a.unlocked; }).length;
    box.innerHTML = list.map(function (a) {
      return '<div class="ach-card ' + (a.unlocked ? 'is-unlocked' : 'is-locked') + '" title="' + esc(a.desc) + '">' +
        '<span class="ach-icon">' + a.icon + '</span>' +
        '<div><h4>' + esc(a.title) + '</h4><p>' + esc(a.desc) + '</p></div></div>';
    }).join('') +
    '<p class="admin-hint">открыто ' + unlocked + ' из ' + list.length + ' — бейджи считаются только из фактических действий, нарисовать их нельзя</p>';
  }

  /* ----------------------------- 02 · лестница ----------------------------- */
  function renderLadder() {
    var totals = LEAGUE.totals(profile.id);
    var xp = totals.xp;
    var currentLevel = totals.level.level;
    $('lg-ladder').innerHTML = LEAGUE.LEVELS.map(function (l) {
      var reached = xp >= l.need;
      var isCurrent = l.level === currentLevel;
      return '<div class="lg-step ' + (reached ? 'is-reached' : '') + (isCurrent ? ' is-current' : '') + '">' +
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
      review: 'взаимная оценка', expertReview: 'экспертная оценка',
      rewardSpend: 'обмен на бирже привилегий', rewardRefund: 'возврат по ордеру'
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
        '<td class="mono">+' + (e.xp || 0) + '</td><td class="mono">' +
        ((e.coins || 0) >= 0 ? '+' : '') + (e.coins || 0) + ' ◈</td></tr>';
    }).join('') : '<tr><td colspan="5" class="admin-hint table-empty">// событий пока нет — выполните лабораторную на стенде</td></tr>';
  }

  /* ----------------------------- 04 · матрица ФГОС ----------------------------- */
  function renderSkills() {
    var box = $('lg-skills');
    if (!box) return;
    var rows = LEAGUE.skillsMatrix(profile.id);
    if (!rows.length) {
      box.innerHTML = '<p class="admin-hint">Модуль навыков не загружен.</p>';
      return;
    }
    var anySubmission = LEAGUE.submissions().some(function (s) { return s.student.id === profile.id; });
    box.innerHTML = rows.map(function (r) {
      var task = (window.FGOS && FGOS.byCode(r.code) || {}).title || r.title || r.code;
      var pct = anySubmission ? Math.max(0, Math.min(100, Math.round(r.percent))) : 0;
      return '<div class="skill-card">' +
        '<div class="skill-card-head">' +
          '<span class="skill-task">' + esc(task) + '</span>' +
          '<span class="skill-bubble">' + esc(r.code) + '</span>' +
        '</div>' +
        '<div class="lg-bar-row"><span class="lg-bar"><span class="lg-bar-fill" style="--p:' + (pct / 100) + '"></span></span>' +
        '<span class="lg-bar-val">' + pct + '%</span></div>' +
        '<div class="skill-meta"><span>стенды: ' + r.stands.map(standName).join(' + ') + '</span>' +
        '<span>' + (pct === 100 ? 'освоено полностью' : pct > 0 ? 'в работе' : 'ожидает практики') + '</span></div>' +
      '</div>';
    }).join('');
  }

  /* ----------------------------- 05 · рейтинг проверяющего ----------------------------- */
  function renderReviewer() {
    var r = LEAGUE.reviewerRating(profile.id);
    if (!r) {
      $('lg-reviewer').innerHTML =
        '<p class="admin-hint">Вы ещё не проверяли чужие работы. Откройте стенд, выберите работу однокурсника ' +
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
      '<div class="lg-rv-head"><div><p class="flat-kicker">интегральный рейтинг</p>' +
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
    }).join('') : '<tr><td colspan="6" class="admin-hint table-empty">// работ пока нет — откройте стенд из каталога</td></tr>';

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
      dataMsg('Импортировано: работ ' + report.submissions + ', рецензий ' + report.reviews +
        ', presence ' + report.presence + ', событий опыта ' + report.ledger +
        (report.prp ? ', PRP-балансов ' + report.prp : '') + '.');
      renderAll();
    }).catch(function (e) { dataMsg('Не удалось импортировать бандл: ' + e.message, true); });
  }
  function resetMine() {
    if (!confirm('Сбросить ВСЕ локальные данные: профиль, работы, рецензии, XP и PRP? Действие необратимо.')) return;
    LEAGUE.resetAll();
    localStorage.removeItem('stands-tour-seen');
    location.href = 'index.html';
  }
  function dataMsg(text, isErr) {
    var el = $('lg-data-msg');
    el.textContent = text;
    el.style.color = isErr ? 'var(--st-bad, #f87171)' : '';
  }

  function renderAll() {
    renderLevel(); renderLadder(); renderLedger(); renderSkills();
    renderReviewer(); renderAchievements(); renderSubs(); renderStandings();
  }

  function initTabs() {
    var tabs = document.querySelectorAll('.lg-tab');
    var panes = document.querySelectorAll('.lg-pane');
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
        panes.forEach(function (p) { p.classList.remove('is-active'); p.hidden = true; });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        var pane = $(tab.dataset.pane);
        if (pane) { pane.classList.add('is-active'); pane.hidden = false; }
      });
    });
  }

  function init() {
    if (!loadProfile()) return;
    renderAll();
    initTabs();
    $('lg-change').addEventListener('click', function () { location.href = 'index.html'; });
    $('lg-export').addEventListener('click', downloadBundle);
    $('lg-import').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importBundle(f);
      e.target.value = '';
    });
    $('lg-reset').addEventListener('click', resetMine);
    window.addEventListener('storage', function (e) {
      if (!e.key) return;
      if (e.key.indexOf('league-') === 0 || e.key === 'stands-profile' || e.key === 'stands-submissions') renderAll();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
