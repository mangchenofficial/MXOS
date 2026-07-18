import { state } from '../state.js';
import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_leaderboard_data';
const APP_ID = 'app-leaderboard';

function loadData() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (raw && typeof raw === 'object') return Object.assign(defaultData(), raw);
    } catch (e) {}
    return defaultData();
}

function defaultData() {
    return {
        weekly: {},
        weekStart: getWeekStart(Date.now()),
        allTime: {},
        stars: []
    };
}

function getWeekStart(ts) {
    const d = new Date(ts);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

let data = loadData();
let currentFocusedApp = null;
let lastTick = 0;

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function checkWeekReset() {
    const ws = getWeekStart(Date.now());
    if (ws !== data.weekStart) {
        const prevStar = Object.entries(data.weekly).sort((a, b) => b[1] - a[1])[0];
        if (prevStar) {
            data.stars.unshift({ appId: prevStar[0], ms: prevStar[1], week: data.weekStart });
            if (data.stars.length > 12) data.stars.length = 12;
        }
        data.weekly = {};
        data.weekStart = ws;
        saveData();
    }
}

function tick() {
    const now = Date.now();
    if (!lastTick) { lastTick = now; return; }
    const dt = now - lastTick;
    lastTick = now;
    checkWeekReset();
    const active = state.activeWindow;
    if (!active) return;
    let appId = null;
    const w = state.windows.find(w => w.element === active);
    if (w) appId = w.appId;
    if (!appId) return;
    currentFocusedApp = appId;
    data.weekly[appId] = (data.weekly[appId] || 0) + dt;
    data.allTime[appId] = (data.allTime[appId] || 0) + dt;
    if (Math.floor(now / 5000) % 2 === 0) saveData();
}

function getWeekly() {
    checkWeekReset();
    const entries = Object.entries(data.weekly).map(([appId, ms]) => {
        const cfg = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(appId)) || {};
        return { appId, ms, name: cfg.title || appId, icon: cfg.icon || null };
    }).sort((a, b) => b.ms - a.ms);
    return entries;
}

function getAllTime() {
    const entries = Object.entries(data.allTime).map(([appId, ms]) => {
        const cfg = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(appId)) || {};
        return { appId, ms, name: cfg.title || appId, icon: cfg.icon || null };
    }).sort((a, b) => b.ms - a.ms);
    return entries;
}

function getStars() {
    return data.stars.slice();
}

function getStarOfWeek() {
    const w = getWeekly();
    return w[0] || null;
}

function getMedal(rank) {
    if (rank === 0) return { metal: 'gold', color: '#fbbf24', label: '金' };
    if (rank === 1) return { metal: 'silver', color: '#cbd5e1', label: '银' };
    if (rank === 2) return { metal: 'bronze', color: '#d97706', label: '铜' };
    return null;
}

function formatDuration(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return '不足 1 分钟';
    if (m < 60) return m + ' 分钟';
    const h = (m / 60).toFixed(1);
    return h + ' 小时';
}

