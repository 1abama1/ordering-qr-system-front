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

Получен адрес http://77.235.30.123:8081. Повторная проверка 20 октября 2026 подтвердила HTTP health: 200, статус UP. HTTPS health на том же порту завершился ошибкой установления TLS-соединения. Локальный успешный smoke из VERIFICATION.md относится к localhost:8080, не к этому серверу.

Для страницы Vercel, открытой по HTTPS, прямое подключение к http:// и ws:// недопустимо. Нужен TLS перед тем же Spring Boot: публичный HTTPS origin и WSS /ws с доверенным сертификатом. Серверный Nginx может направлять оба на существующий backend; PostgreSQL и Java API не требуется переносить в Vercel.

Vercel build намеренно остановится, если отсутствуют API/WS env, указан HTTP/WS или localhost. Это отдельная проверка build:vercel; локальный npm run build и Docker same-origin продолжают работать как раньше. HTTP backend не подменяется mock и не считается рабочей production-интеграцией.

## Временный тест без собственного домена

[Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) выдаёт временный HTTPS адрес без аккаунта и собственного домена. Туннель запускайте на машине backend, направляя его на локальный порт Spring Boot. Например, для исходного локального запуска на 8080, в WSL/Linux x86_64:

```bash
curl -fL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/ordering-qr-cloudflared
chmod +x /tmp/ordering-qr-cloudflared
/tmp/ordering-qr-cloudflared tunnel --url http://localhost:8080
```

Если локальный порт backend другой, замените 8080. Проверьте локальный /actuator/health перед запуском. Не направляйте туннель на удалённый публичный HTTP адрес: размещение cloudflared рядом с backend сохраняет HTTP участок локальным.

Из вывода возьмите настоящий https://<выданное-имя>.trycloudflare.com, проверьте /actuator/health по HTTPS. В Vercel задайте VITE_API_URL=https://<выданное-имя>.trycloudflare.com и VITE_WS_URL=wss://<выданное-имя>.trycloudflare.com/ws, затем Redeploy. Сохраните работающий процесс cloudflared. Backend должен разрешать origin frontend, указанный ниже; адрес туннеля не заменяет ALLOWED_ORIGINS.

Адрес меняется при перезапуске; Quick Tunnel предназначен для тестов, без гарантии доступности. Это не постоянное размещение ресторана. Поддержку WebSocket описывает [Cloudflare FAQ](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/).

## Backend configuration после получения frontend URL

- ALLOWED_ORIGINS: точный https://<проект>.vercel.app либо собственный frontend domain. Для preview добавляйте конкретные разрешённые origin; wildcard не поддерживается backend.
- Для опубликованного frontend: ALLOWED_ORIGINS=https://menu-qr-system.vercel.app, GUEST_MENU_URL=https://menu-qr-system.vercel.app/menu. При необходимости сохраните другие конкретные разрешённые origins. После изменения env перезапустите backend.
- GUEST_MENU_URL: https://<frontend-domain>/menu. Получайте QR заново через ADMIN после настройки адреса.
- Nginx backend должен поддерживать Upgrade на /ws.
- Backend CORS должен разрешать Authorization, Content-Type, Idempotency-Key и необходимые HTTP methods. Это уже есть в исходном backend, нужно настроить origins.
- Строки URL с tableToken не должны попадать в access/error logs backend proxy.

## Ngrok и ERR_NGROK_6024

Для backend https://tables-zipfile-galleria.ngrok-free.dev используйте VITE_API_URL=https://tables-zipfile-galleria.ngrok-free.dev и VITE_WS_URL=wss://tables-zipfile-galleria.ngrok-free.dev/ws. Frontend автоматически добавляет ngrok-skip-browser-warning: 1 к REST-запросам на ngrok-free.dev, ngrok-free.app и ngrok.io, включая login и /me. Для других хостов заголовок не добавляется. Это официальный [обход страницы-предупреждения ngrok](https://ngrok.com/docs/pricing-limits/free-plan-limits).

Backend должен включать ngrok-skip-browser-warning в SecurityConfig.config.setAllowedHeaders. Копия точечного изменения: infra/backend-ngrok-cors.patch. Она применяется из корня backend командой git apply <путь-к-frontend>/infra/backend-ngrok-cors.patch, если исходный файл ещё не исправлен. Не применяйте её повторно.

Текущий frontend origin из браузерного лога — https://menu-qr-system.vercel.app. Задайте ALLOWED_ORIGINS=https://menu-qr-system.vercel.app и GUEST_MENU_URL=https://menu-qr-system.vercel.app/menu в окружении backend. Если оба frontend URL нужны одновременно, перечислите оба точных origin через запятую.

После изменения Java-кода пересоберите образ из корня backend: docker compose up -d --build --no-deps backend. Если действующий запуск использует другие compose-файлы, project name или env-file, сохраните те же параметры. Исходники на удалённом сервере также должны содержать исправление. Перезапуск без сборки не включает новый CORS-заголовок в старый образ. Затем Redeploy актуального frontend в Vercel.

OPTIONS /api/staff/auth/me с Origin: https://menu-qr-system.vercel.app и Access-Control-Request-Headers: authorization,ngrok-skip-browser-warning должен вернуть оба разрешённых заголовка и точный Access-Control-Allow-Origin. GET того же endpoint с ngrok-skip-browser-warning: 1 без JWT должен вернуть 401 JSON с тем же CORS origin; это ожидаемый отказ авторизации, подтверждающий обход страницы ngrok.

## Что делает vercel.json

SPA rewrite поддерживает reload /menu, /cart, /staff/login, /kitchen и /admin/*. /api, /ws и /assets исключены из fallback: отсутствующий API не превращается в HTML. REST и STOMP направляются браузером непосредственно к настроенному backend. Добавлены Referrer-Policy, CSP, прочие headers безопасности и cache policy для hashed assets.

CSP разрешает внешние HTTPS/WSS подключения, чтобы origin backend задавался через env без изменения кода. После выбора постоянного backend можно сузить connect-src до его точного HTTPS/WSS origin.

Zod настраивается с jitless: true перед загрузкой App и созданием схем: валидация не требует eval и сохраняет script-src 'self'. Сообщение браузера CORS request did not succeed со статусом null может означать ошибку TLS ещё до HTTP-ответа; сначала проверяйте HTTPS health без отключения проверки сертификата, затем CORS. В опубликованном HTML нет inline-скриптов приложения: источник отдельного inline-нарушения нужно определять по содержимому заблокированного скрипта и стеку, включая расширения браузера и подключённые инструменты.

## Приёмка после Deploy

1. /staff/login и /admin/menu при прямом открытии возвращают SPA; assets загружаются.
2. Настоящие /api/menu и /api/categories отвечают JSON с публичного backend.
3. Login → /me; guest QR resolve; POST orders с Idempotency-Key; KDS получает NEW_ORDER.
4. STOMP /ws подтверждает receipt, reconnect выполняет REST resync.
5. Stop-list, роли, защищённый PNG и отзыв старого QR работают.
6. Проверить с реального телефона. Не запускайте тесты с созданием записей на рабочей базе ресторана.

GitHub push и статическая сборка не подтверждают Vercel deployment. Публикация считается проверенной только после успешного deployment и smoke с публичным backend.

Источники: [Vite на Vercel](https://vercel.com/docs/frameworks/frontend/vite), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json), [WebSockets](https://vercel.com/docs/functions/websockets).
