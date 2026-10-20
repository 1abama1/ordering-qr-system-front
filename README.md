# ordering-qr-system-front

Рабочее React/TypeScript приложение для backend `feature/restaurant-backend-mvp`. Гость заказывает по подтверждённому QR; кухня получает заказы и управляет наличием; администратор управляет меню, категориями, столиками и сотрудниками. В production нет mock-ответов.

## Запуск — Windows PowerShell

Требуется Node 22.22+ и запущенный backend на http://localhost:8080.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

## Linux/macOS

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Открыть http://localhost:5173. Без QR показывается инструкция. Вход сотрудников: http://localhost:5173/staff/login. Учётную запись ADMIN создаёт backend; пароль в frontend отсутствует.

Пустые VITE_API_URL/VITE_WS_URL используют текущий origin. Vite проксирует /api и /ws к localhost:8080. Для прямого dev-доступа можно задать VITE_API_URL=http://localhost:8080 и VITE_WS_URL=ws://localhost:8080/ws. Имя ресторана: VITE_RESTAURANT_NAME. После изменения env перезапустите dev server.

## Демонстрация

1. Войти ADMIN → «Столики и QR» → QR-код → открыть меню или скачать PNG.
2. Гость сканирует код, видит подтверждённый столик, добавляет блюда и оформляет заказ. Итог — из Order DTO.
3. На отдельном планшете войти KITCHEN/ADMIN → /kitchen → включить звук → начать готовить → завершить.
4. /kitchen/stop-list → выключить блюдо. Оно блокируется в меню гостя; корзина требует удаления недоступного блюда.
5. В admin доступны формы блюд/категорий, активация столиков, QR download/print/regenerate и создание сотрудников. Списка сотрудников в API нет.

Для телефона в той же сети используйте LAN адрес компьютера и порт 5173. Backend GUEST_MENU_URL должен содержать этот адрес /menu; ALLOWED_ORIGINS — точный frontend origin. На телефоне localhost указывает на сам телефон. Для удалённой/production демонстрации используйте HTTPS/WSS.

## Проверки

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Playwright по умолчанию использует установленный Chrome. Альтернатива: `npx playwright install chromium` и `PLAYWRIGHT_CHANNEL=chromium` в окружении. Реальные E2E используют исключительно изолированный dev/test backend и отдельное разрешение на тестовые записи. См. [TESTING](docs/TESTING.md). Mock-данные находятся только в tests/.

JWT хранится только в памяти. При перезагрузке staff требуется новый вход. QR, корзина и неопределённая попытка checkout хранятся в sessionStorage текущей вкладки. После потери ответа не очищайте вкладку: кнопка повторной проверки использует прежний ключ и body.

Документация: [архитектура](docs/ARCHITECTURE.md), [совместимость backend](docs/BACKEND_COMPATIBILITY.md), [тесты](docs/TESTING.md), [deployment](docs/DEPLOYMENT.md), [результаты проверки](docs/VERIFICATION.md).

## Особенность текущего Windows workspace

Из-за заполненного C: зависимости установлены в D:\CodexWork\restaurant-qr-dependencies и подключены junction node_modules. package.json и lockfile переносимы и не содержат ссылок на D:. На другом компьютере используйте обычный npm ci. Здесь команды Vite/Vitest требуют доступа к кэшу на D:.

## Ограничения приёмки

Docker/Compose/Nginx и физические устройства требуют отдельной фактической проверки; подготовленные конфиги сами по себе её не заменяют. Производственная задержка доставки не гарантируется. Кухонный snapshot компенсирует пропуски событий REST-обновлением каждые 15 секунд.

## GitHub и Vercel

Конфигурация SPA и headers находится в vercel.json. Подробные настройки, обязательные HTTPS/WSS переменные и требования к публичному backend — [docs/VERCEL.md](docs/VERCEL.md). Локальный backend/proxy не переносится автоматически в Vercel. Сборка Vercel: npm run build:vercel.
