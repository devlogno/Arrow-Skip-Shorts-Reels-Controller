const DEFAULT_SETTINGS = {
  defaultSkipSeconds: 1,
  speedStep: 0.25,
  maxSpeed: 8,
  volumeStep: 10,
  shortcuts: {
    seekBack:    { key: 'ArrowLeft',  shift: false, ctrl: false, alt: false },
    seekForward: { key: 'ArrowRight', shift: false, ctrl: false, alt: false },
    speedUp:     { key: 'ArrowRight', shift: true,  ctrl: false, alt: false },
    speedDown:   { key: 'ArrowLeft',  shift: true,  ctrl: false, alt: false },
    volumeUp:    { key: 'ArrowUp',    shift: true, ctrl: false, alt: false },
    volumeDown:  { key: 'ArrowDown',  shift: true, ctrl: false, alt: false },
    autoScroll:  { key: 's',          shift: false, ctrl: false, alt: false }
  },
  autoScrollEnabled: false,
  sites: [
    { id: 'youtube-shorts',  label: 'YouTube Shorts',  hostname: 'youtube.com',   pathContains: '/shorts', enabled: true, skipSeconds: 1, defaultSpeed: 1 },
    { id: 'instagram-reels', label: 'Instagram Reels', hostname: 'instagram.com', pathContains: '/reels',  enabled: true, skipSeconds: 1, defaultSpeed: 1 },
    { id: 'tiktok',          label: 'TikTok',          hostname: 'tiktok.com',    pathContains: '',        enabled: true, skipSeconds: 1, defaultSpeed: 1 }
  ]
};

// Deep-merge: fill in any missing keys from defaults without overwriting user values
function mergeDefaults(existing, defaults) {
  const result = { ...defaults, ...existing };
  for (const key of Object.keys(defaults)) {
    if (defaults[key] && typeof defaults[key] === 'object') {
      if (Array.isArray(defaults[key])) {
        // For sites, merge objects by ID or hostname
        if (key === 'sites') {
          const mergedSites = [...(existing?.[key] || [])];
          defaults[key].forEach(defSite => {
            const idx = mergedSites.findIndex(s => s.id === defSite.id || s.hostname === defSite.hostname);
            if (idx === -1) mergedSites.push(defSite);
            else {
              // Merge default properties into existing site object if missing
              mergedSites[idx] = { ...defSite, ...mergedSites[idx] };
            }
          });
          result[key] = mergedSites;
        }
      } else {
        result[key] = mergeDefaults(existing?.[key] || {}, defaults[key]);
      }
    }
  }
  return result;
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // Context Menu
  chrome.contextMenus.create({
    id: 'add-site',
    title: chrome.i18n.getMessage('ctxAddSite') || 'Add to Arrow Skip',
    contexts: ['page']
  });

  if (reason === 'install') {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  } else if (reason === 'update') {
    // Merge new defaults into existing settings — preserves user customizations
    const data = await chrome.storage.sync.get('settings');
    const merged = mergeDefaults(data.settings || {}, DEFAULT_SETTINGS);
    await chrome.storage.sync.set({ settings: merged });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-site' && tab?.url) {
    const url = new URL(tab.url);
    const hostname = url.hostname.replace('www.', '');
    const label = (tab.title || hostname).substring(0, 40); // Cap title length
    const path = url.pathname !== '/' ? url.pathname : '';

    const popupUrl = chrome.runtime.getURL(`popup/popup.html?confirm=1&label=${encodeURIComponent(label)}&hostname=${encodeURIComponent(hostname)}&path=${encodeURIComponent(path)}`);
    
    chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 420,
      height: 540,
      focused: true
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get('settings', d => sendResponse({ settings: d.settings || DEFAULT_SETTINGS }));
    return true;
  }
  if (msg.type === 'SAVE_SETTINGS') {
    chrome.storage.sync.set({ settings: msg.settings }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'GET_DEFAULTS') {
    sendResponse({ defaults: DEFAULT_SETTINGS });
    return false;
  }
});
