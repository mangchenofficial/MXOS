window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_sound_theme';

const THEMES = {
    default: { name: '默认', waveType: 'sine', baseFreq: 600, sweep: 0 },
    retro: { name: '复古', waveType: 'square', baseFreq: 880, sweep: 0 },
    future: { name: '未来', waveType: 'sawtooth', baseFreq: 700, sweep: 300 },
    nature: { name: '自然', waveType: 'triangle', baseFreq: 480, sweep: 100 },
    minimal: { name: '极简', waveType: 'sine', baseFreq: 900, sweep: 0 },
    pixel: { name: '像素', waveType: 'square', baseFreq: 1200, sweep: 400 }
};

let current = 'default';
let audioCtx = null;

function load() {
    try { current = localStorage.getItem(STORAGE_KEY) || 'default'; } catch {}
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, current); } catch {}
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

function play(type) {
    const theme = THEMES[current] || THEMES.default;
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const specs = {
        click: { freq: theme.baseFreq, dur: 0.05, sweep: 0 },
        toggle: { freq: theme.baseFreq, dur: 0.07, sweep: theme.sweep },
        success: { freq: theme.baseFreq * 1.5, dur: 0.14, sweep: theme.sweep },
        error: { freq: theme.baseFreq * 0.5, dur: 0.18, sweep: -theme.sweep },
        notify: { freq: theme.baseFreq * 1.3, dur: 0.1, sweep: theme.sweep }
    };
    const spec = specs[type] || specs.click;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = theme.waveType;
    osc.frequency.setValueAtTime(spec.freq, now);
    if (spec.sweep) osc.frequency.linearRampToValueAtTime(spec.freq + spec.sweep, now + spec.dur);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + spec.dur + 0.02);
}

function setTheme(t) {
    if (!THEMES[t]) return false;
    current = t;
    save();
    play('toggle');
    return true;
}

function getTheme() { return current; }
function themes() { return Object.keys(THEMES); }
function themeLabel(t) { return THEMES[t]?.name || t; }

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-soundThemeSelect')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.innerHTML = `
            <div class="settings-card-title">系统声音主题</div>
            <div class="settings-card-desc">为系统交互音效选择不同的风格</div>
            <select class="settings-select" id="setting-soundThemeSelect">
                ${themes().map(t => `<option value="${t}" ${t === current ? 'selected' : ''}>${themeLabel(t)}</option>`).join('')}
            </select>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-soundThemeSelect').addEventListener('change', (e) => setTheme(e.target.value));
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    load();
    injectSettingsIntoPanel();
    window.MXOS.Features.soundThemes = {
        play, setTheme, getTheme, themes, themeLabel
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setTheme, getTheme, themes };
