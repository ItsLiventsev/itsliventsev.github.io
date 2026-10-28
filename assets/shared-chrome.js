/* ==========================================================================
   shared-chrome.js · поведение общего хрома (все страницы, zero-deps)
   1. Тень липкой шапки стендов при скролле (.st-topbar.is-scrolled)
   2. Компактная «пилюля» липкого профиля на мобильных
   3. Табы секции «стек» на главной (прогрессивное улучшение)
   4. Плавные якоря с потолком 400ms и уважением reduced-motion
   5. Prefetch внутренних страниц при наведении/фокусе (мгновенные переходы)
   Любая секция включается только при наличии своих элементов.
   ========================================================================== */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ticking = false;

  function raf(fn) {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { ticking = false; fn(); });
  }

  /* ---------- 1–2. Скролл: тень шапки и компактный профиль ---------- */
  var topbar = document.querySelector('.st-topbar');
  var stickyAside = document.querySelector('.cab-grid > aside');
  var mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;
  var lastY = window.scrollY;

  function onScroll() {
    var y = window.scrollY;
    if (topbar) topbar.classList.toggle('is-scrolled', y > 8);
    if (stickyAside && mobileQuery && mobileQuery.matches && !reduceMotion) {
      // Вниз — сворачиваем в пилюлю, вверх — разворачиваем обратно
      if (y > 140 && y > lastY + 4) stickyAside.classList.add('is-compact');
      else if (y < lastY - 4 || y < 80) stickyAside.classList.remove('is-compact');
    } else if (stickyAside && (!mobileQuery || !mobileQuery.matches)) {
      stickyAside.classList.remove('is-compact');
    }
    lastY = y;
  }
  if (topbar || stickyAside) {
    window.addEventListener('scroll', function () { raf(onScroll); }, { passive: true });
    onScroll();
  }

  /* ---------- 3. Табы секции «стек»: только десктоп, только с JS ---------- */
  (function initStackTabs() {
    var section = document.getElementById('stack');
    if (!section || !window.matchMedia) return;
    var grid = section.querySelector('.grid');
    var groups = Array.prototype.slice.call(section.querySelectorAll('.group'));
    if (!grid || groups.length < 2) return;
    var desktop = window.matchMedia('(min-width: 768px)');
    var tabList = null;

    function labelOf(g) {
      var el = g.querySelector('.mono');
      return el ? el.textContent.trim() : '';
    }

    function show(index) {
      groups.forEach(function (g, i) {
        var on = i === index;
        g.hidden = !on;
        if (on) {
          // Перезапуск входной анимации для каждой новой панели
          g.classList.remove('stack-panel');
          void g.offsetWidth;
          g.classList.add('stack-panel');
        } else {
          g.classList.remove('stack-panel');
        }
      });
      if (!tabList) return;
      tabList.querySelectorAll('.stack-tab').forEach(function (btn, i) {
        btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
    }

    function enable() {
      if (tabList) return;
      tabList = document.createElement('div');
      tabList.className = 'stack-tabs';
      tabList.setAttribute('role', 'tablist');
      tabList.setAttribute('aria-label', 'Категории технического стека');
      groups.forEach(function (g, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'stack-tab';
        btn.setAttribute('role', 'tab');
        btn.textContent = labelOf(g);
        btn.addEventListener('click', function () { show(i); });
        tabList.appendChild(btn);
      });
      grid.parentNode.insertBefore(tabList, grid);
      grid.classList.add('stack-stage');
      show(0);
    }

    function disable() {
      if (tabList) { tabList.remove(); tabList = null; }
      grid.classList.remove('stack-stage');
      groups.forEach(function (g) { g.hidden = false; g.classList.remove('stack-panel'); });
    }

    function sync() { if (desktop.matches) enable(); else disable(); }
    if (desktop.addEventListener) desktop.addEventListener('change', sync);
    else if (desktop.addListener) desktop.addListener(sync); // старые Safari
    sync();
  })();

  /* ---------- 3.1. Плавное закрытие details-аккордеонов ----------
     Открытие — нативное и анимируется CSS (grid-template-rows 0fr→1fr).
     Закрытие нативно мгновенно, поэтому перехватываем клик и ждём переход. */
  document.querySelectorAll('details.accordion > summary').forEach(function (summary) {
    summary.addEventListener('click', function (e) {
      var details = summary.parentElement;
      if (!details.open) return;
      e.preventDefault();
      var wrap = details.querySelector('.acc-wrap');
      if (!wrap || reduceMotion) { details.open = false; return; }
      wrap.classList.add('is-closing');
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        details.open = false;
        wrap.classList.remove('is-closing');
      }
      wrap.addEventListener('transitionend', finish, { once: true });
      window.setTimeout(finish, 320); // страховка, если transition не сработал
    });
  });

  /* ---------- 4. Якоря: плавный скролл не дольше 400ms ---------- */
  if (!reduceMotion) {
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link || link.classList.contains('skip-link')) return; // skip-link сам переносит фокус
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      var start = window.scrollY;
      var delta = target.getBoundingClientRect().top;
      var duration = Math.min(400, Math.max(120, Math.abs(delta) * 0.4));
      var t0 = performance.now();
      function frame(now) {
        var k = Math.min(1, (now - t0) / duration);
        var eased = 1 - Math.pow(1 - k, 3); // ease-out cubic
        window.scrollTo(0, start + delta * eased);
        if (k < 1) window.requestAnimationFrame(frame);
        else history.replaceState(null, '', id);
      }
      window.requestAnimationFrame(frame);
    });
  }

  /* ---------- 5. Prefetch внутренних ссылок ----------
     Клик попадает в кэш браузера — переход ощущается мгновенным,
     без видимой «пересборки». Внешние ссылки, якоря и протоколы пропускаем. */
  (function initPrefetch() {
    if (!document.head || !window.addEventListener) return;
    var seen = Object.create(null);
    function prefetch(abs) {
      if (seen[abs] || abs === location.href.split('#')[0]) return;
      seen[abs] = true;
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = abs;
      document.head.appendChild(l);
    }
    function fromEvent(e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var a = t.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:)/.test(href)) return;
      try {
        var u = new URL(a.href, location.href);
        if (u.origin === location.origin) prefetch(u.href);
      } catch (err) {}
    }
    document.addEventListener('pointerover', fromEvent, { passive: true });
    document.addEventListener('focusin', fromEvent, { passive: true });
  })();
})();
