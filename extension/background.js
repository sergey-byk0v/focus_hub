// ==================== AM Modulator Section ====================

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');
let capturedTabId = null;

async function loadState() {
  const result = await chrome.storage.local.get('capturedTabId');
  if (result.capturedTabId) {
    capturedTabId = result.capturedTabId;
  }
}

async function saveState() {
  await chrome.storage.local.set({ capturedTabId });
}

async function clearState() {
  capturedTabId = null;
  await chrome.storage.local.remove(["capturedTabId", "captureStartTime"]);
}

async function getOrCreateOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [OFFSCREEN_URL]
  });

  if (contexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Process tab audio with amplitude modulation effects'
  });
}

async function closeOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [OFFSCREEN_URL]
  });

  if (contexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

function sendMessageToOffscreen(data) {
  return chrome.runtime.sendMessage(data);
}

// ==================== Site Reason Blocker Section ====================

let blocklistDomains = [];
let whitelistDomains = [];
let listMode = 'blocklist';
let blockingMode = 'reason';
const APPROVAL_WINDOW_MS = 15000;

function normalizeHost(h) {
  return String(h || '').replace(/^www\./, '').toLowerCase();
}

function sameDomain(a, b) {
  a = normalizeHost(a);
  b = normalizeHost(b);
  return a === b || a.endsWith('.' + b) || b.endsWith('.' + a);
}

async function approveUrl(tabId, url) {
  let domain = '';
  try { domain = normalizeHost(new URL(url).hostname); } catch (_) {}
  const key = String(tabId);
  await chrome.storage.session.set({ [key]: { domain, expires: Date.now() + APPROVAL_WINDOW_MS } });
}

async function loadBlockerState() {
  const result = await chrome.storage.local.get(['blocklistDomains', 'whitelistDomains', 'listMode', 'blockingMode', 'focusMusicUrl']);
  if (result.blocklistDomains) blocklistDomains = result.blocklistDomains;
  if (result.whitelistDomains) whitelistDomains = result.whitelistDomains;
  if (result.listMode) listMode = result.listMode;
  if (result.blockingMode) blockingMode = result.blockingMode;
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Recent Chrome fires repeated top-level events for one navigation
  // (prerender/bfcache activation, redirect chains, non-zero prerender frameIds).
  // Filter to the active outermost frame instead of relying on frameId === 0.
  if (details.documentLifecycle && details.documentLifecycle !== 'active') return;
  if (details.frameType && details.frameType !== 'outermost_frame') return;
  if (details.frameId !== 0 && details.frameType === undefined) return;

  if (blocklistDomains.length === 0 && whitelistDomains.length === 0) {
    const result = await chrome.storage.local.get(['blocklistDomains', 'whitelistDomains', 'listMode', 'focusMusicUrl']);
    if (result.blocklistDomains) blocklistDomains = result.blocklistDomains;
    if (result.whitelistDomains) whitelistDomains = result.whitelistDomains;
    if (result.listMode) listMode = result.listMode;
  }

  if (listMode === 'blocklist' && blocklistDomains.length === 0) return;

  try {
    const url = new URL(details.url);
    const hostname = url.hostname.replace(/^www\./, '');

    let shouldBlock;
    if (listMode === 'blocklist') {
      shouldBlock = blocklistDomains.some(d => hostname === d || hostname.endsWith('.' + d));
    } else {
      shouldBlock = !whitelistDomains.some(d => hostname === d || hostname.endsWith('.' + d));
    }
    if (!shouldBlock) return;

    const key = String(details.tabId);

    const { [key]: grant } = await chrome.storage.session.get(key);
    // Do NOT consume the grant: Chrome can fire onBeforeNavigate repeatedly for one
    // navigation (redirect chains, prerender activation) and consuming on first use
    // re-blocks the site instantly. The grant self-expires after APPROVAL_WINDOW_MS.
    if (grant && grant.expires > Date.now() && sameDomain(grant.domain, hostname)) {
      return;
    }

    const mode = blockingMode === 'complete' ? '&mode=block' : '';
    const blockUrl = chrome.runtime.getURL('block.html')
      + `?target=${encodeURIComponent(details.url)}&tabId=${details.tabId}${mode}`;
    chrome.tabs.update(details.tabId, { url: blockUrl });
  } catch (e) {
    // Invalid URL — skip
  }
});

// ==================== Message Handlers ====================

