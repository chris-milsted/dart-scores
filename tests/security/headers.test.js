// @vitest-environment node
/**
 * Security tests — HTTP response headers (OWASP A05)
 *
 * Requires the container to be running on localhost:8080.
 * All expected security headers are checked for presence and correct values.
 *
 * Run:
 *   podman run --rm -d -p 8080:8080 --name dart-tracker-test dart-tracker:latest
 *   npm run test:security
 *   podman stop dart-tracker-test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';

const BASE_URL = process.env.APP_URL ?? 'http://localhost:8080';

let indexHeaders;
let gameHeaders;
let jsHeaders;
let cssHeaders;

beforeAll(async () => {
  try {
    const [indexRes, gameRes, jsRes, cssRes] = await Promise.all([
      axios.get(`${BASE_URL}/index.html`, { validateStatus: null }),
      axios.get(`${BASE_URL}/game.html`,  { validateStatus: null }),
      axios.get(`${BASE_URL}/js/checkout.js`, { validateStatus: null }),
      axios.get(`${BASE_URL}/css/style.css`,  { validateStatus: null }),
    ]);
    indexHeaders = indexRes.headers;
    gameHeaders  = gameRes.headers;
    jsHeaders    = jsRes.headers;
    cssHeaders   = cssRes.headers;
  } catch (err) {
    throw new Error(
      `Cannot connect to ${BASE_URL}. Start the container first:\n` +
      `  podman run --rm -d -p 8080:8080 --name dart-tracker-test dart-tracker:latest\n` +
      `Original error: ${err.message}`
    );
  }
});

// ---------------------------------------------------------------------------
// Content-Security-Policy
// ---------------------------------------------------------------------------

describe('Content-Security-Policy header', () => {
  it('is present on index.html', () => {
    expect(indexHeaders['content-security-policy']).toBeTruthy();
  });

  it('contains default-src \'self\'', () => {
    const csp = indexHeaders['content-security-policy'];
    expect(csp).toMatch(/default-src\s+'self'/);
  });

  it('contains script-src \'self\' (no unsafe-inline, no CDNs)', () => {
    const csp = indexHeaders['content-security-policy'];
    expect(csp).toMatch(/script-src\s+'self'/);
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('contains frame-ancestors \'none\'', () => {
    const csp = indexHeaders['content-security-policy'];
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
  });

  it('is also present on game.html', () => {
    expect(gameHeaders['content-security-policy']).toBeTruthy();
  });

  it('is present on JS assets', () => {
    expect(jsHeaders['content-security-policy']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// X-Frame-Options
// ---------------------------------------------------------------------------

describe('X-Frame-Options header', () => {
  it('is DENY on index.html', () => {
    expect(indexHeaders['x-frame-options']).toBe('DENY');
  });

  it('is DENY on game.html', () => {
    expect(gameHeaders['x-frame-options']).toBe('DENY');
  });
});

// ---------------------------------------------------------------------------
// X-Content-Type-Options
// ---------------------------------------------------------------------------

describe('X-Content-Type-Options header', () => {
  it('is nosniff on HTML pages', () => {
    expect(indexHeaders['x-content-type-options']).toBe('nosniff');
    expect(gameHeaders['x-content-type-options']).toBe('nosniff');
  });

  it('is nosniff on JS assets', () => {
    expect(jsHeaders['x-content-type-options']).toBe('nosniff');
  });
});

// ---------------------------------------------------------------------------
// Referrer-Policy
// ---------------------------------------------------------------------------

describe('Referrer-Policy header', () => {
  it('is no-referrer on HTML pages', () => {
    expect(indexHeaders['referrer-policy']).toBe('no-referrer');
    expect(gameHeaders['referrer-policy']).toBe('no-referrer');
  });
});

// ---------------------------------------------------------------------------
// Permissions-Policy
// ---------------------------------------------------------------------------

describe('Permissions-Policy header', () => {
  it('is present and denies geolocation', () => {
    const pp = indexHeaders['permissions-policy'];
    expect(pp).toBeTruthy();
    expect(pp).toContain('geolocation=()');
  });

  it('denies microphone and camera', () => {
    const pp = indexHeaders['permissions-policy'];
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('camera=()');
  });
});

// ---------------------------------------------------------------------------
// Server version disclosure (OWASP A05)
// ---------------------------------------------------------------------------

describe('Server version disclosure', () => {
  it('Server header does not reveal nginx version', () => {
    const server = indexHeaders['server'] ?? '';
    // server_tokens off — should be absent or just "nginx" without a version
    expect(server).not.toMatch(/nginx\/\d/);
  });

  it('X-Powered-By header is absent', () => {
    expect(indexHeaders['x-powered-by']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cache-Control for HTML (OWASP A02 / A05)
// ---------------------------------------------------------------------------

describe('Cache-Control for HTML pages', () => {
  it('index.html has no-store', () => {
    const cc = indexHeaders['cache-control'];
    expect(cc).toBeTruthy();
    expect(cc).toContain('no-store');
  });

  it('game.html has no-store', () => {
    const cc = gameHeaders['cache-control'];
    expect(cc).toContain('no-store');
  });
});

// ---------------------------------------------------------------------------
// Method restrictions (OWASP A05)
// ---------------------------------------------------------------------------

describe('HTTP method restrictions', () => {
  // limit_except GET HEAD { deny all } returns 403 Forbidden for other methods
  it('POST is rejected (403)', async () => {
    const res = await axios.post(`${BASE_URL}/index.html`, {}, { validateStatus: null });
    expect([403, 405]).toContain(res.status);
  });

  it('PUT is rejected (403)', async () => {
    const res = await axios.put(`${BASE_URL}/index.html`, {}, { validateStatus: null });
    expect([403, 405]).toContain(res.status);
  });

  it('DELETE is rejected (403)', async () => {
    const res = await axios.delete(`${BASE_URL}/index.html`, { validateStatus: null });
    expect([403, 405]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Directory listing disabled (OWASP A05)
// ---------------------------------------------------------------------------

describe('Directory listing', () => {
  it('/css/ does not expose a directory listing', async () => {
    const res = await axios.get(`${BASE_URL}/css/`, { validateStatus: null });
    // Should be 403 or 404, and the body must NOT look like a directory index
    expect([403, 404]).toContain(res.status);
    expect(res.data).not.toMatch(/<title>Index of/i);
  });

  it('/js/ does not expose a directory listing', async () => {
    const res = await axios.get(`${BASE_URL}/js/`, { validateStatus: null });
    expect([403, 404]).toContain(res.status);
  });
});
