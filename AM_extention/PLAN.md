# AM Extension — Implementation Plan

A Chrome extension that applies amplitude modulation to audio from a specific tab (e.g., Spotify Web).

## Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│   Browser Tab    │───▶│  Service Worker  │───▶│  Offscreen Document  │
│  (open.spotify)  │    │                  │    │                      │
│                  │    │ • getMediaStream │    │ • AudioContext       │
│ Audio output     │    │ • lifecycle mgmt │    │ • getUserMedia()     │
│                  │    │ • timer handlers │    │ • MediaStreamSource  │
└──────────────────┘    │ • persist state  │    │ • AM + Spatial fx    │
                         └───────┬──────────┘    │                      │
                                 │                └──────────────────────┘
                         ┌───────▼──────────┐
                         │  Floating Timer   │
                         │  (timer.html)     │
                         │                   │
                         │ • Elapsed time    │
                         │ • Countdown timer │
                         │ • Auto-stop cap.  │
                         └──────────────────┘
                                 │
                         ┌───────▼──────────┐
                         │      Popup UI    │
                         │                  │
                         │ • Capture toggle │
                         │ • Mod freq +/-1  │
                         │ • Depth slider   │
                         │ • Waveform       │
                         │ • AM/Ring toggle │
                         │ • Spatial Mov.   │
                         │ • Open Timer btn │
                         └──────────────────┘
```

## File Structure

```
AM_extention/
├── manifest.json          # Manifest V3, permissions: tabCapture, offscreen, storage, tabs
├── background.js          # Service worker — getMediaStreamId, offscreen lifecycle, persisted state, timer handlers
├── offscreen.html         # Container for persistent AudioContext
├── offscreen.js           # Web Audio graph — AM + Spatial effect chain (no wet/dry)
├── popup.html             # UI layout — grayish theme, spatial section, timer button
├── popup.js               # UI logic, messaging, storage, +/-1 Hz buttons, spatial controls, timer launcher
├── timer.html             # Floating window UI — elapsed/countdown timer, presets, start/stop
├── timer.js               # Timer logic — setInterval tick, chrome.runtime messaging, storage init
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Current Implementation (as-built)

### 1. Manifest V3
- `permissions`: `["tabCapture", "offscreen", "storage", "tabs"]`
- `host_permissions`: `["<all_urls>"]` — required for tab capture
- `action`: default_popup → `popup.html`
- `background`: service_worker → `background.js`

### 2. Service Worker (`background.js`)
- Uses `chrome.tabCapture.getMediaStreamId({ targetTabId })` instead of `capture()` (MV3 compatible since Chrome 116)
- Creates offscreen document with `reason: 'USER_MEDIA'`
- Sends `streamId` (string) to offscreen document — not the `MediaStream` itself
- Persists `capturedTabId` and `captureStartTime` to `chrome.storage.local` so they survive service worker sleep/restart
- `QUERY_STATUS` reads directly from `chrome.storage.local` to avoid race condition on service worker restart
- `OPEN_TIMER` handler: creates floating window via `chrome.windows.create` or focuses existing one
- `TIMER_EXPIRED` handler: stops capture, closes offscreen, broadcasts `CAPTURE_ENDED`
- On tab close (`chrome.tabs.onRemoved`) → cleans up offscreen document and state

### 3. Offscreen Document (`offscreen.html` + `offscreen.js`)
- **`offscreen.html`**: minimal HTML, loads `offscreen.js`
- **`offscreen.js`**:
  - Receives `streamId` from service worker
  - Calls `navigator.mediaDevices.getUserMedia()` with `chromeMediaSource: 'tab'` to get actual `MediaStream`
  - Audio graph (no wet/dry split — 100% wet):
    ```
    sourceNode → carrierGain → spatialPanner → audioCtx.destination
    modOscillator → modGain ────┘ (modulates carrierGain.gain for AM)
    spatialLFO → spatialWidthGain ┘ (modulates spatialPanner.pan)
    ```
  - **AM mode**: `carrierGain.gain.value = 1.0`, modulator swings gain by ±depth
  - **Ring Mod mode**: `carrierGain.gain.value = 0.0`, modulator swings gain ±depth (no DC offset)
  - **Spatial Movement**: `StereoPannerNode` with sine LFO modulating pan (-1 to 1)
    - LFO frequency = speed (0.1–2 Hz)
    - LFO amplitude = width (0–1), via `spatialWidthGain`
    - When disabled: gain = 0 → pan stays at center
    - When enabled: gain = width → pan sweeps left-right
  - Real-time parameter updates via `chrome.runtime.onMessage`

