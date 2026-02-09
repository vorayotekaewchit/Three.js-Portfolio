# Hero particle visualizer – troubleshooting

You **do not need to install any dependencies**. The site uses Three.js and other scripts via `<script>` tags in `index.html` (no npm install for the hero viz).

## If you don’t see the particles

1. **Turn on debug logs**
   - Open the page, then open **DevTools** (F12 or right‑click → Inspect) and go to the **Console** tab.
   - In the console, run:
     ```js
     window.AUDIO_PARTICLES_DEBUG = true;
     ```
   - Refresh the page. You should see messages like:
     - `[audio-particles] Container found, THREE ok`
     - `[audio-particles] init start`
     - `[audio-particles] Renderer canvas appended to #hero-particles`
     - `[audio-particles] Container size after first resize: W x H`
     - `[audio-particles] First frame rendered`
   - If you see **"Init error: ..."**, that message will tell you what failed.

2. **Check the canvas**
   - With debug on, the particle canvas gets a **green outline**. If you see that outline but no particles, the scene is rendering but the mesh might be off‑screen or too small.
   - In the **Elements** tab, find `#hero-particles` and confirm it has a `<canvas>` inside and that the div has a non‑zero width/height (e.g. in **Computed** or by hovering).

3. **Script order**
   - In `index.html`, **Three.js** must load before `audio-particles.js`. The current order is:
     - `three.js/r128/three.min.js`
     - … other scripts …
     - `js/audio-particles.js`
   - If you added or reordered scripts, put Three.js first.

4. **Container size**
   - The hero block (`.landingSlideshow`) needs a height (e.g. `min-height: 100vh` in CSS). If `#hero-particles` has zero height, the canvas will be 0×0 and nothing will show. Debug logs will show `Container size after first resize: 0 x 0` in that case.

5. **Errors in console**
   - Look for red errors in the Console. Any error inside `audio-particles.js` will stop the visualizer from running; the debug log will usually show **"Init error: ..."** with the message.

## Quick checks

| Check | How |
|-------|-----|
| Is `#hero-particles` in the DOM? | Elements tab → search for `hero-particles` |
| Is Three.js loaded? | Console: type `typeof THREE` → should be `"object"` |
| Is the canvas there? | Inside `#hero-particles` you should see a `<canvas>` |
| Container size | Debug on + refresh, then read the “Container size after first resize” log |
