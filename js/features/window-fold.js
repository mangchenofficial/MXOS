import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOLDED_CLASS = 'window-folded';

function injectStyles() {
    if (document.getElementById('mxos-window-fold-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-window-fold-styles';
    style.textContent = `
.window.${FOLDED_CLASS} {
    width: 220px !important;
    height: 40px !important;
    overflow: visible !important;
    border-radius: var(--radius-md, 10px);
    transition: width 0.32s var(--ease-out, ease), height 0.32s var(--ease-out, ease), transform 0.32s var(--ease-out, ease) !important;
}
.window.${FOLDED_CLASS} .window-content,
.window.${FOLDED_CLASS} .resize-handle {
    display: none !important;
}
.window.${FOLDED_CLASS} .window-header {
    border-radius: var(--radius-md, 10px);
    cursor: grab;
}
.window.${FOLDED_CLASS} .window-controls .minimize,
.window.${FOLDED_CLASS} .window-controls .maximize {
    display: none;
}
.window.${FOLDED_CLASS} .window-controls .close {
    display: inline-flex;
}
.window.${FOLDED_CLASS} .window-controls::before {
    content: '展开';
    color: var(--text-secondary, #aaa);
    font-size: 11px;
    margin-right: 8px;
    cursor: pointer;
}
    `;
    document.head.appendChild(style);
}

let savedBounds = new WeakMap();

function fold(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    if (el.classList.contains(FOLDED_CLASS)) return false;
    savedBounds.set(el, {
        width: el.style.width,
        height: el.style.height,
        left: el.style.left,
        top: el.style.top
    });
    el.classList.add(FOLDED_CLASS);
    el.dataset.foldAppId = winObj.appId;
    if (!prefersReduced) {
        el.style.transform = 'translateZ(0) scale(0.96)';
        setTimeout(() => { el.style.transform = ''; }, 340);
    }
    return true;
}

function unfold(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    if (!el.classList.contains(FOLDED_CLASS)) return false;
    const b = savedBounds.get(el);
    el.classList.remove(FOLDED_CLASS);
    if (b) {
        el.style.width = b.width;
        el.style.height = b.height;
        el.style.left = b.left;
        el.style.top = b.top;
        savedBounds.delete(el);
    }
    return true;
}

function toggle(winObj) {
    if (!winObj) return false;
    const el = winObj.element;
    if (el.classList.contains(FOLDED_CLASS)) return unfold(winObj);
    return fold(winObj);
}

function findByElement(el) {
    return state.windows.find(w => w.element === el);
}

function onHeaderDblClick(e) {
    const header = e.target.closest('.window-header');
    if (!header) return;
    if (e.target.closest('.window-control')) return;
    const winEl = header.closest('.window');
    if (!winEl) return;
    const w = findByElement(winEl);
    if (!w) return;
    toggle(w);
    e.preventDefault();
}

function init() {
    injectStyles();
    document.addEventListener('dblclick', onHeaderDblClick);
    window.MXOS.Features.windowFold = { fold, unfold, toggle };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { fold, unfold, toggle };
