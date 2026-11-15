let isCapturing = false;
let currentTabId = null;
let currentTabTitle = '';
let displayInterval = null;
let displayEndTime = null;
let timerState = 'idle'; // 'idle' | 'running' | 'paused'
let displayPausedRemaining = null; // ms, when paused
let ringTotalMs = null; // total session length for the progress ring
let userPresets = [];
let blocklistSites = [];
let whitelistSites = [];
let listMode = 'blocklist';
let blockingMode = 'reason';
let shuffleReasons = false;
const DEFAULT_MUSIC_URL = 'https://www.youtube.com/watch?v=lTRiuFIWV54';
let musicTabId = null;
let crossoverMode = 'low';
let enabledTabs = ['timer', 'modulation', 'block', 'themes'];
let showSuggestions = true;
let reasonContentMode = 'suggestions'; // 'none'|'suggestions'|'articles'
const MAX_TIMER_SECONDS = 86400; // hard cap: 24 h
let defaultTimerMinutes = 10; // persisted via timerDefaultMinutes



const INITIALLY_UNLOCKED = ['dark'];
let unlockedThemeIds = new Set(INITIALLY_UNLOCKED);
const NORMAL_THEMES = THEMES.filter(t => !t.secret);
let cooldownUntil = 0;
let cooldownInterval = null;
let selectedThemeId = null;

const DEFAULT_BLOCKED_SITES = [
  { domain: 'youtube.com', enabled: true },
  { domain: 'instagram.com', enabled: true },
  { domain: 'twitch.tv', enabled: true },
  { domain: 'tiktok.com', enabled: true },
  { domain: 'twitter.com', enabled: true },
];

const SITE_BLOCK_FEATURES = {
  'youtube.com': [
    { settingKey: 'hideHomePageSuggestions', title: 'Hide Home Page Suggestions', description: 'Hide suggested/recommended videos sections on the homepage' },
    { settingKey: 'hideVideoPageSuggestions', title: 'Hide Video Page Suggestions', description: 'Hide suggested/recommended videos sidebar on video pages' },
    { settingKey: 'hideShorts', title: 'Hide Shorts', description: 'Hide YouTube Shorts videos and sections' },
    { settingKey: 'hideComments', title: 'Hide Comments', description: 'Hide comments section below videos' }
  ],
  'twitch.tv': [
    { settingKey: 'hideFollowedSidebar', title: 'Hide Followed Sidebar', description: 'Hide the followed-channels sidebar below the player' },
    { settingKey: 'hideHomepageRecommendations', title: 'Hide Recommended Streams', description: 'Hide recommended and carousel sections on the homepage' },
    { settingKey: 'hideRelatedChannels', title: 'Hide Related Channels', description: 'Hide related channels listed next to the player' },
    { settingKey: 'hideLiveChannels', title: 'Hide Live Channels', description: 'Hide the Live Channels section in the left sidebar' },
    { settingKey: 'hideHomepage', title: 'Hide Homepage', description: 'Hide the carousel and feed sections on the homepage' }
  ]
};
let dcDomain = null;


const DEFAULT_PRESET_PARAMS = {
  frequency: 16, depth: 0.5, waveform: 'sine',
  spatialEnabled: false, spatialSpeed: 0.3, spatialWidth: 0.7,
  crossoverEnabled: false, crossoverMode: 'low', crossoverFreq: 300,
  pinkNoiseEnabled: false, pinkNoiseMix: 0.03, pinkNoiseModulate: false,
  noiseType: 'pink'
};

const BUILTIN_PRESETS = [
  { name: 'Focus',    params: { ...DEFAULT_PRESET_PARAMS, spatialEnabled: true } },
  { name: 'Brown Haze', params: { ...DEFAULT_PRESET_PARAMS, pinkNoiseEnabled: true, noiseType: 'brown' } },
];

