/* ==========================================================================
   OFFICE ENGINE · учебная вселенная «ОфисПолис»
   Практическая часть УП.02 (часть 2): профессия «Оператор электронно-
   вычислительных и вычислительных машин». Самостоятельный модуль, НЕ
   пересекается с лигой СетьПолиса (ключи stands-, league-, labkit-) и
   сервисным центром ДатаПолиса (ключи ops-, opskit-): все ключи localStorage
   с префиксом office-. Документы, таблицы, сканы, презентации, базы,
   мониторинг и веб — XP и неткоины в той же терминологии, но с отдельным
   балансом.
   UMD: браузер и Node.
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.OFFICE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEYS = {
    profile: 'office-profile',
    ledger: 'office-ledger',
    submissions: 'office-submissions',
    presence: 'office-presence',
    claims: 'office-claims'
  };

  var memory = {};
  var storage = (typeof localStorage !== 'undefined') ? localStorage : {
    getItem: function (k) { return k in memory ? memory[k] : null; },
    setItem: function (k, v) { memory[k] = String(v); },
    removeItem: function (k) { delete memory[k]; }
  };
  function read(k, fallback) {
    try { var v = JSON.parse(storage.getItem(k)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function write(k, v) { storage.setItem(k, JSON.stringify(v)); }
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function hash(s) {
    var h = 0; s = String(s);
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function nowISO() { return new Date().toISOString(); }

  /* Демо-записи разработки в боевой вселенной не принимаем */
  function isDemoRecord(x) {
    if (!x || typeof x !== 'object') return false;
    if (x.demo === true) return true;
    var ids = [x.id, x.student && x.student.id, x.author && x.author.id].filter(Boolean);
    return ids.some(function (v) { return /^demo(-|_)/i.test(String(v)); });
  }

  /* Карьерная лестница бюро: от стажёра до наставника */
  var LEVELS = [
    { level: 1, title: 'Стажёр бюро', need: 0 },
    { level: 2, title: 'Младший оператор ЭВМ', need: 120 },
    { level: 3, title: 'Оператор ЭВМ', need: 300 },
    { level: 4, title: 'Старший оператор ЭВМ', need: 600 },
    { level: 5, title: 'Специалист по документации', need: 1000 },
    { level: 6, title: 'Ведущий специалист бюро', need: 1500 },
    { level: 7, title: 'Наставник бюро', need: 2200 }
  ];
  function levelOf(xp) {
    var cur = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) { if (xp >= LEVELS[i].need) cur = LEVELS[i]; }
    var next = LEVELS[cur.level] || null;
    var span = next ? next.need - LEVELS[cur.level - 1].need : 0;
    var into = next ? xp - LEVELS[cur.level - 1].need : 0;
    return { level: cur.level, title: cur.title, next: next ? next.title : null,
      progress: next ? Math.min(100, Math.round(into / span * 100)) : 100, span: span, into: into };
  }

  var AWARDS = {
    login: { xp: 10, coins: 2, note: 'начало рабочего дня' },
    submit: { xp: 40, coins: 8, note: 'сдача практической работы' },
    standReady: { xp: 50, coins: 10, note: 'работа сдана по DoD' },
    quizPerfect: { xp: 20, coins: 4, note: 'тест без ошибок' }
  };

  /* ----------------------------- Профиль ----------------------------- */
  var MASCOT_POOL = ['fox', 'hedgehog', 'otter', 'owl', 'raccoon', 'cat', 'crab', 'wolf'];
  function getProfile() { return read(KEYS.profile, null); }
  function ensureProfile(name, group, mascotId) {
    var p = getProfile();
    if (p && p.name && p.group) return p;
    var id = uid('opr');
    p = {
      id: id, name: name, group: group,
      createdAt: nowISO(), savedAt: nowISO(),
      mascotId: mascotId || MASCOT_POOL[hash(group || name || id) % MASCOT_POOL.length],
      handleNum: (hash(id) % 99) + 1
    };
    write(KEYS.profile, p);
    return p;
  }
  function updateProfile(patch) {
    var p = getProfile() || {};
    Object.assign(p, patch, { savedAt: nowISO() });
    write(KEYS.profile, p); return p;
  }
  function setMascot(id) { var p = getProfile(); if (p) { p.mascotId = id; write(KEYS.profile, p); } return p; }
  function handleFor(p) {
    var names = { raccoon: 'енот', fox: 'лис', crab: 'краб', owl: 'сова', cat: 'кот', wolf: 'волк', otter: 'выдра', hedgehog: 'ёжик' };
    return { text: (names[(p && p.mascotId) || 'fox'] || 'оператор') + ' #' + ((p && p.handleNum) || 1) };
  }
  function publicStudent(p) {
    return { id: p.id, name: p.name, group: p.group, mascotId: p.mascotId, handle: handleFor(p).text };
  }

  /* ----------------------------- Журнал, XP, неткоины ----------------------------- */
  function ledger() { return read(KEYS.ledger, []); }
  function award(profileId, type, dedupKey, extra) {
    /* Произвольные coins в extra (траты/возвраты биржи) переопределяют каталог */
    var spec = (extra && typeof extra.coins === 'number')
      ? { xp: extra.xp || 0, coins: extra.coins, note: extra.note || 'начисление' }
      : AWARDS[type];
    if (!spec) throw new Error('неизвестная награда ' + type);
    var log = ledger();
    if (dedupKey && log.some(function (e) { return e.profileId === profileId && e.dedupKey === dedupKey; })) {
      return { duplicated: true };
    }
    var event = Object.assign({
      id: uid('xp'), profileId: profileId, at: nowISO(),
      type: type, xp: spec.xp, coins: spec.coins, note: spec.note, dedupKey: dedupKey || null
    }, extra || {});
    log.push(event); write(KEYS.ledger, log); return { duplicated: false, event: event };
  }
  function totals(profileId) {
    var xp = 0, coins = 0;
    ledger().forEach(function (e) { if (e.profileId === profileId) { xp += e.xp || 0; coins += e.coins || 0; } });
    return { xp: xp, coins: coins, level: levelOf(xp) };
  }
  var _lastLogin = {};
  function dailyLogin(profileId) {
    var day = new Date().toISOString().slice(0, 10);
    if (_lastLogin[profileId] === day) return { duplicated: true };
    var log = ledger();
    if (log.some(function (e) { return e.profileId === profileId && e.type === 'login' && String(e.at).slice(0, 10) === day; })) {
      _lastLogin[profileId] = day; return { duplicated: true };
    }
    _lastLogin[profileId] = day;
    return award(profileId, 'login', 'login:' + day);
  }

  /* ----------------------------- Сабмишены практических работ ----------------------------- */
  function submissions() { return read(KEYS.submissions, []).filter(function (s) { return !isDemoRecord(s); }); }
  function addSubmission(s) {
    if (isDemoRecord(s)) return submissions();
    var list = read(KEYS.submissions, []);
    if (list.some(function (x) { return x.id === s.id; })) return list;
    list.push(s); write(KEYS.submissions, list); return list;
  }
  function bestSubmission(profileId, labId) {
    var best = null;
    submissions().forEach(function (s) {
      if (s.student.id === profileId && s.standId === labId && (!best || (s.result.score || 0) > (best.result.score || 0))) best = s;
    });
    return best;
  }

  /* ----------------------------- Присутствие (presence) ----------------------------- */
  function presence() { return read(KEYS.presence, {}); }
  function heartbeat(profile, labId) {
    var map = presence();
    map[profile.id] = {
      id: profile.id, name: profile.name, group: profile.group,
      mascotId: profile.mascotId || 'fox', handle: handleFor(profile).text,
      labId: labId || null, lastSeen: nowISO()
    };
    var cutoff = Date.now() - 7 * 864e5;
    Object.keys(map).forEach(function (id) { if (new Date(map[id].lastSeen).getTime() < cutoff) delete map[id]; });
    write(KEYS.presence, map); return map;
  }
  function listPresence(onlineWindowMs) {
    var now = Date.now(), win = onlineWindowMs || 45000;
    return Object.keys(presence()).map(function (id) {
      var p = presence()[id];
      return Object.assign({}, p, { online: now - new Date(p.lastSeen).getTime() <= win });
    }).filter(function (p) { return !isDemoRecord(p); })
      .sort(function (a, b) { return new Date(b.lastSeen) - new Date(a.lastSeen); });
  }

  /* ----------------------------- Бандлы и сброс ----------------------------- */
  /* ----------------------------- Биржа привилегий ОфисПолиса -----------------------------
     Неткоины бюро тратятся на реальную поддержку документооборота.
     «Журнальные» награды (точка, пересдача, балл) — по единой политике цен
     со СетьПолисом и ДатаПолисом. Ордера едут преподавателю в office-бандле.
     API ордеров сознательно совпадает с лигой: createClaim/cancelClaim/
     refundClaim/setClaimStatus — одна логика на все вселенные. */
  var REWARDS_OFFICE = {
    'template-kit': { coins: 20,  title: 'Шаблон-помощник',        note: 'готовая заготовка документа или таблицы на контрольной' },
    'mentor-hint':  { coins: 25,  title: 'Подсказка наставника',   note: 'наводящая подсказка по работе до сдачи' },
    'deadline-plus':{ coins: 30,  title: '+1 день на работу спринта', note: 'перенос личного срока по работе спринта' },
    'point-wipe':   { coins: 40,  title: 'Не ставить точку',       note: 'аннулирование одного замечания в журнале' },
    'fast-review':  { coins: 45,  title: 'Проверка вне очереди',   note: 'экспресс-проверка работы без ожидания потока' },
    'rescue':       { coins: 60,  title: 'Спасательная круглая',   note: 'пересдача двойки без журнальной записи' },
    'grade-plus':   { coins: 150, title: '+1 балл к четвертной',   note: 'прибавка один балл к оценке за период' }
  };
  function claims() { return read(KEYS.claims, []); }
  function myClaims(profileId) {
    return claims().filter(function (c) { return c.profileId === profileId; });
  }
  function createClaim(profileId, rewardId) {
    var reward = REWARDS_OFFICE[rewardId];
    if (!reward) throw new Error('неизвестная награда: ' + rewardId);
    var profile = getProfile();
    if (myClaims(profileId).some(function (c) { return c.rewardId === rewardId && c.status === 'local'; })) {
      throw new Error('ордер на «' + reward.title + '» уже ждёт подтверждения');
    }
    var balance = totals(profileId).coins;
    if (balance < reward.coins) {
      throw new Error('не хватает неткоинов: нужно ' + reward.coins + ' ◈, на счету ' + balance + ' ◈');
    }
    var claim = {
      id: uid('fcl'), profileId: profileId, rewardId: rewardId,
      handle: handleFor(profile).text, status: 'local',
      at: nowISO()
    };
    write(KEYS.claims, claims().concat([claim]));
    award(profileId, 'rewardSpend', null, {
      xp: 0, coins: -reward.coins,
      note: 'ордер №' + claim.id.slice(-4) + ': ' + reward.title
    });
    return claim;
  }
  /* Отмена до решения преподавателя: «передумал» — монеты возвращаются. */
  function cancelClaim(claimId) {
    var list = claims();
    var claim = null;
    list.forEach(function (c) { if (c.id === claimId) claim = c; });
    if (!claim) throw new Error('ордер не найден');
    if (claim.status !== 'local') throw new Error('отменить можно только ордер, который ещё ждёт подтверждения');
    var reward = REWARDS_OFFICE[claim.rewardId];
    claim.status = 'cancelled';
    write(KEYS.claims, list);
    award(claim.profileId, 'rewardRefund', null, {
      xp: 0, coins: reward ? reward.coins : 0,
      note: 'отмена ордера №' + claim.id.slice(-4)
    });
    return { refunded: true };
  }
  /* Возврат монет после отклонения преподавателем. */
  function refundClaim(claimId) {
    var list = claims();
    var claim = null;
    list.forEach(function (c) { if (c.id === claimId) claim = c; });
    if (!claim) throw new Error('ордер не найден');
    if (claim.status === 'refunded') return { duplicated: true };
    if (claim.status !== 'rejected') throw new Error('вернуть монеты можно только по отклонённому ордеру');
    var reward = REWARDS_OFFICE[claim.rewardId];
    claim.status = 'refunded';
    write(KEYS.claims, list);
    award(claim.profileId, 'rewardRefund', null, {
      xp: 0, coins: reward ? reward.coins : 0,
      note: 'возврат по ордеру №' + claim.id.slice(-4)
    });
    return { refunded: true };
  }
  function setClaimStatus(claimId, status) {
    var list = claims();
    var found = false;
    list.forEach(function (c) { if (c.id === claimId) { c.status = status; c.decidedAt = nowISO(); found = true; } });
    if (found) write(KEYS.claims, list);
    return found;
  }

  function exportBundle(profile) {
    return {
      schema: 'office-bundle/2', exportedAt: nowISO(), student: publicStudent(profile),
      profile: getProfile(), ledger: ledger(), submissions: submissions(),
      claims: claims()
    };
  }
  /* Перенос прогресса ОфисПолиса: слияние по id, события дедупятся
     по (profileId, dedupKey) и дню входа; при переносе тем же человеком
     (ФИО совпало, id другой) события и ордера перепривязываются. */
  function importBundle(bundle) {
    if (!bundle || !/^office-bundle\/[12]$/.test(bundle.schema)) {
      throw new Error('ожидался office-bundle/1 или /2');
    }
    var report = { ledger: 0, submissions: 0, claims: 0 };
    var me = getProfile();
    var migrating = !!(me && bundle.profile && bundle.profile.name === me.name && bundle.profile.id !== me.id);

    var log = ledger();
    (bundle.ledger || []).forEach(function (e) {
      if (!e || !e.id || isDemoRecord(e)) return;
      var ev = Object.assign({}, e);
      if (migrating) ev.profileId = me.id;
      var dup = log.some(function (x) {
        return x.id === ev.id ||
          (ev.dedupKey && x.profileId === ev.profileId && x.dedupKey === ev.dedupKey) ||
          (ev.type === 'login' && x.type === 'login' && ev.at && x.at && ev.at.slice(0, 10) === x.at.slice(0, 10) && x.profileId === ev.profileId);
      });
      if (!dup) { log.push(ev); report.ledger++; }
    });
    write(KEYS.ledger, log);

    var subs = submissions();
    var added = 0;
    (bundle.submissions || []).forEach(function (item) {
      if (!item || !item.id || isDemoRecord(item)) return;
      if (!subs.some(function (x) { return x.id === item.id; })) { subs.push(item); added++; }
    });
    if (added) write(KEYS.submissions, subs);
    report.submissions = added;

    (bundle.claims || []).forEach(function (c) {
      if (!c || !c.id || !c.rewardId) return;
      var cl = Object.assign({}, c);
      if (migrating) cl.profileId = me.id;
      var list = claims();
      var known = null;
      list.forEach(function (x) { if (x.id === cl.id) known = x; });
      if (!known) { list.push(cl); report.claims++; }
      else if ((cl.decidedAt || '') > (known.decidedAt || '') && known.status === 'local') {
        known.status = cl.status; known.decidedAt = cl.decidedAt || known.decidedAt;
      }
      write(KEYS.claims, list);
    });
    return report;
  }
  function resetAll() {
    Object.keys(KEYS).forEach(function (k) { storage.removeItem(KEYS[k]); });
  }

  return {
    KEYS: KEYS, LEVELS: LEVELS, AWARDS: AWARDS, REWARDS_OFFICE: REWARDS_OFFICE,
    levelOf: levelOf, handleFor: handleFor,
    getProfile: getProfile, ensureProfile: ensureProfile, updateProfile: updateProfile,
    setMascot: setMascot, publicStudent: publicStudent,
    ledger: ledger, award: award, totals: totals, dailyLogin: dailyLogin,
    submissions: submissions, addSubmission: addSubmission, bestSubmission: bestSubmission,
    heartbeat: heartbeat, listPresence: listPresence,
    exportBundle: exportBundle, resetAll: resetAll, isDemoRecord: isDemoRecord,
    claims: claims, myClaims: myClaims,
    createClaim: createClaim, cancelClaim: cancelClaim,
    refundClaim: refundClaim, setClaimStatus: setClaimStatus,
    importBundle: importBundle
  };
});
