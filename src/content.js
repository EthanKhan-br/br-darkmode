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
