# Focus Hub — Agent Documentation

## Stack
- Chrome Extension Manifest V3
- No framework, no bundler — vanilla JS
- Offscreen document for AudioContext (offscreen.js)
- Service worker (background.js) for navigation blocking + message relay
- `chrome.storage.local` for all persistence

## File Architecture

| File | Purpose |
|---|---|
| `manifest.json` | Permissions, version, scripts, description |
| `popup.html` | All UI (5 tab panels + inline CSS) |
| `popup.js` | UI logic, state, theme unlock/select, blocking, settings |
| `theme-data.js` | `THEMES[]`, `BASE_PALETTES{}`, `applyThemeById()` |
| `background.js` | Service worker: `onBeforeNavigate` blocking, `SET_BLOCKED_DOMAINS`/`GET_BLOCKER_STATE` handlers |
| `offscreen.js` | Audio graph: oscillator → biquad crossover → carrierGain/dryGain modulation |
| `block.html` | Block page UI: reason tags, countdown, stats bar chart, CSV export |
| `block.js` | Tag selection, entry saving, stats rendering, clearAll, CSV |
| `block.css` | Block page styles |
| `planner.html` | Planner page UI: two-panel layout (tasks deck + daily timeline), inline CSS |
| `planner.js` | Planner logic: cards/tasks CRUD, timeline slots, drag & drop, zoom |
| `planner.css` | Planner page styles |
| `suggestions.md` | Default suggestions content (bundled, fallback if no custom content in storage) |

## Storage Keys (`chrome.storage.local`)

| Key | Type | Used By |
|---|---|---|
| `selectedTheme` | `string\|null` | popup.js |
| `themeUnlocks` | `string[]` | popup.js |
| `nextUnlockTime` | `number` (epoch ms) | popup.js |
| `blocklistSites` | `{domain:string, enabled:boolean}[]` | popup.js |
| `whitelistSites` | `{domain:string, enabled:boolean}[]` | popup.js |
| `listMode` | `"blocklist"\|"whitelist"` | popup.js, background.js |
| `blockEnabled` | `boolean` | popup.js |
| `blockingMode` | `"reason"\|"complete"` | popup.js (relayed via background) |
| `enabledTabs` | `string[]` | popup.js |
| `crossoverMode` | `"low"\|"high"` | popup.js |
| `showSuggestions` | `boolean` | popup.js, block.js |
| `suggestionsContent` | `string` (markdown) | popup.js, block.js |
| `blockedDomains` | `string[]` | background.js |
| `whitelistDomains` | `string[]` | background.js |
| `blockingMode` (in bg) | `"reason"\|"complete"` | background.js |
| `plannerCards` | `Card[]` | planner.js |
| `plannerSlots` | `Slot[]` | planner.js |
| `plannerTimelineWidth` | `number` (px) | planner.js |
| `plannerZoom` | `number` (0.5-2) | planner.js |
| `plannerTimelineRange` | `{start:number, end:number}` | planner.js |

**Note:** popup uses `blocklistSites`/`whitelistSites` (objects with `enabled`). background uses `blockedDomains`/`whitelistDomains` (flat string arrays). They are separate keys.

## Theme System

### Data (`theme-data.js`)
- `BASE_PALETTES` — 7 base palettes: `dark`, `slate`, `medium`, `light`, `pastel`, `vibrant`, `golden`
- `THEMES` — 31 theme entries (30 normal + 1 secret):

```js
{ id, name, color, base, accent, accentHover, secret? }
```

- `applyThemeById(id)` — spreads `BASE_PALETTES[theme.base]` then overwrites `--accent`/`--accent-hover` with `theme.accent`/`theme.accentHover`. Sets as inline styles on `<body>`.

### Initial Unlocks
```js
const INITIALLY_UNLOCKED = ['dark']; // only Dark unlocked initially
```

### Unlock Flow
1. **`loadThemeUnlocks()`** — loads `themeUnlocks` from storage; falls back to `INITIALLY_UNLOCKED`
2. **`unlockRandomTheme()`** — picks a random locked non-secret theme, unlocks it, starts cooldown
3. **`startCooldown(seconds)`** — sets `nextUnlockTime` in storage, updates button every 200ms
4. **`updateUnlockButton()`** — shows "Roll!", countdown HH:MM:SS, or "All themes unlocked!"
   - When all 30 normal themes unlocked, auto-unlocks any secret themes
5. **Cooldown**: 12 hours (`43200s`); currently **0 seconds** for testing

### Secret Theme
- `{ id: 'secret-master', secret: true }` — never rolled by `unlockRandomTheme()`
- Hidden from grid until all 30 normal themes unlocked
- Auto-unlocked when last normal theme is unlocked

### renderThemes()
- Iterates `THEMES`, skips `secret: true` unless all normal themes unlocked
- Unlocked: shows name + color swatch, clickable to select
- Locked: shows "?" button

## Blocking System

### Modes
- **Reason block** — block page shows reason tags + countdown
- **Complete block** — blocks navigation entirely (no block page)

