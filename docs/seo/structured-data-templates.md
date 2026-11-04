# JSON-LD для itsliventsev.github.io — готовые шаблоны

Правила файла:

- всё генерируется в `scripts/build-seo.js` между `<!-- SEO:AUTO:START/END -->`
  (руками в страницах не правится — контракт №02 из `AGENTS.md`);
- `@id` — постоянные, на `https://itsliventsev.github.io/…#<якорь>`, чтобы сущности
  склеивались между страницами;
- никаких полей «на всякий случай»: только то, что реально есть на странице;
- `Organization` не используется (сайт персональный).

## 1. Главная: `ProfilePage` + `Person` + `WebSite`

```json
[
  {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": "https://itsliventsev.github.io/#profile",
    "url": "https://itsliventsev.github.io/",
    "name": "itsliventsev — мастер производственного обучения и системный администратор",
    "inLanguage": "ru-RU",
    "isPartOf": { "@id": "https://itsliventsev.github.io/#website" },
    "mainEntity": { "@id": "https://itsliventsev.github.io/#person" },
    "breadcrumb": { "@id": "https://itsliventsev.github.io/#breadcrumb" }
  },
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://itsliventsev.github.io/#person",
    "name": "itsliventsev",
    "alternateName": "Иван Ливенцев",
    "url": "https://itsliventsev.github.io/",
    "jobTitle": "мастер производственного обучения",
    "description": "Преподаватель СПО: сети, системное администрирование, учебная и производственная практика.",
    "knowsAbout": [
      "компьютерные сети", "Cisco IOS", "VLAN", "маршрутизация", "Linux",
      "системное администрирование", "PostgreSQL", "Docker", "практико-ориентированное обучение"
    ],
    "knowsLanguage": ["ru", "en"],
    "address": { "@type": "PostalAddress", "addressLocality": "Москва", "addressCountry": "RU" },
    "sameAs": [
      "https://github.com/ItsLiventsev"
    ],
    "award": [
      "Наставник победителя (1 место), финал «Мастерята», системы умного дома",
      "Победитель регионального этапа «Московские профессионалы», системы умного дома, юниоры"
    ],
    "worksFor": { "@type": "EducationalOrganization", "name": "колледж (Москва)" }
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://itsliventsev.github.io/#website",
    "url": "https://itsliventsev.github.io/",
    "name": "itsliventsev",
    "inLanguage": "ru-RU",
    "publisher": { "@id": "https://itsliventsev.github.io/#person" }
  }
]
```

Замечания:
- `alternateName` заполнять настоящим именем, только если оно публично на сайте (сейчас в
  подвале/контактах — решать владельцу; иначе убрать поле).
- `worksFor` — реальное название колледжа или убрать (не выдумывать).
- `SearchAction` в `WebSite` **не добавлять**: sitelinks searchbox отменён Google в ноябре 2024.

