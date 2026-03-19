/**
 * Dart-by-dart score calculator.
 *
 * Lets users enter up to three darts individually (segment 1–20,
 * outer bull 25, inner bull 50) with single / double / treble multiplier.
 * The running total is then copied into the throw input on the game page.
 *
 * All DOM text is set via textContent — never innerHTML — (OWASP A03).
 */

let _currentDart = 0;                 // 0-indexed (0, 1, 2)
let _darts       = [null, null, null]; // score for each dart
let _multiplier  = 1;                 // 1 = single, 2 = double, 3 = treble
let _built       = false;             // grid built once on first open

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function openCalc() {
  if (!_built) { _buildUI(); _built = true; }
  _reset();
  document.getElementById('dart-calc-dialog').showModal();
}

// ---------------------------------------------------------------------------
// One-time UI wiring
// ---------------------------------------------------------------------------

function _buildUI() {
  const grid = document.getElementById('calc-grid');

  // Numbers 1–20
  for (let n = 1; n <= 20; n++) {
    const btn       = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'calc-seg-btn';
    btn.textContent = String(n);
    // Capture n by value
    btn.addEventListener('click', (function(val) {
      return () => _addDart(val * _multiplier);
    }(n)));
    grid.appendChild(btn);
  }

  // Outer bull (25) — ignores multiplier
  const ob       = document.createElement('button');
  ob.type        = 'button';
  ob.className   = 'calc-seg-btn calc-bull-btn';
  ob.textContent = 'Outer Bull (25)';
  ob.addEventListener('click', () => _addDart(25));
  grid.appendChild(ob);

  // Inner bull (50) — ignores multiplier
  const ib       = document.createElement('button');
  ib.type        = 'button';
  ib.className   = 'calc-seg-btn calc-bull-btn';
  ib.textContent = 'Bull (50)';
  ib.addEventListener('click', () => _addDart(50));
  grid.appendChild(ib);

  // Multiplier buttons
  document.querySelectorAll('.calc-mult-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _multiplier = parseInt(btn.dataset.mult, 10);
      _updateMultiplierUI();
    });
  });

  document.getElementById('calc-miss-btn')
    .addEventListener('click', () => _addDart(0));

  document.getElementById('calc-undo-btn')
    .addEventListener('click', _undoDart);

  document.getElementById('calc-reset-btn')
    .addEventListener('click', _reset);

  document.getElementById('calc-use-btn')
    .addEventListener('click', _useScore);

  document.getElementById('calc-close-btn')
    .addEventListener('click', () => {
      document.getElementById('dart-calc-dialog').close();
    });
}

// ---------------------------------------------------------------------------
// Dart entry
// ---------------------------------------------------------------------------

function _addDart(score) {
  if (_currentDart >= 3) return;
  _darts[_currentDart] = score;
  _currentDart++;
  _updateDisplay();
}

function _undoDart() {
  if (_currentDart === 0) return;
  _currentDart--;
  _darts[_currentDart] = null;
  _updateDisplay();
}

function _reset() {
  _currentDart = 0;
  _darts       = [null, null, null];
  _multiplier  = 1;
  _updateMultiplierUI();
  _updateDisplay();
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function _updateMultiplierUI() {
  document.querySelectorAll('.calc-mult-btn').forEach(btn => {
    const active = parseInt(btn.dataset.mult, 10) === _multiplier;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function _updateDisplay() {
  // Dart slot values
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`calc-dart-${i + 1}`);
    if (!el) continue;
    el.textContent = _darts[i] !== null ? String(_darts[i]) : '\u2014';
    el.classList.toggle('calc-dart-filled', _darts[i] !== null);
    el.classList.toggle('calc-dart-active', i === _currentDart && _currentDart < 3);
  }

  // Running total
  const totalEl = document.getElementById('calc-total');
  if (totalEl) totalEl.textContent = String(_getTotal());

  // Indicator
  const indEl = document.getElementById('calc-indicator');
  if (indEl) {
    indEl.textContent = _currentDart < 3
      ? `Dart ${_currentDart + 1} of 3`
      : 'All 3 darts entered';
  }

  // Enable / disable grid and miss button
  const allDone = _currentDart >= 3;
  document.querySelectorAll('#calc-grid .calc-seg-btn').forEach(b => { b.disabled = allDone; });
  const missBtn = document.getElementById('calc-miss-btn');
  if (missBtn) missBtn.disabled = allDone;

  // Undo button
  const undoBtn = document.getElementById('calc-undo-btn');
  if (undoBtn) undoBtn.disabled = _currentDart === 0;
}

function _getTotal() {
  return _darts.reduce((sum, v) => sum + (v ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Use the calculated score
// ---------------------------------------------------------------------------

function _useScore() {
  const input = document.getElementById('throw-input');
  if (input) {
    input.value = String(_getTotal());
  }
  document.getElementById('dart-calc-dialog').close();
  _reset();
  if (input) input.focus();
}
