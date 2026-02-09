/**
 * ASCII canvas slideshow — click-to-toggle image/ASCII, tag overlay, nav.
 * Depends: character-set.js, image-to-ascii.js (CharacterSet, ImageToAscii on window).
 * Pixel-perfect: 108×108 grid, 14px chars, 1512 canvas.
 */
(function () {
  var ASCII_COLS = 80;
  var ASCII_ROWS = 48;
  /* High-res ASCII: 108×108 grid, 14px chars, 1512 canvas for pixel-perfect fill */
  var ASCII_CANVAS_COLS = 108;
  var ASCII_CANVAS_ROWS = 108;
  var ASCII_CANVAS_CHAR_SIZE = 14;
  var ASCII_CANVAS_SIZE = 1512;
  var SLIDE_DURATION_MS = 5500;
  var MUSIC_BASE = "assets/music/";
  var ASSETS_BASE = "assets/";
  var ASCII_BASE = "assets/ascii/";
  var FOLDERS_MANIFEST = "assets/music/folders.json";
  var MUSIC_JSON = "assets/music.json";
  var ASCII_IMAGES_MANIFEST = "assets/ascii/images.json";
  var SUPPORTED_IMAGES = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
  var CHARSET_MODES = ["full", "english", "density"];
  var MONOSPACE_FONT = "Courier New, Consolas, Liberation Mono, monospace";

  var uiState = {
    mode: "slideshow",
    charsetMode: "full",
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
        var folderPath = (a && a.folderPath) ? a.folderPath : null;
        var cover = (a && a.cover) ? a.cover : (folderPath ? folderPath + "/cover.png" : name + "/cover.png");
        var base = folderPath ? ASSETS_BASE : MUSIC_BASE;
        return {
          name: name,
          path: folderPath || name,
          cover: cover,
          coverUrl: base + encodeURIComponent(cover).replace(/%2F/g, "/")
        };
      });
    }
    function fromFoldersArray(arr) {
      if (!Array.isArray(arr)) arr = [];
      return arr.map(function (o) {
        var name = (o && o.name) ? o.name : (o.path || "?");
        var path = (o && o.path) ? o.path : name;
        var cover = (o && o.cover) ? o.cover : path + "/cover.png";
        var base = path.indexOf("/") !== -1 ? ASSETS_BASE : MUSIC_BASE;
        return {
          name: name,
          path: path,
          cover: cover,
          coverUrl: base + encodeURIComponent(cover).replace(/%2F/g, "/")
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

  /** Cache key includes charset so switching mode gets correct grid. */
  function cacheKey(url) {
    return url + "|" + uiState.charsetMode;
  }

  /**
   * Generate color ASCII grid from image URL using full 15-level density + charset mode.
   * On 404, tries alternate cover extension (.png <-> .jpg) so Lune Album cover works.
   */
  function generateAsciiFromImage(url, cols, rows, callback) {
    cols = cols || ASCII_COLS;
    rows = rows || ASCII_ROWS;
    var opts = { charsetMode: uiState.charsetMode, useSafeChar: true };
    if (typeof window.ImageToAscii === "undefined") {
      callback(emptyFolderAsciiGrid(cols, rows));
      return;
    }
    window.ImageToAscii.loadImageAndConvertToAscii(url, cols, rows, opts, callback, function () {
      callback(emptyFolderAsciiGrid(cols, rows));
    });
  }

  function emptyFolderAsciiGrid(cols, rows) {
    if (typeof window.ImageToAscii !== "undefined") {
      return window.ImageToAscii.emptyGrid(cols, rows);
    }
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
      var key = cacheKey(artist.coverUrl);
      if (uiState.asciiCache[key]) {
        pending--;
        if (pending === 0 && onDone) onDone();
        scheduleNext(index + 1);
        return;
      }
      generateAsciiFromImage(artist.coverUrl, ASCII_COLS, ASCII_ROWS, function (grid) {
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

  /**
   * Dual-mode renderer — single click toggles RAW IMAGE ↔ ASCII (108×108, pixel-perfect).
   * Canvas 1512×1512; 14×14px chars; textBaseline=top, textAlign=left for zero gaps.
   */
  function ToggleAsciiRenderer(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext("2d");
    this.cols = ASCII_CANVAS_COLS;
    this.rows = ASCII_CANVAS_ROWS;
    this.size = ASCII_CANVAS_SIZE;
    this.charSize = ASCII_CANVAS_CHAR_SIZE;
    this.isAsciiMode = false;
    this.currentImage = null;
    this.currentAsciiGrid = null;
    this.charW = this.charSize;
    this.charH = this.charSize;
  }

  ToggleAsciiRenderer.prototype.toggleMode = function () {
    this.isAsciiMode = !this.isAsciiMode;
    this.renderFrame();
    if (this.canvas) {
      this.canvas.style.transform = "scale(0.98)";
      var self = this;
      setTimeout(function () {
        self.canvas.style.transform = "scale(1)";
      }, 150);
    }
  };

  ToggleAsciiRenderer.prototype.setSource = function (img, asciiGrid) {
    this.currentImage = img;
    this.currentAsciiGrid = asciiGrid;
    this.renderFrame();
  };

  ToggleAsciiRenderer.prototype.renderFrame = function () {
    var ctx = this.ctx;
    var s = this.size;
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, s, s);
    if (this.isAsciiMode && this.currentAsciiGrid) {
      this.renderAscii();
    } else if (this.currentImage && this.currentImage.complete && this.currentImage.naturalWidth) {
      ctx.drawImage(this.currentImage, 0, 0, s, s);
    }
  };

  ToggleAsciiRenderer.prototype.renderAscii = function () {
    var grid = this.currentAsciiGrid;
    if (!grid || !this.ctx) return;
    var ctx = this.ctx;
    var cs = this.charSize;
    ctx.font = cs + "px " + MONOSPACE_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < (grid[r] && grid[r].length); c++) {
        var cell = grid[r][c];
        if (!cell || !cell.char) continue;
        ctx.fillStyle = "rgb(" + (cell.r || 255) + "," + (cell.g || 255) + "," + (cell.b || 255) + ")";
        ctx.fillText(cell.char, c * cs, r * cs);
      }
    }
  };

  /** Derive tag and title from image URL and index (tag = short id, title = display name). */
  function slugFromUrl(url, index) {
    var filename = (url && url.split("/").pop()) ? decodeURIComponent(url.split("/").pop()) : "";
    var base = filename.replace(/\.[^.]+$/, "").trim() || "slide";
    var tag = String(index + 1).padStart(2, "0");
    var title = base.replace(/[-_]+/g, " ");
    return { tag: tag, title: title };
  }

  function initYear0001Toggle() {
    var canvasEl = document.querySelector(".landingSlideshow-asciiCanvas");
    var captionEl = document.getElementById("winamp-ascii-caption");
    var slidesContainer = document.getElementById("ascii-slides-container");
    var navContainer = document.getElementById("ascii-slideshow-nav");
    var tagEl = document.getElementById("ascii-slide-tag");
    var titleEl = document.getElementById("ascii-slide-title");
    var bodyEl = document.getElementById("ascii-slide-body");
    if (!canvasEl || !canvasEl.getContext("2d")) return;
    canvasEl.width = ASCII_CANVAS_SIZE;
    canvasEl.height = ASCII_CANVAS_SIZE;
    var renderer = new ToggleAsciiRenderer(canvasEl);
    var slideIndex = 0;
    var slideUrls = [];
    var asciiCache = {};
    var slideTimer = null;
    var inView = true;
    var tabVisible = !document.hidden;

    function cacheKeyYear(url) {
      return url + "|full";
    }

    function updateCaption() {
      if (!captionEl) return;
      var base = renderer.isAsciiMode ? "Click to see image" : "Click to see ASCII";
      if (slideUrls.length > 1) {
        captionEl.textContent = base + " — Slide " + (slideIndex + 1) + "/" + slideUrls.length;
      } else {
        captionEl.textContent = base;
      }
    }

    function showSlide(img, grid) {
      renderer.setSource(img, grid);
      updateCaption();
    }

    /** Build slide divs: img + slide-text (tag, title). */
    function buildSlidesDOM(urls) {
      if (!slidesContainer || !urls.length) return;
      slidesContainer.innerHTML = "";
      urls.forEach(function (url, i) {
        var meta = slugFromUrl(url, i);
        var slide = document.createElement("div");
        slide.className = "landingSlideshow-slide" + (i === 0 ? " active" : "");
        slide.setAttribute("data-category", "ascii");
        slide.setAttribute("data-url", "#ascii");
        var img = document.createElement("img");
        img.width = 150;
        img.className = "landingSlideshow-image";
        img.alt = meta.title;
        if (/^https?:/i.test(url)) img.crossOrigin = "anonymous";
        img.src = url;
        slide.appendChild(img);
        var textBlock = document.createElement("div");
        textBlock.className = "landingSlideshow-slide-text";
        textBlock.innerHTML = "<span class=\"landingSlideshow-slide-tag\">" + meta.tag + "</span><span class=\"landingSlideshow-slide-title\">" + meta.title + "</span><span class=\"landingSlideshow-slide-body\"></span>";
        slide.appendChild(textBlock);
        slidesContainer.appendChild(slide);
      });
    }

    /** Build nav items (": TAG" per slide), click -> goToSlide(i). */
    function buildNavDOM(urls, goToFn) {
      if (!navContainer || !urls.length) return;
      navContainer.innerHTML = "";
      urls.forEach(function (url, i) {
        var meta = slugFromUrl(url, i);
        var span = document.createElement("span");
        span.className = "landingSlideshow-nav-item" + (i === 0 ? " active" : "");
        span.textContent = ": " + meta.tag;
        span.setAttribute("role", "button");
        span.setAttribute("tabindex", "0");
        span.addEventListener("click", function () {
          if (typeof goToFn === "function") goToFn(i);
        });
        span.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (typeof goToFn === "function") goToFn(i);
          }
        });
        navContainer.appendChild(span);
      });
    }

    /** Sync overlay text and active states (tag, title, body + active slide/nav). */
    function updateOverlayAndActive(index) {
      if (slideUrls.length === 0) return;
      var meta = slugFromUrl(slideUrls[index], index);
      if (tagEl) tagEl.textContent = meta.tag;
      if (titleEl) titleEl.textContent = meta.title;
      if (bodyEl) bodyEl.textContent = "";
      var slides = slidesContainer ? slidesContainer.querySelectorAll(".landingSlideshow-slide") : [];
      slides.forEach(function (s, i) {
        s.classList.toggle("active", i === index);
      });
      var navItems = navContainer ? navContainer.querySelectorAll(".landingSlideshow-nav-item") : [];
      navItems.forEach(function (n, i) {
        n.classList.toggle("active", i === index);
      });
    }

    function loadSlideshowUrls(cb) {
      fetch(ASCII_IMAGES_MANIFEST)
        .then(function (r) {
          if (!r.ok) throw new Error(r.status + " " + r.statusText);
          return r.json();
        })
        .then(function (arr) {
          if (!Array.isArray(arr)) arr = [];
          var list = arr.filter(function (x) {
            return typeof x === "string" && x.trim() && SUPPORTED_IMAGES.some(function (ext) {
              return x.toLowerCase().trim().endsWith(ext);
            });
          });
          cb(list.map(function (f) { return ASCII_BASE + encodeURIComponent(f.trim()); }));
        })
        .catch(function () { cb([]); });
    }

    function generateAsciiYear(url, cb) {
      var opts = { charsetMode: "pixelperfect", useSafeChar: false };
      if (typeof window.ImageToAscii === "undefined") {
        cb(null);
        return;
      }
      window.ImageToAscii.loadImageAndConvertToAscii(url, ASCII_CANVAS_COLS, ASCII_CANVAS_ROWS, opts, cb, function () { cb(null); });
    }

    function goToSlide(index) {
      if (slideUrls.length === 0) return;
      slideIndex = index % slideUrls.length;
      if (slideIndex < 0) slideIndex += slideUrls.length;
      var url = slideUrls[slideIndex];
      var key = cacheKeyYear(url);
      var grid = asciiCache[key];
      var img = new Image();
      if (/^https?:/i.test(url)) img.crossOrigin = "anonymous";
      img.onload = function () {
        if (!grid) {
          generateAsciiYear(url, function (g) {
            asciiCache[key] = g;
            showSlide(img, g);
            updateOverlayAndActive(slideIndex);
          });
        } else {
          showSlide(img, grid);
          updateOverlayAndActive(slideIndex);
        }
      };
      img.onerror = function () {
        showSlide(null, grid || null);
        updateOverlayAndActive(slideIndex);
      };
      img.src = url;
    }

    function scheduleSlide() {
      if (slideTimer) clearTimeout(slideTimer);
      if (slideUrls.length <= 1) return;
      slideTimer = setTimeout(function () {
        if (!tabVisible || !inView) {
          scheduleSlide();
          return;
        }
        goToSlide(slideIndex + 1);
        scheduleSlide();
      }, SLIDE_DURATION_MS);
    }

    canvasEl.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      renderer.toggleMode();
      updateCaption();
      if (navigator.vibrate) navigator.vibrate(10);
    });

    document.addEventListener("visibilitychange", function () {
      tabVisible = !document.hidden;
    });

    var section = canvasEl.closest(".section-ascii") || canvasEl.closest("section");
    if (section) {
      var io = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
      }, { threshold: 0.05, rootMargin: "80px" });
      io.observe(section);
    }

    loadSlideshowUrls(function (urls) {
      slideUrls = urls;
      if (urls.length === 0) {
        if (captionEl) captionEl.textContent = "Drop images in assets/ascii/ and list them in assets/ascii/images.json";
        if (tagEl) tagEl.textContent = "—";
        if (titleEl) titleEl.textContent = "No images";
        var emptyCtx = canvasEl.getContext("2d");
        if (emptyCtx) {
          emptyCtx.fillStyle = "#0a0a0a";
          emptyCtx.fillRect(0, 0, ASCII_CANVAS_SIZE, ASCII_CANVAS_SIZE);
        }
        return;
      }
      buildSlidesDOM(slideUrls);
      buildNavDOM(slideUrls, goToSlide);
      goToSlide(0);
      scheduleSlide();
    });
  }

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
      ctx.font = fontSize + "px " + MONOSPACE_FONT;
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
    var url;
    if (uiState.currentArtist) {
      url = uiState.currentArtist.coverUrl;
      grid = uiState.asciiCache[cacheKey(url)] || null;
      caption = "Now playing: " + uiState.currentArtist.name + " — cover";
    } else if (uiState.slideshowUrls.length > 0) {
      url = uiState.slideshowUrls[uiState.slideshowIndex];
      grid = uiState.asciiCache[cacheKey(url)] || null;
      caption = "Breakcore Visions - Slide " + (uiState.slideshowIndex + 1) + "/" + uiState.slideshowUrls.length;
    } else {
      caption = "Drop images in assets/ascii/ and list them in assets/ascii/images.json";
    }
    if (!grid && url) {
      generateAsciiFromImage(url, ASCII_COLS, ASCII_ROWS, function (g) {
        uiState.asciiCache[cacheKey(url)] = g;
        showCurrentSlide();
      });
      return;
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
      li.textContent = "Drop music folders here! (Add folders to assets/music/ or assets/ascii/, or any folder with cover.png + audio)";
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
      var key = cacheKey(url);
      if (uiState.asciiCache[key]) {
        showCurrentSlide();
      } else {
        generateAsciiFromImage(url, ASCII_COLS, ASCII_ROWS, function (grid) {
          uiState.asciiCache[key] = grid;
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
    if (document.querySelector(".landingSlideshow-asciiCanvas")) {
      initYear0001Toggle();
      return;
    }
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
        coverUrl: folder.coverUrl || ASSETS_BASE + (folder.cover || folder.path + "/cover.png")
      };
      var key = cacheKey(uiState.currentArtist.coverUrl);
      if (uiState.asciiCache[key]) {
        showCurrentSlide();
      } else {
        generateAsciiFromImage(uiState.currentArtist.coverUrl, ASCII_COLS, ASCII_ROWS, function (grid) {
          uiState.asciiCache[key] = grid;
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
        var key = cacheKey(url);
        if (!uiState.asciiCache[key]) return;
        firstShown = true;
        uiState.slideshowIndex = 0;
        showCurrentSlide();
        scheduleSlideshow();
      }
      urls.forEach(function (url, i) {
        var key = cacheKey(url);
        if (uiState.asciiCache[key]) {
          if (i === 0) tryShowFirst();
          return;
        }
        generateAsciiFromImage(url, ASCII_COLS, ASCII_ROWS, function (grid) {
          uiState.asciiCache[key] = grid;
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
