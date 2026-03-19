/**
 * Game page UI controller.
 *
 * All user-derived strings are rendered via textContent only — never
 * innerHTML — to prevent XSS (OWASP A03).
 */

import {
  getState, applyThrow, confirmWin, denyWin,
  resetGame, validateThrowScore, startNextLeg, getPlayerStats,
} from './game.js';
import { getCheckout, canCheckout } from './checkout.js';
import { playSound }     from './sound.js';
import { triggerConfetti } from './particles.js';
import { openCalc }       from './dartCalc.js';

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const state = getState();
  if (!state) { window.location.href = '/index.html'; return; }

  renderFull();
  bindEventListeners();
});

// ---------------------------------------------------------------------------
// Full render
// ---------------------------------------------------------------------------

function renderFull() {
  const state = getState();
  if (!state) return;
  renderLegSetsBar(state);
  renderScoreboard(state);
  renderCurrentTurn(state);
  renderCheckout(state);
  renderStats(state);
  renderThrowHistory(state);
  renderMatchHistory(state);
}

// ---------------------------------------------------------------------------
// Leg / sets progress bar
// ---------------------------------------------------------------------------

function renderLegSetsBar(state) {
  const bar = document.getElementById('leg-set-bar');
  const { config } = state;

  // Hide for trivial single-leg no-sets match
  if (config.bestOfLegs === 1 && !config.playInSets) {
    bar.hidden = true;
    return;
  }

  bar.hidden   = false;
  bar.innerHTML = '';

  // Leg indicator
  const legLabel = document.createElement('span');
  legLabel.className   = 'bar-item';
  legLabel.textContent = config.playInSets
    ? `Set ${state.currentSet} · Leg ${state.currentLeg}`
    : `Leg ${state.currentLeg} of ${config.bestOfLegs}`;
  bar.appendChild(legLabel);

  // Per-player scores
  state.players.forEach((p, i) => {
    const sep = document.createElement('span');
    sep.className   = 'bar-sep';
    sep.textContent = '|';
    bar.appendChild(sep);

    const item = document.createElement('span');
    item.className = 'bar-item bar-player';
    if (i === state.currentPlayerIndex && !state.gameOver) {
      item.classList.add('bar-active');
    }
    // textContent only — player names are user-supplied
    let label = `${p.name}: ${p.legsWon}L`;
    if (config.playInSets) label += ` / ${p.setsWon}S`;
    item.textContent = label;
    bar.appendChild(item);
  });
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

function renderScoreboard(state) {
  const { config } = state;
  const hasSets    = !!config.playInSets;
  const multiLeg   = config.bestOfLegs > 1 || hasSets;

  // Rebuild thead
  const thead = document.querySelector('.scoreboard-table thead tr');
  thead.innerHTML = '';
  ['Player', 'Score', 'Start', ...(multiLeg ? ['Legs'] : []), ...(hasSets ? ['Sets'] : [])].forEach(h => {
    const th = document.createElement('th');
    th.scope       = 'col';
    th.textContent = h;
    thead.appendChild(th);
  });

  const tbody = document.getElementById('scoreboard-body');
  tbody.innerHTML = '';

  state.players.forEach((player, i) => {
    const tr = document.createElement('tr');
    if (i === state.currentPlayerIndex && !state.gameOver) tr.classList.add('active-player');
    if (state.matchWinnerId === i)                         tr.classList.add('winner-player');

    const nameTd  = document.createElement('td');
    nameTd.textContent = player.name;

    const scoreTd      = document.createElement('td');
    scoreTd.textContent = player.currentScore;
    scoreTd.className   = 'score-cell';

    const startTd      = document.createElement('td');
    startTd.textContent = player.startScore;
    startTd.className   = 'start-cell';

    tr.appendChild(nameTd);
    tr.appendChild(scoreTd);
    tr.appendChild(startTd);

    if (multiLeg) {
      const legsTd      = document.createElement('td');
      legsTd.textContent = player.legsWon;
      legsTd.className   = 'legs-cell';
      tr.appendChild(legsTd);
    }

    if (hasSets) {
      const setsTd      = document.createElement('td');
      setsTd.textContent = player.setsWon;
      setsTd.className   = 'sets-cell';
      tr.appendChild(setsTd);
    }

    tbody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// Current turn
// ---------------------------------------------------------------------------

function renderCurrentTurn(state) {
  const player = state.players[state.currentPlayerIndex];
  document.getElementById('current-player-name').textContent = player.name;
  document.getElementById('current-score').textContent       = player.currentScore;

  const form = document.getElementById('throw-form');
  const disabled = state.gameOver || state.legOver;
  form.querySelectorAll('input, button').forEach(el => { el.disabled = disabled; });

  const input = document.getElementById('throw-input');
  input.value = '';
  if (!disabled) input.focus();

  clearResult();
}

// ---------------------------------------------------------------------------
// Checkout suggestions
// ---------------------------------------------------------------------------

function renderCheckout(state) {
  const section   = document.getElementById('checkout-section');
  const container = document.getElementById('checkout-suggestions');
  const player    = state.players[state.currentPlayerIndex];

  container.innerHTML = '';

  if (state.gameOver || state.legOver || !canCheckout(player.currentScore)) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  getCheckout(player.currentScore).forEach(combo => {
    const card = document.createElement('div');
    card.className = 'checkout-card';

    combo.forEach((dart, idx) => {
      const span       = document.createElement('span');
      span.className   = 'dart-label';
      span.textContent = dart;
      card.appendChild(span);

      if (idx < combo.length - 1) {
        const sep       = document.createElement('span');
        sep.className   = 'dart-sep';
        sep.textContent = ' → ';
        card.appendChild(sep);
      }
    });

    container.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function renderStats(state) {
  const content = document.getElementById('stats-content');
  content.innerHTML = '';

  const table  = document.createElement('table');
  table.className = 'stats-table';

  const thead = document.createElement('thead');
  const hrow  = document.createElement('tr');
  ['Player', 'Avg/Turn', '180s', '100+', 'Best Leg', 'Top Checkout'].forEach(h => {
    const th       = document.createElement('th');
    th.scope       = 'col';
    th.textContent = h;
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  state.players.forEach((player, i) => {
    const s  = getPlayerStats(i, state);
    const tr = document.createElement('tr');

    [
      player.name,
      s.avg > 0     ? s.avg.toFixed(1)           : '—',
      s.oneEighties > 0 ? String(s.oneEighties)  : '—',
      s.onePlus > 0     ? String(s.onePlus)       : '—',
      s.bestLeg !== null ? `${s.bestLeg} turns`   : '—',
      s.highestCheckout > 0 ? String(s.highestCheckout) : '—',
    ].forEach(val => {
      const td       = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  content.appendChild(table);
}

// ---------------------------------------------------------------------------
// Throw history (current leg)
// ---------------------------------------------------------------------------

function renderThrowHistory(state) {
  const content = document.getElementById('throw-history-content');
  content.innerHTML = '';

  if (state.throwLog.length === 0) {
    const empty       = document.createElement('p');
    empty.className   = 'history-empty';
    empty.textContent = 'No throws yet this leg.';
    content.appendChild(empty);
    return;
  }

  const table    = document.createElement('table');
  table.className = 'history-table';

  const thead = document.createElement('thead');
  const hrow  = document.createElement('tr');
  ['Player', 'Score', 'Remaining', ''].forEach(h => {
    const th       = document.createElement('th');
    th.scope       = 'col';
    th.textContent = h;
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  // Show most recent first
  [...state.throwLog].reverse().forEach(entry => {
    const player = state.players[entry.playerIndex];
    const tr     = document.createElement('tr');
    if (entry.bust) tr.classList.add('history-bust');

    const nameTd   = document.createElement('td');
    nameTd.textContent = player.name;

    const scoreTd  = document.createElement('td');
    scoreTd.textContent = entry.score;
    scoreTd.className   = 'history-score';

    const remTd   = document.createElement('td');
    remTd.textContent = entry.remainingScore;

    const flagTd  = document.createElement('td');
    if (entry.bust)       flagTd.textContent = 'Bust';
    else if (entry.isCheckout) flagTd.textContent = 'Checkout!';
    flagTd.className = entry.bust ? 'flag-bust' : (entry.isCheckout ? 'flag-checkout' : '');

    tr.appendChild(nameTd);
    tr.appendChild(scoreTd);
    tr.appendChild(remTd);
    tr.appendChild(flagTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  content.appendChild(table);
}

// ---------------------------------------------------------------------------
// Match history (completed legs)
// ---------------------------------------------------------------------------

function renderMatchHistory(state) {
  const section = document.getElementById('match-history-section');
  const content = document.getElementById('match-history-content');

  if (state.matchHistory.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = '';

  // Show legs newest-first
  [...state.matchHistory].reverse().forEach(leg => {
    const winner    = state.players[leg.winnerId];
    const heading   = document.createElement('h3');
    heading.className   = 'history-leg-title';
    const setInfo   = state.config.playInSets ? ` (Set ${leg.setNumber})` : '';
    heading.textContent = `Leg ${leg.legNumber}${setInfo} — Won by ${winner.name}`;
    content.appendChild(heading);

    const table    = document.createElement('table');
    table.className = 'history-table';

    const thead = document.createElement('thead');
    const hrow  = document.createElement('tr');
    ['Player', 'Score', 'Remaining', ''].forEach(h => {
      const th       = document.createElement('th');
      th.textContent = h;
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    [...leg.throws].reverse().forEach(entry => {
      const player = state.players[entry.playerIndex];
      const tr     = document.createElement('tr');
      if (entry.bust) tr.classList.add('history-bust');

      const nameTd   = document.createElement('td');
      nameTd.textContent = player.name;

      const scoreTd = document.createElement('td');
      scoreTd.textContent = entry.score;

      const remTd  = document.createElement('td');
      remTd.textContent = entry.remainingScore;

      const flagTd = document.createElement('td');
      if (entry.bust)            flagTd.textContent = 'Bust';
      else if (entry.isCheckout) flagTd.textContent = 'Checkout!';
      flagTd.className = entry.bust ? 'flag-bust' : (entry.isCheckout ? 'flag-checkout' : '');

      tr.appendChild(nameTd);
      tr.appendChild(scoreTd);
      tr.appendChild(remTd);
      tr.appendChild(flagTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    content.appendChild(table);
  });
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

function bindEventListeners() {
  document.getElementById('throw-form').addEventListener('submit', handleThrowSubmit);
  document.getElementById('open-calc-btn').addEventListener('click', openCalc);

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

  // Double-out confirm
  document.getElementById('confirm-double-out').addEventListener('click', () => {
    document.getElementById('double-out-dialog').close();
    const state = confirmWin();

    if (state.gameOver) {
      playSound('matchwin');
      triggerConfetti();
      const msg = document.getElementById('winner-message');
      msg.textContent = `${state.players[state.matchWinnerId].name} wins the match!`;
      document.getElementById('winner-dialog').showModal();
      renderFull();
    } else {
      // Leg won but match continues
      playSound('legwin');
      triggerLegWinPulse(state.legWinnerId);
      populateLegWinDialog(state);
      document.getElementById('leg-win-dialog').showModal();
      renderFull();
    }
  });

  document.getElementById('deny-double-out').addEventListener('click', () => {
    document.getElementById('double-out-dialog').close();
    denyWin();
    showResult('Bust! Final dart did not land on a double. Turn cancelled.', 'bust');
    playSound('bust');
    triggerBustAnimation();
    renderFull();
  });

  // Leg win → next leg
  document.getElementById('next-leg-btn').addEventListener('click', () => {
    document.getElementById('leg-win-dialog').close();
    startNextLeg();
    renderFull();
  });

  // Play again (match over)
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

  if (!valid) { showResult(error, 'error'); return; }

  const result = applyThrow(score);

  // Sound + animation
  if (result.is180) {
    playSound('180');
    trigger180Badge();
  } else if (!result.bust) {
    // subtle feedback — no sound for normal throws to avoid fatigue
  }

  if (result.bust) {
    showResult(`Bust! Score stays at ${result.newScore}. Turn passed.`, 'bust');
    playSound('bust');
    triggerBustAnimation();
    renderFull();
    return;
  }

  if (result.needsDoubleOutConfirm) {
    document.getElementById('double-out-player').textContent = result.playerName;
    document.getElementById('double-out-dialog').showModal();
    return;
  }

  showResult(`${result.newScore} remaining.`, 'ok');
  renderFull();
}

// ---------------------------------------------------------------------------
// Leg win dialog helper
// ---------------------------------------------------------------------------

function populateLegWinDialog(state) {
  const winner  = state.players[state.legWinnerId];
  const { config } = state;

  const msgEl = document.getElementById('leg-win-message');
  msgEl.textContent = `${winner.name} wins Leg ${state.currentLeg - 1}!`;

  const summaryEl = document.getElementById('leg-score-summary');
  summaryEl.innerHTML = '';

  state.players.forEach((p, i) => {
    const span       = document.createElement('span');
    span.className   = 'leg-score-player';
    if (i === state.legWinnerId) span.classList.add('leg-score-winner');

    let label = `${p.name}: ${p.legsWon} leg${p.legsWon !== 1 ? 's' : ''}`;
    if (config.playInSets) label += ` / ${p.setsWon} set${p.setsWon !== 1 ? 's' : ''}`;
    span.textContent = label;
    summaryEl.appendChild(span);
  });
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

function triggerBustAnimation() {
  const el = document.getElementById('current-score');
  el.classList.remove('anim-bust');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('anim-bust');
  el.addEventListener('animationend', () => el.classList.remove('anim-bust'), { once: true });
}

function triggerLegWinPulse(winnerIndex) {
  const rows = document.querySelectorAll('#scoreboard-body tr');
  const row  = rows[winnerIndex];
  if (!row) return;
  row.classList.add('anim-legwin');
  row.addEventListener('animationend', () => row.classList.remove('anim-legwin'), { once: true });
}

function trigger180Badge() {
  const section = document.querySelector('.current-turn-section');
  const badge   = document.createElement('div');
  badge.className   = 'badge-180';
  badge.textContent = '180!';
  section.appendChild(badge);
  badge.addEventListener('animationend', () => badge.remove(), { once: true });
}

// ---------------------------------------------------------------------------
// Result message
// ---------------------------------------------------------------------------

function showResult(message, type) {
  const el      = document.getElementById('throw-result');
  el.textContent = message;
  el.className   = `throw-result throw-result--${type}`;
  el.hidden      = false;
}

function clearResult() {
  const el  = document.getElementById('throw-result');
  el.hidden = true;
  el.textContent = '';
}
