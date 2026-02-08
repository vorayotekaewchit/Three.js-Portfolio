/**
 * Drum analyzer API client for the portfolio viz.
 * Requires server_drum_api.py running (e.g. http://localhost:5000).
 * Use: analyzeDrumByFile(file).then(result => ...) or analyzeDrumByPath(relativePath).
 */
(function (global) {
  var DEFAULT_BASE = 'http://localhost:5000';

  function getBase() {
    return (typeof window !== 'undefined' && window.DRUM_ANALYZER_BASE) || DEFAULT_BASE;
  }

  /**
   * Analyze a drum sample by uploading the file (POST).
   * @param {File} file - WAV/OGG file from input or drag-drop
   * @returns {Promise<{drum_type: string, BASS: string, MID: string, HIGH: string, features: number[]}>}
   */
  function analyzeDrumByFile(file) {
    var base = getBase();
    var form = new FormData();
    form.append('file', file);
    return fetch(base + '/analyze', { method: 'POST', body: form })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (body) { throw new Error(body.error || res.statusText); });
        return res.json();
      });
  }

  /**
   * Analyze by relative path (GET). Path is relative to project root.
   * @param {string} relativePath - e.g. "assets/music/kick.wav"
   * @returns {Promise<Object>}
   */
  function analyzeDrumByPath(relativePath) {
    var base = getBase();
    return fetch(base + '/analyze?path=' + encodeURIComponent(relativePath))
      .then(function (res) {
        if (!res.ok) return res.json().then(function (body) { throw new Error(body.error || res.statusText); });
        return res.json();
      });
  }

  /**
   * Analyze all audio files in a folder (GET).
   * @param {string} relativeFolderPath - e.g. "assets/music/MyKits"
   * @returns {Promise<{samples: Array, count: number}>}
   */
  function analyzeDrumFolder(relativeFolderPath) {
    var base = getBase();
    return fetch(base + '/analyze?folder=' + encodeURIComponent(relativeFolderPath))
      .then(function (res) {
        if (!res.ok) return res.json().then(function (body) { throw new Error(body.error || res.statusText); });
        return res.json();
      });
  }

  /**
   * Update BASS/MID/HIGH readouts and optionally a drum-type element from API result.
   * @param {Object} result - { drum_type, BASS, MID, HIGH }
   * @param {Object} opts - { drumTypeSelector: '.viz-drum-type' } optional
   */
  function updateVizReadouts(result, opts) {
    opts = opts || {};
    var bassEl = document.querySelector('.viz-bass');
    var midEl = document.querySelector('.viz-mid');
    var highEl = document.querySelector('.viz-high');
    if (bassEl) bassEl.textContent = result.BASS || '000';
    if (midEl) midEl.textContent = result.MID || '000';
    if (highEl) highEl.textContent = result.HIGH || '000';
    var drumEl = opts.drumTypeSelector && document.querySelector(opts.drumTypeSelector);
    if (drumEl) drumEl.textContent = result.drum_type || '—';
  }

  var DrumAnalyzerAPI = {
    analyzeDrumByFile: analyzeDrumByFile,
    analyzeDrumByPath: analyzeDrumByPath,
    analyzeDrumFolder: analyzeDrumFolder,
    updateVizReadouts: updateVizReadouts,
  };
  global.DrumAnalyzerAPI = DrumAnalyzerAPI;
})(typeof window !== 'undefined' ? window : this);
