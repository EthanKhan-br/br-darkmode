# BusinessRocket Portal Dark Mode — Build Plan

**Target:** `https://portal.businessrocket.com/*` only. No other site touched, ever.
**Decisions locked in:** toggle + follow-system · Dark Reader engine + site-specific fixes · built with Claude Code locally · unpacked, personal use.

---

## 1. What I found on your portal (this matters a lot)

I inspected the live dashboard page. The relevant facts:

| Signal | Value | Why it matters |
|---|---|---|
| Framework | React + **MUI (Material UI)** | Class names are emotion-hashed (`css-1ab2c3`) and **change on every portal deploy**. Hand-written selectors targeting them will silently break. |
| Stylesheets | 86 (2 cross-origin) | Lots of surface area; a static override file would be huge. |
| CSS custom properties | **6, all fonts** (`--font-body`, `--font-heading`, …) | There is **no color token layer to flip**. This is the single biggest constraint — the "clean" way to do dark mode (redefine `--bg`, `--fg`) is not available here. |
| Inline `style=` with colors | 90 elements | Inline styles beat any stylesheet rule; must be handled at runtime, not in CSS. |
| SVGs | 200 | Icons. These need `currentColor`/filter treatment, not blanket inversion. |
| Iframes | 3 | Chat/widget frames. Need `all_frames: true` + they may be cross-origin (can't touch those). |
| Shadow roots | 1 | Regular CSS can't pierce it; needs `adoptedStyleSheets`. |

**Conclusion:** this is exactly the site profile where a *runtime color-transform engine* wins and a static stylesheet loses. It also explains why the store extensions you tried were bad — generic ones either invert everything (weird colors) or ship a global CSS blob that never matched MUI's hashed classes.

---

## 2. Architecture

```
businessrocket-dark/
├─ manifest.json          # MV3, host_permissions scoped to the portal ONLY
├─ src/
│  ├─ preload.js          # runs at document_start — paints bg dark before first paint (no white flash)
│  ├─ content.js          # boots the darkreader engine + applies fixes
│  ├─ fixes.css           # hand-written site-specific corrections
│  └─ theme.js            # the color config (single source of truth)
├─ popup/
│  ├─ popup.html
│  └─ popup.js            # Off / On / Auto (follow system)
└─ vendor/darkreader.js   # bundled, MIT licensed, ~150KB
```

### Why this shape
- **`host_permissions: ["https://portal.businessrocket.com/*"]`** is the whole answer to "affects other tabs." The content script is *never injected* anywhere else. Chrome enforces it — it's not a runtime check you can get wrong.
- **`preload.js` at `document_start`** with `run_at` before CSS parse kills the white flash-of-light that makes cheap dark extensions feel broken.
- **Dark Reader's dynamic engine** parses every stylesheet, converts each color to HSL, inverts *lightness only* while preserving hue and clamping saturation. That's why it doesn't produce the "weird colors" of `filter: invert()`. It also runs a `MutationObserver`, so React re-renders and lazily-loaded MUI styles get themed automatically.
- **`fixes.css` layered on top** for the ~10 places the engine guesses wrong. This is where the craft is.

---

## 3. The manifest (start here)

```json
{
  "manifest_version": 3,
  "name": "BusinessRocket Portal Dark",
  "version": "1.0.0",
  "description": "Dark mode for portal.businessrocket.com only.",
  "permissions": ["storage"],
  "host_permissions": ["https://portal.businessrocket.com/*"],
  "content_scripts": [
    {
      "matches": ["https://portal.businessrocket.com/*"],
      "js": ["src/preload.js"],
      "run_at": "document_start",
      "all_frames": true
    },
    {
      "matches": ["https://portal.businessrocket.com/*"],
      "js": ["vendor/darkreader.js", "src/theme.js", "src/content.js"],
      "css": ["src/fixes.css"],
      "run_at": "document_start",
      "all_frames": true
    }
  ],
  "action": { "default_popup": "popup/popup.html" },
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

Note: **no `<all_urls>`, no `activeTab`, no `tabs` permission.** Nothing to leak into other tabs.

---

## 4. Theme config — the part worth tuning

```js
// src/theme.js
const BR_THEME = {
  brightness: 100,
  contrast: 92,       // slightly under 100 softens MUI's pure-white cards
  sepia: 0,
  grayscale: 0,
  darkSchemeBackgroundColor: '#151821',  // near-black with a blue cast (matches the brand navy)
  darkSchemeTextColor: '#dfe3ea',        // NOT pure white — pure white on dark causes halation
  selectionColor: 'auto',
  useFont: false,                        // keep the portal's own fonts
  styleSystemControls: true
};
```

Two rules that separate good dark mode from bad:
1. **Never pure black (`#000`) and never pure white text (`#fff`).** Contrast ratio should land ~12:1, not 21:1. `#151821` / `#dfe3ea` ≈ 12.6:1 — WCAG AAA without the eye strain.
2. **Preserve hue, invert lightness.** Your brand navy `#1b2f5e` should become a *lighter* navy, not orange. `filter: invert()` gives you orange. That's the "weird colors" problem.

---

## 5. The known problem spots (your fix list)

From the dashboard screenshot, these will need explicit handling in `fixes.css`:

1. **Sidebar** — already dark navy. The engine will try to *lighten* it (it inverts lightness). Pin it with `ignoreInlineStyle` / an explicit override so it stays dark and just gets its text/contrast adjusted.
2. **The BusinessRocket logo** (navy + orange script on white) — will look muddy. Fix: `filter: brightness(1.6)` on the logo `<img>`, or swap in a white-knockout version.
3. **Stat cards** (`21 DAY ALERT`, `127`, etc. — currently dark navy w/ white numbers) — same trap as the sidebar. These are *already* dark; leave them.
4. **Unread badges** (the orange `6` / `3` pills) — saturated accent on dark can vibrate. Drop saturation ~15%.
5. **The 200 SVG icons** — most should already be `currentColor` and follow along. Spot-check the sidebar icons and the WhatsApp/chat glyphs.
6. **The 3 iframes** — if same-origin, `all_frames: true` handles them. If cross-origin (likely the chat widget), you cannot theme them; decide whether to leave light or hide.
7. **The shadow root** — needs `document.adoptedStyleSheets` injection; Dark Reader handles this, but verify.
8. **Avatar images / client photos** — must NOT be inverted. Ensure images are excluded (default behavior, but verify).
9. **Focus rings & form fields** — MUI outlined inputs go nearly invisible on dark. Explicitly set border color.
10. **Any charts/graphs deeper in the app** — check the pages you actually live in (Company Orders, Invoices, Lead Manager).

---

## 6. Build order (what to tell Claude Code)

Work in this sequence — each step is verifiable before moving on:

1. **Scaffold + manifest.** Load unpacked at `chrome://extensions` (Developer mode → Load unpacked). Confirm the icon lights up on the portal and stays gray everywhere else. *This is the single most important test — do it first.*
2. **Preload flash-killer.** Inject `html{background:#151821!important}` at `document_start`. Reload the portal; confirm no white flash.
3. **Wire the engine.** `DarkReader.enable(BR_THEME)` in `content.js`. Screenshot. It will be ~80% right immediately.
4. **Toggle + storage.** Popup with Off/On/Auto; persist to `chrome.storage.sync`; Auto listens to `matchMedia('(prefers-color-scheme: dark)')`.
5. **Walk every page you use** — Dashboard, Web Submissions, Lead Manager, Clients, Companies, Company Orders, Invoices, Calendar, Processing and Fee. Screenshot each. Log every ugly spot.
6. **Fix pass.** Work the list from §5 plus whatever you logged, one rule at a time in `fixes.css`.
7. **Contrast audit.** Script it: walk the DOM, compute each text node's fg/bg contrast ratio, flag anything under 4.5:1. Don't eyeball this — it's the step that separates "looks dark" from "actually readable at 11pm."
8. **Deploy-resilience check.** Since MUI class hashes change, prefer structural/semantic selectors (`nav`, `[role="button"]`, `aria-label`, data attributes) over `.css-1ab2c3` in `fixes.css`. Every hashed selector you write is a future bug.

---

## 7. Which Claude to use

**Claude Code, locally** — correct call, and here's the division of labor:

- **Claude Code** owns the repo: writes the manifest, the engine wiring, the popup, and `fixes.css`. It can run the contrast-audit script and iterate on the code. Point it at this plan file as its brief.
- **Claude in Chrome (the side panel you're in now)** owns visual QA: it can see the *logged-in* portal that Claude Code cannot reach, take screenshots page by page, and read computed styles off live elements to tell you the exact selector and color that's wrong. Feed those findings back to Claude Code.

That loop — Chrome finds it, Code fixes it, reload, repeat — is much faster than either alone. Claude Code cannot log into your portal; Claude in Chrome cannot edit files on your disk.

**Concrete kickoff:** save this file into an empty folder, open it in Claude Code, and say:
> Read businessrocket-dark-plan.md and build steps 1–4. Don't write any selector containing a hashed MUI class name.

---

## 8. Things to get right that are easy to miss

- **Don't request `tabs` or `<all_urls>` permission.** You don't need them, and they're the reason store extensions bleed into other tabs.
- **Version-pin the vendored darkreader file.** Don't load it from a CDN — MV3 forbids remote code, and it'd be a security hole anyway.
- **Unpacked extensions survive Chrome restarts** but show a "developer mode" nag on every launch. Ignorable; if it bothers you, a $5 one-time Web Store dev account lets you publish it *unlisted* and install it cleanly.
- **Keep a `DISABLE` escape hatch** — a keyboard shortcut or the popup's Off switch — for when you need to screenshot something for a colleague in normal colors.
- **Test at your actual working hours' screen brightness.** Dark themes that look great at noon are often too low-contrast at night, and vice versa. That's what the contrast target in §4 is protecting.
