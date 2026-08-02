# Ratings and Reviews Phase Report

## Existing-code audit

The repository contained a minimal `Review` schema but no review controller or routes. It used a globally unique `bookingId`, accepted an unstructured `reviewText`, and had no eligibility, lifecycle, idempotency, moderation, reporting, privacy DTO, reconciliation, or transactional aggregate control. Worker profiles and the development seed contained fabricated aggregate values, while marketing UI claimed a fixed 4.9 rating. Those fabricated rating values were removed. Booking completion, payment status, participants, RBAC, notifications, audit logs, and MongoDB replica-set test infrastructure were reused.

## Business rules and policy

Only authenticated customers can create `CUSTOMER_TO_WORKER` reviews. The server derives customer, worker, category, and verified-booking status from an owned booking whose status is `COMPLETED`, payment state is `PAID` or `PARTIALLY_REFUNDED`, assigned worker exists, completion timestamp exists, and policy window remains open. Active disputes hold content in `PENDING_MODERATION`; reviews never change booking or financial state.

The versioned `ReviewPolicy` supports review/edit/response windows, title/comment limits, allowed tags, rate thresholds, auto-publication, suspicious-content moderation, and response enablement. Development defaults are 30 days, 72 edit hours, 5–1200 comment characters, 100 title characters, 48 response-edit hours, and the documented tag allow-list. The record is marked `requiresBusinessApproval`; these are not presented as approved production values. Every review retains its policy and eligibility snapshot.

## Models and aggregate design

`Review` stores participants, direction, integer rating, safe content, tags, publication/moderation lifecycle, verified booking proof, immutable eligibility/policy snapshots, scoped idempotency and fingerprint, edit/removal timestamps, worker response, reports, and moderation attribution. Unique indexes enforce `(bookingId, reviewerId, direction)` and `(reviewerId, idempotencyKey)`.

`ReviewReport` controls duplicate reporter/review/reason combinations and uses enumerated reasons/statuses. `WorkerRatingAggregate` stores `ratingSum`, `ratingCount`, verified count, nullable average, five distribution buckets, version, and last review date. `WorkerProfile` mirrors only controlled average/count fields for search DTOs; zero reviews return `averageRating: null` and count zero.

Example: ratings 4 and 5 produce sum 9, count 2, average 4.5, four-star 1, five-star 1. Editing 4 to 5 preserves count 2, changes sum to 10, and moves one distribution unit. Hide/remove recomputes without the contribution; restore recomputes it back. Operations run in MongoDB transactions for review mutation, aggregate, audit, and creation notification.

## Editing, removal, response, reporting, and moderation

Owners may edit rating/title/comment/tags inside the captured edit window; content and moderation checks rerun and aggregate count is never incremented. Removal is soft and audit-preserving, reverses a published contribution once, and leaves booking/payment history untouched. The reviewed worker can create one sanitized public response and edit it during the captured response window. Reports are authenticated, duplicate-controlled, do not directly alter visibility, and protect reporter identity from public/worker DTOs.

Only explicit moderation transitions can start review, approve, hide, remove, or restore. Each is permission checked, intention-specific, reason-controlled, audited, and aggregate-safe. There is no endpoint capable of changing customer rating/text as an administrator.

## DTOs and APIs

Public DTOs contain rating, safe title/comment/tags, safe customer display identity, verified badge, response, date, and edited flag. They exclude email, phone, address, location, payment, internal booking ID, reports, snapshots, and notes. Owner, worker, and admin DTOs add only role-appropriate lifecycle data; admin detail includes a limited audit timeline.

Customer routes under `/api/v1/reviews` provide eligibility, create, mine, detail, edit, removal request, and report. Worker routes under `/api/worker/reviews` provide list, summary, detail, response/edit, and report. Public routes are `/api/workers/:workerId/reviews` and `/api/workers/:workerId/rating-summary`. Admin routes provide review/report queues, detail, explicit moderation/report resolution, read-only reconciliation, and authorised worker aggregate rebuild.

All lists are paginated; public pages cap at 50, sorting is allow-listed, identifiers are validated, mutation routes are rate-limited, and creation requires `Idempotency-Key`.

## Interfaces

