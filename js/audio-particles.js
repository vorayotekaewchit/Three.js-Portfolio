/**
 * Audio-reactive particles — curl-noise shader, box/cylinder meshes.
 * Uses shared analyser (window.getAudioAnalyser()).
 *
 * Troubleshooting: set window.AUDIO_PARTICLES_DEBUG = true and open DevTools Console.
 * No npm install needed — uses Three.js from CDN (see index.html).
 */
(function () {
  var DEBUG = typeof window !== "undefined" && window.AUDIO_PARTICLES_DEBUG === true;
  function log() {
    if (DEBUG && console && console.log) console.log.apply(console, ["[audio-particles]"].concat(Array.prototype.slice.call(arguments)));
  }

  var container = document.getElementById("hero-particles");
  if (!container) {
    log("No #hero-particles element — check index.html");
    return;
  }
  if (typeof THREE === "undefined") {
    log("THREE is undefined — ensure Three.js script loads before this file (see index.html)");
    return;
  }
  log("Container found, THREE ok");

  var scene, camera, renderer, holder, particles;
  var frequencyData, timeData, bufferLength;
  var inView = true;
  var tabVisible = true;
  var resizeTimer = 0;
  var beatIntervalId = null;
  var bpmInterval = 1500; // fallback ms per beat (sync to BPM when available)

  // Inline GLSL — Simplex-style noise (Ashima/webgl-noise)
  var vertexShader = [
    "varying float vDistance;",
    "uniform float time;",
    "uniform float offsetSize;",
    "uniform float size;",
    "uniform float offsetGain;",
    "uniform float amplitude;",
    "uniform float frequency;",
    "uniform float maxDistance;",
    "vec3 mod289(vec3 x){ return x-floor(x*(1./289.))*289.; }",
    "vec2 mod289(vec2 x){ return x-floor(x*(1./289.))*289.; }",
    "vec3 permute(vec3 x){ return mod289(((x*34.)+1.)*x); }",
    "float noise(vec2 v){",
    "  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);",
    "  vec2 i=floor(v+dot(v,C.yy));",
    "  vec2 x0=v-i+dot(i,C.xx);",
    "  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);",
    "  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;",
    "  i=mod289(i);",
    "  vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));",
    "  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);",
    "  m=m*m; m=m*m;",
    "  vec3 x=2.*fract(p*C.www)-1.;",
    "  vec3 h=abs(x)-.5; vec3 ox=floor(x+.5); vec3 a0=x-ox;",
    "  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);",
    "  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;",
    "  return 130.*dot(m,g);",
    "}",
    "vec3 curl(float x,float y,float z){",
    "  float eps=1.,eps2=2.*eps; float n1,n2,a,b;",
    "  x+=time*.05; y+=time*.05; z+=time*.05;",
    "  vec3 curl=vec3(0.);",
    "  n1=noise(vec2(x,y+eps)); n2=noise(vec2(x,y-eps)); a=(n1-n2)/eps2;",
    "  n1=noise(vec2(x,z+eps)); n2=noise(vec2(x,z-eps)); b=(n1-n2)/eps2; curl.x=a-b;",
    "  n1=noise(vec2(y,z+eps)); n2=noise(vec2(y,z-eps)); a=(n1-n2)/eps2;",
    "  n1=noise(vec2(x+eps,z)); n2=noise(vec2(x-eps,z)); b=(n1-n2)/eps2; curl.y=a-b;",
    "  n1=noise(vec2(x+eps,y)); n2=noise(vec2(x-eps,y)); a=(n1-n2)/eps2;",
    "  n1=noise(vec2(y+eps,z)); n2=noise(vec2(y-eps,z)); b=(n1-n2)/eps2; curl.z=a-b;",
    "  return curl;",
    "}",
    "void main(){",
    "  vec3 newpos=position;",
    "  vec3 target=position+(normal*.1)+curl(newpos.x*frequency,newpos.y*frequency,newpos.z*frequency)*amplitude;",
    "  float d=length(newpos-target)/maxDistance;",
    "  newpos=mix(position,target,pow(d,4.));",
    "  newpos.z+=sin(time)*(.1*offsetGain);",
    "  vec4 mvPosition=modelViewMatrix*vec4(newpos,1.);",
    "  gl_PointSize=size+(pow(d,3.)*offsetSize)*(1./-mvPosition.z);",
    "  gl_Position=projectionMatrix*mvPosition;",
    "  vDistance=d;",
    "}"
  ].join("\n");

  var fragmentShader = [
    "varying float vDistance;",
    "uniform vec3 startColor;",
    "uniform vec3 endColor;",
    "float circle(in vec2 _st,in float _radius){",
    "  vec2 dist=_st-vec2(.5);",
    "  return 1.-smoothstep(_radius-(_radius*.01),_radius+(_radius*.01),dot(dist,dist)*4.);",
    "}",
    "void main(){",
    "  vec2 uv=vec2(gl_PointCoord.x,1.-gl_PointCoord.y);",
    "  float circ=circle(uv,1.);",
    "  vec3 color=mix(startColor,endColor,vDistance);",
    "  float alpha=circ*vDistance*0.9;",
    "  gl_FragColor=vec4(color,alpha);",
    "}"
  ].join("\n");

  function randInt(low, high) {
    return low + Math.floor(Math.random() * (high - low + 1));
  }
  function randFloat(low, high) {
    return low + Math.random() * (high - low);
  }
  function mapLinear(x, a1, a2, b1, b2) {
    return b1 + (x - a1) * (b2 - b1) / (a2 - a1);
  }
  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  function getFreqBands() {
    var a = window.getAudioAnalyser && window.getAudioAnalyser();
    if (!a || !frequencyData) return { low: 0, mid: 0, high: 0 };
    a.getByteFrequencyData(frequencyData);
    var bl = bufferLength;
    var sr = a.context.sampleRate;
    var lowEnd = Math.floor((250 * bl) / sr);
    var midEnd = Math.floor((2000 * bl) / sr);
    var highEnd = bl - 1;
    function avg(start, end) {
      var sum = 0;
      for (var i = start; i <= end && i < frequencyData.length; i++) sum += frequencyData[i];
      return (sum / (end - start + 1)) / 256;
    }
    return {
      low: avg(0, lowEnd),
      mid: avg(lowEnd, midEnd),
      high: avg(midEnd, highEnd)
    };
  }

  function isPlaying() {
    var a = document.getElementById("global-audio");
    return a && !a.paused && !a.ended;
  }

  function onBeat() {
    if (!particles) return;
    if (Math.random() < 0.3) {
      var dur = 0.2;
      var targetRotY = Math.random() * Math.PI * 2;
      var targetRotZ = Math.random() * Math.PI;
      particles.animateRotation(targetRotY, targetRotZ, dur);
    }
    if (Math.random() < 0.3) particles.resetMesh();
  }

  function ReactiveParticles() {
    this.group = new THREE.Group();
    this.time = 0;
    this.holderObjects = null;
    this.pointsMesh = null;
    this.geometry = null;
    this.material = null;
    this.properties = {
      startColor: 0xff66ff,
      endColor: 0x66ffff,
      autoMix: true,
      autoRotate: true
    };
  }

  ReactiveParticles.prototype.init = function () {
    this.holderObjects = new THREE.Object3D();
    this.group.add(this.holderObjects);
    holder.add(this.group);

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        offsetSize: { value: 3 },
        size: { value: 2.2 },
        frequency: { value: 2 },
        amplitude: { value: 1 },
        offsetGain: { value: 0 },
        maxDistance: { value: 1.8 },
        startColor: { value: new THREE.Color(this.properties.startColor) },
        endColor: { value: new THREE.Color(this.properties.endColor) }
      }
    });
    this.resetMesh();
  };

  ReactiveParticles.prototype.createBoxMesh = function () {
    var w = randInt(5, 20);
    var h = randInt(1, 40);
    var d = randInt(5, 80);
    this.geometry = new THREE.BoxGeometry(1, 1, 1, w, h, d);
    this.material.uniforms.offsetSize.value = randInt(30, 60);

    this.pointsMesh = new THREE.Object3D();
    this.pointsMesh.rotateX(Math.PI / 2);
    this.holderObjects.add(this.pointsMesh);
    var pts = new THREE.Points(this.geometry, this.material);
    this.pointsMesh.add(pts);

    var rotY = randFloat(0, Math.PI * 2);
    var rotZ = randFloat(0, Math.PI);
    this.pointsMesh.rotation.set(rotY, 0, rotZ);
    this.group.position.z = randInt(2, 4);
  };

  ReactiveParticles.prototype.createCylinderMesh = function () {
    var r = randInt(1, 3);
    var h = randInt(1, 5);
    this.geometry = new THREE.CylinderGeometry(1, 1, 4, 64 * r, 64 * h, true);
    this.material.uniforms.offsetSize.value = randInt(30, 60);
    this.material.uniforms.size.value = 2;

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    this.pointsMesh.rotation.set(Math.PI / 2, 0, 0);
    this.holderObjects.add(this.pointsMesh);

    var rotY = Math.random() < 0.2 ? Math.PI / 2 : 0;
    this.holderObjects.rotation.y = rotY;
    this.group.position.z = randInt(2, 4);
  };

  ReactiveParticles.prototype.animateRotation = function (rotY, rotZ, duration) {
    if (!this.holderObjects) return;
    var startY = this.holderObjects.rotation.y;
    var startZ = this.holderObjects.rotation.z;
    var start = performance.now();
    function tick(now) {
      var t = (now - start) / (duration * 1000);
      if (t >= 1) {
        this.holderObjects.rotation.y = rotY;
        this.holderObjects.rotation.z = rotZ;
        return;
      }
      t = 1 - Math.pow(1 - t, 3);
      this.holderObjects.rotation.y = startY + (rotY - startY) * t;
      this.holderObjects.rotation.z = startZ + (rotZ - startZ) * t;
      requestAnimationFrame(tick.bind(this));
    }
    requestAnimationFrame(tick.bind(this));
  };

  ReactiveParticles.prototype.onBPMBeat = function () {
    onBeat();
  };

  ReactiveParticles.prototype.resetMesh = function () {
    this.destroyMesh();
    if (Math.random() < 0.5) this.createCylinderMesh();
    else this.createBoxMesh();
    this.material.uniforms.frequency.value = randFloat(0.5, 3);
  };

  ReactiveParticles.prototype.destroyMesh = function () {
    if (!this.pointsMesh) return;
    this.holderObjects.remove(this.pointsMesh);
    var mesh = this.pointsMesh.children && this.pointsMesh.children[0] ? this.pointsMesh.children[0] : this.pointsMesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
    this.pointsMesh = null;
  };

  ReactiveParticles.prototype.update = function (freq) {
    if (isPlaying() && freq) {
      this.material.uniforms.amplitude.value = 0.8 + mapLinear(freq.high, 0, 0.6, -0.1, 0.2);
      this.material.uniforms.offsetGain.value = freq.mid * 0.6;
      var t = mapLinear(freq.low, 0.6, 1, 0.2, 0.5);
      this.time += clamp(t, 0.2, 0.5);
    } else {
      this.material.uniforms.frequency.value = 0.8;
      this.material.uniforms.amplitude.value = 1;
      this.time += 0.02;
    }
    this.material.uniforms.time.value = this.time;
  };

  function init() {
    try {
      log("init start");
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(70, 1, 0.1, 10000);
      camera.position.z = 8;
      camera.frustumCulled = false;
      scene.add(camera);

      holder = new THREE.Object3D();
      holder.name = "holder";
      scene.add(holder);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      container.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("data-viz", "curl-particles");
      log("Renderer canvas appended to #hero-particles");

      var analyser = window.getAudioAnalyser && window.getAudioAnalyser();
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        frequencyData = new Uint8Array(bufferLength);
        timeData = new Uint8Array(analyser.fftSize);
        log("Analyser connected, bufferLength=" + bufferLength);
      } else {
        log("getAudioAnalyser() not available yet — particles will still animate (no audio reaction)");
      }

      particles = new ReactiveParticles();
      particles.init();
      log("Particles created");

      onResize();
      var w = container.offsetWidth;
      var h = container.offsetHeight;
      log("Container size after first resize: " + w + " x " + h);
      if ((!w || !h) && DEBUG) {
        log("Container has no size yet — will retry on resize/load. Ensure .landingSlideshow has min-height (e.g. 100vh).");
      }
      window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(onResize, 120);
      });
      window.addEventListener("load", function () {
        onResize();
      });
      document.addEventListener("visibilitychange", function () {
        tabVisible = !document.hidden;
      });
      var io = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
      }, { threshold: 0.05, rootMargin: "50px" });
      io.observe(container);

      if (DEBUG) {
        renderer.domElement.style.outline = "2px solid lime";
        renderer.domElement.title = "audio-particles canvas (DEBUG)";
      }
      startBeatTimer();
      animate();
    } catch (e) {
      log("Init error: " + e.message);
      if (console && console.error) console.error("[audio-particles]", e);
    }
  }

  function startBeatTimer() {
    if (beatIntervalId) clearInterval(beatIntervalId);
    beatIntervalId = setInterval(function () {
      onBeat();
    }, bpmInterval);
  }

  function onResize() {
    var w = container.offsetWidth || window.innerWidth;
    var h = container.offsetHeight || window.innerHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  var frameCount = 0;
  function animate() {
    requestAnimationFrame(animate);
    if (!tabVisible) return;
    if (!inView && frameCount > 60) return;

    var w = container.offsetWidth;
    var h = container.offsetHeight;
    if (w && h) {
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) onResize();
      var freq = getFreqBands();
      particles.update(freq);
      renderer.clear();
      renderer.render(scene, camera);
      frameCount++;
      if (DEBUG && frameCount === 1) log("First frame rendered");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
