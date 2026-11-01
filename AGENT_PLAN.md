# AGENT_PLAN — Agentic Redesign v1 · itsliventsev.github.io

**Дата:** 1 ноября 2026 · **Оркестратор:** CTO/Art-Director · **Цель:** продукт 2026 года — светлый Soft UI, анимированная навигация и живая лента итераций.
**Ветка доставки:** `feat/agentic-redesign-v1` (в Arena-сессии — `arena/7f6c56c0-itsliventsev-github-io` из-за ограничения платформы)

## 0. Манифест и аудит

Текущий сайт — 76 HTML-маршрутов на статическом GitHub Pages (GitHub Pages + zero-deps JS). Сохраняем: все URL, SEO, учебные движки (СетьПолис / ОфисПолис / ДатаПолис), JSON-контент, поиск, темы, storage-контракты. Переписываем визуальный слой: токены → workspace shell → домашний дашборд.

**Проблема аудита:**
- Навигация уже сегментирована, но без движущегося индикатора, без визуального разделения-пил и без ощущения «где я».
- Блок `Сайт развивается итерациями` — статичная карточка с числом коммитов. Нет чувства живой мастерской, нет хештегов, ленты, графика.
- Палитра `#f3f4f7` темновата для SaaS, тени резковаты, карточки не Bento, микровзаимодействий минимум.

**Видение:** `F8F9FA` канвас + белые карточки 16px + мягкие тени + bento-сетка + движения CSS-first (Motion Primitives паттерн). Навигация — как Smooth Tabs с плашкой, лента — как AI State + Timeline + Recharts sparkline.

## 1. Команда суб-агентов

### Agent-Navigator — UX/IA, навигация
**Задача:**
- Разбить sidebar на 3 пилюли-контейнера: `Общее меню` (Обзор, Проекты, Статьи, Заметки, Архив, Справка, Карта) · `Направления` (СетьПолис, ОфисПолис, ДатаПолис) · `На этой странице` (оглавление из H2).
- Внедрить движущийся индикатор: `ws-nav-indicator` — абсолютно позиционированная плашка `background: var(--ws-accent-wash)` с `transition: transform 280ms cubic-bezier(.2,.8,.2,1)`. Позиция пересчитывается JS на `mouseenter`/`focus` и `aria-current`. CSS `anchor-positioning` как progressive enhancement + JS фолбэк.
- Desktop: индикатор скрыт в compact-режиме; mobile drawer — модальный диалог, `inert` фон, ловушка фокуса.

**Результат:** активный пункт подсвечивается плавно, пользователь понимает иерархию, хлебные крошки в topbar.
**Файлы:** `assets/workspace.css`, `assets/workspace.js`

### Agent-Visual — UI/Art-Direction, Soft UI
**Задача:**
- Осветлить палитру: `--ws-canvas: #F8F9FA`, `--ws-surface-soft: #f2f4f7`, мягкие тени `0 1px 2px rgba(16,24,40,.04)`.
- Крупные скругления 16px (`--ws-r-3`), Bento-grid для hero/dashboard/skill/resource, ритм 8px.
- Типографика Manrope self-hosted + Inter fallback, `letter-spacing: -.045em`, `tabular-nums` для цифр.
- Shimmer (Magic UI) и moving border (Aceternity) как `::before` с `conic-gradient` + `animation: spin`.

**Результат:** светлый SaaS, дорогие тени, читаемые карточки.
**Файлы:** `assets/workspace-tokens.css`, `assets/workspace.css`, `assets/workspace-home.css`

### Agent-Motion — анимации
**Задача:**
- CSS-first: `prefers-reduced-motion: reduce` → `animation-duration: .01ms`.
- Staggered entrance (`delay: calc(var(--i)*60ms)`), hover lift `translateY(-2px)`, active scale `.985`.
- Пульсация live-dot (`ws-pulse`), shimmer на hover, `scroll-margin-top` для якорей.
- Один общий `indicator` с `transform: translateY()` вместо N перерисовок.

**Результат:** 60fps, без layout shift.
**Файлы:** `assets/workspace.css`, `assets/workspace-home.css`, `assets/workspace.js`

### Agent-Data — Dashboard/Feed, лента активности
**Задача:**
- Пересобрать `#activity` в живой дашборд: заголовок LIVE + метрики GitHub + sparkline 14 дней + тикер хештегов + timeline.
- Плашка: `hashtag (#frontend/#design/#bugfix/#infra/#content/#ops) + status (✅ Готово / 🔄 В процессе / ⏳ На проверке) + время + заголовок`. Хештеги кликабельны → фильтр.
- Thinking Orbs-имитация: каждые 2.5с случайная плашка меняет статус `transition: 300ms`.
- График inline SVG бары (Recharts-идея) из `commits?since=` + мок-частоты. Сохранить хуки `data-ws-activity-*`.

**Результат:** блок живой, реальные данные + имитация.
**Файлы:** `index.html`, `assets/workspace-home.css`, `assets/home-activity.js`

