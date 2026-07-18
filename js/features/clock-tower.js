window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const ENABLE_KEY = 'mxos_clock_tower_enabled';
const POS_KEY = 'mxos_clock_tower_pos';
const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

let towerEl = null;
let rafId = null;
let audioCtx = null;
let lastChimeHour = -1;
let gearRotation = 0;
let lastFrameTime = 0;

function injectStyles() {
    if (document.getElementById('mxos-clock-tower-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-clock-tower-styles';
    style.textContent = `
#mxosClockTower {
    position: fixed;
    z-index: 1100;
    width: 200px;
    height: 280px;
    pointer-events: auto;
    opacity: 0;
    transform: scale(0.9);
    transition: opacity 400ms ease, transform 400ms cubic-bezier(0.34,1.56,0.64,1);
}
#mxosClockTower.show { opacity: 1; transform: scale(1); }
#mxosClockTower.pos-top-left { top: 20px; left: 20px; }
#mxosClockTower.pos-top-right { top: 20px; right: 20px; }
#mxosClockTower.pos-bottom-left { bottom: 60px; left: 20px; }
#mxosClockTower.pos-bottom-right { bottom: 60px; right: 20px; }
#mxosClockTower svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 8px 24px rgba(0,0,0,0.4)); }
.mxos-ct-gear { transform-origin: center; transition: transform 100ms linear; }
body.reduce-motion #mxosClockTower { transition: none !important; }
body.reduce-motion .mxos-ct-gear { transition: none !important; }
    `;
    document.head.appendChild(style);
}

function buildTower() {
    if (towerEl) return;
    towerEl = document.createElement('div');
    towerEl.id = 'mxosClockTower';
    towerEl.setAttribute('role', 'img');
    towerEl.setAttribute('aria-label', '桌面时钟塔');
    towerEl.innerHTML = `
<svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="ctBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3a3633"/>
            <stop offset="100%" stop-color="#1a1815"/>
        </linearGradient>
        <radialGradient id="ctFace" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f5f0e1"/>
            <stop offset="100%" stop-color="#d4c9a8"/>
        </radialGradient>
        <linearGradient id="ctRoof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#5a4a3a"/>
            <stop offset="100%" stop-color="#2a221a"/>
        </linearGradient>
    </defs>

    <path d="M30 70 L100 20 L170 70 Z" fill="url(#ctRoof)" stroke="#1a1410" stroke-width="1"/>
    <path d="M30 70 L170 70" stroke="#1a1410" stroke-width="0.5"/>

    <rect x="50" y="70" width="100" height="20" fill="url(#ctBody)" stroke="#1a1410" stroke-width="1"/>

    <rect x="40" y="90" width="120" height="170" fill="url(#ctBody)" stroke="#1a1410" stroke-width="1.2" rx="4"/>

    <circle cx="100" cy="160" r="48" fill="url(#ctFace)" stroke="#1a1410" stroke-width="2"/>
    <circle cx="100" cy="160" r="48" fill="none" stroke="#8a7a5a" stroke-width="0.6"/>

    <g stroke="#1a1410" stroke-width="1.5" stroke-linecap="round">
        <line x1="100" y1="118" x2="100" y2="124"/>
        <line x1="142" y1="160" x2="136" y2="160"/>
        <line x1="100" y1="202" x2="100" y2="196"/>
        <line x1="58" y1="160" x2="64" y2="160"/>
    </g>
    <g stroke="#8a7a5a" stroke-width="0.8" stroke-linecap="round">
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(30 100 160)"/>
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(60 100 160)"/>
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(120 100 160)"/>
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(150 100 160)"/>
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(210 100 160)"/>
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(240 100 160)"/>
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(300 100 160)"/>
        <line x1="100" y1="120" x2="100" y2="124" transform="rotate(330 100 160)"/>
    </g>

    <g class="mxos-ct-gear" id="ctGear1" style="transform-origin: 70px 220px;">
        <circle cx="70" cy="220" r="12" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
        <g stroke="rgba(255,255,255,0.3)" stroke-width="1.2" fill="none">
            <rect x="68" y="206" width="4" height="3"/>
            <rect x="68" y="231" width="4" height="3"/>
            <rect x="56" y="218" width="3" height="4"/>
            <rect x="81" y="218" width="3" height="4"/>
        </g>
        <circle cx="70" cy="220" r="3" fill="rgba(255,255,255,0.5)" stroke="none"/>
    </g>
    <g class="mxos-ct-gear" id="ctGear2" style="transform-origin: 130px 220px;">
        <circle cx="130" cy="220" r="10" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>
        <g stroke="rgba(255,255,255,0.3)" stroke-width="1.2" fill="none">
            <rect x="128" y="208" width="4" height="3"/>
            <rect x="128" y="229" width="4" height="3"/>
            <rect x="118" y="218" width="3" height="4"/>
            <rect x="139" y="218" width="3" height="4"/>
        </g>
        <circle cx="130" cy="220" r="2.5" fill="rgba(255,255,255,0.5)" stroke="none"/>
    </g>

    <line id="ctHourHand" x1="100" y1="160" x2="100" y2="130" stroke="rgba(255,255,255,0.85)" stroke-width="3.5" stroke-linecap="round"/>
    <line id="ctMinHand" x1="100" y1="160" x2="100" y2="118" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round"/>
    <line id="ctSecHand" x1="100" y1="160" x2="100" y2="112" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="100" cy="160" r="3.5" fill="rgba(255,255,255,0.85)" stroke="none"/>
    <circle cx="100" cy="160" r="1.5" fill="rgba(255,255,255,0.5)" stroke="none"/>

    <rect x="48" y="80" width="6" height="8" fill="rgba(255,255,255,0.3)" stroke="none"/>
    <rect x="146" y="80" width="6" height="8" fill="rgba(255,255,255,0.3)" stroke="none"/>
</svg>
    `;
    document.body.appendChild(towerEl);
}

function updateHands() {
    if (!towerEl) return;
    const now = new Date();
    const ms = now.getMilliseconds();
    const sec = now.getSeconds() + ms / 1000;
    const min = now.getMinutes() + sec / 60;
    const hour = (now.getHours() % 12) + min / 60;
    const hourAngle = hour * 30;
    const minAngle = min * 6;
    const secAngle = sec * 6;
    const hourHand = towerEl.querySelector('#ctHourHand');
    const minHand = towerEl.querySelector('#ctMinHand');
    const secHand = towerEl.querySelector('#ctSecHand');
    if (hourHand) hourHand.setAttribute('transform', `rotate(${hourAngle} 100 160)`);
    if (minHand) minHand.setAttribute('transform', `rotate(${minAngle} 100 160)`);
    if (secHand) secHand.setAttribute('transform', `rotate(${secAngle} 100 160)`);
}

function checkChime() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    if (m === 0 && s < 2 && h !== lastChimeHour) {
        lastChimeHour = h;
        playChime();
        spinGears();
    }
}

function spinGears() {
    if (!towerEl) return;
    const g1 = towerEl.querySelector('#ctGear1');
    const g2 = towerEl.querySelector('#ctGear2');
    if (!g1 || !g2) return;
    let start = null;
    const duration = 3000;
    function step(ts) {
        if (!start) start = ts;
        const t = (ts - start) / duration;
        if (t >= 1) {
            g1.style.transform = 'rotate(0deg)';
            g2.style.transform = 'rotate(0deg)';
            return;
        }
        const angle = t * 720;
        g1.style.transform = `rotate(${angle}deg)`;
        g2.style.transform = `rotate(${-angle}deg)`;
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function playChime() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!audioCtx) audioCtx = new AC();
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        const now = audioCtx.currentTime;
        const notes = [
            { f: 392.0, t: 0 },
            { f: 523.25, t: 0.5 },
            { f: 659.25, t: 1.0 },
            { f: 783.99, t: 1.5 }
        ];
        notes.forEach(n => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = n.f;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0, now + n.t);
            g.gain.linearRampToValueAtTime(0.18, now + n.t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + n.t + 2.0);
            osc.connect(g);
            g.connect(audioCtx.destination);
            osc.start(now + n.t);
            osc.stop(now + n.t + 2.1);
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = n.f * 2;
            const g2 = audioCtx.createGain();
            g2.gain.setValueAtTime(0, now + n.t);
            g2.gain.linearRampToValueAtTime(0.05, now + n.t + 0.02);
            g2.gain.exponentialRampToValueAtTime(0.001, now + n.t + 1.5);
            osc2.connect(g2);
            g2.connect(audioCtx.destination);
            osc2.start(now + n.t);
            osc2.stop(now + n.t + 1.6);
        });
    } catch (e) {}
}

