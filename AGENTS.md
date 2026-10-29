# Focus Hub — Agent Documentation

**Current release: v_0_4_0 (manifest 1.5.0)**

## Agent Instructions

1. **Core Behavior: Search Before You Build**
   - Whenever you are presented with a problem, bug, or feature request, your first step must be to search for existing solutions.
   - **External Search:** Use web search to find established libraries, packages, or well-documented patterns that solve the problem.
   - **Internal Search:** Search the current codebase to see if a utility or pattern already exists before creating a new one.
   - **Action:** Only write custom code if no existing, reliable solution is found, or if the user explicitly requests a custom implementation. If you find a library, state its name and use it.

2. **Communication Style: Extreme Conciseness**
   - Do not write long, verbose responses. Eliminate filler text, conversational pleasantries, and unnecessary explanations.
   - When asked about possibilities (e.g., "Can you do X?", "Is it possible to Y?"): answer with a direct "Yes" or "No", provide a maximum of 2-3 short bullet points stating how (e.g., a specific library, API, or command), and do not write implementation code unless explicitly asked to do so.
   - When explaining concepts: use brief, high-level bullet points; keep the entire response under 4 sentences; get straight to the technical core.

3. **Code Generation Rules**
   - Provide only the code that has changed or is necessary. Do not output entire files if only a few lines changed.
   - Include brief comments only where the logic is complex or non-obvious.
   - If you used an existing library based on Section 1, mention it in a single-line comment above the implementation.

4. **Single-Source Styling (Aero design system)**
   - All visual recipes — glass panes/strips, gloss buttons, groove fields, slide switches, aurora backdrop — live ONLY in `extension/aero.css` as utility classes: `.aero-pane`, `.aero-pane-lite`, `.aero-strip`, `.aero-btn` (`.glass` = neutral chip, `.danger` = red), `.aero-seg` (segmented control), `.aero-field`, `input.aero-switch`, `.aero-vfill`, plus `body.aero` element defaults and the aurora backdrop.
   - Page CSS (popup.html, block.css, reading-list.html) keeps layout/spacing/typography only — never re-declare gradient/shadow/glass recipe values.
   - Selected/active states of neutral chips promote to accent gloss via the grouped selector in aero.css (`.aero-btn.glass.selected/.active`, `.aero-seg button.active`) — do not copy the gloss recipe into state rules.
   - Dynamically created elements get their aero classes at creation time (popup.js: preset/theme/dc-config buttons, capture state swap; block.js: chart fills; reading-list.js: item rows, row buttons).
   - `aero.css` must load BEFORE page styles; themes recolor everything through `--accent`/`--glass-*` tokens from `theme-data.js` — never hardcode hue values in page CSS (fixed card hues via `--card-accent`/`--ac` hooks are the exception).

## Release & Update Workflow

The release process is codified in the project skill `skills/release-focus-hub/`; the workflow below is the authoritative source of truth. For reviewing visual styling before implementing it, use the project skill `skills/visual-prototype/` (HTML mocks in `prototypes/`, headless screenshots, pixel-verification).

1. **Bump version** in `extension/manifest.json` (patch bump for fixes, minor for features)
2. **Commit all changes**:
   ```sh
   git add extension/ AGENTS.md
   git commit -m "Brief description of changes"
   ```
3. **Update AGENTS.md** to reflect the new version and any workflow changes
4. **Create release zip** — zip the entire `extension/` folder:
   ```sh
   python3 -c "import shutil; shutil.make_archive('versions/focus_hub_v_0_0_X', 'zip', 'extension')"
   ```
   Name follows sequence: `focus_hub_v_0_1_0.zip` (next release), `focus_hub_v_0_1_1.zip`, ... — `0_X_Y` where minor features bump `X`, patches bump `Y`.
5. **Stage and commit the zip + AGENTS.md**:
   ```sh
   git add versions/ AGENTS.md
   git commit -m "Release v_0_0_X"
   ```
6. **Push to remote**:
   ```sh
   git push
   ```
7. **Load into Chrome for testing** (if not already loaded):
   - Go to `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked" then select `extension/` folder

### Notes
- Always commit the extension code before creating the zip
- The `versions/` folder is version-controlled so release zips are tracked
- Test in Chrome before pushing — load unpacked after each change
- AGENTS.md should be updated to reflect the new version before committing

## Gotchas & Pitfalls

1. **`applyThemeById()` overwrites accent** — spreads base palette, then overwrites `--accent`/`--accent-hover` with theme's `accent`/`accentHover`. If base palette has orange accent but theme has gold accent, buttons will be gold.
2. **Separate storage keys** — popup uses `blocklistSites` (objects with `enabled`), background uses `blockedDomains` (flat string arrays). They are separate keys. Don't confuse them.
3. **Cooldown is in storage** — `nextUnlockTime` persists across popup closes; clear it to reset.
4. **Inline styles override CSS** — `updateTabVisibility()` uses inline `display`, which beats CSS `:checked ~` rules.
5. **Service worker state** — background.js variables reset on SW idle; reload from storage on each message.
6. **No remote code** — all audio is client-side, no external assets.
7. **Tab approval race** — `chrome.storage.session.set` from block page context is not immediately visible to service worker context after Chrome ≥150 update. Keep approval writes in the service worker (the `APPROVE_TAB` message handler writes to `chrome.storage.session`, and `onBeforeNavigate` reads/consumes it in the same SW context, so it's always visible). Approvals live in `chrome.storage.session` (keyed by tabId → array of URLs) so they survive SW termination; `onStartup`/`onInstalled` clear the session to drop stale entries from aborted navigations.
8. **Twitch is live** — `twitch.tv` in `SITE_BLOCK_FEATURES` + `SITE_BLOCK_CONFIG` + `site-block.css` + manifest content_scripts matches. CSS selectors use `aria-label` values that may change with Twitch redesigns.
9. **suggestionsContent fallback** — block.js reads from `chrome.storage.local` first; if empty, fetches the bundled `suggestions.md`. The bundled file is never modified — custom content is stored separately.
10. **Stepper bounds on text inputs** — From/To are `type="text"` (native number inputs broke rendering); stepper JS must read `getAttribute('min'/'max')` because `input.min` is empty on text inputs.
11. **Overlap hatch needs two background properties** — the 45° hatch uses `background-color: color-mix(...)` separate from `background-image: repeating-linear-gradient(...)`; putting `color-mix` inside the gradient fails to paint.
12. **Zoom-aware timeline math** — every viewport-px → minute conversion divides by `/ zoom / scale`; missing the `zoom` factor makes pointer positions drift when zoom ≠ 1.
13. **Timer and capture are independent lifecycles** — `STOP_CAPTURE` stops only modulation and must NOT clear `timer-expiry`/`countdownEndTime`; captured-tab close keeps the countdown; timer expiry still ends the whole session. Offscreen doc closes only when no timer is pending (it hosts the alert sound).
14. **New theme tokens must exist in every `BASE_PALETTES` entry** — `--surface-card`, `--accent-soft`, `--shadow-card(-hover)` are set per-palette in `theme-data.js`; if a palette lacks them, cards keep the dark default under bright themes.
15. **No semi-transparent borders on rounded gradient elements** — Chrome (Skia) bleeds the gradient's FIRST stop as a 1px light line just below the box's bottom edge when the border (or border-color) has alpha (`transparent`, `rgba(...)`, `color-mix(... , transparent)`). Gloss buttons/tab pills/knobs therefore use `border: none`; glass panes/strips are safe only because their bottom border is opaque dark (`border-bottom-color: rgba(0,0,0,0.45)` in aero.css). Keep it that way.
