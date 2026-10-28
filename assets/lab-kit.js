/* ==========================================================================
   LAB KIT · движок лабораторных работ практики ПМ.01
   Страница лабораторной — статический HTML со встроенным JSON (#lab-data).
   Движок рисует бриф, теорию, справочник команд (Cisco/Linux), чек-лист задач,
   ситуационную задачу, контрольный тест и блок рефлексии. Прогресс хранится
   в localStorage, завершённая работа превращается в stands-submission/2 и
   попадает в общий прогресс лиги (XP, квесты, матрица навыков). Без сервера.
   ========================================================================== */
(function () {
  'use strict';

  var $ = window.DOMKIT.$;  // общий хелпер: dom-kit.js
  var esc = window.DOMKIT.esc;  // единое экранирование: dom-kit.js
  function nowISO() { return new Date().toISOString(); }
  function uid() { return 'lab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }

  var STORE = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function showBootError(name, err) {
    if (window && window.console) console.error('[lab-kit] ' + name + ':', err);
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
    var node = $('lab-data');
    if (!node || typeof LEAGUE === 'undefined') return;
    var cfg;
    try { cfg = JSON.parse(node.textContent); }
    catch (e) { showBootError('данные лабораторной', e); return; }

    var profile = LEAGUE.getProfile();
    if (!profile || !profile.name) {
      location.href = 'setpolis.html?return=' + encodeURIComponent(location.pathname.split('/').pop());
      return;
    }
    var fpName = $('fp-name'), fpGroup = $('fp-group');
    if (fpName) fpName.textContent = profile.name;
    if (fpGroup) fpGroup.textContent = LEAGUE.handleFor ? LEAGUE.handleFor(profile).text : (profile.group || '');

    /* presence-пульс: студент виден в лиге на этой лабораторной.
       Сбой presence не должен убивать рендер всей лабораторной. */
    try {
      (function startPresence() {
        var beat = function () { LEAGUE.heartbeat(profile, cfg.id); };
        beat();
        setInterval(beat, 15000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
        window.addEventListener('beforeunload', beat);
      })();
    } catch (e) { if (window && window.console) console.warn('[lab-kit] presence:', e); }

    try {
    var key = 'labkit:' + cfg.id;

    var key = 'labkit:' + cfg.id;
    var state = STORE.get(key, { tasks: {}, quiz: { answers: {}, done: false, correct: 0 }, reflection: {}, finished: false });
    if (!state.tasks) state.tasks = {};
    if (!state.quiz) state.quiz = { answers: {}, done: false, correct: 0 };
    if (!state.reflection) state.reflection = {};

    function save() { STORE.set(key, state); }

    /* ----------------------------- Шапка-прогресс ----------------------------- */
    function renderProgress() {
      var total = cfg.tasks.length;
      var done = cfg.tasks.filter(function (t) { return state.tasks[t.id]; }).length;
      var pct = Math.round(done / total * 100);
      var bar = $('lk-progress-bar');
      if (bar) bar.style.setProperty('--p', pct / 100);
      var label = $('lk-progress-label');
      if (label) label.textContent = done + ' из ' + total + ' задач · ' + pct + '%';
      var chip = $('lk-sprint-chip');
      if (chip) chip.textContent = 'спринт ' + cfg.sprint + ' · ' + esc(cfg.sprintTitle || '');
      return { done: done, total: total, pct: pct };
    }

    /* ----------------------------- Бриф с маскотом ----------------------------- */
    function briefHtml() {
      var svg = window.MASCOTS ? MASCOTS.svg(cfg.mascot || 'fox', { size: 56, floating: true }) : '';
      return '<section class="lab-panel lab-brief">' +
        '<div class="mc-speech">' +
          '<div class="mc-speech-avatar">' + svg + '</div>' +
          '<div class="mc-bubble">' +
            '<p class="mc-who">' + esc(cfg.who || 'Куратор практики') + '</p>' +
            '<p class="mc-text">' + cfg.story + '</p>' +
          '</div>' +
        '</div>' +
      '</section>';
    }

    /* ----------------------------- Теория ----------------------------- */
    function theoryHtml() {
      if (!cfg.theory || !cfg.theory.length) return '';
      return '<section class="lab-panel" id="lk-theory"><div class="lp-head"><span>теория и опорные конспекты</span>' +
        '<span class="flat-badge">индивидуально</span></div><div class="lp-body lab-theory">' +
        cfg.theory.map(function (b, i) {
          return '<article class="theory-block">' +
            '<h3><span class="theory-num">// ' + String(i + 1).padStart(2, '0') + '</span> ' + esc(b.h) + '</h3>' +
            '<p>' + b.p + '</p>' +
            (b.code ? '<pre class="lab-codeblock"><code>' + esc(b.code) + '</code></pre>' : '') +
            (b.note ? '<p class="lab-note">⚑ ' + esc(b.note) + '</p>' : '') +
          '</article>';
        }).join('') +
      '</div></section>';
    }

    /* ----------------------------- Справочник команд ----------------------------- */
    function commandsHtml() {
      if (!cfg.commands || !cfg.commands.length) return '';
      return '<section class="lab-panel" id="lk-commands"><div class="lp-head"><span>шпаргалка команд</span>' +
        '<span class="flat-badge is-run">Cisco · Linux</span></div><div class="lp-body">' +
        '<div class="cmd-duo">' +
          '<div class="cmd-col"><h4>Cisco IOS / Packet Tracer</h4>' +
            cfg.commands.map(function (c) {
              return '<div class="cmd-row"><code>' + esc(c.cisco || '—') + '</code><span>' + esc(c.what) + '</span></div>';
            }).join('') +
          '</div>' +
          '<div class="cmd-col"><h4>ALT Linux / FRR</h4>' +
            cfg.commands.map(function (c) {
              return '<div class="cmd-row"><code>' + esc(c.linux || '—') + '</code><span>' + esc(c.what) + '</span></div>';
            }).join('') +
          '</div>' +
        '</div></div></section>';
    }

    /* ----------------------------- Чек-лист задач ----------------------------- */
    function tasksHtml() {
      return '<section class="lab-panel" id="lk-tasks"><div class="lp-head"><span>бэклог задач лабораторной</span>' +
        '<span class="flat-badge" id="lk-task-chip"></span></div><div class="lp-body">' +
        '<p class="admin-hint">Отмечайте задачу только после того, как реально выполнили её на оборудовании, в Packet Tracer или на виртуальной машине. Честность прогресса — главное правило практики.</p>' +
        '<div class="task-list">' +
        cfg.tasks.map(function (t, i) {
          var on = !!state.tasks[t.id];
          return '<label class="task-item' + (on ? ' is-done' : '') + '">' +
            '<input type="checkbox" data-task="' + esc(t.id) + '"' + (on ? ' checked' : '') + '>' +
            '<span class="task-body"><span class="task-title"><span class="task-num">' + String(i + 1).padStart(2, '0') + '</span> ' + esc(t.text) + '</span>' +
            (t.hint ? '<span class="task-hint">' + esc(t.hint) + '</span>' : '') +
            '</span></label>';
        }).join('') +
        '</div></div></section>';
    }

    /* ----------------------------- Ситуационная задача ----------------------------- */
    function situationalHtml() {
      if (!cfg.situational) return '';
      return '<section class="lab-panel" id="lk-situational"><div class="lp-head"><span>ситуационная задача · кейс</span>' +
        '<span class="flat-badge is-soon">мозговой штурм</span></div><div class="lp-body">' +
        '<p>' + cfg.situational.text + '</p>' +
        (cfg.situational.deliverables ? '<ul class="submit-channels">' +
          cfg.situational.deliverables.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
        '<textarea class="flat-input lab-solution" id="lk-solution" rows="4" placeholder="Зафиксируйте решение: команды, схему, выводы — это часть вашей сдачи">' + esc(state.solution || '') + '</textarea>' +
        '</div></section>';
    }

    /* ----------------------------- Контрольный тест ----------------------------- */
    function quizHtml() {
      if (!cfg.quiz || !cfg.quiz.length) return '';
      return '<section class="lab-panel" id="lk-quiz"><div class="lp-head"><span>контрольный тест · ' + cfg.quiz.length + ' вопросов</span>' +
        '<span class="flat-badge">самопроверка</span></div><div class="lp-body"><div id="lk-quiz-box"></div></div></section>';
    }

    function renderQuiz() {
      var box = $('lk-quiz-box');
      if (!box) return;
      box.innerHTML = cfg.quiz.map(function (item, qi) {
        var opts = item.options.map(function (opt, oi) {
          var cls = 'q-opt';
          if (state.quiz.done) {
            if (oi === item.answer) cls += ' is-ok';
            else if (state.quiz.answers[qi] === oi) cls += ' is-bad';
          }
          return '<label class="' + cls + '"><input type="radio" name="lkq' + qi + '" value="' + oi + '"' +
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
        return '<div class="q-item"><p class="q-title"><span class="q-num">' + String(qi + 1).padStart(2, '0') + '</span> ' + esc(item.q) + '</p>' +
          '<div class="q-opts">' + opts + '</div>' + verdict + explain + '</div>';
      }).join('') +
      '<div class="q-actions"><button class="flat-btn" type="button" id="lk-quiz-check"' + (state.quiz.done ? ' hidden' : '') + '>проверить ответы</button>' +
      '<button class="flat-btn ghost" type="button" id="lk-quiz-reset"' + (state.quiz.done ? '' : ' hidden') + '>пройти заново</button>' +
      '<span class="q-score" id="lk-quiz-score" role="status"></span></div>';

      box.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var qi = Number(radio.closest('.q-item').querySelector('.q-num').textContent) - 1;
          state.quiz.answers[qi] = Number(radio.value);
          save();
        });
      });
      $('lk-quiz-check').addEventListener('click', function () {
        var correct = 0;
        cfg.quiz.forEach(function (item, qi) { if (state.quiz.answers[qi] === item.answer) correct++; });
        state.quiz.correct = correct;
        state.quiz.done = true;
        save(); renderQuiz(); setQuizScore();
      });
      $('lk-quiz-reset').addEventListener('click', function () {
        state.quiz = { answers: {}, done: false, correct: 0 };
        save(); renderQuiz(); setQuizScore();
      });
      setQuizScore();
    }
    function setQuizScore() {
      var el = $('lk-quiz-score');
      if (!el) return;
      el.textContent = state.quiz.done
        ? 'результат: ' + state.quiz.correct + '/' + cfg.quiz.length + (state.quiz.correct === cfg.quiz.length ? ' · все верно' : '')
        : '// ответьте на все вопросы';
      el.className = 'q-score' + (state.quiz.done && state.quiz.correct === cfg.quiz.length ? ' is-ok' : state.quiz.done ? ' is-bad' : '');
    }

    /* ----------------------------- Рефлексия ----------------------------- */
    function reflectionHtml() {
      if (!cfg.reflection || !cfg.reflection.length) return '';
      return '<section class="lab-panel" id="lk-reflection"><div class="lp-head"><span>рефлексия · ван-он-ван с собой</span>' +
        '<span class="flat-badge is-run">2 минуты</span></div><div class="lp-body">' +
        '<p class="admin-hint">Короткая рефлексия после практики закрепляет результат лучше повторного чтения. Ответы видны только вам.</p>' +
        cfg.reflection.map(function (q, i) {
          return '<div class="reflect-item"><label for="lk-rf' + i + '">' + esc(q) + '</label>' +
            '<textarea class="flat-input" id="lk-rf' + i + '" rows="2" data-rf="' + i + '">' + esc(state.reflection[i] || '') + '</textarea></div>';
        }).join('') +
        '<div class="plus-minus"><div><strong>плюсы</strong><textarea class="flat-input" rows="2" data-rf="plus" placeholder="что получилось хорошо">' + esc(state.reflection.plus || '') + '</textarea></div>' +
        '<div><strong>минусы · точки роста</strong><textarea class="flat-input" rows="2" data-rf="minus" placeholder="что улучшить в следующий раз">' + esc(state.reflection.minus || '') + '</textarea></div></div>' +
        '</div></section>';
    }

    /* ----------------------------- Сдача ----------------------------- */
    function finishHtml() {
      return '<section class="lab-panel lab-finish" id="lk-finish"><div class="lp-body finish-body">' +
        '<p class="admin-hint">Сдача засчитается, когда отмечены все задачи и пройден тест. Результат уйдёт в вашу историю и повлияет на уровень, неткоины и матрицу навыков.</p>' +
        '<button class="flat-btn" id="lk-finish-btn" type="button">сдать лабораторную ↓</button>' +
        '<p class="lab-finish-msg" id="lk-finish-msg" role="status"></p>' +
        '</div></section>';
    }

    function computeScore(progress) {
      var taskPart = progress.total ? progress.done / progress.total * 70 : 0;
      var quizPart = cfg.quiz && cfg.quiz.length ? (state.quiz.correct / cfg.quiz.length) * 30 : 30;
      return Math.round(taskPart + quizPart);
    }

    function syncFinishBtn(score) {
      var btn0 = $('lk-finish-btn');
      if (!btn0) return;
      if (score >= 100) { btn0.disabled = true; btn0.textContent = 'сдано на 100% ✓'; }
      else if (state.finished) { btn0.disabled = false; btn0.textContent = 'обновить сдачу ↻'; }
    }

    function bindFinish(progress) {
      var btn = $('lk-finish-btn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var p = renderProgress();
        var missing = p.total - p.done;
        if (missing > 0) { $('lk-finish-msg').textContent = 'Осталось задач: ' + missing + ' — отметьте выполненные в бэклоге.'; return; }
        if (cfg.quiz && cfg.quiz.length && !state.quiz.done) { $('lk-finish-msg').textContent = 'Сначала пройдите контрольный тест.'; return; }
        var score = computeScore(p);
        var checks = cfg.tasks.map(function (t) { return { id: t.id, ok: !!state.tasks[t.id], title: t.text, hint: t.hint || '' }; });
        var submission = {
          id: uid(),
          schema: 'stands-submission/2',
          standId: cfg.id,
          standTitle: cfg.title,
          student: LEAGUE.publicStudent(profile),
          startedAt: state.startedAt || nowISO(),
          updatedAt: nowISO(),
          submittedAt: nowISO(),
          result: { passed: p.done, total: p.total, score: score, ready: score >= 95 },
          checks: checks,
          config: state.solution || '',
          terminalLog: [],
          actionLog: [{ t: nowISO(), type: 'labkit', msg: 'лабораторная сдана через lab-kit, score ' + score }],
          quiz: state.quiz.done ? { answers: state.quiz.answers, done: true, correct: state.quiz.correct } : null,
          autotests: null,
          skills: window.FGOS && FGOS.STANDS[cfg.id] ? { pk: FGOS.STANDS[cfg.id].pk, ok: FGOS.STANDS[cfg.id].ok } : null,
          os: { historyCount: 0, leases: 0 },
          reflection: state.reflection
        };
        LEAGUE.addSubmission(submission);
        /* submit начисляется за каждую сдачу (итерации — тоже работа),
           standReady и quizPerfect защищены дедуп-ключами внутри LEAGUE.award */
        LEAGUE.award(profile.id, 'submit', 'submit:' + cfg.id + ':' + Date.now().toString(36), { standId: cfg.id });
        if (submission.result.ready) LEAGUE.award(profile.id, 'standReady', 'ready:' + cfg.id, { standId: cfg.id });
        if (cfg.quiz && state.quiz.correct === cfg.quiz.length) LEAGUE.award(profile.id, 'quizPerfect', 'quiz:' + cfg.id, { standId: cfg.id });
        state.finished = true; state.lastScore = score; save();
        $('lk-finish-msg').innerHTML = '✓ Работа сдана на <strong>' + score + '%</strong>. Запись появилась в лиге и в истории ваших работ. ' +
          'Коллеги смогут проверить её по коду ITS-LAB1 в кабинете.';
        syncFinishBtn(score);
        renderProgress();
      });
    }

    /* ----------------------------- Сборка страницы ----------------------------- */
    var root = $('lab-root');
    root.innerHTML =
      '<div class="lk-progress-strip"><div class="xp-bar"><i id="lk-progress-bar" style="--p:0"></i></div>' +
        '<span class="xp-meta" id="lk-progress-label">—</span>' +
        '<span class="flat-badge is-run" id="lk-sprint-chip"></span></div>' +
      briefHtml() + theoryHtml() + commandsHtml() + tasksHtml() + situationalHtml() + quizHtml() + reflectionHtml() + finishHtml();

    root.querySelectorAll('input[type="checkbox"][data-task]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.tasks[cb.dataset.task] = cb.checked;
        cb.closest('.task-item').classList.toggle('is-done', cb.checked);
        save(); renderProgress();
      });
    });
    var solution = $('lk-solution');
    if (solution) solution.addEventListener('input', function () { state.solution = solution.value; save(); });
    root.querySelectorAll('textarea[data-rf]').forEach(function (ta) {
      ta.addEventListener('input', function () { state.reflection[ta.dataset.rf] = ta.value; save(); });
    });

    if (!state.startedAt) { state.startedAt = nowISO(); save(); }
    renderProgress();
    renderQuiz();
    bindFinish(renderProgress());
    if (state.finished) {
      syncFinishBtn(state.lastScore || 0);
      if ($('lk-finish-msg')) $('lk-finish-msg').innerHTML = '✓ Работа уже сдана. Можете дополнить конспект и пройти тест заново — прогресс сохраняется, доработку можно отправить повторно.';
    }
    } catch (e) { showBootError('лабораторная «' + (cfg.title || cfg.id) + '»', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