## 2. Заметка базы знаний: `BlogPosting` + `citation` + `about`

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": "https://itsliventsev.github.io/blog/kn-dns.html#article",
  "headline": "DNS: кеш, TTL и два резолвера",
  "description": "Путь запроса от stub-резолвера до авторитетной зоны, почему TTL задерживает изменения и как читать dig.",
  "url": "https://itsliventsev.github.io/blog/kn-dns.html",
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://itsliventsev.github.io/blog/kn-dns.html" },
  "inLanguage": "ru-RU",
  "image": "https://itsliventsev.github.io/assets/og-notes.png",
  "datePublished": "2026-11-04",
  "dateModified": "2026-11-04",
  "author": { "@id": "https://itsliventsev.github.io/#person" },
  "publisher": { "@id": "https://itsliventsev.github.io/#person" },
  "isPartOf": { "@id": "https://itsliventsev.github.io/#website" },
  "articleSection": "Сети",
  "keywords": "dns, ttl, диагностика, dhcp",
  "about": [
    { "@type": "Thing", "name": "DNS" },
    { "@type": "Thing", "name": "TTL" }
  ],
  "citation": [
    { "@type": "CreativeWork", "name": "RFC 1035: Domain Names — Implementation and Specification",
      "url": "https://www.rfc-editor.org/rfc/rfc1035" },
    { "@type": "CreativeWork", "name": "RFC 6891: Extension Mechanisms for DNS (EDNS(0))",
      "url": "https://www.rfc-editor.org/rfc/rfc6891" }
  ],
  "isAccessibleForFree": true,
  "license": "https://itsliventsev.github.io/"
}
```

Источники уже есть в каждой заметке (раздел «Источники», 1–3 ссылки) — `citation`
собирать из того же блока, что печатается на странице.

## 3. Хаб рубрики: `CollectionPage` + `ItemList`

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://itsliventsev.github.io/blog/topics/network.html#page",
  "url": "https://itsliventsev.github.io/blog/topics/network.html",
  "name": "Сети — заметки",
  "description": "15 заметок о сетях: VLAN, маршрутизация, DHCP, DNS, MTU, диагностика.",
  "inLanguage": "ru-RU",
  "isPartOf": { "@id": "https://itsliventsev.github.io/#website" },
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": 15,
    "itemListElement": [
      { "@type": "ListItem", "position": 1,
        "url": "https://itsliventsev.github.io/blog/kn-vlan.html",
        "name": "VLAN и 802.1Q: один провод, много сетей" }
    ]
  }
}
```

## 4. Лабораторный стенд: `LearningResource` (+ `Quiz`)

```json
{
  "@context": "https://schema.org",
  "@type": "LearningResource",
  "@id": "https://itsliventsev.github.io/stands/lab-ip-subnet.html#resource",
  "name": "IP-адресация · расчёт подсетей и масок",
  "description": "Маски, адрес сети, широковещание и VLSM: навык, без которого не настраивается ни один интерфейс.",
  "url": "https://itsliventsev.github.io/stands/lab-ip-subnet.html",
  "inLanguage": "ru-RU",
  "learningResourceType": "лабораторная работа",
  "educationalLevel": "СПО",
  "teaches": "расчёт подсетей IPv4, маски, VLSM, диагностика адресации",
  "timeRequired": "PT4H",
  "educationalAlignment": {
    "@type": "AlignmentObject",
    "alignmentType": "educationalSubject",
    "targetName": "09.02.06 Сетевое и системное администрирование"
  },
  "isPartOf": {
    "@type": "EducationalOccupationalProgram",
    "@id": "https://itsliventsev.github.io/stands/setpolis.html#program"
  },
  "author": { "@id": "https://itsliventsev.github.io/#person" },
  "isAccessibleForFree": true,
  "interactivityType": "active"
}
```

Тест лабораторной (5 вопросов в `lab-data`) — отдельным узлом:

```json
{
  "@context": "https://schema.org",
  "@type": "Quiz",
  "name": "IP-адресация · контрольный тест",
  "about": { "@type": "Thing", "name": "расчёт подсетей IPv4" },
  "educationalAlignment": {
    "@type": "AlignmentObject",
    "alignmentType": "educationalSubject",
    "targetName": "09.02.06 Сетевое и системное администрирование"
  },
  "hasPart": [
    {
      "@type": "Question",
      "name": "Сколько узлов можно назначить в подсети /26?",
      "acceptedAnswer": { "@type": "Answer", "text": "62: 2^6 − 2, минус адрес сети и широковещательный." },
      "suggestedAnswer": [
        { "@type": "Answer", "text": "32" },
        { "@type": "Answer", "text": "62" },
        { "@type": "Answer", "text": "30" }
      ]
    }
  ]
}
```

Важно: `Quiz` без `acceptedAnswer` бессмысленен, а «правильный ответ» виден только после
прохождения — значит разметку теста добавляем **только после T-03**, когда вопросы есть
в HTML. Иначе это разметка контента, которого нет.

## 5. Программа практики (три кабинета)

