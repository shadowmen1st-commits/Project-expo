# Authentication and Regression Repair Report

## Root cause

The configured development database did not contain the documented admin, customer, or worker seed accounts. Registration itself was reachable and returned `201`, but the browser session design was inconsistent: the API exposed refresh tokens to JavaScript, the frontend persisted tokens in `localStorage`, there was no canonical `/auth/me` bootstrap endpoint, and a stale backend process could continue serving the old contract. Public registration also accepted privileged roles, and new workers began in an incorrect draft state.

## Repairs

- Added canonical cookie-backed register, login, refresh, logout, and `/me` flows under `/api/auth`.
- Added normalized validation, strong password requirements, generic credential errors, account-state enforcement, rate limits, DB-backed active-user checks, refresh rotation/reuse revocation, and authentication audit events.
- Restricted public registration to `CUSTOMER` and `WORKER`; new workers are non-public and `PENDING_APPROVAL`.
- Made `passwordHash` excluded by default and kept refresh tokens hashed at rest.
- Replaced browser token storage with HttpOnly cookie sessions and a single environment-driven Axios client using `withCredentials` and one-flight refresh retry.
- Added a safe, idempotent `seed:auth` command for only the three documented development accounts. It does not delete unrelated data.
- Added the auth suite to aggregate regression and all-suite orchestration.

## Required development accounts

| Email | Password | Role |
| --- | --- | --- |
| `admin@hyperlocal.com` | `admin123` | `ADMIN` |
| `customer@hyperlocal.com` | `customer123` | `CUSTOMER` |
| `worker@hyperlocal.com` | `worker123` | `WORKER` |

Run `npm run seed:auth` from `backend` to restore these accounts safely.

## Verification

- Auth/security suite: 42/42 passed.
- Aggregate regression: passed, including booking 20/20, pricing 53/53, payment verification 40/40, legacy payment 17/17, ledger 77/77, refund/dispute legacy 15/15, refund hardening 30/30, and payout security 93/93.
- Frontend production build: passed (2,189 modules transformed). Vite reports a non-blocking bundle-size warning.
- Runtime integration: frontend `/login` returned 200 at `http://localhost:5173`; customer registration returned 201 through `http://localhost:5001/api`; all three seeded roles logged in and `/api/auth/me` confirmed their cookie sessions.
- CORS: configured origin accepted with credentials; unapproved origin rejected.

## Scope preservation

No ratings or reviews work was added. Booking, pricing, payments, ledger, refunds/disputes, payouts, dashboards, uploads, and role boundaries were retained and covered by the aggregate regression run.

## Configuration and implementation evidence

- Login failure: before seeding, direct database inspection found none of the three documented accounts. After seeding, each account completed `POST /api/auth/login` and cookie-authenticated `GET /api/auth/me` at port 5001.
- Registration failure: direct reproduction showed the backend registration route already returned 201. The repair addressed the inconsistent frontend session contract and stale runtime, rather than inventing another registration path.
- Frontend API URL: before, `src/utils/api.js` contained a `http://localhost:5001/api` fallback; after, `src/config/api.js` requires `VITE_API_URL` (`http://localhost:5001/api` in development) and exports the one shared credentialed client.
- Route registration: `app.js` mounts `authRoutes` once at `/api/auth`; endpoints are `/register`, `/login`, `/refresh`, `/logout`, and `/me`.
- CORS: explicit configured-origin allowlist, credential support, methods, and request headers; runtime origin is `http://localhost:5173`.
- Cookies: `access_token` and `refresh_token` are HttpOnly, Secure in production, SameSite=None in production/SameSite=Lax in development; refresh cookie is scoped to `/api/auth`.
- Parsing: raw webhook parsing remains before global `express.json()` and `express.urlencoded()` middleware.
- Password/JWT: bcrypt comparison passed for plaintext and failed for the stored hash as input; access and refresh JWTs use separate configured secrets and lifetimes, while refresh records store SHA-256 hashes only.
- Customer flow: registration, login, session restore, authorization boundary, refresh, and logout passed.
- Worker flow: registration creates one non-public pending profile; login works while booking eligibility remains approval-gated.
- Admin flow: seeded admin login passed, while public `ADMIN` and `SUPER_ADMIN` registration returned validation errors.

## Files inspected and modified

Inspected the backend app bootstrap, environment config, auth routes/controller/middleware/utilities/models, user and worker schemas, seed scripts, test harness, frontend environment/client/context/login/routing, and aggregate regression runner.

Primary modified files: `backend/src/app.js`, `backend/src/controllers/authController.js`, `backend/src/middleware/auth.js`, `backend/src/models/User.js`, `backend/src/routes/authRoutes.js`, `backend/src/utils/validation.js`, `backend/src/utils/seedAuth.js`, `backend/tests/auth.test.js`, `backend/tests/helpers/runSuites.js`, `backend/package.json`, `frontend/src/config/api.js`, `frontend/src/utils/api.js`, `frontend/src/context/AuthContext.jsx`, `frontend/src/pages/Login.jsx`, and `frontend/.env.example`.

## Remaining limitations

The frontend build reports a non-blocking large-chunk warning. Lint exits successfully with existing unused-variable, hook-dependency, and fast-refresh warnings outside this repair. Development seed passwords are intentionally fixed test credentials and must never be used for production accounts.