The customer completed-booking card contains an accessible 1–5 radio/star selector with text labels, title/comment controls, counter, structured tags, verified-booking explanation, disabled/loading state, success state, and moderation-pending message. Worker Dashboard shows nullable average, total/verified reviews, safe recent reviews, empty state, and response control. Worker search cards already consume backend aggregate values and now show `N/A` for zero reviews. Admin Dashboard contains a Review Moderation section with status filter, review/worker/rating/status/report/verified/edited context, and explicit transition buttons. No UI permits admin rating/text rewriting.

## Security, audit, notifications, and reconciliation

Input is Unicode-normalized, control/null bytes and HTML tags are removed, and scripts, JavaScript URLs, external links, contact/payment-like data, and suspicious content are held or rejected. This deterministic filter is defense-in-depth, not a claim of perfect automated moderation. Mongoose schemas, allow-lists, object-ID checks, RBAC, rate limits, scoped queries, unique indexes, fingerprints, and transactions defend against XSS, NoSQL/sort injection, cross-user access, replay, and races.

Audit events cover eligibility, publish/hold, edit/rating change, removal, response, report, moderation, and aggregate rebuild. Creation notifications use deterministic unique keys and are review-specific only. Read-only reconciliation checks booking existence/completion, participant alignment, rating validity, and aggregate count/sum/average drift without writes; authorised rebuild is explicit and audited.

## Seed strategy

Fabricated worker averages/counts were removed from `seed.js`; seeded workers start with nullable average and zero reviews. No random or production-looking reviews are generated, and existing test accounts remain unchanged. Review test fixtures exist only inside isolated databases attached to deterministic completed bookings.

## Files created

Backend models: `ReviewPolicy.js`, `WorkerRatingAggregate.js`, `ReviewReport.js`; services: `ReviewEligibilityService.js`, `ReviewService.js`, `RatingAggregateService.js`, `ReviewModerationService.js`, `ReviewReconciliationService.js`; controller/routes/DTO: `reviewController.js`, `reviewRoutes.js`, `workerReviewRoutes.js`, `reviewDto.js`; test: `review.test.js`. Frontend components: `CustomerReviewCard.jsx`, `WorkerReviewsPanel.jsx`, and `AdminReviewsPanel.jsx`.

## Files modified

`Review.js`, `WorkerProfile.js`, `app.js`, `adminRoutes.js`, `workerRoutes.js`, `rbac.js`, `seed.js`, `package.json`, shared fixtures/environment/suite runner, `CustomerHome.jsx`, `WorkerDashboard.jsx`, `AdminDashboard.jsx`, `LandingPage.jsx`, and `ForWorkersPage.jsx`.

## Verification results

Exact commands executed: `npm run test:auth`, `test:booking`, `test:pricing`, `test:payments`, `test:ledger`, `test:refunds`, `test:payouts`, `test:reviews`, `test:regression`, `test:all`, frontend `npm run build`, and frontend `npm run lint`.

- Reviews/security: 90/90.
- Authentication: 42/42; booking: 20/20; pricing: 53/53.
- Payment verification: 40/40; legacy payment: 17/17.
- Ledger: 77/77; refund legacy: 15/15; refund hardening: 30/30.
- Payout security: 93/93.
- Aggregate regression: 477/477. Full suite including smoke: 478/478.
- MongoDB topology: `MongoMemoryReplSet`, replica set, isolated `hyperlocal_test_*` databases.
- Startup smoke passed on dynamic port 54057.
- Frontend build passed: 2,192 modules transformed. A non-blocking bundle-size warning remains.
- Lint exited zero with existing and non-blocking hook/import hygiene warnings.
- No duplicate-index warnings, ESM/import errors, unhandled rejections, transaction errors after harness hardening, sensitive DTO output, or open-handle failures were observed.

## Known limitations and recommended next phase

Review policy defaults require Trust & Safety/business approval before production. Content rules are deterministic baseline checks and should later integrate a human moderation operations process; they must not be treated as perfect abuse classification. Bulk maker-checker moderation, helpful voting, and automated expiry reminders were intentionally not introduced. The next appropriate phase is focused Trust & Safety moderation operations/policy approval—not general chat, support tickets, push notifications, or deployment.