const els = {
  captureTarget: document.getElementById('captureTarget'),
  captureBtn: document.getElementById('captureBtn'),
  frequency: document.getElementById('frequency'),
  depth: document.getElementById('depth'),
  freqValue: document.getElementById('freqValue'),
  depthValue: document.getElementById('depthValue'),
  freqDown: document.getElementById('freqDown'),
  freqUp: document.getElementById('freqUp'),
  spatialEnabled: document.getElementById('spatialEnabled'),
  spatialSpeed: document.getElementById('spatialSpeed'),
  spatialWidth: document.getElementById('spatialWidth'),
  spatialSpeedValue: document.getElementById('spatialSpeedValue'),
  spatialWidthValue: document.getElementById('spatialWidthValue'),
  spatialControls: document.getElementById('spatialControls'),
  crossoverEnabled: document.getElementById('crossoverEnabled'),
  crossoverFreq: document.getElementById('crossoverFreq'),
  crossoverModeLow: document.getElementById('crossoverModeLow'),
  crossoverModeHigh: document.getElementById('crossoverModeHigh'),
  crossoverFreqValue: document.getElementById('crossoverFreqValue'),
  crossoverControls: document.getElementById('crossoverControls'),
  pinkNoiseEnabled: document.getElementById('pinkNoiseEnabled'),
  pinkNoiseMix: document.getElementById('pinkNoiseMix'),
  pinkNoiseMixValue: document.getElementById('pinkNoiseMixValue'),
  pinkNoiseControls: document.getElementById('pinkNoiseControls'),
  pinkNoiseModulate: document.getElementById('pinkNoiseModulate'),
  noiseType: document.getElementById('noiseType'),
  presetGrid: document.getElementById('presetGrid'),
  presetNameInput: document.getElementById('presetNameInput'),
  savePresetBtn: document.getElementById('savePresetBtn'),
  blockEnabled: document.getElementById('blockEnabled'),
  blockedSiteList: document.getElementById('blockedSiteList'),
  newSiteInput: document.getElementById('newSiteInput'),
  addSiteBtn: document.getElementById('addSiteBtn'),
  timerDisplay: document.getElementById('timerDisplay'),
  timerOrb: document.getElementById('timerOrb'),
  trackCanvas: document.getElementById('trackCanvas'),
  trackPct: document.getElementById('trackPct'),
  addChips: document.querySelectorAll('.add-chip'),
  customMinutes: document.getElementById('customMinutes'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  playPauseLabel: document.getElementById('playPauseLabel'),
  icPlay: document.getElementById('icPlay'),
  icPause: document.getElementById('icPause'),
  icStopSquare: document.getElementById('icStopSquare'),
  icReset: document.getElementById('icReset'),
  defaultMinutes: document.getElementById('defaultMinutes'),
  stopBtn: document.getElementById('stopBtn'),
  checkinEnabled: document.getElementById('checkinEnabled'),
  ciFromH: document.getElementById('ciFromH'),
  ciFromM: document.getElementById('ciFromM'),
  ciToH: document.getElementById('ciToH'),
  ciToM: document.getElementById('ciToM'),
  ciCount: document.getElementById('ciCount'),
  checkinSaveBtn: document.getElementById('checkinSaveBtn'),
  checkinStatus: document.getElementById('checkinStatus'),
  modeReason: document.getElementById('modeReason'),
  modeBlockBtn: document.getElementById('modeBlockBtn'),
  modeBlocklist: document.getElementById('modeBlocklist'),
  modeWhitelist: document.getElementById('modeWhitelist'),
  shuffleReasons: document.getElementById('shuffleReasons'),
  shuffleReasonsRow: document.getElementById('shuffleReasonsRow'),
  playMusicBtn: document.getElementById('playMusicBtn'),
  musicUrlInput: document.getElementById('musicUrlInput'),
  musicUrlSaveBtn: document.getElementById('musicUrlSaveBtn'),
  launchMusicOnStart: document.getElementById('launchMusicOnStart'),
  themeGrid: document.getElementById('themeGrid'),
  unlockBtn: document.getElementById('unlockBtn'),
  plannerBtn: document.getElementById('plannerBtn'),
  readingListBtn: document.getElementById('readingListBtn'),
  siteBlockingControls: document.getElementById('siteBlockingControls'),
  deepCleanSiteList: document.getElementById('deepCleanSiteList'),
  deepCleanEnabled: document.getElementById('deepCleanEnabled'),
  deepCleanEmpty: document.getElementById('deepCleanEmpty'),
  deepCleanCard: document.getElementById('deepCleanCard'),
  deepCleanSummary: document.getElementById('deepCleanSummary'),
  reasonPageBox: document.getElementById('reasonPageBox'),
  deepCleanModal: document.getElementById('deepCleanModal'),
  dcTitle: document.getElementById('dcTitle'),
  dcFeatures: document.getElementById('dcFeatures'),
  dcCloseBtn: document.getElementById('dcCloseBtn'),
};

function getParams() {
  return {
    frequency: parseFloat(els.frequency.value),
    depth: parseInt(els.depth.value) / 100,
    waveform: 'sine',
    spatialEnabled: els.spatialEnabled.checked,
    spatialSpeed: parseFloat(els.spatialSpeed.value),
    spatialWidth: parseInt(els.spatialWidth.value) / 100,
    crossoverEnabled: els.crossoverEnabled.checked,
    crossoverMode: crossoverMode,
    crossoverFreq: parseInt(els.crossoverFreq.value),
    pinkNoiseEnabled: els.pinkNoiseEnabled.checked,
    pinkNoiseMix: parseFloat(els.pinkNoiseMix.value) / 100,
    pinkNoiseModulate: els.pinkNoiseModulate.checked,
    noiseType: els.noiseType.value
  };
}

function updateDisplay() {
  els.freqValue.textContent = parseFloat(els.frequency.value).toFixed(1) + ' Hz';
  els.depthValue.textContent = els.depth.value + '%';
  els.spatialSpeedValue.textContent = parseFloat(els.spatialSpeed.value).toFixed(1) + ' Hz';
  els.spatialWidthValue.textContent = els.spatialWidth.value + '%';
  els.crossoverFreqValue.textContent = els.crossoverFreq.value + ' Hz';
  els.pinkNoiseMixValue.textContent = els.pinkNoiseMix.value + '%';
}

function updateSpatialControls() {
  if (els.spatialEnabled.checked) {
    els.spatialControls.classList.add('enabled');
  } else {
    els.spatialControls.classList.remove('enabled');
  }
}

function updateCrossoverControls() {
  if (els.crossoverEnabled.checked) {
    els.crossoverControls.classList.add('enabled');
  } else {
    els.crossoverControls.classList.remove('enabled');
  }
}

function updateCrossoverModeUI() {
  els.crossoverModeLow.classList.toggle('active', crossoverMode === 'low');
  els.crossoverModeHigh.classList.toggle('active', crossoverMode === 'high');
  // Fix 5: announce selected state to assistive tech
  els.crossoverModeLow.setAttribute('aria-pressed', crossoverMode === 'low');
  els.crossoverModeHigh.setAttribute('aria-pressed', crossoverMode === 'high');
}

function updatePinkNoiseControls() {
  if (els.pinkNoiseEnabled.checked) {
    els.pinkNoiseControls.classList.add('enabled');
  } else {
    els.pinkNoiseControls.classList.remove('enabled');
  }
}

function applyPreset(preset) {
  const p = preset.params;
  els.frequency.value = p.frequency;
  els.depth.value = p.depth * 100;
  els.spatialEnabled.checked = p.spatialEnabled;
  els.spatialSpeed.value = p.spatialSpeed;
  els.spatialWidth.value = p.spatialWidth * 100;
  els.crossoverEnabled.checked = p.crossoverEnabled;
  els.crossoverFreq.value = p.crossoverFreq;
  els.pinkNoiseEnabled.checked = p.pinkNoiseEnabled;
  els.pinkNoiseMix.value = p.pinkNoiseMix * 100;
  els.pinkNoiseModulate.checked = p.pinkNoiseModulate;
  els.noiseType.value = p.noiseType || 'pink';

  updateDisplay();
  updateSpatialControls();
  updateCrossoverControls();
  updateCrossoverModeUI();
  updatePinkNoiseControls();
  sendParams();
}

function saveCurrentPreset() {
  const name = els.presetNameInput.value.trim();
  if (!name) return;

  const preset = { name, params: getParams() };
  userPresets.push(preset);
  chrome.storage.local.set({ userPresets }, () => {
    els.presetNameInput.value = '';
    renderPresets();
  });
}

function deleteUserPreset(index) {
  userPresets.splice(index, 1);
  chrome.storage.local.set({ userPresets }, () => {
    renderPresets();
  });
}

function renderPresets() {
  els.presetGrid.innerHTML = '';

  [...BUILTIN_PRESETS, ...userPresets].forEach((preset, i) => {
    const isUser = i >= BUILTIN_PRESETS.length;
    const userIdx = isUser ? i - BUILTIN_PRESETS.length : -1;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; align-items:center; gap:2px;';

    const btn = document.createElement('button');
    btn.textContent = preset.name;
    btn.className = 'preset-grid-btn aero-btn glass';
    btn.style.flex = '1';
    btn.addEventListener('click', () => applyPreset(preset));
    wrapper.appendChild(btn);

    if (isUser) {
      const del = document.createElement('button');
      del.textContent = '\u00d7';
      del.style.cssText = 'width:18px;height:18px;border:none;background:transparent;color:var(--danger-text);border-radius:50%;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      del.title = 'Delete "' + preset.name + '"';
      del.setAttribute('aria-label', 'Delete preset "' + preset.name + '"');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete "' + preset.name + '"?')) deleteUserPreset(userIdx);
      });
      wrapper.appendChild(del);
    }

    els.presetGrid.appendChild(wrapper);
  });
}

function sendParams() {
  if (isCapturing) {
    chrome.runtime.sendMessage({
      type: 'UPDATE_PARAMS',
      params: getParams()
    });
    // Keep the Home AM card hint in sync with live slider values
    renderHomeAM();
  }
  saveSettings();
}

async function saveSettings() {
  const settings = {
    frequency: els.frequency.value,
    depth: els.depth.value,
    waveform: 'sine',
    spatialEnabled: els.spatialEnabled.checked,
    spatialSpeed: els.spatialSpeed.value,
    spatialWidth: els.spatialWidth.value,
    crossoverEnabled: els.crossoverEnabled.checked,
    crossoverMode: crossoverMode,
    crossoverFreq: els.crossoverFreq.value,
    pinkNoiseEnabled: els.pinkNoiseEnabled.checked,
    pinkNoiseMix: els.pinkNoiseMix.value,
    pinkNoiseModulate: els.pinkNoiseModulate.checked,
    noiseType: els.noiseType.value
  };
  await chrome.storage.local.set({ settings });
}

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  if (result.settings) {
    const s = result.settings;
    els.frequency.value = s.frequency || 16;
    els.depth.value = s.depth || 50;
    els.spatialEnabled.checked = s.spatialEnabled || false;
    els.spatialSpeed.value = s.spatialSpeed || 0.3;
    els.spatialWidth.value = s.spatialWidth || 70;
    els.crossoverEnabled.checked = s.crossoverEnabled || false;
    crossoverMode = s.crossoverMode || 'low';
    els.crossoverFreq.value = s.crossoverFreq || 300;
    els.pinkNoiseEnabled.checked = s.pinkNoiseEnabled || false;
    els.pinkNoiseMix.value = s.pinkNoiseMix || 3;
    els.pinkNoiseModulate.checked = s.pinkNoiseModulate || false;
    els.noiseType.value = s.noiseType || 'pink';
  }
  updateDisplay();
  updateSpatialControls();
  updateCrossoverControls();
  updateCrossoverModeUI();
  updatePinkNoiseControls();
}

function setCapturing(state) {
  isCapturing = state;
  if (state) {
    els.captureTarget.textContent = currentTabTitle;
    els.captureBtn.className = 'stop aero-btn danger';
    sendParams();
  } else {
    // Fix 11: show a helpful default instead of a blank slot
    els.captureTarget.textContent = 'No tab captured';
    els.captureBtn.className = 'start aero-strip';
    currentTabTitle = '';
  }
  renderHome();
}

