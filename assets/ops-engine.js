/* ==========================================================================
   OPS ENGINE · учебная вселенная «ДатаПолис» (эксплуатация и администрирование)
   Самостоятельный модуль, НЕ пересекается с лигой СетьПолиса: все ключи
   localStorage с префиксом ops-. Заявки/инциденты/изменения, SLA, дежурные
   роли, runbook и blameless postmortem, неткоины и PRP (та же терминология,
   отдельный баланс). Обмен без сервера — коды ITS-SD1/INC1/CHG1/RCA1/RUN1.
   UMD: браузер и Node.
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.OPS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEYS = {
    profile: 'ops-profile',
    ledger: 'ops-ledger',
    submissions: 'ops-submissions',
    presence: 'ops-presence',
    prp: 'ops-prp',
    tickets: 'ops-tickets',
    runbooks: 'ops-runbooks',
    postmortems: 'ops-postmortems',
    role: 'ops-role',
    crewOps: 'ops-crew-ops',
    crewPoints: 'ops-crew-points'
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
    var ids = [x.id, x.student && x.student.id, x.assignee && x.assignee.id, x.author && x.author.id].filter(Boolean);
    return ids.some(function (v) { return /^demo(-|_)/i.test(String(v)); });
  }

  /* ----------------------------- Команды (экипажи) и роли ----------------------------- */
  var CREWS = [
    { id: 'crew-noc', name: 'Экипаж «Аванпост»', glyph: 'NOC', color: '#38bdf8',
      focus: 'мониторинг и дежурство: алерты, доступность, реакция на сбои' },
    { id: 'crew-desk', name: 'Экипаж «Приёмная»', glyph: 'SD', color: '#34d399',
      focus: 'Service Desk: заявки пользователей, маршрутизация, обратная связь' },
    { id: 'crew-sec', name: 'Экипаж «Бастион»', glyph: 'SOC', color: '#f87171',
      focus: 'безопасность: доступы, firewall, разбор подозрительной активности' },
    { id: 'crew-rel', name: 'Экипаж «Релиз»', glyph: 'REL', color: '#fbbf24',
      focus: 'изменения и релизы: план отката, приёмка, запуск сервисов' }
  ];
  function crewFor(group) { return CREWS[hash(group || 'ИС-21') % CREWS.length]; }

  /* ----------------------------- Командные операции экипажа -----------------------------
     Общая работа ДатаПолиса: операции проходят несколько инженеров вместе,
     один закрыть не может — минимум minParticipants участников. */
  var CREW_OPS = [
    { id: 'crew-handover', minParticipants: 2,
      title: 'Смена дежурства NOC', points: 25,
      brief: 'Уходящий дежурный передаёт вахту заступающему: открытые инциденты, планы, доступы.',
      roles: ['уходящий дежурный', 'заступающий дежурный'],
      steps: ['Собрать открытые тикеты и инциденты за смену', 'Сверить мониторинг: что мигало и почему', 'Передать план смены и контакты дежурных', 'Обе стороны подтверждают передачу в чате экипажа'] },
    { id: 'crew-warroom', minParticipants: 3,
      title: 'War room по инциденту', points: 40,
      brief: 'Разбор живого инцидента втроём: кто связи, кто логи, кто пишет хронологию.',
      roles: ['координатор', 'дежурный инженер', 'хронолог'],
      steps: ['Объявить инцидент и роли в war room', 'Собрать факты: что сломалось и с какого времени', 'Применить план реагирования из runbook', 'Зафиксировать хронологию для postmortem'] },
    { id: 'crew-audit', minParticipants: 2,
      title: 'Аудит доступов Бастиона', points: 30,
      brief: 'Проверка учёток и прав: кто имеет доступ к сервисам и зачем.',
      roles: ['аудитор', 'владелец сервиса'],
      steps: ['Выгрузить список активных доступов сервиса', 'Сверить с матрицей прав: лишние отозвать', 'Оформить находки списком с приоритетами', 'Согласовать исправления с владельцем'] },
    { id: 'crew-rollback', minParticipants: 3,
      title: 'Репетиция отката релиза', points: 45,
      brief: 'Экипаж «Релиз» репетирует откат: план, команды, проверка сервиса после.',
      roles: ['release-инженер', 'наблюдатель', 'проверяющий'],
      steps: ['Прочитать план отката и озвучить критерии остановки', 'Прогнать команды отката на тестовом стенде', 'Проверить работоспособность сервиса после отката', 'Оформить выводы: сколько заняло, что улучшить'] },
    { id: 'crew-deskday', minParticipants: 2,
      title: 'День Service Desk парой', points: 20,
      brief: 'Приёмная работает в два голоса: один принимает заявки, второй маршрутизирует и учится.',
      roles: ['принимающий оператор', 'маршрутизатор'],
      steps: ['Принять и классифицировать заявки первой линии', 'Разобрать сложный кейс вместе с наставником', 'Проставить приоритеты по SLA', 'Итог смены: что перекинуть на вторую линию'] }
  ];

  function crewOpsCatalog() { return CREW_OPS; }
  function crewSteps() { return read(KEYS.crewOps, {}); }
  function setCrewStep(opId, stepIdx, on) {
    var m = crewSteps();
    var key = opId + '#' + stepIdx;
    if (on) m[key] = nowISO(); else delete m[key];
    write(KEYS.crewOps, m);
    return m;
  }
  function crewPointsMap() { return read(KEYS.crewPoints, {}); }
  function addCrewPoints(crewId, pts) {
    var m = crewPointsMap();
    m[crewId] = (m[crewId] || 0) + pts;
    write(KEYS.crewPoints, m);
    return m[crewId];
  }
  /* Проведение операции: шаги отмечают все участники в своих браузерах,
     закрытие — у того, кто вводил состав. Дедуп операция+неделя: регулярно
     повторяющиеся дежурства приносят награду раз в неделю. */
  function closeCrewOp(profile, opId, participants) {
    var op = null;
    CREW_OPS.forEach(function (o) { if (o.id === opId) op = o; });
    if (!op) throw new Error('неизвестная операция');
    var names = (participants || []).map(function (s) { return String(s).trim(); }).filter(Boolean);
    var uniq = []; names.forEach(function (n) { if (uniq.indexOf(n.toLowerCase()) < 0) uniq.push(n.toLowerCase()); });
    if (uniq.length < op.minParticipants) {
      throw new Error('нужно минимум ' + op.minParticipants + ' участника, указано ' + uniq.length);
    }
    var steps = crewSteps();
    for (var i = 0; i < op.steps.length; i++) {
      if (!steps[op.id + '#' + i]) throw new Error('не все шаги отмечены выполненными');
    }
    var week = (function () {
      var d = new Date(), onejan = new Date(d.getFullYear(), 0, 1);
      var w = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
      return d.getFullYear() + 'W' + w;
    })();
    var awardRes = award(profile.id, 'crewOp', 'crewop:' + op.id + ':' + week);
    if (awardRes.duplicated) {
      /* Повтор на той же неделе: без награды, очков экипажу и записи в журнал */
      return { award: awardRes, crewPoints: crewPointsMap()[profile.crewId] || 0, op: op, duplicated: true };
    }
    var crewPts = addCrewPoints(profile.crewId || crewFor(profile.group).id, op.points);
    var done = read(KEYS.crewOps + '-done', []);
    done.push({ id: uid('cop'), opId: op.id, crewId: profile.crewId, participants: uniq,
      points: op.points, week: week, at: nowISO() });
    write(KEYS.crewOps + '-done', done.slice(-100));
    return { award: awardRes, crewPoints: crewPts, op: op };
  }
  function crewOpsDone() { return read(KEYS.crewOps + '-done', []); }

  /* Роли ротационные: на один спринт/дежурство, не пожизненные */
  var ROLES = [
    { id: 'ic', name: 'Incident Commander', note: 'ведёт war room и принимает решение по инциденту' },
    { id: 'scribe', name: 'Scribe', note: 'фиксирует таймлайн и договорённости' },
    { id: 'duty', name: 'Дежурный инженер', note: 'исполняет восстановление под руководством IC' },
    { id: 'release', name: 'Release Manager', note: 'проверяет план отката и окно изменения' },
    { id: 'reviewer', name: 'Reviewer', note: 'проверяет runbook и конфигурацию по чек-листу' },
    { id: 'champion', name: 'Security Champion', note: 'контролирует доступы и политики безопасности' },
    { id: 'lead', name: 'Tech Lead', note: 'отвечает за архитектурную часть решения' },
    { id: 'po', name: 'Product Owner задачи', note: 'сверяет результат с потребностью заказчика' }
  ];

  var LEVELS = [
    { level: 1, title: 'Стажёр эксплуатации', need: 0 },
    { level: 2, title: 'Младший дежурный', need: 120 },
    { level: 3, title: 'Дежурный инженер', need: 300 },
    { level: 4, title: 'Инженер сервиса', need: 600 },
    { level: 5, title: 'NOC-инженер', need: 1000 },
    { level: 6, title: 'SRE-инженер', need: 1500 },
    { level: 7, title: 'Архитектор сервиса', need: 2200 }
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
    login: { xp: 10, coins: 2, note: 'выход на смену' },
    submit: { xp: 40, coins: 8, note: 'сдача лабораторной' },
    standReady: { xp: 50, coins: 10, note: 'сервис сдан по DoD' },
    quizPerfect: { xp: 20, coins: 4, note: 'тест без ошибок' },
    review: { xp: 15, coins: 3, note: 'проверка runbook коллеги' },
    ticketClosed: { xp: 25, coins: 5, note: 'заявка закрыта' },
    incidentResolved: { xp: 45, coins: 9, note: 'инцидент устранён' },
    slaMet: { xp: 20, coins: 4, note: 'SLA выдержан' },
    runbookWritten: { xp: 30, coins: 6, note: 'написан runbook' },
    changeReleased: { xp: 40, coins: 8, note: 'изменение выпущено с откатом' },
    postmortem: { xp: 25, coins: 5, note: 'разбор инцидента без вины' },
    crewOp: { xp: 35, coins: 9, note: 'командная операция экипажа проведена' }
  };

  var PRP_CAP = 20, INITIAL_PRP = 5;

  /* ----------------------------- Профиль ----------------------------- */
  var MASCOT_POOL = ['wolf', 'cat', 'otter', 'raccoon', 'owl', 'fox', 'crab', 'hedgehog'];
  function getProfile() { return read(KEYS.profile, null); }
  function ensureProfile(name, group, mascotId) {
    var p = getProfile();
    if (p && p.name && p.group) return p;
    var id = uid('eng');
    p = {
      id: id, name: name, group: group,
      createdAt: nowISO(), savedAt: nowISO(),
      crewId: crewFor(group).id,
      mascotId: mascotId || MASCOT_POOL[hash(group || name || id) % MASCOT_POOL.length],
      handleNum: (hash(id) % 99) + 1
    };
    write(KEYS.profile, p);
    var prp = read(KEYS.prp, {}); prp[id] = INITIAL_PRP; write(KEYS.prp, prp);
    write(KEYS.role, { roleId: ROLES[hash(id) % ROLES.length].id, since: nowISO() });
    return p;
  }
  function updateProfile(patch) {
    var p = getProfile() || {};
    Object.assign(p, patch, { savedAt: nowISO() });
    if (patch.group) p.crewId = crewFor(patch.group).id;
    write(KEYS.profile, p); return p;
  }
  function setMascot(id) { var p = getProfile(); if (p) { p.mascotId = id; write(KEYS.profile, p); } return p; }
  function handleFor(p) {
    var names = { raccoon: 'енот', fox: 'лис', crab: 'краб', owl: 'сова', cat: 'кот', wolf: 'волк', otter: 'выдра', hedgehog: 'ёжик' };
    return { text: (names[(p && p.mascotId) || 'wolf'] || 'инженер') + ' #' + ((p && p.handleNum) || 1) };
  }
  function publicStudent(p) {
    return { id: p.id, name: p.name, group: p.group, crewId: p.crewId, mascotId: p.mascotId, handle: handleFor(p).text };
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

  /* ----------------------------- PRP (репутация проверок) ----------------------------- */
  function prpMap() { return read(KEYS.prp, {}); }
  function prpBalance(id) { var m = prpMap(); return typeof m[id] === 'number' ? m[id] : 0; }
  function earnPrp(id) { var m = prpMap(); m[id] = Math.min(PRP_CAP, (m[id] || 0) + 1); write(KEYS.prp, m); return { balance: m[id] }; }
  function spendPrp(id, reason) {
    var m = prpMap(), before = m[id] || 0;
    m[id] = Math.max(0, before - 1); write(KEYS.prp, m);
    return { balance: m[id], charged: before > 0, reason: reason || 'работа выставлена на проверку' };
  }

  /* ----------------------------- Сабмишены лабораторных ----------------------------- */
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

  /* ----------------------------- Тикеты: заявки, инциденты, изменения ----------------------------- */
  var SLA_MIN = { P1: 30, P2: 60, P3: 240, P4: 1440 };
  var TICKET_TYPES = {
    request: { code: 'SD', label: 'заявка Service Desk', prefix: 'ITS-SD1' },
    incident: { code: 'INC', label: 'инцидент', prefix: 'ITS-INC1' },
    change: { code: 'CHG', label: 'изменение', prefix: 'ITS-CHG1' }
  };
  function tickets() { return read(KEYS.tickets, []).filter(function (t) { return !isDemoRecord(t); }); }
  function createTicket(input) {
    var type = TICKET_TYPES[input.type] ? input.type : 'request';
    var priority = SLA_MIN[input.priority] ? input.priority : 'P3';
    var t = {
      id: uid(TICKET_TYPES[type].code.toLowerCase()),
      schema: 'ops-ticket/1',
      type: type, priority: priority,
      title: String(input.title || '').slice(0, 160),
      description: String(input.description || '').slice(0, 2000),
      status: 'open',
      labId: input.labId || null,
      crewId: input.crewId || null,
      author: input.author || null,
      assignee: null,
      rollbackPlan: input.rollbackPlan || null,
      openedAt: nowISO(), ackedAt: null, resolvedAt: null,
      slaMinutes: SLA_MIN[priority], slaMet: null, breached: false
    };
    var list = read(KEYS.tickets, []); list.push(t); write(KEYS.tickets, list); return t;
  }
  function getTicket(id) { return tickets().filter(function (t) { return t.id === id; })[0] || null; }
  function updateTicket(id, patch) {
    var list = read(KEYS.tickets, []);
    var t = null;
    list.forEach(function (x) { if (x.id === id) t = x; });
    if (!t) return null;
    if (patch.assignee && !t.ackedAt) { t.ackedAt = nowISO(); t.assignee = patch.assignee; t.status = 'in_progress'; }
    if (patch.status === 'resolved' || patch.status === 'closed') {
      t.status = patch.status; t.resolvedAt = nowISO();
      var elapsed = (new Date(t.resolvedAt) - new Date(t.openedAt)) / 60000;
      t.slaMet = patch.forceBreach ? false : elapsed <= t.slaMinutes;
      t.breached = !t.slaMet;
      t.resolution = String(patch.resolution || '').slice(0, 2000);
    } else if (patch.status) {
      t.status = patch.status;
    }
    write(KEYS.tickets, list); return t;
  }
  function ticketMetrics() {
    var ts = tickets(), closed = ts.filter(function (t) { return t.resolvedAt; });
    var inSla = closed.filter(function (t) { return t.slaMet; }).length;
    var reaction = closed.filter(function (t) { return t.ackedAt; }).map(function (t) {
      return (new Date(t.ackedAt) - new Date(t.openedAt)) / 60000;
    });
    var resolution = closed.map(function (t) { return (new Date(t.resolvedAt) - new Date(t.openedAt)) / 60000; });
    function avg(a) { return a.length ? Math.round(a.reduce(function (s, v) { return s + v; }, 0) / a.length) : 0; }
    return {
      total: ts.length, open: ts.filter(function (t) { return !t.resolvedAt; }).length, closed: closed.length,
      slaPct: closed.length ? Math.round(inSla / closed.length * 100) : 100,
      avgReactionMin: avg(reaction), avgResolutionMin: avg(resolution),
      incidents: ts.filter(function (t) { return t.type === 'incident'; }).length,
      changes: ts.filter(function (t) { return t.type === 'change'; }).length
    };
  }

  /* ----------------------------- Runbook и postmortem ----------------------------- */
  function runbooks() { return read(KEYS.runbooks, []).filter(function (r) { return !isDemoRecord(r); }); }
  function addRunbook(rb) {
    if (isDemoRecord(rb)) return runbooks();
    var list = read(KEYS.runbooks, []);
    rb.id = rb.id || uid('run'); rb.schema = 'ops-runbook/1'; rb.createdAt = rb.createdAt || nowISO();
    list.push(rb); write(KEYS.runbooks, list); return rb;
  }
  function postmortems() { return read(KEYS.postmortems, []).filter(function (r) { return !isDemoRecord(r); }); }
  function addPostmortem(pm) {
    if (isDemoRecord(pm)) return postmortems();
    var list = read(KEYS.postmortems, []);
    pm.id = pm.id || uid('rca'); pm.schema = 'ops-rca/1'; pm.blameless = true; pm.createdAt = pm.createdAt || nowISO();
    list.push(pm); write(KEYS.postmortems, list); return pm;
  }

  /* ----------------------------- Ротация ролей ----------------------------- */
  function currentRole() {
    var r = read(KEYS.role, null);
    if (!r) return null;
    return ROLES.filter(function (x) { return x.id === r.roleId; })[0] || null;
  }
  function rotateRole() {
    var cur = currentRole();
    var idx = cur ? ROLES.findIndex(function (x) { return x.id === cur.id; }) : -1;
    var next = ROLES[(idx + 1) % ROLES.length];
    write(KEYS.role, { roleId: next.id, since: nowISO() }); return next;
  }

  /* ----------------------------- Присутствие (presence) ----------------------------- */
  function presence() { return read(KEYS.presence, {}); }
  function heartbeat(profile, labId) {
    var map = presence();
    map[profile.id] = {
      id: profile.id, name: profile.name, group: profile.group, crewId: profile.crewId,
      mascotId: profile.mascotId || 'wolf', handle: handleFor(profile).text,
      labId: labId || null, role: (currentRole() || {}).name || null, lastSeen: nowISO()
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

  /* ----------------------------- Репутация экипажа (только позитивно) ----------------------------- */
  function crewReputation() {
    var m = ticketMetrics(), rb = runbooks().length, pm = postmortems().length;
    /* без штрафов: признаём SLA, документацию и культуру разбора */
    return {
      slaScore: m.slaPct,
      runbooks: rb,
      postmortems: pm,
      index: Math.round(m.slaPct * 0.6 + Math.min(25, rb * 3) + Math.min(15, pm * 5))
    };
  }

  /* ----------------------------- Коды обмена без сервера ----------------------------- */
  function b64enc(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64dec(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return decodeURIComponent(escape(atob(str)));
  }
  var CODE_PREFIX = {
    'ops-ticket/1': { request: 'ITS-SD1', incident: 'ITS-INC1', change: 'ITS-CHG1' },
    'ops-rca/1': 'ITS-RCA1',
    'ops-runbook/1': 'ITS-RUN1'
  };
  function encodeArtifact(obj) {
    var pre;
    if (obj.schema === 'ops-ticket/1') pre = CODE_PREFIX['ops-ticket/1'][obj.type] || 'ITS-SD1';
    else pre = CODE_PREFIX[obj.schema] || 'ITS-OPS1';
    return pre + '.' + b64enc(JSON.stringify(obj));
  }
  function decodeArtifact(code) {
    if (!code || typeof code !== 'string' || code.indexOf('.') < 0) throw new Error('неверный код');
    var payload = code.slice(code.indexOf('.') + 1);
    var obj = JSON.parse(b64dec(payload));
    if (isDemoRecord(obj)) throw new Error('демо-запись отклонена');
    return obj;
  }
  function importArtifact(code) {
    var obj = decodeArtifact(code);
    if (obj.schema === 'ops-ticket/1') { updateTicket(obj.id, obj) || write(KEYS.tickets, read(KEYS.tickets, []).concat([obj])); return { kind: 'ticket', obj: obj }; }
    if (obj.schema === 'ops-runbook/1') { addRunbook(obj); return { kind: 'runbook', obj: obj }; }
    if (obj.schema === 'ops-rca/1') { addPostmortem(obj); return { kind: 'postmortem', obj: obj }; }
    throw new Error('неизвестный артефакт');
  }

  /* ----------------------------- Бандлы и сброс ----------------------------- */
  function exportBundle(profile) {
    return {
      schema: 'ops-bundle/2', exportedAt: nowISO(), student: publicStudent(profile),
      profile: getProfile(), ledger: ledger(), submissions: submissions(),
      tickets: tickets(), runbooks: runbooks(), postmortems: postmortems(),
      crewOpsDone: crewOpsDone(), crewPoints: crewPointsMap()
    };
  }
  function resetAll() {
    Object.keys(KEYS).forEach(function (k) { storage.removeItem(KEYS[k]); });
    storage.removeItem(KEYS.crewOps + '-done');
  }

  /* Сводка экипажей ДатаПолиса для общего стенда: очки команд и счётчики
     проведённых операций. Преподаватель собирает её из импортированных
     ops-бандлов так же, как стенд лиги СетьПолиса. */
  function crewsSnapshot() {
    var crews = CREWS.map(function (c) {
      var pts = crewPointsMap()[c.id] || 0;
      return { id: c.id, name: c.name, points: pts };
    }).filter(function (c) { return c.points > 0; });
    var opsCount = {};
    crewOpsDone().forEach(function (d) { if (opsCount[d.opId]) opsCount[d.opId]++; else opsCount[d.opId] = 1; });
    var opsTitles = {};
    CREW_OPS.forEach(function (o) { opsTitles[o.id] = o.title; });
    var members = [];
    var p = getProfile();
    if (p && p.id) {
      var xp = 0;
      ledger().forEach(function (e) { if (e.profileId === p.id) xp += e.xp || 0; });
      members.push({ handle: handleFor(p).text, crewId: p.crewId, xp: xp });
    }
    return { crews: crews, opsDone: opsCount, opsTitles: opsTitles, members: members };
  }

  return {
    KEYS: KEYS, CREWS: CREWS, ROLES: ROLES, LEVELS: LEVELS, AWARDS: AWARDS, CREW_OPS: CREW_OPS,
    SLA_MIN: SLA_MIN, TICKET_TYPES: TICKET_TYPES, PRP_CAP: PRP_CAP, INITIAL_PRP: INITIAL_PRP,
    crewFor: crewFor, levelOf: levelOf, handleFor: handleFor,
    getProfile: getProfile, ensureProfile: ensureProfile, updateProfile: updateProfile,
    setMascot: setMascot, publicStudent: publicStudent,
    ledger: ledger, award: award, totals: totals, dailyLogin: dailyLogin,
    prpBalance: prpBalance, earnPrp: earnPrp, spendPrp: spendPrp,
    submissions: submissions, addSubmission: addSubmission, bestSubmission: bestSubmission,
    tickets: tickets, createTicket: createTicket, getTicket: getTicket, updateTicket: updateTicket,
    ticketMetrics: ticketMetrics,
    runbooks: runbooks, addRunbook: addRunbook,
    postmortems: postmortems, addPostmortem: addPostmortem,
    currentRole: currentRole, rotateRole: rotateRole,
    heartbeat: heartbeat, listPresence: listPresence, crewReputation: crewReputation,
    encodeArtifact: encodeArtifact, decodeArtifact: decodeArtifact, importArtifact: importArtifact,
    exportBundle: exportBundle, resetAll: resetAll, isDemoRecord: isDemoRecord,
    crewOpsCatalog: crewOpsCatalog, crewSteps: crewSteps, setCrewStep: setCrewStep,
    crewPointsMap: crewPointsMap, addCrewPoints: addCrewPoints,
    closeCrewOp: closeCrewOp, crewOpsDone: crewOpsDone, crewsSnapshot: crewsSnapshot
  };
});
