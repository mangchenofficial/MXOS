import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_phantom_mode';

let enabled = false;

function injectStyles() {
    if (document.getElementById('mxos-phantom-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-phantom-mode-styles';
    style.textContent = `
body.phantom-mode-on .window:not(.minimized):not(.is-active) {
    opacity: 0.5 !important;
    filter: blur(1.5px);
    transition: opacity 0.35s ease, filter 0.35s ease;
}
body.phantom-mode-on .window:not(.minimized):not(.is-active):hover {
    opacity: 0.85;
    filter: blur(0.4px);
}
body.phantom-mode-on .window.is-active {
    opacity: 1 !important;
    filter: none !important;
}
    `;
    document.head.appendChild(style);
}

function refreshActive() {
    const active = state.activeWindow;
    state.windows.forEach(w => {
        if (w.minimized) return;
        if (w.element === active) {
            w.element.classList.add('is-active');
        } else {
            w.element.classList.remove('is-active');
        }
    });
}

function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
    if (enabled) {
        document.body.classList.add('phantom-mode-on');
        refreshActive();
    } else {
        document.body.classList.remove('phantom-mode-on');
        state.windows.forEach(w => w.element.classList.remove('is-active'));
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}

function isEnabled() { return enabled; }

function onWindowFocus() {
    if (enabled) refreshActive();
}

function init() {
    try {
        injectStyles();
        enabled = localStorage.getItem(STORAGE_KEY) === '1';
        if (enabled) document.body.classList.add('phantom-mode-on');
        document.addEventListener('mousedown', (e) => {
            const win = e.target.closest && e.target.closest('.window');
            if (win) setTimeout(onWindowFocus, 0);
        }, { passive: true });
        window.addEventListener('mxos:window-focus', onWindowFocus);
        window.MXOS.Features.phantomMode = { setEnabled, isEnabled, refreshActive };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, isEnabled };
