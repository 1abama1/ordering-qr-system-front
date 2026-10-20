# Backend compatibility

Audit: 20 октября 2026, Asia/Omsk. Source: соседний repository ordering-qr-system-architecture, ветка feature/restaurant-backend-mvp, commit 1a40f6b612ba1f0497df77690e4c770cf327b53d. Локальный checkout чист при аудите. Прочитаны API_CONTRACT, FRONTEND_INTEGRATION, WEBSOCKET_EVENTS, ARCHITECTURE, OPERATIONS, VERIFICATION, README, Java controllers/DTO, SecurityConfig, WebSocketConfig, StompSecurityInterceptor, Events, PasswordPolicy, compose и обе Nginx конфигурации. Backend-код не изменялся.

Работающий http://localhost:8080/v3/api-docs сверён с Java; GET health/menu/categories подтверждены настоящим HTTP. Материальных расхождений документации/Java/OpenAPI не обнаружено.

## Endpoint matrix

Все перечисленные методы подключены в src/shared/api/client.ts. Реальная приёмка конкретного запуска отдельно отражена в VERIFICATION.md.

| Access        | Methods                                                                     | Contract and validation                                                        |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Public        | GET /api/categories                                                         | Category[]; sortOrder,id                                                       |
| Public        | GET /api/menu?includeUnavailable=true                                       | MenuItem[]; inactive hidden additionally by guest UI                           |
| Public        | GET /api/tables/resolve                                                     | tableNumber,tableToken query; Table response                                   |
| QR            | POST /api/orders                                                            | UUID Idempotency-Key; only tableNumber/tableToken/items; 201 or replay 200     |
| Public        | POST /api/staff/auth/login                                                  | username/password → Bearer token, expiresAt, Staff                             |
| ADMIN,KITCHEN | GET /api/staff/auth/me                                                      | authoritative Staff                                                            |
| ADMIN,KITCHEN | GET /api/staff/menu                                                         | all MenuItem[], including inactive                                             |
| ADMIN,KITCHEN | GET /api/orders/active?page=N&size=200                                      | Order[]; sequential until empty, not Spring Page                               |
| ADMIN,KITCHEN | GET /api/orders/{id}                                                        | Order; no public tracking                                                      |
| ADMIN,KITCHEN | PATCH /api/orders/{id}/status                                               | JSON status:COOKING                                                            |
| ADMIN,KITCHEN | PATCH /api/orders/{id}/complete                                             | no body                                                                        |
| ADMIN,KITCHEN | PATCH /api/menu/{id}/availability                                           | JSON isAvailable; explicit server-confirmed value                              |
| ADMIN         | POST /api/menu, PUT /api/menu/{id}, DELETE /api/menu/{id}                   | all request Boolean required; delete deactivates                               |
| ADMIN         | POST /api/categories, PUT /api/categories/{id}, DELETE /api/categories/{id} | name<=100, sortOrder>=0; CATEGORY_IN_USE includes inactive dishes              |
| ADMIN         | GET/POST /api/staff/tables                                                  | list; create number 1..10000, immutable                                        |
| ADMIN         | PATCH /api/staff/tables/{id}                                                | isActive                                                                       |
| ADMIN         | GET /api/staff/tables/{id}/qr                                               | metadata; format=png via Axios Bearer Blob                                     |
| ADMIN         | POST /api/staff/tables/{id}/regenerate-token                                | new metadata; old printouts revoked                                            |
| ADMIN         | POST /api/staff/users                                                       | username pattern 3..100, password>=12 and <=72 UTF-8 bytes; role ADMIN/KITCHEN |

Compatibility-only /toggle is deliberately unused. No upload or staff-list endpoint exists.

## DTO and behavior

Runtime Zod schemas match Java responses: MenuItem(id,name,description,price,currency,imageUrl,categoryId,isAvailable,isActive,updatedAt,version); Category(id,name,sortOrder); Order(id,tableNumber,status,totalAmount,currency,createdAt,updatedAt,completedAt,version,items[menuItemId,menuItemName,quantity,priceAtOrder,lineTotal]); Table(id,number,isActive,qrTokenVersion); QR(url,tableToken,tableNumber,qrTokenVersion); Staff(id,username,role); auth(accessToken,tokenType,expiresAt,staff).

Guest URL uses table/token; resolve uses tableNumber/tableToken. Token is opaque. Replay rechecks QR on backend; revoked QR cannot recover an old attempt without staff assistance. 1..50 distinct lines, quantity 1..100. Unknown request fields rejected by backend. Display calculations use integer tyin; final totals and item names are server DTOs.

Problems normalize full application/problem+json and abbreviated Nginx responses. Known 400/401/403/409 do not auto-retry. Retry-After controls checkout waiting; mutation retry is off. Network/timeout/5xx or malformed successful DTO preserve uncertain pending attempt. No new UUID follows an ambiguous response.

## STOMP

Native /ws; no SockJS or JWT query parameter. Destinations only /topic/menu/updates (public), /topic/kitchen/orders (ADMIN/KITCHEN). JWT in CONNECT Authorization. reconnectDelay 3000, heartbeats 10000/10000, 5000 ms receipt timeout.

- NEW_ORDER: eventId/type/occurredAt/orderId/order.
- ORDER_STATUS_CHANGED: previousStatus/newStatus/completedAt/version/orderId/order.
- MENU_CHANGED and MENU_ITEM_AVAILABILITY_CHANGED: menuItemId/isAvailable/isActive/updatedAt/version.
- CATEGORIES_CHANGED: only common fields are required; Java emits null menu fields.

Events invalidate authoritative REST, never substitute prices/status. Receipts precede resync; dirty loop handles events during fetch; duplicate event IDs suppress duplicate notifications. Poll/visibility refresh repairs missed publication. Simple broker delivery is not guaranteed.

## Verification boundaries

Unit/MSW/controlled Playwright checks do not prove live integration. Real backend E2E uses real HTTP/STOMP and PostgreSQL-backed Spring Boot. Docker/Nginx/TLS, physical smartphone, persistence across a DB restart and naturally expired server JWT are separate acceptance steps. Browser viewport testing is not a physical-device test.