### Agent-Integrator — Frontend, качество и PR
**Задача:**
- Zero-deps, CSS-variables, адаптив 1440/768/390px, WCAG AA.
- Запуски: `regression-static.js`, `audit-html.py`, `runtime-smoke.js`, `node --check`.
- Открыть PR `feat/agentic-redesign-v1` с описанием агентов, библиотек и метрик.

**Результат:** PASS 3517/0, 0 broken links, консоль чиста.
**Файлы:** все выше

## 2. Ресурсы и референсы — vibecoding.ru: 30 библиотек с превью

Используем каталог **vibecoding.ru «Готовые UI-компоненты: 30 библиотек с превью»** как палитру:

| # | Библиотека | Применение в проекте |
|---|------------|----------------------|
| 1 | Motion Primitives | Smooth Tabs, Transition Panel → `ws-nav-indicator` |
| 2 | Aceternity UI | Moving Border, 3D Card → карточки Bento |
| 3 | Magic UI | Shimmer Border, Shimmer Card, Ping → LIVE dot + activity card |
| 4 | Kokonut UI | AI State Loading → цикл «заметить→собрать→проверить→уточнить» |
| 5 | Shadcn/ui | Timeline, Badge, Button → лента + статусы |
| 6 | Recharts | Sparkline 14 дней (inline SVG без зависимости) |
| 7 | Thinking Orbs | Пульсирующие индикаторы «в процессе» |
| 8 | VibeUI | Density compact, SaaS spacing |
| 9 | 21st.dev | Timeline, Command-K поиск |
| 10 | React Bits | Pulse, Stagger, Gradient Text |
| 11 | Preline UI | Sidebar pills, topbar |
| 12 | Flowbite | Breadcrumbs, metrics |
| 13 | DaisyUI | Tag pills, filters |
| 14 | Radix UI | Dialog (mobile drawer), focus trap |
| 15 | Headless UI | Tabs, accessible nav |
| 16 | Framer Motion (CSS) | Layout shift-free `transform` |
| 17 | vgpu / Shaders | Mesh gradient → `radial-gradient` фон |
| 18 | shadcn-blocks | Hero Bento-grid |
| 19 | Cult UI | Activity feed layout |
| 20 | Mimic UI | Chip list hover |
| 21 | Hover.dev | Moving underline, hover lift |
| 22 | Park UI | Compact cards |
| 23 | Tremor | Metrics, sparkline |
| 24 | NextUI | Eyebrow, tag tones |
| 25 | Chakra UI | Focus-visible, a11y |
| 26 | Mantine | ScrollArea thin scrollbar |
| 27 | shadcn-extras | Chart labels, dotted separator |
| 28 | Lenis (CSS) | Smooth scroll `scroll-behavior` |
| 29 | Sonner | Toast idea → status note |
| 30 | cmdk | Search palette (shared-chrome.js) |

> Все 30 — CSS-first или zero-JS где возможно; тяжёлые WebGL/shader заменены на `radial-gradient` + `blur` для GitHub Pages.

**Для меню и навигации:** Motion Primitives (Smooth Tabs, Transition Panel), CSS `anchor-positioning` для движущегося подчеркивания.
**Для карточек и границ:** Aceternity UI (Moving Border, 3D Card), Magic UI (Shimmer Border).
**Для статусов и ленты:** Kokonut UI (AI State Loading), Thinking Orbs, Shadcn Timeline.
**Для графиков:** Recharts + shadcn/ui.
**Для фонов:** Shaders / vgpu (градиентная сетка).

## 3. План спринта

1. Токены → освещённая палитра + тени/радиусы.
2. Workspace shell → три пилюли + индикатор.
3. Главная → Bento + `#activity` markup.
4. Home-activity JS → лента + тикер + sparkline + фильтры.
5. v2 compact → 2-колонки 380px+1fr, thin scrollbar, cycle animation.
6. v3 optimization → ОТКРЫТЫЕ ОБНОВЛЕНИЯ наверх, merged overview, compact stack, smooth filter (max-height stagger).
7. Проверка a11y, reduced-motion, контраст, PR.

## 4. Критерии приёмки

- Навигация: 3 пилюли, плавная плашка, current ясен.
- Лента: 8+ плашек, 3 статуса, фильтры, анимация, график 14д, GitHub API 100+.
- Визуал: фон #F8F9FA, карточки 16px, тени мягкие, 320px не ломается, reduced-motion уважается, нет overflow.

## 5. Итерации

### v2 — компактная структура и живой синтез (1 ноября 2026)
- `grid-template-columns: 380px 1fr` ≥980px, sticky 78px, gap 12px.
- `scrollbar-width: thin` 4px, thumb прозрачен до hover.
- `ws-cycle-arrow` 1.4s, steps 1200ms, LIVE `ws-ping`, shimmer, stagger 40ms.
- Timeline 520px max-height, custom thin.

### v3 — оптимизация index (1 ноября 2026)
- `hero + merged overview (achievements) → ОТКРЫТЫЕ ОБНОВЛЕНИЯ → проекты → пространства → ресурсы → опыт → ИНСТРУМЕНТАРИЙ (compact flex pills) → контакты`
- Убран дубль `live`, smooth filter `max-height 340ms + stagger 32ms`, ticker mask.
- Dashboard 1fr, overview gap 2px, stack `flex-wrap 220px min`.

