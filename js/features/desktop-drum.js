window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const PATTERNS = {
    rock: [
        [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
        [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0]
    ],
    hiphop: [
        [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
        [1,0,1,0, 0,0,1,0, 1,0,1,0, 0,0,1,0],
        [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0]
    ],
    electronic: [
        [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
        [1,0,0,1, 0,1,0,0, 1,0,0,1, 0,1,0,0],
        [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
    ]
};

const TRACK_LABELS = ['底鼓', '军鼓', '踩镲', '开镲'];
const PATTERN_LABELS = { rock: '摇滚', hiphop: '嘻哈', electronic: '电子' };

let panel = null;
let audioCtx = null;
let pattern = [
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
];
let playing = false;
let step = 0;
let timer = null;
let bpm = 120;
let cells = [];
let visible = false;

function injectStyles() {
    if (document.getElementById('mxos-drum-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-drum-styles';
    style.textContent = `
#mxosDrumPanel {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 580px; max-width: 94vw;
    background: var(--glass-bg, rgba(20,20,22,0.85));
    backdrop-filter: blur(28px) saturate(1.4);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
    border-radius: var(--radius-lg, 16px);
    box-shadow: var(--shadow, 0 20px 60px rgba(0,0,0,0.5));
    color: var(--text-color, #fff);
    z-index: 9990;
    padding: 22px;
    display: none;
}
#mxosDrumPanel.show { display: block; animation: mxosDrumIn 0.3s var(--ease-out, ease); }
@keyframes mxosDrumIn {
    from { opacity: 0; transform: translate(-50%, -48%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
}
.mxos-drum-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 14px;
}
.mxos-drum-title { font-size: 16px; font-weight: 600; }
.mxos-drum-grid {
    display: grid;
    grid-template-columns: 80px repeat(16, 1fr);
    gap: 3px;
    margin-bottom: 12px;
}
.mxos-drum-label {
    font-size: 11px; color: var(--text-secondary); align-self: center;
}
.mxos-drum-cell {
    height: 22px;
    background: rgba(255,255,255,0.05);
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.08s ease;
}
.mxos-drum-cell.on { background: var(--accent, #a78bfa); }
.mxos-drum-cell.current { border-color: #fff; }
.mxos-drum-controls { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.mxos-drum-btn {
    background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border);
    color: var(--text-color); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;
}
.mxos-drum-btn:hover { background: rgba(255,255,255,0.14); }
.mxos-drum-select {
    background: rgba(0,0,0,0.3); color: var(--text-color);
    border: 1px solid var(--glass-border); padding: 4px 8px; border-radius: 6px;
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

function playKick() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.2);
}
function playSnare() {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start(now);
}
function playHat(open = false) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * (open ? 0.3 : 0.05), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (open ? 0.3 : 0.05));
    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start(now);
}

function playTrack(t) {
    if (t === 0) playKick();
    else if (t === 1) playSnare();
    else if (t === 2) playHat(false);
    else if (t === 3) playHat(true);
}

function buildPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'mxosDrumPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '桌面鼓机');
    panel.innerHTML = `
        <div class="mxos-drum-header">
            <div class="mxos-drum-title">桌面鼓机</div>
            <button class="mxos-drum-btn" id="mxosDrumClose">关闭</button>
        </div>
        <div class="mxos-drum-grid" id="mxosDrumGrid"></div>
        <div class="mxos-drum-controls">
            <button class="mxos-drum-btn" id="mxosDrumPlay">播放</button>
            <button class="mxos-drum-btn" id="mxosDrumClear">清空</button>
            <span>节奏：</span>
            <select class="mxos-drum-select" id="mxosDrumPattern">
                ${Object.keys(PATTERNS).map(k => `<option value="${k}">${PATTERN_LABELS[k]}</option>`).join('')}
            </select>
            <span>BPM：</span>
            <input type="range" min="60" max="180" value="120" id="mxosDrumBpm" style="width:100px">
            <span id="mxosDrumBpmLabel">120</span>
        </div>
    `;
    document.body.appendChild(panel);
    const grid = panel.querySelector('#mxosDrumGrid');
    cells = [];
    for (let t = 0; t < 4; t++) {
        const label = document.createElement('div');
        label.className = 'mxos-drum-label';
        label.textContent = TRACK_LABELS[t];
        grid.appendChild(label);
        const row = [];
        for (let s = 0; s < 16; s++) {
            const cell = document.createElement('div');
            cell.className = 'mxos-drum-cell';
            cell.dataset.track = t;
            cell.dataset.step = s;
            cell.addEventListener('click', () => {
                pattern[t][s] = pattern[t][s] ? 0 : 1;
                cell.classList.toggle('on', !!pattern[t][s]);
                if (pattern[t][s]) playTrack(t);
            });
            grid.appendChild(cell);
            row.push(cell);
        }
        cells.push(row);
    }
    panel.querySelector('#mxosDrumClose').addEventListener('click', hide);
    panel.querySelector('#mxosDrumPlay').addEventListener('click', togglePlay);
    panel.querySelector('#mxosDrumClear').addEventListener('click', clearPattern);
    panel.querySelector('#mxosDrumPattern').addEventListener('change', (e) => loadPattern(e.target.value));
    const bpmInput = panel.querySelector('#mxosDrumBpm');
    bpmInput.addEventListener('input', (e) => {
        bpm = Number(e.target.value);
        panel.querySelector('#mxosDrumBpmLabel').textContent = bpm;
        if (playing) { stopPlay(); startPlay(); }
    });
}

function loadPattern(name) {
    const p = PATTERNS[name];
    if (!p) return;
    pattern = p.map(r => [...r]);
    renderPattern();
}

function renderPattern() {
    if (!panel) return;
    for (let t = 0; t < 4; t++) {
        for (let s = 0; s < 16; s++) {
            cells[t][s].classList.toggle('on', !!pattern[t][s]);
        }
    }
}

function clearPattern() {
    pattern = pattern.map(r => r.map(() => 0));
    renderPattern();
}

function tick() {
    if (!playing) return;
    for (let t = 0; t < 4; t++) {
        cells[t][step].classList.remove('current');
        if (pattern[t][step]) playTrack(t);
    }
    step = (step + 1) % 16;
    for (let t = 0; t < 4; t++) cells[t][step].classList.add('current');
}

function startPlay() {
    if (playing) return;
    playing = true;
    step = 0;
    const interval = 60000 / bpm / 4;
    tick();
    timer = setInterval(tick, interval);
    panel.querySelector('#mxosDrumPlay').textContent = '停止';
}
function stopPlay() {
    if (!playing) return;
    playing = false;
    if (timer) clearInterval(timer);
    timer = null;
    if (panel) {
        for (let t = 0; t < 4; t++) for (let s = 0; s < 16; s++) cells[t][s].classList.remove('current');
        panel.querySelector('#mxosDrumPlay').textContent = '播放';
    }
}
function togglePlay() {
    if (playing) stopPlay(); else startPlay();
}

function show() {
    buildPanel();
    panel.classList.add('show');
    visible = true;
    ensureCtx();
}
function hide() {
    if (panel) panel.classList.remove('show');
    visible = false;
    stopPlay();
}
function toggle() {
    if (visible) hide();
    else show();
}

function init() {
    injectStyles();
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
            e.preventDefault();
            if (panel && panel.classList.contains('show')) hide(); else show();
        }
    });
    window.MXOS.Features.drum = { show, hide, toggle, togglePlay, loadPattern };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { show, hide, toggle };
