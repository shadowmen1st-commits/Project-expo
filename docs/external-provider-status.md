# External Provider Status

| Provider | Status | Notes |
| :--- | :--- | :--- |
| Google OAuth | PENDING_EXTERNAL_CREDENTIALS | Waiting for GCP OAuth Consent Screen approval and live Client ID generation. |
| Apple OAuth | PENDING_EXTERNAL_CREDENTIALS | Waiting for Apple Developer account configuration and Service ID creation. |
| Razorpay | TEST_CONFIGURED_NOT_VERIFIED | Mock endpoints passed locally, but requires external test keys applied to staging environment variables for E2E verification. |
| RazorpayX | PENDING_EXTERNAL_CREDENTIALS | Requires test/sandbox access approval from Razorpay for payouts API. |
| Email (SendGrid/Postmark) | NOT_CONFIGURED | SMTP mock used locally. Requires domain validation and API key generation. |
| Malware Scanner | NOT_CONFIGURED | Attachment uploads remain unverified against a real malware scanning API (e.g., ClamAV/VirusTotal). |
| Push Notifications | NOT_CONFIGURED | FCM or APNs certificates not provisioned. |
| SMS Provider | NOT_CONFIGURED | Twilio or equivalent not provisioned. |
