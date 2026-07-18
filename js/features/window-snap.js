import { state } from '../state.js';

const EDGE_THRESHOLD = 12;
const CORNER_SIZE = 80;
const TASKBAR_H = 48;

let isListening = false;
let currentSnap = null;

function injectStyles() {
    if (document.getElementById('snap-styles')) return;
    const style = document.createElement('style');
    style.id = 'snap-styles';
    style.textContent = `
#windowSnapPreview {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    background: rgba(59, 130, 246, 0.18);
    border: 2px solid rgba(96, 165, 250, 0.7);
    border-radius: 8px;
    pointer-events: none;
    z-index: 9000;
    opacity: 0;
    transform: scale(0.96);
    transition: opacity 180ms ease, transform 180ms ease;
    backdrop-filter: blur(6px) saturate(160%);
    -webkit-backdrop-filter: blur(6px) saturate(160%);
}
#windowSnapPreview.show {
    opacity: 1;
    transform: scale(1);
    animation: snapPulse 1.8s ease-in-out infinite;
}
@keyframes snapPulse {
    0%, 100% {
        border-color: rgba(96, 165, 250, 0.7);
        box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.35);
    }
    50% {
        border-color: rgba(147, 197, 253, 0.95);
        box-shadow: 0 0 22px 4px rgba(96, 165, 250, 0.35);
    }
}
.window.snapping {
    transition: top 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                left 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                height 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                border-radius 0.28s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
    `;
    document.head.appendChild(style);
}

function createPreview() {
    let el = document.getElementById('windowSnapPreview');
    if (!el) {
        el = document.createElement('div');
        el.id = 'windowSnapPreview';
        document.body.appendChild(el);
    }
    return el;
}

function getSnapDirection(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const topEdge = EDGE_THRESHOLD;
    const sideEdge = EDGE_THRESHOLD;

    if (y <= topEdge && x <= CORNER_SIZE) return 'top-left';
    if (y <= topEdge && x >= w - CORNER_SIZE) return 'top-right';
    if (y >= h - TASKBAR_H - CORNER_SIZE && x <= CORNER_SIZE) return 'bottom-left';
    if (y >= h - TASKBAR_H - CORNER_SIZE && x >= w - CORNER_SIZE) return 'bottom-right';

    if (y <= topEdge) return 'top';
    if (x <= sideEdge) return 'left';
    if (x >= w - sideEdge) return 'right';

    return null;
}

function getSnapRect(direction) {
    const w = window.innerWidth;
    const h = window.innerHeight - TASKBAR_H;
    const halfW = w / 2;
    const halfH = h / 2;

    switch (direction) {
        case 'left': return { left: 0, top: 0, width: halfW, height: h };
        case 'right': return { left: halfW, top: 0, width: halfW, height: h };
        case 'top': return { left: 0, top: 0, width: w, height: h };
        case 'top-left': return { left: 0, top: 0, width: halfW, height: halfH };
        case 'top-right': return { left: halfW, top: 0, width: halfW, height: halfH };
        case 'bottom-left': return { left: 0, top: halfH, width: halfW, height: halfH };
        case 'bottom-right': return { left: halfW, top: halfH, width: halfW, height: halfH };
    }
    return null;
}

function showPreview(direction) {
    if (!direction) {
        hidePreview();
        return;
    }
    const rect = getSnapRect(direction);
    if (!rect) return;
    const el = createPreview();
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.classList.add('show');
    currentSnap = direction;
}

function hidePreview() {
    const el = document.getElementById('windowSnapPreview');
    if (el) el.classList.remove('show');
    currentSnap = null;
}

