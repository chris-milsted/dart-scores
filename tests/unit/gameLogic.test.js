/**
 * Unit tests — game.js
 *
 * Covers:
 *  - State initialisation
 *  - validateThrowScore
 *  - applyThrow (normal, bust, win, edge cases)
 *  - confirmWin / denyWin
 *  - Turn rotation
 *  - resetGame
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initGame,
  getState,
  saveState,
  applyThrow,
  confirmWin,
  denyWin,
  resetGame,
  validateThrowScore,
  startNextLeg,
  getPlayerStats,
} from '../../www/js/game.js';

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function setup501(playerNames = ['Alice', 'Bob']) {
  return initGame(playerNames.map(name => ({ name, startScore: 501 })));
}

function setup301(playerNames = ['Alice', 'Bob']) {
  return initGame(playerNames.map(name => ({ name, startScore: 301 })));
}

beforeEach(() => {
  // Clear sessionStorage between tests
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// validateThrowScore
// ---------------------------------------------------------------------------

describe('validateThrowScore', () => {
  it('accepts 0 (no score)', () => {
    const r = validateThrowScore(0);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(0);
  });

  it('accepts 60 (T20)', () => {
    const r = validateThrowScore(60);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(60);
  });

  it('accepts 180 (maximum T20+T20+T20)', () => {
    const r = validateThrowScore(180);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(180);
  });

  it('accepts string "100"', () => {
    const r = validateThrowScore('100');
    expect(r.valid).toBe(true);
    expect(r.score).toBe(100);
  });

  it('rejects 181', () => {
    const r = validateThrowScore(181);
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('rejects -1', () => {
    const r = validateThrowScore(-1);
    expect(r.valid).toBe(false);
  });

  it('rejects non-integer 10.5', () => {
    const r = validateThrowScore(10.5);
    expect(r.valid).toBe(false);
  });

  it('rejects NaN', () => {
    const r = validateThrowScore(NaN);
    expect(r.valid).toBe(false);
  });

  it('rejects empty string', () => {
    const r = validateThrowScore('');
    expect(r.valid).toBe(false);
  });

  it('rejects non-numeric string', () => {
    const r = validateThrowScore('abc');
    expect(r.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// initGame / getState
// ---------------------------------------------------------------------------

describe('initGame', () => {
  it('initialises 501 players with correct starting scores', () => {
    const state = setup501(['Alice', 'Bob']);
    expect(state.players).toHaveLength(2);
    expect(state.players[0].currentScore).toBe(501);
    expect(state.players[1].currentScore).toBe(501);
    expect(state.players[0].startScore).toBe(501);
  });

  it('initialises 301 players', () => {
    const state = setup301(['Alice']);
    expect(state.players[0].currentScore).toBe(301);
    expect(state.players[0].startScore).toBe(301);
  });

  it('supports mixed 301/501 in same game', () => {
    const state = initGame([
      { name: 'Alice', startScore: 501 },
      { name: 'Bob',   startScore: 301 },
    ]);
    expect(state.players[0].currentScore).toBe(501);
    expect(state.players[1].currentScore).toBe(301);
  });

  it('sets currentPlayerIndex to 0', () => {
    const state = setup501();
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('gameOver starts false', () => {
    const state = setup501();
    expect(state.gameOver).toBe(false);
  });

  it('winnerId starts null', () => {
    const state = setup501();
    expect(state.winnerId).toBeNull();
  });

  it('persists to sessionStorage', () => {
    setup501(['Alice']);
    const retrieved = getState();
    expect(retrieved).not.toBeNull();
    expect(retrieved.players[0].name).toBe('Alice');
  });
});

// ---------------------------------------------------------------------------
// applyThrow — normal throws
// ---------------------------------------------------------------------------

describe('applyThrow — normal throws', () => {
  it('reduces score correctly', () => {
    setup501(['Alice', 'Bob']);
    const result = applyThrow(60);
    expect(result.bust).toBe(false);
    expect(result.newScore).toBe(441);
    const state = getState();
    expect(state.players[0].currentScore).toBe(441);
  });

  it('advances turn after normal throw', () => {
    setup501(['Alice', 'Bob']);
    applyThrow(60);
    const state = getState();
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('wraps turn back to player 0 after last player throws', () => {
    setup501(['Alice', 'Bob']);
    applyThrow(60); // Alice → index becomes 1
    applyThrow(60); // Bob   → index wraps to 0
    const state = getState();
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('turn wraps correctly with 3 players', () => {
    setup501(['A', 'B', 'C']);
    applyThrow(10); // A → 1
    applyThrow(10); // B → 2
    applyThrow(10); // C → 0
    const state = getState();
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('score of 0 does not reduce (player threw nothing)', () => {
    setup501(['Alice', 'Bob']);
    applyThrow(0);
    const state = getState();
    expect(state.players[0].currentScore).toBe(501);
    // Turn still advances
    expect(state.currentPlayerIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// applyThrow — bust conditions
// ---------------------------------------------------------------------------

describe('applyThrow — bust conditions', () => {
  it('bust when throw would take score below 0', () => {
    initGame([{ name: 'Alice', startScore: 501 }]);
    // Force score to 10
    const s = getState();
    s.players[0].currentScore = 10;
    saveState(s);

    const result = applyThrow(20); // 10 - 20 = -10 → bust
    expect(result.bust).toBe(true);
    expect(result.newScore).toBe(10); // reverted
    const state = getState();
    expect(state.players[0].currentScore).toBe(10);
  });

  it('bust when throw would land on exactly 1', () => {
    initGame([{ name: 'Alice', startScore: 501 }]);
    const s = getState();
    s.players[0].currentScore = 21;
    saveState(s);

    const result = applyThrow(20); // 21 - 20 = 1 → bust
    expect(result.bust).toBe(true);
    expect(result.newScore).toBe(21);
  });

  it('bust advances the turn', () => {
    setup501(['Alice', 'Bob']);
    const s = getState();
    s.players[0].currentScore = 10;
    saveState(s);

    applyThrow(20); // bust
    const state = getState();
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('score exactly 0 does NOT bust (needs double-out confirm)', () => {
    initGame([{ name: 'Alice', startScore: 501 }]);
    const s = getState();
    s.players[0].currentScore = 40;
    saveState(s);

    const result = applyThrow(40); // 40 - 40 = 0
    expect(result.bust).toBe(false);
    expect(result.needsDoubleOutConfirm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Double-out confirmation
// ---------------------------------------------------------------------------

describe('confirmWin and denyWin', () => {
  function setupNearWin() {
    initGame([{ name: 'Alice', startScore: 501 }, { name: 'Bob', startScore: 501 }]);
    const s = getState();
    s.players[0].currentScore = 40;
    saveState(s);
    applyThrow(40); // triggers needsDoubleOutConfirm
  }

  it('confirmWin sets gameOver and winnerId', () => {
    setupNearWin();
    const state = confirmWin();
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(0);
    expect(state.players[0].currentScore).toBe(0);
  });

  it('denyWin reverts (score stays, turn advances)', () => {
    setupNearWin();
    // Before deny: Alice is still at 40 (score not saved to 0 yet)
    const state = denyWin();
    expect(state.gameOver).toBe(false);
    expect(state.players[0].currentScore).toBe(40); // unchanged
    expect(state.currentPlayerIndex).toBe(1);       // turn advanced
  });
});

// ---------------------------------------------------------------------------
// resetGame
// ---------------------------------------------------------------------------

describe('resetGame', () => {
  it('clears sessionStorage', () => {
    setup501(['Alice']);
    resetGame(false); // don't redirect in tests
    expect(getState()).toBeNull();
  });

  it('navigates to index.html when redirect=true', () => {
    setup501(['Alice']);
    // Mock window.location.href (jsdom doesn't navigate)
    const mockAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '', assign: mockAssign },
      writable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: mockAssign,
      get: () => '',
      configurable: true,
    });

    resetGame(true);
    expect(getState()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Multi-leg / sets
// ---------------------------------------------------------------------------

describe('multi-leg confirmWin', () => {
  function setupBestOf3() {
    return initGame(
      [{ name: 'Alice', startScore: 501 }, { name: 'Bob', startScore: 501 }],
      { bestOfLegs: 3 }
    );
  }

  function winLeg(playerIndex) {
    const s = getState();
    s.players[playerIndex].currentScore = 40;
    s.currentPlayerIndex = playerIndex;
    saveState(s);
    applyThrow(40);
    return confirmWin();
  }

  it('winning first leg does not end match (best of 3)', () => {
    setupBestOf3();
    const state = winLeg(0);
    expect(state.gameOver).toBe(false);
    expect(state.legOver).toBe(true);
    expect(state.legWinnerId).toBe(0);
    expect(state.players[0].legsWon).toBe(1);
  });

  it('winning two legs ends match (best of 3)', () => {
    setupBestOf3();
    winLeg(0);           // Alice wins leg 1
    startNextLeg();
    const state = winLeg(0); // Alice wins leg 2 → match won
    expect(state.gameOver).toBe(true);
    expect(state.matchWinnerId).toBe(0);
    expect(state.winnerId).toBe(0);
  });

  it('startNextLeg resets scores and increments leg counter', () => {
    setupBestOf3();
    winLeg(0);
    const state = startNextLeg();
    expect(state.players[0].currentScore).toBe(501);
    expect(state.players[1].currentScore).toBe(501);
    expect(state.currentLeg).toBe(2);
    expect(state.legOver).toBe(false);
  });

  it('startNextLeg resets currentPlayerIndex to 0', () => {
    setupBestOf3();
    winLeg(0);
    const state = startNextLeg();
    expect(state.currentPlayerIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getPlayerStats
// ---------------------------------------------------------------------------

describe('getPlayerStats', () => {
  it('returns zero stats for a fresh game', () => {
    const state = initGame([{ name: 'Alice', startScore: 501 }]);
    const s = getPlayerStats(0, state);
    expect(s.avg).toBe(0);
    expect(s.oneEighties).toBe(0);
    expect(s.onePlus).toBe(0);
    expect(s.highestCheckout).toBe(0);
    expect(s.bestLeg).toBeNull();
    expect(s.legsWon).toBe(0);
    expect(s.setsWon).toBe(0);
  });

  it('tracks 180 correctly', () => {
    initGame([{ name: 'Alice', startScore: 501 }]);
    applyThrow(180);
    const state = getState();
    const s = getPlayerStats(0, state);
    expect(s.oneEighties).toBe(1);
    expect(s.onePlus).toBe(1);
  });

  it('calculates average per turn', () => {
    initGame([{ name: 'Alice', startScore: 501 }]);
    applyThrow(60);  // turn 1
    applyThrow(80);  // turn 2 (it wraps back to player 0 with single player)
    const state = getState();
    const s = getPlayerStats(0, state);
    expect(s.avg).toBe(70);
  });

  it('records highest checkout on confirmWin', () => {
    initGame([{ name: 'Alice', startScore: 501 }]);
    const s = getState();
    s.players[0].currentScore = 36;
    saveState(s);
    applyThrow(36);
    confirmWin();
    const state = getState();
    const stats = getPlayerStats(0, state);
    expect(stats.highestCheckout).toBe(36);
    expect(stats.legsWon).toBe(1);
  });

  it('does not count busts in totalScored', () => {
    initGame([{ name: 'Alice', startScore: 501 }]);
    const s = getState();
    s.players[0].currentScore = 10;
    saveState(s);
    applyThrow(20); // bust
    const state = getState();
    const stats = getPlayerStats(0, state);
    expect(stats.avg).toBe(0); // bust not counted in totalScored
  });
});

describe('applyThrow — edge cases', () => {
  it('single player game: turn stays at 0 (only 1 player)', () => {
    initGame([{ name: 'Solo', startScore: 501 }]);
    applyThrow(60);
    const state = getState();
    expect(state.currentPlayerIndex).toBe(0); // wraps back to 0
  });

  it('6 players: turn rotates through all', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    initGame(names.map(n => ({ name: n, startScore: 501 })));
    for (let i = 0; i < 6; i++) {
      applyThrow(10);
    }
    const state = getState();
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('each player maintains their own score independently', () => {
    setup501(['Alice', 'Bob']);
    applyThrow(100); // Alice: 501 - 100 = 401
    applyThrow(50);  // Bob:   501 - 50  = 451
    const state = getState();
    expect(state.players[0].currentScore).toBe(401);
    expect(state.players[1].currentScore).toBe(451);
  });
});