async function openMusicTab(url) {
  const target = url || 'https://www.youtube.com/watch?v=lTRiuFIWV54';
  const tab = await chrome.tabs.create({});
  await approveUrl(tab.id, target);
  await chrome.tabs.update(tab.id, { url: target });
  await chrome.storage.local.set({ musicTabId: tab.id });
  return tab;
}

async function maybeAutoOpenMusic() {
  const result = await chrome.storage.local.get(['launchMusicOnStart', 'focusMusicUrl']);
  if (result.launchMusicOnStart === true) {
    try { await openMusicTab(result.focusMusicUrl); } catch (_) {}
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    (async () => {
      try {
        await getOrCreateOffscreen();
        const streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: message.tabId
        });
        capturedTabId = message.tabId || null;
        await saveState();
        await chrome.storage.local.set({ captureStartTime: Date.now() });
        await sendMessageToOffscreen({
          type: 'SET_STREAM_ID',
          streamId: streamId
        });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'STOP_CAPTURE') {
    (async () => {
      // Modulation stops independently of the timer: keep the countdown
      // running, and only tear down the offscreen doc (alert-sound host)
      // when no timer session is pending.
      await sendMessageToOffscreen({ type: 'STOP' }).catch(() => {});
      await clearState();
      const { countdownEndTime } = await chrome.storage.local.get('countdownEndTime');
      if (!(countdownEndTime && countdownEndTime > Date.now())) {
        await closeOffscreen().catch(() => {});
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'UPDATE_PARAMS') {
    sendMessageToOffscreen({
      type: 'UPDATE_PARAMS',
      params: message.params
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'QUERY_STATUS') {
    (async () => {
      // Read from storage, not memory: after a SW restart the async loadState()
      // may not have applied capturedTabId yet when the popup asks first.
      const result = await chrome.storage.local.get("capturedTabId");
      const tabId = result.capturedTabId;
      sendResponse({ capturing: !!tabId, tabId });
    })();
    return true;
  }

  if (message.type === 'START_COUNTDOWN') {
    (async () => {
      const endTime = Date.now() + (message.seconds * 1000);
      await chrome.storage.local.set({ countdownEndTime: endTime, countdownTotalMs: message.seconds * 1000 });
      await chrome.storage.local.remove('countdownPausedRemaining');
      await chrome.alarms.create('timer-expiry', { delayInMinutes: message.seconds / 60 });
      sendResponse({ success: true, endTime });
    })();
    return true;
  }

  if (message.type === 'PAUSE_COUNTDOWN') {
    (async () => {
      const { countdownEndTime } = await chrome.storage.local.get('countdownEndTime');
      if (!countdownEndTime || countdownEndTime <= Date.now()) {
        sendResponse({ success: false });
        return;
      }
      const remaining = Math.max(0, Math.round((countdownEndTime - Date.now()) / 1000));
      await chrome.alarms.clear('timer-expiry');
      await chrome.storage.local.remove('countdownEndTime');
      await chrome.storage.local.set({ countdownPausedRemaining: remaining });
      sendResponse({ success: true, pausedRemaining: remaining });
    })();
    return true;
  }

  if (message.type === 'RESUME_COUNTDOWN') {
    (async () => {
      const { countdownPausedRemaining } = await chrome.storage.local.get('countdownPausedRemaining');
      const seconds = Number(countdownPausedRemaining) || 0;
      if (seconds <= 0) {
        sendResponse({ success: false });
        return;
      }
      const endTime = Date.now() + seconds * 1000;
      await chrome.storage.local.set({ countdownEndTime: endTime });
      await chrome.storage.local.remove('countdownPausedRemaining');
      await chrome.alarms.create('timer-expiry', { delayInMinutes: seconds / 60 });
      sendResponse({ success: true, endTime });
    })();
    return true;
  }

  if (message.type === 'ADD_COUNTDOWN') {
    // Add minutes to the remaining time; works while running and while paused.
    (async () => {
      const addMs = Math.max(0, (message.seconds || 0)) * 1000;
      const MAX_MS = 5400 * 1000;
      const { countdownEndTime, countdownPausedRemaining, countdownTotalMs } =
        await chrome.storage.local.get(['countdownEndTime', 'countdownPausedRemaining', 'countdownTotalMs']);
      if (countdownPausedRemaining) {
        const remaining = Math.min(MAX_MS, countdownPausedRemaining * 1000 + addMs) / 1000;
        const total = Math.max(countdownTotalMs || 0, remaining * 1000);
        await chrome.storage.local.set({ countdownPausedRemaining: Math.round(remaining), countdownTotalMs: total });
        sendResponse({ success: true, state: 'paused', pausedRemaining: Math.round(remaining), totalMs: total });
      } else if (countdownEndTime && countdownEndTime > Date.now()) {
        const endTime = Math.min(Date.now() + MAX_MS, countdownEndTime + addMs);
        const remaining = endTime - Date.now();
        const total = Math.max(countdownTotalMs || 0, remaining);
        await chrome.storage.local.set({ countdownEndTime: endTime, countdownTotalMs: total });
        // alarms.create replaces the existing timer-expiry alarm
        await chrome.alarms.create('timer-expiry', { delayInMinutes: remaining / 60000 });
        sendResponse({ success: true, state: 'running', endTime, totalMs: total });
      } else {
        sendResponse({ success: false });
      }
    })();
    return true;
  }

  if (message.type === 'STOP_COUNTDOWN') {
    (async () => {
      await chrome.alarms.clear('timer-expiry');
      await chrome.storage.local.remove(['countdownEndTime', 'countdownPausedRemaining', 'countdownTotalMs']);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'QUERY_COUNTDOWN') {
    (async () => {
      const { countdownEndTime, countdownPausedRemaining, countdownTotalMs } =
        await chrome.storage.local.get(['countdownEndTime', 'countdownPausedRemaining', 'countdownTotalMs']);
      if (countdownEndTime && countdownEndTime > Date.now()) {
        // Alarms can be lost across browser restarts while endTime survives;
        // re-create from remaining time so expiry still fires.
        const alarm = await chrome.alarms.get('timer-expiry').catch(() => null);
        if (!alarm) {
          await chrome.alarms.create('timer-expiry', { delayInMinutes: (countdownEndTime - Date.now()) / 60000 });
        }
        sendResponse({ state: 'running', endTime: countdownEndTime, totalMs: countdownTotalMs || null });
      } else {
        if (countdownEndTime) await chrome.storage.local.remove('countdownEndTime');
        if (countdownPausedRemaining) {
          sendResponse({ state: 'paused', pausedRemaining: countdownPausedRemaining, totalMs: countdownTotalMs || null });
        } else {
          sendResponse({ state: 'idle' });
        }
      }
    })();
    return true;
  }

  if (message.type === 'TIMER_EXPIRED') {
    (async () => {
      await handleTimerExpiry();
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'SET_BLOCKED_DOMAINS') {
    blocklistDomains = message.blocklist || [];
    whitelistDomains = message.whitelist || [];
    listMode = message.mode || 'blocklist';
    chrome.storage.local.set({ blocklistDomains, whitelistDomains, listMode });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_BLOCKING_MODE') {
    blockingMode = message.mode;
    chrome.storage.local.set({ blockingMode });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'OPEN_MUSIC_TAB') {
    (async () => {
      try {
        const tab = await openMusicTab(message.url);
        sendResponse({ ok: true, tabId: tab.id });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'APPROVE_TAB') {
    (async () => {
      await approveUrl(message.tabId, message.url);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'GET_BLOCKER_STATE') {
    sendResponse({ blocklistDomains, whitelistDomains, listMode, blockingMode });
    return true;
  }

  if (message.type === 'CHECKIN_SAVE') {
    (async () => {
      const cfg = {
        enabled: !!message.enabled,
        fromH: Math.max(0, Math.min(23, message.fromH | 0)),
        fromM: Math.max(0, Math.min(59, message.fromM | 0)),
        toH: Math.max(0, Math.min(23, message.toH | 0)),
        toM: Math.max(0, Math.min(59, message.toM | 0)),
        count: Math.max(1, Math.min(20, message.count | 0))
      };
      if (cfg.fromH * 60 + cfg.fromM >= cfg.toH * 60 + cfg.toM) {
        sendResponse({ error: 'Window must end after it starts.' });
        return;
      }
      cfg.times = [];
      cfg.day = '';
      await chrome.storage.local.set({ [CHECKIN_KEY]: cfg });
      await scheduleNextCheckin();
      sendResponse(await checkinStatus());
    })();
    return true;
  }

  if (message.type === 'CHECKIN_STATUS') {
    (async () => {
      sendResponse(await checkinStatus());
    })();
    return true;
  }
});

async function handleTimerExpiry() {
  const done = (p) => p.catch(() => {});
  await chrome.storage.local.remove(['countdownEndTime', 'countdownPausedRemaining', 'countdownTotalMs']).catch(() => {});
  // Each step is independent: a missing/unresponsive offscreen document must
  // never abort cleanup, or the capture keeps running forever with no alert.
  await done(sendMessageToOffscreen({ type: 'STOP' }));
  await done(closeOffscreen());
  await clearState();
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Timer Expired',
      message: 'AM modulation has stopped.'
    });
  } catch (_) {}
  try {
    // Alert sound runs last so nothing above can prevent the stop sequence.
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [OFFSCREEN_URL]
    });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play timer expiry alert tone'
      });
      await new Promise(r => setTimeout(r, 100));
    }
    await sendMessageToOffscreen({ type: 'PLAY_ALERT' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    await done(sendMessageToOffscreen({ type: 'STOP' }));
    await done(closeOffscreen());
  } catch (_) {}
  chrome.runtime.sendMessage({ type: 'CAPTURE_ENDED' }).catch(() => {});
}

// ==================== Alarm Handler ====================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timer-expiry') {
    await handleTimerExpiry();
  } else if (alarm.name === 'checkin-due') {
    await handleCheckinDue();
  }
});

// ==================== Focus Check-ins ====================

const CHECKIN_KEY = 'focusCheckins';
const CHECKIN_ALARM = 'checkin-due';
const CHECKIN_MIN_GAP_MS = 60 * 1000;

function checkinDayStr(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

// Random N timestamps inside [from, to) for a given day; sorted, >= 60s apart.
function generateCheckinTimes(cfg, day) {
  const from = day.setHours(cfg.fromH, cfg.fromM, 0, 0);
  const to = day.setHours(cfg.toH, cfg.toM, 0, 0);
  const span = to - from;
  const n = Math.min(Math.max(1, cfg.count || 1), 20);
  if (span <= 0) return [];
  // Shrink the min gap if the window can't fit N spaced check-ins
  const gap = Math.min(CHECKIN_MIN_GAP_MS, Math.max(0, Math.floor(span / n) - 1));
  const times = [];
  for (let i = 0; i < n; i++) {
    let t = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      t = from + Math.floor(Math.random() * span);
      if (!times.some(u => Math.abs(u - t) < gap)) break;
    }
    times.push(t);
  }
  return times.sort((a, b) => a - b);
}

// Reschedule the one-shot check-in alarm: drop past times, roll the day over
// when exhausted. Safe to call at any time (startup, install, save, popup).
async function scheduleNextCheckin() {
  const { [CHECKIN_KEY]: cfg } = await chrome.storage.local.get(CHECKIN_KEY);
  if (!cfg || !cfg.enabled) {
    await chrome.alarms.clear(CHECKIN_ALARM).catch(() => {});
    return;
  }
  const now = new Date();
  if (cfg.day !== checkinDayStr(now)) {
    cfg.times = generateCheckinTimes(cfg, new Date());
    cfg.day = checkinDayStr(now);
    await chrome.storage.local.set({ [CHECKIN_KEY]: cfg });
  }
  const nowMs = Date.now();
  const remaining = (cfg.times || []).filter(t => t > nowMs);
  if (remaining.length) {
    if (remaining.length !== (cfg.times || []).length) {
      cfg.times = remaining;
      await chrome.storage.local.set({ [CHECKIN_KEY]: cfg });
    }
    await chrome.alarms.create(CHECKIN_ALARM, { when: remaining[0] });
    return;
  }
  // All of today's check-ins done — generate tomorrow's and schedule the first
  const tomorrow = new Date(nowMs + 24 * 60 * 60 * 1000);
  cfg.times = generateCheckinTimes(cfg, tomorrow);
  cfg.day = checkinDayStr(tomorrow);
  await chrome.storage.local.set({ [CHECKIN_KEY]: cfg });
  if (cfg.times.length) {
    await chrome.alarms.create(CHECKIN_ALARM, { when: cfg.times[0] });
  } else {
    await chrome.alarms.clear(CHECKIN_ALARM).catch(() => {});
  }
}

async function handleCheckinDue() {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Focus check-in',
      message: "How's your focus right now? Take a breath and notice."
    });
  } catch (_) {}
  await scheduleNextCheckin();
}

async function checkinStatus() {
  const { [CHECKIN_KEY]: cfg } = await chrome.storage.local.get(CHECKIN_KEY);
  if (!cfg || !cfg.enabled) return { enabled: false };
  const today = checkinDayStr(new Date());
  if (cfg.day !== today) {
    await scheduleNextCheckin();
    const fresh = (await chrome.storage.local.get(CHECKIN_KEY))[CHECKIN_KEY];
    const remaining = (fresh.times || []).filter(t => t > Date.now());
    return { enabled: true, nextTime: remaining[0] || null, remaining: remaining.length };
  }
  const remaining = (cfg.times || []).filter(t => t > Date.now());
  return { enabled: true, nextTime: remaining[0] || null, remaining: remaining.length };
}

// ==================== Tab Cleanup ====================

chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Clean up expired-session grant so keys don't accumulate
  await chrome.storage.session.remove(String(tabId)).catch(() => {});
  // Read from storage: SW memory may not be loaded after a restart
  const { capturedTabId: stored } = await chrome.storage.local.get('capturedTabId');
  if (stored && Number(stored) === tabId) {
    // Modulation source died — stop it, but keep the countdown running
    await sendMessageToOffscreen({ type: 'STOP' }).catch(() => {});
    await clearState();
    const { countdownEndTime } = await chrome.storage.local.get('countdownEndTime');
    if (!(countdownEndTime && countdownEndTime > Date.now())) {
      await closeOffscreen().catch(() => {});
    }
    chrome.runtime.sendMessage({ type: 'CAPTURE_ENDED' }).catch(() => {});
  }
});

