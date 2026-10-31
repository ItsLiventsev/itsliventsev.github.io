/* ==========================================================================
   Универсальный движок страниц «Биржа привилегий» (stands/rewards.html,
   stands/ops/rewards.html, stands/office/rewards.html)
   Одна логика для трёх вселенных: баланс, каталог наград, ордера студента
   (создание / отмена / возврат), статус-строки. Вселенная выбирается
   атрибутом <body data-rewards="league|ops|office">, движок берёт
   соответствующий модуль (LEAGUE / OPS / OFFICE) и каталог наград.
   Публичный список решений преподавателя рендерит standings.js
   (блоки [data-standings="claims|ops-claims|office-claims"]).
   ========================================================================== */
(function () {
  'use strict';

  var $ = window.DOMKIT.$;
  var esc = window.DOMKIT.esc;
  var setMsg = window.DOMKIT.setMsg;
  function mascotSvg(id, size) { return window.MASCOTS ? window.MASCOTS.svg(id || 'fox', { size: size || 44, floating: false }) : ''; }

  /* Конфигурации вселенных: движок, каталог, порядок карточек, тексты */
  var UNIVERSES = {
    league: {
      engine: function () { return window.LEAGUE || null; },
      rewards: 'REWARDS',
      methods: { create: 'createClaim', cancel: 'cancelClaim', refund: 'refundClaim', my: 'myClaims' },
      order: ['point-wipe', 'rescue', 'grade-plus', 'board-pass', 'deadline', 'hint', 'topic-first'],
      labels: {
        account: 'лига СетьПолиса',
        earnHint: 'Неткоины приходят за сдачи работ, автотесты, тесты без ошибок и взаимные проверки. Полный журнал — на <a href="league.html" rel="nofollow">странице лиги</a>.',
        created: ' создан: он уедет преподавателю в бандле лиги (страница лиги → «обмен бандлами»), решение появится здесь и в общем списке ниже.'
      }
    },
    ops: {
      engine: function () { return (window.OPS && OPS.REWARDS_OPS) ? OPS : null; },
      rewards: 'REWARDS_OPS',
      methods: { create: 'createOpsClaim', cancel: 'cancelOpsClaim', refund: 'refundOpsClaim', my: 'myOpsClaims' },
      order: ['ticket-pick', 'mentor-hint', 'deadline-plus', 'point-wipe', 'standby-skip', 'rescue', 'grade-plus'],
      labels: {
        account: 'эксплуатация · ДатаПолис',
        earnHint: 'Неткоины эксплуатации приходят за закрытые заявки, устранённые инциденты, выдержанный SLA, runbook и командные операции экипажа. Полный журнал — в <a href="index.html">консоли ДатаПолиса</a>.',
        created: ' создан: он уедет преподавателю в ops-бандле, решение появится здесь и в общем списке ниже.'
      }
    },
    office: {
      engine: function () { return (window.OFFICE && OFFICE.REWARDS_OFFICE) ? OFFICE : null; },
      rewards: 'REWARDS_OFFICE',
      methods: { create: 'createClaim', cancel: 'cancelClaim', refund: 'refundClaim', my: 'myClaims' },
      order: ['template-kit', 'mentor-hint', 'deadline-plus', 'point-wipe', 'fast-review', 'rescue', 'grade-plus'],
      labels: {
        account: 'цифровое бюро · ОфисПолис',
        earnHint: 'Неткоины бюро приходят за сдачу практических работ по DoD, тесты без ошибок и ежедневный вход. Полный журнал — в <a href="index.html">бюро ОфисПолиса</a>.',
        created: ' создан: он уедет преподавателю в office-бандле, решение появится здесь и в общем списке ниже.'
      }
    }
  };

  var profile = null;
  var E = null;
  var cfg = null;

  function say(text, state) { setMsg($('rw-msg'), text, state); }

  function gate(show) {
    var g = $('rw-gate'), body = $('rw-body');
    if (g) g.hidden = !show;
    if (body) body.hidden = show;
  }

  function balanceCard() {
    var t = E.totals(profile.id);
    var lvl = t.level;
    var handle = E.handleFor(profile).text;
    var streak = E.loginStreak ? E.loginStreak(profile.id) : 0;
    return '<div class="rw-balance">' +
      mascotSvg(profile.mascotId, 52) +
      '<div class="rw-balance-main"><strong>' + esc(handle) + '</strong>' +
      '<span class="mono">' + esc(lvl.title) + ' · уровень ' + lvl.level +
      (streak > 1 ? ' · <span class="rw-streak" title="подряд идущие дни входа">🔥 ' + streak + '</span>' : '') + '</span></div>' +
      '<div class="rw-balance-coins"><b>' + t.coins + ' ◈</b><span>на счету</span></div>' +
      '<div class="rw-balance-xp"><b>' + t.xp + '</b><span>XP</span></div>' +
      '</div>' +
      '<p class="admin-hint">' + cfg.labels.earnHint + '</p>';
  }

  function catalog() {
    var rewards = E[cfg.rewards];
    var t = E.totals(profile.id);
    var mine = E[cfg.methods.my](profile.id);
    return '<div class="rw-grid">' + cfg.order.map(function (id) {
      var r = rewards[id];
      if (!r) return '';
      var pending = mine.some(function (c) { return c.rewardId === id && c.status === 'local'; });
      var affordable = t.coins >= r.coins;
      return '<div class="rw-card' + (affordable ? '' : ' is-locked') + '">' +
        '<div class="rw-card-head"><strong>' + esc(r.title) + '</strong>' +
        '<span class="rw-price mono">' + r.coins + ' ◈</span></div>' +
        '<p class="rw-note">' + esc(r.note) + '</p>' +
        (pending
          ? '<button class="flat-btn ghost" type="button" disabled>ордер ждёт подтверждения</button>'
          : '<button class="flat-btn" type="button" data-reward="' + id + '"' + (affordable ? '' : ' disabled') + '>' +
            (affordable ? 'запросить ордер' : 'не хватает ' + (r.coins - t.coins) + ' ◈') + '</button>') +
        '</div>';
    }).join('') + '</div>';
  }

  function myClaimsList() {
    var mine = E[cfg.methods.my](profile.id).slice().sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
    if (!mine.length) return '<p class="admin-hint">ордеров пока нет — выберите награду в каталоге выше.</p>';
    var titles = E[cfg.rewards];
    return '<ul class="rw-claims">' + mine.map(function (c) {
      var r = titles[c.rewardId] || { title: c.rewardId, coins: 0 };
      var label = c.status === 'approved' ? 'выдано преподавателем ✓'
        : c.status === 'rejected' ? 'отклонён — монеты можно вернуть'
        : c.status === 'refunded' ? 'монеты возвращены'
        : c.status === 'cancelled' ? 'отменён — монеты возвращены'
        : 'ждёт подтверждения преподавателя';
      var action = (c.status === 'rejected')
        ? ' <button class="flat-btn ghost" type="button" data-refund="' + esc(c.id) + '">вернуть ' + r.coins + ' ◈</button>'
        : (c.status === 'local')
        ? ' <button class="flat-btn ghost" type="button" data-cancel="' + esc(c.id) + '">передумать, вернуть ' + r.coins + ' ◈</button>'
        : '';
      return '<li><span class="mono">№' + esc(c.id.slice(-4)) + '</span>' +
        '<strong>' + esc(r.title) + '</strong>' +
        '<span class="rw-claim-status">' + label + '</span>' + action + '</li>';
    }).join('') + '</ul>';
  }


  /* ==========================================================================
     Перенос профиля между устройствами (волна 10): экспорт/импорт JSON.
     Ключи вселенной: league = stands-* + league-*; ops = ops-*; office = office-*.
     Файл подписан (app/v/universe), импорт чужой вселенной отклоняется.
     ========================================================================== */
  var IO_KEYS = {
    league: function (k) { return k === 'stands-profile' || k === 'stands-submissions' || (k.indexOf('league-') === 0 && k.indexOf('-admin') < 0); },
    ops: function (k) { return k.indexOf('ops-') === 0; },
    office: function (k) { return k.indexOf('office-') === 0; }
  };
  function collectProfile(uni) {
    var test = IO_KEYS[uni], out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (test(k)) out[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }
  function mountIO() {
    var box = $('rw-balance');
    if (!box || box.getAttribute('data-io') === '1') return;
    var uni = document.body.getAttribute('data-rewards');
    if (!IO_KEYS[uni]) return;
    box.setAttribute('data-io', '1');
    box.insertAdjacentHTML('beforeend',
      '<div class="rw-io"><span class="rw-io-label">перенос профиля</span>' +
      '<button type="button" class="rw-io-btn" data-io-act="export">экспорт .json</button>' +
      '<button type="button" class="rw-io-btn" data-io-act="import">импорт</button>' +
      '<input type="file" accept="application/json,.json" class="rw-io-file" hidden aria-hidden="true" tabindex="-1">' +
      '<span class="rw-io-msg" role="status" aria-live="polite"></span></div>');
    var file = box.querySelector('.rw-io-file');
    var msg = box.querySelector('.rw-io-msg');
    function say(t) { if (msg) msg.textContent = t; }
    box.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-io-act');
      if (act === 'export') {
        var data = collectProfile(uni), n = 0;
        for (var k in data) { if (Object.prototype.hasOwnProperty.call(data, k)) n++; }
        if (!n) { say('профиль пуст — нечего выгружать'); return; }
        var blob = new Blob([JSON.stringify({ app: 'itsliventsev', v: 1, universe: uni, exportedAt: new Date().toISOString(), data: data }, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'itsliventsev-' + uni + '-profile.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 500);
        say('выгружено ключей: ' + n);
      } else if (act === 'import') {
        file.click();
      }
    });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var parsed = JSON.parse(String(fr.result));
          if (!parsed || parsed.app !== 'itsliventsev' || parsed.v !== 1 || !parsed.data) throw new Error('bad');
          if (parsed.universe !== uni) { say('файл из другой вселенной: ' + parsed.universe); return; }
          var n = 0;
          for (var k in parsed.data) {
            if (Object.prototype.hasOwnProperty.call(parsed.data, k) && IO_KEYS[uni](k)) {
              try { localStorage.setItem(k, parsed.data[k]); n++; } catch (e) {}
            }
          }
          say('профиль восстановлен, ключей: ' + n + ' · обновляю…');
          setTimeout(function () { location.reload(); }, 900);
        } catch (err) { say('не похоже на файл профиля itsliventsev'); }
      };
      fr.readAsText(f);
      file.value = '';
    });
  }
  function render() {
    if (!$('rw-body')) return;
    if (!profile) { gate(true); return; }
    gate(false);
    $('rw-balance').innerHTML = balanceCard();
    $('rw-catalog').innerHTML = catalog();
    $('rw-my-claims').innerHTML = myClaimsList();
    mountIO();
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var get = function (name) { return e.target.getAttribute && e.target.getAttribute(name); };
      var rewardId = get('data-reward');
      if (rewardId && profile) {
        try {
          var claim = E[cfg.methods.create](profile.id, rewardId);
          render();
          say('Ордер №' + claim.id.slice(-4) + cfg.labels.created, 'ok');
        } catch (err) { say(err.message, 'bad'); }
        return;
      }
      var refundId = get('data-refund');
      if (refundId && profile) {
        try { E[cfg.methods.refund](refundId); render(); say('Монеты возвращены на счёт.', 'ok'); }
        catch (err) { say(err.message, 'bad'); }
        return;
      }
      var cancelId = get('data-cancel');
      if (cancelId && profile) {
        try { E[cfg.methods.cancel](cancelId); render(); say('Ордер отменён, монеты вернулись на счёт.', 'ok'); }
        catch (err) { say(err.message, 'bad'); }
      }
    });
  }

  function init() {
    if (typeof document === 'undefined' || !document.body || !$('rw-body')) return;
    cfg = UNIVERSES[document.body.getAttribute('data-rewards')];
    if (!cfg) return;
    E = cfg.engine();
    if (!E) return;
    profile = E.getProfile();
    if (!profile || !profile.name) { gate(true); return; }
    render();
    bind();
    if (window.STANDINGS) STANDINGS.autoInit(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
