/* ==========================================================================
   Виртуальные стенды · клиентское приложение
   Профиль студента (ФИО/группа), автосохранение прогресса в localStorage,
   терминал-симулятор, журнал действий, контрольные мини-тесты и экспорт
   работы в JSON для преподавателя. Сервер не нужен — всё живёт в браузере.
   Поддерживает два стенда: DHCP (редактор конфига) и Open vSwitch (терминал).
   ========================================================================== */
(function () {
  'use strict';

  var PROFILE_KEY = 'stands-profile';
  var SUBMISSIONS_KEY = 'stands-submissions';
  var progressKey = function (standId) { return 'stands-progress:' + standId; };

  var Store = {
    get: function (k) {
      try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) { return false; }
    },
    del: function (k) { localStorage.removeItem(k); }
  };

  function uid() {
    return 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function nowISO() { return new Date().toISOString(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

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
        var explain = state.done
          ? '<p class="q-explain">// ' + esc(item.explain) + '</p>'
          : '';
        return '<div class="q-item" data-q="' + qi + '">' +
          '<p class="q-title"><span class="q-num">' + String(qi + 1).padStart(2, '0') + '</span>' + esc(item.q) + '</p>' +
          '<div class="q-opts">' + opts + '</div>' + explain + '</div>';
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
    return {
      getState: function () { return state; },
      isComplete: function () { return state.done; }
    };
  }

  /* --------------------------- Общий терминал --------------------------- */
  function makeTerminal(screenEl, inputEl, prompt) {
    var history = [];
    function printTerm(line, out, isErr) {
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
    return {
      history: history,
      print: printTerm,
      restore: function (log) {
        log.forEach(function (h) { printTerm(h.line, h.out, h.err); });
      },
      bind: function (handler) {
        inputEl.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          var line = inputEl.value.trim();
          inputEl.value = '';
          if (!line) return;
          if (handler(line) === false) return; // обработчик сам решил (например clear)
        });
      },
      clear: function () { screenEl.innerHTML = ''; history.length = 0; }
    };
  }

  /* --------------------------- Лендинг стендов --------------------------- */
  function initLanding() {
    var form = $('profile-form');
    if (!form) return;
    var nameInput = $('p-name'), groupInput = $('p-group'), msg = $('profile-msg');
    var gate = $('profile-gate'), panel = $('profile-panel'), catalog = $('stands-catalog');

    function renderPanel(profile) {
      gate.hidden = true;
      panel.hidden = false;
      catalog.hidden = false;
      $('fp-name').textContent = profile.name;
      $('fp-group').textContent = profile.group;
    }

    var existing = Store.get(PROFILE_KEY);
    if (existing && existing.name && existing.group) renderPanel(existing);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nameInput.value.trim().replace(/\s+/g, ' ');
      var group = groupInput.value.trim().replace(/\s+/g, ' ');
      if (name.length < 4) { msg.textContent = 'Укажите ФИО полностью (не короче 4 символов)'; return; }
      if (!group) { msg.textContent = 'Укажите учебную группу'; return; }
      var profile = { name: name, group: group, savedAt: nowISO() };
      Store.set(PROFILE_KEY, profile);
      msg.textContent = '';
      renderPanel(profile);
    });

    $('profile-change').addEventListener('click', function () {
      var p = Store.get(PROFILE_KEY) || {};
      nameInput.value = p.name || '';
      groupInput.value = p.group || '';
      panel.hidden = true;
      catalog.hidden = true;
      gate.hidden = false;
      nameInput.focus();
    });
  }

  /* --------------------------- Mermaid (обе страницы) --------------------------- */
  function initMermaid() {
    if (!window.mermaid || !document.querySelector('.mermaid')) return;
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        flowchart: { curve: 'linear', htmlLabels: true },
        themeVariables: {
          darkMode: true,
          background: '#12161b',
          primaryColor: '#171d23',
          primaryBorderColor: '#5b9dff',
          primaryTextColor: '#e7ecf2',
          lineColor: '#8a95a1',
          secondaryColor: '#171d23',
          tertiaryColor: '#0c1014',
          edgeLabelBackground: '#171d23',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: '13px'
        }
      });
      window.mermaid.run({ nodes: [document.querySelector('.mermaid')] })
        .then(function () {
          var fb = $('schema-fallback');
          if (fb) fb.hidden = true;
        })
        .catch(function () { /* остаётся текстовый fallback */ });
    } catch (e) { /* fallback */ }
  }

  /* --------------------------- Стенд DHCP --------------------------- */
  function initDhcpLab() {
    var editor = $('cfg-editor');
    if (!editor || typeof DHCP === 'undefined') return;

    var profile = Store.get(PROFILE_KEY);
    if (!profile || !profile.name || !profile.group) {
      location.href = 'index.html?return=' + encodeURIComponent(location.pathname.split('/').pop());
      return;
    }
    $('fp-name').textContent = profile.name;
    $('fp-group').textContent = profile.group;

    var standId = 'dhcp-alt';
    var standTitle = 'Конфигурация DHCP · ALT Server / ALT Workstation';
    var key = progressKey(standId);

    var checkBox = $('lab-checks'), scoreEl = $('lab-score');
    var progressBar = $('lab-progress-bar'), stepList = $('lab-steps');
    var termScreen = $('term-screen'), termInput = $('term-input');
    var submitBtn = $('lab-submit'), statusEl = $('lab-status');
    var log = [];
    var startedAt = nowISO();
    function addLog(type, msg) { log.push({ t: nowISO(), type: type, msg: msg }); }

    var term = makeTerminal(termScreen, termInput, 'student@alt:~$');
    var termHistory = term.history;

    // Восстановление прогресса
    var saved = Store.get(key);
    var quizApi = null;
    if (saved && saved.config) {
      editor.value = saved.config;
      termHistory.push.apply(termHistory, saved.terminalLog || []);
      startedAt = saved.startedAt || startedAt;
      addLog('resume', 'прогресс восстановлен из сохранения браузера');
      statusEl.textContent = '// найдено автосохранение от ' + new Date(saved.updatedAt).toLocaleString('ru-RU');
    } else {
      editor.value = DHCP.STARTER_CONFIG;
      addLog('start', 'стенд открыт, профиль: ' + profile.name + ' (' + profile.group + ')');
    }
    term.restore(termHistory.slice());

    quizApi = mountQuiz($('lab-quiz'), DHCP.QUIZ, saved && saved.quiz, function () { autosave(); });

    var lastResult = null;
    function runValidation(quiet) {
      var result = DHCP.validateDhcpConfig(editor.value);
      lastResult = result;
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
      var done = {
        t1: termHistory.some(function (h) { return /install|enable|start/.test(h.line); }),
        t2: result.checks.find(function (c) { return c.id === 'subnet'; }).ok && result.checks.find(function (c) { return c.id === 'range'; }).ok,
        t3: result.checks.find(function (c) { return c.id === 'routers'; }).ok && result.checks.find(function (c) { return c.id === 'dns'; }).ok,
        t4: result.checks.find(function (c) { return c.id === 'authoritative'; }).ok,
        t5: result.checks.find(function (c) { return c.id === 'reservation'; }).ok,
        t6: termHistory.some(function (h) { return h.line.indexOf('dhclient') === 0; }) && result.ready
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
          config: editor.value,
          terminalLog: termHistory.slice(-60),
          actionLog: log.slice(-200),
          startedAt: startedAt,
          updatedAt: nowISO(),
          lastResult: lastResult,
          quiz: quizApi ? quizApi.getState() : null
        });
        statusEl.textContent = '// автосохранено ' + new Date().toLocaleTimeString('ru-RU');
      }, 500);
    }
    editor.addEventListener('input', function () { runValidation(true); });

    term.bind(function (line) {
      var res = DHCP.runCommand(line, { ready: lastResult ? lastResult.ready : false });
      if (res.clear) { term.clear(); return false; }
      term.print(line, res.out, res.ok === false);
      termHistory.push({ line: line, out: res.out, err: res.ok === false });
      if (res.event) addLog(res.event.type, res.event.msg);
      if (line.indexOf('dhclient') === 0) runValidation(true);
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

    submitBtn.addEventListener('click', function () {
      var result = runValidation(true);
      var submission = {
        id: uid(),
        schema: 'stands-submission/1',
        standId: standId,
        standTitle: standTitle,
        student: { name: profile.name, group: profile.group },
        startedAt: startedAt,
        updatedAt: nowISO(),
        submittedAt: nowISO(),
        result: { passed: result.passed, total: result.total, score: result.score, ready: result.ready },
        checks: result.checks,
        config: editor.value,
        terminalLog: termHistory.slice(-60),
        actionLog: log.slice(-200),
        quiz: quizApi ? quizApi.getState() : null
      };
      var mine = Store.get(SUBMISSIONS_KEY) || [];
      mine.push(submission);
      Store.set(SUBMISSIONS_KEY, mine);
      addLog('submit', 'работа сдана: ' + result.passed + '/' + result.total + ', score ' + result.score);

      var blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = standId + '_' + profile.group.replace(/[^\wа-яё-]+/gi, '_') + '_' +
        profile.name.replace(/[^\wа-яё]+/gi, '_') + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);

      statusEl.textContent = '// работа сдана (' + result.score + '%). JSON-файл скачан — отправьте его преподавателю';
      submitBtn.disabled = true;
      setTimeout(function () { submitBtn.disabled = false; }, 2500);
    });

    runValidation(true);
    termInput.focus();
  }

  /* --------------------------- Стенд Open vSwitch --------------------------- */
  function initOvsLab() {
    var panel = $('ovs-panel');
    if (!panel || typeof OVS === 'undefined') return;

    var profile = Store.get(PROFILE_KEY);
    if (!profile || !profile.name || !profile.group) {
      location.href = 'index.html?return=' + encodeURIComponent(location.pathname.split('/').pop());
      return;
    }
    $('fp-name').textContent = profile.name;
    $('fp-group').textContent = profile.group;

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
    function addLog(type, msg) { log.push({ t: nowISO(), type: type, msg: msg }); }

    var term = makeTerminal(termScreen, termInput, 'student@ovs:~$');
    var termHistory = term.history;

    var saved = Store.get(key);
    var state;
    if (saved && saved.ovsState) {
      state = Object.assign(OVS.freshState(), saved.ovsState);
      termHistory.push.apply(termHistory, saved.terminalLog || []);
      startedAt = saved.startedAt || startedAt;
      addLog('resume', 'прогресс восстановлен из сохранения браузера');
      statusEl.textContent = '// найдено автосохранение от ' + new Date(saved.updatedAt).toLocaleString('ru-RU');
    } else {
      state = OVS.freshState();
      addLog('start', 'стенд открыт, профиль: ' + profile.name + ' (' + profile.group + ')');
      term.print('help', 'введите help — покажем последовательность команд для настройки', false);
      termHistory.push({ line: 'help', out: 'введите help — покажем последовательность команд для настройки', err: false });
    }
    term.restore(termHistory.slice());

    var quizApi = mountQuiz($('lab-quiz'), OVS.QUIZ, saved && saved.quiz, function () { autosave(); });

    function renderState() {
      bridgeStatus.textContent = state.bridge
        ? 'мост ' + state.bridge + ' · служба ' + (state.enabled ? 'active' : 'не запущена')
        : '// мост не создан';
      bridgeStatus.className = 'ovs-status ' + (state.bridge && state.enabled ? 'is-ok' : 'is-bad');
      portsBody.innerHTML = OVS.SPEC.ifaces.map(function (name) {
        var want = OVS.SPEC.ports[name];
        var p = state.ports[name];
        var fact, ok = false;
        if (!p) {
          fact = '<span class="ovs-na">порт не добавлен</span>';
        } else if (p.trunks) {
          fact = 'trunk · VLAN [' + p.trunks.join(', ') + ']';
          ok = want.role === 'trunk' && want.vlans.every(function (v) { return p.trunks.indexOf(v) !== -1; });
        } else if (p.tag != null) {
          fact = 'access · VLAN ' + p.tag;
          ok = want.role === 'access' && want.vlan === p.tag;
        } else {
          fact = 'порт без VLAN';
        }
        return '<tr class="' + (ok ? 'is-ok' : '') + '">' +
          '<td class="mono">' + esc(name) + '</td>' +
          '<td>' + esc(want.label) + '</td>' +
          '<td class="mono">' + want.role + ' · ' + (want.vlans ? want.vlans.join(',') : want.vlan) + '</td>' +
          '<td class="mono">' + fact + '</td>' +
          '<td class="ovs-mark">' + (ok ? '✓' : '×') + '</td></tr>';
      }).join('');
    }

    var lastResult = null;
    function runValidation(quiet) {
      var result = OVS.validate(state);
      lastResult = result;
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
      var done = OVS.taskStatus(state, termHistory);
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
          ovsState: state,
          terminalLog: termHistory.slice(-60),
          actionLog: log.slice(-200),
          startedAt: startedAt,
          updatedAt: nowISO(),
          quiz: quizApi ? quizApi.getState() : null
        });
        statusEl.textContent = '// автосохранено ' + new Date().toLocaleTimeString('ru-RU');
      }, 500);
    }

    term.bind(function (line) {
      var res = OVS.runCommand(line, { state: state });
      if (res.clear) { term.clear(); autosave(); return false; }
      term.print(line, res.out, res.ok === false);
      termHistory.push({ line: line, out: res.out, err: res.ok === false });
      if (res.event) addLog(res.event.type, res.event.msg);
      runValidation(true);
      autosave();
      return true;
    });

    $('btn-bug').addEventListener('click', function () {
      state = OVS.brokenState();
      addLog('bug', 'загружена ошибочная конфигурация: eth3 вместо trunk сделан access VLAN 10');
      term.print('ovs-vsctl (bug-report)', 'eth3 назначен tag=10; по заданию это должен быть trunk 10,20', true);
      termHistory.push({ line: 'ovs-vsctl (bug-report)', out: 'eth3 назначен tag=10; по заданию это должен быть trunk 10,20', err: true });
      runValidation(false);
      termScreen.scrollTop = termScreen.scrollHeight;
    });
    $('btn-reset').addEventListener('click', function () {
      if (!confirm('Сбросить весь прогресс этого стенда?')) return;
      Store.del(key);
      location.reload();
    });

    submitBtn.addEventListener('click', function () {
      var result = runValidation(true);
      var submission = {
        id: uid(),
        schema: 'stands-submission/1',
        standId: standId,
        standTitle: standTitle,
        student: { name: profile.name, group: profile.group },
        startedAt: startedAt,
        updatedAt: nowISO(),
        submittedAt: nowISO(),
        result: { passed: result.passed, total: result.total, score: result.score, ready: result.ready },
        checks: result.checks,
        config: OVS.stateToText(state),
        terminalLog: termHistory.slice(-60),
        actionLog: log.slice(-200),
        quiz: quizApi ? quizApi.getState() : null
      };
      var mine = Store.get(SUBMISSIONS_KEY) || [];
      mine.push(submission);
      Store.set(SUBMISSIONS_KEY, mine);
      addLog('submit', 'работа сдана: ' + result.passed + '/' + result.total + ', score ' + result.score);

      var blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = standId + '_' + profile.group.replace(/[^\wа-яё-]+/gi, '_') + '_' +
        profile.name.replace(/[^\wа-яё]+/gi, '_') + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);

      statusEl.textContent = '// работа сдана (' + result.score + '%). JSON-файл скачан — отправьте его преподавателю';
      submitBtn.disabled = true;
      setTimeout(function () { submitBtn.disabled = false; }, 2500);
    });

    runValidation(true);
    termInput.focus();
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    initLanding();
    initDhcpLab();
    initOvsLab();
    initMermaid();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
