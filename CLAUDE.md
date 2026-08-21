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
  `options: [{value, label, color}]`. Walk up via `.return` until a node has
  `memoizedProps.options`. The Stage select carries only `{label, value}`, so check
  both before assuming.
  **Read the fiber key off the element, don't assume it.** This app is React 16, where
  the key is `__reactInternalInstance$…`, not the React 17+ `__reactFiber$…`. A walk
  written for the wrong key returns nothing and looks exactly like "the data isn't
  there" — it cost a round on /company-order. `Object.keys(el).find(k => k.startsWith('__react'))`
  first, every time.

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

### Full-page crawl of /company-order/<id> and /tax-orders/<id> (2026-08-20)

Rules 18-21 came out of this. Two findings worth keeping:

- **MUI's `secondary` palette entry on this portal is the brand orange.** Every
  component that asks for it inherits the same rust rule 17 took off the section bars:
  `.MuiBadge-colorSecondary`, `.MuiChip-colorSecondary`. They are coloured by CLASS
  and carry no `style` attribute, which is precisely why rule 14 never caught them —
  its `[style*="background-color"]` hook is what separates inline-coloured tags from
  everything else. When something looks rust, check whether it is asking for `secondary`
  before looking for a hook.
- **Two table-row tints were converging and no contrast audit would ever have shown it.**
  The site tints rows lavender `rgb(203,195,227)` and pale blue `rgb(195,220,237)`;
  the engine landed them 5 rgb apart. This is the notes-panel lesson repeating: on this
  portal, a distinction that disappears is usually convergence, not contrast. Rule 18
  puts them 37 apart.

| what | hook | rule |
|---|---|---|
| All contained buttons | `.MuiButton-contained` (rule 5, widened from `-containedPrimary`) | 5 |
| Order status banner | `div[style*="rgb(1, 167, 4)"]` | 18 |
| Tinted table rows | `tr[style*="rgb(203, 195, 227)"]` / `rgb(195, 220, 237)` | 18 |
| Badges + secondary chip | `.MuiBadge-colorSecondary` / `-colorError` / `.MuiChip-colorSecondary` | 19 |
| Segmented filters | `.MuiToggleButton-root[.Mui-selected]` | 20 |
| Muted secondary text | `p.text`, `.inline-icon p` | 21 |

- **Rule 5's widening flattened three green buttons and the owner rejected that**
  (2026-08-20): "not green but still distinguishable, right now all 4 buttons look the
  same". Rule 22 + `tagAltButtons()` is the answer — see below. Don't undo it by
  widening rule 5 further.
- **Disabled buttons must stay excluded from rule 5.** Pinning the fill with
  `!important` overrode MUI's own greying, so `Generate PDF`, `Upload PDF` and `Send`
  rendered as solid inviting blue. `:not(.Mui-disabled)` hands them back to the engine.
- `.MuiToggleButton-root.Mui-selected` is marked by MUI with
  `background: rgba(10,10,10,0.12)` — about one RGB step on a dark page, the same
  invisible-marker trap as the sidebar sub-items. The **labels** carry the state.
- **Two muted-text occurrences were deliberately left at engine output** (4.36:1 and
  4.16:1): a bare `<i>` in a MuiGrid cell, and a react-select placeholder whose only
  class is an emotion hash. Hard rule 1 forbids the latter and a dim placeholder is
  correct anyway. Don't "fix" these by blanket-colouring `p` or `i` — this file pins
  text colour in seven rules and a global paragraph colour fights all of them.
- Three more company tags needed mapping: `NON-RESIDENT OWNERS rgb(159,140,212)` and
  `NON-RESIDENT OWNERSHIP rgb(255,31,31)` (crimson, the deliberate opposite of US
  RESIDENT's teal) and `P15 - General Products rgb(171,71,188)` (blue, sharing the lane
  with S03 - Professional Services). **The company-label react-select was not mounted on
  either page**, so the full palette still can't be pulled the way the tax labels were —
  rule 14's neutral fallback will keep catching new ones one at a time until it is.

### Reading the site's own colours back out of its stylesheets (2026-08-20)

`tagAltButtons()` in `content.js`. **Dark Reader appends override sheets rather than
rewriting the originals, so the portal's own declared colours are still readable at
runtime** — this is the general escape hatch for "the signal is only in a generated
class". It is the same move as `tagActiveNav()`, one layer up.

The case that forced it: three buttons are green because of a **container** rule,
`.jss148 div button { background: rgb(40,167,69) }`. The buttons themselves are
identical to the blue ones — same classes, same `jss165`, same inline `width:100%` —
and the container's inline style (`display:flex`) is shared with containers that are
not green. So there is genuinely no CSS hook, and no amount of looking will find one.

How it decides, without hardcoding anything:

1. Walk `document.styleSheets`, skipping any sheet whose `ownerNode` has class
   `darkreader`, and collect `[selectorText, background]` for every rule that sets one.
   Skip `:hover/:focus/:active` or the resting colour becomes whichever came last.
