/* ==========================================================================
   OFFICE HUB · бюро учебной вселенной «ОфисПолис»
   Профиль-гейт, ID-карта оператора ЭВМ, метрики работ, роадмап из пяти
   спринтов с мастерством по сдачам и лента наград. Прогресс изолирован
   ключами office-* и не пересекается с двумя другими вселенными.
   ========================================================================== */
(function () {
  'use strict';
  var $ = window.DOMKIT.$;  // общий хелпер: dom-kit.js
  var esc = window.DOMKIT.esc;  // единое экранирование: dom-kit.js
  var setMsg = window.DOMKIT.setMsg;  // общий статус: dom-kit.js
  function mascotSvg(id, size) { return window.MASCOTS ? MASCOTS.svg(id || 'fox', { size: size || 44, floating: false }) : ''; }

  /* Роадмап третьей вселенной — синхронизирован с id страниц работ */
  var SPRINTS = {
    1: { title: 'Документы', note: 'сложные текстовые документы и работа со сканами' },
    2: { title: 'Таблицы и данные', note: 'вычисления, функции, диаграммы и графики' },
    3: { title: 'Презентации', note: 'слайд-шоу, анимация, графика и звук' },
    4: { title: 'Графика и базы', note: 'схемы, чертежи и работа с базами данных' },
    5: { title: 'Инфраструктура и веб', note: 'мониторинг сети и создание простого сайта' }
  };
  var QUESTS = [
    { id: 'office-docs', sprint: 1, glyph: 'fox', title: 'Сложные текстовые документы', href: 'office-docs.html' },
    { id: 'office-scan', sprint: 1, glyph: 'hedgehog', title: 'Сканированные документы и OCR', href: 'office-scan.html' },
    { id: 'office-sheets', sprint: 2, glyph: 'otter', title: 'Таблицы и вычисления', href: 'office-sheets.html' },
    { id: 'office-charts', sprint: 2, glyph: 'owl', title: 'Диаграммы и графики', href: 'office-charts.html' },
    { id: 'office-slides', sprint: 3, glyph: 'raccoon', title: 'Презентации и слайд-шоу', href: 'office-slides.html' },
    { id: 'office-animation', sprint: 3, glyph: 'cat', title: 'Анимация, графика и звук слайда', href: 'office-animation.html' },
    { id: 'office-draw', sprint: 4, glyph: 'crab', title: 'Простые схемы и чертежи', href: 'office-draw.html' },
    { id: 'office-db', sprint: 4, glyph: 'wolf', title: 'Работа с базами данных', href: 'office-db.html' },
    { id: 'office-monitor', sprint: 5, glyph: 'owl', title: 'Мониторинг сетевой инфраструктуры', href: 'office-monitor.html' },
    { id: 'office-web', sprint: 5, glyph: 'fox', title: 'Создание простого сайта', href: 'office-web.html' }
  ];

  function mascotPicker(current) {
    var ids = ['fox', 'hedgehog', 'otter', 'owl', 'raccoon', 'cat', 'crab', 'wolf'];
    return '<div class="mascot-picker">' + ids.map(function (id) {
      return '<button type="button" class="mascot-opt' + (id === current ? ' is-selected' : '') + '" data-mascot="' + id + '" aria-label="' + id + '">' + mascotSvg(id, 40) + '</button>';
    }).join('') + '</div>';
  }

  function mastery(pid, labId) {
    var best = OFFICE.bestSubmission(pid, labId);
    if (!best) return { pct: 0, label: 'не начата', cls: 'is-soon' };
    var pct = best.result.score || 0;
    return pct >= 95 ? { pct: pct, label: 'сдана ' + pct + '%', cls: 'is-ready' } : { pct: pct, label: 'в работе ' + pct + '%', cls: 'is-run' };
  }

  function renderDashboard(p) {
    $('gate').hidden = true; $('dash').hidden = false;
    var nameField = $('fp-name'), groupField = $('fp-group');
    if (nameField) nameField.textContent = p.name;
    if (groupField) groupField.textContent = p.group;
    OFFICE.dailyLogin(p.id);
    var t = OFFICE.totals(p.id);
    var subs = OFFICE.submissions().filter(function (s) { return s.student.id === p.id; });
    var done = QUESTS.filter(function (q) { return OFFICE.bestSubmission(p.id, q.id); }).length;
    var ready = QUESTS.filter(function (q) {
      var b = OFFICE.bestSubmission(p.id, q.id);
      return b && b.result.score >= 95;
    }).length;
    var avg = subs.length ? Math.round(subs.reduce(function (sum, s) { return sum + (s.result.score || 0); }, 0) / subs.length) : 0;

    $('id-card').innerHTML =
      '<div class="id-card-top">' + mascotSvg(p.mascotId, 64) +
      '<div><p class="id-handle">' + esc(OFFICE.handleFor(p).text) + '</p><p class="id-name">' + esc(p.name) + '</p>' +
      '<p class="id-group">' + esc(p.group) + ' · бюро ОфисПолиса</p></div></div>' +
      '<div class="id-stats"><div class="id-collapse"><div class="id-stat"><b>' + t.level.level + '</b><span>уровень</span></div>' +
      '<div class="id-stat"><b>' + t.coins + ' ◈</b><span>неткоины</span></div>' +
      '<div class="id-stat"><b>' + done + '/' + QUESTS.length + '</b><span>работы</span></div></div></div>' +
      '<div class="id-level"><div class="id-collapse"><span class="xp-meta">' + esc(t.level.title) + ' · ' + t.xp + ' XP</span>' +
      '<div class="xp-bar"><i style="--p:' + (t.level.progress / 100) + '"></i></div></div></div>';

    $('sla-grid').innerHTML = [
      ['работ открыто', QUESTS.length - done], ['работ сдано', done], ['на отлично (≥95%)', ready],
      ['средний балл, %', avg], ['неткоинов', t.coins], ['опыт, XP', t.xp]
    ].map(function (s) { return '<div class="sla-stat"><b>' + s[1] + '</b><span>' + s[0] + '</span></div>'; }).join('');

    var dutyDay = $('duty-day');
    if (dutyDay) dutyDay.textContent = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });

    renderRoadmap(p);
    renderFeed(p);
  }

  function renderRoadmap(p) {
    var done = 0;
    var groups = Object.keys(SPRINTS).map(Number).map(function (sp) {
      var rows = QUESTS.filter(function (q) { return q.sprint === sp; }).map(function (q) {
        var mst = mastery(p.id, q.id);
        if (mst.pct >= 95) done++;
        return '<a class="quest-card" href="' + q.href + '">' +
          '<div class="quest-glyph">' + mascotSvg(q.glyph, 42) + '</div>' +
          '<div><h3>' + esc(q.title) + '</h3><p><span class="os-tag linux">практическая работа</span></p>' +
          '<div class="quest-progress"><i style="--p:' + (mst.pct / 100) + '"></i></div></div>' +
          '<div class="quest-side"><span class="flat-badge ' + mst.cls + '">' + mst.label + '</span></div></a>';
      }).join('');
      return '<div class="sprint-group"><div class="sprint-head"><h3>спринт ' + sp + ' · ' + esc(SPRINTS[sp].title) + '</h3>' +
        '<span class="sprint-meta">// ' + esc(SPRINTS[sp].note) + '</span><span class="sprint-line"></span></div>' + rows + '</div>';
    }).join('');
    var overall = Math.round(done / QUESTS.length * 100);
    $('roadmap').innerHTML = '<div class="roadmap-overview"><div><strong>роадмап бюро</strong>' +
      '<p class="admin-hint">Пять спринтов от сложного документа до простого сайта. Приложения: LibreOffice и Microsoft Office, пара работ — с сетевыми инструментами.</p></div>' +
      '<div class="roadmap-meter"><span class="xp-meta">' + done + ' из ' + QUESTS.length + ' · ' + overall + '%</span><div class="xp-bar"><i style="--p:' + (overall / 100) + '"></i></div></div></div>' + groups;
  }

  function renderFeed(p) {
    var events = OFFICE.ledger().filter(function (e) { return e.profileId === p.id; })
      .sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); }).slice(0, 8);
    $('feed').innerHTML = events.length ? '<ul class="feed-list">' + events.map(function (e) {
      var d = new Date(e.at);
      return '<li><span class="feed-type">+' + e.xp + ' XP</span><span class="feed-note">' + esc(e.note || e.type) + '</span>' +
        '<span class="feed-date">' + d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</span></li>';
    }).join('') + '</ul>' : '<div class="rv-empty rv-empty--mascot">' + mascotSvg('fox', 44) + '<span>// лента пуста: откройте первую работу бюро</span></div>';
  }

  function init() {
    if (typeof OFFICE === 'undefined') return;
    var form = $('gate-form'), gate = $('gate'), dash = $('dash');
    var picked = 'fox';
    function mountPicker(cur) {
      $('mascot-host').innerHTML = mascotPicker(cur);
      $('mascot-host').querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          picked = b.dataset.mascot;
          $('mascot-host').querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-selected', x === b); });
        });
      });
    }
    var existing = OFFICE.getProfile();
    if (existing && existing.name) { renderDashboard(existing); }
    else { gate.hidden = false; mountPicker(picked); }

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('p-name').value.trim(), group = $('p-group').value.trim();
      if (!name || !group) { setMsg($('gate-msg'), 'Заполните ФИО и учебную группу.', 'bad'); return; }
      var p = OFFICE.ensureProfile(name, group, picked);
      /* Возврат к работе, с которой пришёл гейт: только локальный html-файл */
      var back = null;
      try {
        var r = new URLSearchParams(location.search).get('return');
        if (r && /^[\w.-]+\.html$/.test(r)) back = r;
      } catch (err) {}
      if (back) { location.href = back; return; }
      renderDashboard(p);
    });
    var changeBtn = $('profile-change');
    if (changeBtn) changeBtn.addEventListener('click', function () {
      var p = OFFICE.getProfile();
      var name = prompt('ФИО', p.name), group = prompt('Учебная группа', p.group);
      if (name && group && name.trim() && group.trim()) { OFFICE.updateProfile({ name: name.trim(), group: group.trim() }); renderDashboard(OFFICE.getProfile()); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
