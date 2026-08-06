# Production Environment Matrix

> [!CAUTION]
> This environment MUST NEVER use `localhost`, unencrypted mock keys, or test provider webhooks.

## Backend Production Variables

| Variable | Description | Production Value Rule |
| -------- | ----------- | --------------------- |
| `NODE_ENV` | Environment mode | **`production`** |
| `MONGODB_URI` | Atlas Replica Set URI | Must point to a production-only cluster |
| `FRONTEND_URL` | Production UI Domain | `https://www.hyperlocal.example.com` |
| `CORS_ALLOWED_ORIGINS` | CORS Policy | `https://www.hyperlocal.example.com` |
| `TRUST_PROXY` | Proxy handling | `1` (if behind AWS ALB, Cloudflare, etc.) |

## Security & Auth
| Variable | Description | Production Value Rule |
| -------- | ----------- | --------------------- |
| `JWT_ACCESS_SECRET` | Cryptographic secret | 64+ char high-entropy string (Vault/Secrets Manager) |
| `JWT_REFRESH_SECRET` | Cryptographic secret | 64+ char high-entropy string (Different from Access) |
| `COOKIE_SECURE` | Require HTTPS | **`true`** |
| `COOKIE_SAME_SITE` | CSRF Protection | `Strict` or `Lax` based on architecture |
| `FIELD_ENCRYPTION_KEY` | Data Encryption | 32-byte hex generated offline |

## Live Payments & Payouts
| Variable | Description | Production Value Rule |
| -------- | ----------- | --------------------- |
| `RAZORPAY_MODE` | Provider Mode | **`live`** |
| `RAZORPAY_KEY_ID` | Live Key | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Live Secret | (Vault/Secrets Manager) |
| `RAZORPAY_WEBHOOK_SECRET`| Live Webhook Sig | High-entropy custom secret |
| `RAZORPAYX_MODE` | Provider Mode | **`live`** |
| `RAZORPAYX_ACCOUNT_NUMBER`| Corporate Account | Official Virtual Account Number |

## Frontend Public Variables (Vite)
| Variable | Description | Production Value Rule |
| -------- | ----------- | --------------------- |
| `VITE_API_URL` | Backend URL | `https://api.hyperlocal.example.com` |
| `VITE_SOCKET_URL` | Socket Server URL | `wss://api.hyperlocal.example.com` |
| `VITE_APP_ENV` | Mode | `production` |
| `VITE_RAZORPAY_KEY_ID` | Public live key | `rzp_live_...` |
