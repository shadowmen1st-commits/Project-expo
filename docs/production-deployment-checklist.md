# Production Deployment Go-Live Checklist

## Infrastructure & DB
- [ ] Production MongoDB Atlas cluster provisioned (Dedicated M10+)
- [ ] Production database least-privilege user created
- [ ] Production network peering / IP allowlisting configured
- [ ] Production continuous backups enabled
- [ ] Production restore drill successfully executed
- [ ] Production domain registered and DNS configured
- [ ] SSL certificates issued and enforced (HTTP-to-HTTPS redirect)
- [ ] Load balancer / Proxy configured

## Application Configuration
- [ ] Production `NODE_ENV=production` verified
- [ ] Secure, 64+ char `JWT_ACCESS_SECRET` generated offline
- [ ] Secure, 64+ char `JWT_REFRESH_SECRET` generated offline
- [ ] Secure 32-byte `FIELD_ENCRYPTION_KEY` generated offline
- [ ] Secure 32-byte `PAYOUT_DATA_ENCRYPTION_KEY` generated offline
- [ ] `COOKIE_SECURE=true` configured
- [ ] `COOKIE_SAME_SITE` properly restricted
- [ ] CORS strictly limits to production frontend origin

## External Providers
- [ ] Google OAuth production Consent Screen approved
- [ ] Google OAuth live Client ID and Secret obtained
- [ ] Apple OAuth Developer registration complete and live keys obtained
- [ ] Razorpay production account fully KYC approved
- [ ] Razorpay live keys generated and rotated into secrets manager
- [ ] Razorpay webhook signature strictly enforced
- [ ] RazorpayX production virtual account activated and funded
- [ ] RazorpayX live keys generated
- [ ] Email sender domain verified (DKIM, SPF, DMARC)
- [ ] Malware scanner (e.g., ClamAV API) provisioned for production file uploads

## Monitoring & Operations
- [ ] Error monitoring (Sentry/Datadog) configured and alert routing verified
- [ ] PagerDuty / OpsGenie incident contacts verified
- [ ] `GET /health` and `GET /ready` synthetic monitoring active
- [ ] Webhook failure alerts active
- [ ] Ledger/Payout reconciliation mismatch alerts active
- [ ] Rollback runbook tested and Rollback Owner assigned

## Legal & Compliance
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Refund Policy published
- [ ] Payout Policy published
- [ ] Communication/Data-retention policies approved by legal
- [ ] Accessibility business review passed
- [ ] Final Security / Pentest Review signed off

## Final Launch
- [ ] Load test conducted against staging with production equivalence
- [ ] Final User Acceptance Testing (UAT) completed by stakeholders
- [ ] Launch approval recorded
