window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

let enabled = false;
let originalSetItem = null;
let originalGetItem = null;
let originalRemoveItem = null;
let originalClear = null;
const memoryStore = new Map();
let taskbarIndicator = null;

function memorySetItem(key, value) {
    memoryStore.set(key, String(value));
}
function memoryGetItem(key) {
    return memoryStore.has(key) ? memoryStore.get(key) : null;
}
function memoryRemoveItem(key) {
    memoryStore.delete(key);
}
function memoryClear() {
    memoryStore.clear();
}

function addTaskbarIndicator() {
    if (taskbarIndicator) return;
    const taskbar = document.getElementById('taskbar');
    if (!taskbar) {
        setTimeout(addTaskbarIndicator, 500);
        return;
    }
    taskbarIndicator = document.createElement('div');
    taskbarIndicator.id = 'mxos-incognito-indicator';
    taskbarIndicator.title = '无痕模式已启用';
    taskbarIndicator.style.cssText = 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;color:#fbbf24;cursor:pointer';
    taskbarIndicator.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>';
    taskbarIndicator.onclick = () => {
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '无痕模式', body: '正在以无痕模式运行，退出后数据将销毁', type: 'info', duration: 3000 });
        }
    };
    const startBtn = taskbar.querySelector('#startButton');
    if (startBtn && startBtn.nextSibling) {
        taskbar.insertBefore(taskbarIndicator, startBtn.nextSibling);
    } else {
        taskbar.appendChild(taskbarIndicator);
    }
}

function removeTaskbarIndicator() {
    if (taskbarIndicator && taskbarIndicator.parentNode) {
        taskbarIndicator.parentNode.removeChild(taskbarIndicator);
    }
    taskbarIndicator = null;
}

function enable() {
    if (enabled) return true;
    enabled = true;
    originalSetItem = localStorage.setItem.bind(localStorage);
    originalGetItem = localStorage.getItem.bind(localStorage);
    originalRemoveItem = localStorage.removeItem.bind(localStorage);
    originalClear = localStorage.clear.bind(localStorage);
    localStorage.setItem = memorySetItem;
    localStorage.getItem = memoryGetItem;
    localStorage.removeItem = memoryRemoveItem;
    localStorage.clear = memoryClear;
    addTaskbarIndicator();
    document.body.classList.add('mxos-incognito');
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        window.MXOS.notify({ title: '无痕模式已启用', body: '本次会话不会保留任何数据', type: 'info', duration: 3000 });
    }
    window.dispatchEvent(new CustomEvent('mxos:incognito-change', { detail: { enabled: true } }));
    return true;
}

function disable() {
    if (!enabled) return true;
    enabled = false;
    if (originalSetItem) localStorage.setItem = originalSetItem;
    if (originalGetItem) localStorage.getItem = originalGetItem;
    if (originalRemoveItem) localStorage.removeItem = originalRemoveItem;
    if (originalClear) localStorage.clear = originalClear;
    originalSetItem = null;
    originalGetItem = null;
    originalRemoveItem = null;
    originalClear = null;
    memoryStore.clear();
    removeTaskbarIndicator();
    document.body.classList.remove('mxos-incognito');
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        window.MXOS.notify({ title: '无痕模式已关闭', body: '已恢复正常数据存储', type: 'success', duration: 2500 });
    }
    window.dispatchEvent(new CustomEvent('mxos:incognito-change', { detail: { enabled: false } }));
    return true;
}

function isEnabled() {
    return enabled;
}

function destroySession() {
    memoryStore.clear();
    try {
        if (indexedDB.databases) {
            indexedDB.databases().then(dbs => {
                dbs.forEach(db => {
                    if (db.name && db.name.startsWith('MXOS')) {
                        try { indexedDB.deleteDatabase(db.name); } catch (e) {}
                    }
                });
            }).catch(() => {});
        }
    } catch (e) {}
    if (window.caches && window.caches.keys) {
        try {
            window.caches.keys().then(keys => {
                keys.forEach(k => {
                    if (k && k.indexOf('mxos') >= 0) {
                        try { window.caches.delete(k); } catch (e) {}
                    }
                });
            }).catch(() => {});
        } catch (e) {}
    }
}

window.addEventListener('beforeunload', (e) => {
    if (enabled) {
        destroySession();
    }
});

const incognito = {
    enable,
    disable,
    isEnabled,
    destroySession
};

window.MXOS.System.incognito = incognito;

export { incognito };
