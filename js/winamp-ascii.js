/**
 * Winamp-style folder browser + ASCII slideshow.
 * State 1: ASCII slideshow (cycles assets/ascii/). State 2: Folder view (artist list from assets/music/).
 * Click artist → lock to that cover.png ASCII and switch back to slideshow view.
 */
(function () {
  var CHARS = " .:-=+*#%@";
  var ASCII_COLS = 64;
  var ASCII_ROWS = 64;
  var SLIDE_DURATION_MS = 5500;
  var MUSIC_BASE = "assets/music/";
  var ASCII_BASE = "assets/ascii/";
  var FOLDERS_MANIFEST = "assets/music/folders.json";
  var MUSIC_JSON = "assets/music.json";
  var ASCII_IMAGES_MANIFEST = "assets/ascii/images.json";
  var SUPPORTED_IMAGES = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

  var uiState = {
    mode: "slideshow",
    currentArtist: null,
    slideshowIndex: 0,
    slideshowUrls: [],
    artists: [],
    library: [],
    asciiCache: {},
    slideTimer: null,
    inView: true,
    tabVisible: true
  };

  var demoArtists = [
    { name: "breakcore", path: "breakcore", cover: "breakcore/cover.png" },
    { name: "various-artists", path: "various-artists", cover: "various-artists/cover.png" },
    { name: "industrial", path: "industrial", cover: "industrial/cover.png" },
    { name: "gabber", path: "gabber", cover: "gabber/cover.png" },
    { name: "idm", path: "idm", cover: "idm/cover.png" }
  ];

  function isSupported(filename) {
    if (!filename || typeof filename !== "string") return false;
    var lower = filename.toLowerCase();
    return SUPPORTED_IMAGES.some(function (ext) { return lower.endsWith(ext); });
  }

  /**
   * Load artist list (and full library with tracks): try music.json first, then folders.json.
   * Callback(artists, library) — library is [] when from folders.json.
   */
  function scanMusicFolders(callback) {
    function fromLibrary(data) {
      var lib = data && data.library;
      if (!Array.isArray(lib)) return null;
      return lib.map(function (a) {
        var name = (a && a.artist) ? a.artist : "?";
        var cover = (a && a.cover) ? a.cover : name + "/cover.png";
        return {
          name: name,
          path: name,
          cover: cover,
          coverUrl: MUSIC_BASE + encodeURIComponent(cover).replace(/%2F/g, "/")
        };
      });
    }
    function fromFoldersArray(arr) {
      if (!Array.isArray(arr)) arr = [];
      return arr.map(function (o) {
        var name = (o && o.name) ? o.name : (o.path || "?");
        var path = (o && o.path) ? o.path : name;
        var cover = (o && o.cover) ? o.cover : path + "/cover.png";
        return {
          name: name,
          path: path,
          cover: cover,
          coverUrl: MUSIC_BASE + encodeURIComponent(cover).replace(/%2F/g, "/")
        };
      });
    }
    fetch(MUSIC_JSON)
      .then(function (r) {
        if (!r.ok) throw new Error("no music.json");
        return r.json();
      })
      .then(function (data) {
        var list = fromLibrary(data);
        if (list && list.length) {
          if (typeof console !== "undefined" && console.log) {
            console.log("Music library: " + list.length + " artist(s) from assets/music.json");
          }
          callback(list, data.library || []);
          return;
        }
        throw new Error("empty library");
      })
      .catch(function (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("Music library: assets/music.json failed, trying folders.json —", err.message);
        }
        fetch(FOLDERS_MANIFEST)
          .then(function (r) {
            if (!r.ok) throw new Error(r.status + " " + r.statusText);
            return r.json();
          })
          .then(function (arr) {
            var list = fromFoldersArray(arr);
            if (typeof console !== "undefined" && console.log) {
              console.log("Music library: " + list.length + " artist(s) from assets/music/folders.json");
            }
            callback(list, []);
          })
          .catch(function (err2) {
            if (typeof console !== "undefined" && console.warn) {
              console.warn("Music library: both sources failed, using demo list —", err2.message);
            }
            var demo = demoArtists.map(function (o) {
              return {
                name: o.name,
                path: o.path,
                cover: o.cover,
                coverUrl: MUSIC_BASE + o.cover
              };
            });
            callback(demo, []);
          });
      });
  }

  /**
   * Load slideshow image list from assets/ascii/images.json.
   */
  function loadAsciiSlideshowUrls(callback) {
    fetch(ASCII_IMAGES_MANIFEST)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        return r.json();
      })
      .then(function (arr) {
        if (!Array.isArray(arr)) arr = [];
        var list = arr.filter(function (x) {
          return typeof x === "string" && x.trim() && isSupported(x.trim());
        });
        var urls = list.map(function (f) { return ASCII_BASE + encodeURIComponent(f.trim()); });
        callback(urls);
      })
      .catch(function () { callback([]); });
  }

  /**
   * Generate 80x40 color ASCII grid from image URL. Returns grid[r][c] = { char, r, g, b }.
   */
  function generateAsciiFromImage(url, cols, rows, callback) {
    cols = cols || ASCII_COLS;
    rows = rows || ASCII_ROWS;
    var img = new Image();
    if (/^https?:\/\//i.test(url)) img.crossOrigin = "anonymous";
    img.onload = function () {
      var grid = imageToAsciiGrid(img, cols, rows);
      callback(grid);
    };
    img.onerror = function () { callback(emptyFolderAsciiGrid(cols, rows)); };
    img.src = url;
  }

  function imageToAsciiGrid(img, cols, rows) {
    var c = document.createElement("canvas");
    c.width = cols;
    c.height = rows;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, cols, rows);
    var data = ctx.getImageData(0, 0, cols, rows).data;
    var grid = [];
    var len = CHARS.length;
    for (var r = 0; r < rows; r++) {
      grid[r] = [];
      for (var c_ = 0; c_ < cols; c_++) {
        var i = (r * cols + c_) * 4;
        var red = data[i];
        var green = data[i + 1];
        var blue = data[i + 2];
        var lum = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
        var idx = Math.min(len - 1, Math.floor(lum * len));
        grid[r][c_] = { char: CHARS[idx], r: red, g: green, b: blue };
      }
    }
    return grid;
  }

  function emptyFolderAsciiGrid(cols, rows) {
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
   * Pre-cache ASCII for all artist covers (runs in idle time when supported).
   */
  function precacheArtistAscii(artists, onDone) {
    var pending = artists.length;
    if (pending === 0) {
      if (onDone) onDone();
      return;
    }
    function doOne(index) {
      if (index >= artists.length) {
        if (onDone) onDone();
        return;
      }
      var artist = artists[index];
      var key = artist.coverUrl;
      if (uiState.asciiCache[key]) {
        pending--;
        if (pending === 0 && onDone) onDone();
        scheduleNext(index + 1);
        return;
      }
      generateAsciiFromImage(key, ASCII_COLS, ASCII_ROWS, function (grid) {
        uiState.asciiCache[key] = grid;
        pending--;
        if (pending === 0 && onDone) onDone();
        scheduleNext(index + 1);
      });
    }
    function scheduleNext(nextIndex) {
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(function () { doOne(nextIndex); }, { timeout: 2000 });
      } else {
        setTimeout(function () { doOne(nextIndex); }, 0);
      }
    }
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(function () { doOne(0); }, { timeout: 3000 });
    } else {
      doOne(0);
    }
  }

  var canvas, ctx, captionEl, folderCountEl, foldersListEl, btnSlideshow, btnFolders, asciiView, foldersView;
  var cellW, cellH, lastDpr = 1;
  var lastFontSize = 0;

  function getElements() {
    canvas = document.querySelector(".winamp-ascii-canvas");
    captionEl = document.getElementById("winamp-ascii-caption");
    folderCountEl = document.getElementById("winamp-folder-count");
    foldersListEl = document.getElementById("winamp-folders-list");
    btnSlideshow = document.querySelector(".winamp-btn-slideshow");
    btnFolders = document.querySelector(".winamp-btn-folders");
    asciiView = document.querySelector(".winamp-ascii-view");
    foldersView = document.querySelector(".winamp-folders-view");
    if (!canvas) return false;
    ctx = canvas.getContext("2d");
    var wrap = canvas.parentElement;
    var rect = wrap ? wrap.getBoundingClientRect() : { width: 400, height: 400 };
    var size = Math.max(1, Math.min(Math.floor(rect.width || 400), Math.floor(rect.height || 400)));
    var w = size;
    var h = size;
    lastDpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * lastDpr;
    canvas.height = h * lastDpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(lastDpr, lastDpr);
    }
    cellW = w / ASCII_COLS;
    cellH = h / ASCII_ROWS;
    return true;
  }

  function renderGrid(grid) {
    if (!ctx || !canvas || !grid) return;
    var cssW = (canvas.width / lastDpr) || 400;
    var cssH = (canvas.height / lastDpr) || 400;
    var scaleX = cssW / ASCII_COLS;
    var scaleY = cssH / ASCII_ROWS;
    var fontSize = Math.min(scaleX, scaleY) * 1.1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(lastDpr, lastDpr);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, cssW, cssH);
    if (fontSize !== lastFontSize) {
      lastFontSize = fontSize;
      ctx.font = fontSize + "px \"IBM Plex Mono\", monospace";
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < (grid[r] && grid[r].length); c++) {
        var cell = grid[r][c];
        if (!cell || !cell.char) continue;
        ctx.fillStyle = "rgb(" + (cell.r || 255) + "," + (cell.g || 255) + "," + (cell.b || 255) + ")";
        var x = (c + 0.5) * scaleX;
        var y = (r + 0.5) * scaleY;
        ctx.fillText(cell.char, x, y);
      }
    }
  }

  function setMode(mode) {
    uiState.mode = mode;
    if (btnSlideshow) {
      btnSlideshow.classList.toggle("winamp-btn-active", mode === "slideshow");
      btnSlideshow.setAttribute("aria-pressed", mode === "slideshow" ? "true" : "false");
    }
    if (btnFolders) {
      btnFolders.classList.toggle("winamp-btn-active", mode === "folders");
      btnFolders.setAttribute("aria-pressed", mode === "folders" ? "true" : "false");
    }
    if (asciiView) asciiView.classList.toggle("winamp-hidden", mode !== "slideshow");
    if (foldersView) foldersView.classList.toggle("winamp-hidden", mode !== "folders");
    if (mode === "folders") {
      renderFolderList();
    } else {
      showCurrentSlide();
    }
  }

  function showCurrentSlide() {
    var grid = null;
    var caption = "";
    if (uiState.currentArtist) {
      grid = uiState.asciiCache[uiState.currentArtist.coverUrl] || null;
      caption = "Now playing: " + uiState.currentArtist.name + " — cover.png";
    } else if (uiState.slideshowUrls.length > 0) {
      var url = uiState.slideshowUrls[uiState.slideshowIndex];
      if (uiState.asciiCache[url]) {
        grid = uiState.asciiCache[url];
      }
      caption = "Breakcore Visions - Slide " + (uiState.slideshowIndex + 1) + "/" + uiState.slideshowUrls.length;
    } else {
      caption = "Drop images in assets/ascii/ and list them in assets/ascii/images.json";
    }
    if (captionEl) captionEl.textContent = caption;
    if (grid) renderGrid(grid);
  }

  function renderFolderList() {
    if (!foldersListEl) return;
    /* Skip if winampFolders.js owns this list (viz section) */
    if (foldersListEl.closest && foldersListEl.closest(".viz-playlist-wrap")) return;
    foldersListEl.innerHTML = "";
    if (uiState.artists.length === 0) {
      var li = document.createElement("li");
      li.className = "winamp-folder-item winamp-folder-empty";
      li.textContent = "Drop music folders here! (Add folders with cover.png to assets/music/ and list in folders.json)";
      foldersListEl.appendChild(li);
    } else {
      uiState.artists.forEach(function (artist, idx) {
        var libEntry = uiState.library[idx];
        var tracks = (libEntry && libEntry.tracks) ? libEntry.tracks : [];

        var li = document.createElement("li");
        li.className = "winamp-folder-item" + (uiState.currentArtist && uiState.currentArtist.coverUrl === artist.coverUrl ? " winamp-folder-active" : "");
        li.setAttribute("role", "option");
        li.innerHTML = "<span class=\"winamp-folder-icon\" aria-hidden=\"true\">▶</span> " + escapeHtml(artist.name) + "/" + (tracks.length ? " (" + tracks.length + ")" : "");
        li.addEventListener("click", function (e) {
          if (e.target.closest(".winamp-folder-tracks")) return;
          uiState.currentArtist = artist;
          setMode("slideshow");
          showCurrentSlide();
        });
        foldersListEl.appendChild(li);

        if (tracks.length) {
          var ul = document.createElement("ul");
          ul.className = "winamp-folder-tracks";
          tracks.forEach(function (file) {
            var t = document.createElement("li");
            t.textContent = file.replace(/\.[^.]+$/, "");
            t.title = file;
            ul.appendChild(t);
          });
          li.appendChild(ul);
        }
      });
    }
    if (folderCountEl) folderCountEl.textContent = uiState.artists.length;
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function scheduleSlideshow() {
    if (uiState.slideTimer) clearTimeout(uiState.slideTimer);
    if (uiState.currentArtist || uiState.slideshowUrls.length <= 1) return;
    uiState.slideTimer = setTimeout(function () {
      if (!uiState.tabVisible || !uiState.inView || uiState.currentArtist) return;
      uiState.slideshowIndex = (uiState.slideshowIndex + 1) % uiState.slideshowUrls.length;
      var url = uiState.slideshowUrls[uiState.slideshowIndex];
      if (uiState.asciiCache[url]) {
        showCurrentSlide();
      } else {
        generateAsciiFromImage(url, ASCII_COLS, ASCII_ROWS, function (grid) {
          uiState.asciiCache[url] = grid;
          showCurrentSlide();
        });
      }
      scheduleSlideshow();
    }, SLIDE_DURATION_MS);
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!uiState.tabVisible || !uiState.inView) return;
  }

  function init() {
    getElements();
    if (!canvas) return;

    /* Listen for music tree track play — show artist cover in ASCII */
    document.addEventListener("music-tree:play-track", function (e) {
      var detail = e.detail;
      if (!detail || !detail.folder) return;
      var folder = detail.folder;
      uiState.currentArtist = {
        name: folder.name,
        path: folder.name,
        cover: folder.cover || folder.name + "/cover.png",
        coverUrl: folder.coverUrl || MUSIC_BASE + (folder.cover || folder.name + "/cover.png")
      };
      if (uiState.asciiCache[uiState.currentArtist.coverUrl]) {
        showCurrentSlide();
      } else {
        generateAsciiFromImage(uiState.currentArtist.coverUrl, ASCII_COLS, ASCII_ROWS, function (grid) {
          uiState.asciiCache[uiState.currentArtist.coverUrl] = grid;
          showCurrentSlide();
        });
      }
    });

    document.addEventListener("visibilitychange", function () {
      uiState.tabVisible = !document.hidden;
    });
    if (canvas) {
      var section = canvas.closest(".section-viz") || canvas.closest(".section-ascii");
      if (section) {
      var io = new IntersectionObserver(function (entries) {
        uiState.inView = entries[0].isIntersecting;
      }, { threshold: 0.05, rootMargin: "80px" });
      io.observe(section);
      }
    }

    if (btnSlideshow) {
      btnSlideshow.addEventListener("click", function () {
        uiState.currentArtist = null;
        setMode("slideshow");
        scheduleSlideshow();
      });
    }
    if (btnFolders) {
      btnFolders.addEventListener("click", function () {
        setMode("folders");
        var viz = document.getElementById("viz");
        if (viz) viz.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    scanMusicFolders(function (artists, library) {
      uiState.artists = artists;
      uiState.library = Array.isArray(library) ? library : [];
      if (folderCountEl) folderCountEl.textContent = artists.length;
      renderFolderList();
      precacheArtistAscii(artists, function () {
        if (uiState.mode === "slideshow" && uiState.currentArtist) showCurrentSlide();
      });
    });

    var foldersToggle = document.getElementById("winamp-folders-toggle");
    var foldersListWrap = document.getElementById("winamp-folders-list-wrap");
    var foldersPanel = foldersToggle && foldersToggle.closest(".winamp-folders-panel");
    if (foldersToggle && foldersListWrap && foldersPanel) {
      foldersToggle.addEventListener("click", function () {
        var collapsed = foldersPanel.classList.toggle("is-collapsed");
        foldersToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        foldersListWrap.setAttribute("aria-hidden", collapsed ? "true" : "false");
      });
    }

    loadAsciiSlideshowUrls(function (urls) {
      uiState.slideshowUrls = urls;
      if (urls.length === 0) {
        if (captionEl) captionEl.textContent = "Drop images in assets/ascii/ and list them in assets/ascii/images.json";
        return;
      }
      var firstShown = false;
      function tryShowFirst() {
        if (firstShown) return;
        var url = urls[0];
        if (!uiState.asciiCache[url]) return;
        firstShown = true;
        uiState.slideshowIndex = 0;
        showCurrentSlide();
        scheduleSlideshow();
      }
      urls.forEach(function (url, i) {
        if (uiState.asciiCache[url]) {
          if (i === 0) tryShowFirst();
          return;
        }
        generateAsciiFromImage(url, ASCII_COLS, ASCII_ROWS, function (grid) {
          uiState.asciiCache[url] = grid;
          if (i === 0) tryShowFirst();
        });
      });
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (getElements() && uiState.mode === "slideshow") showCurrentSlide();
      }, 120);
    });

    tick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
