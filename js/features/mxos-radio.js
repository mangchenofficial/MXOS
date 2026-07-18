window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STYLES = {
    piano: {
        name: '钢琴',
        waves: ['sine', 'triangle'],
        scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33],
        tempo: 600,
        harmonize: 0.6
    },
    lofi: {
        name: 'Lofi',
        waves: ['sine', 'triangle'],
        scale: [220, 261.63, 293.66, 329.63, 392.00, 440.00],
        tempo: 900,
        harmonize: 0.4
    },
    ambient: {
        name: '环境',
        waves: ['sine'],
        scale: [110, 146.83, 164.81, 220, 277.18],
        tempo: 1500,
        harmonize: 0.8
    },
    chiptune: {
        name: '芯片',
        waves: ['square', 'sawtooth'],
        scale: [261.63, 329.63, 392.00, 523.25, 659.25, 783.99],
        tempo: 350,
        harmonize: 0.3
    }
};

function styleByHour(h) {
    if (h >= 5 && h < 11) return 'piano';
    if (h >= 11 && h < 17) return 'lofi';
    if (h >= 17 && h < 21) return 'ambient';
    return 'chiptune';
}

let audioCtx = null;
let masterGain = null;
let volume = 0.4;
let currentStyle = 'lofi';
let isPlaying = false;
let noteTimer = null;
let trayEl = null;
let panelEl = null;
let trackNumber = 1;
let listeners = new Set();

function injectStyles() {
    if (document.getElementById('mxos-radio-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-radio-styles';
    style.textContent = `
.mxos-radio-tray {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0 8px;
    height: 28px;
    color: var(--text-primary, #e5e7eb);
    cursor: pointer;
    border-radius: 6px;
    transition: background 150ms ease;
    font-size: 12px;
}
.mxos-radio-tray:hover { background: rgba(255,255,255,0.08); }
.mxos-radio-tray svg { width: 16px; height: 16px; color: var(--accent-color, #60a5fa); }
.mxos-radio-tray.playing .mxos-radio-icon { animation: radioPulse 1.5s ease-in-out infinite; }
@keyframes radioPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
#mxosRadioPanel {
    position: fixed;
    bottom: 56px;
    right: 12px;
    z-index: 3500;
    width: 300px;
    background: rgba(20,22,28,0.78);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.5);
    color: #e5e7eb;
    overflow: hidden;
    transform: translateY(12px) scale(0.96);
    opacity: 0;
    pointer-events: none;
    transition: transform 220ms var(--ease-out, ease), opacity 200ms ease;
}
#mxosRadioPanel.show { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
.mxos-rp-head { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.mxos-rp-title { font-size: 13px; color: #9ca3af; }
.mxos-rp-track { font-size: 18px; color: #fff; font-weight: 600; margin-top: 4px; }
.mxos-rp-style { font-size: 12px; color: var(--accent-color, #60a5fa); margin-top: 4px; }
.mxos-rp-controls { display: flex; gap: 6px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.mxos-rp-btn {
    flex: 1;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    color: #e5e7eb;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 150ms ease;
}
.mxos-rp-btn:hover { background: rgba(255,255,255,0.12); }
.mxos-rp-btn.primary { background: rgba(96,165,250,0.2); border-color: rgba(96,165,250,0.4); color: #fff; }
.mxos-rp-btn svg { width: 16px; height: 16px; }
.mxos-rp-styles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.mxos-rp-style-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    color: #cbd5e1;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 150ms ease;
}
.mxos-rp-style-btn:hover { background: rgba(255,255,255,0.1); }
.mxos-rp-style-btn.active { background: rgba(96,165,250,0.2); border-color: rgba(96,165,250,0.5); color: #fff; }
.mxos-rp-volume { padding: 12px 16px; }
.mxos-rp-volume-row { display: flex; align-items: center; gap: 8px; }
.mxos-rp-volume-row input[type=range] { flex: 1; accent-color: var(--accent-color, #60a5fa); }
.mxos-rp-volume-val { font-size: 11px; color: #9ca3af; min-width: 32px; text-align: right; }
body.reduce-motion #mxosRadioPanel,
body.reduce-motion .mxos-radio-tray.playing .mxos-radio-icon { transition: none !important; animation: none !important; }
    `;
    document.head.appendChild(style);
}

function ensureCtx() {
    if (!audioCtx) {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = volume;
            masterGain.connect(audioCtx.destination);
        } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
}

function playNote(freq, duration, when) {
    if (!audioCtx) return;
    const style = STYLES[currentStyle];
    const wave = style.waves[Math.floor(Math.random() * style.waves.length)];
    const osc = audioCtx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const env = audioCtx.createGain();
    env.gain.value = 0;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    osc.connect(env);
    env.connect(filter);
    filter.connect(masterGain);
    const t = when + 0.02;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(0.3, t);
    env.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.start(when);
    osc.stop(when + duration + 0.05);

    if (Math.random() < style.harmonize) {
        const osc2 = audioCtx.createOscillator();
        osc2.type = wave;
        osc2.frequency.value = freq * 1.5;
        const env2 = audioCtx.createGain();
        env2.gain.value = 0;
        osc2.connect(env2);
        env2.connect(masterGain);
        env2.gain.setValueAtTime(0, when);
        env2.gain.linearRampToValueAtTime(0.1, t);
        env2.gain.exponentialRampToValueAtTime(0.001, when + duration * 0.8);
        osc2.start(when);
        osc2.stop(when + duration + 0.05);
    }
}

function scheduleNotes() {
    if (!isPlaying || !audioCtx) return;
    const style = STYLES[currentStyle];
    const now = audioCtx.currentTime;
    const beat = style.tempo / 1000;
    const scale = style.scale;
    const noteCount = currentStyle === 'ambient' ? 1 : 2;
    for (let i = 0; i < noteCount; i++) {
        const freq = scale[Math.floor(Math.random() * scale.length)];
        const off = i * beat * 0.5;
        playNote(freq, beat * 1.8, now + off);
    }
    if (currentStyle === 'chiptune' && Math.random() < 0.5) {
        const bass = style.scale[0] / 2;
        playNote(bass, beat * 2, now);
    }
    noteTimer = setTimeout(scheduleNotes, style.tempo);
}

function buildTray() {
    if (trayEl) return;
    const trayRight = document.querySelector('.taskbar-right');
    if (!trayRight) return;
    trayEl = document.createElement('div');
    trayEl.className = 'mxos-radio-tray';
    trayEl.setAttribute('role', 'button');
    trayEl.setAttribute('tabindex', '0');
    trayEl.setAttribute('aria-label', 'MXOS Radio');
    trayEl.innerHTML = `<span class="mxos-radio-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a9 9 0 0 1 0 13"/></svg></span><span class="mxos-radio-name">Radio</span>`;
    trayEl.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
    });
    trayRight.insertBefore(trayEl, trayRight.firstChild);
}