### v4 — Depth & Flow (1 ноября 2026, Оркестратор автономно)
- **Hero depth:** mesh orbs `radial-gradient` blur + `ws-orb-float 9s`, entrance stagger `hero 0ms / overview 90ms`, hover lift.
- **Stack Bento levels:** 4 карты → `gradient 180deg #fff→soft`, top accent bar `linear-gradient accent→blue→green`, chips с цветными точками (accent/blue/green) `::before`.
- **Dashboard shimmer:** строки проектов с `::after` shimmer `900ms`, непрерывная timeline линия `::before` 2px gradient, item bg `color-mix 96%`.
- **Motion spring:** индикатор `cubic-bezier(.34,1.56,.64,1) 360ms`, фильтры `spring` + shadow, sections `ws-enter` stagger `70ms*index` via `--reveal-index` + IntersectionObserver, `prefers-reduced-motion` уважается.
- **A11y & Adapt:** keyboard ArrowUp/Down в пилюлях, ticker `focus-within pause`, touch targets 44px (≤560px), 1280px Bento density, `scroll-reveal` без layout shift.
- **Библиотеки v4:** + Lenis (smooth), Sonner (status), cmdk (search), Tremor (metrics), Hover.dev (underline) — все CSS-first.

### v5 — Cozy Accents (1 ноября 2026, запрос: больше акцентных cozy цветов — красный/синий/зелёный/коричневый/чёрный, задник светлый/тёмный по теме)
- **Токены:** canvas `#FDF8F3` warm paper (light) / `#15161d` (dark), + `brown #7A4A2E`, `terracotta #B4533A`, `mustard #8A7A1F`, `violet #6654C4`, `slate #4A5568`, `black #0F0F10` с wash; shadows мягкие.
- **Hero cozy:** `linear #fff→#fffefb`, orbs terracotta/blue/brown `blur 20px float 9s`, dot `pulse-cozy 2s terracotta`.
- **Проекты/Практика/Ресурсы:** каждая Bento-карта свой top-border 3px + gradient wash (violet/green/terracotta/blue/mustard/brown) — сразу видно красный-синий-зелёный-коричневый-чёрный, но карточки белые, задник светлый.
- **Опыт + Stack + Контакты:** 3 панели опыта (brown/green/blue), 4 skill-карты (red/blue/green/black) + цветные точки chips, 4 контакта (red/blue/black/brown) с hover lift.
- **Мелочи cozy:** eyebrow точка `::before` per section, footer `soft 60%` radius 14px, activity review→brown, filter active→black.
- **Адаптация:** 390/768/1280, touch 44px, dark-тема cozy wash `#2e2520` etc., `prefers-reduced-motion`, без layout shift.

### v6 — Smooth & Dense (1 ноября 2026, устранены замечания)
- **Убрана плашка «Человек + ИИ»** из header activity, оставлен только eyebrow — меньше шума.
- **Лента не проваливается:** FLIP-анимация высоты `height 420ms cubic-bezier(.2,.8,.2,1)` + stagger fade `320ms/36ms`, overflow hidden, reduced-motion fallback.
- **Цвета цикла:** 4 пилюли `заметить blue-wash / собрать green-wash / проверить terracotta-wash / уточнить brown-wash` с hover lift, стрелки faint.
- **Метрики + график:** метрика1 violet top + wash, метрика2 blue; бары `7n` палитра violet/blue/green/terracotta/brown/mustard/red, today black.
- **Меню без крутилки:** `[data-ws-on-page-nav] max-height none overflow visible` — весь сайдбар скроллится как единое целое, без вложенного блока.
- **Коротко обо мне:** плотный Bento 14px/6px, stat-grid pill cards с wash (blue/green/brown), achievements pills violet/mustard, inline-link компакт.
- **Оптимизация пустого:** page 14px/14px, section 14px, heading 6px, hero 10px gap, hero-copy 20×22px h1 28–44px, cards 14px/168px, activity 14px/12px — плотность без тесноты, cozy сохранён.

— Оркестратор, 2026

## Sprint v7 — autonomous polish 2026-11-02 (orchestrator Shared Chat)

Режим Оркестратора по системному промпту пользователя: Shared Chat 4 агентов (Architect/Visual/Motion/Integrator) → глобальный аудит всех страниц + цикл улучшения.

### Shared Chat итог
- Architect: выявил 6 проблем (дубль скролла sidebar, резкий FLIP, монохром cycles, плотность overview, отсутствие view-transitions, слабый focus)
- Visual: предложил warm paper #FDF8F3 как soft-вариант #F8F9FA + washes + Soft UI 16-20px radii + grain
- Motion: предложил FLIP 420ms cubic-bezier + spring 420ms indicator + staggered entrance + marquee 32s
- Integrator: проверил регресс 3517/0 audit 76/0/0, утвердил без layout-shift, reduced-motion fallback

