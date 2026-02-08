/**
 * VK Logo Lock Screen — Unlock to Particles Visualizer
 * PBKDF2 password verification, 5 attempts, 5min lockout.
 *
 * CHANGE PASSWORD: Run: node scripts/password-manager.js "YourNewPassword"
 * Paste SALT_B64 and EXPECTED_HASH_B64 below.
 */
(function () {
  var LOCKOUT_KEY = 'portfolio_lockout_until';
  var UNLOCK_KEY = 'portfolio_unlocked';
  var LOCKOUT_DURATION_MS = 5 * 60 * 1000;
  var MAX_ATTEMPTS = 5;
  var PBKDF2_ITERATIONS = 100000;

  var SALT_B64 = 'ztyl2koosFkXb6ZP451QkQ==';
  var EXPECTED_HASH_B64 = 'wyNO4P/B5Sx3zf3vS+itLOs0G/BCSnzFxYipEsbPm9c=';

  function getLockoutUntil() {
    try {
      var v = localStorage.getItem(LOCKOUT_KEY);
      return v ? parseInt(v, 10) : 0;
    } catch (e) { return 0; }
  }

  function setLockoutUntil(ts) {
    try { localStorage.setItem(LOCKOUT_KEY, String(ts)); } catch (e) {}
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === '1';
    } catch (e) { return false; }
  }

  function setUnlocked() {
    try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (e) {}
  }

  function b64ToBuf(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    var out = 0;
    for (var i = 0; i < a.length; i++) out |= a[i] ^ b[i];
    return out === 0;
  }

  function verifyPassword(password) {
    if (!EXPECTED_HASH_B64 || !SALT_B64 || !window.crypto || !crypto.subtle) return Promise.resolve(false);
    var saltBuf = b64ToBuf(SALT_B64);
    var expectedBuf = new Uint8Array(b64ToBuf(EXPECTED_HASH_B64));
    return crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    ).then(function (key) {
      return crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        key,
        256
      );
    }).then(function (bits) {
      return constantTimeEqual(new Uint8Array(bits), expectedBuf);
    }).catch(function () { return false; });
  }

  function shakeInput() {
    var input = document.getElementById('passwordInput');
    if (!input) return;
    input.classList.add('shake');
    setTimeout(function () { input.classList.remove('shake'); }, 400);
  }

  function showPortfolio() {
    var lockScreen = document.getElementById('lockScreen');
    var portfolioContent = document.getElementById('portfolioContent');
    if (lockScreen) lockScreen.style.display = 'none';
    if (portfolioContent) portfolioContent.classList.remove('portfolio-content--locked');
    window.dispatchEvent(new Event('resize'));
    if (typeof window.initParticlesOnUnlock === 'function') {
      window.initParticlesOnUnlock();
    }
  }

  function handleUnlock(e) {
    e.preventDefault();
    var input = document.getElementById('passwordInput');
    var attemptsEl = document.getElementById('attempts');
    if (!input) return;

    var password = input.value;
    input.value = '';

    if (!password) return;

    verifyPassword(password).then(function (ok) {
      if (ok) {
        setUnlocked();
        var lockScreen = document.getElementById('lockScreen');
        if (lockScreen) lockScreen.style.opacity = '0';
        setTimeout(showPortfolio, 500);
      } else {
        shakeInput();
        var attempts = parseInt(attemptsEl.getAttribute('data-attempts') || String(MAX_ATTEMPTS), 10) - 1;
        attemptsEl.setAttribute('data-attempts', String(Math.max(0, attempts)));
        if (attempts <= 0) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
          attemptsEl.textContent = 'Locked for 5 minutes.';
          attemptsEl.classList.add('is-lockout');
          var interval = setInterval(function () {
            var left = Math.ceil((getLockoutUntil() - Date.now()) / 1000);
            if (left <= 0) {
              clearInterval(interval);
              attemptsEl.textContent = MAX_ATTEMPTS + ' attempts remaining';
              attemptsEl.classList.remove('is-lockout');
              attemptsEl.setAttribute('data-attempts', String(MAX_ATTEMPTS));
              return;
            }
            attemptsEl.textContent = 'Try again in ' + left + 's';
          }, 1000);
        } else {
          attemptsEl.textContent = attempts + ' attempt' + (attempts === 1 ? '' : 's') + ' left';
        }
      }
    });
  }

  function initLockScreen() {
    var form = document.querySelector('.lock-form');
    var input = document.getElementById('passwordInput');
    var attemptsEl = document.getElementById('attempts');
    if (!form || !input) return;

    attemptsEl.setAttribute('data-attempts', String(MAX_ATTEMPTS));
    form.addEventListener('submit', handleUnlock);
  }

  function run() {
    if (!EXPECTED_HASH_B64) {
      showPortfolio();
      return;
    }
    if (isUnlocked()) {
      showPortfolio();
      return;
    }

    var until = getLockoutUntil();
    if (Date.now() < until) {
      var attemptsEl = document.getElementById('attempts');
      if (attemptsEl) {
        attemptsEl.textContent = 'Try again in ' + Math.ceil((until - Date.now()) / 1000) + 's';
        attemptsEl.classList.add('is-lockout');
      }
      var interval = setInterval(function () {
        var left = Math.ceil((getLockoutUntil() - Date.now()) / 1000);
        if (left <= 0) {
          clearInterval(interval);
          if (attemptsEl) {
            attemptsEl.textContent = MAX_ATTEMPTS + ' attempts remaining';
            attemptsEl.classList.remove('is-lockout');
          }
          return;
        }
        if (attemptsEl) attemptsEl.textContent = 'Try again in ' + left + 's';
      }, 1000);
    }

    initLockScreen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
