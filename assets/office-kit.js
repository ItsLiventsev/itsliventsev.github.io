/* ==========================================================================
   OFFICE KIT · движок практических работ вселенной «ОфисПолис»
   Страница работы — статический HTML со встроенным JSON (#office-data).
   Рендерит бриф маскота, теорию с ИТ-сценариями, шпаргалку приложений
   (LibreOffice / Microsoft и горячие клавиши), чек-лист задач, контрольный
   тест с объяснениями и рефлексию. Состояние — в localStorage (префикс
   officekit:), сдача формирует office-submission/1 и начисляет XP/неткоины
   через OFFICE. Без сервера.
   ========================================================================== */
(function () {
  'use strict';
  var $ = window.DOMKIT.$;  // общий хелпер: dom-kit.js
  var esc = window.DOMKIT.esc;  // единое экранирование: dom-kit.js
  var setMsg = window.DOMKIT.setMsg;  // общий статус: dom-kit.js
  function nowISO() { return new Date().toISOString(); }
  function uid() { return 'offlab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  var STORE = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function showBootError(name, err) {
    if (window && window.console) console.error('[office-kit] ' + name + ':', err);
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
    var node = $('office-data');
    if (!node || typeof OFFICE === 'undefined') return;
    var cfg;
    try { cfg = JSON.parse(node.textContent); }
    catch (e) { showBootError('данные работы', e); return; }

    var profile = OFFICE.getProfile();
    if (!profile || !profile.name) {
      location.href = 'index.html?return=' + encodeURIComponent(location.pathname.split('/').pop());
      return;
    }
    var fpName = $('fp-name'), fpGroup = $('fp-group');
    if (fpName) fpName.textContent = profile.name;
    if (fpGroup) fpGroup.textContent = OFFICE.handleFor(profile).text;

    /* Presence изолирован; его сбой не должен убивать рендер работы */
    try {
      (function presence() {
        var beat = function () { OFFICE.heartbeat(profile, cfg.id); };
        beat(); setInterval(beat, 15000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
        window.addEventListener('beforeunload', beat);
      })();
    } catch (e) { if (window && window.console) console.warn('[office-kit] presence:', e); }

    try {
    var key = 'officekit:' + cfg.id;
    var state = STORE.get(key, {
      tasks: {}, quiz: { answers: {}, done: false, correct: 0 }, reflection: {},
      startedAt: null, finished: false, lastScore: 0
    });
    function save() { STORE.set(key, state); }
    if (!state.startedAt) { state.startedAt = nowISO(); save(); }

    function progress() {
      var done = cfg.tasks.filter(function (t) { return state.tasks[t.id]; }).length;
      var pct = Math.round(done / cfg.tasks.length * 100);
      var bar = $('office-progress-bar'), label = $('office-progress-label');
      if (bar) bar.style.setProperty('--p', pct / 100);
      if (label) label.textContent = done + ' из ' + cfg.tasks.length + ' задач · ' + pct + '%';
      return { done: done, total: cfg.tasks.length, pct: pct };
    }

    function briefHtml() {
      var svg = window.MASCOTS ? MASCOTS.svg(cfg.mascot || 'fox', { size: 56, floating: true }) : '';
      return '<section class="lab-panel lab-brief"><div class="mc-speech"><div class="mc-speech-avatar">' + svg + '</div>' +
        '<div class="mc-bubble"><p class="mc-who">' + esc(cfg.who || 'Бюро ОфисПолиса') + '</p><p class="mc-text">' + cfg.story + '</p></div></div></section>';
    }
    function theoryHtml() {
      if (!cfg.theory || !cfg.theory.length) return '';
      return '<section class="lab-panel" id="office-theory"><div class="lp-head"><h2>теория и опорные конспекты</h2><span class="kind-badge">индивидуально</span></div><div class="lp-body lab-theory">' +
        cfg.theory.map(function (b, i) {
          return '<article class="theory-block"><h3><span class="theory-num">// ' + String(i + 1).padStart(2, '0') + '</span> ' + esc(b.h) + '</h3><p>' + b.p + '</p>' +
            (b.code ? '<pre class="lab-codeblock"><code>' + esc(b.code) + '</code></pre>' : '') +
            (b.note ? '<p class="lab-note">⚑ ' + esc(b.note) + '</p>' : '') + '</article>';
        }).join('') + '</div></section>';
    }
    function referenceHtml() {
      if (!cfg.reference || !cfg.reference.length) return '';
      return '<section class="lab-panel" id="office-reference"><div class="lp-head"><span>шпаргалка приложений</span><span class="kind-badge">LibreOffice · Microsoft</span></div><div class="lp-body"><div class="cmd-duo">' +
        '<div class="cmd-col"><h4><span class="os-tag linux">LibreOffice / свободное ПО</span></h4>' +
        cfg.reference.map(function (c) { return '<div class="cmd-row"><code>' + esc(c.lo || '—') + '</code><span>' + esc(c.what) + '</span></div>'; }).join('') + '</div>' +
        '<div class="cmd-col"><h4><span class="os-tag windows">Microsoft 365 / Office</span></h4>' +
        cfg.reference.map(function (c) { return '<div class="cmd-row"><code>' + esc(c.ms || '—') + '</code><span>' + esc(c.what) + '</span></div>'; }).join('') + '</div>' +
        '</div></div></section>';
    }
    function tasksHtml() {
      return '<section class="lab-panel" id="office-tasks"><div class="lp-head"><span>бэклог рабочего дня</span><span class="kind-badge" id="office-task-chip">чек-лист</span></div><div class="lp-body">' +
        '<p class="admin-hint">Отмечайте задачу после реального выполнения в приложении, на учебном ПК или с готовым файлом. Честность прогресса — правило бюро.</p><div class="task-list">' +
        cfg.tasks.map(function (t, i) {
          var on = !!state.tasks[t.id];
          return '<label class="task-item' + (on ? ' is-done' : '') + '"><input type="checkbox" data-task="' + esc(t.id) + '"' + (on ? ' checked' : '') + '>' +
            '<span class="task-body"><span class="task-title"><span class="task-num">' + String(i + 1).padStart(2, '0') + '</span> ' + esc(t.text) + '</span>' +
            (t.hint ? '<span class="task-hint">' + esc(t.hint) + '</span>' : '') + '</span></label>';
        }).join('') + '</div></div></section>';
    }
    function quizHtml() {
      if (!cfg.quiz || !cfg.quiz.length) return '';
      return '<section class="lab-panel" id="office-quiz"><div class="lp-head"><span>контрольный тест · ' + cfg.quiz.length + ' вопросов</span><span class="kind-badge">самопроверка</span></div><div class="lp-body"><div id="office-quiz-box"></div></div></section>';
    }
    function renderQuiz() {
      var box = $('office-quiz-box');
      if (!box) return;
      box.innerHTML = cfg.quiz.map(function (item, qi) {
        var opts = item.options.map(function (opt, oi) {
          var cls = 'q-opt';
          if (state.quiz.done) {
            if (oi === item.answer) cls += ' is-ok';
            else if (state.quiz.answers[qi] === oi) cls += ' is-bad';
          }
          return '<label class="' + cls + '"><input type="radio" name="offq' + qi + '" value="' + oi + '"' +
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
      '<div class="q-actions"><button class="flat-btn" type="button" id="office-quiz-check"' + (state.quiz.done ? ' hidden' : '') + '>проверить ответы</button>' +
      '<button class="flat-btn ghost" type="button" id="office-quiz-reset"' + (state.quiz.done ? '' : ' hidden') + '>пройти заново</button>' +
      '<span class="q-score" id="office-quiz-score" role="status"></span></div>';
      box.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var qi = Number(radio.closest('.q-item').querySelector('.q-num').textContent) - 1;
          state.quiz.answers[qi] = Number(radio.value); save();
        });
      });
      $('office-quiz-check').addEventListener('click', function () {
        var correct = 0;
        cfg.quiz.forEach(function (item, qi) { if (state.quiz.answers[qi] === item.answer) correct++; });
        state.quiz.correct = correct; state.quiz.done = true; save(); renderQuiz(); quizScore();
      });
      $('office-quiz-reset').addEventListener('click', function () {
        state.quiz = { answers: {}, done: false, correct: 0 }; save(); renderQuiz(); quizScore();
      });
      quizScore();
    }
    function quizScore() {
      var el = $('office-quiz-score');
      if (!el) return;
      el.textContent = state.quiz.done ? 'результат: ' + state.quiz.correct + '/' + cfg.quiz.length : '// ответьте на все вопросы';
      el.className = 'q-score' + (state.quiz.done && state.quiz.correct === cfg.quiz.length ? ' is-ok' : state.quiz.done ? ' is-bad' : '');
    }
    function reflectionHtml() {
      if (!cfg.reflection || !cfg.reflection.length) return '';
      return '<section class="lab-panel" id="office-reflection"><div class="lp-head"><span>рефлексия рабочего дня</span><span class="kind-badge">2 минуты</span></div><div class="lp-body">' +
        cfg.reflection.map(function (q, i) {
          return '<div class="reflect-item"><label for="office-rf' + i + '">' + esc(q) + '</label><textarea class="flat-input" id="office-rf' + i + '" rows="2" data-rf="' + i + '">' + esc(state.reflection[i] || '') + '</textarea></div>';
        }).join('') +
        '<div class="plus-minus"><div><strong>плюсы</strong><textarea class="flat-input" rows="2" data-rf="plus" placeholder="что сработало хорошо">' + esc(state.reflection.plus || '') + '</textarea></div>' +
        '<div><strong>минусы · точки роста</strong><textarea class="flat-input" rows="2" data-rf="minus" placeholder="что улучшить в следующей работе">' + esc(state.reflection.minus || '') + '</textarea></div></div></div></section>';
    }
    function finishHtml() {
      return '<section class="lab-panel" id="office-finish"><div class="lp-body finish-body">' +
        '<p class="admin-hint">Сдача засчитается при отмеченном бэклоге и пройденном тесте. Итог попадёт в историю бюро и повлияет на уровень и неткоины.</p>' +
        '<button class="flat-btn" id="office-finish-btn" type="button">сдать работу ↓</button>' +
        '<p class="ops-msg" id="office-finish-msg" role="status"></p></div></section>';
    }
    function computeScore(p) {
      var taskPart = p.total ? p.done / p.total * 70 : 0;
      var quizPart = cfg.quiz && cfg.quiz.length ? state.quiz.correct / cfg.quiz.length * 30 : 30;
      return Math.round(taskPart + quizPart);
    }
    function syncBtn(score) {
      var b = $('office-finish-btn');
      if (!b) return;
      if (score >= 100) { b.disabled = true; b.textContent = 'сдано на 100% ✓'; }
      else if (state.finished) { b.disabled = false; b.textContent = 'обновить сдачу ↻'; }
    }
    function bindFinish() {
      var btn = $('office-finish-btn');
      btn.addEventListener('click', function () {
        var p = progress();
        if (p.total - p.done > 0) { setMsg($('office-finish-msg'), 'Отметьте выполненные задачи бэклога: осталось ' + (p.total - p.done) + '.', 'bad'); return; }
        if (cfg.quiz && cfg.quiz.length && !state.quiz.done) { setMsg($('office-finish-msg'), 'Сначала пройдите контрольный тест.', 'bad'); return; }
        var score = computeScore(p);
        var sub = {
          id: uid(), schema: 'office-submission/1', standId: cfg.id, standTitle: cfg.title,
          student: OFFICE.publicStudent(profile), startedAt: state.startedAt || nowISO(),
          updatedAt: nowISO(), submittedAt: nowISO(),
          result: { passed: p.done, total: p.total, score: score, ready: score >= 95 },
          checks: cfg.tasks.map(function (t) { return { id: t.id, ok: !!state.tasks[t.id], title: t.text }; }),
          quiz: state.quiz.done ? { answers: state.quiz.answers, done: true, correct: state.quiz.correct } : null,
          reflection: state.reflection
        };
        OFFICE.addSubmission(sub);
        OFFICE.award(profile.id, 'submit', 'submit:' + cfg.id + ':' + Date.now().toString(36), { standId: cfg.id });
        if (sub.result.ready) OFFICE.award(profile.id, 'standReady', 'ready:' + cfg.id, { standId: cfg.id });
        if (cfg.quiz && state.quiz.correct === cfg.quiz.length) OFFICE.award(profile.id, 'quizPerfect', 'quiz:' + cfg.id, { standId: cfg.id });
        state.finished = true; state.lastScore = score; save();
        var fm = $('office-finish-msg');
        fm.className = 'ops-msg is-ok';
        fm.innerHTML = '✓ Сдано на <strong>' + score + '%</strong>. Запись в истории бюро, лучшая версия идёт в зачёт.';
        syncBtn(score); progress();
      });
    }

    var root = $('office-root');
    root.innerHTML =
      '<div class="lk-progress-strip"><div class="xp-bar"><i id="office-progress-bar" style="--p:0"></i></div><span class="xp-meta" id="office-progress-label">—</span>' +
      '<span class="kind-badge">спринт ' + cfg.sprint + ' · ' + esc(cfg.sprintTitle) + '</span></div>' +
      briefHtml() + theoryHtml() + referenceHtml() + tasksHtml() + quizHtml() + reflectionHtml() + finishHtml();

    root.querySelectorAll('input[type="checkbox"][data-task]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.tasks[cb.dataset.task] = cb.checked;
        cb.closest('.task-item').classList.toggle('is-done', cb.checked); save(); progress();
      });
    });
    root.querySelectorAll('textarea[data-rf]').forEach(function (ta) {
      ta.addEventListener('input', function () { state.reflection[ta.dataset.rf] = ta.value; save(); });
    });

    progress(); renderQuiz(); bindFinish();
    if (state.finished) {
      syncBtn(state.lastScore || 0);
      var m = $('office-finish-msg');
      if (m) { m.className = 'ops-msg'; m.textContent = '✓ Работа уже сдавалась. Доработайте и отправьте повторно — лучшая версия идёт в зачёт.'; }
    }
    } catch (e) { showBootError('работа «' + (cfg.title || cfg.id) + '»', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
