/**
 * Pulse-style audio visualizer — inspired by https://github.com/Audio-Solutions/pulse-visualizer
 * Oscilloscope (time-domain) + FFT spectrum bars. Same AnalyserNode, 2D canvas, no Three.js.
 * Keeps BASS/MID/HIGH readouts and drop zone; works with existing Winamp controls.
 */
(function () {
  var canvas = document.getElementById('swiss-viz');
  var bassEl = document.querySelector('.viz-bass');
  var midEl = document.querySelector('.viz-mid');
  var highEl = document.querySelector('.viz-high');
  var dropZone = document.getElementById('viz-drop-zone');
  if (!canvas) return;

  var ctx = null;
  var containerEl = canvas.parentElement;
  var analyser = null;
  var frequencyData = null;
  var timeData = null;
  var bufferLength = 0;
  var fftSize = 0;
  var bass = 0, mid = 0, high = 0;
  var lastBass = -1, lastMid = -1, lastHigh = -1;
  var inView = true;
  var tabVisible = true;
  var resizeTimer = 0;
  var dpr = 1;
  var width = 0, height = 0;
  var barCount = 64;
  var barStep = 0;
  var barW = 0;

  function getAverageEnergy(data, startBin, endBin) {
    if (!data || endBin <= startBin) return 0;
    var sum = 0;
    for (var i = startBin; i < endBin && i < data.length; i++) sum += data[i];
    return sum / (endBin - startBin);
  }

  function init() {
    if (!canvas || !containerEl) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    onResize();
    if (dropZone) {
      dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('is-dragover');
      });
      dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('is-dragover');
      });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('is-dragover');
        var file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/') && typeof window.loadAudioFile === 'function') {
          window.loadAudioFile(file);
        }
      });
    }
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 120);
    });
    document.addEventListener('visibilitychange', function () { tabVisible = !document.hidden; });
    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
    }, { threshold: 0.05, rootMargin: '50px' });
    io.observe(containerEl);
    animate();
  }

  function onResize() {
    if (!containerEl) return;
    var w = containerEl.offsetWidth;
    var h = containerEl.offsetHeight || 320;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = w;
    height = h;
    barStep = 0;
    barW = 0;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function drawOscilloscope() {
    if (!analyser || !timeData || !ctx || timeData.length < 2) return;
    analyser.getByteTimeDomainData(timeData);
    var halfH = height / 2;
    var midY = halfH * 0.5;
    var scaleY = (halfH * 0.45) / 128;
    var step = width / Math.max(1, timeData.length - 1);
    ctx.beginPath();
    for (var i = 0; i < timeData.length; i++) {
      var x = i * step;
      var y = midY - (timeData[i] - 128) * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(227, 6, 19, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawSpectrum() {
    if (!analyser || !frequencyData || !ctx) return;
    analyser.getByteFrequencyData(frequencyData);
    var halfH = height / 2;
    var top = halfH;
    var barH = halfH;
    var step = barStep || Math.max(1, Math.floor(bufferLength / barCount));
    var w = barW || Math.max(1, width / barCount - 1);
    var barWidthPx = width / barCount;
    for (var i = 0; i < barCount; i++) {
      var sum = 0;
      var start = i * step;
      for (var k = 0; k < step && start + k < bufferLength; k++) sum += frequencyData[start + k];
      var val = step > 0 ? sum / step / 255 : 0;
      var x = i * barWidthPx;
      var h = Math.max(2, val * barH * 0.95);
      ctx.fillStyle = 'rgba(227, 6, 19, 0.5)';
      ctx.fillRect(x, top + barH, w, -h);
      ctx.fillStyle = 'rgba(227, 6, 19, 0.85)';
      ctx.fillRect(x, top + barH - h, w, h * 0.6);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!tabVisible || !inView || !ctx || width <= 0 || height <= 0) return;

    if (typeof window.getAudioAnalyser === 'function') {
      analyser = window.getAudioAnalyser();
      if (analyser) {
        fftSize = analyser.fftSize;
        bufferLength = analyser.frequencyBinCount;
        if (!frequencyData || frequencyData.length !== bufferLength) {
          frequencyData = new Uint8Array(bufferLength);
        }
        if (!timeData || timeData.length !== fftSize) {
          timeData = new Uint8Array(fftSize);
        }
        if (!barStep || barStep === 0) barStep = Math.max(1, Math.floor(bufferLength / barCount));
        barW = Math.max(1, width / barCount - 1);
        analyser.getByteFrequencyData(frequencyData);
        var bAvg = getAverageEnergy(frequencyData, 0, 10);
        var mAvg = getAverageEnergy(frequencyData, 10, 100);
        var highEnd = Math.min(256, bufferLength);
        var hAvg = getAverageEnergy(frequencyData, 100, highEnd);
        bass = Math.min(255, Math.floor(bAvg));
        mid = Math.min(255, Math.floor(mAvg));
        high = Math.min(255, Math.floor(hAvg));
      }
    }

    if (bassEl && bass !== lastBass) { lastBass = bass; bassEl.textContent = String(bass).padStart(3, '0'); }
    if (midEl && mid !== lastMid) { lastMid = mid; midEl.textContent = String(mid).padStart(3, '0'); }
    if (highEl && high !== lastHigh) { lastHigh = high; highEl.textContent = String(high).padStart(3, '0'); }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, width, height);

    drawOscilloscope();
    drawSpectrum();

    var midY = height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
  }

  init();
})();
