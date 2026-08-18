# BusinessRocket Portal Dark

Dark mode for `portal.businessrocket.com` — and nothing else, ever.

## Install (any machine)

```
git clone https://github.com/EthanKhan-br/br-darkmode.git
```

Then `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick the folder.

## Use

Click the toolbar icon: **On** / **Off**. Defaults to On. The choice rides
`chrome.storage.sync`, so it follows your Chrome profile to other machines and applies
to every open portal tab at once.

There is deliberately no follow-the-system mode: `prefers-color-scheme` tracks Chrome's
own appearance setting rather than Windows, which made it more confusing than useful.

## Why it's built this way

The portal is React + MUI: class names are emotion-hashed and rehash on every deploy,
there is no color-token layer to flip, and 90 elements carry inline color styles. Static
CSS can't win that. So the engine is a vendored [Dark Reader](https://github.com/darkreader/darkreader)
(v4.9.128, MIT) doing runtime HSL lightness inversion — hue preserved, which is why the
brand navy stays navy instead of turning orange the way `filter: invert()` does.

`host_permissions` is scoped to the one host, so Chrome itself refuses to inject anywhere
else. No `tabs`, no `activeTab`, no `<all_urls>`, no background service worker.

## Tuning

- `src/theme.js` — colors and contrast. The knob. Reload the extension after editing.
- `src/fixes.css` — site-specific corrections, currently a TODO checklist. **Never write a
  hashed MUI selector** (`.css-1ab2c3`) here; use structural ones (`nav`, `[aria-label]`).

## QA

`tools/chrome-qa-brief.md` briefs Claude in Chrome to walk the portal and report
defects. `tools/contrast-audit.js` is a console script that flags sub-AA text.

After changing any color in `src/fixes.css`, run:

```
node tools/verify-fixes.js
```

It asserts every value still clears its WCAG threshold and still appears in the CSS.
