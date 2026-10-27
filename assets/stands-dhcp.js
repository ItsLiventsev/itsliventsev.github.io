/* ==========================================================================
   Виртуальные стенды · стенд DHCP (ALT Server / ALT Workstation)
   Логика без DOM. Терминал исполняется виртуальной машиной os-engine.js:
   ФС (/etc/dhcp/dhcpd.conf, leases, resolv.conf), пакеты, служба dhcp-server,
   динамические journalctl-логи, аренды dhclient, коды возврата, sudo опционален.
   UMD: браузер (window.DHCP) и Node (юнит-тесты).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./os-engine.js'));
  else root.DHCP = factory(root.OSEngine);
})(typeof self !== 'undefined' ? self : this, function (OSEngine) {
  'use strict';

  var NET = {
    subnet: '192.168.10.0',
    netmask: '255.255.255.0',
    gateway: '192.168.10.1',
    rangeStart: '192.168.10.100',
    rangeEnd: '192.168.10.200',
    printerMac: '00:11:22:33:44:55',
    printerIp: '192.168.10.50',
    iface: 'enp0s8',
    dns: ['8.8.8.8', '1.1.1.1']
  };
  var UNIT = 'dhcp-server';
  var PKG = 'dhcp-server';

  var BROKEN_CONFIG = [
    '# /etc/dhcp/dhcpd.conf — версия с ошибкой',
    'default-lease-time 600;',
    'max-lease-time 7200;',
    '',
    '# TODO: объявить subnet для enp0s8',
    '',
    'host printer {',
    '  hardware ethernet 00:11:22:33:44:55;',
    '  fixed-address 192.168.10.50;',
    '}'
  ].join('\n');

  var STARTER_CONFIG = [
    '# /etc/dhcp/dhcpd.conf',
    '# Заполните блоки по заданиям 02–05. Кнопка «проверить» подскажет, чего не хватает.',
    '',
    'default-lease-time 600;',
    'max-lease-time 7200;',
    '',
    '# TODO задание 02: subnet 192.168.10.0/24',
    '',
    '# TODO задание 05: резервирование принтера (host printer)',
    ''
  ].join('\n');

  /* Эталонный валидный конфиг — на нём строятся автотесты и подсказки */
  var GOOD_CONFIG = [
    '# /etc/dhcp/dhcpd.conf — эталонная конфигурация стенда',
    'default-lease-time 600;',
    'max-lease-time 7200;',
    'authoritative;',
    '',
    'subnet ' + NET.subnet + ' netmask ' + NET.netmask + ' {',
    '  range ' + NET.rangeStart + ' ' + NET.rangeEnd + ';',
    '  option routers ' + NET.gateway + ';',
    '  option domain-name-servers ' + NET.dns.join(', ') + ';',
    '}',
    '',
    'host printer {',
    '  hardware ethernet ' + NET.printerMac + ';',
    '  fixed-address ' + NET.printerIp + ';',
    '}'
  ].join('\n');

  function normMac(s) { return String(s || '').toLowerCase().replace(/[^0-9a-f]/g, ''); }
  function ipToInt(ip) {
    var p = String(ip).trim().split('.');
    if (p.length !== 4) return NaN;
    var n = 0;
    for (var i = 0; i < 4; i++) {
      var o = parseInt(p[i], 10);
      if (isNaN(o) || o < 0 || o > 255) return NaN;
      n = (n << 8) | o;
    }
    return n >>> 0;
  }
  function inSubnet(ip, net, mask) {
    var a = ipToInt(ip), n = ipToInt(net), m = ipToInt(mask);
    if (isNaN(a) || isNaN(n) || isNaN(m)) return false;
    return (a & m) === (n & m);
  }

  var CHECKS = [
    {
      id: 'syntax', title: 'Синтаксис: фигурные скобки сбалансированы, строки завершаются «;»',
      run: function (s) {
        var opens = (s.match(/{/g) || []).length;
        var closes = (s.match(/}/g) || []).length;
        if (opens !== closes) return { ok: false, hint: 'Дисбаланс { и }: ' + opens + ' против ' + closes };
        var bad = s.split('\n').filter(function (line) {
          var t = line.replace(/#.*$/, '').trim();
          if (!t || /[{}]\s*$/.test(t) || /[{}]/.test(t)) return false;
          return !/;\s*$/.test(t);
        });
        if (bad.length) return { ok: false, hint: 'Строки без точки с запятой: «' + bad[0].trim().slice(0, 48) + '»' };
        return { ok: true, hint: 'Синтаксис в порядке' };
      }
    },
    {
      id: 'subnet', title: 'Объявлена подсеть ' + NET.subnet + '/24 (subnet … netmask …)',
      run: function (s) {
        var re = /subnet\s+([0-9.]+)\s+netmask\s+([0-9.]+)\s*{/i;
        var m = s.match(re);
        if (!m) return { ok: false, hint: 'Нет блока subnet — именно это вызывает «No subnet declaration for ' + NET.iface + '»' };
        if (m[1] !== NET.subnet || m[2] !== NET.netmask) return { ok: false, hint: 'Ожидалась ' + NET.subnet + ' / ' + NET.netmask + ', найдено ' + m[1] + ' / ' + m[2] };
        return { ok: true, hint: 'subnet ' + NET.subnet + ' netmask ' + NET.netmask };
      }
    },
    {
      id: 'range', title: 'Пул адресов range внутри подсети (100–200)',
      run: function (s) {
        var m = s.match(/range\s+([0-9.]+)\s+([0-9.]+)\s*;/i);
        if (!m) return { ok: false, hint: 'Нет директивы range <start> <end>;' };
        var a = ipToInt(m[1]), b = ipToInt(m[2]);
        if (isNaN(a) || isNaN(b)) return { ok: false, hint: 'Некорректные IP в range' };
        if (a > b) return { ok: false, hint: 'range: начальный адрес больше конечного' };
        if (!inSubnet(m[1], NET.subnet, NET.netmask) || !inSubnet(m[2], NET.subnet, NET.netmask))
          return { ok: false, hint: 'Пул выходит за пределы ' + NET.subnet + '/24' };
        if (a !== ipToInt(NET.rangeStart) || b !== ipToInt(NET.rangeEnd))
          return { ok: false, hint: 'По заданию пул ' + NET.rangeStart + '–' + NET.rangeEnd + ', проверьте границы' };
        return { ok: true, hint: 'range ' + NET.rangeStart + ' ' + NET.rangeEnd };
      }
    },
    {
      id: 'routers', title: 'Шлюз по умолчанию: option routers ' + NET.gateway,
      run: function (s) {
        var m = s.match(/option\s+routers\s+([0-9.]+)\s*;/i);
        if (!m) return { ok: false, hint: 'Нет «option routers <ip>;»' };
        if (m[1] !== NET.gateway) return { ok: false, hint: 'Шлюз должен быть ' + NET.gateway + ', найден ' + m[1] };
        return { ok: true, hint: 'routers ' + NET.gateway };
      }
    },
    {
      id: 'dns', title: 'DNS-серверы: option domain-name-servers',
      run: function (s) {
        var m = s.match(/option\s+domain-name-servers\s+([^;]+);/i);
        if (!m) return { ok: false, hint: 'Нет директивы domain-name-servers' };
        var ips = m[1].split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        if (!ips.length || ips.some(function (ip) { return isNaN(ipToInt(ip)); }))
          return { ok: false, hint: 'Перечислите хотя бы один валидный IP DNS' };
        return { ok: true, hint: 'DNS: ' + ips.join(', ') };
      }
    },
    {
      id: 'reservation', title: 'Резерв принтера: host printer с MAC и fixed-address ' + NET.printerIp,
      run: function (s) {
        var block = s.match(/host\s+printer\s*{([\s\S]*?)}/i);
        if (!block) return { ok: false, hint: 'Нет блока host printer { … }' };
        var body = block[1];
        var mac = body.match(/hardware\s+ethernet\s+([0-9a-fA-F:.\-]+)\s*;/i);
        var fixed = body.match(/fixed-address\s+([0-9.]+)\s*;/i);
        if (!mac) return { ok: false, hint: 'В блоке printer нет hardware ethernet …;' };
        if (normMac(mac[1]) !== normMac(NET.printerMac))
          return { ok: false, hint: 'MAC принтера должен быть ' + NET.printerMac };
        if (!fixed) return { ok: false, hint: 'Нет fixed-address …;' };
        if (fixed[1] !== NET.printerIp) return { ok: false, hint: 'fixed-address должен быть ' + NET.printerIp };
        if (inSubnet(fixed[1], NET.rangeStart, NET.netmask) && ipToInt(fixed[1]) >= ipToInt(NET.rangeStart) && ipToInt(fixed[1]) <= ipToInt(NET.rangeEnd))
          return { ok: false, hint: 'Зарезервированный адрес попал в динамический пул — вынесите его до .100' };
        return { ok: true, hint: 'printer → ' + NET.printerIp + ' (' + NET.printerMac + ')' };
      }
    },
    {
      id: 'authoritative', title: 'Сервер помечен authoritative;',
      run: function (s) {
        if (!/\bauthoritative\s*;/i.test(s)) return { ok: false, hint: 'Добавьте «authoritative;» — клиенты быстрее переподключатся' };
        return { ok: true, hint: 'authoritative;' };
      }
    }
  ];

  function validateDhcpConfig(text) {
    var checks = CHECKS.map(function (c) {
      var r = c.run(text || '');
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

  /* ----------------------------- Виртуальная машина ----------------------------- */
  function createWorld(snapshot) {
    var os = OSEngine.createOS({
      hostname: 'alt',
      user: 'student',
      editorMessage: 'на этом стенде конфиг правится в панели «редактор» (/etc/dhcp/dhcpd.conf синхронизирован с ней)',
      helpExtra: [
        '  стенд DHCP:  mcedit /etc/dhcp/dhcpd.conf, dhclient -v ' + NET.iface,
        '               systemctl status ' + UNIT + ', journalctl -u ' + UNIT
      ],
      initFs: function (vfs) {
        vfs.mkdirp('/etc/dhcp');
        vfs.mkdirp('/var/lib/dhcpd');
        vfs.write('/etc/dhcp/dhcpd.conf', STARTER_CONFIG);
        vfs.write('/etc/hostname', 'alt-server\n');
        vfs.write('/etc/hosts', '127.0.0.1 localhost\n' + NET.gateway + ' alt-server\n');
        vfs.write('/etc/resolv.conf', 'nameserver ' + NET.dns[0] + '\nnameserver ' + NET.dns[1] + '\n');
        vfs.write('/var/lib/dhcpd/dhcpd.leases', '# формат ISC dhcpd.leases — аренды появляются после dhclient\n');
      },
      resolvePackage: function (pkg) {
        if (/dhcp/.test(pkg)) return { package: PKG, service: UNIT, version: '4.4.3-alt1', hint: 'подсказка: ' + UNIT + ' настраивается в /etc/dhcp/dhcpd.conf' };
        if (pkg === 'nano' || pkg === 'mc') return { package: pkg, service: pkg, version: 'alt1', hint: '' };
        return { package: pkg, service: pkg, version: '1.0-alt1', hint: '' };
      },
      journal: journal,
      renderIp: renderIp,
      ping: ping,
      dns: dns,
      commands: {
        dhclient: { usage: 'dhclient [-v] ' + NET.iface, help: 'запросить адрес по DHCP на клиенте', run: cmdDhclient },
        mcedit: { usage: 'mcedit /etc/dhcp/dhcpd.conf', help: 'редактор (на стенде — панель редактора)', run: editorCmd },
        nano: { usage: 'nano /etc/dhcp/dhcpd.conf', help: 'редактор (на стенде — панель редактора)', run: editorCmd },
        vim: { usage: 'vim /etc/dhcp/dhcpd.conf', help: 'редактор (на стенде — панель редактора)', run: editorCmd },
        vi: { usage: 'vi /etc/dhcp/dhcpd.conf', help: 'редактор (на стенде — панель редактора)', run: editorCmd }
      }
    }, snapshot);

    os.service(UNIT).installed = false;

    function svc() { return os.service(UNIT); }
    function currentConfig() { return os.vfs.read('/etc/dhcp/dhcpd.conf') || ''; }
    function setConfig(text) { os.vfs.write('/etc/dhcp/dhcpd.conf', String(text)); }
    function validation() { return validateDhcpConfig(currentConfig()); }

    function journal(state, unit, mode) {
      var s = svc();
      if (unit && unit !== UNIT) return { out: '-- No entries -- для ' + unit, code: 0 };
      if (!s.installed) return { out: 'Unit ' + UNIT + '.service could not be found.', code: 5, isErr: true };
      if (!s.active) {
        return {
          out: '○ ' + UNIT + '.service — DHCPv4 Server Daemon\n   Loaded: loaded (/lib/systemd/system/' + UNIT + '.service; disabled)\n   Active: inactive (dead)',
          code: 0
        };
      }
      var v = validation();
      if (!v.ready) {
        var failed = v.checks.filter(function (c) { return !c.ok; }).slice(0, 3);
        var lines = [
          'dhcpd[812]: Internet Systems Consortium DHCP Server 4.4.3',
          'dhcpd[812]: /etc/dhcp/dhcpd.conf:'
        ];
        failed.forEach(function (c, i) { lines.push('dhcpd[812]:   ошибка: ' + c.hint); });
        lines.push('dhcpd[812]: Configuration file errors encountered -- exiting');
        lines.push('systemd[1]: ' + UNIT + '.service: Failed with result \'exit-code\'.');
        return { out: lines.join('\n'), code: 0 };
      }
      var lines = [
        'dhcpd[942]: Internet Systems Consortium DHCP Server 4.4.3',
        'dhcpd[942]: For consistency, lease file was parsed',
        'dhcpd[942]: Listening on LPF/' + NET.iface + '/0a:00:27:00:00:08/24',
        'dhcpd[942]: Sending on   LPF/' + NET.iface + '/' + NET.subnet + '/24',
        'dhcpd[942]: Server starting service.'
      ];
      state.leases.forEach(function (l) {
        lines.push('dhcpd[942]: DHCPACK on ' + l.ip + ' to ' + l.mac + ' (' + (l.hostname || 'client') + ') via ' + NET.iface);
      });
      if (mode === 'status') {
        return {
          out: '● ' + UNIT + '.service — active (running)\n   Loaded: loaded; Main PID: 942 (dhcpd)\n   Active: active since ' + new Date(state.bootAt).toLocaleString('ru-RU') + '\n   Listening on ' + NET.iface + '/0.0.0.0:67\n\n' + lines.slice(-5).join('\n'),
          code: 0
        };
      }
      return { out: lines.join('\n'), code: 0 };
    }

    function renderIp(state, kind) {
      if (kind === 'route') {
        return {
          out: [
            'default via ' + NET.gateway + ' dev ' + NET.iface,
            NET.subnet + '/24 dev ' + NET.iface + ' proto kernel scope link',
            '10.0.2.0/24 dev enp0s3 proto kernel scope link'
          ].join('\n'), code: 0
        };
      }
      if (kind === 'link') {
        return {
          out: ['1: lo: <LOOPBACK,UP>', '2: enp0s3: <BROADCAST,MULTICAST,UP> mtu 1500', '3: ' + NET.iface + ': <BROADCAST,MULTICAST,UP> mtu 1500'].join('\n'), code: 0
        };
      }
      var rows = [
        '1: lo: <LOOPBACK,UP> mtu 65536',
        '    inet 127.0.0.1/8',
        '2: enp0s3: <BROADCAST,MULTICAST,UP> mtu 1500',
        '    inet 10.0.2.15/24 (NAT/WAN)',
        '3: ' + NET.iface + ': <BROADCAST,MULTICAST,UP,UPLOWER_UP> mtu 1500',
        '    inet ' + NET.gateway + '/24 brd 192.168.10.255 scope global ' + NET.iface
      ];
      state.leases.forEach(function (l) {
        rows.push('    inet ' + l.ip + '/24 scope global secondary ' + NET.iface + '  # dhcp lease ' + l.mac);
      });
      return { out: rows.join('\n'), code: 0 };
    }

    function ping(host, n) {
      if (/\.local$/.test(host) || host === 'printer.offline') {
        return { out: 'ping: ' + host + ': Name or service not known', code: 2, isErr: true };
      }
      var ip = /^[0-9.]+$/.test(host) ? host : '192.168.10.1';
      var rows = [];
      for (var i = 0; i < n; i++) rows.push('64 bytes from ' + ip + ': icmp_seq=' + (i + 1) + ' ttl=64 time=0.4' + i + ' ms');
      rows.push('--- ' + host + ' ping statistics ---\n' + n + ' packets transmitted, ' + n + ' received, 0% packet loss');
      return { out: rows.join('\n'), code: 0 };
    }

    function dns(host) {
      if (/\.local$/.test(host)) return { out: ';; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN', code: 1, isErr: true };
      var ip = host === 'google.com' ? '8.8.8.8' : '192.168.10.20';
      return { out: ';; ANSWER SECTION:\n' + host + '. 300 IN A ' + ip + '\n;; status: NOERROR', code: 0 };
    }

    function editorCmd(a) {
      var file = a.positionals[0] || '/etc/dhcp/dhcpd.conf';
      return { out: '[' + file + '] ' + (a.name || 'редактор') + ': ' +
        (file === '/etc/dhcp/dhcpd.conf'
          ? 'файл синхронизирован с панелью «редактор» — правьте конфиг там'
          : 'используйте панель редактора на стенде') };
    }

    function cmdDhclient(a, state) {
      var iface = a.positionals.filter(function (p) { return p.charAt(0) !== '-'; })[0] || NET.iface;
      if (iface !== NET.iface) return { out: 'dhclient: интерфейс ' + iface + ' не найден (доступен ' + NET.iface + ')', code: 1, isErr: true };
      var s = svc();
      if (!s.installed) return { out: 'dhclient: DHCP-сервер стенда ещё не установлен (apt-get install ' + PKG + ')', code: 1, isErr: true };
      var v = validation();
      if (!s.active || !v.ready) {
        return {
          code: 1, isErr: true,
          out: 'Internet Systems Consortium DHCP Client 4.4.3\nDHCPDISCOVER on ' + NET.iface + ' to 255.255.255.255 port 67 interval 3\nDHCPDISCOVER on ' + NET.iface + ' to 255.255.255.255 port 67 interval 7\nNo DHCPOFFERS received.\nпохоже, сервер ещё не раздаёт адреса — проверьте dhcpd.conf и службу',
          event: { type: 'terminal', msg: 'dhclient: попытка без готового конфига' }
        };
      }
      var mac = '08:00:27:ab:1c:' + (10 + state.leases.length).toString(16);
      var lease = { ip: NET.rangeStart, mac: mac, hostname: 'alt-ws-' + (state.leases.length + 1), at: new Date().toISOString() };
      state.leases = state.leases || [];
      state.leases.push(lease);
      os.vfs.write('/var/lib/dhcpd/dhcpd.leases',
        'lease ' + lease.ip + ' {\n  starts 2 ' + new Date().toUTCString() + ';\n  hardware ethernet ' + mac + ';\n  client-hostname "' + lease.hostname + '";\n}\n', true);
      return {
        out: 'Internet Systems Consortium DHCP Client 4.4.3\n' +
          'DHCPDISCOVER on ' + NET.iface + ' to 255.255.255.255 port 67\n' +
          'DHCPOFFER of ' + NET.rangeStart + ' from ' + NET.gateway + '\n' +
          'DHCPREQUEST for ' + NET.rangeStart + ' on ' + NET.iface + '\n' +
          'DHCPACK  of ' + NET.rangeStart + ' from ' + NET.gateway + ' — lease bound',
        event: { type: 'terminal', msg: 'клиент получил ' + NET.rangeStart }
      };
    }

    return {
      os: os,
      run: function (line) { return os.run(line); },
      setConfig: setConfig,
      getConfig: currentConfig,
      validate: validation,
      snapshot: function () { return os.serialize(); },
      leases: function () { return os.state.leases || (os.state.leases = []); }
    };
  }

  /* Совместимость: старый вызов DHCP.runCommand на эфемерной машине */
  var legacy = null;
  function runCommand(line, ctx) {
    if (!legacy) legacy = createWorld();
    if (ctx && ctx.config != null) legacy.setConfig(ctx.config);
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

    t('at-01', 'Установка DHCP-службы с sudo', function (w) {
      var r = w.run('sudo apt-get install isc-dhcp-server');
      var again = w.run('sudo apt-get install isc-dhcp-server');
      return { ok: r.code === 0 && /уже установлен/i.test(again.out), actual: again.out.slice(0, 60), expected: 'код 0, повторный вызов: уже установлен' };
    });
    t('at-02', 'Установка без sudo тоже работает', function (w) {
      var r = w.run('apt-get install isc-dhcp-server');
      return { ok: r.code === 0, actual: 'код ' + r.code, expected: 'код 0' };
    });
    t('at-03', 'Неизвестная команда возвращает 127', function (w) {
      var r = w.run('ifconfig');
      return { ok: r.code === 127, actual: 'код ' + r.code, expected: 'код 127' };
    });
    t('at-04', 'cat стартового dhcpd.conf показывает шаблон', function (w) {
      var r = w.run('cat /etc/dhcp/dhcpd.conf');
      return { ok: /dhcpd\.conf/.test(r.out), actual: r.out.split('\n')[0], expected: 'шапка конфига' };
    });
    t('at-05', 'Цепочка &&: установка и запуск службы', function (w) {
      var r = w.run('apt-get install isc-dhcp-server && systemctl enable --now ' + UNIT);
      var st = w.run('systemctl is-active ' + UNIT);
      return { ok: r.code === 0 && st.out === 'active', actual: st.out, expected: 'active' };
    });
    t('at-06', 'Bug report: служба на битом конфиге не раздаёт адреса', function (w) {
      w.run('apt-get install isc-dhcp-server && systemctl enable --now ' + UNIT);
      w.setConfig(BROKEN_CONFIG);
      var log = w.run('journalctl -u ' + UNIT);
      var cli = w.run('dhclient -v ' + NET.iface);
      return {
        ok: /errors encountered/i.test(log.out) && cli.code === 1 && /No DHCPOFFERS/.test(cli.out),
        actual: log.out.split('\n').slice(-2).join(' ') + ' || dhclient code ' + cli.code,
        expected: 'ошибка конфигурации в journalctl + отказ dhclient'
      };
    });
    t('at-07', 'Полный позитивный путь: эталонный конфиг, DORA, leases', function (w) {
      w.run('apt-get install isc-dhcp-server');
      w.setConfig(GOOD_CONFIG);
      w.run('systemctl enable --now ' + UNIT);
      var st = w.run('systemctl status ' + UNIT);
      var cli = w.run('dhclient -v ' + NET.iface);
      var leases = w.run('cat /var/lib/dhcpd/dhcpd.leases');
      return {
        ok: /active \(running\)/.test(st.out) && /DHCPACK/.test(cli.out) && leases.out.indexOf(NET.rangeStart) !== -1,
        actual: cli.out.split('\n').pop(),
        expected: 'DHCPACK ' + NET.rangeStart + ' и запись в leases'
      };
    });
    t('at-08', 'Пайпы и история: history | grep', function (w) {
      w.run('apt-get install isc-dhcp-server');
      w.setConfig(GOOD_CONFIG);
      w.run('systemctl enable --now ' + UNIT);
      w.run('dhclient -v ' + NET.iface);
      var r = w.run('history | grep dhclient');
      return { ok: /dhclient/.test(r.out), actual: r.out, expected: 'строка истории с dhclient' };
    });

    var passed = results.filter(function (r) { return r.ok; }).length;
    return { results: results, passed: passed, total: results.length, score: Math.round(passed / results.length * 100) };
  }

  var TASKS = [
    { id: 't1', title: 'Установить и запустить DHCP-службу', kind: 'terminal' },
    { id: 't2', title: 'Объявить подсеть и пул адресов', kind: 'config' },
    { id: 't3', title: 'Прописать шлюз и DNS', kind: 'config' },
    { id: 't4', title: 'Пометить сервер authoritative', kind: 'config' },
    { id: 't5', title: 'Зарезервировать адрес принтера по MAC', kind: 'config' },
    { id: 't6', title: 'Проверить выдачу адреса клиентом (dhclient)', kind: 'terminal' }
  ];

  var GOALS = [
    'Объяснять назначение DHCP и последовательность обмена DORA (Discover → Offer → Request → Acknowledge)',
    'Объявлять подсеть subnet/netmask и задавать динамический пул range по границам задания',
    'Прописывать клиентам шлюз по умолчанию и DNS-серверы через option',
    'Резервировать статический адрес по MAC-адресу блоком host и помечать сервер authoritative',
    'Проверять службу и выдачу адреса командами systemctl, journalctl и dhclient'
  ];

  var QUIZ = [
    {
      q: 'На каком порту UDP работает DHCP-сервер?',
      options: ['53', '67', '68', '22'],
      answer: 1,
      explain: 'Сервер слушает UDP/67, клиент временно использует UDP/68. Порт 53 — это DNS, 22 — SSH.'
    },
    {
      q: 'В каком порядке идут сообщения при получении адреса?',
      options: ['Request → Discover → Acknowledge → Offer', 'Discover → Offer → Request → Acknowledge', 'Offer → Discover → Acknowledge → Request', 'Discover → Request → Offer → Acknowledge'],
      answer: 1,
      explain: 'DORA: клиент ищет сервер (Discover), сервер предлагает адрес (Offer), клиент просит его (Request), сервер подтверждает аренду (Acknowledge).'
    },
    {
      q: 'Что задаёт директива range 192.168.10.100 192.168.10.200;?',
      options: ['Подсеть и маску сети', 'Диапазон динамически выдаваемых адресов', 'Адрес шлюза по умолчанию', 'Зарезервированные адреса принтеров'],
      answer: 1,
      explain: 'range ограничивает пул динамической выдачи. Резервы (host/fixed-address) должны находиться вне этого диапазона.'
    },
    {
      q: 'Зачем нужна директива authoritative;?',
      options: ['Включает шифрование аренды', 'Запрещает клиентам менять IP вручную', 'Объявляет сервер основным для сети и ускоряет обновление аренды', 'Заменяет директиву option routers'],
      answer: 2,
      explain: 'authoritative говорит клиентам, что сервер управляет этой сетью: при устаревшей аренде клиент сразу запрашивает новый адрес, а не ждёт таймаутов.'
    },
    {
      q: 'Где должен находиться fixed-address принтера 192.168.10.50?',
      options: ['Внутри пула range, чтобы адрес выдавался быстрее', 'Вне динамического пула range', 'Обязательно .1 — на месте шлюза', 'Адрес не может быть в той же подсети'],
      answer: 1,
      explain: 'Статический резерв выносят из пула (здесь пул .100–.200, а принтер — .50), иначе один и тот же адрес мог бы быть выдан и динамически, и по резерву.'
    }
  ];

  return {
    NET: NET,
    UNIT: UNIT,
    PKG: PKG,
    TASKS: TASKS,
    GOALS: GOALS,
    QUIZ: QUIZ,
    STARTER_CONFIG: STARTER_CONFIG,
    BROKEN_CONFIG: BROKEN_CONFIG,
    GOOD_CONFIG: GOOD_CONFIG,
    validateDhcpConfig: validateDhcpConfig,
    createWorld: createWorld,
    runAutotests: runAutotests,
    runCommand: runCommand
  };
});
