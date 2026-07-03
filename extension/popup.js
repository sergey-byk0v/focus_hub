let isCapturing = false;
let currentTabId = null;
let currentTabTitle = '';
let displayInterval = null;
let displayEndTime = null;
let userPresets = [];
let blocklistSites = [];
let whitelistSites = [];
let listMode = 'blocklist';
let blockingMode = 'reason';
let crossoverMode = 'low';
let enabledTabs = ['timer', 'modulation', 'block', 'themes'];
let showSuggestions = true;


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
  status: document.getElementById('status'),
  captureBtn: document.getElementById('captureBtn'),
  controls: document.getElementById('controls'),
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
  countdownControls: document.getElementById('countdownControls'),
  presetBtns: document.querySelectorAll('.preset-btn'),
  customMinutes: document.getElementById('customMinutes'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  modeReason: document.getElementById('modeReason'),
  modeBlockBtn: document.getElementById('modeBlockBtn'),
  modeBlocklist: document.getElementById('modeBlocklist'),
  modeWhitelist: document.getElementById('modeWhitelist'),
  themeGrid: document.getElementById('themeGrid'),
  unlockBtn: document.getElementById('unlockBtn'),
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
    btn.className = 'preset-grid-btn';
    btn.style.flex = '1';
    btn.addEventListener('click', () => applyPreset(preset));
    wrapper.appendChild(btn);

    if (isUser) {
      const del = document.createElement('button');
      del.textContent = '\u00d7';
      del.style.cssText = 'width:18px;height:18px;border:none;background:transparent;color:#ff4757;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      del.title = 'Delete "' + preset.name + '"';
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

function setCapturing(state, tabId) {
  isCapturing = state;
  if (state) {
    els.status.textContent = currentTabTitle;
    els.status.className = 'status capturing';
    els.captureBtn.textContent = 'Stop Capture';
    els.captureBtn.className = 'stop';
    els.controls.classList.add('enabled');
    sendParams();
  } else {
    els.status.textContent = 'Idle';
    els.status.className = 'status idle';
    els.captureBtn.textContent = 'Start Capture';
    els.captureBtn.className = 'start';
    els.controls.classList.remove('enabled');
    currentTabTitle = '';
  }
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

function displayTick() {
  if (!displayEndTime) return;
  const remaining = displayEndTime - Date.now();
  if (remaining <= 0) {
    els.timerDisplay.textContent = '00:00';
    stopDisplayTick();
    return;
  }
  els.timerDisplay.textContent = formatTime(remaining);
}

function startDisplayTick(endTime) {
  stopDisplayTick();
  displayEndTime = endTime;
  displayInterval = setInterval(displayTick, 100);
  displayTick();
  els.startBtn.style.display = 'none';
  els.stopBtn.style.display = 'inline-block';
}

function stopDisplayTick() {
  if (displayInterval) { clearInterval(displayInterval); displayInterval = null; }
  displayEndTime = null;
  els.startBtn.style.display = 'inline-block';
  els.stopBtn.style.display = 'none';
}

function resetTimer() {
  stopDisplayTick();
  els.timerDisplay.textContent = '00:00';
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

  sites.forEach((site, i) => {
    const row = document.createElement('div');
    row.className = 'block-site-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = site.enabled;
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
    del.addEventListener('click', () => {
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

  updateListModeUI();
  renderSiteList();
  if (els.blockEnabled.checked) applyBlocking();
}

function updateModeUI() {
  els.modeReason.classList.toggle('active', blockingMode === 'reason');
  els.modeBlockBtn.classList.toggle('active', blockingMode === 'complete');
}

function updateListModeUI() {
  els.modeBlocklist.classList.toggle('active', listMode === 'blocklist');
  els.modeWhitelist.classList.toggle('active', listMode === 'whitelist');
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

els.captureBtn.addEventListener('click', async () => {
  if (isCapturing) {
    await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    setCapturing(false);
  } else {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;
    currentTabId = tabs[0].id;

    els.captureBtn.disabled = true;
    els.captureBtn.textContent = 'Starting...';

    const response = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      tabId: currentTabId
    });

    els.captureBtn.disabled = false;

    if (response.success) {
      currentTabTitle = tabs[0].title;
      setCapturing(true, currentTabId);
    } else {
      els.status.textContent = 'Error: ' + (response.error || 'Unknown');
      els.status.className = 'status idle';
    }
  }
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

els.presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!isCapturing) return;
    const seconds = parseInt(btn.dataset.seconds);
    chrome.runtime.sendMessage({ type: 'START_COUNTDOWN', seconds }, r => {
      if (r && r.endTime) startDisplayTick(r.endTime);
    });
  });
});

els.startBtn.addEventListener('click', async () => {
  if (!isCapturing) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;
    const response = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      tabId: tabs[0].id
    });
    if (!response.success) return;
    currentTabTitle = tabs[0].title;
    setCapturing(true, tabs[0].id);
  }

  const minutes = parseInt(els.customMinutes.value);
  const seconds = minutes * 60;
  if (seconds > 0 && seconds <= 5400) {
    chrome.runtime.sendMessage({ type: 'START_COUNTDOWN', seconds }, r => {
      if (r && r.endTime) startDisplayTick(r.endTime);
    });
  }
});

