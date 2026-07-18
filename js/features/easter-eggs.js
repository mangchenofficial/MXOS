import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_easter_eggs';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function loadData() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (raw && typeof raw === 'object') return Object.assign(defaultData(), raw);
    } catch (e) {}
    return defaultData();
}

function defaultData() {
    return {
        found: [],
        devMode: false,
        konami: false,
        logoClicks: 0,
        calcOpens: 0,
        loveTyped: 0
    };
}

let data = loadData();
let konamiIdx = 0;
let loveBuffer = '';

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function markFound(id) {
    if (data.found.includes(id)) return false;
    data.found.push(id);
    saveData();
    window.dispatchEvent(new CustomEvent('mxos:easter-egg-found', { detail: { id, total: data.found.length } }));
    return true;
}

function notifyEgg(title, body) {
    if (window.MXOS.notify) {
        window.MXOS.notify({ title: '彩蛋 · ' + title, body, type: 'success' });
    }
}

function triggerKonami() {
    if (data.konami) return;
    data.konami = true;
    markFound('konami');
    saveData();
    notifyEgg('科乐美密码', '你输入了 ↑↑↓↓←→←→BA，唤醒了古老的魔法');
    window.dispatchEvent(new CustomEvent('mxos:konami'));
    spawnRainbowBurst();
}

function spawnRainbowBurst() {
    const host = document.createElement('canvas');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10000';
    host.width = window.innerWidth;
    host.height = window.innerHeight;
    document.body.appendChild(host);
    const ctx = host.getContext('2d');
    const cx = host.width / 2;
    const cy = host.height / 2;
    const colors = ['#ef4444', '#f59e0b', '#fbbf24', '#22c55e', '#06b6d4', '#60a5fa', '#a855f7'];
    const particles = [];
    for (let i = 0; i < 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: colors[i % colors.length],
            size: 4 + Math.random() * 4,
            life: 1
        });
    }
    let raf;
    function frame() {
        ctx.clearRect(0, 0, host.width, host.height);
        let alive = false;
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life -= 0.012;
            if (p.life <= 0) return;
            alive = true;
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        if (alive) raf = requestAnimationFrame(frame);
        else { cancelAnimationFrame(raf); host.remove(); }
    }
    raf = requestAnimationFrame(frame);
}

function setupKonami() {
    document.addEventListener('keydown', (e) => {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === KONAMI[konamiIdx]) {
            konamiIdx++;
            if (konamiIdx === KONAMI.length) {
                konamiIdx = 0;
                triggerKonami();
            }
        } else {
            konamiIdx = (key === KONAMI[0]) ? 1 : 0;
        }
    });
}

function setupLogoClick() {
    document.addEventListener('click', (e) => {
        const logo = e.target.closest('.start-btn, .start-logo, [data-app="start"]');
        if (!logo) return;
        data.logoClicks = (data.logoClicks || 0) + 1;
        if (data.logoClicks >= 10 && !data.devMode) {
            data.devMode = true;
            markFound('dev-mode');
            saveData();
            notifyEgg('开发者模式', '点击 Logo 10 次，你已是 MXOS 的开发者');
            window.dispatchEvent(new CustomEvent('mxos:dev-mode-unlocked'));
            document.body.classList.add('mxos-dev-mode');
        }
        if (data.logoClicks === 7 || data.logoClicks === 8 || data.logoClicks === 9) {
            if (window.MXOS.dialog && window.MXOS.dialog.toast) {
                window.MXOS.dialog.toast(`再点 ${10 - data.logoClicks} 次解锁开发者模式`, 'info');
            }
        }
        saveData();
    });
}

function setupTerminalCommands() {
    document.addEventListener('keydown', (e) => {
        const input = e.target;
        if (!input || !input.classList || !input.classList.contains('term-input')) return;
        if (e.key !== 'Enter') return;
        const cmd = (input.value || '').trim();
        if (!cmd) return;
        window.dispatchEvent(new CustomEvent('mxos:terminal-command', { detail: { command: cmd, raw: cmd } }));
        const lower = cmd.toLowerCase();
        if (lower === 'mxos sudo make me a sandwich') {
            markFound('sandwich');
            notifyEgg('三明治彩蛋', '好的，给您做了一个虚拟三明治（其实是 sudo 权限的玩笑）');
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
        } else if (lower === 'love') {
            data.loveTyped = (data.loveTyped || 0) + 1;
            markFound('love');
            saveData();
            notifyEgg('爱意传递', 'Love is all you need. MXOS 也爱你');
        }
    }, true);
}

function setupCalcOpen() {
    window.addEventListener('mxos:window-opened', (e) => {
        const appId = e.detail && e.detail.appId;
        if (appId === 'calculator') {
            data.calcOpens = (data.calcOpens || 0) + 1;
            if (data.calcOpens >= 5) markFound('calc-5');
            saveData();
        }
    });
}

function setupLoveKey() {
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.tagName === 'INPUT' && e.target.classList && e.target.classList.contains('term-input')) return;
        if (e.target && e.target.tagName === 'TEXTAREA') return;
        if (e.key.length !== 1) return;
        loveBuffer = (loveBuffer + e.key.toLowerCase()).slice(-4);
        if (loveBuffer === 'love') {
            if (!data.found.includes('love-global')) {
                markFound('love-global');
                notifyEgg('爱意传递', '在任意地方输入了 love，世界因你而温暖');
            }
        }
    });
}

function getFound() {
    return data.found.slice();
}

function isDevMode() {
    return !!data.devMode;
}

function isKonami() {
    return !!data.konami;
}

function getStats() {
    return Object.assign({}, data);
}

function injectStyles() {
    if (document.getElementById('mxos-easter-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-easter-styles';
    style.textContent = `
body.mxos-dev-mode::before{content:"DEV";position:fixed;top:8px;left:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;z-index:99999;pointer-events:none;letter-spacing:1px}
    `;
    document.head.appendChild(style);
}

function init() {
    injectStyles();
    if (data.devMode) document.body.classList.add('mxos-dev-mode');
    setupKonami();
    setupLogoClick();
    setupTerminalCommands();
    setupCalcOpen();
    setupLoveKey();
    window.MXOS.Features.easterEggs = {
        getFound, isDevMode, isKonami, getStats, markFound, triggerKonami
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getFound, isDevMode, isKonami, markFound };
