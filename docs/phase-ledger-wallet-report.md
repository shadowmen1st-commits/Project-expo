# Phase Report: Double-Entry Ledger, Internal Hold, and Worker Wallet

This report documents the design, implementation details, verification results, and accounting policy for the double-entry accounting layer of the Hyperlocal Service Marketplace.

## 1. Accounting Policy & Chart of Accounts

We have established a rigorous, transaction-backed, double-entry financial system where total Debits always equal total Credits. All monetary fields are stored as safe 64-bit integers in Paise (INR) to avoid float rounding errors.

### Chart of Accounts:
- **Assets**:
  - `PAYMENT_GATEWAY_RECEIVABLE` (Debit balance) - Tracks funds captured by Razorpay, awaiting settlement.
- **Liabilities**:
  - `CUSTOMER_FUNDS_HELD` (Credit balance) - Internal hold of customer payments prior to completion.
  - `WORKER_EARNINGS_PENDING` (Credit balance) - Earning allocation locked under settlement hold.
  - `WORKER_EARNINGS_AVAILABLE` (Credit balance) - Earnings released and ready for withdrawal.
  - `WORKER_PAYOUT_RESERVED` (Credit balance) - Earnings reserved for in-flight payouts.
  - `TAX_PAYABLE` (Credit balance) - Collected tax liabilities.
- **Revenue**:
  - `PLATFORM_COMMISSION_REVENUE` (Credit balance) - Platform commission portion.
  - **CUSTOMER_PLATFORM_FEE_REVENUE** (Credit balance) - Customer platform fee portion.
- **Expense**:
  - `PLATFORM_FUNDED_DISCOUNT_EXPENSE` (Debit balance) - Expense representing coupon discounts absorbed by the platform.

### Platform-Funded Discounts
Since the worker's earnings and platform commission are calculated on the raw base amount before discount, any coupon discount reduces the total customer paid amount but does not affect the worker's payout. The difference is absorbed by the platform as a `PLATFORM_FUNDED_DISCOUNT_EXPENSE` debit.

---

## 2. Component Layout

### Schemas & Models
1. **`LedgerAccount`**: Stores individual account numbers, codes, types, and cached balances.
2. **`LedgerTransaction`**: Stores core journal headers, event type, status, and metadata.
3. **`LedgerEntry`**: Stores individual debits and credits referencing accounts.
4. **`WorkerEarning`**: Manages the status of worker earnings (`PENDING` vs `AVAILABLE`).
5. **`WorkerWallet`**: High-performance projection storing available/pending balances for worker UI dashboards.

### Services
1. **`LedgerPostingService`**: The authoritative service to write journal transactions. Handles idempotency, balanced check verification, and automatic wallet projection sync.
2. **`SettlementReleaseService`**: Sweep processor releasing pending earnings to available balance.
3. **`LedgerReconciliationService`**: Compares cached projections in `WorkerWallet` against raw ledger entries to flag mismatches.

---

## 3. Verification & Compliance Results

- **Automated Test Suite**: Successfully executed 77 distinct test validations (`tests/ledger.test.js`) covering corrective reversals, double reversals, float rejection, unbalanced transaction rejection, idempotency checks, and wallet projections.
- **Security Checkpoint**: The test suite verifies that the target DB contains `'test'` or `'dev'` before proceeding with cleanups.
- **Regression Checks**: Run payment verification tests (40 tests) and booking tests (20 tests) to ensure zero regression.

---

## 4. Operational Commands

- **Settlement Hold Release Sweep**:
  ```bash
  npm run settlement:release
  ```
- **Ledger Backfill Migration**:
  ```bash
  npm run ledger:migrate
  ```
- **Test Executions**:
  ```bash
  npm run test:ledger
  npm run test:payments
  ```
