window.MXOS = window.MXOS || {};

const STORAGE_KEY = 'mxos_doodle_overlay';

let canvasEl = null;
let ctx = null;
let toolbarEl = null;
let isActive = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentTool = 'pen';
let currentColor = '#ef4444';
let currentSize = 4;

function injectStyles() {
    if (document.getElementById('mxos-doodle-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-doodle-styles';
    style.textContent = `
#mxosDoodleCanvas {
    position: fixed; inset: 0;
    z-index: 1050;
    pointer-events: none;
    display: none;
}
#mxosDoodleCanvas.active {
    display: block;
    pointer-events: auto;
    cursor: crosshair;
}
#mxosDoodleToolbar {
    position: fixed;
    top: 60px; left: 50%; transform: translateX(-50%) translateY(-12px);
    z-index: 1060;
    background: rgba(24,28,38,0.85);
    backdrop-filter: blur(30px) saturate(180%);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.45);
    padding: 8px 10px;
    display: none;
    align-items: center;
    gap: 8px;
    color: #e5e7eb;
    font-family: inherit;
    opacity: 0;
    transition: transform 220ms var(--ease-out, ease), opacity 200ms ease;
}
#mxosDoodleToolbar.active {
    display: flex;
}
#mxosDoodleToolbar.show-active {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
.dl-tool-group {
    display: flex; gap: 4px; padding: 0 6px;
    border-right: 1px solid rgba(255,255,255,0.08);
}
.dl-tool-group:last-of-type { border-right: none; }
.dl-tool {
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05);
    border: 1px solid transparent;
    border-radius: 8px;
    color: #cbd5e1; cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
}
.dl-tool:hover { background: rgba(255,255,255,0.1); color: #fff; }
.dl-tool.active {
    background: rgba(96,165,250,0.22);
    border-color: rgba(96,165,250,0.45);
    color: #fff;
}
.dl-tool svg { width: 16px; height: 16px; }
.dl-color {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.4);
    cursor: pointer;
    transition: transform 120ms ease;
}
.dl-color:hover { transform: scale(1.15); }
.dl-color.active {
    border-color: #fff;
    box-shadow: 0 0 0 2px rgba(96,165,250,0.6);
}
.dl-size-input {
    width: 60px; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e5e7eb; padding: 4px 6px; border-radius: 6px;
    font-size: 11px; font-family: inherit;
}
.dl-btn {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: #cbd5e1; padding: 6px 10px; border-radius: 7px;
    font-size: 12px; font-family: inherit; cursor: pointer;
    display: inline-flex; align-items: center; gap: 5px;
}
.dl-btn:hover { background: rgba(96,165,250,0.22); color: #fff; }
.dl-btn svg { width: 13px; height: 13px; }
.dl-btn.danger:hover { background: rgba(239,68,68,0.25); color: #fff; }
.dl-title { font-size: 12px; color: #9ca3af; padding-right: 4px; }
body.reduce-motion #mxosDoodleToolbar { transition-duration: 0.01ms !important; }
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvasEl) return;
    canvasEl = document.createElement('canvas');
    canvasEl.id = 'mxosDoodleCanvas';
    canvasEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvasEl);
    ctx = canvasEl.getContext('2d');
    resizeCanvas();

    canvasEl.addEventListener('mousedown', onPointerDown);
    canvasEl.addEventListener('mousemove', onPointerMove);
    canvasEl.addEventListener('mouseup', onPointerUp);
    canvasEl.addEventListener('mouseleave', onPointerUp);
    canvasEl.addEventListener('touchstart', onPointerDown, { passive: false });
    canvasEl.addEventListener('touchmove', onPointerMove, { passive: false });
    canvasEl.addEventListener('touchend', onPointerUp);

    window.addEventListener('resize', () => {
        const saved = canvasEl.toDataURL();
        resizeCanvas();
        restoreFromDataUrl(saved);
    });
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);
    canvasEl.style.width = w + 'px';
    canvasEl.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function buildToolbar() {
    if (toolbarEl) return;
    toolbarEl = document.createElement('div');
    toolbarEl.id = 'mxosDoodleToolbar';
    toolbarEl.setAttribute('role', 'toolbar');
    toolbarEl.setAttribute('aria-label', '涂鸦工具栏');
    toolbarEl.innerHTML = `
        <span class="dl-title">涂鸦</span>
        <div class="dl-tool-group">
            <button class="dl-tool active" data-tool="pen" aria-label="画笔"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></button>
            <button class="dl-tool" data-tool="eraser" aria-label="橡皮"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-1-1-1-2 0-3l9-9c1-1 2-1 3 0l6 6c1 1 1 2 0 3l-7 7"/></svg></button>
        </div>
        <div class="dl-tool-group dl-colors">
            <div class="dl-color active" data-color="#ef4444" style="background:#ef4444"></div>
            <div class="dl-color" data-color="#f59e0b" style="background:#f59e0b"></div>
            <div class="dl-color" data-color="#10b981" style="background:#10b981"></div>
            <div class="dl-color" data-color="#60a5fa" style="background:#60a5fa"></div>
            <div class="dl-color" data-color="#8b5cf6" style="background:#8b5cf6"></div>
            <div class="dl-color" data-color="#ec4899" style="background:#ec4899"></div>
            <div class="dl-color" data-color="#ffffff" style="background:#ffffff"></div>
            <div class="dl-color" data-color="#000000" style="background:#000000"></div>
        </div>
        <div class="dl-tool-group">
            <input type="range" class="dl-size-input" min="1" max="40" value="4" aria-label="画笔粗细">
        </div>
        <div class="dl-tool-group">
            <button class="dl-btn dl-save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>保存</button>
            <button class="dl-btn dl-clear"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>清空</button>
            <button class="dl-btn dl-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>关闭</button>
        </div>
    `;
    document.body.appendChild(toolbarEl);

    toolbarEl.querySelectorAll('.dl-tool').forEach(btn => {
        btn.addEventListener('click', () => {
            toolbarEl.querySelectorAll('.dl-tool').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
        });
    });
    toolbarEl.querySelectorAll('.dl-color').forEach(c => {
        c.addEventListener('click', () => {
            toolbarEl.querySelectorAll('.dl-color').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            currentColor = c.dataset.color;
            currentTool = 'pen';
            toolbarEl.querySelectorAll('.dl-tool').forEach(b => b.classList.toggle('active', b.dataset.tool === 'pen'));
        });
    });
    const sizeInput = toolbarEl.querySelector('.dl-size-input');
    sizeInput.addEventListener('input', () => {
        currentSize = parseInt(sizeInput.value, 10) || 4;
    });
    toolbarEl.querySelector('.dl-save').addEventListener('click', save);
    toolbarEl.querySelector('.dl-clear').addEventListener('click', clear);
    toolbarEl.querySelector('.dl-close').addEventListener('click', stop);
}

function getPos(e) {
    if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function onPointerDown(e) {
    e.preventDefault();
    isDrawing = true;
    const p = getPos(e);
    lastX = p.x;
    lastY = p.y;
    drawSegment(p.x, p.y, p.x + 0.5, p.y + 0.5);
}

function onPointerMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getPos(e);
    drawSegment(lastX, lastY, p.x, p.y);
    lastX = p.x;
    lastY = p.y;
}

function onPointerUp() {
    isDrawing = false;
}

function drawSegment(x1, y1, x2, y2) {
    ctx.save();
    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = currentSize * 2.5;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

function restoreFromDataUrl(url) {
    if (!url || !ctx) return;
    const img = new Image();
    img.onload = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
        ctx.restore();
    };
    img.src = url;
}

function save() {
    try {
        const url = canvasEl.toDataURL('image/png');
        localStorage.setItem(STORAGE_KEY, url);
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('涂鸦已保存为壁纸覆盖层');
    } catch (e) {
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('保存失败：' + e.message);
    }
}

function clear() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.restore();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

function loadSaved() {
    try {
        const url = localStorage.getItem(STORAGE_KEY);
        if (url) restoreFromDataUrl(url);
    } catch (e) {}
}

function start() {
    if (isActive) return;
    if (!canvasEl) {
        buildCanvas();
        buildToolbar();
    }
    isActive = true;
    canvasEl.classList.add('active');
    toolbarEl.classList.add('active');
    loadSaved();
    requestAnimationFrame(() => toolbarEl.classList.add('show-active'));
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('涂鸦模式已开启');
}

function stop() {
    if (!isActive) return;
    isActive = false;
    canvasEl.classList.remove('active');
    toolbarEl.classList.remove('show-active');
    setTimeout(() => {
        if (toolbarEl) toolbarEl.classList.remove('active');
    }, 200);
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('涂鸦模式已关闭');
}

function toggle() {
    if (isActive) stop();
    else start();
}

function init() {
    injectStyles();
    window.MXOS.Doodle = { start, stop, clear, save, toggle, isActive: () => isActive };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, clear, save, toggle };
