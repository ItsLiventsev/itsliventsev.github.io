/* ==========================================================================
   LEAGUE · учебная геймификация и пиринговое обучение (без сервера)
   Всё состояние — localStorage одного браузера; обмен между устройствами —
   JSON-бандлы и коды работ. Профили, XP/уровни/валюта, трайбы, взаимные
   оценки «равный равному», экспертные оценки, рейтинг проверяющих
   (справедливость, доброжелательность, заинтересованность, пунктуальность),
   presence-сердцебиения, демо-однокурсники. UMD: браузер и Node (тесты).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory((function () { try { return require('./fgos-skills.js'); } catch (e) { return null; } })());
  } else root.LEAGUE = factory(root.FGOS);
})(typeof self !== 'undefined' ? self : this, function (FGOS) {
  'use strict';

  var KEYS = {
    profile: 'stands-profile',
    submissions: 'stands-submissions',
    ledger: 'league-ledger',
    reviews: 'league-reviews',
    presence: 'league-presence',
    demo: 'league-demo-version'
  };
  var DEMO_VERSION = '3';

  /* В браузере используем localStorage, в Node — память (юнит-тесты) */
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
    var h = 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  /* ----------------------------- Уровни и награды ----------------------------- */
  var LEVELS = [
    { level: 1, title: 'Стажёр', need: 0 },
    { level: 2, title: 'Младший администратор', need: 120 },
    { level: 3, title: 'Администратор сети', need: 300 },
    { level: 4, title: 'Старший администратор', need: 600 },
    { level: 5, title: 'Инженер сетевых сервисов', need: 1000 },
    { level: 6, title: 'Ведущий инженер', need: 1500 },
    { level: 7, title: 'Сетевой архитектор', need: 2200 }
  ];

  var AWARDS = {
    login:        { xp: 10, coins: 2,  note: 'ежедневный вход' },
    submit:       { xp: 40, coins: 8,  note: 'сдача лабораторной' },
    standReady:   { xp: 50, coins: 10, note: 'стенд пройден на 100%' },
    autotests:    { xp: 30, coins: 6,  note: 'все автотесты пройдены' },
    quizPerfect:  { xp: 20, coins: 4,  note: 'тест без ошибок' },
    review:       { xp: 15, coins: 3,  note: 'взаимная оценка равному' },
    expertReview: { xp: 25, coins: 5,  note: 'экспертная оценка преподавателя' }
  };

  function levelOf(xp) {
    var cur = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) { if (xp >= LEVELS[i].need) cur = LEVELS[i]; }
    var next = LEVELS[cur.level] || null;
    return {
      level: cur.level, title: cur.title,
      next: next ? next.title : null,
      progress: next ? Math.round(((xp - cur.need) / (next.need - cur.need)) * 100) : 100,
      into: next ? xp - cur.need : 0,
      span: next ? next.need - cur.need : 0
    };
  }

  /* ----------------------------- Трайбы и турниры ----------------------------- */
  var TRIBES = [
    { id: 'tribe-packet', name: 'Трайб «Пакет»', glyph: 'PKT', color: '#5b9dff' },
    { id: 'tribe-frame', name: 'Трайб «Кадр»', glyph: 'FRM', color: '#34d399' },
    { id: 'tribe-route', name: 'Трайб «Маршрут»', glyph: 'RTE', color: '#fbbf24' },
    { id: 'tribe-socket', name: 'Трайб «Сокет»', glyph: 'SKT', color: '#f87171' }
  ];
  function tribeFor(group) { return TRIBES[hash(group || 'ИС-21') % TRIBES.length]; }

  var HACKATHONS = [
    { id: 'hack-1', title: 'Хакатон «Первая сеть»', status: 'done', date: '2026-09-18', task: 'Базовая настройка DHCP и VLAN' },
    { id: 'hack-2', title: 'Хакатон «Отказоустойчивость»', status: 'active', date: '2026-11-12', task: 'Диагностика и послеаварийное восстановление сервисов' },
    { id: 'hack-3', title: 'Хакатон «Сетевой архитектор»', status: 'future', date: '2026-12-16', task: 'Проектирование топологии филиала по ФГОС ПК 5.3' }
  ];

  /* ----------------------------- Профиль и журнал ----------------------------- */
  function getProfile() { return read(KEYS.profile, null); }
  function ensureProfile(name, group) {
    var p = getProfile();
    if (p && p.name && p.group) return p;
    p = { id: uid('stu'), name: name, group: group, createdAt: new Date().toISOString(), savedAt: new Date().toISOString() };
    p.tribeId = tribeFor(group).id;
    write(KEYS.profile, p);
    return p;
  }
  function updateProfile(patch) {
    var p = getProfile() || {};
    Object.assign(p, patch, { savedAt: new Date().toISOString() });
    if (patch.group) p.tribeId = tribeFor(patch.group).id;
    write(KEYS.profile, p);
    return p;
  }

  function ledger() { return read(KEYS.ledger, []); }
  function totals(profileId) {
    var xp = 0, coins = 0;
    ledger().forEach(function (e) {
      if (e.profileId === profileId) { xp += e.xp || 0; coins += e.coins || 0; }
    });
    return { xp: xp, coins: coins, level: levelOf(xp) };
  }
  function award(profileId, type, dedupKey, extra) {
    var spec = AWARDS[type];
    if (!spec) throw new Error('неизвестная награда ' + type);
    var log = ledger();
    if (dedupKey && log.some(function (e) { return e.profileId === profileId && e.dedupKey === dedupKey; })) {
      return { duplicated: true };
    }
    var event = Object.assign({
      id: uid('xp'), profileId: profileId, at: new Date().toISOString(),
      type: type, xp: spec.xp, coins: spec.coins, note: spec.note, dedupKey: dedupKey || null
    }, extra || {});
    log.push(event);
    write(KEYS.ledger, log);
    return { duplicated: false, event: event };
  }
  function dailyLogin(profileId) {
    var day = new Date().toISOString().slice(0, 10);
    return award(profileId, 'login', 'login:' + day);
  }

  /* ----------------------------- Работы студентов ----------------------------- */
  function submissions() { return read(KEYS.submissions, []); }
  function addSubmission(s) {
    var list = submissions();
    if (list.some(function (x) { return x.id === s.id; })) return list;
    list.push(s);
    write(KEYS.submissions, list);
    return list;
  }
  function bestSubmission(profileId, standId) {
    var best = null;
    submissions().forEach(function (s) {
      if (s.student.id === profileId && s.standId === standId && (!best || (s.result.score || 0) > (best.result.score || 0))) best = s;
    });
    return best;
  }

  /* Компактный код работы для пересылки в чате/почте (без файлов) */
  function b64encodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64decodeUnicode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return decodeURIComponent(escape(atob(str)));
  }
  function encodeSubmission(s) { return 'ITS-LAB1.' + b64encodeUnicode(JSON.stringify(s)); }
  function decodeSubmission(code) {
    code = String(code).trim();
    if (code.indexOf('ITS-LAB1.') !== 0) throw new Error('код работы должен начинаться с ITS-LAB1.');
    var obj = JSON.parse(b64decodeUnicode(code.slice(9)));
    if (!obj || obj.schema !== 'stands-submission/2' || !obj.student || !obj.standId || !obj.submittedAt) {
      throw new Error('структура кода не соответствует контракту stands-submission/2');
    }
    return obj;
  }

  /* ----------------------------- Взаимные оценки ----------------------------- */
  function reviews() { return read(KEYS.reviews, []); }
  function addReview(r) {
    var list = reviews();
    r.id = r.id || uid('rev');
    r.createdAt = r.createdAt || new Date().toISOString();
    list.push(r);
    write(KEYS.reviews, list);
    return r;
  }
  function reviewsFor(submissionId) {
    return reviews().filter(function (r) { return r.submissionId === submissionId; });
  }
  function reviewsBy(profileId) {
    return reviews().filter(function (r) { return r.reviewer.id === profileId; });
  }

  var RUDE = /дурак|туп|плох|ужас|ненавиж|отстой|fail|дно|бездар/i;
  var KIND = /молод|хорош|отлич|супер|спасибо|понрав|аккурат|верно|успеш|рекоменд|пожалуйста/i;

  /* Рейтинг проверяющего: 4 качества по методике «равный равному» */
  function reviewerRating(profileId) {
    var mine = reviewsBy(profileId);
    if (!mine.length) return null;
    var fair = [], kindness = [], engagement = [], punctuality = [];
    mine.forEach(function (r) {
      var sub = submissions().filter(function (s) { return s.id === r.submissionId; })[0];
      var peerAvg = (r.scores.config + r.scores.completeness + r.scores.journal + r.scores.communication) / 4;
      if (sub && sub.result && typeof sub.result.score === 'number') {
        var ciScore = (sub.result.score / 100) * 5;            // CI-истина в шкале 1..5
        fair.push(Math.max(0, 100 - Math.abs(peerAvg - ciScore) * 25));
      }
      var comment = String(r.comment || '');
      var k = 70;
      if (KIND.test(comment)) k += 15;
      if (RUDE.test(comment)) k -= 40;
      if (comment.length > 120) k += 10;
      kindness.push(Math.max(0, Math.min(100, k)));
      var e = 40 + Math.min(40, comment.length / 4) + (Object.keys(r.scores).length === 4 ? 20 : 0);
      engagement.push(Math.min(100, e));
      if (sub) {
        var hours = (new Date(r.createdAt) - new Date(sub.submittedAt)) / 36e5;
        punctuality.push(hours < 1 ? 100 : hours < 6 ? 90 : hours < 24 ? 75 : hours < 72 ? 60 : 45);
      }
    });
    var avg = function (a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : 70; };
    var dims = {
      fairness: avg(fair),
      kindness: avg(kindness),
      engagement: avg(engagement),
      punctuality: avg(punctuality)
    };
    dims.overall = Math.round((dims.fairness + dims.kindness + dims.engagement + dims.punctuality) / 4);
    dims.count = mine.length;
    return dims;
  }

  function reviewerLeaderboard() {
    var ids = {};
    reviews().forEach(function (r) { ids[r.reviewer.id] = r.reviewer; });
    return Object.keys(ids).map(function (id) {
      var rating = reviewerRating(id);
      return { reviewer: ids[id], rating: rating };
    }).filter(function (x) { return x.rating; }).sort(function (a, b) { return b.rating.overall - a.rating.overall; });
  }

  /* ----------------------------- Presence (кто онлайн) ----------------------------- */
  function presence() { return read(KEYS.presence, {}); }
  function heartbeat(profile, standId) {
    var map = presence();
    map[profile.id] = {
      id: profile.id, name: profile.name, group: profile.group, tribeId: profile.tribeId,
      standId: standId || null, lastSeen: new Date().toISOString(), demo: !!profile.demo
    };
    var cutoff = Date.now() - 7 * 864e5;
    Object.keys(map).forEach(function (id) { if (new Date(map[id].lastSeen).getTime() < cutoff) delete map[id]; });
    write(KEYS.presence, map);
    return map;
  }
  function listPresence(onlineWindowMs) {
    var now = Date.now(), window = onlineWindowMs || 45000;
    return Object.keys(presence()).map(function (id) {
      var p = presence()[id];
      return Object.assign({}, p, { online: now - new Date(p.lastSeen).getTime() <= window });
    }).sort(function (a, b) { return new Date(b.lastSeen) - new Date(a.lastSeen); });
  }

  /* ----------------------------- Мастерство навыков (ФГОС) ----------------------------- */
  function standMastery(profileId, standId) {
    var best = bestSubmission(profileId, standId);
    if (!best) return { percent: 0, signals: {} };
    var r = best.result || {}, quiz = best.quiz || {}, auto = best.autotests || {};
    var score = r.score || 0;
    var quizBonus = quiz.done && quiz.correct === Object.keys(quiz.answers || {}).length ? 10 : 0;
    var autoBonus = auto.total && auto.passed === auto.total ? 10 : 0;
    return {
      percent: Math.min(100, Math.round(score * 0.8 + quizBonus + autoBonus)),
      signals: { checks: r.passed + '/' + r.total, quiz: quiz.done ? quiz.correct + '/' + Object.keys(quiz.answers || {}).length : '—', autotests: auto.total ? auto.passed + '/' + auto.total : '—' },
      submissionId: best.id
    };
  }
  function skillsMatrix(profileId) {
    if (!FGOS) return [];
    var rows = {};
    Object.keys(FGOS.STANDS).forEach(function (standId) {
      var spec = FGOS.STANDS[standId], mastery = standMastery(profileId, standId);
      spec.pk.forEach(function (code) {
        if (!rows[code]) rows[code] = { code: code, title: (FGOS.byCode(code) || {}).title || '', percents: [], stands: [] };
        rows[code].percents.push(mastery.percent);
        rows[code].stands.push(standId);
      });
    });
    return Object.keys(rows).map(function (code) {
      var row = rows[code];
      row.percent = Math.round(row.percents.reduce(function (a, b) { return a + b; }, 0) / row.percents.length);
      delete row.percents;
      return row;
    }).sort(function (a, b) { return a.code.localeCompare(b.code); });
  }

  /* ----------------------------- Трайбы: состав и таблица ----------------------------- */
  function roster() {
    var people = [];
    var p = getProfile();
    if (p && p.name) people.push({ id: p.id, name: p.name, group: p.group, tribeId: p.tribeId, demo: false });
    var demo = read('league-demo-data', { students: [] }).students || [];
    demo.forEach(function (d) { people.push({ id: d.id, name: d.name, group: d.group, tribeId: d.tribeId, demo: true }); });
    return people;
  }
  function tribeStandings() {
    var log = ledger();
    var byTribe = {};
    TRIBES.forEach(function (t) { byTribe[t.id] = { tribe: t, xp: 0, members: 0 }; });
    roster().forEach(function (person) {
      if (!byTribe[person.tribeId]) return;
      byTribe[person.tribeId].members++;
      log.forEach(function (e) { if (e.profileId === person.id) byTribe[person.tribeId].xp += e.xp || 0; });
    });
    return Object.keys(byTribe).map(function (id) { return byTribe[id]; }).sort(function (a, b) { return b.xp - a.xp; });
  }

  /* ----------------------------- Бандлы обмена между устройствами ----------------------------- */
  function exportBundle() {
    return {
      schema: 'league-bundle/1',
      exportedAt: new Date().toISOString(),
      submissions: submissions(),
      reviews: reviews(),
      presence: presence(),
      ledger: ledger()
    };
  }
  function importBundle(bundle) {
    if (!bundle || bundle.schema !== 'league-bundle/1') throw new Error('ожидался league-bundle/1');
    var report = { submissions: 0, reviews: 0, presence: 0, ledger: 0 };
    (bundle.submissions || []).forEach(function (s) {
      var before = submissions().length;
      addSubmission(s);
      if (submissions().length > before) report.submissions++;
    });
    var rv = reviews();
    (bundle.reviews || []).forEach(function (r) { if (!rv.some(function (x) { return x.id === r.id; })) { rv.push(r); report.reviews++; } });
    write(KEYS.reviews, rv);
    var pm = presence();
    Object.keys(bundle.presence || {}).forEach(function (id) { if (!pm[id]) { pm[id] = bundle.presence[id]; report.presence++; } });
    write(KEYS.presence, pm);
    var lg = ledger();
    (bundle.ledger || []).forEach(function (e) { if (!lg.some(function (x) { return x.id === e.id; })) { lg.push(e); report.ledger++; } });
    write(KEYS.ledger, lg);
    return report;
  }

  /* ----------------------------- Демо-однокурсники ----------------------------- */
  function seedDemo(force) {
    if (!force && storage.getItem(KEYS.demo) === DEMO_VERSION) return read('league-demo-data', { students: [] });
    var groups = ['ИС-21', 'ИС-22'];
    var names = ['Громов Артём Олегович', 'Зайцева Дарья Сергеевна', 'Ковалёв Никита Андреевич', 'Лебедева Полина Игоревна', 'Морозов Илья Дмитриевич', 'Соколова Вероника Павловна'];
    var stands = ['dhcp-alt', 'switch-ovs'];
    var students = [], subs = [], revs = [], pres = {}, led = [];
    var now = Date.now();
    names.forEach(function (name, i) {
      var group = groups[i % 2];
      /* в демо распределяем трайбы равномерно, чтобы таблица турнира жила сразу */
      var tribe = TRIBES[i % TRIBES.length];
      var id = 'demo-' + (i + 1);
      students.push({ id: id, name: name, group: group, tribeId: tribe.id, demo: true });
      stands.forEach(function (standId, si) {
        var score = [86, 100, 71, 100, 57, 86][(i + si) % 6];
        var sub = {
          id: uid('demo-sub'), schema: 'stands-submission/2', standId: standId,
          standTitle: standId === 'dhcp-alt' ? 'DHCP ALT' : 'Open vSwitch',
          student: { id: id, name: name, group: group, demo: true },
          startedAt: new Date(now - (5 + i) * 36e5).toISOString(),
          submittedAt: new Date(now - (4 - si) * 36e5 - i * 18e5).toISOString(),
          result: { passed: Math.round(score / 100 * (standId === 'dhcp-alt' ? 7 : 6)), total: standId === 'dhcp-alt' ? 7 : 6, score: score, ready: score === 100 },
          checks: [], config: '// демо-конфигурация', terminalLog: [], actionLog: [],
          quiz: { done: true, correct: score > 70 ? 5 : 3, answers: { 0: 0, 1: 1, 2: 1, 3: 2, 4: 1 } },
          autotests: { passed: score === 100 ? 8 : 6, total: 8, score: score === 100 ? 100 : 75 },
          demo: true
        };
        subs.push(sub);
        led.push({ id: uid('demo-xp'), profileId: id, at: sub.submittedAt, type: 'submit', xp: 40, coins: 8, note: AWARDS.submit.note, dedupKey: null });
        if (score === 100) led.push({ id: uid('demo-xp'), profileId: id, at: sub.submittedAt, type: 'standReady', xp: 50, coins: 10, note: AWARDS.standReady.note, dedupKey: null });
      });
      pres[id] = {
        id: id, name: name, group: group, tribeId: tribe.id,
        standId: i % 2 ? 'dhcp-alt' : 'switch-ovs',
        lastSeen: new Date(now - (i < 3 ? i * 12000 : 36e5 * (i - 2))).toISOString(), demo: true
      };
    });
    /* Несколько пиринговых и одна экспертная оценка */
    var rubric = function (a, b, c, d) { return { config: a, completeness: b, journal: c, communication: d }; };
    revs.push({
      id: uid('demo-rev'), kind: 'peer', standId: 'dhcp-alt', submissionId: subs[0].id,
      reviewer: { id: students[1].id, name: students[1].name, group: students[1].group },
      reviewee: { id: students[0].id, name: students[0].name, group: students[0].group },
      scores: rubric(4, 4, 5, 5), comment: 'Аккуратный dhcpd.conf, шлюз и DNS на месте, журнал показывает DORA полностью. Можно чуть подробнее комментировать резерв принтера.',
      createdAt: new Date(now - 2 * 36e5).toISOString(), demo: true
    });
    revs.push({
      id: uid('demo-rev'), kind: 'expert', standId: 'switch-ovs', submissionId: subs[3].id,
      reviewer: { id: 'teacher', name: 'Преподаватель', group: '—' },
      reviewee: { id: students[3].id, name: students[3].name, group: students[3].group },
      scores: rubric(5, 5, 5, 5), comment: 'Эталонная настройка trunk/access, все проверки и автотесты пройдены. Принято на максимальный балл.',
      createdAt: new Date(now - 36e5).toISOString(), demo: true
    });
    write('league-demo-data', { students: students });
    write(KEYS.submissions, subs);
    write(KEYS.reviews, revs);
    write(KEYS.presence, pres);
    write(KEYS.ledger, led);
    storage.setItem(KEYS.demo, DEMO_VERSION);
    return { students: students };
  }

  function resetAll() {
    Object.keys(KEYS).forEach(function (k) { storage.removeItem(KEYS[k]); });
    storage.removeItem('league-demo-data');
  }

  return {
    KEYS: KEYS,
    AWARDS: AWARDS,
    LEVELS: LEVELS,
    TRIBES: TRIBES,
    HACKATHONS: HACKATHONS,
    levelOf: levelOf,
    tribeFor: tribeFor,
    getProfile: getProfile,
    ensureProfile: ensureProfile,
    updateProfile: updateProfile,
    ledger: ledger,
    totals: totals,
    award: award,
    dailyLogin: dailyLogin,
    submissions: submissions,
    addSubmission: addSubmission,
    bestSubmission: bestSubmission,
    encodeSubmission: encodeSubmission,
    decodeSubmission: decodeSubmission,
    reviews: reviews,
    addReview: addReview,
    reviewsFor: reviewsFor,
    reviewsBy: reviewsBy,
    reviewerRating: reviewerRating,
    reviewerLeaderboard: reviewerLeaderboard,
    heartbeat: heartbeat,
    listPresence: listPresence,
    standMastery: standMastery,
    skillsMatrix: skillsMatrix,
    roster: roster,
    tribeStandings: tribeStandings,
    exportBundle: exportBundle,
    importBundle: importBundle,
    seedDemo: seedDemo,
    resetAll: resetAll
  };
});
