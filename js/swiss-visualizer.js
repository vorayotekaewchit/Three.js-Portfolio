/**
 * Swiss visualizer — 20×20 grid + oscilloscope waveform.
 * Grid: bass/mid/high bands via getAverageEnergy. Waveform: time-domain line (WaveformVisualizer)
 * sharing the same AnalyserNode. Analyser fftSize 2048 for waveform resolution.
 */
(function () {
  const canvas = document.getElementById('swiss-viz');
  const bassEl = document.querySelector('.viz-bass');
  const midEl = document.querySelector('.viz-mid');
  const highEl = document.querySelector('.viz-high');
  const dropZone = document.getElementById('viz-drop-zone');
  if (!canvas || typeof THREE === 'undefined') return;

  var scene, camera, renderer, mesh, analyser, containerEl;
  var frequencyData, bufferLength;
  var bass = 0, mid = 0, high = 0;
  var geometry, count = 20 * 20;
  var inView = true;
  var tabVisible = true;
  var resizeTimer = 0;
  var waveform = null;
  var lastTime = 0;

  function getAverageEnergy(data, startBin, endBin) {
    if (!data || endBin <= startBin) return 0;
    var sum = 0;
    for (var i = startBin; i < endBin && i < data.length; i++) sum += data[i];
    return sum / (endBin - startBin);
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setClearColor(0x0d0d0d);
  containerEl = canvas.parentElement;
  containerEl.replaceChild(renderer.domElement, canvas);
  var el = renderer.domElement;
  el.id = 'swiss-viz';
  el.className = 'viz-canvas';
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.width = '100%';
  el.style.height = '100%';

    var size = 8;
    geometry = new THREE.BufferGeometry();
    positions = new Float32Array(count * 3);
    var step = size / 19;
    var ox = -size / 2, oy = -size / 2;
    for (var i = 0; i < 20; i++) {
      for (var j = 0; j < 20; j++) {
        var idx = (i * 20 + j) * 3;
        positions[idx] = ox + j * step;
        positions[idx + 1] = oy + i * step;
        positions[idx + 2] = 0;
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.computeBoundingSphere();
    var mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });
    mesh = new THREE.Mesh(geometry, mat);
    scene.add(mesh);

    if (typeof WaveformVisualizer !== 'undefined') {
      waveform = new WaveformVisualizer(scene, {
        numPoints: 2048,
        color: 0xe30613,
        opacity: 0.92,
        smoothing: 0.18,
        scaleY: 1,
        positionZ: 6,
        reactiveColor: true,
        glowLine: true
      });
    }

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

    onResize();
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
    var width = containerEl.offsetWidth;
    var height = containerEl.offsetHeight || 320;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate(time) {
    requestAnimationFrame(animate);
    var deltaTime = lastTime ? (time - lastTime) / 1000 : 0.016;
    lastTime = time;

    if (!tabVisible || !inView) return;
    if (typeof window.getAudioAnalyser === 'function') {
      analyser = window.getAudioAnalyser();
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        if (!frequencyData) frequencyData = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(frequencyData);
        if (waveform) waveform.update(analyser, deltaTime);
        var bAvg = getAverageEnergy(frequencyData, 0, 10);
        var mAvg = getAverageEnergy(frequencyData, 10, 100);
        var highEnd = Math.min(256, bufferLength);
        var hAvg = getAverageEnergy(frequencyData, 100, highEnd);
        bass = Math.min(255, Math.floor(bAvg));
        mid = Math.min(255, Math.floor(mAvg));
        high = Math.min(255, Math.floor(hAvg));
      }
    }
    if (bassEl) bassEl.textContent = String(bass).padStart(3, '0');
    if (midEl) midEl.textContent = String(mid).padStart(3, '0');
    if (highEl) highEl.textContent = String(high).padStart(3, '0');

    var pos = geometry.attributes.position.array;
    var col = geometry.attributes.color.array;
    var bassNorm = bass / 255;
    var midNorm = mid / 255;
    var highNorm = high / 255;
    for (var i = 0; i < 20; i++) {
      for (var j = 0; j < 20; j++) {
        var idx = (i * 20 + j) * 3;
        var third = j / 19;
        var level = third < 0.33 ? bassNorm : (third < 0.66 ? midNorm : highNorm);
        var height = level * 2;
        pos[idx + 2] = height;
        var g = 1 - level * 0.7;
        col[idx] = g; col[idx + 1] = g; col[idx + 2] = g;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    renderer.render(scene, camera);
  }

  init();
})();
