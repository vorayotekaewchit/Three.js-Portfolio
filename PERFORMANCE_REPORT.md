# Performance Audit Report

**Target:** 3–5× faster, 60fps visuals, Lighthouse 95+

---

## Phase 1: Audit — Top 5 Bottlenecks Addressed

| # | Bottleneck | Impact | Fix |
|---|------------|--------|-----|
| 1 | **Layout thrashing** (DOM reads/writes every frame) | High | Cached section list (main.js), only update BASS/MID/HIGH DOM when value changed (pulse-visualizer), single DocumentFragment append (winampFolders) |
| 2 | **Expensive per-frame work** | High | Cached bar step/width in pulse visualizer; removed `geometry.computeVertexNormals()` every frame in swiss-visualizer; cached font in ASCII renderGrid |
| 3 | **No GPU/compositor hints** | Medium | `will-change: transform`, `transform: translateZ(0)`, `contain` on viz canvas, hero-particles, ASCII canvas, hero layers |
| 4 | **Blocking / heavy initial load** | Medium | Preload critical CSS; defer Three.js; requestIdleCallback for ASCII artist precache; fonts with `display=swap` |
| 5 | **Large list reflows** | Medium | DocumentFragment for folder list; `content-visibility: auto` + `contain-intrinsic-size` on folder/track items |

---

## Phase 2: Critical Fixes Implemented

### JavaScript
- **pulse-visualizer.js:** Cached `barStep`/`barW`; update BASS/MID/HIGH text only when value changed (`lastBass`/`lastMid`/`lastHigh`).
- **winamp-ascii.js:** Cached `lastFontSize` so `ctx.font` is set only when scale changes; precache artist ASCII with `requestIdleCallback` (one-by-one in idle time).
- **main.js:** Cached `document.querySelectorAll('section[id]')`; loop with early break when current section found.
- **page-scroll-manager.js:** Debounced history `replaceState` (150ms) to avoid scroll-handler spam.
- **swiss-visualizer.js:** Removed `geometry.computeVertexNormals()` per frame (MeshBasicMaterial doesn’t need it).
- **winampFolders.js:** Build full list in a `DocumentFragment`, then single `listEl.appendChild(fragment)` to minimize reflows.

### CSS
- **GPU / containment:** `.hero-particles`, `.section-ascii .winamp-ascii-canvas`, `.viz-canvas-wrap`, `.viz-canvas` / `#swiss-viz`, `.hero-bg-layer` — `will-change: transform`, `transform: translateZ(0)`, and `contain` where safe.
- **List performance:** `.viz-playlist-wrap .winamp-folder-item` and `.winamp-folder-tracks li` — `content-visibility: auto` and `contain-intrinsic-size: auto 32px` / `24px` for off-screen skipping.

### HTML / Loading
- Preload `styles.css` as style.
- Fonts link with `crossorigin`; already using `display=swap` in Google Fonts URL.
- Three.js loaded with `defer` so it doesn’t block parsing.

---

## Phase 3: Optimizations Summary

| Area | Before | After |
|------|--------|-------|
| **Viz RAF loop** | DOM write every frame (BASS/MID/HIGH) | DOM write only when value changed |
| **Spectrum bars** | Recompute step/barW every frame | Cached; reset on resize |
| **ASCII render** | Set `ctx.font` every frame | Set only when fontSize changed |
| **ASCII precache** | All artists in parallel (memory spike) | requestIdleCallback, one-by-one |
| **Scroll / history** | RAF on every scroll tick | Debounced 150ms then RAF |
| **Section detection** | querySelectorAll every scroll | Cached node list |
| **Folder list render** | N appends → N reflows | 1 appendChild(fragment) |
| **List items** | Always rendered | content-visibility: auto (browser skips off-screen) |

---

## Measurement Checklist

- **Before/after:** Run Lighthouse (Performance) and compare LCP, TBT, CLS. Target: ~50% reduction in TBT, LCP &lt; 2.5s.
- **FPS:** In DevTools Performance, record while scrolling and with viz + ASCII visible; confirm main thread and GPU stay within 60fps budget.
- **Memory:** Record heap before/after opening music library with 1000+ tracks; ensure no unbounded growth (content-visibility + fragment help).
- **Lighthouse target:** Performance 95+, Accessibility 90+, Best Practices 100, SEO 90+.

---

## npm Scripts (package.json)

- `npm run analyze` — run Lighthouse in CI mode (optional: add `npx lighthouse` when needed).
- `npm run lighthouse` — run Lighthouse with default config for local audit.

---

## Progressive Enhancement

- Site remains usable without JS: static content, nav links, and layout work. Visualizer and folder tree require JS; core content and navigation do not.

---

## Critical Optimizations Checklist

- [x] **Layout thrashing** — No read/write interleaving in hot paths; cached section list; conditional DOM updates for BASS/MID/HIGH
- [x] **GPU/compositor** — `will-change: transform`, `transform: translateZ(0)`, `contain` on viz, hero, ASCII
- [x] **Preload critical** — CSS preload; fonts with display=swap; Three.js defer
- [x] **Memoize / cache** — Bar step/width, font size, section list; BASS/MID/HIGH only when changed
- [x] **Debounce / throttle** — Scroll→history 150ms debounce; resize already debounced in viz/particles
- [x] **requestIdleCallback** — ASCII artist precache (non-blocking)
- [x] **Batch DOM** — DocumentFragment for folder list (single append)
- [x] **content-visibility** — Folder and track list items (browser skips off-screen)
- [x] **Remove per-frame waste** — computeVertexNormals removed; font set only when scale changes

---

## Files Touched

- `index.html` — preload, defer, crossorigin
- `styles.css` — GPU/contain, content-visibility
- `js/pulse-visualizer.js` — cache math, conditional DOM updates
- `js/winamp-ascii.js` — font cache, requestIdleCallback precache
- `js/main.js` — cached sections
- `js/page-scroll-manager.js` — debounced history
- `js/swiss-visualizer.js` — removed computeVertexNormals
- `js/winampFolders.js` — DocumentFragment batch
- `package.json` — analyze + lighthouse scripts
- `PERFORMANCE_REPORT.md` — this report
