/**
 * Winamp-style player — playlist from assets/music/folders.json (same folder/dropdown UI as Music Library).
 * Uses global audio (setPlaylistTrack). Play, Pause, Prev, Next, Seek, Volume.
 */
(function () {
  var FOLDERS_URL = new URL("assets/music/folders.json", window.location.href).href;
  var MUSIC_BASE = new URL("assets/music/", window.location.href).href.replace(/\/?$/, "/");
  var ASSETS_BASE = new URL("assets/", window.location.href).href.replace(/\/?$/, "/");

  var playlist = [];
  var currentIndex = -1;
  var listEl = document.getElementById("winamp-playlist");
  var countEl = document.getElementById("winamp-playlist-count");
  var nowplayingEl = document.querySelector(".viz-track");
  var seekEl = document.getElementById("winamp-seek");
  var timeEl = document.getElementById("winamp-time");
  var volumeEl = document.getElementById("winamp-volume");
  var btnPlay = document.querySelector(".viz-btn-play");
  var btnPause = document.querySelector(".viz-btn-pause");
  var btnPrev = document.querySelector(".viz-btn-prev");
  var btnNext = document.querySelector(".viz-btn-next");

  var audio = null;
  var playlistExpanded = {};

  function getAudio() {
    if (!audio && typeof window.getGlobalAudio === "function") audio = window.getGlobalAudio();
    return audio;
  }

  function encodePath(path) {
    return path.split("/").map(function (seg) { return encodeURIComponent(seg); }).join("/");
  }

  function trackUrl(fullPath) {
    return ASSETS_BASE + encodePath(fullPath);
  }

  function setTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    var fullPath = playlist[index];
    var name = fullPath.split("/").pop().replace(/\.[^.]+$/, "") || fullPath.replace(/\.[^.]+$/, "");
    var url = trackUrl(fullPath);
    if (typeof window.setPlaylistTrack === "function") window.setPlaylistTrack(url, name);
    if (nowplayingEl) nowplayingEl.textContent = name;
    if (listEl) {
      listEl.querySelectorAll("[data-playlist-index]").forEach(function (li) {
        li.classList.toggle("winamp-track-playing", parseInt(li.dataset.playlistIndex, 10) === index);
      });
    }
    var a = getAudio();
    if (a) {
      a.currentTime = 0;
      if (seekEl) seekEl.value = 0;
      updateTime();
    }
  }

  function play() {
    if (typeof window.playFirstOrSelectedTrack === "function") {
      window.playFirstOrSelectedTrack();
      return;
    }
    var a = getAudio();
    if (!a) return;
    if (currentIndex < 0 && playlist.length && (!a.src || a.src === "")) setTrack(0);
    if (a.readyState < 2) {
      var once = function () {
        a.removeEventListener("canplay", once);
        a.play().catch(function () {});
      };
      a.addEventListener("canplay", once);
    } else {
      a.play().catch(function () {});
    }
  }

  function pause() {
    if (getAudio()) getAudio().pause();
  }

  function prev() {
    if (typeof window.musicTreeHasContext === "function" && window.musicTreeHasContext()) {
      if (typeof window.musicTreePrev === "function") window.musicTreePrev();
      return;
    }
    if (currentIndex <= 0) {
      if (getAudio()) getAudio().currentTime = 0;
      return;
    }
    setTrack(currentIndex - 1);
    play();
  }

  function next() {
    if (typeof window.musicTreeHasContext === "function" && window.musicTreeHasContext()) {
      if (typeof window.musicTreeNext === "function") window.musicTreeNext();
      return;
    }
    if (currentIndex < 0 || currentIndex >= playlist.length - 1) return;
    setTrack(currentIndex + 1);
    play();
  }

  function updateTime() {
    var a = getAudio();
    if (!a || !timeEl) return;
    var cur = isNaN(a.currentTime) ? 0 : a.currentTime;
    var dur = isNaN(a.duration) || !isFinite(a.duration) ? 0 : a.duration;
    timeEl.textContent = formatTime(cur) + " / " + formatTime(dur);
    if (dur > 0 && seekEl) {
      seekEl.value = Math.round((cur / dur) * 100);
    }
  }

  function formatTime(s) {
    if (!isFinite(s) || s < 0) return "0:00";
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function bindControls() {
    if (btnPlay) btnPlay.addEventListener("click", function () { play(); });
    if (btnPause) btnPause.addEventListener("click", function () { pause(); });
    if (btnPrev) btnPrev.addEventListener("click", prev);
    if (btnNext) btnNext.addEventListener("click", next);

    if (seekEl) {
      seekEl.addEventListener("input", function () {
        var a = getAudio();
        if (!a || !isFinite(a.duration) || a.duration <= 0) return;
        var pct = parseFloat(seekEl.value, 10) / 100;
        if (isNaN(pct)) return;
        a.currentTime = Math.max(0, Math.min(pct * a.duration, a.duration));
      });
    }

    if (volumeEl) {
      volumeEl.addEventListener("input", function () {
        var a = getAudio();
        if (!a) return;
        var v = parseFloat(volumeEl.value, 10);
        if (!isNaN(v)) a.volume = Math.max(0, Math.min(1, v / 100));
      });
    }

    var a = getAudio();
    if (a) {
      a.addEventListener("timeupdate", updateTime);
      a.addEventListener("loadedmetadata", updateTime);
      a.addEventListener("ended", function () {
        if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
          setTrack(currentIndex + 1);
          play();
        }
      });
    }
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatTrackName(file) {
    return (file || "").replace(/\.[^.]+$/, "");
  }

  function togglePlaylistFolder(folderEl) {
    if (!folderEl) return;
    var tracksUl = folderEl.querySelector(".winamp-folder-tracks");
    var icon = folderEl.querySelector(".winamp-folder-icon");
    if (!tracksUl) return;
    var key = folderEl.dataset.folderKey || "";
    var expanded = folderEl.classList.toggle("winamp-folder-expanded");
    if (icon) icon.classList.toggle("expanded", expanded);
    tracksUl.classList.toggle("expanded", expanded);
    playlistExpanded[key] = expanded;
  }

  function buildPlaylistFromFolders(folders) {
    playlist = [];
    folders.forEach(function (entry) {
      var pathPrefix = entry.path || entry.name || "?";
      var tracks = Array.isArray(entry.tracks) ? entry.tracks : [];
      tracks.forEach(function (file) {
        playlist.push(pathPrefix + "/" + file);
      });
    });
  }

  function renderPlaylistTree(folders) {
    buildPlaylistFromFolders(folders);
    if (!listEl) {
      if (countEl) countEl.textContent = playlist.length;
      if (playlist.length && typeof window.setVizControlsEnabled === "function") window.setVizControlsEnabled(true);
      if (nowplayingEl && playlist.length === 0) nowplayingEl.textContent = "No track loaded. Drop audio or use playlist.";
      return;
    }
    listEl.innerHTML = "";

    folders.forEach(function (entry) {
      var name = entry.name || entry.path || "?";
      var pathPrefix = entry.path || name;
      var tracks = Array.isArray(entry.tracks) ? entry.tracks : [];
      var folderKey = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      var expanded = playlistExpanded[folderKey] !== false;

      var li = document.createElement("li");
      li.className = "winamp-folder-item" + (expanded ? " winamp-folder-expanded" : "");
      li.dataset.folderKey = folderKey;

      var label = document.createElement("span");
      label.className = "winamp-folder-label";
      label.innerHTML = '<span class="winamp-folder-icon' + (expanded ? " expanded" : "") + '" aria-hidden="true">▶</span> ' +
        escapeHtml(name) + "/ (" + tracks.length + ")";
      label.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePlaylistFolder(li);
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
          var fullPath = pathPrefix + "/" + file;
          var idx = playlist.indexOf(fullPath);
          var trackLi = document.createElement("li");
          trackLi.textContent = formatTrackName(file);
          trackLi.title = file;
          trackLi.dataset.playlistIndex = idx;
          trackLi.classList.add("winamp-track-playlist-item");
          trackLi.addEventListener("click", function (e) {
            e.stopPropagation();
            setTrack(idx);
            play();
          });
          tracksUl.appendChild(trackLi);
        });
      }
      li.appendChild(tracksUl);
      listEl.appendChild(li);
    });

    if (countEl) countEl.textContent = playlist.length;
    if (playlist.length && typeof window.setVizControlsEnabled === "function") window.setVizControlsEnabled(true);
    if (nowplayingEl && playlist.length === 0) nowplayingEl.textContent = "No track loaded. Drop audio or use playlist.";
  }

  function loadPlaylist() {
    fetch(FOLDERS_URL)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (arr) {
        var folders = Array.isArray(arr) ? arr : [];
        renderPlaylistTree(folders);
      })
      .catch(function () {
        playlist = [];
        if (listEl) listEl.innerHTML = "";
        if (countEl) countEl.textContent = "0";
        if (nowplayingEl) nowplayingEl.textContent = "Playlist not found. Ensure assets/music/folders.json exists.";
      });
  }

  if (seekEl) {
    loadPlaylist();
    bindControls();
    var a = getAudio();
    if (volumeEl && a) {
      var v = parseFloat(volumeEl.value, 10);
      if (!isNaN(v)) a.volume = Math.max(0, Math.min(1, v / 100));
    }
    updateTime();
  }
})();