els.stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_COUNTDOWN' });
  stopDisplayTick();
  els.timerDisplay.textContent = '00:00';
});

function updateTabVisibility() {
  var tabs = ['timer', 'modulation', 'block', 'themes'];
  tabs.forEach(function(tab) {
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
  activateFirstEnabledTab();
}

function renderThemes() {
  els.themeGrid.innerHTML = "";
  const allNormalUnlocked = NORMAL_THEMES.every(t => unlockedThemeIds.has(t.id));
  THEMES.forEach(theme => {
    if (theme.secret && !allNormalUnlocked) return;
    const isUnlocked = unlockedThemeIds.has(theme.id);
    const btn = document.createElement("button");
    btn.className = "theme-btn";
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
  if (cooldownUntil > 0) {
    cooldownUntil = 0;
    await chrome.storage.local.set({ nextUnlockTime: 0 });
  }
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

  startCooldown(0);
  renderThemes();
  updateUnlockButton();
}

els.unlockBtn.addEventListener("click", unlockRandomTheme);

var suggestionsToggle = document.getElementById('showSuggestions');
if (suggestionsToggle) {
  suggestionsToggle.addEventListener('change', function() {
    showSuggestions = suggestionsToggle.checked;
    chrome.storage.local.set({ showSuggestions: showSuggestions });
  });
}

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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CAPTURE_ENDED') {
    resetTimer();
    setCapturing(false);
  }
});

(async () => {
  await loadSettings();
  await loadBlockedSites();
  await loadBlockingMode();
  await loadTheme();
  await loadThemeUnlocks();
  await loadTabVisibility();
  var ssResult = await chrome.storage.local.get('showSuggestions');
  showSuggestions = ssResult.showSuggestions !== undefined ? ssResult.showSuggestions : true;
  if (suggestionsToggle) suggestionsToggle.checked = showSuggestions;
  var scResult = await chrome.storage.local.get('suggestionsContent');
  if (!scResult.suggestionsContent) {
    try { var resp = await fetch(chrome.runtime.getURL('suggestions.md')); scResult.suggestionsContent = await resp.text(); } catch (_) {}
  }
  if (suggestionsEditor) suggestionsEditor.value = scResult.suggestionsContent || '';
  renderThemes();
  updateUnlockButton();
})();

chrome.storage.local.get('userPresets', result => {
  userPresets = result.userPresets || [];
  renderPresets();
});

chrome.runtime.sendMessage({ type: 'QUERY_STATUS' }, (response) => {
  if (response && response.capturing) {
    chrome.runtime.sendMessage({ type: 'QUERY_COUNTDOWN' }, r => {
      if (r && r.active && r.endTime) startDisplayTick(r.endTime);
    });
    chrome.tabs.get(response.tabId, (tab) => {
      if (!chrome.runtime.lastError) {
        currentTabTitle = tab.title;
      }
      setCapturing(true, response.tabId);
    });
  }
});
