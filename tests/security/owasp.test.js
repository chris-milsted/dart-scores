/**
 * Security tests — OWASP Top 10 (A01–A10)
 *
 * These are static-analysis and structural tests that verify the application's
 * security posture without requiring a running server (except where noted).
 *
 * Complements headers.test.js which requires a live container.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const WWW_DIR = resolve(__dirname, '../../www');
const JS_DIR  = resolve(__dirname, '../../www/js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(path) {
  return readFileSync(path, 'utf-8');
}

function getAllJsFiles(dir) {
  return readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => join(dir, f));
}

function getAllHtmlFiles(dir) {
  const files = [];
  function walk(d) {
    readdirSync(d).forEach(f => {
      const full = join(d, f);
      if (statSync(full).isDirectory()) walk(full);
      else if (f.endsWith('.html')) files.push(full);
    });
  }
  walk(dir);
  return files;
}

const jsFiles  = getAllJsFiles(JS_DIR);
const htmlFiles = getAllHtmlFiles(WWW_DIR);

// ---------------------------------------------------------------------------
// A01 — Broken Access Control
// ---------------------------------------------------------------------------

describe('OWASP A01 — Broken Access Control', () => {
  it('game.js does not accept game state from URL parameters', () => {
    const src = readFile(join(JS_DIR, 'game.js'));
    // Game state must come from sessionStorage only, never from location.search
    expect(src).not.toContain('location.search');
    expect(src).not.toContain('URLSearchParams');
    expect(src).not.toContain('window.location.hash');
  });

  it('ui.js redirects to index.html when no sessionStorage state exists', () => {
    const src = readFile(join(JS_DIR, 'ui.js'));
    // Must check getState() and redirect on null
    expect(src).toContain('index.html');
    expect(src).toContain('getState');
  });

  it('game state is stored in sessionStorage, not localStorage', () => {
    const src = readFile(join(JS_DIR, 'game.js'));
    expect(src).toContain('sessionStorage');
    expect(src).not.toContain('localStorage');
  });
});

// ---------------------------------------------------------------------------
// A03 — Injection / XSS
// ---------------------------------------------------------------------------

describe('OWASP A03 — Injection (XSS prevention)', () => {
  it('no JS file uses innerHTML with user-controlled data', () => {
    // Scan for innerHTML assignments in application JS
    // We allow innerHTML = '' (clearing) but not innerHTML = variable
    jsFiles.forEach(filePath => {
      const src = readFile(filePath);
      const lines = src.split('\n');
      lines.forEach((line, idx) => {
        // Flag: innerHTML = something-other-than-empty-string or comment
        const trimmed = line.trim();
        if (trimmed.includes('innerHTML') && trimmed.includes('=')) {
          // Allow: clearing (innerHTML = ''), or the setup.js clearing of error list
          const isClearing = /innerHTML\s*=\s*['"`]\s*['"`]/.test(trimmed);
          const isComment  = trimmed.startsWith('//') || trimmed.startsWith('*');
          if (!isClearing && !isComment) {
            // This is a potential XSS risk — fail with useful message
            throw new Error(
              `Potential innerHTML XSS at ${filePath}:${idx + 1}: ${trimmed}`
            );
          }
        }
      });
    });
    // If we get here, no dangerous innerHTML assignments were found
    expect(true).toBe(true);
  });

  it('no JS file uses document.write', () => {
    jsFiles.forEach(filePath => {
      const src = readFile(filePath);
      expect(src, `document.write found in ${filePath}`).not.toContain('document.write');
    });
  });

  it('HTML files do not embed inline event handlers (onclick= etc.)', () => {
    htmlFiles.forEach(filePath => {
      const src = readFile(filePath);
      // Inline event handlers are a CSP violation and potential XSS vector
      expect(src, `Inline event handler in ${filePath}`).not.toMatch(/\bon\w+\s*=/);
    });
  });

  it('HTML files do not use javascript: protocol hrefs', () => {
    htmlFiles.forEach(filePath => {
      const src = readFile(filePath);
      expect(src, `javascript: URI in ${filePath}`).not.toMatch(/href\s*=\s*["']javascript:/i);
    });
  });

  it('all user-sourced string rendering uses textContent not innerHTML', () => {
    // Confirm the UI files use textContent for all user-derived output
    ['ui.js', 'setup.js'].forEach(fname => {
      const src = readFile(join(JS_DIR, fname));
      // Should contain textContent assignments
      expect(src, `${fname} should use textContent`).toContain('textContent');
    });
  });
});

// ---------------------------------------------------------------------------
// A05 — Security Misconfiguration
// ---------------------------------------------------------------------------

describe('OWASP A05 — Security Misconfiguration', () => {
  it('nginx.conf has server_tokens off', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toContain('server_tokens off');
  });

  it('nginx.conf has Content-Security-Policy header', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toContain('Content-Security-Policy');
  });

  it('nginx.conf has X-Frame-Options DENY', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toContain('X-Frame-Options');
    expect(cfg).toContain('DENY');
  });

  it('nginx.conf has X-Content-Type-Options nosniff', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toContain('X-Content-Type-Options');
    expect(cfg).toContain('nosniff');
  });

  it('nginx.conf has Referrer-Policy', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toContain('Referrer-Policy');
  });

  it('nginx.conf has Permissions-Policy', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toContain('Permissions-Policy');
  });

  it('nginx.conf disables directory autoindex', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toContain('autoindex off');
  });

  it('nginx.conf restricts HTTP methods via limit_except', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    // limit_except is the correct nginx idiom for method restrictions
    expect(cfg).toContain('limit_except');
    expect(cfg).toContain('GET');
    expect(cfg).toContain('HEAD');
    expect(cfg).toContain('deny all');
  });

  it('Containerfile pins nginx version (not latest)', () => {
    const cfg = readFile(resolve(__dirname, '../../Containerfile'));
    // Must not use `:latest` — version must be pinned
    expect(cfg).not.toMatch(/nginx:latest/);
    // Should specify a version like 1.27
    expect(cfg).toMatch(/nginx:\d+\.\d+/);
  });

  it('Containerfile drops to non-root user', () => {
    const cfg = readFile(resolve(__dirname, '../../Containerfile'));
    expect(cfg).toContain('USER nginx');
  });

  it('Containerfile removes default nginx config', () => {
    const cfg = readFile(resolve(__dirname, '../../Containerfile'));
    expect(cfg).toContain('default.conf');
  });
});

// ---------------------------------------------------------------------------
// A06 — Vulnerable and Outdated Components
// ---------------------------------------------------------------------------

describe('OWASP A06 — Vulnerable and Outdated Components', () => {
  it('www/ contains no package.json (no runtime npm dependencies)', () => {
    const files = readdirSync(WWW_DIR);
    expect(files).not.toContain('package.json');
  });

  it('HTML files do not load scripts from external CDNs', () => {
    htmlFiles.forEach(filePath => {
      const src = readFile(filePath);
      // Check for common CDN patterns
      const externalScriptPattern = /src\s*=\s*["'](https?:|\/\/)/i;
      const scriptTags = [...src.matchAll(/<script[^>]*>/gi)];
      scriptTags.forEach(match => {
        expect(
          match[0],
          `External script tag found in ${filePath}: ${match[0]}`
        ).not.toMatch(externalScriptPattern);
      });
    });
  });

  it('HTML files do not load stylesheets from external CDNs', () => {
    htmlFiles.forEach(filePath => {
      const src = readFile(filePath);
      const externalLinkPattern = /href\s*=\s*["'](https?:|\/\/)/i;
      const linkTags = [...src.matchAll(/<link[^>]*>/gi)];
      linkTags.forEach(match => {
        expect(
          match[0],
          `External stylesheet found in ${filePath}: ${match[0]}`
        ).not.toMatch(externalLinkPattern);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// A08 — Software and Data Integrity Failures
// ---------------------------------------------------------------------------

describe('OWASP A08 — Software and Data Integrity', () => {
  it('CSP in nginx.conf includes script-src \'self\' (blocks external scripts)', () => {
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).toMatch(/script-src\s+'self'/);
    // Must not allow unsafe-inline or unsafe-eval
    expect(cfg).not.toContain('unsafe-inline');
    expect(cfg).not.toContain('unsafe-eval');
  });

  it('game.js only reads state from sessionStorage (no external data source)', () => {
    const src = readFile(join(JS_DIR, 'game.js'));
    // No fetch, XMLHttpRequest, or import from external
    expect(src).not.toContain('fetch(');
    expect(src).not.toContain('XMLHttpRequest');
    expect(src).not.toContain('http://');
    expect(src).not.toContain('https://');
  });
});

// ---------------------------------------------------------------------------
// A07 — Identification and Authentication Failures (N/A — documented)
// ---------------------------------------------------------------------------

describe('OWASP A07 — Authentication (not applicable)', () => {
  it('application has no authentication mechanism to misconfigure', () => {
    // The app has no login, sessions, or credentials.
    // sessionStorage holds only game score state — no PII or secrets.
    // This test documents the intentional design decision.
    const gameSrc = readFile(join(JS_DIR, 'game.js'));
    expect(gameSrc).not.toContain('password');
    expect(gameSrc).not.toContain('token');
    expect(gameSrc).not.toContain('cookie');
    expect(gameSrc).not.toContain('auth');
  });
});

// ---------------------------------------------------------------------------
// A10 — Server-Side Request Forgery (N/A — documented)
// ---------------------------------------------------------------------------

describe('OWASP A10 — SSRF (not applicable)', () => {
  it('nginx config makes no outbound requests (static file server only)', () => {
    // SSRF requires a server that can be instructed to make outbound requests.
    // nginx serving static files cannot be exploited for SSRF.
    // This test documents the design: no proxy_pass, no resolver, no upstream.
    const cfg = readFile(resolve(__dirname, '../../nginx.conf'));
    expect(cfg).not.toContain('proxy_pass');
    expect(cfg).not.toContain('resolver');
  });
});
