window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const PHASE_INHALE = 4000;
const PHASE_HOLD = 7000;
const PHASE_EXHALE = 8000;
const CYCLE = PHASE_INHALE + PHASE_HOLD + PHASE_EXHALE;

const PHASE_TEXT = {
    inhale: '吸气 · 让光进入身体',
    hold: '屏息 · 留住这一刻的宁静',
    exhale: '呼气 · 把一切放下'
};

let overlayEl = null;
let glowEl = null;
let textEl = null;
let targetWindow = null;
let originalTransform = '';
let originalTransition = '';
let rafId = null;
let startTime = 0;
let isRunning = false;
let currentPhase = 'inhale';
let audioCtx = null;
let audioNodes = [];

function injectStyles() {
    if (document.getElementById('mxos-meditation-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-meditation-styles';
    style.textContent = `
.mxos-meditation-glow {
    position: fixed; inset: 0;
    z-index: 9998;
    pointer-events: none;
    background: radial-gradient(circle at 50% 50%, rgba(96,165,250,0.12), rgba(96,165,250,0) 60%);
    opacity: 0;
    transition: opacity 800ms ease;
}
.mxos-meditation-glow.show { opacity: 1; }
.mxos-meditation-text {
    position: fixed;
    top: 18%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: none;
    color: var(--text-primary, #f3f4f6);
    font-size: 18px;
    font-weight: 300;
    letter-spacing: 4px;
    text-shadow: 0 2px 12px rgba(0,0,0,0.6);
    opacity: 0;
    transition: opacity 600ms ease;
    background: rgba(20,22,28,0.55);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 12px 24px;
    border-radius: 24px;
}
.mxos-meditation-text.show { opacity: 1; }
body.reduce-motion .mxos-meditation-glow,
body.reduce-motion .mxos-meditation-text { transition: none !important; }
    `;
    document.head.appendChild(style);
}

function buildOverlay() {
    if (glowEl) return;
    glowEl = document.createElement('div');
    glowEl.className = 'mxos-meditation-glow';
    glowEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glowEl);

    textEl = document.createElement('div');
    textEl.className = 'mxos-meditation-text';
    textEl.setAttribute('role', 'status');
    textEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(textEl);
}

function startAudio() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
        const master = audioCtx.createGain();
        master.gain.value = 0;
        master.connect(audioCtx.destination);
        master.gain.setTargetAtTime(0.08, audioCtx.currentTime, 1.5);

        [220, 277, 330].forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            const g = audioCtx.createGain();
            g.gain.value = 0.2;
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 0.08 + i * 0.04;
            const lfoG = audioCtx.createGain();
            lfoG.gain.value = 0.1;
            lfo.connect(lfoG);
            lfoG.connect(g.gain);
            osc.connect(g);
            g.connect(master);
            osc.start();
            lfo.start();
            audioNodes.push(osc, lfo, g, lfoG);
        });
        audioNodes.push(master);
    } catch (e) {}
}

function stopAudio() {
    if (!audioCtx) return;
    try {
        const master = audioNodes[audioNodes.length - 1];
        if (master && master.gain) master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
    } catch (e) {}
    setTimeout(() => {
        audioNodes.forEach(n => {
            try { if (n.stop) n.stop(); } catch (e) {}
            try { if (n.disconnect) n.disconnect(); } catch (e) {}
        });
        audioNodes = [];
        try { audioCtx.close(); } catch (e) {}
        audioCtx = null;
    }, 600);
}

function getActiveWindowEl() {
    const w = window.MXOS && window.MXOS.state && window.MXOS.state.activeWindow;
    if (w) return w;
    const els = document.querySelectorAll('.window:not(.minimized)');
    if (!els.length) return null;
    let top = null;
    let topZ = -1;
    els.forEach(el => {
        const z = parseInt(el.style.zIndex) || 0;
        if (z > topZ) { topZ = z; top = el; }
    });
    return top;
}

function setPhase(p) {
    if (currentPhase === p) return;
    currentPhase = p;
    if (textEl) {
        textEl.classList.remove('show');
        setTimeout(() => {
            textEl.textContent = PHASE_TEXT[p];
            textEl.classList.add('show');
        }, 300);
    }
}

function frame(ts) {
    if (!isRunning || !targetWindow) return;
    if (!startTime) {
        startTime = ts;
        setPhase('inhale');
    }
    const elapsed = (ts - startTime) % CYCLE;
    let phase;
    let scale;
    if (elapsed < PHASE_INHALE) {
        phase = 'inhale';
        const t = elapsed / PHASE_INHALE;
        scale = 1 + 0.02 * easeInOut(t);
    } else if (elapsed < PHASE_INHALE + PHASE_HOLD) {
        phase = 'hold';
        scale = 1.02;
    } else {
        phase = 'exhale';
        const t = (elapsed - PHASE_INHALE - PHASE_HOLD) / PHASE_EXHALE;
        scale = 1.02 - 0.02 * easeInOut(t);
    }
    setPhase(phase);
    targetWindow.style.transform = `scale(${scale.toFixed(4)})`;

    if (glowEl) {
        const glowT = phase === 'inhale' ? (elapsed / PHASE_INHALE) :
            phase === 'hold' ? 1 :
            1 - ((elapsed - PHASE_INHALE - PHASE_HOLD) / PHASE_EXHALE);
        glowEl.style.opacity = (0.4 + 0.6 * glowT).toFixed(3);
    }

    rafId = requestAnimationFrame(frame);
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function start() {
    if (isRunning) return;
    const el = getActiveWindowEl();
    if (!el) {
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            try {
                window.MXOS.notify({ title: '窗口冥想', body: '请先打开一个窗口再开始冥想', type: 'info', duration: 3000 });
            } catch (e) {}
        }
        return false;
    }
    injectStyles();
    buildOverlay();
    targetWindow = el;
    originalTransform = el.style.transform;
    originalTransition = el.style.transition;
    el.style.transition = 'none';
    isRunning = true;
    startTime = 0;
    currentPhase = '';
    glowEl.classList.add('show');
    textEl.textContent = PHASE_TEXT.inhale;
    textEl.classList.add('show');
    startAudio();
    rafId = requestAnimationFrame(frame);
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:meditation-start');
    }
    return true;
}

function stop() {
    if (!isRunning) return;
    isRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (targetWindow) {
        targetWindow.style.transition = 'transform 600ms ease';
        targetWindow.style.transform = originalTransform;
        setTimeout(() => {
            if (targetWindow) {
                targetWindow.style.transition = originalTransition;
            }
        }, 600);
        targetWindow = null;
    }
    if (glowEl) glowEl.classList.remove('show');
    if (textEl) {
        textEl.classList.remove('show');
        setTimeout(() => { if (textEl) textEl.textContent = ''; }, 400);
    }
    stopAudio();
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:meditation-end');
    }
}

function toggle() {
    if (isRunning) {
        stop();
        return false;
    }
    return start();
}

function onKeydown(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
    } else if (e.key === 'Escape' && isRunning) {
        stop();
    }
}

function init() {
    injectStyles();
    window.MXOS.Features.meditation = {
        start, stop, toggle,
        isRunning: () => isRunning,
        phases: ['inhale', 'hold', 'exhale']
    };
    document.addEventListener('keydown', onKeydown);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, toggle };
