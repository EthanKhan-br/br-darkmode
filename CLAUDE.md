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

## Task tables (inspected 2026-08-19 — don't re-derive)

The Dashboard's Daily / Soft / System Tasks tables are the one place with
**author-written test ids**, and they are the stable hook rules 9-10 are built on:

- `tr[data-testid="task-<id>-row"]` — 21 real rows across the three tables.
- `tr[data-testid="task-<id>-details-row"]` — the collapsed expansion row, 1px tall,
  `colspan=7`. Excluded from the hover rule so it keeps matching the portal's own
  behaviour. Any `[data-testid$="-row"]` selector catches both, so filter it out.
- `data-testid="due-date"` is the **filter input** at the top of the page, NOT the
  column cell. Don't reach for it expecting a cell.
- The overdue date is a **bare text node** sitting directly in the `<td>` — no span,
  no class, unselectable. Its color has to be set on the cell, via
  `td.MuiTableCell-body:has(.MuiChip-root)`. "Today" cells contain no chip, so
  `:has()` splits overdue from non-overdue with zero false positives across all 14.
- All 14 `.MuiChip-root` on the Dashboard are Passed Due chips, all inside task rows.
  Elsewhere in the portal chips are status pills — which is why rule 10 keeps the
  `tr[data-testid^="task-"]` ancestor instead of styling chips globally.
- **Rule 6 caused the murky pill, not the engine.** Its 40% black overlay crushed the
  chip's own rgb(183,10,10) to ~rgb(110,6,6), 1.25:1 against the row. It can't be
  softened globally: at 30% the worst status chip elsewhere drops to 3.89:1, under AA.
- The olive hover is also not an engine fault. The portal declares
  `background-color: #fbffb3` itself; the engine inverted that yellow faithfully.

`jss` numbers renumbered *mid-session* (chip jss163 → jss176, row jss167 → jss180)
between two inspections minutes apart on an unchanged portal. That's the hard rule
demonstrating itself.

## Notes panel (inspected 2026-08-19 — don't re-derive)

The order-detail Notes panel (`/company-order/<id>`) has **exactly two** note
categories, not the six the chips imply, and the site sets each card's color as an
**inline style** on `div[data-testid="note-row"]`:

- `background-color: rgb(255, 203, 128)` — ordinary notes (23 of 25 on the order walked)
- `background-color: rgb(175, 225, 175)` — status-change notes (2 of 25)

Rule 11 hooks those with `[style*="rgb(255"]` / `[style*="rgb(175"]` — the comma-free
prefix, both so it survives the site nudging its palette and because
`verify-fixes.js` splits selectors on commas. Dark Reader overrides the inline color
with its own `!important` rule rather than rewriting the attribute, which is why
matching on `[style*=]` still works.

Card structure: three `<p>` siblings — two header lines (12.8px/300) then the body
(15px/400). Rule 11 pins all three with `:nth-of-type(-n+2)` for the header tier.
**Pin the text, always.** The same header measured `rgb(215,219,225)` in one browser
and rendered a dim tan in another minutes later, because the engine derives text color
from the *original* pale fill and the result depends on when it processed the node.

Anything left to the engine here is non-deterministic across page loads. That is the
single most useful fact in this section.


### The rest of the colour-carrying components (rules 12-15)

Everything below was flattened or muddied by the engine and is now owned outright.
The pattern is the same each time: **the site's own hue is not worth preserving, and
the engine's output is not deterministic.** Pin both fill and text or it will move.

| component | hook | rule |
|---|---|---|
| Notes category filters | `[data-testid="<cat>-checkbox"] + .MuiFormControlLabel-label p` | 13 |
| Company tag pills | `.MuiChip-root[style*="background-color"]` + colour prefix | 14 |
| Active Subscriptions | `.MuiAlert-standardSuccess` | 12 |
| UnPaid Subscriptions | `.MuiAlert-standardWarning` (+ `-standardError`) | 15 |

- Filter categories are `company`, `client`, `order`, `general`, `taxorder`, `calls`,
  `sales_rep`. `data-testid="due-date"` is a **filter input**, not a cell — a trap I
  already fell into once.
- `.MuiChip-root[style*="background-color"]` is what separates the company tags from
  every other chip: status chips are coloured by class and carry no `style` attribute,
  so rule 10's Passed Due pill is untouched. Four tags (Ein Registrar, Member, Manager,
  Registered Agent) have no inline colour and keep the neutral fallback.