### 4. Floating Timer Window (`timer.html` + `timer.js`)
- **`timer.html`**: compact floating popup window (240×300px), grayish theme
- **`timer.js`**:
  - **Elapsed mode**: shows time since capture started (auto-starts on open if capturing)
  - **Countdown mode**: user picks duration via presets (15s/30s/1m/5m) or custom input (1–3600s)
  - At countdown 0: sends `TIMER_EXPIRED` → background stops capture
  - Toggle between modes via button row
  - Reads `captureStartTime` from `chrome.storage.local` on init
  - Listens for `CAPTURE_ENDED` message to reset display
  - Cleans up `timerWindowId` from storage on window close
  - Timer runs locally via `setInterval(100ms)` — unaffected by service worker sleep

### 5. Popup UI (`popup.html`)
- **Capture button**: Start / Stop (shows current state, handles reconnect gracefully)
- **Modulator frequency**: slider 1–100 Hz (step 1), +/-1 Hz buttons on sides, default 16 Hz
- **Depth**: slider 0–100%, default 50%
- **Waveform**: dropdown — Sine, Square, Triangle, Sawtooth
- **Mode toggle**: AM (Tremolo) / Ring Mod
- **Spatial Movement section** (collapsible via checkbox):
  - Checkbox toggle — enables/disables the effect
  - **Speed**: slider 0.1–2 Hz, default 0.3 Hz
  - **Width**: slider 0–100%, default 70%
- **Timer button** — opens floating timer window (only functional when capturing)
- **Status indicator**: green "Capturing" or gray "Idle"
- Grayish color scheme (dark gray background, silver accents)

### 6. Popup Logic (`popup.js`)
- Sends start/stop messages to service worker
- On any parameter change → sends `chrome.runtime.sendMessage` to offscreen for real-time update
- Settings saved to `chrome.storage.local` and restored on popup open
- On open: queries service worker `QUERY_STATUS` to detect if already capturing (survives popup close)
- Controls enabled only when capturing
- +/-1 Hz fine-stepping buttons alongside the slider
- Spatial controls grayed out when checkbox is unchecked
- **Open Timer** button sends `OPEN_TIMER` message to service worker

### 7. Edge Cases Handled
- **Service worker sleep** → `capturedTabId` persisted in storage; `QUERY_STATUS` reads from storage directly (fixes race condition); timer runs locally in floating window
- **Tab closed** → detected via `chrome.tabs.onRemoved`, auto-cleanup, broadcasts `CAPTURE_ENDED`
- **DRM content** → error message shown if no audio tracks in captured stream
- **Already capturing** → prevents double-capture; popup detects and shows existing state
- **Offscreen document lifecycle** → created/destroyed per capture session
- **Timer window duplicate** → `timerWindowId` stored in `chrome.storage.local`, checks before creating new window
- **Timer window closed** → cleans up `timerWindowId` from storage
- **Countdown expired** → stops capture, closes offscreen, broadcasts `CAPTURE_ENDED`

### 8. Not Yet Implemented (future)
- Real-time waveform visualizer (`AnalyserNode` + `<canvas>`)
- Keyboard shortcuts for toggle
- Presets (removed for now, may be re-added)
- Per-site settings persistence (detect via tab URL)

## AM Effect Math

The core effect multiplies the carrier (tab audio) by the modulator (oscillator):

```
output(t) = carrier(t) × modulator(t)
```

### AM mode (tremolo, <20 Hz)
- `carrierGain.gain.value = 1.0`
- Modulator output (depth 0–1) swings the gain around 1.0
- Result: volume oscillates, producing classic tremolo effect

### Ring Mod mode (>20 Hz)
- `carrierGain.gain.value = 0.0`
- Modulator output (depth 0–1) swings the gain through positive and negative values
- Result: carrier × oscillator with no DC offset
- Creates sideband frequencies at (f_carrier ± f_modulator)
- Produces metallic, bell-like, robotic timbres

## Spatial Movement Effect

Uses `StereoPannerNode` with a low-frequency sine oscillator to smoothly pan audio left-right:

```
pan(t) = spatialLFO(t) × spatialWidthGain
```

- **LFO**: `OscillatorNode` with sine waveform, frequency = speed
- **Width**: `GainNode` scales LFO amplitude to desired pan range
- When disabled, gain = 0 → pan stays at 0 (center)
- When enabled, gain = width → pan sweeps -1 to 1 (left to right)
- Always sine wave for smooth, natural-sounding circular motion
