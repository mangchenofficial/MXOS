import { registerAppRenderer } from '../core.js';

window.MXOS = window.MXOS || {};
window.MXOS.Apps = window.MXOS.Apps || {};

const MAX_HISTORY = 20;

const PALETTE = [
    '#000000', '#1f2937', '#6b7280', '#d1d5db', '#ffffff',
    '#ef4444', '#f97316', '#fbbf24', '#84cc16', '#22c55e',
    '#10b981', '#06b6d4', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899'
];

const SVG_ICONS = {
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    brush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/></svg>',
    marker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M18 2l4 4-10 10H8v-4L18 2z"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16a2 2 0 0 1 0-2.83l9.17-9.17a2 2 0 0 1 2.83 0L21 10a2 2 0 0 1 0 2.83L13 20"/><line x1="18" y1="13" x2="9" y2="4"/></svg>',
    fill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11h2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8v2"/><path d="M9 11l3 3L22 4"/></svg>',
    line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>',
    rect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
    circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
};

const BRUSH_PRESETS = {
    pencil: { size: 2, alpha: 1, label: '铅笔' },
    brush: { size: 8, alpha: 1, label: '毛笔' },
    marker: { size: 14, alpha: 0.55, label: '马克笔' }
};

function showToast(msg, type = 'info') {
    if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast(msg, type);
}

function createLayerCanvas(width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
}

function snapshotLayers(layers) {
    return layers.map(l => {
        const tmp = document.createElement('canvas');
        tmp.width = l.canvas.width;
        tmp.height = l.canvas.height;
        tmp.getContext('2d').drawImage(l.canvas, 0, 0);
        return { canvas: tmp, visible: l.visible, name: l.name };
    });
}

function restoreSnapshot(layers, snapshot) {
    snapshot.forEach((s, i) => {
        const ctx = layers[i].canvas.getContext('2d');
        ctx.clearRect(0, 0, layers[i].canvas.width, layers[i].canvas.height);
        ctx.drawImage(s.canvas, 0, 0);
        layers[i].visible = s.visible;
    });
}

