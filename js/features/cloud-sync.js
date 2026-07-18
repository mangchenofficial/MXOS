import { state } from '../state.js';
import { eventBus } from '../utils/event-bus.js';
import { http } from '../utils/http.js';

const TOKEN_KEY = 'mxos_session_token';
const PUSH_DEBOUNCE_MS = 2000;
const SYNC_VERSION = 1;

window.MXOS = window.MXOS || {};
const MXOS = window.MXOS;
MXOS.Cloud = MXOS.Cloud || {};

function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function notify(title, body, type = 'info') {
    if (MXOS.notify && typeof MXOS.notify === 'function') {
        try { MXOS.notify({ title, body, type, duration: 3500 }); return; } catch (e) {}
    }
    console.log('[Cloud]', title, body);
}

function isUserLoggedIn() {
    return !!(state.user && state.user.isLoggedIn && getToken());
}

function setStatus(status, extra = {}) {
    state.cloudSync.status = status;
    if (status === 'success') state.cloudSync.lastSync = Date.now();
    eventBus.emit('cloud:status', { status, ...extra });
}

function getStatus() {
    return {
        status: state.cloudSync.status,
        lastSync: state.cloudSync.lastSync,
        conflictMode: state.cloudSync.conflictMode,
        loggedIn: isUserLoggedIn(),
        lastSyncLabel: state.cloudSync.lastSync
            ? new Date(state.cloudSync.lastSync).toLocaleString('zh-CN')
            : '尚未同步'
    };
}

function collectLocalData() {
    const data = {
        version: SYNC_VERSION,
        timestamp: Date.now(),
        settings: {},
        installedApps: [],
        desktopLayout: {}
    };
    try {
        const persistKeys = ['mxos_personalization', 'mxos_theme_mode', 'accentColor', 'mxos_reduce_motion'];
        persistKeys.forEach(k => {
            const v = localStorage.getItem(k);
            if (v != null) data.settings[k] = v;
        });
        data.settings.personalizationSettings = JSON.parse(JSON.stringify(state.personalizationSettings || {}));
    } catch (e) {}
    try {
        data.installedApps = JSON.parse(localStorage.getItem('mxos_installed_apps') || '[]');
    } catch (e) { data.installedApps = []; }
    try {
        const desktop = document.getElementById('desktop');
        if (desktop) {
            const positions = {};
            desktop.querySelectorAll('.desktop-icon').forEach(el => {
                const app = el.dataset.app;
                if (app) positions[app] = { x: el.offsetLeft, y: el.offsetTop };
            });
            data.desktopLayout = positions;
        }
    } catch (e) {}
    return data;
}

function applyCloudData(cloudData, mode = 'merge') {
    if (!cloudData || typeof cloudData !== 'object') return false;
    try {
        if (cloudData.settings) {
            const s = cloudData.settings;
            if (mode === 'cloud' || mode === 'merge') {
                if (s.personalizationSettings && typeof s.personalizationSettings === 'object') {
                    Object.assign(state.personalizationSettings, s.personalizationSettings);
                    try { localStorage.setItem('mxos_personalization', JSON.stringify(state.personalizationSettings)); } catch (e) {}
                    window.dispatchEvent(new CustomEvent('wallpaper-change', {
                        detail: { url: state.personalizationSettings.wallpaper, type: state.personalizationSettings.wallpaperType }
                    }));
                    if (state.personalizationSettings.accentColor) {
                        document.documentElement.style.setProperty('--accent-color', state.personalizationSettings.accentColor);
                    }
                }
                Object.keys(s).forEach(k => {
                    if (k === 'personalizationSettings') return;
                    try { localStorage.setItem(k, s[k]); } catch (e) {}
                });
            }
        }
        if (cloudData.installedApps && (mode === 'cloud' || mode === 'merge')) {
            const cloud = Array.isArray(cloudData.installedApps) ? cloudData.installedApps : [];
            if (mode === 'cloud') {
                state.installedApps = cloud;
                try { localStorage.setItem('mxos_installed_apps', JSON.stringify(cloud)); } catch (e) {}
                eventBus.emit('apps:changed', { source: 'cloud' });
            } else {
                const localMap = new Map(state.installedApps.map(a => [a.id, a]));
                cloud.forEach(a => { if (a && a.id && !localMap.has(a.id)) localMap.set(a.id, a); });
                state.installedApps = Array.from(localMap.values());
                try { localStorage.setItem('mxos_installed_apps', JSON.stringify(state.installedApps)); } catch (e) {}
                eventBus.emit('apps:changed', { source: 'cloud-merge' });
            }
        }
        if (cloudData.desktopLayout && (mode === 'cloud' || mode === 'merge')) {
            const layout = cloudData.desktopLayout;
            Object.keys(layout).forEach(app => {
                const pos = layout[app];
                if (!pos) return;
                const el = document.querySelector(`.desktop-icon[data-app="${CSS.escape(app)}"]`);
                if (el) {
                    if (pos.x != null) el.style.left = pos.x + 'px';
                    if (pos.y != null) el.style.top = pos.y + 'px';
                }
            });
        }
        return true;
    } catch (e) {
        console.error('[Cloud] 应用云端数据失败:', e);
        return false;
    }
}

