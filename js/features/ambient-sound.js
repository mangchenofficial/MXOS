window.MXOS = window.MXOS || {};

const SOUND_TYPES = {
    rain: { name: '雨声', color: '#60a5fa' },
    cafe: { name: '咖啡馆', color: '#a78bfa' },
    keyboard: { name: '键盘', color: '#fbbf24' },
    campfire: { name: '篝火', color: '#f97316' },
    waves: { name: '海浪', color: '#06b6d4' }
};

let audioCtx = null;
let masterGain = null;
let activeNodes = new Map();
let masterVolume = 0.5;
let panelEl = null;

function ensureCtx() {
    if (!audioCtx) {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AC();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = masterVolume;
            masterGain.connect(audioCtx.destination);
        } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

function makeNoise(ctx) {
    const bufSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
}

function createRain(ctx) {
    const src = makeNoise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4000;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(hp); hp.connect(lp); lp.connect(gain);
    src.start();
    return { nodes: [src, hp, lp, gain], output: gain };
}

function createCafe(ctx) {
    const src = makeNoise(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    src.connect(lp); lp.connect(gain);
    src.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    lfo.start();

    return { nodes: [src, lp, gain, lfo, lfoGain], output: gain };
}

function createKeyboard(ctx) {
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    function tick() {
        if (!activeNodes.has('keyboard')) return;
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 1500 + Math.random() * 1500;
        const env = ctx.createGain();
        env.gain.value = 0;
        osc.connect(env); env.connect(gain);
        const now = ctx.currentTime;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.3, now + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.08);
        setTimeout(tick, 200 + Math.random() * 600);
    }
    setTimeout(tick, 200);
    return { nodes: [gain], output: gain };
}

function createCampfire(ctx) {
    const src = makeNoise(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    src.connect(lp); lp.connect(gain);
    src.start();

    function crackle() {
        if (!activeNodes.has('campfire')) return;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 80 + Math.random() * 200;
        const env = ctx.createGain();
        env.gain.value = 0;
        const out = ctx.createGain();
        out.gain.value = 0.12;
        osc.connect(env); env.connect(out); out.connect(gain);
        const now = ctx.currentTime;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.5, now + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.15);
        setTimeout(crackle, 800 + Math.random() * 1800);
    }
    setTimeout(crackle, 500);

    return { nodes: [src, lp, gain], output: gain };
}

function createWaves(ctx) {
    const src = makeNoise(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    src.connect(lp); lp.connect(gain);
    src.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.2;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    lfo.start();

    return { nodes: [src, lp, gain, lfo, lfoGain], output: gain };
}

const CREATORS = {
    rain: createRain,
    cafe: createCafe,
    keyboard: createKeyboard,
    campfire: createCampfire,
    waves: createWaves
};

function play(type) {
    const ctx = ensureCtx();
    if (!ctx) return false;
    if (!SOUND_TYPES[type]) return false;
    if (activeNodes.has(type)) return true;
    const created = CREATORS[type](ctx);
    created.output.connect(masterGain);
    activeNodes.set(type, created);
    updatePanel();
    return true;
}

function stop(type) {
    const item = activeNodes.get(type);
    if (!item) return;
    try {
        item.nodes.forEach(n => {
            try { if (n.stop) n.stop(); } catch (e) {}
            try { if (n.disconnect) n.disconnect(); } catch (e) {}
        });
    } catch (e) {}
    activeNodes.delete(type);
    updatePanel();
}

function stopAll() {
    Array.from(activeNodes.keys()).forEach(stop);
}

function mix(types) {
    if (!Array.isArray(types)) return;
    Object.keys(SOUND_TYPES).forEach(t => {
        if (types.indexOf(t) >= 0) play(t);
        else stop(t);
    });
}

function setVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    if (masterGain) {
        try {
            masterGain.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.05);
        } catch (e) {
            masterGain.gain.value = masterVolume;
        }
    }
    updatePanel();
}

function getActive() {
    return Array.from(activeNodes.keys());
}

