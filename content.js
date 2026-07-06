(() => {
  'use strict';
  if (window.__svsLoaded) return;
  window.__svsLoaded = true;

  let settings = null, overlayTimer = null, currentSpeed = null;
  let lastSiteId = null;

  function load(cb) {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, res => {
      if (chrome.runtime.lastError) return;
      settings = res?.settings || null;
      const site = matchedSite();
      if (site) {
        lastSiteId = site.id;
        // Sync speed on load
        currentSpeed = site.defaultSpeed ?? 1;
      }
      cb && cb();
    });
  }

  function matchedSite() {
    if (!settings) return null;
    const host = location.hostname.replace('www.', '');
    const path = location.pathname;
    for (const s of settings.sites) {
      if (!s.enabled) continue;
      if (!host.includes(s.hostname.replace('www.', ''))) continue;
      if (s.pathContains && !path.includes(s.pathContains)) continue;
      return s;
    }
    return null;
  }

  function video() {
    const all = [...document.querySelectorAll('video')];
    return all.find(v => !v.paused && v.readyState >= 2)
      || all.find(v => v.offsetParent && v.readyState >= 2)
      || all[0] || null;
  }

  function overlay(icon, label, side = 'center') {
    let el = document.getElementById('__svs_hud__');
    if (!el) {
      el = document.createElement('div');
      el.id = '__svs_hud__';
      Object.assign(el.style, {
        position: 'fixed', top: '50%',
        background: 'rgba(0,0,0,0.65)',
        color: '#fff',
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        fontSize: '20px', fontWeight: '700',
        padding: '12px 24px', borderRadius: '999px',
        pointerEvents: 'none', zIndex: '2147483647',
        opacity: '0', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: '8px',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        transition: 'opacity 0.15s ease, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      });
      document.body.appendChild(el);
    }

    const pos = side === 'left' ? '30%' : (side === 'right' ? '70%' : '50%');
    el.style.left = pos;
    el.innerHTML = `<span style="font-size:16px">${icon}</span><span>${label}</span>`;
    el.style.opacity = '1';
    el.style.transform = `translate(-50%,-50%) scale(1.05)`;
    
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = `translate(-50%,-50%) scale(0.9)`;
    }, 450);
  }

  function applySpeed(vid, rate) {
    if (!vid) return;
    if (Math.abs(vid.playbackRate - rate) < 0.01 && vid.__svsLockedRate === rate) return;
    
    vid.playbackRate = rate;
    vid.__svsLockedRate = rate;
    
    if (vid.__svsLock) vid.removeEventListener('ratechange', vid.__svsLock);
    
    let lockUntil = Date.now() + 2000;
    vid.__svsLock = () => {
      if (Date.now() > lockUntil) {
        vid.removeEventListener('ratechange', vid.__svsLock);
        vid.__svsLock = null;
        return;
      }
      if (Math.abs(vid.playbackRate - rate) > 0.01) {
        vid.playbackRate = rate;
      }
    };
    vid.addEventListener('ratechange', vid.__svsLock);
  }

  let isGlobalScrolling = false;
  // Fast interval to catch new videos and apply speed
  setInterval(() => {
    if (currentSpeed === null) return;
    const vids = document.querySelectorAll('video');
    const autoScroll = !!settings?.autoScrollEnabled;
    
    for (const v of vids) {
      applySpeed(v, currentSpeed);
      
      // Strictly enforce loop = false if auto-scroll is on
      if (autoScroll && v.loop) {
        v.__svsOldLoop = true;
        v.loop = false;
      } else if (!autoScroll && v.__svsOldLoop) {
        v.loop = true;
        delete v.__svsOldLoop;
      }

      if (!v.__svsAutoScroll) {
        v.__svsAutoScroll = true;
        const doScroll = () => {
          if (!settings?.autoScrollEnabled) return;
          if (isGlobalScrolling) return;
          isGlobalScrolling = true;
          
          overlay('📜', chrome.i18n.getMessage('hudAutoScrolling') || 'Auto Scrolling...');
          setTimeout(() => {
            const target = document.activeElement || document.body;
            let scrolled = false;

            // 1. YouTube Shorts Specific Navigation
            if (location.hostname.includes('youtube.com')) {
              const nextBtn = document.querySelector('button[aria-label="Next video"], #navigation-button-down button');
              if (nextBtn) {
                nextBtn.click();
                scrolled = true;
              }
            }

            // 2. Keyboard Event Fallbacks (ArrowDown is very reliable for Shorts/Reels)
            if (!scrolled) {
              const keys = [
                { k: 'PageDown', c: 34 },
                { k: 'ArrowDown', c: 40 }
              ];
              keys.forEach(keyData => {
                const e = new KeyboardEvent('keydown', {
                  key: keyData.k, code: keyData.k, keyCode: keyData.c, which: keyData.c,
                  bubbles: true, cancelable: true
                });
                target.dispatchEvent(e);
              });
            }

            // 3. Deep Container Scroll (Primary for IG and various Reels-like layouts)
            if (!scrolled) {
              let p = v.parentElement;
              while (p && p !== document.body) {
                if (p.scrollHeight > p.clientHeight + 100) {
                  p.scrollBy({ top: p.clientHeight, behavior: 'smooth' });
                  scrolled = true;
                  break;
                }
                p = p.parentElement;
              }
            }

            // 4. Final Fallback
            if (!scrolled) {
              window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
            }
            
            // Global lock to prevent rapid-fire scrolling
            setTimeout(() => { isGlobalScrolling = false; }, 2000);
          }, 100);
        };

        v.addEventListener('ended', doScroll);
        // Fallback: if video is stuck at end but ended didn't fire
        v.addEventListener('timeupdate', () => {
          if (v.duration > 0 && v.currentTime >= v.duration - 0.15 && !v.loop && settings?.autoScrollEnabled) {
            doScroll();
          }
        });
      }
    }
  }, 250);

  function matches(e, sc) {
    return e.key === sc.key
      && !!e.shiftKey === !!sc.shift
      && !!e.ctrlKey === !!sc.ctrl
      && !!e.altKey === !!sc.alt;
  }

  function onKey(e) {
    if (!e.isTrusted) return; // Ignore simulated events (like auto-scroll)
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
    if (!settings?.shortcuts) return;
    const site = matchedSite();
    if (!site) return;
    const sc = settings.shortcuts;
    const vid = video();

    const handle = (action) => { e.preventDefault(); e.stopPropagation(); action(); };

    if (matches(e, sc.seekBack)) return handle(() => {
      if (!vid) return;
      const s = site.skipSeconds ?? settings.defaultSkipSeconds ?? 1;
      vid.currentTime = Math.max(0, vid.currentTime - s);
      overlay('◀◀', `-${s}s`, 'left');
    });
    if (matches(e, sc.seekForward)) return handle(() => {
      if (!vid) return;
      const s = site.skipSeconds ?? settings.defaultSkipSeconds ?? 1;
      vid.currentTime = Math.min(vid.duration || Infinity, vid.currentTime + s);
      overlay('▶▶', `+${s}s`, 'right');
    });
    if (matches(e, sc.speedUp)) return handle(() => {
      const step = +(settings.speedStep || 0.25);
      const maxSpd = +(settings.maxSpeed || 8);
      // Snap to next multiple of step
      currentSpeed = Math.min(maxSpd, +( (Math.floor((currentSpeed + 0.001) / step) + 1) * step ).toFixed(2));
      applySpeed(vid, currentSpeed);
      overlay('🚀', `${currentSpeed}×`);
    });
    if (matches(e, sc.speedDown)) return handle(() => {
      const step = +(settings.speedStep || 0.25);
      // Snap to previous multiple of step
      currentSpeed = Math.max(0.1, +( (Math.ceil((currentSpeed - 0.001) / step) - 1) * step ).toFixed(2));
      // Ensure we don't hit 0 unless intended (min is 0.1)
      if (currentSpeed < 0.1) currentSpeed = 0.1;
      applySpeed(vid, currentSpeed);
      overlay('🐢', `${currentSpeed}×`);
    });
    if (matches(e, sc.volumeUp)) return handle(() => {
      if (!vid) return;
      const step = (settings.volumeStep || 10) / 100;
      vid.volume = Math.min(1, +(vid.volume + step).toFixed(2));
      vid.muted = false;
      overlay('🔊', `${Math.round(vid.volume * 100)}%`);
    });
    if (matches(e, sc.volumeDown)) return handle(() => {
      if (!vid) return;
      const step = (settings.volumeStep || 10) / 100;
      vid.volume = Math.max(0, +(vid.volume - step).toFixed(2));
      overlay(vid.volume === 0 ? '🔇' : '🔈', `${Math.round(vid.volume * 100)}%`);
    });
    if (matches(e, sc.autoScroll)) return handle(() => {
      settings.autoScrollEnabled = !settings.autoScrollEnabled;
      chrome.storage.sync.set({ settings });
      overlay('📜', settings.autoScrollEnabled ? (chrome.i18n.getMessage('hudAutoScrollOn') || 'Auto Scroll ON') : (chrome.i18n.getMessage('hudAutoScrollOff') || 'Auto Scroll OFF'));
    });
  }

  load(() => document.addEventListener('keydown', onKey, { capture: true }));
  
  chrome.storage.onChanged.addListener(c => { 
    if (c.settings) {
      settings = c.settings.newValue;
      const site = matchedSite();
      if (site) {
        lastSiteId = site.id;
        currentSpeed = site.defaultSpeed ?? 1;
      }
    }
  });
})();
