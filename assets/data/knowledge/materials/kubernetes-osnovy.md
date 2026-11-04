---
title: Kubernetes: зачем нужен оркестратор
summary: Kubernetes описывает желаемое состояние, а не последовательность команд; контроллеры сами приводят кластер к этому состоянию — в этом сила и в этом источник непонимания.
date: 2026-11-04
updated: 2026-11-04
level: продвинутый
readtime: 9 мин
ai: true
notes: [kn-docker, kn-monitoring, kn-logs]
sources:
  - title: "Kubernetes documentation: concepts"
    url: https://kubernetes.io/docs/concepts/
    publisher: The Kubernetes Authors
    accessed: 2026-11-04
  - title: "Kubernetes: Pods"
    url: https://kubernetes.io/docs/concepts/workloads/pods/
    publisher: The Kubernetes Authors
    accessed: 2026-11-04
goal:
  - объяснять, что такое декларативное управление;
  - называть основные объекты и их роли;
  - запускать, проверять и масштабировать приложение без ручной сборки контейнеров.
---

## Декларативный подход

Вместо «запусти контейнер, потом проверь, потом перезапусти» Kubernetes предлагает описать, как должно быть, и следить за расхождением. Заявили: «нужно три копии приложения, доступного по порту 80» — контроллер добьётся этого и будет восстанавливать состояние после падений.

Отсюда главное свойство: желаемое состояние хранится в объектах, а не в голове администратора. Кластер можно воспроизвести заново из тех же YAML-файлов.

## Основные объекты

| Объект | Роль | Аналогия |
| --- | --- | --- |
| Pod | минимальная единица, один или несколько контейнеров | один процесс на сервере |
| Deployment | декларация «сколько копий и как обновлять» | служба с репликами |
| Service | стабильная точка входа к подам | балансировщик |
| ConfigMap / Secret | конфигурация и секреты | файл конфигурации вне образа |
| Namespace | логическое деление кластера | папка для объектов |
| Ingress | правила внешнего доступа | reverse proxy |

Ключевая тонкость: Pod — временный объект. У него меняется IP, его можно удалить в любой момент. Поэтому приложения никогда не обращаются к подам напрямую: между ними стоит Service со стабильным именем и IP.

## Минимальный манифест

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          resources:
            requests: { cpu: 100m, memory: 64Mi }
            limits: { cpu: 500m, memory: 256Mi }
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
```

Две части здесь важны. `selector` связывает Service с подами по меткам — если метки не совпадают, Service будет пустым, и это самая частая ошибка новичка. `resources` обязательны: без них планировщик не знает, куда ставить поды, а кластер легко перегрузить.

## Проверка и управление

```bash
kubectl apply -f web.yaml
kubectl get pods -o wide
kubectl get svc
kubectl describe pod web-abcde
kubectl logs -f web-abcde --tail 50
kubectl scale deployment web --replicas=5
kubectl rollout status deployment/web
kubectl rollout undo deployment/web
```

Порядок разбора «не работает»: `get pods` (есть ли поды), `describe` (почему не стартуют), `logs` (что говорит приложение). Три команды закрывают большинство ситуаций.

## Что ломается чаще всего

| Симптом | Причина |
| --- | --- |
| под в `Pending` | не хватает ресурсов или нет узла с нужными метками |
| под в `ImagePullBackOff` | нет доступа к реестру или неверный тег |
| под в `CrashLoopBackOff` | приложение падает само, смотреть `logs --previous` |
| Service не отвечает | не совпадают метки `selector` и подов |
| под убит по памяти | превышен `limits.memory` (OOMKilled) |

## Отличие от Docker

Docker управляет одним контейнером на одном хосте. Kubernetes управляет подами на многих узлах: сам выбирает узел, сам перезапускает, сам распределяет нагрузку, сам обновляет версии по стратегии раскатки.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

С такой стратегией при обновлении никогда не уменьшается число доступных подов — сначала поднимается новый, потом гасится старый. Для сервиса без простоя этого достаточно.

## Итог

- Kubernetes хранит желаемое состояние и постоянно к нему возвращается.
- Pod временный, Service — стабильная точка входа.
- Без `resources` кластер неуправляем.
- Разбор идёт в порядке: `get`, `describe`, `logs`.

Основы контейнеров — {{docker-osnovy}}, эксплуатация — {{monitoring-infrastruktury}}.
