window.MXOS = window.MXOS || {};

const STORAGE_KEY = 'mxos_sound_feedback';
const DEFAULTS = { enabled: false, theme: 'default', volume: 0.3 };

let settings = loadSettings();
let audioCtx = null;
let bound = false;

function loadSettings() {
    try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch {
        return { ...DEFAULTS };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
}

function ensureContext() {
    if (!audioCtx) {
        try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            audioCtx = new Ctor();
        } catch {
            return null;
        }
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

const THEMES = {
    default: {
        click: { freq: 600, dur: 0.06, type: 'sine', sweep: 0 },
        success: [
            { freq: 660, dur: 0.08, type: 'sine', delay: 0 },
            { freq: 880, dur: 0.12, type: 'sine', delay: 0.08 }
        ],
        error: [
            { freq: 320, dur: 0.12, type: 'square', delay: 0 },
            { freq: 240, dur: 0.18, type: 'square', delay: 0.1 }
        ],
        notify: [
            { freq: 880, dur: 0.08, type: 'triangle', delay: 0 },
            { freq: 1320, dur: 0.12, type: 'triangle', delay: 0.08 }
        ],
        toggle: { freq: 520, dur: 0.07, type: 'triangle', sweep: 220 }
    },
    retro: {
        click: { freq: 1200, dur: 0.03, type: 'square', sweep: 0 },
        success: [
            { freq: 880, dur: 0.05, type: 'square', delay: 0 },
            { freq: 1320, dur: 0.05, type: 'square', delay: 0.06 },
            { freq: 1760, dur: 0.08, type: 'square', delay: 0.12 }
        ],
        error: [
            { freq: 200, dur: 0.1, type: 'sawtooth', delay: 0 },
            { freq: 150, dur: 0.15, type: 'sawtooth', delay: 0.1 }
        ],
        notify: [
            { freq: 1320, dur: 0.05, type: 'square', delay: 0 },
            { freq: 1760, dur: 0.05, type: 'square', delay: 0.06 },
            { freq: 2200, dur: 0.08, type: 'square', delay: 0.12 }
        ],
        toggle: { freq: 1000, dur: 0.04, type: 'square', sweep: 600 }
    },
    future: {
        click: { freq: 1000, dur: 0.05, type: 'sine', sweep: 400 },
        success: [
            { freq: 523, dur: 0.1, type: 'sine', delay: 0 },
            { freq: 784, dur: 0.1, type: 'sine', delay: 0.08 },
            { freq: 1047, dur: 0.16, type: 'sine', delay: 0.16 }
        ],
        error: [
            { freq: 220, dur: 0.18, type: 'sawtooth', delay: 0 },
            { freq: 180, dur: 0.22, type: 'sine', delay: 0.12 }
        ],
        notify: [
            { freq: 1047, dur: 0.1, type: 'sine', delay: 0 },
            { freq: 1568, dur: 0.16, type: 'sine', delay: 0.1 }
        ],
        toggle: { freq: 700, dur: 0.08, type: 'sine', sweep: 500 }
    },
    nature: {
        click: { freq: 480, dur: 0.1, type: 'sine', sweep: 0 },
        success: [
            { freq: 523, dur: 0.14, type: 'sine', delay: 0 },
            { freq: 659, dur: 0.16, type: 'sine', delay: 0.1 }
        ],
        error: [
            { freq: 196, dur: 0.2, type: 'triangle', delay: 0 },
            { freq: 165, dur: 0.24, type: 'triangle', delay: 0.12 }
        ],
        notify: [
            { freq: 784, dur: 0.14, type: 'sine', delay: 0 },
            { freq: 988, dur: 0.18, type: 'sine', delay: 0.12 }
        ],
        toggle: { freq: 440, dur: 0.1, type: 'sine', sweep: 200 }
    },
    minimal: {
        click: { freq: 800, dur: 0.02, type: 'sine', sweep: 0 },
        success: [{ freq: 1000, dur: 0.05, type: 'sine', delay: 0 }],
        error: [{ freq: 400, dur: 0.06, type: 'sine', delay: 0 }],
        notify: [{ freq: 1200, dur: 0.04, type: 'sine', delay: 0 }],
        toggle: { freq: 900, dur: 0.03, type: 'sine', sweep: 0 }
    }
};

function playTone(ctx, opts, when) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, when);
    if (opts.sweep) {
        osc.frequency.linearRampToValueAtTime(opts.freq + opts.sweep, when + opts.dur);
    }
    const vol = settings.volume;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + opts.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + opts.dur + 0.02);
}

