# CLAUDE.md

Dark mode Chrome extension (MV3, unpacked) for `https://portal.businessrocket.com`
and nothing else. Personal tool, not published to the Web Store.

Repo: `https://github.com/EthanKhan-br/br-darkmode` (private) · owner `EthanKhan-br`
Local: `c:\Users\PC\Downloads\br-darkmode` · version lives in `manifest.json`

The original brief is `businessrocketdarkplan.md`. **It is a historical document, not
a spec** — several of its decisions were superseded during the build. Where this file
and the plan disagree, this file wins. Specific corrections are noted below.

---

## Hard rules

**1. Never write a generated class name.** The portal is **MUI v4 with react-jss**,
not v5 with emotion — classes look like `jss37`, not `css-1ab2c3`. JSS numbers
sequentially by *stylesheet registration order*, so adding or reordering any
component anywhere earlier in the app renumbers them. That is strictly less stable
than an emotion hash, which at least only changes when its own rule changes.
Use structural hooks: `fieldset`, `[role="button"]`, `[aria-label]`,
`[data-testid]`, `div.extra-class`, or MUI's *stable* public classes
(`MuiChip-root`, `MuiPaper-root`, `MuiTypography-root`) — those are API.
`tools/verify-fixes.js` fails the build if a `jss<n>` or `css-…` appears in
`fixes.css` or `content.js`.

**2. Every rule in `src/fixes.css` must start with `html:not([data-br-dark="off"])`.**
The manifest injects this stylesheet unconditionally, so an unguarded rule keeps
restyling the portal after the user picks Off. This shipped as a real bug in v1.2.0
(eight unguarded rules) and is now asserted by `tools/verify-fixes.js`.

**3. Don't add permissions.** `permissions: ["storage"]` and one host entry is the
entire manifest surface. `host_permissions` scoped to the portal *is* the guarantee
that no other site is touched — Chrome enforces it, so it can't be got wrong at
runtime. No `tabs`, no `activeTab`, no `<all_urls>`, no background service worker.
The owner's core requirement is a lightweight extension that cannot bleed into other
tabs; widening this needs their explicit say-so.

**4. Colors are chosen numerically, never by eye.** Every value in `fixes.css` is
verified against a measured background by `tools/verify-fixes.js`. Run it after any
color change. It exits non-zero on failure.

---

## Layout

```
manifest.json           MV3. One content_scripts entry, document_start, all_frames.
src/theme.js            BR_THEME — the tuning knob. Owner edits this.
src/content.js          ~20 lines. Resolves On/Off, calls DarkReader.enable/disable.
src/fixes.css           Site-specific corrections + the flash-killer.
popup/popup.html|js     Two buttons, writes chrome.storage.sync.
vendor/darkreader.js    Pinned 4.9.128, MIT. Do not edit. Re-vendor: npm pack darkreader@<v>
tools/verify-fixes.js   The check. node tools/verify-fixes.js
tools/contrast-audit.js Console script for QA walks. Not shipped.
tools/chrome-qa-brief.md Brief to paste into Claude in Chrome for a QA walk.
icons/                  Placeholder PNGs, generated with Node zlib.
```

### How the pieces fit

`content.js` reads `chrome.storage.sync` (default `on`), sets
`documentElement.dataset.brDark`, then enables or disables Dark Reader. It treats
**any value that isn't `'off'` as on**, which absorbs the legacy `'auto'` left in
storage by v1.0 without a migration step.

Cross-tab sync is `chrome.storage.onChanged`, not messaging — that's *why* no `tabs`
permission is needed. The popup only writes; every open portal tab reacts.

`DarkReader.enable()` is called inside the storage callback. That's deliberate: the
async hop guarantees `document.head` exists. Calling it at raw `document_start` is
the fragile path.

---

## Deviations from `businessrocketdarkplan.md`

| Plan said | Reality | Why |
|---|---|---|
| `src/preload.js` at `document_start` | doesn't exist | Manifest-injected CSS already lands before first paint. One rule replaced a JS file. |
| Two `content_scripts` blocks | one | Both were `document_start`; the split bought nothing. |
| Toggle + follow-system (Auto) | On/Off only | See rejected list. |
| `commands` keyboard shortcut | popup only | Needs a background service worker to receive the event. |
| Contrast ratio 12.6:1 | **13.8:1** | The plan's arithmetic was wrong. `#dfe3ea` on `#151821` is 13.77:1. |
| 3 iframes incl. a chat widget | Stripe telemetry only | See measured facts. |
| Shadow root needs work | it's Grammarly's | See measured facts. |

---

## Measured facts (from the QA walk — do not re-derive)

Page background `rgb(30,32,41)` · sidebar `rgb(33,36,46)` · light foreground
`rgb(214,218,225)`. These are what Dark Reader actually settles on, which is *not*
the same as `BR_THEME.darkSchemeBackgroundColor` — the engine derives per-surface
colors from the site's own values.

- **Iframes are a non-issue.** All three are Stripe telemetry, sized 1519×1 and 0×0.
  There is no chat widget. `all_frames: true` costs nothing but buys nothing.
- **The shadow root belongs to Grammarly's extension**, not the portal. No
  `adoptedStyleSheets` work is needed.
- **Zero unthemed light surfaces** across every page walked. Avatars and logos have
  `filter: none` — nothing is wrongly inverted. The already-dark sidebar and stat
  cards were correctly left alone. The engine's core color work is good; everything
  in `fixes.css` is an edge case, not a systemic failure.