registerAppRenderer('drawing-app', (contentEl) => {
    let canvasWidth = 800;
    let canvasHeight = 600;
    let tool = 'pencil';
    let brushSize = BRUSH_PRESETS.pencil.size;
    let brushAlpha = BRUSH_PRESETS.pencil.alpha;
    let color = '#3b82f6';
    let activeLayer = 1;
    let history = [];
    let historyIndex = -1;
    let drawing = false;
    let startPt = null;
    let lastPt = null;
    let textInput = null;
    let filters = { invert: false, grayscale: false, blur: 0, brightness: 100 };

    const layers = [
        { name: '背景', canvas: createLayerCanvas(canvasWidth, canvasHeight), visible: true },
        { name: '中间', canvas: createLayerCanvas(canvasWidth, canvasHeight), visible: true },
        { name: '前景', canvas: createLayerCanvas(canvasWidth, canvasHeight), visible: true }
    ];

    const root = document.createElement('div');
    root.className = 'drawing-app';
    root.innerHTML = `
        <style>
            .drawing-app{display:flex;flex-direction:column;height:100%;background:#0a0a0b;color:#e5e7eb;font-family:"MiSans","Microsoft YaHei",sans-serif;overflow:hidden}
            .da-toolbar{display:flex;align-items:center;gap:4px;padding:8px 12px;background:rgba(15,18,25,0.7);border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);flex-shrink:0;flex-wrap:wrap}
            .da-tool{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid transparent;border-radius:6px;background:transparent;color:#cbd5e1;cursor:pointer;transition:background .15s ease,transform .08s ease}
            .da-tool:hover{background:rgba(255,255,255,0.08)}
            .da-tool:active{transform:scale(.92)}
            .da-tool.active{background:var(--accent-color,#3b82f6);color:#fff;border-color:transparent}
            .da-tool svg{width:18px;height:18px}
            .da-sep{width:1px;height:22px;background:rgba(255,255,255,0.1);margin:0 4px}
            .da-size{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#9ca3af}
            .da-size input[type=range]{width:90px;accent-color:var(--accent-color,#3b82f6)}
            .da-filter-btn{padding:4px 8px;font-size:11px;border-radius:5px;background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;border:1px solid transparent}
            .da-filter-btn:hover{background:rgba(255,255,255,0.12)}
            .da-filter-btn.active{background:var(--accent-color,#3b82f6);color:#fff}
            .da-body{flex:1;display:flex;min-height:0;overflow:hidden}
            .da-canvas-wrap{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:16px;background:repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%,transparent 0% 50%) 50% / 20px 20px}
            .da-stage{position:relative;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:2px;line-height:0}
            .da-stage canvas{position:absolute;left:0;top:0;width:100%;height:100%}
            .da-stage canvas.da-hit{position:relative;cursor:crosshair;touch-action:none}
            .da-side{width:220px;background:rgba(15,18,25,0.6);border-left:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0}
            .da-section{padding:12px;border-bottom:1px solid rgba(255,255,255,0.06)}
            .da-section h4{margin:0 0 8px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px}
            .da-palette{display:grid;grid-template-columns:repeat(8,1fr);gap:4px}
            .da-swatch{aspect-ratio:1;border-radius:4px;cursor:pointer;border:2px solid transparent;transition:transform .1s ease}
            .da-swatch:hover{transform:scale(1.12)}
            .da-swatch.active{border-color:#fff;box-shadow:0 0 0 2px var(--accent-color,#3b82f6)}
            .da-color-row{display:flex;align-items:center;gap:6px;margin-top:8px}
            .da-color-row input[type=color]{width:36px;height:28px;border:1px solid rgba(255,255,255,0.15);border-radius:5px;background:transparent;cursor:pointer;padding:0}
            .da-color-row span{font-size:11px;color:#9ca3af;font-family:Consolas,monospace}
            .da-layer{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.04);margin-bottom:4px;cursor:pointer;border:1px solid transparent}
            .da-layer:hover{background:rgba(255,255,255,0.08)}
            .da-layer.active{border-color:var(--accent-color,#3b82f6);background:rgba(59,130,246,0.15)}
            .da-layer-name{flex:1;font-size:12px;color:#e5e7eb}
            .da-layer canvas{width:32px;height:24px;border:1px solid rgba(255,255,255,0.15);border-radius:2px;background:#fff}
            .da-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:4px;color:#9ca3af;cursor:pointer;background:transparent;border:none}
            .da-icon-btn:hover{background:rgba(255,255,255,0.1);color:#fff}
            .da-icon-btn svg{width:14px;height:14px}
            .da-filter-row{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:11px;color:#cbd5e1}
            .da-filter-row input[type=range]{flex:1;accent-color:var(--accent-color,#3b82f6)}
            .da-text-input{position:absolute;background:rgba(255,255,255,0.95);color:#000;border:2px solid var(--accent-color,#3b82f6);border-radius:3px;padding:2px 4px;font-size:14px;outline:none;min-width:80px}
            @media (prefers-reduced-motion: reduce){
                .da-tool,.da-swatch{transition:none}
            }
        </style>
        <div class="da-toolbar">
            <div class="da-tool active" data-tool="pencil" title="铅笔">${SVG_ICONS.pencil}</div>
            <div class="da-tool" data-tool="brush" title="毛笔">${SVG_ICONS.brush}</div>
            <div class="da-tool" data-tool="marker" title="马克笔">${SVG_ICONS.marker}</div>
            <div class="da-tool" data-tool="eraser" title="橡皮">${SVG_ICONS.eraser}</div>
            <div class="da-tool" data-tool="fill" title="填充">${SVG_ICONS.fill}</div>
            <div class="da-sep"></div>
            <div class="da-tool" data-tool="line" title="直线">${SVG_ICONS.line}</div>
            <div class="da-tool" data-tool="rect" title="矩形">${SVG_ICONS.rect}</div>
            <div class="da-tool" data-tool="circle" title="圆形">${SVG_ICONS.circle}</div>
            <div class="da-tool" data-tool="text" title="文字">${SVG_ICONS.text}</div>
            <div class="da-sep"></div>
            <div class="da-size"><span>粗细</span><input type="range" id="daSize" min="1" max="60" value="${brushSize}"><span id="daSizeVal">${brushSize}</span></div>
            <div class="da-sep"></div>
            <div class="da-tool" id="daUndo" title="撤销">${SVG_ICONS.undo}</div>
            <div class="da-tool" id="daRedo" title="重做">${SVG_ICONS.redo}</div>
            <div class="da-tool" id="daClear" title="清空当前图层">${SVG_ICONS.trash}</div>
            <div class="da-sep"></div>
            <div class="da-tool" id="daSave" title="保存到 VFS">${SVG_ICONS.save}</div>
            <div class="da-tool" id="daExport" title="导出 PNG">${SVG_ICONS.download}</div>
        </div>
        <div class="da-body">
            <div class="da-canvas-wrap" id="daCanvasWrap">
                <div class="da-stage" id="daStage"></div>
            </div>
            <div class="da-side">
                <div class="da-section">
                    <h4>颜色</h4>
                    <div class="da-palette" id="daPalette"></div>
                    <div class="da-color-row">
                        <input type="color" id="daColorPicker" value="${color}">
                        <span id="daColorHex">${color.toUpperCase()}</span>
                    </div>
                </div>
                <div class="da-section">
                    <h4>图层</h4>
                    <div id="daLayers"></div>
                </div>
                <div class="da-section">
                    <h4>滤镜（输出时应用）</h4>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
                        <div class="da-filter-btn" id="daInvert">反色</div>
                        <div class="da-filter-btn" id="daGray">灰度</div>
                    </div>
                    <div class="da-filter-row"><span>模糊</span><input type="range" id="daBlur" min="0" max="10" step="0.5" value="0"><span id="daBlurVal">0</span></div>
                    <div class="da-filter-row"><span>亮度</span><input type="range" id="daBright" min="20" max="200" value="100"><span id="daBrightVal">100%</span></div>
                </div>
            </div>
        </div>
    `;
    contentEl.appendChild(root);

    const stage = root.querySelector('#daStage');
    const palette = root.querySelector('#daPalette');
    const layersEl = root.querySelector('#daLayers');
    const colorPicker = root.querySelector('#daColorPicker');
    const colorHex = root.querySelector('#daColorHex');
    const sizeRange = root.querySelector('#daSize');
    const sizeVal = root.querySelector('#daSizeVal');
    const blurRange = root.querySelector('#daBlur');
    const blurVal = root.querySelector('#daBlurVal');
    const brightRange = root.querySelector('#daBright');
    const brightVal = root.querySelector('#daBrightVal');

    const displayCanvases = [];
    const hitCanvas = document.createElement('canvas');
    hitCanvas.className = 'da-hit';
    hitCanvas.width = canvasWidth;
    hitCanvas.height = canvasHeight;
    let stageScale = 1;

    function buildStage() {
        stage.innerHTML = '';
        stage.style.width = canvasWidth + 'px';
        stage.style.height = canvasHeight + 'px';
        displayCanvases.length = 0;
        layers.forEach((l, i) => {
            const c = document.createElement('canvas');
            c.width = canvasWidth;
            c.height = canvasHeight;
            c.style.pointerEvents = 'none';
            stage.appendChild(c);
            displayCanvases.push(c);
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            if (l.visible) ctx.drawImage(l.canvas, 0, 0);
        });
        stage.appendChild(hitCanvas);
        fitStage();
    }

    function fitStage() {
        const wrap = root.querySelector('#daCanvasWrap');
        const availW = wrap.clientWidth - 32;
        const availH = wrap.clientHeight - 32;
        const sx = availW / canvasWidth;
        const sy = availH / canvasHeight;
        stageScale = Math.min(1, sx, sy);
        if (stageScale < 0.1) stageScale = 0.1;
        stage.style.transform = `scale(${stageScale})`;
        stage.style.transformOrigin = 'center center';
    }

    function composite() {
        layers.forEach((l, i) => {
            const ctx = displayCanvases[i].getContext('2d');
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            if (l.visible) ctx.drawImage(l.canvas, 0, 0);
        });
    }

    function renderPalette() {
        palette.innerHTML = '';
        PALETTE.forEach(c => {
            const sw = document.createElement('div');
            sw.className = 'da-swatch' + (c.toLowerCase() === color.toLowerCase() ? ' active' : '');
            sw.style.background = c;
            sw.dataset.color = c;
            sw.addEventListener('click', () => setColor(c));
            palette.appendChild(sw);
        });
    }

    function renderLayers() {
        layersEl.innerHTML = '';
        for (let i = layers.length - 1; i >= 0; i--) {
            const l = layers[i];
            const row = document.createElement('div');
            row.className = 'da-layer' + (i === activeLayer ? ' active' : '');
            const thumb = document.createElement('canvas');
            thumb.width = 32;
            thumb.height = 24;
            thumb.getContext('2d').drawImage(l.canvas, 0, 0, 32, 24);
            row.appendChild(thumb);
            const name = document.createElement('div');
            name.className = 'da-layer-name';
            name.textContent = l.name;
            row.appendChild(name);
            const visBtn = document.createElement('button');
            visBtn.className = 'da-icon-btn';
            visBtn.title = l.visible ? '隐藏' : '显示';
            visBtn.innerHTML = l.visible ? SVG_ICONS.eye : SVG_ICONS.eyeOff;
            visBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                l.visible = !l.visible;
                composite();
                renderLayers();
            });
            row.appendChild(visBtn);
            const upBtn = document.createElement('button');
            upBtn.className = 'da-icon-btn';
            upBtn.title = '上移';
            upBtn.innerHTML = SVG_ICONS.up;
            upBtn.disabled = (i === layers.length - 1);
            if (upBtn.disabled) upBtn.style.opacity = '0.3';
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (i < layers.length - 1) {
                    [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]];
                    if (activeLayer === i) activeLayer = i + 1;
                    else if (activeLayer === i + 1) activeLayer = i;
                    buildStage();
                    renderLayers();
                    pushHistory();
                }
            });
            row.appendChild(upBtn);
            const downBtn = document.createElement('button');
            downBtn.className = 'da-icon-btn';
            downBtn.title = '下移';
            downBtn.innerHTML = SVG_ICONS.down;
            downBtn.disabled = (i === 0);
            if (downBtn.disabled) downBtn.style.opacity = '0.3';
            downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (i > 0) {
                    [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]];
                    if (activeLayer === i) activeLayer = i - 1;
                    else if (activeLayer === i - 1) activeLayer = i;
                    buildStage();
                    renderLayers();
                    pushHistory();
                }
            });
            row.appendChild(downBtn);
            row.addEventListener('click', () => {
                activeLayer = i;
                renderLayers();
            });
            layersEl.appendChild(row);
        }
    }

    function setColor(c) {
        color = c;
        colorPicker.value = c;
        colorHex.textContent = c.toUpperCase();
        renderPalette();
    }

    function setTool(t) {
        tool = t;
        root.querySelectorAll('.da-tool[data-tool]').forEach(el => {
            el.classList.toggle('active', el.dataset.tool === t);
        });
        if (BRUSH_PRESETS[t]) {
            brushSize = BRUSH_PRESETS[t].size;
            brushAlpha = BRUSH_PRESETS[t].alpha;
            sizeRange.value = brushSize;
            sizeVal.textContent = brushSize;
        }
        if (t === 'text') {
            hitCanvas.style.cursor = 'text';
        } else if (t === 'fill') {
            hitCanvas.style.cursor = 'crosshair';
        } else {
            hitCanvas.style.cursor = 'crosshair';
        }
    }

    function getPos(e) {
        const rect = hitCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * canvasWidth;
        const y = (e.clientY - rect.top) / rect.height * canvasHeight;
        return { x: Math.round(x), y: Math.round(y) };
    }

    function strokeSegment(from, to) {
        const ctx = layers[activeLayer].canvas.getContext('2d');
        ctx.save();
        ctx.globalAlpha = brushAlpha;
        ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
        composite();
    }

    function drawShape(from, to, preview = false) {
        if (preview) {
            composite();
        } else {
            const lctx = layers[activeLayer].canvas.getContext('2d');
            lctx.save();
            lctx.strokeStyle = color;
            lctx.fillStyle = color;
            lctx.lineWidth = brushSize;
            lctx.lineCap = 'round';
            lctx.lineJoin = 'round';
            drawShapeOnCtx(lctx, from, to);
            lctx.restore();
        }
        if (preview) {
            const pctx = displayCanvases[activeLayer].getContext('2d');
            pctx.save();
            pctx.strokeStyle = color;
            pctx.fillStyle = color;
            pctx.lineWidth = brushSize;
            pctx.lineCap = 'round';
            pctx.lineJoin = 'round';
            drawShapeOnCtx(pctx, from, to);
            pctx.restore();
        } else {
            composite();
        }
    }

    function drawShapeOnCtx(ctx, from, to) {
        ctx.beginPath();
        if (tool === 'line') {
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        } else if (tool === 'rect') {
            const x = Math.min(from.x, to.x);
            const y = Math.min(from.y, to.y);
            const w = Math.abs(to.x - from.x);
            const h = Math.abs(to.y - from.y);
            ctx.strokeRect(x, y, w, h);
        } else if (tool === 'circle') {
            const cx = (from.x + to.x) / 2;
            const cy = (from.y + to.y) / 2;
            const rx = Math.max(1, Math.abs(to.x - from.x) / 2);
            const ry = Math.max(1, Math.abs(to.y - from.y) / 2);
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function hexToRgb(hex) {
        const m = hex.replace('#', '');
        const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
        return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
    }

    function floodFill(startX, startY) {
        const layer = layers[activeLayer];
        const ctx = layer.canvas.getContext('2d');
        const img = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = img.data;
        const idx = (startY * canvasWidth + startX) * 4;
        const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
        const fill = hexToRgb(color);
        if (target[0] === fill.r && target[1] === fill.g && target[2] === fill.b && target[3] === 255) return;
        const stack = [[startX, startY]];
        const visited = new Uint8Array(canvasWidth * canvasHeight);
        while (stack.length) {
            const [x, y] = stack.pop();
            if (x < 0 || y < 0 || x >= canvasWidth || y >= canvasHeight) continue;
            const p = y * canvasWidth + x;
            if (visited[p]) continue;
            const i = p * 4;
            if (data[i] !== target[0] || data[i + 1] !== target[1] || data[i + 2] !== target[2] || data[i + 3] !== target[3]) continue;
            visited[p] = 1;
            data[i] = fill.r;
            data[i + 1] = fill.g;
            data[i + 2] = fill.b;
            data[i + 3] = 255;
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        ctx.putImageData(img, 0, 0);
        composite();
    }

    function placeText(x, y) {
        if (textInput) {
            commitText();
            return;
        }
        const rect = hitCanvas.getBoundingClientRect();
        const screenX = (x / canvasWidth) * rect.width + rect.left - stage.getBoundingClientRect().left;
        const screenY = (y / canvasHeight) * rect.height + rect.top - stage.getBoundingClientRect().top;
        textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'da-text-input';
        textInput.placeholder = '输入文字，回车确认';
        textInput.style.left = (screenX / stageScale) + 'px';
        textInput.style.top = (screenY / stageScale - 14) + 'px';
        textInput.style.color = color;
        textInput.style.fontFamily = '"MiSans",sans-serif';
        stage.appendChild(textInput);
        setTimeout(() => textInput.focus(), 10);
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            else if (e.key === 'Escape') { textInput.remove(); textInput = null; }
        });
        textInput.addEventListener('blur', () => { if (textInput) commitText(); });
    }

    function commitText() {
        if (!textInput) return;
        const txt = textInput.value;
        const leftPx = parseFloat(textInput.style.left);
        const topPx = parseFloat(textInput.style.top);
        const x = leftPx;
        const y = topPx + 14;
        textInput.remove();
        textInput = null;
        if (!txt) return;
        const ctx = layers[activeLayer].canvas.getContext('2d');
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = '18px "MiSans",sans-serif';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(txt, x, y);
        ctx.restore();
        composite();
        pushHistory();
    }

    function pushHistory() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(snapshotLayers(layers));
        if (history.length > MAX_HISTORY) history.shift();
        historyIndex = history.length - 1;
    }

    function undo() {
        if (historyIndex <= 0) { showToast('已经是最早状态', 'info'); return; }
        historyIndex--;
        restoreSnapshot(layers, history[historyIndex]);
        composite();
        renderLayers();
    }

    function redo() {
        if (historyIndex >= history.length - 1) { showToast('已经是最新状态', 'info'); return; }
        historyIndex++;
        restoreSnapshot(layers, history[historyIndex]);
        composite();
        renderLayers();
    }

    function clearActiveLayer() {
        const ctx = layers[activeLayer].canvas.getContext('2d');
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        composite();
        renderLayers();
        pushHistory();
        showToast('已清空当前图层', 'info');
    }

    function buildOutputCanvas() {
        const out = document.createElement('canvas');
        out.width = canvasWidth;
        out.height = canvasHeight;
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        layers.forEach(l => { if (l.visible) ctx.drawImage(l.canvas, 0, 0); });
        const filterParts = [];
        if (filters.invert) filterParts.push('invert(1)');
        if (filters.grayscale) filterParts.push('grayscale(1)');
        if (filters.blur > 0) filterParts.push(`blur(${filters.blur}px)`);
        if (filters.brightness !== 100) filterParts.push(`brightness(${filters.brightness}%)`);
        if (filterParts.length) {
            const tmp = document.createElement('canvas');
            tmp.width = canvasWidth;
            tmp.height = canvasHeight;
            const tctx = tmp.getContext('2d');
            tctx.filter = filterParts.join(' ');
            tctx.drawImage(out, 0, 0);
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            ctx.drawImage(tmp, 0, 0);
        }
        return out;
    }

    async function saveToVfs() {
        try {
            const out = buildOutputCanvas();
            const dataUrl = out.toDataURL('image/png');
            const path = '/Pictures/Drawing-' + Date.now() + '.png';
            if (window.MXOS?.fs?.writeFile) {
                await window.MXOS.fs.writeFile(path, dataUrl);
                showToast('已保存到 ' + path, 'success');
            } else {
                showToast('文件系统不可用，使用下载方式', 'warning');
                downloadCanvas(out, 'Drawing-' + Date.now() + '.png');
            }
        } catch (e) {
            showToast('保存失败：' + e.message, 'error');
        }
    }

    function downloadCanvas(canvas, filename) {
        canvas.toBlob((blob) => {
            if (!blob) { showToast('导出失败', 'error'); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    }

    function exportPng() {
        const out = buildOutputCanvas();
        downloadCanvas(out, 'Drawing-' + Date.now() + '.png');
        showToast('已导出 PNG', 'success');
    }

    root.querySelectorAll('.da-tool[data-tool]').forEach(el => {
        el.addEventListener('click', () => setTool(el.dataset.tool));
    });

    sizeRange.addEventListener('input', () => {
        brushSize = parseInt(sizeRange.value);
        sizeVal.textContent = brushSize;
    });

    colorPicker.addEventListener('input', () => setColor(colorPicker.value));

    root.querySelector('#daUndo').addEventListener('click', undo);
    root.querySelector('#daRedo').addEventListener('click', redo);
    root.querySelector('#daClear').addEventListener('click', clearActiveLayer);
    root.querySelector('#daSave').addEventListener('click', saveToVfs);
    root.querySelector('#daExport').addEventListener('click', exportPng);

    root.querySelector('#daInvert').addEventListener('click', (e) => {
        filters.invert = !filters.invert;
        e.currentTarget.classList.toggle('active', filters.invert);
    });
    root.querySelector('#daGray').addEventListener('click', (e) => {
        filters.grayscale = !filters.grayscale;
        e.currentTarget.classList.toggle('active', filters.grayscale);
    });
    blurRange.addEventListener('input', () => {
        filters.blur = parseFloat(blurRange.value);
        blurVal.textContent = filters.blur;
    });
    brightRange.addEventListener('input', () => {
        filters.brightness = parseInt(brightRange.value);
        brightVal.textContent = filters.brightness + '%';
    });

    hitCanvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hitCanvas.setPointerCapture(e.pointerId);
        const p = getPos(e);
        if (tool === 'text') { placeText(p.x, p.y); return; }
        if (tool === 'fill') {
            pushHistory();
            floodFill(p.x, p.y);
            pushHistory();
            return;
        }
        drawing = true;
        startPt = p;
        lastPt = p;
        if (tool === 'pencil' || tool === 'brush' || tool === 'marker' || tool === 'eraser') {
            strokeSegment(p, p);
        }
    });

    hitCanvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = getPos(e);
        if (tool === 'pencil' || tool === 'brush' || tool === 'marker' || tool === 'eraser') {
            strokeSegment(lastPt, p);
            lastPt = p;
        } else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
            drawShape(startPt, p, true);
        }
    });

    function endStroke(e) {
        if (!drawing) return;
        drawing = false;
        if (tool === 'line' || tool === 'rect' || tool === 'circle') {
            const p = getPos(e);
            drawShape(startPt, p, false);
        }
        startPt = null;
        lastPt = null;
        pushHistory();
    }
    hitCanvas.addEventListener('pointerup', endStroke);
    hitCanvas.addEventListener('pointercancel', endStroke);
    hitCanvas.addEventListener('pointerleave', (e) => { if (drawing) endStroke(e); });

    function onResize() { fitStage(); }
    contentEl.addEventListener('windowResize', onResize);
    contentEl.addEventListener('windowResizeEnd', onResize);

    buildStage();
    renderPalette();
    renderLayers();
    pushHistory();
    setTimeout(fitStage, 50);

    window.MXOS.Apps.DrawingApp = {
        undo, redo, clearActiveLayer,
        exportPng, saveToVfs,
        setColor, setTool,
        getLayers: () => layers.map(l => ({ name: l.name, visible: l.visible }))
    };
});

window.MXOS.Apps.DrawingApp = window.MXOS.Apps.DrawingApp || {};

console.log('[MXOS.Apps.DrawingApp] 画板应用已加载');