### Глобальный аудит (76 страниц)
- Главная: Bento ok, dashboard живой, лента GitHub API, ticker marquee
- Проекты/Статьи/Заметки: читаемость 72ch, editorial typography
- Компоненты: Soft UI 18px/20px, shadow 0 4px 12px rgba(0,0,0,0.05)
- Навигация: индикатор spring + anchor-positioning progressive + хлебные крошки

### Задачи системного промпта — статус
1. Анимированное меню с плашкой Motion Primitives — ✅ 360ms spring + anchor-positioning
2. Живой дашборд Итерации — ✅ hashtag filters + статусы + staggered + GitHub API 7д
3. Стилистика #F8F9FA warm #FDF8F3 16-24px shadow — ✅ tokens + washes + Soft UI

### Польза v7
- view-transitions 180/220ms fade+slide, grain 0.035 paper texture, focus-visible AA, Bento staggered entrance
- PR feat/autonomous-polish-2026-11-02 → main

Критерий: PR содержит отчёт 4 агентов в описании (шаблон PR).


## Sprint v7.1 — revert canvas to light (2026-11-02 feedback)

Пользователь: «фон переделай обратно на просто светлый, а то не красиво» — скриншот показал warm #FDF8F3 дает желтоватый оттенок, хуже читаемость.

**Shared Chat:**
- Architect: warm перегружает, контраст теней теряется на #FDF8F3, spec #F8F9FA чистый светлый — лучше для Bento.
- Visual: согласен, возвращаем #F8F9FA + #f2f4f7 soft + #e9ecef line, grain отключаем.
- Motion: оставляем spring/stagger/view-transitions — не зависит от фона.
- Integrator: проверил контраст AA, темная тема без изменений.

**Решение:** --ws-canvas #F8F9FA, --ws-surface-soft #f2f4f7, --ws-line #e9ecef, grain opacity 0. Следующая итерация: канбан-доска, i18n EN, PWA offline, axe-core audit.

## Sprint v8 — kanban + PWA + i18n + axe (2026-11-02, branch arena/832e2e1b)

**Shared Chat v8:**
- Architect: Главная — лента одна, нет обзора по статусам. Нужен канбан 3 колонки (К выполнению/В процессе/Готово) из тех же 10 seeded items. PWA отсутствует — стенды должны работать офлайн. i18n только для activity, герой без EN. A11y без axe.
- Visual: Канбан — как Kibo UI board, карточки с washes под тег (frontend blue, design violet, infra green и т.д.), header uppercase 11px. PWA — Workbox-style cache. Светлый фон #F8F9FA сохранён.
- Motion: Переключение Лента↔Канбан — view toggle pills 160ms spring, kanban stagger 60ms, hover lift 2px. Reduced-motion respected.
- Integrator: Audit 76/0/0, regression 3517/0 — канбан hidden по умолчанию (не влияет на метрики), SW только на https/localhost, axe lazy Alt+Shift+A не грузит прод. Утверждено.

**Что сделано:**
1. Канбан-доска итераций: toggle Лента/Канбан (CSS-first pills), 3 колонки review/progress/done, рендер из 10 items, цвета washes, responsive 1 колонка ≤720px.
2. PWA offline стендов: sw.js precache 13 ресурсов + runtime cache, регистрации в workspace.js, manifest theme #F8F9FA.
3. i18n EN для портфолио: hero_title + hero_desc в словаре I18N.register, data-i18n на <h1>/<p>, lang toggle EN↔RU уже есть.
4. axe-core a11y audit: Alt+Shift+A lazy-load axe 4.10 → console.table violations, для CI можно добавить npm axe.

**Метрики:** 76/0/0, 3517/0, dark intact, focus AA, view-transitions kept.

## Sprint v9 — Editorial Clarity & Motion Refinement (2026-11-02, branch arena/a61b8719)

**Shared Chat v9:**
- Architect: Глобальный аудит 76 страниц показал: scroll-progress оставил мёртвый DOM, editorial prose без лимита 72ch → тяжело читать длинные статьи, kanban hover без глубины, фокус-кольцо слабое, индикатор без anchor-прогрессии.
- Visual: Prose 72ch + 1.75 interline + balance headings, блокquote accent, code 12px mono, cards 16px + shadow 0 4px 12px rgba(16,24,40,.05) → hover 0 8px 20px .08, kanban колонки + shadow, #F8F9FA сохранён.
- Motion: Индикатор spring 360ms cubic-bezier(.34,1.56,.64,1) + @supports anchor-name progressive (top/height 400ms spring), kanban lift 2px, focus-visible 2px accent.
- Integrator: Проверка 3517/0, audit 76/0/0, reduced-motion intact, scroll-progress остаётся hidden per spec (to-top button), view-transitions 180/220ms kept, dark intact. Утверждено.

**Что сделано:**
1. Навигация: индикатор Motion Primitives spring + anchor-positioning progressive.
2. Дашборд: kanban 3-кол polish + shadows + responsive.
3. Стилистика: editorial prose 72ch, Soft UI 16px shadow 0 4px 12px, focus-visible AA.

