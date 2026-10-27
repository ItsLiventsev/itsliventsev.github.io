/* ==========================================================================
   Виртуальные стенды · стенд коммутации на Open vSwitch (Linux)
   Чистая логика без DOM: состояние виртуального коммутатора, эмулятор
   терминала ovs-vsctl/ovs-ofctl/ip, проверки конфигурации, мини-тест.
   UMD: браузер (window.OVS) и Node (module.exports) — юнит-тесты без jsdom.
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.OVS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Спецификация стенда: один мост br0, два access-порта и trunk-аплинк */
  var SPEC = {
    bridge: 'br0',
    ifaces: ['eth1', 'eth2', 'eth3'],
    ports: {
      eth1: { role: 'access', vlan: 10, label: 'ПК отдела продаж' },
      eth2: { role: 'access', vlan: 20, label: 'ПК бухгалтерии' },
      eth3: { role: 'trunk', vlans: [10, 20], label: 'Аплинк к вышестоящему коммутатору' }
    },
    vlans: { 10: 'SALES', 20: 'ACCOUNTING' }
  };

  function freshState() {
    return { installed: false, enabled: false, bridge: null, ports: {}, showRan: false };
  }

  /* «Сломанная» конфигурация для ситуационной задачи: eth3 ошибочно сделан
     access-портом VLAN 10 вместо trunk 10,20 */
  function brokenState() {
    var s = freshState();
    s.installed = true;
    s.enabled = true;
    s.bridge = 'br0';
    s.ports = {
      eth1: { tag: 10, trunks: null },
      eth2: { tag: 20, trunks: null },
      eth3: { tag: 10, trunks: null }
    };
    return s;
  }

  /* Текстовая выгрузка состояния в стиле `ovs-vsctl show` — идёт в JSON сдачи */
  function stateToText(state) {
    if (!state.bridge) return '// мост ещё не создан (ovs-vsctl add-br ' + SPEC.bridge + ')';
    var lines = [state.bridge];
    SPEC.ifaces.forEach(function (name) {
      var p = state.ports[name];
      if (!p) { lines.push('    // порт ' + name + ' не добавлен'); return; }
      if (p.trunks) lines.push('    Port ' + name + '\n        trunks: [' + p.trunks.join(', ') + ']');
      else lines.push('    Port ' + name + '\n        tag: ' + (p.tag == null ? 'нет (access без VLAN)' : p.tag));
      lines.push('        Interface "' + name + '"');
    });
    return lines.join('\n');
  }

  /* ----------------------------- Терминал ----------------------------- */
  function needSvc(state) {
    if (!state.installed) return { ok: false, out: 'ovs-vsctl: Open vSwitch не установлен — sudo apt-get install openvswitch-switch' };
    if (!state.enabled) return { ok: false, out: 'ovs-vsctl: служба openvswitch не запущена — sudo systemctl enable --now openvswitch' };
    return null;
  }

  function cmdHelp() {
    return { out: [
      'доступные команды стенда:',
      '  sudo apt-get install openvswitch-switch   установка OVS',
      '  sudo systemctl enable --now openvswitch   запуск службы',
      '  sudo systemctl status openvswitch         статус службы',
      '  sudo ovs-vsctl add-br br0                 создать мост',
      '  sudo ovs-vsctl add-port br0 eth1          добавить порт',
      '  sudo ovs-vsctl set port eth1 tag=10       access-порт в VLAN 10',
      '  sudo ovs-vsctl set port eth3 trunks=10,20 trunk с VLAN 10 и 20',
      '  ovs-vsctl show                            текущая конфигурация OVSDB',
      '  sudo ovs-ofctl show br0                   таблица портов (OpenFlow)',
      '  ip -d link show                           интерфейсы Linux',
      '  clear                                     очистить терминал'
    ].join('\n') };
  }

  function cmdInstall(state) {
    if (state.installed) return { out: 'openvswitch-switch уже установлен (новейшая версия)' };
    state.installed = true;
    return {
      out: 'Чтение списков пакетов… Готово\nopenvswitch-switch установлен: демоны ovs-vswitchd и ovsdb-server\nподсказка: запустите службу — sudo systemctl enable --now openvswitch',
      event: { type: 'terminal', msg: 'установлен Open vSwitch' }
    };
  }

  function cmdSystemctl(state, action) {
    if (!state.installed) return { ok: false, out: 'Unit openvswitch.service не найден — сначала установите пакет' };
    if (action === 'status') {
      return { out: state.enabled
        ? '● openvswitch.service — active (running)\n   Loaded: loaded; Main PID: 942 (ovs-vswitchd)'
        : '○ openvswitch.service — inactive (dead)' };
    }
    if (!state.enabled) state.enabled = true;
    return { out: 'Created symlink → openvswitch.service; служба active (running)', event: { type: 'terminal', msg: 'служба openvswitch: ' + action } };
  }

  function cmdAddBr(state, br) {
    var blocked = needSvc(state);
    if (blocked) return blocked;
    if (br !== SPEC.bridge) return { ok: false, out: 'ovs-vsctl: по заданию мост должен называться ' + SPEC.bridge };
    if (state.bridge) return { ok: false, out: 'ovs-vsctl: мост ' + br + ' уже существует' };
    state.bridge = br;
    return { out: 'ovs-vsctl: создан мост ' + br + ' (новый интерфейс ' + br + ' появился в ip link)', event: { type: 'terminal', msg: 'создан мост ' + br } };
  }

  function cmdAddPort(state, br, iface) {
    var blocked = needSvc(state);
    if (blocked) return blocked;
    if (!state.bridge) return { ok: false, out: 'ovs-vsctl: моста ещё нет — сначала add-br ' + SPEC.bridge };
    if (br !== state.bridge) return { ok: false, out: 'ovs-vsctl: нет моста с именем ' + br };
    if (SPEC.ifaces.indexOf(iface) === -1) return { ok: false, out: 'ovs-vsctl: интерфейс ' + iface + ' отсутствует на стенде (доступны ' + SPEC.ifaces.join(', ') + ')' };
    if (state.ports[iface]) return { ok: false, out: 'ovs-vsctl: порт ' + iface + ' уже добавлен в ' + br };
    state.ports[iface] = { tag: null, trunks: null };
    return { out: 'ovs-vsctl: интерфейс ' + iface + ' добавлен в мост ' + br + ' (пока без VLAN)', event: { type: 'terminal', msg: 'добавлен порт ' + iface } };
  }

  function cmdSetPort(state, iface, param, value) {
    var blocked = needSvc(state);
    if (blocked) return blocked;
    var p = state.ports[iface];
    if (!p) return { ok: false, out: 'ovs-vsctl: порт ' + iface + ' не найден — сначала add-port ' + SPEC.bridge + ' ' + iface };
    if (param === 'tag') {
      var vid = parseInt(value, 10);
      if (!vid || vid < 1 || vid > 4094) return { ok: false, out: 'ovs-vsctl: VLAN ID должен быть числом 1–4094' };
      p.tag = vid; p.trunks = null;
      return { out: 'ovs-vsctl: ' + iface + ' → access-порт, нетегированный трафик уходит в VLAN ' + vid, event: { type: 'terminal', msg: iface + ' tag=' + vid } };
    }
    if (param === 'trunks') {
      var ids = String(value).split(',').map(function (x) { return parseInt(x.trim(), 10); }).filter(function (n) { return n >= 1 && n <= 4094; });
      if (!ids.length) return { ok: false, out: 'ovs-vsctl: перечислите VLAN через запятую, например trunks=10,20' };
      p.trunks = ids; p.tag = null;
      return { out: 'ovs-vsctl: ' + iface + ' → trunk, разрешены VLAN [' + ids.join(', ') + '] (теги 802.1Q)', event: { type: 'terminal', msg: iface + ' trunks=' + ids.join(',') } };
    }
    return { ok: false, out: 'ovs-vsctl: неизвестный параметр ' + param + ' (используйте tag или trunks)' };
  }

  function cmdShow(state) {
    var blocked = needSvc(state);
    if (blocked) return blocked;
    state.showRan = true;
    if (!state.bridge) return { out: 'ovs-vsctl: // мостов нет' };
    return { out: stateToText(state), event: { type: 'terminal', msg: 'выполнена проверка ovs-vsctl show' } };
  }

  function cmdOfctl(state) {
    var blocked = needSvc(state);
    if (blocked) return blocked;
    if (!state.bridge) return { ok: false, out: 'ovs-ofctl: моста нет' };
    var rows = ['OFPT_FEATURES_REPLY (dpid=0000000000000001):', ' port(s):'];
    SPEC.ifaces.forEach(function (name, i) {
      var p = state.ports[name];
      rows.push((i + 1) + '(' + name + '): addr:00:0' + (i + 1) + ':00:00:00:0' + (i + 1) +
        '  config: 0  state: 0  current: ' + (p ? 'LINK_UP' : 'LINK_DOWN'));
    });
    return { out: rows.join('\n') };
  }

  function cmdIpLink(state) {
    var rows = ['1: lo: <LOOPBACK,UP>', '2: enp0s3: <BROADCAST,MULTICAST,UP> mtu 1500 (NAT/WAN)'];
    var n = 3;
    SPEC.ifaces.forEach(function (name) {
      var kind = state.ports[name] ? ' ovs_slave_of:' + SPEC.bridge : ' обычный NIC';
      rows.push(n + ': ' + name + ': <BROADCAST,MULTICAST,UP> mtu 1500' + kind);
      n++;
    });
    if (state.bridge) rows.push(n + ': ' + state.bridge + ': <BROADCAST,MULTICAST,UP> mtu 1500  ovs-system (внутренний интерфейс моста)');
    return { out: rows.join('\n') };
  }

  function runCommand(line, ctx) {
    var state = ctx && ctx.state ? ctx.state : freshState();
    var key = String(line || '').trim().replace(/\s+/g, ' ');
    if (!key) return { out: '' };
    if (key === 'clear') return { clear: true };
    if (key === 'help') return cmdHelp();

    var m;
    if ((m = key.match(/^sudo apt-get install openvswitch-switch$/))) return cmdInstall(state);
    if ((m = key.match(/^sudo systemctl (enable --now|start|restart) openvswitch$/))) return cmdSystemctl(state, m[1]);
    if ((m = key.match(/^sudo systemctl status openvswitch$/))) return cmdSystemctl(state, 'status');
    if ((m = key.match(/^sudo ovs-vsctl add-br (\S+)$/))) return cmdAddBr(state, m[1]);
    if ((m = key.match(/^sudo ovs-vsctl add-port (\S+) (\S+)$/))) return cmdAddPort(state, m[1], m[2]);
    if ((m = key.match(/^sudo ovs-vsctl set port (\S+) (tag|trunks)=([0-9,]+)$/))) return cmdSetPort(state, m[1], m[2], m[3]);
    if (key === 'ovs-vsctl show' || key === 'sudo ovs-vsctl show') return cmdShow(state);
    if ((m = key.match(/^sudo ovs-ofctl show (\S+)$/))) {
      if (m[1] !== SPEC.bridge) return { ok: false, out: 'ovs-ofctl: моста ' + m[1] + ' нет' };
      return cmdOfctl(state);
    }
    if (key === 'ip -d link show' || key === 'ip link show') return cmdIpLink(state);

    var bin = key.split(' ')[0].replace('sudo', '').trim() || key.split(' ')[1];
    return { ok: false, out: 'bash: ' + bin + ': команда не найдена в стенде (введите help)' };
  }

  /* ----------------------------- Проверки ----------------------------- */
  var CHECKS = [
    {
      id: 'service', title: 'OVS установлен и служба openvswitch запущена',
      run: function (s) {
        if (!s.installed) return { ok: false, hint: 'Нет пакета: sudo apt-get install openvswitch-switch' };
        if (!s.enabled) return { ok: false, hint: 'Пакет есть, но служба не активна: systemctl enable --now openvswitch' };
        return { ok: true, hint: 'openvswitch active (running)' };
      }
    },
    {
      id: 'bridge', title: 'Создан мост ' + SPEC.bridge + ' (ovs-vsctl add-br)',
      run: function (s) {
        if (!s.bridge) return { ok: false, hint: 'Мост не создан — sudo ovs-vsctl add-br ' + SPEC.bridge };
        if (s.bridge !== SPEC.bridge) return { ok: false, hint: 'Ожидался мост ' + SPEC.bridge + ', найден ' + s.bridge };
        return { ok: true, hint: 'мост ' + SPEC.bridge + ' поднят' };
      }
    },
    {
      id: 'eth1', title: 'eth1 — access-порт VLAN 10 (tag=10)',
      run: function (s) {
        var p = s.ports.eth1;
        if (!p) return { ok: false, hint: 'eth1 не добавлен в мост' };
        if (p.tag !== 10) return { ok: false, hint: 'Нужен access VLAN 10: ovs-vsctl set port eth1 tag=10' };
        return { ok: true, hint: 'eth1 → access 10 (' + SPEC.vlans[10] + ')' };
      }
    },
    {
      id: 'eth2', title: 'eth2 — access-порт VLAN 20 (tag=20)',
      run: function (s) {
        var p = s.ports.eth2;
        if (!p) return { ok: false, hint: 'eth2 не добавлен в мост' };
        if (p.tag !== 20) return { ok: false, hint: 'Нужен access VLAN 20: ovs-vsctl set port eth2 tag=20' };
        return { ok: true, hint: 'eth2 → access 20 (' + SPEC.vlans[20] + ')' };
      }
    },
    {
      id: 'eth3', title: 'eth3 — trunk с VLAN 10 и 20 (trunks=10,20)',
      run: function (s) {
        var p = s.ports.eth3;
        if (!p) return { ok: false, hint: 'eth3 не добавлен в мост' };
        if (!p.trunks) return { ok: false, hint: 'eth3 сейчас access — аплинку нужен trunk: set port eth3 trunks=10,20' };
        var has10 = p.trunks.indexOf(10) !== -1, has20 = p.trunks.indexOf(20) !== -1;
        if (!has10 || !has20) return { ok: false, hint: 'В trunk должны присутствовать оба VLAN — 10 и 20' };
        return { ok: true, hint: 'eth3 → trunk [10, 20], теги 802.1Q' };
      }
    },
    {
      id: 'ports', title: 'На мосту ровно три порта eth1–eth3, лишних нет',
      run: function (s) {
        var names = Object.keys(s.ports);
        if (names.length !== 3) return { ok: false, hint: 'Портов сейчас ' + names.length + ', по заданию 3: eth1, eth2, eth3' };
        var extra = names.filter(function (n) { return SPEC.ifaces.indexOf(n) === -1; });
        if (extra.length) return { ok: false, hint: 'Лишние порты: ' + extra.join(', ') };
        return { ok: true, hint: 'eth1, eth2, eth3 — полный комплект' };
      }
    }
  ];

  function validate(state) {
    var s = state || freshState();
    var checks = CHECKS.map(function (c) {
      var r = c.run(s);
      return { id: c.id, title: c.title, ok: !!r.ok, hint: r.hint };
    });
    var passed = checks.filter(function (c) { return c.ok; }).length;
    return {
      checks: checks,
      passed: passed,
      total: checks.length,
      score: Math.round((passed / checks.length) * 100),
      ready: passed === checks.length
    };
  }

  /* Статус шагов плана для панели прогресса (history — журнал введённых команд) */
  function taskStatus(state, history) {
    history = history || [];
    var ran = function (re) { return history.some(function (h) { return re.test(h.line || ''); }); };
    return {
      t1: state.installed && state.enabled,
      t2: state.bridge === SPEC.bridge,
      t3: ['eth1', 'eth2', 'eth3'].every(function (n) { return !!state.ports[n]; }),
      t4: (state.ports.eth1 && state.ports.eth1.tag === 10) && (state.ports.eth2 && state.ports.eth2.tag === 20),
      t5: state.ports.eth3 && Array.isArray(state.ports.eth3.trunks) && state.ports.eth3.trunks.indexOf(10) !== -1 && state.ports.eth3.trunks.indexOf(20) !== -1,
      t6: state.showRan === true || ran(/ovs-vsctl show/)
    };
  }

  var TASKS = [
    { id: 't1', title: 'Установить Open vSwitch и запустить службу', kind: 'terminal' },
    { id: 't2', title: 'Создать мост br0', kind: 'terminal' },
    { id: 't3', title: 'Добавить порты eth1, eth2, eth3', kind: 'terminal' },
    { id: 't4', title: 'Назначить access-портам VLAN 10 и 20', kind: 'terminal' },
    { id: 't5', title: 'Настроить trunk на eth3 (VLAN 10, 20)', kind: 'terminal' },
    { id: 't6', title: 'Проверить конфигурацию через ovs-vsctl show', kind: 'terminal' }
  ];

  var GOALS = [
    'Объяснять, что делает коммутатор на канальном уровне: MAC-таблица, доставка кадров, flooding',
    'Описывать роль Open vSwitch в Linux-системах и его компоненты: ovs-vswitchd, OVSDB, OpenFlow',
    'Создавать мост и добавлять порты командами ovs-vsctl add-br/add-port',
    'Различать access- и trunk-порты, настраивать VLAN через tag и trunks (802.1Q)',
    'Проверять коммутацию утилитами ovs-vsctl, ovs-ofctl и ip'
  ];

  var QUIZ = [
    {
      q: 'На каком уровне модели OSI работает коммутатор?',
      options: ['Сетевой (L3), по IP-адресам', 'Канальный (L2), по MAC-адресам', 'Транспортный (L4), по портам TCP/UDP', 'Физический (L1), просто усилитель сигнала'],
      answer: 1,
      explain: 'Коммутатор учит MAC-адреса и доставляет кадры внутри сети. Маршрутизацией по IP занимается маршрутизатор (L3).'
    },
    {
      q: 'Что такое Open vSwitch?',
      options: ['Графический сетевой редактор для схем', 'Виртуальный многопротокольный коммутатор с управлением через OVSDB и OpenFlow', 'Драйвер Wi-Fi для рабочих станций', 'Файрвол, заменяющий iptables'],
      answer: 1,
      explain: 'OVS — программный коммутатор для виртуализированных сред: ovs-vswitchd коммутирует трафик, OVSDB хранит конфигурацию, OpenFlow задаёт правила.'
    },
    {
      q: 'Как ведёт себя access-порт с VLAN 10?',
      options: ['Пропускает все VLAN подряд', 'Принимает нетегированный трафик и помещает его в VLAN 10', 'Добавляет тег 802.1Q ко всем исходящим кадрам', 'Работает только с IPv6'],
      answer: 1,
      explain: 'Access-порт подключает одно устройство к одному VLAN: входящие нетегированные кадры получают тег VLAN, на выходе тег снимается.'
    },
    {
      q: 'Зачем нужен trunk-порт между коммутаторами?',
      options: ['Чтобы ускорить трафик за счёт отключения VLAN', 'Чтобы передавать трафик нескольких VLAN в одном линке по тегам 802.1Q', 'Чтобы объединить две подсети в одну', 'Чтобы назначить всем портам один MAC-адрес'],
      answer: 1,
      explain: 'Trunk мультиплексирует несколько VLAN в одно физическое соединение; кадры помечаются тегами, и приёмник понимает, какому VLAN кадр принадлежит.'
    },
    {
      q: 'В чём разница между ovs-vsctl и ovs-ofctl?',
      options: ['Нет разницы, это синонимы', 'ovs-vsctl настраивает мосты/порты через OVSDB, ovs-ofctl управляет flow-правилами по OpenFlow', 'ovs-ofctl настраивает мосты, ovs-vsctl показывает погоду', 'ovs-vsctl работает только на Windows'],
      answer: 1,
      explain: 'ovs-vsctl — конфигурация коммутатора (мосты, порты, VLAN) в базе OVSDB; ovs-ofctl — просмотр и управление таблицами потоков OpenFlow.'
    }
  ];

  return {
    SPEC: SPEC,
    TASKS: TASKS,
    GOALS: GOALS,
    QUIZ: QUIZ,
    freshState: freshState,
    brokenState: brokenState,
    stateToText: stateToText,
    validate: validate,
    taskStatus: taskStatus,
    runCommand: runCommand
  };
});
