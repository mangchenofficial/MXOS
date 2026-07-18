window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_particle_art';

const STYLES = {
    rainbow: {
        name: '彩虹',
        colors: ['#ef4444', '#f59e0b', '#fbbf24', '#22c55e', '#06b6d4', '#60a5fa', '#a855f7'],
        size: [3, 7],
        life: 800,
        gravity: 0,
        blend: 'screen'
    },
    ink: {
        name: '水墨',
        colors: ['#1a1a1a', '#374151', '#6b7280', '#9ca3af'],
        size: [4, 10],
        life: 1200,
        gravity: 0.05,
        blend: 'multiply'
    },
    star: {
        name: '星光',
        colors: ['#fef3c7', '#fde68a', '#fbbf24', '#ffffff'],
        size: [1, 4],
        life: 1000,
        gravity: -0.02,
        blend: 'lighter'
    },
    fire: {
        name: '火焰',
        colors: ['#fef3c7', '#fbbf24', '#f97316', '#dc2626'],
        size: [3, 8],
        life: 700,
        gravity: -0.15,
        blend: 'lighter'
    },
    aurora: {
        name: '极光',
        colors: ['#22d3ee', '#34d399', '#a78bfa', '#f472b6'],
        size: [5, 12],
        life: 1500,
        gravity: -0.03,
        blend: 'screen'
    }
};

function loadData() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return Object.assign({ enabled: false, style: 'rainbow' }, raw);
    } catch (e) {}
    return { enabled: false, style: 'rainbow' };
}

let settings = loadData();

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
}

let canvas = null;
let ctx = null;
let particles = [];
let rafId = null;
let lastEmit = 0;
let lastX = 0;
let lastY = 0;
let hasLast = false;

function injectStyles() {
    if (document.getElementById('mxos-particle-art-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-particle-art-styles';
    style.textContent = `
#mxosParticleCanvas{position:fixed;inset:0;z-index:9000;pointer-events:none;display:block}
#mxosParticleCanvas.hidden{display:none}
.mxos-particle-settings{position:fixed;bottom:60px;right:20px;background:rgba(10,10,11,0.85);backdrop-filter:blur(40px) saturate(200%);-webkit-backdrop-filter:blur(40px) saturate(200%);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px;color:#e5e7eb;font-size:12px;z-index:9001;min-width:180px;display:none}
.mxos-particle-settings.show{display:block}
.mxos-particle-settings h4{margin:0 0 10px;font-size:13px;color:#fbbf24}
.mxos-particle-style-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
.mxos-particle-style-btn{padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#cbd5e1;cursor:pointer;font-size:11px;transition:all 0.15s}
.mxos-particle-style-btn:hover{border-color:rgba(251,191,36,0.4)}
.mxos-particle-style-btn.active{background:rgba(251,191,36,0.2);border-color:#fbbf24;color:#fbbf24}
.mxos-particle-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mxos-particle-toggle input{accent-color:#fbbf24}
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosParticleCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('touchmove', onMouseMove, { passive: true });
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
    if (!settings.enabled) return;
    const now = performance.now();
    if (now - lastEmit < 16) return;
    lastEmit = now;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    if (hasLast) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const count = Math.min(8, Math.max(1, Math.floor(dist / 6)));
        for (let i = 0; i < count; i++) {
            spawnParticle(lastX + dx * (i / count), lastY + dy * (i / count));
        }
    } else {
        spawnParticle(x, y);
    }
    lastX = x;
    lastY = y;
    hasLast = true;
}

function spawnParticle(x, y) {
    const cfg = STYLES[settings.style] || STYLES.rainbow;
    const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    const size = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
    particles.push({
        x, y,
        vx: -0.5 + Math.random() * 1,
        vy: -0.5 + Math.random() * 1 - cfg.gravity * 5,
        size,
        color,
        born: performance.now(),
        life: cfg.life,
        cfg
    });
    if (particles.length > 500) particles.splice(0, particles.length - 500);
}

let lastFrame = 0;
function frame(ts) {
    if (!canvas) return;
    if (!lastFrame) lastFrame = ts;
    const dt = Math.min(64, ts - lastFrame);
    lastFrame = ts;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = (STYLES[settings.style] || STYLES.rainbow).blend;
    const now = performance.now();
    particles = particles.filter(p => {
        const age = now - p.born;
        if (age > p.life) return false;
        const t = age / p.life;
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.vy += p.cfg.gravity * (dt / 16);
        p.vx *= 0.99;
        p.vy *= 0.99;
        const alpha = 1 - t;
        const size = p.size * (1 - t * 0.3);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = size * 2;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
    });
    ctx.globalCompositeOperation = 'source-over';
    rafId = requestAnimationFrame(frame);
}

function start() {
    if (!canvas) buildCanvas();
    if (rafId) cancelAnimationFrame(rafId);
    canvas.classList.remove('hidden');
    rafId = requestAnimationFrame(frame);
}

function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (canvas) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        canvas.classList.add('hidden');
    }
    particles = [];
}

function setEnabled(v) {
    settings.enabled = !!v;
    saveData();
    if (settings.enabled) start();
    else stop();
}

function setStyle(s) {
    if (!STYLES[s]) return;
    settings.style = s;
    saveData();
}

function getSettings() {
    return Object.assign({}, settings);
}

function getStyles() {
    return Object.keys(STYLES).map(k => ({ id: k, name: STYLES[k].name }));
}

async function saveToVfs() {
    if (!canvas) return null;
    try {
        const dataUrl = canvas.toDataURL('image/png');
        const path = '/Pictures/ParticleArt-' + Date.now() + '.png';
        if (window.MXOS.fs && window.MXOS.fs.writeFile) {
            await window.MXOS.fs.writeFile(path, dataUrl);
        }
        if (window.MXOS.dialog && window.MXOS.dialog.toast) {
            window.MXOS.dialog.toast('粒子艺术已保存到 ' + path, 'success');
        }
        return path;
    } catch (e) {
        if (window.MXOS.dialog && window.MXOS.dialog.toast) {
            window.MXOS.dialog.toast('保存失败：' + e.message, 'error');
        }
        return null;
    }
}

function setupShortcut() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
            if (settings.enabled) {
                e.preventDefault();
                saveToVfs();
            }
        }
    });
}

function init() {
    try {
        injectStyles();
        setupShortcut();
        window.MXOS.Features.particleArt = {
            setEnabled, setStyle, getSettings, getStyles, saveToVfs,
            start, stop
        };
        if (settings.enabled) start();
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, setStyle, getSettings, getStyles, saveToVfs };
