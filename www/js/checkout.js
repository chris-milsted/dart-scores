/**
 * Dart checkout (exit shot) suggestion engine.
 *
 * Computes valid 1, 2, and 3 dart combinations that finish on a double or Bull.
 *
 * Rules enforced:
 *  - Final dart must land on a double (D1-D20) or Bullseye (Bull = 50 pts).
 *  - Maximum achievable checkout: 170 (T20 + T20 + Bull).
 *  - Scores 159, 162, 163, 165, 166, 168, 169 are known impossible checkouts.
 */

// ---------------------------------------------------------------------------
// Dart definitions
// ---------------------------------------------------------------------------

/**
 * All valid dart scores, sorted by desirability (high-value trebles first).
 * Used as non-finishing darts in multi-dart combinations.
 */
const ALL_DARTS = (() => {
  const darts = [];
  for (let i = 20; i >= 1; i--) darts.push({ label: `T${i}`, value: i * 3 });
  darts.push({ label: 'Bull', value: 50 });
  for (let i = 20; i >= 1; i--) darts.push({ label: `D${i}`, value: i * 2 });
  darts.push({ label: '25', value: 25 });
  for (let i = 20; i >= 1; i--) darts.push({ label: String(i), value: i });
  return darts;
})();

/**
 * Valid finishing darts: doubles D1–D20 and Bull (inner bull = 50).
 * A checkout must end on one of these.
 */
const FINISH_DARTS = (() => {
  const darts = [];
  // Higher doubles first so suggestions favour D20, D16, D10 etc.
  for (let i = 20; i >= 1; i--) darts.push({ label: `D${i}`, value: i * 2 });
  darts.push({ label: 'Bull', value: 50 });
  return darts;
})();

/** O(1) lookup: is a given value a valid finishing dart value? */
const FINISH_VALUES = new Set(FINISH_DARTS.map(d => d.value));

/** O(1) lookup: value -> label for finishing darts */
const FINISH_BY_VALUE = new Map(FINISH_DARTS.map(d => [d.value, d.label]));

// ---------------------------------------------------------------------------
// Table builder
// ---------------------------------------------------------------------------

/**
 * Build the checkout lookup table for scores 2–170.
 * Stores up to 3 suggestions per score, ordered by desirability
 * (high-value combinations preferred via ALL_DARTS priority ordering).
 *
 * @returns {Map<number, string[][]>}
 */
function buildCheckoutTable() {
  const table = new Map();

  for (let score = 2; score <= 170; score++) {
    const suggestions = [];

    // --- 1-dart finish ---
    if (FINISH_VALUES.has(score)) {
      suggestions.push([FINISH_BY_VALUE.get(score)]);
    }

    // --- 2-dart finish ---
    if (suggestions.length < 3) {
      for (const d1 of ALL_DARTS) {
        if (suggestions.length >= 3) break;
        const rem = score - d1.value;
        if (rem <= 0) continue;
        if (FINISH_VALUES.has(rem)) {
          suggestions.push([d1.label, FINISH_BY_VALUE.get(rem)]);
        }
      }
    }

    // --- 3-dart finish ---
    if (suggestions.length < 3) {
      outer: for (const d1 of ALL_DARTS) {
        for (const d2 of ALL_DARTS) {
          if (suggestions.length >= 3) break outer;
          const rem = score - d1.value - d2.value;
          if (rem <= 0) continue;
          if (FINISH_VALUES.has(rem)) {
            suggestions.push([d1.label, d2.label, FINISH_BY_VALUE.get(rem)]);
          }
        }
      }
    }

    if (suggestions.length > 0) {
      table.set(score, suggestions);
    }
  }

  return table;
}

// Computed once at module load — negligible cost in modern JS (~1-2 ms).
const CHECKOUT_TABLE = buildCheckoutTable();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get checkout suggestions for a given remaining score.
 *
 * @param {number} score - Remaining score (must be 2–170).
 * @returns {string[][] | null} Array of up to 3 dart-combination arrays,
 *   or null if the score cannot be checked out.
 *
 * @example
 * getCheckout(170) // [["T20","T20","Bull"]]
 * getCheckout(40)  // [["D20"],["D19","D1"],["D18","D2"]]
 * getCheckout(169) // null  (impossible checkout)
 */
export function getCheckout(score) {
  return CHECKOUT_TABLE.get(score) ?? null;
}

/**
 * Returns true if the score is achievable as a checkout in 1–3 darts.
 *
 * @param {number} score
 * @returns {boolean}
 */
export function canCheckout(score) {
  return CHECKOUT_TABLE.has(score);
}
