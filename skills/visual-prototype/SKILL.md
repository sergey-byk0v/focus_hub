---
name: visual-prototype
description: "Use when the user asks to check, compare, or preview visual styling before applying it to the Focus Hub extension — triggers on: prototype / mock / preview / try variants / side-by-side compare / test html / check how X looks / does this style work."
---

# Visual Prototyping for Focus Hub

Build throwaway HTML mockups in the project's `prototypes/` folder so the user
can judge a visual change **before** it touches `extension/`. Never edit
extension files while a style is still under discussion — prototype first,
get a pick, then implement.

## 1. Where prototypes live

- Always `prototypes/<topic>_<variant>.html` (project folder, git-tracked).
  Screenshots go next to them: `prototypes/<topic>_<variant>.png`.
- One self-contained file per comparison (inline `<style>`, no external deps,
  system fonts only — `Segoe UI` first, matching the extension).
- Screenshot with headless Chrome and show the image inline:

```sh
google-chrome-stable --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=5000 --run-all-compositor-stages-before-draw \
  --screenshot=prototypes/<name>.png --window-size=350,600 \
  "file://$PWD/prototypes/<name>.html"
```

- `--run-all-compositor-stages-before-draw` is mandatory: without it Chrome
  paints mid-transition frames that look like bugs.
- Popup-sized pages: `--window-size=350,600`. Comparison sheets: add height
  (~1000) and +30px width for the scrollbar.

## 2. Use the real tokens — never improvise colors

Start every prototype from the actual palette so comparisons are honest:

- Default tokens: copy the `body { --bg … --shadow-card }` block from
  `extension/popup.html` into the mock's `<style>`.
- Because prototypes live inside the repo, reference real assets directly —
  no copying needed:
  `<link rel="stylesheet" href="../extension/aero.css">`,
  `<script src="../extension/theme-data.js"></script>` (then inject
  `applyThemeById('<id>')` inline before `</body>` for theme variants).
- Forgetting the aero.css link renders UA-white controls and wastes a debug
  round — every mock that shows buttons/inputs/cards needs it.
- JS-driven UI (theme grid, preset grid) won't render from popup.js on a
  bare mock — inject a static mock of the elements instead, and activate tabs
  from the mock script
  (`document.getElementById('tabX').checked = true` — popup.js resets to Home
  on init, so setting the radio attribute alone is not enough).

## 3. Structure of a comparison sheet

- One `<h2>` per variant (short label + one-line explanation).
- Per variant show the states that matter: idle / hover (duplicate the node
  with a `.hov` class — static screenshots can't hover) / running-selected.
- Keep real dimensions (card `min-height`, 350px body) — scaled-down mocks lie.
- For edge/line bugs: add a `transform: scale(2–3)` zoom section; verify with
  a pixel scan, not by eye:

```python
from PIL import Image
im = Image.open('/tmp/opencode/x.png').convert('RGB')
# sample columns/rows through the suspected edge and print RGB values
```

## 4. Known rendering traps (all hit in this repo already)

- **Semi-transparent border on a rounded gradient element** → Chrome bleeds the
  gradient's first stop as a 1px light line below the box. Use `border: none`
  in prototypes too, or the mock will show a line the real fix removes.
- **`<button>` does not inherit text color** (UA default black) — set explicit
  `color` or `color: inherit` in mocks of button-based UI.
- **Missing copied assets** (aero.css / popup.js / theme-data.js) silently
  render UA defaults — if a mock looks white/washed-out, check the copies first.
- Chrome paints headless screenshots before CSS variables/JS settle unless
  both `--virtual-time-budget` and `--run-all-compositor-stages-before-draw`
  are passed.

## 5. Workflow

1. Ask/derive the variants to compare (max 3 — more is noise).
2. Build one sheet, screenshot, show inline, note what to look at.
3. Keep the sheets in `prototypes/` until the change ships; delete a round's
   files only when the user confirms they're obsolete (they're git-tracked,
   so ask before `git rm`).
4. Only after the user picks: switch to implementation and change
   `extension/` (respecting the single-source rule — recipes go into
   `extension/aero.css`, not page CSS).
