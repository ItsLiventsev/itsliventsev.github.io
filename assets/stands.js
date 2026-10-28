/* ==========================================================================
   Виртуальные стенды · клиентское приложение (v3)
   Кабинет студента вселенной «СетьПолис»: профиль с маскотом-хэндлом,
   квесты-стенды, обмен кодами ITS-LAB1/ITS-REV1 без сервера, взаимные проверки с
   PRP-очками, светлая/тёмная тема, онбординг, presence, автосейв ВМ.
   ========================================================================== */
(function () {
  'use strict';

  var PROFILE_KEY = 'stands-profile';
  var THEME_KEY = 'itsliventsev-theme';
  var TOUR_KEY = 'stands-tour-seen';
  var OLD_SUBMISSIONS_KEY = 'stands-submissions';

  function uid() { return 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function nowISO() { return new Date().toISOString(); }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var Store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { localStorage.removeItem(k); }
  };
  var progressKey = function (standId) { return 'stands-progress:' + standId; };
  /* Безопасный возврат после онбординга: только файл этого каталога,
     без протоколов, слэшей и обхода путей (защита от open redirect). */
  function returnTarget() {
    try {
      var p = new URLSearchParams(location.search).get('return');
      if (p && /^[\w.-]+\.html$/.test(p)) return p;
    } catch (e) {}
    return null;
  }
  var hasLeague = function () { return typeof window.LEAGUE !== 'undefined'; };
  var hasFgos = function () { return typeof window.FGOS !== 'undefined'; };
  var hasMascots = function () { return typeof window.MASCOTS !== 'undefined'; };

  /* Безопасный запуск подсистем: сбой декоративного/дочернего модуля не должен
     убивать терминал и остальные стенды. Ошибка показывается пользователю. */
  function showInitError(name, err) {
    if (window && window.console) console.error('[stands] ' + name + ':', err);
    var host = document.getElementById('main-content') || document.body;
    if (!host) return;
    var box = document.createElement('div');
    box.className = 'st-init-error';
    box.setAttribute('role', 'alert');
    box.innerHTML = '<strong>// модуль «' + esc(name) + '» запустился с ошибкой.</strong>' +
      '<span>Терминал и сохранение работают; обновите страницу. Если повторяется — ' +
      'передайте текст из консоли (F12) преподавателю.</span>';
    host.insertBefore(box, host.firstChild);
  }
  function safeRun(name, fn) {
    try { fn(); } catch (err) { showInitError(name, err); }
  }
  /* Декоративные виджеты (XP-полоса, навыки, presence) изолированы:
     их сбой не прерывает привязку терминала и автосейв. */
  function safeWidget(name, fn) {
    try { fn(); } catch (err) { if (window && window.console) console.warn('[stands] widget ' + name + ':', err); }
  }
  function mascotSvg(id, size, floating) {
    if (hasMascots()) return window.MASCOTS.svg(id || 'raccoon', { size: size || 48, floating: floating !== false });
    return '';
  }

  /* Миграция работ схемы /1 в хранилище лиги */
  function migrateOldSubmissions() {
    if (!hasLeague()) return;
    var old = Store.get(OLD_SUBMISSIONS_KEY);
    if (!Array.isArray(old) || !old.length) return;
    old.forEach(function (s) { if (s && s.id) window.LEAGUE.addSubmission(s); });
    localStorage.removeItem(OLD_SUBMISSIONS_KEY);
  }

  /* ----------------------------- Тема (светлая/тёмная) ----------------------------- */
  function initTheme() {
    function apply(theme) { document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark'); }
    var saved = localStorage.getItem(THEME_KEY);
    apply(saved === 'light' ? 'light' : 'dark');
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        localStorage.setItem(THEME_KEY, next);
        apply(next);
      });
    });
    window.addEventListener('storage', function (e) {
      if (e.key === THEME_KEY) apply(e.newValue === 'light' ? 'light' : 'dark');
    });
  }

  /* ----------------------------- Мини-тест ----------------------------- */
  function mountQuiz(box, quiz, saved, onchange) {
    if (!box || !quiz || !quiz.length) return null;
    var state = saved && saved.done != null
      ? { answers: saved.answers || {}, done: !!saved.done, correct: saved.correct || 0 }
      : { answers: {}, done: false, correct: 0 };

    function render() {
      box.innerHTML = quiz.map(function (item, qi) {
        var opts = item.options.map(function (opt, oi) {
          var cls = 'q-opt';
          if (state.done) {
            if (oi === item.answer) cls += ' is-ok';
            else if (state.answers[qi] === oi) cls += ' is-bad';
          }
          return '<label class="' + cls + '"><input type="radio" name="q' + qi + '" value="' + oi + '"' +
            (state.answers[qi] === oi ? ' checked' : '') + (state.done ? ' disabled' : '') + '>' +
            '<span>' + esc(opt) + '</span></label>';
        }).join('');
        var verdict = '';
        var explain = '';
        if (state.done) {
          var chosen = state.answers[qi];
          var answered = chosen != null;
          var isCorrect = answered && chosen === item.answer;
          var vCls = !answered ? 'is-warn' : isCorrect ? 'is-ok' : 'is-bad';
          var vText = !answered ? 'без ответа' : isCorrect ? 'верно' : 'неверно';
          verdict = '<p class="q-verdict ' + vCls + '"><span class="q-verdict-badge">' + vText + '</span>' +
            (isCorrect ? '' : ' правильный ответ: <strong>' + esc(item.options[item.answer]) + '</strong>') + '</p>';
          explain = '<p class="q-explain">// ' + esc(item.explain) + '</p>';
        }
        return '<div class="q-item" data-q="' + qi + '">' +
          '<p class="q-title"><span class="q-num">' + String(qi + 1).padStart(2, '0') + '</span>' + esc(item.q) + '</p>' +
          '<div class="q-opts">' + opts + '</div>' + verdict + explain + '</div>';
      }).join('') +
      '<div class="q-actions"><button class="flat-btn" type="button" id="quiz-check"' + (state.done ? ' hidden' : '') + '>проверить ответы</button>' +
      '<button class="flat-btn ghost" type="button" id="quiz-reset"' + (state.done ? '' : ' hidden') + '>пройти заново</button>' +
      '<span class="q-score" id="quiz-score" role="status"></span></div>';

      box.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var qi = Number(radio.closest('.q-item').dataset.q);
          state.answers[qi] = Number(radio.value);
          emit();
        });
      });
      $('quiz-check').addEventListener('click', function () {
        var correct = 0;
        quiz.forEach(function (item, qi) { if (state.answers[qi] === item.answer) correct++; });
        state.correct = correct;
        state.done = true;
        render();
        setScore();
        emit();
      });
      $('quiz-reset').addEventListener('click', function () {
        state = { answers: {}, done: false, correct: 0 };
        render();
        emit();
      });
      setScore();
    }

    function setScore() {
      var el = $('quiz-score');
      if (!el) return;
      el.textContent = state.done
        ? 'результат: ' + state.correct + '/' + quiz.length + (state.correct === quiz.length ? ' · все верно' : '')
        : '// ответьте на все вопросы';
      el.className = 'q-score' + (state.done && state.correct === quiz.length ? ' is-ok' : state.done ? ' is-bad' : '');
    }

    function emit() { if (typeof onchange === 'function') onchange(state); }

    render();
    return { getState: function () { return state; }, isComplete: function () { return state.done; } };
  }

  /* ----------------------------- Терминал ----------------------------- */
  function makeTerminal(screenEl, inputEl, prompt, getHistory) {
    var termLog = [];
    var navIdx = -1;

    function print(line, out, isErr) {
      var row = document.createElement('div');
      row.className = 'lt-line';
      row.innerHTML = '<span class="lt-prompt">' + esc(prompt) + '</span><span>' + esc(line) + '</span>';
      screenEl.appendChild(row);
      if (out) {
        var pre = document.createElement('div');
        if (isErr) pre.className = 'lt-err';
        pre.textContent = out;
        screenEl.appendChild(pre);
      }
      screenEl.scrollTop = screenEl.scrollHeight;
    }

    inputEl.addEventListener('keydown', function (e) {
      var hist = getHistory ? getHistory() : [];
      if (e.key === 'ArrowUp') {
        if (!hist.length) return;
        e.preventDefault();
        navIdx = navIdx === -1 ? hist.length - 1 : Math.max(0, navIdx - 1);
        inputEl.value = hist[navIdx] || '';
      } else if (e.key === 'ArrowDown') {
        if (navIdx === -1) return;
        e.preventDefault();
        navIdx++;
        if (navIdx >= hist.length) { navIdx = -1; inputEl.value = ''; }
        else inputEl.value = hist[navIdx] || '';
      } else if (e.key === 'Enter') {
        navIdx = -1;
      }
    });

    return {
      log: termLog,
      print: print,
      restore: function (entries) { entries.forEach(function (h) { print(h.line, h.out, h.err); }); },
      bind: function (handler) {
        inputEl.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          var line = inputEl.value.trim();
          inputEl.value = '';
          if (!line) return;
          if (handler(line) === false) return;
        });
      },
      clear: function () { screenEl.innerHTML = ''; termLog.length = 0; }
    };
  }

  /* ----------------------------- Presence ----------------------------- */
  var presenceTimer = null;
  function startPresence(standId) {
    if (!hasLeague()) return;
    var profile = window.LEAGUE.getProfile();
    if (!profile) return;
    var beat = function () { window.LEAGUE.heartbeat(profile, standId); };
    beat();
    clearInterval(presenceTimer);
    presenceTimer = setInterval(beat, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
    window.addEventListener('beforeunload', beat);
  }

  /* ----------------------------- Общие виджеты ----------------------------- */
  function renderXpStrip(anchor) {
    if (!hasLeague() || !anchor) return;
    var profile = window.LEAGUE.getProfile();
    if (!profile) return;
    var t = window.LEAGUE.totals(profile.id);
    var tribe = window.LEAGUE.TRIBES.filter(function (x) { return x.id === profile.tribeId; })[0];
    var handle = window.LEAGUE.handleFor(profile).text;
    var strip = document.createElement('div');
    strip.className = 'xp-strip';
    strip.id = 'xp-strip';
    strip.innerHTML =
      '<span class="xp-handle" title="ваш хэндл во взаимных оценках">' + mascotSvg(profile.mascotId, 22, false) + ' ' + esc(handle) + '</span>' +
      '<span class="xp-level">ур. ' + t.level.level + ' · ' + esc(t.level.title) + '</span>' +
      '<div class="xp-bar" title="опыт до следующего уровня"><i style="width:' + t.level.progress + '%"></i></div>' +
      '<span class="xp-meta">' + t.xp + ' XP</span>' +
      '<span class="xp-meta xp-coins">◈ ' + t.coins + '</span>' +
      '<span class="prp-pill" title="PRP — очки взаимных проверок: сдача тратит 1, проверка коллеги даёт 1">PRP ' +
        window.LEAGUE.prpBalance(profile.id) + '</span>' +
      (tribe ? '<span class="xp-meta">' + esc(tribe.name) + '</span>' : '');
    anchor.parentNode.insertBefore(strip, anchor.nextSibling);
  }

  function refreshXpStrip() {
    safeWidget('xp-strip-refresh', function () {
      var old = $('xp-strip');
      if (old) old.remove();
      renderXpStrip($('lab-profile'));
    });
  }

  function renderSkills(standId) {
    var box = $('lab-skills');
    if (!box || !hasFgos()) return;
    var spec = window.FGOS.STANDS[standId];
    if (!spec) return;
    function cards(codes) {
      return '<div class="skill-grid">' + codes.map(function (code) {
        var c = window.FGOS.byCode(code);
        var task = c && c.title ? c.title : code;
        return '<div class="skill-card"><div class="skill-card-head">' +
          '<span class="skill-task">' + esc(task) + '</span>' +
          '<span class="skill-bubble">' + esc(code) + '</span></div></div>';
      }).join('') + '</div>';
    }
    box.innerHTML =
      '<div class="st-skill-group"><h3>профессиональные компетенции · ФГОС СПО ' + esc(window.FGOS.SPECIALTY.split(' ')[0]) + '</h3>' +
      cards(spec.pk) +
      '<ul class="st-practical">' + spec.skills.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="st-skill-group"><h3>общие компетенции</h3>' + cards(spec.ok) +
      '<p class="flat-caption flat-caption--mt">Мастерство по каждому коду растёт от результатов CI, автотестов и квиза — прогресс виден в личном кабинете.</p></div>';
  }

  function renderAutotests(report) {
    var box = $('lab-autotests'), badge = $('at-badge');
    if (!box) return;
    if (badge) {
      badge.textContent = report.passed + '/' + report.total;
      badge.className = 'flat-badge ' + (report.passed === report.total ? 'is-ready' : 'is-soon');
    }
    box.innerHTML = '<div class="at-summary"><span class="at-score">пройдено ' + report.passed + '/' + report.total +
      ' · ' + report.score + '%</span></div>' +
      report.results.map(function (r) {
        return '<div class="at-row ' + (r.ok ? 'is-ok' : 'is-bad') + '">' +
          '<div class="at-head"><span class="at-mark">' + (r.ok ? '✓' : '×') + '</span>' +
          '<span class="at-title">' + esc(r.title) + '</span></div>' +
          (r.ok ? '' : '<p class="at-detail">ожидалось: ' + esc(r.expected) + '<br>факт: ' + esc(r.actual) + '</p>') +
          '</div>';
      }).join('');
  }

  /* ----------------------------- Обмен кодами (ядро взаимных проверок без сервера) ----------------------------- */
  function processCodes(text) {
    var L = window.LEAGUE;
    var report = { subs: 0, reviews: 0, errors: [] };
    String(text || '').split(/[\r\n]+/).forEach(function (raw, i) {
      var code = raw.trim();
      if (!code) return;
      try {
        if (code.indexOf('ITS-LAB1.') === 0) {
          var sub = L.decodeSubmission(code);
          var before = L.submissions().length;
          L.addSubmission(sub);
          if (L.submissions().length > before) report.subs++;
        } else if (code.indexOf('ITS-REV1.') === 0) {
          var rv = L.decodeReview(code);
          var r = L.importReview(rv);
          if (!r.duplicated) report.reviews++;
        } else {
          report.errors.push('строка ' + (i + 1) + ': неизвестный код (ожидается ITS-LAB1… или ITS-REV1…)');
        }
      } catch (e) {
        report.errors.push('строка ' + (i + 1) + ': ' + e.message);
      }
    });
    return report;
  }

  function bindExchange(textareaId, btnId, msgId, onDone) {
    var btn = $(btnId), ta = $(textareaId), msg = $(msgId);
    if (!btn || !ta || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function () {
      if (!hasLeague()) { msg.className = 'exchange-msg is-bad'; msg.textContent = 'Модуль лиги не загружен'; return; }
      var r = processCodes(ta.value);
      ta.value = '';
      msg.className = 'exchange-msg ' + (r.errors.length && !r.subs && !r.reviews ? 'is-bad' : r.errors.length ? '' : 'is-ok');
      var parts = [];
      if (r.subs) parts.push('работ добавлено: ' + r.subs);
      if (r.reviews) parts.push('рецензий получено: ' + r.reviews);
      msg.textContent = parts.length ? parts.join(' · ') + (r.errors.length ? ' · ошибок: ' + r.errors.length : '')
        : (r.errors.join('; ') || 'новых данных нет: такие коды уже импортированы ранее');
      if (typeof onDone === 'function') onDone(r);
    });
  }

  /* Подтягивание работ и рецензий из публичной папки репозитория (без токена) */
  function pullFromRepo(btn, msgEl, onDone) {
    if (!hasLeague()) return;
    var cfg = window.LEAGUE.REPO_CONFIG;
    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = 'проверяю репозиторий…';
    var headers = { Accept: 'application/vnd.github+json' };
    function list(folder) {
      var url = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + folder + '?ref=' + cfg.branch;
      return fetch(url, { headers: headers }).then(function (r) {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error('GitHub API: ' + r.status + (r.status === 403 ? ' (лимит запросов — попробуйте позже)' : ''));
        return r.json();
      }).then(function (files) {
        var jsons = files.filter(function (f) { return f.name && f.name.endsWith('.json'); });
        return Promise.all(jsons.map(function (f) { return fetch(f.download_url).then(function (r) { return r.json(); }); }));
      });
    }
    Promise.all([list(cfg.submissionsPath), list(cfg.reviewsPath)]).then(function (res) {
      var subList = res[0], revList = res[1], subs = 0, revs = 0;
      var L = window.LEAGUE;
      subList.forEach(function (s) {
        if ((s.schema === 'stands-submission/1' || s.schema === 'stands-submission/2') && s.student && s.id) {
          var before = L.submissions().length;
          L.addSubmission(s);
          if (L.submissions().length > before) subs++;
        }
      });
      revList.forEach(function (r) {
        if (r.schema === 'league-review/1' && r.submissionId && r.reviewer) {
          if (!L.importReview(r).duplicated) revs++;
        }
      });
      msgEl.className = 'exchange-msg is-ok';
      msgEl.textContent = 'Из репозитория: новых работ ' + subs + ', рецензий ' + revs;
      if (onDone) onDone({ subs: subs, reviews: revs });
    }).catch(function (err) {
      msgEl.className = 'exchange-msg is-bad';
      msgEl.textContent = err.message;
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = old;
    });
  }

  /* ----------------------------- Взаимные оценки ----------------------------- */
  var RUBRIC = [
    { key: 'config', label: 'корректность конфигурации' },
    { key: 'completeness', label: 'полнота: цели, тест, автотесты' },
    { key: 'journal', label: 'качество журнала и аккуратность' },
    { key: 'communication', label: 'объяснения и комментарии' }
  ];

  function renderReviewArea(standId) {
    if (!hasLeague()) return;
    var profile = window.LEAGUE.getProfile();
    var poolBox = $('rv-pool'), badge = $('rv-pool-badge');
    if (!poolBox || !profile) return;

    var pool = window.LEAGUE.submissions().filter(function (s) {
      return s.standId === standId && s.student.id !== profile.id;
    });
    if (badge) badge.textContent = pool.length + ' работ';
    if (!pool.length) {
      poolBox.innerHTML =
        '<div class="helper-card"><p class="helper-lead">Пул пуст. Работы однокурсников приходят двумя путями:</p>' +
        '<p class="flat-caption">1. Вставьте код <code>ITS-LAB1…</code>, который прислал коллега, в блок «обмен кодами» ниже.</p>' +
        '<p class="flat-caption">2. Нажмите «подтянуть из репозитория» — преподаватель публикует там присланные работы.</p></div>';
    } else {
      poolBox.innerHTML = pool.slice(0, 6).map(function (s) {
        var reviewed = window.LEAGUE.reviewsFor(s.id).some(function (r) { return r.reviewer.id === profile.id; });
        var who = s.student.handle ? esc(s.student.handle) : esc(s.student.name);
        return '<div class="rv-card" data-sub="' + esc(s.id) + '">' +
          '<div class="rv-card-head"><div class="rv-who">' + who +
            '<small>' + esc(s.student.group || '—') + (s.student.name ? ' · ' + esc(s.student.name) : '') + '</small></div>' +
          '<span class="rv-score-pill ' + ((s.result.score || 0) >= 85 ? 'is-ok' : '') + '">CI ' + (s.result.score != null ? s.result.score + '%' : '—') + '</span></div>' +
          (reviewed
            ? '<p class="rv-empty">// вы уже проверили эту работу</p>'
            : '<button class="flat-btn ghost rv-open" type="button" data-sub="' + esc(s.id) + '">оценить работу</button>') +
          '<div class="rv-form-holder"></div></div>';
      }).join('');

      poolBox.querySelectorAll('.rv-open').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('.rv-card');
          var holder = card.querySelector('.rv-form-holder');
          var sub = pool.filter(function (s) { return s.id === btn.dataset.sub; })[0];
          var scores = { config: 0, completeness: 0, journal: 0, communication: 0 };
          holder.innerHTML = '<div class="rv-form">' +
            '<div class="rv-criteria">' + RUBRIC.map(function (c) {
              return '<div class="rv-crit" data-crit="' + c.key + '"><label>' + esc(c.label) + '</label>' +
                '<div class="rv-stars">' + [1, 2, 3, 4, 5].map(function (n) {
                  return '<button type="button" data-n="' + n + '" aria-label="' + n + ' из 5">★</button>';
                }).join('') + '</div></div>';
            }).join('') + '</div>' +
            '<textarea class="flat-input rv-comment" placeholder="Доброжелательный конструктивный комментарий: что хорошо, что можно улучшить"></textarea>' +
            '<div class="flat-row">' +
            '<button class="flat-btn rv-save" type="button">отправить оценку</button>' +
            '<button class="flat-btn ghost rv-cancel" type="button">отмена</button></div></div>';

          holder.querySelectorAll('.rv-crit').forEach(function (crit) {
            crit.addEventListener('click', function (e) {
              var star = e.target.closest('button');
              if (!star) return;
              var key = crit.dataset.crit, n = Number(star.dataset.n);
              scores[key] = n;
              crit.querySelectorAll('.rv-stars button').forEach(function (b, i) {
                b.classList.toggle('on', i < n);
              });
            });
          });
          holder.querySelector('.rv-cancel').addEventListener('click', function () { holder.innerHTML = ''; });
          holder.querySelector('.rv-save').addEventListener('click', function () {
            var filled = RUBRIC.every(function (c) { return scores[c.key] >= 1; });
            var comment = holder.querySelector('.rv-comment').value.trim();
            if (!filled) { alert('Поставьте оценку по каждому из четырёх критериев'); return; }
            if (comment.length < 15) { alert('Комментарий короче 15 символов — объясните, что именно хорошо и что улучшить'); return; }
            var review = {
              schema: 'league-review/1',
              kind: 'peer', standId: standId, submissionId: sub.id,
              reviewer: window.LEAGUE.publicStudent(profile),
              reviewee: { id: sub.student.id, name: sub.student.name, group: sub.student.group, handle: sub.student.handle },
              scores: scores, comment: comment
            };
            window.LEAGUE.addReview(review); // сам начислит +1 PRP
            window.LEAGUE.award(profile.id, 'review', 'review:' + sub.id, { standId: standId });
            showReviewCode(review);
            refreshXpStrip();
            renderReviewArea(standId);
            renderMyReviews(standId);
          });
        });
      });
    }

    renderMyReviews(standId);
  }

  /* Модалка с кодом рецензии: рецензент отправляет ITS-REV1 автору работы */
  function showReviewCode(review) {
    var modal = $('rev-code-modal');
    if (!modal) { window.LEAGUE && alert('Рецензия сохранена. Код: ' + window.LEAGUE.encodeReview(review)); return; }
    $('rev-code-text').value = window.LEAGUE.encodeReview(review);
    modal.hidden = false;
    $('rev-code-close').onclick = function () { modal.hidden = true; };
    modal.onclick = function (e) { if (e.target === modal) modal.hidden = true; };
    $('rev-code-copy').onclick = function () {
      var ta = $('rev-code-text');
      ta.select();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).catch(function () {});
      else document.execCommand('copy');
      this.textContent = 'скопировано ✓';
      var btn = this;
      setTimeout(function () { btn.textContent = 'скопировать код'; }, 2000);
    };
  }

  function renderMyReviews(standId) {
    var box = $('rv-mine');
    if (!box || !hasLeague()) return;
    var profile = window.LEAGUE.getProfile();
    var mine = window.LEAGUE.reviews().filter(function (r) {
      return r.standId === standId && r.reviewee && (r.reviewee.id === profile.id || r.reviewee.name === profile.name);
    });
    if (!mine.length) {
      box.innerHTML = '<p class="rv-empty">// здесь появятся рецензии на ваши работы: вставьте код ITS-REV1 от коллеги в блок обмена</p>';
      return;
    }
    box.innerHTML = mine.map(function (r) {
      var avg = Math.round(((r.scores.config + r.scores.completeness + r.scores.journal + r.scores.communication) / 4) * 10) / 10;
      var who = r.reviewer.handle ? esc(r.reviewer.handle) : esc(r.reviewer.name);
      return '<div class="rv-review ' + (r.kind === 'expert' ? 'is-expert' : '') + '">' +
        '<p class="rv-review-meta">' + (r.kind === 'expert' ? '★ экспертная оценка' : 'взаимная оценка') + ' · ' +
        who + ' · средний балл ' + avg + '/5</p>' +
        '<p>' + esc(r.comment) + '</p></div>';
    }).join('');
  }

  /* ----------------------------- Сдача работы ----------------------------- */
  function openCodeModal(code) {
    var modal = $('sub-code-modal');
    if (!modal) return;
    $('sub-code-text').value = code;
    modal.hidden = false;
    $('sub-code-close').onclick = function () { modal.hidden = true; };
    modal.onclick = function (e) { if (e.target === modal) modal.hidden = true; };
    $('sub-code-copy').onclick = function () {
      var ta = $('sub-code-text');
      ta.select();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).catch(function () {});
      else document.execCommand('copy');
      this.textContent = 'скопировано ✓';
      var btn = this;
      setTimeout(function () { btn.textContent = 'скопировать код'; }, 2000);
    };
  }

  function downloadJson(submission) {
    try {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof Blob === 'undefined') return false;
      var profile = submission.student;
      var blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = submission.standId + '_' + String(profile.group || '').replace(/[^\wа-яё-]+/gi, '_') +
        '_' + String(profile.name || '').replace(/[^\wа-яё]+/gi, '_') + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return true;
    } catch (e) {
      return false;
    }
  }

  function grantSubmitAwards(profile, standId, result, quizApi, autotests) {
    if (!hasLeague()) return;
    var L = window.LEAGUE;
    L.award(profile.id, 'submit', 'submit:' + standId + ':' + Date.now().toString(36), { standId: standId });
    if (result.ready) L.award(profile.id, 'standReady', 'ready:' + standId, { standId: standId });
    if (quizApi) {
      var q = quizApi.getState();
      if (q.done && q.correct === 5) L.award(profile.id, 'quizPerfect', 'quiz:' + standId, { standId: standId });
    }
    if (autotests && autotests.passed === autotests.total) {
      L.award(profile.id, 'autotests', 'at:' + standId, { standId: standId });
    }
  }

  /* ----------------------------- Кабинет (лендинг стендов) ----------------------------- */
  /* Единая история практики ПМ.01: пять спринтов от игровых задач к реальной работе
     сетевого администратора. Cisco-подобные и Linux-стенды чередуются ~50/50. */
  var SPRINT_STORY = {
    1: { title: 'Новобранец', note: 'игровой старт: база CLI, адресация и кабель — руками и на симуляторе' },
    2: { title: 'Кадр', note: 'коммутация: VLAN, транки, STP и маршрутизация между сегментами' },
    3: { title: 'Маршрут', note: 'маршрутизация и граница: статика, OSPF/FRR, NAT и firewall' },
    4: { title: 'Защита', note: 'службы и доступ: DHCP, SSH-ключи, sudoers и AAA' },
    5: { title: 'Проект', note: 'реальная работа: документация, бэклог, спринты и защита ЛВС под ключ' }
  };
  var QUESTS = [
    { id: 'lab-ios-basics', sprint: 1, glyph: 'fox', href: 'lab-ios-basics.html', format: 'индивидуально',
      title: 'Cisco IOS · первая настройка', desc: 'Режимы CLI, hostname, интерфейсы и сохранение конфигурации' },
    { id: 'lab-alt-basics', sprint: 1, glyph: 'crab', href: 'lab-alt-basics.html', format: 'индивидуально',
      title: 'ALT Linux · базовая настройка', desc: 'Консоль, apt-get, systemd и сеть через /etc/net/ifaces' },
    { id: 'lab-ip-subnet', sprint: 1, glyph: 'owl', href: 'lab-ip-subnet.html', format: 'пара',
      title: 'IP-адресация и подсети', desc: 'Маски, VLSM и ручной расчёт с проверкой калькулятором' },
    { id: 'lab-cabling', sprint: 1, glyph: 'hedgehog', href: 'lab-cabling.html', format: 'бригада',
      title: 'Обжим и кабельный расчёт', desc: 'T568A/B, прямой и кросс-линк, розетки, формула средней длины' },
    { id: 'switch-ovs', sprint: 2, glyph: 'crab', href: 'switch-ovs.html', format: 'интерактивный стенд',
      title: 'Коммутация · Open vSwitch', desc: 'Два отдела, один Linux-коммутатор: VLAN access и trunk' },
    { id: 'lab-vlan-cisco', sprint: 2, glyph: 'wolf', href: 'lab-vlan-cisco.html', format: 'пара',
      title: 'Cisco · VLAN, STP, EtherChannel', desc: 'Access и trunk-порты, PortFast, rapid-pvst, агрегация' },
    { id: 'lab-intervlan', sprint: 2, glyph: 'otter', href: 'lab-intervlan.html', format: 'индивидуально',
      title: 'Маршрутизация между VLAN', desc: 'Подынтерфейсы 802.1Q на Cisco и VLAN-бридж на Linux' },
    { id: 'lab-static-cisco', sprint: 3, glyph: 'fox', href: 'lab-static-cisco.html', format: 'пара',
      title: 'Статическая маршрутизация', desc: 'ip route, маршрут по умолчанию и таблица сетей на троих роутерах' },
    { id: 'lab-frr', sprint: 3, glyph: 'owl', href: 'lab-frr.html', format: 'группа',
      title: 'FRR · RIP, OSPF, EIGRP', desc: 'Динамическая маршрутизация на ALT через vtysh, мозговой штурм' },
    { id: 'lab-nat-firewall', sprint: 3, glyph: 'cat', href: 'lab-nat-firewall.html', format: 'пара',
      title: 'NAT и firewall на iptables', desc: 'ip_forward, MASQUERADE, цепочки filter, DROP против REJECT' },
    { id: 'dhcp-alt', sprint: 4, glyph: 'fox', href: 'dhcp-alt.html', format: 'интерактивный стенд',
      title: 'DHCP на ALT Server', desc: 'Новый офис «СетьПолиса»: 40 мест, принтер и гостиная сеть' },
    { id: 'lab-ssh-sudo', sprint: 4, glyph: 'raccoon', href: 'lab-ssh-sudo.html', format: 'индивидуально + 1:1',
      title: 'SSH, sudoers и AAA', desc: 'Ключи вместо паролей, минимальные привилегии, доступ на Cisco' },
    { id: 'lab-dns-bind', sprint: 4, glyph: 'owl', href: 'lab-dns-bind.html', format: 'пара + ревью',
      title: 'DNS на BIND · зоны и записи', desc: 'Прямая и обратная зона, A/CNAME/PTR/MX, диагностика dig и чек-лист приёмки' },
    { id: 'lab-netdoc', sprint: 5, glyph: 'otter', href: 'lab-netdoc.html', format: 'группа + ревью',
      title: 'Документирование сети', desc: 'Физ- и логсхемы, IP-план, ведомости и перекрёстное ревью' },
    { id: 'lab-final', sprint: 5, glyph: 'wolf', href: 'lab-final.html', format: 'командный проект',
      title: 'Комплексный проект ЛВС', desc: 'Бэклог, три спринта, защита и авария на время — сеть под ключ' }
  ];

  function renderMascotPicker(selected) {
    if (!hasLeague()) return '';
    return '<div class="mascot-pick" id="mascot-pick">' + window.LEAGUE.MASCOTS.map(function (m) {
      return '<button type="button" data-mascot="' + m.id + '" class="' + (m.id === selected ? 'is-selected' : '') + '" ' +
        'title="' + m.animal + '" aria-label="маскот ' + m.animal + '">' + mascotSvg(m.id, 42, false) + '</button>';
    }).join('') + '</div>';
  }

  function initCabinet() {
    var form = $('profile-form');
    if (!form) return;
    migrateOldSubmissions();
    var nameInput = $('p-name'), groupInput = $('p-group'), msg = $('profile-msg');
    var gate = $('profile-gate'), dashboard = $('cab-dashboard');
    var pickerHost = $('mascot-picker-host');
    var pickedMascot = null;

    function mountPicker(current) {
      pickedMascot = current || (window.LEAGUE ? window.LEAGUE.MASCOTS[0].id : 'raccoon');
      pickerHost.innerHTML = renderMascotPicker(pickedMascot);
      pickerHost.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          pickedMascot = b.dataset.mascot;
          pickerHost.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-selected', x === b); });
          if (hasLeague()) window.LEAGUE.setMascot(pickedMascot);
        });
      });
    }

    function renderDashboard(profile) {
      gate.hidden = true;
      dashboard.hidden = false;
      initGreeting(profile);
      var L = window.LEAGUE;
      L.dailyLogin(profile.id);
      var t = L.totals(profile.id);
      var handle = L.handleFor(profile);
      var tribe = L.TRIBES.filter(function (x) { return x.id === profile.tribeId; })[0];

      $('cab-id-card').innerHTML =
        '<div class="id-card-top">' + mascotSvg(profile.mascotId, 64) +
          '<div><p class="id-handle">' + esc(handle.text) + '</p>' +
          '<p class="id-name">' + esc(profile.name) + '</p>' +
          '<p class="id-group">' + esc(profile.group) + (tribe ? ' · ' + esc(tribe.name) : '') + '</p></div></div>' +
        '<div class="id-stats">' +
          '<div class="id-stat"><b>' + t.level.level + '</b><span>уровень</span></div>' +
          '<div class="id-stat"><b>' + t.coins + ' ◈</b><span>неткоины</span></div>' +
          '<div class="id-stat"><b>' + L.prpBalance(profile.id) + '</b><span>PRP</span></div>' +
        '</div>' +
        '<div class="id-level"><span class="xp-meta">' + esc(t.level.title) + ' · ' + t.xp + ' XP' +
          (t.level.next ? ' · до «' + esc(t.level.next) + '» ' + (t.level.span - t.level.into) + ' XP' : '') + '</span>' +
          '<div class="xp-bar"><i style="width:' + t.level.progress + '%"></i></div>' +
          '<div class="flat-row flat-row--spaced">' +
          '<a class="flat-btn ghost" href="league.html">моя лига и достижения →</a>' +
          '<a class="flat-btn ghost" href="teams.html">трайн и команды</a>' +
          '<button class="flat-btn ghost" id="cab-mascot-change" type="button">сменить маскота</button></div></div>';

      (function renderQuests() {
        var doneCount = 0;
        var cards = QUESTS.map(function (q) {
          var m = L.standMastery(profile.id, q.id);
          var best = L.bestSubmission(profile.id, q.id);
          if (best && m.percent >= 95) doneCount++;
          var state = !best ? { label: 'не начат', cls: 'is-soon' }
            : m.percent >= 95 ? { label: 'пройден ' + m.percent + '%', cls: 'is-ready' }
            : { label: 'в работе ' + m.percent + '%', cls: 'is-run' };
          return '<a class="quest-card" href="' + q.href + '">' +
            '<div class="quest-glyph">' + mascotSvg(q.glyph, 44) + '</div>' +
            '<div><h3>' + esc(q.title) + '</h3><p>' + esc(q.desc) + '</p>' +
            '<div class="quest-progress"><i style="width:' + m.percent + '%"></i></div></div>' +
            '<div class="quest-side"><span class="flat-badge ' + state.cls + '">' + state.label + '</span>' +
            '<span class="flat-badge">' + esc(q.format) + '</span></div></a>';
        });
        var overall = Math.round(doneCount / QUESTS.length * 100);
        var head = '<div class="roadmap-overview">' +
          '<div><strong>роадмап практики</strong>' +
          '<p class="admin-hint">Пять спринтов ведут от базовых команд до проекта ЛВС под ключ. Порядок рекомендован, но не заперт: выбирайте свою траекторию.</p></div>' +
          '<div class="roadmap-meter"><span class="xp-meta">' + doneCount + ' из ' + QUESTS.length + ' работ · ' + overall + '%</span>' +
          '<div class="xp-bar"><i style="width:' + overall + '%"></i></div></div></div>';

        var groups = '';
        Object.keys(SPRINT_STORY).map(Number).sort().forEach(function (sp) {
          var story = SPRINT_STORY[sp];
          var rows = QUESTS.map(function (q, i) { return q.sprint === sp ? cards[i] : null; }).filter(Boolean).join('');
          groups += '<div class="sprint-group">' +
            '<div class="sprint-head"><h3>спринт ' + sp + ' · ' + esc(story.title) + '</h3>' +
            '<span class="sprint-meta">// ' + esc(story.note) + '</span><span class="sprint-line"></span></div>' +
            rows + '</div>';
        });
        $('cab-quests').innerHTML = head + groups;
      })();

      var events = L.ledger().filter(function (e) { return e.profileId === profile.id; })
        .sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); }).slice(0, 8);
      $('cab-feed').innerHTML = events.length ? '<ul class="feed-list">' + events.map(function (e) {
        var d = new Date(e.at);
        return '<li><span class="feed-type">+' + e.xp + ' XP</span><span class="feed-note">' + esc(e.note || e.type) +
          (e.standId ? ' · ' + esc(e.standId) : '') + '</span><span class="feed-date">' +
          d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</span></li>';
      }).join('') + '</ul>' : '<p class="rv-empty">// лента пуста: откройте первый квест</p>';

      bindExchange('cab-code-input', 'cab-code-go', 'cab-msg', function () { renderDashboard(profile); });
      var repoBtn = $('cab-repo');
      if (repoBtn) repoBtn.onclick = function () {
        pullFromRepo(repoBtn, $('cab-msg'), function () { renderDashboard(profile); });
      };
      var mc = $('cab-mascot-change');
      if (mc) mc.onclick = function () {
        dashboard.hidden = true; gate.hidden = false;
        mountPicker(profile.mascotId);
        nameInput.value = profile.name; groupInput.value = profile.group;
      };
    }

    var existing = Store.get(PROFILE_KEY);
    if (hasLeague() && existing && existing.name && existing.group) {
      var p = window.LEAGUE.getProfile();
      if (p && p.name) renderDashboard(p);
    }

    mountPicker(existing && existing.mascotId);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nameInput.value.trim().replace(/\s+/g, ' ');
      var group = groupInput.value.trim().replace(/\s+/g, ' ');
      if (name.length < 4) { msg.textContent = 'Укажите ФИО полностью (не короче 4 символов)'; return; }
      if (!group) { msg.textContent = 'Укажите учебную группу'; return; }
      var profile;
      if (hasLeague()) {
        var old = window.LEAGUE.getProfile();
        profile = old ? window.LEAGUE.updateProfile({ name: name, group: group }) : window.LEAGUE.ensureProfile(name, group);
        if (pickedMascot) profile = window.LEAGUE.setMascot(pickedMascot);
      } else {
        profile = { name: name, group: group, mascotId: pickedMascot, savedAt: nowISO() };
        Store.set(PROFILE_KEY, profile);
      }
      msg.textContent = '';
      var back = returnTarget();
      if (back) { location.href = back; return; }
      renderDashboard(profile);
      startTour(true);
    });

    var changeBtn = $('profile-change');
    if (changeBtn) changeBtn.addEventListener('click', function () {
      var p = Store.get(PROFILE_KEY) || {};
      nameInput.value = p.name || '';
      groupInput.value = p.group || '';
      dashboard.hidden = true;
      gate.hidden = false;
      mountPicker(p.mascotId);
    });
  }

  /* ----------------------------- Онбординг-тур ----------------------------- */
  var TOUR_STEPS = [
    { mascot: 'raccoon', who: 'Енот Топотун · наставник',
      text: 'Привет! Я проведу вас по учебной вселенной <strong>СетьПолис</strong>. Это потоковый проект: каждый стенд — глава одной истории про живую сеть компании.' },
    { mascot: 'fox', who: 'Лиса Василиса · руководитель IT',
      text: 'Квесты — это реальные задачи из практики. Внутри каждого: бриф-легенда, терминал виртуальной машины, автотесты как в CI и контрольный тест. Переключайте формы деятельности, когда захотите.' },
    { mascot: 'crab', who: 'Краб Клешня · инженер ЦОД',
      text: 'Застряли? Сначала <strong>help</strong> и man на машине, потом спросите коллегу, потом поищите в интернете. Умение искать данные — тоже профессиональный навык.' },
    { mascot: 'owl', who: 'Филин Мудрей · эксперт',
      text: 'Сданную работу проверят автотесты, однокурсники и преподаватель. За проверки коллег начисляются PRP и XP, а лучшие рецензенты попадают в рейтинг справедливых. Удачи в квесте!' }
  ];
  function startTour(onlyIfNew) {
    if (onlyIfNew && localStorage.getItem(TOUR_KEY)) return;
    var overlay = $('tour-overlay');
    if (!overlay) return;
    var step = 0;
    function render() {
      var s = TOUR_STEPS[step];
      overlay.innerHTML = '<div class="tour-pop" role="dialog" aria-modal="true">' +
        (hasMascots() ? window.MASCOTS.speech(s.mascot, s.who, s.text, { size: 56 }) : '<p>' + s.text + '</p>') +
        '<p class="tour-progress">шаг ' + (step + 1) + ' из ' + TOUR_STEPS.length + '</p>' +
        '<div class="tour-actions">' +
        '<button class="flat-btn ghost" id="tour-skip" type="button">пропустить</button>' +
        '<button class="flat-btn" id="tour-next" type="button">' + (step === TOUR_STEPS.length - 1 ? 'начать квесты →' : 'дальше →') + '</button>' +
        '</div></div>';
      $('tour-skip').onclick = close;
      $('tour-next').onclick = function () { if (step === TOUR_STEPS.length - 1) close(); else { step++; render(); } };
    }
    function close() { overlay.innerHTML = ''; overlay.hidden = true; localStorage.setItem(TOUR_KEY, '1'); }
    overlay.hidden = false;
    render();
  }

  /* Scroll-spy для степпера стенда */
  function initStepSpy() {
    var links = document.querySelectorAll('.step-nav a[href^="#"]');
    if (!links.length || typeof IntersectionObserver === 'undefined') return;
    var map = {};
    links.forEach(function (a) {
      var sec = document.querySelector(a.getAttribute('href'));
      if (sec) map[sec.id] = a;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.remove('is-active'); });
          if (map[en.target.id]) map[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ----------------------------- Появление блоков при скролле ----------------------------- */
  function initReveal() {
    var blocks = document.querySelectorAll('.st-section-head, .lab-panel, .topo, .quiz-launch, .greet-card, .st-goals, .st-skills, .quest-card, .id-card, .flat-module, .skills-details, .flat-profile');
    if (!blocks.length) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var i = 0;
    blocks.forEach(function (el) {
      if (el.classList.contains('reveal')) return;
      el.classList.add('reveal');
      if (i % 4) el.classList.add('d' + ((i % 4) + 1));
      i++;
    });
    if (typeof IntersectionObserver === 'undefined') {
      blocks.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    blocks.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------- Приветствие маскота в кабинете ----------------------------- */
  function dayGreeting() {
    var h = new Date().getHours();
    if (h < 6) return 'доброй ночи';
    if (h < 12) return 'доброе утро';
    if (h < 18) return 'добрый день';
    return 'добрый вечер';
  }

  function initGreeting(profile) {
    var dashboard = $('cab-dashboard');
    if (!dashboard || !profile) return;
    if (dashboard.previousElementSibling && dashboard.previousElementSibling.classList.contains('greet-card')) return;
    var today = new Date().toISOString().slice(0, 10);
    var flag = Store.get('stands-greet');
    var mascotId = profile.mascotId || (window.LEAGUE && window.LEAGUE.MASCOTS[0].id) || 'raccoon';
    var card = document.createElement('section');
    card.className = 'greet-card' + (flag && flag.date === today ? ' is-dismissed' : '');
    card.innerHTML =
      '<div class="greet-mascot" aria-hidden="true">' + mascotSvg(mascotId, 56, true) + '</div>' +
      '<div class="greet-body">' +
        '<h2>' + esc(dayGreeting()) + ', ' + esc(profile.name.split(' ')[0]) + '!</h2>' +
        '<p>Стенды прогреты, журнал открыт. Правило преподавателя Кирилла Александровича простое: ' +
        'сначала понять, что должно произойти, — потом вводить команду. Ошиблись? Разберитесь и сделайте снова — это и есть практика.</p>' +
        '<div class="greet-actions">' +
          '<a class="flat-btn" href="#cab-dashboard">к рабочим задачам →</a>' +
          '<button class="flat-btn ghost greet-close" type="button">свернуть</button>' +
        '</div>' +
      '</div>';
    dashboard.parentNode.insertBefore(card, dashboard);
    card.querySelector('.greet-close').addEventListener('click', function () {
      card.classList.add('is-dismissed');
      Store.set('stands-greet', { date: today });
    });
  }

  /* ----------------------------- Модальное окно контрольного теста ----------------------------- */
  function initQuizModal(getQuizState) {
    var modal = $('quiz-modal');
    var openBtn = $('btn-quiz-open');
    var closeBtn = $('quiz-modal-close');
    var hint = $('quiz-launch-hint');
    if (!modal || !openBtn) return;

    var lore = modal.querySelector('.quiz-modal-lore');
    if (!lore) {
      lore = document.createElement('p');
      lore.className = 'quiz-modal-lore';
      lore.innerHTML = 'Самопроверка, а не экзамен: ошиблись — вернитесь к стенду, разберитесь и пройдите ещё раз.';
      modal.querySelector('#lab-quiz').parentNode.insertBefore(lore, modal.querySelector('#lab-quiz'));
    }

    function syncHint() {
      if (!hint || !getQuizState) return;
      var st = getQuizState();
      if (st && st.done) {
        hint.textContent = 'Прошлое прохождение: ' + st.correct + '/5. Откройте тест, чтобы разобрать ответы или пройти заново.';
      }
    }
    function open() { modal.hidden = false; document.body.style.overflow = 'hidden'; }
    function close() { modal.hidden = true; document.body.style.overflow = ''; }
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
    var quizBox = modal.querySelector('#lab-quiz');
    if (quizBox && typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () { syncHint(); });
      mo.observe(quizBox, { childList: true, subtree: true });
    }
    syncHint();
    return { syncHint: syncHint };
  }

  /* ----------------------------- Интерактивная топология стендов ----------------------------- */
  var TOPO = {
    'dhcp-alt': {
      build: function () {
        return '<div class="topo-grid">' +
          '<div class="topo-row"><span class="topo-plate" data-node="wan"><b>WAN</b><small>внешняя сеть · NAT enp0s3</small></span></div>' +
          '<div class="topo-row"><span class="topo-link" data-link="wan-srv"></span></div>' +
          '<div class="topo-row"><span class="topo-plate" data-node="srv"><b>ALT Server</b><small>DHCP + NAT · 192.168.10.1</small></span></div>' +
          '<div class="topo-row topo-fan"><span class="topo-link" data-link="srv-ws1"></span><span class="topo-link" data-link="srv-ws2"></span><span class="topo-link" data-link="srv-prn"></span></div>' +
          '<div class="topo-row topo-fan">' +
            '<span class="topo-plate" data-node="ws1"><b>WS 1</b><small>ALT Workstation · DHCP-клиент</small></span>' +
            '<span class="topo-plate" data-node="ws2"><b>WS 2</b><small>статический IP</small></span>' +
            '<span class="topo-plate" data-node="prn"><b>Принтер</b><small>резерв .50 по MAC</small></span>' +
          '</div></div>' +
          '<div class="topo-legend"><span><i class="dot is-on"></i>узел активен</span><span><i class="dot is-done"></i>настроен верно</span><span><i class="dot"></i>ожидает настройки</span></div>';
      },
      update: function (host, result) {
        var ok = function (id) { var c = result.checks.find(function (x) { return x.id === id; }); return !!(c && c.ok); };
        var states = {
          wan: { on: true, done: ok('subnet') },
          srv: { on: ok('subnet') || ok('range'), done: ok('subnet') && ok('range') && ok('routers') && ok('dns') },
          ws1: { on: ok('range'), done: !!result.ready },
          ws2: { on: ok('routers'), done: ok('authoritative') },
          prn: { on: ok('reservation'), done: ok('reservation') && !!result.ready }
        };
        var links = {
          'wan-srv': states.srv.on,
          'srv-ws1': states.srv.on,
          'srv-ws2': states.srv.on && states.ws2.on,
          'srv-prn': states.prn.on
        };
        Object.keys(states).forEach(function (n) {
          var el = host.querySelector('[data-node="' + n + '"]');
          if (!el) return;
          el.classList.toggle('is-on', states[n].on);
          el.classList.toggle('is-done', states[n].done);
        });
        Object.keys(links).forEach(function (l) {
          var el = host.querySelector('[data-link="' + l + '"]');
          if (el) el.classList.toggle('is-on', links[l]);
        });
      }
    },
    'switch-ovs': {
      build: function () {
        return '<div class="topo-grid">' +
          '<div class="topo-row"><span class="topo-plate" data-node="up"><b>Вышестоящий коммутатор</b><small>магистральная сеть</small></span></div>' +
          '<div class="topo-row"><span class="topo-link" data-link="up-br"></span></div>' +
          '<div class="topo-row"><span class="topo-plate" data-node="br"><b>Open vSwitch · br0</b><small>ovs-vswitchd · OVSDB</small></span></div>' +
          '<div class="topo-row topo-fan"><span class="topo-link" data-link="br-e1"></span><span class="topo-link" data-link="br-e2"></span><span class="topo-link" data-link="br-e3"></span></div>' +
          '<div class="topo-row topo-fan">' +
            '<span class="topo-plate" data-node="e1"><b>eth1</b><small>ПК продаж · access VLAN 10</small></span>' +
            '<span class="topo-plate" data-node="e2"><b>eth2</b><small>бухгалтерия · access VLAN 20</small></span>' +
            '<span class="topo-plate" data-node="e3"><b>eth3</b><small>аплинк · trunk 10,20</small></span>' +
          '</div></div>' +
          '<div class="topo-legend"><span><i class="dot is-on"></i>порт поднят</span><span><i class="dot is-done"></i>настроен по заданию</span><span><i class="dot"></i>порт свободен</span></div>';
      },
      update: function (host, result, world) {
        var st = world.state();
        var SPEC = OVS.SPEC;
        var brOn = !!st.bridge;
        var brDone = brOn && st.enabled;
        var nodeStates = { up: { on: true, done: brDone }, br: { on: brOn, done: brDone } };
        var linkStates = { 'up-br': brOn };
        SPEC.ifaces.forEach(function (name, i) {
          var key = 'e' + (i + 1);
          var p = st.ports[name];
          var want = SPEC.ports[name];
          var on = !!p;
          var done = false;
          if (p && p.trunks) done = want.role === 'trunk' && want.vlans.every(function (v) { return p.trunks.indexOf(v) !== -1; });
          else if (p && p.tag != null) done = want.role === 'access' && want.vlan === p.tag;
          nodeStates[key] = { on: on, done: done };
          linkStates['br-' + key] = on;
        });
        Object.keys(nodeStates).forEach(function (n) {
          var el = host.querySelector('[data-node="' + n + '"]');
          if (!el) return;
          el.classList.toggle('is-on', nodeStates[n].on);
          el.classList.toggle('is-done', nodeStates[n].done);
        });
        Object.keys(linkStates).forEach(function (l) {
          var el = host.querySelector('[data-link="' + l + '"]');
          if (el) el.classList.toggle('is-on', linkStates[l]);
        });
      }
    }
  };

  function mountTopology(standId) {
    var host = $('lab-topo');
    if (!host || !TOPO[standId]) return null;
    host.innerHTML = TOPO[standId].build();
    return host;
  }
  function updateTopology(standId, host, result, world) {
    if (host && TOPO[standId]) TOPO[standId].update(host, result, world);
  }

  /* ----------------------------- Общий каркас стенда ----------------------------- */
  function loadProfile() {
    var profile = Store.get(PROFILE_KEY);
    if (!profile || !profile.name || !profile.group) {
      location.href = 'setpolis.html?return=' + encodeURIComponent(location.pathname.split('/').pop());
      return null;
    }
    if (hasLeague()) {
      var p = window.LEAGUE.getProfile();
      if (!p || !p.name) {
        profile = window.LEAGUE.ensureProfile(profile.name, profile.group);
        if (profile.mascotId) window.LEAGUE.setMascot(profile.mascotId);
      } else profile = p;
    }
    var fpName = $('fp-name'), fpGroup = $('fp-group');
    if (fpName) fpName.textContent = profile.name;
    if (fpGroup) fpGroup.textContent = hasLeague() ? window.LEAGUE.handleFor(profile).text : profile.group;
    return profile;
  }

  function bindCodeModalsOnce() {
    ['sub-code-modal', 'rev-code-modal'].forEach(function (id) {
      var modal = $(id);
      if (!modal) return;
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.hidden) modal.hidden = true;
      });
    });
  }

  function bindStandExchange(standId, rerender) {
    bindExchange('rv-code-input', 'rv-code-go', 'rv-code-msg', function () {
      if (rerender) rerender();
    });
    var repoBtn = $('rv-repo');
    if (repoBtn) repoBtn.addEventListener('click', function () {
      pullFromRepo(repoBtn, $('rv-code-msg'), function () { if (rerender) rerender(); });
    });
  }

  /* ----------------------------- Стенд DHCP ----------------------------- */
  function initDhcpLab() {
    var editor = $('cfg-editor');
    if (!editor || typeof DHCP === 'undefined') return;
    var profile = loadProfile();
    if (!profile) return;
    bindCodeModalsOnce();
    safeWidget('xp-strip', function () { renderXpStrip($('lab-profile')); });
    safeWidget('skills', function () { renderSkills('dhcp-alt'); });
    safeWidget('presence', function () { startPresence('dhcp-alt'); });

    var standId = 'dhcp-alt';
    var standTitle = 'Конфигурация DHCP · ALT Server / ALT Workstation';
    var key = progressKey(standId);
    var checkBox = $('lab-checks'), scoreEl = $('lab-score');
    var progressBar = $('lab-progress-bar'), stepList = $('lab-steps');
    var termScreen = $('term-screen'), termInput = $('term-input');
    var submitBtn = $('lab-submit'), statusEl = $('lab-status');
    var log = [];
    var startedAt = nowISO();
    var autotestsReport = null;
    function addLog(type, msg) { log.push({ t: nowISO(), type: type, msg: msg }); }

    var saved = Store.get(key);
    var world;
    try { world = saved && saved.vm ? DHCP.createWorld(saved.vm) : DHCP.createWorld(); }
    catch (e) { world = DHCP.createWorld(); }
    if (saved && saved.vm) {
      startedAt = saved.startedAt || startedAt;
      addLog('resume', 'прогресс восстановлен из сохранения браузера');
      statusEl.textContent = '// найдено автосохранение от ' + new Date(saved.updatedAt).toLocaleString('ru-RU');
    } else {
      addLog('start', 'стенд открыт, профиль: ' + profile.name + ' (' + profile.group + ')');
    }

    var term = makeTerminal(termScreen, termInput, 'student@alt:~$', function () { return world.os.state.history; });
    if (saved && saved.terminalLog) term.restore(saved.terminalLog);
    else term.print('help', 'введите help — покажем список команд виртуальной машины', false);

    editor.value = world.getConfig();
    var quizApi = mountQuiz($('lab-quiz'), DHCP.QUIZ, saved && saved.quiz, autosave);
    var topoHost = mountTopology('dhcp-alt');
    var quizModal = initQuizModal(function () { return quizApi ? quizApi.getState() : null; });

    var lastResult = null;
    function runValidation(quiet) {
      world.setConfig(editor.value);
      var result = world.validate();
      lastResult = result;
      updateTopology('dhcp-alt', topoHost, result, world);
      if (quizModal) quizModal.syncHint();
      checkBox.innerHTML = result.checks.map(function (c) {
        return '<div class="lab-check ' + (c.ok ? 'is-ok' : 'is-bad') + '">' +
          '<span class="lc-mark">' + (c.ok ? '✓' : '×') + '</span>' +
          '<div><span class="lc-title">' + esc(c.title) + '</span>' +
          '<span class="lc-hint">' + esc(c.hint) + '</span></div></div>';
      }).join('');
      scoreEl.innerHTML = result.passed + '<small>/' + result.total + ' проверок · ' + result.score + '%</small>';
      progressBar.style.width = result.score + '%';
      renderSteps(result);
      if (!quiet) addLog('check', 'проверка конфига: ' + result.passed + '/' + result.total);
      autosave();
      return result;
    }

    function renderSteps(result) {
      var hist = world.os.state.history;
      var done = {
        t1: hist.some(function (h) { return /apt-get install|apt install/.test(h); }) && hist.some(function (h) { return /systemctl .*(start|enable)/.test(h); }),
        t2: result.checks.find(function (c) { return c.id === 'subnet'; }).ok && result.checks.find(function (c) { return c.id === 'range'; }).ok,
        t3: result.checks.find(function (c) { return c.id === 'routers'; }).ok && result.checks.find(function (c) { return c.id === 'dns'; }).ok,
        t4: result.checks.find(function (c) { return c.id === 'authoritative'; }).ok,
        t5: result.checks.find(function (c) { return c.id === 'reservation'; }).ok,
        t6: hist.some(function (h) { return h.indexOf('dhclient') === 0 || /\sdhclient/.test(h); }) && result.ready
      };
      stepList.innerHTML = DHCP.TASKS.map(function (t, i) {
        var ok = done[t.id];
        return '<li class="lab-step' + (ok ? ' is-done' : '') + '">' +
          '<span class="ls-num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span>' + esc(t.title) + '</span>' +
          '<span class="ls-state">' + (ok ? 'готово' : '—') + '</span></li>';
      }).join('');
    }

    var saveTimer = null;
    function autosave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        Store.set(key, {
          v: 2,
          vm: world.snapshot(),
          terminalLog: term.log.slice(-60),
          actionLog: log.slice(-200),
          startedAt: startedAt,
          updatedAt: nowISO(),
          lastResult: lastResult,
          quiz: quizApi ? quizApi.getState() : null,
          autotests: autotestsReport
        });
        statusEl.textContent = '// автосохранено ' + new Date().toLocaleTimeString('ru-RU');
      }, 500);
    }
    editor.addEventListener('input', function () { runValidation(true); });

    term.bind(function (line) {
      var res = world.run(line);
      if (res.clear) { term.clear(); autosave(); return false; }
      term.print(line, res.out, res.isErr || res.code !== 0);
      term.log.push({ line: line, out: res.out, err: res.isErr || res.code !== 0 });
      if (res.event) addLog(res.event.type, res.event.msg);
      if (/\sdhclient|^dhclient/.test(line)) runValidation(true);
      autosave();
      return true;
    });

    $('btn-validate').addEventListener('click', function () { runValidation(false); });
    $('btn-bug').addEventListener('click', function () {
      editor.value = DHCP.BROKEN_CONFIG;
      addLog('bug', 'загружен сломанный конфиг ситуационной задачи');
      runValidation(false);
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('btn-reset').addEventListener('click', function () {
      if (!confirm('Сбросить весь прогресс этого стенда?')) return;
      Store.del(key);
      location.reload();
    });
    $('btn-autotests').addEventListener('click', function () {
      var btn = $('btn-autotests');
      btn.disabled = true;
      btn.textContent = 'прогоняю на тестовой ВМ…';
      setTimeout(function () {
        autotestsReport = DHCP.runAutotests();
        renderAutotests(autotestsReport);
        btn.disabled = false;
        btn.textContent = 'прогнать автотесты →';
        addLog('autotests', 'автотесты: ' + autotestsReport.passed + '/' + autotestsReport.total);
        autosave();
      }, 350);
    });

    submitBtn.addEventListener('click', function () {
      var result = runValidation(true);
      var submission = {
        id: uid(),
        schema: 'stands-submission/2',
        standId: standId,
        standTitle: standTitle,
        student: hasLeague() ? window.LEAGUE.publicStudent(profile) : { id: profile.id || profile.name, name: profile.name, group: profile.group },
        startedAt: startedAt,
        updatedAt: nowISO(),
        submittedAt: nowISO(),
        result: { passed: result.passed, total: result.total, score: result.score, ready: result.ready },
        checks: result.checks,
        config: editor.value,
        terminalLog: term.log.slice(-60),
        actionLog: log.slice(-200),
        quiz: quizApi ? quizApi.getState() : null,
        autotests: autotestsReport ? { passed: autotestsReport.passed, total: autotestsReport.total, score: autotestsReport.score } : null,
        skills: hasFgos() ? { pk: window.FGOS.STANDS[standId].pk, ok: window.FGOS.STANDS[standId].ok } : null,
        os: { historyCount: world.os.state.history.length, leases: world.leases().length }
      };
      if (hasLeague()) {
        window.LEAGUE.addSubmission(submission);
        window.LEAGUE.spendPrp(profile.id, 'работа выставлена на взаимную проверку: ' + standId);
        grantSubmitAwards(profile, standId, result, quizApi, autotestsReport);
        refreshXpStrip();
        renderReviewArea(standId);
      }
      addLog('submit', 'работа сдана: ' + result.passed + '/' + result.total + ', score ' + result.score);
      downloadJson(submission);
      if (hasLeague()) openCodeModal(window.LEAGUE.encodeSubmission(submission));
      statusEl.textContent = '// работа сдана (' + result.score + '%): JSON скачан, код готов к отправке коллегам';
      submitBtn.disabled = true;
      setTimeout(function () { submitBtn.disabled = false; }, 2500);
      autosave();
    });

    runValidation(true);
    if (saved && saved.autotests) { autotestsReport = saved.autotests; renderAutotests(autotestsReport); }
    renderReviewArea(standId);
    bindStandExchange(standId, function () { renderReviewArea(standId); });
  }

  /* ----------------------------- Стенд Open vSwitch ----------------------------- */
  function initOvsLab() {
    var panel = $('ovs-panel');
    if (!panel || typeof OVS === 'undefined') return;
    var profile = loadProfile();
    if (!profile) return;
    bindCodeModalsOnce();
    safeWidget('xp-strip', function () { renderXpStrip($('lab-profile')); });
    safeWidget('skills', function () { renderSkills('switch-ovs'); });
    safeWidget('presence', function () { startPresence('switch-ovs'); });

    var standId = 'switch-ovs';
    var standTitle = 'Коммутация в Linux · Open vSwitch (VLAN, access, trunk)';
    var key = progressKey(standId);
    var checkBox = $('lab-checks'), scoreEl = $('lab-score');
    var progressBar = $('lab-progress-bar'), stepList = $('lab-steps');
    var termScreen = $('term-screen'), termInput = $('term-input');
    var submitBtn = $('lab-submit'), statusEl = $('lab-status');
    var portsBody = $('ovs-ports'), bridgeStatus = $('ovs-bridge-status');
    var log = [];
    var startedAt = nowISO();
    var autotestsReport = null;
    function addLog(type, msg) { log.push({ t: nowISO(), type: type, msg: msg }); }

    var saved = Store.get(key);
    var world;
    try { world = saved && saved.vm ? OVS.createWorld(saved.vm) : OVS.createWorld(); }
    catch (e) { world = OVS.createWorld(); }
    if (saved && saved.vm) {
      startedAt = saved.startedAt || startedAt;
      addLog('resume', 'прогресс восстановлен из сохранения браузера');
      statusEl.textContent = '// найдено автосохранение от ' + new Date(saved.updatedAt).toLocaleString('ru-RU');
    } else {
      addLog('start', 'стенд открыт, профиль: ' + profile.name + ' (' + profile.group + ')');
    }

    var term = makeTerminal(termScreen, termInput, 'student@ovs:~$', function () { return world.os.state.history; });
    if (saved && saved.terminalLog) term.restore(saved.terminalLog);
    else term.print('help', 'введите help — покажем список команд виртуальной машины', false);

    var quizApi = mountQuiz($('lab-quiz'), OVS.QUIZ, saved && saved.quiz, autosave);
    var topoHost = mountTopology('switch-ovs');
    var quizModal = initQuizModal(function () { return quizApi ? quizApi.getState() : null; });
    var prevPortOk = {};

    function renderState() {
      var state = world.state();
      bridgeStatus.textContent = state.bridge
        ? 'мост ' + state.bridge + ' · служба ' + (state.enabled ? 'active' : 'не запущена')
        : '// мост не создан';
      bridgeStatus.className = 'ovs-status ' + (state.bridge && state.enabled ? 'is-ok' : 'is-bad');
      portsBody.innerHTML = OVS.SPEC.ifaces.map(function (name) {
        var want = OVS.SPEC.ports[name];
        var p = state.ports[name];
        var fact, ok = false;
        if (!p) fact = '<span class="ovs-na">порт не добавлен</span>';
        else if (p.trunks) {
          fact = 'trunk · VLAN [' + p.trunks.join(', ') + ']';
          ok = want.role === 'trunk' && want.vlans.every(function (v) { return p.trunks.indexOf(v) !== -1; });
        } else if (p.tag != null) {
          fact = 'access · VLAN ' + p.tag;
          ok = want.role === 'access' && want.vlan === p.tag;
        } else fact = 'порт без VLAN';
        var justCameAlive = ok && !prevPortOk[name];
        return '<tr class="' + (ok ? 'is-ok' : '') + (justCameAlive ? ' ovs-port-flash' : '') + '" data-port="' + name + '">' +
          '<td class="mono">' + esc(name) + '</td><td>' + esc(want.label) + '</td>' +
          '<td class="mono">' + want.role + ' · ' + (want.vlans ? want.vlans.join(',') : want.vlan) + '</td>' +
          '<td class="mono">' + fact + '</td><td class="ovs-mark">' + (ok ? '✓' : '×') + '</td></tr>';
      }).join('');
      OVS.SPEC.ifaces.forEach(function (name) {
        var row = portsBody.querySelector('tr[data-port="' + name + '"]');
        if (row && row.classList.contains('ovs-port-flash')) {
          setTimeout(function () { row.classList.remove('ovs-port-flash'); }, 1200);
        }
        var p = state.ports[name];
        prevPortOk[name] = !!(p && (function () {
          var want = OVS.SPEC.ports[name];
          if (p.trunks) return want.role === 'trunk' && want.vlans.every(function (v) { return p.trunks.indexOf(v) !== -1; });
          if (p.tag != null) return want.role === 'access' && want.vlan === p.tag;
          return false;
        })());
      });
    }

    var lastResult = null;
    function runValidation(quiet) {
      var result = world.validate();
      lastResult = result;
      updateTopology('switch-ovs', topoHost, result, world);
      if (quizModal) quizModal.syncHint();
      checkBox.innerHTML = result.checks.map(function (c) {
        return '<div class="lab-check ' + (c.ok ? 'is-ok' : 'is-bad') + '">' +
          '<span class="lc-mark">' + (c.ok ? '✓' : '×') + '</span>' +
          '<div><span class="lc-title">' + esc(c.title) + '</span>' +
          '<span class="lc-hint">' + esc(c.hint) + '</span></div></div>';
      }).join('');
      scoreEl.innerHTML = result.passed + '<small>/' + result.total + ' проверок · ' + result.score + '%</small>';
      progressBar.style.width = result.score + '%';
      renderSteps();
      renderState();
      if (!quiet) addLog('check', 'проверка конфигурации OVS: ' + result.passed + '/' + result.total);
      autosave();
      return result;
    }

    function renderSteps() {
      var done = OVS.taskStatus(world.state(), world.os.state.history);
      stepList.innerHTML = OVS.TASKS.map(function (t, i) {
        var ok = done[t.id];
        return '<li class="lab-step' + (ok ? ' is-done' : '') + '">' +
          '<span class="ls-num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span>' + esc(t.title) + '</span>' +
          '<span class="ls-state">' + (ok ? 'готово' : '—') + '</span></li>';
      }).join('');
    }

    var saveTimer = null;
    function autosave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        Store.set(key, {
          v: 2,
          vm: world.snapshot(),
          terminalLog: term.log.slice(-60),
          actionLog: log.slice(-200),
          startedAt: startedAt,
          updatedAt: nowISO(),
          lastResult: lastResult,
          quiz: quizApi ? quizApi.getState() : null,
          autotests: autotestsReport
        });
        statusEl.textContent = '// автосохранено ' + new Date().toLocaleTimeString('ru-RU');
      }, 500);
    }

    term.bind(function (line) {
      var res = world.run(line);
      if (res.clear) { term.clear(); autosave(); return false; }
      term.print(line, res.out, res.isErr || res.code !== 0);
      term.log.push({ line: line, out: res.out, err: res.isErr || res.code !== 0 });
      if (res.event) addLog(res.event.type, res.event.msg);
      runValidation(true);
      autosave();
      return true;
    });

    $('btn-bug').addEventListener('click', function () {
      world.setState(OVS.brokenState());
      addLog('bug', 'загружена ошибочная конфигурация: eth3 вместо trunk сделан access VLAN 10');
      term.print('ovs-vsctl (bug-report)', 'eth3 назначен tag=10; по заданию это должен быть trunk 10,20', true);
      term.log.push({ line: 'ovs-vsctl (bug-report)', out: 'eth3 назначен tag=10; по заданию это должен быть trunk 10,20', err: true });
      runValidation(false);
      termScreen.scrollTop = termScreen.scrollHeight;
    });
    $('btn-reset').addEventListener('click', function () {
      if (!confirm('Сбросить весь прогресс этого стенда?')) return;
      Store.del(key);
      location.reload();
    });
    $('btn-autotests').addEventListener('click', function () {
      var btn = $('btn-autotests');
      btn.disabled = true;
      btn.textContent = 'прогоняю на тестовой ВМ…';
      setTimeout(function () {
        autotestsReport = OVS.runAutotests();
        renderAutotests(autotestsReport);
        btn.disabled = false;
        btn.textContent = 'прогнать автотесты →';
        addLog('autotests', 'автотесты: ' + autotestsReport.passed + '/' + autotestsReport.total);
        autosave();
      }, 350);
    });

    submitBtn.addEventListener('click', function () {
      var result = runValidation(true);
      var state = world.state();
      var submission = {
        id: uid(),
        schema: 'stands-submission/2',
        standId: standId,
        standTitle: standTitle,
        student: hasLeague() ? window.LEAGUE.publicStudent(profile) : { id: profile.id || profile.name, name: profile.name, group: profile.group },
        startedAt: startedAt,
        updatedAt: nowISO(),
        submittedAt: nowISO(),
        result: { passed: result.passed, total: result.total, score: result.score, ready: result.ready },
        checks: result.checks,
        config: OVS.stateToText(state),
        terminalLog: term.log.slice(-60),
        actionLog: log.slice(-200),
        quiz: quizApi ? quizApi.getState() : null,
        autotests: autotestsReport ? { passed: autotestsReport.passed, total: autotestsReport.total, score: autotestsReport.score } : null,
        skills: hasFgos() ? { pk: window.FGOS.STANDS[standId].pk, ok: window.FGOS.STANDS[standId].ok } : null,
        os: { historyCount: world.os.state.history.length, bridge: state.bridge, ports: Object.keys(state.ports).length }
      };
      if (hasLeague()) {
        window.LEAGUE.addSubmission(submission);
        window.LEAGUE.spendPrp(profile.id, 'работа выставлена на взаимную проверку: ' + standId);
        grantSubmitAwards(profile, standId, result, quizApi, autotestsReport);
        refreshXpStrip();
        renderReviewArea(standId);
      }
      addLog('submit', 'работа сдана: ' + result.passed + '/' + result.total + ', score ' + result.score);
      downloadJson(submission);
      if (hasLeague()) openCodeModal(window.LEAGUE.encodeSubmission(submission));
      statusEl.textContent = '// работа сдана (' + result.score + '%): JSON скачан, код готов к отправке коллегам';
      submitBtn.disabled = true;
      setTimeout(function () { submitBtn.disabled = false; }, 2500);
      autosave();
    });

    runValidation(true);
    if (saved && saved.autotests) { autotestsReport = saved.autotests; renderAutotests(autotestsReport); }
    renderReviewArea(standId);
    bindStandExchange(standId, function () { renderReviewArea(standId); });
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    safeRun('тема', initTheme);
    safeRun('кабинет', initCabinet);
    safeRun('стенд DHCP', initDhcpLab);
    safeRun('стенд OVS', initOvsLab);
    safeRun('анимации', initReveal);
    safeRun('навигация шагов', initStepSpy);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
