/* ==========================================================================
   OPS KIT · движок лабораторных вселенной «ДатаПолис»
   Страница лабораторной — статический HTML со встроенным JSON (#ops-data).
   Рендерит бриф, теорию, шпаргалку Linux/Windows, бэклог задач, тикет с SLA,
   runbook, (для изменений) план отката, (для инцидентов) blameless postmortem,
   квиз и рефлексию. Состояние — в localStorage (префикс opskit:), сдача
   формирует ops-submission/1 и начисляет XP/неткоины через OPS. Без сервера.
   ========================================================================== */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nowISO() { return new Date().toISOString(); }
  function setMsg(el, text, state) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.remove('is-ok', 'is-bad', 'is-warn');
    if (state) el.classList.add('is-' + state);
  }
  function uid() { return 'opslab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  var STORE = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function showBootError(name, err) {
    if (window && window.console) console.error('[ops-kit] ' + name + ':', err);
    var host = document.getElementById('main-content') || document.body;
    if (!host) return;
    var box = document.createElement('div');
    box.className = 'st-init-error';
    box.setAttribute('role', 'alert');
    box.innerHTML = '<strong>// модуль «' + name + '» запустился с ошибкой.</strong>' +
      '<span>Сохранение работает; обновите страницу. Если повторяется — текст из консоли (F12) преподавателю.</span>';
    host.insertBefore(box, host.firstChild);
  }

  function boot() {
    var node = $('ops-data');
    if (!node || typeof OPS === 'undefined') return;
    var cfg;
    try { cfg = JSON.parse(node.textContent); }
    catch (e) { showBootError('данные лабораторной', e); return; }

    var profile = OPS.getProfile();
    if (!profile || !profile.name) {
      location.href = 'index.html?return=' + encodeURIComponent(location.pathname.split('/').pop());
      return;
    }
    var fpName = $('fp-name'), fpGroup = $('fp-group');
    if (fpName) fpName.textContent = profile.name;
    if (fpGroup) fpGroup.textContent = OPS.handleFor(profile).text;

    /* Presence изолирован: его сбой не должен убивать рендер лабораторной */
    try {
      (function presence() {
        var beat = function () { OPS.heartbeat(profile, cfg.id); };
        beat(); setInterval(beat, 15000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
        window.addEventListener('beforeunload', beat);
      })();
    } catch (e) { if (window && window.console) console.warn('[ops-kit] presence:', e); }

    try {
    var key = 'opskit:' + cfg.id;
    var state = STORE.get(key, {
      tasks: {}, quiz: { answers: {}, done: false, correct: 0 }, reflection: {},
      ticketId: null, runbookId: null, rcaId: null, rollback: '', solution: '',
      startedAt: null, finished: false, lastScore: 0
    });
    function save() { STORE.set(key, state); }
    if (!state.startedAt) { state.startedAt = nowISO(); save(); }

    function progress() {
      var done = cfg.tasks.filter(function (t) { return state.tasks[t.id]; }).length;
      var pct = Math.round(done / cfg.tasks.length * 100);
      var bar = $('ops-progress-bar'), label = $('ops-progress-label');
      if (bar) bar.style.width = pct + '%';
      if (label) label.textContent = done + ' из ' + cfg.tasks.length + ' задач · ' + pct + '%';
      return { done: done, total: cfg.tasks.length, pct: pct };
    }

    function briefHtml() {
      var svg = window.MASCOTS ? MASCOTS.svg(cfg.mascot || 'wolf', { size: 56, floating: true }) : '';
      return '<section class="lab-panel lab-brief"><div class="mc-speech"><div class="mc-speech-avatar">' + svg + '</div>' +
        '<div class="mc-bubble"><p class="mc-who">' + esc(cfg.who || 'Дежурная смена') + '</p><p class="mc-text">' + cfg.story + '</p></div></div></section>';
    }
    function theoryHtml() {
      if (!cfg.theory || !cfg.theory.length) return '';
      return '<section class="lab-panel" id="ops-theory"><div class="lp-head"><span>теория и опорные конспекты</span><span class="kind-badge">индивидуально</span></div><div class="lp-body lab-theory">' +
        cfg.theory.map(function (b, i) {
          return '<article class="theory-block"><h3><span class="theory-num">// ' + String(i + 1).padStart(2, '0') + '</span> ' + esc(b.h) + '</h3><p>' + b.p + '</p>' +
            (b.code ? '<pre class="lab-codeblock"><code>' + esc(b.code) + '</code></pre>' : '') +
            (b.note ? '<p class="lab-note">⚑ ' + esc(b.note) + '</p>' : '') + '</article>';
        }).join('') + '</div></section>';
    }
    function commandsHtml() {
      if (!cfg.commands || !cfg.commands.length) return '';
      return '<section class="lab-panel" id="ops-commands"><div class="lp-head"><span>шпаргалка команд</span><span class="kind-badge">Linux · Windows</span></div><div class="lp-body"><div class="cmd-duo">' +
        '<div class="cmd-col"><h4><span class="os-tag linux">ALT Linux</span></h4>' +
        cfg.commands.map(function (c) { return '<div class="cmd-row"><code>' + esc(c.linux || '—') + '</code><span>' + esc(c.what) + '</span></div>'; }).join('') + '</div>' +
        '<div class="cmd-col"><h4><span class="os-tag windows">Windows</span></h4>' +
        cfg.commands.map(function (c) { return '<div class="cmd-row"><code>' + esc(c.windows || '—') + '</code><span>' + esc(c.what) + '</span></div>'; }).join('') + '</div>' +
        '</div></div></section>';
    }
    function tasksHtml() {
      return '<section class="lab-panel" id="ops-tasks"><div class="lp-head"><span>бэклог смены</span><span class="kind-badge" id="ops-task-chip">чек-лист</span></div><div class="lp-body">' +
        '<p class="admin-hint">Отмечайте задачу после реального выполнения на сервере, ВМ или стенде. Честность прогресса — правило дежурной смены.</p><div class="task-list">' +
        cfg.tasks.map(function (t, i) {
          var on = !!state.tasks[t.id];
          return '<label class="task-item' + (on ? ' is-done' : '') + '"><input type="checkbox" data-task="' + esc(t.id) + '"' + (on ? ' checked' : '') + '>' +
            '<span class="task-body"><span class="task-title"><span class="task-num">' + String(i + 1).padStart(2, '0') + '</span> ' + esc(t.text) + '</span>' +
            (t.hint ? '<span class="task-hint">' + esc(t.hint) + '</span>' : '') + '</span></label>';
        }).join('') + '</div></div></section>';
    }

    function ticketHtml() {
      if (!cfg.ticket) return '';
      var t = cfg.ticket;
      var kindCls = t.type === 'incident' ? 'tk-incident' : t.type === 'change' ? 'tk-change' : '';
      var typeLabel = t.type === 'incident' ? 'инцидент' : t.type === 'change' ? 'изменение' : 'заявка Service Desk';
      var stateLabel = state.ticketId ? 'в работе/закрыт — смотрите доску' : 'открыт, ждёт реакции';
      var stateCls = state.ticketId ? 'is-progress' : 'is-open';
      var rollback = t.type === 'change' ?
        '<div class="rollback-field"><label class="flat-label" for="ops-rollback">план отката (обязателен для изменения)</label>' +
        '<textarea class="flat-input" id="ops-rollback" rows="2" placeholder="Как вернуть всё как было, если изменение сломает сервис">' + esc(state.rollback) + '</textarea></div>' : '';
      return '<section class="lab-panel ticket-card ' + kindCls + '" id="ops-ticket"><div class="lp-head"><span>тикет обслуживания</span><span class="kind-badge">' + esc(typeLabel) + '</span></div><div class="lp-body">' +
        '<div class="ticket-head"><h3>' + esc(t.title) + '</h3><span class="sev sev-' + esc(t.priority) + '">' + esc(t.priority) + '</span>' +
        '<span class="ticket-state ' + stateCls + '">' + stateLabel + '</span></div>' +
        '<p class="ticket-text">' + esc(t.text) + '</p>' +
        (t.deliverables ? '<ul class="submit-channels">' + t.deliverables.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="sla-meter"><span class="sla-num">SLA-окно: ' + esc(OPS.SLA_MIN[t.priority]) + ' мин</span><div class="xp-bar"><i id="ops-sla-bar" style="width:0"></i></div><span class="sla-num" id="ops-sla-state">не взят</span></div>' +
        rollback +
        '<div class="ticket-actions">' +
        '<button class="flat-btn" type="button" id="ops-ticket-ack">взять в работу</button>' +
        '<button class="flat-btn ghost" type="button" id="ops-ticket-resolve" disabled>закрыть с решением</button></div>' +
        '<p class="ops-msg" id="ops-ticket-msg" role="status"></p></div></section>';
    }

    function runbookHtml() {
      if (!cfg.runbook) return '';
      return '<section class="lab-panel" id="ops-runbook"><div class="lp-head"><span>runbook · база знаний смены</span><span class="kind-badge">артефакт сдачи</span></div><div class="lp-body runbook-editor">' +
        '<p class="admin-hint">Runbook — пошаговая инструкция, по которой новичок повторит вашу работу без вас. Опирайтесь на предложенный каркас.</p>' +
        '<div class="runbook-step runbook-map">' +
        '<span class="rs-num">карта</span><div>' + cfg.runbook.steps.map(function (s, i) {
          return '<p><strong>' + String(i + 1) + '.</strong> ' + esc(s) + '</p>';
        }).join('') + '</div></div>' +
        '<textarea class="flat-input" id="ops-runbook-text" rows="5" placeholder="Ваш runbook: пронумерованные шаги, команды и проверки результата">' + esc(state.runbookText || '') + '</textarea>' +
        '<button class="flat-btn ghost" type="button" id="ops-runbook-save">сохранить runbook в базу знаний</button>' +
        '<p class="ops-msg" id="ops-runbook-msg" role="status"></p></div></section>';
    }

    function rcaHtml() {
      if (!cfg.rca) return '';
      return '<section class="lab-panel rca-box" id="ops-rca"><div class="lp-head"><span>postmortem · разбор без вины</span><span class="kind-badge">blameless</span></div><div class="lp-body">' +
        '<div class="blameless-note"><span>🛡</span><span>Цель разбора — найти <strong>причину и защиту на будущее</strong>, а не виноватого. Ошибка сотрудника — это дефект процесса, который чинится системно.</span></div>' +
        '<div class="rca-fields">' +
        '<div><label>что произошло и влияние (какие сервисы/пользователи затронуты)</label><textarea class="flat-input" data-rca="impact" rows="2">' + esc((state.rcaFields || {}).impact || '') + '</textarea></div>' +
        '<div><label>корневая причина (root cause)</label><textarea class="flat-input" data-rca="cause" rows="2">' + esc((state.rcaFields || {}).cause || '') + '</textarea></div>' +
        '<div><label>меры на будущее (конкретные действия и сроки)</label><textarea class="flat-input" data-rca="actions" rows="2">' + esc((state.rcaFields || {}).actions || '') + '</textarea></div>' +
        '</div><button class="flat-btn ghost" type="button" id="ops-rca-save">сохранить postmortem</button>' +
        '<p class="ops-msg" id="ops-rca-msg" role="status"></p></div></section>';
    }

    function quizHtml() {
      if (!cfg.quiz || !cfg.quiz.length) return '';
      return '<section class="lab-panel" id="ops-quiz"><div class="lp-head"><span>контрольный тест · ' + cfg.quiz.length + ' вопросов</span><span class="kind-badge">самопроверка</span></div><div class="lp-body"><div id="ops-quiz-box"></div></div></section>';
    }
    function renderQuiz() {
      var box = $('ops-quiz-box');
      if (!box) return;
      box.innerHTML = cfg.quiz.map(function (item, qi) {
        var opts = item.options.map(function (opt, oi) {
          var cls = 'q-opt';
          if (state.quiz.done) {
            if (oi === item.answer) cls += ' is-ok';
            else if (state.quiz.answers[qi] === oi) cls += ' is-bad';
          }
          return '<label class="' + cls + '"><input type="radio" name="opsq' + qi + '" value="' + oi + '"' +
            (state.quiz.answers[qi] === oi ? ' checked' : '') + (state.quiz.done ? ' disabled' : '') + '><span>' + esc(opt) + '</span></label>';
        }).join('');
        var verdict = '', explain = '';
        if (state.quiz.done) {
          var chosen = state.quiz.answers[qi];
          var answered = chosen != null;
          var isCorrect = answered && chosen === item.answer;
          var vCls = !answered ? 'is-warn' : isCorrect ? 'is-ok' : 'is-bad';
          var vText = !answered ? 'без ответа' : isCorrect ? 'верно' : 'неверно';
          verdict = '<p class="q-verdict ' + vCls + '"><span class="q-verdict-badge">' + vText + '</span>' +
            (isCorrect ? '' : ' правильный ответ: <strong>' + esc(item.options[item.answer]) + '</strong>') + '</p>';
          explain = '<p class="q-explain">// ' + esc(item.explain) + '</p>';
        }
        return '<div class="q-item"><p class="q-title"><span class="q-num">' + String(qi + 1).padStart(2, '0') + '</span> ' + esc(item.q) + '</p><div class="q-opts">' + opts + '</div>' + verdict + explain + '</div>';
      }).join('') +
      '<div class="q-actions"><button class="flat-btn" type="button" id="ops-quiz-check"' + (state.quiz.done ? ' hidden' : '') + '>проверить ответы</button>' +
      '<button class="flat-btn ghost" type="button" id="ops-quiz-reset"' + (state.quiz.done ? '' : ' hidden') + '>пройти заново</button>' +
      '<span class="q-score" id="ops-quiz-score" role="status"></span></div>';
      box.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var qi = Number(radio.closest('.q-item').querySelector('.q-num').textContent) - 1;
          state.quiz.answers[qi] = Number(radio.value); save();
        });
      });
      $('ops-quiz-check').addEventListener('click', function () {
        var correct = 0;
        cfg.quiz.forEach(function (item, qi) { if (state.quiz.answers[qi] === item.answer) correct++; });
        state.quiz.correct = correct; state.quiz.done = true; save(); renderQuiz(); quizScore();
      });
      $('ops-quiz-reset').addEventListener('click', function () {
        state.quiz = { answers: {}, done: false, correct: 0 }; save(); renderQuiz(); quizScore();
      });
      quizScore();
    }
    function quizScore() {
      var el = $('ops-quiz-score');
      if (!el) return;
      el.textContent = state.quiz.done ? 'результат: ' + state.quiz.correct + '/' + cfg.quiz.length : '// ответьте на все вопросы';
      el.className = 'q-score' + (state.quiz.done && state.quiz.correct === cfg.quiz.length ? ' is-ok' : state.quiz.done ? ' is-bad' : '');
    }

    function reflectionHtml() {
      if (!cfg.reflection || !cfg.reflection.length) return '';
      return '<section class="lab-panel" id="ops-reflection"><div class="lp-head"><span>рефлексия смены</span><span class="kind-badge">2 минуты</span></div><div class="lp-body">' +
        cfg.reflection.map(function (q, i) {
          return '<div class="reflect-item"><label for="ops-rf' + i + '">' + esc(q) + '</label><textarea class="flat-input" id="ops-rf' + i + '" rows="2" data-rf="' + i + '">' + esc(state.reflection[i] || '') + '</textarea></div>';
        }).join('') +
        '<div class="plus-minus"><div><strong>плюсы</strong><textarea class="flat-input" rows="2" data-rf="plus" placeholder="что сработало хорошо">' + esc(state.reflection.plus || '') + '</textarea></div>' +
        '<div><strong>минусы · точки роста</strong><textarea class="flat-input" rows="2" data-rf="minus" placeholder="что улучшить в следующую смену">' + esc(state.reflection.minus || '') + '</textarea></div></div></div></section>';
    }

    function bindTicket() {
      if (!cfg.ticket) return;
      var msg = $('ops-ticket-msg'), ack = $('ops-ticket-ack'), res = $('ops-ticket-resolve'), slaBar = $('ops-sla-bar'), slaState = $('ops-sla-state');
      function refresh() {
        if (!state.ticketId) return;
        var t = OPS.getTicket(state.ticketId);
        if (!t) return;
        if (t.ackedAt) { ack.disabled = true; res.disabled = !!t.resolvedAt; slaBar.style.width = '100%'; slaState.textContent = t.resolvedAt ? ('закрыт · SLA ' + (t.slaMet ? 'выдержан' : 'нарушен')) : 'в работе'; }
      }
      ack.addEventListener('click', function () {
        if (state.ticketId) return;
        var t = OPS.createTicket({
          type: cfg.ticket.type, priority: cfg.ticket.priority, title: cfg.ticket.title,
          description: cfg.ticket.text, labId: cfg.id, crewId: profile.crewId, author: OPS.publicStudent(profile)
        });
        OPS.updateTicket(t.id, { assignee: OPS.publicStudent(profile) });
        state.ticketId = t.id; save();
        ack.disabled = true; res.disabled = false;
        slaState.textContent = 'вы взяли в работу';
        setMsg(msg, '// Тикет ' + t.id + ' создан и назначен на вас. Время реакции зафиксировано.', 'ok');
      });
      res.addEventListener('click', function () {
        if (!state.ticketId) return;
        if (cfg.ticket.type === 'change' && !($('ops-rollback').value || '').trim()) {
          setMsg(msg, 'Для изменения обязателен план отката — заполните поле выше.', 'bad'); return;
        }
        var resolution = ($('ops-solution') ? $('ops-solution').value : '') || 'решение зафиксировано в runbook';
        var t = OPS.updateTicket(state.ticketId, { status: 'resolved', resolution: resolution });
        OPS.award(profile.id, t.type === 'incident' ? 'incidentResolved' : t.type === 'change' ? 'changeReleased' : 'ticketClosed', 'tk:' + t.id, { ticketId: t.id });
        if (t.slaMet) OPS.award(profile.id, 'slaMet', 'sla:' + t.id, { ticketId: t.id });
        res.disabled = true; refresh();
        setMsg(msg, '// Тикет закрыт' + (t.slaMet ? ', SLA выдержан — дополнительный опыт.' : ', SLA нарушен: это повод для postmortem, а не для штрафа.'), t.slaMet ? 'ok' : 'warn');
      });
      var rb = $('ops-rollback');
      if (rb) rb.addEventListener('input', function () { state.rollback = rb.value; save(); });
      refresh();
    }

    function bindRunbook() {
      var ta = $('ops-runbook-text'), btn = $('ops-runbook-save'), msg = $('ops-runbook-msg');
      if (!ta) return;
      ta.addEventListener('input', function () { state.runbookText = ta.value; save(); });
      btn.addEventListener('click', function () {
        if (ta.value.trim().length < 30) { setMsg(msg, 'Слишком короткий runbook: опишите хотя бы несколько конкретных шагов.', 'bad'); return; }
        if (!state.runbookId) {
          var rb = OPS.addRunbook({ title: 'Runbook: ' + cfg.title, steps: ta.value.split('\n').filter(Boolean), labId: cfg.id, author: OPS.publicStudent(profile) });
          state.runbookId = rb.id; save();
          OPS.award(profile.id, 'runbookWritten', 'rb:' + cfg.id, { labId: cfg.id });
          setMsg(msg, '// Runbook сохранён в базу знаний экипажа, опыт начислен.', 'ok');
        } else setMsg(msg, '// Runbook этой лабораторной уже в базе знаний.', 'warn');
      });
    }
    function bindRca() {
      if (!cfg.rca) return;
      state.rcaFields = state.rcaFields || {};
      document.querySelectorAll('[data-rca]').forEach(function (ta) {
        ta.addEventListener('input', function () { state.rcaFields[ta.dataset.rca] = ta.value; save(); });
      });
      $('ops-rca-save').addEventListener('click', function () {
        var f = state.rcaFields;
        if (!f.impact || !f.cause || !f.actions || !f.impact.trim() || !f.cause.trim() || !f.actions.trim()) {
          setMsg($('ops-rca-msg'), 'Заполните все три поля разбора.', 'bad'); return;
        }
        if (!state.rcaId) {
          var pm = OPS.addPostmortem({ ticketId: state.ticketId, labId: cfg.id, impact: f.impact, rootCause: f.cause, actions: f.actions, author: OPS.publicStudent(profile) });
          state.rcaId = pm.id; save();
          OPS.award(profile.id, 'postmortem', 'rca:' + cfg.id, { labId: cfg.id });
          setMsg($('ops-rca-msg'), '// Postmortem сохранён. Без вины, с системными выводами — опыт начислен.', 'ok');
        } else setMsg($('ops-rca-msg'), '// Postmortem этой лабораторной уже сохранён.', 'warn');
      });
    }

    function finishHtml() {
      return '<section class="lab-panel" id="ops-finish"><div class="lp-body finish-body">' +
        '<p class="admin-hint">Сдача засчитается при отмеченном бэклоге и пройденном тесте. Итог попадёт в историю и повлияет на уровень, неткоины и репутацию экипажа.</p>' +
        '<button class="flat-btn" id="ops-finish-btn" type="button">сдать лабораторную ↓</button>' +
        '<p class="ops-msg" id="ops-finish-msg" role="status"></p></div></section>';
    }
    function computeScore(p) {
      var taskPart = p.total ? p.done / p.total * 70 : 0;
      var quizPart = cfg.quiz && cfg.quiz.length ? state.quiz.correct / cfg.quiz.length * 30 : 30;
      return Math.round(taskPart + quizPart);
    }
    function syncBtn(score) {
      var b = $('ops-finish-btn');
      if (!b) return;
      if (score >= 100) { b.disabled = true; b.textContent = 'сдано на 100% ✓'; }
      else if (state.finished) { b.disabled = false; b.textContent = 'обновить сдачу ↻'; }
    }
    function bindFinish() {
      var btn = $('ops-finish-btn');
      btn.addEventListener('click', function () {
        var p = progress();
        if (p.total - p.done > 0) { setMsg($('ops-finish-msg'), 'Отметьте выполненные задачи бэклога: осталось ' + (p.total - p.done) + '.', 'bad'); return; }
        if (cfg.quiz && cfg.quiz.length && !state.quiz.done) { setMsg($('ops-finish-msg'), 'Сначала пройдите контрольный тест.', 'bad'); return; }
        var score = computeScore(p);
        var sub = {
          id: uid(), schema: 'ops-submission/1', standId: cfg.id, standTitle: cfg.title,
          student: OPS.publicStudent(profile), startedAt: state.startedAt || nowISO(),
          updatedAt: nowISO(), submittedAt: nowISO(),
          result: { passed: p.done, total: p.total, score: score, ready: score >= 95 },
          checks: cfg.tasks.map(function (t) { return { id: t.id, ok: !!state.tasks[t.id], title: t.text }; }),
          ticketId: state.ticketId, runbookId: state.runbookId, rcaId: state.rcaId,
          quiz: state.quiz.done ? { answers: state.quiz.answers, done: true, correct: state.quiz.correct } : null,
          reflection: state.reflection
        };
        OPS.addSubmission(sub);
        OPS.award(profile.id, 'submit', 'submit:' + cfg.id + ':' + Date.now().toString(36), { standId: cfg.id });
        if (sub.result.ready) OPS.award(profile.id, 'standReady', 'ready:' + cfg.id, { standId: cfg.id });
        if (cfg.quiz && state.quiz.correct === cfg.quiz.length) OPS.award(profile.id, 'quizPerfect', 'quiz:' + cfg.id, { standId: cfg.id });
        state.finished = true; state.lastScore = score; save();
        var fm = $('ops-finish-msg');
        fm.className = 'ops-msg is-ok';
        fm.innerHTML = '✓ Сдано на <strong>' + score + '%</strong>. Запись в истории сервиса, экипаж видит вклад в репутацию.';
        syncBtn(score); progress();
      });
    }

    var root = $('ops-root');
    root.innerHTML =
      '<div class="lk-progress-strip"><div class="xp-bar"><i id="ops-progress-bar" style="width:0"></i></div><span class="xp-meta" id="ops-progress-label">—</span>' +
      '<span class="kind-badge">спринт ' + cfg.sprint + ' · ' + esc(cfg.sprintTitle) + '</span></div>' +
      briefHtml() + theoryHtml() + commandsHtml() + tasksHtml() + ticketHtml() + runbookHtml() + rcaHtml() + quizHtml() + reflectionHtml() + finishHtml();

    root.querySelectorAll('input[type="checkbox"][data-task]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.tasks[cb.dataset.task] = cb.checked;
        cb.closest('.task-item').classList.toggle('is-done', cb.checked); save(); progress();
      });
    });
    root.querySelectorAll('textarea[data-rf]').forEach(function (ta) {
      ta.addEventListener('input', function () { state.reflection[ta.dataset.rf] = ta.value; save(); });
    });
    var sol = $('ops-solution');
    if (sol) sol.addEventListener('input', function () { state.solution = sol.value; save(); });

    progress(); renderQuiz(); bindTicket(); bindRunbook(); bindRca(); bindFinish();
    if (state.finished) { syncBtn(state.lastScore || 0); var m = $('ops-finish-msg'); if (m) { m.className = 'ops-msg'; m.textContent = '✓ Работа уже сдавалась. Доработайте и отправьте повторно — лучшая версия идёт в зачёт.'; } }
    } catch (e) { showBootError('лабораторная «' + (cfg.title || cfg.id) + '»', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
