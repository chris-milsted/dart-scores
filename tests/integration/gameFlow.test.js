/**
 * Integration tests — full game flow via Playwright
 *
 * Requires the container to be running on localhost:8080.
 *
 * Setup:
 *   podman run --rm -d -p 8080:8080 --name dart-tracker-test dart-tracker:latest
 *   npx playwright test
 *   podman stop dart-tracker-test
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.APP_URL ?? 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the setup page and configure players.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Array<{name: string, score?: 301|501}>} players
 */
async function setupGame(page, players) {
  await page.goto(`${BASE}/index.html`);

  // Set player count
  const currentCount = await page.locator('#player-count-display').textContent();
  let count = parseInt(currentCount.trim(), 10);

  while (count < players.length) {
    await page.click('#increase-players');
    count++;
  }
  while (count > players.length) {
    await page.click('#decrease-players');
    count--;
  }

  // Fill in player details
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    await page.locator(`.player-row:nth-child(${i + 1}) .player-name-input`).fill(player.name);

    // Toggle score if needed (default is 501)
    const toggleBtn = page.locator(`.player-row:nth-child(${i + 1}) .score-toggle`);
    const currentScore = await toggleBtn.getAttribute('data-score');
    const desiredScore = String(player.score ?? 501);
    if (currentScore !== desiredScore) {
      await toggleBtn.click();
    }
  }

  await page.click('#start-game-btn');
  await page.waitForURL(`${BASE}/game.html`);
}

/**
 * Submit a throw score on the game page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} score
 */
async function submitThrow(page, score) {
  await page.locator('#throw-input').fill(String(score));
  await page.locator('#throw-form button[type="submit"]').click();
}

// ---------------------------------------------------------------------------
// Setup page tests
// ---------------------------------------------------------------------------

test.describe('Setup page', () => {
  test('loads setup page on fresh visit', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('h2')).toContainText('New Game Setup');
  });

  test('player count starts at 2', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    const display = page.locator('#player-count-display');
    await expect(display).toHaveText('2');
  });

  test('decrease button disabled at 1 player', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await page.click('#decrease-players'); // 2 → 1
    await expect(page.locator('#decrease-players')).toBeDisabled();
  });

  test('increase button disabled at 6 players', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    for (let i = 0; i < 4; i++) await page.click('#increase-players');
    await expect(page.locator('#increase-players')).toBeDisabled();
  });

  test('shows error for empty player name', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await page.click('#start-game-btn');
    await expect(page.locator('#setup-errors')).not.toBeHidden();
  });

  test('shows error for duplicate names', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await page.locator('.player-row:nth-child(1) .player-name-input').fill('Alice');
    await page.locator('.player-row:nth-child(2) .player-name-input').fill('Alice');
    await page.click('#start-game-btn');
    await expect(page.locator('#setup-errors')).not.toBeHidden();
    await expect(page.locator('#setup-errors')).toContainText(/duplicate/i);
  });

  test('score toggle switches between 501 and 301', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    const toggle = page.locator('.player-row:nth-child(1) .score-toggle');
    await expect(toggle).toHaveAttribute('data-score', '501');
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-score', '301');
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-score', '501');
  });
});

// ---------------------------------------------------------------------------
// Game page redirect guard
// ---------------------------------------------------------------------------

