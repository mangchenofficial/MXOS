import { state } from '../state.js';
import { minimizeWindow } from '../core.js';

window.MXOS = window.MXOS || {};

const SHAKE_THRESHOLD = 8;
const SHAKE_TIME_WINDOW = 700;
const SHAKE_DIRECTION_CHANGES = 3;
const MIN_AMPLITUDE = 60;

let directionChanges = 0;
let lastDirection = 0;
let lastShakeTime = 0;
let lastFirstX = 0;
let tracking = false;
let activeWindow = null;
let bound = false;

function onDragMove() {
    if (!state.dragState || !state.dragState.element) return;
    const currentX = state.dragState.currentX;
    const startX = state.dragState.startX;
    const dx = currentX - startX;
    const now = Date.now();

    if (!tracking) {
        tracking = true;
        activeWindow = findWindowByElement(state.dragState.element);
        directionChanges = 0;
        lastDirection = 0;
        lastFirstX = currentX;
        return;
    }

    if (now - lastShakeTime > SHAKE_TIME_WINDOW) {
        directionChanges = 0;
        lastDirection = 0;
        lastFirstX = currentX;
    }

    const relDx = currentX - lastFirstX;
    const direction = relDx > 0 ? 1 : relDx < 0 ? -1 : 0;
    if (direction !== 0 && direction !== lastDirection && Math.abs(relDx) > SHAKE_THRESHOLD) {
        directionChanges++;
        lastDirection = direction;
        lastFirstX = currentX;
        lastShakeTime = now;
        if (directionChanges >= SHAKE_DIRECTION_CHANGES && Math.abs(dx) >= MIN_AMPLITUDE) {
            triggerShake();
            directionChanges = 0;
            lastDirection = 0;
        }
    }
}

function onDragEnd() {
    tracking = false;
    directionChanges = 0;
    lastDirection = 0;
    activeWindow = null;
}

function findWindowByElement(el) {
    return state.windows.find(w => w.element === el);
}

function triggerShake() {
    const target = activeWindow || (state.activeWindow ? findWindowByElement(state.activeWindow) : null);
    if (!target) return;
    const others = state.windows.filter(w => w !== target && !w.minimized);
    if (others.length === 0) return;
    others.forEach(w => {
        try {
            minimizeWindow(w);
        } catch (e) {}
    });
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已最小化其他窗口');
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    window.dispatchEvent(new CustomEvent('mxos:window-shake', { detail: { window: target } }));
}

function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('mousemove', onDragMove, true);
    document.addEventListener('touchmove', onDragMove, { passive: true });
    document.addEventListener('mouseup', onDragEnd, true);
    document.addEventListener('touchend', onDragEnd, true);
}

function init() {
    bind();
    window.MXOS.WindowShake = {
        trigger: triggerShake,
        isEnabled: () => true
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { triggerShake };
