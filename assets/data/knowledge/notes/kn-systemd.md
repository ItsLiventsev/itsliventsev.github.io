---
id: kn-systemd
title: systemd: юниты, цели и порядок загрузки
zone: linux
tags: [systemd, журналы, диагностика]
date: 2026-11-04
updated: 2026-11-04
summary: systemd запускает службы по графу зависимостей и целям, а не по порядку строк в файле; поэтому After задаёт очерёдность, Requires — жёсткую зависимость, а Wants — мягкую.
excerpt: unit, target и wants, enable против start, override через systemctl edit и три команды, которые отвечают почти на любой вопрос о службе.
readtime: 7 мин
cover: kn-systemd
ai: true
related: [kn-logs, kn-ssh, kn-ansible]
sources:
  - title: "systemd.unit(5): юниты, зависимости, цели"
    url: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    publisher: freedesktop.org
    accessed: 2026-11-04
  - title: "systemctl(1): команды управления службами"
    url: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    publisher: freedesktop.org
    accessed: 2026-11-03
  - title: "journalctl(1): фильтры по юниту, времени и приоритету"
    url: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    publisher: freedesktop.org
    accessed: 2026-11-02
visuals:
  - type: terms
    key: ponyatiya
    items:
      - term: unit
        def: описание объекта — службы, точки монтирования, таймера, сокета
      - term: target
        def: группа юнитов, аналог уровня выполнения; multi-user.target — обычная загрузка
      - term: Wants
        def: мягкая зависимость: если юнит не поднялся, загрузка продолжается
      - term: Requires
        def: жёсткая зависимость: без него юнит не стартует
      - term: After
        def: только порядок, без зависимости: «запускай после», но не «требуй»
---

«Почему сервис не поднялся после перезагрузки» — вопрос, который systemd решает лучше старых init-скриптов, но и путаницы добавляет больше. Причина в том, что порядок задаётся не файлом, а графом.

## Юнит, цель и зависимости

Юнит — это файл с секциями `[Unit]`, `[Service]`, `[Install]`. Цель (target) — именованная точка, к которой система стремится при загрузке: `multi-user.target` — обычный сервер без графики, `graphical.target` — с ним.

Зависимости бывают двух видов, и их постоянно путают:

- `Wants=` — «было бы хорошо». Если зависимость не стартует, всё равно продолжаем.
- `Requires=` — «без этого нельзя». Зависимость упала — юнит не запускается.
- `After=` — только порядок. Само по себе ничего не гарантирует: если юнит не в списке зависимостей, `After` может быть проигнорирован.

Практический пример: сервису нужен настроенный адрес на интерфейсе. В юните пишут `After=network.target` — и получают падение при загрузке, потому что `network.target` означает «сетевая подсистема инициализирована», а не «адрес назначен». Правильно — `network-online.target` плюс `Wants=network-online.target`.

## enable не равно start

- `systemctl start nginx` — запустить сейчас.
- `systemctl enable nginx` — включить автозапуск при загрузке (создаёт симлинк в `wants/` целевого юнита).
- `systemctl enable --now nginx` — и то, и другое.

Ошибка «включил, а после перезагрузки не работает» почти всегда означает, что сделан только `start` (или только `enable`, а сервис падает при старте — тогда смотреть `journalctl`).

## Как переопределить юнит, не ломая пакет

Правка файлов в `/usr/lib/systemd/system` — плохая идея: обновление пакета перезапишет изменения. Правильно — drop-in:

```bash
systemctl edit nginx          # создаёт /etc/systemd/system/nginx.service.d/override.conf
systemctl daemon-reload       # обязательно после любой правки
systemctl restart nginx
```

`daemon-reload` — самая забываемая команда. Без неё systemd продолжает работать со старым описанием: вы правите лимиты памяти, а сервис их не видит.

## Три команды, которые отвечают почти всегда

```bash
systemctl status nginx --no-pager -l    # состояние, последние строки, код выхода
journalctl -u nginx -n 100 --no-pager   # её журнал
systemd-analyze blame                   # кто тормозил загрузку
```

`systemctl status` показывает и причину падения: `status=203/EXEC` — нет файла или прав, `status=1/FAILURE` — упало само приложение, `start-limit-hit` — слишком много рестартов за короткое время (помогает `systemctl reset-failed`).

## Таймеры вместо cron

Таймер systemd умеет то, чего не умеет cron: не запускать задачу, если прошлая ещё идёт, писать в журнал, повторять при неудаче. Описание состоит из двух юнитов — `.service` с самой задачей и `.timer` с расписанием:

```ini
# backup.timer
[Timer]
OnCalendar=daily
Persistent=true
```

`Persistent=true` означает «если машина была выключена в момент запуска, выполнить при следующем включении» — важная деталь для бэкапов, о которых [[kn-backups|отдельная заметка]].

## Что помнить

1. После любой правки — `daemon-reload`.
2. `After` без `Wants`/`Requires` часто не работает так, как ожидают.
3. Порядок в файле не имеет значения: важны только директивы.
4. Логи службы — в journald; про уровни и ротацию — в [[kn-logs|заметке про журналы]].
5. Автоматизировать управление службами лучше модулем `ansible.builtin.service`, а не `shell` — см. [[kn-ansible|Ansible]].
