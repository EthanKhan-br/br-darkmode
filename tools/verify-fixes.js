/* Asserts src/fixes.css is sound: every color clears its WCAG threshold, the
   values still appear in the CSS, and every rule is scoped so it stops applying
   when the user picks Off.  Run: node tools/verify-fixes.js */
const fs = require('fs');
const css = fs.readFileSync(__dirname + '/../src/fixes.css', 'utf8');
const GUARD = 'html:not([data-br-dark="off"])';

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
const CHIPS = [[133,145,11],[68,122,24],[140,45,39],[11,133,13],[40,133,61],[34,110,158],[60,159,223]];

let failed = 0;
const line = (ok, name, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(30)} ${detail}`);
};
const check = (name, got, need) =>
  line(got >= need, name, `${got.toFixed(2)} (need ${need})`);

console.log('--- contrast ---');
check('field border', ratio([107, 120, 150], PAGE), 3);            // WCAG 1.4.11
check('focus ring', ratio([110, 175, 240], PAGE), 3);
check('focus vs resting border', ratio([110, 175, 240], [107, 120, 150]), 1.8);
check('sidebar nav text', ratio([146, 160, 186], SIDE), 4.5);
check('primary button', ratio(FG, [26, 92, 134]), 4.5);
check('worst chip @ 40% overlay', Math.min(...CHIPS.map((c) => ratio(FG, darken(c, 0.4)))), 4.5);

console.log('--- values still present in fixes.css ---');
for (const v of ['rgb(107, 120, 150)', 'rgb(110, 175, 240)', 'rgb(146, 160, 186)',
                 'rgb(26, 92, 134)', 'rgba(0, 0, 0, 0.4)'])
  line(css.includes(v), 'css value', v);

// An unguarded rule keeps restyling the portal after the user picks Off -- the
// bug that turned the logo yellow with the extension switched off.
console.log('--- every rule guarded against Off ---');
for (const block of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
  if (!block.includes('{')) continue;
  for (const sel of block.split('{')[0].split(',').map((s) => s.trim()).filter(Boolean))
    line(sel.startsWith(GUARD), 'guarded', sel.slice(0, 58));
}

console.log(failed ? `\n${failed} FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
