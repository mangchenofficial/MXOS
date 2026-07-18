window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const REFRESH_INTERVAL = 30 * 60 * 1000;
const STORAGE_KEY = 'mxos_weather_cache';

let canvas = null;
let ctx = null;
let rafId = null;
let particles = [];
let currentWeather = null;
let trayEl = null;
let refreshTimer = null;
let listeners = new Set();
let lastTime = 0;

const WEATHER_ICONS = {
    clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
    'partly-cloudy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="3"/><path d="M17 18a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5"/></svg>',
    cloudy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 18a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A4 4 0 0 0 7 18h10z"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9h18M3 13h18M3 17h12"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A4 4 0 0 0 7 14"/><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A4 4 0 0 0 7 14"/><path d="M8 18v3M12 18v3M16 18v3"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A4 4 0 0 0 7 14"/><path d="M8 19l.5.5M12 19l.5.5M16 19l.5.5M8 21l.5-.5M12 21l.5-.5M16 21l.5-.5"/></svg>',
    thunderstorm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 14a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A4 4 0 0 0 7 14"/><path d="M13 16l-3 4h3l-2 3"/></svg>',
    unknown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 18v.5"/></svg>'
};

function injectStyles() {
    if (document.getElementById('mxos-weather-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-weather-styles';
    style.textContent = `
#mxosWeatherCanvas {
    position: fixed; inset: 0;
    z-index: 1;
    pointer-events: none;
    display: block;
}
.mxos-weather-tray {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0 8px;
    height: 28px;
    color: var(--text-primary, #e5e7eb);
    cursor: pointer;
    border-radius: 6px;
    transition: background 150ms ease;
    font-size: 12px;
}
.mxos-weather-tray:hover { background: rgba(255,255,255,0.08); }
.mxos-weather-tray svg { width: 16px; height: 16px; color: var(--accent-color, #60a5fa); }
.mxos-weather-temp { font-variant-numeric: tabular-nums; }
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosWeatherCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    const wallpaper = document.getElementById('wallpaper') || document.getElementById('desktop');
    if (wallpaper && wallpaper.parentElement) {
        wallpaper.parentElement.insertBefore(canvas, wallpaper.nextSibling);
    } else {
        document.body.insertBefore(canvas, document.body.firstChild);
    }
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
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

function spawnParticles(icon) {
    particles = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (icon === 'rain' || icon === 'drizzle' || icon === 'thunderstorm') {
        const count = icon === 'drizzle' ? 80 : 160;
        for (let i = 0; i < count; i++) {
            particles.push({
                kind: 'rain',
                x: Math.random() * w,
                y: Math.random() * h,
                vy: 8 + Math.random() * 6,
                vx: -1.5,
                len: 12 + Math.random() * 10,
                opacity: 0.3 + Math.random() * 0.3
            });
        }
    } else if (icon === 'snow') {
        const count = 90;
        for (let i = 0; i < count; i++) {
            particles.push({
                kind: 'snow',
                x: Math.random() * w,
                y: Math.random() * h,
                vy: 0.6 + Math.random() * 1.2,
                vx: -0.4 + Math.random() * 0.8,
                r: 1 + Math.random() * 2.5,
                phase: Math.random() * Math.PI * 2,
                phaseSpeed: 0.02 + Math.random() * 0.02,
                opacity: 0.5 + Math.random() * 0.4
            });
        }
    } else if (icon === 'clear') {
        const count = 14;
        for (let i = 0; i < count; i++) {
            particles.push({
                kind: 'sunbeam',
                x: Math.random() * w,
                y: Math.random() * h * 0.6,
                r: 40 + Math.random() * 80,
                opacity: 0.05 + Math.random() * 0.08,
                phase: Math.random() * Math.PI * 2,
                phaseSpeed: 0.005 + Math.random() * 0.005
            });
        }
    } else if (icon === 'fog') {
        const count = 8;
        for (let i = 0; i < count; i++) {
            particles.push({
                kind: 'fog',
                x: Math.random() * w,
                y: h * 0.3 + Math.random() * h * 0.5,
                vx: 0.3 + Math.random() * 0.4,
                r: 200 + Math.random() * 200,
                opacity: 0.06 + Math.random() * 0.06
            });
        }
    }
}

function updateAndDraw(dt) {
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    const f = dt / 16;

    particles.forEach(p => {
        if (p.kind === 'rain') {
            p.x += p.vx * f;
            p.y += p.vy * f;
            if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
            if (p.x < -20) p.x = w;
            ctx.strokeStyle = `rgba(180,200,220,${p.opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.vx * 2, p.y + p.len);
            ctx.stroke();
        } else if (p.kind === 'snow') {
            p.phase += p.phaseSpeed * f;
            p.x += (p.vx + Math.sin(p.phase) * 0.5) * f;
            p.y += p.vy * f;
            if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
            ctx.fillStyle = `rgba(240,245,255,${p.opacity})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.kind === 'sunbeam') {
            p.phase += p.phaseSpeed * f;
            const a = p.opacity * (0.5 + 0.5 * Math.sin(p.phase));
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grad.addColorStop(0, `rgba(255,220,150,${a})`);
            grad.addColorStop(1, 'rgba(255,220,150,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.kind === 'fog') {
            p.x += p.vx * f;
            if (p.x > w + p.r) p.x = -p.r;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grad.addColorStop(0, `rgba(220,225,235,${p.opacity})`);
            grad.addColorStop(1, 'rgba(220,225,235,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function frame(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(64, ts - lastTime);
    lastTime = ts;
    updateAndDraw(dt);
    rafId = requestAnimationFrame(frame);
}

function getIconForCode(code, isDay) {
    if (code === 0 || code === 1) return isDay === false ? 'clear' : 'clear';
    if (code === 2) return 'partly-cloudy';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code >= 61 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code >= 85 && code <= 86) return 'snow';
    if (code >= 95) return 'thunderstorm';
    return 'unknown';
}

function buildTray() {
    if (trayEl) return;
    const trayRight = document.querySelector('.taskbar-right');
    if (!trayRight) return;
    trayEl = document.createElement('div');
    trayEl.className = 'mxos-weather-tray';
    trayEl.setAttribute('role', 'button');
    trayEl.setAttribute('tabindex', '0');
    trayEl.setAttribute('aria-label', '桌面天气');
    trayEl.innerHTML = `<span class="mxos-weather-icon">${WEATHER_ICONS.unknown}</span><span class="mxos-weather-temp">--°</span>`;
    trayEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showPanel();
    });
    trayRight.insertBefore(trayEl, trayRight.firstChild);
}

function updateTray() {
    if (!trayEl || !currentWeather) return;
    const icon = WEATHER_ICONS[currentWeather.icon] || WEATHER_ICONS.unknown;
    trayEl.querySelector('.mxos-weather-icon').innerHTML = icon;
    trayEl.querySelector('.mxos-weather-temp').textContent = Math.round(currentWeather.temperature) + '°';
    trayEl.setAttribute('aria-label', `天气：${currentWeather.description}，${Math.round(currentWeather.temperature)}度`);
}

let panelEl = null;

function showPanel() {
    if (!panelEl) buildPanel();
    panelEl.classList.add('show');
    refreshPanel();
}

function buildPanel() {
    panelEl = document.createElement('div');
    panelEl.id = 'mxosWeatherPanel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', '桌面天气');
    panelEl.innerHTML = `<div class="mxos-weather-panel-inner"></div>`;
    document.body.appendChild(panelEl);
    document.addEventListener('click', (e) => {
        if (!panelEl.classList.contains('show')) return;
        if (e.target.closest('#mxosWeatherPanel')) return;
        if (e.target.closest('.mxos-weather-tray')) return;
        panelEl.classList.remove('show');
    });
}

function refreshPanel() {
    if (!panelEl) return;
    const inner = panelEl.querySelector('.mxos-weather-panel-inner');
    if (!inner) return;
    if (!currentWeather) {
        inner.innerHTML = '<div class="mxos-wp-loading">正在获取天气…</div>';
        return;
    }
    inner.innerHTML = `
        <div class="mxos-wp-head">
            <div class="mxos-wp-icon">${WEATHER_ICONS[currentWeather.icon] || WEATHER_ICONS.unknown}</div>
            <div class="mxos-wp-main">
                <div class="mxos-wp-temp">${Math.round(currentWeather.temperature)}°C</div>
                <div class="mxos-wp-desc">${currentWeather.description}</div>
            </div>
        </div>
        <div class="mxos-wp-meta">
            <div class="mxos-wp-meta-item"><span>风速</span><b>${Math.round(currentWeather.windspeed)} km/h</b></div>
            <div class="mxos-wp-meta-item"><span>风向</span><b>${Math.round(currentWeather.winddirection)}°</b></div>
            <div class="mxos-wp-meta-item"><span>更新</span><b>${new Date(currentWeather.fetchedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</b></div>
        </div>
    `;
}

function injectPanelStyles() {
    if (document.getElementById('mxos-weather-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-weather-panel-styles';
    style.textContent = `
#mxosWeatherPanel {
    position: fixed;
    bottom: 56px;
    right: 12px;
    z-index: 3500;
    width: 280px;
    background: rgba(20,22,28,0.78);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.5);
    color: #e5e7eb;
    overflow: hidden;
    transform: translateY(12px) scale(0.96);
    opacity: 0;
    pointer-events: none;
    transition: transform 220ms var(--ease-out, ease), opacity 200ms ease;
}
#mxosWeatherPanel.show { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
.mxos-weather-panel-inner { padding: 16px; }
.mxos-wp-head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.mxos-wp-icon { color: var(--accent-color, #60a5fa); }
.mxos-wp-icon svg { width: 40px; height: 40px; }
.mxos-wp-temp { font-size: 28px; font-weight: 600; color: #fff; }
.mxos-wp-desc { font-size: 13px; color: #cbd5e1; margin-top: 2px; }
.mxos-wp-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
.mxos-wp-meta-item { display: flex; flex-direction: column; gap: 2px; font-size: 11px; }
.mxos-wp-meta-item span { color: #9ca3af; }
.mxos-wp-meta-item b { color: #e5e7eb; font-weight: 500; }
.mxos-wp-loading { padding: 24px 0; text-align: center; color: #9ca3af; font-size: 12px; }
body.reduce-motion #mxosWeatherPanel { transition: none !important; }
    `;
    document.head.appendChild(style);
}

async function refresh() {
    try {
        let w = null;
        if (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.weather === 'function') {
            w = await window.MXOS.Real.weather(true);
        }
        if (!w) return;
        const icon = getIconForCode(w.weathercode, w.isDay);
        currentWeather = Object.assign({}, w, { icon });
        spawnParticles(icon);
        updateTray();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentWeather)); } catch (e) {}
        listeners.forEach(fn => {
            try { fn(currentWeather); } catch (e) {}
        });
        if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
            window.MXOS.events.emit('mxos:weather-change', currentWeather);
        }
        if (panelEl && panelEl.classList.contains('show')) refreshPanel();
    } catch (e) {}
}

function onWeatherChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function get() {
    return currentWeather ? Object.assign({}, currentWeather) : null;
}

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
    injectPanelStyles();
    buildCanvas();
    waitForTaskbar(buildTray);
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            currentWeather = JSON.parse(cached);
            if (currentWeather) {
                spawnParticles(currentWeather.icon);
                updateTray();
            }
        }
    } catch (e) {}
    rafId = requestAnimationFrame(frame);
    window.MXOS.Features.weather = {
        get, refresh, onWeatherChange,
        isRunning: () => !!rafId
    };
    setTimeout(refresh, 1500);
    refreshTimer = setInterval(refresh, REFRESH_INTERVAL);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { get, refresh, onWeatherChange };
