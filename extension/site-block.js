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
  },
  'twitch.tv': {
    attributes: {
      hideFollowedSidebar:         { attribute: 'focus-hub-twitch-hide-followed-sidebar',         settingKey: 'hideFollowedSidebar' },
      hideHomepageRecommendations: { attribute: 'focus-hub-twitch-hide-homepage-recommendations', settingKey: 'hideHomepageRecommendations' },
      hideRelatedChannels:         { attribute: 'focus-hub-twitch-hide-related-channels',         settingKey: 'hideRelatedChannels' },
      hideLiveChannels:            { attribute: 'focus-hub-twitch-hide-live-channels',            settingKey: 'hideLiveChannels' },
      hideHomepage:                { attribute: 'focus-hub-twitch-hide-homepage',                settingKey: 'hideHomepage' }
    }
  }
};
const STORAGE_KEY = 'siteBlocking';

function applySiteBlocking(settings, globalEnabled) {
  const host = window.location.hostname;
  let domain = '';
  for (const d in SITE_BLOCK_CONFIG) {
    if (host === d || host.endsWith('.' + d)) { domain = d; break; }
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

// ── Twitch Homepage Feed Hiding (JS-based DOM walking) ──
// The carousel is hidden via CSS; feed sections (shelves) are found by walking
// the carousel's sibling tree and hiding children that contain <h2> headings.
// Matches the approach used by amirbexe/twitch-carousel-remover.

const HOMEPAGE_ATTR = 'focus-hub-twitch-hide-homepage';
let homepageBodyObserver = null;
let homepageTitleObserver = null;

function isTwitchHomepage() {
  return location.hostname.endsWith('twitch.tv') && location.pathname === '/';
}

function hideHomepageSections() {
  const carousels = document.querySelectorAll('[data-a-target="front-page-carousel"]');
  carousels.forEach(function(carousel) {
    const parent = carousel.parentElement;
    if (!parent) return;
    Array.from(parent.children).forEach(function(child) {
      if (child === carousel) return;
      if (child.querySelector('h2')) {
        child.setAttribute('data-fh-hidden', 'true');
        child.style.display = 'none';
      }
    });
  });
  startHomepageBodyObserver();
}

function showHomepageSections() {
  document.querySelectorAll('[data-fh-hidden="true"]').forEach(function(el) {
    el.removeAttribute('data-fh-hidden');
    el.style.display = '';
  });
  stopHomepageBodyObserver();
}

let homepageDebounce = null;
function startHomepageBodyObserver() {
  if (homepageBodyObserver) return;
  homepageBodyObserver = new MutationObserver(function() {
    if (!isTwitchHomepage()) return;
    clearTimeout(homepageDebounce);
    homepageDebounce = setTimeout(hideHomepageSections, 300);
  });
  homepageBodyObserver.observe(document.body, { childList: true, subtree: true });
}

function stopHomepageBodyObserver() {
  if (homepageBodyObserver) {
    homepageBodyObserver.disconnect();
    homepageBodyObserver = null;
  }
}

function checkHomepageState() {
  if (!isTwitchHomepage()) {
    showHomepageSections();
    return;
  }
  const attr = document.documentElement.getAttribute(HOMEPAGE_ATTR);
  if (attr === 'true') {
    hideHomepageSections();
  } else {
    showHomepageSections();
  }
}

// Watch attribute changes on <html> (set by applySiteBlocking)
new MutationObserver(checkHomepageState).observe(
  document.documentElement,
  { attributes: true, attributeFilter: [HOMEPAGE_ATTR] }
);

// SPA navigation — re-check when page title changes (Twitch updates it on route change)
function setupTitleObserver() {
  let lastTitle = document.title;
  homepageTitleObserver = new MutationObserver(function() {
    if (document.title !== lastTitle) {
      lastTitle = document.title;
      checkHomepageState();
    }
  });
  const titleEl = document.querySelector('title') || document.head;
  if (titleEl) {
    homepageTitleObserver.observe(titleEl, {
      childList: true, subtree: true, characterData: true
    });
  }
}

// Initial check (deferred to let DOM settle)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setupTitleObserver();
    setTimeout(checkHomepageState, 500);
  });
} else {
  setupTitleObserver();
  setTimeout(checkHomepageState, 500);
}