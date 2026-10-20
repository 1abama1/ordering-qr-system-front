# Проверка Restaurant QR Frontend

20 октября 2026, Asia/Omsk. Это локальный MVP с настоящим backend; production/Compose приёмка не объявляется завершённой.

## A. Implemented Features

- Guest: серверная проверка QR, tab-scoped сессия, удаление credentials из URL, меню/категории/поиск, детали блюда, корректные placeholders, корзина с лимитами и расчётами в тыйынах, server-confirmed checkout и receipt.
- Checkout: snapshot и UUID сохраняются до POST. При потере ответа корзина блокируется, повтор/reload отправляет исходные key/body. Нет отправки пользовательских цен или публичного live tracking. Для HTTP LAN есть криптографический UUID fallback; HTTPS использует crypto.randomUUID.
- Staff: login + /me, JWT только в памяти, роль/маршрут, expiry/logout/401 cleanup.
- KDS: PENDING/COOKING, полный paginated snapshot, единый timer tick, статусы и завершение после сервера, уведомления/подсветка, opt-in Web Audio и fullscreen.
- Stop-list: явное isAvailable, подтверждение сервером, disabled в гостевом меню и блокировка недоступной корзины.
- Admin: реальные показатели, menu/category CRUD, soft delete, CATEGORY_IN_USE, столики, активация, QR PNG через Bearer Blob, download/print layout, regeneration warning, создание ADMIN/KITCHEN.
- Общие состояния загрузки/ошибки/повтора/пустых данных, сохранение последнего корректного snapshot, доступные подписи форм, focus и reduced motion. Интерактивные кнопки гостя имеют touch targets 44px.

## B. Project Structure

```text
src/
  app/                 App, providers, router, styles
  shared/
    api/               contracts, public/staff HTTP, errors, client
    components/        local Radix/shadcn-style UI and feedback
    config/            environment
    lib/               money, storage, UUID, URL redaction
  features/
    auth/              memory-only session and guards
    qr-session/        validation and tab session
    menu/              shared Query options
    cart/              single cart store and integer totals
    checkout/          immutable attempt persistence
    orders/            paginated authoritative snapshots
    kitchen/           opt-in sound
    realtime/          STOMP, receipts and serialized dirty sync
  pages/               guest, auth, kitchen, admin
  widgets/             guest-header, menu-grid, admin-sidebar
tests/                 unit, integration, controlled/real Playwright
infra/nginx/           SPA, API/WS proxy, cache/security headers
docs/                  architecture, compatibility, tests, deployment
scripts/run-real.mjs   hidden-stdin real-test runner
Dockerfile, compose.frontend.yml, .github/workflows/frontend.yml
```

Ownership и merge strategy — ARCHITECTURE.md.

## C. Backend Integration

Аудит feature/restaurant-backend-mvp, commit 1a40f6b612ba1f0497df77690e4c770cf327b53d. Java/документация сверены с работающим /v3/api-docs. Материальных расхождений нет. Полная endpoint/DTO/role matrix — BACKEND_COMPATIBILITY.md. Backend со стороны frontend-разработки не редактировался.

Реально проверены health, OpenAPI, menu/categories, QR resolve, login/me, order create/replay/read/active/status/complete, availability, CRUD menu/categories, tables create/update/QR PNG/regenerate и staff create. Тесты использовали localhost:8080 и действительный Spring Boot; запись подтверждалась staff GET order. Прямого SQL или проверки DB restart в этой frontend suite нет.

Последний полный real E2E:

- Заказ **5**, серверный итог **600 KGS**, сохранён **COMPLETED**.
- Первый POST сохранён сервером, HTTP-ответ намеренно потерян в browser route. Reload/retry использовал прежний ключ и body.
- NEW_ORDER получен кухней, UI cooking/complete сохранены, completed исчез из active.
- Stop-list дошёл до гостя, добавление и checkout недоступной позиции заблокированы. Наличие восстановлено в finally.
- PNG отображён через защищённый запрос; после logout все /ws staff connections закрылись.
- ADMIN создал/изменил/деактивировал тестовое блюдо, создал/изменил/удалил пустую категорию, получил CATEGORY_IN_USE для связанной категории.
- Столик **9899** создан, QR перевыпущен, старый resolve вернул **403**, столик деактивирован.
- KITCHEN создан и вошёл; admin REST вернул **403**, admin UI ограничен. Anonymous active REST вернул **401**.

E2E добавляют настоящие тестовые записи. История заказов сохранена; тестовые блюда деактивированы, столики 9900/9899 деактивированы. Тестовые категории и сотрудники остаются в dev БД: API удаления сотрудников отсутствует. Их пароли в репозиторий не записаны.

## D. Realtime

CONNECT → SUBSCRIBE с уникальным receipt → подтверждение всех подписок → REST snapshot. reconnect 3s, heartbeat 10s/10s, receipt timeout 5s. Все события помечают snapshot dirty; fetch сериализован и повторяется после событий в полёте. Poll 15s + foreground refresh компенсируют потерю публикации. eventId используется для дедупликации уведомлений, JWT передаётся только в CONNECT headers.

