# Music folder

**Music Library shows:** anything in `assets/music/`, anything in `assets/ascii/`, and any folder under `assets/` that has a cover image (`cover.png` / `cover.jpg` etc.) in the same folder as supported audio (`.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`).

## Auto-update (recommended)

1. **From the project root**, start the watcher: `npm run music-scan`  
   (The script writes `assets/music.json` and updates `assets/music/folders.json`. It watches `assets/music/` and `assets/ascii/`; other folders are picked up on each scan.)
2. **Add music in any of these ways:**
   - **assets/music/** — drop artist/album folders (each with optional `cover.png` and audio files).
   - **assets/ascii/** — drop subfolders that contain audio (optional cover).
   - **Any folder under assets/** — if it contains both a `cover.png` (or `cover.jpg` etc.) and at least one audio file, it will appear in the Music Library.
3. **Open the site with a local server** (e.g. Live Server from the project folder) and **refresh** — the Music Library list is in the **Audio Visualizer** section (scroll to it). Expand **“MUSIC LIBRARY (N)”** if it’s collapsed.

**If the list is empty:** Open DevTools → Console. You should see either `Music library: 3 artist(s) from assets/music.json` or `from assets/music/folders.json`. If you see a warning about both failing, serve the site from the project root (not `file://`) and ensure `assets/music/folders.json` or `assets/music.json` exists.

## Manual setup

- **Audio player:** List **exact filenames** in **playlist.json** for the Winamp-style player.
- **Folder view:** The scanner writes **folders.json** from your artist folders. To do it by hand: add `name`, `path`, `cover` per artist (see example below).

## folders.json / music.json

- **folders.json** — used by the Winamp ASCII folder view (artist list + cover). Auto-written by `npm run music-scan`.
- **music.json** — full library (`library[]`, `lastScan`, `totalArtists`). Auto-written by the scanner; optional for future UI. Gitignored.

Example **folders.json** shape:

```json
[
  { "name": "TRACKERCORPS VOL. 1", "path": "Various Artists - TRACKERCORPS VOL. 1", "cover": "Various Artists - TRACKERCORPS VOL. 1/cover.png" }
]
```

## playlist.json (audio player)

Flat list of track filenames for the Winamp player:

```json
["my-song.mp3", "another-track.ogg"]
```

---

**ASCII slideshow** uses **assets/ascii/images.json** and images in **assets/ascii/**.