function formatTime(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

// ---- Progress track (Gravity Defied-style course) ----
// Random course per timer start; the rider travels the arc length as
// time passes. The seed is stored so popup reopens show the same track.
// Colors are read from --accent at draw time (st-low re-points it to
// --danger), so themes recolor the track without JS changes.

let trackSeed = null;
let trackPts = null, trackCum = null, trackTotalLen = 0;
let trackW = 0, trackH = 0;

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function trackHexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return [95, 201, 138];
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function trackAccel() {
  // Computed on the container so .st-low's --accent re-point applies
  return trackHexToRgb(getComputedStyle(els.timerOrb).getPropertyValue('--accent'));
}

// Apply a persisted seed (from storage on open; replaces any transient course)
function trackApplySeed(seed) {
  if (seed == null || seed === trackSeed) return;
  trackSeed = seed;
  trackPts = null;
}

// Fresh course for a newly started timer
function trackNewCourse() {
  trackSeed = (Date.now() & 0x7fffffff) | 1;
  trackPts = null;
  chrome.storage.local.set({ timerTrackSeed: trackSeed });
}

function trackClearCourse() {
  trackSeed = null;
  trackPts = null;
  chrome.storage.local.remove('timerTrackSeed');
}

function trackBuildCourse() {
  const rng = mulberry32(trackSeed || 1);
  const W = trackW, H = trackH;
  const n = 70, mx = 10, dx = (W - 2 * mx) / n;
  const baseY = H * 0.66, climb = H * 0.30;   // finish always above start
  const maxDy = dx * 1.1;                      // ~48° max slope
  let v = [], y = 0;
  for (let i = 0; i <= n; i++) { v.push(y); y += (rng() * 2 - 1) * H * 0.055; y *= 0.88; }
  for (let k = 0; k < 2; k++) v = v.map((a, i) => (v[Math.max(0, i - 1)] + a * 2 + v[Math.min(n, i + 1)]) / 4);
  trackPts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const yy = baseY - climb * t + v[i] * (1 - Math.abs(2 * t - 1) * 0.25);
    trackPts.push({ x: mx + t * (W - 2 * mx), y: Math.max(H * 0.16, Math.min(H - 10, yy)) });
  }
  for (let i = 1; i <= n; i++) {
    const d = trackPts[i].y - trackPts[i - 1].y;
    if (Math.abs(d) > maxDy) trackPts[i].y = trackPts[i - 1].y + Math.sign(d) * maxDy;
  }
  // force finish strictly above start: shift the last 25% toward target
  const target = trackPts[0].y - climb;
  const i0 = Math.floor(n * 0.75), delta = target - trackPts[n].y;
  if (delta < 0) for (let i = i0; i <= n; i++) trackPts[i].y += delta * ((i - i0) / (n - i0)) * 0.9;
  trackCum = [0]; trackTotalLen = 0;
  for (let i = 1; i <= n; i++) {
    trackTotalLen += Math.hypot(trackPts[i].x - trackPts[i - 1].x, trackPts[i].y - trackPts[i - 1].y);
    trackCum.push(trackTotalLen);
  }
}

function trackEnsure() {
  if (trackPts) return;
  if (!trackW) {
    const dpr = window.devicePixelRatio || 1;
    trackW = els.trackCanvas.clientWidth || 212;
    trackH = els.trackCanvas.clientHeight || 64;
    els.trackCanvas.width = trackW * dpr;
    els.trackCanvas.height = trackH * dpr;
    els.trackCanvas.getContext('2d').scale(dpr, dpr);
  }
  if (trackSeed == null) {
    // transient idle preview — not persisted; a real start mints a new seed
    trackSeed = (Date.now() & 0x7fffffff) | 1;
  }
  trackBuildCourse();
}

function trackPosAt(p) {
  const d = p * trackTotalLen;
  let i = 1; while (i < trackCum.length && trackCum[i] < d) i++;
  const a = trackPts[i - 1], b = trackPts[i];
  const f = (d - trackCum[i - 1]) / (trackCum[i] - trackCum[i - 1] || 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: Math.atan2(b.y - a.y, b.x - a.x) };
}

function trackDraw(p) {
  trackEnsure();
  const ctx = els.trackCanvas.getContext('2d');
  const W = trackW, H = trackH;
  const rgb = trackAccel();
  const acc = a => 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  ctx.clearRect(0, 0, W, H);

  // 3D ribbon road: skewed bottom edge + rungs (see prototypes/gravity_timer)
  const DEPTH = 7, SKEW = 5, RUNG = 7;
  const bottom = trackPts.map(q => ({ x: q.x + SKEW, y: q.y + DEPTH }));
  ctx.strokeStyle = acc(1); ctx.lineJoin = 'round';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < trackPts.length; i += RUNG) {
    ctx.beginPath(); ctx.moveTo(trackPts[i].x, trackPts[i].y); ctx.lineTo(bottom[i].x, bottom[i].y); ctx.stroke();
  }
  const last = trackPts.length - 1;
  ctx.beginPath(); ctx.moveTo(trackPts[last].x, trackPts[last].y); ctx.lineTo(bottom[last].x, bottom[last].y); ctx.stroke();
  ctx.strokeStyle = acc(0.6); ctx.lineWidth = 1.2;
  ctx.beginPath();
  bottom.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
  ctx.stroke();
  ctx.strokeStyle = acc(1); ctx.lineWidth = 1.6;
  ctx.beginPath();
  trackPts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
  ctx.stroke();

  // start marker
  ctx.strokeStyle = 'rgba(233,235,233,0.45)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(trackPts[0].x, trackPts[0].y, 3, 0, Math.PI * 2); ctx.stroke();

  // finish checkered flag
  const f = trackPts[last];
  ctx.strokeStyle = acc(1); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y - 11); ctx.stroke();
  ctx.strokeStyle = 'rgba(233,235,233,0.8)'; ctx.lineWidth = 0.8;
  ctx.strokeRect(f.x, f.y - 11, 7, 5);
  ctx.fillStyle = acc(1);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++)
    if ((r + c) % 2 === 0) ctx.fillRect(f.x + c * 3.5, f.y - 11 + r * 2.5, 3.5, 2.5);

  // rider at progress
  const q = trackPosAt(p);
  ctx.save();
  ctx.translate(q.x, q.y); ctx.rotate(q.ang);
  ctx.strokeStyle = '#e9ebe9'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(-4.5, -2, 2.4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(4.5, -2, 2.4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4.5, -2); ctx.lineTo(4.5, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-0.8, -7); ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.8, -8.8, 1.6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // glowing progress dot under the bike
  ctx.save();
  ctx.shadowColor = acc(1); ctx.shadowBlur = 6;
  ctx.fillStyle = acc(1);
  ctx.beginPath(); ctx.arc(q.x, q.y, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(q.x, q.y, 1, 0, Math.PI * 2); ctx.fill();
}

function renderRing(remainingMs) {
  if (!els.trackCanvas) return;
  let traveled;
  if (timerState === 'idle') {
    traveled = 0;
  } else {
    const total = ringTotalMs && ringTotalMs > 0 ? ringTotalMs : 0;
    traveled = total ? Math.max(0, Math.min(1, 1 - remainingMs / total)) : 0;
  }
  if (els.trackPct) els.trackPct.textContent = Math.round(traveled * 100) + '%';
  trackDraw(traveled);
}

function currentTimerMs() {
  if (timerState === 'running' && displayEndTime) return Math.max(0, displayEndTime - Date.now());
  if (timerState === 'paused' && displayPausedRemaining != null) return displayPausedRemaining;
  return 0;
}

function updateTimerUI() {
  // Orb state class (drives glow/pulse/recolor in aero.css)
  if (els.timerOrb) {
    const st = timerState === 'running' ? 'st-running' : timerState === 'paused' ? 'st-paused' : 'st-idle';
    els.timerOrb.classList.remove('st-idle', 'st-running', 'st-paused', 'st-low');
    els.timerOrb.classList.add(st);
    if (timerState === 'running' && currentTimerMs() > 0 && currentTimerMs() <= 60000) {
      els.timerOrb.classList.add('st-low');
    }
  }
  // Big button morphs: play (idle/resume) ⇄ pause (running)
  const running = timerState === 'running';
  if (els.icPlay) els.icPlay.style.display = running ? 'none' : 'block';
  if (els.icPause) els.icPause.style.display = running ? 'block' : 'none';
  if (els.playPauseLabel) {
    els.playPauseLabel.textContent = timerState === 'idle' ? 'Start' : running ? 'Pause' : 'Resume';
  }
  if (els.playPauseBtn) {
    const label = timerState === 'idle' ? 'Start' : running ? 'Pause' : 'Resume';
    els.playPauseBtn.title = label;
    els.playPauseBtn.setAttribute('aria-label', label + ' timer');
  }
  if (els.stopBtn) {
    const idle = timerState === 'idle';
    // Idle: stop acts as "reset pending duration", only needed once chips
    // moved it off the default — otherwise it stays disabled.
    const pendingDirty = idle && pendingSeconds() !== defaultTimerMinutes * 60;
    els.stopBtn.disabled = idle && !pendingDirty;
    els.stopBtn.classList.toggle('dim', idle && !pendingDirty);
    // Idle-dirty shows the reset arrow; square otherwise
    if (els.icReset) els.icReset.style.display = pendingDirty ? 'block' : 'none';
    if (els.icStopSquare) els.icStopSquare.style.display = pendingDirty ? 'none' : 'block';
  }
}

function showTime(ms) {
  els.timerDisplay.textContent = formatTime(ms);
}

function displayTick() {
  if (!displayEndTime) return;
  const remaining = displayEndTime - Date.now();
  if (remaining <= 0) {
    resetTimerDisplay();
    return;
  }
  showTime(remaining);
  renderRing(remaining);
  updateTimerUI();
  renderHomeTimer();
}

function startDisplayTick(endTime, totalMs) {
  stopDisplayTick();
  timerState = 'running';
  displayEndTime = endTime;
  displayPausedRemaining = null;
  if (totalMs) ringTotalMs = totalMs;
  displayInterval = setInterval(displayTick, 100);
  displayTick();
  updateTimerUI();
}

function setPausedDisplay(remainingMs, totalMs) {
  stopDisplayTick();
  timerState = 'paused';
  displayPausedRemaining = remainingMs;
  if (totalMs) ringTotalMs = Math.max(totalMs, remainingMs);
  showTime(remainingMs);
  renderRing(remainingMs);
  updateTimerUI();
  renderHomeTimer();
}

function stopDisplayTick() {
  if (displayInterval) { clearInterval(displayInterval); displayInterval = null; }
  displayEndTime = null;
}

// ==================== Home bento ====================

const homeEls = {
  card: document.getElementById('cardTimer'),
  countdown: document.getElementById('homeCountdown'),
  timerPlay: document.getElementById('homeTimerPlay'),
  amCard: document.getElementById('cardModulation'),
  amState: document.getElementById('homeAmState'),
  amPlay: document.getElementById('homeAmPlay')
};

function renderHomeTimer() {
  if (!homeEls.countdown) return;
  const active = timerState !== 'idle';
  homeEls.card.classList.toggle('running', timerState === 'running');
  homeEls.card.classList.toggle('paused', timerState === 'paused');
  if (active) {
    homeEls.countdown.textContent = formatTime(currentTimerMs());
    homeEls.countdown.classList.add('active');
  } else {
    homeEls.countdown.textContent = '00:00';
    homeEls.countdown.classList.remove('active');
  }
}

function renderHomeAM() {
  if (!homeEls.amState) return;
  homeEls.amCard.classList.toggle('running', isCapturing);
  if (isCapturing) {
    homeEls.amState.textContent = 'On';
    homeEls.amState.classList.add('active');
  } else {
    homeEls.amState.textContent = 'Off';
    homeEls.amState.classList.remove('active');
  }
}

function renderHome() {
  renderHomeTimer();
  renderHomeAM();
}

// Card → tab navigation; the play chip handles its own action and is excluded.
// Timer/AM cards are divs, so keyboard activation is handled manually.
document.querySelectorAll('.home-card[data-goto]').forEach(card => {
  const go = () => {
    var radio = document.getElementById('tab' + card.dataset.goto);
    if (radio) radio.checked = true;
  };
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-play')) return;
    go();
  });
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
      e.preventDefault();
      go();
    }
  });
});

