/**
 * Audio Analyzer — Web Audio API for audio-reactive visuals.
 * Shared analyser (fftSize 2048) for hero particles and pulse visualizer.
 * Binds viz controls: file input, play/pause, volume, track label.
 */
(function () {
  const audio = document.getElementById('global-audio');
  if (!audio) return;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let analyser = null;
  let source = null;

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
    return analyser;
  }

  function getAnalyser() {
    if (!analyser) connectAnalyser();
    return analyser;
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

  window.getGlobalAudio = function () { return audio; };
  window.getAudioAnalyser = getAnalyser;
  window.loadAudioFile = loadFile;
  window.setPlaylistTrack = setPlaylistTrack;
  window.setVizControlsEnabled = setControlsEnabled;
})();
