#!/usr/bin/env node
/**
 * Music Scanner — watches assets/music/ and auto-updates music.json + folders.json.
 * Run: node scripts/music-scanner.js  (or npm run music-scan)
 * Drop folders with cover.png + audio files → JSON updates → Winamp UI shows new artists.
 */

const fs = require("fs");
const path = require("path");

const MUSIC_DIR = path.join(process.cwd(), "assets", "music");
const MUSIC_JSON = path.join(process.cwd(), "assets", "music.json");
const FOLDERS_JSON = path.join(MUSIC_DIR, "folders.json");
const AUDIO_EXT = [".mp3", ".flac", ".wav", ".m4a", ".ogg"];
const COVER_NAMES = ["cover.png", "cover.jpg", "cover.webp", "cover.jpeg"];
const POLL_INTERVAL_MS = 2000;
const DEBOUNCE_MS = 400;

let debounceTimer = null;
let lastLibraryHash = "";

function log(msg, icon = "") {
  const prefix = icon ? `${icon} ` : "";
  console.log(prefix + msg);
}

function getCoverPath(files) {
  const lower = files.map((f) => f.toLowerCase());
  for (const name of COVER_NAMES) {
    if (lower.includes(name)) return name;
  }
  return null;
}

function getAudioFiles(files) {
  return files
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return AUDIO_EXT.includes(ext);
    })
    .sort();
}

function scanMusicFolder() {
  if (!fs.existsSync(MUSIC_DIR)) {
    try {
      fs.mkdirSync(MUSIC_DIR, { recursive: true });
      log("Created assets/music/", "📁");
    } catch (err) {
      console.warn("Could not create assets/music/:", err.message);
      return [];
    }
  }

  let entries;
  try {
    entries = fs.readdirSync(MUSIC_DIR, { withFileTypes: true });
  } catch (err) {
    console.warn("Could not read assets/music/:", err.message);
    return [];
  }

  const library = [];
  const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

  for (const dir of subdirs) {
    const dirPath = path.join(MUSIC_DIR, dir.name);
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch (err) {
      continue;
    }

    const coverPath = getCoverPath(files);
    const tracks = getAudioFiles(files);

    if (tracks.length === 0) continue;

    const coverRel = coverPath ? `${dir.name}/${coverPath}` : null;
    let lastModified;
    try {
      lastModified = fs.statSync(dirPath).mtime.toISOString();
    } catch {
      lastModified = new Date().toISOString();
    }

    library.push({
      artist: dir.name,
      cover: coverRel,
      tracks,
      totalTracks: tracks.length,
      lastModified,
    });
  }

  library.sort((a, b) => a.artist.localeCompare(b.artist, "en", { sensitivity: "base" }));

  return library;
}

function hashLibrary(library) {
  return JSON.stringify(
    library.map((a) => [a.artist, a.cover, a.tracks.length].join("|"))
  );
}

function writeMusicJson(library) {
  const now = new Date().toISOString();
  const data = {
    library,
    lastScan: now,
    totalArtists: library.length,
  };

  try {
    const dir = path.dirname(MUSIC_JSON);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MUSIC_JSON, JSON.stringify(data, null, 2), "utf8");
    if (library.length > 0) {
      log("Wrote: " + path.resolve(MUSIC_JSON), "📄");
    }
  } catch (err) {
    console.warn("Could not write music.json:", err.message);
  }
}

function writeFoldersJson(library) {
  const arr = library.map((a) => ({
    name: a.artist,
    path: a.artist,
    cover: a.cover || `${a.artist}/cover.png`,
  }));

  try {
    fs.writeFileSync(FOLDERS_JSON, JSON.stringify(arr, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not write folders.json:", err.message);
  }
}

function runScan() {
  const library = scanMusicFolder();
  const hash = hashLibrary(library);

  if (hash === lastLibraryHash) return;
  lastLibraryHash = hash;

  writeMusicJson(library);
  writeFoldersJson(library);

  const totalTracks = library.reduce((s, a) => s + a.totalTracks, 0);
  log(`${library.length} artists, ${totalTracks} tracks → music.json + folders.json updated`, "💾");
}

function debouncedScan() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runScan();
  }, DEBOUNCE_MS);
}

function watch() {
  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
  }

  runScan();

  try {
    const watcher = fs.watch(MUSIC_DIR, { recursive: false }, (eventType, filename) => {
      if (!filename || path.basename(filename).startsWith(".")) return;
      debouncedScan();
    });
    watcher.on("error", () => {
      log("Watch error; using polling only.", "⚠️");
      try {
        watcher.close();
      } catch (_) {}
    });
    log("Watching assets/music/", "📁");
  } catch (err) {
    log("fs.watch not available, using polling only.", "⚠️");
  }

  setInterval(runScan, POLL_INTERVAL_MS);
}

function main() {
  log("Music Scanner v1.0", "🟢");

  process.on("SIGINT", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    runScan();
    log("Bye.", "👋");
    process.exit(0);
  });

  watch();
}

main();
