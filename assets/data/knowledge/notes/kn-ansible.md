---
id: kn-ansible
title: Ansible: плейбук, который можно запускать дважды
zone: ops
tags: [автоматизация, shell, systemd]
date: 2026-11-04
updated: 2026-11-04
summary: Плейбук описывает желаемое состояние, а не последовательность команд; идемпотентный модуль на повторном запуске показывает changed=0, и это главный признак того, что автоматизация написана правильно.
excerpt: Модуль вместо shell, inventory и группы, --check и --diff, шаблоны Jinja2 и почему отчёт changed=0 важнее успешного вывода.
readtime: 8 мин
cover: kn-ansible
ai: true
related: [kn-ssh, kn-systemd, kn-prometheus]
sources:
  - title: "Ansible: Playbook best practices"
    url: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_best_practices.html
    publisher: Red Hat
    accessed: 2026-11-04
  - title: "Ansible: Idempotency и модули"
    url: https://docs.ansible.com/ansible/latest/reference_appendices/glossary.html
    publisher: Red Hat
    accessed: 2026-11-03
  - title: "Ansible: Check mode и diff mode"
    url: https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html
    publisher: Red Hat
    accessed: 2026-11-02
visuals:
  - type: table
    key: moduli
    caption: Если задача меняет систему, для неё почти всегда есть модуль — и он умеет проверять текущее состояние.
    head: [Задача, Модуль, Что делает при повторе]
    rows:
      - [поставить пакет, ansible.builtin.apt, ничего, если уже стоит]
      - [положить конфиг, ansible.builtin.template, пишет только при отличии]
      - [запустить службу, ansible.builtin.service, включает и стартует один раз]
      - [создать пользователя, ansible.builtin.user, не меняет существующего]
      - [выполнить команду, ansible.builtin.command, всегда выполняется]
---

Ansible выиграл не потому, что он самый мощный, а потому что не требует агента: подключается по SSH (см. [[kn-ssh|настройку sshd]]) и работает поверх обычного Python. Но именно эта простота провоцирует писать плейбуки как скрипты — с `shell` на каждом шаге, без проверки состояния и без возможности запустить второй раз.

## Идемпотентность на пальцах

Идемпотентный плейбук при повторном запуске не меняет ничего. Это не стилистическое требование, а практическое: без него нельзя ни перезапустить упавшую задачу, ни применить конфигурацию к уже настроенному хосту.

```yaml
- hosts: web
  become: true
  tasks:
    - name: nginx установлен
      ansible.builtin.apt:
        name: nginx
        state: present

    - name: конфиг из шаблона
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        validate: "nginx -t -c %s"
      notify: reload nginx

    - name: служба включена
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
```

Три вещи здесь важны:

1. `template` пишет файл только если содержимое отличается — отсюда `changed=0` при повторном запуске.
2. `validate` проверяет конфиг до подмены: синтаксическая ошибка не уронит работающий сервис.
3. `notify` + handler перезагружает nginx **один раз**, даже если его изменили несколько задач, и только если что-то изменилось.

## Почему shell ломает всё

```yaml
- ansible.builtin.shell: systemctl restart nginx
```

Такой шаг всегда `changed`, всегда выполняется и ничего не знает о состоянии системы. Замена — модуль `service`, который сначала проверит, а потом сделает. Если модуля нет, добавляют `creates`/`removes` или `changed_when`, чтобы задача стала проверяемой.

## --check и --diff

```bash
ansible-playbook site.yml --limit web --check --diff
```

`--check` прогоняет плейбук без изменений и показывает, что **было бы** сделано. `--diff` печатает различия в файлах. Это единственный безопасный способ применить изменения к чужому продакшену: сначала посмотреть отчёт, потом запускать по-настоящему.

Ограничение: задачи, которые зависят от предыдущих (например, проверка только что установленного пакета), в check-режиме могут врать. Поэтому в отчёт смотрят, а не верят ему слепо.

## Инвентарь и переменные

```ini
[web]
web1.example.org
web2.example.org

[db]
db1.example.org
```

Хост не должен «знать, кто он»: роль определяется группой, параметры — `group_vars/web.yml`. Тогда один и тот же плейбук применяется к тестовой и продуктивной среде без правок.

Секреты не хранят в открытом виде: `ansible-vault` шифрует файл переменных, пароль передаётся отдельно.

## Что должно быть в репозитории

- `site.yml` — точка входа, роли подключаются списком.
- `roles/<имя>/tasks|templates|handlers` — по одной роли на компонент.
- `inventory/` и `group_vars/` — окружения.
- README с порядком применения и откатом.

И главное: плейбук в git — это документация инфраструктуры. Если сервер настроен руками и в репозитории этого нет, сервер восстанавливается только по памяти. О том, как ещё и бэкапить состояние — [[kn-backups|3-2-1]], о том, как проверять службы после деплоя — [[kn-systemd|systemd]] и [[kn-prometheus|мониторинг]].
