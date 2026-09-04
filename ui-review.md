# Focus Hub Popup — UI Review Fix Plan

Scope: `extension/popup.html`, `extension/popup.js`, `extension/theme-data.js`.
Baseline: Vercel Web Interface Guidelines + impeccable-design-polish audit (2025-09-05).

> **Intentionally excluded (per request):** "Enabling keyboard tab switching" —
> no `tabindex`/`role="tablist"`/arrow-key nav is planned in this pass. Everything
> below is fair game.

Fixes are ordered by impact (accessibility first, then robustness, then polish).
Line numbers refer to the current code; they drift as edits land.

---

## 1. Visible keyboard focus on every interactive element

**Where:** `popup.html:56`, `:516`, `:566`; global style block; `popup.js` dynamic buttons.

**What:**
- `input[type="range"] { outline: none }` (`popup.html:56`) leaves sliders with zero
  keyboard indicator. Remove the bare `outline:none` and style the slider thumb
  (and/or a wrapper ring) for `:focus-visible`.
- Add one consistent `:focus-visible` ring rule (e.g. `outline: 2px solid var(--accent);
  outline-offset: 2px`) applied to buttons, `select`, `input`, `textarea`, and dynamic
  buttons created in `popup.js` (presets `:210`, site rows `:376`, theme grid `:681`).
- Keep the `:focus` border-color swap on text inputs only as an *additional* cue —
  never as the only cue (`:focus` border on its own is a subtle cue on light/pastel accents).
- Locked theme buttons (`popup.html:459-470`) are focusable dead stops: apply
  `disabled` semantics (see Fix 5).

**Acceptance:** Tab through the whole popup with the keyboard — every stop shows a
clearly visible ring and does something (or is properly disabled).

---

## 2. Accessible names for icon-only and unlabeled controls

**Where:** `popup.html:600-601`, `:613-627`, `:772`; `popup.js:218-225`, `:361-385`, `:676-702`.

**What:**
- **Planner button** (`popup.html:600`): add `aria-label="Open Daily Planner"` (keep
  `title` as secondary).
- **Tab icons** (`popup.html:613-627`): each SVG gets `aria-hidden="true"` and its
  `<label>` gets `aria-label` (Timer, Modulation, Blocking, Themes, Settings) — screen
  readers currently announce nothing. (Wire `role="tab"`/`aria-selected` only when the
  keyboard-tab work is later enabled; labels alone suffice now.)
- **Site-row checkboxes** (`popup.js:361-369`): checkbox has no name. Give each row an
  accessible label, e.g. wrap in a `<label>` or set `aria-label`/`title` = `Toggle
  <domain>`.
- **Delete buttons** (`popup.js:218-225` presets, `:376-379` sites): glyph-only `×`.
  Replace `title`-only with `aria-label` ("Delete preset …" / "Remove example.com");
  keep `title` for the hover tooltip.
- **Help icon** (`popup.html:772`, CSS `:282-311`): hover-only tooltip — add
  `aria-label` describing its content, and make the icon keyboard-focusable
  (`tabindex="0"` + `:focus`/`:focus-within` shows the tooltip) or move the
  explanation into visible text.
- **Tooltip arrow/copy hygiene:** all tooltip SVGs and tab SVGs get `aria-hidden="true"`
  (decorative); every `::after` tooltip needs a text-only equivalent for SR users.

**Acceptance:** Inspect with a screen reader (or Chrome a11y tree): no control is
announced as an unlabeled button/checkbox.

---

## 3. Contrast fixes (WCAG AA)

**Where:** `popup.html:216-225` (`.tab-label`), `:142-145` (Stop button), `:395-399`,
`:459-470`; `theme-data.js` palette tokens (`:9`, `:51`, `:59`).

**What:**
- **Inactive tabs:** `--text-muted #888` at `opacity: 0.6` on `#2a2a2a` lands around
  2:1. Use the palette's real secondary color (no extra opacity layer) or a dedicated
  muted token that holds ≥4.5:1 on the base background; keep `opacity:1`.
