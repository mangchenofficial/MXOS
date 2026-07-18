window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const SYNODIC_MONTH = 29.530588853;
const NEW_MOON_REF = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();

const PHASES = [
    { key: 'new', name: '新月', emoji: '🌑' },
    { key: 'waxing-crescent', name: '蛾眉月', emoji: '🌒' },
    { key: 'first-quarter', name: '上弦月', emoji: '🌓' },
    { key: 'waxing-gibbous', name: '盈凸月', emoji: '🌔' },
    { key: 'full', name: '满月', emoji: '🌕' },
    { key: 'waning-gibbous', name: '亏凸月', emoji: '🌖' },
    { key: 'last-quarter', name: '下弦月', emoji: '🌗' },
    { key: 'waning-crescent', name: '残月', emoji: '🌘' }
];

let trayEl = null;
let tipEl = null;
let lastPhaseIdx = -1;

function computePhase(date) {
    const t = date.getTime();
    let age = ((t - NEW_MOON_REF) / 86400000) % SYNODIC_MONTH;
    if (age < 0) age += SYNODIC_MONTH;
    const fraction = age / SYNODIC_MONTH;
    let idx;
    if (fraction < 0.0625 || fraction >= 0.9375) idx = 0;
    else if (fraction < 0.1875) idx = 1;
    else if (fraction < 0.3125) idx = 2;
    else if (fraction < 0.4375) idx = 3;
    else if (fraction < 0.5625) idx = 4;
    else if (fraction < 0.6875) idx = 5;
    else if (fraction < 0.8125) idx = 6;
    else idx = 7;
    return { age, fraction, idx, phase: PHASES[idx] };
}

function buildMoonSvg(phaseIdx) {
    const lit = moonLitRatio(phaseIdx);
    const waxing = phaseIdx >= 1 && phaseIdx <= 4;
    const r = 12;
    let path = '';
    if (phaseIdx === 0) {
        path = `<circle cx="12" cy="12" r="${r}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1"/>`;
    } else if (phaseIdx === 4) {
        path = `<circle cx="12" cy="12" r="${r}" fill="rgba(255,255,255,0.85)"/>`;
    } else {
        const rx = Math.abs(lit - 0.5) * 2 * r;
        const sweep1 = waxing ? 1 : 0;
        const sweep2 = lit > 0.5 ? 0 : 1;
        const sweep3 = lit > 0.5 ? 1 : 0;
        const largeArcOuter = 1;
        const largeArcInner = (lit > 0.5 && rx > 0.01) ? 0 : 1;
        const startAngle = -Math.PI / 2;
        const endAngle = Math.PI / 2;
        const topX = 12 + Math.cos(startAngle) * r;
        const topY = 12 + Math.sin(startAngle) * r;
        const bottomX = 12 + Math.cos(endAngle) * r;
        const bottomY = 12 + Math.sin(endAngle) * r;
        const innerSweep = waxing ? 0 : 1;
        const outerSweep = waxing ? 1 : 0;
        path = `
            <defs>
                <clipPath id="moonClip-${phaseIdx}"><circle cx="12" cy="12" r="${r}"/></clipPath>
            </defs>
            <circle cx="12" cy="12" r="${r}" fill="rgba(255,255,255,0.1)"/>
            <path d="M ${topX} ${topY} A ${r} ${r} 0 ${largeArcOuter} ${outerSweep} ${bottomX} ${bottomY} A ${rx} ${r} 0 ${largeArcInner} ${innerSweep} ${topX} ${topY} Z" fill="rgba(255,255,255,0.85)" clip-path="url(#moonClip-${phaseIdx})"/>
        `;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

function moonLitRatio(idx) {
    const map = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25];
    return map[idx];
}

function getLunarDate(date) {
    try {
        const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        return fmt.format(date);
    } catch (e) {
        return '';
    }
}

function injectStyles() {
    if (document.getElementById('mxos-moon-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-moon-styles';
    style.textContent = `
.mxos-moon-tray {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0 6px;
    height: 28px;
    color: var(--text-primary, #e5e7eb);
    cursor: help;
    border-radius: 6px;
    transition: background 150ms ease;
    position: relative;
}
.mxos-moon-tray:hover { background: rgba(255,255,255,0.08); }
.mxos-moon-tray svg { width: 18px; height: 18px; }
.mxos-moon-tip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    background: rgba(20,22,28,0.92);
    color: #f3f4f6;
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 180ms ease, transform 180ms ease;
    z-index: 9999;
}
.mxos-moon-tip.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.mxos-moon-tip-title { color: #fff; font-weight: 600; margin-bottom: 2px; }
.mxos-moon-tip-sub { color: #9ca3af; }
body.reduce-motion .mxos-moon-tray,
body.reduce-motion .mxos-moon-tip { transition: none !important; }
    `;
    document.head.appendChild(style);
}

function buildTray() {
    if (trayEl) return;
    const trayRight = document.querySelector('.taskbar-right');
    if (!trayRight) return;
    trayEl = document.createElement('div');
    trayEl.className = 'mxos-moon-tray';
    trayEl.setAttribute('role', 'button');
    trayEl.setAttribute('tabindex', '0');
    trayEl.setAttribute('aria-label', '月相');
    trayEl.innerHTML = `<span class="mxos-moon-icon"></span>`;
    tipEl = document.createElement('div');
    tipEl.className = 'mxos-moon-tip';
    trayEl.appendChild(tipEl);
    trayEl.addEventListener('mouseenter', () => tipEl.classList.add('show'));
    trayEl.addEventListener('mouseleave', () => tipEl.classList.remove('show'));
    trayEl.addEventListener('focus', () => tipEl.classList.add('show'));
    trayEl.addEventListener('blur', () => tipEl.classList.remove('show'));
    trayRight.insertBefore(trayEl, trayRight.firstChild);
}

function updateTray() {
    const info = computePhase(new Date());
    const iconEl = trayEl.querySelector('.mxos-moon-icon');
    if (iconEl) iconEl.innerHTML = buildMoonSvg(info.idx);
    const lunar = getLunarDate(new Date());
    if (tipEl) {
        tipEl.innerHTML = `<div class="mxos-moon-tip-title">${info.phase.name}</div><div class="mxos-moon-tip-sub">农历 ${lunar || '—'}</div>`;
    }
    trayEl.setAttribute('aria-label', `月相：${info.phase.name}`);
    if (lastPhaseIdx !== info.idx) {
        lastPhaseIdx = info.idx;
        if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
            window.MXOS.events.emit('mxos:moon-phase-change', { phase: info.phase, idx: info.idx });
        }
    }
}

function getCurrentPhase() {
    const info = computePhase(new Date());
    return {
        name: info.phase.name,
        key: info.phase.key,
        age: info.age,
        fraction: info.fraction,
        idx: info.idx,
        lunar: getLunarDate(new Date())
    };
}

function getMoonIcon(idx) {
    return buildMoonSvg(idx);
}

let updateTimer = null;

function waitForTaskbar(callback) {
    const tray = document.querySelector('.taskbar-right');
    if (tray) { callback(); return; }
    const observer = new MutationObserver(() => {
        if (document.querySelector('.taskbar-right')) {
            observer.disconnect();
            callback();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
}

function init() {
    injectStyles();
    waitForTaskbar(() => { buildTray(); updateTray(); });
    window.MXOS.Features.moon = {
        getCurrentPhase, getMoonIcon,
        phases: PHASES.slice()
    };
    updateTimer = setInterval(updateTray, 60 * 60 * 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getCurrentPhase, getMoonIcon };
