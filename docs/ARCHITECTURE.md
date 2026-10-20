# Architecture and ownership

React 19 + TypeScript strict, Vite, Tailwind 4, React Router, TanStack Query, Axios, STOMP, Zustand, React Hook Form/Zod, Radix/shadcn-style local primitives, Sonner and Lucide.

## Data flow

- shared/api: verified transport contracts, runtime Zod validation, public and Bearer HTTP clients, normalized Problem Details.
- features/qr-session: tab-scoped credential, URL cleanup, server validation on reload.
- features/cart: single Zustand cart, quantity/item limits, integer tyin arithmetic. Session storage prevents cross-tab leakage.
- features/checkout: immutable pending key/body saved before POST. Unknown outcome locks editing and replays only original key/body. Definitive validation/availability rejection unlocks an explicitly revised basket. A malformed response is an unknown outcome.
- features/auth: memory-only JWT. /me verifies login. Timeout, logout and protected 401 stop the staff session. No refresh token exists.
- features/menu/queries: Query options are shared across layouts and mutations. No copied server state in Zustand.
- features/realtime: one STOMP client per mounted layout. Receipts precede authoritative refetch. Serialized dirty loop repeats after events during fetch. 15-second fallback and foreground refresh. Event ID bounded set deduplicates notifications. Cleanup removes timers, listeners, subscriptions and cancels protected queries.
- features/orders: arrays of up to 200 orders per page, sequential pages until empty, deduplication by ID/version, createdAt/id ordering. Repeated pages or 500-page limit cause explicit error, preserving previous good data.
- pages: lazy-loaded guest, staff and admin screens; widgets: reusable guest header, menu cards and admin navigation.

## Ownership and merge strategy

| Owner  | Files                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| Марьям | pages/guest, widgets/menu-grid, widgets/guest-header; checkout UI                                                  |
| Атай   | pages/kitchen, features/kitchen; KDS timers and sound                                                              |
| Шах    | shared/api, shared/config, auth, qr-session, checkout/attempt, realtime, app, tests, deployment, admin integration |

Shared contracts and primitives change through lead review first. Integrate small feature branches sequentially: shared foundation → guest → kitchen → realtime → admin. Rebase before merging; never resolve contract conflicts by adding fields not accepted by backend. Run all quality gates before merge. Do not change backend in this repository.

## Decisions and constraints

No payment, public tracking, order editing, bookings or fabricated revenue metrics. Images are only restaurant-supplied HTTP(S) URLs; local CSS placeholders accurately say no photo. UI guards complement Spring Security. Query keys/logs contain no JWT or QR tokens. Browser tests disable traces for real credentials. Passwords never enter persistent storage.
