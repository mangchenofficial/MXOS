import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_stamps_data';
const APP_ID = 'stamps';

const STAMPS = [
    { id: 'first-step', name: '初出茅庐', desc: '首次打开任意应用', svg: 'flag', cond: (s) => s.appsOpened >= 1 },
    { id: 'explorer', name: '探索者', desc: '打开过 5 个不同应用', svg: 'compass', cond: (s) => s.uniqueApps >= 5 },
    { id: 'veteran', name: '老司机', desc: '打开过 15 个不同应用', svg: 'medal', cond: (s) => s.uniqueApps >= 15 },
    { id: 'night-owl', name: '夜猫子', desc: '凌晨 0-4 点使用 MXOS', svg: 'moon', cond: (s) => s.nightUse },
    { id: 'early-bird', name: '早起的鸟', desc: '早上 5-7 点使用 MXOS', svg: 'sun', cond: (s) => s.morningUse },
    { id: 'streak-7', name: '一周不间断', desc: '连续 7 天使用 MXOS', svg: 'flame', cond: (s) => s.streak >= 7 },
    { id: 'streak-30', name: '月度坚持', desc: '连续 30 天使用 MXOS', svg: 'fire', cond: (s) => s.streak >= 30 },
    { id: 'focus-1h', name: '专注一小时', desc: '单次专注模式 60 分钟', svg: 'target', cond: (s) => s.focusMinutes >= 60 },
    { id: 'installer-10', name: '应用收藏家', desc: '安装 10 个应用', svg: 'box', cond: (s) => s.installedCount >= 10 },
    { id: 'installer-25', name: '应用大户', desc: '安装 25 个应用', svg: 'boxes', cond: (s) => s.installedCount >= 25 },
    { id: 'collector-5', name: '邮票新秀', desc: '收集 5 枚邮票', svg: 'star', cond: (s) => s.collected >= 5 },
    { id: 'collector-15', name: '邮票鉴赏家', desc: '收集 15 枚邮票', svg: 'crown', cond: (s) => s.collected >= 15 },
    { id: 'collector-all', name: '集邮大师', desc: '收集全部邮票', svg: 'trophy', cond: (s) => s.collected >= STAMPS.length },
    { id: 'terminal-master', name: '终端高手', desc: '使用终端 50 次', svg: 'terminal', cond: (s) => s.terminalUses >= 50 },
    { id: 'calculator-100', name: '人肉计算器', desc: '使用计算器 100 次', svg: 'calc', cond: (s) => s.calcUses >= 100 },
    { id: 'notepad-writer', name: '随笔作者', desc: '在便签中写下 1000 字', svg: 'pen', cond: (s) => s.notepadChars >= 1000 },
    { id: 'music-lover', name: '音乐爱好者', desc: '播放音乐 30 次', svg: 'note', cond: (s) => s.musicPlays >= 30 },
    { id: 'screenshot-king', name: '截图达人', desc: '截图 20 次', svg: 'camera', cond: (s) => s.screenshots >= 20 },
    { id: 'wallpaper-changer', name: '壁纸控', desc: '更换壁纸 10 次', svg: 'image', cond: (s) => s.wallpaperChanges >= 10 },
    { id: 'theme-switcher', name: '变色龙', desc: '切换主题 20 次', svg: 'palette', cond: (s) => s.themeChanges >= 20 },
    { id: 'pet-friend', name: '宠物之友', desc: '与桌面宠物互动 50 次', svg: 'heart', cond: (s) => s.petInteracts >= 50 },
    { id: 'easter-hunter', name: '彩蛋猎人', desc: '发现 3 个彩蛋', svg: 'egg', cond: (s) => s.easterEggs >= 3 },
    { id: 'konami', name: '科乐美密码', desc: '输入 Konami 代码', svg: 'key', cond: (s) => s.konami },
    { id: 'dev-mode', name: '开发者之心', desc: '解锁开发者模式', svg: 'code', cond: (s) => s.devMode },
    { id: 'time-traveler', name: '时光旅人', desc: '使用时光机回看历史', svg: 'clock-back', cond: (s) => s.timeTravel }
];

const STAMP_SVGS = {
    flag: '<path d="M5 3v18M5 4h11l-2 3 2 3H5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><polygon points="12,7 14,12 12,17 10,12" fill="currentColor"/>',
    medal: '<circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>',
    flame: '<path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4-2 1-4 3-4 6a6 6 0 0 0 12 0c0-5-4-8-6-11z"/>',
    fire: '<path d="M12 2c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6-1 3 1 4 2 4 2 0 1-3 1-9z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    boxes: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    star: '<polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/>',
    crown: '<path d="M3 18h18l-2-9-4 4-3-6-3 6-4-4-2 9z"/><path d="M3 18v3h18v-3"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H4v2a3 3 0 0 0 3 3M16 5h4v2a3 3 0 0 1-3 3M10 13v4h4v-4M8 21h8"/>',
    terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 9l3 3-3 3M12 15h6"/>',
    calc: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h2M16 18h0"/>',
    pen: '<path d="M3 21l3-1L19 7l-3-3L3 17v4z"/><path d="M14 6l4 4"/>',
    note: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 18V4l12-2v14"/>',
    camera: '<rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6l2-3h4l2 3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1.2" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="16" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="14" r="1.2" fill="currentColor"/>',
    heart: '<path d="M12 21s-7-4.5-9.5-9C1 9 3 5 6.5 5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 5 23 9 21.5 12c-2.5 4.5-9.5 9-9.5 9z"/>',
    egg: '<ellipse cx="12" cy="13" rx="7" ry="9"/>',
    key: '<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M16 16l2-2M18 18l2-2"/>',
    code: '<path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12"/>',
    'clock-back': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M3 12a9 9 0 0 1 9-9"/>'
};