// Pending duration (idle): what the +chips accumulated, driven by the hidden input
function pendingSeconds() {
  const m = parseInt(els.customMinutes.value);
  if (isNaN(m)) return 600;
  return Math.max(60, Math.min(MAX_TIMER_SECONDS, m * 60));
}

function resetTimerDisplay() {
  stopDisplayTick();
  timerState = 'idle';
  displayPausedRemaining = null;
  ringTotalMs = null;
  trackClearCourse();
  showTime(pendingSeconds() * 1000);
  renderRing(0);
  updateTimerUI();
  renderHomeTimer();
}

function resetTimer() {
  resetTimerDisplay();
}

function applyBlocking() {
  if (!els.blockEnabled.checked) {
    chrome.runtime.sendMessage({ type: 'SET_BLOCKED_DOMAINS', blocklist: [], whitelist: [], mode: listMode });
    return;
  }
  const enabledBlocklist = blocklistSites.filter(site => site.enabled).map(site => site.domain);
  const enabledWhitelist = whitelistSites.filter(site => site.enabled).map(site => site.domain);
  chrome.runtime.sendMessage({ type: 'SET_BLOCKED_DOMAINS', blocklist: enabledBlocklist, whitelist: enabledWhitelist, mode: listMode });
}

function renderSiteList() {
  els.blockedSiteList.innerHTML = '';
  const sites = listMode === 'blocklist' ? blocklistSites : whitelistSites;

  // Fix 11: empty state
  if (sites.length === 0) {
    const hint = document.createElement('div');
    hint.style.cssText = 'padding:8px 2px; font-size:12px; color:var(--text-muted);';
    hint.textContent = listMode === 'blocklist'
      ? 'Nothing blocked yet — add a site below.'
      : 'Whitelist is empty — everything will be blocked.';
    els.blockedSiteList.appendChild(hint);
  }

  sites.forEach((site, i) => {
    const row = document.createElement('div');
    row.className = 'block-site-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = site.enabled;
    cb.setAttribute('aria-label', 'Toggle blocking for ' + site.domain);
    cb.addEventListener('change', () => {
      sites[i].enabled = cb.checked;
      saveBlockedSites();
      if (els.blockEnabled.checked) applyBlocking();
    });
    row.appendChild(cb);

    const name = document.createElement('span');
    name.className = 'site-name';
    name.textContent = site.domain;
    row.appendChild(name);

    const del = document.createElement('button');
    del.className = 'site-del';
    del.textContent = '\u00d7';
    del.title = 'Remove ' + site.domain;
    del.setAttribute('aria-label', 'Remove ' + site.domain);
    del.addEventListener('click', () => {
      // Fix 10: destructive action needs confirmation (matches preset delete)
      if (!confirm('Remove ' + site.domain + ' from the list?')) return;
      sites.splice(i, 1);
      saveBlockedSites();
      renderSiteList();
      if (els.blockEnabled.checked) applyBlocking();
    });
    row.appendChild(del);

    els.blockedSiteList.appendChild(row);
  });
}

function addBlockedSite() {
  let domain = els.newSiteInput.value.trim().toLowerCase();
  if (!domain) return;

  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    domain = new URL(domain).hostname;
  }
  domain = domain.replace(/^www\./, '');

  if (!domain || domain.includes(' ') || !domain.includes('.')) return;

  const sites = listMode === 'blocklist' ? blocklistSites : whitelistSites;
  if (sites.some(s => s.domain === domain)) return;

  sites.push({ domain, enabled: true });
  els.newSiteInput.value = '';
  saveBlockedSites();
  renderSiteList();
  if (els.blockEnabled.checked) applyBlocking();
}

async function saveBlockedSites() {
  await chrome.storage.local.set({ blocklistSites, whitelistSites, listMode });
}

async function loadBlockedSites() {
  const result = await chrome.storage.local.get(['blocklistSites', 'whitelistSites', 'listMode', 'blockEnabled']);

  if (result.blocklistSites && result.blocklistSites.length > 0) {
    blocklistSites = result.blocklistSites.map(s => typeof s === 'string' ? { domain: s, enabled: true } : s);
  } else {
    blocklistSites = DEFAULT_BLOCKED_SITES.map(s => ({ ...s }));
    await chrome.storage.local.set({ blocklistSites });
  }

  if (result.whitelistSites && result.whitelistSites.length > 0) {
    whitelistSites = result.whitelistSites.map(s => typeof s === 'string' ? { domain: s, enabled: true } : s);
  } else {
    whitelistSites = [];
    await chrome.storage.local.set({ whitelistSites });
  }

  listMode = result.listMode || 'blocklist';
  els.blockEnabled.checked = result.blockEnabled || false;
  els.siteBlockingControls.classList.toggle('enabled', els.blockEnabled.checked);

  updateListModeUI();
  renderSiteList();
  if (els.blockEnabled.checked) applyBlocking();
}