### List Modes
- **Blocklist** — blocks listed domains (default)
- **Whitelist** — blocks ALL domains except listed ones (empty whitelist = block everything)

### Flow
1. popup stores `{domain, enabled}[]` in `blocklistSites`/`whitelistSites`
2. `applyBlocking()` sends `{ blocklist, whitelist, mode }` to background via `SET_BLOCKED_DOMAINS`
3. background stores flat `blockedDomains`/`whitelistDomains` arrays
4. `chrome.webNavigation.onBeforeNavigate` checks mode:
   - Blocklist: block if domain in `blockedDomains`
   - Whitelist: block if domain NOT in `whitelistDomains`

## Audio System (offscreen.js)

### Graph
```
Oscillator → lowPass1 → lowPass2 → carrierGain → destination
           → highPass1 → highPass2 → dryGain     → destination
```

### Crossover
- 4th-order Linkwitz-Riley (24dB/octave) — cascaded biquad lowPass/highPass pairs
- `updateParams()` updates all 4 filter frequencies from `params.crossoverFreq`

### Crossover Mode
- **Low** — routes low-passed audio to `carrierGain` (modulated), high-passed to `dryGain`
- **High** — routes high-passed audio to `carrierGain` (modulated), low-passed to `dryGain`
- `rewireGraph()` called when mode changes

### Parameters
```js
const params = {
  frequency: 2,        // oscillator freq (Hz)
  mix: 0.5,            // 0-1 modulation mix
  amplitude: 0.15,     // oscillator amplitude
  crossoverFreq: 100,  // filter threshold (Hz)
  crossoverMode: 'low' // 'low' | 'high'
};
```

## Tab System

### Tabs
`timer`, `modulation`, `block`, `themes`, `settings`

### Visibility
- Controlled by `enabledTabs` state + `updateTabVisibility()`
- Settings tab toggles per-tab checkboxes; Settings tab itself is always visible
- Uses inline `display` style to hide/show tab labels and panels
- `autoSwitchTab()` moves away from disabled tab

## Popup HTML Structure
- 5 `<input type="radio" name="tab">` elements
- `.tab-bar` with 5 `<label>` elements
- 5 `.tab-panel` divs (id = `panelTimer`, `panelModulation`, etc.)
- CSS `:checked ~` selectors show/hide panels and highlight active tab

## Presets
- Built-in: `Focus` (center 2Hz, mix 50%), `Brown Haze` (center 1.5Hz, mix 70%)
- User presets stored in `chrome.storage.local` key `userPresets`

## Block Page (block.html)
- Reason tags: Waiting, Bored, Procrastination, Avoiding something, Free-time chill, Work/Study, On background, Other
- Countdown: 6 seconds before "Proceed" enables
- Continue countdown: 6 seconds after suggestions render before "Continue to site" enables
- Entry model: `{ url, reason, tag, customText, timestamp, date }`
- Stats: collapsible bar chart, bars sorted by count descending, Export CSV
- `tag` from pre-upgrade entries defaults to `'Other'`

## Suggestions System

### Flow
1. Popup Settings > Block Page has a monospace textarea pre-filled with the bundled `suggestions.md` content
2. User edits the markdown and hits **Save** — writes to `chrome.storage.local` key `suggestionsContent`
3. **Restore defaults** re-fetches the bundled `suggestions.md` and overwrites stored content
4. On block page load, `block.js` checks `chrome.storage.local.get('suggestionsContent')` first
   - If custom content exists, parses it directly
   - If not, falls back to `fetch(chrome.runtime.getURL('suggestions.md'))`
5. When user selects a reason tag and clicks Proceed, `block.js` checks `showSuggestions && suggestionsMap[tag.toLowerCase()]`
   - If the tag has entries in the map → shows `#suggestions-ui` with rendered suggestion items
   - If tag has no entries (section removed) → skips suggestions and navigates directly to site

### Markdown Format
```md
# Tag Name
- [Link text](https://example.com)
- Plain text item
```

### UI Elements
- `#suggestions-ui` (hidden div, shown after Proceed)
- `#suggestions-list` — rendered `.suggestion-item` links
- `#continue-btn` — navigates to the blocked URL via `chrome.tabs.update`
- `#showSuggestions` toggle (popup Settings) — disables/enables the feature entirely

### Features
- Links (`[text](url)`) render as clickable links opening in new tabs
- Plain text items are inert (click does nothing)
- Missing/empty sections cause that tag to skip suggestions (no error)

### Rendered Markdown
- `renderMarkdown()` converts raw markdown per section into rich HTML
- Supports: `## subheadings`, `> blockquotes`, `` `code blocks` ``, `![images](src)`, `**bold**`, `*italic*`
- Consecutive `- ` lines are grouped into `<ul>` lists
- `inlineMd()` applies inline formatting within any line
- `escHtml()` / `escAttr()` sanitize user content

## Editor (popup Settings > Block Page)
- `#suggestionsEditor` — monospace textarea (160px height), shows bundled content on first open
- `#suggestionsSaveBtn` — saves editor content to `chrome.storage.local`
- `#suggestionsRestoreBtn` — re-fetches bundled `suggestions.md` and overwrites storage

