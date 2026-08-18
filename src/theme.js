// The tuning knob. Edit these, reload the extension, reload the portal.
// Rules that matter: never pure #000 bg, never pure #fff text. Target ~12:1,
// not 21:1 -- #151821 / #dfe3ea is 13.8:1, AAA without the halation. (The plan
// doc says 12.6:1; that was wrong, verified with tools/contrast-audit.js math.)
const BR_THEME = {
  brightness: 100,
  contrast: 92,                          // softens MUI's pure-white cards
  sepia: 0,
  grayscale: 0,
  darkSchemeBackgroundColor: '#151821',  // near-black, blue cast to match brand navy
  darkSchemeTextColor: '#dfe3ea',
  selectionColor: 'auto',
  useFont: false,                        // keep the portal's own fonts
  styleSystemControls: true
};
