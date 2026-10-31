/* ==========================================================================
   itsliventsev · общее поведение страниц
   Подключается на каждой странице после Tailwind. Логика включается
   только при наличии нужных элементов — файл безопасен для любых страниц.
   ========================================================================== */

document.documentElement.classList.add('js-enabled');

/* ---------- Тема: переключатель светлая/тёмная + запоминание ---------- */
(function () {
  const STORAGE_KEY = 'itsliventsev-theme';
  const root = document.documentElement;

  function currentTheme() {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, animate) {
    if (theme === 'dark') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* приватный режим */ }
    // Браузерный хром мобильных подстраивается под активную тему
    const metaColor = document.querySelector('meta[name="theme-color"]');
    if (metaColor) metaColor.setAttribute('content', theme === 'dark' ? '#08080a' : '#fafafa');
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('title', theme === 'dark' ? 'включить светлую тему' : 'включить тёмную тему');
      btn.setAttribute('aria-label', theme === 'dark' ? 'включить светлую тему' : 'включить тёмную тему');
      if (animate) {
        btn.classList.remove('swap');
        void btn.offsetWidth; // рестарт анимации иконки
        btn.classList.add('swap');
      }
    });
  }

  // Стартовая синхронизация (атрибут уже проставлен head-скриптом)
  applyTheme(currentTheme(), false);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-toggle');
    if (!btn) return;
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // View Transitions: круговое раскрытие новой темы от кнопки.
    // Браузеры без API (или с reduced-motion) получают мгновенное переключение.
    if (!reduceMotion && document.startViewTransition) {
      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const maxRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = document.startViewTransition(() => applyTheme(next, true));
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`] },
          // Длительность совпадает с --dur-base и прокруткой иконки theme-toggle
          { duration: 220, easing: 'cubic-bezier(.2, .8, .2, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
    } else {
      applyTheme(next, true);
    }
  });

  // Синхронизация между вкладками
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) applyTheme(e.newValue, true);
  });
})();

/* ---------- Мобильное меню и состояние шапки при скролле ---------- */
(function () {
  const header = document.querySelector('.site-header');
  if (!header) return;

  // Бургер: создаётся из JS только если на странице есть навигация
  const nav = header.querySelector('.site-nav');
  let burger = null;
  if (nav) {
    // nav получает id, чтобы бургер мог ссылаться на него через aria-controls
    if (!nav.id) nav.id = 'site-nav';
    if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Основная навигация');
    burger = document.createElement('button');
    burger.className = 'icon-btn nav-burger';
    burger.type = 'button';
    burger.setAttribute('aria-label', 'открыть меню');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-controls', nav.id);
    burger.innerHTML = '<span class="sr-only">меню</span>'
      + '<span class="burger-bars" aria-hidden="true">'
      + '<span class="burger-bar"></span><span class="burger-bar"></span><span class="burger-bar"></span>'
      + '</span>';
    const actions = header.querySelector('.header-actions');
    if (actions) actions.prepend(burger);
    else header.appendChild(burger);

    function setMenu(open) {
      header.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'закрыть меню' : 'открыть меню');
      if (open) {
        // Фокус первой ссылке — клавиатура сразу внутри меню
        const first = nav.querySelector('.nav-link');
        if (first) first.focus();
      }
    }

    burger.addEventListener('click', () => {
      const open = !header.classList.contains('nav-open');
      setMenu(open);
      if (!open) burger.focus(); // фокус возвращается на кнопку
    });
    // Закрытие после клика по ссылке
    nav.addEventListener('click', (e) => {
      if (e.target.closest('.nav-link') && header.classList.contains('nav-open')) {
        setMenu(false);
      }
    });
    // Закрытие по Esc с возвратом фокуса
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        setMenu(false);
        burger.focus();
      }
    });
    // На десктопной ширине открытое меню не должно залипать
    window.addEventListener('resize', () => {
      if (window.innerWidth > 880 && header.classList.contains('nav-open')) setMenu(false);
    }, { passive: true });
  }

  // Шапка фиксированная и всегда закреплена: при скролле меняется только тень.
  // Никаких трансформов по направлению скролла — меню не «шатается».
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ---------- Прогресс прокрутки + процент чтения + кнопка «наверх» ---------- */
(function () {
  const progress = document.getElementById('scroll-progress');
  const readPercent = document.getElementById('read-percent');
  const toTop = document.getElementById('to-top');
  let ticking = false;

  function update() {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    if (progress) progress.style.transform = 'scaleX(' + (pct / 100) + ')';
    if (readPercent) readPercent.textContent = Math.round(pct) + '%';
    if (toTop) toTop.classList.toggle('show', window.scrollY > 600);
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();

  if (toTop) {
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
})();

/* ---------- Счётчики с анимацией ---------- */
(function () {
  const counters = document.querySelectorAll('.counter[data-target]');
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      let current = 0;
      const step = Math.max(1, Math.floor(target / 20));
      const timer = setInterval(() => {
        current += step;
        if (current >= target) { el.textContent = target; clearInterval(timer); }
        else el.textContent = current;
      }, 50);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach((c) => observer.observe(c));
})();

/* ---------- Автосчётчики разделов: баблы в меню и быстрых ссылках ----------
   Данные лежат в /feed-counts.json (пересобирает build-post-index.js).
   Элементы: <span class="nav-bubble" data-feed-count="blog"></span>.
   Путь к манифесту считается от глубины текущей страницы. */
(function () {
  const bubbles = document.querySelectorAll('[data-feed-count]');
  if (!bubbles.length) return;
  if (typeof fetch !== 'function') return; // старые браузеры/file:// — баблы останутся скрытыми
  const depth = location.pathname.split('/').filter(Boolean).length;
  const manifest = (depth > 1 ? '../' : './') + 'feed-counts.json';
  fetch(manifest)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((counts) => {
      bubbles.forEach((b) => {
        const n = counts[b.dataset.feedCount];
        if (typeof n !== 'number') return;
        b.textContent = n;
        b.classList.add('is-filled');
        b.title = 'записей в разделе: ' + n;
      });
    })
    .catch(() => { /* манифест недоступен (file://, офлайн) — баблы просто скрыты */ });
})();

/* ---------- Универсальные фильтры (data-filter-root) ---------- */
document.querySelectorAll('[data-filter-root]').forEach((root) => {
  const buttons = root.querySelectorAll('[data-filter-btn]');
  const items = root.querySelectorAll('[data-filter-item]');
  const empty = root.querySelector('[data-filter-empty]');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const filter = btn.dataset.filterBtn;
      let visible = 0;
      items.forEach((item) => {
        const show = filter === 'all' || item.dataset.category === filter;
        item.classList.toggle('is-hidden', !show);
        if (show) visible++;
      });
      if (empty) empty.hidden = visible !== 0;
    });
  });
});

/* ---------- Scrollspy для якорных ссылок в шапке и нижнем доке ---------- */
(function () {
  const spyLinks = document.querySelectorAll('a.nav-link[href^="#"], .bottom-dock a[href^="#"]');
  if (!spyLinks.length) return;
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      spyLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  spyLinks.forEach((l) => {
    const href = l.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (target) spy.observe(target);
  });
})();

/* ---------- Scrollspy для оглавления статьи ---------- */
(function () {
  const tocLinks = document.querySelectorAll('.toc-link');
  const sections = document.querySelectorAll('section[id^="s"]');
  if (!tocLinks.length || !sections.length) return;
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      tocLinks.forEach((l) => l.classList.remove('current'));
      const link = document.querySelector('.toc-link[href="#' + entry.target.id + '"]');
      if (link) link.classList.add('current');
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  sections.forEach((s) => spy.observe(s));

  // Единый слот футера «обновлено» — дата из времени выдачи файла
  document.querySelectorAll('[data-footer-updated]').forEach((el) => {
    const d = new Date(document.lastModified);
    if (!isNaN(d.getTime())) {
      el.textContent = '// обновлено: ' + d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  });
})();