function updateTray() {
    if (!trayEl) return;
    trayEl.classList.toggle('playing', isPlaying);
    const nameEl = trayEl.querySelector('.mxos-radio-name');
    if (nameEl) nameEl.textContent = isPlaying ? STYLES[currentStyle].name : 'Radio';
}

function buildPanel() {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'mxosRadioPanel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', 'MXOS Radio 控制面板');
    refreshPanel();
    document.body.appendChild(panelEl);
    document.addEventListener('click', (e) => {
        if (!panelEl.classList.contains('show')) return;
        if (e.target.closest('#mxosRadioPanel')) return;
        if (e.target.closest('.mxos-radio-tray')) return;
        panelEl.classList.remove('show');
    });
}

function refreshPanel() {
    if (!panelEl) return;
    const styleCfg = STYLES[currentStyle];
    const playIcon = isPlaying
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    panelEl.innerHTML = `
        <div class="mxos-rp-head">
            <div class="mxos-rp-title">正在播放</div>
            <div class="mxos-rp-track">曲目 ${String(trackNumber).padStart(2, '0')} · ${styleCfg.name}</div>
            <div class="mxos-rp-style">${styleCfg.name} · 自动时段编排</div>
        </div>
        <div class="mxos-rp-controls">
            <button class="mxos-rp-btn" data-act="prev" aria-label="上一首"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 4L8 12l10 8V4zM6 4h2v16H6z"/></svg></button>
            <button class="mxos-rp-btn primary" data-act="play" aria-label="播放/暂停">${playIcon}</button>
            <button class="mxos-rp-btn" data-act="next" aria-label="下一首"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l10 8-10 8V4zM16 4h2v16h-2z"/></svg></button>
        </div>
        <div class="mxos-rp-styles">
            ${Object.keys(STYLES).map(k => `<button class="mxos-rp-style-btn ${k === currentStyle ? 'active' : ''}" data-style="${k}">${STYLES[k].name}</button>`).join('')}
        </div>
        <div class="mxos-rp-volume">
            <div class="mxos-rp-volume-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 10v4h4l5 4V6L8 10H4z"/></svg>
                <input type="range" min="0" max="100" value="${Math.round(volume * 100)}" aria-label="音量">
                <span class="mxos-rp-volume-val">${Math.round(volume * 100)}%</span>
            </div>
        </div>
    `;
    panelEl.querySelectorAll('.mxos-rp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            if (act === 'play') togglePlay();
            else if (act === 'next') next();
            else if (act === 'prev') prev();
        });
    });
    panelEl.querySelectorAll('.mxos-rp-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setStyle(btn.dataset.style);
        });
    });
    const range = panelEl.querySelector('input[type=range]');
    if (range) {
        range.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10) / 100;
            setVolume(v);
            panelEl.querySelector('.mxos-rp-volume-val').textContent = e.target.value + '%';
        });
    }
}

