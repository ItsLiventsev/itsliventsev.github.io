# blog/ — короткие заметки

Здесь хранятся небольшие записи: заметки с занятий, мысли, подборки и дополнения к практикумам. Завершённые длинные тексты находятся в `../articles/`, проекты — в `../projects/`.

## Как добавить заметку

1. Создайте HTML-файл в этой папке; имя файла является slug.
2. Используйте в качестве примера `2026-10-26-kak-ustroen-etot-blog.html`: сохраните SEO-метаданные, `h1`, `main#main-content`, навигационные ссылки и подключение `workspace-tokens.css`, `workspace.css`, `workspace.js`.
3. Заполните метаданные записи — они участвуют в карточке `blog.html`:

```html
<meta name="post-date" content="2026-11-02">
<meta name="post-type" content="note">
<meta name="post-tags" content="пары,сети">
<meta name="post-readtime" content="3 мин">
<!-- <meta name="post-status" content="draft"> -->
```

Поддерживаемые типы: `note`, `thought`, `digest`, `extra`. `title` и `description` берутся из стандартных метатегов.

## Индекс

GitHub Action запускает `scripts/build-post-index.js`, который обновляет `posts.json`. Локально: `node scripts/build-post-index.js`.