- Chip and tag palettes are shared deliberately — rule 14 maps onto rule 13's seven
  validated colours rather than inventing new ones.

**Why hues, not contrast.** Warm colours cannot be dark. Yellow, orange and peach reach
low lightness only by becoming brown, so any pale-warm surface the engine inverts lands
in the same mud regardless of saturation. Every colour problem in this panel was a
*convergence* problem, not a contrast problem — the numbers passed AA throughout. When
categories stop being distinguishable, measure pairwise RGB distance, which
`verify-fixes.js` now does. A contrast ratio is blind to it.

**Cool hues have no such failure mode**, which is why the palette is blue / teal /
violet / slate / magenta / crimson / green. Saturated dark blue is the one to avoid:
at card lightness it lands at 1.00 against the page, because the page is itself dark
blue.


### Tax service orders (`/tax-orders`, inspected 2026-08-20)

**Read the app's own colour maps. Do not collect them by eye, and do not step through
states one at a time.** Both palettes on this page came out of the running app in a
single read each, after I had already started the slow way:

- **Stage colours** live in the JS bundle as object `Z` in `main.<hash>.chunk.js`.
  Fetch the bundle from the page and search it. All four stages that had been measured
  by hand matched it exactly, which is what made the other twelve trustworthy.
- **Label colours** live on the Label filter's react-select **React fiber** as
  `options: [{value, label, color}]`. Walk `__reactFiber$…` up via `.return` until a
  node has `memoizedProps.options`. The Stage select carries only `{label, value}`, so
  check both before assuming.

That replaced a plan to have the owner set a test order to each of 16 stages in turn.
When a colour map is needed, look in the bundle and the fiber first.

Do **not** reach for the API to get these. It is a separate host
(`…execute-api.us-west-1.amazonaws.com/prod/…`) and needs the app's auth token; taking
that token is off limits.

| what | hook | rule |
|---|---|---|
| Stage boxes | `tbody td div[style*="background: rgb"]` + full colour | 16 |
| Tax order labels | `.MuiChip-root[style*="background-color"]` + full colour | 14 |

- Stage boxes are **classless divs** — no class, no testid, no attribute. The site's
  own inline colour is the only hook that exists, which is why the map was needed.
  They use the `background:` SHORTHAND; rule 14 matches `background-color`, which is
  why the two rules never collide.
- **Selectors carry the full colour, not a prefix.** Three stages share `rgb(255` and
  BUSINESSJETT `rgb(241,188,188)` collides with the company tag PROFILE-ACCOUNTANT
  `rgb(241,109,65)`. `verify-fixes.js` now splits selectors on commas **at bracket
  depth zero**, so full colours inside `[style*=…]` are safe to use.
- **16 stages and 25 labels are grouped, not individually coloured.** One order can
  carry all 25 labels at once. Twenty-five distinguishable hues do not exist at this
  lightness — seven already needed a search to hold 33 rgb apart. Colour answers
  "does this need me?" and the text carries the specifics.
- **Rule 14's fallback is load-bearing.** Any inline-coloured chip that is not mapped
  renders neutral grey. That is deliberate (neutral beats mud) but it means a NEW
  label created in the portal looks broken until it is added. This already bit once:
  the /tax-orders labels were grey because rule 14 was written for company tags and
  caught them too.

**A portal bug, not ours:** the stage `Review Completed` is `#D7E8` in the bundle. Four
hex digits is not valid CSS, so that stage renders with no background at all, in light
mode too. There is nothing to hook, so it is absent from rule 16.

**The filter dropdowns are react-select** (`.css-2b097c-container`), which is the
component the open item below is about. Option ids (`react-select-N-option-M`) are
regenerated per mount — match options by text, never by id.

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
  active signal is `background-color: rgba(10,10,10,0.04)`, roughly one RGB step,
  which is invisible in light mode too. Owner saw this and **accepted it as-is**
  (2026-08-18), so `tagActiveNav()` handles top-level rows only. Sub-item detection
  was written, found never to fire, and removed in v1.5.3 rather than left running
  `getComputedStyle` on every mutation for no visible result. Don't rebuild it
  unless the owner asks.

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

