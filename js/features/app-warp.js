import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_app_warp';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let enabled = false;
let stage = null;
let cards = [];
let activeIdx = 0;
let isOpen = false;
let keyHandler = null;

function load() {
    try { enabled = localStorage.getItem(STORAGE_KEY) === '1'; } catch { enabled = false; }
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-app-warp-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-app-warp-styles';
    style.textContent = `
#mxosAppWarpStage {
    position: fixed; inset: 0;
    z-index: 9988;
    pointer-events: none;
    display: none;
    perspective: 1400px;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(8px);
}
#mxosAppWarpStage.show { display: block; }
.mxos-warp-card {
    position: absolute;
    top: 50%; left: 50%;
    width: 280px; height: 180px;
    transform-style: preserve-3d;
    background: var(--glass-bg, rgba(20,20,22,0.8));
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.12));
    border-radius: var(--radius-lg, 14px);
    box-shadow: var(--shadow, 0 12px 36px rgba(0,0,0,0.5));
    color: var(--text-color, #fff);
    padding: 12px;
    display: flex; flex-direction: column; gap: 8px;
    transition: transform 0.32s var(--ease-out, ease), opacity 0.32s ease;
    transform-origin: center center;
}
.mxos-warp-card .warp-title {
    font-size: 14px; font-weight: 600;
}
.mxos-warp-card .warp-sub {
    font-size: 11px; color: var(--text-secondary, #aaa);
}
    `;
    document.head.appendChild(style);
}

function buildStage() {
    if (stage) return;
    stage = document.createElement('div');
    stage.id = 'mxosAppWarpStage';
    stage.setAttribute('aria-hidden', 'true');
    document.body.appendChild(stage);
}

function visibleWindows() {
    return state.windows.filter(w => !w.minimized);
}

function open() {
    if (!enabled || isOpen) return;
    const list = visibleWindows();
    if (list.length === 0) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('当前没有可切换的窗口', 'info');
        return;
    }
    isOpen = true;
    buildStage();
    stage.innerHTML = '';
    cards = [];
    const center = list.findIndex(w => w.element === state.activeWindow);
    activeIdx = center >= 0 ? center : 0;
    list.forEach((w, i) => {
        const card = document.createElement('div');
        card.className = 'mxos-warp-card';
        const title = w.element.querySelector('.window-title span')?.textContent || w.appId;
        const icon = w.element.querySelector('.window-title')?.innerHTML || '';
        card.innerHTML = `<div class="warp-title">${icon} ${title}</div><div class="warp-sub">${w.appId}</div>`;
        card.addEventListener('click', () => {
            activeIdx = i;
            commit();
        });
        stage.appendChild(card);
        cards.push(card);
    });
    stage.classList.add('show');
    positionCards();
    if (!keyHandler) {
        keyHandler = (e) => onKeyDown(e);
        window.addEventListener('keydown', keyHandler);
    }
}

function positionCards() {
    const n = cards.length;
    cards.forEach((card, i) => {
        const offset = i - activeIdx;
        const absOff = Math.abs(offset);
        const x = offset * 220;
        const z = -absOff * 200;
        const ry = offset * -25;
        const opacity = absOff > 3 ? 0 : 1 - absOff * 0.18;
        card.style.transform = `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg)`;
        card.style.opacity = opacity;
        card.style.zIndex = String(100 - absOff);
    });
}

function onKeyDown(e) {
    if (!isOpen) return;
    if (e.key === 'Tab' && e.altKey) {
        e.preventDefault();
        if (e.shiftKey) activeIdx = (activeIdx - 1 + cards.length) % cards.length;
        else activeIdx = (activeIdx + 1) % cards.length;
        positionCards();
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        commit();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
    }
}

function commit() {
    const list = visibleWindows();
    if (list[activeIdx]) {
        const w = list[activeIdx];
        if (w.element) {
            w.element.style.transition = 'transform 0.4s var(--ease-out, ease), opacity 0.4s ease';
            w.element.style.transform = 'scale(0.94)';
            w.element.style.opacity = '0.4';
            setTimeout(() => {
                w.element.style.transform = '';
                w.element.style.opacity = '';
                w.element.style.transition = '';
                if (window.MXOS?.core?.bringToFront) window.MXOS.core.bringToFront(w.element);
                else w.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            }, 200);
        }
    }
    close();
}

function close() {
    isOpen = false;
    if (stage) stage.classList.remove('show');
    if (keyHandler) {
        window.removeEventListener('keydown', keyHandler);
        keyHandler = null;
    }
}

function onKeyUp(e) {
    if (!enabled) return;
    if (e.key === 'Alt' && isOpen) {
        commit();
    } else if (e.key === 'Tab' && e.altKey && !isOpen) {
        open();
    }
}

function setEnabled(v) {
    enabled = !!v;
    save();
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}
function isEnabled() { return enabled; }

function init() {
    try {
        load();
        injectStyles();
        window.addEventListener('keydown', (e) => {
            if (!enabled) return;
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault();
                if (!isOpen) open();
                else {
                    activeIdx = (activeIdx + (e.shiftKey ? -1 : 1) + cards.length) % cards.length;
                    positionCards();
                }
            }
        });
        window.addEventListener('keyup', onKeyUp);
        window.MXOS.Features.appWarp = { setEnabled, isEnabled, open, close };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, isEnabled, open, close };
