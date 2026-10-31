/* ==========================================================================
   Страница «Биржа привилегий ДатаПолиса» (stands/ops/rewards.html)
   Каталог наград за неткоины эксплуатации, баланс инженера, ордера
   студента и публичный список решений преподавателя (snap.datapolis).
   Зеркало биржи СетьПолиса: тот же контракт ордеров (create/cancel/
   refund), каталог — ops-специфичный (REWARDS_OPS в ops-engine.js).
   ========================================================================== */
(function () {
  'use strict';

  var $ = window.DOMKIT.$;
  var esc = window.DOMKIT.esc;
  var setMsg = window.DOMKIT.setMsg;
  function O() { return (window.OPS && OPS.REWARDS_OPS) ? OPS : null; }
  function say(text, state) { setMsg($('orw-msg'), text, state); }
  function mascotSvg(id, size) { return window.MASCOTS ? window.MASCOTS.svg(id || 'wolf', { size: size || 44, floating: false }) : ''; }

  var profile = null;

  function gate(show) {
    var g = $('orw-gate'), body = $('orw-body');
    if (g) g.hidden = !show;
    if (body) body.hidden = show;
  }

  function balanceCard() {
    var t = O().totals(profile.id);
    var lvl = t.level;
    var handle = O().handleFor(profile).text;
    return '<div class="rw-balance">' +
      mascotSvg(profile.mascotId, 52) +
      '<div class="rw-balance-main"><strong>' + esc(handle) + '</strong>' +
      '<span class="mono">' + esc(lvl.title) + ' · уровень ' + lvl.level + '</span></div>' +
      '<div class="rw-balance-coins"><b>' + t.coins + ' ◈</b><span>на счету</span></div>' +
      '<div class="rw-balance-xp"><b>' + t.xp + '</b><span>XP</span></div>' +
      '</div>' +
      '<p class="admin-hint">Неткоины эксплуатации приходят за закрытые заявки, устранённые инциденты, выдержанный SLA, ' +
      'runbook и командные операции экипажа. Полный журнал — в <a href="index.html">консоли ДатаПолиса</a>.</p>';
  }

  function catalog() {
    var rewards = O().REWARDS_OPS;
    var t = O().totals(profile.id);
    var mine = O().myOpsClaims(profile.id);
    var order = ['ticket-pick', 'mentor-hint', 'deadline-plus', 'point-wipe', 'standby-skip', 'rescue', 'grade-plus'];
    return '<div class="rw-grid">' + order.map(function (id) {
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
    var mine = O().myOpsClaims(profile.id).slice().sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
    if (!mine.length) return '<p class="admin-hint">ордеров пока нет — выберите награду в каталоге выше.</p>';
    var titles = O().REWARDS_OPS;
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
    if (!$('orw-body')) return;
    if (!profile) { gate(true); return; }
    gate(false);
    $('orw-balance').innerHTML = balanceCard();
    $('orw-catalog').innerHTML = catalog();
    $('orw-my-claims').innerHTML = myClaimsList();
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var get = function (name) { return e.target.getAttribute && e.target.getAttribute(name); };
      var rewardId = get('data-reward');
      if (rewardId && profile) {
        try {
          var claim = O().createOpsClaim(profile.id, rewardId);
          render();
          say('Ордер №' + claim.id.slice(-4) + ' создан: он уедет преподавателю в ops-бандле, решение появится здесь и в общем списке ниже.', 'ok');
        } catch (err) { say(err.message, 'bad'); }
        return;
      }
      var refundId = get('data-refund');
      if (refundId && profile) {
        try { O().refundOpsClaim(refundId); render(); say('Монеты возвращены на счёт.', 'ok'); }
        catch (err) { say(err.message, 'bad'); }
        return;
      }
      var cancelId = get('data-cancel');
      if (cancelId && profile) {
        try { O().cancelOpsClaim(cancelId); render(); say('Ордер отменён, монеты вернулись на счёт.', 'ok'); }
        catch (err) { say(err.message, 'bad'); }
      }
    });
  }

  function init() {
    if (!$('orw-body')) return;
    profile = O() ? O().getProfile() : null;
    if (!profile || !profile.name) { gate(true); return; }
    render();
    bind();
    if (window.STANDINGS) STANDINGS.autoInit(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
