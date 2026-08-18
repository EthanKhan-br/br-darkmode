// Resolves On / Off -> DarkReader on or off. That is the whole job.
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
}

// Deferring to the storage callback also means document.head exists by the time
// DarkReader.enable runs -- calling it at raw document_start is the fragile path.
chrome.storage.sync.get({ mode: 'on' }, ({ mode }) => apply(mode));
// Fires in every open portal tab, so the popup needs no "tabs" permission.
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'sync' && c.mode) apply(c.mode.newValue);
});
