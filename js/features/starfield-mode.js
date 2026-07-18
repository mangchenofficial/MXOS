window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_starfield_enabled';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let canvas = null;
let ctx = null;
let rafId = null;
let stars = [];
let meteors = [];
let constellations = [];
let enabled = false;
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
let lastMeteorTime = 0;
let lastConstellationTime = 0;

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-starfield-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-starfield-styles';
    style.textContent = `
#mxosStarfieldCanvas {
    position: fixed; inset: 0;
    z-index: 0;
    pointer-events: none;
    display: block;
}
body.starfield-on #desktop { background: #050507 !important; }
    `;
    document.head.appendChild(style);
}

function buildCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosStarfieldCanvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
}

function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    generateStars();
}

function generateStars() {
    stars = [];
    const count = Math.floor((window.innerWidth * window.innerHeight) / 4500);
    for (let i = 0; i < count; i++) {
        const layer = Math.floor(Math.random() * 3);
        stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: 0.3 + Math.random() * (layer === 0 ? 0.6 : layer === 1 ? 1.1 : 1.8),
            baseAlpha: 0.3 + Math.random() * 0.7,
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.5 + Math.random() * 1.5,
            layer,
            color: Math.random() < 0.15 ? '#ffd9a8' : (Math.random() < 0.3 ? '#bcd4ff' : '#ffffff')
        });
    }
}

function spawnMeteor() {
    const fromLeft = Math.random() < 0.5;
    meteors.push({
        x: fromLeft ? -50 : window.innerWidth + 50,
        y: Math.random() * window.innerHeight * 0.5,
        vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 4),
        vy: 3 + Math.random() * 2,
        life: 1,
        len: 80 + Math.random() * 80
    });
}

function spawnConstellation() {
    if (stars.length < 12) return;
    const cx = Math.random() * window.innerWidth;
    const cy = Math.random() * window.innerHeight;
    const picked = [];
    for (let i = 0; i < 5; i++) {
        let best = null;
        let bestD = 200;
        for (let j = 0; j < stars.length; j++) {
            const s = stars[j];
            if (picked.includes(s)) continue;
            const d = Math.hypot(s.x - cx, s.y - cy);
            if (d < bestD) { bestD = d; best = s; }
        }
        if (!best) break;
        picked.push(best);
    }
    if (picked.length >= 3) {
        constellations.push({ stars: picked, life: 1 });
    }
}

function onPointerMove(e) {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
}

function frame(t) {
    if (!enabled) return;
    rafId = requestAnimationFrame(frame);
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, w, h);

    mouseX += (targetMouseX - mouseX) * 0.06;
    mouseY += (targetMouseY - mouseY) * 0.06;

    if (!prefersReduced && t - lastMeteorTime > 4500 + Math.random() * 4000) {
        lastMeteorTime = t;
        spawnMeteor();
    }
    if (!prefersReduced && t - lastConstellationTime > 9000) {
        lastConstellationTime = t;
        if (Math.random() < 0.5) spawnConstellation();
    }

    constellations.forEach((c, i) => {
        c.life -= 0.002;
        if (c.life <= 0) { constellations.splice(i, 1); return; }
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${c.life * 0.35})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let i2 = 0; i2 < c.stars.length - 1; i2++) {
            ctx.moveTo(c.stars[i2].x, c.stars[i2].y);
            ctx.lineTo(c.stars[i2 + 1].x, c.stars[i2 + 1].y);
        }
        ctx.stroke();
        ctx.restore();
    });

    for (const s of stars) {
        const parallaxX = mouseX * (s.layer + 1) * 6;
        const parallaxY = mouseY * (s.layer + 1) * 6;
        const px = s.x + parallaxX;
        const py = s.y + parallaxY;
        s.twinkle += 0.016 * s.twinkleSpeed;
        const alpha = s.baseAlpha * (0.6 + 0.4 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.layer === 2 && alpha > 0.7) {
            ctx.globalAlpha = alpha * 0.25;
            ctx.beginPath();
            ctx.arc(px, py, s.r * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;

    for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life -= 0.012;
        if (m.life <= 0 || m.x < -200 || m.x > w + 200) { meteors.splice(i, 1); continue; }
        const tailX = m.x - m.vx * (m.len / Math.hypot(m.vx, m.vy));
        const tailY = m.y - m.vy * (m.len / Math.hypot(m.vx, m.vy));
        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${m.life})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
    }
}

function start() {
    if (enabled) return;
    enabled = true;
    buildCanvas();
    document.body.classList.add('starfield-on');
    rafId = requestAnimationFrame(frame);
}

function stop() {
    if (!enabled) return;
    enabled = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    document.body.classList.remove('starfield-on');
    if (canvas) {
        ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function setEnabled(v) {
    saveEnabled(!!v);
    if (v) start(); else stop();
}

function isEnabled() {
    return enabled;
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-starfield')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">桌面星空模式</div>
                <div class="settings-card-desc">在桌面显示程序生成的星空（含流星、星座连线、视差）</div>
            </div>
            <div class="toggle-switch ${enabled ? 'on' : ''}" id="setting-starfield" role="switch" aria-checked="${enabled}"></div>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-starfield').addEventListener('click', () => {
            const next = !enabled;
            setEnabled(next);
            section.querySelector('#setting-starfield').classList.toggle('on', next);
            section.querySelector('#setting-starfield').setAttribute('aria-checked', next ? 'true' : 'false');
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    try {
        injectStyles();
        injectSettingsIntoPanel();
        if (loadEnabled()) start();
        window.MXOS.Features.starfield = {
            start, stop, setEnabled, isEnabled, generateStars
        };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, setEnabled, isEnabled };
