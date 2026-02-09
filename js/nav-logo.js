/**
 * Nav + loader logo circles — stroke circle animation
 * Draws on navLogo-circle and siteLoader-circle (canvas)
 */
(function () {
  function drawCircle(canvas, options) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var size = options.size || 50;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    var radius = (size / 2) - 2;
    var circumference = 2 * Math.PI * radius;

    function render(progress) {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, radius, -0.5 * Math.PI, (2 - progress) * Math.PI);
      ctx.strokeStyle = options.strokeColor || '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (options.animate) {
      var start = null;
      var duration = options.duration || 1500;
      function step(t) {
        if (!start) start = t;
        var elapsed = t - start;
        var p = Math.min(elapsed / duration, 1);
        render(p);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      render(0);
    }
  }

  var navCircle = document.querySelector('.navLogo-circle');
  if (navCircle) {
    drawCircle(navCircle, { size: 50, strokeColor: '#ffffff' });
  }

  var loaderCircle = document.querySelector('.siteLoader-circle');
  if (loaderCircle) {
    drawCircle(loaderCircle, { size: 50, strokeColor: '#ffffff', animate: true, duration: 1200 });
  }

})();
