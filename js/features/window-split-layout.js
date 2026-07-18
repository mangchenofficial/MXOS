import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const LAYOUTS = {
    'split-2': { name: '二分屏', cells: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
    'split-3': { name: '三分屏', cells: [{ x: 0, y: 0, w: 0.33, h: 1 }, { x: 0.33, y: 0, w: 0.34, h: 1 }, { x: 0.67, y: 0, w: 0.33, h: 1 }] },
    'quad-4': { name: '四分屏', cells: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
    'grid-2x2': { name: '网格 2x2', cells: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
    'grid-3x3': {
        name: '网格 3x3',
        cells: Array.from({ length: 9 }, (_, i) => ({
            x: (i % 3) / 3,
            y: Math.floor(i / 3) / 3,
            w: 1 / 3,
            h: 1 / 3
        }))
    }
};

let currentLayout = null;
let previewEl = null;

function injectStyles() {
    if (document.getElementById('mxos-split-layout-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-split-layout-styles';
    style.textContent = `
#mxosSplitPreview {
    position: fixed; inset: 0;
    z-index: 9985;
    pointer-events: none;
    display: none;
}
#mxosSplitPreview.show { display: block; }
.mxos-split-cell {
    position: absolute;
    border: 2px dashed var(--accent, #a78bfa);
    background: rgba(167, 139, 250, 0.08);
    border-radius: var(--radius-md, 10px);
    transition: opacity 0.2s ease;
}
.mxos-split-cell.highlight {
    background: rgba(167, 139, 250, 0.22);
    border-color: var(--accent, #a78bfa);
}
    `;
    document.head.appendChild(style);
}

function ensurePreview() {
    if (previewEl) return;
    previewEl = document.createElement('div');
    previewEl.id = 'mxosSplitPreview';
    previewEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(previewEl);
}

function layoutNames() {
    return Object.keys(LAYOUTS);
}

function layoutLabel(key) {
    return LAYOUTS[key]?.name || key;
}

function applyLayout(key) {
    const layout = LAYOUTS[key];
    if (!layout) return false;
    const visible = state.windows.filter(w => !w.minimized);
    if (visible.length === 0) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('当前没有可布局的窗口', 'warning');
        return false;
    }
    const taskbarH = 48;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - taskbarH;
    const margin = 6;
    const maxCells = Math.min(layout.cells.length, visible.length);
    for (let i = 0; i < maxCells; i++) {
        const cell = layout.cells[i];
        const w = visible[i];
        const x = Math.round(cell.x * screenW + margin);
        const y = Math.round(cell.y * screenH + margin);
        const width = Math.round(cell.w * screenW - margin * 2);
        const height = Math.round(cell.h * screenH - margin * 2);
        w.element.style.transition = 'left 0.3s var(--ease-out, ease), top 0.3s var(--ease-out, ease), width 0.3s var(--ease-out, ease), height 0.3s var(--ease-out, ease)';
        w.element.style.left = x + 'px';
        w.element.style.top = y + 'px';
        w.element.style.width = width + 'px';
        w.element.style.height = height + 'px';
        if (w.element.classList.contains('maximized')) w.element.classList.remove('maximized');
        setTimeout(() => { w.element.style.transition = ''; }, 320);
    }
    currentLayout = key;
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    return true;
}

function clearLayout() {
    currentLayout = null;
    if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已清除分屏布局', 'info');
}

function showPreview(key) {
    const layout = LAYOUTS[key];
    if (!layout) return;
    ensurePreview();
    const taskbarH = 48;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight - taskbarH;
    previewEl.innerHTML = '';
    layout.cells.forEach((cell, i) => {
        const div = document.createElement('div');
        div.className = 'mxos-split-cell';
        div.style.left = (cell.x * screenW + 6) + 'px';
        div.style.top = (cell.y * screenH + 6) + 'px';
        div.style.width = (cell.w * screenW - 12) + 'px';
        div.style.height = (cell.h * screenH - 12) + 'px';
        div.dataset.idx = i;
        previewEl.appendChild(div);
    });
    previewEl.classList.add('show');
}

function hidePreview() {
    if (!previewEl) return;
    previewEl.classList.remove('show');
}

function getCurrent() {
    return currentLayout;
}

function init() {
    injectStyles();
    window.MXOS.Features.splitLayout = {
        layoutNames, layoutLabel, applyLayout, clearLayout,
        showPreview, hidePreview, getCurrent
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { applyLayout, layoutNames, layoutLabel };
