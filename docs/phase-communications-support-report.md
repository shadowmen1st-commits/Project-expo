# Communications, Notifications, and Support hardening

## Delivered

- Booking-scoped customer/worker chat with server-derived identity and eligibility, durable idempotency, monotonic sequence/read state, edits, soft deletion, reporting, user/admin restrictions, attachment authorization, and audit records.
- Socket authentication now verifies the `access_token` cookie and current active user. Rooms are server-derived; typing events are rate-limited, eligibility-checked, and expire automatically.
- Notification outbox claiming is atomic, recipient-scoped APIs are paginated, archive/read operations are ownership-safe, and security notification preferences cannot be disabled.
- Customer/worker support tickets validate content and booking ownership. Admin queue, assignment, internal notes, replies, controlled transitions, escalation, SLA scan, RBAC, idempotency, and audit timeline are available.
- Customer, worker, and admin React surfaces expose booking chat, support operations, and chat moderation.

## Provider and policy status

- Email is a test adapter only in `NODE_ENV=test`; production fails closed with `EMAIL_PROVIDER_NOT_CONFIGURED` until a real provider is configured.
- Attachment storage/scanning is a development implementation. It accepts only JPEG, PNG, WebP, and PDF with extension/MIME/magic checks and reports `SCANNER_NOT_CONFIGURED`; production object storage and malware scanning remain external integrations.
- The default communication policy and fallback SLA deadlines are development defaults requiring business approval before production use.
- No deployment or mobile-client changes were performed.

## Verification

- `npm run test:communications`: 145/145 assertions/tests passed (64 chat, 28 notifications, 43 support, plus 10 integration tests).
- `npm run test:regression`: passed after adding the three communication suites to the existing regression group.
- `npm run test:smoke`: backend started on a dynamic port successfully.
- `npm run build` in `frontend`: production build passed; Vite reported only a bundle-size warning.

## Commands

Run from `backend`: `npm run test:chat`, `npm run test:notifications`, `npm run test:support`, `npm run test:communications`, `npm run test:regression`, or `npm run test:all`.
