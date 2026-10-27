/* ==========================================================================
   Админка · приём работ виртуальных стендов (v2, без сервера)
   Источники работ: импорт JSON, приём по коду ITS-LAB1, папка submissions/
   публичного репозитория (читается без токена), локальное хранилище лиги.
   Presence: кто авторизован и на каком стенде, со своей кнопкой обновления
   (без перезагрузки страницы) и живыми обновлениями через событие storage.
   Экспертная оценка работ рубрикой из 4 критериев.
   ========================================================================== */
(function () {
  'use strict';

  var TOKEN_KEY = 'itsliventsev-admin-token';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return iso || '—'; }
  }
  function ago(iso) {
    var sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return 'только что';
    if (sec < 3600) return Math.floor(sec / 60) + ' мин назад';
    if (sec < 86400) return Math.floor(sec / 3600) + ' ч назад';
    return Math.floor(sec / 86400) + ' дн назад';
  }
  function status(msg, isErr) {
    var el = $('sub-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isErr ? '#dc2626' : 'var(--accent)';
  }
  var L = function () { return window.LEAGUE || null; };

  /* Хранилище работ: общее с лигой ключом stands-submissions */
  function loadItems() {
    if (L()) return L().submissions();
    try {
      var raw = JSON.parse(localStorage.getItem('stands-submissions-admin'));
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }
  function saveItems(items) {
    if (L()) { localStorage.setItem(L().KEYS.submissions, JSON.stringify(items)); return; }
    localStorage.setItem('stands-submissions-admin', JSON.stringify(items));
  }
  function addItems(list) {
    var seen = {};
    loadItems().forEach(function (s) { seen[s.id] = true; });
    var added = 0, skipped = 0;
    list.forEach(function (o) {
      if (!validSubmission(o)) { skipped++; return; }
      if (seen[o.id]) return;
      seen[o.id] = true;
      if (L()) L().addSubmission(o); else { var all = loadItems(); all.push(o); saveItems(all); }
      added++;
    });
    render();
    status('Добавлено работ: ' + added + (skipped ? ', пропущено некорректных: ' + skipped : ''));
    return added;
  }
  function removeItem(id) {
    saveItems(loadItems().filter(function (x) { return x.id !== id; }));
    render();
  }

  var state = { filterText: '', filterGroup: '', filterStand: '' };

  function validSubmission(o) {
    return o && (o.schema === 'stands-submission/1' || o.schema === 'stands-submission/2') &&
      o.student && o.standId && o.submittedAt;
  }

  function filtered() {
    var q = state.filterText.trim().toLowerCase();
    return loadItems().filter(function (s) {
      if (state.filterGroup && s.student.group !== state.filterGroup) return false;
      if (state.filterStand && s.standId !== state.filterStand) return false;
      if (q) {
        var hay = (s.student.name + ' ' + (s.student.group || '') + ' ' + (s.standTitle || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return (b.submittedAt || '').localeCompare(a.submittedAt || ''); });
  }

  function scoreClass(score) {
    if (score >= 85) return 'is-ok';
    if (score >= 50) return '';
    return 'is-bad';
  }
  function standLabel(id) {
    return id === 'dhcp-alt' ? 'DHCP · ALT' : id === 'switch-ovs' ? 'Open vSwitch' : id;
  }

  /* ----------------------------- Presence-блок ----------------------------- */
  function renderPresence() {
    var tbody = $('presence-tbody');
    if (!tbody || !L()) return;
    var list = L().listPresence(45000);
    $('presence-count').textContent = list.length;
    $('presence-online').textContent = list.filter(function (p) { return p.online; }).length;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="presence-empty">// пока нет ни одной сессии: данные появятся, когда студенты откроют стенды</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (p) {
      return '<tr>' +
        '<td><span class="ps-dot ' + (p.online ? 'is-online' : '') + '"></span>' +
        (p.online ? 'онлайн' : 'неактивен') + (p.demo ? ' <small>(демо)</small>' : '') + '</td>' +
        '<td><strong>' + esc(p.name) + '</strong></td>' +
        '<td class="mono">' + esc(p.group || '—') + '</td>' +
        '<td class="mono">' + esc(p.standId ? standLabel(p.standId) : '—') + '</td>' +
        '<td class="mono" title="' + esc(fmtDate(p.lastSeen)) + '">' + ago(p.lastSeen) + '</td>' +
        '</tr>';
    }).join('');
    $('presence-updated').textContent = 'обновлено ' + new Date().toLocaleTimeString('ru-RU');
  }

  /* ----------------------------- Таблица работ ----------------------------- */
  function renderFilters() {
    var groups = {}, stands = {};
    loadItems().forEach(function (s) { groups[s.student.group] = true; stands[s.standId] = s.standTitle || standLabel(s.standId); });
    var gSel = $('sub-filter-group'), sSel = $('sub-filter-stand');
    if (gSel) {
      var gv = gSel.value;
      gSel.innerHTML = '<option value="">все группы</option>' + Object.keys(groups).sort().map(function (g) {
        return '<option' + (g === gv ? ' selected' : '') + '>' + esc(g) + '</option>';
      }).join('');
    }
    if (sSel) {
      var sv = sSel.value;
      sSel.innerHTML = '<option value="">все стенды</option>' + Object.keys(stands).map(function (id) {
        return '<option value="' + esc(id) + '"' + (id === sv ? ' selected' : '') + '>' + esc(stands[id]) + '</option>';
      }).join('');
    }
    $('sub-count').textContent = loadItems().length;
  }

  function reviewsOf(id) { return L() ? L().reviewsFor(id) : []; }

  function render() {
    renderFilters();
    var tbody = $('sub-tbody');
    var rows = filtered();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="padding:1.4rem;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:.8rem;">' +
        (loadItems().length ? '// по фильтрам ничего не найдено' : '// работ пока нет — импорт JSON, приём по коду или загрузка демо-данных') + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (s, i) {
      var r = s.result || {};
      var revs = reviewsOf(s.id);
      var expert = revs.filter(function (x) { return x.kind === 'expert'; }).length;
      var peer = revs.length - expert;
      return '<tr>' +
        '<td class="mono">' + String(i + 1).padStart(2, '0') + '</td>' +
        '<td><strong>' + esc(s.student.name) + '</strong>' + (s.student.demo ? ' <small title="демо-однокурсник">демо</small>' : '') + '</td>' +
        '<td class="mono">' + esc(s.student.group || '—') + '</td>' +
        '<td>' + esc(s.standTitle || standLabel(s.standId)) + '</td>' +
        '<td><span class="sub-score ' + scoreClass(r.score || 0) + '">' + (r.score != null ? r.score + '%' : '—') + '</span></td>' +
        '<td class="mono" style="font-size:.78rem;">' +
          (s.autotests ? 'АТ ' + esc(s.autotests.passed + '/' + s.autotests.total) + ' · ' : '') +
          (s.quiz && s.quiz.done ? 'тест ' + esc(s.quiz.correct) : 'тест —') +
          '<br><span style="color:var(--muted);">пиринг ' + peer + ' · эксперт ' + expert + '</span></td>' +
        '<td class="mono" style="color:var(--muted);">' + fmtDate(s.submittedAt) + '</td>' +
        '<td class="sub-actions">' +
          '<button class="btn btn-sm" type="button" data-open="' + esc(s.id) + '">открыть</button> ' +
          '<button class="btn btn-sm btn-ghost" type="button" data-del="' + esc(s.id) + '">удалить</button>' +
        '</td></tr>';
    }).join('');
  }

  /* ----------------------------- Детализация + экспертная оценка ----------------------------- */
  function openDetail(id) {
    var s = loadItems().filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    $('sub-modal').hidden = false;
    var r = s.result || {};
    var checks = (s.checks || []).map(function (c) {
      return '<div class="lab-check ' + (c.ok ? 'is-ok' : 'is-bad') + '">' +
        '<span class="lc-mark">' + (c.ok ? '✓' : '×') + '</span>' +
        '<div><span class="lc-title">' + esc(c.title) + '</span>' +
        '<span class="lc-hint">' + esc(c.hint) + '</span></div></div>';
    }).join('') || '<p class="admin-hint">проверок нет</p>';
    var auto = s.autotests ? '<p class="sub-detail-meta">автотесты: ' + esc(s.autotests.passed + '/' + s.autotests.total) + ' (' + esc(s.autotests.score) + '%)</p>' : '';
    var revs = reviewsOf(s.id);
    var revHtml = revs.length ? revs.map(function (rv) {
      var avg = Math.round(((rv.scores.config + rv.scores.completeness + rv.scores.journal + rv.scores.communication) / 4) * 10) / 10;
      return '<div class="rv-review ' + (rv.kind === 'expert' ? 'is-expert' : '') + '" style="border-left:2px solid ' + (rv.kind === 'expert' ? 'var(--warn-text,#b45309)' : 'var(--accent)') + ';padding:.6rem .75rem;margin:.4rem 0;background:var(--surface-2);">' +
        '<p class="rv-review-meta" style="font-family:var(--font-mono);font-size:.72rem;color:var(--muted);margin:0 0 .25rem;">' +
        (rv.kind === 'expert' ? '★ экспертная оценка' : 'взаимная оценка') + ' · ' + esc(rv.reviewer.name) + ' · ' + avg + '/5</p>' +
        '<p style="margin:0;font-size:.88rem;line-height:1.55;">' + esc(rv.comment) + '</p></div>';
    }).join('') : '<p class="admin-hint">оценок пока нет</p>';

    $('sub-modal-body').innerHTML =
      '<div class="sub-detail-head">' +
        '<div><strong style="font-size:1.05rem;">' + esc(s.student.name) + '</strong>' +
        '<div class="mono text-xs" style="color:var(--muted);margin-top:.2rem;">' + esc(s.student.group || '—') + ' · ' + esc(s.standTitle || standLabel(s.standId)) +
        (s.student.demo ? ' · демо-данные' : '') + '</div></div>' +
        '<span class="sub-score ' + scoreClass(r.score || 0) + '" style="font-size:1rem;">' + (r.score != null ? r.score + '%' : '—') + '</span>' +
      '</div>' +
      '<p class="mono text-xs" style="color:var(--muted);">начало: ' + fmtDate(s.startedAt) + ' · сдача: ' + fmtDate(s.submittedAt) +
      ' · проверок: ' + (r.passed != null ? r.passed + '/' + r.total : '—') + '</p>' +
      (s.skills ? '<p class="admin-hint" style="margin-top:.5rem;">навыки ФГОС: ' + esc((s.skills.pk || []).join(', ')) + '</p>' : '') +
      '<p class="section-label" style="margin-top:1rem;">результаты CI-проверок</p>' +
      '<div class="lab-checks">' + checks + '</div>' + auto +
      (s.quiz && s.quiz.done ? '<p class="section-label" style="margin-top:1.2rem;">контрольный мини-тест</p><p class="sub-detail-meta">результат: ' + esc(s.quiz.correct) + ' из ' + esc(Object.keys(s.quiz.answers || {}).length) + '</p>' : '') +
      '<p class="section-label" style="margin-top:1.2rem;">итоговая конфигурация стенда</p>' +
      '<pre class="sub-code">' + esc(s.config || '') + '</pre>' +
      '<p class="section-label" style="margin-top:1.2rem;">журнал терминала</p>' +
      '<pre class="sub-code">' + esc((s.terminalLog || []).map(function (h) { return (h.line || '') + (h.out ? '\n' + h.out : ''); }).join('\n')) + '</pre>' +
      '<p class="section-label" style="margin-top:1.2rem;">журнал действий</p>' +
      '<pre class="sub-code">' + esc((s.actionLog || []).map(function (l) { return '[' + fmtDate(l.t) + '] ' + l.type + ': ' + l.msg; }).join('\n')) + '</pre>' +
      '<p class="section-label" style="margin-top:1.2rem;">взаимные и экспертные оценки</p>' + revHtml +
      (L() ? expertForm(s) : '');

    if (L()) bindExpertForm(s);
  }

  function expertForm(s) {
    return '<div style="margin-top:1rem;border:1px solid var(--border);border-radius:10px;padding:1rem;">' +
      '<p class="section-label" style="margin:0 0 .6rem;">★ экспертная оценка преподавателя</p>' +
      '<div id="expert-crits" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:.6rem;">' +
      [['config', 'корректность конфигурации'], ['completeness', 'полнота работы'], ['journal', 'журнал и аккуратность'], ['communication', 'объяснения']].map(function (c) {
        return '<label style="font-size:.8rem;color:var(--text-2);">' + c[1] +
          ' <select class="flat-input expert-score" data-crit="' + c[0] + '" style="margin-top:.25rem;width:100%;">' +
          [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (n === 4 ? ' selected' : '') + '>' + n + ' из 5</option>'; }).join('') +
          '</select></label>';
      }).join('') + '</div>' +
      '<textarea id="expert-comment" class="flat-input" rows="3" style="margin-top:.7rem;width:100%;" placeholder="Экспертное заключение: сильные стороны и точки роста"></textarea>' +
      '<button class="btn btn-primary" id="expert-save" type="button" style="margin-top:.7rem;">сохранить экспертную оценку</button></div>';
  }

  function bindExpertForm(s) {
    var btn = $('expert-save');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var scores = {};
      document.querySelectorAll('.expert-score').forEach(function (sel) { scores[sel.dataset.crit] = Number(sel.value); });
      var comment = $('expert-comment').value.trim();
      if (comment.length < 10) { alert('Заключение короче 10 символов — добавьте развернутый комментарий'); return; }
      L().addReview({
        kind: 'expert', standId: s.standId, submissionId: s.id,
        reviewer: { id: 'teacher', name: 'Преподаватель', group: '—' },
        reviewee: { id: s.student.id || s.student.name, name: s.student.name, group: s.student.group },
        scores: scores, comment: comment
      });
      if (s.student.id) L().award(s.student.id, 'expertReview', 'expert:' + s.id, { standId: s.standId });
      status('Экспертная оценка сохранена');
      render();
      openDetail(s.id);
    });
  }

  /* ----------------------------- Приём по коду ----------------------------- */
  function acceptCodes(text) {
    if (!L()) { status('Модуль лиги не загружен', true); return; }
    var codes = text.split(/[\r\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var okCount = 0;
    var errors = [];
    codes.forEach(function (code, i) {
      try { L().addSubmission(L().decodeSubmission(code)); okCount++; }
      catch (e) { errors.push('строка ' + (i + 1) + ': ' + e.message); }
    });
    render();
    if (okCount) status('Принято работ по коду: ' + okCount + (errors.length ? ', ошибок: ' + errors.length : ''));
    else status('Не принято ни одной работы: ' + errors.join('; '), true);
  }

  /* ----------------------------- Папка репозитория (без токена для публичного репо) ----------------------------- */
  function pullFromRepo() {
    var cfg = window.ADMIN_CONFIG;
    if (!cfg) return status('Не найден admin-config.js', true);
    var btn = $('sub-repo');
    btn.disabled = true;
    var token = sessionStorage.getItem(TOKEN_KEY);
    var headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    var api = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/submissions?ref=' + cfg.branch;
    fetch(api, { headers: headers })
      .then(function (r) {
        if (r.status === 404) throw new Error('Папки submissions/ в репозитории ещё нет');
        if (!r.ok) throw new Error('GitHub API: ' + r.status + (r.status === 403 ? ' (лимит запросов — повторите позже или войдите токеном)' : ''));
        return r.json();
      })
      .then(function (files) {
        var jsons = files.filter(function (f) { return f.name && f.name.endsWith('.json'); });
        if (!jsons.length) throw new Error('В submissions/ нет JSON-файлов');
        return Promise.all(jsons.map(function (f) { return fetch(f.download_url).then(function (r) { return r.json(); }); }));
      })
      .then(function (list) { addItems(list); })
      .catch(function (err) { status(err.message, true); })
      .finally(function () { btn.disabled = false; });
  }

  /* ----------------------------- Инициализация ----------------------------- */
  function init() {
    if (!$('submissions-card')) return;
    render();
    renderPresence();

    // Живые обновления из других вкладок того же браузера (без перезагрузки)
    window.addEventListener('storage', function (e) {
      if (!e.key) return;
      if (L() && (e.key === L().KEYS.submissions || e.key === L().KEYS.reviews)) render();
      if (L() && e.key === L().KEYS.presence) renderPresence();
    });
    // Периодическое обновление только presence-блока
    setInterval(renderPresence, 20000);

    $('presence-refresh').addEventListener('click', function () {
      renderPresence();
      status('Список онлайн-сессий обновлен без перезагрузки страницы');
    });

    $('sub-import').addEventListener('change', function (e) {
      var files = [].slice.call(e.target.files || []);
      Promise.all(files.map(function (f) {
        return f.text().then(function (txt) { try { return JSON.parse(txt); } catch (err) { status('Не удалось разобрать ' + f.name, true); return null; } });
      })).then(function (list) { addItems(list.filter(Boolean)); });
      e.target.value = '';
    });

    $('sub-code-go').addEventListener('click', function () {
      var ta = $('sub-code');
      acceptCodes(ta.value);
      ta.value = '';
    });

    $('sub-export').addEventListener('click', function () {
      var items = loadItems();
      if (!items.length) return status('Нечего экспортировать', true);
      var blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'stands-submissions_' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      status('Экспортировано работ: ' + items.length);
    });

    $('sub-clear').addEventListener('click', function () {
      if (!loadItems().length) return;
      if (!confirm('Удалить все работы из этого браузера?')) return;
      saveItems([]); render(); status('Список работ очищен');
    });

    $('sub-repo').addEventListener('click', pullFromRepo);

    $('sub-demo').addEventListener('click', function () {
      if (!L()) return status('Модуль лиги не загружен', true);
      L().seedDemo(true);
      render(); renderPresence();
      status('Демо-данные загружены: 6 однокурсников, 12 работ, оценки и presence');
    });

    $('sub-search').addEventListener('input', function (e) { state.filterText = e.target.value; render(); });
    $('sub-filter-group').addEventListener('change', function (e) { state.filterGroup = e.target.value; render(); });
    $('sub-filter-stand').addEventListener('change', function (e) { state.filterStand = e.target.value; render(); });

    $('sub-tbody').addEventListener('click', function (e) {
      var openId = e.target.getAttribute && e.target.getAttribute('data-open');
      var delId = e.target.getAttribute && e.target.getAttribute('data-del');
      if (openId) openDetail(openId);
      if (delId) {
        if (!confirm('Удалить эту работу из списка?')) return;
        removeItem(delId); status('Работа удалена');
      }
    });

    $('sub-modal-close').addEventListener('click', function () { $('sub-modal').hidden = true; });
    $('sub-modal').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('sub-modal').hidden) $('sub-modal').hidden = true;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
