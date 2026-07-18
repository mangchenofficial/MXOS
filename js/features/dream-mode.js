window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const TRIGGER_DELAY = 30 * 1000;
const WAKE_MOVE_THRESHOLD = 5;

let canvas = null;
let ctx = null;
let rafId = null;
let audioCtx = null;
let audioNodes = [];
let masterGain = null;
let lockTimer = null;
let isRunning = false;
let lastMouseX = -1;
let lastMouseY = -1;
let mouseStartX = -1;
let mouseStartY = -1;
let startTime = 0;
let particles = [];
let fractalSeed = 0;

const PALETTES = [
    ['#0a0a0b', '#1a1a1f', '#2d2d35', '#5a5a66'],
    ['#0a0a0b', '#1f1a14', '#3a2d1f', '#8a6a3a'],
    ['#0a0a0b', '#14201a', '#1f3a2d', '#3a8a6a'],
    ['#0a0a0b', '#1a1420', '#2d1f3a', '#6a3a8a']
];

function injectStyles() {
    if (document.getElementById('mxos-dream-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-dream-styles';
    style.textContent = `
#mxosDreamCanvas {
    position: fixed; inset: 0;
    z-index: 9000;
    pointer-events: auto;
    cursor: none;
    display: none;
    background: #0a0a0b;
}
#mxosDreamCanvas.show { display: block; }
body.reduce-motion #mxosDreamCanvas { cursor: default; }
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosDreamCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('click', wakeUp);
    canvas.addEventListener('keydown', wakeUp);
}

function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function onMouseMove(e) {
    handleMove(e.clientX, e.clientY);
}

function onTouchMove(e) {
    if (!e.touches.length) return;
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
}

function handleMove(x, y) {
    if (mouseStartX < 0) {
        mouseStartX = x;
        mouseStartY = y;
        return;
    }
    const dx = x - mouseStartX;
    const dy = y - mouseStartY;
    if (Math.sqrt(dx * dx + dy * dy) >= WAKE_MOVE_THRESHOLD) {
        wakeUp();
    }
    lastMouseX = x;
    lastMouseY = y;
}

function spawnParticles() {
    particles = [];
    const count = 80;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            radius: 1 + Math.random() * 3,
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: 0.005 + Math.random() * 0.01,
            hueShift: Math.random()
        });
    }
}

function startAudio() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(audioCtx.destination);
        masterGain.gain.setTargetAtTime(0.18, audioCtx.currentTime, 1.5);

        const droneFreqs = [55, 82.5, 110, 165];
        droneFreqs.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = i % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.value = f;
            const g = audioCtx.createGain();
            g.gain.value = 0.25;
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 0.05 + i * 0.03;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 0.15;
            lfo.connect(lfoGain);
            lfoGain.connect(g.gain);
            osc.connect(g);
            g.connect(masterGain);
            osc.start();
            lfo.start();
            audioNodes.push(osc, lfo, g, lfoGain);
        });

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        masterGain.disconnect();
        masterGain.connect(filter);
        filter.connect(audioCtx.destination);
        audioNodes.push(filter);
    } catch (e) {}
}

function stopAudio() {
    if (!audioCtx) return;
    try {
        masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
    } catch (e) {}
    setTimeout(() => {
        audioNodes.forEach(n => {
            try { if (n.stop) n.stop(); } catch (e) {}
            try { if (n.disconnect) n.disconnect(); } catch (e) {}
        });
        audioNodes = [];
        try { audioCtx.close(); } catch (e) {}
        audioCtx = null;
        masterGain = null;
    }, 600);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function getColor(t, palette) {
    const idx = t * (palette.length - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    const c1 = palette[i];
    const c2 = palette[Math.min(palette.length - 1, i + 1)];
    return mixHex(c1, c2, f);
}

function mixHex(a, b, t) {
    const pa = parseHex(a);
    const pb = parseHex(b);
    const r = Math.round(lerp(pa[0], pb[0], t));
    const g = Math.round(lerp(pa[1], pb[1], t));
    const bl = Math.round(lerp(pa[2], pb[2], t));
    return `rgb(${r},${g},${bl})`;
}

function parseHex(h) {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function drawFractalCurve(t, palette, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) * 0.32;
    const points = 220;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r1 = baseR + Math.sin(a * 5 + t * 0.0006) * 30;
        const r2 = Math.cos(a * 3 - t * 0.0004) * 40;
        const r = r1 + r2;
        const x = cx + Math.cos(a + t * 0.0001) * r;
        const y = cy + Math.sin(a + t * 0.0001) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, baseR * 1.6);
    const c1 = getColor((Math.sin(t * 0.0002) + 1) / 2, palette);
    const c2 = getColor((Math.cos(t * 0.00015) + 1) / 2, palette);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function frame(ts) {
    if (!isRunning || !canvas) return;
    if (!startTime) startTime = ts;
    const t = ts - startTime;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const paletteIdx = Math.floor(t / 18000) % PALETTES.length;
    const palette = PALETTES[paletteIdx];

    ctx.fillStyle = 'rgba(10,10,11,0.06)';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    particles.forEach(p => {
        p.phase += p.phaseSpeed;
        p.x += p.vx + Math.sin(p.phase) * 0.2;
        p.y += p.vy + Math.cos(p.phase * 0.8) * 0.2;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
        const alpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(p.phase));
        const col = getColor((p.hueShift + t * 0.00005) % 1, palette);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    drawFractalCurve(t, palette, w, h);
    drawFractalCurve(t * 0.7 + 1000, palette, w, h);
    ctx.globalCompositeOperation = 'source-over';

    rafId = requestAnimationFrame(frame);
}

function start() {
    if (isRunning) return;
    buildCanvas();
    spawnParticles();
    fractalSeed = Math.random() * 1000;
    isRunning = true;
    canvas.classList.add('show');
    mouseStartX = -1;
    mouseStartY = -1;
    startTime = 0;
    startAudio();
    rafId = requestAnimationFrame(frame);
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:dream-start');
    }
}

function stop() {
    if (!isRunning) return;
    isRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    stopAudio();
    if (canvas) {
        canvas.classList.remove('show');
        if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
    mouseStartX = -1;
    mouseStartY = -1;
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:dream-end');
    }
}

function wakeUp() {
    if (!isRunning) return;
    stop();
    if (typeof window.unlockScreen === 'function') {
        try { window.unlockScreen(); } catch (e) {}
    } else if (window.MXOS.system && typeof window.MXOS.system.unlock === 'function') {
        try { window.MXOS.system.unlock(); } catch (e) {}
    } else {
        const lockScreen = document.getElementById('lock-screen');
        if (lockScreen) {
            lockScreen.classList.add('hidden');
            lockScreen.style.display = 'none';
        }
    }
}

function onLock() {
    if (lockTimer) clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
        start();
    }, TRIGGER_DELAY);
}

function onUnlock() {
    if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
    }
    if (isRunning) stop();
}

function isEnabled() {
    try { return localStorage.getItem('mxos_dream_enabled') === '1'; } catch (e) { return false; }
}

function setEnabled(v) {
    try { localStorage.setItem('mxos_dream_enabled', v ? '1' : '0'); } catch (e) {}
    if (!v && isRunning) stop();
}

function init() {
    try {
        injectStyles();
        window.MXOS.Features.dreamMode = {
            start, stop, wakeUp, isEnabled, setEnabled,
            isRunning: () => isRunning
        };
        if (window.MXOS.events && typeof window.MXOS.events.on === 'function') {
            window.MXOS.events.on('system:lock', onLock);
            window.MXOS.events.on('system:unlock', onUnlock);
        } else {
            window.addEventListener('system:lock', onLock);
            window.addEventListener('system:unlock', onUnlock);
        }
        window.addEventListener('mxos:unlock', onUnlock);
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, wakeUp, setEnabled, isEnabled };