function snapWindow(windowEl, direction) {
    if (!windowEl || !direction) return;
    const rect = getSnapRect(direction);
    if (!rect) return;

    if (windowEl.classList.contains('maximized')) {
        windowEl.classList.remove('maximized');
        windowEl.style.borderRadius = '';
        windowEl.style.boxShadow = '';
    }

    if (direction === 'top' && !windowEl.dataset.prevTop) {
        windowEl.dataset.prevTop = windowEl.offsetTop + 'px';
        windowEl.dataset.prevLeft = windowEl.offsetLeft + 'px';
        windowEl.dataset.prevWidth = windowEl.offsetWidth + 'px';
        windowEl.dataset.prevHeight = windowEl.offsetHeight + 'px';
    }

    windowEl.classList.add('snapping');
    windowEl.style.top = rect.top + 'px';
    windowEl.style.left = rect.left + 'px';
    windowEl.style.width = rect.width + 'px';
    windowEl.style.height = rect.height + 'px';
    windowEl.style.transform = '';
    windowEl.dataset.snapState = direction;

    if (direction === 'top') {
        windowEl.classList.add('maximized');
        windowEl.style.borderRadius = '0';
        windowEl.style.boxShadow = 'none';
    } else {
        windowEl.style.borderRadius = '8px';
    }

    setTimeout(() => {
        windowEl.classList.remove('snapping');
        const contentEl = windowEl.querySelector('.window-content');
        if (contentEl) {
            const event = new CustomEvent('windowResizeEnd', {
                detail: { width: rect.width, height: rect.height }
            });
            contentEl.dispatchEvent(event);
        }
    }, 300);
}

function snap(appId, direction) {
    let windowObj = null;
    if (appId && typeof appId === 'object' && appId.element) {
        windowObj = appId;
    } else if (appId && typeof appId === 'object' && appId.classList && appId.classList.contains('window')) {
        windowObj = { element: appId };
    } else {
        windowObj = state.windows.find(w => w.appId === appId) || (state.activeWindow ? { element: state.activeWindow } : null);
    }
    if (!windowObj || !windowObj.element) return;
    snapWindow(windowObj.element, direction);
}

function clearSnapState(windowEl) {
    if (!windowEl) return;
    if (windowEl.dataset.snapState) {
        delete windowEl.dataset.snapState;
    }
}

function setupDragHook() {
    if (isListening) return;
    isListening = true;

    document.addEventListener('mousemove', (e) => {
        if (!state.dragState) {
            if (currentSnap) hidePreview();
            return;
        }
        const el = state.dragState.element;
        if (!el) return;
        if (el.classList.contains('maximized')) {
            if (currentSnap) hidePreview();
            return;
        }
        const direction = getSnapDirection(e.clientX, e.clientY);
        if (direction !== currentSnap) {
            showPreview(direction);
        }
    }, { capture: true });

    document.addEventListener('mouseup', () => {
        if (!state.dragState) return;
        if (currentSnap) {
            const el = state.dragState.element;
            const direction = currentSnap;
            hidePreview();
            setTimeout(() => {
                snapWindow(el, direction);
            }, 0);
        }
    }, { capture: true });

    document.addEventListener('touchmove', (e) => {
        if (!state.dragState) return;
        const t = e.touches[0];
        if (!t) return;
        const el = state.dragState.element;
        if (!el || el.classList.contains('maximized')) {
            if (currentSnap) hidePreview();
            return;
        }
        const direction = getSnapDirection(t.clientX, t.clientY);
        if (direction !== currentSnap) {
            showPreview(direction);
        }
    }, { capture: true, passive: false });

    document.addEventListener('touchend', () => {
        if (!state.dragState) return;
        if (currentSnap) {
            const el = state.dragState.element;
            const direction = currentSnap;
            hidePreview();
            setTimeout(() => {
                snapWindow(el, direction);
            }, 0);
        }
    }, { capture: true });

    window.addEventListener('resize', () => {
        if (currentSnap) hidePreview();
    });
}

function init() {
    injectStyles();
    setupDragHook();

    window.MXOS = window.MXOS || {};
    window.MXOS.window = window.MXOS.window || {};
    window.MXOS.window.snap = snap;
    window.MXOS.window.clearSnap = clearSnapState;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { snap, clearSnapState };