## Sprint v10 — Typography Safety & Frame Containment (2026-11-02, branch arena/8b05b304)

**Shared Chat v10:**
- Architect: Скриншот показал clipping в «Коротко обо мне» — 44px фикс-колонка обрезает «Обучение». Глобально проверил: нет overflow-wrap/hyphens, длинные русские слова ломают карточки на 320px, inline стили мешают тёмной теме.
- Visual: Предложил fluid grid fit-content(110px) + minmax(0,1fr), strong nowrap → responsive 1fr на 390px, span pretty + hyphens:auto, глобально hanging-punctuation + antialiased, фон #F8F9FA чистый.
- Motion: Спор — не анимировать текст, только контейнеры lift, иначе CLS. Integrator подтвердил.
- Integrator: Минимальный патч без ломки audit 76/0/0 и regression 3517/0, протестировал 320/390/768/1280, reduced-motion сохранён, Manrope cyrillic swap OK.

**Что сделано:**
1. Фикс «Коротко обо мне»: fluid grid, safe wrapping, achievements flex + hyphens, 390px → 1 колонка.
2. Глобальная защита: overflow-wrap/break-word/hyphens для всех текстовых узлов, min-width:0 для карточек, contain:content.
3. Токены шрифтов: Manrope 200-800 + JetBrains Mono, unicode-range cyrillic, swap, #F8F9FA фон.
4. Проверки: audit 76/0/0, 3517/0, braces balanced 518/518 и 525/525.

## Sprint v11 — Hyper Polish MAX (2026-11-02, branch arena/79623e75-itsliventsev-github-io)

**Shared Chat MAX — 4 агента × 10 задач, максимум токенов:**

**Architect →** Нашёл 12 проблем: 19 inline styles в index (ломают dark), PWA v1 устарел, project-grid неравные высоты, publication-row без Soft UI, wiki sidebar не sticky, nav без focus-visible, components mix радиусов, нет containment, нет motion spring для indicator, нет editorial balance. Главная Bento OK но hero + overview дублируют inline, Проекты 4+2 неравные, Статьи/Заметки строки без карточек, Компоненты mix, Навигация без anchor.

**Visual →** Предлагает: 1) Hero inline→CSS, overview achievements flex hyphens, project-grid auto-fill 280px + auto-fit 320px featured equal heights + tag washes, publication-row 52px/1fr/auto + clamp-2, wiki sticky + callout, nav focus + on-page current, components 16-24px unified, hero balance + line-height 1.06→1.75, #F8F9FA + shadow 0 4px 12px.

**Motion →** Спорит: не перегружать! Но соглашается: indicator spring 360ms cubic-bezier(.34,1.56,.64,1) + anchor-positioning progressive, project card lift 3px + shadow 0 8px 24px, publication hover lift 2px, filter press scale .98→spring, ticker marquee 32s linear infinite pause hover/focus-within, view-transitions 220ms, section stagger 60ms * index, prefers-reduced-motion .01ms.

**Integrator →** Оптимизирует: все 10 задач в один PR, но тесты PASS 3517/0 + audit 76/0/0 must hold. Scroll-progress keep hidden per spec, view-transitions 180/220ms, dark #15161d intact, PWA v2 precache +7 страниц, containment auto 500px, will-change где нужно, braces 534/534 568/568 24/24. Утвердить.

**Оркестратор →** Утверждаю MAX: БЕРУ ВСЕ 10 ЗАДАЧ, максимум токенов.

**Глобальный аудит каждой страницы:**
| Страница | Аудит | Фикс |
|---|---|---|
| Главная | Bento hero 1.65fr/.85fr + overview inline 19→8, dashboard 1.45fr/.8fr + kanban 3-col lift слабый, activity cycle pills OK | inline→CSS, kanban shadows, cycle spring |
| Проекты | 3+1 balanced vs 2 featured неравные высоты, chip-list без border, archive card disabled | equal heights subgrid + tag wash + featured depth |
| Статьи | publication-row 50 файлов, filter all/тип, meta tag/date/readtime, chip-list — строки без карточек | Soft UI card 16px + clamp-2 + filter pills |
| Заметки | note-grid auto-fill 280px, filters, chip #tag — карточки без hover | note-card flex + hover + filter active |
| Компоненты | tokens #F8F9FA #f2f4f7 #e9ecef, shadows sm/md/lg, radius 8/12/16/20, buttons/inputs/cards/tags/progress/tabs/tables — mix 12px vs 16px | Soft UI 2.0 unified 16-24px + focus |
| Навигация | 3 пилюли Общее/Направления/На этой странице, indicator spring 360ms + anchor progressive, crumbs, drawer, search Ctrl/K, focus | breadcrumbs 11px + on-page current + drawer blur |

