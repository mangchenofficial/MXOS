import { state } from '../state.js';

window.MXOS = window.MXOS || {};

const THRESHOLD = 10;
let enabled = false;
let guideEl = null;
let listening = false;

function injectStyles() {
    if (document.getElementById('mxos-gravity-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-gravity-styles';
    style.textContent = `
#mxosGravityGuide {
    position: fixed;
    pointer-events: none;
    z-index: 8800;
    background: rgba(59, 130, 246, 0.9);
    box-shadow: 0 0 6px rgba(96,165,250,0.8);
    opacity: 0;
    transition: opacity 100ms ease;
}
#mxosGravityGuide.h { height: 1px; left: 0; right: 0; width: 100%; }
#mxosGravityGuide.v { width: 1px; top: 0; bottom: 0; height: 100%; }
#mxosGravityGuide.show { opacity: 1; }
    `;
    document.head.appendChild(style);
}

function ensureGuide() {
    if (!guideEl) {
        guideEl = document.createElement('div');
        guideEl.id = 'mxosGravityGuide';
        document.body.appendChild(guideEl);
    }
    return guideEl;
}

function showGuide(type, pos) {
    const g = ensureGuide();
    g.className = type + ' show';
    if (type === 'h') {
        g.style.top = pos + 'px';
        g.style.left = '';
        g.style.right = '';
        g.style.width = '';
    } else {
        g.style.left = pos + 'px';
        g.style.top = '';
        g.style.bottom = '';
        g.style.height = '';
    }
}

function hideGuide() {
    if (guideEl) guideEl.classList.remove('show');
}

function getRect(el) {
    return el.getBoundingClientRect();
}

function findAlignments(draggedEl) {
    const dragRect = getRect(draggedEl);
    const result = { dx: 0, dy: 0, guides: [] };
    const others = state.windows
        .filter(w => w.element !== draggedEl && !w.minimized)
        .map(w => w.element);

    const dragEdges = {
        left: dragRect.left,
        right: dragRect.right,
        top: dragRect.top,
        bottom: dragRect.bottom,
        cx: dragRect.left + dragRect.width / 2,
        cy: dragRect.top + dragRect.height / 2
    };

    let bestX = null;
    let bestXGuide = null;
    let bestY = null;
    let bestYGuide = null;

    others.forEach(other => {
        const r = getRect(other);
        const oEdges = {
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2
        };

        if (bestX === null) {
            const candidates = [
                { drag: dragEdges.left, other: oEdges.left, pos: oEdges.left, type: 'v' },
                { drag: dragEdges.left, other: oEdges.right, pos: oEdges.right, type: 'v' },
                { drag: dragEdges.right, other: oEdges.left, pos: oEdges.left - dragRect.width, type: 'v' },
                { drag: dragEdges.right, other: oEdges.right, pos: oEdges.right - dragRect.width, type: 'v' },
                { drag: dragEdges.cx, other: oEdges.cx, pos: oEdges.cx - dragRect.width / 2, type: 'v' }
            ];
            for (const c of candidates) {
                const delta = c.pos - c.drag;
                if (Math.abs(delta) < THRESHOLD && (bestX === null || Math.abs(delta) < Math.abs(bestX))) {
                    bestX = delta;
                    bestXGuide = { type: 'v', pos: c.other };
                }
            }
        }

        if (bestY === null) {
            const candidates = [
                { drag: dragEdges.top, other: oEdges.top, pos: oEdges.top, type: 'h' },
                { drag: dragEdges.top, other: oEdges.bottom, pos: oEdges.bottom, type: 'h' },
                { drag: dragEdges.bottom, other: oEdges.top, pos: oEdges.top - dragRect.height, type: 'h' },
                { drag: dragEdges.bottom, other: oEdges.bottom, pos: oEdges.bottom - dragRect.height, type: 'h' },
                { drag: dragEdges.cy, other: oEdges.cy, pos: oEdges.cy - dragRect.height / 2, type: 'h' }
            ];
            for (const c of candidates) {
                const delta = c.pos - c.drag;
                if (Math.abs(delta) < THRESHOLD && (bestY === null || Math.abs(delta) < Math.abs(bestY))) {
                    bestY = delta;
                    bestYGuide = { type: 'h', pos: c.other };
                }
            }
        }
    });

    const screenCx = window.innerWidth / 2;
    const screenCy = (window.innerHeight - 48) / 2;
    if (bestX === null && Math.abs(dragEdges.cx - screenCx) < THRESHOLD) {
        bestX = screenCx - dragEdges.cx;
        bestXGuide = { type: 'v', pos: screenCx };
    }
    if (bestY === null && Math.abs(dragEdges.cy - screenCy) < THRESHOLD) {
        bestY = screenCy - dragEdges.cy;
        bestYGuide = { type: 'h', pos: screenCy };
    }

    if (bestX !== null) {
        result.dx = bestX;
        result.guides.push(bestXGuide);
    }
    if (bestY !== null) {
        result.dy = bestY;
        result.guides.push(bestYGuide);
    }
    return result;
}

function onDragMove() {
    if (!enabled || !state.dragState) {
        hideGuide();
        return;
    }
    const el = state.dragState.element;
    if (!el || el.classList.contains('maximized')) {
        hideGuide();
        return;
    }
    const align = findAlignments(el);
    if (align.dx !== 0 || align.dy !== 0) {
        const transform = el.style.transform || '';
        const match = transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0px\)/);
        if (match) {
            const baseX = parseFloat(match[1]);
            const baseY = parseFloat(match[2]);
            el.style.transform = `translate3d(${baseX + align.dx}px, ${baseY + align.dy}px, 0)`;
        }
        if (align.guides.length) {
            const g = align.guides[0];
            showGuide(g.type, g.pos);
        } else {
            hideGuide();
        }
    } else {
        hideGuide();
    }
}

function onDragEnd() {
    hideGuide();
}

function setup() {
    if (listening) return;
    listening = true;
    document.addEventListener('mousemove', onDragMove, { capture: true });
    document.addEventListener('touchmove', onDragMove, { capture: true, passive: false });
    document.addEventListener('mouseup', onDragEnd, { capture: true });
    document.addEventListener('touchend', onDragEnd, { capture: true });
}

function teardown() {
    if (!listening) return;
    listening = false;
    document.removeEventListener('mousemove', onDragMove, { capture: true });
    document.removeEventListener('touchmove', onDragMove, { capture: true });
    document.removeEventListener('mouseup', onDragEnd, { capture: true });
    document.removeEventListener('touchend', onDragEnd, { capture: true });
    hideGuide();
}

function enable() {
    if (enabled) return;
    enabled = true;
    injectStyles();
    ensureGuide();
    setup();
}

function disable() {
    if (!enabled) return;
    enabled = false;
    teardown();
}

function isEnabled() {
    return enabled;
}

function init() {
    injectStyles();
    ensureGuide();
    enabled = true;
    setup();
    window.MXOS.Gravity = { enable, disable, isEnabled };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { enable, disable, isEnabled };
