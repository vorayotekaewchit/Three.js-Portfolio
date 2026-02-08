/**
 * Audio-reactive particle system — Three.js sphere, positions and colors
 * driven by frequency bands (bass 0–10, mid 10–100, high 100–255).
 * Uses shared analyser (fftSize 1024) and getAverageEnergy.
 */
(function () {
  const container = document.getElementById('hero-particles');
  if (!container || typeof THREE === 'undefined') return;

  var scene, camera, renderer, points, analyser;
  var frequencyData, bufferLength;
  var basePositions;
  var particleCount = 5000;
  var inView = true;
  var tabVisible = true;
  var resizeTimer = 0;
  var time = 0;

  function getAverageEnergy(data, startBin, endBin) {
    if (!data || endBin <= startBin) return 0;
    var sum = 0;
    for (var i = startBin; i < endBin && i < data.length; i++) sum += data[i];
    return sum / (endBin - startBin);
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.z = 2;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    var geometry = new THREE.BufferGeometry();
    var positions = new Float32Array(particleCount * 3);
    var colors = new Float32Array(particleCount * 3);
    basePositions = new Float32Array(particleCount * 3);

    var radius = 0.8;
    for (var i = 0; i < particleCount; i++) {
      var i3 = i * 3;
      var u = Math.random();
      var v = Math.random();
      var theta = 2 * Math.PI * u;
      var phi = Math.acos(2 * v - 1);

      var x = radius * Math.sin(phi) * Math.cos(theta);
      var y = radius * Math.sin(phi) * Math.sin(theta);
      var z = radius * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      basePositions[i3] = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;

      colors[i3] = Math.random();
      colors[i3 + 1] = Math.random();
      colors[i3 + 2] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    var material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    points = new THREE.Points(geometry, material);
    scene.add(points);

    onResize();
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 120);
    });
    document.addEventListener('visibilitychange', function () { tabVisible = !document.hidden; });
    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
    }, { threshold: 0.05, rootMargin: '50px' });
    io.observe(container);
    animate();
  }

  function onResize() {
    var width = container.offsetWidth;
    var height = container.offsetHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateParticles(freqData) {
    var bassEnergy = getAverageEnergy(freqData, 0, 10) / 255;
    var midEnergy = getAverageEnergy(freqData, 10, 100) / 255;
    var highEnd = Math.min(256, freqData.length);
    var highEnergy = getAverageEnergy(freqData, 100, highEnd) / 255;

    var pos = points.geometry.attributes.position.array;
    var col = points.geometry.attributes.color.array;

    for (var i = 0; i < particleCount; i++) {
      var i3 = i * 3;
      var bx = basePositions[i3];
      var by = basePositions[i3 + 1];
      var bz = basePositions[i3 + 2];
      var dist = Math.sqrt(bx * bx + by * by + bz * bz);

      pos[i3] = bx + Math.sin(dist * 0.5 + time) * bassEnergy * 0.15;
      pos[i3 + 1] = by + Math.cos(dist * 0.3 + time * 0.7) * midEnergy * 0.1;
      pos[i3 + 2] = bz + Math.sin(time * 0.5) * highEnergy * 0.08;

      col[i3] = Math.min(1, bassEnergy * 1.5);
      col[i3 + 1] = Math.min(1, midEnergy * 1.2);
      col[i3 + 2] = Math.min(1, highEnergy * 1.2);
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;
    if (!tabVisible || !inView) return;

    if (typeof window.getAudioAnalyser === 'function') {
      analyser = window.getAudioAnalyser();
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        if (!frequencyData) frequencyData = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(frequencyData);
        updateParticles(frequencyData);
      }
    }

    points.rotation.y = time * 0.05;
    renderer.render(scene, camera);
  }

  init();
})();
