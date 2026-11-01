# Workspace / Learning OS — дизайн-система

Новая система интерфейса описана в `assets/workspace-tokens.css`, `assets/workspace.css`, `assets/workspace-learning.css` и `assets/workspace-home.css`. Новые компоненты используют namespace `ws-` и семантические `data-ws-*` атрибуты. Старые глобальные, модульные и Tailwind-таблицы стилей удалены; в репозитории остались только четыре новые Workspace-таблицы.

HTML и JavaScript практикумов пока сохраняют часть прежних классов как стабильные runtime-хуки. `assets/workspace.js` переводит визуальные состояния в `data-ws-*`, а новый CSS не использует старые классы и не привязан к прежней визуальной архитектуре. Это позволяет оставить движки, сохранённый прогресс и сценарии заданий без регресса.

## Визуальные принципы

- Светлая SaaS/LMS-рабочая среда: нейтральный canvas `#f3f4f7`, белые поверхности, тонкие холодные разделители, деликатные тени и умеренные радиусы.
- Единый акцент — спокойный фиолетовый; пастельные синий, зелёный и персиковый сообщают семантику статусов.
- Manrope для UI и длинного чтения; JetBrains Mono — для технического вывода.
- Сетка карточек, строк и курсов вместо терминальных композиций. Кнопки собраны в мягкие controls, без прыгающих и бесконечных эффектов.
- Движение ограничено быстрым состоянием hover/focus/drawer; `prefers-reduced-motion` убирает переходы.

## Токены

| Роль | Токен | Светлая | Тёмная |
|---|---|---:|---:|
| Фон приложения | `--ws-canvas` | `#f3f4f7` | `#15161d` |
| Поверхность | `--ws-surface` | `#fff` | `#1d1e27` |
| Вложенная поверхность | `--ws-surface-soft` | `#f8f8fb` | `#23242e` |
| Основной текст | `--ws-ink` | `#171821` | `#f1f1f5` |
| Вторичный текст | `--ws-ink-soft` | `#4f515d` | `#c6c7d0` |
| Акцент | `--ws-accent` | `#5e48d7` | `#a99bff` |
| Граница | `--ws-line` | `#e9e9ee` | `#30313c` |
| Отступы | `--ws-space-*` | 4/8/12/16/24/32px | — |
| Радиусы | `--ws-r-*` | 8/12/16/22px | — |
| Тени | `--ws-shadow-*` | sm/md/lg | theme-aware |

## Библиотека компонентов

- `WorkspaceShell`, `Sidebar`, `Topbar`, `Breadcrumbs`, `SearchDialog`, `MobileDrawer` — общий каркас и IA.
- `PageHeading`, `SurfaceCard`, `ActionButton`, `StatusTag` — базовые строительные блоки.
- `CourseCard`, `LearningPath`, `ProgressBar`, `Leaderboard`, `CertificatePanel` — LMS-паттерны для практических пространств.
- `PublicationRow`, `NoteCard`, `MetadataPanel`, `TableOfContents` — читательские шаблоны и каталоги.
- `data-ws-surface`, `data-ws-action`, `data-ws-tag`, `data-ws-grid`, `data-ws-row` и другие semantic hooks не зависят от прежних визуальных CSS-классов.

## Навигация и адаптивность

Sidebar на desktop имеет расширенный и компактный режим; на ширине до 940px превращается в drawer. Overlay закрывает меню, Escape и выбор пункта также возвращают в контент. Поиск работает по локальному `assets/search-index.json`, запускается `Ctrl/⌘K` и `/`. Хлебные крошки сохраняются на глубоких маршрутах; в пространствах под глобальной навигацией остаётся локальный контекст.

## Проверки

Перед слиянием: `node scripts/regression-static.js`, `python3 scripts/audit-html.py`, `node scripts/runtime-smoke.js`, `node --check assets/workspace.js`, `git diff --check`. Проверка внешнего браузера и Lighthouse указывается только после реального запуска.
