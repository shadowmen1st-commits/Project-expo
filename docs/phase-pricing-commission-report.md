# Secure Pricing & Commission System — Technical Phase Report

## Executive Summary

This document details the architecture, data models, financial calculation pipelines, security enforcement mechanisms, API contracts, test results, and migration protocols for the **Secure Pricing and Commission System** within the Hyperlocal Service Marketplace codebase.

The system serves as the single authoritative source of truth for hourly and daily worker rates, minimum charge adjustments, customer platform fees, GST tax calculations, coupon discounts, commission rule priority resolution, worker net earnings, and immutable booking pricing snapshots.

---

## Key System Principles & Architectural Guardrails

1. **Integer Minor Units (Paise) Financial Arithmetic**:
   All financial values are stored and calculated as non-negative integer Paise ($\text{₹}1.00 = 100 \text{ paise}$). Floating-point currency inputs or intermediate variables are strictly prohibited to prevent IEEE 754 precision loss and rounding drift.

2. **Basis Points (BPS) Rate Metrics**:
   All percentage inputs (commission rates, tax rates, percentage platform fees, percentage coupon discounts) are stored in Basis Points ($10,000 \text{ bps} = 100\%$, $1,000 \text{ bps} = 10\%$, $1,800 \text{ bps} = 18\%$).

3. **Platform Fee & Worker Commission Separation**:
   Customer platform fee (e.g. ₹50 added to customer total) and Worker commission (deducted from base service value to compute worker net earnings) are treated as two separate financial mechanisms. The customer platform fee does not reduce worker earnings.

4. **Server-Side Price Quotes (`PriceQuote`)**:
   The frontend UI does not calculate prices locally. Short-lived server quotes (`POST /api/v1/pricing/quote`) are issued with a 15-minute expiration timer and single-use atomic consumption on booking creation (`POST /api/v1/bookings`).

5. **Immutable Booking Pricing Snapshots (`pricingSnapshot`)**:
   Every booking embeds a complete `pricingSnapshot` at the moment of creation. Subsequent edits to category default commissions, worker profile rates, or global tax settings do not alter historical booking records.

---

## Authoritative 13-Step Calculation Pipeline

$$\text{Raw Service Amount} = \begin{cases} \text{Duration Units} \times \text{Hourly Rate} & \text{if HOURLY} \\ \text{Duration Days} \times \text{Daily Rate} & \text{if DAILY} \end{cases}$$

$$\text{Base Amount} = \text{Raw Service Amount} + \text{Minimum Charge Adjustment}$$

$$\text{Taxable Amount} = \max(0, \text{Base Amount} + \text{Platform Fee} - \text{Discount})$$

$$\text{Customer Total} = \text{Base Amount} + \text{Platform Fee} + \text{Tax Amount} - \text{Discount}$$

$$\text{Commission Amount} = \text{Clamp}\left(\frac{\text{Base Amount} \times \text{Percentage BPS}}{10000} + \text{Fixed Commission}, \text{Min Cap}, \text{Max Cap}\right)$$

$$\text{Worker Earning} = \max(0, \text{Base Amount} - \text{Commission Amount})$$

$$\text{Financial Invariant}: W_e + C_a = B_a$$

---

## Commission Priority Resolution Order

When resolving applicable commission rules, `CommissionResolverService` enforces the following priority hierarchy:
1. `WORKER` Scope Override (Priority 1)
2. `CATEGORY` Scope Override (Priority 2)
3. `GLOBAL` System Default (Priority 3)

Ambiguous equal-priority rules within the same scope are blocked with `HTTP 409 COMMISSION_RULE_CONFLICT`.

---

## Verified Test Suite Execution Results

Automated test suite `backend/tests/pricing.test.js` was executed and achieved **53 / 53 passed scenarios (0 failures)**:

| Category | Scenarios | Status |
| :--- | :--- | :--- |
| **Money Utilities & Minor Units** | 1 – 8 | ✅ PASSED |
| **Hourly & Daily Pricing Pipeline** | 9 – 22 | ✅ PASSED |
| **Platform Fee vs Commission Separation** | 23 – 28 | ✅ PASSED |
| **Coupon & Promotional Discounts** | 29 – 34 | ✅ PASSED |
| **Commission Priority & Conflict Resolution** | 35 – 44 | ✅ PASSED |
| **Server Price Quotes & Single-Use Consumption** | 45 – 48 | ✅ PASSED |
| **Immutable Snapshots & Regression Verification** | 49 – 53 | ✅ PASSED |

---

## Files Modified & Created

- `backend/src/utils/moneyUtils.js` [NEW]
- `backend/src/models/CommissionRule.js` [UPGRADED]
- `backend/src/models/PlatformPricingConfig.js` [NEW]
- `backend/src/models/Coupon.js` [NEW]
- `backend/src/models/SurgeRule.js` [NEW]
- `backend/src/models/PriceQuote.js` [NEW]
- `backend/src/models/Booking.js` [UPGRADED]
- `backend/src/services/CommissionResolverService.js` [NEW]
- `backend/src/services/PricingService.js` [NEW]
- `backend/src/controllers/pricingController.js` [NEW]
- `backend/src/routes/pricingRoutes.js` [NEW]
- `backend/src/controllers/bookingController.js` [UPGRADED]
- `backend/src/index.js` [UPGRADED]
- `backend/src/utils/migratePricingSnapshots.js` [NEW]
- `backend/src/utils/seed.js` [UPGRADED]
- `backend/tests/pricing.test.js` [NEW]
- `frontend/src/pages/CustomerHome.jsx` [UPGRADED]
- `frontend/src/pages/WorkerDashboard.jsx` [UPGRADED]
- `frontend/src/pages/AdminDashboard.jsx` [UPGRADED]
