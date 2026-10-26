# blog/ — короткие заметки

Сюда складываются небольшие записи: заметки с пар, мысли, подборки,
мини-дополнения. Большие завершённые тексты живут в `../articles/`,
сделанные руками проекты — в `../projects/`.

## Как добавить заметку

1. Создайте HTML-файл в этой папке, например `2026-11-02-zametka-s-pary.html`
   (имя файла = slug; дата в имени не обязательна, но удобна).
2. Возьмите за образец `2026-10-26-kak-ustroen-etot-blog.html`: та же шапка,
   подвал, `page-wrap` + `prose-measure`, подключение `../assets/site.css`.
3. В `<head>` пропишите служебные meta-теги — по ним автоматически
   собирается карточка в ленте `blog.html`:

```html
<meta name="post-date"     content="2026-11-02">   <!-- или просто год: 2026 -->
<meta name="post-type"     content="note">         <!-- note | thought | digest | extra -->
<meta name="post-tags"     content="пары,сети">    <!-- через запятую -->
<meta name="post-readtime" content="3 мин">
<!-- <meta name="post-status" content="draft"> --> <!-- черновик не попадёт в ленту -->
```

`title` и `description` берутся из стандартных `<title>` и meta description.

## Что происходит после пуша

GitHub Action (`.github/workflows/post-index.yml`) запускает
`scripts/build-post-index.js`, который пересобирает `posts.json` и коммитит
его обратно. Лента на `blog.html` читает этот JSON — руками карточки
добавлять не нужно. Локально индекс можно собрать так же:

```bash
node scripts/build-post-index.js
```

## Типы записей и их цвета

| type      | подпись        | цвет кромки |
|-----------|----------------|-------------|
| note      | заметка        | розовый     |
| thought   | мысль          | фиолетовый  |
| digest    | подборка       | синий       |
| extra     | доп. материал  | изумрудный  |
