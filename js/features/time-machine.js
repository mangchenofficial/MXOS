import { state } from '../state.js';
import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const DB_NAME = 'mxos_time_machine';
const APP_ID = 'time-machine';
const STORE = 'snapshots';
const SNAPSHOT_INTERVAL = 10 * 60 * 1000;
const MAX_PER_DAY = 144;

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE)) {
                const store = db.createObjectStore(STORE, { keyPath: 'id' });
                store.createIndex('byDay', 'day', { unique: false });
                store.createIndex('byTs', 'ts', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

async function addSnapshot(snap) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(snap);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { return false; }
}

async function getDaySnapshots(day) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const idx = tx.objectStore(STORE).index('byDay');
            const req = idx.getAll(day);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (e) { return []; }
}

async function getAllDays() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const idx = tx.objectStore(STORE).index('byDay');
            const days = new Set();
            const req = idx.openKeyCursor();
            req.onsuccess = () => {
                const cur = req.result;
                if (cur) {
                    days.add(cur.key);
                    cur.continue();
                } else {
                    resolve(Array.from(days).sort().reverse());
                }
            };
            req.onerror = () => reject(req.error);
        });
    } catch (e) { return []; }
}

async function clearAll() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { return false; }
}

function getCurrentSnapshot() {
    const windows = state.windows.filter(w => !w.minimized).map(w => {
        const cfg = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(w.appId)) || {};
        return { appId: w.appId, title: cfg.title || w.appId, icon: cfg.icon || null };
    });
    const theme = (window.MXOS.theme && window.MXOS.theme.get()) || {};
    const wallpaper = (state.personalizationSettings && state.personalizationSettings.wallpaper) || null;
    return {
        id: 'snap_' + Date.now(),
        ts: Date.now(),
        day: new Date().toISOString().slice(0, 10),
        windows,
        windowCount: windows.length,
        theme: theme.mode || 'dark',
        accent: theme.accent || null,
        wallpaper: wallpaper,
        activeApp: (state.windows.find(w => w.element === state.activeWindow) || {}).appId || null
    };
}

let snapshotHandle = null;

async function takeSnapshot() {
    const snap = getCurrentSnapshot();
    await addSnapshot(snap);
    const daySnaps = await getDaySnapshots(snap.day);
    if (daySnaps.length > MAX_PER_DAY) {
        const db = await openDB();
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        daySnaps.sort((a, b) => a.ts - b.ts);
        for (let i = 0; i < daySnaps.length - MAX_PER_DAY; i++) {
            store.delete(daySnaps[i].id);
        }
    }
}

function start() {
    if (snapshotHandle) return;
    setTimeout(takeSnapshot, 30000);
    snapshotHandle = setInterval(takeSnapshot, SNAPSHOT_INTERVAL);
}

