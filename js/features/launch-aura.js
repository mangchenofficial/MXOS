window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_launch_aura_enabled';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

let enabled = false;
let layer = null;

function injectStyles() {
    if (document.getElementById('mxos-launch-aura-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-launch-aura-styles';
    style.textContent = `
#mxosLaunchAuraLayer {
    position: fixed; inset: 0;
    z-index: 9990;
    pointer-events: none;
    display: block;
}
.mxos-launch-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid var(--accent, #a78bfa);
    transform: translate(-50%, -50%);
    animation: mxosLaunchRing 0.7s var(--ease-out, ease-out) forwards;
    pointer-events: none;
}
@keyframes mxosLaunchRing {
    0% { width: 0; height: 0; opacity: 0.9; border-width: 3px; }
    100% { width: 220px; height: 220px; opacity: 0; border-width: 1px; }
}
.mxos-launch-ripple {
    position: absolute;
    border-radius: 50%;
    background: var(--accent, #a78bfa);
    transform: translate(-50%, -50%) scale(0);
    animation: mxosLaunchRipple 0.55s ease-out forwards;
    pointer-events: none;
    opacity: 0.4;
}
@keyframes mxosLaunchRipple {
    0% { width: 0; height: 0; opacity: 0.5; }
    100% { width: 160px; height: 160px; opacity: 0; }
}
    `;
    document.head.appendChild(style);
}

function ensureLayer() {
    if (layer) return;
    layer = document.createElement('div');
    layer.id = 'mxosLaunchAuraLayer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
}

function emit(x, y) {
    if (prefersReduced) return;
    ensureLayer();
    const ring = document.createElement('div');
    ring.className = 'mxos-launch-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    layer.appendChild(ring);
    setTimeout(() => ring.remove(), 720);
    const ripple = document.createElement('div');
    ripple.className = 'mxos-launch-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    layer.appendChild(ripple);
    setTimeout(() => ripple.remove(), 580);
}

function findLaunchPoint(appId) {
    const sels = [
        `.start-app[data-app="${appId}"]`,
        `.desktop-icon[data-app="${appId}"]`,
        `.taskbar-item[data-app="${appId}"]`
    ];
    for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el) {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
    }
    return null;
}

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
}
function isEnabled() { return enabled; }

function onAppLaunch(e) {
    if (!enabled) return;
    const d = e && e.detail;
    if (!d) return;
    const appId = d.appId || d.app;
    if (!appId) return;
    const pt = findLaunchPoint(appId) || { x: window.innerWidth / 2, y: window.innerHeight - 60 };
    emit(pt.x, pt.y);
}

function playAt(x, y) {
    emit(x, y);
}

function init() {
    try {
        enabled = loadEnabled();
        injectStyles();
        ensureLayer();
        window.addEventListener('mxos:app-launch', onAppLaunch);
        window.addEventListener('mxos:window-created', onAppLaunch);
        window.MXOS.Features.launchAura = { playAt, setEnabled, isEnabled };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { playAt, setEnabled, isEnabled };
