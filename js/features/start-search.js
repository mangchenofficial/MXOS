import { state, appConfigs } from '../state.js';
import { createWindow, launchThirdPartyApp } from '../core.js';
import { debounce } from '../utils/debounce.js';

let worker = null;
let searchSeq = 0;
let pendingResolve = null;
let selectedIndex = -1;

function ensureWorker() {
    if (worker) return worker;
    try {
        worker = new Worker(new URL('../workers/start-search.worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
        try { worker = new Worker('js/workers/start-search.worker.js'); }
        catch (e2) { worker = null; return null; }
    }
    worker.onmessage = (e) => {
        const data = e.data || {};
        if (data.type === 'results' && pendingResolve) {
            const cb = pendingResolve;
            pendingResolve = null;
            cb(data.results);
        }
    };
    worker.onerror = () => {};
    return worker;
}

function collectApps() {
    const apps = [];
    Object.keys(appConfigs).forEach(id => {
        const cfg = appConfigs[id];
        if (cfg && cfg.title) {
            apps.push({ id, name: cfg.title, type: 'builtin', icon: cfg.icon || 'app-default' });
        }
    });
    state.installedApps.forEach(app => {
        apps.push({
            id: app.id,
            name: app.name || app.id,
            type: 'installed',
            icon: app.icon || 'app-default'
        });
    });
    return apps;
}

function collectSettings() {
    return [
        { id: 'settings', name: '个性化', section: 'personalization' },
        { id: 'settings', name: '显示设置', section: 'display' },
        { id: 'settings', name: '声音', section: 'sound' },
        { id: 'settings', name: '网络', section: 'network' },
        { id: 'settings', name: '账户', section: 'account' },
        { id: 'settings', name: '时间与语言', section: 'time' },
        { id: 'settings', name: '应用', section: 'apps' },
        { id: 'settings', name: '隐私', section: 'privacy' },
        { id: 'settings', name: '更新', section: 'update' }
    ];
}

function initWorkerData() {
    const w = ensureWorker();
    if (!w) return;
    w.postMessage({ type: 'init', apps: collectApps(), settings: collectSettings() });
}

function searchViaWorker(query) {
    return new Promise((resolve) => {
        const w = ensureWorker();
        if (!w) { resolve({ apps: [], settings: [], docs: [] }); return; }
        const id = ++searchSeq;
        pendingResolve = (results) => resolve(results);
        w.postMessage({ type: 'search', query, id });
        setTimeout(() => {
            if (pendingResolve) {
                pendingResolve = null;
                resolve({ apps: [], settings: [], docs: [] });
            }
        }, 2000);
    });
}

function searchSync(query) {
    const q = String(query).trim().toLowerCase();
    if (!q) return { apps: [], settings: [], docs: [] };
    const apps = collectApps();
    const settings = collectSettings();
    const matchedApps = apps.filter(a =>
        (a.name || '').toLowerCase().includes(q) || (a.id || '').toLowerCase().includes(q)
    ).slice(0, 5);
    const matchedSettings = settings.filter(s =>
        (s.name || '').toLowerCase().includes(q)
    ).slice(0, 5);
    return { apps: matchedApps, settings: matchedSettings, docs: [] };
}

function ensureSearchContainer() {
    const startMenu = document.getElementById('startMenu');
    if (!startMenu) return null;
    let container = document.getElementById('startSearchResults');
    if (container) return container;
    container = document.createElement('div');
    container.id = 'startSearchResults';
    container.className = 'start-search-results';
    container.style.cssText = 'padding:0 16px 16px;max-height:320px;overflow-y:auto;display:none';
    startMenu.appendChild(container);

    if (!document.getElementById('start-search-style')) {
        const style = document.createElement('style');
        style.id = 'start-search-style';
        style.textContent = `
.start-search-results { color: var(--text-color); }
.start-search-group-title { font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin:8px 4px 4px; }
.start-search-item { display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;transition:background 0.12s; }
.start-search-item:hover { background: var(--hover-bg); }
.start-search-item.selected { background: var(--hover-bg); }
.start-search-item-icon { width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.start-search-item-name { font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.start-search-loading { display:flex;align-items:center;gap:8px;padding:12px 16px;color:var(--text-secondary);font-size:13px; }
.start-search-loading .spinner { width:14px;height:14px;border:2px solid var(--glass-border);border-top-color:var(--accent-color, #60a5fa);border-radius:50%;animation:startSearchSpin 0.8s linear infinite; }
@keyframes startSearchSpin { to { transform: rotate(360deg); } }
.start-search-loading .spinner { animation: startSearchSpin 0.8s linear infinite; }
.start-search-empty { padding:16px;text-align:center;color:var(--text-secondary);font-size:13px; }
        `;
        document.head.appendChild(style);
    }
    return container;
}

function showLoading(container) {
    container.innerHTML = '<div class="start-search-loading"><div class="spinner"></div><span>搜索中...</span></div>';
    container.style.display = 'block';
}

function getSearchItems() {
    const container = document.getElementById('startSearchResults');
    if (!container) return [];
    return Array.from(container.querySelectorAll('.start-search-item'));
}

function updateSelectedHighlight() {
    const container = document.getElementById('startSearchResults');
    if (!container) return;
    container.querySelectorAll('.start-search-item.selected').forEach(el => el.classList.remove('selected'));
    const items = getSearchItems();
    if (selectedIndex >= 0 && selectedIndex < items.length) {
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
}

function renderResults(container, results) {
    const { apps, settings, docs } = results;
    const total = (apps ? apps.length : 0) + (settings ? settings.length : 0) + (docs ? docs.length : 0);
    if (total === 0) {
        container.innerHTML = '<div class="start-search-empty">无搜索结果</div>';
        container.style.display = 'block';
        selectedIndex = -1;
        return;
    }
    let html = '';
    if (apps && apps.length > 0) {
        html += '<div class="start-search-group-title">应用</div>';
        apps.forEach(app => {
            const isInstalled = app.type === 'installed';
            html += `<div class="start-search-item" data-app-id="${escapeHtml(app.id)}" data-app-type="${escapeHtml(app.type || 'builtin')}">
                <div class="start-search-item-icon"><svg width="24" height="24" viewBox="0 0 40 40"><use href="#svg-${escapeHtml(app.icon || 'app-default')}"/></svg></div>
                <div class="start-search-item-name">${escapeHtml(app.name)}</div>
            </div>`;
        });
    }
    if (settings && settings.length > 0) {
        html += '<div class="start-search-group-title">设置</div>';
        settings.forEach(s => {
            html += `<div class="start-search-item" data-setting-section="${escapeHtml(s.section || '')}">
                <div class="start-search-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
                <div class="start-search-item-name">${escapeHtml(s.name)}</div>
            </div>`;
        });
    }
    container.innerHTML = html;
    container.style.display = 'block';

    container.querySelectorAll('.start-search-item[data-app-id]').forEach(item => {
        item.addEventListener('click', () => {
            const appId = item.dataset.appId;
            const appType = item.dataset.appType;
            window.MXOS.closeStartMenu();
            clearSearch();
            if (appType === 'installed') {
                const app = state.installedApps.find(a => a.id === appId);
                if (app) launchThirdPartyApp(app);
            } else {
                createWindow(appId);
            }
        });
    });
    container.querySelectorAll('.start-search-item[data-setting-section]').forEach(item => {
        item.addEventListener('click', () => {
            window.MXOS.closeStartMenu();
            clearSearch();
            createWindow('settings');
        });
    });

    selectedIndex = -1;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function clearSearch() {
    const container = document.getElementById('startSearchResults');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    const searchInput = document.querySelector('.start-search');
    if (searchInput) searchInput.value = '';
    selectedIndex = -1;
    showPinned(true);
}

function showPinned(show) {
    const pinned = document.querySelector('.start-pinned');
    if (pinned) pinned.style.display = show ? '' : 'none';
}

const performSearch = debounce(async (query) => {
    const container = ensureSearchContainer();
    if (!container) return;
    const q = String(query).trim();
    if (!q) {
        container.innerHTML = '';
        container.style.display = 'none';
        showPinned(true);
        return;
    }
    showPinned(false);
    showLoading(container);
    let results;
    const w = ensureWorker();
    if (w) {
        initWorkerData();
        results = await searchViaWorker(q);
    } else {
        results = searchSync(q);
    }
    const currentInput = document.querySelector('.start-search');
    if (!currentInput || currentInput.value.trim() !== q) return;
    renderResults(container, results);
}, 300);

export function initStartSearch() {
    const startMenu = document.getElementById('startMenu');
    if (!startMenu) return;
    const searchInput = startMenu.querySelector('.start-search');
    if (!searchInput) return;
    if (searchInput.dataset.bound === '1') return;
    searchInput.dataset.bound = '1';

    searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSearch();
            window.MXOS.closeStartMenu();
            return;
        }
        const items = getSearchItems();
        if (items.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelectedHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelectedHighlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const idx = selectedIndex >= 0 ? selectedIndex : 0;
            if (items[idx]) items[idx].click();
        }
    });

    const observer = new MutationObserver(() => {
        if (!startMenu.classList.contains('show')) {
            clearSearch();
        }
    });
    observer.observe(startMenu, { attributes: true, attributeFilter: ['class'] });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStartSearch);
} else {
    initStartSearch();
}

window.MXOS = window.MXOS || {};
window.MXOS.initStartSearch = initStartSearch;


