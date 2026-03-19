/**
 * Unit tests — setup.js (validateSetup)
 *
 * Tests the player setup validation logic in isolation.
 * The DOM is set up manually using jsdom (via vitest's jsdom environment).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// We test validateSetup by constructing the DOM it expects, then importing.
// Because setup.js binds to DOMContentLoaded we only import validateSetup.
// ---------------------------------------------------------------------------

// Build the DOM structure that validateSetup reads from
function buildSetupDOM(players) {
  document.body.innerHTML = `
    <form id="setup-form">
      <div id="player-rows"></div>
      <ul id="setup-errors" hidden></ul>
    </form>
  `;

  const container = document.getElementById('player-rows');
  players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.index = i;

    const input = document.createElement('input');
    input.className = 'player-name-input';
    input.value = p.name;

    const toggle = document.createElement('button');
    toggle.className = 'score-toggle';
    toggle.dataset.score = String(p.score);

    row.appendChild(input);
    row.appendChild(toggle);
    container.appendChild(row);
  });
}

// Import validateSetup after DOM is ready
let validateSetup;
beforeEach(async () => {
  document.body.innerHTML = '';
  // Dynamic import so we can control DOM before module runs
  const mod = await import('../../www/js/setup.js');
  validateSetup = mod.validateSetup;
});

// ---------------------------------------------------------------------------
// Valid configurations
// ---------------------------------------------------------------------------

describe('validateSetup — valid inputs', () => {
  it('accepts 1 player with 501', () => {
    buildSetupDOM([{ name: 'Alice', score: 501 }]);
    const { valid, players, errors } = validateSetup();
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(players[0].name).toBe('Alice');
    expect(players[0].startScore).toBe(501);
  });

  it('accepts 6 players', () => {
    buildSetupDOM([
      { name: 'A', score: 501 },
      { name: 'B', score: 501 },
      { name: 'C', score: 301 },
      { name: 'D', score: 501 },
      { name: 'E', score: 301 },
      { name: 'F', score: 501 },
    ]);
    const { valid, players } = validateSetup();
    expect(valid).toBe(true);
    expect(players).toHaveLength(6);
  });

  it('trims whitespace from player names', () => {
    buildSetupDOM([{ name: '  Alice  ', score: 501 }]);
    const { valid, players } = validateSetup();
    expect(valid).toBe(true);
    expect(players[0].name).toBe('Alice');
  });

  it('correctly reads 301 starting score', () => {
    buildSetupDOM([{ name: 'Bob', score: 301 }]);
    const { valid, players } = validateSetup();
    expect(valid).toBe(true);
    expect(players[0].startScore).toBe(301);
  });

  it('correctly reads 501 starting score', () => {
    buildSetupDOM([{ name: 'Bob', score: 501 }]);
    const { valid, players } = validateSetup();
    expect(players[0].startScore).toBe(501);
  });

  it('allows mixed 301/501 in same game', () => {
    buildSetupDOM([
      { name: 'Alice', score: 501 },
      { name: 'Bob', score: 301 },
    ]);
    const { valid, players } = validateSetup();
    expect(valid).toBe(true);
    expect(players[0].startScore).toBe(501);
    expect(players[1].startScore).toBe(301);
  });
});

// ---------------------------------------------------------------------------
// Invalid configurations
// ---------------------------------------------------------------------------

describe('validateSetup — invalid inputs', () => {
  it('rejects empty player name', () => {
    buildSetupDOM([{ name: '', score: 501 }]);
    const { valid, errors } = validateSetup();
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects whitespace-only name', () => {
    buildSetupDOM([{ name: '   ', score: 501 }]);
    const { valid, errors } = validateSetup();
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('name'))).toBe(true);
  });

  it('rejects duplicate player names', () => {
    buildSetupDOM([
      { name: 'Alice', score: 501 },
      { name: 'Alice', score: 501 },
    ]);
    const { valid, errors } = validateSetup();
    expect(valid).toBe(false);
    expect(errors.some(e => /duplicate/i.test(e))).toBe(true);
  });

  it('duplicate check is case-insensitive', () => {
    buildSetupDOM([
      { name: 'alice', score: 501 },
      { name: 'ALICE', score: 501 },
    ]);
    const { valid, errors } = validateSetup();
    expect(valid).toBe(false);
    expect(errors.some(e => /duplicate/i.test(e))).toBe(true);
  });

  it('rejects no players (empty container)', () => {
    buildSetupDOM([]);
    const { valid } = validateSetup();
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// XSS safety — ensure names with HTML entities are stored as plain text
// ---------------------------------------------------------------------------

describe('validateSetup — XSS safety', () => {
  it('stores raw name string (no HTML parsing) for <script> payloads', () => {
    const xssPayload = '<script>alert(1)</script>';
    buildSetupDOM([{ name: xssPayload, score: 501 }]);
    const { players } = validateSetup();
    // The value should be stored as-is (plain string); rendering is the UI's
    // responsibility (via textContent). Validation does not strip HTML.
    expect(players[0].name).toBe(xssPayload);
  });

  it('stores raw name string for img onerror payloads', () => {
    const xssPayload = '"><img src=x onerror=alert(1)>';
    buildSetupDOM([{ name: xssPayload, score: 501 }]);
    const { valid, players } = validateSetup();
    // Non-empty, so it's "valid" by length. The XSS prevention happens
    // at render time (textContent), not at validation time.
    expect(players[0].name).toBe(xssPayload);
  });
});