- **Stop / danger fills:** white on `--danger #ff4757` is ≈3.3:1 — fails for the 13px
  "Stop" button and `×` glyphs. Darken the default `--danger` (e.g. `#e02a38` or
  darker per base palette) or use `--text-on-accent`-style dark text on the light
  danger fills. Audit every palette in `theme-data.js` — danger/success fills must
  pass 4.5:1 with their label text.
- **Low-saturation accents:** default `dark`/`light` accents (`#b0b0b0`, `#d0d0d0`)
  make active-tab borders and primary buttons barely distinguishable. Bump the default
  accent saturation, or introduce a separate `--accent-active` for border/active cues.
- **Muted/small tokens:** `theme-data.js:51` (vibrant `--text-muted #707090` on
  `#1a1a2e` ≈3.4:1) and `:59` (golden) drop below 4.5:1 — raise until they pass on
  their base background.
- Apply the same sweep to every opacity-dimmed interactive state
  (`opacity: 0.4/.45/.5/.6` at `popup.html:314, 460, 489, 515, 544, 573`) — prefer
  explicit color tokens over opacity layering.

**Acceptance:** All body-copy-size text ≥4.5:1, large/bold ≥3:1, non-text UI ≥3:1 —
spot-checked across `dark`, `light`, `pastel`, `vibrant`, `golden` palettes.

---

## 4. Minimum type scale of 12px

**Where:** `popup.html:431` (`.theme-btn` 10px), `:658-659`, `:776-777`, `:793-796`
(11px inputs/buttons/notes), `:291-306` (tooltip 11px).

**What:**
- Raise 10px → 12px minimum for any interactive control label or caption. Sizes to
  touch: `.theme-btn` font (grid may need a 4-column layout or taller tiles to fit),
  Save/Restore buttons, "Opens via the Focus Music button…" note, preset name input.
- Keep 11px only for purely decorative micro-copy that is duplicated elsewhere; prefer
  12px as the floor.
- Tooltip text (`:303`) can stay 11px if contrast passes, but bump to 12px if the
  layout allows.

**Acceptance:** No interactive element or primary instruction renders below 12px.

---

## 5. Real disabled/selected semantics on segmented + locked controls

**Where:** `popup.html:356-379` (`.mode-toggle`), `:459-470` (`.theme-btn.locked`);
`popup.js` mode handlers, `:696-699`.

**What:**
- **Mode toggles** (Reason/Complete Block, Blocklist/Whitelist, Low/High): expose state
  beyond `.active` — set `aria-pressed="true|false"` on the buttons when toggled.
- **Locked theme buttons:** replace the `pointer-events:none` + `?` placeholder hack
  with a real `disabled` button (or `aria-disabled="true"` + `tabindex="-1"`) so
  keyboard users don't land on inert stops; keep the lock affordance purely visual
  (`opacity`/lock icon), not `pointer-events`-based.

**Acceptance:** State changes are announced (`aria-pressed`); disabled controls are
skipped by the keyboard and reported as disabled.

---

## 6. Form semantics: labels, autocomplete, name

**Where:** `popup.html:642-643` (`#customMinutes`), `:774` (`#suggestionsEditor`),
`:658`, `:763`, `:793`.

**What:**
- `#customMinutes`: associate the "min" unit properly — a `<label for="customMinutes">`
  or `aria-label="Minutes"`, and drop reliance on placeholder-only naming.
