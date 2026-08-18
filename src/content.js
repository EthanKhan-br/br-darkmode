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
}

/* The sidebar's current-page marker is unreachable from CSS. The portal is MUI v4
   with react-jss, and it marks the active row only by appending a generated class
   (jss37 on the row, jss41 on its label). JSS numbers sequentially by stylesheet
   registration order, so an unrelated component added anywhere earlier renumbers
   them -- never hardcode one. There are no hrefs to match either: the sidebar rows
   are plain divs navigating via onClick router pushes.
   So detect the row by relative structure and expose our own hook for fixes.css. */
function navRows() {
  // Author-written class, 11 of them, sidebar-only -- the one durable hook here.
  return [...document.querySelectorAll('div.extra-class')].map((d) => d.parentElement);
}
function navSubItems() {
  // Submenu children. The 4 collapsible group headers are the ones directly
  // inside a <ul>; those never take an active state, so drop them.
  return [...document.querySelectorAll('div[role="button"]')]
    .filter((el) => el.parentElement && !el.parentElement.matches('ul'));
}

// Is this background painted at all? Inactive rows are rgba(0,0,0,0). Active ones
// are rgba(10,10,10,0.04) today, but Dark Reader may rewrite that to an opaque
// rgb(), so a missing alpha channel counts as painted rather than as no-match.
// Extracted and exercised by tools/verify-fixes.js -- keep it a pure function.
function bgIsPainted(bg) {
  const c = (bg || '').match(/[\d.]+/g);
  if (!c || c.length < 3) return false;      // 'transparent', 'none', ''
  return c.length < 4 || Number(c[3]) > 0;   // no alpha = opaque
}

function tagActiveNav() {
  const rows = navRows(), subs = navSubItems();
  // Clear before measuring. Our own [data-br-active] styling sets a background,
  // which the sub-item test below would otherwise read back as the active signal
  // and latch a stale row on forever. getComputedStyle forces a style recalc, so
  // the reads after this loop see the portal's own values.
  [...rows, ...subs].forEach((el) => el.removeAttribute('data-br-active'));
  if (!applied) return;

  // Top level: the active row carries exactly one class more than its siblings.
  const base = Math.min(...rows.map((r) => r.classList.length));
  rows.forEach((r) => {
    if (r.classList.length > base) r.setAttribute('data-br-active', '');
  });

  // Submenu children have identical classes, so the only signal is a
  // non-transparent background (rgba(10,10,10,0.04) -- about one RGB step, which
  // is why it's invisible in dark mode). MUI uses the same 4% for :hover, hence
  // the exclusion, or whatever the pointer is over would read as current.
  subs.forEach((el) => {
    const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (c && c.length > 3 && +c[3] > 0 && !el.matches(':hover')) {
      el.setAttribute('data-br-active', '');
    }
  });
}

// React re-renders the sidebar on navigation. attributeFilter is 'class' only, so
// our own data-br-active writes can't retrigger this; rAF collapses bursts.
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; tagActiveNav(); });
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
