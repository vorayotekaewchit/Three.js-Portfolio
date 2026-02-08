/**
 * WaveformVisualizer — Real-time oscilloscope-style line from AnalyserNode time-domain data.
 * Uses THREE.Line with dynamic BufferGeometry; vertex positions updated each frame with
 * getByteTimeDomainData and optional smoothing (lerp). Shares the same AnalyserNode as
 * other visualizers (frequency grid, particles). Designed for minimal performance impact.
 *
 * Usage:
 *   var waveform = new WaveformVisualizer(scene, { color: 0xe30613, smoothing: 0.2 });
 *   // In your animate loop:
 *   waveform.update(analyser, deltaTime);
 */

(function (global) {
  'use strict';

  var THREE = global.THREE;
  if (!THREE) return;

  /**
   * Linear interpolation.
   * @param {number} a - Start value
   * @param {number} b - End value
   * @param {number} t - Factor 0..1
   * @returns {number}
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Clamp value between min and max.
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * WaveformVisualizer — Oscilloscope-style line driven by AnalyserNode time-domain data.
   *
   * @param {THREE.Scene} scene - Three.js scene to add the line to
   * @param {Object} options - Configuration
   * @param {number} [options.numPoints=2048] - Number of waveform vertices (should match analyser.fftSize)
   * @param {number} [options.color=0xe30613] - Line color (hex)
   * @param {number} [options.opacity=0.9] - Line opacity 0..1
   * @param {number} [options.smoothing=0.18] - Lerp factor per frame (higher = snappier, lower = smoother)
   * @param {number} [options.scaleY=1] - Amplitude scale (time-domain 0–255 mapped to -scaleY..+scaleY)
   * @param {number} [options.positionZ=6] - Z position in scene (in front of grid)
   * @param {boolean} [options.reactiveColor=false] - If true, tint line by bass/mid energy
   * @param {boolean} [options.glowLine=false] - Add a second additive line for glow (vaporwave style)
   */
  function WaveformVisualizer(scene, options) {
    this.scene = scene;
    this.options = options || {};
    this.numPoints = this.options.numPoints || 2048;
    this.color = this.options.color !== undefined ? this.options.color : 0xe30613;
    this.opacity = clamp(this.options.opacity !== undefined ? this.options.opacity : 0.9, 0, 1);
    this.smoothing = clamp(this.options.smoothing !== undefined ? this.options.smoothing : 0.18, 0.01, 1);
    this.scaleY = this.options.scaleY !== undefined ? this.options.scaleY : 1;
    this.positionZ = this.options.positionZ !== undefined ? this.options.positionZ : 6;
    this.reactiveColor = !!this.options.reactiveColor;
    this.glowLine = !!this.options.glowLine;

    // Time-domain data array (reused each frame; length = fftSize)
    this.timeData = null;
    // Current smoothed positions (x, y, z per vertex) — we lerp toward target
    this.currentPositions = new Float32Array(this.numPoints * 3);
    // Reusable target positions (avoid GC)
    this.targetPositions = new Float32Array(this.numPoints * 3);

    this.mesh = null;
    this.glowMesh = null;
    this.geometry = null;
    this._initialized = false;
    this._lastFftSize = 0;

    this._buildGeometry();
    this._buildLine();
    if (this.glowLine) this._buildGlowLine();
    scene.add(this.mesh);
    if (this.glowMesh) scene.add(this.glowMesh);
    this._initialized = true;
  }

  /**
   * Create BufferGeometry with one vertex per waveform sample.
   * X: -1 to 1 (normalized), Y: 0 (updated each frame), Z: 0.
   * Memory is reused; we never recreate the geometry.
   */
  WaveformVisualizer.prototype._buildGeometry = function () {
    var numPoints = this.numPoints;
    var positions = new Float32Array(numPoints * 3);
    var n = numPoints - 1;
    for (var i = 0; i < numPoints; i++) {
      var i3 = i * 3;
      positions[i3] = (i / n) * 2 - 1; // X: -1 .. 1
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setDrawRange(0, numPoints);
    this.currentPositions.set(positions);
    this.targetPositions.set(positions);
  };

  /**
   * Build the main line mesh (THREE.Line).
   */
  WaveformVisualizer.prototype._buildLine = function () {
    var material = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: this.opacity,
      linewidth: 1
    });
    this.mesh = new THREE.Line(this.geometry, material);
    this.mesh.position.set(0, 0, this.positionZ);
    this.mesh.frustumCulled = false;
  };

  /**
   * Optional second line with additive blending for glow (vaporwave-style).
   */
  WaveformVisualizer.prototype._buildGlowLine = function () {
    var glowGeom = this.geometry.clone();
    var glowMat = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.glowMesh = new THREE.Line(glowGeom, glowMat);
    this.glowMesh.position.set(0, 0, this.positionZ + 0.01);
    this.glowMesh.frustumCulled = false;
  };

  /**
   * Ensure time-domain buffer length matches analyser.fftSize.
   * If fftSize changed (e.g. 1024 → 2048), we keep using existing geometry size
   * and sample the data (or skip extra points). For simplicity we don't resize geometry
   * at runtime; we use min(fftSize, numPoints) so 1024 analyser works with 2048-point geometry.
   */
  WaveformVisualizer.prototype._ensureTimeData = function (fftSize) {
    var len = fftSize;
    if (!this.timeData || this.timeData.length !== len) {
      this.timeData = new Uint8Array(len);
    }
    return this.timeData;
  };

  /**
   * Map time-domain byte (0–255) to normalized Y in [-scaleY, +scaleY].
   * Center at 128 for symmetry.
   */
  WaveformVisualizer.prototype._sampleToY = function (byte) {
    return ((byte / 255) - 0.5) * 2 * this.scaleY;
  };

  /**
   * Update waveform from analyser. Call every frame from your animate loop.
   *
   * @param {AnalyserNode} analyser - Web Audio AnalyserNode (shared with other visualizers)
   * @param {number} deltaTime - Time since last frame (seconds), for frame-rate-independent smoothing
   */
  WaveformVisualizer.prototype.update = function (analyser, deltaTime) {
    if (!analyser || !this.geometry) return;

    var fftSize = analyser.fftSize;
    var timeData = this._ensureTimeData(fftSize);
    analyser.getByteTimeDomainData(timeData);

    var numPoints = this.numPoints;
    var positions = this.geometry.attributes.position.array;
    var current = this.currentPositions;
    var target = this.targetPositions;
    var smooth = this.smoothing;
    // Frame-rate-independent smoothing: stronger when delta is large
    var t = 1 - Math.exp(-smooth * (deltaTime * 60));
    t = clamp(t, 0.01, 1);

    var step = (fftSize - 1) / Math.max(1, numPoints - 1);
    for (var i = 0; i < numPoints; i++) {
      var srcIndex = Math.min(Math.floor(i * step), fftSize - 1);
      var y = this._sampleToY(timeData[srcIndex]);
      var x = (i / (numPoints - 1)) * 2 - 1;

      var i3 = i * 3;
      target[i3] = x;
      target[i3 + 1] = y;
      target[i3 + 2] = 0;

      current[i3] = lerp(current[i3], target[i3], t);
      current[i3 + 1] = lerp(current[i3 + 1], target[i3 + 1], t);
      current[i3 + 2] = 0;
    }

    positions.set(current);
    this.geometry.attributes.position.needsUpdate = true;

    if (this.glowMesh && this.glowMesh.geometry) {
      this.glowMesh.geometry.attributes.position.array.set(current);
      this.glowMesh.geometry.attributes.position.needsUpdate = true;
    }

    // Optional: tint line by frequency band (bass = red, mid = green)
    if (this.reactiveColor && this.mesh.material.color) {
      var freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);
      var bass = 0, mid = 0;
      var n = freqData.length;
      for (var j = 0; j < Math.min(10, n); j++) bass += freqData[j];
      for (var k = 10; k < Math.min(100, n); k++) mid += freqData[k];
      bass = Math.min(255, bass / 10);
      mid = Math.min(255, mid / 90);
      var r = (this.color >> 16) / 255;
      var g = ((this.color >> 8) & 0xff) / 255;
      var b = (this.color & 0xff) / 255;
      this.mesh.material.color.setRGB(
        Math.min(1, r * (0.7 + (bass / 255) * 0.3)),
        Math.min(1, g * (0.7 + (mid / 255) * 0.3)),
        b
      );
    }
  };

  /**
   * Set line color (hex).
   */
  WaveformVisualizer.prototype.setColor = function (hex) {
    this.color = hex;
    if (this.mesh && this.mesh.material) this.mesh.material.color.setHex(hex);
    if (this.glowMesh && this.glowMesh.material) this.glowMesh.material.color.setHex(hex);
  };

  /**
   * Set amplitude scale (e.g. 1.2 for larger wave).
   */
  WaveformVisualizer.prototype.setScaleY = function (scaleY) {
    this.scaleY = scaleY;
  };

  /**
   * Remove from scene and dispose geometry/materials.
   */
  WaveformVisualizer.prototype.dispose = function () {
    if (this.mesh && this.scene) this.scene.remove(this.mesh);
    if (this.glowMesh && this.scene) this.scene.remove(this.glowMesh);
    if (this.geometry) this.geometry.dispose();
    if (this.mesh && this.mesh.material) this.mesh.material.dispose();
    if (this.glowMesh && this.glowMesh.geometry) this.glowMesh.geometry.dispose();
    if (this.glowMesh && this.glowMesh.material) this.glowMesh.material.dispose();
  };

  // Expose to global for script-tag usage
  global.WaveformVisualizer = WaveformVisualizer;

})(typeof window !== 'undefined' ? window : this);
