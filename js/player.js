/**
 * AudioManager — Web Audio API for audio-reactive visuals (Three.js + viz).
 * Industry-standard: getFrequencyData(), getWaveformData(), lifecycle (resume on gesture).
 * Binds viz controls: file input, play/pause, volume, track label, keyboard shortcuts.
 */
(function () {
  const audio = document.getElementById('global-audio');
  if (!audio) return;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let analyser = null;
  let source = null;
  var frequencyData = null;
  var waveformData = null;
  var bufferLength = 0;

  const vizFileInput = document.querySelector('.viz-file-input');
  const vizPlayBtn = document.querySelector('.viz-btn-play');
  const vizPauseBtn = document.querySelector('.viz-btn-pause');
  const vizVolumeEl = document.getElementById('winamp-volume') || document.querySelector('.viz-volume');
  const vizTrackEl = document.querySelector('.viz-track');

  function connectAnalyser() {
    if (source) return analyser;
    source = audioContext.createMediaElementSource(audio);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    bufferLength = analyser.frequencyBinCount;
    frequencyData = new Uint8Array(bufferLength);
    waveformData = new Uint8Array(analyser.fftSize);
    return analyser;
  }

  function getAnalyser() {
    if (!analyser) connectAnalyser();
    return analyser;
  }

  /** Industry-standard: frequency data for Three.js visualizer (0–255 per bin). */
  function getFrequencyData() {
    var a = getAnalyser();
    if (!frequencyData) return new Uint8Array(0);
    a.getByteFrequencyData(frequencyData);
    return frequencyData;
  }

  /** Industry-standard: waveform (time-domain) data for scope / waveform viz. */
  function getWaveformData() {
    var a = getAnalyser();
    if (!waveformData) return new Uint8Array(0);
    a.getByteTimeDomainData(waveformData);
    return waveformData;
  }

  function setFilename(name) {
    if (vizTrackEl) vizTrackEl.textContent = name || 'No track loaded. Drop audio or use playlist.';
  }

  function setControlsEnabled(enabled) {
    [vizPlayBtn, vizPauseBtn].forEach(function (btn) {
      if (btn) btn.disabled = !enabled;
    });
  }

  function applyVolume() {
    if (!vizVolumeEl || vizVolumeEl.value == null) return;
    var v = parseFloat(vizVolumeEl.value, 10) / 100;
    if (!isNaN(v)) audio.volume = Math.max(0, Math.min(1, v));
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('audio/')) return;
    audio.src = URL.createObjectURL(file);
    setFilename(file.name);
    setControlsEnabled(true);
    connectAnalyser();
    applyVolume();
  }

  function setPlaylistTrack(url, displayName) {
    if (!url) return;
    audio.src = url;
    setFilename(displayName || 'Playlist');
    setControlsEnabled(true);
    connectAnalyser();
    applyVolume();
  }

  if (vizFileInput) {
    vizFileInput.addEventListener('change', function () {
      if (vizFileInput.files.length) loadFile(vizFileInput.files[0]);
    });
  }

  function play() {
    function doPlay() { audio.play().catch(function () {}); }
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(doPlay);
      return;
    }
    if (audio.readyState >= 2) { doPlay(); return; }
    var once = function () {
      audio.removeEventListener('canplay', once);
      doPlay();
    };
    audio.addEventListener('canplay', once);
    doPlay();
  }

  if (vizPlayBtn) vizPlayBtn.addEventListener('click', play);
  if (vizPauseBtn) vizPauseBtn.addEventListener('click', function () { audio.pause(); });

  if (vizVolumeEl) {
    vizVolumeEl.addEventListener('input', applyVolume);
    applyVolume();
  }

  audio.addEventListener('play', function () {
    if (audioContext.state === 'suspended') audioContext.resume();
  });

  setControlsEnabled(false);

  // ——— Keyboard shortcuts (Spotify/Apple Music style) ———
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (audio.paused) {
          if (typeof window.getGlobalAudio === 'function' && window.getGlobalAudio() === audio) {
            if (typeof window.playFirstOrSelectedTrack === 'function') {
              window.playFirstOrSelectedTrack();
            } else {
              play();
            }
          } else play();
        } else audio.pause();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey && typeof window.musicTreeNext === 'function') {
          window.musicTreeNext();
        } else if (audio.duration && isFinite(audio.duration)) {
          audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey && typeof window.musicTreePrev === 'function') {
          window.musicTreePrev();
        } else {
          audio.currentTime = Math.max(0, audio.currentTime - 10);
        }
        break;
    }
  });

  window.getGlobalAudio = function () { return audio; };
  window.getAudioAnalyser = getAnalyser;
  window.getFrequencyData = getFrequencyData;
  window.getWaveformData = getWaveformData;
  window.loadAudioFile = loadFile;
  window.setPlaylistTrack = setPlaylistTrack;
  window.setVizControlsEnabled = setControlsEnabled;
})();
