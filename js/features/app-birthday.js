window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_app_install_dates';
const SEEN_KEY = 'mxos_birthday_seen';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let canvas = null;
let ctx = null;
let rafId = null;
let particles = [];
let cakeEl = null;

function loadInstallDates() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveInstallDates(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
}

function ensureInstallDates() {
    const dates = loadInstallDates();
    if (!dates._system) {
        dates._system = new Date().toISOString();
        saveInstallDates(dates);
    }
    return dates;
}

function injectStyles() {
    if (document.getElementById('mxos-birthday-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-birthday-styles';
    style.textContent = `
#mxosBirthdayLayer {
    position: fixed; inset: 0;
    z-index: 9990;
    pointer-events: none;
    display: none;
}
#mxosBirthdayLayer.show { display: block; }
#mxosBirthdayCanvas {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
}
#mxosBirthdayCake {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    animation: mxosBirthdayBounce 1.6s ease-in-out infinite;
}
@keyframes mxosBirthdayBounce {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -52%) scale(1.03); }
}
    `;
    document.head.appendChild(style);
}

function buildCake() {
    return `<svg width="200" height="180" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="30" y="100" width="140" height="55" rx="6"/>
        <rect x="40" y="80" width="120" height="28" rx="4"/>
        <rect x="95" y="62" width="10" height="20"/>
        <path d="M100 62 L100 52 L100 52" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
        <circle cx="100" cy="50" r="5" fill="rgba(255,255,255,0.4)" stroke="none"/>
        <text x="100" y="32" text-anchor="middle" fill="rgba(255,255,255,0.85)" stroke="none" font-size="14" font-family="MiSans, sans-serif">生日快乐</text>
    </svg>`;
}

function buildLayer() {
    if (canvas) return;
    const layer = document.createElement('div');
    layer.id = 'mxosBirthdayLayer';
    layer.setAttribute('aria-hidden', 'true');
    cakeEl = document.createElement('div');
    cakeEl.id = 'mxosBirthdayCake';
    cakeEl.innerHTML = buildCake();
    layer.appendChild(cakeEl);
    canvas = document.createElement('canvas');
    canvas.id = 'mxosBirthdayCanvas';
    layer.appendChild(canvas);
    document.body.appendChild(layer);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
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

function spawnConfetti() {
    const colors = ['#fbbf24', '#f472b6', '#a78bfa', '#34d399', '#60a5fa', '#fb923c'];
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: -10,
            vx: (Math.random() - 0.5) * 2,
            vy: 1 + Math.random() * 2,
            r: 3 + Math.random() * 3,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.2,
            life: 1,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

function draw() {
    rafId = requestAnimationFrame(draw);
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (particles.length < 200 && Math.random() < 0.6) spawnConfetti();
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rot += p.vrot;
        p.life -= 0.004;
        if (p.life <= 0 || p.y > h + 20) { particles.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

function trigger(appId = '_system') {
    if (prefersReduced) {
        if (window.MXOS?.notify) {
            window.MXOS.notify({ title: '生日快乐', body: '感谢你与 MXOS 共度的时光', type: 'info' });
        }
        return;
    }
    buildLayer();
    const layer = document.getElementById('mxosBirthdayLayer');
    layer.classList.add('show');
    particles = [];
    if (!rafId) rafId = requestAnimationFrame(draw);
    if (window.MXOS?.notify) {
        window.MXOS.notify({ title: '生日快乐', body: '感谢你与 MXOS 共度的时光，愿每一份创作都被铭记。', type: 'info' });
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('success');
    setTimeout(stop, 6000);
}

function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    particles = [];
    const layer = document.getElementById('mxosBirthdayLayer');
    if (layer) layer.classList.remove('show');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function check() {
    const dates = ensureInstallDates();
    const now = new Date();
    const todayKey = `${now.getMonth() + 1}-${now.getDate()}`;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch {}
    for (const appId in dates) {
        const installDate = new Date(dates[appId]);
        if (installDate.getMonth() + 1 !== now.getMonth() + 1 || installDate.getDate() !== now.getDate()) continue;
        if (now.getFullYear() === installDate.getFullYear()) continue;
        const key = `${appId}-${now.getFullYear()}`;
        if (seen.includes(key)) continue;
        seen.push(key);
        try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-50))); } catch {}
        trigger(appId);
        break;
    }
}

function init() {
    injectStyles();
    ensureInstallDates();
    setTimeout(check, 60_000);
    window.MXOS.Features.birthday = { trigger, stop, check };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { trigger, stop };