function loadData() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (raw && typeof raw === 'object') return Object.assign(defaultStats(), raw);
    } catch (e) {}
    return defaultStats();
}

function defaultStats() {
    return {
        collected: [],
        stats: {
            appsOpened: 0, uniqueApps: 0, nightUse: false, morningUse: false,
            streak: 0, focusMinutes: 0, installedCount: 0, collected: 0,
            terminalUses: 0, calcUses: 0, notepadChars: 0, musicPlays: 0,
            screenshots: 0, wallpaperChanges: 0, themeChanges: 0,
            petInteracts: 0, easterEggs: 0, konami: false, devMode: false,
            timeTravel: false, _uniqueSet: [], _lastVisit: null, _visitDays: []
        }
    };
}

let data = loadData();
normalizeData();

function normalizeData() {
    if (!data.collected) data.collected = [];
    if (!data.stats) data.stats = {};
    const def = defaultStats().stats;
    Object.keys(def).forEach(k => { if (data.stats[k] === undefined) data.stats[k] = def[k]; });
    if (!Array.isArray(data.stats._uniqueSet)) data.stats._uniqueSet = [];
    if (!Array.isArray(data.stats._visitDays)) data.stats._visitDays = [];
}

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function stampSvg(id, collected) {
    const def = STAMPS.find(s => s.id === id);
    if (!def) return '';
    const path = STAMP_SVGS[def.svg] || '';
    const opacity = collected ? 1 : 0.18;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:${opacity}">${path}</svg>`;
}

function checkAll() {
    const s = data.stats;
    s.collected = data.collected.length;
    STAMPS.forEach(stamp => {
        if (data.collected.includes(stamp.id)) return;
        try {
            if (stamp.cond(s)) collect(stamp.id, true);
        } catch (e) {}
    });
}

function collect(id, silent) {
    if (data.collected.includes(id)) return false;
    const stamp = STAMPS.find(s => s.id === id);
    if (!stamp) return false;
    data.collected.push(id);
    data.stats.collected = data.collected.length;
    saveData();
    if (!silent) {
        if (window.MXOS.notify) {
            window.MXOS.notify({
                title: '邮票收集 · ' + stamp.name,
                body: stamp.desc,
                type: 'success'
            });
        }
        spawnParticles();
    }
    window.dispatchEvent(new CustomEvent('mxos:stamp-collected', { detail: { id, name: stamp.name } }));
    return true;
}

function list() {
    return STAMPS.map(s => ({
        id: s.id, name: s.name, desc: s.desc, svg: s.svg,
        collected: data.collected.includes(s.id)
    }));
}

function has(id) {
    return data.collected.includes(id);
}

function getStats() {
    return Object.assign({}, data.stats);
}

function updateStats(patch) {
    Object.assign(data.stats, patch);
    saveData();
    checkAll();
}

function recordAppOpen(appId) {
    const s = data.stats;
    s.appsOpened = (s.appsOpened || 0) + 1;
    if (!s._uniqueSet.includes(appId)) {
        s._uniqueSet.push(appId);
        s.uniqueApps = s._uniqueSet.length;
    }
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) s.nightUse = true;
    if (hour >= 5 && hour < 8) s.morningUse = true;
    recordVisit();
    saveData();
    checkAll();
}

function recordVisit() {
    const today = new Date().toISOString().slice(0, 10);
    const days = data.stats._visitDays;
    if (days[days.length - 1] === today) return;
    if (days.length && isConsecutive(days[days.length - 1], today)) {
        days.push(today);
    } else {
        days.length = 0;
        days.push(today);
    }
    if (days.length > 60) days.splice(0, days.length - 60);
    data.stats.streak = days.length;
}

function isConsecutive(a, b) {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return (db - da) / 86400000 === 1;
}

function spawnParticles() {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
    document.body.appendChild(host);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#fff'];
    for (let i = 0; i < 28; i++) {
        const p = document.createElement('div');
        const angle = (i / 28) * Math.PI * 2;
        const dist = 80 + Math.random() * 120;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const size = 6 + Math.random() * 8;
        p.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;border-radius:50%;background:${colors[i % colors.length]};transition:transform 1.2s cubic-bezier(0.2,0.8,0.3,1),opacity 1.2s ease;opacity:1`;
        host.appendChild(p);
        requestAnimationFrame(() => {
            p.style.transform = `translate(${x}px,${y}px) scale(0.2)`;
            p.style.opacity = '0';
        });
    }
    setTimeout(() => host.remove(), 1400);
}

function injectStyles() {
    if (document.getElementById('mxos-stamps-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-stamps-styles';
    style.textContent = `
.mxos-stamps-app{padding:24px;color:#e5e7eb;height:100%;overflow:auto;background:rgba(10,10,11,0.6)}
.mxos-stamps-header{margin-bottom:20px}
.mxos-stamps-title{font-size:22px;font-weight:700;margin:0 0 4px}
.mxos-stamps-sub{font-size:13px;color:#9ca3af}
.mxos-stamps-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px}
.mxos-stamp-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 12px;text-align:center;backdrop-filter:blur(40px) saturate(200%);-webkit-backdrop-filter:blur(40px) saturate(200%);transition:transform 0.2s,border-color 0.2s;position:relative;overflow:hidden}
.mxos-stamp-card:hover{transform:translateY(-3px);border-color:rgba(251,191,36,0.4)}
.mxos-stamp-card.owned{background:linear-gradient(160deg,rgba(251,191,36,0.12),rgba(255,255,255,0.04))}
.mxos-stamp-card.owned::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#fbbf24,transparent)}
.mxos-stamp-icon{width:48px;height:48px;margin:0 auto 10px;color:#fbbf24}
.mxos-stamp-card:not(.owned) .mxos-stamp-icon{color:#6b7280}
.mxos-stamp-name{font-size:13px;font-weight:600;margin-bottom:4px}
.mxos-stamp-desc{font-size:11px;color:#9ca3af;line-height:1.4;min-height:30px}
.mxos-stamp-perf{position:absolute;top:8px;right:8px;width:10px;height:10px;border-radius:50%;background:#fbbf24;box-shadow:0 0 8px #fbbf24;display:none}
.mxos-stamp-card.owned .mxos-stamp-perf{display:block}
    `;
    document.head.appendChild(style);
}

function renderApp(contentEl) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'mxos-stamps-app';
    const owned = data.collected.length;
    const total = STAMPS.length;
    root.innerHTML = `
        <div class="mxos-stamps-header">
            <div class="mxos-stamps-title">MXOS 邮票册</div>
            <div class="mxos-stamps-sub">已收集 ${owned} / ${total} 枚 · 完成度 ${Math.round(owned / total * 100)}%</div>
        </div>
        <div class="mxos-stamps-grid" id="mxosStampsGrid"></div>
    `;
    contentEl.appendChild(root);
    const grid = root.querySelector('#mxosStampsGrid');
    list().forEach(s => {
        const card = document.createElement('div');
        card.className = 'mxos-stamp-card' + (s.collected ? ' owned' : '');
        card.innerHTML = `
            <div class="mxos-stamp-perf"></div>
            <div class="mxos-stamp-icon">${stampSvg(s.id, s.collected)}</div>
            <div class="mxos-stamp-name">${s.collected ? s.name : '？？？'}</div>
            <div class="mxos-stamp-desc">${s.desc}</div>
        `;
        grid.appendChild(card);
    });
}

function setupListeners() {
    window.addEventListener('mxos:window-opened', (e) => {
        const appId = e.detail && e.detail.appId;
        if (appId) recordAppOpen(appId);
    });
    window.addEventListener('mxos:terminal-command', (e) => {
        const cmd = (e.detail && e.detail.command) || '';
        if (cmd.startsWith('mxos') || cmd === 'ls' || cmd === 'help') {
            updateStats({ terminalUses: (data.stats.terminalUses || 0) + 1 });
        }
    });
    window.addEventListener('mxos:konami', () => updateStats({ konami: true }));
    window.addEventListener('mxos:dev-mode-unlocked', () => updateStats({ devMode: true }));
    window.addEventListener('mxos:easter-egg-found', () => updateStats({ easterEggs: (data.stats.easterEggs || 0) + 1 }));
    window.addEventListener('mxos:time-travel', () => updateStats({ timeTravel: true }));
    if (window.MXOS.events) {
        window.MXOS.events.on('theme:change', () => updateStats({ themeChanges: (data.stats.themeChanges || 0) + 1 }));
    }
    setInterval(() => {
        const h = new Date().getHours();
        if (h >= 0 && h < 5) updateStats({ nightUse: true });
    }, 60000);
}

function registerApp() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: '邮票册', icon: 'store', width: 820, height: 600, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    addStartMenuEntry();
}

function addStartMenuEntry() {
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(addStartMenuEntry, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-store"/></svg><span>邮票册</span>`;
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    normalizeData();
    recordVisit();
    saveData();
    checkAll();
    window.MXOS.Features.stamps = {
        collect, list, has, getStats, updateStats, recordAppOpen,
        renderApp, checkAll
    };
    setupListeners();
    setTimeout(registerApp, 1500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { collect, list, has, getStats, updateStats };
