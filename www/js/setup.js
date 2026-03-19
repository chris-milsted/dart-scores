/**
 * Setup page logic.
 *
 * Handles dynamic player row generation, validation, and game initialisation.
 * All user-provided strings are treated as untrusted and rendered only via
 * textContent — never innerHTML — to prevent stored XSS (OWASP A03).
 */

import { initGame } from './game.js';

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 6;
const DEFAULT_PLAYERS = 2;
const DEFAULT_SCORE = 501;

let playerCount = DEFAULT_PLAYERS;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  renderPlayerRows(playerCount);
  updateCountDisplay();

  document.getElementById('decrease-players').addEventListener('click', () => {
    if (playerCount > MIN_PLAYERS) {
      playerCount--;
      renderPlayerRows(playerCount);
      updateCountDisplay();
    }
  });

  document.getElementById('increase-players').addEventListener('click', () => {
    if (playerCount < MAX_PLAYERS) {
      playerCount++;
      renderPlayerRows(playerCount);
      updateCountDisplay();
    }
  });

  document.getElementById('setup-form').addEventListener('submit', handleStartGame);
});

// ---------------------------------------------------------------------------
// DOM builders
// ---------------------------------------------------------------------------

function updateCountDisplay() {
  document.getElementById('player-count-display').textContent = playerCount;
  document.getElementById('decrease-players').disabled = playerCount <= MIN_PLAYERS;
  document.getElementById('increase-players').disabled = playerCount >= MAX_PLAYERS;
}

/**
 * Rebuild the player-rows section for the given number of players.
 * Preserves existing name/score values when possible.
 *
 * @param {number} count
 */
function renderPlayerRows(count) {
  const container = document.getElementById('player-rows');

  // Collect existing values before clearing
  const existing = [];
  container.querySelectorAll('.player-row').forEach(row => {
    existing.push({
      name: row.querySelector('.player-name-input').value,
      score: row.querySelector('.score-toggle').dataset.score,
    });
  });

  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const row = buildPlayerRow(
      i,
      existing[i]?.name ?? '',
      existing[i]?.score ?? String(DEFAULT_SCORE)
    );
    container.appendChild(row);
  }
}

/**
 * Build a single player-row element.
 *
 * @param {number} index
 * @param {string} nameValue
 * @param {string} scoreValue  '301' or '501'
 * @returns {HTMLElement}
 */
function buildPlayerRow(index, nameValue, scoreValue) {
  const row = document.createElement('div');
  row.className = 'player-row';
  row.dataset.index = index;

  // Label
  const label = document.createElement('label');
  label.className = 'player-label';
  label.textContent = `Player ${index + 1}`;
  label.htmlFor = `player-name-${index}`;

  // Name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = `player-name-${index}`;
  nameInput.className = 'player-name-input';
  nameInput.placeholder = `Player ${index + 1} name`;
  nameInput.maxLength = 30;
  nameInput.autocomplete = 'off';
  nameInput.value = nameValue;

  // Score toggle
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'score-toggle';
  toggleBtn.dataset.score = scoreValue;
  toggleBtn.textContent = `${scoreValue}`;
  toggleBtn.setAttribute('aria-label', `Toggle starting score for player ${index + 1}`);

  toggleBtn.addEventListener('click', () => {
    const current = toggleBtn.dataset.score;
    const next = current === '501' ? '301' : '501';
    toggleBtn.dataset.score = next;
    toggleBtn.textContent = next;
    toggleBtn.classList.toggle('score-301', next === '301');
    toggleBtn.classList.toggle('score-501', next === '501');
  });

  // Initialise toggle visual state
  toggleBtn.classList.add(scoreValue === '301' ? 'score-301' : 'score-501');

  row.appendChild(label);
  row.appendChild(nameInput);
  row.appendChild(toggleBtn);
  return row;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Read and validate the player setup from the DOM.
 *
 * @returns {{ valid: boolean, players: Array<{name:string, startScore:number}>, errors: string[] }}
 */
export function validateSetup() {
  const rows = document.querySelectorAll('.player-row');
  const players = [];
  const errors = [];
  const seenNames = new Set();

  rows.forEach((row, i) => {
    const rawName = row.querySelector('.player-name-input').value.trim();
    const rawScore = row.querySelector('.score-toggle').dataset.score;

    if (!rawName) {
      errors.push(`Player ${i + 1} must have a name.`);
      return;
    }

    // Normalise for duplicate detection (case-insensitive)
    const normName = rawName.toLowerCase();
    if (seenNames.has(normName)) {
      errors.push(`Duplicate name: "${rawName}". Each player must have a unique name.`);
      return;
    }
    seenNames.add(normName);

    const startScore = rawScore === '301' ? 301 : 501;
    players.push({ name: rawName, startScore });
  });

  if (players.length < MIN_PLAYERS) {
    errors.push(`At least ${MIN_PLAYERS} player is required.`);
  }

  return { valid: errors.length === 0, players, errors };
}

// ---------------------------------------------------------------------------
// Game start handler
// ---------------------------------------------------------------------------

function handleStartGame(event) {
  event.preventDefault();

  const errorBox = document.getElementById('setup-errors');
  errorBox.innerHTML = '';
  errorBox.hidden = true;

  const { valid, players, errors } = validateSetup();

  if (!valid) {
    errors.forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg; // textContent prevents XSS
      errorBox.appendChild(li);
    });
    errorBox.hidden = false;
    errorBox.focus();
    return;
  }

  initGame(players);
  window.location.href = '/game.html';
}
