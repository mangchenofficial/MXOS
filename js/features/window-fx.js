import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function injectStyles() {
    if (document.getElementById('mxos-window-fx-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-window-fx-styles';
    style.textContent = `
@keyframes mxosWindowShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
}
.window.fx-shake { animation: mxosWindowShake 0.45s ease; }
#mxosWindowFxCanvas {
    position: fixed; inset: 0;
    z-index: 9990;
    pointer-events: none;
    display: block;
}
    `;
    document.head.appendChild(style);
}

let canvas = null;
let ctx = null;
let particles = [];
let rafId = null;

function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'mxosWindowFxCanvas';
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

function frame() {
    if (!particles.length) { rafId = null; if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    rafId = requestAnimationFrame(frame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.018;
        p.rot += p.vrot;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(${p.color},${p.life})`;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
        ctx.restore();
    }
}

function spawnParticlesFromEl(el, color = '255,255,255') {
    if (prefersReduced) return;
    ensureCanvas();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const count = 36;
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 5;
        particles.push({
            x: cx + (Math.random() - 0.5) * r.width * 0.6,
            y: cy + (Math.random() - 0.5) * r.height * 0.6,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp - 1,
            r: 3 + Math.random() * 4,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 0.4,
            life: 1,
            color
        });
    }
    if (!rafId) rafId = requestAnimationFrame(frame);
}

function shake(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    el.classList.remove('fx-shake');
    void el.offsetWidth;
    el.classList.add('fx-shake');
    setTimeout(() => el.classList.remove('fx-shake'), 500);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('error');
    return true;
}

function vanish(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    spawnParticlesFromEl(el, '200,200,210');
    el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.92)';
    setTimeout(() => {
        el.style.transition = '';
        if (window.MXOS?.core?.closeWindow) {
            window.MXOS.core.closeWindow(winObj);
        } else {
            const closeBtn = el.querySelector('.window-control.close');
            if (closeBtn) closeBtn.click();
        }
    }, 450);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    return true;
}

function mirror(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    const rect = el.getBoundingClientRect();
    const clone = el.cloneNode(true);
    clone.classList.add('window-mirror');
    clone.style.left = (parseInt(el.style.left || rect.left, 10) + 40) + 'px';
    clone.style.top = (parseInt(el.style.top || rect.top, 10) + 40) + 'px';
    clone.style.opacity = '0.85';
    clone.style.pointerEvents = 'none';
    clone.querySelectorAll('input, textarea, button, [contenteditable]').forEach(n => {
        if (n.setAttribute) n.setAttribute('disabled', '');
    });
    document.body.appendChild(clone);
    setTimeout(() => {
        clone.style.transition = 'opacity 0.5s ease';
        clone.style.opacity = '0';
        setTimeout(() => clone.remove(), 600);
    }, 4000);
    if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已创建只读镜像副本', 'info');
    return true;
}

function split(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    const appId = winObj.appId;
    spawnParticlesFromEl(el, '180,180,200');
    if (window.openApp) {
        window.openApp(appId);
    }
    if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已尝试复制窗口', 'info');
    return true;
}

function freeze(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    const content = el.querySelector('.window-content');
    if (!content) return false;
    spawnParticlesFromEl(el, '220,220,230');
    content.style.transition = 'filter 0.3s ease';
    content.style.filter = 'grayscale(1) contrast(0.9)';
    content.setAttribute('data-frozen', '1');
    content.style.pointerEvents = 'none';
    const banner = document.createElement('div');
    banner.className = 'mxos-frozen-banner';
    banner.style.cssText = 'position:absolute;top:0;left:0;right:0;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;padding:4px 8px;text-align:center;z-index:5;pointer-events:none;';
    banner.textContent = '已凝固（释放资源中）';
    el.appendChild(banner);
    return true;
}

function unfreeze(winObj) {
    if (!winObj || !winObj.element) return false;
    const el = winObj.element;
    const content = el.querySelector('.window-content');
    if (!content) return false;
    content.style.filter = '';
    content.style.pointerEvents = '';
    content.removeAttribute('data-frozen');
    el.querySelectorAll('.mxos-frozen-banner').forEach(b => b.remove());
    return true;
}

function init() {
    try {
        injectStyles();
        window.MXOS.Features.windowFx = {
            shake, vanish, mirror, split, freeze, unfreeze
        };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { shake, vanish, mirror, split, freeze, unfreeze };