test.describe('game.html — access guard', () => {
  test('redirects to index.html if accessed without game state', async ({ page }) => {
    // Clear sessionStorage before loading game page
    await page.goto(`${BASE}/index.html`);
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${BASE}/game.html`);
    await expect(page).toHaveURL(`${BASE}/index.html`);
  });
});

// ---------------------------------------------------------------------------
// Normal game flow
// ---------------------------------------------------------------------------

test.describe('Normal game flow', () => {
  test('displays both players in scoreboard after setup', async ({ page }) => {
    await setupGame(page, [
      { name: 'Alice', score: 501 },
      { name: 'Bob',   score: 501 },
    ]);
    const scoreboard = page.locator('.scoreboard-table');
    await expect(scoreboard).toContainText('Alice');
    await expect(scoreboard).toContainText('Bob');
  });

  test('current player name is shown in the turn section', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }, { name: 'Bob', score: 501 }]);
    await expect(page.locator('#current-player-name')).toHaveText('Alice');
  });

  test('starting score is displayed correctly', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }]);
    await expect(page.locator('#current-score')).toHaveText('501');
  });

  test('score decreases after a valid throw', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }, { name: 'Bob', score: 501 }]);
    await submitThrow(page, 60);
    // After Alice's throw, scoreboard shows 441 for Alice
    const scoreboard = page.locator('.scoreboard-table');
    await expect(scoreboard).toContainText('441');
  });

  test('turn advances to Bob after Alice throws', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }, { name: 'Bob', score: 501 }]);
    await submitThrow(page, 60);
    await expect(page.locator('#current-player-name')).toHaveText('Bob');
  });

  test('turn returns to Alice after Bob throws', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }, { name: 'Bob', score: 501 }]);
    await submitThrow(page, 60); // Alice
    await submitThrow(page, 60); // Bob
    await expect(page.locator('#current-player-name')).toHaveText('Alice');
  });
});

// ---------------------------------------------------------------------------
// Bust scenarios
// ---------------------------------------------------------------------------

test.describe('Bust scenarios', () => {
  test('bust message shown when score goes below 0', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 301 }]);
    // Reduce score to just above busting range (throw 300, leaving 1 — also a bust)
    // Let's get to a known position: throw 180 (leaves 121), then 121 = score 121
    // Just throw something that will bust
    // Start at 301, throw 180 (leaves 121), then throw 180 (would be -59 → bust)
    await submitThrow(page, 180);
    await submitThrow(page, 180); // bust
    const result = page.locator('#throw-result');
    await expect(result).toContainText(/bust/i);
  });

  test('score reverts after bust', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 301 }]);
    await submitThrow(page, 180); // 121 remaining
    const beforeScore = await page.locator('#current-score').textContent();
    await submitThrow(page, 180); // bust
    // Score should revert to 121 (shown in scoreboard)
    const scoreboard = page.locator('.scoreboard-table');
    await expect(scoreboard).toContainText('121');
  });

  test('score of 1 remaining causes bust', async ({ page }) => {
    // To get score to exactly 21: throw 280 (start 301) but 280 > 180 (max)
    // Instead: throw 180 (121 left), then throw 100 (21 left), then throw 20 (1 left → bust)
    await setupGame(page, [{ name: 'Solo', score: 301 }]);
    await submitThrow(page, 180); // 121
    await submitThrow(page, 100); // 21
    await submitThrow(page, 20);  // would be 1 → bust
    const result = page.locator('#throw-result');
    await expect(result).toContainText(/bust/i);
  });
});

// ---------------------------------------------------------------------------
// Checkout suggestions
// ---------------------------------------------------------------------------

test.describe('Checkout suggestions', () => {
  async function navigateToScore(page, playerScore, startScore = 501) {
    await setupGame(page, [{ name: 'Solo', score: startScore }]);
    const toThrow = startScore - playerScore;
    if (toThrow > 0) {
      // Throw in chunks of max 180
      let remaining = toThrow;
      while (remaining > 0) {
        const chunk = Math.min(remaining, 180);
        await submitThrow(page, chunk);
        remaining -= chunk;
      }
    }
  }

  test('checkout section is hidden for score > 170', async ({ page }) => {
    await setupGame(page, [{ name: 'Solo', score: 501 }]);
    await expect(page.locator('#checkout-section')).toBeHidden();
  });

  test('checkout section appears when score is 170', async ({ page }) => {
    await navigateToScore(page, 170, 501);
    await expect(page.locator('#checkout-section')).toBeVisible();
  });

  test('checkout section appears for score 50 (Bull finish)', async ({ page }) => {
    await navigateToScore(page, 50, 301);
    await expect(page.locator('#checkout-section')).toBeVisible();
    await expect(page.locator('#checkout-suggestions')).toContainText('Bull');
  });

  test('checkout section is hidden for score 169 (impossible)', async ({ page }) => {
    await navigateToScore(page, 169, 501);
    await expect(page.locator('#checkout-section')).toBeHidden();
  });

  test('T20 T20 Bull suggestion shown for score 170', async ({ page }) => {
    await navigateToScore(page, 170, 501);
    const suggestions = page.locator('#checkout-suggestions');
    await expect(suggestions).toContainText('T20');
    await expect(suggestions).toContainText('Bull');
  });
});

// ---------------------------------------------------------------------------
// Double-out confirmation
// ---------------------------------------------------------------------------

test.describe('Double-out confirmation', () => {
  async function setupToFinish(page) {
    await setupGame(page, [{ name: 'Solo', score: 301 }]);
    // Get to score 40 (D20 finish)
    await submitThrow(page, 180); // 121
    await submitThrow(page, 81);  // 40
    // Now throw 40 to trigger double-out dialog
    await submitThrow(page, 40);
  }

  test('double-out dialog appears when score reaches 0', async ({ page }) => {
    await setupToFinish(page);
    await expect(page.locator('#double-out-dialog')).toBeVisible();
  });

  test('confirming double-out shows winner dialog', async ({ page }) => {
    await setupToFinish(page);
    await page.click('#confirm-double-out');
    await expect(page.locator('#winner-dialog')).toBeVisible();
    await expect(page.locator('#winner-message')).toContainText('Solo');
  });

  test('denying double-out treats throw as bust', async ({ page }) => {
    await setupToFinish(page);
    await page.click('#deny-double-out');
    await expect(page.locator('#throw-result')).toContainText(/bust/i);
    // Score should still be 40
    const scoreboard = page.locator('.scoreboard-table');
    await expect(scoreboard).toContainText('40');
  });
});

// ---------------------------------------------------------------------------
// Restart flow
// ---------------------------------------------------------------------------

test.describe('Restart flow', () => {
  test('restart button opens confirmation dialog', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }]);
    await page.click('#restart-btn');
    await expect(page.locator('#restart-dialog')).toBeVisible();
  });

  test('cancel restart keeps game state', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }]);
    await submitThrow(page, 60);
    const scoreBefore = await page.locator('#current-score').textContent();
    await page.click('#restart-btn');
    await page.click('#cancel-restart');
    await expect(page.locator('#restart-dialog')).not.toBeVisible();
    // Score unchanged
    const scoreboard = page.locator('.scoreboard-table');
    await expect(scoreboard).toContainText(scoreBefore.trim());
  });

  test('confirming restart navigates to setup page', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }]);
    await page.click('#restart-btn');
    await page.click('#confirm-restart');
    await expect(page).toHaveURL(`${BASE}/index.html`);
  });

  test('play again from winner screen goes to setup', async ({ page }) => {
    await setupGame(page, [{ name: 'Solo', score: 301 }]);
    await submitThrow(page, 180);
    await submitThrow(page, 81);
    await submitThrow(page, 40);
    await page.click('#confirm-double-out');
    await page.click('#play-again');
    await expect(page).toHaveURL(`${BASE}/index.html`);
  });
});

// ---------------------------------------------------------------------------
// XSS — player name rendering (OWASP A03)
// ---------------------------------------------------------------------------

test.describe('XSS prevention — player name rendering', () => {
  test('script tag in player name is rendered as text, not executed', async ({ page }) => {
    // Track any unexpected alert() calls
    let alertFired = false;
    page.on('dialog', () => { alertFired = true; });

    await setupGame(page, [
      { name: '<script>window.__xss=1</script>', score: 501 },
      { name: 'Bob', score: 501 },
    ]);

    // The name should appear as literal text in the scoreboard
    const scoreboard = page.locator('.scoreboard-table');
    const text = await scoreboard.textContent();
    expect(text).toContain('<script>');
    expect(alertFired).toBe(false);

    // Confirm the XSS script did NOT execute
    const xssExecuted = await page.evaluate(() => window.__xss);
    expect(xssExecuted).toBeUndefined();
  });

  test('img onerror payload in name is not executed', async ({ page }) => {
    let alertFired = false;
    page.on('dialog', () => { alertFired = true; });

    await setupGame(page, [
      { name: '"><img src=x onerror="window.__xss2=1">', score: 501 },
      { name: 'Bob', score: 501 },
    ]);

    const xssExecuted = await page.evaluate(() => window.__xss2);
    expect(xssExecuted).toBeUndefined();
    expect(alertFired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Score input validation
// ---------------------------------------------------------------------------

test.describe('Score input validation', () => {
  test('throws above 180 are rejected', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }]);
    await submitThrow(page, 181);
    await expect(page.locator('#throw-result')).toContainText(/180/);
    // Score unchanged
    await expect(page.locator('#current-score')).toHaveText('501');
  });

  test('negative scores are rejected', async ({ page }) => {
    await setupGame(page, [{ name: 'Alice', score: 501 }]);
    await page.locator('#throw-input').fill('-1');
    await page.locator('#throw-form button[type="submit"]').click();
    await expect(page.locator('#throw-result')).toBeVisible();
    await expect(page.locator('#current-score')).toHaveText('501');
  });
});
