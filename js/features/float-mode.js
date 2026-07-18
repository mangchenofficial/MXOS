import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_float_mode';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let enabled = false;
let savedBounds = new WeakMap();

function injectStyles() {
    if (document.getElementById('mxos-float-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-float-mode-styles';
    style.textContent = `
body.float-mode-on .window:not(.minimized) {
    transition: width 0.35s var(--ease-out, ease), height 0.35s var(--ease-out, ease), opacity 0.3s ease, transform 0.35s var(--ease-out, ease) !important;
    width: 320px !important;
    height: 220px !important;
    opacity: 0.92;
    border-radius: var(--radius-lg, 14px);
    box-shadow: var(--shadow, 0 8px 24px rgba(0,0,0,0.4));
}
body.float-mode-on .window:not(.minimized) .window-content {
    overflow: hidden;
    transform: scale(0.85);
    transform-origin: top left;
}
body.float-mode-on .window:not(.minimized):hover {
    opacity: 1;
    transform: translateY(-2px) scale(1.02);
}
    `;
    document.head.appendChild(style);
}

function captureBounds(winEl) {
    if (savedBounds.has(winEl)) return;
    savedBounds.set(winEl, {
        width: winEl.style.width,
        height: winEl.style.height,
        left: winEl.style.left,
        top: winEl.style.top
    });
}

function applyToWindow(winEl) {
    captureBounds(winEl);
}

function restoreWindow(winEl) {
    const b = savedBounds.get(winEl);
    if (b) {
        winEl.style.width = b.width;
        winEl.style.height = b.height;
        winEl.style.left = b.left;
        winEl.style.top = b.top;
        savedBounds.delete(winEl);
    }
}

function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
    if (enabled) {
        document.body.classList.add('float-mode-on');
        state.windows.forEach(w => {
            if (!w.minimized) applyToWindow(w.element);
        });
        if (!prefersReduced && window.MXOS?.notify) {
            window.MXOS.notify({ title: '漂浮模式', body: '窗口已变为可自由摆放的卡片', type: 'info' });
        }
    } else {
        state.windows.forEach(w => restoreWindow(w.element));
        document.body.classList.remove('float-mode-on');
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}

function isEnabled() { return enabled; }

function onWindowCreated(e) {
    if (!enabled) return;
    const w = e && e.detail && e.detail.window;
    if (w && w.element) applyToWindow(w.element);
}

function init() {
    try {
        injectStyles();
        enabled = localStorage.getItem(STORAGE_KEY) === '1';
        if (enabled) document.body.classList.add('float-mode-on');
        window.addEventListener('mxos:window-created', onWindowCreated);
        window.MXOS.Features.floatMode = { setEnabled, isEnabled };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, isEnabled };
