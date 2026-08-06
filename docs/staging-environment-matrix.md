# Staging Environment Matrix

## Backend Staging Variables

| Variable | Description | Staging Placeholder |
| -------- | ----------- | ------------------- |
| `NODE_ENV` | Environment mode | `staging` |
| `PORT` | HTTP Port | (Provided by host) |
| `MONGODB_URI` | Atlas Replica Set URI | `mongodb+srv://user:pass@staging-cluster.mongodb.net/staging_db` |
| `FRONTEND_URL` | Staging UI Domain | `https://staging.hyperlocal.example.com` |
| `CORS_ALLOWED_ORIGINS` | CORS Policy | `https://staging.hyperlocal.example.com` |
| `TRUST_PROXY` | Proxy handling | `1` |
| `LOG_LEVEL` | Winston level | `info` |
| `SERVICE_VERSION` | Git SHA/Version | (Injected by CI) |

## Authentication
| Variable | Description | Staging Placeholder |
| -------- | ----------- | ------------------- |
| `JWT_ACCESS_SECRET` | 64-char hex string | `[SECURELY_GENERATED_ACCESS_SECRET]` |
| `JWT_REFRESH_SECRET` | 64-char hex string | `[SECURELY_GENERATED_REFRESH_SECRET]` |
| `COOKIE_NAME` | Access cookie | `__Host-access_token` |
| `REFRESH_COOKIE_NAME` | Refresh cookie | `__Host-refresh_token` |
| `COOKIE_SECURE` | Require HTTPS | `true` |
| `COOKIE_SAME_SITE` | CSRF Protection | `Lax` |
| `COOKIE_DOMAIN` | Target Domain | (Empty or explicitly `.staging.hyperlocal.example.com`) |

## Encryption
| Variable | Description | Staging Placeholder |
| -------- | ----------- | ------------------- |
| `FIELD_ENCRYPTION_KEY` | 32-byte hex | `[SECURELY_GENERATED_ENCRYPTION_KEY]` |
| `PAYOUT_ENCRYPTION_KEY`| 32-byte hex | `[SECURELY_GENERATED_PAYOUT_KEY]` |

## OAuth
| Variable | Description | Staging Placeholder |
| -------- | ----------- | ------------------- |
| `GOOGLE_OAUTH_ENABLED` | Toggle | `true` |
| `GOOGLE_CLIENT_ID` | OAuth Client | `[GOOGLE_CLIENT_ID]` |
| `GOOGLE_CLIENT_SECRET` | OAuth Secret | `[GOOGLE_CLIENT_SECRET]` |
| `GOOGLE_REDIRECT_URI` | Callback | `https://api-staging.hyperlocal.example.com/api/auth/google/callback` |
| `APPLE_OAUTH_ENABLED` | Toggle | `false` |

## Payments & Payouts (TEST MODE ONLY)
| Variable | Description | Staging Placeholder |
| -------- | ----------- | ------------------- |
| `RAZORPAY_ENABLED` | Toggle | `true` |
| `RAZORPAY_MODE` | Safety Toggle | `test` |
| `RAZORPAY_KEY_ID` | Test Key | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Test Secret | `[RAZORPAY_TEST_SECRET]` |
| `RAZORPAY_WEBHOOK_SECRET`| Signature | `[RAZORPAY_WEBHOOK_SECRET]` |
| `RAZORPAYX_ENABLED` | Toggle | `true` |
| `RAZORPAYX_MODE` | Safety Toggle | `test` |

## Frontend Public Variables (Vite)
| Variable | Description | Staging Placeholder |
| -------- | ----------- | ------------------- |
| `VITE_API_URL` | Backend URL | `https://api-staging.hyperlocal.example.com` |
| `VITE_SOCKET_URL` | Socket Server URL | `wss://api-staging.hyperlocal.example.com` |
| `VITE_APP_ENV` | Badge / Mode | `staging` |
| `VITE_APP_NAME` | Title | `Hyperlocal Staging` |
| `VITE_RAZORPAY_KEY_ID` | Public test key | `rzp_test_...` |