async function request(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET') return http.get(path, options);
    if (method === 'POST') return http.post(path, options.body, options);
    if (method === 'PUT') return http.put(path, options.body, options);
    if (method === 'DELETE') return http.del(path, options);
    return http.request(path, options);
}

let pushTimer = null;
let pushQueue = new Set();

function schedulePush(type) {
    if (!isUserLoggedIn()) return;
    pushQueue.add(type);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
        pushTimer = null;
        const types = Array.from(pushQueue);
        pushQueue.clear();
        push(types).catch(() => {});
    }, PUSH_DEBOUNCE_MS);
}

async function push(types = ['settings', 'apps', 'desktop']) {
    if (!isUserLoggedIn()) return { skipped: true, reason: 'not-logged-in' };
    setStatus('pushing');
    try {
        const data = collectLocalData();
        const payload = {
            types,
            data,
            clientTime: Date.now()
        };
        const res = await request('/sync/push', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        setStatus('success', { direction: 'push' });
        eventBus.emit('cloud:push', { ok: true, types });
        return res;
    } catch (e) {
        setStatus('error', { direction: 'push', error: e.message });
        eventBus.emit('cloud:push', { ok: false, error: e.message });
        if (e.status === 404 || e.message === 'Failed to fetch') {
            notify('云同步不可用', '同步服务暂不可用', 'warning');
        }
        throw e;
    }
}

async function pull(options = {}) {
    const { silent = false, askConflict = false } = options;
    if (!isUserLoggedIn()) return { skipped: true, reason: 'not-logged-in' };
    setStatus('pulling');
    try {
        const res = await request('/sync/pull', { method: 'GET' });
        const cloudData = res.data || res.payload || res;
        if (!cloudData || (res.empty === true) || (!cloudData.settings && !cloudData.installedApps && !cloudData.desktopLayout)) {
            setStatus('success', { direction: 'pull', empty: true });
            eventBus.emit('cloud:pull', { ok: true, empty: true });
            return { empty: true };
        }
        let mode = 'merge';
        if (askConflict) {
            mode = await askConflictMode();
        }
        const applied = applyCloudData(cloudData, mode);
        setStatus('success', { direction: 'pull', mode });
        eventBus.emit('cloud:pull', { ok: true, mode, applied });
        if (!silent) notify('云端数据已同步', `已${mode === 'cloud' ? '使用云端' : mode === 'local' ? '保留本地' : '合并'}数据`, 'success');
        return { ok: true, mode, data: cloudData };
    } catch (e) {
        setStatus('error', { direction: 'pull', error: e.message });
        eventBus.emit('cloud:pull', { ok: false, error: e.message });
        if (e.status === 404 || e.message === 'Failed to fetch') {
            if (!silent) notify('云同步不可用', '同步服务暂不可用', 'warning');
        }
        throw e;
    }
}

function askConflictMode() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'mxos-conflict-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', '云端数据同步');
        modal.innerHTML = `
            <div class="mxos-conflict-overlay"></div>
            <div class="mxos-conflict-panel">
                <div class="mxos-conflict-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
                </div>
                <h2 class="mxos-conflict-title">发现云端同步数据</h2>
                <p class="mxos-conflict-subtitle">检测到您的账户已有云端数据，请选择同步方式</p>
                <div class="mxos-conflict-options">
                    <button class="mxos-conflict-option" data-mode="cloud">
                        <div class="opt-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        </div>
                        <div class="opt-text">
                            <div class="opt-title">使用云端</div>
                            <div class="opt-desc">下载云端数据覆盖本地</div>
                        </div>
                    </button>
                    <button class="mxos-conflict-option" data-mode="local">
                        <div class="opt-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        </div>
                        <div class="opt-text">
                            <div class="opt-title">保留本地</div>
                            <div class="opt-desc">忽略云端，保留当前数据</div>
                        </div>
                    </button>
                    <button class="mxos-conflict-option" data-mode="merge">
                        <div class="opt-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v18M16 3v18M3 8h18M3 16h18"/></svg>
                        </div>
                        <div class="opt-text">
                            <div class="opt-title">合并</div>
                            <div class="opt-desc">本地与云端数据合并（推荐）</div>
                        </div>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        injectConflictStyles();
        requestAnimationFrame(() => modal.classList.add('show'));

        const cleanup = () => {
            modal.classList.remove('show');
            setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 250);
        };

        modal.querySelectorAll('.mxos-conflict-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                cleanup();
                resolve(mode);
            });
        });
        modal.querySelector('.mxos-conflict-overlay').addEventListener('click', () => {
            cleanup();
            resolve('merge');
        });
    });
}

function injectConflictStyles() {
    if (document.getElementById('mxos-conflict-style')) return;
    const style = document.createElement('style');
    style.id = 'mxos-conflict-style';
    style.textContent = `
    #mxos-conflict-modal{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;pointer-events:none}
    .mxos-conflict-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.5);opacity:0;transition:opacity 0.25s}
    .mxos-conflict-panel{position:relative;width:440px;max-width:92vw;background:rgba(28,28,35,0.82);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border:1px solid rgba(255,255,255,0.12);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,0.6);padding:28px;color:#fff;transform:translateY(12px) scale(0.96);opacity:0;transition:transform 0.28s cubic-bezier(0.4,0,0.2,1),opacity 0.28s}
    #mxos-conflict-modal.show{pointer-events:auto}
    #mxos-conflict-modal.show .mxos-conflict-overlay{opacity:1}
    #mxos-conflict-modal.show .mxos-conflict-panel{transform:translateY(0) scale(1);opacity:1}
    .mxos-conflict-icon{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#60a5fa,#a5b4fc);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:#fff;box-shadow:0 8px 20px rgba(96,165,250,0.35)}
    .mxos-conflict-title{margin:0 0 6px;font-size:18px;font-weight:600;text-align:center}
    .mxos-conflict-subtitle{margin:0 0 20px;color:#94a3b8;font-size:12px;text-align:center}
    .mxos-conflict-options{display:flex;flex-direction:column;gap:10px}
    .mxos-conflict-option{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;color:#fff;cursor:pointer;transition:background 0.15s,border-color 0.15s;text-align:left}
    .mxos-conflict-option:hover{background:rgba(96,165,250,0.12);border-color:rgba(96,165,250,0.4)}
    .opt-icon{width:40px;height:40px;border-radius:10px;background:rgba(96,165,250,0.15);color:#60a5fa;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .opt-text{flex:1}
    .opt-title{font-size:14px;font-weight:600;margin-bottom:2px}
    .opt-desc{font-size:11px;color:#94a3b8}
    `;
    document.head.appendChild(style);
}

async function sync() {
    if (!isUserLoggedIn()) {
        notify('未登录', '请先登录后再同步', 'warning');
        return { skipped: true, reason: 'not-logged-in' };
    }
    setStatus('syncing');
    try {
        await push(['settings', 'apps', 'desktop']);
        await pull({ silent: true });
        notify('同步完成', '云端与本地数据已同步', 'success');
        return { ok: true };
    } catch (e) {
        notify('同步失败', e.message || '请稍后重试', 'error');
        throw e;
    }
}

let firstPullDone = false;
async function firstPullAfterLogin() {
    if (firstPullDone) return;
    firstPullDone = true;
    try {
        const res = await pull({ silent: true, askConflict: true });
        if (res && res.ok) {
            notify('云端数据已加载', `已${res.mode === 'cloud' ? '使用云端' : res.mode === 'local' ? '保留本地' : '合并'}同步数据`, 'success');
        }
    } catch (e) {
        firstPullDone = false;
    }
}

function debounce(fn, ms) {
    let t = null;
    return function (...args) {
        if (t) clearTimeout(t);
        t = setTimeout(() => { t = null; fn.apply(this, args); }, ms);
    };
}

const debouncedPushSettings = debounce(() => schedulePush('settings'), PUSH_DEBOUNCE_MS);
const debouncedPushApps = debounce(() => schedulePush('apps'), PUSH_DEBOUNCE_MS);
const debouncedPushDesktop = debounce(() => schedulePush('desktop'), PUSH_DEBOUNCE_MS);

function bindListeners() {
    eventBus.on('storage:set', () => debouncedPushSettings());
    eventBus.on('storage:remove', () => debouncedPushSettings());
    eventBus.on('theme:change', () => debouncedPushSettings());
    window.addEventListener('wallpaper-change', () => debouncedPushSettings());

    eventBus.on('apps:changed', (data) => {
        if (data && (data.source === 'cloud' || data.source === 'cloud-merge')) return;
        debouncedPushApps();
    });
    window.addEventListener('storage', (e) => {
        if (e.key === 'mxos_installed_apps') {
            debouncedPushApps();
        }
    });

    let dragTimer = null;
    document.addEventListener('dragend', () => {
        if (dragTimer) clearTimeout(dragTimer);
        dragTimer = setTimeout(() => debouncedPushDesktop(), 500);
    }, true);
    window.addEventListener('windowResizeEnd', () => debouncedPushDesktop());

    eventBus.on('user:login', () => {
        firstPullAfterLogin();
    });
    eventBus.on('user:logout', () => {
        firstPullDone = false;
        setStatus('idle');
    });
}

function init() {
    bindListeners();
    if (isUserLoggedIn()) {
        setTimeout(() => firstPullAfterLogin(), 1500);
    }
}

MXOS.Cloud = {
    sync,
    push,
    pull,
    getStatus,
    collectLocalData,
    applyCloudData,
    isUserLoggedIn
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { sync, push, pull, getStatus, collectLocalData, applyCloudData };
export default MXOS.Cloud;
