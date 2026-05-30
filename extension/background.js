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

let blockedDomains = [];
let blockingMode = 'reason';

async function loadBlockerState() {
  const result = await chrome.storage.local.get(['blockedDomains', 'blockingMode']);
  if (result.blockedDomains) blockedDomains = result.blockedDomains;
  if (result.blockingMode) blockingMode = result.blockingMode;
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  if (blockedDomains.length === 0) {
    const result = await chrome.storage.local.get('blockedDomains');
    if (result.blockedDomains) blockedDomains = result.blockedDomains;
    if (blockedDomains.length === 0) return;
  }

  try {
    const url = new URL(details.url);
    const hostname = url.hostname.replace(/^www\./, '');
    if (!blockedDomains.some(d => hostname === d || hostname.endsWith('.' + d))) return;

    const { approved } = await chrome.storage.session.get({ approved: {} });
    const key = String(details.tabId);

    if (approved[key] === details.url) {
      delete approved[key];
      await chrome.storage.session.set({ approved });
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
      await chrome.alarms.clear('timer-expiry');
      await chrome.storage.local.remove('countdownEndTime');
      await sendMessageToOffscreen({ type: 'STOP' });
      await closeOffscreen();
      await clearState();
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
      const result = await chrome.storage.local.get("capturedTabId");
      const tabId = result.capturedTabId;
      sendResponse({ capturing: !!tabId, tabId });
    })();
    return true;
  }

  if (message.type === 'START_COUNTDOWN') {
    (async () => {
      const endTime = Date.now() + (message.seconds * 1000);
      await chrome.storage.local.set({ countdownEndTime: endTime });
      await chrome.alarms.create('timer-expiry', { delayInMinutes: message.seconds / 60 });
      sendResponse({ success: true, endTime });
    })();
    return true;
  }

  if (message.type === 'STOP_COUNTDOWN') {
    (async () => {
      await chrome.alarms.clear('timer-expiry');
      await chrome.storage.local.remove('countdownEndTime');
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'QUERY_COUNTDOWN') {
    (async () => {
      const result = await chrome.storage.local.get('countdownEndTime');
      const endTime = result.countdownEndTime;
      if (endTime && endTime > Date.now()) {
        sendResponse({ active: true, endTime });
      } else {
        if (endTime) await chrome.storage.local.remove('countdownEndTime');
        sendResponse({ active: false });
      }
    })();
    return true;
  }

  if (message.type === 'TIMER_EXPIRED') {
    (async () => {
      await sendMessageToOffscreen({ type: 'PLAY_ALERT' });
      await new Promise(r => setTimeout(r, 1500));
      await sendMessageToOffscreen({ type: 'STOP' });
      await closeOffscreen();
      await clearState();
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Timer Expired',
        message: 'AM modulation has stopped.'
      });
      chrome.runtime.sendMessage({ type: 'CAPTURE_ENDED' }).catch(() => {});
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'SET_BLOCKED_DOMAINS') {
    blockedDomains = message.domains;
    chrome.storage.local.set({ blockedDomains });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_BLOCKING_MODE') {
    blockingMode = message.mode;
    chrome.storage.local.set({ blockingMode });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_BLOCKER_STATE') {
    sendResponse({ blockedDomains, blockingMode });
    return true;
  }
});

// ==================== Alarm Handler ====================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'timer-expiry') {
    await chrome.storage.local.remove('countdownEndTime');
    await sendMessageToOffscreen({ type: 'PLAY_ALERT' });
    await new Promise(r => setTimeout(r, 1500));
    await sendMessageToOffscreen({ type: 'STOP' });
    await closeOffscreen();
    await clearState();
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Timer Expired',
      message: 'AM modulation has stopped.'
    });
    chrome.runtime.sendMessage({ type: 'CAPTURE_ENDED' }).catch(() => {});
  }
});

// ==================== Tab Cleanup ====================

chrome.tabs.onRemoved.addListener((tabId) => {
  if (capturedTabId === tabId) {
    chrome.alarms.clear('timer-expiry');
    chrome.storage.local.remove('countdownEndTime');
    sendMessageToOffscreen({ type: 'STOP' }).catch(() => {});
    closeOffscreen();
    clearState();
    chrome.runtime.sendMessage({ type: 'CAPTURE_ENDED' }).catch(() => {});
  }
});

// ==================== Startup ====================

loadState();
loadBlockerState();
