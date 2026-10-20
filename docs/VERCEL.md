# GitHub → Vercel

## Импорт

Репозиторий: https://github.com/1abama1/ordering-qr-system-front

1. Vercel → Add New → Project → Import Git Repository → ordering-qr-system-front.
2. Framework: Vite. Root Directory: корень репозитория. Node.js: 22.x.
3. Install Command: npm ci. Build Command: npm run build:vercel. Output: dist.
4. Перед Deploy заполните переменные ниже для Production и нужных Preview окружений.
5. После изменения переменных сделайте Redeploy: Vite встраивает их во время сборки.

| Переменная           | Значение                                     |
| -------------------- | -------------------------------------------- |
| VITE_API_URL         | Публичный HTTPS origin Spring Boot, без /api |
| VITE_WS_URL          | Публичный WSS URL Spring Boot, путь /ws      |
| VITE_RESTAURANT_NAME | DASTOR или название ресторана                |

Пример формата, не действующий адрес: VITE_API_URL=https://api.restaurant.example, VITE_WS_URL=wss://api.restaurant.example/ws.

VITE_* публичны: не помещайте сюда JWT_SECRET, QR_SECRET, пароли сотрудников, DB_PASSWORD или access tokens. Локальные env и .vercel исключены из Git.

## Указанный backend

Получен адрес http://77.235.30.123:8081. Проверки HTTP/HTTPS health из среды разработки завершились timeout; публичная доступность и TLS не подтверждены. Локальный успешный smoke из VERIFICATION.md относится к localhost:8080, не к этому серверу.

Для страницы Vercel, открытой по HTTPS, прямое подключение к http:// и ws:// недопустимо. Нужен TLS перед тем же Spring Boot: публичный HTTPS origin и WSS /ws с доверенным сертификатом. Серверный Nginx может направлять оба на существующий backend; PostgreSQL и Java API не требуется переносить в Vercel.

Vercel build намеренно остановится, если отсутствуют API/WS env, указан HTTP/WS или localhost. Это отдельная проверка build:vercel; локальный npm run build и Docker same-origin продолжают работать как раньше. HTTP backend не подменяется mock и не считается рабочей production-интеграцией.

## Backend configuration после получения frontend URL

- ALLOWED_ORIGINS: точный https://<проект>.vercel.app либо собственный frontend domain. Для preview добавляйте конкретные разрешённые origin; wildcard не поддерживается backend.
- GUEST_MENU_URL: https://<frontend-domain>/menu. Получайте QR заново через ADMIN после настройки адреса.
- Nginx backend должен поддерживать Upgrade на /ws.
- Backend CORS должен разрешать Authorization, Content-Type, Idempotency-Key и необходимые HTTP methods. Это уже есть в исходном backend, нужно настроить origins.
- Строки URL с tableToken не должны попадать в access/error logs backend proxy.

## Что делает vercel.json

SPA rewrite поддерживает reload /menu, /cart, /staff/login, /kitchen и /admin/*. /api, /ws и /assets исключены из fallback: отсутствующий API не превращается в HTML. REST и STOMP направляются браузером непосредственно к настроенному backend. Добавлены Referrer-Policy, CSP, прочие headers безопасности и cache policy для hashed assets.

CSP разрешает внешние HTTPS/WSS подключения, чтобы origin backend задавался через env без изменения кода. После выбора постоянного backend можно сузить connect-src до его точного HTTPS/WSS origin.

## Приёмка после Deploy

1. /staff/login и /admin/menu при прямом открытии возвращают SPA; assets загружаются.
2. Настоящие /api/menu и /api/categories отвечают JSON с публичного backend.
3. Login → /me; guest QR resolve; POST orders с Idempotency-Key; KDS получает NEW_ORDER.
4. STOMP /ws подтверждает receipt, reconnect выполняет REST resync.
5. Stop-list, роли, защищённый PNG и отзыв старого QR работают.
6. Проверить с реального телефона. Не запускайте тесты с созданием записей на рабочей базе ресторана.

GitHub push и статическая сборка не подтверждают Vercel deployment. Публикация считается проверенной только после успешного deployment и smoke с публичным backend.

Источники: [Vite на Vercel](https://vercel.com/docs/frameworks/frontend/vite), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json), [WebSockets](https://vercel.com/docs/functions/websockets).
