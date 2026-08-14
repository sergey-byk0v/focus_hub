# Focus Hub

Chrome extension (Manifest V3) combining a focus-timer, an AM audio modulator, a site blocker with reason-gate + suggestions, a theme unlock system, and a daily planner. No frameworks, no bundler — vanilla JS.

## Features

- ⏱️ **Countdown timer** — presets or custom; auto-stops the audio modulator on expiry
- 🎧 **AM modulator** — frequency/depth, spatial auto-pan, crossover (low/high), noise mixer, presets
- 🚫 **Site blocking** — blocklist or whitelist mode; Reason gate or Complete block
- 🧩 **Themes** — 30 unlockable themes (+1 secret), unlocked daily by "Roll!"
- ⚙️ **Settings** — toggle which tabs appear, edit block-page suggestions (markdown)
- 📅 **Daily planner** — task cards + time-line, drag & drop, zoom, overlap detection, live current-time line

## Tabs

### Timer
Countdown timer (15/30/60/90 presets or custom). Automatically stops AM modulation when the timer expires. Save/load custom presets.

### Modulation
Amplitude-modulation audio processing for any tab:
- **Frequency / Depth** — modulation rate and intensity
- **Spatial Movement** — auto-pan left↔right at configurable speed/width
- **Crossover** — modulate only low or high frequencies (Low/High mode)
- **Noise** — white/pink/brown/gray, optional modulation gating
- **Presets** — save/load configurations

### Blocking
Two list modes:
- **Blocklist** — block listed sites (default)
- **Whitelist** — block everything except listed sites

Two block behaviors:
- **Reason** — intercepts navigation, asks why, shows markdown suggestions, logs entries (stats chart + CSV export)
- **Complete** — blocks navigation entirely

### Themes
7 palettes / 30 themes to unlock + 1 hidden secret theme. "Roll!" unlocks a random theme daily (12h cooldown).

### Settings
- Show/hide tabs
- Block Page suggestions editor (markdown) + restore defaults

## Daily Planner
Opened from the popup. Two panels:
- **Tasks deck** — color-coded cards with task lists
- **Timeline** — draw/move/resize time slots; drag tasks from the deck onto the timeline; From/To range, zoom (Ctrl+scroll), overlap hatch, current-time line, Clear all

## Installation
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select the `extension/` folder

Requires permissions: `webNavigation`, `storage`, `tabCapture`, `offscreen`, `tabs`, `notifications`, `alarms`.

## Releases
Current version: **1.1.1** — zips in `versions/`.
