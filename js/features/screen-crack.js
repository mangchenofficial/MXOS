window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_screen_crack_enabled';
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

let enabled = false;
let layer = null;
let canvas = null;
let ctx = null;
let rafId = null;
let shards = [];
let cracks = '';
let recovering = false;
let clickCount = 0;
let lastClickTime = 0;
let recoverTimer = null;

function injectStyles() {
    if (document.getElementById('mxos-screen-crack-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-screen-crack-styles';
    style.textContent = `
#mxosScreenCrackLayer {
    position: fixed; inset: 0;
    z-index: 9995;
    pointer-events: none;
    display: none;
}
#mxosScreenCrackLayer.show { display: block; }
#mxosScreenCrackSvg {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
}
#mxosScreenCrackCanvas {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
}
    `;
    document.head.appendChild(style);
}

function buildLayer() {
    if (layer) return;
    layer = document.createElement('div');
    layer.id = 'mxosScreenCrackLayer';
    layer.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mxosScreenCrackSvg';
    svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    layer.appendChild(svg);
    canvas = document.createElement('canvas');
    canvas.id = 'mxosScreenCrackCanvas';
    layer.appendChild(canvas);
    document.body.appendChild(layer);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', () => {
        if (!layer) return;
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        resize();
    });
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

function generateCracks(cx, cy) {
    const lines = [];
    const branches = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < branches; i++) {
        const ang = (i / branches) * Math.PI * 2 + Math.random() * 0.3;
        let x = cx, y = cy;
        const segs = 6 + Math.floor(Math.random() * 4);
        let path = `M ${x} ${y}`;
        for (let j = 0; j < segs; j++) {
            const len = 30 + Math.random() * 80;
            const jitter = (Math.random() - 0.5) * 0.6;
            x += Math.cos(ang + jitter) * len;
            y += Math.sin(ang + jitter) * len;
            path += ` L ${x} ${y}`;
            if (Math.random() < 0.4) {
                const subAng = ang + (Math.random() - 0.5) * 1.5;
                let sx = x, sy = y;
                let subPath = `M ${sx} ${sy}`;
                const subSegs = 3 + Math.floor(Math.random() * 3);
                for (let k = 0; k < subSegs; k++) {
                    const sl = 15 + Math.random() * 30;
                    sx += Math.cos(subAng) * sl;
                    sy += Math.sin(subAng) * sl;
                    subPath += ` L ${sx} ${sy}`;
                }
                lines.push(subPath);
            }
        }
        lines.push(path);
    }
    return lines.map(d => `<path d="${d}" stroke="rgba(255,255,255,0.55)" stroke-width="0.8" fill="none" />`).join('');
}

function spawnShards(cx, cy) {
    const count = 30;
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 6;
        shards.push({
            x: cx, y: cy,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp - 2,
            r: 2 + Math.random() * 4,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.4,
            life: 1
        });
    }
}

function frame() {
    if (!shards.length && !layer?.classList.contains('show')) { rafId = null; return; }
    rafId = requestAnimationFrame(frame);
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.2;
        s.rot += s.vrot;
        s.life -= 0.012;
        if (s.life <= 0 || s.y > h + 20) { shards.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = `rgba(255,255,255,${s.life * 0.85})`;
        ctx.beginPath();
        ctx.moveTo(0, -s.r);
        ctx.lineTo(s.r, s.r);
        ctx.lineTo(-s.r, s.r);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

function trigger(cx, cy) {
    if (prefersReduced) {
        if (window.MXOS?.notify) window.MXOS.notify({ title: '桌面碎裂彩蛋', body: '检测到减少动画偏好，未触发碎裂效果', type: 'info' });
        return;
    }
    buildLayer();
    const svg = layer.querySelector('#mxosScreenCrackSvg');
    cracks = generateCracks(cx, cy);
    svg.innerHTML = cracks;
    shards = [];
    spawnShards(cx, cy);
    layer.classList.add('show');
    if (!rafId) rafId = requestAnimationFrame(frame);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('error');
    if (recoverTimer) clearTimeout(recoverTimer);
    recoverTimer = setTimeout(recover, 5000);
}

function recover() {
    if (!layer) return;
    recovering = true;
    layer.style.transition = 'opacity 0.6s ease';
    layer.style.opacity = '0';
    setTimeout(() => {
        layer.classList.remove('show');
        layer.style.opacity = '';
        layer.style.transition = '';
        const svg = layer.querySelector('#mxosScreenCrackSvg');
        if (svg) svg.innerHTML = '';
        shards = [];
        recovering = false;
    }, 600);
}

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
}
function isEnabled() { return enabled; }

function onDesktopClick(e) {
    if (!enabled) return;
    if (e.button !== 0) return;
    const target = e.target;
    if (target.closest && target.closest('.window, .taskbar, .start-app, .desktop-icon, #startMenu, #quickSettingsPanel, .notification-center, #contextMenu, button, .btn')) return;
    const now = performance.now();
    if (now - lastClickTime > 600) clickCount = 0;
    lastClickTime = now;
    clickCount++;
    if (clickCount >= 5) {
        clickCount = 0;
        trigger(e.clientX, e.clientY);
    }
}

function init() {
    try {
        enabled = loadEnabled();
        injectStyles();
        document.addEventListener('pointerdown', onDesktopClick, { passive: true });
        window.MXOS.Features.screenCrack = { trigger, recover, setEnabled, isEnabled };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { trigger, recover, setEnabled, isEnabled };
