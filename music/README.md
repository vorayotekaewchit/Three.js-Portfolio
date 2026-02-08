# Album covers for the ASCII slideshow

## How to add your images (3 steps)

### 1. Put image files in this folder

Copy your album/playlist artwork into the `music/` folder.  
Use **exact** filenames (including capitals and extension), for example:

- `album1.jpg`
- `breakcore.png`
- `playlist.webp`

Supported: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

### 2. List those filenames in `images.json`

Open `music/images.json` and edit the list so it matches your files:

```json
[
  "album1.jpg",
  "breakcore.png",
  "playlist.webp"
]
```

- One filename per line, in quotes, separated by commas.
- The name must match the file in the folder exactly (including `.jpg` / `.png` etc.).

### 3. Open the site with a local server

Do **not** double‑click `index.html` (that uses `file://` and the slideshow won’t load the images).

Use one of these instead:

- **VS Code:** Right‑click `index.html` → “Open with Live Server”
- **Terminal:** In the project folder run `npx serve` or `python3 -m http.server 8000`, then open `http://localhost:8000` (or the URL it shows)

---

## If the slideshow doesn’t show your images

### Step 1: Open the browser console

- **Chrome / Edge:** `F12` or right‑click the page → “Inspect” → click the **Console** tab.
- **Safari:** Enable the Develop menu, then “Show JavaScript Console”.
- **Firefox:** `F12` → **Console** tab.

### Step 2: Reload the page and read the message

After you reload, look for a line that starts with **ASCII slideshow**.

- **“ASCII slideshow: 3 images loaded from music/”** (number may vary)  
  → Images are loading. If you still don’t see them, check that you’re looking at the ASCII section and that the filenames in `images.json` match the files in `music/`.

- **“ASCII slideshow: No images found. Check music/images.json and open the site with a server (not file://).”**  
  → Either `music/images.json` is missing/wrong, or the page was opened as `file://`. Fix `images.json` and/or use a local server (see step 3 above).

- **“ASCII slideshow: Failed to load image: music/something.jpg”**  
  → That file is not in the `music/` folder, or the name in `images.json` doesn’t match (typo, wrong extension, or wrong case).

### Quick checklist

| Check | What to do |
|-------|------------|
| Files are in `music/` | Same folder as this README. |
| Names in `images.json` | Must match the file names exactly (e.g. `album1.jpg` not `Album1.JPG` unless the file is really named that). |
| Opened with a server | Use Live Server or `npx serve` / `python3 -m http.server`, not double‑clicking the HTML file. |
| Console message | Use the message (see Step 2 above) to see if the list loaded or which image failed. |

---

## Folder layout (for reference)

```
your-project/
├── index.html
├── js/
│   └── ascii-slideshow.js
└── music/              ← you are here
    ├── README.md       ← this file
    ├── images.json     ← list of filenames (edit this)
    ├── album1.jpg      ← your images
    ├── breakcore.png
    └── playlist.webp
```
