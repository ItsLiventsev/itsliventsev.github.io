/* ==========================================================================
   OPS HUB · кабинет сервисного центра «ДатаПолис»
   Профиль-гейт, экипаж и ротация ролей, метрики SLA, доска тикетов,
   роадмап спринтов с мастерством, лента событий, обмен кодами ITS-*.
   ========================================================================== */
(function () {
  'use strict';
  var $ = window.DOMKIT.$;  // общий хелпер: dom-kit.js
  var esc = window.DOMKIT.esc;  // единое экранирование: dom-kit.js
  function mascotSvg(id, size) { return window.MASCOTS ? MASCOTS.svg(id || 'wolf', { size: size || 44, floating: false }) : ''; }
  var setMsg = window.DOMKIT.setMsg;  // общий статус: dom-kit.js

  /* Роадмап второй вселенной — синхронизирован с id страниц-лабораторных */
  var SPRINTS = {
    1: { title: 'Приёмка', note: 'установка ОС, сеть, инвентаризация и сервисный каталог' },
    2: { title: 'Учёт', note: 'домен, учётные записи, группы и ввод станций' },
    3: { title: 'Сервисы', note: 'DNS, время, файлы, веб и удалённый доступ' },
    4: { title: 'Эксплуатация', note: 'мониторинг, дежурства, инциденты и резервные копии' },
    5: { title: 'Изменения и релиз', note: 'безопасность, план отката и запуск сервиса под ключ' }
  };
  var QUESTS = [
    { id: 'ops-install-alt', sprint: 1, glyph: 'wolf', os: 'linux', title: 'Установка и база ALT Server', href: 'ops-install-alt.html' },
    { id: 'ops-install-win', sprint: 1, glyph: 'cat', os: 'windows', title: 'Установка Windows Server', href: 'ops-install-win.html' },
    { id: 'ops-inventory', sprint: 1, glyph: 'otter', os: 'mixed', title: 'Инвентаризация и сервисный каталог', href: 'ops-inventory.html' },
    { id: 'ops-samba-ad', sprint: 2, glyph: 'raccoon', os: 'linux', title: 'Samba DC · домен и учётные записи', href: 'ops-samba-ad.html' },
    { id: 'ops-win-ad', sprint: 2, glyph: 'cat', os: 'windows', title: 'Windows AD · подразделения и политики', href: 'ops-win-ad.html' },
    { id: 'ops-domain-join', sprint: 2, glyph: 'fox', os: 'mixed', title: 'Ввод рабочих станций в домен', href: 'ops-domain-join.html' },
    { id: 'ops-dns-time', sprint: 3, glyph: 'owl', os: 'linux', title: 'DNS и синхронизация времени', href: 'ops-dns-time.html' },
    { id: 'ops-files', sprint: 3, glyph: 'hedgehog', os: 'linux', title: 'Файловые сервисы NFS и права', href: 'ops-files.html' },
    { id: 'ops-web', sprint: 3, glyph: 'otter', os: 'linux', title: 'Веб-стек, Docker и reverse proxy', href: 'ops-web.html' },
    { id: 'ops-remote', sprint: 3, glyph: 'raccoon', os: 'mixed', title: 'Удалённый доступ SSH и RDP', href: 'ops-remote.html' },
    { id: 'ops-monitor', sprint: 4, glyph: 'wolf', os: 'linux', title: 'Мониторинг, алерты и логи', href: 'ops-monitor.html' },
    { id: 'ops-backup', sprint: 4, glyph: 'hedgehog', os: 'mixed', title: 'Резервное копирование', href: 'ops-backup.html' },
    { id: 'ops-log-audit', sprint: 4, glyph: 'otter', os: 'linux', title: 'Журналы, auditd и ротация', href: 'ops-log-audit.html' },
    { id: 'ops-net-tshoot', sprint: 4, glyph: 'crab', os: 'mixed', title: 'Диагностика сети · парный инцидент', href: 'ops-net-tshoot.html' },
    { id: 'ops-security-change', sprint: 5, glyph: 'cat', os: 'mixed', title: 'Безопасность и управление изменениями', href: 'ops-security-change.html' },
    { id: 'ops-final', sprint: 5, glyph: 'wolf', os: 'mixed', title: 'Запуск сервиса под ключ', href: 'ops-final.html' }
  ];

  function mascotPicker(current) {
    var ids = ['wolf', 'cat', 'otter', 'raccoon', 'owl', 'fox', 'crab', 'hedgehog'];
    return '<div class="mascot-picker">' + ids.map(function (id) {
      return '<button type="button" class="mascot-opt' + (id === current ? ' is-selected' : '') + '" data-mascot="' + id + '" aria-label="' + id + '">' + mascotSvg(id, 40) + '</button>';
    }).join('') + '</div>';
  }

  function mastery(pid, labId) {
    var best = OPS.bestSubmission(pid, labId);
    if (!best) return { pct: 0, label: 'не начат', cls: 'is-soon' };
    var pct = best.result.score || 0;
    return pct >= 95 ? { pct: pct, label: 'сдан ' + pct + '%', cls: 'is-ready' } : { pct: pct, label: 'в работе ' + pct + '%', cls: 'is-run' };
  }

  function renderDashboard(p) {
    $('gate').hidden = true; $('dash').hidden = false;
    var nameField = $('fp-name'), groupField = $('fp-group');
    if (nameField) nameField.textContent = p.name;
    if (groupField) groupField.textContent = p.group;
    OPS.dailyLogin(p.id);
    var t = OPS.totals(p.id), crew = OPS.CREWS.filter(function (c) { return c.id === p.crewId; })[0] || OPS.CREWS[0];
    var role = OPS.currentRole();
    var m = OPS.ticketMetrics(), rep = OPS.crewReputation();

    $('id-card').innerHTML =
      '<div class="id-card-top">' + mascotSvg(p.mascotId, 64) +
      '<div><p class="id-handle">' + esc(OPS.handleFor(p).text) + '</p><p class="id-name">' + esc(p.name) + '</p>' +
      '<p class="id-group">' + esc(p.group) + ' · ' + esc(crew.name) + '</p></div></div>' +
      '<div class="id-stats"><div class="id-collapse"><div class="id-stat"><b>' + t.level.level + '</b><span>уровень</span></div>' +
      '<div class="id-stat"><b>' + t.coins + ' ◈</b><span>неткоины</span></div>' +
      '<div class="id-stat"><b>' + OPS.prpBalance(p.id) + '</b><span>PRP</span></div></div></div>' +
      '<div class="id-level"><div class="id-collapse"><span class="xp-meta">' + esc(t.level.title) + ' · ' + t.xp + ' XP</span>' +
      '<div class="xp-bar"><i style="--p:' + (t.level.progress / 100) + '"></i></div></div></div>';

    $('role-ribbon').innerHTML =
      '<span class="rr-label">роль этой смены</span><span class="rr-name" aria-live="polite">' + esc(role.name) + '</span>' +
      '<span class="rr-note">' + esc(role.note) + '. Роли ротируются — никто не закреплён за одной функцией навсегда.</span>' +
      '<button class="flat-btn ghost" type="button" id="role-rotate">ротировать роль ↻</button>';
    $('role-rotate').addEventListener('click', function () {
      OPS.rotateRole(); renderDashboard(p);
      $('role-rotate').focus({ preventScroll: true });
      $('role-ribbon').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    });

    var dutyDay = $('duty-day');
    if (dutyDay) dutyDay.textContent = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });

    $('sla-grid').innerHTML = [
      ['заявки открыты', m.open], ['закрыто', m.closed], ['SLA выдержан, %', m.slaPct],
      ['инцидентов', m.incidents], ['изменений', m.changes], ['индекс репутации', rep.index]
    ].map(function (s) { return '<div class="sla-stat"><b>' + s[1] + '</b><span>' + s[0] + '</span></div>'; }).join('');

    renderBoard();
    renderRoadmap(p);
    renderFeed(p);
  }

  function renderBoard() {
    var ts = OPS.tickets();
    var cols = { open: [], in_progress: [], resolved: [] };
    ts.forEach(function (t) { if (t.status === 'resolved' || t.status === 'closed') cols.resolved.push(t); else cols[t.status] ? cols[t.status].push(t) : cols.open.push(t); });
    var label = { open: 'открыты', in_progress: 'в работе', resolved: 'закрыты' };
    $('board').innerHTML = Object.keys(cols).map(function (k) {
      var body = cols[k].length ? cols[k].map(function (t) {
        var kind = t.type === 'incident' ? 'инцидент' : t.type === 'change' ? 'изменение' : 'заявка';
        return '<div class="ops-ticket-mini"><span class="sev sev-' + esc(t.priority) + '">' + esc(t.priority) + '</span> <span class="kind-badge">' + kind + '</span>' +
          '<h4>' + esc(t.title) + '</h4><p>' + (t.slaMet === null ? 'SLA идёт' : t.slaMet ? 'SLA выдержан' : 'SLA нарушен · нужен разбор') + '</p></div>';
      }).join('') : '<div class="ops-empty">// пусто: тикеты появятся из лабораторных</div>';
      return '<div class="ops-column"><div class="ops-column-head"><span>' + label[k] + '</span><span class="count">' + cols[k].length + '</span></div><div class="ops-column-body">' + body + '</div></div>';
    }).join('');
  }

  function renderRoadmap(p) {
    var done = 0;
    var groups = Object.keys(SPRINTS).map(Number).map(function (sp) {
      var rows = QUESTS.filter(function (q) { return q.sprint === sp; }).map(function (q) {
        var mst = mastery(p.id, q.id);
        if (mst.pct >= 95) done++;
        return '<a class="quest-card" href="' + q.href + '">' +
          '<div class="quest-glyph">' + mascotSvg(q.glyph, 42) + '</div>' +
          '<div><h3>' + esc(q.title) + '</h3><p><span class="os-tag ' + (q.os === 'windows' ? 'windows' : q.os === 'linux' ? 'linux' : 'linux') + '">' + (q.os === 'windows' ? 'Windows' : q.os === 'linux' ? 'ALT Linux' : 'смешанно') + '</span></p>' +
          '<div class="quest-progress"><i style="--p:' + (mst.pct / 100) + '"></i></div></div>' +
          '<div class="quest-side"><span class="flat-badge ' + mst.cls + '">' + mst.label + '</span></div></a>';
      }).join('');
      return '<div class="sprint-group"><div class="sprint-head"><h3>спринт ' + sp + ' · ' + esc(SPRINTS[sp].title) + '</h3>' +
        '<span class="sprint-meta">// ' + esc(SPRINTS[sp].note) + '</span><span class="sprint-line"></span></div>' + rows + '</div>';
    }).join('');
    var overall = Math.round(done / QUESTS.length * 100);
    $('roadmap').innerHTML = '<div class="roadmap-overview"><div><strong>роадмап эксплуатации</strong>' +
      '<p class="admin-hint">Пять спринтов от приёмки сервера до запуска сервиса с дежурством. ~70% ALT Linux, ~30% Windows.</p></div>' +
      '<div class="roadmap-meter"><span class="xp-meta">' + done + ' из ' + QUESTS.length + ' · ' + overall + '%</span><div class="xp-bar"><i style="--p:' + (overall / 100) + '"></i></div></div></div>' + groups;
  }

  function renderFeed(p) {
    var events = OPS.ledger().filter(function (e) { return e.profileId === p.id; })
      .sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); }).slice(0, 8);
    $('feed').innerHTML = events.length ? '<ul class="feed-list">' + events.map(function (e) {
      var d = new Date(e.at);
      return '<li><span class="feed-type">+' + e.xp + ' XP</span><span class="feed-note">' + esc(e.note || e.type) + '</span>' +
        '<span class="feed-date">' + d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</span></li>';
    }).join('') + '</ul>' : '<div class="rv-empty rv-empty--mascot">' + mascotSvg('otter', 44) + '<span>// лента пуста: выйдите на первую смену</span></div>';
  }

  /* --------------------- Страница «операции экипажа» (crew-ops.html) ---------------------
     Общая работа ДатаПолиса: инженеры вместе проходят чек-листы операций
     (смена дежурства, war room, аудит доступов…). Шаги отмечают каждый в
     своём браузере, закрытие — у координатора, который вводит состав.
     Награда: XP/неткоины каждому участнику с дедупом на неделю + очки экипажу. */
  function renderCrewOps(p) {
    var root = $('crew-ops-root');
    if (!root) return false;
    var ops = OPS.CREW_OPS, steps = OPS.crewSteps(), done = OPS.crewOpsDone();
    var crew = OPS.CREWS.filter(function (c) { return c.id === p.crewId; })[0] || OPS.CREWS[0];
    var pts = OPS.crewPointsMap()[p.crewId] || 0;
    var totalPts = 0;
    OPS.crewPointsMap() && Object.keys(OPS.crewPointsMap()).forEach(function (k) { totalPts += OPS.crewPointsMap()[k]; });
    var doneCount = {};
    done.forEach(function (d) { doneCount[d.opId] = (doneCount[d.opId] || 0) + 1; });

    var html = '<div class="ops-cohead">' +
      '<div><strong>' + esc(crew.name) + '</strong><span>' + esc(crew.focus) + '</span></div>' +
      '<div class="sla-stats"><div class="sla-stat"><b>' + pts + '</b><span>очков экипажа</span></div>' +
      '<div class="sla-stat"><b>' + Object.keys(doneCount).length + '/' + ops.length + '</b><span>типов операций закрыто</span></div></div></div>';

    html += '<div class="ops-cogrid">' + ops.map(function (op) {
      var allChecked = op.steps.every(function (_, i) { return steps[op.id + '#' + i]; });
      var closed = doneCount[op.id] || 0;
      var roleList = op.roles.map(function (r) { return '<span class="ops-role-chip">' + esc(r) + '</span>'; }).join('');
      var stepList = '<ul class="ops-steps">' + op.steps.map(function (st, i) {
        var on = !!steps[op.id + '#' + i];
        return '<li><label class="ops-step' + (on ? ' is-done' : '') + '">' +
          '<input type="checkbox" data-op-step="' + op.id + '#' + i + '"' + (on ? ' checked' : '') + '>' +
          '<span>' + esc(st) + '</span></label></li>';
      }).join('') + '</ul>';
      var recent = done.filter(function (d) { return d.opId === op.id; }).slice(-2)
        .map(function (d) { return '<li class="mono">' + esc(d.participants.join(', ')) + '</li>'; }).join('');
      return '<article class="ops-cocard" id="op-' + op.id + '">' +
        '<div class="ops-cocard-head"><div><strong>' + esc(op.title) + '</strong>' +
        '<p>' + esc(op.brief) + '</p></div>' +
        '<div class="ops-cocard-meta"><span class="ops-op-points mono">+' + op.points + '</span>' +
        '<span class="ops-op-done mono">' + (closed ? 'проведено: ' + closed : 'ещё не проводилась') + '</span></div></div>' +
        '<div class="ops-role-row">' + roleList + '<span class="ops-role-note mono">минимум ' + op.minParticipants + ' участн.</span></div>' +
        stepList +
        (recent ? '<p class="ops-recent-label mono">// последние составы:</p><ul class="ops-recent">' + recent + '</ul>' : '') +
        '<div class="ops-close-row">' +
        '<input class="ops-participants" id="participants-' + op.id + '" type="text" ' +
        'placeholder="участники через запятую (минимум ' + op.minParticipants + ')">' +
        '<button class="btn btn-primary" type="button" data-op-close="' + op.id + '"' + (allChecked ? '' : ' disabled') + '>операция проведена ✓</button>' +
        '</div></article>';
    }).join('') + '</div>';

    root.innerHTML = html;
    root.querySelectorAll('[data-op-step]').forEach(function (box) {
      box.addEventListener('change', function () {
        var parts = box.getAttribute('data-op-step').split('#');
        OPS.setCrewStep(parts[0], parseInt(parts[1], 10), box.checked);
        var now = OPS.crewSteps();
        var all = OPS.CREW_OPS.filter(function (o) { return o.id === parts[0]; })[0]
          .steps.every(function (_, i) { return now[parts[0] + '#' + i]; });
        var btn = root.querySelector('[data-op-close="' + parts[0] + '"]');
        if (btn) btn.disabled = !all;
      });
    });
    root.querySelectorAll('[data-op-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var opId = btn.getAttribute('data-op-close');
        var input = root.querySelector('#participants-' + opId);
        try {
          var res = OPS.closeCrewOp(p, opId, (input.value || '').split(','));
          setMsg($('crew-ops-msg'),
            'Операция «' + res.op.title + '» закрыта: +' + res.op.points + ' очков экипажу, всего у экипажа ' + res.crewPoints +
            '. Участникам: +' + OPS.AWARDS.crewOp.xp + ' XP и +' + OPS.AWARDS.crewOp.coins + ' ◈ (один раз в неделю).', 'ok');
          renderCrewOps(OPS.getProfile());
        } catch (err) { setMsg($('crew-ops-msg'), err.message, 'bad'); }
      });
    });
    return true;
  }

  function init() {
    if (typeof OPS === 'undefined') return;
    var form = $('gate-form'), gate = $('gate'), dash = $('dash');
    var picked = 'wolf';
    function mountPicker(cur) {
      var host = $('mascot-host');
      if (!host) return;
      host.innerHTML = mascotPicker(cur);
      host.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          picked = b.dataset.mascot;
          $('mascot-host').querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-selected', x === b); });
        });
      });
    }
    var existing = OPS.getProfile();
    if (existing && existing.name) {
      /* Спутниковые страницы (биржа) без root/dash просто не рендерят кабинет */
      if (!renderCrewOps(existing) && $('dash')) renderDashboard(existing);
    }
    else if (gate) { gate.hidden = false; mountPicker(picked); }

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('p-name').value.trim(), group = $('p-group').value.trim();
      if (!name || !group) { setMsg($('gate-msg'), 'Заполните ФИО и учебную группу.', 'bad'); return; }
      var p = OPS.ensureProfile(name, group, picked);
      /* Возврат к лабораторной, с которой пришёл гейт: только локальный html-файл */
      var back = null;
      try {
        var r = new URLSearchParams(location.search).get('return');
        if (r && /^[\w.-]+\.html$/.test(r)) back = r;
      } catch (err) {}
      if (back) { location.href = back; return; }
      if (!renderCrewOps(p) && $('dash')) renderDashboard(p);
    });
    var changeBtn = $('profile-change');
    if (changeBtn) changeBtn.addEventListener('click', function () {
      var p = OPS.getProfile();
      var name = prompt('ФИО', p.name), group = prompt('Учебная группа', p.group);
      if (name && group && name.trim() && group.trim()) { OPS.updateProfile({ name: name.trim(), group: group.trim() }); renderDashboard(OPS.getProfile()); }
    });
    var go = $('code-go'), input = $('code-input'), msg = $('code-msg');
    if (go) go.addEventListener('click', function () {
      var lines = (input.value || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      var okN = 0;
      lines.forEach(function (code) {
        try { OPS.importArtifact(code); okN++; } catch (e) { /* битый код пропускаем */ }
      });
      setMsg(msg, okN ? 'Принято артефактов: ' + okN + ' (тикеты, runbook или postmortem).' : 'Коды не распознаны.', okN ? 'ok' : 'bad');
      input.value = '';
      var p = OPS.getProfile(); if (p) renderDashboard(p);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
