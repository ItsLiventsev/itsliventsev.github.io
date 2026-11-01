# AGENT_PLAN — Agentic Redesign v1 · itsliventsev.github.io

**Дата:** 1 ноября 2026 · **Оркестратор:** CTO/Art-Director · **Цель:** продукт 2026 года — светлый Soft UI, анимированная навигация и живая лента итераций.

## 0. Манифест и аудит

Текущий сайт — 75 HTML-маршрутов на статическом GitHub Pages. Сохраняем: все URL, SEO, учебные движки (СетьПолис / ОфисПолис / ДатаПолис), JSON-контент, поиск, темы, storage-контракты. Переписываем визуальный слой: токены → workspace shell → домашний дашборд.

**Проблема аудита:**
- Навигация уже сегментирована (`РАЗДЕЛЫ САЙТА` / `НАПРАВЛЕНИЯ` / `На этой странице`), но без движущегося индикатора, без визуального разделения-пил и без ощущения «где я».
- Блок `Сайт развивается итерациями` — статичная карточка с числом коммитов. Нет чувства живой мастерской, нет хештегов, ленты, графика.
- Палитра `#f3f4f7` темновата для SaaS, тени резковаты, карточки не Bento, микровзаимодействий минимум.

**Видение:** `F8F9FA` канвас + белые карточки 16px + мягкие тени + bento-сетка + движения CSS-first (Motion Primitives паттерн). Навигация — как Smooth Tabs с плашкой, лента — как AI State + Timeline + Recharts sparkline.

## 1. Команда суб-агентов

### Agent-Navigator — UX/IA, навигация
**Задача:**
- Разбить sidebar на 3 пилюли-контейнера: `Общее меню` (Обзор, Проекты, Статьи, Заметки, Архив, Справка, Карта) · `Направления` (СетьПолис, ОфисПолис, ДатаПолис) · `На этой странице` (оглавление из H2).
- Внедрить движущийся индикатор: `ws-nav-indicator` — абсолютно позиционированная плашка `background: var(--ws-accent-wash)` с `transition: transform 280ms cubic-bezier(.2,.8,.2,1)`. Позиция пересчитывается JS на `mouseenter`/`focus` и `aria-current`.
- CSS `anchor-positioning` как прогрессивное улучшение + JS фолбэк; `@supports` не ломает старые браузеры.
- Desktop: индикатор не показывается в компактном режиме; mobile drawer — модальный диалог, `inert` фон, ловушка фокуса.

**Результат:** активный пункт подсвечивается плавно, пользователь понимает иерархию, хлебные крошки остаются в topbar.

**Файлы:** `assets/workspace.css`, `assets/workspace.js`

### Agent-Visual — UI/Art-Direction, Soft UI
**Задача:**
- Осветлить палитру: `--ws-canvas: #F8F9FA`, `--ws-surface-soft: #f2f4f7`, обновить `--ws-shadow-sm/md/lg` на мягкие многослойные (0 1px 2px rgba(16,24,40,.04)).
- Крупные скругления 16px (`--ws-r-3`), бело-карточный Bento-grid для hero/dashboard/skill/resource, единый ритм 8px.
- Типографика Manrope (self-hosted) + Inter fallback, `letter-spacing: -.045em` для заголовков, `font-variant-numeric: tabular-nums` для цифр.
- Добавить `ws-bento`, `ws-shimmer` (Magic UI Shimmer Border) и `aceternity moving border` как `::before` с `conic-gradient` + `animation: spin`.

**Результат:** светлый SaaS, дорогие тени, читаемые карточки.

**Файлы:** `assets/workspace-tokens.css`, `assets/workspace.css`, `assets/workspace-home.css`