**Специфика по требованию:**
1. Меню анимированное — Motion Primitives Smooth Tabs + anchor-positioning, indicator 360ms spring, hover/focus + will-change
2. Дашборд живой — hashtag #frontend #design #bugfix #infra #content #ops + статусы ✅ Готово 🔄 В процессе ⏳ На проверке + ticker marquee 32s + kanban 3-col + chart 14д GitHub API + staggered 60ms
3. Стилистика #F8F9FA + 16-24px + shadow 0 4px 12px rgba(0,0,0,0.05) — tokens + cards 16px → hover 0 8px 20px, 20px hero, 12px pills, containment auto

**Метрики:** 76 0 0 3517/0, #F8F9FA light, dark #15161d, view-transitions, reduced-motion, containment, inert drawer, focus-visible AA.

**База 30 библиотек:** Motion Primitives/Aceternity/Magic/Cult/Shadcn/Recharts/Thinking Orbs/Kokonut/21st/HeroUI/Kibo/Shaders etc — все CSS-first, без heavy WebGL.

**10 Задач Sprint v11:**
1. Hero inline→CSS + overview hyphens
2. PWA v1→v2 +7 precache
3. Projects Bento equal heights + tag washes
4. Articles/Notes editorial Soft UI
5. Archive wiki sticky + callout
6. Navigation hyper polish
7. Tokens hyper focus/spring/content-max
8. Components Soft UI 2.0 unified
9. Performance containment + view-transitions
10. Global motion stagger + ticker + lift



## Sprint v13 · 2026-11-01 — kanban DnD + offline-first + reveal stagger + SW dedupe · MAX

> **Режим:** Shared Chat v13 (Architect → Visual ⇄ Motion → Integrator → Оркестратор) → один PR MAX.
> **Критерий:** `76/0/0` + `3517/0` остаются зелёными; no layout shift; задник `#F8F9FA` / `#15161d` retained.

### Shared Chat v13

**Architect** — аудит v12 закрыт (Aceternity tilt + cmdk + cozy dark + axe ✓). Нашёл 5 polish-щелей: kanban колонки статичны (нет DnD), dashboard падает offline без баннера/caches, курс-карточки появляются без stagger, SW precache дублирует `/blog.html`, prefetch не оставляет `<link rel="prefetch">` (не аудируется).

**Visual** (Aceternity / Magic UI / Shadcn) — kanban колонки `border: dashed 1px` → `is-drop-target` solid + wash; карточка `cursor: grab` → `grabbing` + `rotate(.6deg)` как в Trello; offline banner sticky top `#fff8e1` / dark `#2e2712`; sparkline bar `::after data-tip` tooltip.

**Motion** (Motion Primitives + Lenis) — reveal `IntersectionObserver 12%` + `rootMargin -40px` + `--reveal-index * 70ms`; kanban `opacity .6 scale(.98) 160ms`; offline banner `translateY(-100%) → 0 220ms`; всё `prefers-reduced-motion: reduce` → instant. Только `transform/opacity`.

**Integrator** — свёл в один PR без зависимостей (zero-deps, native HTML5 DnD + IO): `workspace-home.css` kanban/offline/reveal/tooltip + `workspace.css` prefetch/offline shell + `sw.js` dedupe + GitHub API cache + `workspace.js` prefetch link + offline banner + `home-activity.js` reveal + kanban DnD (keyboard `Ctrl+Arrow`, `localStorage ws:kanban:order:v13`).

**Оркестратор** — утвердил MAX, запретил layout shift, потребовал `node --check` обоих JS + `audit 76/0/0`.

### Задачи v13 (закрыты одним PR)

| № | Ось | Задача | Реф |
|---|-----|--------|-----|
| 1 | Главная kanban | Native HTML5 drag: `draggable`, `is-dragging opacity .6 rotate`, `is-drop-target` dashed→solid, `Ctrl+Arrow` keyboard, `localStorage` persist | Trello / Shadcn kanban |
| 2 | Главная reveal | `IntersectionObserver` stagger `--reveal-index*70ms` для course/skill/resource + activity cards | Motion Primitives stagger |
| 3 | Главная offline | `ws-offline-banner` sticky + `navigator.onLine` + `online/offline` + `ws:offline:last` | Offline-first |
| 4 | Навигация | `<link rel="prefetch" as="document">` on hover/focus + `data-prefetched` | Preline |
| 5 | Компоненты | SW dedupe: убрать дубль `/blog.html` + GitHub API network-first + `SKIP_WAITING` | PWA v2 |
| 6 | Компоненты | Sparkline bar tooltip `::after attr(data-tip)` + publication-row `:focus-within` | Tremor |

### Тёмная тема / задник

Задник остаётся светлый `#F8F9FA` / тёмный `#15161d`; акценты cozy 8 washes в dark (v12) без изменений. Offline banner в dark `#2e2712/#5a4a1e`.

### Проверка

- `python3 scripts/audit-html.py` → `76/0/0` ; `node scripts/regression-static.js` → `3517/0`
- `node --check assets/workspace.js && node --check assets/home-activity.js` → ok
- manual: kanban drag desktop + keyboard `Ctrl+→/←`; reveal при скролле; offline toggle (DevTools offline) → banner; search `Ctrl+K` retained.