function updateModeUI() {
  els.modeReason.classList.toggle('active', blockingMode === 'reason');
  els.modeBlockBtn.classList.toggle('active', blockingMode === 'complete');
  // Fix 5: announce selected state to assistive tech
  els.modeReason.setAttribute('aria-pressed', blockingMode === 'reason');
  els.modeBlockBtn.setAttribute('aria-pressed', blockingMode === 'complete');
  els.shuffleReasonsRow.style.display = blockingMode === 'reason' ? '' : 'none';
  if (els.reasonPageBox) els.reasonPageBox.style.display = blockingMode === 'reason' ? '' : 'none';
}

function updateListModeUI() {
  els.modeBlocklist.classList.toggle('active', listMode === 'blocklist');
  els.modeWhitelist.classList.toggle('active', listMode === 'whitelist');
  // Fix 5: announce selected state to assistive tech
  els.modeBlocklist.setAttribute('aria-pressed', listMode === 'blocklist');
  els.modeWhitelist.setAttribute('aria-pressed', listMode === 'whitelist');
  els.newSiteInput.placeholder = listMode === 'blocklist' ? 'Add site to block' : 'Add site to allow';
  renderSiteList();
}

async function loadBlockingMode() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_BLOCKER_STATE' }, (response) => {
      if (response) {
        blockingMode = response.blockingMode || 'reason';
      }
      updateModeUI();
      resolve();
    });
  });
}

// Shared capture/stop flow: used by the AM panel pill and the Home play chip
async function toggleCapture(chips) {
  if (isCapturing) {
    await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    setCapturing(false);
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;
    currentTabId = tabs[0].id;

    if (chips) chips.visible.disabled = true;
    els.captureBtn.disabled = true;
    els.captureTarget.textContent = 'Starting…';

    const response = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      tabId: currentTabId
    });

    if (chips) chips.visible.disabled = false;
    els.captureBtn.disabled = false;

    if (response.success) {
      currentTabTitle = tabs[0].title;
      setCapturing(true, currentTabId);
    } else {
      els.captureTarget.textContent = 'Error: ' + (response.error || 'Unknown');
    }
  }
}

els.captureBtn.addEventListener('click', () => toggleCapture());
homeEls.amPlay.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleCapture({ visible: homeEls.amPlay });
});

// Shared timer functions: used by the Timer panel and the Home play chip
function startCountdownFromInput() {
  const minutes = parseInt(els.customMinutes.value);
  const seconds = minutes * 60;
  if (seconds > 0 && seconds <= MAX_TIMER_SECONDS) {
    chrome.runtime.sendMessage({ type: 'START_COUNTDOWN', seconds }, r => {
      if (r && r.endTime) {
        trackNewCourse();
        startDisplayTick(r.endTime, seconds * 1000);
      }
    });
  }
}

// Running/paused: presets and the Start→Add button add minutes to remaining
function addCountdownSeconds(seconds) {
  chrome.runtime.sendMessage({ type: 'ADD_COUNTDOWN', seconds }, r => {
    if (!r || !r.success) return;
    if (r.state === 'running' && r.endTime) {
      startDisplayTick(r.endTime, r.totalMs);
    } else if (r.state === 'paused') {
      setPausedDisplay(r.pausedRemaining * 1000, r.totalMs);
    }
  });
}

function pauseCountdown() {
  chrome.runtime.sendMessage({ type: 'PAUSE_COUNTDOWN' }, r => {
    if (r && r.success) setPausedDisplay(r.pausedRemaining * 1000, ringTotalMs);
  });
}

function resumeCountdown() {
  chrome.runtime.sendMessage({ type: 'RESUME_COUNTDOWN' }, r => {
    if (r && r.endTime) startDisplayTick(r.endTime, ringTotalMs);
  });
}

function stopCountdown() {
  if (timerState === 'idle') {
    els.customMinutes.value = defaultTimerMinutes; // pending duration back to the default
  }
  chrome.runtime.sendMessage({ type: 'STOP_COUNTDOWN' });
  resetTimerDisplay();
}

homeEls.timerPlay.addEventListener('click', (e) => {
  e.stopPropagation();
  if (timerState === 'running') pauseCountdown();
  else if (timerState === 'paused') resumeCountdown();
  else startCountdownFromInput();
});
els.plannerBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('planner.html') });
});

els.readingListBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('reading-list.html') });
});

els.frequency.addEventListener('input', () => { updateDisplay(); sendParams(); });
els.depth.addEventListener('input', () => { updateDisplay(); sendParams(); });

els.freqDown.addEventListener('click', () => {
  const current = parseFloat(els.frequency.value);
  els.frequency.value = Math.max(1, current - 1);
  updateDisplay();
  sendParams();
});

els.freqUp.addEventListener('click', () => {
  const current = parseFloat(els.frequency.value);
  els.frequency.value = Math.min(50, current + 1);
  updateDisplay();
  sendParams();
});

els.spatialEnabled.addEventListener('change', () => {
  updateSpatialControls();
  sendParams();
});

els.spatialSpeed.addEventListener('input', () => { updateDisplay(); sendParams(); });
els.spatialWidth.addEventListener('input', () => { updateDisplay(); sendParams(); });

els.crossoverEnabled.addEventListener('change', () => {
  updateCrossoverControls();
  sendParams();
});

els.crossoverModeLow.addEventListener('click', () => {
  crossoverMode = 'low';
  updateCrossoverModeUI();
  sendParams();
});

els.crossoverModeHigh.addEventListener('click', () => {
  crossoverMode = 'high';
  updateCrossoverModeUI();
  sendParams();
});

els.crossoverFreq.addEventListener('input', () => { updateDisplay(); sendParams(); });

els.pinkNoiseEnabled.addEventListener('change', () => {
  updatePinkNoiseControls();
  sendParams();
});

els.pinkNoiseMix.addEventListener('input', () => { updateDisplay(); sendParams(); });

els.pinkNoiseModulate.addEventListener('change', () => {
  sendParams();
});

els.noiseType.addEventListener('change', () => {
  sendParams();
});

els.savePresetBtn.addEventListener('click', saveCurrentPreset);

els.blockEnabled.addEventListener('change', () => {
  chrome.storage.local.set({ blockEnabled: els.blockEnabled.checked });
  els.siteBlockingControls.classList.toggle('enabled', els.blockEnabled.checked);
  applyBlocking();
});

els.modeBlocklist.addEventListener('click', () => {
  listMode = 'blocklist';
  saveBlockedSites();
  updateListModeUI();
  if (els.blockEnabled.checked) applyBlocking();
});

els.modeWhitelist.addEventListener('click', () => {
  listMode = 'whitelist';
  saveBlockedSites();
  updateListModeUI();
  if (els.blockEnabled.checked) applyBlocking();
});

els.newSiteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBlockedSite();
});

els.addSiteBtn.addEventListener('click', addBlockedSite);

els.modeReason.addEventListener('click', () => {
  blockingMode = 'reason';
  chrome.runtime.sendMessage({ type: 'SET_BLOCKING_MODE', mode: 'reason' });
  updateModeUI();
});

els.modeBlockBtn.addEventListener('click', () => {
  blockingMode = 'complete';
  chrome.runtime.sendMessage({ type: 'SET_BLOCKING_MODE', mode: 'complete' });
  updateModeUI();
});

// Idle: chips accumulate into the pending duration (cap 24 h).
// Running/paused: chips add minutes to the remaining time.
els.addChips.forEach(btn => {
  btn.addEventListener('click', () => {
    const seconds = parseInt(btn.dataset.seconds);
    if (timerState === 'idle') {
      const next = Math.min(MAX_TIMER_SECONDS, pendingSeconds() + seconds);
      els.customMinutes.value = next / 60;
      showTime(next * 1000);
      renderRing(0);
      updateTimerUI(); // re-evaluate the idle stop (reset) button
    } else {
      addCountdownSeconds(seconds);
    }
  });
});

