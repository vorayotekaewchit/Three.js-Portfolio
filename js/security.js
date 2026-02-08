/**
 * Portfolio security — lightweight anti-tamper and devtools detection.
 * Cosmetic protection only; source remains recruiter-readable. No encryption.
 */
(function () {
  var DEVTOOLS_THRESHOLD = 160;
  var devtoolsOpen = false;
  var warningShown = false;

  function initAntiTamper() {
    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'F12' ||
          (e.ctrlKey && e.key === 'u') ||
          (e.ctrlKey && e.key === 's') ||
          (e.metaKey && e.key === 's')) {
        e.preventDefault();
        return false;
      }
    });
  }

  function showDevToolsWarning() {
    if (warningShown) return;
    warningShown = true;
    var overlay = document.createElement('div');
    overlay.id = 'portfolio-devtools-warning';
    overlay.setAttribute('aria-live', 'polite');
    overlay.className = 'portfolio-devtools-warning';
    overlay.innerHTML = '<p class="portfolio-devtools-text">Portfolio protected</p>';
    document.body.appendChild(overlay);
    setTimeout(function () {
      if (overlay.parentNode) overlay.classList.add('is-visible');
    }, 10);
  }

  function initDevToolsDetection() {
    window.addEventListener('resize', function () {
      var widthDiff = window.outerWidth - window.innerWidth;
      var heightDiff = window.outerHeight - window.innerHeight;
      if ((widthDiff > DEVTOOLS_THRESHOLD || heightDiff > DEVTOOLS_THRESHOLD) && !devtoolsOpen) {
        devtoolsOpen = true;
        showDevToolsWarning();
      }
    });
  }

  function init() {
    initAntiTamper();
    initDevToolsDetection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