**A dark amber notes card.** Three attempts, all rejected on looks: `rgb(54,44,30)`
(hsl 29% sat, read as sludge), `rgb(63,45,13)` (65% sat, still wrong), and removing the
fill entirely (owner: "that is not what I want"). Yellow and orange reach low lightness
*only* by becoming brown — it is the hue, not the tuning, so no amount of saturation
work fixes it. The categories were re-hued instead: slate-indigo + teal, chosen 2026-08-19
over violet+teal, plum+cyan and blue-violet+emerald. Colour the exception, not the rule —
23 of 25 cards are ordinary notes, so the default stays near-neutral.
Saturated dark blue is also out: at card lightness it lands at 1.00 against the page,
because the portal background is itself a dark blue.

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

**Extension CSS outranks anything you inject into the page.** Chrome applies
manifest-injected content-script CSS at **user origin**, and a user-origin `!important`
beats an author-origin `!important` no matter how specific the author rule is. So
testing a candidate rule by appending a `<style>` to the page **cannot** override
`fixes.css` — the test silently fails and looks like a broken selector. This cost a
round: an injected rule 14 appeared to do nothing while being in the sheet, matching the
element, and carrying `!important` at higher specificity than the rule it lost to.
Injection is still a valid way to test a rule that competes with nothing but Dark
Reader. To test anything that competes with our own CSS, edit `fixes.css` and restart
the browser.


**QA loop — I can now drive the portal myself.** A `puppeteer` MCP server is registered
at user scope (`C:\Users\PC\.claude.json`). Launch it headful with the unpacked
extension loaded, via `launchOptions` on `puppeteer_navigate`:

```json
{ "headless": false, "defaultViewport": null,
  "args": ["--disable-extensions-except=c:\\Users\\PC\\Downloads\\br-darkmode",
           "--load-extension=c:\\Users\\PC\\Downloads\\br-darkmode"] }
```

Headful is required — Chrome will not load an unpacked extension headless, and without
it the portal renders light and tells you nothing. **Changing `launchOptions` restarts
the browser, which is how the extension reloads after a CSS edit — and it drops the
portal session every time.** The owner has to sign in again by hand. Batch edits before
restarting; a login per iteration is the main cost of this loop.

Rules for driving it, set by the owner 2026-08-19 and not negotiable: **read-only.**
Navigate, hover, screenshot, read computed styles. No clicks, fills or selects — no
Mark As Read, no Complete, no sort toggles, no pagination, and do not click Log In even
with credentials prefilled. It is live production data shared with coworkers, and any
state change looks to the whole team like the owner did it. Hover is safe: it is pure
CSS with no class toggle, so it fires no request and persists nothing.
Return class names and colours from `evaluate`, never cell text — that keeps client PII
out of the transcript.

`tools/chrome-qa-brief.md` and Claude in Chrome still work and need no login of mine,
but every round through them costs fidelity in translation. Prefer driving directly.

**Commits:** `git -c user.name="EthanKhan-br" -c user.email="naveedanas87@gmail.com"`.
The repo has no committed identity.

---

## Open items

- ~~**Sidebar active-page marker.**~~ Stale as written — rule 8 stopped being a union
  of class guesses at v1.5.0. `content.js` tags the row at runtime with
  `[data-br-active]` by relative structure and rule 8 styles that attribute. Left here
  only so the old wording is not mistaken for current.
- **react-select menus.** The QA walk opened one but didn't capture its portal markup.
  If those still flash light on mount, add their container to rule 2 in `fixes.css`.
- ~~**Notes category chips.**~~ Closed 2026-08-19 by rule 13. The diagnosis in this
  item was wrong in an instructive way: it read as a contrast problem, and every chip
  passed AA the whole time. The real fault was that five of the seven site colours are
  warm pastels, and warm pastels all invert to the same brown-olive — they converged.
  Hues are now hand-assigned by search over seven hue lanes that skip 30-70deg.
  **Generalise from this:** on this portal a category that stops being distinguishable
  is almost never a contrast bug. Check whether the source colours share a hue family
  first, and measure pairwise separation, which no contrast ratio will show you.
- ~~**Rule 15 is reasoned, not measured.**~~ Confirmed visually by the owner
  2026-08-20: `MuiAlert-standardWarning` was the right class, and the alarm box renders
  red above the teal success box as intended. **The route is still unrecorded** —
  `/company-tax-order/4326` redirects to the dashboard, so if that page needs
  inspecting again, get the URL from the address bar rather than guessing it.
- **Pages never walked:** none — the walk covered all 15. Re-walk after any major
  portal deploy, since MUI hashes and layouts move.