// ==================== Startup ====================

chrome.runtime.onStartup.addListener(async () => {
  try { await chrome.storage.session.clear(); } catch (_) {}
  try {
    chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: 'focushub-save-reading',
      title: 'Save to Focus Hub reading list',
      contexts: ['page', 'link']
    });
  } catch (_) {}
  maybeAutoOpenMusic();
  scheduleNextCheckin().catch(() => {});
});

chrome.runtime.onInstalled.addListener(async (details) => {
  try { await chrome.storage.session.clear(); } catch (_) {}
  try {
    chrome.contextMenus.create({
      id: 'focushub-save-reading',
      title: 'Save to Focus Hub reading list',
      contexts: ['page', 'link']
    });
  } catch (_) {}
  if (details.reason === 'install' || details.reason === 'update') {
    maybeAutoOpenMusic();
  }
  scheduleNextCheckin().catch(() => {});
});

function readingMenuTitleForUrl(url, saved) {
  var item = (saved || []).find(function (a) { return a && a.url === url; });
  if (item && item.status !== 'archived') return 'Move to Focus Hub archive';
  if (item && item.status === 'archived') return 'Restore in Focus Hub reading list';
  return 'Save to Focus Hub reading list';
}

async function refreshReadingMenu(url) {
  try {
    if (!url || !/^https?:\/\//i.test(url)) return;
    var res = await chrome.storage.local.get({ savedArticles: [] });
    var saved = Array.isArray(res.savedArticles) ? res.savedArticles : [];
    chrome.contextMenus.update('focushub-save-reading', { title: readingMenuTitleForUrl(url, saved) });
  } catch (_) {}
}

chrome.tabs.onActivated.addListener(async (info) => {
  try {
    var tab = await chrome.tabs.get(info.tabId);
    if (tab && tab.url) refreshReadingMenu(tab.url);
  } catch (_) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.active && tab.url) refreshReadingMenu(tab.url);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'focushub-save-reading') return;
  var url = (info.linkUrl || info.pageUrl || (tab ? tab.url : null) || '').trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) return;
  var title = (tab && tab.title) || url;
  var res = await chrome.storage.local.get({ savedArticles: [] });
  var saved = Array.isArray(res.savedArticles) ? res.savedArticles : [];
  var existing = saved.find(function (a) { return a && a.url === url; });
  if (existing) {
    existing.status = existing.status === 'archived' ? 'active' : 'archived';
    await chrome.storage.local.set({ savedArticles: saved });
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Focus Hub',
        message: existing.status === 'archived' ? 'Moved to archive' : 'Restored to active'
      });
    } catch (_) {}
  } else {
    saved.unshift({ title: String(title).slice(0, 240) || url, url: url, addedAt: Date.now(), status: 'active' });
    await chrome.storage.local.set({ savedArticles: saved });
  }
  refreshReadingMenu(url);
});

loadState();
loadBlockerState();
