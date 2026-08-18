// Resolves Off / On / Auto -> DarkReader on or off. That is the whole job.
const MQ = matchMedia('(prefers-color-scheme: dark)');
let applied = null;

function apply(mode) {
  const want = mode === 'on' || (mode === 'auto' && MQ.matches);
  // Drives the flash-killer rule in fixes.css.
  document.documentElement.dataset.brDark = want ? 'on' : 'off';
  if (want === applied) return;
  applied = want;
  // ponytail: 2 cross-origin stylesheets on this portal may not theme. If they
  // stay light, the fix is DarkReader.setFetchMethod routed through a background
  // service worker (which also needs that origin in host_permissions).
  want ? DarkReader.enable(BR_THEME) : DarkReader.disable();
}

const refresh = () => chrome.storage.sync.get({ mode: 'auto' }, ({ mode }) => apply(mode));

// Deferring to the storage callback also means document.head exists by the time
// DarkReader.enable runs -- calling it at raw document_start is the fragile path.
refresh();
// Fires in every open portal tab, so the popup needs no "tabs" permission.
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'sync' && c.mode) apply(c.mode.newValue);
});
MQ.addEventListener('change', refresh);
