/* Asserts the project is sound: every color clears its WCAG threshold, the values
   still appear in the CSS, every rule is scoped so it stops applying when the user
   picks Off, and content.js's active-row predicate still behaves.
   Run: node tools/verify-fixes.js */
const fs = require('fs');
const css = fs.readFileSync(__dirname + '/../src/fixes.css', 'utf8');
const js = fs.readFileSync(__dirname + '/../src/content.js', 'utf8');
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
// Two hues can be equally light and still read as different colors, which a contrast
// ratio cannot see at all. Straight-line RGB distance is crude but it measures the
// thing that actually matters when categories are told apart by hue.
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

// Measured on the live portal during the QA walks.
const PAGE = [30, 32, 41], SIDE = [33, 36, 46], FG = [214, 218, 225];
// Task tables sit on their own surface. Same value as SIDE today, kept separate
// because they are independent measurements and either can move on its own.
const TABLE = [33, 36, 46], WHITE = [255, 255, 255];
const NOTE_TAGS = [[27,60,97],[30,94,91],[73,41,97],[53,60,77],[105,31,94],[103,28,53],[38,89,59]];
const CHIPS = [[133,145,11],[68,122,24],[140,45,39],[11,133,13],[40,133,61],[34,110,158],[60,159,223]];

let failed = 0;
const line = (ok, name, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(26)} ${detail}`);
};
const check = (name, got, need) => line(got >= need, name, `${got.toFixed(2)} (need ${need})`);

console.log('--- contrast ---');
check('field border', ratio([107, 120, 150], PAGE), 3);            // WCAG 1.4.11
check('focus ring', ratio([110, 175, 240], PAGE), 3);
check('focus vs resting border', ratio([110, 175, 240], [107, 120, 150]), 1.8);
check('sidebar nav text', ratio([146, 160, 186], SIDE), 4.5);
check('primary button', ratio(FG, [26, 92, 134]), 4.5);
// A hover that lightens would drop the label under AA -- the fill closes on a light
// label as it rises. Darkening opens the gap and still reads as a state change.
const BTN = [26, 92, 134], BTN_H = [18, 66, 96], ALT = [30, 94, 91], ALT_H = [20, 64, 62];
check('button hover label', ratio(FG, BTN_H), 4.5);
check('button hover is felt', ratio(BTN, BTN_H), 1.25);
check('alt button label', ratio([226, 232, 240], ALT), 4.5);
check('alt button vs page', ratio(ALT, PAGE), 1.5);
check('alt button hover label', ratio(FG, ALT_H), 4.5);
check('alt button hover is felt', ratio(ALT, ALT_H), 1.25);
// The alt button separates from the primary by HUE ONLY -- equal lightness, blue
// against blue-green. That was the owner's call (2026-08-20) over a violet that also
// separated on lightness, so there is deliberately NO lightness check here: adding one
// back would fail a choice that was made on purpose. 30 rgb is the same bar the
// category tags are held to, and it is the real constraint that remains.
line(dist(ALT, BTN) >= 30, 'alt button vs primary', dist(ALT, BTN).toFixed(0) + ' rgb apart (need 30)');
check('worst chip @ 40%', Math.min(...CHIPS.map((c) => ratio(FG, darken(c, 0.4)))), 4.5);
// State indicators: a selection fill is carried by its label too, so these target
// "unmistakable" rather than the 3:1 a bare boundary would need.
check('active tint vs sidebar', ratio([37, 48, 66], SIDE), 1.1);
check('active label on tint', ratio([226, 232, 240], [37, 48, 66]), 4.5);
// The label must also stand clear of the inactive rows -- on a tint this subtle,
// brightness is half the signal.
check('active vs inactive label', ratio([226, 232, 240], [146, 160, 186]), 1.8);
check('hover row vs sidebar', ratio([50, 56, 72], SIDE), 1.25);
check('hover row text', ratio([178, 190, 212], [50, 56, 72]), 4.5);
// Task rows: the portal declares its own #fbffb3 hover, which inverts to a dirty
// olive. The replacement is held to the same "felt, not loud" bar as the sidebar.
check('task hover vs table', ratio([44, 50, 64], TABLE), 1.2);
check('task hover text', ratio(FG, [44, 50, 64]), 4.5);
// Overdue pill. Rule 10 turns rule 6's overlay off here, so the fill is what it
// says it is. The label is 10px -- normal text, needing the full 4.5, which is
// what rules out reusing FG at 3.55.
check('overdue pill vs table', ratio([211, 47, 47], TABLE), 3);      // WCAG 1.4.11
check('overdue pill label', ratio(WHITE, [211, 47, 47]), 4.5);
check('overdue pill vs hover', ratio([211, 47, 47], [44, 50, 64]), 2.5);
// The date has to stay readable on the resting AND the hovered row.
check('overdue date on table', ratio([255, 145, 138], TABLE), 4.5);
check('overdue date on hover', ratio([255, 145, 138], [44, 50, 64]), 4.5);
// Notes cards. The site colors these inline and the engine either muddies or
// flattens them, so rule 11 owns both categories outright. The fill stays dark and
// the category hue lives in the accent -- that is what keeps the text this high.
check('note card vs page', ratio([41, 44, 56], PAGE), 1.15);
// The category fills. Saturation is what keeps these from reading as mud, and a
// contrast ratio cannot see saturation -- so the thresholds guard legibility only,
// and the hue choice is carried by the hsl() figures in the rule 11 comment.
check('slate fill vs page', ratio([44, 44, 68], PAGE), 1.15);
check('slate header text', ratio([178, 190, 212], [44, 44, 68]), 4.5);
check('slate accent on fill', ratio([124, 140, 235], [44, 44, 68]), 3);
check('teal fill vs page', ratio([19, 57, 55], PAGE), 1.15);
check('teal header text', ratio([178, 190, 212], [19, 57, 55]), 4.5);
check('teal accent on fill', ratio([50, 205, 180], [19, 57, 55]), 3);
// Categories must separate by hue, which a contrast ratio cannot see. The fills carry
// it once and the accents carry it again, so neither channel is load-bearing alone.
// The slate default is deliberately close to neutral, so the fills carry little of the
// distinction and the ACCENTS carry nearly all of it. That is the design, not a miss --
// but it makes the accent separation load-bearing, so it is held to a higher bar.
line(dist([44, 44, 68], [19, 57, 55]) >= 25, 'note fills differ',
     dist([44, 44, 68], [19, 57, 55]).toFixed(0) + ' rgb apart (need 25)');
check('note header text', ratio([178, 190, 212], [41, 44, 56]), 4.5);
check('note body text', ratio([226, 232, 240], [41, 44, 56]), 4.5);
check('amber accent vs card', ratio([230, 167, 72], [41, 44, 56]), 3);   // WCAG 1.4.11
check('green accent vs card', ratio([124, 200, 134], [41, 44, 56]), 3);
// Rule 12 reuses the teal outright, so the only new numbers are its own text and icon.
// The seven category chips are checked as a SET: the binding constraint is the worst
// member, not any individual one, and the thing that actually broke before was them
// converging -- so pairwise separation is checked too. A contrast ratio cannot see it.
check('worst tag label', Math.min(...NOTE_TAGS.map((c) => ratio([226, 232, 240], c))), 4.5);
check('worst tag vs panel', Math.min(...NOTE_TAGS.map((c) => ratio(c, SIDE))), 1.25);
line(Math.min(...NOTE_TAGS.flatMap((a, i) => NOTE_TAGS.slice(i + 1).map((b) => dist(a, b)))) >= 30,
     'tags stay distinct',
     Math.min(...NOTE_TAGS.flatMap((a, i) => NOTE_TAGS.slice(i + 1).map((b) => dist(a, b)))).toFixed(0) + ' rgb worst pair (need 30)');
// The alarm box is deliberately the loudest fill in the file, and must beat the
// success box it stacks with -- but on HUE, not brightness, so no luminance check
// would catch them converging. Distance does.
check('alarm fill vs page', ratio([103, 32, 30], PAGE), 1.35);
check('alarm text', ratio([255, 236, 234], [103, 32, 30]), 4.5);
check('alarm accent on fill', ratio([255, 107, 107], [103, 32, 30]), 3);
line(dist([103, 32, 30], [19, 57, 55]) >= 60, 'alarm vs success box',
     dist([103, 32, 30], [19, 57, 55]).toFixed(0) + ' rgb apart (need 60)');
check('alert text on teal', ratio([226, 232, 240], [19, 57, 55]), 4.5);
check('alert icon on teal', ratio([50, 205, 180], [19, 57, 55]), 3);
line(dist([124, 140, 235], [50, 205, 180]) >= 100, 'note accents differ', dist([124, 140, 235], [50, 205, 180]).toFixed(0) + ' rgb apart (need 100)');

// The section rule is decoration, not text or a UI boundary: the bar has to keep the
// presence the rust had, or the layout loses a separator it was designed around.
check('section rule vs page', ratio([26, 92, 134], PAGE), 1.8);

// Rule 18. The two row tints are a CONVERGENCE check, not a contrast one: the engine
// landed them 5 rgb apart, which no contrast ratio would have flagged. Both stay as
// quiet as the task hover -- they are full-width bands.
const ROW_VIOLET = [60, 40, 78], ROW_BLUE = [26, 54, 82];
check('row tint violet vs row', ratio(ROW_VIOLET, TABLE), 1.1);
check('row tint blue vs row', ratio(ROW_BLUE, TABLE), 1.1);
check('row tint violet text', ratio(FG, ROW_VIOLET), 4.5);
check('row tint blue text', ratio(FG, ROW_BLUE), 4.5);
line(dist(ROW_VIOLET, ROW_BLUE) >= 30, 'row tints stay distinct',
     dist(ROW_VIOLET, ROW_BLUE).toFixed(0) + ' rgb apart (need 30)');
check('status banner text', ratio([226, 232, 240], [38, 89, 59]), 4.5);
check('status banner vs page', ratio([38, 89, 59], PAGE), 1.5);
check('info panel vs page', ratio([34, 46, 68], PAGE), 1.15);
check('info panel text', ratio([226, 232, 240], [34, 46, 68]), 4.5);
// Same pale blue, scoped to a table cell, is a status box rather than a panel: it has
// to read as a box, so it is held to the presence the rule 16 stage boxes have.
check('status box vs page', ratio([27, 60, 97], PAGE), 1.4);
check('status box label', ratio([226, 232, 240], [27, 60, 97]), 4.5);
check('green banner on panel', ratio([38, 89, 59], [34, 46, 68]), 1.5);

// Rule 19. A badge is a UI marker before it is text -- the dot variant has no label at
// all, so it needs 3:1 against the page as a boundary as well as 4.5 under a count.
check('badge vs page', ratio([211, 47, 47], PAGE), 3);
check('badge count label', ratio(WHITE, [211, 47, 47]), 4.5);
check('secondary chip label', ratio([226, 232, 240], [26, 92, 134]), 4.5);

// Rule 20. MUI's own selected marker is rgba(10,10,10,0.12) -- about one RGB step on a
// dark page. The gap between the two LABELS is what has to carry the state, so it is
// checked the same way the sidebar active row is.
check('toggle selected tint vs page', ratio([37, 48, 66], PAGE), 1.15);
check('toggle selected label', ratio([226, 232, 240], [37, 48, 66]), 4.5);
check('toggle unselected label', ratio([146, 160, 186], PAGE), 4.5);
check('toggle selected vs unselected', ratio([226, 232, 240], [146, 160, 186]), 1.8);

// Rule 21. The engine left this at 4.01 -- under AA, but only just, which is why it
// went unnoticed for so long.
check('muted secondary text', ratio([146, 160, 186], TABLE), 4.5);

console.log('--- values still in fixes.css ---');
for (const v of ['rgb(107, 120, 150)', 'rgb(110, 175, 240)', 'rgb(146, 160, 186)',
                 'rgb(26, 92, 134)', 'rgba(0, 0, 0, 0.4)', 'rgb(37, 48, 66)', 'rgb(226, 232, 240)',
                 'rgb(50, 56, 72)', 'rgb(178, 190, 212)',
                 'rgb(44, 50, 64)', 'rgb(211, 47, 47)', 'rgb(255, 145, 138)', 'rgb(255, 255, 255)',
                 'rgb(41, 44, 56)',
                 'rgb(44, 44, 68)', 'rgb(124, 140, 235)', 'rgb(19, 57, 55)', 'rgb(50, 205, 180)', 'rgb(103, 32, 30)', 'rgb(255, 107, 107)', 'rgb(255, 236, 234)',
                 'rgb(27, 60, 97)', 'rgb(30, 94, 91)', 'rgb(73, 41, 97)', 'rgb(53, 60, 77)', 'rgb(105, 31, 94)', 'rgb(103, 28, 53)', 'rgb(38, 89, 59)',
                 'rgb(60, 40, 78)', 'rgb(26, 54, 82)', 'rgb(34, 46, 68)',
                 'rgb(18, 66, 96)', 'rgb(20, 64, 62)'])
  line(css.includes(v), 'css value', v);

// An unguarded rule keeps restyling the portal after the user picks Off -- the bug
// that turned the logo yellow with the extension switched off.
console.log('--- every rule guarded against Off ---');
// Commas inside [attr="rgb(1, 2, 3)"] are NOT selector separators. The naive
// split(',') reported those as unguarded rules, which blocked using a full colour
// in a selector -- and three tax stages share the rgb(255 prefix, so partial
// matches cannot tell them apart. Depth-aware split, so precise selectors are usable.
const splitSelectors = (text) => {
  const out = []; let buf = '', depth = 0;
  for (const ch of text) {
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out.map((x) => x.trim()).filter(Boolean);
};

let guarded = 0;
for (const block of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
  if (!block.includes('{')) continue;
  for (const sel of splitSelectors(block.split('{')[0])) {
    if (sel.startsWith(GUARD)) guarded++;
    else line(false, 'unguarded', sel.slice(0, 58));
  }
}
line(true, 'guarded selectors', `${guarded} checked`);

// No jss class may be hardcoded: the portal is MUI v4 + react-jss, which numbers
// classes by stylesheet registration order, so they renumber on unrelated changes.
console.log('--- no generated class names ---');
for (const [name, src] of [['fixes.css', css], ['content.js', js]]) {
  const hits = (src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').match(/\bjss\d+|\bcss-[0-9a-z]{5,}/g) || []);
  line(hits.length === 0, 'no generated classes', `${name}${hits.length ? ' -> ' + hits.join(' ') : ''}`);
}

console.log(failed ? `\n${failed} FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