---

## Sidebar structure (inspected 2026-08-18 — don't re-derive)

```
div.jss36[.jss37]            <- row; the extra class carries the active background
└─ div.jss35.extra-class     <- THE stable hook: author-written, 11 of them, sidebar-only
   └─ p.MuiTypography-root.jss39[.jss41]   <- label; extra class carries the active color
```

- `ul > div[role="button"]` matches **only the 4 collapsible group headers**
  (Web Submissions, Lead Manager, White Label Partners, Tax Service Orders). They
  never take an active state. An early fix pass wasted three rounds targeting these
  believing they were the nav rows — `:hover` appeared to work only because
  `.MuiListItem-button` ships a default MUI hover.
- The 11 real nav rows are `div.extra-class`'s **parent**.
- Submenu children are `div[role="button"]` **not** directly inside a `ul`.
- **No hrefs anywhere in the sidebar** — 0 of 11 rows have an `<a>` ancestor or
  descendant. Navigation is `onClick` router pushes, so URL-matching is not an
  option. Routes don't track labels either (Clients → `/client`, Processing and Fee
  → `/formation-state`), so a hand-built label→route map would silently rot.
- No `aria-current`, no data attributes, no inline styles, no pseudo-element
  marker, no border or box-shadow difference. The extra class is the only signal.
- **Submenu children have no class difference at all** — all identical. Their only
  active signal is `background-color: rgba(10,10,10,0.04)`, roughly one RGB step.
  MUI uses that same 4% for `:hover`, hence the `:hover` exclusion in
  `tagActiveNav()`.

`content.js` therefore tags the active row at runtime with `[data-br-active]` by
*relative* structure (the row with one more class than its siblings; the submenu row
with a painted background) and `fixes.css` styles that attribute. It clears the
attribute before measuring, or its own styling would be read back as the signal and
latch a stale row on permanently.

---

## Rejected approaches — do not retry without new information

**Auto / follow-system mode.** Removed in v1.1.0. `prefers-color-scheme` follows
*Chrome's* appearance setting, not Windows, so the owner set Windows to Light and the
portal stayed dark — it reads as broken. The underlying question (whether their Chrome
was overriding the OS) was never actually diagnosed; if Auto ever comes back, run
`matchMedia('(prefers-color-scheme: dark)').matches` on the portal first.

**Logo `filter: brightness(1.9)`.** Clips the orange script's red channel at 255 and
turns "Rocket.com" yellow. Anything above ~1.08 does — CSS filters cannot raise
lightness without shifting hue.

**Light plaque behind the logo.** Worked numerically (navy 1.19:1 → 11.48:1) but read
as a white block in the dark sidebar. Owner rejected on looks. The logo is now
intentionally unstyled; WCAG exempts logotypes from contrast requirements. A
white-knockout SVG is the only remaining option and needs the real artwork.

**`DarkReader.setFetchMethod` + background service worker** to theme cross-origin
stylesheets. Owner explicitly declined — it needs a service worker *and*
`cdn.tiny.cloud` in `host_permissions`. Consequence accepted: the TinyMCE rich-text
editor renders fully light. Don't re-open without the permission-widening being wanted.

**Greying the toolbar icon off-site.** Needs a background service worker
(`declarativeContent` + `chrome.action.disable()`). Cosmetic only — the isolation
guarantee is `host_permissions` and it's verified. Owner chose to skip.

**Console noise that is NOT a bug:** `fonts.googleapis.com` cross-origin errors
(`@font-face` only, no colors) and Dark Reader's CSP `inline script` errors (it injects
a custom-element watcher the portal's CSP blocks; non-fatal).

---

## Workflow

**After any change:** `node tools/verify-fixes.js` — asserts contrast thresholds, that
the values still appear in the CSS, and that every selector carries the Off guard.

**To see a change in the browser** (both steps, every time):
1. `chrome://extensions` → the ↻ on the extension card. Confirm the version bumps.
2. Reload the portal tab. Content scripts and CSS only inject at page load.

Bump `manifest.json` version on every functional change — it's the only way to confirm
Chrome re-read the folder.

**QA loop.** I cannot log into the portal. Claude in Chrome can, and does the visual
walk; `tools/chrome-qa-brief.md` is the brief to paste into it. It reports defects with
structural selectors and computed colors, I write the rules here. Its last report was
high quality — programmatic WCAG ratios, and it correctly refused to run a remote
script on a page holding live client PII.

**Commits:** `git -c user.name="EthanKhan-br" -c user.email="naveedanas87@gmail.com"`.
The repo has no committed identity.

---

## Open items

- **Sidebar active-page marker.** Rule 8 in `fixes.css` is a *union of guesses* at
  the class the portal uses (`Mui-selected` / `aria-current` / `.active` / `.selected`).
  If the current-page pill still does not show, find the real marker with
  `$('ul > div[role=button]').find(e => e.className || e.getAttribute('aria-current'))`
  and add it. Never a hashed emotion class.
- **react-select menus.** The QA walk opened one but didn't capture its portal markup.
  If those still flash light on mount, add their container to rule 2 in `fixes.css`.
- **Notes category chips** (Company / Client / Order / Tax Order / Calls / Sales Rep)
  all pass AA but converged to muddy brown-olive, so they no longer distinguish at a
  glance. Rule 6 darkens them further. Cosmetic; needs hand-assigned hues.
- **Pages never walked:** none — the walk covered all 15. Re-walk after any major
  portal deploy, since MUI hashes and layouts move.
