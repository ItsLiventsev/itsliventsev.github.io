/* ==========================================================================
   Виртуальные стенды · стенд DHCP (ALT Server / ALT Workstation)
   Чистая логика без DOM: задания, проверка конфига dhcpd.conf, эмулятор
   терминала. UMD-обёртка: работает и в браузере (window.DHCP), и в Node
   (module.exports) — поэтому покрывается юнит-тестами без jsdom.
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DHCP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Параметры сети стенда (легенда: новый отдел, сеть 192.168.10.0/24)
  var NET = {
    subnet: '192.168.10.0',
    netmask: '255.255.255.0',
    gateway: '192.168.10.1',
    rangeStart: '192.168.10.100',
    rangeEnd: '192.168.10.200',
    printerMac: '00:11:22:33:44:55',
    printerIp: '192.168.10.50',
    iface: 'enp0s8'
  };

  // Шаблон «сломанного» конфига для ситуационной задачи (bug report)
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

  // Стартовый шаблон для студента
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

  /* Проверки конфигурации. Каждая возвращает {ok, hint} — обратная связь
     в духе логов CI: зелёная галочка или конкретная причина отказа. */
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

  /* Эмулятор терминала. Только whitelist-команды — безопасно и предсказуемо.
     Возвращает {out, ok, event}. event пишется в журнал действий студента. */
  var TERMINAL = {
    welcome: 'ALT Server (стенд Codespaces) · введите «help» для списка команд',
    commands: {
      help: function () {
        return { out: [
          'доступные команды стенда:',
          '  sudo apt-get install <пакет>   установка пакета',
          '  sudo systemctl <действие> <служба>',
          '  mcedit /etc/dhcp/dhcpd.conf    редактор конфига (на стенде — поле выше)',
          '  dhclient -v ' + NET.iface + '          запрос адреса на клиенте',
          '  ip -c a                        список интерфейсов и адресов',
          '  journalctl -u dhcp-server      логи службы DHCP',
          '  clear                          очистить терминал'
        ].join('\n') };
      },
      'sudo apt-get install isc-dhcp-server': function () { return install(); },
      'sudo apt-get install dhcp-server': function () { return install(); },
      'apt-get install isc-dhcp-server': function () { return { out: 'нужен sudo: операция требует прав root', ok: false }; },
      'sudo systemctl start isc-dhcp-server': function () { return svc('start', 'isc-dhcp-server'); },
      'sudo systemctl start dhcp-server': function () { return svc('start', 'dhcp-server'); },
      'sudo systemctl enable --now dhcp-server': function () { return svc('enable', 'dhcp-server'); },
      'sudo systemctl status dhcp-server': function () { return status(); },
      'journalctl -u dhcp-server': function () { return logs(); },
      'ip -c a': function () { return ipAddr(); },
      'ip a': function () { return ipAddr(); },
      ['dhclient -v ' + NET.iface]: function (ctx) { return dhclient(ctx); },
      clear: function () { return { clear: true }; }
    }
  };

  function install() {
    return { out: 'Чтение списков пакетов… Готово\n' +
      'dhcp-server (ISC Kea/legacy isc-dhcp) установлен\n' +
      'подсказка: включите службу — sudo systemctl enable --now dhcp-server',
      event: { type: 'terminal', msg: 'установлен пакет DHCP-сервера' } };
  }
  function svc(action, name) {
    return {
      out: action === 'enable'
        ? 'Created symlink → dhcp-server.service; служба запущена'
        : 'Служба ' + name + ' запущена (см. journalctl -u dhcp-server)',
      event: { type: 'terminal', msg: 'служба ' + name + ': ' + action }
    };
  }
  function status() {
    return { out: '● dhcp-server.service — active (running)\n   Loaded: loaded; Main PID: 2048 (dhcpd)\n   Listening on ' + NET.iface + '/0.0.0.0:67' };
  }
  function logs() {
    return { out: [
      'dhcpd: Internet Systems Consortium DHCP Server',
      'dhcpd: For consistency, lease file was parsed',
      'dhcpd: Listening on LPF/' + NET.iface + '/0a:00:27:00:00:08/24',
      'dhcpd: Sending on   LPF/' + NET.iface + '/192.168.10.0/24',
      'dhcpd: Server starting service.'
    ].join('\n') };
  }
  function ipAddr() {
    return { out: [
      '1: lo: <LOOPBACK,UP> mtu 65536',
      '    inet 127.0.0.1/8',
      '2: ' + NET.iface + ': <BROADCAST,MULTICAST,UP,UPLOWER_UP> mtu 1500',
      '    inet ' + NET.gateway + '/24 brd 192.168.10.255 scope global ' + NET.iface,
      '3: enp0s3: <BROADCAST,MULTICAST,UP> mtu 1500',
      '    inet 10.0.2.15/24 (NAT/WAN)'
    ].join('\n') };
  }
  function dhclient(ctx) {
    // Успех выдачи адреса зависит от готовности конфига (если контекст передан)
    var ready = ctx && ctx.ready === true;
    if (!ready) {
      return {
        ok: false,
        out: 'dhclient: DHCPDISCOVER on ' + NET.iface + ' … no DHCPOFFERS received.\n' +
             'похоже, сервер ещё не раздаёт адреса — проверьте dhcpd.conf и службу',
        event: { type: 'terminal', msg: 'dhclient: попытка без готового конфига' }
      };
    }
    return {
      out: 'DHCPDISCOVER on ' + NET.iface + ' to 255.255.255.255\n' +
        'DHCPOFFER of ' + NET.rangeStart + ' from ' + NET.gateway + '\n' +
        'DHCPREQUEST for ' + NET.rangeStart + '\n' +
        'DHCPACK  of ' + NET.rangeStart + ' — lease bound',
      event: { type: 'terminal', msg: 'клиент получил ' + NET.rangeStart }
    };
  }

  function runCommand(line, ctx) {
    var key = String(line || '').trim().replace(/\s+/g, ' ');
    if (!key) return { out: '' };
    if (TERMINAL.commands[key]) return TERMINAL.commands[key](ctx || {}) || { out: '' };
    var bin = key.split(' ')[0];
    return { ok: false, out: 'bash: ' + bin + ': команда не найдена в стенде (введите help)' };
  }

  // Задания стенда (для прогресс-бара и журнала)
  var TASKS = [
    { id: 't1', title: 'Установить и запустить DHCP-службу', kind: 'terminal' },
    { id: 't2', title: 'Объявить подсеть и пул адресов', kind: 'config' },
    { id: 't3', title: 'Прописать шлюз и DNS', kind: 'config' },
    { id: 't4', title: 'Пометить сервер authoritative', kind: 'config' },
    { id: 't5', title: 'Зарезервировать адрес принтера по MAC', kind: 'config' },
    { id: 't6', title: 'Проверить выдачу адреса клиентом (dhclient)', kind: 'terminal' }
  ];

  // Учебные цели стенда (что студент должен уметь по итогам)
  var GOALS = [
    'Объяснять назначение DHCP и последовательность обмена DORA (Discover → Offer → Request → Acknowledge)',
    'Объявлять подсеть subnet/netmask и задавать динамический пул range по границам задания',
    'Прописывать клиентам шлюз по умолчанию и DNS-серверы через option',
    'Резервировать статический адрес по MAC-адресу блоком host и помечать сервер authoritative',
    'Проверять службу и выдачу адреса командами systemctl, journalctl и dhclient'
  ];

  // Контрольный мини-тест: answer — индекс верного варианта, explain — разбор
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
    TASKS: TASKS,
    GOALS: GOALS,
    QUIZ: QUIZ,
    STARTER_CONFIG: STARTER_CONFIG,
    BROKEN_CONFIG: BROKEN_CONFIG,
    validateDhcpConfig: validateDhcpConfig,
    runCommand: runCommand
  };
});
