import { state, appConfigs } from '../state.js';
import { eventBus } from '../utils/event-bus.js';

window.MXOS = window.MXOS || {};
window.MXOS.Recommend = window.MXOS.Recommend || {};

const USAGE_KEY = 'mxos_app_usage';
const RECOMMENDATION_LIMIT = 5;
const USAGE_WINDOW_DAYS = 30;

function loadUsage() {
    try {
        const arr = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
        return arr && typeof arr === 'object' ? arr : {};
    } catch (e) { return {}; }
}

function saveUsage(data) {
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function pruneOld(usage) {
    const cutoff = Date.now() - USAGE_WINDOW_DAYS * 24 * 3600 * 1000;
    let changed = false;
    Object.keys(usage).forEach(appId => {
        const rec = usage[appId];
        if (!rec || !Array.isArray(rec.sessions)) return;
        const before = rec.sessions.length;
        rec.sessions = rec.sessions.filter(s => (s.ts || 0) >= cutoff);
        if (rec.sessions.length !== before) changed = true;
        if (rec.lastOpen && rec.lastOpen < cutoff) {
        }
    });
    return usage;
}

function recordUsage(appId, options) {
    if (!appId) return;
    const opts = options || {};
    const usage = pruneOld(loadUsage());
    if (!usage[appId]) {
        usage[appId] = { opens: 0, totalMs: 0, sessions: [], lastOpen: 0 };
    }
    const rec = usage[appId];
    rec.opens = (rec.opens || 0) + 1;
    rec.lastOpen = Date.now();
    if (opts.durationMs) {
        rec.totalMs = (rec.totalMs || 0) + (opts.durationMs || 0);
    }
    rec.sessions = rec.sessions || [];
    rec.sessions.push({ ts: Date.now(), durationMs: opts.durationMs || 0 });
    if (rec.sessions.length > 200) rec.sessions = rec.sessions.slice(-200);
    saveUsage(usage);
    eventBus.emit('recommend:usage', { appId, opens: rec.opens, lastOpen: rec.lastOpen });
}

function recordOpen(appId) {
    recordUsage(appId, {});
}

function recordDuration(appId, durationMs) {
    if (!appId || !durationMs) return;
    const usage = pruneOld(loadUsage());
    if (!usage[appId]) {
        usage[appId] = { opens: 0, totalMs: 0, sessions: [], lastOpen: 0 };
    }
    usage[appId].totalMs = (usage[appId].totalMs || 0) + durationMs;
    usage[appId].sessions = usage[appId].sessions || [];
    const last = usage[appId].sessions[usage[appId].sessions.length - 1];
    if (last) last.durationMs = (last.durationMs || 0) + durationMs;
    saveUsage(usage);
}

function getUsageScore(appId, now) {
    const usage = loadUsage();
    const rec = usage[appId];
    if (!rec) return 0;
    let score = 0;
    score += (rec.opens || 0) * 5;
    score += Math.min(50, (rec.totalMs || 0) / 60000);
    if (rec.lastOpen) {
        const daysAgo = (now - rec.lastOpen) / (24 * 3600 * 1000);
        if (daysAgo < 1) score += 15;
        else if (daysAgo < 3) score += 8;
        else if (daysAgo < 7) score += 4;
        else if (daysAgo < 14) score += 1;
    }
    return score;
}

function getInstalledAppList() {
    const list = [];
    Object.keys(appConfigs).forEach(id => {
        const cfg = appConfigs[id];
        if (cfg && cfg.title && !['store', 'recycle-bin', 'settings', 'this-pc'].includes(id)) {
            list.push({ id, title: cfg.title, icon: cfg.icon });
        }
    });
    (state.installedApps || []).forEach(app => {
        list.push({ id: app.id, title: app.name, icon: app.icon, thirdparty: true });
    });
    return list;
}

function timeOfDayContext() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 14) return 'noon';
    if (h >= 14 && h < 18) return 'afternoon';
    if (h >= 18 && h < 23) return 'evening';
    return 'night';
}

