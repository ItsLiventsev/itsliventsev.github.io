/* ==========================================================================
   Админка · приём работ виртуальных стендов.
   Работает без GitHub-токена: импортированные JSON хранятся в localStorage
   и фильтруются по ФИО, группе и стенду. При активной сессии админки
   умеет дополнительно подтягивать работы из папки submissions/ репозитория.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'stands-submissions-admin';
  var TOKEN_KEY = 'itsliventsev-admin-token';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!Array.isArray(raw)) return [];
      // битые/частичные записи не должны ронять всю панель — подставляем безопасные значения
      return raw.filter(function (o) { return o && o.student && o.standId; }).map(function (o) {
        o.student.name = o.student.name || '—';
        o.student.group = o.student.group || '—';
        o.standTitle = o.standTitle || o.standId;
        o.result = o.result || {};
        o.checks = Array.isArray(o.checks) ? o.checks : [];
        return o;
      });
    } catch (e) { return []; }
  }
  function save(items) { localStorage.setItem(STORE_KEY, JSON.stringify(items)); }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return iso || '—'; }
  }
  function status(msg, isErr) {
    var el = $('sub-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isErr ? '#dc2626' : 'var(--accent)';
  }

  var state = { items: load(), filterText: '', filterGroup: '', filterStand: '' };

  function validSubmission(o) {
    return o && o.schema === 'stands-submission/1' && o.student && o.standId && o.submittedAt;
  }

  function addSubmissions(list) {
    var seen = {};
    state.items.forEach(function (s) { seen[s.id] = true; });
    var added = 0, skipped = 0;
    list.forEach(function (o) {
      if (!validSubmission(o)) { skipped++; return; }
      if (seen[o.id]) return;
      seen[o.id] = true;
      state.items.push(o);
      added++;
    });
    state.items.sort(function (a, b) { return (b.submittedAt || '').localeCompare(a.submittedAt || ''); });
    save(state.items);
    render();
    status('Добавлено работ: ' + added + (skipped ? ', пропущено некорректных: ' + skipped : ''));
  }

  function filtered() {
    var q = state.filterText.trim().toLowerCase();
    return state.items.filter(function (s) {
      if (state.filterGroup && s.student.group !== state.filterGroup) return false;
      if (state.filterStand && s.standId !== state.filterStand) return false;
      if (q) {
        var hay = (s.student.name + ' ' + s.student.group + ' ' + s.standTitle).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderFilters() {
    var groups = {}, stands = {};
    state.items.forEach(function (s) {
      groups[s.student.group] = true;
      stands[s.standId] = s.standTitle;
    });
    var gSel = $('sub-filter-group');
    var sSel = $('sub-filter-stand');
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
    $('sub-count').textContent = state.items.length;
  }

  function scoreClass(score) {
    if (score >= 85) return 'is-ok';
    if (score >= 50) return '';
    return 'is-bad';
  }

  function render() {
    renderFilters();
    var tbody = $('sub-tbody');
    var rows = filtered();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:1.4rem;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:.8rem;">' +
        (state.items.length ? '// по фильтрам ничего не найдено' : '// работ пока нет — импортируйте JSON-файлы студентов') + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (s, i) {
      var r = s.result || {};
      return '<tr>' +
        '<td class="mono">' + String(i + 1).padStart(2, '0') + '</td>' +
        '<td><strong>' + esc(s.student.name) + '</strong></td>' +
        '<td class="mono">' + esc(s.student.group) + '</td>' +
        '<td>' + esc(s.standTitle) + '</td>' +
        '<td><span class="sub-score ' + scoreClass(r.score || 0) + '">' + (r.score != null ? r.score + '%' : '—') + '</span></td>' +
        '<td class="mono" style="color:var(--muted);">' + fmtDate(s.submittedAt) + '</td>' +
        '<td class="sub-actions">' +
          '<button class="btn btn-sm" type="button" data-open="' + esc(s.id) + '">открыть</button> ' +
          '<button class="btn btn-sm btn-ghost" type="button" data-del="' + esc(s.id) + '">удалить</button>' +
        '</td></tr>';
    }).join('');
  }

  function openDetail(id) {
    var s = state.items.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var r = s.result || {};
    var checks = (s.checks || []).map(function (c) {
      return '<div class="lab-check ' + (c.ok ? 'is-ok' : 'is-bad') + '">' +
        '<span class="lc-mark">' + (c.ok ? '✓' : '×') + '</span>' +
        '<div><span class="lc-title">' + esc(c.title) + '</span>' +
        '<span class="lc-hint">' + esc(c.hint) + '</span></div></div>';
    }).join('') || '<p class="admin-hint">проверок нет</p>';
    $('sub-modal-body').innerHTML =
      '<div class="sub-detail-head">' +
        '<div><strong style="font-size:1.05rem;">' + esc(s.student.name) + '</strong>' +
        '<div class="mono text-xs" style="color:var(--muted);margin-top:.2rem;">' + esc(s.student.group) + ' · ' + esc(s.standTitle) + '</div></div>' +
        '<span class="sub-score ' + scoreClass(r.score || 0) + '" style="font-size:1rem;">' + (r.score != null ? r.score + '%' : '—') + '</span>' +
      '</div>' +
      '<p class="mono text-xs" style="color:var(--muted);">начало: ' + fmtDate(s.startedAt) + ' · сдача: ' + fmtDate(s.submittedAt) +
      ' · проверок пройдено: ' + (r.passed != null ? r.passed + '/' + r.total : '—') + '</p>' +
      '<p class="section-label" style="margin-top:1rem;">результаты CI-проверок</p>' +
      '<div class="lab-checks">' + checks + '</div>' +
      '<p class="section-label" style="margin-top:1.2rem;">итоговый dhcpd.conf</p>' +
      '<pre class="sub-code">' + esc(s.config || '') + '</pre>' +
      '<p class="section-label" style="margin-top:1.2rem;">журнал терминала</p>' +
      '<pre class="sub-code">' + esc((s.terminalLog || []).map(function (h) {
        return (h.prompt || '') + ' ' + (h.line || '') + (h.out ? '\n' + h.out : '');
      }).join('\n')) + '</pre>' +
      '<p class="section-label" style="margin-top:1.2rem;">журнал действий</p>' +
      '<pre class="sub-code">' + esc((s.actionLog || []).map(function (l) {
        return '[' + fmtDate(l.t) + '] ' + l.type + ': ' + l.msg;
      }).join('\n')) + '</pre>';
    $('sub-modal').hidden = false;
  }

  function init() {
    if (!$('submissions-card')) return;

    // Стили квадратной системы подтягиваем только если страница не в flat-scope
    render();

    $('sub-import').addEventListener('change', function (e) {
      var files = [].slice.call(e.target.files || []);
      var pending = files.map(function (f) {
        return f.text().then(function (txt) {
          try { return JSON.parse(txt); } catch (err) { status('Не удалось разобрать ' + f.name, true); return null; }
        });
      });
      Promise.all(pending).then(function (list) { addSubmissions(list.filter(Boolean)); });
      e.target.value = '';
    });

    $('sub-export').addEventListener('click', function () {
      if (!state.items.length) return status('Нечего экспортировать', true);
      var blob = new Blob([JSON.stringify(state.items, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'stands-submissions_' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      status('Экспортировано работ: ' + state.items.length);
    });

    $('sub-clear').addEventListener('click', function () {
      if (!state.items.length) return;
      if (!confirm('Удалить все импортированные работы из этого браузера?')) return;
      state.items = []; save(); render(); status('Список работ очищен');
    });

    $('sub-repo').addEventListener('click', pullFromRepo);

    $('sub-search').addEventListener('input', function (e) { state.filterText = e.target.value; render(); });
    $('sub-filter-group').addEventListener('change', function (e) { state.filterGroup = e.target.value; render(); });
    $('sub-filter-stand').addEventListener('change', function (e) { state.filterStand = e.target.value; render(); });

    $('sub-tbody').addEventListener('click', function (e) {
      var openId = e.target.getAttribute && e.target.getAttribute('data-open');
      var delId = e.target.getAttribute && e.target.getAttribute('data-del');
      if (openId) openDetail(openId);
      if (delId) {
        if (!confirm('Удалить эту работу из списка?')) return;
        state.items = state.items.filter(function (x) { return x.id !== delId; });
        save(); render(); status('Работа удалена');
      }
    });

    $('sub-modal-close').addEventListener('click', function () { $('sub-modal').hidden = true; });
    $('sub-modal').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('sub-modal').hidden) $('sub-modal').hidden = true;
    });
  }

  function pullFromRepo() {
    var cfg = window.ADMIN_CONFIG;
    var token = sessionStorage.getItem(TOKEN_KEY);
    if (!cfg) return status('Не найден admin-config.js', true);
    if (!token) return status('Нужен вход по токену: папка репозитория читается с авторизацией', true);
    var btn = $('sub-repo');
    btn.disabled = true;
    var api = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/submissions?ref=' + cfg.branch;
    fetch(api, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } })
      .then(function (r) {
        if (r.status === 404) throw new Error('Папки submissions/ в репозитории ещё нет');
        if (!r.ok) throw new Error('GitHub API: ' + r.status);
        return r.json();
      })
      .then(function (files) {
        var jsons = files.filter(function (f) { return f.name && f.name.endsWith('.json'); });
        if (!jsons.length) throw new Error('В submissions/ нет JSON-файлов');
        return Promise.all(jsons.map(function (f) {
          return fetch(f.download_url).then(function (r) { return r.json(); });
        }));
      })
      .then(function (list) { addSubmissions(list); })
      .catch(function (err) { status(err.message, true); })
      .finally(function () { btn.disabled = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
