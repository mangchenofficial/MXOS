window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_gestures_enabled';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const GESTURE_MAP = {
    C: 'calculator',
    T: 'terminal',
    N: 'stickynotes',
    B: 'browser'
};

let enabled = false;
let canvas = null;
let ctx = null;
let drawing = false;
let points = [];
let rafId = null;
let trailFade = 1;
let hintEl = null;

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-gestures-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-gestures-styles';
    style.textContent = `
#mxosGestureCanvas {
    position: fixed; inset: 0;
    z-index: 9990;
    pointer-events: none;
    display: none;
}
body.gestures-active #mxosGestureCanvas { display: block; }
#mxosGestureHint {
    position: fixed;
    bottom: 80px; left: 50%;
    transform: translateX(-50%);
    background: var(--glass-bg, rgba(20,20,22,0.7));
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
    color: var(--text-color, #fff);
    padding: 8px 14px;
    border-radius: var(--radius-md, 10px);
    font-size: 14px;
    z-index: 9991;
    pointer-events: none;
    display: none;
    box-shadow: var(--shadow, 0 6px 18px rgba(0,0,0,0.4));
}
#mxosGestureHint.show { display: block; }
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosGestureCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    hintEl = document.createElement('div');
    hintEl.id = 'mxosGestureHint';
    document.body.appendChild(hintEl);
    resize();
    window.addEventListener('resize', resize);
}

function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function onMouseDown(e) {
    if (!enabled) return;
    if (e.button !== 2) return;
    drawing = true;
    points = [{ x: e.clientX, y: e.clientY }];
    trailFade = 1;
    document.body.classList.add('gestures-active');
    showHint('正在识别手势...');
    if (!rafId) rafId = requestAnimationFrame(draw);
}

function onMouseMove(e) {
    if (!drawing) return;
    points.push({ x: e.clientX, y: e.clientY });
    if (points.length > 250) points.shift();
}

function onMouseUp(e) {
    if (!drawing) return;
    if (e.button !== 2) return;
    drawing = false;
    const letter = recognize(points);
    hideHint();
    if (letter) {
        const app = GESTURE_MAP[letter];
        if (app) {
            if (window.MXOS?.notify) {
                window.MXOS.notify({ title: '手势识别', body: `识别到字母 ${letter}，打开 ${appLabel(app)}`, type: 'info' });
            }
            if (window.openApp) window.openApp(app);
            else if (window.MXOS?.openApp) window.MXOS.openApp(app);
        }
    }
    setTimeout(() => {
        document.body.classList.remove('gestures-active');
        points = [];
    }, 600);
}

function appLabel(id) {
    const m = { calculator: '计算器', terminal: '终端', stickynotes: '便签', browser: '浏览器' };
    return m[id] || id;
}

function recognize(pts) {
    if (pts.length < 8) return null;
    const bb = boundingBox(pts);
    if (bb.w < 25 || bb.h < 25) return null;
    const norm = normalize(pts, bb);
    let bestLetter = null;
    let bestScore = 0.55;
    for (const letter of Object.keys(TEMPLATES)) {
        const tpl = TEMPLATES[letter];
        const score = scoreMatch(norm, tpl);
        if (score > bestScore) { bestScore = score; bestLetter = letter; }
    }
    return bestLetter;
}

function boundingBox(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function normalize(pts, bb) {
    const size = Math.max(bb.w, bb.h) || 1;
    return pts.map(p => ({
        x: (p.x - bb.minX) / size,
        y: (p.y - bb.minY) / size
    }));
}

function scoreMatch(pts, tpl) {
    const n = tpl.length;
    const step = pts.length / n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
        const idx = Math.floor(i * step);
        const p = pts[Math.min(idx, pts.length - 1)];
        const t = tpl[i];
        sum += 1 - Math.min(1, Math.hypot(p.x - t[0], p.y - t[1]));
    }
    return sum / n;
}

const TEMPLATES = {
    C: [[0.8,0.2],[0.4,0.1],[0.15,0.35],[0.15,0.65],[0.4,0.9],[0.8,0.8]],
    T: [[0.2,0.2],[0.8,0.2],[0.5,0.2],[0.5,0.8]],
    N: [[0.2,0.85],[0.2,0.2],[0.8,0.8],[0.8,0.2]],
    B: [[0.25,0.2],[0.25,0.8],[0.25,0.5],[0.75,0.4],[0.75,0.6],[0.25,0.5],[0.75,0.55],[0.75,0.75],[0.25,0.8]]
};

function draw() {
    if (!drawing && trailFade <= 0 && points.length === 0) {
        rafId = null;
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }
    rafId = requestAnimationFrame(draw);
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (points.length < 2) return;
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * trailFade})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.6 * trailFade})`;
    ctx.beginPath();
    ctx.arc(points[points.length - 1].x, points[points.length - 1].y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (!drawing) {
        trailFade -= 0.05;
    }
}

function showHint(text) {
    if (!hintEl) return;
    hintEl.textContent = text;
    hintEl.classList.add('show');
}
function hideHint() {
    if (!hintEl) return;
    hintEl.classList.remove('show');
}

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
    if (enabled) buildCanvas();
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}
function isEnabled() { return enabled; }

function onContextMenu(e) {
    if (!enabled) return;
    e.preventDefault();
}

function init() {
    try {
        injectStyles();
        if (loadEnabled()) {
            enabled = true;
            buildCanvas();
        }
        document.addEventListener('mousedown', onMouseDown, { passive: false });
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('mouseup', onMouseUp, { passive: true });
        document.addEventListener('contextmenu', (e) => {
            if (!enabled) return;
            if (e.target.closest && e.target.closest('.window, .taskbar, #startMenu, #quickSettingsPanel, .notification-center, #contextMenu, .desktop-icon, .start-app')) return;
            e.preventDefault();
        }, true);
        window.MXOS.Features.gestures = { setEnabled, isEnabled, recognize };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, isEnabled };