function togglePanel() {
    if (!panelEl) buildPanel();
    panelEl.classList.toggle('show');
    if (panelEl.classList.contains('show')) refreshPanel();
}

function play() {
    if (isPlaying) return;
    if (!ensureCtx()) return;
    isPlaying = true;
    scheduleNotes();
    updateTray();
    if (panelEl && panelEl.classList.contains('show')) refreshPanel();
    emitChange();
}

function pause() {
    if (!isPlaying) return;
    isPlaying = false;
    if (noteTimer) { clearTimeout(noteTimer); noteTimer = null; }
    updateTray();
    if (panelEl && panelEl.classList.contains('show')) refreshPanel();
    emitChange();
}

function togglePlay() {
    if (isPlaying) pause();
    else play();
}

function next() {
    trackNumber += 1;
    const h = new Date().getHours();
    setStyle(styleByHour(h));
    if (panelEl && panelEl.classList.contains('show')) refreshPanel();
    emitChange();
}

function prev() {
    trackNumber = Math.max(1, trackNumber - 1);
    if (panelEl && panelEl.classList.contains('show')) refreshPanel();
    emitChange();
}

function setStyle(s) {
    if (!STYLES[s]) return;
    currentStyle = s;
    if (panelEl && panelEl.classList.contains('show')) refreshPanel();
    updateTray();
    emitChange();
}

function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain && audioCtx) {
        try { masterGain.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.05); }
        catch (e) { masterGain.gain.value = volume; }
    }
}

function getNowPlaying() {
    return {
        playing: isPlaying,
        style: currentStyle,
        styleName: STYLES[currentStyle].name,
        track: trackNumber,
        volume
    };
}

function emitChange() {
    const np = getNowPlaying();
    listeners.forEach(fn => { try { fn(np); } catch (e) {} });
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:radio-change', np);
    }
}

function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function autoSwitchByTime() {
    const h = new Date().getHours();
    const target = styleByHour(h);
    if (target !== currentStyle) {
        setStyle(target);
    }
}

let autoTimer = null;

function waitForTaskbar(callback) {
    const tray = document.querySelector('.taskbar-right');
    if (tray) { callback(); return; }
    const observer = new MutationObserver(() => {
        if (document.querySelector('.taskbar-right')) {
            observer.disconnect();
            callback();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
}

function init() {
    injectStyles();
    currentStyle = styleByHour(new Date().getHours());
    waitForTaskbar(() => { buildTray(); updateTray(); });
    window.MXOS.Features.radio = {
        play, pause, togglePlay, next, prev,
        setStyle, setVolume, getNowPlaying, onChange,
        styles: Object.keys(STYLES)
    };
    autoTimer = setInterval(autoSwitchByTime, 10 * 60 * 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { play, pause, togglePlay, next, prev, setStyle, setVolume, getNowPlaying };
