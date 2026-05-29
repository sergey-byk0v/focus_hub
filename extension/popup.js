// ==================== Tab Switching ====================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ==================== AM Modulator Section ====================

let isCapturing = false;
let currentTabId = null;
let currentTabTitle = '';
let displayInterval = null;
let displayEndTime = null;

const els = {
  status: document.getElementById('status'),
  captureBtn: document.getElementById('captureBtn'),
  controls: document.getElementById('controls'),
  frequency: document.getElementById('frequency'),
  depth: document.getElementById('depth'),
  waveform: document.getElementById('waveform'),
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
  timerDisplay: document.getElementById('timerDisplay'),
  countdownControls: document.getElementById('countdownControls'),
  presetBtns: document.querySelectorAll('.preset-btn'),
  customSeconds: document.getElementById('customSeconds'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
};

function getParams() {
  return {
    frequency: parseFloat(els.frequency.value),
    depth: parseInt(els.depth.value) / 100,
    waveform: els.waveform.value,
    spatialEnabled: els.spatialEnabled.checked,
    spatialSpeed: parseFloat(els.spatialSpeed.value),
    spatialWidth: parseInt(els.spatialWidth.value) / 100
  };
}

function updateDisplay() {
  els.freqValue.textContent = parseFloat(els.frequency.value).toFixed(1) + ' Hz';
  els.depthValue.textContent = els.depth.value + '%';
  els.spatialSpeedValue.textContent = parseFloat(els.spatialSpeed.value).toFixed(1) + ' Hz';
  els.spatialWidthValue.textContent = els.spatialWidth.value + '%';
}

function updateSpatialControls() {
  if (els.spatialEnabled.checked) {
    els.spatialControls.classList.add('enabled');
  } else {
    els.spatialControls.classList.remove('enabled');
  }
}

function sendParams() {
  if (!isCapturing) return;
  chrome.runtime.sendMessage({
    type: 'UPDATE_PARAMS',
    params: getParams()
  });
  saveSettings();
}

async function saveSettings() {
  const settings = {
    frequency: els.frequency.value,
    depth: els.depth.value,
    waveform: els.waveform.value,
    spatialEnabled: els.spatialEnabled.checked,
    spatialSpeed: els.spatialSpeed.value,
    spatialWidth: els.spatialWidth.value
  };
  await chrome.storage.local.set({ settings });
}

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  if (result.settings) {
    const s = result.settings;
    els.frequency.value = s.frequency || 16;
    els.depth.value = s.depth || 50;
    els.waveform.value = s.waveform || 'sine';
    els.spatialEnabled.checked = s.spatialEnabled || false;
    els.spatialSpeed.value = s.spatialSpeed || 0.3;
    els.spatialWidth.value = s.spatialWidth || 70;
  }
  updateDisplay();
  updateSpatialControls();
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
els.waveform.addEventListener('change', () => sendParams());

els.freqDown.addEventListener('click', () => {
  const current = parseFloat(els.frequency.value);
  els.frequency.value = Math.max(1, current - 1);
  updateDisplay();
  sendParams();
});

els.freqUp.addEventListener('click', () => {
  const current = parseFloat(els.frequency.value);
  els.frequency.value = Math.min(100, current + 1);
  updateDisplay();
  sendParams();
});

els.spatialEnabled.addEventListener('change', () => {
  updateSpatialControls();
  sendParams();
});

els.spatialSpeed.addEventListener('input', () => { updateDisplay(); sendParams(); });
els.spatialWidth.addEventListener('input', () => { updateDisplay(); sendParams(); });

els.presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (!isCapturing) return;
    const seconds = parseInt(btn.dataset.seconds);
    chrome.runtime.sendMessage({ type: 'START_COUNTDOWN', seconds }, r => {
      if (r && r.endTime) startDisplayTick(r.endTime);
    });
  });
});

