/* ==========================================================================
   Виртуальные стенды · коммутация на Open vSwitch (Linux)
   Логика без DOM. Состояние OVSDB живёт внутри виртуальной машины os-engine.js:
   пакет openvswitch-switch, служба openvswitch, мост/порты/VLAN, ovs-vsctl,
   ovs-ofctl, ip. sudo опционален — команды работают и с ним, и без него.
   UMD: браузер (window.OVS) и Node (юнит-тесты).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./os-engine.js'));
  else root.OVS = factory(root.OSEngine);
})(typeof self !== 'undefined' ? self : this, function (OSEngine) {
  'use strict';

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
  var UNIT = 'openvswitch';
  var PKG = 'openvswitch-switch';

  function freshState() {
    return { installed: false, enabled: false, bridge: null, ports: {}, showRan: false };
  }

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

  /* ----------------------------- Проверки (контракт 6/6) ----------------------------- */
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

  function taskStatus(state, history) {
    history = history || [];
    var ran = function (re) { return history.some(function (h) { return re.test(h.line || h); }); };
    return {
      t1: state.installed && state.enabled,
      t2: state.bridge === SPEC.bridge,
      t3: ['eth1', 'eth2', 'eth3'].every(function (n) { return !!state.ports[n]; }),
      t4: (state.ports.eth1 && state.ports.eth1.tag === 10) && (state.ports.eth2 && state.ports.eth2.tag === 20),
      t5: state.ports.eth3 && Array.isArray(state.ports.eth3.trunks) && state.ports.eth3.trunks.indexOf(10) !== -1 && state.ports.eth3.trunks.indexOf(20) !== -1,
      t6: state.showRan === true || ran(/ovs-vsctl show/)
    };
  }

  /* ----------------------------- Виртуальная машина ----------------------------- */
  function createWorld(snapshot) {
    var os = OSEngine.createOS({
      hostname: 'ovs',
      user: 'student',
      editorMessage: 'на этом стенде конфигурация собирается командами ovs-vsctl в терминале',
      helpExtra: [
        '  стенд OVS:  ovs-vsctl add-br|add-port|set|del-port|show|list',
        '              ovs-ofctl show ' + SPEC.bridge + ', ip link show'
      ],
      initFs: function (vfs) {
        vfs.mkdirp('/etc/openvswitch');
        vfs.write('/etc/hostname', 'ovs-node\n');
        vfs.write('/etc/openvswitch/conf.db', '// OVSDB: база создаётся службой openvswitch\n');
      },
      resolvePackage: function (pkg) {
        if (/openvswitch/.test(pkg)) return { package: PKG, service: UNIT, version: '3.2-alt1', hint: 'подсказка: запустите службу — systemctl enable --now ' + UNIT };
        return { package: pkg, service: pkg, version: '1.0-alt1', hint: '' };
      },
      journal: journal,
      renderIp: renderIp,
      commands: {
        'ovs-vsctl': { usage: 'ovs-vsctl <подкоманда>', help: 'управление OVSDB: мосты, порты, VLAN', run: cmdVsvtl },
        'ovs-ofctl': { usage: 'ovs-ofctl <подкоманда> ' + SPEC.bridge, help: 'управление OpenFlow: таблицы потоков и портов', run: cmdOfctl },
        'ovs-appctl': { usage: 'ovs-appctl <подкоманда>', help: 'внутренние команды демона ovs-vswitchd', run: cmdAppctl }
      }
    }, snapshot);

    if (!os.state.ovs) os.state.ovs = freshState();

    function db() { return os.state.ovs; }
    /* OVS-состояние — проекция реестра пакетов/служб виртуальной ОС */
    function sync() {
      var s = db(), svc = os.service(UNIT);
      s.installed = svc.installed;
      s.enabled = svc.active;
      return s;
    }
    function needSvc() {
      var s = sync();
      if (!s.installed) return { out: 'ovs-vsctl: Open vSwitch не установлен — apt-get install ' + PKG, code: 1, isErr: true };
      if (!s.enabled) return { out: 'ovs-vsctl: служба ' + UNIT + ' не запущена — systemctl enable --now ' + UNIT, code: 1, isErr: true };
      return null;
    }

    function journal(state, unit, mode) {
      if (unit && unit !== UNIT) return { out: '-- No entries -- для ' + unit, code: 0 };
      var s = sync();
      if (!s.installed) return { out: 'Unit ' + UNIT + '.service could not be found.', code: 5, isErr: true };
      if (!s.enabled) return { out: '○ ' + UNIT + '.service — Open vSwitch Forwarding Unit\n   Active: inactive (dead)', code: 0 };
      var base = [
        'ovsdb-server[711]: ovsdb_server: opened database /etc/openvswitch/conf.db',
        'ovs-vswitchd[742]: ovs_vswitchd: starting up'
      ];
      if (s.bridge) base.push('ovs-vswitchd[742]: bridge ' + s.bridge + ': added interface');
      if (mode === 'status') {
        return { out: '● ' + UNIT + '.service — active (running)\n   Main PID: 742 (ovs-vswitchd)\n\n' + base.join('\n'), code: 0 };
      }
      return { out: base.join('\n'), code: 0 };
    }

    function renderIp(state, kind) {
      var s = sync();
      if (kind === 'route') return { out: 'default via 10.0.2.2 dev enp0s3\n10.0.2.0/24 dev enp0s3 proto kernel scope link', code: 0 };
      var rows = ['1: lo: <LOOPBACK,UP>', '2: enp0s3: <BROADCAST,MULTICAST,UP> mtu 1500 (NAT/WAN)'];
      var n = 3;
      SPEC.ifaces.forEach(function (name) {
        var kind2 = s.ports[name] ? ' ovs_slave_of:' + SPEC.bridge : ' обычный NIC';
        rows.push(n + ': ' + name + ': <BROADCAST,MULTICAST,UP> mtu 1500' + kind2);
        n++;
      });
      if (s.bridge) rows.push(n + ': ' + s.bridge + ': <BROADCAST,MULTICAST,UP> mtu 1500  ovs-system (внутренний интерфейс моста)');
      return { out: rows.join('\n'), code: 0 };
    }

    function cmdVsvtl(a, state) {
      var s = db();
      var args = a.positionals;
      var sub = args[0];
      var blocked = needSvc();
      if (sub === '--version') return { out: 'ovs-vsctl (Open vSwitch) 3.2.0\nDB Schema 8.3.0', code: 0 };
      if (blocked && sub !== 'show') return blocked;
      if (!sub || sub === 'show') {
        if (blocked) return blocked;
        s.showRan = true;
        if (!s.bridge) return { out: 'ovs-vsctl: // мостов нет', code: 0, event: { type: 'terminal', msg: 'выполнена проверка ovs-vsctl show' } };
        return { out: stateToText(s), code: 0, event: { type: 'terminal', msg: 'выполнена проверка ovs-vsctl show' } };
      }
      var m;
      var raw = a.positionals.join(' ');
      if (sub === 'add-br') {
        var br = args[1];
        if (br !== SPEC.bridge) return { out: 'ovs-vsctl: по заданию мост должен называться ' + SPEC.bridge, code: 1, isErr: true };
        if (s.bridge) return { out: 'ovs-vsctl: мост ' + br + ' уже существует', code: 1, isErr: true };
        s.bridge = br;
        return { out: 'ovs-vsctl: создан мост ' + br + ' (новый интерфейс ' + br + ' появился в ip link)', code: 0, event: { type: 'terminal', msg: 'создан мост ' + br } };
      }
      if (sub === 'add-port') {
        var b = args[1], iface = args[2];
        if (!s.bridge) return { out: 'ovs-vsctl: моста ещё нет — сначала add-br ' + SPEC.bridge, code: 1, isErr: true };
        if (b !== s.bridge) return { out: 'ovs-vsctl: нет моста с именем ' + b, code: 1, isErr: true };
        if (SPEC.ifaces.indexOf(iface) === -1) return { out: 'ovs-vsctl: интерфейс ' + iface + ' отсутствует на стенде (доступны ' + SPEC.ifaces.join(', ') + ')', code: 1, isErr: true };
        if (s.ports[iface]) return { out: 'ovs-vsctl: порт ' + iface + ' уже добавлен в ' + b, code: 1, isErr: true };
        s.ports[iface] = { tag: null, trunks: null };
        return { out: 'ovs-vsctl: интерфейс ' + iface + ' добавлен в мост ' + b + ' (пока без VLAN)', code: 0, event: { type: 'terminal', msg: 'добавлен порт ' + iface } };
      }
      if (sub === 'del-port') {
        var dp = args[2];
        if (!s.ports[dp]) return { out: 'ovs-vsctl: порт ' + dp + ' не найден на мосту ' + SPEC.bridge, code: 1, isErr: true };
        delete s.ports[dp];
        return { out: 'ovs-vsctl: порт ' + dp + ' удалён', code: 0, event: { type: 'terminal', msg: 'удалён порт ' + dp } };
      }
      if (sub === 'set' && args[1] === 'port') {
        var name = args[2], assign = args[3] || '';
        var p = s.ports[name];
        if (!p) return { out: 'ovs-vsctl: порт ' + name + ' не найден — сначала add-port ' + SPEC.bridge + ' ' + name, code: 1, isErr: true };
        if ((m = assign.match(/^(tag|trunks)=([0-9,]+)$/))) {
          var param = m[1], value = m[2];
          if (param === 'tag') {
            var vid = parseInt(value, 10);
            if (!vid || vid < 1 || vid > 4094) return { out: 'ovs-vsctl: VLAN ID должен быть числом 1–4094', code: 1, isErr: true };
            p.tag = vid; p.trunks = null;
            return { out: 'ovs-vsctl: ' + name + ' → access-порт, нетегированный трафик уходит в VLAN ' + vid, code: 0, event: { type: 'terminal', msg: name + ' tag=' + vid } };
          }
          var ids = value.split(',').map(function (x) { return parseInt(x.trim(), 10); }).filter(function (n) { return n >= 1 && n <= 4094; });
          if (!ids.length) return { out: 'ovs-vsctl: перечислите VLAN через запятую, например trunks=10,20', code: 1, isErr: true };
          p.trunks = ids; p.tag = null;
          return { out: 'ovs-vsctl: ' + name + ' → trunk, разрешены VLAN [' + ids.join(', ') + '] (теги 802.1Q)', code: 0, event: { type: 'terminal', msg: name + ' trunks=' + ids.join(',') } };
        }
        return { out: 'ovs-vsctl: неизвестный параметр (используйте tag=VLAN или trunks=10,20)', code: 1, isErr: true };
      }
      if (sub === 'list') {
        var what = args[1] || 'br';
        if (what === 'br' || what === 'bridge') return { out: '_uuid               name\n' + (s.bridge ? 'uuid-0001            ' + s.bridge : '// записей нет'), code: 0 };
        if (what === 'port' || what === 'interface') {
          var names = Object.keys(s.ports);
          return { out: names.length ? names.map(function (n) { return 'uuid-' + n + '  name=' + n; }).join('\n') : '// записей нет', code: 0 };
        }
        return { out: 'ovs-vsctl: неизвестная таблица ' + what, code: 1, isErr: true };
      }
      if (sub === 'get') return { out: 'ovs-vsctl: укажите таблицу и поле, например get port eth1 tag', code: 1 };
      return { out: 'ovs-vsctl: неизвестная подкоманда «' + sub + '» (введите help)', code: 1, isErr: true };
    }

    function cmdOfctl(a) {
      var s = db();
      var blocked = needSvc();
      if (blocked) return blocked;
      var sub = a.positionals[0], br = a.positionals[1];
      if (!sub) return { out: 'Usage: ovs-ofctl show|dump-flows|dump-ports BRIDGE', code: 2, isErr: true };
      if (br && br !== SPEC.bridge) return { out: 'ovs-ofctl: моста ' + br + ' нет', code: 1, isErr: true };
      if (!s.bridge) return { out: 'ovs-ofctl: моста нет — сначала ovs-vsctl add-br ' + SPEC.bridge, code: 1, isErr: true };
      if (sub === 'show') {
        var rows = ['OFPT_FEATURES_REPLY (dpid=0000000000000001):', ' ' + SPEC.ifaces.length + ' port(s):'];
        SPEC.ifaces.forEach(function (name, i) {
          var p = s.ports[name];
          rows.push((i + 1) + '(' + name + '): addr:00:0' + (i + 1) + ':00:00:00:0' + (i + 1) +
            '  config: 0  state: 0  current: ' + (p ? 'LINK_UP' : 'LINK_DOWN'));
        });
        return { out: rows.join('\n'), code: 0 };
      }
      if (sub === 'dump-flows') {
        return { out: 'cookie=0x0, duration=12.4s, table=0, n_packets=0, priority=0 actions=NORMAL', code: 0 };
      }
      if (sub === 'dump-ports') {
        return { out: SPEC.ifaces.map(function (n) { return n + ': rx pkts=0, tx pkts=0, rx drop=0, tx drop=0'; }).join('\n'), code: 0 };
      }
      return { out: 'ovs-ofctl: неизвестная подкоманда «' + sub + '»', code: 1, isErr: true };
    }

    function cmdAppctl(a) {
      var sub = a.positionals[0];
      var blocked = needSvc();
      if (blocked) return blocked;
      if (sub === 'version') return { out: 'ovs-vswitchd (Open vSwitch) 3.2.0', code: 0 };
      if (sub === 'bridge/reconnect') return { out: 'ovs-appctl: bridge ' + SPEC.bridge + ': reconnect requested', code: 0 };
      return { out: 'ovs-appctl: неизвестная команда «' + (sub || '') + '»', code: 1, isErr: true };
    }

    return {
      os: os,
      run: function (line) { return os.run(line); },
      state: function () { return sync(); },
      setState: function (s) {
        os.state.ovs = s;
        var svc = os.service(UNIT);
        svc.installed = !!s.installed;
        svc.enabled = !!s.enabled;
        svc.active = !!s.enabled;
      },
      snapshot: function () { return os.serialize(); },
      validate: function () { return validate(sync()); }
    };
  }

  /* Совместимость: старый вызов OVS.runCommand на эфемерной машине */
  var legacy = null;
  function runCommand(line, ctx) {
    if (!legacy) legacy = createWorld();
    if (ctx && ctx.state) legacy.setState(ctx.state);
    return legacy.run(line);
  }

  /* ----------------------------- Автотесты стенда ----------------------------- */
  function runAutotests() {
    var results = [];
    function t(id, title, fn) {
      var world = createWorld();
      var actual, expected, ok = false;
      try { var r = fn(world) || {}; ok = !!r.ok; actual = r.actual || ''; expected = r.expected || ''; }
      catch (e) { actual = 'исключение: ' + e.message; expected = 'без исключений'; }
      results.push({ id: id, title: title, ok: ok, actual: actual, expected: expected });
    }

    t('at-01', 'Установка Open vSwitch с sudo', function (w) {
      var r = w.run('sudo apt-get install ' + PKG);
      var again = w.run('sudo apt-get install ' + PKG);
      return { ok: r.code === 0 && /уже установлен/i.test(again.out), actual: again.out.slice(0, 60), expected: 'код 0, повторно: уже установлен' };
    });
    t('at-02', 'Установка без sudo тоже работает', function (w) {
      var r = w.run('apt-get install ' + PKG);
      return { ok: r.code === 0, actual: 'код ' + r.code, expected: 'код 0' };
    });
    t('at-03', 'ovs-vsctl до установки запрещён', function (w) {
      var r = w.run('ovs-vsctl add-br ' + SPEC.bridge);
      return { ok: r.code === 1 && /не установлен/.test(r.out), actual: r.out, expected: 'ошибка с подсказкой установки' };
    });
    t('at-04', 'Неизвестная команда возвращает 127', function (w) {
      var r = w.run('ifconfig');
      return { ok: r.code === 127, actual: 'код ' + r.code, expected: 'код 127' };
    });
    t('at-05', 'Полный позитивный путь до готовой конфигурации', function (w) {
      w.run('apt-get install ' + PKG);
      w.run('systemctl enable --now ' + UNIT);
      w.run('ovs-vsctl add-br ' + SPEC.bridge);
      w.run('ovs-vsctl add-port ' + SPEC.bridge + ' eth1');
      w.run('ovs-vsctl add-port ' + SPEC.bridge + ' eth2');
      w.run('ovs-vsctl add-port ' + SPEC.bridge + ' eth3');
      w.run('ovs-vsctl set port eth1 tag=10');
      w.run('ovs-vsctl set port eth2 tag=20');
      w.run('ovs-vsctl set port eth3 trunks=10,20');
      var show = w.run('ovs-vsctl show');
      var ofctl = w.run('ovs-ofctl show ' + SPEC.bridge);
      var v = w.validate();
      return {
        ok: v.ready && show.out.indexOf(SPEC.bridge) !== -1 && (ofctl.out.match(/LINK_UP/g) || []).length === 3,
        actual: 'проверок пройдено ' + v.passed + '/' + v.total + ', LINK_UP: ' + ((ofctl.out.match(/LINK_UP/g) || []).length),
        expected: '6/6 проверок и 3 LINK_UP'
      };
    });
    t('at-06', 'set port работает и с sudo, и без sudo', function (w) {
      w.run('apt-get install ' + PKG + ' && systemctl enable --now ' + UNIT);
      w.run('ovs-vsctl add-br ' + SPEC.bridge);
      w.run('sudo ovs-vsctl add-port ' + SPEC.bridge + ' eth1');
      var bare = w.run('ovs-vsctl set port eth1 tag=10');
      var withSudo = w.run('sudo ovs-vsctl set port eth1 tag=10');
      return { ok: bare.code === 0 && withSudo.code === 0 && w.state().ports.eth1.tag === 10, actual: 'tag=' + w.state().ports.eth1.tag, expected: 'tag=10 в обоих случаях' };
    });
    t('at-07', 'Bug report: eth3 ошибочно access, затем исправление на trunk', function (w) {
      w.run('apt-get install ' + PKG);
      w.setState(brokenState());
      var before = w.validate();
      var fix = w.run('ovs-vsctl set port eth3 trunks=10,20');
      var after = w.validate();
      return {
        ok: !before.ready && before.checks.find(function (c) { return c.id === 'eth3'; }).ok === false && fix.code === 0 && after.ready,
        actual: 'до: ' + before.passed + '/6, после: ' + after.passed + '/6',
        expected: 'ошибка eth3 до исправления, 6/6 после'
      };
    });
    t('at-08', 'Пайп grep и история команд', function (w) {
      w.run('apt-get install ' + PKG);
      w.run('systemctl enable --now ' + UNIT);
      w.run('ovs-vsctl add-br ' + SPEC.bridge);
      var piped = w.run('ovs-vsctl show | grep ' + SPEC.bridge);
      return { ok: new RegExp(SPEC.bridge).test(piped.out), actual: piped.out, expected: SPEC.bridge + ' в выводе пайпа' };
    });

    var passed = results.filter(function (r) { return r.ok; }).length;
    return { results: results, passed: passed, total: results.length, score: Math.round(passed / results.length * 100) };
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
    UNIT: UNIT,
    PKG: PKG,
    TASKS: TASKS,
    GOALS: GOALS,
    QUIZ: QUIZ,
    freshState: freshState,
    brokenState: brokenState,
    stateToText: stateToText,
    validate: validate,
    taskStatus: taskStatus,
    createWorld: createWorld,
    runAutotests: runAutotests,
    runCommand: runCommand
  };
});
