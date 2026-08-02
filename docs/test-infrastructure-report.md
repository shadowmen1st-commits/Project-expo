# Test Infrastructure Report

## Architecture

Express construction is isolated in `backend/src/app.js`; importing it does not connect to MongoDB or listen. `backend/src/index.js` provides `startServer(port)` and `stopServer()`, connects deliberately, supports port `0`, and owns signal shutdown.

Shared helpers:

- `tests/helpers/testEnvironment.js`: isolated standalone/replica-set startup, transaction-abort probe, database guards, reset, app creation and cleanup.
- `tests/helpers/testFixtures.js`: focused user, customer, admin, worker/profile, category, pricing, commission, booking and payment factories plus auth headers.
- `tests/helpers/mockProviders.js`: provider reset boundary.
- `tests/helpers/runTestFile.js`: sets test/mock environment before dynamically importing legacy suites.
- `tests/helpers/runSuites.js`: cross-platform, sequential fail-fast aggregation with exit-code propagation and duration output.

Financial suites use a one-node `MongoMemoryReplSet`: payment verification, legacy payment, ledger, refund/dispute, refund hardening and payout. Booking also uses the replica set because its completion path is financial. No manually managed MongoDB service is required. API tests use Supertest except the raw HTTP payment verification suite, which intentionally binds an OS-assigned port to exercise request-stream behavior.

## Runner audit

| Suite | Command | Previous topology/startup/fixtures | Previous failure | Current strategy |
|---|---|---|---|---|
| Booking | `npm run test:booking` | Development MongoDB, port 5001, seeded accounts | Null fixture dereference | Supertest, isolated replica set, local factories, finally cleanup |
| Pricing | `npm run test:pricing` | Environment-dependent connection | Development-data risk | Test bootstrap, memory replica set, controlled disconnect |
| Payment verification | `npm run test:payments` | Fixed port 5089 | Port dependency | Memory replica set, dynamic port, controlled start/stop |
| Legacy payment | `npm run test:payments:legacy` | Port 5001 and seed data | Invalid 0/0 result | Supertest, 17 discovered tests, assertion-count guard |
| Ledger | `npm run test:ledger` | Local MongoDB and forced exit | Standalone fallback risk | Test bootstrap, replica set, natural disconnect |
| Legacy refund/dispute | `npm run test:refunds` | Configuration imported as development; standalone MongoDB | Transaction code 20 | Dynamic test bootstrap, replica set, 15 assertions |
| Refund hardening | `npm run test:refunds:hardening` | Memory replica set | None | Retained; 30 assertions/8 scenarios |
| Payout | `npm run test:payouts` | Memory replica set | None | Retained; 93/93 |

## Safety and cleanup

- `NODE_ENV` must be `test` before destructive cleanup.
- Database names must contain `test`; otherwise cleanup throws.
- Each shared environment uses a random database name and prints only its name/topology.
- No production Razorpay or bank data is used. Payment and payout modes are explicitly mock-only in test.
- Mongoose model indexes initialize before financial transactions, avoiding first-write catalog races.
- Mongoose, memory processes and any HTTP server close in `finally`/controlled shutdown paths. Provider injections are reset.
- Financial tests throw if transaction capability is absent; they do not silently fall back.

## Commands and final results

| Command | Result | Exit |
|---|---:|---:|
| `npm run test:booking` | 20/20 | 0 |
| `npm run test:pricing` | 53/53 | 0 |
| `npm run test:payments` | 40/40 | 0 |
| `npm run test:payments:legacy` | 17/17 | 0 |
| `npm run test:ledger` | 77/77 | 0 |
| `npm run test:refunds` | 15/15 | 0 |
| `npm run test:refunds:hardening` | 30 assertions across 8 scenarios | 0 |
| `npm run test:payouts` | 93/93 | 0 |
| `npm run test:financial` | all constituent suites passed | 0 |
| `npm run test:regression` | all constituent suites passed | 0 |
| `npm run test:all` | all suites plus smoke passed | 0 |
| `npm run lint` (frontend) | passed with pre-existing non-fatal warnings | 0 |
| `npm run build` (frontend) | 2,188 modules transformed | 0 |

Final `test:all` backend smoke used dynamically assigned port **62341**. Test-case total is **323** when refund hardening is counted as 8 scenarios; separately reported validation/assertion total is **345**.

## Adding a suite

Set test/mock environment before importing configuration, choose standalone only for truly non-financial work, otherwise call `startReplicaSetTestEnvironment()`. Build only the fixtures relevant to the scenario, use Supertest with `createTestApp()`, assert that at least one test ran, and always call `stopTestEnvironment()` in `finally`. Add the direct command to `package.json`, then add it to the appropriate fail-fast group.

## MongoMemoryReplSet troubleshooting and CI

Allow enough startup time and cache downloaded MongoDB binaries where the CI provider permits it. A transaction error usually means configuration was imported before test mode or a suite bypassed the shared/bootstrap connection. Catalog-change errors indicate transactions began before indexes finished; the connection layer now awaits model initialization.

GitHub Actions installs backend/frontend dependencies, runs `test:all`, frontend lint and the production build. It needs no MongoDB service.

## RazorpayX sandbox

Status: **PENDING_EXTERNAL_CREDENTIALS**. Later verification requires activated RazorpayX access, test credentials/account number, IP allowlisting, webhook secret, a public HTTPS webhook URL, test Contact and Fund Account, a test payout, processed/failed/reversed webhook evidence, and ledger reconciliation. Mock execution is not sandbox verification.