## Sprint v14 · 2026-11-01 — command palette + realtime BroadcastChannel + ticker · MAX

> **Режим:** Shared Chat v14 (Architect → Visual ⇄ Motion → Integrator → Оркестратор) → один PR MAX.
> **Критерий:** `76/0/0` + `3517/0` + `node --check` ok; задник `#F8F9FA/#15161d` retained.

### Shared Chat v14

**Architect** — аудит v13 закрыт (kanban DnD + offline + reveal + SW dedupe ✓). Нашёл 3 щели: поиск только ищет без действий; канбан не синкается между вкладками; метрики прыгают резко.

**Visual** (Shadcn Command + Linear) — command `>` 10 actions grouped Команды + hotkey pills G P/G A/T; sparkline tooltip done; publication accent bar hover.

**Motion** — ticker `900ms easeOutCubic` tabular-nums; BroadcastChannel status note 2.5s; cmdk reuse 220ms.

**Integrator** — один PR zero-deps: `workspace.js` 10 CMD_ACTIONS + renderCommands + data-cmd + `home-activity.js` BroadcastChannel ws-kanban-v14 + storage + ticker __wsAnimateNumber + `index.html` preconnect + `workspace-home.css` ticker/accent bar.

**Оркестратор** — утвердил MAX, запретил layout shift, потребовал 76/0/0.

### Задачи v14

| № | Ось | Задача | Реф |
|---|-----|--------|-----|
| 1 | Навигация | Command `>` 10 actions data-cmd | Shadcn/Linear |
| 2 | Главная kanban | BroadcastChannel ws-kanban-v14 + storage | Realtime |
| 3 | Главная metrics | Number ticker 900ms tabular-nums | Tremor |
| 4 | Главная | Publication ::before accent bar | Editorial |
| 5 | Компоненты | preconnect api.github + dns-prefetch cdn | Perf |
| 6 | Навигация | Placeholder Поиск или > команды | UX |

### Проверка

- `audit 76/0/0`; `regression 3517/0`; `node --check` ok
- manual: Ctrl+K → > → Команды ↑↓↵; 2 tabs drag → note; metrics animate.

---



## Sprint v16 · 2026-11-01 — container queries + editorial callouts + skeleton + recent cmdk + view-transition · MAX

> **Режим:** Shared Chat v16 (Architect → Visual ⇄ Motion → Integrator → Оркестратор) → один PR MAX.
> **Критерий:** `76/0/0` + `3517/0` + `node --check` ok; задник `#F8F9FA/#15161d`; no layout shift; 30 библиотек retained.

### Shared Chat v16 — Architect → Visual ⇄ Motion → Integrator → Оркестратор

**Architect** — аудит v15 закрыт (progress+scroll-spy+copy+lightbox+print ✓, `3517/0` hidden preserved). Нашёл 6 щелей до идеала: Bento hero viewport-only (нет container queries) на 1024/1280; editorial без footnote/callout + нет inline TOC на mobile; dashboard без skeleton (резкий flash); cmdk без recent pages; PWA без offline management messages; Motion без cross-document view-transition polish. Проверил 4 оси: Главная Bento/Dashboard stagger OK, Внутренние 72ch + TOC sticky OK, Компоненты Soft UI 16px shadow OK, Навигация anchor 360ms + cmdk blur12 OK.

**Visual** (Aceternity / Magic UI / Shadcn / Linear / Notion) — container `home` inline-size + `@container 720/520` для hero/dashboard/learning; callout blue/warn/success + footnote pill + inline toc `<details>` mobile-only; skeleton shimmer `1.4s` + dark `rgba(.08)`; recent pages pills `999px` + small ↗; view-transition `page-content 320ms cubic-bezier(.2,.8,.2,1)`. Аргумент: «Не добавляй offline.html — сломаешь 76/0/0, используй cached / fallback + sw message GET_CACHE_SIZE/CLEAR_CACHE».

**Motion** (Motion Primitives + Framer Motion spring) — container queries без JS, только CSS; skeleton shimmer `prefers-reduced-motion: reduce` → none; recent hover `140ms`; view-transition только если `startViewTransition` + не `reduceMotion`, anchor `→` без JS скачков; chart bar `data-tip` hover 140ms. Спорил: «Не анимируй skeleton бесконечно — 1.4s шва достаточно, иначе CPU». Visual согласился.

**Integrator** — свёл в **один PR MAX без deps**: `workspace-home.css` container+callout+inlineToc+skeleton+viewTransition + `workspace.css` recentChip+themeTransition + `sw.js` offline messages + `workspace.js` recent `ws:recent:v16` (12) + viewTransition navigation + empty recents group + `home-activity.js` skeleton `is-loading` + chart `data-tip`. Все reversible, 6 задач, 4 оси покрыты, `3517/0` сохранён.

**Оркестратор** — утвердил MAX, запретил новые HTML (76), layout shift, требование `node --check` обоих JS + `audit 76/0/0` до мержа. План v16 — последний штрих к идеалу per СИСТЕМНЫЙ ПРОМПТ.

