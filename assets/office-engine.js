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
    presence: 'office-presence'
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
    var spec = AWARDS[type];
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
  function exportBundle(profile) {
    return {
      schema: 'office-bundle/1', exportedAt: nowISO(), student: publicStudent(profile),
      profile: getProfile(), ledger: ledger(), submissions: submissions()
    };
  }
  function resetAll() {
    Object.keys(KEYS).forEach(function (k) { storage.removeItem(KEYS[k]); });
  }

  return {
    KEYS: KEYS, LEVELS: LEVELS, AWARDS: AWARDS,
    levelOf: levelOf, handleFor: handleFor,
    getProfile: getProfile, ensureProfile: ensureProfile, updateProfile: updateProfile,
    setMascot: setMascot, publicStudent: publicStudent,
    ledger: ledger, award: award, totals: totals, dailyLogin: dailyLogin,
    submissions: submissions, addSubmission: addSubmission, bestSubmission: bestSubmission,
    heartbeat: heartbeat, listPresence: listPresence,
    exportBundle: exportBundle, resetAll: resetAll, isDemoRecord: isDemoRecord
  };
});