function weatherContext() {
    try {
        if (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.weather === 'function') {
            const cache = localStorage.getItem('mxos_real_weather');
            if (cache) {
                const obj = JSON.parse(cache);
                if (obj && obj.data) return obj.data;
            }
        }
    } catch (e) {}
    return null;
}

const CONTEXT_APP_HINTS = {
    morning: ['calculator', 'calendar', 'clock', 'office', 'word', 'excel'],
    noon: ['music', 'browser', 'store', 'office'],
    afternoon: ['browser', 'office', 'excel', 'ppt', 'calculator'],
    evening: ['music', 'browser', 'notepad', 'office'],
    night: ['music', 'browser', 'notepad']
};

const WEATHER_APP_HINTS = {
    rain: ['music', 'browser', 'notepad'],
    snow: ['music', 'browser'],
    thunderstorm: ['music', 'browser'],
    clear: ['browser', 'office', 'store', 'calculator'],
    cloudy: ['browser', 'office', 'music'],
    'partly-cloudy': ['browser', 'office', 'music']
};

function getRecommendations(limit) {
    const maxCount = limit && limit > 0 ? limit : RECOMMENDATION_LIMIT;
    const apps = getInstalledAppList();
    const now = Date.now();
    const ctxTime = timeOfDayContext();
    const weather = weatherContext();
    const usage = loadUsage();
    pruneOld(usage);

    const scored = apps.map(app => {
        let score = getUsageScore(app.id, now);
        if (CONTEXT_APP_HINTS[ctxTime] && CONTEXT_APP_HINTS[ctxTime].indexOf(app.id) >= 0) score += 6;
        if (weather && weather.icon && WEATHER_APP_HINTS[weather.icon] && WEATHER_APP_HINTS[weather.icon].indexOf(app.id) >= 0) score += 4;
        if (app.thirdparty) score += 2;
        return { ...app, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount).filter(a => a.score > 0).map(a => ({ id: a.id, title: a.title, icon: a.icon, thirdparty: !!a.thirdparty, score: a.score }));
}

function recordSessionStart(appId) {
    if (!appId) return null;
    const usage = pruneOld(loadUsage());
    if (!usage[appId]) usage[appId] = { opens: 0, totalMs: 0, sessions: [], lastOpen: 0 };
    usage[appId].opens = (usage[appId].opens || 0) + 1;
    usage[appId].lastOpen = Date.now();
    usage[appId].sessions = usage[appId].sessions || [];
    usage[appId].sessions.push({ ts: Date.now(), durationMs: 0 });
    if (usage[appId].sessions.length > 200) usage[appId].sessions = usage[appId].sessions.slice(-200);
    saveUsage(usage);
    return { appId, startedAt: Date.now() };
}

function recordSessionEnd(session) {
    if (!session || !session.appId) return;
    const duration = Date.now() - (session.startedAt || Date.now());
    recordDuration(session.appId, duration);
    eventBus.emit('recommend:session-end', { appId: session.appId, durationMs: duration });
}

function renderRecommendations(container, options) {
    if (!container) return;
    const opts = options || {};
    const recs = getRecommendations(opts.limit || 5);
    if (recs.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    container.style.display = '';
    container.innerHTML = `
        <div style="font-size:12px;color:var(--text-secondary,#9ca3af);margin-bottom:8px;padding:0 4px;display:flex;align-items:center;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
            <span>猜你想用</span>
        </div>
        <div class="mxos-recommend-list" style="display:grid;grid-template-columns:repeat(${Math.min(recs.length, 5)},1fr);gap:8px">
            ${recs.map(r => `
                <div class="mxos-recommend-item" data-app="${escapeAttr(r.id)}" data-thirdparty="${r.thirdparty ? '1' : '0'}" role="button" tabindex="0" style="display:flex;flex-direction:column;align-items:center;padding:10px 6px;border-radius:8px;cursor:pointer;transition:background 0.15s">
                    <svg width="32" height="32" viewBox="0 0 40 40" style="border-radius:8px"><use href="#svg-${escapeAttr(r.icon || 'app-default')}"/></svg>
                    <span style="margin-top:6px;font-size:11px;color:var(--text-color,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72px;text-align:center">${escapeHtml(r.title)}</span>
                </div>
            `).join('')}
        </div>
    `;
    container.querySelectorAll('.mxos-recommend-item').forEach(el => {
        el.addEventListener('mouseenter', () => {
            el.style.background = 'var(--hover-bg, rgba(255,255,255,0.08))';
        });
        el.addEventListener('mouseleave', () => {
            el.style.background = '';
        });
        el.addEventListener('click', () => {
            const appId = el.dataset.app;
            if (el.dataset.thirdparty === '1') {
                const app = (state.installedApps || []).find(a => a.id === appId);
                if (app && window.MXOS && window.MXOS.Recommend && typeof window.MXOS.Recommend.launch === 'function') {
                    window.MXOS.Recommend.launch(app);
                } else if (window.MXOS && window.MXOS.state && window.MXOS.state.thirdPartyAppData && window.MXOS.state.thirdPartyAppData[appId]) {
                    const data = window.MXOS.state.thirdPartyAppData[appId];
                    if (window.MXOS.Recommend && typeof window.MXOS.Recommend.launch === 'function') {
                        window.MXOS.Recommend.launch(data);
                    }
                }
            } else {
                if (window.MXOS && typeof window.MXOS.openApp === 'function') {
                    window.MXOS.openApp(appId);
                }
            }
            const startMenu = document.getElementById('startMenu');
            if (startMenu) window.MXOS.closeStartMenu();
        });
    });
}

function launch(app) {
    if (!app) return false;
    recordOpen(app.id);
    if (window.MXOS && typeof window.MXOS.openApp === 'function') {
        return window.MXOS.openApp(app.id);
    }
    return false;
}

function renderStartMenuRecommend() {
    const startMenu = document.getElementById('startMenu');
    if (!startMenu) return null;
    let container = document.getElementById('mxos-recommend-section');
    if (!container) {
        const pinned = startMenu.querySelector('.start-pinned');
        container = document.createElement('div');
        container.id = 'mxos-recommend-section';
        container.style.cssText = 'padding:0 16px 12px;border-bottom:1px solid var(--glass-border,rgba(255,255,255,0.08));margin-bottom:8px';
        if (pinned && pinned.parentNode) {
            pinned.parentNode.insertBefore(container, pinned);
        } else {
            startMenu.appendChild(container);
        }
    }
    renderRecommendations(container, { limit: 5 });
    return container;
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

const Recommend = {
    getRecommendations,
    recordUsage,
    recordOpen,
    recordDuration,
    recordSessionStart,
    recordSessionEnd,
    renderRecommendations,
    renderStartMenuRecommend,
    launch,
    getUsageScore
};

window.MXOS.Recommend = Recommend;

window.addEventListener('mxos:window-opened', (e) => {
    const detail = e && e.detail;
    if (detail && detail.appId) {
        let appId = detail.appId;
        if (appId.indexOf('thirdparty_') === 0) {
            appId = appId.slice('thirdparty_'.length);
        }
        recordOpen(appId);
    }
});

let refreshTimer = null;
window.addEventListener('mxos:desktop-ready', () => {
    setTimeout(renderStartMenuRecommend, 300);
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(renderStartMenuRecommend, 5 * 60 * 1000);
});

document.addEventListener('click', (e) => {
    if (e.target.closest('#startButton')) {
        setTimeout(renderStartMenuRecommend, 50);
    }
});

export { getRecommendations, recordUsage, recordOpen, renderRecommendations, renderStartMenuRecommend, launch };
export default Recommend;


