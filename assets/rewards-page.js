/* ==========================================================================
   Страница «Биржа привилегий» (stands/rewards.html)
   Каталог наград за неткоины, баланс, ордера студента и публичный список
   решений преподавателя (из standings/standings.json через standings.js).
   Всё локально: монеты и ордера живут в лиге (league.js), публикация —
   в админке преподавателя. zero-deps, esc через dom-kit.
   ========================================================================== */
(function () {
  'use strict';

  var $ = window.DOMKIT.$;        // общий хелпер: dom-kit.js
  var esc = window.DOMKIT.esc;    // единое экранирование: dom-kit.js
  var setMsg = window.DOMKIT.setMsg; // статус-строка: dom-kit.js
  function say(text, state) { setMsg($('rw-msg'), text, state); }
  function L() { return window.LEAGUE || null; }

  var profile = null;

  function mascotSvg(id, size) { return window.MASCOTS ? window.MASCOTS.svg(id || 'fox', { size: size || 44, floating: false }) : ''; }

  function gate(show) {
    var g = $('rw-gate'), body = $('rw-body');
    if (g) g.hidden = !show;
    if (body) body.hidden = show;
  }

  function balanceCard() {
    var t = L().totals(profile.id);
    var lvl = t.level;
    var handle = L().handleFor(profile).text;
    return '<div class="rw-balance">' +
      mascotSvg(profile.mascotId, 52) +
      '<div class="rw-balance-main"><strong>' + esc(handle) + '</strong>' +
      '<span class="mono">' + esc(lvl.title) + ' · уровень ' + lvl.level + '</span></div>' +
      '<div class="rw-balance-coins"><b>' + t.coins + ' ◈</b><span>на счету</span></div>' +
      '<div class="rw-balance-xp"><b>' + t.xp + '</b><span>XP</span></div>' +
      '</div>' +
      '<p class="admin-hint">Неткоины приходят за сдачи работ, автотесты, тесты без ошибок и взаимные проверки. ' +
      'Полный журнал — на <a href="league.html" rel="nofollow">странице лиги</a>.</p>';
  }

  function catalog() {
    var rewards = L().REWARDS;
    var t = L().totals(profile.id);
    var mine = L().myClaims(profile.id);
    var order = ['point-wipe', 'rescue', 'grade-plus', 'board-pass', 'deadline', 'hint', 'topic-first'];
    return '<div class="rw-grid">' + order.map(function (id) {
      var r = rewards[id];
      if (!r) return '';
      var pending = mine.some(function (c) { return c.rewardId === id && c.status === 'local'; });
      var affordable = t.coins >= r.coins;
      var cls = 'rw-card' + (affordable ? '' : ' is-locked');
      return '<div class="' + cls + '">' +
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
    var mine = L().myClaims(profile.id).slice().sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
    if (!mine.length) return '<p class="admin-hint">ордеров пока нет — выберите награду в каталоге выше.</p>';
    var titles = L().REWARDS;
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

  function render() {
    if (!$('rw-body')) return;
    if (!profile) { gate(true); return; }
    gate(false);
    $('rw-balance').innerHTML = balanceCard();
    $('rw-catalog').innerHTML = catalog();
    $('rw-my-claims').innerHTML = myClaimsList();
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var rewardId = e.target.getAttribute && e.target.getAttribute('data-reward');
      if (rewardId && profile) {
        try {
          var claim = L().createClaim(profile.id, rewardId);
          render();
          say('Ордер №' + claim.id.slice(-4) + ' создан: он уйдёт преподавателю в бандле лиги (страница лиги → обмен бандлами), решение появится здесь и в общем списке ниже.', 'ok');
        } catch (err) { say(err.message, 'bad'); }
        return;
      }
      var refundId = e.target.getAttribute && e.target.getAttribute('data-refund');
      if (refundId && profile) {
        try { L().refundClaim(refundId); render(); say('Монеты возвращены на счёт.', 'ok'); }
        catch (err) { say(err.message, 'bad'); }
        return;
      }
      var cancelId = e.target.getAttribute && e.target.getAttribute('data-cancel');
      if (cancelId && profile) {
        try { L().cancelClaim(cancelId); render(); say('Ордер отменён, монеты вернулись на счёт.', 'ok'); }
        catch (err) { say(err.message, 'bad'); }
      }
    });
  }

  function init() {
    if (!$('rw-body')) return;
    profile = L() ? L().getProfile() : null;
    if (!profile || !profile.name) { gate(true); return; }
    render();
    bind();
    /* Публичные решения преподавателя — после загрузки стенда */
    if (window.STANDINGS) {
      STANDINGS.autoInit(true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
