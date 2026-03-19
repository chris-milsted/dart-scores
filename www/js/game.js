/**
 * Core game state machine for 301/501 darts.
 *
 * Supports best-of-X legs with optional best-of-Y sets.
 * Tracks per-player statistics and a full throw history.
 *
 * State is persisted in sessionStorage as a JSON blob.
 */

const STATE_KEY = 'dartTrackerState';

const legsNeeded = bestOf => Math.ceil(bestOf / 2);

// ---------------------------------------------------------------------------
// State I/O
// ---------------------------------------------------------------------------

export function getState() {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(state) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * @param {Array<{name:string, startScore:301|501}>} playerSetups
 * @param {{ bestOfLegs?: number, playInSets?: false|3|5 }} [config]
 */
export function initGame(playerSetups, config = {}) {
  const bestOfLegs  = config.bestOfLegs  ?? 1;
  const playInSets  = config.playInSets  ?? false;

  const normConfig = {
    bestOfLegs,
    legsToWin:  legsNeeded(bestOfLegs),
    playInSets,
    setsToWin:  playInSets ? legsNeeded(playInSets) : null,
  };

  const state = {
    config: normConfig,
    players: playerSetups.map(p => ({
      name:           p.name,
      startScore:     p.startScore,
      currentScore:   p.startScore,
      legsWon:        0,
      legsWonInSet:   0,
      setsWon:        0,
      stats: {
        totalScored:      0,
        totalTurns:       0,
        oneEighties:      0,
        onePlus:          0,
        highestCheckout:  0,
        bestLeg:          null,
      },
    })),
    currentPlayerIndex: 0,
    gameOver:           false,
    matchWinnerId:      null,
    winnerId:           null,   // kept for backwards-compat
    currentLeg:         1,
    currentSet:         1,
    legTurns:           new Array(playerSetups.length).fill(0),
    pendingThrowScore:  null,
    legOver:            false,
    legWinnerId:        null,
    throwLog:           [],
    matchHistory:       [],
  };

  saveState(state);
  return state;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

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
// Internal helpers
// ---------------------------------------------------------------------------

function recordThrow(state, playerIndex, score, bust, isCheckout) {
  state.throwLog.push({
    legNumber:     state.currentLeg,
    setNumber:     state.currentSet,
    playerIndex,
    score,
    remainingScore: state.players[playerIndex].currentScore,
    bust,
    isCheckout,
  });
  const s = state.players[playerIndex].stats;
  s.totalTurns++;
  if (!bust) {
    s.totalScored += score;
    if (score === 180) s.oneEighties++;
    if (score >= 100)  s.onePlus++;
  }
}

function archiveLeg(state, winnerId) {
  state.matchHistory.push({
    legNumber: state.currentLeg,
    setNumber: state.currentSet,
    winnerId,
    throws: [...state.throwLog],
  });
  state.throwLog = [];
}

function updateStatsOnLegWin(state, playerIndex, checkoutScore) {
  const s = state.players[playerIndex].stats;
  if (checkoutScore > s.highestCheckout) s.highestCheckout = checkoutScore;
  const turns = state.legTurns[playerIndex];
  if (s.bestLeg === null || turns < s.bestLeg) s.bestLeg = turns;
}

function advanceTurn(state) {
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;
}

// ---------------------------------------------------------------------------
// Turn logic
// ---------------------------------------------------------------------------

export function applyThrow(score) {
  const state = getState();
  if (!state || state.gameOver) throw new Error('No active game.');

  const idx    = state.currentPlayerIndex;
  const player = state.players[idx];
  const prev   = player.currentScore;
  const next   = prev - score;

  // Bust: would go below 0 or land on 1
  if (next < 0 || next === 1) {
    recordThrow(state, idx, score, true, false);
    state.legTurns[idx]++;
    advanceTurn(state);
    saveState(state);
    return {
      bust: true, needsDoubleOutConfirm: false,
      turnAdvanced: true, newScore: prev,
      playerName: player.name, is180: false, isOnePlus: false,
    };
  }

  // Potential win: score hits exactly 0
  if (next === 0) {
    state.pendingThrowScore = score;
    saveState(state);
    return {
      bust: false, needsDoubleOutConfirm: true,
      turnAdvanced: false, newScore: 0,
      playerName: player.name,
      is180: score === 180, isOnePlus: score >= 100,
    };
  }

  // Normal throw
  player.currentScore = next;
  recordThrow(state, idx, score, false, false);
  state.legTurns[idx]++;
  advanceTurn(state);
  saveState(state);
  return {
    bust: false, needsDoubleOutConfirm: false,
    turnAdvanced: true, newScore: next,
    playerName: player.name,
    is180: score === 180, isOnePlus: score >= 100,
  };
}

export function confirmWin() {
  const state        = getState();
  const idx          = state.currentPlayerIndex;
  const player       = state.players[idx];
  const checkout     = state.pendingThrowScore;

  player.currentScore = 0;
  recordThrow(state, idx, checkout, false, true);
  state.legTurns[idx]++;
  updateStatsOnLegWin(state, idx, checkout);

  player.legsWon++;
  player.legsWonInSet++;

  archiveLeg(state, idx);
  state.pendingThrowScore = null;

  const { config } = state;

  // Check set win
  let setWon = false;
  if (config.playInSets && player.legsWonInSet >= config.legsToWin) {
    setWon = true;
    player.setsWon++;
    state.players.forEach(p => { p.legsWonInSet = 0; });
    state.currentSet++;
  }

  // Check match win
  const matchWon = config.playInSets
    ? player.setsWon >= config.setsToWin
    : player.legsWon >= config.legsToWin;

  if (matchWon) {
    state.gameOver      = true;
    state.matchWinnerId = idx;
    state.winnerId      = idx;
    state.legOver       = false;
    state.legWinnerId   = null;
  } else {
    state.legOver     = true;
    state.legWinnerId = idx;
  }

  saveState(state);
  return state;
}

export function denyWin() {
  const state   = getState();
  const idx     = state.currentPlayerIndex;
  const attempt = state.pendingThrowScore;

  recordThrow(state, idx, attempt, true, false);
  state.legTurns[idx]++;
  state.pendingThrowScore = null;

  advanceTurn(state);
  saveState(state);
  return state;
}

export function startNextLeg() {
  const state = getState();

  state.players.forEach(p => { p.currentScore = p.startScore; });
  state.legTurns          = new Array(state.players.length).fill(0);
  state.currentLeg++;
  state.currentPlayerIndex = 0;
  state.legOver            = false;
  state.legWinnerId        = null;
  // throwLog was already cleared by archiveLeg inside confirmWin

  saveState(state);
  return state;
}

export function resetGame(redirect = true) {
  sessionStorage.removeItem(STATE_KEY);
  if (redirect) window.location.href = '/index.html';
}

// ---------------------------------------------------------------------------
// Stats helper (computed on demand — not stored as floating-point)
// ---------------------------------------------------------------------------

export function getPlayerStats(playerIndex, state) {
  const player = state.players[playerIndex];
  const s      = player.stats;
  const avg    = s.totalTurns > 0
    ? Math.round((s.totalScored / s.totalTurns) * 10) / 10
    : 0;
  return {
    avg,
    oneEighties:      s.oneEighties,
    onePlus:          s.onePlus,
    highestCheckout:  s.highestCheckout,
    bestLeg:          s.bestLeg,
    legsWon:          player.legsWon,
    setsWon:          player.setsWon,
  };
}
