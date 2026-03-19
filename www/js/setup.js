/**
 * Setup page logic.
 *
 * Handles player row generation, match format selection, validation,
 * and game initialisation.
 * All user-provided strings are rendered only via textContent — never
 * innerHTML — to prevent stored XSS (OWASP A03).
 */

import { initGame } from './game.js';

const MIN_PLAYERS   = 1;
const MAX_PLAYERS   = 6;
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

  // Show/hide the sets selector based on whether legs > 1
  document.getElementById('best-of-select').addEventListener('change', updateSetsVisibility);
  updateSetsVisibility();

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

function updateSetsVisibility() {
  const legs    = parseInt(document.getElementById('best-of-select').value, 10);
  const setsRow = document.getElementById('sets-row');
  // Sets only make sense with more than 1 leg
  setsRow.hidden = legs <= 1;
  if (legs <= 1) {
    document.getElementById('sets-select').value = 'off';
  }
}

function renderPlayerRows(count) {
  const container = document.getElementById('player-rows');

  const existing = [];
  container.querySelectorAll('.player-row').forEach(row => {
    existing.push({
      name:  row.querySelector('.player-name-input').value,
      score: row.querySelector('.score-toggle').dataset.score,
    });
  });

  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const row = buildPlayerRow(
      i,
      existing[i]?.name  ?? '',
      existing[i]?.score ?? String(DEFAULT_SCORE)
    );
    container.appendChild(row);
  }
}

function buildPlayerRow(index, nameValue, scoreValue) {
  const row = document.createElement('div');
  row.className      = 'player-row';
  row.dataset.index  = index;
  row.setAttribute('role', 'listitem');

  const label       = document.createElement('label');
  label.className   = 'player-label';
  label.textContent = `Player ${index + 1}`;
  label.htmlFor     = `player-name-${index}`;

  const nameInput         = document.createElement('input');
  nameInput.type          = 'text';
  nameInput.id            = `player-name-${index}`;
  nameInput.className     = 'player-name-input';
  nameInput.placeholder   = `Player ${index + 1} name`;
  nameInput.maxLength     = 30;
  nameInput.autocomplete  = 'off';
  nameInput.value         = nameValue;

  const toggleBtn = document.createElement('button');
  toggleBtn.type              = 'button';
  toggleBtn.className         = 'score-toggle';
  toggleBtn.dataset.score     = scoreValue;
  toggleBtn.textContent       = scoreValue;
  toggleBtn.setAttribute('aria-label', `Toggle starting score for player ${index + 1}`);

  toggleBtn.addEventListener('click', () => {
    const next = toggleBtn.dataset.score === '501' ? '301' : '501';
    toggleBtn.dataset.score = next;
    toggleBtn.textContent   = next;
    toggleBtn.classList.toggle('score-301', next === '301');
    toggleBtn.classList.toggle('score-501', next === '501');
  });

  toggleBtn.classList.add(scoreValue === '301' ? 'score-301' : 'score-501');

  row.appendChild(label);
  row.appendChild(nameInput);
  row.appendChild(toggleBtn);
  return row;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateSetup() {
  const rows    = document.querySelectorAll('.player-row');
  const players = [];
  const errors  = [];
  const seen    = new Set();

  rows.forEach((row, i) => {
    const rawName  = row.querySelector('.player-name-input').value.trim();
    const rawScore = row.querySelector('.score-toggle').dataset.score;

    if (!rawName) {
      errors.push(`Player ${i + 1} must have a name.`);
      return;
    }
    const normName = rawName.toLowerCase();
    if (seen.has(normName)) {
      errors.push(`Duplicate name: "${rawName}". Each player must have a unique name.`);
      return;
    }
    seen.add(normName);
    players.push({ name: rawName, startScore: rawScore === '301' ? 301 : 501 });
  });

  if (players.length < MIN_PLAYERS) {
    errors.push(`At least ${MIN_PLAYERS} player is required.`);
  }

  return { valid: errors.length === 0, players, errors };
}

function readMatchConfig() {
  const bestOfLegs = parseInt(document.getElementById('best-of-select').value, 10);
  const setsRaw    = document.getElementById('sets-select').value;
  const playInSets = setsRaw === 'off' ? false : parseInt(setsRaw, 10);
  return { bestOfLegs, playInSets };
}

// ---------------------------------------------------------------------------
// Game start
// ---------------------------------------------------------------------------

function handleStartGame(event) {
  event.preventDefault();

  const errorBox  = document.getElementById('setup-errors');
  errorBox.innerHTML = '';
  errorBox.hidden    = true;

  const { valid, players, errors } = validateSetup();

  if (!valid) {
    errors.forEach(msg => {
      const li      = document.createElement('li');
      li.textContent = msg;
      errorBox.appendChild(li);
    });
    errorBox.hidden = false;
    errorBox.focus();
    return;
  }

  const config = readMatchConfig();
  initGame(players, config);
  window.location.href = '/game.html';
}