// Default-value field: persists and, when idle, feeds the pending duration
els.defaultMinutes.addEventListener('change', () => {
  const v = parseInt(els.defaultMinutes.value);
  if (isNaN(v)) { els.defaultMinutes.value = defaultTimerMinutes; return; }
  defaultTimerMinutes = Math.max(1, Math.min(1440, v));
  els.defaultMinutes.value = defaultTimerMinutes;
  chrome.storage.local.set({ timerDefaultMinutes: defaultTimerMinutes });
  if (timerState === 'idle') {
    els.customMinutes.value = defaultTimerMinutes;
    showTime(defaultTimerMinutes * 60000);
    renderRing(0);
    updateTimerUI();
  }
});

// Big round button morphs: idle→start, running→pause, paused→resume
els.playPauseBtn.addEventListener('click', () => {
  if (timerState === 'running') pauseCountdown();
  else if (timerState === 'paused') resumeCountdown();
  else startCountdownFromInput();
});

els.stopBtn.addEventListener('click', stopCountdown);

// ==================== Focus check-ins ====================

const CHECKIN_KEY = 'focusCheckins';

function renderCheckinStatus(status) {
  if (!status || !status.enabled) {
    els.checkinStatus.textContent = 'Off';
    return;
  }
  if (status.nextTime) {
    const d = new Date(status.nextTime);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    els.checkinStatus.textContent = 'Next ' + hh + ':' + mm + ' · ' + status.remaining + ' left today';
  } else {
    els.checkinStatus.textContent = 'Done for today';
  }
}

function populateCheckinInputs(cfg) {
  els.checkinEnabled.checked = !!(cfg && cfg.enabled);
  els.ciFromH.value = String(cfg ? cfg.fromH : 9).padStart(2, '0');
  els.ciFromM.value = String(cfg ? cfg.fromM : 0).padStart(2, '0');
  els.ciToH.value = String(cfg ? cfg.toH : 17).padStart(2, '0');
  els.ciToM.value = String(cfg ? cfg.toM : 0).padStart(2, '0');
  els.ciCount.value = String(cfg ? cfg.count : 5);
}

function refreshCheckinUI() {
  chrome.storage.local.get(CHECKIN_KEY).then(result => {
    populateCheckinInputs(result[CHECKIN_KEY]);
  });
  chrome.runtime.sendMessage({ type: 'CHECKIN_STATUS' }, r => {
    if (!chrome.runtime.lastError) renderCheckinStatus(r);
  });
}

function saveCheckin() {
  const cfg = {
    enabled: els.checkinEnabled.checked,
    fromH: parseInt(els.ciFromH.value, 10) || 0,
    fromM: parseInt(els.ciFromM.value, 10) || 0,
    toH: parseInt(els.ciToH.value, 10) || 0,
    toM: parseInt(els.ciToM.value, 10) || 0,
    count: parseInt(els.ciCount.value, 10) || 1
  };
  els.checkinSaveBtn.disabled = true;
  chrome.runtime.sendMessage({ type: 'CHECKIN_SAVE', ...cfg }, r => {
    els.checkinSaveBtn.disabled = false;
    if (chrome.runtime.lastError) return;
    if (r && r.error) {
      els.checkinStatus.textContent = r.error;
    } else {
      renderCheckinStatus(r);
    }
  });
}

// Stepper buttons (planner pattern: text inputs, bounds live in min/max attrs)
document.querySelector('.checkin-section').addEventListener('click', e => {
  const btn = e.target.closest('.stepper-btn');
  if (!btn) return;
  const input = btn.closest('.stepper').querySelector('input');
  const dir = parseInt(btn.dataset.dir, 10);
  const min = parseInt(input.getAttribute('min'), 10) || 0;
  const max = parseInt(input.getAttribute('max'), 10) || 99;
  let v = parseInt(input.value, 10);
  if (isNaN(v)) v = min;
  v = Math.max(min, Math.min(max, v + dir));
  input.value = input.id === 'ciCount' ? String(v) : String(v).padStart(2, '0');
});

els.checkinSaveBtn.addEventListener('click', saveCheckin);
els.checkinEnabled.addEventListener('change', saveCheckin);

function updateTabVisibility() {
  var tabIds = ['timer', 'modulation', 'block', 'themes'];
  tabIds.forEach(function(tab) {
    var label = document.getElementById('label' + tab.charAt(0).toUpperCase() + tab.slice(1));
    var panel = document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1));
    var visible = enabledTabs.indexOf(tab) !== -1;
    if (label) label.style.display = visible ? '' : 'none';
    if (panel) panel.style.display = visible ? '' : 'none';
  });
}

function activateFirstEnabledTab() {
  var tabs = ['timer', 'modulation', 'block', 'themes'];
  for (var i = 0; i < tabs.length; i++) {
    if (enabledTabs.indexOf(tabs[i]) !== -1) {
      var radio = document.getElementById('tab' + tabs[i].charAt(0).toUpperCase() + tabs[i].slice(1));
      if (radio) { radio.checked = true; return; }
    }
  }
  document.getElementById('tabSettings').checked = true;
}

async function saveTabVisibility() {
  await chrome.storage.local.set({ enabledTabs: enabledTabs });
}

async function loadTabVisibility() {
  var result = await chrome.storage.local.get('enabledTabs');
  if (result.enabledTabs && result.enabledTabs.length > 0) {
    enabledTabs = result.enabledTabs;
  } else {
    enabledTabs = ['timer', 'modulation', 'block', 'themes'];
  }


document.querySelectorAll('.tab-toggle').forEach(function(cb) {
    cb.checked = enabledTabs.indexOf(cb.dataset.tab) !== -1;
  });
  updateTabVisibility();
  // Popup always opens on the Home board
  document.getElementById('tabHome').checked = true;
}

function renderThemes() {
  els.themeGrid.innerHTML = "";
  const allNormalUnlocked = NORMAL_THEMES.every(t => unlockedThemeIds.has(t.id));
  THEMES.forEach(theme => {
    if (theme.secret && !allNormalUnlocked) return;
    const isUnlocked = unlockedThemeIds.has(theme.id);
    const btn = document.createElement("button");
    btn.className = "theme-btn aero-strip";
    if (theme.id === selectedThemeId) btn.classList.add("active");
    if (!isUnlocked) btn.classList.add("locked");

    if (isUnlocked) {
      const nameSpan = document.createElement("span");
      nameSpan.textContent = theme.name;
      btn.appendChild(nameSpan);

      const swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.background = theme.color;
      btn.appendChild(swatch);

      btn.addEventListener("click", () => selectTheme(theme.id));
    } else {
      btn.textContent = "?";
      // Fix 5: real disabled state — not focusable, announced as disabled
      btn.disabled = true;
      btn.title = "Locked theme — use Roll! to unlock";
      btn.setAttribute("aria-label", "Locked theme: " + theme.name);
    }

    els.themeGrid.appendChild(btn);
  });
}

function selectTheme(themeId) {
  selectedThemeId = themeId;
  applyThemeById(themeId);
  renderThemes();
  chrome.storage.local.set({ selectedTheme: themeId });
}

async function loadTheme() {
  const result = await chrome.storage.local.get("selectedTheme");
  selectedThemeId = result.selectedTheme || null;
  if (selectedThemeId) {
    applyThemeById(selectedThemeId);
  }
}

async function loadThemeUnlocks() {
  const result = await chrome.storage.local.get(["themeUnlocks", "selectedTheme"]);

  if (result.themeUnlocks && result.themeUnlocks.length > 0) {
    unlockedThemeIds = new Set(result.themeUnlocks);
  } else {
    const initial = new Set(INITIALLY_UNLOCKED);
    if (result.selectedTheme) initial.add(result.selectedTheme);
    unlockedThemeIds = initial;
    await chrome.storage.local.set({ themeUnlocks: [...unlockedThemeIds] });
  }

  if (result.selectedTheme && !unlockedThemeIds.has(result.selectedTheme)) {
    unlockedThemeIds.add(result.selectedTheme);
    await chrome.storage.local.set({ themeUnlocks: [...unlockedThemeIds] });
  }

  const timeResult = await chrome.storage.local.get("nextUnlockTime");
  cooldownUntil = timeResult.nextUnlockTime || 0;
}

