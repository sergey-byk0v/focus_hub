// In-page ("Deep Clean") blocking. Toggles focus-hub-* attributes on <html>; the
// matching rules in site-block.css hide the sections via display:none!important.
// Logic mirrors the researched "Intentional" extension: per-domain config map,
// attribute toggling on document_start, re-apply on storage change.
const SITE_BLOCK_CONFIG = {
  'youtube.com': {
    attributes: {
      hideHomePageSuggestions:   { attribute: 'focus-hub-youtube-hide-home-page-suggestions',   settingKey: 'hideHomePageSuggestions' },
      hideVideoPageSuggestions:  { attribute: 'focus-hub-youtube-hide-video-page-suggestions',  settingKey: 'hideVideoPageSuggestions' },
      hideShorts:                { attribute: 'focus-hub-youtube-hide-shorts',                   settingKey: 'hideShorts' },
      hideComments:              { attribute: 'focus-hub-youtube-hide-comments',                 settingKey: 'hideComments' }
    }
  }
};
const STORAGE_KEY = 'siteBlocking';

function applySiteBlocking(settings, globalEnabled) {
  const host = window.location.hostname;
  let domain = '';
  for (const d in SITE_BLOCK_CONFIG) {
    if (host.includes(d)) { domain = d; break; }
  }
  const config = SITE_BLOCK_CONFIG[domain];
  const root = document.documentElement;

  if (!config) return;

  // Global Deep Clean kill-switch off (or no per-site entry) -> clear every attribute
  if (globalEnabled === false) {
    for (const key in config.attributes) {
      root.removeAttribute(config.attributes[key].attribute);
    }
    return;
  }

  const toggles = settings && settings[domain] ? settings[domain] : null;

  // Per-site master off (or no saved settings) -> clear every attribute
  if (!toggles || !toggles.enabled) {
    for (const key in config.attributes) {
      root.removeAttribute(config.attributes[key].attribute);
    }
    return;
  }

  for (const key in config.attributes) {
    const { attribute, settingKey } = config.attributes[key];
    root.setAttribute(attribute, toggles[settingKey] ? 'true' : 'false');
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes[STORAGE_KEY] || changes['deepCleanEnabled'])) {
    let settings = changes[STORAGE_KEY] ? changes[STORAGE_KEY].newValue : null;
    const globalEnabled = changes['deepCleanEnabled'] ? changes['deepCleanEnabled'].newValue : undefined;
    // When only the global flag changed, re-read settings for this site
    if (settings === null) {
      chrome.storage.local.get(STORAGE_KEY).then(result => {
        applySiteBlocking(result[STORAGE_KEY], globalEnabled);
      });
      return;
    }
    applySiteBlocking(settings, globalEnabled);
  }
});

chrome.storage.local.get([STORAGE_KEY, 'deepCleanEnabled']).then(result => {
  applySiteBlocking(result[STORAGE_KEY], result['deepCleanEnabled']);
});
