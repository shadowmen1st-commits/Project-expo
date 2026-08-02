# Chat, Notifications and Support hardening report

The implementation and verification record for the initial hardening work is documented in [phase-communications-support-report.md](./phase-communications-support-report.md). The previous decision was `CHAT_NOTIFICATIONS_SUPPORT_HARDENING_PENDING`; the remaining local verification blockers have now been closed.

## Final verification

- Dedicated real Socket.IO smoke: 31/31 passed on dynamic port `57353`. It uses the real Express app, HTTP server, Socket.IO server, MongoMemoryReplSet, real Socket.IO clients and natural cleanup.
- Authentication covers missing, malformed, invalid and expired credentials plus deleted/disabled users. Room-enumeration guesses are denied without room membership or conversation-ID disclosure.
- Worker reassignment emits `access:revoked`, removes the former Worker from the active room, rejects further socket sends and REST history, and permits the newly assigned Worker.
- Transaction failure injection passed after sequence allocation, Message creation, Conversation update, unread update, outbox creation and immediately before commit. Each pre-commit failure rolled back all durable projections. Post-commit/pre-emit recovery reused the durable message without duplicate effects.
- Concurrency suite: 48/48 passed, including ten identical submissions, changed-payload conflict, 25 concurrent distinct messages with unique contiguous sequences, durable-count reconciliation, concurrent read acknowledgements, monotonic read state and non-negative unread projection.
- Typing events are authorized and room-scoped, identity is server-derived, stop is delivered, events are not persisted, and timers are cleared by Socket.IO shutdown.
- Frontend startup smoke passed on dynamic port `54628`: HTTP 200, main HTML, environment-driven API/socket URLs, communication component presence, unsafe-rendering scan and clean Vite shutdown.
- Frontend production build passed in 10.5 seconds. Lint exited 0 with pre-existing unused-variable/hook warnings; no communication security error was reported.

## Exact communication counts

- Chat: 64/64
- Notifications: 28/28
- Support: 43/43
- Integration: 10/10
- Concurrency/rollback: 48/48
- Socket smoke/security: 31/31
- Total backend communication/security: 224/224
- Frontend startup smoke: 1/1
- Total communication verification: 225/225

## Independent command matrix

All commands exited `0`: `test:chat` (64, 6.0s), `test:notifications` (28, 5.5s), `test:support` (43, 5.0s), `test:communications` (222, 29.3s), `test:auth` (42, 12.9s), `test:oauth` (70, 10.2s), `test:booking` (20, 11.6s), `test:pricing` (53, 10.3s), `test:payments` (40, 14.7s), `test:payments:legacy` (17, 12.4s), `test:ledger` (77, 13.3s), `test:refunds` (15, 10.0s), `test:refunds:hardening` (8 scenarios/30 assertions, 11.5s), `test:payouts` (93, 8.8s), `test:reviews` (90, 10.8s), `test:financial` (30.8s), expanded `test:regression` (85.4s), expanded `test:all` (84.6s), backend smoke, dedicated socket smoke, frontend build, frontend lint and frontend startup smoke.

MongoDB topology was `MongoMemoryReplSet`. The final `test:all` backend smoke used dynamic port `58578`; the dedicated socket smoke used `57353`; frontend smoke used `54628`. Framework-wide assertion count is `ASSERTION_COUNT_NOT_EMITTED` because not every legacy runner emits assertion totals.

## Warning, leak and CI audit

Duplicate-index warnings: 0. ESM/import warnings: 0. Open handles: 0. Unhandled rejections: 0. Port collisions: 0. Zero-test suites: 0. Failed setup suites after the transaction retry repair: 0. Sensitive credential leaks: 0. Internal-note requester leaks: 0. Production bundle has a non-blocking large-chunk warning. Mock-payment and development-policy warnings are intentional and accurately labelled.

CI now runs the expanded `test:all`, a dedicated Socket smoke, frontend lint/build and frontend startup smoke. All use isolated databases/dynamic ports and cleanup paths.

## External providers and decision

Email: `NOT_CONFIGURED`. Attachment malware scanner: `NOT_CONFIGURED`. Push: `NOT_CONFIGURED`. SMS: `NOT_CONFIGURED`. Test adapters remain test-only, production email fails closed, and risky attachment formats remain blocked.

Remaining local blockers: none. Production credentials, malware scanning and business approval of development policy/SLA values are external readiness work, not local phase blockers.

Final decision: `CHAT_NOTIFICATIONS_SUPPORT_PHASE_COMPLETE`.