function updateUnlockButton() {
  const normalLockedCount = NORMAL_THEMES.filter(t => !unlockedThemeIds.has(t.id)).length;
  if (normalLockedCount === 0) {
    const secretThemes = THEMES.filter(t => t.secret && !unlockedThemeIds.has(t.id));
    if (secretThemes.length > 0) {
      secretThemes.forEach(t => unlockedThemeIds.add(t.id));
      chrome.storage.local.set({ themeUnlocks: [...unlockedThemeIds] });
      renderThemes();
    }
    els.unlockBtn.disabled = true;
    els.unlockBtn.className = "unlock-btn all-unlocked";
    els.unlockBtn.textContent = "All themes unlocked!";
    if (cooldownInterval) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
    }
    return;
  }

  const remaining = cooldownUntil - Date.now();
  if (remaining <= 0) {
    els.unlockBtn.disabled = false;
    els.unlockBtn.className = "unlock-btn";
    els.unlockBtn.textContent = "Roll!";
    if (cooldownInterval) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
    }
  } else {
    els.unlockBtn.disabled = true;
    els.unlockBtn.className = "unlock-btn";
    const totalSec = Math.ceil(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    els.unlockBtn.textContent = "Roll in " + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    if (!cooldownInterval) {
      cooldownInterval = setInterval(updateUnlockButton, 200);
    }
  }
}

function startCooldown(seconds) {
  cooldownUntil = Date.now() + seconds * 1000;
  chrome.storage.local.set({ nextUnlockTime: cooldownUntil });
  updateUnlockButton();
  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(updateUnlockButton, 200);
}


function unlockRandomTheme() {
  const lockedIds = THEMES.filter(t => !t.secret && !unlockedThemeIds.has(t.id)).map(t => t.id);
  if (lockedIds.length === 0) {
    updateUnlockButton();
    return;
  }

  const randomId = lockedIds[Math.floor(Math.random() * lockedIds.length)];
  unlockedThemeIds.add(randomId);
  chrome.storage.local.set({ themeUnlocks: [...unlockedThemeIds] });

  startCooldown(43200);
  renderThemes();
  updateUnlockButton();
}

els.unlockBtn.addEventListener("click", unlockRandomTheme);

var modeReasonNoneBtn = document.getElementById('modeReasonNone');
var modeReasonSuggestionsBtn = document.getElementById('modeReasonSuggestions');
var modeReasonArticlesBtn = document.getElementById('modeReasonArticles');

function setReasonContentMode(mode) {
  reasonContentMode = mode;
  if (mode === 'suggestions') {
    showSuggestions = true;
  } else if (mode === 'articles') {
    showSuggestions = false;
  } else { // none
    showSuggestions = false;
  }
  if (modeReasonNoneBtn) modeReasonNoneBtn.classList.toggle('active', mode === 'none');
  if (modeReasonSuggestionsBtn) modeReasonSuggestionsBtn.classList.toggle('active', mode === 'suggestions');
  if (modeReasonArticlesBtn) modeReasonArticlesBtn.classList.toggle('active', mode === 'articles');
  var suggestionsHelpRow = document.getElementById('suggestionsHelpRow');
  var suggestionsEditorBox = document.getElementById('suggestionsEditorBox');
  var articlesLinkBox = document.getElementById('articlesLinkBox');
  if (suggestionsHelpRow) suggestionsHelpRow.style.display = mode === 'suggestions' ? '' : 'none';
  if (suggestionsEditorBox) suggestionsEditorBox.style.display = mode === 'suggestions' ? '' : 'none';
  if (articlesLinkBox) articlesLinkBox.style.display = mode === 'articles' ? '' : 'none';
  chrome.storage.local.set({ reasonContentMode: mode, showSuggestions: showSuggestions });
}

var openReadingListBtn = document.getElementById('openReadingListBtn');
if (openReadingListBtn) openReadingListBtn.addEventListener('click', function () {
  chrome.tabs.create({ url: chrome.runtime.getURL('reading-list.html') });
});

if (modeReasonNoneBtn) modeReasonNoneBtn.addEventListener('click', function() { setReasonContentMode('none'); });
if (modeReasonSuggestionsBtn) modeReasonSuggestionsBtn.addEventListener('click', function() { setReasonContentMode('suggestions'); });
if (modeReasonArticlesBtn) modeReasonArticlesBtn.addEventListener('click', function() { setReasonContentMode('articles'); });


els.shuffleReasons.addEventListener('change', () => {
  shuffleReasons = els.shuffleReasons.checked;
  chrome.storage.local.set({ shuffleReasons });
});

function openFocusMusic() {
  const url = (els.musicUrlInput.value.trim() || DEFAULT_MUSIC_URL);
  if (musicTabId) {
    chrome.tabs.get(musicTabId, (tab) => {
      if (!chrome.runtime.lastError && tab) {
        chrome.tabs.update(musicTabId, { active: true });
        return;
      }
      musicTabId = null;
      chrome.storage.local.set({ musicTabId: null });
      openFocusMusic();
    });
    return;
  }
  chrome.runtime.sendMessage({ type: 'OPEN_MUSIC_TAB', url }, (response) => {
    if (response && response.ok && response.tabId) {
      musicTabId = response.tabId;
      chrome.storage.local.set({ musicTabId });
    } else {
      chrome.tabs.create({ url }, (tab) => {
        musicTabId = tab.id;
        chrome.storage.local.set({ musicTabId });
      });
    }
  });
}

els.playMusicBtn.addEventListener('click', openFocusMusic);

els.musicUrlSaveBtn.addEventListener('click', () => {
  const url = els.musicUrlInput.value.trim() || DEFAULT_MUSIC_URL;
  chrome.storage.local.set({ focusMusicUrl: url }, () => {
    els.musicUrlSaveBtn.textContent = 'Saved';
    setTimeout(() => { els.musicUrlSaveBtn.textContent = 'Save'; }, 1200);
  });
});

els.launchMusicOnStart.addEventListener('change', () => {
  chrome.storage.local.set({ launchMusicOnStart: els.launchMusicOnStart.checked });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === musicTabId) {
    musicTabId = null;
    chrome.storage.local.set({ musicTabId: null });
  }
});

var suggestionsEditor = document.getElementById('suggestionsEditor');
var suggestionsSaveBtn = document.getElementById('suggestionsSaveBtn');
var suggestionsRestoreBtn = document.getElementById('suggestionsRestoreBtn');

if (suggestionsSaveBtn && suggestionsEditor) {
  suggestionsSaveBtn.addEventListener('click', async function () {
    var content = suggestionsEditor.value;
    await chrome.storage.local.set({ suggestionsContent: content });
  });
}

if (suggestionsRestoreBtn && suggestionsEditor) {
  suggestionsRestoreBtn.addEventListener('click', async function () {
    try {
      var resp = await fetch(chrome.runtime.getURL('suggestions.md'));
      var md = await resp.text();
      suggestionsEditor.value = md;
      await chrome.storage.local.set({ suggestionsContent: md });
    } catch (_) {}
  });
}


document.querySelectorAll('.tab-toggle').forEach(function(cb) {
  cb.addEventListener('change', function() {
    var tab = cb.dataset.tab;
    if (cb.checked) {
      if (enabledTabs.indexOf(tab) === -1) enabledTabs.push(tab);
    } else {
      enabledTabs = enabledTabs.filter(function(t) { return t !== tab; });
      var checkedRadio = document.querySelector('input[name="tab"]:checked');
      if (checkedRadio) {
        var currentId = checkedRadio.id.toLowerCase();
        if (currentId === 'tab' + tab) activateFirstEnabledTab();
      }
    }
    saveTabVisibility();
    updateTabVisibility();
  });
});

function syncTimerDisplay() {
  chrome.runtime.sendMessage({ type: 'QUERY_COUNTDOWN' }, r => {
    if (!r) return;
    if (r.state === 'running' && r.endTime) startDisplayTick(r.endTime, r.totalMs);
    else if (r.state === 'paused') setPausedDisplay(r.pausedRemaining * 1000, r.totalMs);
    else resetTimerDisplay();
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CAPTURE_ENDED') {
    setCapturing(false);
    // Timer is independent of capture — re-sync its display from the
    // background state instead of resetting it (capture may keep running).
    syncTimerDisplay();
  }
});

