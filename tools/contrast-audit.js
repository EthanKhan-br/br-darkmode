/* Paste into DevTools console on any portal page, with dark mode ON.
   Flags unreadable text and regions the engine failed to theme.
   Not part of the extension -- a QA tool, never loaded by the manifest. */
(() => {
  const lum = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const parse = (s) => {
    const n = (s.match(/[\d.]+/g) || []).map(Number);
    return n.length >= 3 ? { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 } : null;
  };
  // Real background = first ancestor that isn't transparent.
  const bgOf = (el) => {
    for (let n = el; n && n !== document.documentElement.parentNode; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.05) return c.rgb;
    }
    return [21, 24, 33];
  };
  // Structural hint only -- emotion hashes rehash every deploy, so strip them.
  const hint = (el) => {
    const a = el.getAttribute('aria-label'), r = el.getAttribute('role');
    const cls = [...el.classList].filter((c) => !/^css-/.test(c)).slice(0, 2).join('.');
    return el.tagName.toLowerCase() +
      (a ? `[aria-label="${a}"]` : '') + (r ? `[role="${r}"]` : '') +
      (cls ? `.${cls}` : '') + ` <- ${el.parentElement?.tagName.toLowerCase() || '?'}`;
  };

  const bad = [], light = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || !el.offsetParent) continue;

    const bg = bgOf(el);
    // Region the engine missed entirely: a near-white surface on a dark page.
    if (lum(bg) > 0.75 && el.getBoundingClientRect().width > 80) {
      light.push({ el: hint(el), bg: `rgb(${bg})`, tag: el.tagName });
    }

    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!text) continue;
    const fg = parse(cs.color);
    if (!fg || fg.a < 0.05) continue;

    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    const r = ratio(fg.rgb, bg);
    if (r < (large ? 3 : 4.5)) {
      bad.push({
        ratio: +r.toFixed(2), need: large ? 3 : 4.5, size: `${px}px`,
        fg: cs.color, bg: `rgb(${bg})`,
        text: (el.textContent || '').trim().slice(0, 40), where: hint(el)
      });
    }
  }

  bad.sort((a, b) => a.ratio - b.ratio);
  console.log(`%c${location.pathname}`, 'font-weight:bold;font-size:14px');
  console.log(`%c${bad.length} low-contrast  ${light.length} unthemed-light`,
    `color:${bad.length || light.length ? '#ff8a65' : '#8bc34a'}`);
  if (bad.length) { console.log('--- text below WCAG AA ---'); console.table(bad); }
  if (light.length) { console.log('--- surfaces the engine missed ---'); console.table(light.slice(0, 15)); }

  window.__brAudit = { page: location.pathname, bad, light };
  console.log('Run  copy(JSON.stringify(__brAudit))  to put this on your clipboard.');
})();
