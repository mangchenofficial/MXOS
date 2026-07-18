import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_window_aura';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let enabled = false;

function injectStyles() {
    if (document.getElementById('mxos-window-aura-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-window-aura-styles';
    style.textContent = `
body.window-aura-on .window:not(.minimized) {
    transition: box-shadow 0.4s ease, transform 0.4s ease;
}
body.window-aura-on .window.is-focused {
    animation: mxosAuraBreathe 4.5s ease-in-out infinite;
}
@keyframes mxosAuraBreathe {
    0%, 100% {
        box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 0 30px rgba(167, 139, 250, 0.18), 0 8px 24px rgba(0,0,0,0.4);
    }
    50% {
        box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 0 48px rgba(167, 139, 250, 0.34), 0 8px 24px rgba(0,0,0,0.4);
    }
}
body.window-aura-on .window.is-focused .window-header::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
    background-size: 220% 100%;
    animation: mxosAuraSweep 3.6s linear infinite;
    pointer-events: none;
    border-radius: inherit;
    mix-blend-mode: screen;
}
@keyframes mxosAuraSweep {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.window-header { position: relative; overflow: hidden; }
    `;
    document.head.appendChild(style);
}

function refreshFocus() {
    const active = state.activeWindow;
    state.windows.forEach(w => {
        if (!w.element) return;
        if (w.element === active) w.element.classList.add('is-focused');
        else w.element.classList.remove('is-focused');
    });
}

function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
    if (enabled) {
        if (prefersReduced) {
            if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('检测到减少动画偏好，光环动画将不做呼吸', 'info');
        }
        document.body.classList.add('window-aura-on');
        refreshFocus();
    } else {
        document.body.classList.remove('window-aura-on');
        state.windows.forEach(w => w.element.classList.remove('is-focused'));
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}

function isEnabled() { return enabled; }

function onFocusChange() {
    if (enabled) refreshFocus();
}

function init() {
    try {
        injectStyles();
        enabled = localStorage.getItem(STORAGE_KEY) === '1';
        if (enabled) document.body.classList.add('window-aura-on');
        document.addEventListener('mousedown', (e) => {
            const win = e.target.closest && e.target.closest('.window');
            if (win) setTimeout(onFocusChange, 0);
        }, { passive: true });
        window.addEventListener('mxos:window-focus', onFocusChange);
        window.MXOS.Features.windowAura = { setEnabled, isEnabled, refreshFocus };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, isEnabled };
