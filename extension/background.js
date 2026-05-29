importScripts('config.js');

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;

  try {
    const url = new URL(details.url);
    if (!isTargetSite(url.hostname)) return;

    const { approved } = await chrome.storage.session.get({ approved: {} });
    const key = String(details.tabId);

    if (approved[key] === details.url) {
      delete approved[key];
      await chrome.storage.session.set({ approved });
      return;
    }

    const blockUrl = chrome.runtime.getURL('block.html')
      + `?target=${encodeURIComponent(details.url)}&tabId=${details.tabId}`;
    chrome.tabs.update(details.tabId, { url: blockUrl });
  } catch (e) {
    // Invalid URL — skip
  }
});

function isTargetSite(hostname) {
  return TARGET_SITES.some(site =>
    hostname === site || hostname.endsWith('.' + site)
  );
}
