/**
 * Winamp Folders — fully clickable nested folder browser.
 * Root toggle, folder expand/collapse, track play. localStorage persistence.
 * Integrates with viz-controls and ASCII cover display.
 */
(function () {
  var MUSIC_JSON = "assets/music.json";
  var FOLDERS_JSON = "assets/music/folders.json";
  var MUSIC_BASE = "assets/music/";
  var STORAGE_KEY = "winampFolders";
  var DEBOUNCE_MS = 150;

  var folderState = {};
  var library = [];
  var currentTrackEl = null;
  var playbackContext = null;
  var lastClick = 0;

  try {
    folderState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    folderState = {};
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(folderState));
    } catch (e) {}
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatTrackName(filename) {
    return (filename || "").replace(/\.[^.]+$/, "");
  }

  function loadLibrary(callback) {
    fetch(MUSIC_JSON)
      .then(function (r) {
        if (!r.ok) throw new Error("no music.json");
        return r.json();
      })
      .then(function (data) {
        var lib = data && data.library;
        if (Array.isArray(lib) && lib.length) {
          callback(lib);
          return;
        }
        throw new Error("empty");
      })
      .catch(function () {
        fetch(FOLDERS_JSON)
          .then(function (r) {
            return r.ok ? r.json() : [];
          })
          .then(function (arr) {
            if (!Array.isArray(arr) || arr.length === 0) {
              callback([]);
              return;
            }
            fetch(MUSIC_JSON)
              .then(function (r2) {
                return r2.ok ? r2.json() : { library: [] };
              })
              .then(function (data2) {
                var lib = (data2 && data2.library) || [];
                var byArtist = {};
                lib.forEach(function (e) { byArtist[e.artist] = e; });
                var merged = arr.map(function (o) {
                  var name = o.name || o.path || "?";
                  return byArtist[name] || { artist: name, cover: (o.cover || name + "/cover.png"), tracks: [] };
                });
                callback(merged);
              })
              .catch(function () { callback([]); });
          })
          .catch(function () { callback([]); });
      });
  }

  function toggleRoot() {
    var toggle = document.getElementById("winamp-folders-toggle");
    var wrap = document.getElementById("winamp-folders-list-wrap");
    var panel = document.getElementById("winamp-folders-panel");
    if (!toggle || !wrap || !panel) return;
    var collapsed = panel.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    wrap.setAttribute("aria-hidden", collapsed ? "true" : "false");
    folderState._root = !collapsed;
    saveState();
  }

  function getFolderId(artist) {
    return (artist || "").replace(/[^a-z0-9]/gi, "_").toLowerCase();
  }

  function toggleFolder(folderEl) {
    if (!folderEl) return;
    var tracks = folderEl.querySelector(".winamp-folder-tracks");
    var icon = folderEl.querySelector(".winamp-folder-icon");
    if (!tracks) return;
    var artist = folderEl.dataset.artist;
    var id = getFolderId(artist);
    var expanded = folderEl.classList.toggle("winamp-folder-expanded");
    if (icon) icon.classList.toggle("expanded", expanded);
    tracks.classList.toggle("expanded", expanded);
    folderState[id] = expanded;
    saveState();
  }

  function playTrack(trackEl) {
    var now = Date.now();
    if (now - lastClick < DEBOUNCE_MS) return;
    lastClick = now;

    var trackPath = trackEl.dataset.trackPath || trackEl.getAttribute("title");
    var artist = trackEl.dataset.artist;
    var cover = trackEl.dataset.cover;
    var coverUrl = trackEl.dataset.coverUrl;
    if (!trackPath) return;

    var url = MUSIC_BASE + encodeURIComponent(trackPath).replace(/%2F/g, "/");
    var displayName = formatTrackName(trackPath.split("/").pop() || trackPath);

    if (typeof window.setPlaylistTrack === "function") {
      window.setPlaylistTrack(url, displayName);
    }
    if (typeof window.setVizControlsEnabled === "function") {
      window.setVizControlsEnabled(true);
    }

    var audio = typeof window.getGlobalAudio === "function" ? window.getGlobalAudio() : null;
    if (audio) {
      var doPlay = function () { audio.play().catch(function () {}); };
      if (audio.readyState >= 2) doPlay();
      else {
        audio.addEventListener("canplay", function once() {
          audio.removeEventListener("canplay", once);
          doPlay();
        });
        doPlay();
      }
    }

    /* Prev/Next context */
    var entry = library.find(function (e) { return e.artist === artist; });
    var tracks = (entry && entry.tracks) || [];
    var idx = tracks.indexOf(trackPath.split("/").pop());
    playbackContext = entry && idx >= 0 ? { entry: entry, trackIndex: idx, tracks: tracks } : null;

    if (currentTrackEl) currentTrackEl.classList.remove("winamp-track-playing");
    currentTrackEl = trackEl;
    trackEl.classList.add("winamp-track-playing");

    var nowplayingEl = document.querySelector(".viz-track");
    if (nowplayingEl) nowplayingEl.textContent = displayName;

    if (typeof console !== "undefined" && console.log) {
      console.log("Playing:", trackPath.split("/").pop());
    }

    document.dispatchEvent(new CustomEvent("music-tree:play-track", {
      detail: {
        track: { path: trackPath, name: displayName },
        folder: {
          name: artist,
          cover: cover || artist + "/cover.png",
          coverUrl: coverUrl || MUSIC_BASE + (cover || artist + "/cover.png")
        }
      }
    }));
  }

  function findTrackEl(path) {
    var items = document.querySelectorAll(".winamp-folder-tracks li[data-track-path]");
    for (var i = 0; i < items.length; i++) {
      if (items[i].dataset.trackPath === path) return items[i];
    }
    return null;
  }

  function prevTrack() {
    if (!playbackContext) return;
    var ctx = playbackContext;
    if (ctx.trackIndex <= 0) return;
    var prevFile = ctx.tracks[ctx.trackIndex - 1];
    var path = ctx.entry.artist + "/" + prevFile;
    var el = findTrackEl(path);
    if (el) playTrack(el);
  }

  function nextTrack() {
    if (!playbackContext) return;
    var ctx = playbackContext;
    if (ctx.trackIndex >= ctx.tracks.length - 1) return;
    var nextFile = ctx.tracks[ctx.trackIndex + 1];
    var path = ctx.entry.artist + "/" + nextFile;
    var el = findTrackEl(path);
    if (el) playTrack(el);
  }

  window.musicTreePrev = prevTrack;
  window.musicTreeNext = nextTrack;
  window.musicTreeHasContext = function () { return !!playbackContext; };

  function render(lib) {
    library = lib;
    var listEl = document.getElementById("winamp-folders-list");
    var countEl = document.getElementById("winamp-folder-count");
    if (!listEl) return;

    listEl.innerHTML = "";
    if (!lib || lib.length === 0) {
      var empty = document.createElement("li");
      empty.className = "winamp-folder-item winamp-folder-empty";
      empty.textContent = "Empty folder. Run npm run music-scan and add folders with cover.png + audio to assets/music/.";
      listEl.appendChild(empty);
      if (countEl) countEl.textContent = "0";
      return;
    }

    var fragment = document.createDocumentFragment();
    lib.forEach(function (entry) {
      var artist = entry.artist || "?";
      var cover = entry.cover || artist + "/cover.png";
      var tracks = Array.isArray(entry.tracks) ? entry.tracks : [];
      var coverUrl = MUSIC_BASE + cover.replace(/\/\/+/g, "/");
      var folderId = getFolderId(artist);
      var expanded = folderState[folderId] !== false;

      var li = document.createElement("li");
      li.className = "winamp-folder-item" + (expanded ? " winamp-folder-expanded" : "");
      li.setAttribute("role", "option");
      li.dataset.artist = artist;
      li.dataset.cover = cover;
      li.dataset.coverUrl = coverUrl;

      var label = document.createElement("span");
      label.className = "winamp-folder-label";
      label.innerHTML = '<span class="winamp-folder-icon' + (expanded ? " expanded" : "") + '" aria-hidden="true">▶</span> ' +
        escapeHtml(artist) + "/ (" + tracks.length + ")";
      label.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFolder(li);
      });

      li.appendChild(label);

      var tracksUl = document.createElement("ul");
      tracksUl.className = "winamp-folder-tracks" + (expanded ? " expanded" : "");

      if (tracks.length === 0) {
        var emptyLi = document.createElement("li");
        emptyLi.className = "winamp-track-empty";
        emptyLi.textContent = "Empty folder";
        tracksUl.appendChild(emptyLi);
      } else {
        tracks.forEach(function (file) {
          var path = artist + "/" + file;
          var trackLi = document.createElement("li");
          trackLi.textContent = formatTrackName(file);
          trackLi.title = file;
          trackLi.dataset.trackPath = path;
          trackLi.dataset.artist = artist;
          trackLi.dataset.cover = cover;
          trackLi.dataset.coverUrl = coverUrl;
          trackLi.addEventListener("click", function (e) {
            e.stopPropagation();
            playTrack(trackLi);
          });
          tracksUl.appendChild(trackLi);
        });
      }

      li.appendChild(tracksUl);
      fragment.appendChild(li);
    });
    listEl.appendChild(fragment);

    if (countEl) countEl.textContent = lib.length;

    /* Root toggle state */
    var panel = document.getElementById("winamp-folders-panel");
    var wrap = document.getElementById("winamp-folders-list-wrap");
    var toggle = document.getElementById("winamp-folders-toggle");
    if (folderState._root === false && panel && wrap && toggle) {
      panel.classList.add("is-collapsed");
      wrap.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  function bindRootToggle() {
    var toggle = document.getElementById("winamp-folders-toggle");
    if (toggle) toggle.addEventListener("click", toggleRoot);
  }

  function setupKeyboard() {
    document.addEventListener("keydown", function (e) {
      var target = e.target;
      if (!target.closest) return;
      var item = target.closest(".winamp-folder-label, .winamp-folder-tracks li");
      if (!item) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (item.classList.contains("winamp-folder-label")) {
          var folder = item.closest(".winamp-folder-item");
          if (folder) toggleFolder(folder);
        } else {
          playTrack(item);
        }
      }
    });
  }

  function init() {
    bindRootToggle();
    setupKeyboard();
    loadLibrary(render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
