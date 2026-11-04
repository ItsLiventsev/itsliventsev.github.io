---
title: Доменные службы: контроллер домена
summary: Домен — это единая база учётных записей и политик; контроллер домена отвечает на запросы входа, и без второго контроллера его отказ означает недоступность всей инфраструктуры.
date: 2026-11-04
updated: 2026-11-04
level: практика
readtime: 9 мин
ai: true
notes: [kn-ssh, kn-dns, kn-ntp]
sources:
  - title: "Microsoft Learn: Active Directory Domain Services overview"
    url: https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/active-directory-domain-services
    publisher: Microsoft
    accessed: 2026-11-04
  - title: "Samba AD DC documentation"
    url: https://wiki.samba.org/index.php/Setting_up_Samba_as_an_Active_Directory_Domain_Controller
    publisher: Samba Team
    accessed: 2026-11-04
goal:
  - объяснять, какие службы держатся на контроллере домена;
  - разворачивать домен и проверять вход;
  - ставить второй контроллер и понимать, зачем он нужен.
---

## Что такое домен

Домен — это общая база объектов (пользователи, компьютеры, группы) и общие правила для них. Пользователь входит на любой машине домена под одной учётной записью; политики применяются централизованно, а не вручную на каждом компьютере.

На контроллере домена держатся четыре службы, и он не работает, если хотя бы одна не готова:

| Служба | Роль | Что ломается без неё |
| --- | --- | --- |
| AD DS | каталог объектов и аутентификация | никто не входит в систему |
| DNS | зона домена и SRV-записи | клиент не находит контроллер |
| Kerberos | билеты и доверие | вход отклоняется с ошибкой времени |
| Синхронизация времени | корректные метки | билеты Kerberos «просрочены» |

Последняя строка объясняет классику: расхождение часов более пяти минут делает вход в домен невозможным, хотя пароль верный. Проверять надо время, а не пароль.

## Развёртывание

### Windows Server

```text
Install-WindowsFeature AD-Domain-Services -IncludeManagementTools
Install-ADDSForest -DomainName example.local -InstallDns
```

После установки контроллер перезагружается, домен готов. Проверка:

```text
Get-ADDomain
Get-ADUser -Filter * | Select Name, Enabled
dcdiag /test:dns
```

### Samba AD на Linux

```bash
samba-tool domain provision --realm=EXAMPLE.LOCAL --domain=EXAMPLE \
  --adminpass='ПарольАдмина' --server-role=dc --dns-backend=SAMBA_INTERNAL
systemctl enable --now samba
samba-tool domain level show
samba-tool user list
```

У Samba есть важное преимущество для учебного стенда: домен поднимается на одном сервере Linux и не требует лицензий.

## Клиент в домене

Windows: параметры системы → принадлежность к домену → ввод учётных данных администратора домена. Linux:

```bash
realm discover example.local
realm join --user=administrator example.local
realm list
id operator@example.local
```

Проверка входа — не только «получилось», но и «откуда видно»: `klist` показывает билеты Kerberos, `realm list` — статус членства.

## Второй контроллер

Один контроллер — единственная точка отказа: его выключение останавливает вход всех пользователей. Второй контроллер решает две задачи: отказоустойчивость и распределение нагрузки на вход.

```text
Install-ADDSDomainController -DomainName example.local -InstallDns
```

```bash
samba-tool domain join example.local DC -U administrator
```

После присоединения важны три вещи:

- Репликация работает: `repadmin /replsummary` (Windows) или `samba-tool drs showrepl` (Samba).
- DNS на обоих серверах, и клиенты знают оба.
- Роли FSMO распределены или осознанно закреплены за основным.

## Диагностика входа

| Симптом | Первая проверка |
| --- | --- |
| «Неверный пароль» при верном пароле | время на клиенте и сервере |
| «Доверие между доменами не установлено» | связь, DNS, время |
| Долгий вход | какие DNS-серверы прописаны у клиента |
| Политика не применяется | членство компьютера в OU, `gpresult` |

## Итог

- Домен держится на четырёх службах: каталог, DNS, Kerberos, время.
- Один контроллер — точка отказа; второй нужен, а не «желателен».
- Расхождение часов ломает вход раньше, чем что-либо ещё.
- Диагностика начинается с DNS и времени, а не с пароля.
