/* ==========================================================================
   flow.js · хореография flow-motion (zero-deps, подключается последним)
   1. Инжект ambient-слоя с моно-глифами и баблами на стендах
   2. Пословное появление заголовков [data-flow-words] (маска + пружина)
   3. IntersectionObserver для [data-flow]-блоков и групп со стаггером --i
   4. Параллакс ambient-слоя за курсором (только pointer:fine, rAF-лерп)
   При prefers-reduced-motion модуль не делает ничего: контент остаётся
   в естественном состоянии, вся видимая информация доступна сразу.
   ========================================================================== */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  /* ---------- 1. Ambient: глифы и баблы ---------- */
  function makeEl(tag, cls, style, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (style) el.setAttribute('style', style);
    if (text != null) el.textContent = text;
    return el;
  }

  (function injectAmbient() {
    var body = document.body;
    if (!body || !body.classList || typeof body.insertBefore !== 'function') return;
    var isFlat = body.classList.contains('flat-scope');

    if (isFlat && !body.querySelector('.st-ambient')) {
      var layer = makeEl('div', 'st-ambient flow-parallax');
      layer.setAttribute('aria-hidden', 'true');
      var glyphs = [
        { t: '#',  top: '12%', left: '6%',  size: 'clamp(4rem, 10vw, 8rem)', dx: '16px',  dy: '-26px', r0: '-9deg', r1: '8deg',  d: '24s', delay: '-3s' },
        { t: '/',  top: '64%', left: '4%',  size: 'clamp(3rem, 7vw, 5.5rem)', dx: '-12px', dy: '-20px', r0: '7deg',  r1: '-6deg', d: '28s', delay: '-9s', far: true },
        { t: '>_', top: '22%', left: '88%', size: 'clamp(3.5rem, 8vw, 6.5rem)', dx: '-18px', dy: '22px', r0: '-5deg', r1: '10deg', d: '26s', delay: '-6s' },
        { t: '*',  top: '70%', left: '90%', size: 'clamp(2.5rem, 6vw, 4.5rem)', dx: '14px',  dy: '-18px', r0: '10deg', r1: '-8deg', d: '30s', delay: '-12s', far: true }
      ];
      glyphs.forEach(function (g) {
        var span = makeEl('span', 'amb-glyph' + (g.far ? ' is-far' : ''),
          'top:' + g.top + ';left:' + g.left + ';font-size:' + g.size +
          ';--dx:' + g.dx + ';--dy:' + g.dy + ';--r0:' + g.r0 + ';--r1:' + g.r1 +
          ';--gdur:' + g.d + ';--gdelay:' + g.delay, g.t);
        layer.appendChild(span);
      });
      var bubbles = [
        { w: '200px', top: '16%', left: '78%', bx: '20px', by: '-34px', d: '18s', delay: '-2s' },
        { w: '140px', top: '66%', left: '10%', bx: '-16px', by: '-26px', d: '22s', delay: '-8s' }
      ];
      bubbles.forEach(function (b) {
        layer.appendChild(makeEl('span', 'flow-bubble',
          'width:' + b.w + ';height:' + b.w + ';top:' + b.top + ';left:' + b.left +
          ';--bx:' + b.bx + ';--by:' + b.by + ';--bdur:' + b.d + ';--bdelay:' + b.delay));
      });
      body.insertBefore(layer, body.firstChild);
    }

    // Мягкие страницы: добавляем баблы в уже существующий ambient
    var ambient = document.querySelector('.ambient');
    if (ambient) {
      ambient.classList.add('flow-parallax');
      if (!ambient.querySelector('.flow-bubble')) {
        ambient.appendChild(makeEl('span', 'flow-bubble',
          'width:200px;height:200px;top:24%;left:8%;--bx:22px;--by:-30px;--bdur:18s;--bdelay:-4s'));
        ambient.appendChild(makeEl('span', 'flow-bubble',
          'width:140px;height:140px;top:60%;right:12%;left:auto;--bx:-18px;--by:-24px;--bdur:22s;--bdelay:-10s'));
      }
    }
  })();

  /* ---------- 2. Пословное появление заголовков ---------- */
  function splitWords(el) {
    // Безопасный сплит: только элементы без вложенных тегов
    if (el.querySelector('*') || el.dataset.flowSplit === 'done') return;
    var text = el.textContent;
    el.dataset.flowSplit = 'done';
    el.classList.add('flow-words');
    el.textContent = '';
    var wordIndex = 0;
    text.split(/(\s+)/).forEach(function (part) {
      if (part === '') return;
      if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(part)); return; }
      var outer = document.createElement('span');
      outer.className = 'flow-word';
      var inner = document.createElement('span');
      inner.className = 'flow-word-in';
      inner.style.setProperty('--i', Math.min(wordIndex, 8));
      inner.textContent = part;
      outer.appendChild(inner);
      el.appendChild(outer);
      wordIndex++;
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-flow-words]'), splitWords);

  /* ---------- 3. IO: блоки data-flow и стаггер-группы ---------- */
  var targets = Array.prototype.slice.call(document.querySelectorAll('[data-flow], [data-flow-words], [data-flow-group]'));
  // Дочерним элементам групп проставляем индекс --i (потолок в CSS)
  targets.forEach(function (group) {
    if (!group.hasAttribute('data-flow-group')) return;
    // Декорируем всех детей: задержка стаггера ограничена --flow-cap в CSS,
    // поэтому большие сетки (10+ карточек) не растягивают каскад
    Array.prototype.slice.call(group.children).forEach(function (child, i) {
      child.style.setProperty('--i', i);
      if (!child.hasAttribute('data-flow')) child.setAttribute('data-flow', 'rise');
    });
  });
  // Пересобираем список ПОСЛЕ декорирования групп: иначе дочерние карточки
  // не попадают ни в наблюдатель, ни в страховочный таймаут и остаются opacity:0
  targets = Array.prototype.slice.call(document.querySelectorAll('[data-flow], [data-flow-words], [data-flow-group]'));
  if ('IntersectionObserver' in window && targets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add(el.hasAttribute('data-flow-words') ? 'is-in' : 'flow-in');
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (el) { io.observe(el); });
    // Подстраховка: если наблюдатель не сработал, контент всё равно появится
    window.setTimeout(function () {
      targets.forEach(function (el) {
        el.classList.add(el.hasAttribute('data-flow-words') ? 'is-in' : 'flow-in');
      });
    }, 1600);
  } else {
    targets.forEach(function (el) {
      el.classList.add(el.hasAttribute('data-flow-words') ? 'is-in' : 'flow-in');
    });
  }

  /* ---------- 4. Параллакс ambient за курсором (rAF-лерп) ---------- */
  if (finePointer) {
    var layers = Array.prototype.slice.call(document.querySelectorAll('.flow-parallax'));
    if (layers.length) {
      var tx = 0, ty = 0, cx = 0, cy = 0, frame = null;
      window.addEventListener('pointermove', function (e) {
        tx = (e.clientX / window.innerWidth - .5) * 2;
        ty = (e.clientY / window.innerHeight - .5) * 2;
        if (!frame) frame = window.requestAnimationFrame(tick);
      }, { passive: true });
      function tick() {
        cx += (tx - cx) * .06;
        cy += (ty - cy) * .06;
        // Сдвиг не больше 14px — ощущение глубины, без укачивания
        layers.forEach(function (layer) {
          layer.style.transform = 'translate3d(' + (cx * 14).toFixed(2) + 'px,' + (cy * 14).toFixed(2) + 'px,0)';
        });
        if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) {
          frame = window.requestAnimationFrame(tick);
        } else { frame = null; }
      }
    }
  }
})();