## Planner Page (planner.html)

Opened from the popup top-row button via `chrome.tabs.create(chrome.runtime.getURL('planner.html'))`. Two-panel layout: **Tasks deck** (left) + **Timeline** (right). Applies the selected theme via `applyThemeById()` (loads `theme-data.js`).

### Data Model
```js
Card = { id, name, color, tasks: Task[] }
Task = { id, text, done }
Slot = { id, date: 'YYYY-MM-DD', startMinute, endMinute, label }
```
- `slots` filtered to today's date (`todayStr()`) on render
- Persisted under `plannerCards` / `plannerSlots`

### Tasks Deck
- Cards JS-packed into 4 columns (`DECK_COLS=4`, `DECK_GAP=12`) via `layoutDeck()` — heights measured with clones in a hidden `meas` div; `ResizeObserver` on `#card-deck` re-lays out on resize
- Card: color chip cycles through `CARD_COLORS` (8 colors), dblclick inline rename, `.card-delete` button, add-task input, `.task` rows (checkbox `.task-check`, text, `.task-delete`)
- Task rows: checkbox toggles `done`; dblclick (or click) inline-edits via `.task-edit-input`
- New cards/tasks auto-open the name/text field

### Timeline
- `#timeline` = `#hour-axis` (labels + lines) + `#slot-layer` (slots); height 100%, spans From/To range
- **Timeline stretch**: `timelineScale()` = `clientHeight / (rangeEndMin() - rangeStartMin())`; hour lines/labels/slots all scale by it; `timelineY()` = `rangeStartMin() + (clientY - rect.top) / zoom / scale`
- **From/To**: header steppers (−/+) + text inputs (0–23 / 1–24, `start < end`), persisted `plannerTimelineRange`; steppers read bounds via `getAttribute('min'/'max')` (`.min` is empty on text inputs)
- **Clear all**: red header button, single click, no confirm, disabled when today empty; removes today's slots
- **Slots**: font-size 14px; click=30 min, drag≥15 min to draw; move 15-min snap; resize via top/bottom `.slot-resize-handle` (min 15 min); Delete/Backspace/Esc delete selected; dblclick inline rename; new slots auto-open name field
- **Overlap hatch**: `renderOverlapLayer()` finds pairwise overlaps among today's slots, merges to maximal regions, paints `.slot-overlap` divs with a 45° diagonal hatch; `pointer-events:none; z-index:1`
- **Zoom**: CSS `zoom` on `#app` (0.5–2), persisted `plannerZoom`; all viewport-px math divides by `zoom`

### Drag & Drop
- `DRAG_THRESHOLD=5`; ghost = fixed `#dragging-ghost` clone; `body.dragging` disables selection; `suppressClickUntil` blocks the post-drag synthetic click (300ms)
- **Card reorder**: drag starts on `.card-header` only; drop on `.card` splices to its index, on `.add-card` moves to end
- **Task row drag**: pointerdown on `.task` (skips `.task-check`/`.task-delete`/`.task-edit-input`) — same machinery
- **Drop on timeline**: `#timeline` gets `.drop-target` accent ring + `.slot-preview` at snapped position; release → `commitTimelineDrop()` creates a 30-min slot labeled with the **task text** (or **card name**), clamped to the visible range, auto-selected. Independent copy — the task/card stays in the deck

## Version
- Current: `1.1.0` (manifest.json)
- Release zips in `versions/` folder

## Release & Update Workflow

Steps to prepare and share a new release:

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
2. **Separate storage keys** — popup uses `blocklistSites` (objects), background uses `blockedDomains` (strings). Don't confuse them.
3. **Cooldown is in storage** — `nextUnlockTime` persists across popup closes; clear it to reset.
4. **Inline styles override CSS** — `updateTabVisibility()` uses inline `display`, which beats CSS `:checked ~` rules.
5. **Service worker state** — background.js variables reset on SW idle; reload from storage on each message.
6. **No remote code** — all audio is client-side, no external assets.
7. **Tab approval race** — `chrome.storage.session.set` from block page context is not immediately visible to service worker context after Chrome ≥150 update. Fixed by using `APPROVE_TAB` runtime message + in-memory `approvedTabs` map in background.js.
8. **suggestionsContent fallback** — block.js reads from `chrome.storage.local` first; if empty, fetches the bundled `suggestions.md`. The bundled file is never modified — custom content is stored separately.
9. **Stepper bounds on text inputs** — From/To are `type="text"` (native number inputs broke rendering); stepper JS must read `getAttribute('min'/'max')` because `input.min` is empty on text inputs.
10. **Overlap hatch needs two background properties** — the 45° hatch uses `background-color: color-mix(...)` separate from `background-image: repeating-linear-gradient(...)`; putting `color-mix` inside the gradient fails to paint.
11. **Zoom-aware timeline math** — every viewport-px → minute conversion divides by `/ zoom / scale`; missing the `zoom` factor makes pointer positions drift when zoom ≠ 1.
