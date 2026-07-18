window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_desktop_theater_enabled';
const IDLE_DELAY = 2 * 60 * 1000;
const WAKE_MOVE_THRESHOLD = 3;
const FORMATIONS = ['circle', 'square', 'wave', 'random-walk'];

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

let enabled = false;
let rafId = null;
let isRunning = false;
let icons = [];
let lastActivityTime = Date.now();
let lastMouseX = -1;
let lastMouseY = -1;
let mouseStartX = -1;
let mouseStartY = -1;
let formationIndex = 0;
let lastFormationChange = 0;
let formationInterval = 12000;
let reducedMotion = false;

function injectStyles() {
    if (document.getElementById('mxos-theater-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-theater-styles';
    style.textContent = `
.desktop-icon.theater-active {
    transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1), left 700ms cubic-bezier(0.4, 0, 0.2, 1), top 700ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    z-index: 5;
}
body.reduce-motion .desktop-icon.theater-active {
    transition: none !important;
}
    `;
    document.head.appendChild(style);
}

function captureIcons() {
    const list = document.querySelectorAll('.desktop-icon');
    icons = [];
    list.forEach(el => {
        const rect = el.getBoundingClientRect();
        icons.push({
            el: el,
            homeX: el.offsetLeft,
            homeY: el.offsetTop,
            x: el.offsetLeft,
            y: el.offsetTop,
            tx: el.offsetLeft,
            ty: el.offsetTop,
            phase: Math.random() * Math.PI * 2,
            speed: 0.8 + Math.random() * 0.5
        });
    });
}

function setFormation(name) {
    if (!icons.length) return;
    const w = window.innerWidth;
    const h = window.innerHeight - 60;
    const cx = w / 2;
    const cy = h / 2;
    if (name === 'circle') {
        const r = Math.min(w, h) * 0.3;
        const n = icons.length;
        icons.forEach((ic, i) => {
            const a = (i / n) * Math.PI * 2;
            ic.tx = cx + Math.cos(a) * r - ic.el.offsetWidth / 2;
            ic.ty = cy + Math.sin(a) * r - ic.el.offsetHeight / 2;
        });
    } else if (name === 'square') {
        const side = Math.ceil(Math.sqrt(icons.length));
        const step = 90;
        const startX = cx - (side * step) / 2;
        const startY = cy - (side * step) / 2;
        icons.forEach((ic, i) => {
            const row = Math.floor(i / side);
            const col = i % side;
            ic.tx = startX + col * step;
            ic.ty = startY + row * step;
        });
    } else if (name === 'wave') {
        const step = (w * 0.8) / Math.max(1, icons.length - 1);
        const startX = w * 0.1;
        icons.forEach((ic, i) => {
            ic.tx = startX + i * step;
            ic.ty = cy + Math.sin(i * 0.6) * 80 - ic.el.offsetHeight / 2;
            ic.phase = i * 0.6;
        });
    } else if (name === 'random-walk') {
        icons.forEach(ic => {
            ic.tx = 40 + Math.random() * (w - 120);
            ic.ty = 40 + Math.random() * (h - 120);
        });
    }
}

function checkCollisions() {
    for (let i = 0; i < icons.length; i++) {
        for (let j = i + 1; j < icons.length; j++) {
            const a = icons[i];
            const b = icons[j];
            const dx = (a.x + 20) - (b.x + 20);
            const dy = (a.y + 20) - (b.y + 20);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = 70;
            if (dist < minDist && dist > 0.1) {
                const push = (minDist - dist) / 2;
                const nx = dx / dist;
                const ny = dy / dist;
                a.tx += nx * push * 0.2;
                a.ty += ny * push * 0.2;
                b.tx -= nx * push * 0.2;
                b.ty -= ny * push * 0.2;
            }
        }
    }
}

function frame(ts) {
    if (!isRunning) return;
    if (!lastFormationChange) lastFormationChange = ts;
    if (ts - lastFormationChange > formationInterval) {
        lastFormationChange = ts;
        formationIndex = (formationIndex + 1) % FORMATIONS.length;
        setFormation(FORMATIONS[formationIndex]);
    }

    if (FORMATIONS[formationIndex] === 'wave') {
        icons.forEach(ic => {
            ic.phase += 0.03;
            const baseY = window.innerHeight / 2 - 60;
            ic.ty = baseY + Math.sin(ic.phase) * 80;
        });
    } else if (FORMATIONS[formationIndex] === 'random-walk') {
        icons.forEach(ic => {
            if (Math.random() < 0.02) {
                ic.tx += (Math.random() - 0.5) * 60;
                ic.ty += (Math.random() - 0.5) * 60;
                ic.tx = Math.max(20, Math.min(window.innerWidth - 80, ic.tx));
                ic.ty = Math.max(20, Math.min(window.innerHeight - 100, ic.ty));
            }
        });
    }

    checkCollisions();

    icons.forEach(ic => {
        const lerp = reducedMotion ? 1 : 0.06;
        ic.x += (ic.tx - ic.x) * lerp;
        ic.y += (ic.ty - ic.y) * lerp;
        ic.el.style.left = ic.x + 'px';
        ic.el.style.top = ic.y + 'px';
    });

    rafId = requestAnimationFrame(frame);
}

function start() {
    if (isRunning) return;
    reducedMotion = document.body.classList.contains('reduce-motion') ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    captureIcons();
    if (!icons.length) return;
    isRunning = true;
    icons.forEach(ic => ic.el.classList.add('theater-active'));
    formationIndex = Math.floor(Math.random() * FORMATIONS.length);
    setFormation(FORMATIONS[formationIndex]);
    lastFormationChange = 0;
    rafId = requestAnimationFrame(frame);
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:theater-start');
    }
}

function stop() {
    if (!isRunning) return;
    isRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    icons.forEach(ic => {
        ic.el.style.left = ic.homeX + 'px';
        ic.el.style.top = ic.homeY + 'px';
        ic.el.classList.remove('theater-active');
        setTimeout(() => {
            ic.el.style.left = '';
            ic.el.style.top = '';
        }, 700);
    });
    icons = [];
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:theater-end');
    }
}