function play(type) {
    if (!settings.enabled) return;
    const theme = THEMES[settings.theme] || THEMES.default;
    const spec = theme[type];
    if (!spec) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (Array.isArray(spec)) {
        spec.forEach(note => playTone(ctx, note, now + (note.delay || 0)));
    } else {
        playTone(ctx, spec, now);
    }
}

function setEnabled(enabled) {
    settings.enabled = !!enabled;
    saveSettings();
    if (settings.enabled) {
        const ctx = ensureContext();
        if (ctx) play('click');
    }
}

function setTheme(theme) {
    if (!THEMES[theme]) return false;
    settings.theme = theme;
    saveSettings();
    if (settings.enabled) play('toggle');
    return true;
}

function setVolume(vol) {
    settings.volume = Math.max(0, Math.min(1, vol));
    saveSettings();
}

function getSettings() {
    return { ...settings };
}

function themes() {
    return Object.keys(THEMES);
}

function isInteractable(target) {
    if (!target || !target.matches) return false;
    if (target.matches('input, textarea, [contenteditable="true"]')) return false;
    return target.closest('button, .window-control, .taskbar-item, .start-app, .desktop-icon, .qs-tile, .toggle-switch, .context-menu-item, .settings-menu-item, .start-button, .cb-item, .sticky-color-dot, .sticky-tool-btn, .cb-icon-btn, .cb-action-btn, .focus-exit-btn');
}

function onClick(e) {
    if (!settings.enabled) return;
    const target = e.target;
    if (!isInteractable(target)) return;
    play('click');
}

function onWindowToggle(e) {
    if (!settings.enabled) return;
    const w = e.detail?.window;
    if (!w) return;
    play(w.minimized ? 'toggle' : 'toggle');
}

function onNotificationShow(e) {
    if (!settings.enabled) return;
    play('notify');
}

function bindGlobalListeners() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', onClick, true);
    window.addEventListener('mxos:notification-shown', onNotificationShow);
    window.addEventListener('mxos:window-minimized', onWindowToggle);
    window.addEventListener('mxos:window-restored', onWindowToggle);
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        const volumeSlider = mainEl.querySelector('#setting-volume');
        if (!volumeSlider) return;
        if (mainEl.querySelector('#setting-soundFeedback')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">操作声音反馈</div>
                <div class="settings-card-desc">点击按钮、打开通知时播放音效</div>
            </div>
            <div class="toggle-switch ${settings.enabled ? 'on' : ''}" id="setting-soundFeedback" role="switch" aria-checked="${settings.enabled}"></div>
        `;
        mainEl.appendChild(section);
        const toggle = section.querySelector('#setting-soundFeedback');
        toggle.addEventListener('click', () => {
            const next = !settings.enabled;
            setEnabled(next);
            toggle.classList.toggle('on', next);
            toggle.setAttribute('aria-checked', next ? 'true' : 'false');
        });
        const themeSection = document.createElement('div');
        themeSection.className = 'settings-card';
        themeSection.innerHTML = `
            <div class="settings-card-title">音色主题</div>
            <div class="settings-card-desc">选择不同的音效风格</div>
            <select class="settings-select" id="setting-soundTheme">
                ${themes().map(t => `<option value="${t}" ${t === settings.theme ? 'selected' : ''}>${themeLabel(t)}</option>`).join('')}
            </select>
        `;
        mainEl.appendChild(themeSection);
        themeSection.querySelector('#setting-soundTheme').addEventListener('change', (e) => {
            setTheme(e.target.value);
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function themeLabel(t) {
    const labels = { default: '默认', retro: '复古', future: '未来', nature: '自然', minimal: '极简' };
    return labels[t] || t;
}

function init() {
    bindGlobalListeners();
    injectSettingsIntoPanel();
    window.MXOS.Sound = {
        play,
        setEnabled,
        setTheme,
        setVolume,
        getSettings,
        themes,
        themeLabel
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { play, setEnabled, setTheme, themes };
