window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_aurora_enabled';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let canvas = null;
let ctx = null;
let rafId = null;
let enabled = false;
let phase = 0;
let mouseX = 0;
let mouseY = 0;
let ripples = [];

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-aurora-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-aurora-styles';
    style.textContent = `
#mxosAuroraCanvas {
    position: fixed; inset: 0;
    z-index: 0;
    pointer-events: none;
    display: block;
    opacity: 0.85;
}
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosAuroraCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
}

function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function onPointerMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
}
function onPointerDown(e) {
    if (e.target.closest('.window, .taskbar, .start-app, .desktop-icon, #startMenu, #quickSettingsPanel, .notification-center, #contextMenu')) return;
    ripples.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
    if (ripples.length > 12) ripples.shift();
}

function drawAurora(t) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    const bands = 3;
    for (let b = 0; b < bands; b++) {
        const yBase = h * (0.2 + b * 0.18);
        const amp = 50 + b * 30;
        const speed = 0.0003 * (b + 1);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
            const y = yBase + Math.sin((x + t * speed * 1000) * 0.005 + b) * amp
                + Math.sin((x - t * speed * 1500) * 0.002) * (amp * 0.6);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, yBase - amp, 0, h);
        const accent = getComputedStyle(document.body).getPropertyValue('--accent') || '#a78bfa';
        grad.addColorStop(0, `rgba(167, 139, 250, ${0.05 + b * 0.02})`);
        grad.addColorStop(0.5, `rgba(168, 200, 220, ${0.04 + b * 0.02})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fill();
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += 3;
        r.life -= 0.012;
        if (r.life <= 0) { ripples.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${r.life * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
}

function frame(t) {
    if (!enabled) return;
    rafId = requestAnimationFrame(frame);
    phase = t;
    if (!prefersReduced) drawAurora(t);
}

function start() {
    if (enabled) return;
    enabled = true;
    buildCanvas();
    rafId = requestAnimationFrame(frame);
}
function stop() {
    if (!enabled) return;
    enabled = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setEnabled(v) {
    saveEnabled(!!v);
    if (v) start(); else stop();
}
function isEnabled() { return enabled; }

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-aurora')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">桌面流光与波浪</div>
                <div class="settings-card-desc">背景缓慢流动的极光光带 + 点击水波纹</div>
            </div>
            <div class="toggle-switch ${enabled ? 'on' : ''}" id="setting-aurora" role="switch" aria-checked="${enabled}"></div>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-aurora').addEventListener('click', () => {
            const next = !enabled;
            setEnabled(next);
            section.querySelector('#setting-aurora').classList.toggle('on', next);
            section.querySelector('#setting-aurora').setAttribute('aria-checked', next ? 'true' : 'false');
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    try {
        injectStyles();
        injectSettingsIntoPanel();
        if (loadEnabled()) start();
        window.MXOS.Features.aurora = { start, stop, setEnabled, isEnabled };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, setEnabled, isEnabled };
