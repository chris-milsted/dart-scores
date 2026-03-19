/**
 * Core game state machine for 301/501 darts.
 *
 * All state is persisted in sessionStorage as a JSON blob so it survives
 * page navigations but is discarded when the tab is closed.
 *
 * Darts rules implemented:
 *  - Players count DOWN from their starting score (301 or 501).
 *  - Must reach exactly 0 to win.
 *  - BUST: score would go below 0, or would land on exactly 1 →
 *      turn is cancelled, score reverts to previous value.
 *  - DOUBLE OUT: the winning dart must land on a double or the bullseye.
 *      This is verified via UI confirmation (the app cannot detect which
 *      physical dart was last, so the player is prompted to confirm).
 */

const STATE_KEY = 'dartTrackerState';

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Player
 * @property {string}     name         - Display name (sanitised to textContent use only).
 * @property {301 | 501}  startScore   - Starting score for this player.
 * @property {number}     currentScore - Current remaining score.
 */

/**
 * @typedef {Object} GameState
 * @property {Player[]}    players             - Array of players.
 * @property {number}      currentPlayerIndex  - Index of the player whose turn it is.
 * @property {boolean}     gameOver            - True when a winner has been declared.
 * @property {number|null} winnerId            - Index of the winning player, or null.
 */

// ---------------------------------------------------------------------------
// State I/O
// ---------------------------------------------------------------------------

/**
 * Read the current game state from sessionStorage.
 *
 * @returns {GameState | null}
 */
export function getState() {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persist game state to sessionStorage.
 *
 * @param {GameState} state
 */
export function saveState(state) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
}

/**
 * Initialise a new game from the player setup data.
 *
 * @param {Array<{name: string, startScore: 301|501}>} playerSetups
 * @returns {GameState}
 */
export function initGame(playerSetups) {
  const state = {
    players: playerSetups.map(p => ({
      name: p.name,
      startScore: p.startScore,
      currentScore: p.startScore,
    })),
    currentPlayerIndex: 0,
    gameOver: false,
    winnerId: null,
  };
  saveState(state);
  return state;
}

/**
 * Clear all game state and (optionally) redirect to the setup page.
 *
 * @param {boolean} [redirect=true]
 */
export function resetGame(redirect = true) {
  sessionStorage.removeItem(STATE_KEY);
  if (redirect) {
    window.location.href = '/index.html';
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a throw score value.
 *
 * A single turn score must be an integer in the range [0, 180].
 * 180 is the theoretical maximum (T20 + T20 + T20).
 *
 * @param {number | string} raw
 * @returns {{ valid: boolean, score: number, error: string | null }}
 */
export function validateThrowScore(raw) {
  if (raw === '' || raw === null || raw === undefined) {
    return { valid: false, score: 0, error: 'Score must be a whole number.' };
  }
  const score = Number(raw);
  if (!Number.isInteger(score) || isNaN(score)) {
    return { valid: false, score: 0, error: 'Score must be a whole number.' };
  }
  if (score < 0) {
    return { valid: false, score: 0, error: 'Score cannot be negative.' };
  }
  if (score > 180) {
    return { valid: false, score: 0, error: 'Maximum score per turn is 180.' };
  }
  return { valid: true, score, error: null };
}

// ---------------------------------------------------------------------------
// Turn logic
// ---------------------------------------------------------------------------

/**
 * Apply a throw score to the current player.
 *
 * Returns an object describing the outcome. The caller (UI layer) is
 * responsible for acting on the outcome — e.g., showing a double-out
 * confirmation dialog when `needsDoubleOutConfirm` is true.
 *
 * @param {number} score - Validated throw score (0–180).
 * @returns {{
 *   bust: boolean,
 *   needsDoubleOutConfirm: boolean,
 *   turnAdvanced: boolean,
 *   newScore: number,
 *   playerName: string,
 * }}
 */
export function applyThrow(score) {
  const state = getState();
  if (!state || state.gameOver) {
    throw new Error('No active game.');
  }

  const player = state.players[state.currentPlayerIndex];
  const previousScore = player.currentScore;
  const newScore = previousScore - score;

  // --- Bust: would go below 0, or land on 1 (unfinishable) ---
  if (newScore < 0 || newScore === 1) {
    // Revert and advance turn — score unchanged
    advanceTurn(state);
    saveState(state);
    return {
      bust: true,
      needsDoubleOutConfirm: false,
      turnAdvanced: true,
      newScore: previousScore,
      playerName: player.name,
    };
  }

  // --- Potential win: score reaches exactly 0 ---
  if (newScore === 0) {
    // Cannot automatically verify double-out; UI must ask the player.
    // State is NOT saved yet — it will be saved after confirmation.
    return {
      bust: false,
      needsDoubleOutConfirm: true,
      turnAdvanced: false,
      newScore: 0,
      playerName: player.name,
    };
  }

  // --- Normal throw: reduce score and advance turn ---
  player.currentScore = newScore;
  advanceTurn(state);
  saveState(state);
  return {
    bust: false,
    needsDoubleOutConfirm: false,
    turnAdvanced: true,
    newScore,
    playerName: player.name,
  };
}

/**
 * Confirm a double-out win for the current player.
 * Call this after the player confirms their final dart landed on a double/bull.
 *
 * @returns {GameState} Updated (terminal) game state.
 */
export function confirmWin() {
  const state = getState();
  const player = state.players[state.currentPlayerIndex];
  player.currentScore = 0;
  state.gameOver = true;
  state.winnerId = state.currentPlayerIndex;
  saveState(state);
  return state;
}

/**
 * Deny a double-out — player did NOT finish on a double/bull.
 * Treated as a bust: score reverts, turn advances.
 *
 * @returns {GameState} Updated game state.
 */
export function denyWin() {
  const state = getState();
  // Score stays at what it was before the throw (no change needed —
  // confirmWin/denyWin are called before saving the 0).
  advanceTurn(state);
  saveState(state);
  return state;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Advance currentPlayerIndex to the next player (wraps around).
 * Mutates state in place — caller is responsible for saveState().
 *
 * @param {GameState} state
 */
function advanceTurn(state) {
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;
}