function stop() {
    if (snapshotHandle) { clearInterval(snapshotHandle); snapshotHandle = null; }
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(day) {
    try {
        return new Date(day + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    } catch (e) { return day; }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function snapshotThumb(snap) {
    const count = snap.windowCount || 0;
    const colors = ['#60a5fa', '#fbbf24', '#22c55e', '#a855f7', '#ef4444'];
    const accent = snap.accent || '#60a5fa';
    let rects = '';
    for (let i = 0; i < Math.min(count, 4); i++) {
        const c = colors[i % colors.length];
        const x = 10 + (i % 2) * 50;
        const y = 10 + Math.floor(i / 2) * 35;
        rects += `<rect x="${x}" y="${y}" width="40" height="28" rx="3" fill="${c}" opacity="0.8"/>`;
    }
    return `<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="70" fill="${snap.theme === 'light' ? '#f3f4f6' : '#1a1a1f'}"/>
        ${rects}
        <rect width="100" height="6" y="64" fill="${accent}"/>
    </svg>`;
}

function injectStyles() {
    if (document.getElementById('mxos-timemachine-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-timemachine-styles';
    style.textContent = `
.mxos-tm-app{padding:24px;color:#e5e7eb;height:100%;overflow:auto;background:rgba(10,10,11,0.6);display:flex;flex-direction:column}
.mxos-tm-header{margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
.mxos-tm-title{font-size:22px;font-weight:700;margin:0}
.mxos-tm-sub{font-size:13px;color:#9ca3af;margin-top:4px}
.mxos-tm-layout{display:flex;gap:16px;flex:1;min-height:0}
.mxos-tm-sidebar{width:200px;flex-shrink:0;overflow:auto;background:rgba(255,255,255,0.03);border-radius:12px;padding:10px}
.mxos-tm-day{padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;color:#cbd5e1;transition:background 0.15s;margin-bottom:4px}
.mxos-tm-day:hover{background:rgba(255,255,255,0.06)}
.mxos-tm-day.active{background:rgba(251,191,36,0.15);color:#fbbf24;font-weight:600}
.mxos-tm-day-count{font-size:10px;color:#6b7280;float:right}
.mxos-tm-main{flex:1;overflow:auto;background:rgba(255,255,255,0.03);border-radius:12px;padding:16px}
.mxos-tm-empty{text-align:center;padding:60px 20px;color:#6b7280}
.mxos-tm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:20px}
.mxos-tm-thumb{cursor:pointer;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;transition:transform 0.2s,border-color 0.2s}
.mxos-tm-thumb:hover{transform:scale(1.04);border-color:rgba(251,191,36,0.4)}
.mxos-tm-thumb svg{width:100%;height:auto;display:block}
.mxos-tm-thumb-time{padding:4px 8px;font-size:10px;color:#9ca3af;text-align:center}
.mxos-tm-player{background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;margin-top:12px}
.mxos-tm-player-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.mxos-tm-player-title{font-size:14px;font-weight:600;color:#fbbf24}
.mxos-tm-player-controls{display:flex;gap:8px}
.mxos-tm-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#e5e7eb;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s}
.mxos-tm-btn:hover{background:rgba(251,191,36,0.2);border-color:rgba(251,191,36,0.5);color:#fbbf24}
.mxos-tm-btn svg{width:14px;height:14px}
.mxos-tm-view{display:flex;gap:16px}
.mxos-tm-view-thumb{width:240px;height:160px;border-radius:8px;overflow:hidden;background:#1a1a1f}
.mxos-tm-view-info{flex:1}
.mxos-tm-view-time{font-size:18px;font-weight:700;color:#fbbf24;margin-bottom:8px}
.mxos-tm-view-windows{display:flex;flex-direction:column;gap:4px}
.mxos-tm-window{padding:4px 10px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:12px;color:#cbd5e1}
    `;
    document.head.appendChild(style);
}

let playerState = { snaps: [], idx: 0, playing: false, timer: null, contentEl: null };

async function renderApp(contentEl) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'mxos-tm-app';
    root.innerHTML = `
        <div class="mxos-tm-header">
            <div>
                <div class="mxos-tm-title">MXOS 时光机</div>
                <div class="mxos-tm-sub">每 10 分钟记录一次桌面状态 · 回看历史时刻</div>
            </div>
            <button class="mxos-tm-btn" id="mxosTmClear" title="清空历史"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
        <div class="mxos-tm-layout">
            <div class="mxos-tm-sidebar" id="mxosTmDays"></div>
            <div class="mxos-tm-main" id="mxosTmMain"></div>
        </div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(root);
    playerState.contentEl = contentEl;
    const days = await getAllDays();
    const dayList = root.querySelector('#mxosTmDays');
    if (!days.length) {
        dayList.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:12px">还没有历史快照</div>';
        root.querySelector('#mxosTmMain').innerHTML = `<div class="mxos-tm-empty"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;opacity:0.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><div>时光机正在记录，稍后再来看看吧</div></div>`;
        return;
    }
    days.forEach(d => {
        const item = document.createElement('div');
        item.className = 'mxos-tm-day';
        item.dataset.day = d;
        item.innerHTML = `${formatDate(d).split(' ').slice(0, 2).join(' ')} <span class="mxos-tm-day-count" id="cnt_${d}"></span>`;
        item.addEventListener('click', () => selectDay(d, contentEl));
        dayList.appendChild(item);
    });
    root.querySelector('#mxosTmClear').addEventListener('click', async () => {
        if (window.MXOS.dialog && window.MXOS.dialog.confirm) {
            const ok = await window.MXOS.dialog.confirm('清空时光机', '确定清空所有历史快照吗？此操作不可撤销。');
            if (!ok) return;
        }
        await clearAll();
        renderApp(contentEl);
    });
    selectDay(days[0], contentEl);
}

async function selectDay(day, contentEl) {
    const root = contentEl.querySelector('.mxos-tm-app');
    if (!root) return;
    root.querySelectorAll('.mxos-tm-day').forEach(el => el.classList.toggle('active', el.dataset.day === day));
    const snaps = (await getDaySnapshots(day)).sort((a, b) => a.ts - b.ts);
    playerState.snaps = snaps;
    playerState.idx = 0;
    playerState.playing = false;
    if (playerState.timer) { clearInterval(playerState.timer); playerState.timer = null; }
    const main = root.querySelector('#mxosTmMain');
    if (!snaps.length) {
        main.innerHTML = `<div class="mxos-tm-empty">这一天没有快照</div>`;
        return;
    }
    main.innerHTML = `
        <div style="font-size:14px;font-weight:600;color:#fbbf24;margin-bottom:12px">${formatDate(day)}</div>
        <div class="mxos-tm-grid" id="mxosTmGrid"></div>
        <div class="mxos-tm-player" id="mxosTmPlayer"></div>
    `;
    const grid = main.querySelector('#mxosTmGrid');
    snaps.forEach((s, i) => {
        const t = document.createElement('div');
        t.className = 'mxos-tm-thumb';
        t.innerHTML = `${snapshotThumb(s)}<div class="mxos-tm-thumb-time">${formatTime(s.ts)}</div>`;
        t.addEventListener('click', () => showSnap(i, contentEl));
        grid.appendChild(t);
    });
    showSnap(0, contentEl);
}

function showSnap(idx, contentEl) {
    const root = contentEl.querySelector('.mxos-tm-app');
    if (!root) return;
    playerState.idx = idx;
    const snap = playerState.snaps[idx];
    if (!snap) return;
    window.dispatchEvent(new CustomEvent('mxos:time-travel', { detail: snap }));
    const player = root.querySelector('#mxosTmPlayer');
    if (!player) return;
    player.innerHTML = `
        <div class="mxos-tm-player-header">
            <div class="mxos-tm-player-title">${formatTime(snap.ts)} · ${snap.windowCount} 个窗口</div>
            <div class="mxos-tm-player-controls">
                <button class="mxos-tm-btn" id="mxosTmPrev"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h2v16H6zM20 4v16l-12-8z"/></svg></button>
                <button class="mxos-tm-btn" id="mxosTmPlay"><svg viewBox="0 0 24 24" fill="currentColor"><path d="${playerState.playing ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M8 5v14l11-7z'}"/></svg></button>
                <button class="mxos-tm-btn" id="mxosTmNext"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 4h2v16h-2zM4 4l12 8-12 8z"/></svg></button>
            </div>
        </div>
        <div class="mxos-tm-view">
            <div class="mxos-tm-view-thumb">${snapshotThumb(snap)}</div>
            <div class="mxos-tm-view-info">
                <div class="mxos-tm-view-time">${new Date(snap.ts).toLocaleString('zh-CN')}</div>
                <div style="font-size:11px;color:#9ca3af;margin-bottom:8px">主题：${snap.theme === 'light' ? '浅色' : '深色'} · 强调色：${snap.accent || '默认'}</div>
                <div class="mxos-tm-view-windows">
                    ${snap.windows && snap.windows.length ? snap.windows.map(w => `<div class="mxos-tm-window">${escapeHtml(w.title)}</div>`).join('') : '<div class="mxos-tm-window" style="color:#6b7280">当时没有打开的窗口</div>'}
                </div>
            </div>
        </div>
    `;
    player.querySelector('#mxosTmPrev').addEventListener('click', () => {
        if (playerState.idx > 0) showSnap(playerState.idx - 1, contentEl);
    });
    player.querySelector('#mxosTmNext').addEventListener('click', () => {
        if (playerState.idx < playerState.snaps.length - 1) showSnap(playerState.idx + 1, contentEl);
    });
    player.querySelector('#mxosTmPlay').addEventListener('click', () => {
        playerState.playing = !playerState.playing;
        if (playerState.timer) { clearInterval(playerState.timer); playerState.timer = null; }
        if (playerState.playing) {
            playerState.timer = setInterval(() => {
                if (playerState.idx < playerState.snaps.length - 1) {
                    showSnap(playerState.idx + 1, contentEl);
                } else {
                    playerState.playing = false;
                    if (playerState.timer) { clearInterval(playerState.timer); playerState.timer = null; }
                    showSnap(playerState.idx, contentEl);
                }
            }, 1000);
        } else {
            showSnap(playerState.idx, contentEl);
        }
    });
}

function registerApp() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: '时光机', icon: 'clock', width: 880, height: 620, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(registerApp, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-clock"/></svg><span>时光机</span>`;
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    start();
    window.MXOS.Features.timeMachine = {
        takeSnapshot, getDaySnapshots, getAllDays, clearAll,
        renderApp, start, stop, getCurrentSnapshot
    };
    setTimeout(registerApp, 2200);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { takeSnapshot, getAllDays, getDaySnapshots };