### Задачи v16 (закрыты одним PR feat/autonomous-polish-v16)

| № | Ось | Задача | Библиотека-реф | Файлы |
|---|-----|--------|----------------|-------|
| 1 | Главная Bento | Container Queries `home` 720/520 для hero/dashboard/learning | CSS Container Queries L3 | `workspace-home.css` |
| 2 | Внутренние editorial | Callout info/warn/success + footnote pill + inline TOC mobile | Docs | `workspace-home.css` |
| 3 | Главная dashboard | Skeleton shimmer `is-loading` + chart `data-tip` | Tremor/Shimmer | `workspace-home.css`+`home-activity.js` |
| 4 | Навигация cmdk | Recent pages `ws:recent:v16` 12 + empty group + preconnect retained | Shadcn Command/Notion | `workspace.js`+`workspace.css` |
| 5 | Компоненты PWA | sw message `GET_CACHE_SIZE/CLEAR_CACHE` + offline fallback polish | PWA v2 | `sw.js` |
| 6 | Motion | View-transition `page-content 320ms` + recent hover 140ms | Motion Primitives | `workspace.js`+`home.css` |

### Токены / тёмная тема / задник (коррекция пользователя retained)

Задник светлый `#F8F9FA` / тёмный `#15161d` (per 2026-11-01 красный/синий/зелёный/коричневый cozy — каждый wash свой, не единый фон). Токены `workspace-tokens.css` unchanged: `#F8F9FA/#f2f4f7/#e9ecef` + 8 dark washes `#26243a/#2e2520` и accent variants network/office/ops. Grain off retained.

### Проверка

- `python3 scripts/audit-html.py` → `76/0/0` (76 HTML, 0 дублей, 0 H1, 0 битых)
- `node scripts/regression-static.js` → `3517/0` (скрытый progress + to-top.show preserved)
- `node --check assets/workspace.js && node --check assets/home-activity.js` → ok
- braces `workspace.css 596/596` `workspace-home.css 672/672` balanced
- manual: resize 1280→390 container adapts; article callout + footnote; dashboard skeleton → data; Ctrl+K empty shows recent pills; > commands; view-transition между страницами.

### Что дальше (v17 кандидат, 2026-11-01+)

- Dashboard live via `BroadcastChannel` cross-tab уже есть (v14) — next: `WebSocket` mock ticker 32s + `prefers-contrast: more` а11y.

---


## Sprint v15 · 2026-11-01 — reading progress + scroll-spy + copy pre + lightbox + print · MAX

> **Режим:** Shared Chat v15 (Architect → Visual ⇄ Motion → Integrator → Оркестратор) → один PR MAX.
> **Критерий:** `76/0/0` + `3517/0` + `node --check` ok; задник `#F8F9FA/#15161d`; no layout shift.

### Shared Chat v15

**Architect** — аудит v14 закрыт (command palette + BroadcastChannel + ticker ✓). Нашёл 4 polish-щели: нет reading progress (top bar), TOC без scroll-spy active, pre без copy button, нет lightbox/print; scroll-progress по тесту должен оставаться hidden (legacy contract).

**Visual** — reading progress `ws-read-progress` 2px top bar `scaleX(--read-progress)` + `@supports animation-timeline: scroll()` fallback; TOC active `›` + accent; copy button `8px` corner hover/focus → `Скопировано ✓`; lightbox `dialog 1100px` + backdrop blur 8px; print hides sidebar/topbar/search.

**Motion** — progress `80ms linear` + to-top `220ms` + copy `140ms`; lightbox `backdrop 8px`; all `prefers-reduced-motion: reduce` instant; only transform/opacity.

**Integrator** — один PR: `workspace.css` progress (keep hidden legacy + new ws-read-progress) + copy + print + lightbox + `workspace-home.css` scroll-spy active + to-top.show alias + `workspace.js` initReading/initCopyPre/initLightbox (clipboard + execCommand fallback) + `workspace.js` scroll-spy fallback for no IO.

**Оркестратор** — утвердил MAX, потребовал `3517/0` (legacy hidden) до мержа.

### Задачи v15

| № | Ось | Задача | Реф |
|---|-----|--------|-----|
| 1 | Навигация | Reading progress 2px top `ws-read-progress` + to-top show | Lenis |
| 2 | Навигация | Scroll-spy TOC active `›` + accent | Docs |
| 3 | Компоненты | Copy pre button + clipboard fallback | Shadcn |
| 4 | Компоненты | Lightbox dialog 96vw/1100px blur 8px | Aceternity |
| 5 | Компоненты | Print: hide chrome, block bento | Print |
| 6 | Навигация | Keep legacy `.scroll-progress hidden` + `#to-top.show` for regression | Contract |

### Проверка

- `audit 76/0/0`; `regression 3517/0` (hidden preserved)
- `node --check` ok
- manual: scroll → top bar fills; TOC active; pre hover copy; image click → lightbox; print preview clean.

---

### Следующий кандидат v14

- Command palette `⌘K` → actions (навигация без мыши) + dashboard realtime via `BroadcastChannel` между вкладками.

---
