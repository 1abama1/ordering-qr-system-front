# Deployment

## Vite development

Пустые API/WS переменные = текущий origin; dev proxy /api и /ws → localhost:8080. `npm run dev` слушает LAN. Никаких frontend секретов: VITE_* встраиваются в публичный bundle.

Для смартфона задайте в backend GUEST_MENU_URL=http://<LAN-IP>:5173/menu и ALLOWED_ORIGINS=http://<LAN-IP>:5173,http://localhost:5173. Проверяйте firewall и доступность устройства. QR после изменения GUEST_MENU_URL получите заново через backend. Токен самостоятельно не меняйте. Для HTTPS origin нужен WSS.

## Standalone container in an existing network

Dockerfile: Node multi-stage build → Nginx static SPA and REST/WS proxy. В сети контейнера должен резолвиться backend:8080. Новый PostgreSQL frontend не создаёт.

```bash
docker build -t restaurant-ordering-frontend .
docker run --rm --network <existing-backend-network> -p 8081:80 restaurant-ordering-frontend
```

## Existing backend Compose stack

Из frontend каталога, после заполнения backend .env:

PowerShell:

```powershell
docker compose --project-directory ../ordering-qr-system-architecture --env-file ../ordering-qr-system-architecture/.env -f ../ordering-qr-system-architecture/compose.yml -f compose.frontend.yml config --quiet
docker compose --project-directory ../ordering-qr-system-architecture --env-file ../ordering-qr-system-architecture/.env -f ../ordering-qr-system-architecture/compose.yml -f compose.frontend.yml up -d --build
```

Linux: те же команды. Override заменяет только nginx service образом frontend и конфигурацией; backend и существующий PostgreSQL/volume остаются частью исходного compose. Пути в override рассчитаны на соседние папки с текущими именами. Если структура отличается, исправьте context и bind mounts. Не используйте down -v для перезапуска.

## Nginx

infra/nginx/default.conf основан на проверенной конфигурации backend commit 1a40f6b. Сохранены rate limits, JSON 413/429, correlation ID, health/swagger/dev OpenAPI и WebSocket Upgrade/таймауты. Access log не содержит query strings с QR credentials. Добавлены:

- SPA fallback /index.html;
- index.html Cache-Control no-store;
- immutable cache для hashed /assets;
- CSP, no-referrer, nosniff, frame deny, permissions policy.

CSP разрешает same-origin connections. Сторонний API потребует явного изменения connect-src и CORS; предпочтителен same-origin. Inline styles разрешены для Radix/Sonner, inline scripts запрещены. Изображения допускают HTTP(S)/Blob; в HTTPS production используйте только HTTPS фотографии.

Перед production нужен TLS termination, HTTPS GUEST_MENU_URL, точные ALLOWED_ORIGINS и WSS. HSTS задавайте на TLS ingress после подтверждения HTTPS. Здесь нет сертификатов и runtime secrets. .env и тестовые артефакты исключены из Docker context.

## Required acceptance

Пока Docker daemon недоступен, нельзя утверждать успешный Docker build или proxy smoke. После доступности:

1. compose config → build → health.
2. Deep-link /admin/menu возвращает SPA; /api/categories — JSON.
3. Login/QR PNG через Nginx.
4. STOMP CONNECT → SUBSCRIBE → RECEIPT через /ws.
5. Создать тестовый заказ, увидеть KDS, завершить, проверить persistence после restart.
6. Проверить headers/cache и QR на реальном телефоне.

Для QR-sensitive /menu и /api/tables/resolve отключён стандартный error_log: Nginx не позволяет форматировать его без query strings. Диагностику ошибок этих маршрутов смотрите в frontend Problem Details и backend correlation ID. Access log всех маршрутов исключает query. Конфигурация требует фактического nginx -t в целевом окружении.