В последнем локальном прогоне browser наблюдал новый заказ в KDS через **393 мс** от отправки POST. Ранее наблюдались 143 и 155 мс. Это локальный smoke и измерение конкретных прогонов, а не SLA или оценка Internet latency.

Receipt/reconnect/timeout/duplicate/race/expiry/cleanup проверены управляемыми тестами. Реальные native STOMP соединения, receipts, NEW_ORDER, смена статусов, stop-list и logout/close подтверждены real suite. Непрерывный production soak и принудительная потеря реального WS между сервером и физическим планшетом не выполнялись.

## E. Tests

Фактически выполнено:

| Command / suite                 | Result                                                |
| ------------------------------- | ----------------------------------------------------- |
| npm install                     | Успешно на D: после устранения peer conflict и ENOSPC |
| npm run typecheck               | PASS                                                  |
| npm run lint                    | PASS, 0 errors                                        |
| npm run test:run                | **47 passed**, 7 files                                |
| npm run build                   | PASS, dist создан                                     |
| npm run test:e2e                | **11 passed**                                         |
| real Playwright against backend | **2 passed**                                          |
| npm run format                  | Выполнен                                              |

Controlled E2E включают QR/cart/receipt, lost-response replay через reload, роли, 7 ширин и отсутствие crypto.randomUUID в HTTP LAN. Unit/integration включают integer money, лимиты, immutable attempt, Problem Details/Retry-After, пагинацию/сдвиг страниц, все 5 событий, receipt timeout, reconnect, dirty loop, dedup, JWT expiry и cleanup.

Guest, Kitchen и Admin прошли browser viewport checks 320,375,390,768,1024,1440,1920 без горизонтального overflow. Real suite зафиксировала 0 page errors. Это browser emulation, не физические устройства.

Безопасные локальные артефакты (ignored):

- .local/real-e2e-result.json
- .local/admin-e2e-result.json
- .local/real-menu-390.png, .local/real-menu-1440.png
- .local/real-kitchen.png, .local/real-admin.png

Ранее в разработке были исправлены неуспешные прогоны: peer dependencies, полный диск, sandbox cache access, несовместимое имя MSW option, подписи форм/select, тестовый interceptor module imports, overflow 320px и фильтрация Vite HMR socket в проверке logout. Неуспешные прогоны не засчитывались как PASS.

## F. Deployment

README.md содержит PowerShell/Linux запуск. npm ci → npm run dev; frontend localhost:5173, backend localhost:8080. Dev использует same-origin REST/WS proxy; нет localhost устройства в browser API URL. Имя ресторана задаётся VITE_RESTAURANT_NAME.

Подготовлены multi-stage Dockerfile, .dockerignore, безопасный frontend Compose override существующего backend, Nginx API/WS proxy/SPA fallback/cache/CSP/Referrer-Policy, frontend GitHub Actions. Build-time имя контейнера можно задать --build-arg VITE_RESTAURANT_NAME=... . Новая БД frontend не создаётся.

DEPLOYMENT.md содержит точные команды и дальнейший proxy smoke. Docker daemon был недоступен. Docker build, Compose up, nginx -t, контейнерные healthchecks, реальный Nginx Upgrade и TLS в этом запуске не проверялись. GitHub Actions подготовлен, но удалённый CI не запускался.

## G. Remaining Issues / Acceptance

- Требуется фактическая Docker/Compose/Nginx/TLS приёмка, DNS/origins и публичный GUEST_MENU_URL.
- Физический телефон/планшет, печать на принтере, звук на оборудовании кухни и длительный soak не проверены.
- Естественное истечение реального server JWT не ожидалось; frontend expiry проверен управляемым таймером, серверные 401/403 — настоящими запросами.
- Для телефона QR должен кодировать LAN/HTTPS host, а не localhost. Изменение backend configuration выполняет владелец среды.
- При отозванном QR backend запрещает даже replay: понадобится актуальный QR/проверка сотрудником.
- На C: оставалось мало места; node_modules подключён junction из D:\CodexWork\restaurant-qr-dependencies. Lockfile переносим, локальных file: зависимостей нет. Временные browser profiles финальных прогонов размещены на D:.

## H. Demo Guide

1. npm run dev, открыть /staff/login и войти существующим ADMIN.
2. /admin/tables → QR столика → скачать/распечатать backend PNG.
3. На телефоне открыть QR, добавить два блюда, подтвердить заказ и показать server receipt.
4. На планшете /kitchen → включить звук → PENDING → COOKING → завершить.
5. /kitchen/stop-list → выключить блюдо, показать disabled у гостя, вернуть наличие.
6. /admin/menu, /admin/categories, /admin/tables, /admin/staff — показать CRUD и права.
7. Для демонстрации потери ответа запускайте real E2E только в dev/test среде.
