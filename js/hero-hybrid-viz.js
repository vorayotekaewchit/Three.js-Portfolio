/**
 * Hero: audio-reactive particle sphere.
 * Particles reactive to BEAT (transient detection); color flash + position punch on kicks/hits.
 * Shared analyser: window.getAudioAnalyser().
 */
(function () {
  const container = document.getElementById('hero-particles');
  if (!container || typeof THREE === 'undefined') return;

  var scene, camera, renderer, points, analyser;
  var frequencyData, bufferLength;
  var timeData;
  var basePositions;
  var particleCount = 5000;
  var inView = true;
  var tabVisible = true;
  var resizeTimer = 0;
  var time = 0;

  var smoothLevel = 0;
  var prevPeak = 0;

  var composer, bloomPass, renderPass;
  var useComposer = false;
  var mouseX = 0, mouseY = 0;
  var lookTarget = new THREE.Vector3(0, 0, 0);
  var gui = null;

  function getAverageEnergy(data, startBin, endBin) {
    if (!data || endBin <= startBin) return 0;
    var sum = 0;
    for (var i = startBin; i < endBin && i < data.length; i++) sum += data[i];
    return sum / (endBin - startBin);
  }

  function getAverageFrequencyNormalized(data) {
    if (!data || !data.length) return 0;
    var sum = 0;
    for (var i = 0; i < data.length; i++) sum += data[i];
    return (sum / data.length) / 255;
  }

  function getBeatIntensity(a) {
    if (!a || !timeData || timeData.length === 0) return 0;
    a.getByteTimeDomainData(timeData);
    var sum = 0;
    var peak = 0;
    for (var i = 0; i < timeData.length; i++) {
      var v = Math.abs((timeData[i] - 128) / 128);
      sum += v;
      if (v > peak) peak = v;
    }
    var rms = sum / timeData.length;
    smoothLevel += (rms - smoothLevel) * 0.25;
    var beat = peak > smoothLevel * 1.8 ? Math.min(1, (peak - smoothLevel) * 3) : 0;
    prevPeak = peak;
    return Math.min(1, beat);
  }

  function initPostProcessing() {
    try {
      if (typeof THREE.EffectComposer === 'undefined') return;
      var w = Math.max(300, container.offsetWidth || window.innerWidth);
      var h = Math.max(200, container.offsetHeight || window.innerHeight);
      renderPass = new THREE.RenderPass(scene, camera);
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(renderPass);
      if (typeof THREE.UnrealBloomPass !== 'undefined') {
        bloomPass = new THREE.UnrealBloomPass(
          new THREE.Vector2(w, h), 0.4, 0.8, 0.5
        );
        composer.addPass(bloomPass);
      }
      if (typeof THREE.OutputPass !== 'undefined') {
        composer.addPass(new THREE.OutputPass());
      }
      useComposer = !!composer && composer.passes.length > 0;
    } catch (e) {
      useComposer = false;
    }
  }

  function initGUI() {
    if (typeof lil !== 'undefined' && bloomPass) {
      gui = new lil.GUI({ title: 'Hero Particles' });
      gui.add(bloomPass, 'threshold', 0, 1, 0.01).name('Bloom threshold');
      gui.add(bloomPass, 'strength', 0, 2, 0.01).name('Bloom strength');
      gui.add(bloomPass, 'radius', 0, 1, 0.01).name('Bloom radius');
      gui.close();
    }
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.z = 2;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setClearColor(0x000000, 0);
    if (typeof THREE.ACESFilmicToneMapping !== 'undefined') {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
    }
    container.appendChild(renderer.domElement);

    // ——— Particles (100% preserved) ———
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
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    points = new THREE.Points(geometry, material);
    scene.add(points);

    onResize();
    requestAnimationFrame(function () { onResize(); });
    setTimeout(onResize, 100);
    initPostProcessing();
    initGUI();

    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 120);
    });
    document.addEventListener('visibilitychange', function () {
      tabVisible = !document.hidden;
    });
    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
    }, { threshold: 0.05, rootMargin: '50px' });
    io.observe(container);

    function onMouseMove(e) {
      var rect = container.getBoundingClientRect();
      if (rect.width && rect.height) {
        mouseX = (e.clientX - rect.left) / rect.width * 2 - 1;
        mouseY = -(e.clientY - rect.top) / rect.height * 2 + 1;
      }
    }
    container.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    var heroPlayBtn = document.getElementById('hero-play-btn');
    if (heroPlayBtn && typeof window.getGlobalAudio === 'function') {
      heroPlayBtn.addEventListener('click', function () {
        var audio = window.getGlobalAudio();
        if (audio) audio.play().catch(function () {});
      });
    }

    animate();
  }

  function onResize() {
    if (!renderer) return;
    var width = container.offsetWidth || container.clientWidth;
    var height = container.offsetHeight || container.clientHeight;
    if (!width || !height) {
      width = window.innerWidth;
      height = window.innerHeight;
    }
    width = Math.max(300, width);
    height = Math.max(200, height);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setSize(width, height);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.renderTarget1 && composer.renderTarget1.setSize(width, height);
      composer.renderTarget2 && composer.renderTarget2.setSize(width, height);
      if (bloomPass && bloomPass.resolution) {
        bloomPass.resolution.set(width, height);
      }
    }
  }

  function updateParticles(freqData, averageFreq, beatIntensity) {
    var bassEnergy = getAverageEnergy(freqData, 0, 10) / 255;
    var midEnergy = getAverageEnergy(freqData, 10, 100) / 255;
    var highEnd = Math.min(256, freqData.length);
    var highEnergy = getAverageEnergy(freqData, 100, highEnd) / 255;

    var sphereScale = 1 + averageFreq * 0.25;
    var beatPunch = beatIntensity || 0;
    var pos = points.geometry.attributes.position.array;
    var col = points.geometry.attributes.color.array;

    for (var i = 0; i < particleCount; i++) {
      var i3 = i * 3;
      var bx = basePositions[i3];
      var by = basePositions[i3 + 1];
      var bz = basePositions[i3 + 2];
      var dist = Math.sqrt(bx * bx + by * by + bz * bz);

      var warp = sphereScale;
      var punch = 1 + beatPunch * 0.35;
      pos[i3] = (bx + Math.sin(dist * 0.5 + time) * bassEnergy * 0.15) * warp * punch;
      pos[i3 + 1] = (by + Math.cos(dist * 0.3 + time * 0.7) * midEnergy * 0.1) * warp * punch;
      pos[i3 + 2] = (bz + Math.sin(time * 0.5) * highEnergy * 0.08) * warp * punch;

      var beatFlash = 0.4 + beatPunch * 0.6;
      col[i3] = Math.min(1, 0.15 + bassEnergy * 1.5 * beatFlash);
      col[i3 + 1] = Math.min(1, 0.12 + midEnergy * 1.2 * beatFlash);
      col[i3 + 2] = Math.min(1, 0.2 + highEnergy * 1.2 * beatFlash);
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;
    if (!tabVisible || !inView) return;

    var averageFreq = 0;
    var beatIntensity = 0;
    if (typeof window.getAudioAnalyser === 'function') {
      analyser = window.getAudioAnalyser();
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        if (!frequencyData) frequencyData = new Uint8Array(bufferLength);
        if (!timeData || timeData.length !== analyser.fftSize) {
          timeData = new Uint8Array(analyser.fftSize);
        }
        analyser.getByteFrequencyData(frequencyData);
        averageFreq = getAverageFrequencyNormalized(frequencyData);
        beatIntensity = getBeatIntensity(analyser);
        updateParticles(frequencyData, averageFreq, beatIntensity);
      }
    } else {
      if (!frequencyData) frequencyData = new Uint8Array(256);
      updateParticles(frequencyData, 0, 0);
    }

    points.rotation.y = time * 0.05;

    if (camera) {
      lookTarget.x += (mouseX * 0.4 - lookTarget.x) * 0.05;
      lookTarget.y += (mouseY * 0.4 - lookTarget.y) * 0.05;
      camera.lookAt(lookTarget);
    }

    if (useComposer && composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  init();
})();
