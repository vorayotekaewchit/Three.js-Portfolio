/**
 * Portfolio password gate — PBKDF2 verification, 5-attempt lockout.
 * No plaintext passwords; verifier derived client-side. Recruiter-safe (readable source).
 */
(function () {
  var LOCKOUT_KEY = 'portfolio_lockout_until';
  var UNLOCK_KEY = 'portfolio_unlocked';
  var LOCKOUT_DURATION_MS = 5 * 60 * 1000;
  var MAX_ATTEMPTS = 5;
  var PBKDF2_ITERATIONS = 100000;
  var SALT_B64 = 'QxHNCSDJ9v/OaFLxbiTB1w==';
  var EXPECTED_HASH_B64 = 'P1Hj0Fk+e8RNXp4UD6zhCfMuNCbqKyKxMwvNDICG1Qo=';

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
      var v = sessionStorage.getItem(UNLOCK_KEY);
      return v === '1';
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

  function bufToB64(buf) {
    var binary = '';
    for (var i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return btoa(binary);
  }

  function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    var out = 0;
    for (var i = 0; i < a.length; i++) out |= a[i] ^ b[i];
    return out === 0;
  }

  function deriveKey(password, saltBuf) {
    return crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    ).then(function (key) {
      return crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBuf,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        key,
        256
      );
    });
  }

  function verifyPassword(password) {
    if (!EXPECTED_HASH_B64 || !SALT_B64 || !window.crypto || !crypto.subtle) return Promise.resolve(false);
    var saltBuf = b64ToBuf(SALT_B64);
    var expectedBuf = new Uint8Array(b64ToBuf(EXPECTED_HASH_B64));
    return deriveKey(password, saltBuf).then(function (bits) {
      var derived = new Uint8Array(bits);
      return constantTimeEqual(derived, expectedBuf);
    }).catch(function () { return false; });
  }

  function showLockScreen() {
    var overlay = document.getElementById('portfolio-lock-overlay');
    if (overlay) overlay.classList.add('is-visible');
  }

  function hideLockScreen() {
    var overlay = document.getElementById('portfolio-lock-overlay');
    if (overlay) overlay.classList.remove('is-visible');
  }

  function setMessage(msg, isError) {
    var el = document.getElementById('portfolio-lock-message');
    if (el) {
      el.textContent = msg;
      el.className = 'portfolio-lock-message' + (isError ? ' is-error' : '');
    }
  }

  function setLockoutCountdown(secondsLeft) {
    var el = document.getElementById('portfolio-lock-message');
    if (el) el.textContent = 'Too many attempts. Try again in ' + secondsLeft + 's.';
  }

  function initLockScreen() {
    var overlay = document.getElementById('portfolio-lock-overlay');
    var input = document.getElementById('portfolio-lock-input');
    var btn = document.getElementById('portfolio-lock-submit');
    if (!overlay || !input) return;

    var attempts = 0;

    function tryUnlock() {
      var password = (input && input.value) || '';
      input.value = '';
      if (!password) {
        setMessage('Enter access code', true);
        return;
      }
      verifyPassword(password).then(function (ok) {
        if (ok) {
          setUnlocked();
          setMessage('Access granted', false);
          hideLockScreen();
        } else {
          attempts++;
          setMessage('Incorrect. Attempts: ' + attempts + '/' + MAX_ATTEMPTS, true);
          if (attempts >= MAX_ATTEMPTS) {
            setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
            attempts = 0;
            setMessage('Locked for 5 minutes.', true);
            var interval = setInterval(function () {
              var left = Math.ceil((getLockoutUntil() - Date.now()) / 1000);
              if (left <= 0) {
                clearInterval(interval);
                setMessage('You can try again.', false);
                return;
              }
              setLockoutCountdown(left);
            }, 1000);
          }
        }
      });
    }

    if (btn) btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tryUnlock();
    });
  }

  function checkLockout() {
    var until = getLockoutUntil();
    if (Date.now() < until) {
      showLockScreen();
      setMessage('Too many attempts. Try again in ' + Math.ceil((until - Date.now()) / 1000) + 's.', true);
      return true;
    }
    return false;
  }

  function run() {
    if (!EXPECTED_HASH_B64) {
      hideLockScreen();
      return;
    }
    if (isUnlocked()) {
      hideLockScreen();
      return;
    }
    if (checkLockout()) {
      initLockScreen();
      return;
    }
    showLockScreen();
    initLockScreen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
