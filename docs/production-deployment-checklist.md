# Production deployment checklist

## Governance and credentials

- [ ] Commit and review the intended repository contents; the current local Git index contains no tracked files.
- [ ] Review the final readiness report and accept all business-owned risks.
- [ ] Configure MongoDB Atlas replica-set networking, least-privilege user, encryption and automated backups.
- [ ] Generate independent 32+ character JWT access and refresh secrets in a secret manager.
- [ ] Configure payout data-encryption key and rotation version in a secret manager.
- [ ] Complete Google OAuth consent, production origin and exact HTTPS callback verification.
- [ ] Complete Apple Service ID, domain, return URL, Team ID, Key ID and private-key setup.
- [ ] Configure and verify Razorpay payment keys and signed webhook on public HTTPS.
- [ ] Configure and verify RazorpayX account, IP allow-list, payout credentials and webhook.
- [ ] Configure private object storage and a fail-closed malware scanner before enabling production uploads.
- [ ] Configure email sender verification, SPF, DKIM and DMARC before enabling email.

## Application configuration

- [ ] Set `NODE_ENV=production`, `PORT`, `MONGODB_URI`, `FRONTEND_URL`, exact `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL` and `TRUST_PROXY=1`.
- [ ] Set frontend `VITE_API_URL` and `VITE_SOCKET_URL` to public HTTPS/WSS endpoints.
- [ ] Confirm cookie domain, Secure, HttpOnly and SameSite behavior on the chosen same-site/cross-site topology.
- [ ] Confirm production validator rejects placeholders, localhost URLs and mock/test providers.
- [ ] Configure payment, refund and payout webhook URLs and retain raw-body signature verification.
- [ ] Keep optional providers explicitly disabled until complete; never use mock delivery in production.

## Verification before release

- [ ] Install and run real Playwright browser E2E for Customer, Worker and Admin journeys.
- [ ] Run responsive checks at 320, 375, 768, 1024, 1280 and 1440 pixels.
- [ ] Run automated accessibility tooling and a manual keyboard/screen-reader review.
- [ ] Build both Docker images and scan them for vulnerabilities and embedded secrets.
- [ ] Run staging performance tests and approve latency/capacity targets.
- [ ] Run MongoDB query plans using staging-shaped datasets.
- [ ] Execute `npm run test:all`, `test:readiness`, `test:backup-restore`, `test:shutdown`, Socket smoke, frontend lint/build/startup smoke.
- [ ] Execute a staging backup and restore drill; approve RPO/RTO.
- [ ] Verify `/health` and `/ready`, alerting, error monitoring and outbox/dead-letter alerts.

## Release and rollback

- [ ] Take a pre-release database backup and record deployment version/image digests.
- [ ] Deploy backend with one Socket.IO instance initially; use Redis adapter/shared rate state before multi-instance scaling.
- [ ] Deploy immutable frontend assets with SPA fallback and documented security headers.
- [ ] Run post-deploy auth, booking, payment test-mode, chat and readiness smoke tests.
- [ ] Monitor errors, webhook failures, reconciliation drift, dead letters and latency.
- [ ] Roll back application images first if health/readiness or error budgets fail.
- [ ] Do not roll back immutable financial ledger data; use forward corrective journals/migrations.
- [ ] Restore the database only under an approved incident plan after validating backup timestamp and financial consistency.
- [ ] Rotate any credential suspected of exposure and preserve audit/incident evidence.
