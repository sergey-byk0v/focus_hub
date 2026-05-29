const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');
let capturedTabId = null;
let blockedDomains = [];

function isDomainBlocked(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return blockedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

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

loadState();

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
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CLOSE_EXISTING_TABS') {
    chrome.tabs.query({}, tabs => {
      for (const tab of tabs) {
        if (tab.url && isDomainBlocked(tab.url)) {
          chrome.tabs.remove(tab.id);
        }
      }
      sendResponse({ success: true });
    });
  }
});

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && isDomainBlocked(changeInfo.url)) {
    chrome.tabs.remove(tabId);
  }
});
