/* ==========================================================================
   LEAGUE · учебная геймификация и взаимные проверки (без сервера)
   Всё состояние — localStorage одного браузера; обмен между устройствами и
   студентами — JSON-бандлы, коды работ ITS-LAB1 и коды рецензий ITS-REV1,
   плюс публичная папка репозитория (читается без токена).
   Профили с маскотами-хэндлами (#енот 7), XP/уровни/неткоины, PRP-очки
   взаимных проверок, трайбы, достижения, рейтинг проверяющего
   (справедливость, доброжелательность, заинтересованность, пунктуальность),
   presence. UMD: браузер и Node.
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
    prp: 'league-prp'
  };

  /* Публичный репозиторий используется как общая доска обмена без сервера:
     чтение папок submissions/ и reviews/ доступно без токена (Contents API). */
  var REPO_CONFIG = {
    owner: 'ItsLiventsev',
    repo: 'itsliventsev.github.io',
    branch: 'main',
    submissionsPath: 'submissions',
    reviewsPath: 'reviews'
  };

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
    review:       { xp: 15, coins: 3,  note: 'взаимная оценка работы' },
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

  /* ----------------------------- Маскоты и хэндлы ----------------------------- */
  var MASCOTS = [
    { id: 'raccoon', animal: 'енот',    color: '#8b93a7' },
    { id: 'fox',     animal: 'лиса',    color: '#e8843c' },
    { id: 'crab',    animal: 'краб',    color: '#ef5d5d' },
    { id: 'owl',     animal: 'филин',   color: '#9b7bd4' },
    { id: 'cat',     animal: 'кот',     color: '#5b9dff' },
    { id: 'wolf',    animal: 'волк',    color: '#7d8fa3' },
    { id: 'otter',   animal: 'выдра',   color: '#3aa6a0' },
    { id: 'hedgehog', animal: 'ёж',     color: '#b0794a' }
  ];
  function mascotById(id) {
    for (var i = 0; i < MASCOTS.length; i++) if (MASCOTS[i].id === id) return MASCOTS[i];
    return MASCOTS[0];
  }
  /* Хэндл — социальное имя студента: животное-маскот + стабильный номер */
  function handleFor(p) {
    if (!p) return { animal: 'енот', num: 1, text: 'енот #1' };
    var m = mascotById(p.mascotId);
    var num = p.handleNum || (hash(p.id || p.name || 'x') % 99) + 1;
    return { animal: m.animal, num: num, text: m.animal + ' #' + num };
  }

  /* ----------------------------- Трайбы ----------------------------- */
  var TRIBES = [
    { id: 'tribe-packet', name: 'Трайб «Пакет»', glyph: 'PKT', color: 'var(--st-accent)' },
    { id: 'tribe-frame', name: 'Трайб «Кадр»', glyph: 'FRM', color: 'var(--st-ok)' },
    { id: 'tribe-route', name: 'Трайб «Маршрут»', glyph: 'RTE', color: 'var(--st-warn)' },
    { id: 'tribe-socket', name: 'Трайб «Сокет»', glyph: 'SKT', color: 'var(--st-bad)' }
  ];
  function tribeFor(group) { return TRIBES[hash(group || 'ИС-21') % TRIBES.length]; }


  /* ----------------------------- Профиль и журнал ----------------------------- */
  function getProfile() { return read(KEYS.profile, null); }
  function ensureProfile(name, group) {
    var p = getProfile();
    if (p && p.name && p.group) return p;
    var id = uid('stu');
    var m = MASCOTS[hash(group || name || id) % MASCOTS.length];
    p = {
      id: id, name: name, group: group,
      createdAt: new Date().toISOString(), savedAt: new Date().toISOString(),
      tribeId: tribeFor(group).id,
      mascotId: m.id, handleNum: (hash(id) % 99) + 1
    };
    write(KEYS.profile, p);
    var prp = prpMap();
    prp[id] = INITIAL_PRP;
    write(KEYS.prp, prp);
    return p;
  }
  function updateProfile(patch) {
    var p = getProfile() || {};
    Object.assign(p, patch, { savedAt: new Date().toISOString() });
    if (patch.group) p.tribeId = tribeFor(patch.group).id;
    write(KEYS.profile, p);
    return p;
  }
  function setMascot(mascotId) {
    var p = getProfile();
    if (!p || !mascotById(mascotId)) return p;
    p.mascotId = mascotId;
    p.savedAt = new Date().toISOString();
    write(KEYS.profile, p);
    return p;
  }
  function publicStudent(p) {
    if (!p) return p;
    var h = handleFor(p);
    return {
      id: p.id, name: p.name, group: p.group, tribeId: p.tribeId || null,
      mascotId: p.mascotId || 'raccoon', handle: h.text, handleNum: h.num
    };
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

  /* ----------------------------- PRP · очки взаимных проверок -----------------------------
     Каждому новичку — 5 PRP. Сдача работы на взаимную проверку стоит 1 PRP,
     проверка чужой работы приносит 1 PRP: помогать коллегам напрямую выгодно,
     а бесконечно заказывать рецензии нельзя. В офлайне баланс не блокирует сдачу. */
  var INITIAL_PRP = 5;
  var PRP_CAP = 20;
  function prpMap() { return read(KEYS.prp, {}); }
  function prpBalance(profileId) {
    var m = prpMap();
    return typeof m[profileId] === 'number' ? m[profileId] : 0;
  }
  function earnPrp(profileId, n, reason) {
    var m = prpMap();
    m[profileId] = Math.min(PRP_CAP, (m[profileId] || 0) + (n || 1));
    write(KEYS.prp, m);
    return { balance: m[profileId], reason: reason || 'проверка работы коллеги' };
  }
  function spendPrp(profileId, reason) {
    var m = prpMap();
    var before = m[profileId] || 0;
    m[profileId] = Math.max(0, before - 1);
    write(KEYS.prp, m);
    return { balance: m[profileId], charged: before > 0, reason: reason || 'работа выставлена на взаимную проверку' };
  }

  /* ----------------------------- Работы студентов ----------------------------- */
  function submissions() { return read(KEYS.submissions, []); }
  /* Демо-данные разработки в боевой системе не принимаем ниоткуда */
  function isDemoRecord(x) {
    if (!x || typeof x !== 'object') return false;
    if (x.demo === true) return true;
    var ids = [x.id, x.student && x.student.id, x.reviewer && x.reviewer.id, x.reviewee && x.reviewee.id].filter(Boolean);
    return ids.some(function (v) { return /^demo(-|_)/i.test(String(v)); });
  }

  function addSubmission(s) {
    if (isDemoRecord(s)) return submissions();
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
    if (isDemoRecord(r)) return reviews();
    var list = reviews();
    r.id = r.id || uid('rev');
    r.createdAt = r.createdAt || new Date().toISOString();
    list.push(r);
    write(KEYS.reviews, list);
    if (r.kind === 'peer' && r.reviewer && r.reviewer.id) earnPrp(r.reviewer.id, 1, 'взаимная проверка работы ' + r.submissionId);
    return r;
  }
  function reviewsFor(submissionId) {
    return reviews().filter(function (r) { return r.submissionId === submissionId; });
  }
  function reviewsBy(profileId) {
    return reviews().filter(function (r) { return r.reviewer.id === profileId; });
  }
  /* Импорт уже готовой рецензии (из кода ITS-REV1 или файла): без начисления PRP,
     т.к. очки получает рецензент на своей машине в момент написания. */
  function importReview(r) {
    var list = reviews();
    if (r.id && list.some(function (x) { return x.id === r.id; })) return { duplicated: true };
    r.id = r.id || uid('rev');
    r.createdAt = r.createdAt || new Date().toISOString();
    list.push(r);
    write(KEYS.reviews, list);
    return { duplicated: false, review: r };
  }

  /* Код рецензии: проверяющий отправляет его автору работы в любом мессенджере,
     автор вставляет код у себя на стенде — рецензия подхватывается без сервера. */
  function encodeReview(r) { return 'ITS-REV1.' + b64encodeUnicode(JSON.stringify(r)); }
  function decodeReview(code) {
    code = String(code).trim();
    if (code.indexOf('ITS-REV1.') !== 0) throw new Error('код рецензии должен начинаться с ITS-REV1.');
    var obj = JSON.parse(b64decodeUnicode(code.slice(9)));
    if (!obj || obj.schema !== 'league-review/1' || !obj.submissionId || !obj.reviewer || !obj.reviewee ||
        !obj.scores || !obj.comment) {
      throw new Error('структура кода не соответствует контракту league-review/1');
    }
    return obj;
  }

  var RUDE = /дурак|туп|плох|ужас|ненавиж|отстой|fail|дно|бездар/i;
  var KIND = /молод|хорош|отлич|супер|спасибо|понрав|аккурат|верно|успеш|рекоменд|пожалуйста/i;

  /* Рейтинг проверяющего: четыре качества взаимной оценки */
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
      mascotId: profile.mascotId || 'raccoon', handle: handleFor(profile).text,
      standId: standId || null, lastSeen: new Date().toISOString()
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
    }).filter(function (p) { return !isDemoRecord(p); })
      .sort(function (a, b) { return new Date(b.lastSeen) - new Date(a.lastSeen); });
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

  /* ----------------------------- Достижения (бейджи) -----------------------------
     Вычисляются из реальных данных, ничего отдельно не храним — честность и простота. */
  var ACHIEVEMENTS = [
    { id: 'first-login', icon: '🌅', title: 'Первый день в СетьПолисе', desc: 'войти на стенды впервые' },
    { id: 'first-submit', icon: '📤', title: 'Боевое крещение', desc: 'сдать первую лабораторную' },
    { id: 'stand-ready', icon: '💯', title: 'Идеальная настройка', desc: 'пройти стенд на 100%' },
    { id: 'autotests-master', icon: '🤖', title: 'Повелитель автотестов', desc: '8 из 8 автотестов на стенде' },
    { id: 'quiz-perfect', icon: '🧠', title: 'Эрудит', desc: 'контрольный тест без единой ошибки' },
    { id: 'both-stands', icon: '🗺️', title: 'Покоритель двух квестов', desc: 'сдать оба доступных стенда' },
    { id: 'first-review', icon: '🤝', title: 'Первое ревью', desc: 'проверить работу однокурсника' },
    { id: 'reviewer-5', icon: '⭐', title: 'Опытный проверяющий', desc: 'оставить 5 взаимных оценок' },
    { id: 'fair-reviewer', icon: '⚖️', title: 'Справедливый глаз', desc: 'рейтинг справедливости не ниже 85' },
    { id: 'kind-reviewer', icon: '💬', title: 'Доброе слово', desc: 'рейтинг доброжелательности не ниже 85' },
    { id: 'prp-rich', icon: '🪙', title: 'Капитал доверия', desc: 'накопить 8 PRP проверками коллег' },
    { id: 'early-bird', icon: '🐦', title: 'Ранняя пташка', desc: 'начать работу до 9:00' },
    { id: 'streak-3', icon: '🔥', title: 'На три дня', desc: 'заходить на стенды три разных дня' },
    { id: 'level-3', icon: '🎓', title: 'Администратор сети', desc: 'достичь третьего уровня' }
  ];
  function achievements(profileId) {
    var log = ledger().filter(function (e) { return e.profileId === profileId; });
    var has = function (type) { return log.some(function (e) { return e.type === type; }); };
    var mySubs = submissions().filter(function (s) { return s.student.id === profileId; });
    var myReviews = reviewsBy(profileId);
    var rating = reviewerRating(profileId);
    var standsDone = {};
    mySubs.forEach(function (s) { standsDone[s.standId] = true; });
    var loginDays = {};
    log.filter(function (e) { return e.type === 'login'; }).forEach(function (e) { loginDays[e.at.slice(0, 10)] = true; });
    var early = log.some(function (e) { return new Date(e.at).getHours() < 9; });
    var checks = {
      'first-login': log.some(function (e) { return e.type === 'login'; }),
      'first-submit': has('submit'),
      'stand-ready': has('standReady'),
      'autotests-master': has('autotests'),
      'quiz-perfect': has('quizPerfect'),
      'both-stands': Object.keys(standsDone).length >= 2,
      'first-review': myReviews.length >= 1,
      'reviewer-5': myReviews.length >= 5,
      'fair-reviewer': !!rating && rating.fairness >= 85,
      'kind-reviewer': !!rating && rating.kindness >= 85,
      'prp-rich': prpBalance(profileId) >= 8,
      'early-bird': early,
      'streak-3': Object.keys(loginDays).length >= 3,
      'level-3': totals(profileId).level.level >= 3
    };
    return ACHIEVEMENTS.map(function (a) {
      return Object.assign({}, a, { unlocked: !!checks[a.id] });
    });
  }

  /* ----------------------------- Трайбы: состав и таблица ----------------------------- */
  /* Ростер собирается только из реальных следов: свой профиль, авторы работ,
     участники рецензий, presence-сessions. Никаких искусственных студентов. */
  function roster() {
    var people = {};
    function add(s) {
      if (!s || !s.id || !s.name || isDemoRecord(s)) return;
      if (!people[s.id]) people[s.id] = { id: s.id, name: s.name, group: s.group, tribeId: s.tribeId, handle: s.handle };
    }
    var p = getProfile();
    if (p && p.name) add(Object.assign({}, p, { handle: handleFor(p).text }));
    submissions().forEach(function (s) { add(s.student); });
    reviews().forEach(function (r) { add(r.reviewer); add(r.reviewee); });
    Object.keys(presence()).forEach(function (id) { add(presence()[id]); });
    return Object.keys(people).map(function (k) { return people[k]; });
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
      schema: 'league-bundle/2',
      exportedAt: new Date().toISOString(),
      profile: getProfile(),
      submissions: submissions(),
      reviews: reviews(),
      presence: presence(),
      prp: prpMap(),
      ledger: ledger()
    };
  }
  function importBundle(bundle) {
    if (!bundle || (bundle.schema !== 'league-bundle/1' && bundle.schema !== 'league-bundle/2')) {
      throw new Error('ожидался league-bundle/1 или /2');
    }
    var report = { submissions: 0, reviews: 0, presence: 0, ledger: 0, prp: 0 };
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
    if (bundle.schema === 'league-bundle/2' && bundle.prp) {
      var m = prpMap();
      Object.keys(bundle.prp).forEach(function (id) {
        if (typeof m[id] !== 'number') { m[id] = bundle.prp[id]; report.prp++; }
      });
      write(KEYS.prp, m);
    }
    return report;
  }

  function resetAll() {
    Object.keys(KEYS).forEach(function (k) { storage.removeItem(KEYS[k]); });
  }

  return {
    KEYS: KEYS,
    REPO_CONFIG: REPO_CONFIG,
    AWARDS: AWARDS,
    LEVELS: LEVELS,
    TRIBES: TRIBES,
    MASCOTS: MASCOTS,
    INITIAL_PRP: INITIAL_PRP,
    PRP_CAP: PRP_CAP,
    levelOf: levelOf,
    tribeFor: tribeFor,
    mascotById: mascotById,
    handleFor: handleFor,
    setMascot: setMascot,
    publicStudent: publicStudent,
    getProfile: getProfile,
    ensureProfile: ensureProfile,
    updateProfile: updateProfile,
    prpBalance: prpBalance,
    earnPrp: earnPrp,
    spendPrp: spendPrp,
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
    importReview: importReview,
    encodeReview: encodeReview,
    decodeReview: decodeReview,
    reviewsFor: reviewsFor,
    reviewsBy: reviewsBy,
    reviewerRating: reviewerRating,
    reviewerLeaderboard: reviewerLeaderboard,
    heartbeat: heartbeat,
    listPresence: listPresence,
    standMastery: standMastery,
    skillsMatrix: skillsMatrix,
    achievements: achievements,
    roster: roster,
    tribeStandings: tribeStandings,
    exportBundle: exportBundle,
    importBundle: importBundle,
    resetAll: resetAll
  };
});
