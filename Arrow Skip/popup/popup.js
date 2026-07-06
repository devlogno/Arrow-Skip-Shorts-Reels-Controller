(() => {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let settings = null;
  let recordingTarget = null; // { action, btn }
  let editingSiteIdx = null; // null or index

  // Factory defaults — mirrors background.js DEFAULT_SETTINGS.shortcuts
  const DEFAULT_SHORTCUTS = {
    seekBack:    { key: 'ArrowLeft',  shift: false, ctrl: false, alt: false },
    seekForward: { key: 'ArrowRight', shift: false, ctrl: false, alt: false },
    speedUp:     { key: 'ArrowRight', shift: true,  ctrl: false, alt: false },
    speedDown:   { key: 'ArrowLeft',  shift: true,  ctrl: false, alt: false },
    volumeUp:    { key: 'ArrowUp',    shift: true, ctrl: false, alt: false },
    volumeDown:  { key: 'ArrowDown',  shift: true, ctrl: false, alt: false },
    autoScroll:  { key: 's',          shift: false, ctrl: false, alt: false }
  };

  const SHORTCUT_DEFS = [
    { action: 'seekBack',    icon: '⏪', label: chrome.i18n.getMessage('seekBack') || 'Seek Back'   },
    { action: 'seekForward', icon: '⏩', label: chrome.i18n.getMessage('seekForward') || 'Seek Forward' },
    { action: 'speedUp',     icon: '🚀', label: chrome.i18n.getMessage('speedUp') || 'Speed Up'    },
    { action: 'speedDown',   icon: '🐢', label: chrome.i18n.getMessage('speedDown') || 'Speed Down'  },
    { action: 'volumeUp',    icon: '🔊', label: chrome.i18n.getMessage('volumeUp') || 'Volume Up'   },
    { action: 'volumeDown',  icon: '🔈', label: chrome.i18n.getMessage('volumeDown') || 'Volume Down' },
    { action: 'autoScroll',  icon: '📜', label: chrome.i18n.getMessage('autoScroll') || 'Auto Scroll' }
  ];

  // ── Stepper builder ────────────────────────────────────────────────────────
  // Returns a <div> with ‹ [input] unit › controls. onChange(value) fires on change.
  let _newSkipStepper = null;
  let _newSpeedStepper = null;

  function buildStepper(initVal, onChange, { min = 0.1, max = 60, step = 1, unit = 'sec' } = {}) {
    let current = Math.max(min, Math.min(max, initVal));

    const btnStyle = (extra = '') =>
      `width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;` +
      `font-size:16px;font-weight:700;cursor:pointer;transition:all .15s;` +
      `background:var(--surface2);border:1px solid var(--border);color:var(--text);${extra}`;

    const boxStyle =
      `display:flex;align-items:center;gap:1px;width:64px;height:26px;border-radius:6px;` +
      `background:var(--surface2);border:1px solid var(--border);` +
      `outline:none;transition:border-color .15s,box-shadow .15s;padding:0 4px;`;

    const inpStyle =
      `width:32px;background:transparent;border:none;text-align:right;font-size:12px;font-weight:500;` +
      `color:var(--text);outline:none;padding-right:1px;`;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:3px;';

    const dec = document.createElement('button');
    dec.type = 'button';
    dec.innerHTML = '&#8249;';
    dec.style.cssText = btnStyle();

    const box = document.createElement('div');
    box.style.cssText = boxStyle;

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.value = current;
    inp.min = min; inp.max = max; inp.step = step;
    inp.style.cssText = inpStyle;

    const uSpan = document.createElement('span');
    uSpan.textContent = unit;
    uSpan.style.cssText = 'font-size:10px;font-weight:600;color:var(--muted);margin-left:1px;width:15px;text-align:left;';

    const inc = document.createElement('button');
    inc.type = 'button';
    inc.innerHTML = '&#8250;';
    inc.style.cssText = btnStyle();

    function commit(v) {
      // For speed (unit 'x'), we snap to grid
      if (unit === 'x') {
        const direction = v > current ? 1 : -1;
        if (direction > 0) {
          current = (Math.floor((current + 0.001) / step) + 1) * step;
        } else {
          current = (Math.ceil((current - 0.001) / step) - 1) * step;
        }
      } else {
        current = v;
      }
      current = Math.max(min, Math.min(max, Math.round(current * 100) / 100));
      inp.value = current;
      onChange(current);
    }

    dec.onclick = () => commit(current - step);
    inc.onclick = () => commit(current + step);
    inp.oninput = () => { const v = parseFloat(inp.value); if (!isNaN(v)) { current = v; onChange(v); } };
    inp.onblur  = () => commit(parseFloat(inp.value) || current);
    inp.onblur  = () => commit(parseFloat(inp.value) || current);
    inp.onfocus = () => { box.style.borderColor = '#f97316'; box.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.2)'; };
    inp.onblur  = () => { commit(parseFloat(inp.value) || current); box.style.borderColor = 'var(--border)'; box.style.boxShadow = 'none'; };

    const hoverOn  = btn => () => { btn.style.background = 'rgba(249,115,22,0.18)'; btn.style.borderColor = '#f97316'; btn.style.color = '#fdba74'; };
    const hoverOff = btn => () => { btn.style.background = 'var(--surface2)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text)'; };
    [dec, inc].forEach(b => { b.onmouseenter = hoverOn(b); b.onmouseleave = hoverOff(b); });

    // Expose getValue for Add Site handler
    wrap._getValue = () => current;

    box.append(inp, uSpan);
    wrap.append(dec, box, inc);
    return wrap;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtKey(sc) {
    if (!sc) return '—';
    const parts = [];
    if (sc.ctrl)  parts.push('Ctrl');
    if (sc.alt)   parts.push('Alt');
    if (sc.shift) parts.push('Shift');
    const map = { ArrowLeft:'←', ArrowRight:'→', ArrowUp:'↑', ArrowDown:'↓', ' ':'Space' };
    parts.push(map[sc.key] || sc.key);
    return parts.join('+');
  }

  function localize() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const msg = chrome.i18n.getMessage(el.dataset.i18n);
      if (msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
      if (msg) el.title = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
      if (msg) el.placeholder = msg;
    });
  }

  // ── Load / Save ───────────────────────────────────────────────────────────
  function load() {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, res => {
      settings = res?.settings ? JSON.parse(JSON.stringify(res.settings)) : null;
      if (settings) render();
    });
  }

  function save() {
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });
  }

  // ── Render All ────────────────────────────────────────────────────────────
  function render() {
    renderDefaultSkip();
    renderAutoScroll();
    renderSites();
    renderShortcuts();
  }

  // ── Auto Scroll ──────────────────────────────────────────────────────────
  function renderAutoScroll() {
    const chk = document.getElementById('auto-scroll-toggle');
    const track = chk.nextElementSibling;
    const thumb = track.firstElementChild;
    
    chk.checked = !!settings.autoScrollEnabled;
    track.style.background = chk.checked ? '#f97316' : 'var(--surface2)';
    thumb.style.transform = `translateX(${chk.checked ? 14 : 0}px)`;

    chk.onchange = () => {
      settings.autoScrollEnabled = chk.checked;
      track.style.background = chk.checked ? '#f97316' : 'var(--surface2)';
      thumb.style.transform = `translateX(${chk.checked ? 14 : 0}px)`;
      save();
    };
  }

  // ── Default Skip ─────────────────────────────────────────────────────────
  function renderDefaultSkip() {
    const container = document.getElementById('default-skip-stepper');
    container.innerHTML = '';
    const stepper = buildStepper(
      settings.defaultSkipSeconds,
      val => { settings.defaultSkipSeconds = val; save(); },
      { min: 1, max: 60, step: 1 }
    );
    container.appendChild(stepper);
  }

  // ── Sites ─────────────────────────────────────────────────────────────────
  function renderSites() {
    const list = document.getElementById('sites-list');
    list.innerHTML = '';
    settings.sites.forEach((site, idx) => {
      const card = document.createElement('div');
      card.className = 'site-card rounded-xl p-3 flex flex-col gap-2.5';
      card.style.cssText = `background:var(--surface);border:1px solid var(--border);animation-delay:${idx * 40}ms;opacity:0`;
      card.innerHTML = `
        <div class="flex items-center gap-2">
          <label class="toggle relative w-8 h-5 flex-shrink-0 cursor-pointer">
            <input type="checkbox" class="toggle-check sr-only" ${site.enabled ? 'checked' : ''} />
            <span class="toggle-track block w-full h-full rounded-full" style="background:${site.enabled ? '#f97316' : 'var(--surface2)'}">
              <span class="toggle-thumb absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" style="transform:translateX(${site.enabled ? 14 : 0}px)"></span>
            </span>
          </label>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold truncate">${esc(site.label)}</div>
            <div class="text-xs truncate" style="color:var(--muted)">${esc(site.hostname)}${site.pathContains ? esc(site.pathContains) + '*' : '/*'}</div>
          </div>
          <div class="flex items-center gap-1">
            <button class="edit-btn text-[10px] font-bold uppercase tracking-wide rounded-lg px-2 py-1 transition-all duration-150 hover:opacity-80" 
              style="background:var(--surface2);border:1px solid var(--border);color:var(--muted)" data-i18n-title="edit" data-i18n="editBtn">Edit</button>
            <button class="del-btn text-lg leading-none rounded-lg px-1.5 transition-all duration-150 hover:opacity-80" style="color:var(--muted)" data-i18n-title="remove">✕</button>
          </div>
        </div>
        <div class="flex items-center justify-between gap-3 mt-1">
          <div class="flex items-center gap-2 flex-1">
            <span class="text-[10px] font-bold uppercase tracking-tighter" style="color:var(--muted)" data-i18n="skip">Skip</span>
            <div class="site-skip-stepper"></div>
          </div>
          <div class="flex items-center gap-2 flex-1 justify-end">
            <span class="text-[10px] font-bold uppercase tracking-tighter" style="color:var(--muted)" data-i18n="defaultSpeed">Default Speed</span>
            <div class="site-speed-stepper"></div>
          </div>
        </div>
      `;
      localize(); // Localize injected content
      // Toggle
      const chk = card.querySelector('.toggle-check');
      const track = card.querySelector('.toggle-track');
      const thumb = card.querySelector('.toggle-thumb');
      chk.onchange = () => {
        settings.sites[idx].enabled = chk.checked;
        track.style.background = chk.checked ? '#f97316' : 'var(--surface2)';
        thumb.style.transform = `translateX(${chk.checked ? 14 : 0}px)`;
        card.style.opacity = chk.checked ? '1' : '0.5';
        save();
      };
      card.querySelector('.site-skip-stepper').appendChild(buildStepper(
        site.skipSeconds,
        val => { settings.sites[idx].skipSeconds = val; save(); },
        { min: 1, max: 60, step: 1 }
      ));
      card.querySelector('.site-speed-stepper').appendChild(buildStepper(
        site.defaultSpeed || 1,
        val => { settings.sites[idx].defaultSpeed = val; save(); },
        { min: 0.1, max: 16, step: 0.1, unit: 'x' }
      ));
      // Edit
      card.querySelector('.edit-btn').onclick = () => {
        editingSiteIdx = idx;
        const s = settings.sites[idx];
        document.getElementById('new-label').value = s.label;
        document.getElementById('new-hostname').value = s.hostname;
        document.getElementById('new-path').value = s.pathContains || '';
        
        document.getElementById('new-skip-stepper').innerHTML = '';
        _newSkipStepper = buildStepper(s.skipSeconds, () => {}, { min: 1, max: 60, step: 1 });
        document.getElementById('new-skip-stepper').appendChild(_newSkipStepper);

        document.getElementById('new-speed-stepper').innerHTML = '';
        _newSpeedStepper = buildStepper(s.defaultSpeed || 1, () => {}, { min: 0.1, max: 16, step: 0.1, unit: 'x' });
        document.getElementById('new-speed-stepper').appendChild(_newSpeedStepper);

        document.getElementById('add-tab-title').textContent = chrome.i18n.getMessage('editSite') || 'Edit Site';
        document.getElementById('add-site-btn').textContent = chrome.i18n.getMessage('saveChanges') || 'Save Changes';
        document.getElementById('add-cancel-btn').classList.remove('hidden');
        switchTab('add');
      };
      // Delete
      card.querySelector('.del-btn').onclick = () => {
        settings.sites.splice(idx, 1);
        save();
        renderSites();
      };
      if (!site.enabled) card.style.opacity = '0.5';
      list.appendChild(card);
      // Trigger animation
      requestAnimationFrame(() => requestAnimationFrame(() => { card.style.opacity = ''; card.style.animationFillMode = 'forwards'; }));
    });
  }

  // ── Shortcuts ─────────────────────────────────────────────────────────────
  function renderShortcuts() {
    // Speed / volume step sliders
    const spSl = document.getElementById('speed-step');
    const spBadge = document.getElementById('speed-badge');
    const volSl = document.getElementById('vol-step');
    const volBadge = document.getElementById('vol-badge');

    spSl.value = settings.speedStep || 0.25;
    spBadge.textContent = (settings.speedStep || 0.25) + '×';
    spSl.oninput = () => {
      settings.speedStep = +spSl.value;
      spBadge.textContent = (+spSl.value).toFixed(2).replace(/\.?0+$/, '') + '×';
      save();
    };

    const mxSl    = document.getElementById('max-speed');
    const mxBadge = document.getElementById('max-speed-badge');
    mxSl.value = settings.maxSpeed || 8;
    mxBadge.textContent = (settings.maxSpeed || 8) + '×';
    mxSl.oninput = () => {
      settings.maxSpeed = +mxSl.value;
      mxBadge.textContent = mxSl.value + '×';
      save();
    };

    volSl.value = settings.volumeStep || 10;
    volBadge.textContent = (settings.volumeStep || 10) + '%';
    volSl.oninput = () => {
      settings.volumeStep = +volSl.value;
      volBadge.textContent = volSl.value + '%';
      save();
    };

    // Shortcut rows
    const list = document.getElementById('sc-list');
    list.innerHTML = '';
    SHORTCUT_DEFS.forEach(({ action, icon, label }) => {
      const sc  = settings.shortcuts?.[action];
      const def = DEFAULT_SHORTCUTS[action];
      const isDefault = sc && fmtKey(sc) === fmtKey(def);

      const row = document.createElement('div');
      row.className = 'sc-row flex items-center gap-2 rounded-xl px-3 py-2.5';
      row.style.cssText = 'background:var(--surface);border:1px solid var(--border)';
      row.innerHTML = `
        <span class="text-base w-6 text-center flex-shrink-0">${icon}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">${label}</div>
          <div class="text-xs" style="color:var(--muted)">${chrome.i18n.getMessage('defaultPrefix') || 'default'}: ${esc(fmtKey(def))}</div>
        </div>
        <button class="reset-sc-btn text-xs rounded-md px-1.5 py-1 transition-all duration-150"
          title="Reset to default"
          style="color:${isDefault ? 'transparent' : 'var(--muted)'};pointer-events:${isDefault ? 'none' : 'auto'};border:1px solid ${isDefault ? 'transparent' : 'var(--border)'}">
          ↺
        </button>
        <button class="key-btn text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-150"
          style="background:var(--surface2);border:1px solid ${isDefault ? 'var(--border)' : '#f97316'};color:${isDefault ? '#fdba74' : '#f97316'};min-width:88px;text-align:center"
          data-action="${action}">${esc(fmtKey(sc))}</button>
      `;
      const keyBtn   = row.querySelector('.key-btn');
      const resetBtn = row.querySelector('.reset-sc-btn');
      keyBtn.onclick   = () => startRecording(action, keyBtn);
      resetBtn.onclick = () => resetShortcut(action);
      list.appendChild(row);
    });
  }

  // ── Reset single shortcut ─────────────────────────────────────────────────
  function resetShortcut(action) {
    settings.shortcuts[action] = { ...DEFAULT_SHORTCUTS[action] };
    save();
    renderShortcuts();
  }

  // ── Key Capture ───────────────────────────────────────────────────────────
  function startRecording(action, btn) {
    if (recordingTarget) stopRecording(false);
    recordingTarget = { action, btn };
    btn.textContent = 'Press key…';
    btn.classList.add('recording');
    btn.style.color = '#f97316';
    btn.style.borderColor = '#f97316';
    document.addEventListener('keydown', captureKey, { capture: true, once: true });
    document.addEventListener('keyup', cancelCapture, { capture: true, once: true });
  }

  function captureKey(e) {
    e.preventDefault(); e.stopPropagation();
    if (!recordingTarget) return;
    const ignore = ['Shift','Control','Alt','Meta'];
    if (ignore.includes(e.key)) {
      // Wait for non-modifier
      document.addEventListener('keydown', captureKey, { capture: true, once: true });
      return;
    }
    const sc = { key: e.key, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey };
    settings.shortcuts[recordingTarget.action] = sc;
    save();
    stopRecording(true);
    renderShortcuts(); // re-render to update all badges
  }

  function cancelCapture() {
    stopRecording(false);
  }

  function stopRecording(success) {
    if (!recordingTarget) return;
    const { btn } = recordingTarget;
    btn.classList.remove('recording');
    btn.style.color = '';
    btn.style.borderColor = '';
    if (!success) {
      const sc = settings.shortcuts?.[recordingTarget.action];
      btn.textContent = fmtKey(sc);
    }
    recordingTarget = null;
    document.removeEventListener('keyup', cancelCapture, { capture: true });
  }

  // ── Add Site ──────────────────────────────────────────────────────────────
  document.getElementById('add-site-btn').onclick = () => {
    const label    = document.getElementById('new-label').value.trim();
    const hostname = document.getElementById('new-hostname').value.trim().replace(/^https?:\/\//,'').replace(/\/.*/,'');
    const path     = document.getElementById('new-path').value.trim();
    const skip  = _newSkipStepper ? _newSkipStepper._getValue() : 1;
    const speed = _newSpeedStepper ? _newSpeedStepper._getValue() : 1;
    const errEl = document.getElementById('add-error');

    errEl.classList.add('hidden');
    if (!label)                           return showErr(chrome.i18n.getMessage('errLabelRequired') || 'Enter a label');
    if (!hostname || !hostname.includes('.')) return showErr(chrome.i18n.getMessage('errHostRequired') || 'Enter a valid hostname');

    if (editingSiteIdx !== null) {
      settings.sites[editingSiteIdx] = {
        ...settings.sites[editingSiteIdx],
        label, hostname, pathContains: path, skipSeconds: skip, defaultSpeed: speed
      };
    } else {
      settings.sites.push({ id: 'custom-' + Date.now(), label, hostname, pathContains: path, enabled: true, skipSeconds: skip, defaultSpeed: speed });
    }
    
    save(); renderSites();
    resetAddForm();
    switchTab('sites');

    // If we are in a confirmation window, close it
    if (window.location.search.includes('confirm=1')) {
      window.close();
    }
  };

  function resetAddForm() {
    editingSiteIdx = null;
    document.getElementById('add-tab-title').textContent = chrome.i18n.getMessage('addTabTitle') || 'Add New Site';
    document.getElementById('add-site-btn').textContent = chrome.i18n.getMessage('addSiteBtn') || 'Add Site';
    document.getElementById('add-cancel-btn').classList.add('hidden');
    ['new-label','new-hostname','new-path'].forEach(id => document.getElementById(id).value = '');
    
    document.getElementById('new-skip-stepper').innerHTML = '';
    document.getElementById('new-speed-stepper').innerHTML = '';
    _newSkipStepper = buildStepper(1, () => {}, { min: 1, max: 60, step: 1 });
    _newSpeedStepper = buildStepper(1, () => {}, { min: 0.1, max: 16, step: 0.1, unit: 'x' });
    document.getElementById('new-skip-stepper').appendChild(_newSkipStepper);
    document.getElementById('new-speed-stepper').appendChild(_newSpeedStepper);
  }

  document.getElementById('add-cancel-btn').onclick = () => {
    resetAddForm();
    switchTab('sites');
  };

  function showErr(msg) {
    const el = document.getElementById('add-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  // Reset ─────────────────────────────────────────────────────────────────
  document.getElementById('reset-btn').onclick = () => {
    chrome.runtime.sendMessage({ type: 'GET_DEFAULTS' }, res => {
      settings = JSON.parse(JSON.stringify(res.defaults));
      save(); render();
    });
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = ['sites', 'shortcuts', 'add'];
  const LINE_POSITIONS = { sites: 0, shortcuts: 100, add: 200 };

  function switchTab(id) {
    TABS.forEach(t => {
      const panel = document.getElementById('tab-' + t);
      const btn   = document.querySelector(`[data-tab="${t}"]`);
      if (t === id) {
        panel.classList.remove('hidden');
        btn.classList.add('active');
        btn.style.color = '#f97316';
      } else {
        panel.classList.add('hidden');
        btn.classList.remove('active');
        btn.style.color = 'var(--muted)';
      }
    });
    document.getElementById('tab-line').style.transform = `translateX(${LINE_POSITIONS[id]}%)`;
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  // Focus styles for text inputs
  document.querySelectorAll('input[type=text]').forEach(inp => {
    inp.onfocus = () => { inp.style.borderColor = '#f97316'; inp.style.boxShadow = '0 0 0 3px rgba(249,115,22,0.2)'; };
    inp.onblur  = () => { inp.style.borderColor = 'var(--border)'; inp.style.boxShadow = 'none'; };
  });

  // ── Boot ─────────────────────────────────────────────────────────────────
  localize();
  load();
  
  // Check for URL parameters (Context Menu Add)
  const params = new URLSearchParams(window.location.search);
  if (params.get('label')) {
    document.getElementById('new-label').value = params.get('label');
    document.getElementById('new-hostname').value = params.get('hostname');
    document.getElementById('new-path').value = params.get('path') || '';
    switchTab('add');
  } else {
    switchTab('sites');
  }

  // Init the Add Site steppers
  const nss = document.getElementById('new-skip-stepper');
  _newSkipStepper = buildStepper(1, () => {}, { min: 1, max: 60, step: 1 });
  nss.appendChild(_newSkipStepper);

  const nsp = document.getElementById('new-speed-stepper');
  _newSpeedStepper = buildStepper(1, () => {}, { min: 0.1, max: 16, step: 0.1, unit: 'x' });
  nsp.appendChild(_newSpeedStepper);
})();
