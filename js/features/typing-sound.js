window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_typing_sound';
const TYPES = ['mechanical', 'typewriter', 'soft'];

let settings = { enabled: false, type: 'mechanical' };
let audioCtx = null;
let lastKey = 0;

function load() {
    try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        settings = { enabled: false, type: 'mechanical', ...s };
    } catch {}
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
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

function playMechanical() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = createNoise(ctx, 0.04);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800 + Math.random() * 600;
    bp.Q.value = 1.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    noise.connect(bp).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.06);
    const click = ctx.createOscillator();
    const cg = ctx.createGain();
    click.type = 'square';
    click.frequency.value = 2200;
    cg.gain.setValueAtTime(0.0001, now);
    cg.gain.linearRampToValueAtTime(0.08, now + 0.001);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
    click.connect(cg).connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.02);
}

function playTypewriter() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
    if (Math.random() < 0.15) {
        const ding = ctx.createOscillator();
        const dg = ctx.createGain();
        ding.type = 'sine';
        ding.frequency.value = 2200;
        dg.gain.setValueAtTime(0.0001, now);
        dg.gain.linearRampToValueAtTime(0.1, now + 0.005);
        dg.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        ding.connect(dg).connect(ctx.destination);
        ding.start(now + 0.05);
        ding.stop(now + 0.26);
    }
}

function playSoft() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000 + Math.random() * 200;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
}

function createNoise(ctx, dur) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
}

function play() {
    if (!settings.enabled) return;
    const now = performance.now();
    if (now - lastKey < 20) return;
    lastKey = now;
    if (settings.type === 'mechanical') playMechanical();
    else if (settings.type === 'typewriter') playTypewriter();
    else playSoft();
}

function onKeyDown(e) {
    if (!settings.enabled) return;
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (!target || !target.matches) return;
    if (!target.matches('input, textarea, [contenteditable="true"]')) return;
    play();
}

function setEnabled(v) {
    settings.enabled = !!v;
    save();
}
function setType(t) {
    if (!TYPES.includes(t)) return false;
    settings.type = t;
    save();
    return true;
}
function getSettings() { return { ...settings }; }
function types() { return [...TYPES]; }
function typeLabel(t) {
    const m = { mechanical: '机械键盘', typewriter: '打字机', soft: '柔和' };
    return m[t] || t;
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-typingSound')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">打字机音效</div>
                <div class="settings-card-desc">在输入框内打字时播放程序生成的键盘音效</div>
            </div>
            <div class="toggle-switch ${settings.enabled ? 'on' : ''}" id="setting-typingSound" role="switch" aria-checked="${settings.enabled}"></div>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-typingSound').addEventListener('click', () => {
            const next = !settings.enabled;
            setEnabled(next);
            section.querySelector('#setting-typingSound').classList.toggle('on', next);
            section.querySelector('#setting-typingSound').setAttribute('aria-checked', next ? 'true' : 'false');
        });
        const typeSection = document.createElement('div');
        typeSection.className = 'settings-card';
        typeSection.innerHTML = `
            <div class="settings-card-title">音色类型</div>
            <select class="settings-select" id="setting-typingSoundType">
                ${TYPES.map(t => `<option value="${t}" ${t === settings.type ? 'selected' : ''}>${typeLabel(t)}</option>`).join('')}
            </select>
        `;
        mainEl.appendChild(typeSection);
        typeSection.querySelector('#setting-typingSoundType').addEventListener('change', (e) => setType(e.target.value));
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    load();
    injectSettingsIntoPanel();
    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.MXOS.Features.typingSound = { setEnabled, setType, getSettings, types, typeLabel, play };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, setType, getSettings, play };
