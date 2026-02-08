#!/usr/bin/env node
/**
 * Music Scanner — watches assets/music/, assets/ascii/, and any folder with cover.png + audio.
 * Run: node scripts/music-scanner.js  (or npm run music-scan)
 * Music Library shows: assets/music/, assets/ascii/, and any folder under assets with cover + audio.
 */

import fs from "fs";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "assets");
const MUSIC_DIR = path.join(ASSETS_DIR, "music");
const ASCII_DIR = path.join(ASSETS_DIR, "ascii");
const MUSIC_JSON = path.join(process.cwd(), "assets", "music.json");
const FOLDERS_JSON = path.join(MUSIC_DIR, "folders.json");
const AUDIO_EXT = [".mp3", ".flac", ".wav", ".m4a", ".ogg"];
const COVER_NAMES = ["cover.png", "cover.jpg", "cover.webp", "cover.jpeg", "cover.svg"];
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

/** Normalize path to use forward slashes (for URLs). */
function folderPathRel(baseDir, dirPath) {
  const rel = path.relative(baseDir, dirPath);
  return rel.split(path.sep).join("/");
}

/**
 * Scan a single directory for artist/album entries: subdirs with at least one audio file.
 * folderPrefix is the path segment before the subdir name (e.g. "music" or "ascii").
 */
function scanDirForAlbums(baseDir, folderPrefix) {
  if (!fs.existsSync(baseDir)) return [];

  let entries;
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch (err) {
    return [];
  }

  const result = [];
  const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

  for (const dir of subdirs) {
    const dirPath = path.join(baseDir, dir.name);
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch (err) {
      continue;
    }

    const coverPath = getCoverPath(files);
    const tracks = getAudioFiles(files);

    if (tracks.length === 0) continue;

    const folderPath = folderPrefix + "/" + dir.name;
    const coverRel = coverPath ? folderPath + "/" + coverPath : null;
    let lastModified;
    try {
      lastModified = fs.statSync(dirPath).mtime.toISOString();
    } catch {
      lastModified = new Date().toISOString();
    }

    result.push({
      artist: dir.name,
      folderPath,
      cover: coverRel,
      tracks,
      totalTracks: tracks.length,
      lastModified,
    });
  }

  return result;
}

/**
 * Recursively find folders under assets that contain both a cover image and audio files.
 * Does not add folders already in existingPaths (e.g. from music/ or ascii/).
 */
function scanCoverAudioFolders(existingPaths) {
  const seen = new Set(existingPaths || []);
  const result = [];

  function walk(dirPath) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;

      const childPath = path.join(dirPath, e.name);
      const rel = folderPathRel(ASSETS_DIR, childPath);

      if (rel.startsWith("music/") || rel.startsWith("ascii/")) continue;

      let files;
      try {
        files = fs.readdirSync(childPath);
      } catch (err) {
        walk(childPath);
        continue;
      }

      const hasCover = getCoverPath(files) !== null;
      const tracks = getAudioFiles(files);

      if (hasCover && tracks.length > 0 && !seen.has(rel)) {
        seen.add(rel);
        const coverName = getCoverPath(files);
        const coverRel = rel + "/" + coverName;
        let lastModified;
        try {
          lastModified = fs.statSync(childPath).mtime.toISOString();
        } catch {
          lastModified = new Date().toISOString();
        }
        result.push({
          artist: e.name,
          folderPath: rel,
          cover: coverRel,
          tracks,
          totalTracks: tracks.length,
          lastModified,
        });
      }

      walk(childPath);
    }
  }

  if (fs.existsSync(ASSETS_DIR)) walk(ASSETS_DIR);
  return result;
}

function scanMusicFolder() {
  if (!fs.existsSync(MUSIC_DIR)) {
    try {
      fs.mkdirSync(MUSIC_DIR, { recursive: true });
      log("Created assets/music/", "📁");
    } catch (err) {
      console.warn("Could not create assets/music/:", err.message);
    }
  }

  const fromMusic = scanDirForAlbums(MUSIC_DIR, "music");
  const fromAscii = scanDirForAlbums(ASCII_DIR, "ascii");
  const existingPaths = fromMusic.map((e) => e.folderPath).concat(fromAscii.map((e) => e.folderPath));
  const coverAudio = scanCoverAudioFolders(existingPaths);

  const library = [...fromMusic, ...fromAscii, ...coverAudio];
  library.sort((a, b) => a.artist.localeCompare(b.artist, "en", { sensitivity: "base" }));

  return library;
}

function hashLibrary(library) {
  return JSON.stringify(
    library.map((a) => [a.artist, a.folderPath, a.cover, a.tracks.length].join("|"))
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
    path: a.folderPath,
    cover: a.cover || `${a.folderPath}/cover.png`,
  }));

  try {
    if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
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
    const onWatch = (eventType, filename) => {
      if (!filename || path.basename(filename).startsWith(".")) return;
      debouncedScan();
    };
    if (fs.existsSync(MUSIC_DIR)) {
      fs.watch(MUSIC_DIR, { recursive: false }, onWatch);
      log("Watching assets/music/", "📁");
    }
    if (fs.existsSync(ASCII_DIR)) {
      fs.watch(ASCII_DIR, { recursive: false }, onWatch);
      log("Watching assets/ascii/", "📁");
    }
  } catch (err) {
    log("fs.watch not available; using polling only.", "⚠️");
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
