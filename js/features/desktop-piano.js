window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const WHITE_NOTES = [
    { name: 'C4', freq: 261.63, key: 'a' },
    { name: 'D4', freq: 293.66, key: 's' },
    { name: 'E4', freq: 329.63, key: 'd' },
    { name: 'F4', freq: 349.23, key: 'f' },
    { name: 'G4', freq: 392.00, key: 'g' },
    { name: 'A4', freq: 440.00, key: 'h' },
    { name: 'B4', freq: 493.88, key: 'j' },
    { name: 'C5', freq: 523.25, key: 'k' },
    { name: 'D5', freq: 587.33, key: 'l' },
    { name: 'E5', freq: 659.25, key: ';' }
];
const BLACK_NOTES = [
    { name: 'C#4', freq: 277.18, key: 'w', pos: 0 },
    { name: 'D#4', freq: 311.13, key: 'e', pos: 1 },
    { name: 'F#4', freq: 369.99, key: 't', pos: 3 },
    { name: 'G#4', freq: 415.30, key: 'y', pos: 4 },
    { name: 'A#4', freq: 466.16, key: 'u', pos: 5 },
    { name: 'C#5', freq: 554.37, key: 'o', pos: 7 },
    { name: 'D#5', freq: 622.25, key: 'p', pos: 8 }
];

let panel = null;
let audioCtx = null;
let isOpen = false;
let keyHandler = null;

function injectStyles() {
    if (document.getElementById('mxos-piano-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-piano-styles';
    style.textContent = `
#mxosPianoPanel {
    position: fixed; bottom: 60px; left: 50%;
    transform: translateX(-50%);
    background: var(--glass-bg, rgba(20,20,22,0.85));
    backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
    border-radius: var(--radius-lg, 14px) var(--radius-lg, 14px) 0 0;
    box-shadow: var(--shadow, 0 -8px 32px rgba(0,0,0,0.4));
    color: var(--text-color, #fff);
    z-index: 9990;
    padding: 16px 18px 14px;
    display: none;
}
#mxosPianoPanel.show { display: block; animation: mxosPianoIn 0.3s var(--ease-out, ease); }
@keyframes mxosPianoIn {
    from { transform: translate(-50%, 30px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
}
.mxos-piano-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px; font-size: 13px;
}
.mxos-piano-close {
    background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border);
    color: var(--text-color); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
}
.mxos-piano-keys {
    position: relative;
    display: flex;
    user-select: none;
}
.mxos-piano-white {
    width: 38px; height: 140px;
    background: linear-gradient(180deg, #f9fafb, #d1d5db);
    border: 1px solid #6b7280;
    border-radius: 0 0 6px 6px;
    margin-right: 1px;
    cursor: pointer;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 8px;
    color: #374151;
    font-size: 10px;
    transition: background 0.08s ease;
}
.mxos-piano-white:active, .mxos-piano-white.pressed {
    background: linear-gradient(180deg, #d1d5db, #9ca3af);
}
.mxos-piano-black {
    position: absolute;
    width: 24px; height: 88px;
    background: linear-gradient(180deg, #1f2937, #050507);
    border-radius: 0 0 4px 4px;
    cursor: pointer;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 6px;
    color: #d1d5db;
    font-size: 9px;
    z-index: 2;
    transition: background 0.08s ease;
}
.mxos-piano-black:active, .mxos-piano-black.pressed {
    background: linear-gradient(180deg, #050507, #1f2937);
}
    `;
    document.head.appendChild(style);
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

function playFreq(freq, duration = 0.8) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration);
    osc2.stop(now + duration);
}

function buildPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'mxosPianoPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '桌面钢琴');
    panel.innerHTML = `
        <div class="mxos-piano-header">
            <span>桌面钢琴 · A-L 白键 / W E T Y U O P 黑键</span>
            <button class="mxos-piano-close" id="mxosPianoClose">收起</button>
        </div>
        <div class="mxos-piano-keys" id="mxosPianoKeys"></div>
    `;
    document.body.appendChild(panel);
    const keys = panel.querySelector('#mxosPianoKeys');
    WHITE_NOTES.forEach((n, i) => {
        const el = document.createElement('div');
        el.className = 'mxos-piano-white';
        el.dataset.note = n.name;
        el.dataset.freq = n.freq;
        el.dataset.key = n.key;
        el.innerHTML = `<span>${n.key.toUpperCase()}</span>`;
        el.addEventListener('pointerdown', () => { playFreq(n.freq); flash(el); });
        keys.appendChild(el);
    });
    const whiteW = 39;
    BLACK_NOTES.forEach(n => {
        const el = document.createElement('div');
        el.className = 'mxos-piano-black';
        el.dataset.note = n.name;
        el.dataset.freq = n.freq;
        el.dataset.key = n.key;
        el.style.left = (n.pos + 1) * whiteW - 12 + 'px';
        el.innerHTML = `<span>${n.key.toUpperCase()}</span>`;
        el.addEventListener('pointerdown', (e) => { e.stopPropagation(); playFreq(n.freq); flash(el); });
        keys.appendChild(el);
    });
    panel.querySelector('#mxosPianoClose').addEventListener('click', hide);
}

function flash(el) {
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 140);
}

function show() {
    buildPanel();
    panel.classList.add('show');
    isOpen = true;
    if (!keyHandler) {
        keyHandler = (e) => {
            if (!isOpen) return;
            if (e.repeat) return;
            const k = e.key.toLowerCase();
            const all = [...WHITE_NOTES, ...BLACK_NOTES];
            const n = all.find(x => x.key === k);
            if (n) {
                e.preventDefault();
                playFreq(n.freq);
                const el = panel.querySelector(`[data-key="${k}"]`);
                if (el) flash(el);
            }
            if (e.key === 'Escape') hide();
        };
        window.addEventListener('keydown', keyHandler);
    }
    ensureCtx();
}
function hide() {
    if (panel) panel.classList.remove('show');
    isOpen = false;
}

function onContextMenu(e) {
    if (e.button !== 2) return;
    if (e.target.closest && e.target.closest('.window, .taskbar, #startMenu, #quickSettingsPanel, .notification-center, #contextMenu, .desktop-icon, .start-app, .btn, button')) return;
    e.preventDefault();
    if (isOpen) hide(); else show();
}

function toggle() {
    if (isOpen) hide(); else show();
}

function init() {
    injectStyles();
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
            e.preventDefault();
            toggle();
        }
    });
    window.MXOS.Features.piano = { show, hide, toggle, playFreq };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { show, hide, toggle };