(async () => {
  // Track seed first — the timer sync below may draw before the rest loads
  var trackSeedResult = await chrome.storage.local.get('timerTrackSeed');
  trackApplySeed(trackSeedResult.timerTrackSeed);
  // Persisted default timer duration
  var defResult = await chrome.storage.local.get('timerDefaultMinutes');
  if (defResult.timerDefaultMinutes) {
    defaultTimerMinutes = Math.max(1, Math.min(1440, defResult.timerDefaultMinutes));
  }
  if (els.defaultMinutes) els.defaultMinutes.value = defaultTimerMinutes;
  if (timerState === 'idle') {
    els.customMinutes.value = defaultTimerMinutes;
    showTime(defaultTimerMinutes * 60000);
    renderRing(0);
    updateTimerUI();
  }
  await loadSettings();
  await loadBlockedSites();
  await loadBlockingMode();
  await loadTheme();
  await loadThemeUnlocks();
  await loadTabVisibility();
  var rcResult = await chrome.storage.local.get(['reasonContentMode', 'showSuggestions']);
  if (rcResult.reasonContentMode) {
    reasonContentMode = rcResult.reasonContentMode;
  } else if (rcResult.showSuggestions !== undefined) {
    reasonContentMode = rcResult.showSuggestions ? 'suggestions' : 'none';
  } else {
    reasonContentMode = 'suggestions';
  }
  showSuggestions = (reasonContentMode === 'suggestions');
  setReasonContentMode(reasonContentMode);
  try { await chrome.storage.local.remove(['articlesContent', 'articlesUrl']); } catch (_) {}
  var musicResult = await chrome.storage.local.get(['focusMusicUrl', 'musicTabId', 'launchMusicOnStart']);
  if (els.musicUrlInput) els.musicUrlInput.value = musicResult.focusMusicUrl || DEFAULT_MUSIC_URL;
  if (musicResult.musicTabId) musicTabId = musicResult.musicTabId;
  if (els.launchMusicOnStart) els.launchMusicOnStart.checked = musicResult.launchMusicOnStart === true;

  var shResult = await chrome.storage.local.get('shuffleReasons');
  shuffleReasons = shResult.shuffleReasons === true;
  els.shuffleReasons.checked = shuffleReasons;
  els.shuffleReasonsRow.style.display = blockingMode === 'reason' ? '' : 'none';

  var scResult = await chrome.storage.local.get('suggestionsContent');
  if (!scResult.suggestionsContent) {
    try { var resp = await fetch(chrome.runtime.getURL('suggestions.md')); scResult.suggestionsContent = await resp.text(); } catch (_) {}
  }
  if (suggestionsEditor) suggestionsEditor.value = scResult.suggestionsContent || '';
  renderHome();
  renderThemes();
  updateUnlockButton();
  renderDeepCleanList();
  if (timerState === 'idle') renderRing(0); // dim course preview while idle
})();

chrome.storage.local.get('userPresets', result => {
  userPresets = result.userPresets || [];
  renderPresets();
});

chrome.runtime.sendMessage({ type: 'QUERY_STATUS' }, (response) => {
  if (response && response.capturing) {
    chrome.tabs.get(response.tabId, (tab) => {
      if (!chrome.runtime.lastError) {
        currentTabTitle = tab.title;
      }
      setCapturing(true, response.tabId);
    });
  }
  // Always restore the countdown display, even if capture was already stopped
  // by a lost alarm — avoids showing 00:00 while time is actually remaining.
  syncTimerDisplay();
  refreshCheckinUI();
});


// --- Deep Clean (in-page blocking) dialog ---

function openDeepCleanDialog(domain) {
  const feat = SITE_BLOCK_FEATURES[domain];
  if (!feat) return;
  dcDomain = domain;
  els.dcTitle.textContent = 'Deep Clean — ' + domain;
  renderFeatureRows(feat);
  chrome.storage.local.get('siteBlocking').then(result => {
    const s = (result.siteBlocking || {})[domain] || {};
    els.dcFeatures.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = !!s[cb.dataset.key];
    });
  });
  els.deepCleanModal.hidden = false;
}

function closeDeepCleanDialog() {
  els.deepCleanModal.hidden = true;
  dcDomain = null;
  renderDeepCleanList();
}

async function renderDeepCleanList() {
  els.deepCleanSiteList.innerHTML = '';
  const result = await chrome.storage.local.get(['siteBlocking', 'deepCleanEnabled']);
  const all = result.siteBlocking || {};
  els.deepCleanEnabled.checked = result.deepCleanEnabled !== false;
  els.deepCleanCard.classList.toggle('off', !els.deepCleanEnabled.checked);

  const domains = Object.keys(SITE_BLOCK_FEATURES);
  els.deepCleanEmpty.hidden = domains.length > 0;
  if (domains.length === 0) return;

  let totalActive = 0;
  let sitesActive = 0;

  domains.forEach(domain => {
    const s = all[domain] || {};
    const settings = SITE_BLOCK_FEATURES[domain];
    const siteEnabled = !!s.enabled;
    const active = settings.filter(f => s[f.settingKey]);
    if (siteEnabled) { totalActive += active.length; sitesActive++; }

    const row = document.createElement('div');
    row.className = 'dc-site-row';

    const name = document.createElement('span');
    name.className = 'dc-site-name';
    name.textContent = domain;
    row.appendChild(name);

    const toggle = document.createElement('label');
    toggle.className = 'switch switch-sm';
    toggle.title = 'Toggle Deep Clean for ' + domain;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = siteEnabled;
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggle.appendChild(cb);
    toggle.appendChild(slider);
    cb.addEventListener('change', async () => {
      const res = await chrome.storage.local.get('siteBlocking');
      const blocks = res.siteBlocking || {};
      const entry = blocks[domain] || {};
      entry.enabled = cb.checked;
      blocks[domain] = entry;
      await chrome.storage.local.set({ siteBlocking: blocks });
      renderDeepCleanList();
    });
    row.appendChild(toggle);

    const controls = document.createElement('span');
    controls.className = 'dc-controls';

    const badge = document.createElement('span');
    if (active.length === 0) {
      badge.className = 'dc-chip faint';
      badge.textContent = 'All visible';
    } else {
      badge.className = 'dc-count';
      badge.textContent = active.length + (active.length === 1 ? ' hidden' : ' hidden');
    }
    controls.appendChild(badge);

    const btn = document.createElement('button');
    btn.className = 'dc-config-btn aero-btn glass';
    btn.textContent = 'Configure';
    btn.setAttribute('aria-label', 'Configure Deep Clean for ' + domain);
    btn.addEventListener('click', () => openDeepCleanDialog(domain));
    controls.appendChild(btn);

    row.appendChild(controls);
    els.deepCleanSiteList.appendChild(row);
  });

  if (sitesActive > 0) {
    els.deepCleanSummary.textContent = totalActive + ' feature' + (totalActive === 1 ? '' : 's') + ' active on ' + sitesActive + ' site' + (sitesActive === 1 ? '' : 's');
  } else {
    els.deepCleanSummary.textContent = 'No features configured yet';
  }
}

function renderFeatureRows(feat) {
  els.dcFeatures.innerHTML = '';
  feat.forEach(f => {
    const row = document.createElement('div');
    row.className = 'dc-feature-row';

    const text = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'dc-name';
    name.textContent = f.title;
    text.appendChild(name);

    const label = document.createElement('label');
    label.className = 'switch';
    label.title = f.title;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.key = f.settingKey;
    const slider = document.createElement('span');
    slider.className = 'slider';
    label.appendChild(cb);
    label.appendChild(slider);

    row.appendChild(text);
    row.appendChild(label);
    els.dcFeatures.appendChild(row);
  });
}

async function persistDeepClean() {
  if (!dcDomain) return;
  const result = await chrome.storage.local.get('siteBlocking');
  const all = result.siteBlocking || {};
  const entry = all[dcDomain] || {};
  els.dcFeatures.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    entry[cb.dataset.key] = cb.checked;
  });
  all[dcDomain] = entry;
  await chrome.storage.local.set({ siteBlocking: all });
}

els.deepCleanEnabled.addEventListener('change', () => {
  els.deepCleanCard.classList.toggle('off', !els.deepCleanEnabled.checked);
  chrome.storage.local.set({ deepCleanEnabled: els.deepCleanEnabled.checked });
});

els.dcFeatures.addEventListener('change', (e) => {
  if (e.target.type === 'checkbox') persistDeepClean();
});

els.dcCloseBtn.addEventListener('click', closeDeepCleanDialog);

els.deepCleanModal.addEventListener('click', (e) => {
  if (e.target === els.deepCleanModal) closeDeepCleanDialog();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.deepCleanModal.hidden) closeDeepCleanDialog();
});
