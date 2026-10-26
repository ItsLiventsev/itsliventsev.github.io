/* ==========================================================================
   Виртуальные стенды · клиентское приложение
   Профиль студента (ФИО/группа), автосохранение прогресса в localStorage,
   терминал-симулятор, журнал действий и экспорт работы в JSON для преподавателя.
   Сервер не нужен: всё живёт в браузере, работа выгружается файлом.
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

  /* ---------------- Лендинг стендов: идентификация и каталог ---------------- */
  function initLanding() {
    var form = document.getElementById('profile-form');
    if (!form) return;
    var nameInput = document.getElementById('p-name');
    var groupInput = document.getElementById('p-group');
    var gate = document.getElementById('profile-gate');
    var panel = document.getElementById('profile-panel');
    var catalog = document.getElementById('stands-catalog');
    var msg = document.getElementById('profile-msg');

    function renderPanel(profile) {
      gate.hidden = true;
      panel.hidden = false;
      catalog.hidden = false;
      document.getElementById('fp-name').textContent = profile.name;
      document.getElementById('fp-group').textContent = profile.group;
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

    document.getElementById('profile-change').addEventListener('click', function () {
      var p = Store.get(PROFILE_KEY) || {};
      nameInput.value = p.name || '';
      groupInput.value = p.group || '';
      panel.hidden = true;
      catalog.hidden = true;
      gate.hidden = false;
      nameInput.focus();
    });
  }

  /* ---------------- Лабораторная страница ---------------- */
  function initLab() {
    var editor = document.getElementById('cfg-editor');
    if (!editor || typeof DHCP === 'undefined') return;

    var profile = Store.get(PROFILE_KEY);
    if (!profile || !profile.name || !profile.group) {
      location.href = 'index.html?return=' + encodeURIComponent(location.pathname.split('/').pop());
      return;
    }
    document.getElementById('fp-name').textContent = profile.name;
    document.getElementById('fp-group').textContent = profile.group;

    var standId = 'dhcp-alt';
    var standTitle = 'Конфигурация DHCP · ALT Server / ALT Workstation';
    var key = progressKey(standId);

    var checkBox = document.getElementById('lab-checks');
    var scoreEl = document.getElementById('lab-score');
    var progressBar = document.getElementById('lab-progress-bar');
    var stepList = document.getElementById('lab-steps');
    var termScreen = document.getElementById('term-screen');
    var termInput = document.getElementById('term-input');
    var submitBtn = document.getElementById('lab-submit');
    var statusEl = document.getElementById('lab-status');
    var log = [];
    var termHistory = [];
    var startedAt = nowISO();

    function addLog(type, msg) {
      log.push({ t: nowISO(), type: type, msg: msg });
    }

    // Восстановление сохранённого прогресса
    var saved = Store.get(key);
    if (saved && saved.config) {
      editor.value = saved.config;
      termHistory = saved.terminalLog || [];
      startedAt = saved.startedAt || startedAt;
      addLog('resume', 'прогресс восстановлен из сохранения браузера');
      statusEl.textContent = '// найдено автосохранение от ' + new Date(saved.updatedAt).toLocaleString('ru-RU');
    } else {
      editor.value = DHCP.STARTER_CONFIG;
      addLog('start', 'стенд открыт, профиль: ' + profile.name + ' (' + profile.group + ')');
    }
    termHistory.forEach(function (h) { printTerm(h.prompt, h.line, h.out, h.err); });

    // Mermaid-схема (CDN; если не загрузился — остаётся текстовый fallback)
    if (window.mermaid) {
      try {
        window.mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose', flowchart: { curve: 'linear' } });
        var fb = document.getElementById('schema-fallback');
        if (fb) fb.hidden = true;
      } catch (e) { /* остаётся fallback */ }
    }

    /* --- Проверка конфига --- */
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
      return done;
    }

    /* --- Автосохранение (debounce) --- */
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
          lastResult: lastResult
        });
        statusEl.textContent = '// автосохранено ' + new Date().toLocaleTimeString('ru-RU');
      }, 500);
    }
    editor.addEventListener('input', function () { runValidation(true); });

    /* --- Терминал --- */
    function printTerm(prompt, line, out, isErr) {
      var row = document.createElement('div');
      row.className = 'lt-line';
      row.innerHTML = '<span class="lt-prompt">' + esc(prompt) + '</span><span>' + esc(line) + '</span>';
      termScreen.appendChild(row);
      if (out) {
        var pre = document.createElement('div');
        if (isErr) pre.className = 'lt-err';
        pre.textContent = out;
        termScreen.appendChild(pre);
      }
      termScreen.scrollTop = termScreen.scrollHeight;
    }

    termInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var line = termInput.value.trim();
      termInput.value = '';
      if (!line) return;
      var res = DHCP.runCommand(line, { ready: lastResult ? lastResult.ready : false });
      if (res.clear) { termScreen.innerHTML = ''; termHistory = []; return; }
      printTerm('student@alt:~$', line, res.out, res.ok === false);
      termHistory.push({ prompt: 'student@alt:~$', line: line, out: res.out, err: res.ok === false });
      if (res.event) addLog(res.event.type, res.event.msg);
      if (line.indexOf('dhclient') === 0) runValidation(true);
      autosave();
    });

    /* --- Кнопки лаборатории --- */
    document.getElementById('btn-validate').addEventListener('click', function () { runValidation(false); });
    document.getElementById('btn-bug').addEventListener('click', function () {
      editor.value = DHCP.BROKEN_CONFIG;
      addLog('bug', 'загружен сломанный конфиг ситуационной задачи');
      runValidation(false);
      editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
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
        actionLog: log.slice(-200)
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

  let booted = false;
  function boot() {
    if (booted) { return; }
    booted = true;
    initLanding();
    initLab();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
