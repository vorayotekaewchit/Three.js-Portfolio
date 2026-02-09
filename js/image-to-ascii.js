/**
 * PNG/JPG image-to-ASCII conversion with 15-level density mapping.
 * Uses CharacterSet for full international charset and safe fallbacks.
 * Target width 120-200 chars; output monospaced grid for canvas or <pre>.
 */
(function (global) {
  "use strict";

  var CharacterSet = global.CharacterSet;
  var MAX_WIDTH = 200;
  var MIN_WIDTH = 120;
  var DEFAULT_COLS = 80;
  var DEFAULT_ROWS = 48;
  var NUM_LEVELS = 15;

  function getLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b);
  }

  /** Map brightness 0-255 to density level 0 (bright) .. 14 (dark). */
  function brightnessToLevel(brightness) {
    var normalized = Math.max(0, Math.min(255, brightness)) / 255;
    return Math.min(NUM_LEVELS - 1, Math.floor((1 - normalized) * NUM_LEVELS));
  }

  /**
   * Convert image (canvas Image or HTMLImageElement) to ASCII grid.
   * For pixelperfect mode uses high-res sampling (year0001-style): sample at 4x resolution
   * and average each cell for sharper, denser output. Toggle (ASCII ↔ image) does not affect
   * quality — it only switches which view is shown; quality is fixed at generation time.
   * @param {HTMLImageElement|HTMLCanvasElement} img
   * @param {number} cols - character columns (capped to MIN_WIDTH..MAX_WIDTH)
   * @param {number} rows - character rows
   * @param {Object} options - { charsetMode: 'full'|'english'|'pixelperfect', useSafeChar: boolean }
   * @returns {Array} grid[r][c] = { char, r, g, b }
   */
  function imageToAsciiGrid(img, cols, rows, options) {
    options = options || {};
    var charsetMode = options.charsetMode || "full";
    var useSafeChar = options.useSafeChar !== false;
    cols = Math.max(8, Math.min(MAX_WIDTH, cols || DEFAULT_COLS));
    rows = Math.max(4, Math.min(200, rows || DEFAULT_ROWS));

    var getChar = charsetMode === "english"
      ? CharacterSet.getCharForDensityEnglish
      : charsetMode === "pixelperfect"
        ? CharacterSet.getCharForDensityPixelPerfect
        : CharacterSet.getCharForDensity;
    var safeChar = CharacterSet.getSafeChar;
    var grid = [];
    var r, c, red, green, blue, lum, level, ch, variety;

    /* Pixel-perfect (year0001-style): sample at 16x resolution (1728×1728 for 108×108) and average each cell */
    if (charsetMode === "pixelperfect") {
      var sampleScale = 16;
      var sampleW = cols * sampleScale;
      var sampleH = rows * sampleScale;
      var canvas = document.createElement("canvas");
      canvas.width = sampleW;
      canvas.height = sampleH;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, sampleW, sampleH);
      var data = ctx.getImageData(0, 0, sampleW, sampleH).data;

      for (r = 0; r < rows; r++) {
        grid[r] = [];
        for (c = 0; c < cols; c++) {
          var rSum = 0, gSum = 0, bSum = 0, n = 0;
          var y0 = r * sampleScale;
          var x0 = c * sampleScale;
          var y1 = Math.min(y0 + sampleScale, sampleH);
          var x1 = Math.min(x0 + sampleScale, sampleW);
          for (var py = y0; py < y1; py++) {
            for (var px = x0; px < x1; px++) {
              var i = (py * sampleW + px) * 4;
              rSum += data[i];
              gSum += data[i + 1];
              bSum += data[i + 2];
              n++;
            }
          }
          red = n > 0 ? Math.round(rSum / n) : 0;
          green = n > 0 ? Math.round(gSum / n) : 0;
          blue = n > 0 ? Math.round(bSum / n) : 0;
          lum = getLuminance(red, green, blue);
          level = brightnessToLevel(lum);
          variety = r * cols + c;
          ch = getChar(level, variety);
          if (useSafeChar) ch = safeChar(ch);
          grid[r][c] = { char: ch, r: red, g: green, b: blue };
        }
      }
      return grid;
    }

    var canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, cols, rows);
    var data = ctx.getImageData(0, 0, cols, rows).data;

    for (r = 0; r < rows; r++) {
      grid[r] = [];
      for (c = 0; c < cols; c++) {
        var i = (r * cols + c) * 4;
        red = data[i];
        green = data[i + 1];
        blue = data[i + 2];
        lum = getLuminance(red, green, blue);
        level = brightnessToLevel(lum);
        variety = r * cols + c;
        ch = getChar(level, variety);
        if (useSafeChar) ch = safeChar(ch);
        grid[r][c] = { char: ch, r: red, g: green, b: blue };
      }
    }
    return grid;
  }

  /**
   * Load image from URL and convert to ASCII grid. Handles 404 with .png <-> .jpg fallback.
   * @param {string} url
   * @param {number} cols
   * @param {number} rows
   * @param {Object} options - same as imageToAsciiGrid
   * @param {function(Array)} callback - (grid)
   * @param {function()} errCallback - optional
   */
  function loadImageAndConvertToAscii(url, cols, rows, options, callback, errCallback) {
    cols = cols || DEFAULT_COLS;
    rows = rows || DEFAULT_ROWS;
    options = options || {};
    var img = new Image();
    if (/^https?:/i.test(url)) img.crossOrigin = "anonymous";

    function tryFallback() {
      var alt = url.replace(/\.(png|jpg|jpeg|webp)$/i, function (match) {
        return /\.png$/i.test(match) ? ".jpg" : ".png";
      });
      if (alt === url) {
        if (errCallback) errCallback();
        callback(emptyGrid(cols, rows));
        return;
      }
      img.onerror = function () {
        if (errCallback) errCallback();
        callback(emptyGrid(cols, rows));
      };
      img.onload = function () {
        callback(imageToAsciiGrid(img, cols, rows, options));
      };
      img.src = alt;
    }

    img.onload = function () {
      callback(imageToAsciiGrid(img, cols, rows, options));
    };
    img.onerror = tryFallback;
    img.src = url;
  }

  function emptyGrid(cols, rows) {
    var grid = [];
    var gray = 80;
    for (var r = 0; r < rows; r++) {
      grid[r] = [];
      for (var c = 0; c < cols; c++) {
        var ch = " ";
        if (r === Math.floor(rows / 2) - 1 && c >= cols / 2 - 5 && c <= cols / 2 + 5) ch = ".";
        if (r === Math.floor(rows / 2) && c >= cols / 2 - 6 && c <= cols / 2 + 6) ch = "[";
        if (r === Math.floor(rows / 2) && c === Math.floor(cols / 2) - 7) ch = "f";
        if (r === Math.floor(rows / 2) && c === Math.floor(cols / 2) + 7) ch = "]";
        grid[r][c] = { char: ch, r: gray, g: gray, b: gray };
      }
    }
    return grid;
  }

  /**
   * Render grid to a <pre> element (e.g. for DOM display). Uses monospace CSS.
   * @param {Array} grid - from imageToAsciiGrid
   * @param {HTMLElement} preEl - optional; if not provided, returns string
   * @returns {string|void}
   */
  function gridToPre(grid, preEl) {
    if (!grid || !grid.length) return preEl ? undefined : "";
    var lines = [];
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      var line = "";
      for (var c = 0; c < (row && row.length); c++) {
        line += (row[c] && row[c].char) ? row[c].char : " ";
      }
      lines.push(line);
    }
    var text = lines.join("\n");
    if (preEl) {
      preEl.textContent = text;
      preEl.style.whiteSpace = "pre";
      preEl.style.fontFamily = "Courier New, Consolas, Liberation Mono, monospace";
      preEl.style.letterSpacing = "0";
      preEl.style.lineHeight = "1";
      return undefined;
    }
    return text;
  }

  var api = {
    imageToAsciiGrid: imageToAsciiGrid,
    loadImageAndConvertToAscii: loadImageAndConvertToAscii,
    gridToPre: gridToPre,
    emptyGrid: emptyGrid,
    brightnessToLevel: brightnessToLevel,
    MAX_WIDTH: MAX_WIDTH,
    MIN_WIDTH: MIN_WIDTH,
    DEFAULT_COLS: DEFAULT_COLS,
    DEFAULT_ROWS: DEFAULT_ROWS,
    NUM_LEVELS: NUM_LEVELS
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.ImageToAscii = api;
  }
})(typeof window !== "undefined" ? window : this);
