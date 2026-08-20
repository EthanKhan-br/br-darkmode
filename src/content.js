// Resolves On / Off -> DarkReader on or off, and tags the sidebar's current row.
let applied = null;

function apply(mode) {
  // Anything that isn't an explicit "off" means on -- this also absorbs the
  // legacy "auto" value left in storage by v1.0 without a migration step.
  const want = mode !== 'off';
  // Drives the flash-killer rule in fixes.css.
  document.documentElement.dataset.brDark = want ? 'on' : 'off';
  if (want === applied) return;
  applied = want;
  // ponytail: CONFIRMED + ACCEPTED (2026-08-18). Two cross-origin stylesheets
  // don't theme: fonts.googleapis.com (@font-face only, no colors, harmless) and
  // cdn.tiny.cloud's TinyMCE skin -- so the rich-text editor stays light. Owner
  // decided that's fine and explicitly ruled out the fix, which would need a
  // background service worker plus cdn.tiny.cloud in host_permissions. Don't
  // re-open without that permission-widening being wanted.
  want ? DarkReader.enable(BR_THEME) : DarkReader.disable();
  tagActiveNav();
  tagAltButtons();
}

/* The sidebar's current-page marker is unreachable from CSS. The portal is MUI v4
   with react-jss, and it marks the active row only by appending a generated class
   (jss37 on the row, jss41 on its label). JSS numbers sequentially by stylesheet
   registration order, so an unrelated component added anywhere earlier renumbers
   them -- never hardcode one. There are no hrefs to match either: the sidebar rows
   are plain divs navigating via onClick router pushes.
   So detect the row by relative structure and expose our own hook for fixes.css.

   Top-level rows only. Submenu children (Submissions / Reports / ...) are marked
   with background rgba(10,10,10,0.04) -- about one RGB step, invisible in light
   mode too. Owner saw that and accepted it as-is (2026-08-18), so there is
   deliberately no sub-item detection here. */
function navRows() {
  // Author-written class, 11 of them, sidebar-only -- the one durable hook here.
  return [...document.querySelectorAll('div.extra-class')].map((d) => d.parentElement);
}

function tagActiveNav() {
  const rows = navRows();
  rows.forEach((el) => el.removeAttribute('data-br-active'));
  if (!applied) return;
  // The active row carries exactly one class more than its siblings. Reading class
  // counts rather than our own styling keeps this immune to what fixes.css paints.
  const base = Math.min(...rows.map((r) => r.classList.length));
  rows.forEach((r) => {
    if (r.classList.length > base) r.setAttribute('data-br-active', '');
  });
}

/* The same problem as the sidebar row, one layer up. Three buttons on the order page
   -- Post Payment Reminder, Start / View Off Boarding Schedule -- are green, and the
   green is set by a CONTAINER rule, `.jss148 div button { background: ... }`, not by
   anything on the button. The buttons are otherwise identical to the blue ones: same
   classes, same jss165, same inline width. So no CSS hook exists at all -- the only
   thing separating them is a generated class on a grandparent, and the container's
   own inline style (display:flex) is shared with containers that are not green.
   Rule 5 was widened to every contained button to fix a real AA failure, and that
   flattened them to one blue, losing a distinction the site was making on purpose.

   The site's own stylesheets still hold the original colours -- Dark Reader appends
   override sheets rather than rewriting the originals, which is what makes this
   readable at runtime at all. So read them back and tag the odd ones out.
   Relative, exactly like tagActiveNav: whichever declared colour is MOST COMMON is
   the site's default button, and anything else was a deliberate choice. No jss name
   and no colour value is hardcoded here, so this survives both renumbering and the
   portal changing its palette. */
let btnRules = null;

function buttonRules() {
  if (btnRules) return btnRules;
  btnRules = [];
  for (const sheet of document.styleSheets) {
    // Skip Dark Reader's own sheets, or we read back the colours it just wrote.
    const node = sheet.ownerNode;
    if (node && node.classList && node.classList.contains('darkreader')) continue;
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }   // cross-origin sheet
    for (const r of rules) {
      if (!r.selectorText || !r.style) continue;
      const bg = r.style.backgroundColor || r.style.background;
      // :hover declares a second colour for the same button. Including it would make
      // the resting colour whichever rule happened to come last in the sheet.
      if (bg && !/:(hover|focus|active)/.test(r.selectorText)) btnRules.push([r.selectorText, bg]);
    }
  }
  return btnRules;
}

/* ponytail: last-rule-wins, which ignores specificity. Correct for this portal --
   JSS emits single-class rules in mount order and nothing here is overridden by a
   weaker-but-later rule. If that ever stops holding, compare specificity instead. */
function declaredColors(btns) {
  const out = new Map();
  for (const [sel, bg] of buttonRules())
    for (const el of btns) {
      let m;
      try { m = el.matches(sel); } catch (e) { continue; }    // unsupported selector
      if (m) out.set(el, bg);
    }
  return out;
}

function tagAltButtons() {
  const btns = [...document.querySelectorAll('.MuiButton-contained')];
  btns.forEach((b) => b.removeAttribute('data-br-alt'));
  if (!applied || btns.length < 2) return;
  let declared = declaredColors(btns);
  // JSS appends rules to a sheet it already registered, so the sheet count alone
  // can't invalidate the cache. A stale cache shows up as buttons no rule claims --
  // rescan once when that happens, which settles after the last component mounts.
  if (declared.size < btns.length) {
    btnRules = null;
    declared = declaredColors(btns);
  }
  const tally = new Map();
  for (const bg of declared.values()) tally.set(bg, (tally.get(bg) || 0) + 1);
  if (tally.size < 2) return;                                 // nothing to separate
  const common = [...tally].sort((a, b) => b[1] - a[1])[0][0];
  for (const [el, bg] of declared) if (bg !== common) el.setAttribute('data-br-alt', '');
}

// React re-renders the sidebar on navigation. attributeFilter is 'class' only, so
// our own data-br-active writes can't retrigger this; rAF collapses bursts.
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; tagActiveNav(); tagAltButtons(); });
}).observe(document.documentElement, {
  childList: true, subtree: true, attributes: true, attributeFilter: ['class']
});

// Deferring to the storage callback also means document.head exists by the time
// DarkReader.enable runs -- calling it at raw document_start is the fragile path.
chrome.storage.sync.get({ mode: 'on' }, ({ mode }) => apply(mode));
// Fires in every open portal tab, so the popup needs no "tabs" permission.
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'sync' && c.mode) apply(c.mode.newValue);
});
