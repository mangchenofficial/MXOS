import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_evolution_data';
const XP_PER_MINUTE = 10;
const MAX_LEVEL = 10;
const TICK_MS = 1000;

const UNLOCKS = {
    2: '解锁：基础配色变体',
    3: '解锁：紧凑布局模式',
    4: '解锁：夜间深色皮肤',
    5: '解锁：精致图标包',
    6: '解锁：动画加速',
    7: '解锁：高级主题色',
    8: '解锁：极简模式',
    9: '解锁：开发者徽章',
    10: '解锁：传说级皮肤'
};

function loadData() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (raw && typeof raw === 'object') return raw;
    } catch (e) {}
    return { apps: {}, totalUseMs: 0 };
}

function saveData(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
}

let data = loadData();
let currentFocusedApp = null;
let lastTick = 0;
let tickHandle = null;

function xpForLevel(level) {
    return level * 100;
}

function getLevel(appId) {
    const a = data.apps[appId];
    if (!a) return 1;
    let lvl = 1;
    while (lvl < MAX_LEVEL && a.xp >= xpForLevel(lvl)) lvl++;
    return lvl;
}

function getProgress(appId) {
    const a = data.apps[appId] || { xp: 0, useMs: 0 };
    const lvl = getLevel(appId);
    if (lvl >= MAX_LEVEL) return { level: lvl, xp: a.xp, current: 0, needed: 0, pct: 100, unlock: UNLOCKS[lvl] || null };
    const base = xpForLevel(lvl);
    const next = xpForLevel(lvl + 1);
    const current = a.xp - base;
    const needed = next - base;
    return {
        level: lvl,
        xp: a.xp,
        current: current,
        needed: needed,
        pct: needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 0,
        unlock: UNLOCKS[lvl + 1] || null
    };
}

function addXp(appId, amount) {
    if (!appId || amount <= 0) return getLevel(appId);
    const before = getLevel(appId);
    if (!data.apps[appId]) data.apps[appId] = { xp: 0, useMs: 0 };
    data.apps[appId].xp += amount;
    const after = getLevel(appId);
    if (after > before) {
        saveData(data);
        onLevelUp(appId, after);
    }
    return after;
}

function onLevelUp(appId, level) {
    const unlock = UNLOCKS[level] || '已达最高等级';
    const title = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(appId) || {}).title || appId;
    if (window.MXOS.notify) {
        window.MXOS.notify({
            title: '应用进化 · 等级提升',
            body: `${title} 升至 ${level} 级！${unlock}`,
            type: 'success'
        });
    }
    window.dispatchEvent(new CustomEvent('mxos:evolution-levelup', { detail: { appId, level, unlock } }));
}

function tick() {
    const now = Date.now();
    if (!lastTick) { lastTick = now; return; }
    const dt = now - lastTick;
    lastTick = now;
    const active = state.activeWindow;
    if (!active) { currentFocusedApp = null; return; }
    const appId = active.dataset && active.dataset.appId;
    if (!appId) {
        const w = state.windows.find(w => w.element === active);
        if (w) currentFocusedApp = w.appId;
        else return;
    } else {
        currentFocusedApp = appId;
    }
    const aid = currentFocusedApp;
    if (!aid) return;
    if (!data.apps[aid]) data.apps[aid] = { xp: 0, useMs: 0 };
    data.apps[aid].useMs += dt;
    data.totalUseMs = (data.totalUseMs || 0) + dt;
    const minutes = data.apps[aid].useMs / 60000;
    const expectedXp = Math.floor(minutes * XP_PER_MINUTE);
    if (expectedXp > data.apps[aid].xp) {
        const before = getLevel(aid);
        data.apps[aid].xp = expectedXp;
        const after = getLevel(aid);
        if (after > before) onLevelUp(aid, after);
    }
    if (Math.floor(now / 5000) % 2 === 0) saveData(data);
}

function getAll() {
    const result = [];
    Object.keys(data.apps).forEach(appId => {
        result.push({ appId, ...getProgress(appId), useMs: data.apps[appId].useMs });
    });
    return result.sort((a, b) => b.xp - a.xp);
}

function resetApp(appId) {
    if (data.apps[appId]) {
        delete data.apps[appId];
        saveData(data);
    }
}

function injectStyles() {
    if (document.getElementById('mxos-evolution-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-evolution-styles';
    style.textContent = `
.mxos-evo-badge{position:absolute;top:4px;right:4px;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1a1a1a;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.4)}
    `;
    document.head.appendChild(style);
}

function start() {
    if (tickHandle) return;
    lastTick = Date.now();
    tickHandle = setInterval(tick, TICK_MS);
}

function stop() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    saveData(data);
}

function init() {
    injectStyles();
    window.MXOS.Features.evolution = {
        getLevel, getProgress, addXp, getAll, resetApp,
        getXp: (id) => (data.apps[id] || { xp: 0 }).xp,
        getUseMs: (id) => (data.apps[id] || { useMs: 0 }).useMs,
        start, stop
    };
    start();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getLevel, getProgress, addXp, getAll };
