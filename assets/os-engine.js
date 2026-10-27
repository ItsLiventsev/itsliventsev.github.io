/* ==========================================================================
   OS-ENGINE · лёгкая виртуальная машина в браузере (без DOM)
   Моделирует Linux-машину: виртуальная ФС, службы, пакеты, сеть, шелл bash.
   Шелл: sudo (работает и с sudo, и без — учебный стенд не наказывает за
   отсутствие прав), цепочки &&/||/;, пайпы, редиректы >/>>, кавычки, флаги,
   история команд, коды возврата. Состояние сериализуется для автосохранения.
   UMD: браузер (window.OSEngine) и Node (юнит-тесты).
   ========================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.OSEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------ Виртуальная ФС ------------------------------ */
  function Node(type, name) {
    this.type = type;           // 'dir' | 'file'
    this.name = name;
    this.children = type === 'dir' ? {} : null;
    this.content = type === 'file' ? '' : null;
    this.mode = type === 'dir' ? 'rwxr-xr-x' : 'rw-r--r--';
    this.mtime = Date.now();
  }

  function VFS(snapshot) {
    this.root = new Node('dir', '');
    this.mkdirp('/home/student');
    this.mkdirp('/tmp');
    if (snapshot) this._restore(snapshot);
  }
  VFS.prototype._resolve = function (p, cwd) {
    if (p == null) p = cwd;
    p = String(p).replace(/^~/, '/home/student');
    if (p.charAt(0) !== '/') p = (cwd || '/home/student') + '/' + p;
    var parts = p.split('/').filter(Boolean);
    var abs = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '.') continue;
      if (parts[i] === '..') abs.pop();
      else abs.push(parts[i]);
    }
    return '/' + abs.join('/');
  };
  VFS.prototype._parent = function (abs) {
    var i = abs.lastIndexOf('/');
    return { dir: abs.slice(0, i) || '/', base: abs.slice(i + 1) };
  };
  VFS.prototype._find = function (abs) {
    if (abs === '/') return this.root;
    var cur = this.root;
    var parts = abs.split('/').filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      if (!cur.children || !cur.children[parts[i]]) return null;
      cur = cur.children[parts[i]];
    }
    return cur;
  };
  VFS.prototype.mkdirp = function (p, cwd) {
    var abs = this._resolve(p, cwd);
    var parts = abs.split('/').filter(Boolean);
    var cur = this.root, path = '';
    for (var i = 0; i < parts.length; i++) {
      path += '/' + parts[i];
      if (!cur.children[parts[i]]) cur.children[parts[i]] = new Node('dir', parts[i]);
      cur = cur.children[parts[i]];
      if (cur.type !== 'dir') return false;
    }
    return true;
  };
  VFS.prototype.touch = function (p, cwd) {
    var abs = this._resolve(p, cwd);
    var n = this._find(abs);
    if (n) { n.mtime = Date.now(); return true; }
    var q = this._parent(abs);
    var dir = this._find(q.dir);
    if (!dir || dir.type !== 'dir') return false;
    dir.children[q.base] = new Node('file', q.base);
    return true;
  };
  VFS.prototype.write = function (p, content, append, cwd) {
    var abs = this._resolve(p, cwd);
    var n = this._find(abs);
    if (!n) {
      var q = this._parent(abs);
      this.mkdirp(q.dir);
      var dir = this._find(q.dir);
      if (!dir || dir.type !== 'dir') return false;
      n = new Node('file', q.base);
      dir.children[q.base] = n;
    }
    if (n.type !== 'file') return false;
    n.content = append ? (n.content || '') + content : content;
    n.mtime = Date.now();
    return true;
  };
  VFS.prototype.read = function (p, cwd) {
    var n = this._find(this._resolve(p, cwd));
    return n && n.type === 'file' ? n.content : null;
  };
  VFS.prototype.exists = function (p, cwd) { return !!this._find(this._resolve(p, cwd)); };
  VFS.prototype.ls = function (p, cwd) {
    var n = this._find(this._resolve(p || '.', cwd));
    if (!n) return null;
    if (n.type === 'file') return [{ name: n.name, node: n }];
    return Object.keys(n.children).sort().map(function (k) { return { name: k, node: n.children[k] }; });
  };
  VFS.prototype.remove = function (p, recursive, cwd) {
    var abs = this._resolve(p, cwd);
    var n = this._find(abs);
    if (!n) return false;
    if (n.type === 'dir' && !recursive) return false;
    var q = this._parent(abs);
    delete this._find(q.dir).children[q.base];
    return true;
  };
  VFS.prototype.move = function (src, dst, cwd) {
    var sAbs = this._resolve(src, cwd), dAbs = this._resolve(dst, cwd);
    var sNode = this._find(sAbs);
    if (!sNode) return false;
    var sq = this._parent(sAbs);
    var dNode = this._find(dAbs);
    if (dNode && dNode.type === 'dir') {
      dNode.children[sNode.name] = sNode;
    } else {
      var dq = this._parent(dAbs);
      var dParent = this._find(dq.dir);
      if (!dParent || dParent.type !== 'dir') return false;
      sNode.name = dq.base;
      dParent.children[dq.base] = sNode;
    }
    delete this._find(sq.dir).children[sq.base];
    return true;
  };
  VFS.prototype.copy = function (src, dst, cwd) {
    var sNode = this._find(this._resolve(src, cwd));
    if (!sNode) return false;
    var clone = JSON.parse(JSON.stringify(sNode));
    var dAbs = this._resolve(dst, cwd);
    var dNode = this._find(dAbs);
    if (dNode && dNode.type === 'dir') dNode.children[sNode.name] = clone;
    else {
      var dq = this._parent(dAbs);
      var dParent = this._find(dq.dir);
      if (!dParent || dParent.type !== 'dir') return false;
      clone.name = dq.base;
      dParent.children[dq.base] = clone;
    }
    return true;
  };
  VFS.prototype.serialize = function () { return JSON.parse(JSON.stringify(this.root)); };
  VFS.prototype._restore = function (root) { this.root = root; };

  /* ------------------------------ Парсер шелла ------------------------------ */
  function tokenize(line) {
    var tokens = [], cur = '', quote = null;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (quote) {
        if (ch === quote) { quote = null; continue; }
        cur += ch; continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (/\s/.test(ch)) { if (cur) { tokens.push(cur); cur = ''; } continue; }
      cur += ch;
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  function splitOps(line) {
    var segs = [], cur = '', quote = null;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '&' && line[i + 1] === '&') { segs.push({ op: '&&', line: cur }); cur = ''; i++; continue; }
      if (ch === '|' && line[i + 1] === '|') { segs.push({ op: '||', line: cur }); cur = ''; i++; continue; }
      if (ch === ';') { segs.push({ op: ';', line: cur }); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) segs.push({ op: ';', line: cur });
    return segs;
  }

  function parsePipes(line) {
    var parts = [], cur = '', quote = null;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '|' && line[i + 1] !== '|') { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function parseCommand(line) {
    // stderr-редиректы в симуляции не меняют вывод — просто аккуратно снимаем их
    line = line.replace(/2>>?\s*("[^"]*"|'[^']*'|\S+)/g, ' ').replace(/2>&1/g, ' ');
    var redirects = [];
    var cleaned = line.replace(/(>>?)\s*("([^"]*)"|'([^']*)'|\S+)/g, function (m, op, all, d1, d2) {
      redirects.push({ append: op === '>>', target: d1 != null ? d1 : (d2 != null ? d2 : all) });
      return '';
    });
    var tokens = tokenize(cleaned);
    var usedSudo = false;
    if (tokens[0] === 'sudo') { tokens.shift(); usedSudo = true; }
    var name = tokens.shift() || '';
    var positionals = [], flags = {}, options = {};
    tokens.forEach(function (t) {
      if (t.indexOf('--') === 0) {
        var kv = t.slice(2).split('=');
        if (kv.length > 1) options[kv[0]] = kv.slice(1).join('=');
        else flags[kv[0]] = true;
      } else if (t.charAt(0) === '-' && t.length > 1 && !/^-\d/.test(t)) {
        t.slice(1).split('').forEach(function (f) { flags[f] = true; });
      } else positionals.push(t);
    });
    return { name: name, tokens: tokens, positionals: positionals, flags: flags, options: options, usedSudo: usedSudo, redirects: redirects, raw: line.trim() };
  }

  /* ------------------------------ Машина ------------------------------ */
  function createOS(opts, snapshot) {
    opts = opts || {};
    var state = snapshot ? JSON.parse(JSON.stringify(snapshot)) : {
      user: opts.user || 'student',
      host: opts.hostname || 'alt',
      cwd: '/home/student',
      history: [],
      packages: {},       // имя пакета -> {version, installedAt}
      services: {},       // unit -> {installed, enabled, active, package, pid}
      leases: [],         // выданные DHCP-аренды
      vars: {},
      bootAt: Date.now()
    };
    var vfs = new VFS(snapshot && snapshot.vfs);
    state.vfs = undefined;
    if (opts.initFs) opts.initFs(vfs, state);

    var R = function (out, code, extra) {
      return Object.assign({ out: out == null ? '' : String(out), ok: (code || 0) === 0, code: code || 0 }, extra || {});
    };
    var Err = function (msg, code) { return R(msg, code || 1, { isErr: true }); };

    var world = {
      commands: opts.commands || {},                 // доменные команды стенда
      helpExtra: opts.helpExtra || [],
      journal: opts.journal || function () { return R('-- No entries --', 0); },
      renderIp: opts.renderIp || function () { return R('1: lo: <LOOPBACK,UP>', 0); },
      ping: opts.ping || function (host) { return R('PING ' + host + ': 56 data bytes\n4 packets transmitted, 4 received, 0% packet loss', 0); },
      dns: opts.dns || function (host) { return R(';; ANSWER: ' + host + ' → 10.0.2.15', 0); },
      editorMessage: opts.editorMessage || 'в стенде редактирование файла выполняется в панели «редактор» выше'
    };

    var service = function (unit) {
      if (!state.services[unit]) state.services[unit] = { installed: false, enabled: false, active: false, package: unit, pid: null };
      return state.services[unit];
    };

    /* ------------------------- Встроенные команды ------------------------- */
    var builtins = {
      help: {
        usage: 'help', help: 'список доступных команд стенда',
        run: function () {
          var base = [
            'доступные команды стенда (sudo можно опускать — права root в симуляции уже есть):',
            '  навигация:   pwd, ls (-la), cd, cat, mkdir, touch, cp, mv, rm, find-подобный grep',
            '  система:     whoami, id, hostname, uname -a, uptime, ps aux, df -h, free -h, date',
            '  пакеты:      apt-get update, apt-get install <пакет>, apt install …',
            '  службы:      systemctl status|start|stop|restart|enable|disable|is-active <unit>',
            '  диагностика: journalctl -u <unit> -n 20, ip a, ip route, ss -tulpn, ping -c 4, dig',
            '  файлы:       echo "текст" > файл, grep -n "строка" файл, head -n 5, tail -n 20',
            '  прочее:      history, man <команда>, which <команда>, clear'
          ];
          return R(base.concat(world.helpExtra).join('\n'));
        }
      },
      clear: { usage: 'clear', help: 'очистить терминал', run: function () { return R('', 0, { clear: true }); } },
      history: { usage: 'history', help: 'история введённых команд', run: function () { return R(state.history.map(function (h, i) { return String(i + 1).padStart(3) + '  ' + h; }).join('\n')); } },
      pwd: { usage: 'pwd', help: 'текущий каталог', run: function () { return R(state.cwd); } },
      exit: { usage: 'exit', help: 'выйти из сеанса (в стенде — просто закрывает терминал-сессию)', run: function () { return R('logout\n// в стенде сессия сохраняется автоматически'); } },
      logout: { usage: 'logout', help: 'завершить сессию', run: function () { return builtins.exit.run(); } },

      cd: {
        usage: 'cd <каталог>', help: 'сменить каталог',
        run: function (a) {
          var target = a.positionals[0] || '/home/student';
          var abs = vfs._resolve(target, state.cwd);
          var n = vfs._find(abs);
          if (!n) return Err('bash: cd: ' + target + ': Нет такого каталога');
          if (n.type !== 'dir') return Err('bash: cd: ' + target + ': Не каталог');
          state.cwd = abs;
          return R('');
        }
      },
      ls: {
        usage: 'ls [-la] [каталог]', help: 'список файлов',
        run: function (a) {
          var target = a.positionals[0] || '.';
          var items = vfs.ls(target, state.cwd);
          if (items === null) return Err('ls: не удалось получить доступ к «' + target + '»: Нет такого файла или каталога', 2);
          var showHidden = a.flags.a || a.flags.l, longFmt = a.flags.l;
          items = items.filter(function (i) { return showHidden || i.name.charAt(0) !== '.'; });
          if (!items.length) return R('');
          if (longFmt) {
            return R(items.map(function (i) {
              var pref = i.node.type === 'dir' ? 'd' : '-';
              var size = i.node.type === 'file' ? String(i.node.content || '').length : 4096;
              var d = new Date(i.node.mtime).toLocaleString('ru-RU', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
              return pref + i.node.mode + ' 1 ' + state.user + ' ' + state.user + ' ' + String(size).padStart(6) + ' ' + d + ' ' + i.name;
            }).join('\n'));
          }
          return R(items.map(function (i) { return i.node.type === 'dir' ? i.name + '/' : i.name; }).join('  '));
        }
      },
      cat: {
        usage: 'cat <файл>…', help: 'вывести содержимое файла',
        run: function (a, c, stdin) {
          if (!a.positionals.length && stdin != null) return R(stdin);
          var out = [];
          for (var i = 0; i < a.positionals.length; i++) {
            var content = vfs.read(a.positionals[i], state.cwd);
            if (content === null) return Err('cat: ' + a.positionals[i] + ': Нет такого файла');
            out.push(content);
          }
          return R(out.join('\n'));
        }
      },
      echo: {
        usage: 'echo <текст> [> файл]', help: 'вывести текст или записать в файл (редирект обрабатывает шелл)',
        run: function (a) {
          return R(a.positionals.join(' '));
        }
      },
      mkdir: {
        usage: 'mkdir [-p] <каталог>', help: 'создать каталог',
        run: function (a) {
          var ok = true;
          a.positionals.forEach(function (p) {
            var good = a.flags.p ? vfs.mkdirp(p, state.cwd) : (function () {
              var abs = vfs._resolve(p, state.cwd), q = vfs._parent(abs);
              var dir = vfs._find(q.dir);
              if (!dir || dir.type !== 'dir' || dir.children[q.base]) return false;
              dir.children[q.base] = new Node('dir', q.base); return true;
            })();
            if (!good) ok = false;
          });
          return ok ? R('') : Err('mkdir: не удалось создать каталог');
        }
      },
      touch: { usage: 'touch <файл>', help: 'создать пустой файл / обновить mtime', run: function (a) { var ok = a.positionals.every(function (p) { return vfs.touch(p, state.cwd); }); return ok ? R('') : Err('touch: ошибка создания файла'); } },
      rm: {
        usage: 'rm [-rf] <путь>', help: 'удалить файл или каталог',
        run: function (a) {
          var recursive = a.flags.r || a.flags.R;
          var fail = a.positionals.filter(function (p) { return !vfs.remove(p, recursive, state.cwd); });
          return fail.length && !a.flags.f ? Err('rm: не удалось удалить «' + fail[0] + '»' + (vfs.exists(fail[0], state.cwd) ? ' (каталог: нужен -r)' : '')) : R('');
        }
      },
      cp: { usage: 'cp <источник> <приёмник>', help: 'копировать файл', run: function (a) { return vfs.copy(a.positionals[0], a.positionals[1], state.cwd) ? R('') : Err('cp: не удалось скопировать'); } },
      mv: { usage: 'mv <источник> <приёмник>', help: 'переместить/переименовать', run: function (a) { return vfs.move(a.positionals[0], a.positionals[1], state.cwd) ? R('') : Err('mv: не удалось переместить'); } },

      whoami: { usage: 'whoami', help: 'имя текущего пользователя', run: function (a) { return R(a.usedSudo ? 'root' : state.user); } },
      id: { usage: 'id', help: 'идентификаторы пользователя', run: function (a) { return R(a.usedSudo ? 'uid=0(root) gid=0(root) группы=0(root)' : 'uid=1000(' + state.user + ') gid=1000(' + state.user + ') группы=1000(' + state.user + '),27(sudo)'); } },
      hostname: { usage: 'hostname', help: 'имя машины', run: function () { return R(state.host); } },
      uname: { usage: 'uname [-a]', help: 'сведения о ядре и ОС', run: function (a) { return R(a.flags.a ? 'Linux ' + state.host + ' 5.10.0 #1 SMP x86_64 GNU/Linux (ALT Server, стенд)' : 'Linux'); } },
      date: { usage: 'date', help: 'системные дата и время', run: function () { return R(new Date().toString()); } },
      uptime: { usage: 'uptime', help: 'время работы и нагрузка', run: function () { var up = Math.max(1, Math.round((Date.now() - state.bootAt) / 1000)); return R(' ' + new Date().toLocaleTimeString('ru-RU') + ' up ' + up + 's,  1 user,  load average: 0.04, 0.03, 0.01'); } },
      df: { usage: 'df [-h]', help: 'дисковое пространство', run: function () { return R('Файловая система  Размер Исп Дост Исп%\n/dev/sda1            20G  4,2G   15G  22% /\ntmpfs               987M     0  987M   0% /tmp'); } },
      free: { usage: 'free [-h]', help: 'память', run: function () { return R('               total   used   free\ntotal:         4096M  1280M  2816M'); } },
      ps: {
        usage: 'ps [aux]', help: 'процессы',
        run: function () {
          var rows = ['USER         PID STAT COMMAND', state.user + '       1   Ss   /sbin/init'];
          Object.keys(state.services).forEach(function (u, i) {
            var s = state.services[u];
            if (s.active) rows.push('root         ' + (400 + i) + '   Ssl  ' + u + ' [active]');
          });
          rows.push(state.user + '     1024 R+   ps');
          return R(rows.join('\n'));
        }
      },
      which: { usage: 'which <команда>', help: 'путь к исполняемому файлу', run: function (a) { var n = a.positionals[0]; if (builtins[n] || world.commands[n]) return R('/usr/bin/' + n); return Err('', 1); } },
      man: {
        usage: 'man <команда>', help: 'краткая справка по команде',
        run: function (a) {
          var n = a.positionals[0], c = builtins[n] || world.commands[n];
          if (!c) return Err('Нет справочной страницы для «' + n + '»', 16);
          if (n === 'sudo') return R('SUDO(8)\n\nNAME\n  sudo — выполнить команду от имени root.\n\nВ РЕАЛЬНОЙ СИСТЕМЕ\n  apt-get install, systemctl start, ovs-vsctl set требуют прав root; на этом стенде\n  они работают и без sudo, чтобы вы не теряли время на права доступа.');
          return R(n.toUpperCase() + '\n\nNAME\n  ' + (c.help || '') + '\n\nSYNOPSIS\n  ' + (c.usage || n));
        }
      },

      grep: {
        usage: 'grep [-in] <шаблон> [файл]', help: 'поиск строк по шаблону',
        run: function (a, c, stdin) {
          var pat = a.positionals[0], file = a.positionals[1];
          var text = file != null ? vfs.read(file, state.cwd) : stdin;
          if (text == null) return Err('grep: ' + (file || 'stdin') + ': нет данных', 2);
          var re;
          try { re = new RegExp(pat, a.flags.i ? 'i' : ''); } catch (e) { return Err('grep: некорректное регулярное выражение', 2); }
          var hits = text.split('\n').map(function (line, i) {
            if (re.test(line)) return (a.flags.n ? (i + 1) + ':' : '') + line;
            return null;
          }).filter(Boolean);
          return hits.length ? R(hits.join('\n')) : R('', 1);
        }
      },
      head: { usage: 'head [-n N] [файл]', help: 'первые строки', run: function (a, c, stdin) { var n = parseInt(a.options.n, 10) || 10; var t = a.positionals[0] ? vfs.read(a.positionals[0], state.cwd) : stdin; return t == null ? Err('head: нет файла', 2) : R(t.split('\n').slice(0, n).join('\n')); } },
      tail: { usage: 'tail [-n N] [файл]', help: 'последние строки', run: function (a, c, stdin) { var n = parseInt(a.options.n, 10) || 10; var t = a.positionals[0] ? vfs.read(a.positionals[0], state.cwd) : stdin; return t == null ? Err('tail: нет файла', 2) : R(t.split('\n').slice(-n).join('\n')); } },
      wc: { usage: 'wc [-l] [файл]', help: 'подсчёт строк/слов', run: function (a, c, stdin) { var t = a.positionals[0] ? vfs.read(a.positionals[0], state.cwd) : stdin; if (t == null) return Err('wc: нет файла', 2); var lines = t.split('\n').length; return R(a.flags.l ? String(lines) : lines + ' ' + t.split(/\s+/).filter(Boolean).length + ' ' + t.length); } },
      tee: { usage: 'tee [-a] <файл>', help: 'записать stdin в файл и вывести его', run: function (a, c, stdin) { if (!a.positionals[0] || stdin == null) return Err('tee: нет данных', 1); vfs.write(a.positionals[0], stdin + '\n', a.flags.a, state.cwd); return R(stdin); } },

      ping: { usage: 'ping [-c N] <узел>', help: 'проверка доступности узла', run: function (a) { var host = a.positionals[0]; if (!host) return Err('ping: нужен адрес узла', 1); var n = parseInt(a.options.c, 10) || 4; return world.ping(host, n, state); } },
      dig: { usage: 'dig <имя>', help: 'DNS-запрос', run: function (a) { var h = a.positionals[0]; return h ? world.dns(h, state) : Err('dig: укажите имя', 1); } },
      nslookup: { usage: 'nslookup <имя>', help: 'DNS-запрос (упрощённый)', run: function (a) { var h = a.positionals[0]; return h ? world.dns(h, state) : Err('nslookup: укажите имя', 1); } },
      host: { usage: 'host <имя>', help: 'DNS-запрос (упрощённый)', run: function (a) { var h = a.positionals[0]; return h ? world.dns(h, state) : Err('host: укажите имя', 1); } },

      ip: {
        usage: 'ip addr | ip link | ip route', help: 'сеть: адреса, интерфейсы, маршруты',
        run: function (a) {
          var sub = a.positionals[0] || '';
          if (sub === 'a' || sub === 'addr' || sub === 'address' || (!sub && (a.flags.c))) return world.renderIp(state, 'addr');
          if (sub === 'link' || sub === 'l') return world.renderIp(state, 'link');
          if (sub === 'r' || sub === 'route') return world.renderIp(state, 'route');
          return Err('Usage: ip [ -c ] {{ addr | link | route }}', 2);
        }
      },
      ss: { usage: 'ss [-tulpn]', help: 'сокеты и порты', run: function () { return R('Netid State  Local Address:Port\nudp   UNLISTEN 0.0.0.0:67  (dhcpd)\ntcp   LISTEN   0.0.0.0:22  (sshd)'); } },
      netstat: { usage: 'netstat [-tulpn]', help: 'сокеты и порты (классика)', run: function () { return builtins.ss.run(); } },

      systemctl: {
        usage: 'systemctl <действие> <unit>', help: 'управление службами',
        run: function (a) {
          var action = a.positionals[0], unit = a.positionals[1];
          if (action === 'is-active') { var s1 = service(unit); return R(s1.active ? 'active' : 'inactive', s1.active ? 0 : 3); }
          if (action === 'is-enabled') { var s2 = service(unit); return R(s2.enabled ? 'enabled' : 'disabled', s2.enabled ? 0 : 1); }
          if (action === 'status') return world.journal(state, unit, 'status');
          if (!unit) return Err('systemctl: укажите unit', 2);
          var s = service(unit);
          if (!s.installed) return Err('Unit ' + unit + '.service не найден — сначала установите пакет', 5);
          if (action === 'start' || action === 'restart') { s.active = true; s.pid = 400 + Math.floor(Math.random() * 500); return R(''); }
          if (action === 'stop') { s.active = false; s.pid = null; return R(''); }
          if (action === 'enable' || action === 'disable') { s.enabled = action === 'enable'; if (action === 'enable') { s.active = true; s.pid = 400 + Math.floor(Math.random() * 500); } return R('Created symlink /etc/systemd/system/multi-user.target.wants/' + unit + '.service → /lib/systemd/system/' + unit + '.service'); }
          return Err('systemctl: неизвестное действие «' + action + '»', 2);
        }
      },
      service: {
        usage: 'service <unit> <действие>', help: 'классический способ управления службой',
        run: function (a) {
          var unit = a.positionals[0], action = a.positionals[1];
          var s = service(unit);
          if (!s.installed) return Err('Unit ' + unit + '.service не найден', 5);
          if (action === 'status') return world.journal(state, unit, 'status');
          if (['start', 'stop', 'restart'].indexOf(action) === -1) return Err('service: неизвестное действие', 2);
          s.active = action !== 'stop';
          return R('Redirecting to /bin/systemctl ' + action + ' ' + unit + '.service');
        }
      },
      journalctl: {
        usage: 'journalctl -u <unit> [-n N]', help: 'логи службы',
        run: function (a) {
          var unit = a.options.u || (a.positionals[0] !== '-u' && a.positionals[0]) || null;
          if (a.flags.u) unit = a.positionals[0];
          return world.journal(state, unit, 'log', parseInt(a.options.n, 10) || 20);
        }
      },
      'apt-get': {
        usage: 'apt-get install|remove|update <пакет>', help: 'управление пакетами (ALT/dpkg)',
        run: function (a, c) { return aptRun(a, c); }
      },
      apt: { usage: 'apt install|remove|update <пакет>', help: 'управление пакетами (современный синтаксис)', run: function (a, c) { return aptRun(a, c); } },

      mcedit: { usage: 'mcedit <файл>', help: 'консольный редактор', run: editorRun },
      nano: { usage: 'nano <файл>', help: 'консольный редактор', run: editorRun },
      vim: { usage: 'vim <файл>', help: 'консольный редактор', run: editorRun },
      vi: { usage: 'vi <файл>', help: 'консольный редактор', run: editorRun },
      reboot: { usage: 'reboot', help: 'перезагрузка виртуальной машины', run: function () { state.bootAt = Date.now(); Object.keys(state.services).forEach(function (u) { var s = state.services[u]; if (!s.enabled) s.active = false; }); return R('Connection to ' + state.host + ' closed by remote host.\n// перезагрузка стенда: службы с автозапуском поднялись'); } }
    };

    function a0flags() { return ''; }
    function editorRun(a) { return R('[' + (a.positionals[0] || 'файл') + '] ' + world.editorMessage); }

    function aptRun(a, c) {
      var action = a.positionals[0];
      if (action === 'update') return R('Получ:1 http://ftp.altlinux.org Sisyphus InRelease\nЧтение списков пакетов… Готово\nВсе пакеты актуальны.');
      if (action === 'install' || action === 'remove') {
        var pkg = a.positionals[1];
        if (!pkg) return Err('apt-get: укажите пакет', 2);
        var resolver = opts.resolvePackage ? opts.resolvePackage(pkg) : { package: pkg, service: pkg };
        if (!resolver) return Err('E: Не удалось найти пакет ' + pkg, 100);
        if (action === 'remove') { delete state.packages[resolver.package]; var svc0 = state.services[resolver.service]; if (svc0) { svc0.installed = false; svc0.active = false; svc0.enabled = false; } return R('Удаляется пакет ' + resolver.package + '… Готово'); }
        if (state.packages[resolver.package]) return R(resolver.package + ' уже установлен (новейшая версия)');
        state.packages[resolver.package] = { version: resolver.version || '1:8.1-alt1', installedAt: Date.now() };
        var svc = service(resolver.service);
        svc.installed = true;
        return R('Чтение списков пакетов… Готово\nУстанавливается ' + resolver.package + ' (' + (resolver.version || '1:8.1-alt1') + ')…\nГотово\n' + (resolver.hint || ''), 0, { event: { type: 'terminal', msg: 'установлен пакет ' + resolver.package } });
      }
      return Err('apt-get: неизвестное действие «' + action + '»', 2);
    }

    /* ------------------------- Исполнение шелла ------------------------- */
    function executeOne(line, stdin) {
      var parsed = parseCommand(line);
      if (!parsed.name) return R('');
      var handler = builtins[parsed.name] || world.commands[parsed.name];
      if (!handler) {
        var hint = opts.suggestCommand ? opts.suggestCommand(parsed.name) : null;
        return Err('bash: ' + parsed.name + ': команда не найдена в стенде' + (hint ? ' — может быть, «' + hint + '»?' : ' (введите help)'), 127);
      }
      var res = handler.run(parsed, state, stdin);
      res = res || R('');
      if (parsed.redirects.length && res.clear !== true) {
        parsed.redirects.forEach(function (rd) { vfs.write(rd.target, res.out + '\n', rd.append, state.cwd); });
        res.out = '';
      }
      if (parsed.usedSudo) res.usedSudo = true;
      return res;
    }

    function run(line) {
      line = String(line || '').trim();
      if (!line) return R('');
      var segs = splitOps(line);
      var combined = [], last = R(''), lastEvent = null;
      var stop = false;
      segs.forEach(function (seg) {
        if (stop) return;
        var pipeParts = parsePipes(seg.line);
        var res = R(''), stdin = null;
        pipeParts.forEach(function (p, idx) {
          res = executeOne(p, idx > 0 ? stdin : null);
          stdin = res.out;
        });
        if (res.event) lastEvent = res.event;
        if (res.clear) { last = res; stop = true; return; }
        if (res.out) combined.push(res.out);
        if (seg.op === '&&' && res.code !== 0) stop = true;
        if (seg.op === '||' && res.code === 0) stop = true;
        last = res;
      });
      state.history.push(line);
      if (state.history.length > 200) state.history.shift();
      var out = combined.join('\n');
      return Object.assign({}, last, { out: out, event: last.event || lastEvent });
    }

    return {
      state: state,
      vfs: vfs,
      run: run,
      service: service,
      parseCommand: parseCommand,
      serialize: function () { return Object.assign({}, state, { vfs: vfs.serialize() }); },
      restore: function (snap) {
        Object.keys(state).forEach(function (k) { delete state[k]; });
        Object.assign(state, snap);
        vfs._restore(snap.vfs);
        delete state.vfs;
      },
      builtins: builtins
    };
  }

  return { createOS: createOS, VFS: VFS, tokenize: tokenize, splitOps: splitOps, parseCommand: parseCommand };
});
