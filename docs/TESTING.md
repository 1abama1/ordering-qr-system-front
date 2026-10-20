# Testing

## Commands

- npm ci — воспроизводимая установка по lockfile.
- npm run typecheck — strict TypeScript для приложения, конфигов и тестов.
- npm run lint — ESLint, Hooks и TypeScript rules.
- npm run test:run — Vitest + Testing Library + MSW.
- npm run test:e2e — Playwright UI на изолированных контролируемых HTTP/WebSocket обработчиках.
- npm run build — tsc -b и Vite production build.

MSW 3 использует onUnhandledFrame:error. Обработчики не подключаются из src и не входят в production. Unit tests проверяют деньги/корзину, QR, idempotency snapshot, ошибки/Retry-After, таймеры KDS, dirty loop, страницы заказов и event dedup. Integration tests проверяют HTTP contracts, login/me/401, QR, checkout/replay, stop-list conflict, статусы, receipt timeout, reconnect, пять видов событий и cleanup.

## Real backend E2E

Только отдельная dev/test среда: тесты создают настоящие заказы. Запущенный Spring Boot должен использовать PostgreSQL. Подтверждение persistence читается через staff GET order; frontend тесты не подключаются непосредственно к БД.

Предпочтительно задавать TEST_ADMIN_USERNAME и TEST_ADMIN_PASSWORD в памяти процесса через менеджер секретов/защищённый ввод, а не .env или командную строку. Затем REAL_E2E=1 и npm run test:e2e:real. TEST_API_URL по умолчанию http://localhost:8080.

В PowerShell для скрытого ввода пароля:

```powershell
$env:TEST_ADMIN_USERNAME = Read-Host 'Test admin username'
$testPassword = Read-Host 'Test admin password' -AsSecureString
$testPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($testPassword)
try {
  $env:TEST_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($testPointer)
  $env:REAL_E2E = '1'
  npm run test:e2e:real
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($testPointer)
  Remove-Item Env:TEST_ADMIN_PASSWORD, Env:TEST_ADMIN_USERNAME, Env:REAL_E2E
}
```

Для автоматизированной текущей сессии scripts/run-real.mjs принимает JSON через скрытый stdin: username/password/devTest:true; не передавайте этот JSON как shell argument и не сохраняйте в файл.

Real suite открывает два browser context. ADMIN получает реальный QR; guest добавляет два блюда; backend сохраняет первый POST, а browser намеренно теряет ответ; reload/retry использует прежний ключ/body. KDS получает заказ, меняет COOKING/COMPLETED. Stop-list восстанавливается в finally. Проверяются PNG с Bearer, logout/WS close, защищённый anonymous REST и 7 ширин экрана. Трассы/видео отключены. .local/real-e2e-result.json содержит только безопасные результаты и время наблюдения KDS.

Проверки истинного истечения server JWT, физических Android/iOS, production TLS и Nginx proxy не заменяются mock-тестами. Результаты конкретного запуска — в VERIFICATION.md.

Второй real сценарий проверяет admin CRUD, CATEGORY_IN_USE, QR revoke и создание KITCHEN с проверкой прав. Тестовые данные сохраняются в dev DB; итоговые результаты и перечень оставшейся приёмки — VERIFICATION.md.
