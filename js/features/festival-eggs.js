window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let canvas = null;
let ctx = null;
let rafId = null;
let particles = [];
let activeFestival = null;

function getFestivalByDate() {
    const d = new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if (m === 1 && day >= 1 && day <= 7) return 'spring';
    if (m === 12 && day >= 20 && day <= 28) return 'christmas';
    if (m === 10 && day >= 28 && day <= 31) return 'halloween';
    if (m === 9 && day >= 12 && day <= 22) return 'midautumn';
    return null;
}

const FESTIVAL_INFO = {
    spring: { name: '春节', color: '#fbbf24', wish: '新春快乐，万事如意' },
    christmas: { name: '圣诞', color: '#dc2626', wish: '圣诞快乐，平安喜乐' },
    halloween: { name: '万圣节', color: '#f97316', wish: '万圣节快乐，糖霜与魔法之夜' },
    midautumn: { name: '中秋', color: '#fcd34d', wish: '中秋团圆，月圆人安' }
};

function injectStyles() {
    if (document.getElementById('mxos-festival-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-festival-styles';
    style.textContent = `
#mxosFestivalCanvas {
    position: fixed; inset: 0;
    z-index: 1008;
    pointer-events: none;
    display: block;
}
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosFestivalCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
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

function spawnParticle() {
    const w = window.innerWidth;
    if (activeFestival === 'spring') {
        particles.push({ type: 'lantern', x: Math.random() * w, y: window.innerHeight + 20, vx: (Math.random() - 0.5) * 0.4, vy: -0.6 - Math.random() * 0.4, r: 6 + Math.random() * 4, life: 1, color: '#fbbf24' });
    } else if (activeFestival === 'christmas') {
        particles.push({ type: 'snow', x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 0.6, vy: 0.6 + Math.random() * 1.0, r: 1.5 + Math.random() * 2, life: 1, color: '#ffffff' });
    } else if (activeFestival === 'halloween') {
        particles.push({ type: 'bat', x: -20, y: Math.random() * window.innerHeight * 0.6, vx: 1.5 + Math.random(), vy: Math.sin(Math.random() * 6) * 0.6, r: 6 + Math.random() * 3, life: 1, color: '#1f2937', flap: 0 });
    } else if (activeFestival === 'midautumn') {
        particles.push({ type: 'petal', x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random() * 0.5, r: 3 + Math.random() * 2, rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 0.05, life: 1, color: '#fef3c7' });
    }
}

function draw() {
    rafId = requestAnimationFrame(draw);
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (particles.length < 80 && Math.random() < 0.4) spawnParticle();
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.type === 'lantern') {
            p.life -= 0.0025;
            if (p.y < -40 || p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.fillStyle = `rgba(251, 191, 36, ${p.life * 0.85})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = p.life * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        } else if (p.type === 'snow') {
            if (p.y > h + 10) { particles.splice(i, 1); continue; }
            ctx.fillStyle = `rgba(255,255,255,0.85)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'bat') {
            if (p.x > w + 30) { particles.splice(i, 1); continue; }
            p.flap += 0.3;
            const fy = Math.sin(p.flap) * 3;
            ctx.fillStyle = 'rgba(31, 41, 55, 0.85)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + fy, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + fy);
            ctx.lineTo(p.x - p.r * 1.5, p.y + fy - p.r * (Math.sin(p.flap) > 0 ? 1.2 : -1.2));
            ctx.lineTo(p.x - p.r * 0.5, p.y + fy);
            ctx.fill();
        } else if (p.type === 'petal') {
            if (p.y > h + 10) { particles.splice(i, 1); continue; }
            p.rot += p.vrot;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = 'rgba(254, 243, 199, 0.7)';
            ctx.beginPath();
            ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

function start(festival) {
    activeFestival = festival || getFestivalByDate();
    if (!activeFestival) return;
    if (prefersReduced) return;
    buildCanvas();
    if (!rafId) rafId = requestAnimationFrame(draw);
    sendWish();
}

function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    particles = [];
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    activeFestival = null;
}

function sendWish() {
    if (!activeFestival) return;
    const info = FESTIVAL_INFO[activeFestival];
    if (!info) return;
    if (window.MXOS?.notify) {
        window.MXOS.notify({
            title: `${info.name}祝福`,
            body: info.wish,
            type: 'info'
        });
    }
}

function getActive() {
    return activeFestival;
}

function init() {
    injectStyles();
    const festival = getFestivalByDate();
    if (festival) {
        start(festival);
    }
    window.MXOS.Features.festival = { start, stop, getActive, sendWish, getFestivalByDate };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop };
