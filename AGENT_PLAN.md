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

— Оркестратор, 2026
