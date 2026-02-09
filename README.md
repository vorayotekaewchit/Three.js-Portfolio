# Three.js Portfolio

Static portfolio: Three.js hero particles, ASCII slideshow, audio viz. No build step.

## Does audio play on the site?

- **Load file** (in the Audio Visualizer section): **Yes.** You pick an audio file from your device and it plays. Works locally and on GitHub Pages.
- **Music Library (playlist)**: Only if (1) there are audio files (e.g. `.mp3`) in `assets/music/` (e.g. inside `Lune Album/`) and they are committed to the repo, and (2) the app has a track list. The track list comes from `assets/music.json`, which is **gitignored** by default, so it is not deployed to GitHub Pages. To have playlist audio on the live site:
  1. Add audio files into `assets/music/` (e.g. `assets/music/Lune Album/`).
  2. Run `npm run music-scan` (or `node scripts/music-scanner.js`) to generate `assets/music.json`.
  3. Either commit `assets/music.json` (e.g. remove it from `.gitignore` for that file) so GitHub Pages serves it, or generate it in CI before deploy.

Right now there are no audio files in `assets/music/` in the repo, so the Music Library shows folders but no tracks to play on the deployed site.

**iOS / large files:** On iPhone, "Load file" uses the system picker (Photo Library, Take Video, Choose File). Very large `.wav` files (e.g. 50+ MB) can be slow or fail to open on mobile. Prefer `.mp3` or `.m4a` for mobile, or use shorter/smaller files. **GitHub:** The repo ignores `.wav` in `assets/music/` (see `.gitignore`); GitHub itself allows any file type up to 100 MB per file.

## Run locally

```bash
npx serve
# or open index.html in a browser
```

## Deploy on GitHub Pages

1. Push the repo to GitHub.
2. **Settings** → **Pages** → **Build and deployment**.
3. **Source**: Deploy from a branch.
4. **Branch**: `main` (or your default branch), folder **/ (root)**.
5. Save. The site will be at `https://<username>.github.io/<repo-name>/`.

If the repo is named `Three.js-Portfolio`, the URL is `https://<username>.github.io/Three.js-Portfolio/`.
