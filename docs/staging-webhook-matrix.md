# Staging Webhook Matrix

| Provider | Event | Staging URL | Method | Signature Req | Idempotency Key | Expected Status | Retry | Reconciliation Path | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Razorpay | `payment.captured` | `https://api-staging.../api/webhooks/razorpay` | POST | `x-razorpay-signature` | `razorpay_payment_id` | 200 | Yes (Provider) | `/api/ledger/reconcile` | PENDING_EXTERNAL_ACCESS |
| Razorpay | `refund.processed` | `https://api-staging.../api/webhooks/razorpay` | POST | `x-razorpay-signature` | `razorpay_refund_id` | 200 | Yes (Provider) | `/api/ledger/reconcile` | PENDING_EXTERNAL_ACCESS |
| RazorpayX| `payout.processed` | `https://api-staging.../api/webhooks/razorpayx`| POST | `x-razorpay-signature` | `razorpay_payout_id` | 200 | Yes (Provider) | `/api/ledger/reconcile` | PENDING_EXTERNAL_ACCESS |
| Google | `oauth2callback` | `https://api-staging.../api/auth/google/callback` | GET | `state` / PKCE | `code` exchange | 302 | User Retry | None | PENDING_EXTERNAL_ACCESS |
| Apple | `oauth2callback` | `https://api-staging.../api/auth/apple/callback` | POST | `state` / PKCE | `code` exchange | 302 | User Retry | None | PENDING_EXTERNAL_ACCESS |
