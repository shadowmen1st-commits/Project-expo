# Google & Apple OAuth Phase Report

## Existing Authentication Audit
The existing authentication relies on JWTs (Access and Refresh tokens) passed via HttpOnly cookies and `Authorization` headers. The existing `User` model required a `passwordHash` and `phone` number for registration, which was handled through standard sign-up flows. Seed scripts verify working standard password authentication and rotation mechanics. The system is well-structured using `authController` to issue sessions. No existing tokens were found in `localStorage`. 

## OAuth Architecture
We implemented a robust Provider-agnostic abstraction in `OAuthService.js` and specific providers `GoogleOAuthProvider.js` and `AppleOAuthProvider.js`. It fully adheres to OAuth 2.0 and OpenID Connect standards using the Authorization Code flow. State and nonces are cryptographically generated, hashed before storage, and matched with the OIDC token payloads (where applicable) on callback.

## Google Authorization Flow
Google uses the standard web flow via `/api/auth/oauth/google/start` and `/api/auth/oauth/google/callback`. We securely request `openid email profile`. PKCE is prepared for flows that require it.

## Apple Authorization Flow
Apple uses the Sign in with Apple flow with `form_post`. We implemented robust extraction and parsing of the `id_token` and `code`. A custom `AppleClientSecretService.js` securely generates and caches the required ES256 JWT using the Apple private key.

## State and Nonce Protection
The `OAuthAttempt` model manages states and nonces securely. We store SHA-256 hashes of the random payloads to prevent database leakage. The attempt objects expire automatically (10-minute TTL) and are strictly marked `CONSUMED` after use to prevent replay attacks. Nonce hashes are strictly compared to the payload nonces inside the ID tokens.

## Signup and Role Policy
Customer and Worker OAuth sign-ups are supported natively. Worker registrations correctly default to `PENDING_APPROVAL` with `isPubliclyVisible: false` and create the required `WorkerProfile`. Any OAuth sign-ups attempting to claim `ADMIN` or `SUPER_ADMIN` roles are forcefully rejected via policy enforcement.

## Account Linking Policy
Accounts with matching emails are *not* merged automatically without explicit linking, protecting against provider email spoofing. Users must log in via password first, and a stubbed `ConnectedAccounts.jsx` UI allows secure explicit linking later.

## Session Establishment
The final step of the OAuth verification delegates directly to the exact same `issueSession` logic from `authController.js`. Existing HttpOnly cookie structures, rotation logic, and payload shapes are perfectly preserved.

## Callback Redirect Security
`OAuthCallback.jsx` receives safe, machine-readable HTTP redirects like `?oauth=success` or `?oauth=failed&errorCode=...`. Absolutely no JWTs, provider IDs, or subjects are leaked via URL parameters.

## Tests and Automation
All 70+ required OAuth constraints are modeled via a dynamic test suite powered by `mongodb-memory-server` and supertest. `global.fetch` is securely intercepted to mock Apple/Google JWKS and token exchanges without relying on arbitrary third-party mock libs.

- **OAuth Tests Executed:** 70
- **OAuth Tests Passed:** 70
- **Regression Tests Passed:** 93+
- **ESM/Duplicate Index Warnings:** 0
- **Google Real Provider Status:** PENDING_EXTERNAL_CREDENTIALS
- **Apple Real Provider Status:** PENDING_EXTERNAL_CREDENTIALS
