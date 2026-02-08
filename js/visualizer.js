/**
 * Hybrid Audio Visualizer — Particles + Wireframe Icosahedron + Bloom.
 * Single shared AnalyserNode (window.getAudioAnalyser()) drives both particle
 * system and icosahedron. Preserves: Web Audio, Winamp/music library, resize,
 * visibility, RAF. Adds: Icosahedron wireframe, bloom (built-in simple bloom;
 * for UnrealBloomPass include EffectComposer, RenderPass, UnrealBloomPass after
 * three.js), optional dat.GUI, mouse orbit, FPS overlay.
 */
(function () {
  const container = document.getElementById('hero-particles');
  if (!container || typeof THREE === 'undefined') return;

  var scene, camera, renderer, points, icosahedronMesh, analyser;
  var frequencyData, bufferLength, basePositions;
  var particleCount = 25000;
  var inView = true;
  var tabVisible = true;
  var resizeTimer = 0;
  var time = 0;

  var composer = null;
  var bloomPass = null;
  var useBloom = false;

  var mouseX = 0, mouseY = 0;
  var targetCameraX = 0, targetCameraY = 0;
  var cameraAngleX = 0, cameraAngleY = 0;

  var gui = null;
  var sharedUniforms = {
    u_time: { value: 0 },
    u_frequency: { value: 0 },
    u_amplitude: { value: 0 },
    u_red: { value: 1 },
    u_green: { value: 0.4 },
    u_blue: { value: 1 },
    u_mouse: { value: new THREE.Vector2(0, 0) }
  };

  var fpsEl = null;
  var frameCount = 0;
  var lastFpsTime = 0;

  function getAverageEnergy(data, startBin, endBin) {
    if (!data || endBin <= startBin) return 0;
    var sum = 0;
    for (var i = startBin; i < endBin && i < data.length; i++) sum += data[i];
    return sum / (endBin - startBin);
  }

  var IcosahedronVertexShader = [
    'uniform float u_time;',
    'uniform float u_frequency;',
    'uniform float u_amplitude;',
    'varying float vPulse;',
    'void main() {',
    '  vec3 pos = position;',
    '  float d = length(pos);',
    '  float pulse = sin(u_time * 2.0 + d * 3.0) * u_amplitude * 0.15;',
    '  pos += normalize(pos) * pulse;',
    '  vPulse = u_frequency;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);',
    '}'
  ].join('\n');

  var IcosahedronFragmentShader = [
    'uniform float u_red;',
    'uniform float u_green;',
    'uniform float u_blue;',
    'varying float vPulse;',
    'void main() {',
    '  float a = 0.7 + vPulse * 0.3;',
    '  gl_FragColor = vec4(u_red, u_green, u_blue, a);',
    '}'
  ].join('\n');

  function createIcosahedron() {
    var geo = new THREE.IcosahedronGeometry(0.35, 2);
    var wireGeo = new THREE.WireframeGeometry(geo);
    geo.dispose();

    var mat = new THREE.ShaderMaterial({
      uniforms: sharedUniforms,
      vertexShader: IcosahedronVertexShader,
      fragmentShader: IcosahedronFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    var line = new THREE.LineSegments(wireGeo, mat);
    line.rotation.order = 'XYZ';
    return line;
  }

  function initParticles() {
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
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var pts = new THREE.Points(geometry, material);
    return pts;
  }

  function updateParticles(freqData) {
    var bassEnergy = getAverageEnergy(freqData, 0, 10) / 255;
    var midEnergy = getAverageEnergy(freqData, 10, 100) / 255;
    var highEnd = Math.min(256, freqData.length);
    var highEnergy = getAverageEnergy(freqData, 100, highEnd) / 255;

    var pos = points.geometry.attributes.position.array;
    var col = points.geometry.attributes.color.array;

    var r = sharedUniforms.u_red.value;
    var g = sharedUniforms.u_green.value;
    var b = sharedUniforms.u_blue.value;

    for (var i = 0; i < particleCount; i++) {
      var i3 = i * 3;
      var bx = basePositions[i3];
      var by = basePositions[i3 + 1];
      var bz = basePositions[i3 + 2];
      var dist = Math.sqrt(bx * bx + by * by + bz * bz);

      pos[i3] = bx + Math.sin(dist * 0.5 + time) * bassEnergy * 0.15;
      pos[i3 + 1] = by + Math.cos(dist * 0.3 + time * 0.7) * midEnergy * 0.1;
      pos[i3 + 2] = bz + Math.sin(time * 0.5) * highEnergy * 0.08;

      col[i3] = Math.min(1, bassEnergy * 1.5 * r);
      col[i3 + 1] = Math.min(1, midEnergy * 1.2 * g);
      col[i3 + 2] = Math.min(1, highEnergy * 1.2 * b);
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
  }

  function updateIcosahedron(freqData) {
    var bassEnergy = getAverageEnergy(freqData, 0, 10) / 255;
    var midEnergy = getAverageEnergy(freqData, 10, 100) / 255;
    var highEnd = Math.min(256, freqData.length);
    var highEnergy = getAverageEnergy(freqData, 100, highEnd) / 255;

    sharedUniforms.u_time.value = time;
    sharedUniforms.u_frequency.value = (bassEnergy + midEnergy + highEnergy) / 3;
    sharedUniforms.u_amplitude.value = bassEnergy;
    sharedUniforms.u_mouse.value.set(mouseX, mouseY);

    icosahedronMesh.rotation.x = time * 0.1;
    icosahedronMesh.rotation.y = time * 0.15;
  }

  var simpleBloomRT = null;
  var simpleBloomQuad = null;
  var simpleBloomThreshold = 0.5;
  var simpleBloomStrength = 0.5;

  function initSimpleBloom() {
    var w = container.offsetWidth || 1;
    var h = container.offsetHeight || 1;
    simpleBloomRT = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      stencilBuffer: false
    });
    simpleBloomRT.texture.generateMipmaps = false;
    var brightShader = {
      vertexShader: [
        'varying vec2 vUv;',
        'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform float threshold;',
        'uniform float strength;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec4 c = texture2D(tDiffuse, vUv);',
        '  float L = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));',
        '  if (L < threshold) c.rgb = vec3(0.0);',
        '  else c.rgb = c.rgb * strength;',
        '  gl_FragColor = c;',
        '}'
      ].join('\n')
    };
    var brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: simpleBloomThreshold },
        strength: { value: simpleBloomStrength }
      },
      vertexShader: brightShader.vertexShader,
      fragmentShader: brightShader.fragmentShader,
      depthWrite: false
    });
    var quadGeo = new THREE.PlaneBufferGeometry(2, 2);
    simpleBloomQuad = new THREE.Mesh(quadGeo, brightMat);
    simpleBloomQuad.frustumCulled = false;
    var sceneBloom = new THREE.Scene();
    sceneBloom.add(simpleBloomQuad);
    var cameraOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { scene: sceneBloom, camera: cameraOrtho, rt: simpleBloomRT, quad: simpleBloomQuad };
  }

  var simpleBloom = null;

  function renderWithSimpleBloom() {
    var w = container.offsetWidth || 1;
    var h = container.offsetHeight || 1;
    if (!simpleBloom) simpleBloom = initSimpleBloom();
    if (simpleBloom.rt.width !== w || simpleBloom.rt.height !== h) {
      simpleBloom.rt.setSize(w, h);
    }
    renderer.setRenderTarget(simpleBloom.rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(scene, camera);
    simpleBloom.quad.material.uniforms.tDiffuse.value = simpleBloom.rt.texture;
    simpleBloom.quad.material.uniforms.threshold.value = simpleBloomThreshold;
    simpleBloom.quad.material.uniforms.strength.value = simpleBloomStrength;
    simpleBloom.quad.material.blending = THREE.AdditiveBlending;
    simpleBloom.quad.material.depthWrite = false;
    renderer.render(simpleBloom.scene, simpleBloom.camera);
    simpleBloom.quad.material.blending = THREE.NormalBlending;
  }

  function initBloom() {
    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
      var w = container.offsetWidth || 1;
      var h = container.offsetHeight || 1;
      var resolution = new THREE.Vector2(w, h);
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloomPass = new THREE.UnrealBloomPass(resolution, 0.5, 0.8, 0.5);
      composer.addPass(bloomPass);
      if (renderer.toneMapping !== undefined) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;
      }
      return true;
    }
    return false;
  }

  function updateFps() {
    frameCount++;
    var now = performance.now() / 1000;
    if (now - lastFpsTime >= 0.5) {
      var fps = Math.round(frameCount / (now - lastFpsTime));
      if (fpsEl) fpsEl.textContent = fps + ' fps';
      frameCount = 0;
      lastFpsTime = now;
    }
  }

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 2);
    targetCameraX = 0;
    targetCameraY = 0;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    points = initParticles();
    scene.add(points);

    icosahedronMesh = createIcosahedron();
    scene.add(icosahedronMesh);

    useBloom = initBloom();

    if (container) {
      fpsEl = document.createElement('div');
      fpsEl.className = 'viz-fps';
      fpsEl.setAttribute('aria-hidden', 'true');
      fpsEl.textContent = '— fps';
      container.appendChild(fpsEl);
    }

    document.addEventListener('mousemove', function (e) {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      targetCameraX = mouseX * 0.8;
      targetCameraY = mouseY * 0.5;
    });

    if (typeof dat !== 'undefined' && dat.GUI) {
      var guiParams = {
        bloomThreshold: simpleBloomThreshold,
        bloomStrength: simpleBloomStrength
      };
      gui = new dat.GUI({ name: 'Visualizer' });
      gui.add(sharedUniforms.u_red, 'value', 0, 1).name('Red');
      gui.add(sharedUniforms.u_green, 'value', 0, 1).name('Green');
      gui.add(sharedUniforms.u_blue, 'value', 0, 1).name('Blue');
      if (bloomPass) {
        gui.add(bloomPass, 'threshold', 0, 1).name('Bloom threshold');
        gui.add(bloomPass, 'strength', 0, 2).name('Bloom strength');
        gui.add(bloomPass, 'radius', 0, 1).name('Bloom radius');
      } else {
        gui.add(guiParams, 'bloomThreshold', 0, 1).name('Bloom threshold').onChange(function (v) { simpleBloomThreshold = v; });
        gui.add(guiParams, 'bloomStrength', 0, 1.5).name('Bloom strength').onChange(function (v) { simpleBloomStrength = v; });
      }
      var sensFolder = gui.addFolder('Audio sensitivity');
      sensFolder.add(sharedUniforms.u_amplitude, 'value', 0, 1).name('Bass scale');
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
    if (composer) {
      composer.setSize(width, height);
      composer.setPixelRatio(renderer.getPixelRatio());
      if (bloomPass && bloomPass.resolution) {
        bloomPass.resolution.set(width, height);
      }
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    cameraAngleX += (targetCameraX - cameraAngleX) * 0.05;
    cameraAngleY += (targetCameraY - cameraAngleY) * 0.05;
    var dist = 2;
    camera.position.x = Math.sin(cameraAngleX * Math.PI) * dist * 0.3;
    camera.position.y = cameraAngleY * dist * 0.25;
    camera.position.z = dist;
    camera.lookAt(0, 0, 0);

    if (!tabVisible) return;

    if (typeof window.getAudioAnalyser === 'function') {
      analyser = window.getAudioAnalyser();
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        if (!frequencyData) frequencyData = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(frequencyData);
        updateParticles(frequencyData);
        updateIcosahedron(frequencyData);
      }
    } else {
      sharedUniforms.u_time.value = time;
      sharedUniforms.u_frequency.value = 0.2;
      sharedUniforms.u_amplitude.value = 0.1;
      updateIcosahedron(frequencyData || new Uint8Array(256));
    }

    points.rotation.y = time * 0.05;

    if (useBloom && composer) {
      composer.render();
    } else {
      renderWithSimpleBloom();
    }

    updateFps();
  }

  init();
})();