- `#suggestionsEditor`: add a visible `<label>` (e.g. "Text to show after reason
  chosen") wired via `for`/`id`, matching the div at `:772`.
- Add `name` attributes to all text/number inputs and `autocomplete="off"` (non-auth
  form; prevents password-manager triggers).
- Keep the `keydown` Enter-to-add behavior already present at `popup.js:579`.

**Acceptance:** Every field has a programmatic label; Chrome DevTools > Accessibility
shows names on all inputs.

---

## 7. Animation hygiene

**Where:** `transition: all` at `popup.html:97, 113, 170, 224, 374, 434, 484`;
no reduced-motion handling anywhere.

**What:**
- Replace each `transition: all 0.15s/0.2s` with explicit property lists
  (typically `background-color, color, border-color, opacity`).
- Add a global reduced-motion rule:
  `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; } }`
- Keep all transitions on `transform`/`opacity` for compositor-friendliness where motion
  is added later.

**Acceptance:** No `transition: all` remains; toggling OS "reduce motion" disables
crossfades/tooltip fades.

---

## 8. Copy & typography fixes

**Where:** `popup.html:658` (`"Preset name..."`), `:793` (`"...v=..."`), general labels.

**What:**
- Replace `...` ellipses with `…` in placeholders; placeholders should end with `…`
  or show a concrete example (e.g. `https://youtube.com/watch?v=…`).
- Standardize button capitalization (Title Case per Chicago: "Roll!", "Start", "Stop",
  "Save", "Restore Defaults" — currently `:777` is lowercase "Restore defaults").
- Prefer action-specific button text ("Save Music URL" over bare "Save" where the
  context is ambiguous, `:794`).
- Numbers already tabular (`:530` ✓) — keep.

**Acceptance:** No straight `...` in user-visible copy; heading/button casing consistent.

---

## 9. Panel height: cap + scroll instead of unbounded stack

**Where:** `popup.html:7-34` (`body`), panels `:651-743` (Modulation), `:745-782` (Block).

**What:**
- Chrome popups cap at ~600px tall. Modulation (4 section boxes + controls) and Block
  (site list + 160px editor + suggestions) exceed it, so content clips.
- Set `body { max-height: 600px; overflow-y: auto; }` (or on `#controls`) with a
  `overscroll-behavior: contain`, and consider collapsing section boxes
  (`section-sub-controls`) so panels stay scannable.
- Reserve `scrollbar-gutter` to avoid layout shift when the scrollbar appears.

**Acceptance:** Every panel is fully reachable by scrolling; no control is cut off at
the popup edge in Chrome.

---

## 10. Destructive actions: confirm before delete

**Where:** `popup.js:380-385` (site delete — immediate); contrast with preset delete
which already confirms (`popup.js:224`).

**What:**
- Add the same lightweight confirm for site removal ("Remove example.com?"), or an
  undo window. Keep it synchronous and cheap; the action also re-applies blocking.
- The Block-page "Clear all" (planner/block page, out of this file's scope) should
  follow the same rule when touched later.

**Acceptance:** No single-click permanent delete exists in the popup without
confirmation or undo.

---

## 11. Long-content handling and empty states

**Where:** `popup.html:395-399` (`.site-name`), `:596-599` (`#captureTarget`), `:761`.

**What:**
- Domain rows: `min-width: 0` + `overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap` on `.site-name` so very long domains truncate instead of
  wrapping/breaking the row layout.
- `#captureTarget`: render a muted default like "No tab captured" instead of blank
  space (empty-state handling), and truncate long tab titles the same way.
- Empty site list: show a one-line hint ("Nothing blocked yet — add a site below") so
  the panel doesn't look broken.

**Acceptance:** Long domains/titles truncate with ellipsis; no blank control surfaces
on empty state.

---

## 12. Real heading structure

**Where:** section titles are all `<label>`s (`popup.html:652-654`, `:767`, `:791`,
`:802`).

**What:**
- Convert section titles (`Presets`, `Block Page`, `Focus Music`, `Visible Tabs`) to a
  lightweight heading hierarchy (`h2`/`.section-header`-styled) or keep as labels but
  add `role="heading" aria-level="2"` — simplest is semantic `<h2>` reusing current
  styles.
- Popup gets one visible title context via the top controls; no need for a skip link at
  this size.

**Acceptance:** Document outline shows a coherent heading structure; no visual change.

---

## Quick-win order (if time-boxed)

1. Fix 1 (focus rings) + Fix 2 (aria-labels) — a11y core
2. Fix 3 (contrast) + Fix 5 (aria-pressed/disabled) — state legibility
3. Fix 4 (type floor) + Fix 8 (copy) — visual polish
4. Fix 9 (height cap), Fix 6/7/10/11/12 — hardening