2. For each contained button, `el.matches(sel)` against those rules, last wins.
3. **The most common declared colour IS the site's default.** Anything else was a
   deliberate choice → tag `[data-br-alt]`.

Verified live on `/company-order/454991`: 18 buttons, all claimed by a rule, majority
`rgb(60,159,223)` ×12, tagged `rgb(40,167,69)` ×3 (the green ones), `rgb(168,188,123)`
×2 (+ Add Item, Reminder Schedules), `rgb(229,127,90)` ×1 (Upload PDF).

- **All non-default buttons share ONE alt colour.** Three site colours collapse to
  violet deliberately — the semantic that matters is "not the primary action", and four
  button colours on one page is what the flattening was supposed to fix.
- Cache invalidation is by `declared.size < btns.length`, **not** by stylesheet count:
  JSS appends rules to a sheet it already registered, so the count doesn't move.
- The alt fill is **teal `rgb(30,94,91)`**, the value rules 11 and 12 already use.
  Owner picked it 2026-08-20 from teal / outlined / steel / leave-it-blue, after
  rejecting violet `rgb(88,52,120)` on looks. It separates by **hue only** — 43 rgb and
  1.04 in lightness. I had argued for violet precisely because it separated on both
  axes; that argument lost, and `verify-fixes.js` deliberately carries no lightness
  check for this pair so it can't be "fixed" back. **The numbers were never the
  objection** — three colour rounds on this portal have now ended that way.
- **Button hover darkens, it does not lighten.** The site lightens to rgb(36,121,175),
  which drops the label to 3.38:1 — a light label loses contrast as the fill rises. Down
  gives 7.59:1 and still reads as a 1.48 step. Generalise: on this dark UI the honest
  direction for a state change is usually down.


### Dashboard crawl (2026-08-20, against v1.20.0)

Clean apart from two hue faults — **zero unthemed light surfaces**, no leftover
inline-coloured elements, and the only text below AA was two react-select placeholders
at 4.36:1 (the emotion-hash ones rule 21 deliberately leaves).

- **`data-testid="toggle-notes-button"`** is an author-written hook on two floating
  buttons, top-left over the sidebar and top-right over the content. The site colours
  the two copies differently — pale yellow `rgb(253,255,221)` and bright blue
  `rgb(60,159,223)` — and the engine sent them to olive `rgb(59,62,10)` and the raw
  `rgb(34,110,158)`. Rule 23 puts both on the theme blue. **Pale yellow has now failed
  three times** (rules 9, 13, 23); treat any pale yellow the site declares as a hue that
  must be replaced, never tuned.
- **Rule 19's badge hook was wrong in an instructive way.** Naming
  `.MuiBadge-colorSecondary`/`-colorError` misses the *default* case, because MUI only
  adds a colour modifier when the component asks for one. The dashboard's Chat Messages
  count had neither and stayed rust. Now `.MuiBadge-badge:not(.MuiBadge-colorPrimary)`.
  **Generalise: when hooking a MUI variant class, check what the unmodified default
  looks like** — it is the case most likely to fall through.
- Both fixes **lower** measured contrast (8.04→5.13 and 5.29→4.98) and both look far
  better. That is now the rule on this portal rather than the exception: a colour
  complaint here is almost never a contrast number.
- The 102 row action buttons sit at 1.07:1 against the table. The site declares
  `rgb(236,236,238)` with `border:none`, which is **1.18:1 in light mode** — so the
  engine roughly halved it rather than breaking it. Offered and not taken (2026-08-20);
  `rgb(44,48,61)` restores the light-mode figure exactly if it comes up again.
- The big orange stat numbers `rgb(235,124,87)` measure 5.84:1 at 54px and need 3:1.
  Left alone deliberately — they read as a deliberate second metric beside the blue.

### Company orders (`/company-order`, inspected 2026-08-20) — rules 24, 25

**The failure mode here is INVISIBLE, not muddy — and it will recur.** Dark Reader does
not process every node. The ones it misses carry no `--darkreader-inline-bgcolor`, and
its blanket fallback

    html, body, body :not(iframe) { background: var(--darkreader-background-ffffff) }

then paints them the page colour, overriding the site's own inline style. Six of 25
status boxes and five of 25 rows were rendering at exactly `rgb(30,32,41)`. Our CSS is
user-origin so it still wins, which is the only reason this is fixable from here.
**When something is missing rather than ugly, check for that fallback before anything
else.**

- **`tr[…]` does nothing; you need `tr[…] > td`.** The row background IS painted, but
  the unprocessed `td` cells stay opaque at the page colour and cover it. Rule 18
  shipped the wrong form and **never rendered** — corrected into rule 25. Measured both
  ways: tr alone gives an invisible row, `tr > td` paints all ten cells.
