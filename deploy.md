# Portfolio deployment — secure demo workflow

## Strategy

- **Public GitHub:** Clean, readable source. Recruiters see full code; no encryption.
- **Private / password‑gated demo:** Netlify (or similar) serves the **built** site. Visitors see the Winamp lock screen first; you share the access code with clients.

## Prerequisites

- Node 18+
- Netlify CLI (optional): `npm i -g netlify-cli`

## 1. Set a demo password (monthly rotation)

```bash
node scripts/password-manager.js "YourClientPassword"
```

Copy the two lines (`SALT_B64` and `EXPECTED_HASH_B64`) into `js/password-auth.js`, replacing the existing values. If both are left empty, the lock screen is **disabled** (useful for local dev or open GitHub Pages).

## 2. Production build

```bash
npm install
npm run build:prod
```

Output is in `dist/`: minified JS, copied assets, `index.html` with security headers. No source maps.

## 3. Deploy to Netlify

**First-time:**

- Link the repo: `netlify link`
- Set build command: `npm run build:prod`
- Set publish directory: `dist`

**Each deploy:**

```bash
npm run deploy:demo
```

Or: push to your connected branch; Netlify builds and deploys automatically.

## 4. Security checklist

- [ ] Bundle size &lt;500KB gzipped (check Netlify deploy summary)
- [ ] No source maps in production (`dist/` has no `.map` files)
- [ ] CSP allows only your CDNs (three.js, dat.gui, fonts)
- [ ] Password never sent in plaintext (PBKDF2 client-side only)
- [ ] 5 failed attempts → 5 min lockout (stored in `localStorage`)
- [ ] Run `npm run lighthouse` after deploy for performance/accessibility

## 5. Scripts reference

| Script | Purpose |
|--------|--------|
| `npm run build:prod` | Vite build + minify (terser), no source maps |
| `npm run preview` | Serve `dist/` locally (e.g. `http://localhost:4173`) |
| `npm run deploy:demo` | Build then `netlify deploy --prod` |
| `npm run security-check` | Build + Lighthouse |
| `npm run lighthouse` | Run Lighthouse (start local server on 8080 first) |

## 6. Flow for visitors

1. Open demo URL → Winamp-style full-screen lock.
2. Enter access code → smooth fade → music visualizer and rest of portfolio.
3. If DevTools is opened (resize heuristic) → subtle “Portfolio protected” overlay.
4. Right-click / F12 / Ctrl+U / Ctrl+S are disabled (cosmetic protection).

Recruiters viewing your **GitHub repo** see normal, readable source; the live demo stays password‑protected and hardened.
