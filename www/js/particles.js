/**
 * Confetti particle effect for match wins.
 * Creates DOM elements that fall via CSS animation, then remove themselves.
 */

const COLOURS = [
  '#00c896', '#f5a623', '#e84040',
  '#4a90d9', '#9b59b6', '#ffffff', '#f0e14b',
];

/**
 * Spawn confetti particles on the page.
 * Each particle removes itself when its CSS animation ends.
 */
export function triggerConfetti() {
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    el.style.left             = `${Math.random() * 100}vw`;
    el.style.top              = `-${8 + Math.random() * 12}px`;
    el.style.backgroundColor  = COLOURS[Math.floor(Math.random() * COLOURS.length)];
    el.style.width            = `${5 + Math.random() * 9}px`;
    el.style.height           = `${5 + Math.random() * 9}px`;
    el.style.animationDuration = `${1.8 + Math.random() * 2.5}s`;
    el.style.animationDelay   = `${Math.random() * 1.8}s`;
    el.style.transform        = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}