- **The status list cannot be enumerated, so the BASE RULE is the fix.** Names and
  colours come from the API (the React prop holds `#bdd5ff`), are absent from the JS
  bundle — zero hits for every status name and every hex — and are not reachable in the
  React tree from either page. Pagination would need clicks the read-only rule forbids.
  So `tbody td div[style*="background-color"]` gets a neutral fill and any unseen status
  renders neutral instead of vanishing. Verified: 25 matches, one per row, zero false
  positives (every match carries `border-radius`). It cannot reach rule 16's stage boxes
  (`background:` shorthand, different attribute string) and loses to rule 14's chips on
  specificity. **Don't try to complete the mapping — the base is the point.**
- **Row-tint colours ARE gettable**: five hard-coded constants in one bundle block,
  `_ = "#EA987A"  w = "#CBC3E3"  j = "#db635b"  S = "#c3dced"  k = "#ff00009c"`. Three
  are confirmed on a page; `#EA987A` and `#ff00009c` are inferred from sharing the block
  and may colour something else — harmless, since the selector only fires on a `tr`
  carrying that colour.
- `rgb(189,213,255)` is the DEFAULT status colour — 17 of 25, five different statuses.
  Kept as one blue bucket deliberately; splitting it would invent a distinction the site
  does not make. Owner also grouped **Ready to File with Submitted to Government Agency**
  on green (2026-08-20).
- **`tbody td` IS NOT A NARROW SCOPE ON THIS PORTAL — the notes panel is a table too.**
  Rule 24's base matched all 23 note rows on `/tax-orders/<id>` and all 9 on
  `/company-order/<id>`, and at (0,2,4) outranked rule 11's (0,2,1), flattening every
  ordinary note back to neutral. Shipped in v1.22.0, caught by the owner, fixed in
  v1.24.0 by giving rule 11 an extra `[style]` → (0,3,1).
  **The symptom is the lesson: only the ORDINARY notes broke.** The status-change ones
  survived because their selector already carried a second attribute. When a rule works
  for some members of a set and not others, suspect a specificity collision, not a
  broken hook — and count the columns rather than eyeballing the selector.
  Note rows sit at `div < div < td < tr < tbody`. Before adding any selector scoped to
  `tbody td`, enumerate what actually renders inside a `td` here; it is more than the
  tables you are thinking of.
- **Urgent rows: `rgb(125,33,36)` at 1.56, the others held 1.17–1.25.** Two lessons.
  Rule 15's alarm red — tuned to shout against the *page* — measures only 1.28 against a
  table *row*; **a colour that is loud on one surface is not loud on another, re-measure
  it.** And the first attempt at 1.85/80% saturation was rejected as too bright, so
  saturation came down with luminance; the two quiet tints that had drifted loud came
  down too, rather than dropping the assertion that urgent leads by 1.2x.
  `verify-fixes.js` asserts blue >= green on that colour, because a search of the same
  lane without it returns `rgb(130,41,23)` — the rust family the owner has rejected twice.

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
- **Two row tints in rule 25 are unverified guesses.** `#EA987A` and `#ff00009c` were
  taken from the same bundle constants block as the three confirmed ones but have never
  been seen on a page — they may colour something that is not a row at all. Harmless
  either way (the selector only fires on a `tr` carrying that inline colour), but if one
  ever shows up, check it renders sensibly rather than assuming it was right.
- **Pages never walked:** none — the walk covered all 15. Re-walk after any major
  portal deploy, since MUI hashes and layouts move.

---

## Where things stand (end of 2026-08-20)

`manifest.json` is at **v1.24.0**, everything is committed and pushed to `main`, and
`node tools/verify-fixes.js` passes 87 checks. `fixes.css` has 25 rules.

Sessions on 2026-08-19/20 took the file from 8 rules to 25. The through-line, worth
holding on to before touching anything here:

1. **A colour complaint on this portal is almost never a contrast number.** Four of the
   fixes in this stretch *lowered* measured contrast and all four looked better. Warm
   pastels converge to the same brown-olive; that is a hue fault a ratio cannot see.
2. **The engine is not deterministic and does not process every node.** Pin fill *and*
   text, always. When a surface is *missing* rather than ugly, it is Dark Reader's
   `body :not(iframe)` fallback painting an unprocessed node the page colour.
3. **Read the app's own data before collecting anything by eye** — the JS bundle, the
   React fiber, the site's own stylesheets via `document.styleSheets`. Dark Reader
   appends overrides rather than rewriting originals, so the site's declared colours are
   still readable at runtime. That is what `tagAltButtons()` runs on.
4. **Loudness does not transfer between surfaces.** Rule 15's alarm red shouts against
   the page and is mid-pack against a table row. Re-measure against the actual backdrop.
5. **Three scratch files sit untracked at the repo root** — `activenavfindings.md`,
   `chrome-qa-brief.md`, `qareport.md`. Offered to the owner repeatedly and left alone;
   don't commit them without being asked.
