/**
 * Winamp-style player — playlist from assets/music/playlist.json.
 * Uses global audio (setPlaylistTrack). Play, Pause, Prev, Next, Seek, Volume.
 */
(function () {
  var PLAYLIST_URL = 'assets/music/playlist.json';
  var MUSIC_BASE = 'assets/music/';

  var playlist = [];
  var currentIndex = -1;
  var listEl = document.getElementById('winamp-playlist');
  var nowplayingEl = document.querySelector('.viz-track');
  var seekEl = document.getElementById('winamp-seek');
  var timeEl = document.getElementById('winamp-time');
  var volumeEl = document.getElementById('winamp-volume');
  var btnPlay = document.querySelector('.viz-btn-play');
  var btnPause = document.querySelector('.viz-btn-pause');
  var btnPrev = document.querySelector('.viz-btn-prev');
  var btnNext = document.querySelector('.viz-btn-next');

  var audio = null;

  function getAudio() {
    if (!audio && typeof window.getGlobalAudio === 'function') audio = window.getGlobalAudio();
    return audio;
  }

  function setTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    var file = playlist[index];
    var url = MUSIC_BASE + encodeURIComponent(file);
    var name = file.replace(/\.[^.]+$/, '');
    if (typeof window.setPlaylistTrack === 'function') window.setPlaylistTrack(url, name);
    if (nowplayingEl) nowplayingEl.textContent = name;
    if (listEl) {
      listEl.querySelectorAll('li').forEach(function (li, i) {
        li.classList.toggle('active', i === index);
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
    var a = getAudio();
    if (!a) return;
    if (currentIndex < 0 && playlist.length && (!a.src || a.src === '')) setTrack(0);
    if (a.readyState < 2) {
      var once = function () {
        a.removeEventListener('canplay', once);
        a.play().catch(function () {});
      };
      a.addEventListener('canplay', once);
    } else {
      a.play().catch(function () {});
    }
  }

  function pause() {
    if (getAudio()) getAudio().pause();
  }

  function prev() {
    if (typeof window.musicTreeHasContext === 'function' && window.musicTreeHasContext()) {
      if (typeof window.musicTreePrev === 'function') window.musicTreePrev();
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
    if (typeof window.musicTreeHasContext === 'function' && window.musicTreeHasContext()) {
      if (typeof window.musicTreeNext === 'function') window.musicTreeNext();
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
    timeEl.textContent = formatTime(cur) + ' / ' + formatTime(dur);
    if (dur > 0 && seekEl) {
      seekEl.value = Math.round((cur / dur) * 100);
    }
  }

  function formatTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function bindControls() {
    if (btnPlay) btnPlay.addEventListener('click', function () { play(); });
    if (btnPause) btnPause.addEventListener('click', function () { pause(); });
    if (btnPrev) btnPrev.addEventListener('click', prev);
    if (btnNext) btnNext.addEventListener('click', next);

    if (seekEl) {
      seekEl.addEventListener('input', function () {
        var a = getAudio();
        if (!a || !isFinite(a.duration) || a.duration <= 0) return;
        var pct = parseFloat(seekEl.value, 10) / 100;
        if (isNaN(pct)) return;
        a.currentTime = Math.max(0, Math.min(pct * a.duration, a.duration));
      });
    }

    if (volumeEl) {
      volumeEl.addEventListener('input', function () {
        var a = getAudio();
        if (!a) return;
        var v = parseFloat(volumeEl.value, 10);
        if (!isNaN(v)) a.volume = Math.max(0, Math.min(1, v / 100));
      });
    }

    var a = getAudio();
    if (a) {
      a.addEventListener('timeupdate', updateTime);
      a.addEventListener('loadedmetadata', updateTime);
      a.addEventListener('ended', function () {
        if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
          setTrack(currentIndex + 1);
          play();
        }
      });
    }
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    playlist.forEach(function (file, i) {
      var li = document.createElement('li');
      li.textContent = file.replace(/\.[^.]+$/, '');
      li.setAttribute('data-index', i);
      if (i === currentIndex) li.classList.add('active');
      li.addEventListener('click', function () {
        setTrack(i);
        play();
      });
      listEl.appendChild(li);
    });
  }

  function loadPlaylist() {
    fetch(PLAYLIST_URL)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (arr) {
        playlist = Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string' && x.trim(); }) : [];
        renderList();
        if (playlist.length && typeof window.setVizControlsEnabled === 'function') window.setVizControlsEnabled(true);
        if (nowplayingEl && !listEl && !playlist.length) {
          /* Tree UI: leave nowplaying as-is until user plays from tree */
        } else if (nowplayingEl && !playlist.length) {
          nowplayingEl.textContent = 'No tracks. Add files to assets/music/ and list them in playlist.json.';
        }
      })
      .catch(function () {
        playlist = [];
        renderList();
        if (nowplayingEl && listEl) nowplayingEl.textContent = 'Playlist not found. Run from a server and ensure assets/music/playlist.json exists.';
      });
  }

  if (listEl || seekEl) {
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
