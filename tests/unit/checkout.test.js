/**
 * Unit tests — checkout.js
 *
 * Verifies the correctness of the checkout suggestion engine including:
 *  - Known canonical checkouts (170, 167, 160, 50, etc.)
 *  - All suggestions sum to their score
 *  - All suggestions end on a double or Bull
 *  - Known impossible checkouts return null
 *  - Out-of-range scores return null
 */

import { describe, it, expect } from 'vitest';
import { getCheckout, canCheckout } from '../../www/js/checkout.js';

// ---------------------------------------------------------------------------
// Helper: parse dart label to numeric value
// ---------------------------------------------------------------------------

function dartValue(label) {
  if (label === 'Bull') return 50;
  if (label === '25')   return 25;
  if (label.startsWith('T')) return parseInt(label.slice(1), 10) * 3;
  if (label.startsWith('D')) return parseInt(label.slice(1), 10) * 2;
  return parseInt(label, 10);
}

function isFinishDart(label) {
  return label === 'Bull' || (label.startsWith('D') && label !== '25');
}

// ---------------------------------------------------------------------------
// Canonical checkout tests
// ---------------------------------------------------------------------------

describe('getCheckout — known canonical checkouts', () => {
  it('170: T20 T20 Bull', () => {
    const suggestions = getCheckout(170);
    expect(suggestions).not.toBeNull();
    // The first suggestion must be the canonical T20 T20 Bull path
    const first = suggestions[0];
    expect(first).toEqual(['T20', 'T20', 'Bull']);
  });

  it('167: T20 T19 Bull', () => {
    const suggestions = getCheckout(167);
    expect(suggestions).not.toBeNull();
    expect(suggestions[0]).toEqual(['T20', 'T19', 'Bull']);
  });

  it('164: T20 T18 Bull', () => {
    const suggestions = getCheckout(164);
    expect(suggestions).not.toBeNull();
    expect(suggestions[0]).toEqual(['T20', 'T18', 'Bull']);
  });

  it('161: T20 T17 Bull', () => {
    const suggestions = getCheckout(161);
    expect(suggestions).not.toBeNull();
    expect(suggestions[0]).toEqual(['T20', 'T17', 'Bull']);
  });

  it('160: T20 T20 D20', () => {
    const suggestions = getCheckout(160);
    expect(suggestions).not.toBeNull();
    expect(suggestions[0]).toEqual(['T20', 'T20', 'D20']);
  });

  it('110: T20 Bull (2-dart)', () => {
    const suggestions = getCheckout(110);
    expect(suggestions).not.toBeNull();
    const twodart = suggestions.find(s => s.length === 2);
    expect(twodart).toBeDefined();
    // T20(60) + Bull(50) = 110
    expect(dartValue(twodart[0]) + dartValue(twodart[1])).toBe(110);
    expect(isFinishDart(twodart[1])).toBe(true);
  });

  it('50: Bull (1-dart finish)', () => {
    const suggestions = getCheckout(50);
    expect(suggestions).not.toBeNull();
    const oneDart = suggestions.find(s => s.length === 1);
    expect(oneDart).toBeDefined();
    expect(oneDart[0]).toBe('Bull');
  });

  it('40: D20 (1-dart finish)', () => {
    const suggestions = getCheckout(40);
    expect(suggestions).not.toBeNull();
    const oneDart = suggestions.find(s => s.length === 1);
    expect(oneDart).toBeDefined();
    expect(oneDart[0]).toBe('D20');
  });

  it('32: D16 (1-dart finish)', () => {
    const suggestions = getCheckout(32);
    expect(suggestions).not.toBeNull();
    expect(suggestions[0]).toEqual(['D16']);
  });

  it('2: D1 (1-dart finish — minimum checkout)', () => {
    const suggestions = getCheckout(2);
    expect(suggestions).not.toBeNull();
    expect(suggestions[0]).toEqual(['D1']);
  });
});

// ---------------------------------------------------------------------------
// Impossible checkouts
// ---------------------------------------------------------------------------

describe('getCheckout — impossible checkouts return null', () => {
  const IMPOSSIBLE = [159, 162, 163, 165, 166, 168, 169];

  IMPOSSIBLE.forEach(score => {
    it(`${score} is impossible`, () => {
      expect(getCheckout(score)).toBeNull();
      expect(canCheckout(score)).toBe(false);
    });
  });

  it('score 1 is impossible', () => {
    expect(getCheckout(1)).toBeNull();
  });

  it('score 0 has no checkout entry', () => {
    expect(getCheckout(0)).toBeNull();
  });

  it('score 171 (over max) returns null', () => {
    expect(getCheckout(171)).toBeNull();
  });

  it('score 501 returns null', () => {
    expect(getCheckout(501)).toBeNull();
  });

  it('negative score returns null', () => {
    expect(getCheckout(-1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Structural invariants: all suggestions 2–170
// ---------------------------------------------------------------------------

describe('getCheckout — structural invariants for all achievable scores', () => {
  it('every suggestion array sums to its score', () => {
    for (let score = 2; score <= 170; score++) {
      const suggestions = getCheckout(score);
      if (suggestions === null) continue; // impossible — checked separately

      suggestions.forEach((combo, idx) => {
        const total = combo.reduce((sum, dart) => sum + dartValue(dart), 0);
        expect(total, `score ${score} suggestion[${idx}] sum mismatch`).toBe(score);
      });
    }
  });

  it('every suggestion ends on a double or Bull', () => {
    for (let score = 2; score <= 170; score++) {
      const suggestions = getCheckout(score);
      if (suggestions === null) continue;

      suggestions.forEach((combo, idx) => {
        const last = combo[combo.length - 1];
        expect(
          isFinishDart(last),
          `score ${score} suggestion[${idx}] last dart "${last}" is not a finish dart`
        ).toBe(true);
      });
    }
  });

  it('each suggestion has 1, 2, or 3 darts', () => {
    for (let score = 2; score <= 170; score++) {
      const suggestions = getCheckout(score);
      if (suggestions === null) continue;

      suggestions.forEach((combo, idx) => {
        expect(
          combo.length,
          `score ${score} suggestion[${idx}] has unexpected length`
        ).toBeGreaterThanOrEqual(1);
        expect(combo.length).toBeLessThanOrEqual(3);
      });
    }
  });

  it('returns up to 3 suggestions per score', () => {
    for (let score = 2; score <= 170; score++) {
      const suggestions = getCheckout(score);
      if (suggestions === null) continue;
      expect(suggestions.length).toBeLessThanOrEqual(3);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('canCheckout matches getCheckout nullability', () => {
    for (let score = -5; score <= 175; score++) {
      const can = canCheckout(score);
      const suggestion = getCheckout(score);
      expect(can).toBe(suggestion !== null);
    }
  });
});
