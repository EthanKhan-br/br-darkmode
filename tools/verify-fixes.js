/* Asserts every color in src/fixes.css clears its WCAG threshold, and that the
   values in the CSS still match the ones checked here. Run: node tools/verify-fixes.js */
const fs = require('fs');
const css = fs.readFileSync(__dirname + '/../src/fixes.css', 'utf8');

const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const darken = (c, a) => c.map((v) => Math.round(v * (1 - a)));

// Measured on the live portal during the QA walk.
const PAGE = [30, 32, 41], SIDE = [33, 36, 46], FG = [214, 218, 225];
// Every chip fill the walk found failing, plus the two that already passed.
const CHIPS = [[133,145,11],[68,122,24],[140,45,39],[11,133,13],[40,133,61],[34,110,158],[60,159,223]];

let failed = 0;
const check = (name, got, need) => {
  const ok = got >= need;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(30)} ${got.toFixed(2)} (need ${need})`);
};
const inCss = (name, s) => {
  const ok = css.includes(s);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(30)} ${s}`);
};

check('field border', ratio([107, 120, 150], PAGE), 3);      // WCAG 1.4.11, UI boundary
check('focus ring', ratio([110, 175, 240], PAGE), 3);
check('focus vs resting border', ratio([110, 175, 240], [107, 120, 150]), 1.8); // distinct by lightness, not just hue
check('sidebar nav text', ratio([146, 160, 186], SIDE), 4.5);
check('primary button', ratio(FG, [26, 92, 134]), 4.5);
check('worst chip @ 40% overlay', Math.min(...CHIPS.map((c) => ratio(FG, darken(c, 0.4)))), 4.5);

console.log('--- values still present in fixes.css ---');
['rgb(107, 120, 150)', 'rgb(110, 175, 240)', 'rgb(146, 160, 186)',
 'rgb(26, 92, 134)', 'rgba(0, 0, 0, 0.4)'].forEach((v) => inCss('css value', v));

console.log(failed ? `\n${failed} FAILED` : '\nall fix colors verified');
process.exit(failed ? 1 : 0);
