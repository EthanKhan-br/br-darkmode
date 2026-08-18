# Brief for Claude in Chrome — dark mode QA walk

Paste this into the Claude side panel with the portal open. Do one batch of pages
per conversation; long walks lose fidelity.

---

I'm QA-ing a dark mode Chrome extension on `portal.businessrocket.com`. It uses the
Dark Reader engine (runtime HSL lightness inversion) and it's already loaded and ON.
Your job is to find what it gets **wrong**. Do not try to fix anything and do not
edit any files — just report.

## Pages to walk

Company Orders, Clients, Lead Manager, Web Submissions, Invoices, Companies,
Company Subscription, Tax Service Orders, Failed Payments, Processing and Fee,
Calendar, Dashboard, RockyAI, White Label Partners, Power Ups.

For each page: load it, screenshot it, then **interact** — open a dropdown, click
into a text input, open a modal or detail row. Elements render on demand and the
worst defects only appear on interaction.

## What counts as a defect

1. Text you can't comfortably read against its background.
2. A surface still light/white on a dark page — the engine missed it.
3. Something *already* dark that got wrongly lightened (sidebar, stat cards).
4. The BusinessRocket logo going muddy — it's navy + orange script on white.
5. Orange notification badges vibrating or glowing against dark.
6. Form fields whose borders have gone near-invisible (MUI outlined inputs).
7. Avatars, client photos, or logos that look inverted or washed out.
8. Chart/graph axis labels, gridlines, or legends that vanished.
9. Icons that disappeared into the background.

## Already known — do NOT report these

- The TinyMCE rich-text editor renders fully light. Accepted, won't be fixed.
- Google Fonts and CSP errors in the console. Harmless noise.

## How to report each defect

- **Page** and what's wrong, in one line.
- **A structural selector**: tag plus `aria-label`, `role`, `data-*`, or stable
  semantic class. **Never a hashed MUI class** like `.css-1ab2c3` — those rehash on
  every deploy, so any rule built on one silently breaks. If the only distinguishing
  feature is a hash, describe the element's position and nearby text instead.
- **The computed colors**: `color` and `background-color` from the styles panel.
- A screenshot of the region.

## Optional, if you can run console JS

Fetch and run:
https://raw.githubusercontent.com/EthanKhan-br/br-darkmode/main/tools/contrast-audit.js

It prints a table of text below WCAG AA plus unthemed light surfaces, and stores
`window.__brAudit`. Paste that JSON into your report. If you can't execute console
JS, skip it and rely on the styles panel — the visual findings matter more.

## Output

One markdown list, grouped by page, worst first. End with the three defects you'd
fix first if you only had time for three.
