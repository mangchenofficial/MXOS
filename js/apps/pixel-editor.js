import { registerAppRenderer } from '../core.js';

window.MXOS = window.MXOS || {};
window.MXOS.Apps = window.MXOS.Apps || {};

const MAX_HISTORY = 30;

const EGA_PALETTE = [
    '#000000', '#ffffff', '#ff0000', '#00ff00',
    '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#808080', '#c0c0c0', '#800000', '#008000',
    '#000080', '#808000', '#800080', '#008080'
];

const SVG_ICONS = {
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16a2 2 0 0 1 0-2.83l9.17-9.17a2 2 0 0 1 2.83 0L21 10a2 2 0 0 1 0 2.83L13 20"/><line x1="18" y1="13" x2="9" y2="4"/></svg>',
    fill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11h2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8v2"/><path d="M9 11l3 3L22 4"/></svg>',
    picker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22l3-1 12-12-2-2L3 19l-1 3z"/><path d="M14 7l3 3"/><path d="M17 4l3 3-3 3-3-3z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
};

function showToast(msg, type = 'info') {
    if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast(msg, type);
}

function hexToRgb(hex) {
    const m = hex.replace('#', '');
    const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
    return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
}

registerAppRenderer('pixel-editor', (contentEl) => {
    let gridSize = 16;
    let pixelSize = 20;
    let tool = 'pencil';
    let color = '#ff0000';
    let showGrid = true;
    let pixels = [];
    let history = [];
    let historyIndex = -1;
    let drawing = false;
    let lastDrawnIdx = -1;
    let hoverIdx = -1;

    function initPixels() {
        pixels = new Array(gridSize * gridSize).fill(null);
    }
    initPixels();

    const root = document.createElement('div');
    root.className = 'pixel-app';
    root.innerHTML = `
        <style>
            .pixel-app{display:flex;flex-direction:column;height:100%;background:#0a0a0b;color:#e5e7eb;font-family:"MiSans","Microsoft YaHei",sans-serif;overflow:hidden}
            .pa-toolbar{display:flex;align-items:center;gap:4px;padding:8px 12px;background:rgba(15,18,25,0.7);border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);flex-shrink:0;flex-wrap:wrap}
            .pa-tool{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid transparent;border-radius:6px;background:transparent;color:#cbd5e1;cursor:pointer;transition:background .15s ease,transform .08s ease}
            .pa-tool:hover{background:rgba(255,255,255,0.08)}
            .pa-tool:active{transform:scale(.92)}
            .pa-tool.active{background:var(--accent-color,#3b82f6);color:#fff}
            .pa-tool svg{width:18px;height:18px}
            .pa-sep{width:1px;height:22px;background:rgba(255,255,255,0.1);margin:0 4px}
            .pa-size-select{padding:4px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:#e5e7eb;font-size:12px;cursor:pointer}
            .pa-size-select option{background:#1f2937;color:#e5e7eb}
            .pa-body{flex:1;display:flex;min-height:0;overflow:hidden}
            .pa-left{width:52px;background:rgba(15,18,25,0.6);border-right:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:4px;flex-shrink:0}
            .pa-center{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:16px;background:repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%,transparent 0% 50%) 50% / 20px 20px}
            .pa-canvas-wrap{position:relative;background:#1a1a1c;border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5)}
            .pa-canvas{display:block;cursor:crosshair;touch-action:none;image-rendering:pixelated;image-rendering:crisp-edges}
            .pa-right{width:220px;background:rgba(15,18,25,0.6);border-left:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0}
            .pa-section{padding:12px;border-bottom:1px solid rgba(255,255,255,0.06)}
            .pa-section h4{margin:0 0 8px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px}
            .pa-palette{display:grid;grid-template-columns:repeat(8,1fr);gap:4px}
            .pa-swatch{aspect-ratio:1;border-radius:4px;cursor:pointer;border:2px solid transparent;transition:transform .1s ease}
            .pa-swatch:hover{transform:scale(1.12)}
            .pa-swatch.active{border-color:#fff;box-shadow:0 0 0 2px var(--accent-color,#3b82f6)}
            .pa-color-row{display:flex;align-items:center;gap:6px;margin-top:8px}
            .pa-color-row input[type=color]{width:36px;height:28px;border:1px solid rgba(255,255,255,0.15);border-radius:5px;background:transparent;cursor:pointer;padding:0}
            .pa-color-row span{font-size:11px;color:#9ca3af;font-family:Consolas,monospace}
            .pa-preview{display:flex;gap:12px;align-items:flex-start}
            .pa-preview-box{display:flex;flex-direction:column;align-items:center;gap:4px}
            .pa-preview-box span{font-size:10px;color:#9ca3af}
            .pa-preview canvas{background:#1a1a1c;border:1px solid rgba(255,255,255,0.15);border-radius:3px;image-rendering:pixelated;image-rendering:crisp-edges}
            .pa-info{font-size:11px;color:#9ca3af;line-height:1.7}
            @media (prefers-reduced-motion: reduce){
                .pa-tool,.pa-swatch{transition:none}
            }
        </style>
        <div class="pa-toolbar">
            <div class="pa-tool active" data-tool="pencil" title="铅笔">${SVG_ICONS.pencil}</div>
            <div class="pa-tool" data-tool="eraser" title="橡皮">${SVG_ICONS.eraser}</div>
            <div class="pa-tool" data-tool="fill" title="填充">${SVG_ICONS.fill}</div>
            <div class="pa-tool" data-tool="picker" title="吸管">${SVG_ICONS.picker}</div>
            <div class="pa-sep"></div>
            <div class="pa-tool" id="paUndo" title="撤销">${SVG_ICONS.undo}</div>
            <div class="pa-tool" id="paRedo" title="重做">${SVG_ICONS.redo}</div>
            <div class="pa-tool" id="paClear" title="清空">${SVG_ICONS.trash}</div>
            <div class="pa-tool" id="paGrid" title="切换网格">${SVG_ICONS.grid}</div>
            <div class="pa-sep"></div>
            <select class="pa-size-select" id="paSize">
                <option value="8">8 × 8</option>
                <option value="16" selected>16 × 16</option>
                <option value="32">32 × 32</option>
                <option value="64">64 × 64</option>
            </select>
            <div class="pa-sep"></div>
            <div class="pa-tool" id="paExport" title="导出 PNG">${SVG_ICONS.download}</div>
        </div>
        <div class="pa-body">
            <div class="pa-left">
                <div class="pa-tool active" data-tool="pencil" title="铅笔">${SVG_ICONS.pencil}</div>
                <div class="pa-tool" data-tool="eraser" title="橡皮">${SVG_ICONS.eraser}</div>
                <div class="pa-tool" data-tool="fill" title="填充">${SVG_ICONS.fill}</div>
                <div class="pa-tool" data-tool="picker" title="吸管">${SVG_ICONS.picker}</div>
            </div>
            <div class="pa-center">
                <div class="pa-canvas-wrap">
                    <canvas class="pa-canvas" id="paCanvas"></canvas>
                </div>
            </div>
            <div class="pa-right">
                <div class="pa-section">
                    <h4>颜色</h4>
                    <div class="pa-palette" id="paPalette"></div>
                    <div class="pa-color-row">
                        <input type="color" id="paColorPicker" value="${color}">
                        <span id="paColorHex">${color.toUpperCase()}</span>
                    </div>
                </div>
                <div class="pa-section">
                    <h4>预览</h4>
                    <div class="pa-preview">
                        <div class="pa-preview-box">
                            <canvas id="paPreview1" width="64" height="64"></canvas>
                            <span>1×</span>
                        </div>
                        <div class="pa-preview-box">
                            <canvas id="paPreview4" width="128" height="128"></canvas>
                            <span>4×</span>
                        </div>
                    </div>
                </div>
                <div class="pa-section">
                    <h4>信息</h4>
                    <div class="pa-info" id="paInfo"></div>
                </div>
            </div>
        </div>
    `;
    contentEl.appendChild(root);

    const canvas = root.querySelector('#paCanvas');
    const ctx = canvas.getContext('2d');
    const palette = root.querySelector('#paPalette');
    const colorPicker = root.querySelector('#paColorPicker');
    const colorHex = root.querySelector('#paColorHex');
    const sizeSelect = root.querySelector('#paSize');
    const preview1 = root.querySelector('#paPreview1');
    const preview4 = root.querySelector('#paPreview4');
    const infoEl = root.querySelector('#paInfo');

    function computePixelSize() {
        const wrap = root.querySelector('.pa-center');
        const avail = Math.min(wrap.clientWidth - 40, wrap.clientHeight - 40);
        pixelSize = Math.max(4, Math.floor(avail / gridSize));
    }

    function resizeCanvas() {
        computePixelSize();
        canvas.width = gridSize * pixelSize;
        canvas.height = gridSize * pixelSize;
        render();
    }

    function render() {
        ctx.fillStyle = '#1a1a1c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const checker = pixelSize / 2;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if ((x + y) % 2 === 0) {
                    ctx.fillStyle = '#25252a';
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }
        for (let i = 0; i < pixels.length; i++) {
            if (pixels[i]) {
                const x = i % gridSize;
                const y = Math.floor(i / gridSize);
                ctx.fillStyle = pixels[i];
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
        if (showGrid && pixelSize >= 6) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i <= gridSize; i++) {
                ctx.moveTo(i * pixelSize + 0.5, 0);
                ctx.lineTo(i * pixelSize + 0.5, canvas.height);
                ctx.moveTo(0, i * pixelSize + 0.5);
                ctx.lineTo(canvas.width, i * pixelSize + 0.5);
            }
            ctx.stroke();
        }
        if (hoverIdx >= 0 && hoverIdx < pixels.length) {
            const x = hoverIdx % gridSize;
            const y = Math.floor(hoverIdx / gridSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * pixelSize + 1, y * pixelSize + 1, pixelSize - 2, pixelSize - 2);
        }
        renderPreviews();
        renderInfo();
    }

    function renderPreviews() {
        const drawTo = (c, scale) => {
            const cx = c.getContext('2d');
            cx.fillStyle = '#1a1a1c';
            cx.fillRect(0, 0, c.width, c.height);
            const ps = c.width / gridSize;
            for (let i = 0; i < pixels.length; i++) {
                if (pixels[i]) {
                    const x = i % gridSize;
                    const y = Math.floor(i / gridSize);
                    cx.fillStyle = pixels[i];
                    cx.fillRect(x * ps, y * ps, ps, ps);
                }
            }
        };
        drawTo(preview1, 1);
        drawTo(preview4, 4);
    }

    function renderInfo() {
        const used = pixels.filter(p => p).length;
        const total = pixels.length;
        infoEl.innerHTML = '尺寸: ' + gridSize + ' × ' + gridSize + '<br>已绘像素: ' + used + ' / ' + total + '<br>当前工具: ' + toolName(tool) + '<br>当前颜色: <span style="display:inline-block;width:10px;height:10px;background:' + color + ';border:1px solid #fff;border-radius:2px;vertical-align:middle"></span> ' + color.toUpperCase();
    }

    function toolName(t) {
        return { pencil: '铅笔', eraser: '橡皮', fill: '填充', picker: '吸管' }[t] || t;
    }

    function renderPalette() {
        palette.innerHTML = '';
        EGA_PALETTE.forEach(c => {
            const sw = document.createElement('div');
            sw.className = 'pa-swatch' + (c.toLowerCase() === color.toLowerCase() ? ' active' : '');
            sw.style.background = c;
            sw.title = c;
            sw.addEventListener('click', () => setColor(c));
            palette.appendChild(sw);
        });
    }

    function setColor(c) {
        color = c;
        colorPicker.value = c;
        colorHex.textContent = c.toUpperCase();
        renderPalette();
        renderInfo();
    }

    function setTool(t) {
        tool = t;
        root.querySelectorAll('.pa-tool[data-tool]').forEach(el => {
            el.classList.toggle('active', el.dataset.tool === t);
        });
        if (t === 'picker') canvas.style.cursor = 'cell';
        else if (t === 'fill') canvas.style.cursor = 'crosshair';
        else canvas.style.cursor = 'crosshair';
        renderInfo();
    }

    function getPixelIdx(e) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / rect.width * gridSize);
        const y = Math.floor((e.clientY - rect.top) / rect.height * gridSize);
        if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return -1;
        return y * gridSize + x;
    }

    function applyTool(idx) {
        if (idx < 0 || idx === lastDrawnIdx) return;
        lastDrawnIdx = idx;
        if (tool === 'pencil') {
            pixels[idx] = color;
        } else if (tool === 'eraser') {
            pixels[idx] = null;
        } else if (tool === 'fill') {
            floodFill(idx);
        } else if (tool === 'picker') {
            if (pixels[idx]) setColor(pixels[idx]);
        }
        render();
    }

    function floodFill(startIdx) {
        const target = pixels[startIdx];
        if (target === color) return;
        const stack = [startIdx];
        const visited = new Uint8Array(gridSize * gridSize);
        while (stack.length) {
            const idx = stack.pop();
            if (idx < 0 || idx >= pixels.length) continue;
            if (visited[idx]) continue;
            if (pixels[idx] !== target) continue;
            visited[idx] = 1;
            pixels[idx] = color;
            const x = idx % gridSize;
            const y = Math.floor(idx / gridSize);
            if (x > 0) stack.push(idx - 1);
            if (x < gridSize - 1) stack.push(idx + 1);
            if (y > 0) stack.push(idx - gridSize);
            if (y < gridSize - 1) stack.push(idx + gridSize);
        }
    }

    function snapshot() {
        return pixels.slice();
    }

    function pushHistory() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(snapshot());
        if (history.length > MAX_HISTORY) history.shift();
        historyIndex = history.length - 1;
    }

    function restoreSnapshot(snap) {
        pixels = snap.slice();
        render();
    }

    function undo() {
        if (historyIndex <= 0) { showToast('已经是最早状态', 'info'); return; }
        historyIndex--;
        restoreSnapshot(history[historyIndex]);
    }

    function redo() {
        if (historyIndex >= history.length - 1) { showToast('已经是最新状态', 'info'); return; }
        historyIndex++;
        restoreSnapshot(history[historyIndex]);
    }

    function clearAll() {
        pixels.fill(null);
        render();
        pushHistory();
        showToast('已清空画布', 'info');
    }

    function changeSize(newSize) {
        gridSize = newSize;
        initPixels();
        history = [];
        historyIndex = -1;
        pushHistory();
        resizeCanvas();
    }

    function exportPng() {
        const out = document.createElement('canvas');
        const scale = 16;
        out.width = gridSize * scale;
        out.height = gridSize * scale;
        const octx = out.getContext('2d');
        octx.fillStyle = '#1a1a1c';
        octx.fillRect(0, 0, out.width, out.height);
        for (let i = 0; i < pixels.length; i++) {
            if (pixels[i]) {
                const x = i % gridSize;
                const y = Math.floor(i / gridSize);
                octx.fillStyle = pixels[i];
                octx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
        out.toBlob((blob) => {
            if (!blob) { showToast('导出失败', 'error'); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Pixel-' + gridSize + 'x' + gridSize + '-' + Date.now() + '.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('已导出 PNG', 'success');
        }, 'image/png');
    }

    root.querySelectorAll('.pa-tool[data-tool]').forEach(el => {
        el.addEventListener('click', () => setTool(el.dataset.tool));
    });

    colorPicker.addEventListener('input', () => setColor(colorPicker.value));

    sizeSelect.addEventListener('change', () => {
        changeSize(parseInt(sizeSelect.value));
    });

    root.querySelector('#paUndo').addEventListener('click', undo);
    root.querySelector('#paRedo').addEventListener('click', redo);
    root.querySelector('#paClear').addEventListener('click', clearAll);
    root.querySelector('#paGrid').addEventListener('click', () => {
        showGrid = !showGrid;
        render();
    });
    root.querySelector('#paExport').addEventListener('click', exportPng);

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const idx = getPixelIdx(e);
        if (idx < 0) return;
        if (tool !== 'picker' && tool !== 'fill') {
            pushHistory();
        }
        drawing = true;
        lastDrawnIdx = -1;
        applyTool(idx);
        if (tool === 'fill' || tool === 'picker') {
            drawing = false;
            if (tool === 'fill') pushHistory();
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        const idx = getPixelIdx(e);
        if (idx !== hoverIdx) {
            hoverIdx = idx;
            render();
        }
        if (!drawing) return;
        if (idx >= 0) applyTool(idx);
    });

    function endDraw() {
        if (drawing) {
            drawing = false;
            lastDrawnIdx = -1;
        }
    }
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);
    canvas.addEventListener('pointerleave', () => {
        if (hoverIdx !== -1) { hoverIdx = -1; render(); }
    });

    function onResize() { resizeCanvas(); }
    contentEl.addEventListener('windowResize', onResize);
    contentEl.addEventListener('windowResizeEnd', onResize);

    renderPalette();
    resizeCanvas();
    pushHistory();

    window.MXOS.Apps.PixelEditor = {
        undo, redo, clearAll, exportPng,
        setColor, setTool,
        changeSize,
        getPixels: () => pixels.slice(),
        getGridSize: () => gridSize
    };
});

window.MXOS.Apps.PixelEditor = window.MXOS.Apps.PixelEditor || {};

console.log('[MXOS.Apps.PixelEditor] 像素画编辑器已加载');
