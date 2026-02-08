/**
 * Full international character set for ASCII art (512+ chars).
 * Industry-standard density mapping, no double-width (CJK/emoji).
 * Attaches to window.CharacterSet for use by ascii-canvas-slideshow.js and image-to-ascii.js.
 */
(function (global) {
  "use strict";

  var FULL_CHAR_SET = {
    ascii: " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?`~ ",
    blocks: " \u2591\u2592\u2593\u2588 \u2584\u2580 \u258C\u2590 \u2591\u2592\u2593\u2588 ",
    lines: " \u2550\u2551\u2563\u255E\u2569\u2566\u2560\u256C\u2554\u2557\u255A\u255D\u2568\u2565\u2552\u2555\u2558\u255B\u2514\u2524\u2518\u251C\u252C\u2524\u2502\u251C\u2514\u2518\u2510\u250C ",
    intl: " \u00E4\u00F6\u00FC\u00DF\u00E7\u00E9\u00E8\u00EA\u00EB\u00EF\u00EE\u00F1\u00F3\u00F2\u00F4\u00F5\u00FA\u00F9\u00FB\u00FF\u00E5\u00E6\u0153\u00F0 \u00E1\u00E0\u00E2\u00E3\u00E4\u00E5\u00E7\u00E9\u00E8\u00EA\u00EB\u00ED\u00EC\u00EE\u00EF\u00F1\u00F3\u00F2\u00F4\u00F5\u00FA\u00F9\u00FB\u00FC\u00FD\u00FF ",
    cyrillic: " \u0430\u0431\u0432\u0433\u0434\u0435\u0451\u0436\u0437\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044A\u044B\u044C\u044D\u044E\u044F ",
    greek: " \u03B1\u03B2\u03B3\u03B4\u03B5\u03B6\u03B7\u03B8\u03B9\u03BA\u03BB\u03BC\u03BD\u03BE\u03BF\u03C0\u03C1\u03C3\u03C4\u03C5\u03C6\u03C7\u03C8\u03C9 ",
    greekUpper: " \u0391\u0392\u0393\u0394\u0395\u0396\u0397\u0398\u0399\u039A\u039B\u039C\u039D\u039E\u039F\u03A0\u03A1\u03A3\u03A4\u03A5\u03A6\u03A7\u03A8\u03A9 ",
    symbols: " \u2190\u2191\u2192\u2193 \u2196\u2197\u2198\u2199 \u25C0\u25B6\u25B2\u25BC\u25C6\u25C7\u25CB\u25CF\u25D0\u25D1\u25D2\u25D3\u25D4\u25D5 \u2605\u2606\u2660\u2663\u2665\u2666 ",
    centralEuro: " \u0104\u010C\u0118\u011B\u0141\u0143\u0147\u00D3\u0158\u015A\u0164\u00DA\u017D\u0105\u010D\u0107\u0119\u011B\u0142\u0144\u0148\u00F3\u0159\u015B\u0165\u0161\u00FA\u017E \u0110\u0111 "
  };

  /** Combined string of all single-width chars for density palette (no duplicates, ordered by visual density). */
  var DENSITY_PALETTE = (
    "\u2588\u2593\u2592\u2591\u2580\u2584\u258C\u2590\u25CF\u25CB\u25C6\u25C7\u25A0\u25A1\u25D0\u25D1\u25D2\u25D3\u25D4\u25D5" +
    "\u2550\u2551\u2563\u255E\u2569\u2566\u2560\u256C\u2554\u2557\u255A\u255D\u2524\u251C\u2514\u2518\u2510\u250C\u2502\u2500" +
    "\u25B2\u25BC\u25B6\u25C0\u25AA\u25AB\u25E6\u2022\u00B7\u2219" +
    "=_-+*#%&@$?!;:,\"'`." +
    "  "
  );

  /**
   * 15 density levels: level 0 = brightest (white), level 14 = darkest (black).
   * Each level maps to one or more chars for variety.
   */
  var DENSITY_LEVELS = [
    " \u2588\u2593\u2588\u2593 ",           // 0 brightest
    "\u2593\u2592\u2588\u2591\u2580",
    "\u2592\u2591\u2584\u258C\u2590",
    "\u2580\u2584\u258C\u2590\u25CF",
    "\u25CF\u25CB\u25C6\u25C7\u25A0",
    "\u25CB\u25C7\u25A0\u25A1\u25D0",
    "\u25D0\u25D1\u25D2\u25D3\u25D4",
    "\u2550\u2551\u2524\u251C\u2502",
    "\u25B2\u25BC\u25B6\u25C0\u25AA",
    "\u25AA\u25AB\u00B7\u2219\u2022",
    "=_-+*#%&@",
    "$?!;:,\"'",
    "`.",
    ". '",
    "  "                                    // 14 darkest
  ];

  /** English-only (94 printable ASCII). */
  var ENGLISH_CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?`~ ";

  /** 15 density levels using only ASCII for "english" mode (bright → dark). */
  var ENGLISH_DENSITY_LEVELS = [
    " ", " .", ".:", ".:-", ".:-=", ".:-=+", ".:-=+*", ".:-=+*#", ".:-=+*#%",
    ".:-=+*#%@", "#%@&", "%@&?!", "@&?!;", "?!;,.", " "
  ];

  /** Pixel-perfect density: square chars for seamless fill (bright → dark). */
  var PIXELPERFECT_DENSITY_LEVELS = [
    " \u25E6\u00B7\u2032",           // 0 brightest: ◦·′
    "\u00B7\u2032\u0060.",          // 1
    "\u0060.,\u0027",               // 2
    "\u25AA\u25AB",                 // 3 ▪▫
    "\u25AB\u25AC",                 // 4 ▫▬
    "\u25AC\u25A1",                 // 5 ▬□
    "\u25A1\u25A0",                 // 6 □■
    "\u258C\u2590",                 // 7 ▌▐
    "\u2580\u2584",                 // 8 ▀▄
    "\u2591",                       // 9 ░
    "\u2592",                       // 10 ▒
    "\u2593",                       // 11 ▓
    "\u2588\u2593",                 // 12
    "\u2588\u2593\u2592",           // 13
    "\u2588 "                       // 14 darkest
  ];

  /** Fallback for chars that may not render: map to safe single-cell equiv. */
  var FALLBACK_MAP = {
    "\u2588": "#",
    "\u2593": "%",
    "\u2592": "+",
    "\u2591": "*",
    "\u2580": "^",
    "\u2584": "_",
    "\u258C": "|",
    "\u2590": "|",
    "\u2550": "=",
    "\u2551": "|",
    "\u2563": "|",
    "\u255E": "+",
    "\u2569": "+",
    "\u2566": "+",
    "\u2560": "+",
    "\u256C": "+",
    "\u2554": "+",
    "\u2557": "+",
    "\u255A": "+",
    "\u255D": "+",
    "\u2524": "|",
    "\u251C": "|",
    "\u2514": "+",
    "\u2518": "+",
    "\u2510": "+",
    "\u250C": "+",
    "\u2502": "|",
    "\u2500": "-",
    "\u25B2": "^",
    "\u25BC": "v",
    "\u25B6": ">",
    "\u25C0": "<",
    "\u25C6": "*",
    "\u25C7": "+",
    "\u25CB": "o",
    "\u25CF": "*",
    "\u25A0": "#",
    "\u25A1": "+",
    "\u25D0": "(",
    "\u25D1": ")",
    "\u25D2": "(",
    "\u25D3": ")",
    "\u25D4": "o",
    "\u25D5": "o",
    "\u25AA": "#",
    "\u25AB": "#",
    "\u2605": "*",
    "\u2606": "*",
    "\u2660": "S",
    "\u2663": "C",
    "\u2665": "H",
    "\u2666": "D"
  };

  function getAllChars() {
    var s = "";
    var k;
    for (k in FULL_CHAR_SET) {
      if (FULL_CHAR_SET.hasOwnProperty(k)) s += FULL_CHAR_SET[k];
    }
    return s;
  }

  /** Return character for density level (0=bright, 14=dark). variety = optional seed for picking within level. */
  function getCharForDensity(level, variety) {
    level = Math.max(0, Math.min(14, Math.floor(level)));
    var str = DENSITY_LEVELS[level];
    if (!str || !str.length) return " ";
    var idx = variety != null ? (Math.abs(variety) % str.length) : 0;
    return str.charAt(idx);
  }

  /** English-only density: 15 levels using only ASCII chars. */
  function getCharForDensityEnglish(level, variety) {
    level = Math.max(0, Math.min(14, Math.floor(level)));
    var str = ENGLISH_DENSITY_LEVELS[level];
    if (!str || !str.length) return " ";
    var idx = variety != null ? (Math.abs(variety) % str.length) : 0;
    return str.charAt(idx);
  }

  /** Pixel-perfect density: square chars for seamless canvas fill. */
  function getCharForDensityPixelPerfect(level, variety) {
    level = Math.max(0, Math.min(14, Math.floor(level)));
    var str = PIXELPERFECT_DENSITY_LEVELS[level];
    if (!str || !str.length) return " ";
    var idx = variety != null ? (Math.abs(variety) % str.length) : 0;
    return str.charAt(idx);
  }

  /** Safe char for rendering: use fallback if in map, else return char (caller may replace unknown with space). */
  function getSafeChar(ch) {
    if (!ch || ch.length === 0) return " ";
    return FALLBACK_MAP[ch] != null ? FALLBACK_MAP[ch] : ch;
  }

  /** Build charset string for mode: 'full' | 'english' | 'density'. */
  function getCharsForMode(mode) {
    if (mode === "english") return ENGLISH_CHARS;
    if (mode === "density") return DENSITY_PALETTE;
    return getAllChars();
  }

  /** Character width tester: returns Set of chars that measure as single-width in given font (optional). */
  function buildCharWidthTester(fontFamily, fontSizePx) {
    fontFamily = fontFamily || "Courier New, Consolas, Liberation Mono, monospace";
    fontSizePx = fontSizePx || 12;
    var canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!canvas) return { measure: function () { return 1; }, singleWidthSet: null };
    var ctx = canvas.getContext("2d");
    ctx.font = fontSizePx + "px " + fontFamily;
    var spaceW = ctx.measureText(" ").width;
    var singleWidthSet = new Set();
    var all = getAllChars();
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (singleWidthSet.has(c)) continue;
      var w = ctx.measureText(c).width;
      if (w <= spaceW * 1.5) singleWidthSet.add(c);
    }
    return {
      measure: function (ch) { return ctx.measureText(ch).width; },
      spaceWidth: spaceW,
      singleWidthSet: singleWidthSet
    };
  }

  var api = {
    FULL_CHAR_SET: FULL_CHAR_SET,
    DENSITY_LEVELS: DENSITY_LEVELS,
    PIXELPERFECT_DENSITY_LEVELS: PIXELPERFECT_DENSITY_LEVELS,
    ENGLISH_DENSITY_LEVELS: ENGLISH_DENSITY_LEVELS,
    DENSITY_PALETTE: DENSITY_PALETTE,
    ENGLISH_CHARS: ENGLISH_CHARS,
    FALLBACK_MAP: FALLBACK_MAP,
    getCharForDensity: getCharForDensity,
    getCharForDensityEnglish: getCharForDensityEnglish,
    getCharForDensityPixelPerfect: getCharForDensityPixelPerfect,
    getSafeChar: getSafeChar,
    getCharsForMode: getCharsForMode,
    getAllChars: getAllChars,
    buildCharWidthTester: buildCharWidthTester
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.CharacterSet = api;
  }
})(typeof window !== "undefined" ? window : this);
