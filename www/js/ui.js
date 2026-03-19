/**
 * Game page UI controller.
 *
 * Reads game state from sessionStorage and drives the DOM.
 * All user-derived strings (player names, scores) are rendered via
 * textContent exclusively — never innerHTML — to prevent XSS (OWASP A03).
 */

import {
  getState,
  applyThrow,
  confirmWin,
  denyWin,
  resetGame,
  validateThrowScore,
} from './game.js';
import { getCheckout, canCheckout } from './checkout.js';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Guard: if no game state exists redirect to setup
  const state = getState();
  if (!state) {
    window.location.href = '/index.html';
    return;
  }

  renderFull();
  bindEventListeners();
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/** Render the entire game page from current sessionStorage state. */
function renderFull() {
  const state = getState();
  if (!state) return;

  renderScoreboard(state);
  renderCurrentTurn(state);
  renderCheckout(state);
}

/**
 * Render the scoreboard section (all players, scores, current player highlight).
 *
 * @param {import('./game.js').GameState} state
 */
function renderScoreboard(state) {
  const tbody = document.getElementById('scoreboard-body');
  tbody.innerHTML = '';

  state.players.forEach((player, i) => {
    const tr = document.createElement('tr');
    if (i === state.currentPlayerIndex && !state.gameOver) {
      tr.classList.add('active-player');
    }
    if (state.winnerId === i) {
      tr.classList.add('winner-player');
    }

    const nameTd = document.createElement('td');
    nameTd.textContent = player.name;

    const scoreTd = document.createElement('td');
    scoreTd.textContent = player.currentScore;
    scoreTd.className = 'score-cell';

    const startTd = document.createElement('td');
    startTd.textContent = player.startScore;
    startTd.className = 'start-cell';

    tr.appendChild(nameTd);
    tr.appendChild(scoreTd);
    tr.appendChild(startTd);
    tbody.appendChild(tr);
  });
}

/**
 * Render the current-player turn section.
 *
 * @param {import('./game.js').GameState} state
 */
function renderCurrentTurn(state) {
  const section = document.getElementById('current-turn');
  const player = state.players[state.currentPlayerIndex];

  document.getElementById('current-player-name').textContent = player.name;
  document.getElementById('current-score').textContent = player.currentScore;

  // Disable the form if the game is over
  const form = document.getElementById('throw-form');
  form.querySelectorAll('input, button').forEach(el => {
    el.disabled = state.gameOver;
  });

  // Reset throw input
  const throwInput = document.getElementById('throw-input');
  throwInput.value = '';
  throwInput.focus();

  // Clear previous result message
  clearResult();
}

/**
 * Render or hide checkout suggestions for the current player.
 *
 * @param {import('./game.js').GameState} state
 */
function renderCheckout(state) {
  const section = document.getElementById('checkout-section');
  const container = document.getElementById('checkout-suggestions');
  const player = state.players[state.currentPlayerIndex];

  container.innerHTML = '';

  if (state.gameOver || !canCheckout(player.currentScore)) {
    section.hidden = true;
    return;
  }

  const suggestions = getCheckout(player.currentScore);
  section.hidden = false;

  suggestions.forEach(combo => {
    const card = document.createElement('div');
    card.className = 'checkout-card';

    combo.forEach((dart, idx) => {
      const span = document.createElement('span');
      span.className = 'dart-label';
      span.textContent = dart; // textContent — safe
      card.appendChild(span);

      if (idx < combo.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'dart-sep';
        sep.textContent = ' → ';
        card.appendChild(sep);
      }
    });

    container.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

function bindEventListeners() {
  // Score submission
  document.getElementById('throw-form').addEventListener('submit', handleThrowSubmit);

  // Restart flow
  document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('restart-dialog').showModal();
  });

  document.getElementById('cancel-restart').addEventListener('click', () => {
    document.getElementById('restart-dialog').close();
  });

  document.getElementById('confirm-restart').addEventListener('click', () => {
    document.getElementById('restart-dialog').close();
    resetGame(true);
  });

  // Double-out confirmation
  document.getElementById('confirm-double-out').addEventListener('click', () => {
    document.getElementById('double-out-dialog').close();
    const state = confirmWin();
    showWinner(state.players[state.winnerId].name);
    renderFull();
  });

  document.getElementById('deny-double-out').addEventListener('click', () => {
    document.getElementById('double-out-dialog').close();
    denyWin();
    showResult('Bust! Final dart did not land on a double. Turn cancelled.', 'bust');
    renderFull();
  });

  // Play again from winner screen
  document.getElementById('play-again').addEventListener('click', () => {
    document.getElementById('winner-dialog').close();
    resetGame(true);
  });
}

// ---------------------------------------------------------------------------
// Throw submission
// ---------------------------------------------------------------------------

function handleThrowSubmit(event) {
  event.preventDefault();

  const rawValue = document.getElementById('throw-input').value;
  const { valid, score, error } = validateThrowScore(rawValue);

  if (!valid) {
    showResult(error, 'error');
    return;
  }

  const result = applyThrow(score);

  if (result.bust) {
    showResult(`Bust! Score stays at ${result.newScore}. Turn passed.`, 'bust');
    renderFull();
    return;
  }

  if (result.needsDoubleOutConfirm) {
    // Show double-out confirmation dialog before saving the win
    document.getElementById('double-out-player').textContent = result.playerName;
    document.getElementById('double-out-dialog').showModal();
    return;
  }

  // Normal throw
  showResult(`Score: ${result.newScore} remaining.`, 'ok');
  renderFull();
}

// ---------------------------------------------------------------------------
// Result / winner helpers
// ---------------------------------------------------------------------------

function showResult(message, type) {
  const el = document.getElementById('throw-result');
  el.textContent = message; // textContent — safe
  el.className = `throw-result throw-result--${type}`;
  el.hidden = false;
}

function clearResult() {
  const el = document.getElementById('throw-result');
  el.hidden = true;
  el.textContent = '';
}

function showWinner(name) {
  const msg = document.getElementById('winner-message');
  msg.textContent = `${name} wins! Well thrown!`; // textContent — safe
  document.getElementById('winner-dialog').showModal();
}
