window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_keyboard_music';
const SCALE = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00];

let enabled = false;
let audioCtx = null;

function load() {
    try { enabled = localStorage.getItem(STORAGE_KEY) === '1'; } catch {}
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
}

function ensureCtx() {
    if (!audioCtx) {
        try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            audioCtx = new Ctor();
        } catch { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
}

function freqFromKey(key) {
    const code = key.charCodeAt(0);
    return SCALE[code % SCALE.length];
}

function playNote(freq) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
}

function onKeyDown(e) {
    if (!enabled) return;
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (target && target.matches && !target.matches('input, textarea, [contenteditable="true"]')) {
        if (!e.key || e.key.length !== 1) return;
    }
    const freq = freqFromKey(e.key || 'a');
    playNote(freq);
}

function setEnabled(v) {
    enabled = !!v;
    save();
    if (enabled) {
        const ctx = ensureCtx();
        if (ctx) playNote(440);
    }
}
function isEnabled() { return enabled; }

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-keyboardMusic')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">键盘音乐</div>
                <div class="settings-card-desc">打字时为每个按键生成音符</div>
            </div>
            <div class="toggle-switch ${enabled ? 'on' : ''}" id="setting-keyboardMusic" role="switch" aria-checked="${enabled}"></div>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-keyboardMusic').addEventListener('click', () => {
            const next = !enabled;
            setEnabled(next);
            section.querySelector('#setting-keyboardMusic').classList.toggle('on', next);
            section.querySelector('#setting-keyboardMusic').setAttribute('aria-checked', next ? 'true' : 'false');
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    load();
    injectSettingsIntoPanel();
    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.MXOS.Features.keyboardMusic = { setEnabled, isEnabled, playNote };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, isEnabled };
