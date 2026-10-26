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
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
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
  if (nav) {
    const burger = document.createElement('button');
    burger.className = 'icon-btn nav-burger';
    burger.setAttribute('aria-label', 'открыть меню');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span class="sr-only">меню</span><span><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>';
    const actions = header.querySelector('.header-actions');
    if (actions) actions.prepend(burger);
    else header.appendChild(burger);

    burger.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'закрыть меню' : 'открыть меню');
    });
    // Закрытие после клика по ссылке
    nav.addEventListener('click', (e) => {
      if (e.target.closest('.nav-link') && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
    // Закрытие по Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Тень шапки при скролле
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
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
    if (progress) progress.style.width = pct + '%';
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

/* ---------- Появление блоков при скролле ---------- */
(function () {
  const targets = document.querySelectorAll('.reveal, .stagger');
  if (!targets.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px -36px 0px' });
  targets.forEach((el) => observer.observe(el));
  // Подстраховка: если наблюдатель не сработал
  setTimeout(() => targets.forEach((el) => el.classList.add('active')), 1200);
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

/* ---------- Анимированные «метки» в заголовках ----------
   data-mark='[".","..","..."]'            — текстовые кадры
   data-mark-html='["<span> >_</span>"]'  — HTML-кадры
   data-mark-interval="450"                — скорость */
document.querySelectorAll('[data-mark], [data-mark-html]').forEach((el) => {
  const frames = el.dataset.mark ? JSON.parse(el.dataset.mark) : JSON.parse(el.dataset.markHtml);
  const interval = parseInt(el.dataset.markInterval || '450', 10);
  let i = 0;
  setInterval(() => {
    i = (i + 1) % frames.length;
    if (el.dataset.markHtml !== undefined) el.innerHTML = frames[i];
    else el.textContent = frames[i];
  }, interval);
});

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

/* ---------- Магнитные элементы ---------- */
document.querySelectorAll('.magnetic').forEach((el) => {
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .18}px)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
});

/* ---------- Scrollspy для якорных ссылок в шапке ---------- */
(function () {
  const spyLinks = document.querySelectorAll('a.nav-link[href^="#"]');
  if (!spyLinks.length) return;
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      spyLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  spyLinks.forEach((l) => {
    const target = document.querySelector(l.getAttribute('href'));
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
})();
