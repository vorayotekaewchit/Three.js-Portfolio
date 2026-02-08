/**
 * Hero — background cycle (CSS), subtle parallax on scroll (throttled)
 */
(function () {
  var layers = document.querySelectorAll('.hero-bg-layer');
  if (!layers.length) return;

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY * 0.05;
      for (var i = 0; i < layers.length; i++) {
        layers[i].style.transform = 'translate3d(0,' + y + 'px,0)';
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();
