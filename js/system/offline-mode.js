window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

let statusBar = null;
let lastOnline = navigator.onLine;
const syncQueue = [];
const listeners = [];

function createStatusBar() {
    if (statusBar) return statusBar;
    const container = document.getElementById('mxos-status-bar-container') || document.body;
    statusBar = document.createElement('div');
    statusBar.id = 'mxos-offline-status';
    statusBar.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100vw;height:28px;background:linear-gradient(90deg,#f59e0b,#d97706);color:#1f2937;font-family:MiSans,Microsoft YaHei,sans-serif;font-size:13px;font-weight:600;align-items:center;justify-content:center;gap:8px;z-index:999998;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
    statusBar.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
        <span>离线模式</span>
        <span style="font-weight:400;font-size:12px;opacity:0.85">部分功能可能不可用，联网后将自动同步</span>
    `;
    container.appendChild(statusBar);
    return statusBar;
}

function adjustTopOffset() {
    if (!statusBar) return;
    if (navigator.onLine) {
        document.body.style.paddingTop = '';
    } else {
        document.body.style.paddingTop = '28px';
    }
}

function showOfflineBar() {
    if (!statusBar) createStatusBar();
    statusBar.style.display = 'flex';
    adjustTopOffset();
    document.body.classList.add('mxos-offline');
    window.dispatchEvent(new CustomEvent('mxos:online-change', { detail: { online: false } }));
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        window.MXOS.notify({ title: '已进入离线模式', body: '网络连接已断开', type: 'warning', duration: 3000 });
    }
}

function hideOfflineBar() {
    if (statusBar) {
        statusBar.style.display = 'none';
    }
    adjustTopOffset();
    document.body.classList.remove('mxos-offline');
    window.dispatchEvent(new CustomEvent('mxos:online-change', { detail: { online: true } }));
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        window.MXOS.notify({ title: '已联网', body: '正在同步后台数据...', type: 'success', duration: 2500 });
    }
    triggerBackgroundSync();
}

function queueSync(task) {
    if (typeof task === 'function') {
        syncQueue.push(task);
        if (navigator.onLine) {
            triggerBackgroundSync();
        }
    }
}

function onSync(listener) {
    if (typeof listener === 'function') {
        listeners.push(listener);
    }
}

async function triggerBackgroundSync() {
    while (syncQueue.length > 0) {
        const task = syncQueue.shift();
        try {
            await task();
        } catch (e) {}
    }
    listeners.forEach(l => {
        try { l(); } catch (e) {}
    });
}

function isOnline() {
    return navigator.onLine;
}

function init() {
    createStatusBar();
    window.addEventListener('online', () => {
        const wasOffline = !lastOnline;
        lastOnline = true;
        hideOfflineBar();
    });
    window.addEventListener('offline', () => {
        lastOnline = false;
        showOfflineBar();
    });
    if (!navigator.onLine) {
        showOfflineBar();
    }
}

const offlineMode = {
    init,
    isOnline,
    queueSync,
    onSync,
    triggerBackgroundSync
};

window.MXOS.System.offlineMode = offlineMode;

init();

export { offlineMode };