function frame(ts) {
    if (!lastFrameTime) lastFrameTime = ts;
    const dt = ts - lastFrameTime;
    lastFrameTime = ts;
    if (!document.body.classList.contains('reduce-motion')) {
        gearRotation += dt * 0.04;
        const g1 = towerEl && towerEl.querySelector('#ctGear1');
        const g2 = towerEl && towerEl.querySelector('#ctGear2');
        if (g1) g1.style.transform = `rotate(${gearRotation}deg)`;
        if (g2) g2.style.transform = `rotate(${-gearRotation}deg)`;
    }
    updateHands();
    checkChime();
    rafId = requestAnimationFrame(frame);
}

function isEnabled() {
    try { return localStorage.getItem(ENABLE_KEY) === '1'; } catch (e) { return false; }
}

function setEnabled(v) {
    try { localStorage.setItem(ENABLE_KEY, v ? '1' : '0'); } catch (e) {}
    if (v) start();
    else stop();
}

function getPosition() {
    try {
        const p = localStorage.getItem(POS_KEY);
        if (POSITIONS.indexOf(p) >= 0) return p;
    } catch (e) {}
    return 'top-right';
}

function setPosition(p) {
    if (POSITIONS.indexOf(p) < 0) return;
    try { localStorage.setItem(POS_KEY, p); } catch (e) {}
    if (towerEl) {
        POSITIONS.forEach(pos => towerEl.classList.remove('pos-' + pos));
        towerEl.classList.add('pos-' + p);
    }
}

function start() {
    if (!isEnabled()) return;
    injectStyles();
    buildTower();
    setPosition(getPosition());
    towerEl.classList.add('show');
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
}

function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (towerEl) {
        towerEl.classList.remove('show');
        setTimeout(() => {
            if (towerEl && !isEnabled()) {
                towerEl.remove();
                towerEl = null;
            }
        }, 400);
    }
}

function init() {
    injectStyles();
    window.MXOS.Features.clockTower = {
        isEnabled, setEnabled,
        getPosition, setPosition,
        start, stop,
        positions: POSITIONS.slice()
    };
    if (isEnabled()) setTimeout(start, 800);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { isEnabled, setEnabled, getPosition, setPosition, start, stop };