function onActivity() {
    lastActivityTime = Date.now();
    if (isRunning) {
        stop();
    }
    mouseStartX = -1;
    mouseStartY = -1;
}

function onMouseMove(e) {
    if (mouseStartX < 0) {
        mouseStartX = e.clientX;
        mouseStartY = e.clientY;
        return;
    }
    const dx = e.clientX - mouseStartX;
    const dy = e.clientY - mouseStartY;
    if (Math.sqrt(dx * dx + dy * dy) >= WAKE_MOVE_THRESHOLD) {
        onActivity();
    }
}

function checkIdle() {
    if (!enabled || isRunning) return;
    if (Date.now() - lastActivityTime > IDLE_DELAY) {
        start();
    }
}

let idleTimer = null;

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
    if (enabled) start();
    else stop();
}
function isEnabled() { return enabled; }

function init() {
    try {
        enabled = loadEnabled();
        injectStyles();
        window.MXOS.Features.theater = {
            start, stop, setEnabled, isEnabled,
            isRunning: () => isRunning,
            formations: FORMATIONS.slice(),
            setFormation: (name) => {
                if (FORMATIONS.indexOf(name) >= 0 && isRunning) {
                    formationIndex = FORMATIONS.indexOf(name);
                    setFormation(name);
                    lastFormationChange = performance.now();
                }
            }
        };
        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'click'].forEach(ev => {
            document.addEventListener(ev, (e) => {
                if (ev === 'mousemove') onMouseMove(e);
                else onActivity();
            }, { passive: true });
        });
        idleTimer = setInterval(checkIdle, 10000);
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, setEnabled, isEnabled };