els.startBtn.addEventListener('click', () => {
  if (!isCapturing) return;
  const seconds = parseInt(els.customSeconds.value);
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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CAPTURE_ENDED') {
    resetTimer();
    setCapturing(false);
  }
});

loadSettings();

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

// ==================== Reasons Tab Section ====================

const DEFAULT_REASON_SETTINGS = {
  enabled: true,
  sites: ["youtube.com", "twitch.tv"],
  countdownSeconds: 10
};

const blockToggle = document.getElementById('blockToggle');
const siteListEl = document.getElementById('siteList');
const newSiteInput = document.getElementById('newSiteInput');
const addSiteBtn = document.getElementById('addSiteBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const restoreDefaultsBtn = document.getElementById('restoreDefaultsBtn');
const reasonStatus = document.getElementById('reasonStatus');

let reasonSettings = { ...DEFAULT_REASON_SETTINGS };

async function loadReasonSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_REASON_SETTINGS' }, (response) => {
      if (response) {
        reasonSettings = response;
      }
      applyReasonSettings();
      resolve();
    });
  });
}

async function saveReasonSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'SAVE_REASON_SETTINGS', settings: reasonSettings }, () => {
      resolve();
    });
  });
}

function applyReasonSettings() {
  blockToggle.classList.toggle('active', reasonSettings.enabled);
  renderSiteList();
}

function renderSiteList() {
  if (reasonSettings.sites.length === 0) {
    siteListEl.innerHTML = '<div class="status-msg">No sites added. Add one below.</div>';
    return;
  }
  siteListEl.innerHTML = reasonSettings.sites.map((site, i) =>
    '<div class="site-item">' +
      '<span class="site-domain">' + escapeHtml(site) + '</span>' +
      '<button class="remove-btn" data-index="' + i + '">&times;</button>' +
    '</div>'
  ).join('');

  siteListEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index);
      reasonSettings.sites.splice(idx, 1);
      await saveReasonSettings();
      applyReasonSettings();
    });
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

blockToggle.addEventListener('click', async () => {
  reasonSettings.enabled = !reasonSettings.enabled;
  await saveReasonSettings();
  applyReasonSettings();
});

addSiteBtn.addEventListener('click', async () => {
  let domain = newSiteInput.value.trim().toLowerCase();
  if (!domain) return;

  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');

  if (!domain || domain.includes('.') === false) {
    reasonStatus.textContent = 'Enter a valid domain (e.g. reddit.com)';
    return;
  }

  if (reasonSettings.sites.includes(domain)) {
    reasonStatus.textContent = 'Site already in the list';
    return;
  }

  reasonSettings.sites.push(domain);
  await saveReasonSettings();
  applyReasonSettings();
  newSiteInput.value = '';
  reasonStatus.textContent = '';
});

newSiteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSiteBtn.click();
});

restoreDefaultsBtn.addEventListener('click', async () => {
  reasonSettings = { ...DEFAULT_REASON_SETTINGS };
  await saveReasonSettings();
  applyReasonSettings();
  reasonStatus.textContent = 'Defaults restored';
  setTimeout(() => { reasonStatus.textContent = ''; }, 2000);
});

exportCsvBtn.addEventListener('click', async () => {
  const { entries } = await chrome.storage.local.get({ entries: [] });
  if (entries.length === 0) {
    reasonStatus.textContent = 'No entries to export';
    setTimeout(() => { reasonStatus.textContent = ''; }, 2000);
    return;
  }

  const headers = 'url,reason,timestamp,date';
  const rows = entries.map(e =>
    '"' + escCsv(e.url) + '","' + escCsv(e.reason) + '","' + e.timestamp + '","' + e.date + '"'
  );
  const csv = [headers].concat(rows).join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'site-reasons.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  reasonStatus.textContent = 'Exported ' + entries.length + ' entries';
  setTimeout(() => { reasonStatus.textContent = ''; }, 2000);
});

function escCsv(str) {
  return String(str).replace(/"/g, '""');
}

loadReasonSettings();