```json
{
  "@context": "https://schema.org",
  "@type": "EducationalOccupationalProgram",
  "@id": "https://itsliventsev.github.io/stands/setpolis.html#program",
  "name": "УП.01 · СетьПолис — учебная практика по сетевому администрированию",
  "description": "15 работ: Cisco IOS, ALT Linux, VLAN, маршрутизация, DHCP, DNS, межсетевой экран.",
  "url": "https://itsliventsev.github.io/stands/setpolis.html",
  "inLanguage": "ru-RU",
  "educationalLevel": "СПО",
  "educationalCredentialAwarded": "практика в составе ПМ.01",
  "programPrerequisites": "базовый курс информатики",
  "timeToComplete": "PT60H",
  "occupationalCategory": "Сетевое и системное администрирование",
  "provider": { "@id": "https://itsliventsev.github.io/#person" },
  "hasCourse": {
    "@type": "Course",
    "name": "СетьПолис: базовый курс сетевого администрирования",
    "description": "Пять спринтов от первой команды в консоли до проекта ЛВС.",
    "provider": { "@id": "https://itsliventsev.github.io/#person" }
  }
}
```

`timeToComplete` считать из сумм часов работ (в `lab-data` есть `hours`), не придумывать.

## 6. Словарь: `DefinedTermSet`

```json
{
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "@id": "https://itsliventsev.github.io/stands/glossary.html#termset",
  "name": "Словарь практик трёх вселенных",
  "url": "https://itsliventsev.github.io/stands/glossary.html",
  "inLanguage": "ru-RU",
  "hasDefinedTerm": [
    {
      "@type": "DefinedTerm",
      "@id": "https://itsliventsev.github.io/stands/glossary.html#sla",
      "name": "SLA",
      "description": "Соглашение об уровне обслуживания: сколько времени даётся на реакцию и решение заявки по каждому приоритету.",
      "inDefinedTermSet": "https://itsliventsev.github.io/stands/glossary.html#termset",
      "url": "https://itsliventsev.github.io/stands/glossary.html#sla"
    }
  ]
}
```

`description` брать из видимого `<dd>`, а не писать заново.

## 7. FAQ (переиспользуемый фрагмент)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://itsliventsev.github.io/faq.html#faq",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Как сдать лабораторную работу?",
      "acceptedAnswer": { "@type": "Answer", "text": "…текст из видимого <details>…" }
    }
  ]
}
```

Правила:
- **ровно один** `FAQPage` на страницу (сейчас на `/faq.html` их два, второй — битый JSON);
- текст ответа — только plain text, без `<a>`/`<strong>` внутри;
- 3–6 вопросов можно ставить также на хабы рубрик — если эти вопросы **видимы** на странице;
- помнить: с 7 мая 2026 Google не показывает FAQ rich results никому; разметка полезна для
  понимания контента и AI-ответов, но не как «фича выдачи».

## 8. Хлебные крошки

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "главная", "item": "https://itsliventsev.github.io/" },
    { "@type": "ListItem", "position": 2, "name": "заметки", "item": "https://itsliventsev.github.io/blog.html" },
    { "@type": "ListItem", "position": 3, "name": "Сети", "item": "https://itsliventsev.github.io/blog/topics/network.html" },
    { "@type": "ListItem", "position": 4, "name": "DNS: кеш, TTL и два резолвера", "item": "https://itsliventsev.github.io/blog/kn-dns.html" }
  ]
}
```

Сейчас крошки строятся как «главная → заметки → материал», без рубрики. Добавить уровень
рубрики — и в разметке, и в видимых крошках (T-08).

## 9. Что проверить после внедрения

| Проверка | Инструмент | Критерий |
| --- | --- | --- |
| JSON валиден | `scripts/test-seo.js` (новый, `JSON.parse` каждого блока) | 0 ошибок |
| Обязательные поля | тот же тест: `headline`, `datePublished`, `author`, `image` | 100% страниц типа |
| Нет выдуманных сущностей | ревью: `Organization`, `aggregateRating`, `review` — запрещены | 0 вхождений |
| `citation` совпадает с видимыми источниками | тест: количество ссылок в блоке «Источники» = `citation.length` | равно |
| Rich Results Test | вручную, 5 контрольных URL | 0 ошибок, 0 предупреждений об отсутствующих полях |
| Яндекс.Вебмастер → «Структурированные данные» | вручную | без «Ошибка» |