### Agent-Motion — анимации
**Задача:**
- CSS-first анимации: `prefers-reduced-motion: reduce` → все `animation-duration: .01ms`.
- Staggered entrance карточек (`animation-delay: calc(var(--i)*60ms)`), hover lift `translateY(-2px)`, active scale `.985`.
- Пульсация live-dot (`@keyframes ws-pulse`), бегущий градиент шімера на hover, `scroll-margin-top` для якорей.
- Использовать Motion Primitives идею: один общий `indicator` с `transform: translateY()` вместо N перерисовок `top`.

**Результат:** 60fps, без layout shift.

**Файлы:** `assets/workspace.css`, `assets/workspace-home.css`, `assets/workspace.js`

### Agent-Data — Dashboard/Feed, лента активности
**Задача:**
- Пересобрать `#activity` в живой дашборд: заголовок с LIVE-точкой + метрики GitHub + sparkline последних 14 дней + горизонтальный тикер хештегов + вертикальный timeline.
- Плашка события: `hashtag (#frontend/#design/#bugfix/#infra/#content/#ops) + status (✅ Готово / 🔄 В процессе / ⏳ На проверке) + время + заголовок`. Хештеги кликабельны → фильтр ленты.
- Быстро меняющиеся плашки: имитация «thinking orbs» — каждые 2.5с случайная плашка меняет статус с `transition: all 300ms`.
- График: inline SVG бары (Recharts-идея) из GitHub `commits?since=` + мок-частоты (последние 14 дней). Адаптив, `aria-label`.
- Сохранить старые хуки `data-ws-activity-count/date/sha/commit` для регрессии, добавить `data-ws-activity-ticker/timeline/chart/filter`.

**Результат:** блок выглядит живым, реальные данные + имитация, статусы читаемы.

**Файлы:** `index.html`, `assets/workspace-home.css`, `assets/home-activity.js`

### Agent-Integrator — Frontend, качество и PR
**Задача:**
- Обеспечить сборку без зависимостей, zero-deps JS, чистый CSS-variables.
- Адаптив 1440/768/390px, клавиатурная доступность, контраст WCAG AA (проверить luminance).
- Запустить: `node scripts/regression-static.js`, `python3 scripts/audit-html.py`, `node scripts/runtime-smoke.js`, `node --check assets/*.js`.
- Открыть PR `feat/agentic-redesign-v1` (в этой сессии — коммиты на `arena/39bc41ca-itsliventsev-github-io`) с описанием агентов, библиотек и метрик.

**Результат:** PASS 3400+, 0 битых ссылок, нет layout shift, консоль чиста.

**Файлы:** все выше + `scripts/regression-static.js` (обновить cache-bust ожидания если нужно)

## 2. Ресурсы и референсы

- **Меню:** Motion Primitives Smooth Tabs / Transition Panel + CSS anchor-positioning.
- **Карточки/границы:** Aceternity Moving Border, Magic UI Shimmer Border, 3D Card идея (hover perspective).
- **Статусы:** Kokonut UI AI State Loading, Thinking Orbs.
- **Лента:** Shadcn Timeline + badge statuses.
- **График:** Recharts (inline SVG без зависимости).
- **Фоны:** vgpu/shader лёгкий mesh gradient (реализован как `radial-gradient` без WebGL).

## 3. План спринта (порядок внедрения)

1. Токены → освещённая палитра + новые тени/радиусы.
2. Workspace shell → три пилюли + индикатор + логика навигации.
3. Главная → Bento рефреш + новый markup `#activity`.
4. Home-activity JS → лента + тикер + sparkline + фильтры.
5. Проверка адаптивности, reduced-motion, контраста, PR.

## 4. Критерии приёмки

- Навигация: три визуально отделённые группы, плавная плашка следует за ховером/активом, текущий раздел ясен без чтения URL.
- Лента: минимум 8 плашек с хештегами, 3 статуса, кликабельные фильтры, анимированная смена, график 14 дней, обновления из GitHub API (100+).
- Визуал: фон #F8F9FA, карточки белые 16px, мягкие тени, сетка не ломается на 320px, анимации уважают reduced-motion, нет горизонтального overflow.

— Оркестратор, 2026
