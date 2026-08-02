/**
 * Money Representation & Financial Calculation Utility Module
 * All currency values are stored as Integer Minor Units (Paise: ₹1.00 = 100 paise).
 * Percentage rates are stored as Basis Points (BPS: 10,000 bps = 100%, 100 bps = 1%).
 */

/**
 * Asserts that a value is a safe, non-negative integer paise amount.
 */
export const assertSafeMoneyInteger = (value, fieldName = 'Amount') => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        throw new TypeError(`${fieldName} must be a valid number.`);
    }
    if (!Number.isInteger(value)) {
        throw new TypeError(`${fieldName} must be an integer (in paise). Received: ${value}`);
    }
    if (value < 0) {
        throw new RangeError(`${fieldName} cannot be negative. Received: ${value}`);
    }
    if (value > Number.MAX_SAFE_INTEGER) {
        throw new RangeError(`${fieldName} exceeds maximum safe integer limit.`);
    }
    return true;
};

/**
 * Converts Rupees (e.g. 499.50) safely to Integer Paise (e.g. 49950).
 */
export const rupeesToPaise = (rupees) => {
    if (rupees === null || rupees === undefined || rupees === '') {
        return 0;
    }
    const num = Number(rupees);
    if (isNaN(num) || !isFinite(num)) {
        throw new TypeError(`Invalid rupee amount: ${rupees}`);
    }
    if (num < 0) {
        throw new RangeError(`Rupee amount cannot be negative: ${rupees}`);
    }
    return Math.round(num * 100);
};

/**
 * Converts Integer Paise to display Rupee number (e.g. 49950 -> 499.50).
 */
export const paiseToDisplayRupees = (paise) => {
    assertSafeMoneyInteger(paise, 'paise');
    return Number((paise / 100).toFixed(2));
};

/**
 * Applies central rounding policy to a floating value.
 */
export const applyRoundingPolicy = (value, policy = 'HALF_UP') => {
    if (policy === 'FLOOR') return Math.floor(value);
    if (policy === 'CEIL') return Math.ceil(value);
    // Default HALF_UP
    return Math.round(value);
};

/**
 * Multiplies an integer paise amount by basis points (BPS).
 * 10,000 BPS = 100%, 1,000 BPS = 10%, 100 BPS = 1%.
 */
export const multiplyPaiseByBasisPoints = (paise, bps, policy = 'HALF_UP') => {
    assertSafeMoneyInteger(paise, 'paise');
    if (typeof bps !== 'number' || isNaN(bps) || bps < 0 || bps > 100000) {
        throw new RangeError(`Basis points must be between 0 and 100,000. Received: ${bps}`);
    }
    const raw = (paise * bps) / 10000;
    return applyRoundingPolicy(raw, policy);
};

/**
 * Convenience wrapper for percentage calculations using BPS.
 */
export const calculatePercentageAmount = (paise, bps) => {
    return multiplyPaiseByBasisPoints(paise, bps);
};

/**
 * Formats integer paise into a structured API representation.
 */
export const formatMoneyForAPI = (paise) => {
    assertSafeMoneyInteger(paise, 'paise');
    const rupees = paise / 100;
    return {
        paise,
        rupees,
        formatted: `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
};
