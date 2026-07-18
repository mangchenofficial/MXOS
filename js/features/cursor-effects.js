window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_cursor_fx';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TRAIL_STYLES = ['particle', 'ribbon', 'stardust', 'rainbow', 'ink'];
const CURSOR_THEMES = ['default', 'pixel', 'handdrawn', 'minimal', 'magic'];

let settings = { enabled: false, trail: 'particle', theme: 'default' };
let canvas = null;
let ctx = null;
let rafId = null;
let particles = [];
let lastX = 0;
let lastY = 0;
let lastSpawn = 0;

function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        settings = { enabled: false, trail: 'particle', theme: 'default', ...s };
    } catch {}
}
function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-cursor-fx-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-cursor-fx-styles';
    style.textContent = `
#mxosCursorFxCanvas {
    position: fixed; inset: 0;
    z-index: 9999;
    pointer-events: none;
    display: block;
}
body.cursor-fx-pixel, body.cursor-fx-pixel * { cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><rect x='0' y='0' width='8' height='8' fill='black'/><rect x='8' y='8' width='8' height='8' fill='black'/></svg>") 0 0, default !important; }
body.cursor-fx-minimal { cursor: crosshair; }
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosCursorFxCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
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
    if (prefersReduced) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const dist = Math.hypot(dx, dy);
    if (now - lastSpawn > 16 && dist > 1) {
        lastSpawn = now;
        spawnTrail(e.clientX, e.clientY, dx, dy);
    }
    lastX = e.clientX;
    lastY = e.clientY;
}

function onPointerDown(e) {
    if (prefersReduced) return;
    spawnBurst(e.clientX, e.clientY);
    spawnRipple(e.clientX, e.clientY);
}

function spawnTrail(x, y, dx, dy) {
    const style = settings.trail;
    if (style === 'particle') {
        for (let i = 0; i < 2; i++) {
            particles.push({ type: 'p', x, y, vx: dx * 0.04 + (Math.random() - 0.5) * 0.6, vy: dy * 0.04 + (Math.random() - 0.5) * 0.6 - 0.3, life: 1, r: 1.5 + Math.random() * 1.5, color: '255,255,255' });
        }
    } else if (style === 'ribbon') {
        particles.push({ type: 'p', x, y, vx: 0, vy: 0, life: 1, r: 3, color: '200,200,210', ribbon: true, decay: 0.04 });
    } else if (style === 'stardust') {
        for (let i = 0; i < 3; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = 0.4 + Math.random();
            particles.push({ type: 'p', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, r: 0.8 + Math.random() * 1.5, color: '255,240,200', star: true, decay: 0.025 });
        }
    } else if (style === 'rainbow') {
        const hue = (performance.now() * 0.2) % 360;
        const rgb = hslToRgb(hue / 360, 0.7, 0.6);
        particles.push({ type: 'p', x, y, vx: dx * 0.02, vy: dy * 0.02 - 0.2, life: 1, r: 2.5, color: `${rgb[0]},${rgb[1]},${rgb[2]}`, decay: 0.03 });
    } else if (style === 'ink') {
        for (let i = 0; i < 2; i++) {
            particles.push({ type: 'p', x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, life: 1, r: 2 + Math.random() * 2, color: '20,20,25', ink: true, decay: 0.02 });
        }
    }
}

function spawnBurst(x, y) {
    const count = 12;
    for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const sp = 2 + Math.random() * 2;
        particles.push({ type: 'p', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, r: 1.8, color: '255,255,255', decay: 0.03 });
    }
}

function spawnRipple(x, y) {
    particles.push({ type: 'r', x, y, r: 0, life: 1 });
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function frame() {
    if (!settings.enabled) return;
    rafId = requestAnimationFrame(frame);
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.type === 'p') {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.02;
            p.life -= p.decay || 0.025;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.fillStyle = `rgba(${p.color},${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'r') {
            p.r += 2.5;
            p.life -= 0.025;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.strokeStyle = `rgba(255,255,255,${p.life * 0.5})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function start() {
    if (!settings.enabled) return;
    buildCanvas();
    if (!rafId) rafId = requestAnimationFrame(frame);
    applyTheme();
}

function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    particles = [];
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyTheme();
}

function applyTheme() {
    document.body.classList.remove('cursor-fx-pixel', 'cursor-fx-handdrawn', 'cursor-fx-minimal', 'cursor-fx-magic');
    if (settings.theme !== 'default' && settings.enabled) {
        document.body.classList.add('cursor-fx-' + settings.theme);
    }
}

function setEnabled(v) {
    settings.enabled = !!v;
    saveSettings();
    if (v) start(); else stop();
}

function setTrail(style) {
    if (!TRAIL_STYLES.includes(style)) return false;
    settings.trail = style;
    saveSettings();
    return true;
}

function setTheme(theme) {
    if (!CURSOR_THEMES.includes(theme)) return false;
    settings.theme = theme;
    saveSettings();
    applyTheme();
    return true;
}

function getSettings() { return { ...settings }; }
function trailStyles() { return [...TRAIL_STYLES]; }
function themes() { return [...CURSOR_THEMES]; }

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-cursorFx')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">鼠标光标特效</div>
                <div class="settings-card-desc">拖尾粒子 + 点击星爆与涟漪</div>
            </div>
            <div class="toggle-switch ${settings.enabled ? 'on' : ''}" id="setting-cursorFx" role="switch" aria-checked="${settings.enabled}"></div>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-cursorFx').addEventListener('click', () => {
            const next = !settings.enabled;
            setEnabled(next);
            section.querySelector('#setting-cursorFx').classList.toggle('on', next);
            section.querySelector('#setting-cursorFx').setAttribute('aria-checked', next ? 'true' : 'false');
        });
        const trailSection = document.createElement('div');
        trailSection.className = 'settings-card';
        trailSection.innerHTML = `
            <div class="settings-card-title">拖尾样式</div>
            <select class="settings-select" id="setting-cursorTrail">
                ${TRAIL_STYLES.map(s => `<option value="${s}" ${s === settings.trail ? 'selected' : ''}>${trailLabel(s)}</option>`).join('')}
            </select>
        `;
        mainEl.appendChild(trailSection);
        trailSection.querySelector('#setting-cursorTrail').addEventListener('change', (e) => setTrail(e.target.value));
        const themeSection = document.createElement('div');
        themeSection.className = 'settings-card';
        themeSection.innerHTML = `
            <div class="settings-card-title">光标主题</div>
            <select class="settings-select" id="setting-cursorTheme">
                ${CURSOR_THEMES.map(t => `<option value="${t}" ${t === settings.theme ? 'selected' : ''}>${themeLabel(t)}</option>`).join('')}
            </select>
        `;
        mainEl.appendChild(themeSection);
        themeSection.querySelector('#setting-cursorTheme').addEventListener('change', (e) => setTheme(e.target.value));
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function trailLabel(s) {
    const m = { particle: '粒子', ribbon: '光带', stardust: '星轨', rainbow: '彩虹', ink: '水墨' };
    return m[s] || s;
}
function themeLabel(t) {
    const m = { default: '默认', pixel: '像素', handdrawn: '手绘', minimal: '极简', magic: '魔法' };
    return m[t] || t;
}

function init() {
    try {
        loadSettings();
        injectStyles();
        injectSettingsIntoPanel();
        if (settings.enabled) start();
        window.MXOS.Features.cursorFx = {
            setEnabled, setTrail, setTheme, getSettings, trailStyles, themes
        };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, setTrail, setTheme, getSettings };