function injectStyles() {
    if (document.getElementById('mxos-leaderboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-leaderboard-styles';
    style.textContent = `
.mxos-lb-app{padding:24px;color:#e5e7eb;height:100%;overflow:auto;background:rgba(10,10,11,0.6)}
.mxos-lb-header{margin-bottom:20px}
.mxos-lb-title{font-size:22px;font-weight:700;margin:0 0 4px}
.mxos-lb-sub{font-size:13px;color:#9ca3af}
.mxos-lb-section{margin-bottom:24px}
.mxos-lb-section-title{font-size:14px;font-weight:600;color:#fbbf24;margin:0 0 12px;display:flex;align-items:center;gap:8px}
.mxos-lb-podium{display:flex;justify-content:center;gap:12px;align-items:flex-end;margin-bottom:12px}
.mxos-lb-podium-item{text-align:center;flex:1;max-width:120px}
.mxos-lb-medal{width:48px;height:48px;margin:0 auto 6px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#1a1a1a;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
.mxos-lb-podium-item.gold .mxos-lb-medal{background:linear-gradient(135deg,#fbbf24,#f59e0b);transform:scale(1.15)}
.mxos-lb-podium-item.silver .mxos-lb-medal{background:linear-gradient(135deg,#e5e7eb,#9ca3af)}
.mxos-lb-podium-item.bronze .mxos-lb-medal{background:linear-gradient(135deg,#fb923c,#c2410c);color:#fff}
.mxos-lb-podium-name{font-size:12px;font-weight:600;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mxos-lb-podium-time{font-size:11px;color:#9ca3af}
.mxos-lb-list{display:flex;flex-direction:column;gap:6px}
.mxos-lb-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.03)}
.mxos-lb-row.star{background:linear-gradient(90deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03));border:1px solid rgba(251,191,36,0.25)}
.mxos-lb-rank{width:24px;text-align:center;font-weight:700;color:#9ca3af}
.mxos-lb-name{flex:1;font-size:13px}
.mxos-lb-time{font-size:12px;color:#9ca3af}
.mxos-lb-star-badge{display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a1a1a;font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;margin-left:8px}
.mxos-lb-empty{text-align:center;padding:40px 20px;color:#6b7280;font-size:13px}
    `;
    document.head.appendChild(style);
}

function renderApp(contentEl) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'mxos-lb-app';
    const weekly = getWeekly();
    const star = getStarOfWeek();
    root.innerHTML = `
        <div class="mxos-lb-header">
            <div class="mxos-lb-title">窗口排行榜</div>
            <div class="mxos-lb-sub">本周使用时长统计 · 每周日重置</div>
        </div>
        <div id="mxosLbBody"></div>
    `;
    contentEl.appendChild(root);
    const body = root.querySelector('#mxosLbBody');
    if (!weekly.length) {
        body.innerHTML = `<div class="mxos-lb-empty">还没有使用记录，多用几个应用吧</div>`;
        return;
    }
    const top3 = weekly.slice(0, 3);
    const podium = document.createElement('div');
    podium.className = 'mxos-lb-section';
    podium.innerHTML = `<div class="mxos-lb-section-title">本周三甲</div><div class="mxos-lb-podium" id="mxosLbPodium"></div>`;
    body.appendChild(podium);
    const podiumEl = podium.querySelector('#mxosLbPodium');
    const order = [1, 0, 2];
    order.forEach(idx => {
        const item = top3[idx];
        if (!item) return;
        const medal = getMedal(idx);
        const cls = idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze';
        const div = document.createElement('div');
        div.className = `mxos-lb-podium-item ${cls}`;
        div.innerHTML = `
            <div class="mxos-lb-medal">${idx + 1}</div>
            <div class="mxos-lb-podium-name">${escapeHtml(item.name)}</div>
            <div class="mxos-lb-podium-time">${formatDuration(item.ms)}</div>
        `;
        podiumEl.appendChild(div);
    });

    const listSec = document.createElement('div');
    listSec.className = 'mxos-lb-section';
    listSec.innerHTML = `<div class="mxos-lb-section-title">完整榜单</div><div class="mxos-lb-list" id="mxosLbList"></div>`;
    body.appendChild(listSec);
    const listEl = listSec.querySelector('#mxosLbList');
    weekly.forEach((it, i) => {
        const row = document.createElement('div');
        row.className = 'mxos-lb-row' + (i === 0 ? ' star' : '');
        const starBadge = i === 0 ? '<span class="mxos-lb-star-badge">本周之星</span>' : '';
        row.innerHTML = `
            <div class="mxos-lb-rank">${i + 1}</div>
            <div class="mxos-lb-name">${escapeHtml(it.name)}${starBadge}</div>
            <div class="mxos-lb-time">${formatDuration(it.ms)}</div>
        `;
        listEl.appendChild(row);
    });

    if (data.stars.length) {
        const starsSec = document.createElement('div');
        starsSec.className = 'mxos-lb-section';
        starsSec.innerHTML = `<div class="mxos-lb-section-title">历届本周之星</div><div class="mxos-lb-list" id="mxosLbStars"></div>`;
        body.appendChild(starsSec);
        const starsEl = starsSec.querySelector('#mxosLbStars');
        data.stars.forEach(s => {
            const cfg = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(s.appId)) || {};
            const row = document.createElement('div');
            row.className = 'mxos-lb-row';
            const date = new Date(s.week).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
            row.innerHTML = `
                <div class="mxos-lb-rank">★</div>
                <div class="mxos-lb-name">${escapeHtml(cfg.title || s.appId)} <span style="color:#6b7280;font-size:11px">· ${date}</span></div>
                <div class="mxos-lb-time">${formatDuration(s.ms)}</div>
            `;
            starsEl.appendChild(row);
        });
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectStartMenuWidget() {
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) return;
    if (grid.querySelector('.mxos-lb-widget')) return;
    const weekly = getWeekly();
    if (!weekly.length) return;
    const widget = document.createElement('div');
    widget.className = 'mxos-lb-widget';
    widget.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;padding:10px 12px;margin-bottom:8px;background:linear-gradient(90deg,rgba(251,191,36,0.1),rgba(255,255,255,0.02));border:1px solid rgba(251,191,36,0.2);border-radius:10px';
    widget.innerHTML = `<div style="font-size:11px;color:#fbbf24;font-weight:700;display:flex;align-items:center;gap:4px">本周之星</div>`;
    weekly.slice(0, 3).forEach((it, i) => {
        const medal = getMedal(i);
        const item = document.createElement('div');
        item.style.cssText = 'flex:1;display:flex;align-items:center;gap:6px;font-size:11px;color:#d1d5db;min-width:0';
        item.innerHTML = `<span style="width:16px;height:16px;border-radius:50%;background:${medal.color};color:#1a1a1a;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex-shrink:0">${i+1}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(it.name)}</span>`;
        widget.appendChild(item);
    });
    grid.parentNode.insertBefore(widget, grid);
}

let tickHandle = null;
let widgetHandle = null;

function start() {
    if (tickHandle) return;
    lastTick = Date.now();
    tickHandle = setInterval(tick, 1000);
}

function stop() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    saveData();
}

function registerApp() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: '窗口排行榜', icon: 'dashboard', width: 760, height: 600, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(registerApp, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-dashboard"/></svg><span>排行榜</span>`;
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    checkWeekReset();
    start();
    window.MXOS.Features.leaderboard = {
        getWeekly, getAllTime, getStars, getStarOfWeek,
        renderApp, formatDuration
    };
    setTimeout(injectStartMenuWidget, 2000);
    widgetHandle = setInterval(injectStartMenuWidget, 30000);
    setTimeout(registerApp, 2000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getWeekly, getAllTime, getStarOfWeek };
