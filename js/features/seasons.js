window.MXOS = window.MXOS || {};

const STORAGE_KEY = 'mxos_seasons_enabled';

function getSeasonByMonth(month) {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
}

const SEASON_INFO = {
    spring: { name: '春', particle: 'sakura', color: '#fbcfe8' },
    summer: { name: '夏', particle: 'firefly', color: '#fde68a' },
    autumn: { name: '秋', particle: 'leaf', color: '#fb923c' },
    winter: { name: '冬', particle: 'snow', color: '#e0e7ff' }
};

let canvasEl = null;
let ctx = null;
let rafId = null;
let particles = [];
let enabled = false;
let lastTime = 0;
let currentSeason = null;

function isEnabled() {
    return enabled;
}

function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch (e) {}
    if (enabled) start();
    else stop();
}

function loadEnabled() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === null) return false;
        return v === '1';
    } catch (e) { return false; }
}

function getCurrent() {
    const m = new Date().getMonth() + 1;
    const key = getSeasonByMonth(m);
    return { key, name: SEASON_INFO[key].name, particle: SEASON_INFO[key].particle };
}

function injectStyles() {
    if (document.getElementById('mxos-seasons-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-seasons-styles';
    style.textContent = `
#mxosSeasonsCanvas {
    position: fixed; inset: 0;
    z-index: 1010;
    pointer-events: none;
    display: block;
}
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvasEl) return;
    canvasEl = document.createElement('canvas');
    canvasEl.id = 'mxosSeasonsCanvas';
    canvasEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvasEl);
    ctx = canvasEl.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
}

function resize() {
    if (!canvasEl) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = Math.round(window.innerWidth * dpr);
    canvasEl.height = Math.round(window.innerHeight * dpr);
    canvasEl.style.width = window.innerWidth + 'px';
    canvasEl.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawnParticles() {
    particles = [];
    const season = getCurrent().particle;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = season === 'firefly' ? 25 : 60;
    for (let i = 0; i < count; i++) {
        particles.push(createParticle(season, w, h, true));
    }
}

function createParticle(season, w, h, initial) {
    const p = {
        x: Math.random() * w,
        y: initial ? Math.random() * h : -20,
        season: season,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.04,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.02,
        size: 0,
        opacity: 0,
        extra: {}
    };
    if (season === 'sakura') {
        p.size = 6 + Math.random() * 8;
        p.vy = 0.5 + Math.random() * 1;
        p.vx = -0.5 + Math.random();
        p.opacity = 0.6 + Math.random() * 0.4;
    } else if (season === 'firefly') {
        p.size = 2 + Math.random() * 2;
        p.vy = -0.2 + Math.random() * 0.4;
        p.vx = -0.3 + Math.random() * 0.6;
        p.opacity = 0;
        p.glowPhase = Math.random() * Math.PI * 2;
        p.glowSpeed = 0.02 + Math.random() * 0.02;
    } else if (season === 'leaf') {
        p.size = 8 + Math.random() * 10;
        p.vy = 0.8 + Math.random() * 1.2;
        p.vx = -0.8 + Math.random() * 1.6;
        p.opacity = 0.7 + Math.random() * 0.3;
        const colors = ['#fb923c', '#f97316', '#dc2626', '#fbbf24', '#b45309'];
        p.extra.color = colors[Math.floor(Math.random() * colors.length)];
    } else if (season === 'snow') {
        p.size = 2 + Math.random() * 4;
        p.vy = 0.5 + Math.random() * 1.5;
        p.vx = -0.3 + Math.random() * 0.6;
        p.opacity = 0.6 + Math.random() * 0.4;
    }
    return p;
}

function updateParticle(p, w, h, dt) {
    const f = dt / 16;
    p.wobble += p.wobbleSpeed * f;
    p.x += (p.vx + Math.sin(p.wobble) * 0.5) * f;
    p.y += p.vy * f;
    p.rotation += p.rotationSpeed * f;

    if (p.season === 'firefly') {
        p.glowPhase += p.glowSpeed * f;
        p.opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(p.glowPhase));
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
    } else {
        if (p.y > h + 20 || p.x < -30 || p.x > w + 30) {
            Object.assign(p, createParticle(p.season, w, h, false));
        }
    }
}

function drawParticle(p) {
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    if (p.season === 'sakura') {
        drawSakura(p.size);
    } else if (p.season === 'firefly') {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#fde68a';
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
    } else if (p.season === 'leaf') {
        drawLeaf(p.size, p.extra.color);
    } else if (p.season === 'snow') {
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawSakura(size) {
    ctx.fillStyle = '#fbcfe8';
    for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -size / 2, size / 3, size / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(0, 0, size / 5, 0, Math.PI * 2);
    ctx.fill();
}

function drawLeaf(size, color) {
    ctx.fillStyle = color || '#fb923c';
    ctx.beginPath();
    ctx.ellipse(0, 0, size / 2.5, size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.stroke();
}

function frame(ts) {
    if (!canvasEl) return;
    if (!lastTime) lastTime = ts;
    const dt = Math.min(64, ts - lastTime);
    lastTime = ts;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
        updateParticle(p, w, h, dt);
        drawParticle(p);
    });
    rafId = requestAnimationFrame(frame);
}

function start() {
    if (!enabled) return;
    if (!canvasEl) buildCanvas();
    if (rafId) cancelAnimationFrame(rafId);
    spawnParticles();
    rafId = requestAnimationFrame(frame);
    canvasEl.style.display = 'block';
}

function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (canvasEl) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        canvasEl.style.display = 'none';
    }
    particles = [];
}

function init() {
    try {
        injectStyles();
        enabled = loadEnabled();
        const season = getCurrent();
        currentSeason = season.key;
        window.MXOS.Seasons = {
            getCurrent,
            setEnabled,
            isEnabled,
            start,
            stop
        };
        if (enabled) setTimeout(start, 1500);

        setInterval(() => {
            const s = getCurrent();
            if (s.key !== currentSeason) {
                currentSeason = s.key;
                if (enabled) spawnParticles();
            }
        }, 60000);
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getCurrent, setEnabled, isEnabled };