function injectStyles() {
    if (document.getElementById('mxos-ambient-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-ambient-styles';
    style.textContent = `
#mxosAmbientPanel {
    position: fixed; z-index: 3300;
    bottom: 60px; right: 24px;
    width: 280px;
    background: rgba(24,28,38,0.82);
    backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
    -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.5);
    color: #e5e7eb; font-family: inherit;
    overflow: hidden;
    transform: translateY(12px) scale(0.96); opacity: 0;
    pointer-events: none;
    transition: transform 220ms var(--ease-out, ease), opacity 200ms ease;
}
#mxosAmbientPanel.show { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
.am-header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.am-header-icon { color: var(--accent-color, #60a5fa); display: flex; }
.am-header-icon svg { width: 18px; height: 18px; }
.am-title { flex: 1; font-size: 13px; font-weight: 600; color: #fff; }
.am-close { width: 24px; height: 24px; background: transparent; border: none; color: #9ca3af; cursor: pointer; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.am-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
.am-close svg { width: 14px; height: 14px; }
.am-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.am-sound {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 8px;
    background: rgba(255,255,255,0.04); cursor: pointer;
    border: 1px solid transparent;
    transition: background 120ms ease, border-color 120ms ease;
}
.am-sound:hover { background: rgba(255,255,255,0.08); }
.am-sound.active {
    background: rgba(96,165,250,0.18);
    border-color: rgba(96,165,250,0.4);
}
.am-sound-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; opacity: 0.5; }
.am-sound.active .am-sound-dot { opacity: 1; box-shadow: 0 0 8px currentColor; }
.am-sound-name { flex: 1; font-size: 13px; color: #e5e7eb; }
.am-sound.active .am-sound-name { color: #fff; }
.am-volume-wrap { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.08); }
.am-volume-label { font-size: 11px; color: #9ca3af; margin-bottom: 6px; }
.am-volume-row { display: flex; align-items: center; gap: 8px; }
.am-volume-row input[type=range] { flex: 1; accent-color: var(--accent-color, #60a5fa); }
.am-volume-val { font-size: 11px; color: #cbd5e1; min-width: 32px; text-align: right; }
body.reduce-motion #mxosAmbientPanel { transition-duration: 0.01ms !important; }
    `;
    document.head.appendChild(style);
}

function buildPanel() {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'mxosAmbientPanel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', '声音景观');
    panelEl.innerHTML = `
        <div class="am-header">
            <span class="am-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
            <span class="am-title">声音景观</span>
            <button class="am-close" aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="am-body"></div>
        <div class="am-volume-wrap">
            <div class="am-volume-label">主音量</div>
            <div class="am-volume-row">
                <input type="range" min="0" max="100" value="50" class="am-volume-input" aria-label="音量">
                <span class="am-volume-val">50%</span>
            </div>
        </div>
    `;
    document.body.appendChild(panelEl);

    panelEl.querySelector('.am-close').addEventListener('click', () => panelEl.classList.remove('show'));
    panelEl.querySelector('.am-volume-input').addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10) / 100;
        setVolume(v);
        panelEl.querySelector('.am-volume-val').textContent = e.target.value + '%';
    });

    let dragOff = null;
    const header = panelEl.querySelector('.am-header');
    header.style.cursor = 'move';
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.am-close')) return;
        const rect = panelEl.getBoundingClientRect();
        dragOff = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragOff) return;
        const x = Math.max(0, Math.min(window.innerWidth - panelEl.offsetWidth, e.clientX - dragOff.x));
        const y = Math.max(0, Math.min(window.innerHeight - panelEl.offsetHeight, e.clientY - dragOff.y));
        panelEl.style.left = x + 'px';
        panelEl.style.top = y + 'px';
        panelEl.style.bottom = 'auto';
        panelEl.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { dragOff = null; });
}

function updatePanel() {
    if (!panelEl) return;
    const body = panelEl.querySelector('.am-body');
    body.innerHTML = '';
    Object.keys(SOUND_TYPES).forEach(type => {
        const cfg = SOUND_TYPES[type];
        const isActive = activeNodes.has(type);
        const row = document.createElement('div');
        row.className = 'am-sound' + (isActive ? ' active' : '');
        row.innerHTML = `
            <div class="am-sound-dot" style="background:${cfg.color};color:${cfg.color}"></div>
            <div class="am-sound-name">${cfg.name}</div>
        `;
        row.addEventListener('click', () => {
            if (isActive) stop(type);
            else play(type);
        });
        body.appendChild(row);
    });
    const volInput = panelEl.querySelector('.am-volume-input');
    if (volInput) {
        volInput.value = Math.round(masterVolume * 100);
        panelEl.querySelector('.am-volume-val').textContent = volInput.value + '%';
    }
}

function showPanel() {
    if (!panelEl) buildPanel();
    updatePanel();
    panelEl.classList.add('show');
}

function hidePanel() {
    if (panelEl) panelEl.classList.remove('show');
}

function togglePanel() {
    if (!panelEl) buildPanel();
    panelEl.classList.toggle('show');
    if (panelEl.classList.contains('show')) updatePanel();
}

function syncWithFocus(active) {
    if (active) {
        if (getActive().length > 0) {
            masterVolume = 0.3;
            if (masterGain) masterGain.gain.setTargetAtTime(0.3, audioCtx.currentTime, 0.1);
        }
    } else {
        if (masterGain && audioCtx) {
            masterGain.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.1);
        }
    }
}

function init() {
    injectStyles();
    window.MXOS.Ambient = {
        play, stop, mix, setVolume,
        stopAll, getActive, show: showPanel, hide: hidePanel,
        toggle: togglePanel, syncWithFocus
    };

    window.addEventListener('focus-mode:change', (e) => {
        syncWithFocus(e.detail.active);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { play, stop, mix, setVolume };
