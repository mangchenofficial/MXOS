window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_desktop_flip_enabled';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-desktop-flip-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-desktop-flip-styles';
    style.textContent = `
#desktopFlipStage {
    position: fixed; inset: 0;
    z-index: 9990;
    pointer-events: none;
    perspective: 1600px;
    display: none;
}
#desktopFlipStage.show { display: block; }
#desktopFlipCard {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    transform-origin: center center;
    will-change: transform, opacity;
}
@keyframes mxosFlipOut {
    0% { transform: rotateY(0deg) scale(1); opacity: 1; }
    50% { transform: rotateY(45deg) scale(0.92); opacity: 0.6; }
    100% { transform: rotateY(90deg) scale(0.85); opacity: 0; }
}
@keyframes mxosFlipIn {
    0% { transform: rotateY(-90deg) scale(0.85); opacity: 0; }
    50% { transform: rotateY(-45deg) scale(0.92); opacity: 0.6; }
    100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}
body.desktop-flipping #desktop,
body.desktop-flipping .taskbar,
body.desktop-flipping .desktop-icons,
body.desktop-flipping .widget-layer {
    transition: transform 0.6s var(--ease-out, ease), opacity 0.6s var(--ease-out, ease);
}
    `;
    document.head.appendChild(style);
}

let stage = null;
let card = null;
let flipping = false;
let enabled = false;

function buildStage() {
    if (stage) return;
    stage = document.createElement('div');
    stage.id = 'desktopFlipStage';
    stage.setAttribute('aria-hidden', 'true');
    card = document.createElement('div');
    card.id = 'desktopFlipCard';
    stage.appendChild(card);
    document.body.appendChild(stage);
}

function flip(direction) {
    if (!enabled || flipping || prefersReduced) return false;
    flipping = true;
    document.body.classList.add('desktop-flipping');
    const desktop = document.getElementById('desktop');
    const animOut = direction === 'next' ? 'rotateY(-90deg) scale(0.85)' : 'rotateY(90deg) scale(0.85)';
    const animIn = 'rotateY(0deg) scale(1)';
    if (desktop) {
        desktop.style.transition = 'transform 0.3s var(--ease-out, ease), opacity 0.3s var(--ease-out, ease)';
        desktop.style.transform = animOut;
        desktop.style.opacity = '0';
    }
    setTimeout(() => {
        if (desktop) {
            desktop.style.transform = animIn;
            desktop.style.opacity = '1';
            setTimeout(() => {
                desktop.style.transition = '';
                desktop.style.transform = '';
                desktop.style.opacity = '';
                document.body.classList.remove('desktop-flipping');
                flipping = false;
            }, 320);
        } else {
            flipping = false;
            document.body.classList.remove('desktop-flipping');
        }
    }, 320);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    return true;
}

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
}
function isEnabled() { return enabled; }

function onVirtualDesktopSwitch(e) {
    const dir = (e && e.detail && e.detail.direction) || 'next';
    flip(dir);
}

function init() {
    try {
        enabled = loadEnabled();
        injectStyles();
        buildStage();
        window.addEventListener('mxos:virtual-desktop-switch', onVirtualDesktopSwitch);
        window.MXOS.Features.desktopFlip = { flip, isFlipping: () => flipping, setEnabled, isEnabled };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { flip, setEnabled, isEnabled };
