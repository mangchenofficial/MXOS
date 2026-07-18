import { state, appConfigs } from './state.js';
import {
    createWindow, minimizeWindow, closeWindow, bringToFront,
    toggleMaximize, restoreWindow, openApp as coreOpenApp, getTaskbarItemForWindow
} from './core.js';
import { eventBus } from './utils/event-bus.js';
import {
    alert as dialogAlert, confirm as dialogConfirm,
    prompt as dialogPrompt, showToast as dialogToast
} from './utils/dialog.js';
import { vfs } from './vfs.js';

window.MXOS = window.MXOS || {};
window.MXOS.Real = window.MXOS.Real || {};
window.MXOS.System = window.MXOS.System || {};

const MXOS = window.MXOS;

MXOS.dialog = {
    alert(title, message) {
        return dialogAlert(title, message);
    },
    confirm(title, message) {
        return dialogConfirm(title, message);
    },
    prompt(title, defaultValue = '') {
        return dialogPrompt(title, defaultValue);
    },
    toast(message, type = 'info') {
        return dialogToast(message, type);
    }
};

function ensureAppConfig(appId) {
    if (appConfigs[appId]) return appConfigs[appId];
    if (appId === 'notepad') {
        appConfigs[appId] = {
            title: '记事本', icon: 'notepad',
            width: 700, height: 500, content: 'notepad'
        };
        return appConfigs[appId];
    }
    return null;
}

MXOS.openApp = function (appId, args) {
    if (!appId) return false;
    if (!appConfigs[appId]) {
        ensureAppConfig(appId);
    }
    if (!appConfigs[appId]) {
        dialogToast('未找到应用: ' + appId, 'error');
        return false;
    }
    if (args && typeof args === 'object') {
        try {
            const cfg = appConfigs[appId];
            Object.keys(args).forEach(k => {
                if (k === 'fileId' || k === 'initialContent' || k === 'title') {
                    cfg[k] = args[k];
                }
            });
            if (args.title) cfg.title = args.title;
        } catch (e) {}
    }
    try {
        createWindow(appId);
        return true;
    } catch (e) {
        console.error('[MXOS.openApp] 打开应用失败:', e);
        return false;
    }
};

MXOS.closeApp = function (appId) {
    const wins = state.windows.filter(w => w.appId === appId);
    if (wins.length === 0) return false;
    wins.forEach(w => closeWindow(w));
    return true;
};

MXOS.listApps = function () {
    const list = [];
    Object.keys(appConfigs).forEach(id => {
        const cfg = appConfigs[id];
        list.push({
            id,
            title: cfg.title,
            icon: cfg.icon,
            width: cfg.width,
            height: cfg.height
        });
    });
    state.installedApps.forEach(app => {
        list.push({
            id: app.id,
            title: app.name,
            icon: app.icon,
            version: app.version,
            installed: true
        });
    });
    return list;
};

MXOS.getAppConfig = function (appId) {
    const cfg = appConfigs[appId];
    if (cfg) return { ...cfg };
    const installed = state.installedApps.find(a => a.id === appId);
    if (installed) return { ...installed };
    return null;
};

function findWindowByApp(appId) {
    return state.windows.find(w => w.appId === appId);
}

MXOS.window = {
    minimize(appId) {
        const w = findWindowByApp(appId);
        if (!w) return false;
        minimizeWindow(w);
        return true;
    },
    maximize(appId) {
        const w = findWindowByApp(appId);
        if (!w) return false;
        toggleMaximize(w.element);
        return true;
    },
    close(appId) {
        return MXOS.closeApp(appId);
    },
    focus(appId) {
        const w = findWindowByApp(appId);
        if (!w) return false;
        if (w.minimized) {
            restoreWindow(w, getTaskbarItemForWindow(w));
        }
        bringToFront(w.element);
        return true;
    },
    snap(appIdOrElement, direction) {
        let el = appIdOrElement;
        if (typeof appIdOrElement === 'string') {
            const w = state.windows.find(win => win.id === appIdOrElement || win.appId === appIdOrElement);
            if (!w) return false;
            el = w.element;
        }
        if (!el) return false;
        if (direction === 'top') {
            if (!el.classList.contains('maximized')) toggleMaximize(el);
            return true;
        }
        el.classList.remove('maximized');
        const taskbarH = 48;
        if (direction === 'left') {
            el.style.top = '0px';
            el.style.left = '0px';
            el.style.width = Math.floor(window.innerWidth / 2) + 'px';
            el.style.height = (window.innerHeight - taskbarH) + 'px';
        } else if (direction === 'right') {
            el.style.top = '0px';
            el.style.left = Math.floor(window.innerWidth / 2) + 'px';
            el.style.width = Math.floor(window.innerWidth / 2) + 'px';
            el.style.height = (window.innerHeight - taskbarH) + 'px';
        } else {
            return false;
        }
        const contentEl = el.querySelector('.window-content');
        if (contentEl) {
            contentEl.dispatchEvent(new CustomEvent('windowResizeEnd', {
                detail: { width: el.offsetWidth, height: el.offsetHeight }
            }));
        }
        return true;
    },
    getBounds(appId) {
        const w = findWindowByApp(appId);
        if (!w) return null;
        const el = w.element;
        return {
            x: el.offsetLeft,
            y: el.offsetTop,
            width: el.offsetWidth,
            height: el.offsetHeight
        };
    },
    setBounds(appId, bounds) {
        const w = findWindowByApp(appId);
        if (!w || !bounds) return false;
        const el = w.element;
        el.classList.remove('maximized');
        if (bounds.x != null) el.style.left = bounds.x + 'px';
        if (bounds.y != null) el.style.top = bounds.y + 'px';
        if (bounds.width != null) el.style.width = bounds.width + 'px';
        if (bounds.height != null) el.style.height = bounds.height + 'px';
        const contentEl = el.querySelector('.window-content');
        if (contentEl) {
            contentEl.dispatchEvent(new CustomEvent('windowResizeEnd', {
                detail: { width: el.offsetWidth, height: el.offsetHeight }
            }));
        }
        return true;
    }
};

const FS_KEY = 'mxos_api_fs';
function loadFsTree() {
    try {
        return JSON.parse(localStorage.getItem(FS_KEY) || '{}');
    } catch (e) {
        return {};
    }
}
function saveFsTree(tree) {
    try {
        localStorage.setItem(FS_KEY, JSON.stringify(tree));
    } catch (e) {
        console.error('[MXOS.fs] 保存失败:', e);
    }
}
function normalizePath(path) {
    if (typeof path !== 'string') return null;
    let p = path.trim();
    if (!p.startsWith('/')) p = '/' + p;
    p = p.replace(/\/+/g, '/');
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
}
function parentPath(path) {
    const p = normalizePath(path);
    if (!p || p === '/') return '/';
    const idx = p.lastIndexOf('/');
    if (idx <= 0) return '/';
    return p.slice(0, idx);
}
function baseName(path) {
    const p = normalizePath(path);
    if (!p || p === '/') return '';
    return p.slice(p.lastIndexOf('/') + 1);
}
function ensureDesktopSample() {
    const tree = loadFsTree();
    if (!tree['/Desktop']) {
        tree['/Desktop'] = { type: 'folder', createdAt: new Date().toISOString() };
    }
    if (!tree['/Desktop/test.txt']) {
        tree['/Desktop/test.txt'] = {
            type: 'file',
            content: 'Hello from MXOS API!\n这是通过 MXOS.fs 创建的示例文件。',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };
    }
    saveFsTree(tree);
}

MXOS.fs = {
    async readFile(path) {
        const p = normalizePath(path);
        if (!p) throw new Error('无效路径');
        const tree = loadFsTree();
        const node = tree[p];
        if (!node) throw new Error('文件不存在: ' + p);
        if (node.type !== 'file') throw new Error('不是文件: ' + p);
        return node.content || '';
    },
    async writeFile(path, content) {
        const p = normalizePath(path);
        if (!p || p === '/') throw new Error('无效路径');
        const tree = loadFsTree();
        const now = new Date().toISOString();
        tree[p] = { type: 'file', content: String(content), createdAt: tree[p]?.createdAt || now, modifiedAt: now };
        saveFsTree(tree);
        eventBus.emit('fs:write', { path: p });
    },
    async listFiles(path) {
        const p = normalizePath(path);
        if (!p) throw new Error('无效路径');
        const tree = loadFsTree();
        const prefix = p === '/' ? '/' : p + '/';
        const result = [];
        Object.keys(tree).forEach(k => {
            if (k === p) return;
            if (!k.startsWith(prefix)) return;
            const rest = k.slice(prefix.length);
            if (rest.length === 0 || rest.includes('/')) return;
            const node = tree[k];
            result.push({
                name: rest,
                path: k,
                type: node.type,
                size: node.type === 'file' ? (node.content || '').length : 0,
                modifiedAt: node.modifiedAt || node.createdAt
            });
        });
        return result;
    },
    async createFolder(path) {
        const p = normalizePath(path);
        if (!p || p === '/') throw new Error('无效路径');
        const tree = loadFsTree();
        if (tree[p]) throw new Error('已存在: ' + p);
        tree[p] = { type: 'folder', createdAt: new Date().toISOString() };
        saveFsTree(tree);
        eventBus.emit('fs:createFolder', { path: p });
    },
    async delete(path) {
        const p = normalizePath(path);
        if (!p) throw new Error('无效路径');
        const tree = loadFsTree();
        if (!tree[p]) throw new Error('不存在: ' + p);
        const prefix = p + '/';
        Object.keys(tree).forEach(k => {
            if (k === p || k.startsWith(prefix)) delete tree[k];
        });
        saveFsTree(tree);
        eventBus.emit('fs:delete', { path: p });
    },
    async move(from, to) {
        const src = normalizePath(from);
        const dst = normalizePath(to);
        if (!src || !dst) throw new Error('无效路径');
        const tree = loadFsTree();
        if (!tree[src]) throw new Error('源不存在: ' + src);
        const prefix = src + '/';
        const moves = [];
        Object.keys(tree).forEach(k => {
            if (k === src) {
                moves.push([k, dst]);
            } else if (k.startsWith(prefix)) {
                moves.push([k, dst + k.slice(src.length)]);
            }
        });
        moves.forEach(([from2, to2]) => {
            tree[to2] = tree[from2];
            delete tree[from2];
        });
        saveFsTree(tree);
        eventBus.emit('fs:move', { from: src, to: dst });
    },
    async copy(from, to) {
        const src = normalizePath(from);
        const dst = normalizePath(to);
        if (!src || !dst) throw new Error('无效路径');
        const tree = loadFsTree();
        if (!tree[src]) throw new Error('源不存在: ' + src);
        const prefix = src + '/';
        const copies = [];
        Object.keys(tree).forEach(k => {
            if (k === src) {
                copies.push([k, dst]);
            } else if (k.startsWith(prefix)) {
                copies.push([k, dst + k.slice(src.length)]);
            }
        });
        copies.forEach(([from2, to2]) => {
            tree[to2] = JSON.parse(JSON.stringify(tree[from2]));
        });
        saveFsTree(tree);
        eventBus.emit('fs:copy', { from: src, to: dst });
    },
    async exists(path) {
        const p = normalizePath(path);
        if (!p) return false;
        const tree = loadFsTree();
        return !!tree[p];
    }
};

MXOS.FS = {
    async search(query, options) {
        return vfs.search(query, options || {});
    },
    async listAll() {
        return vfs.getAll();
    },
    async getChildren(parentId) {
        return vfs.getChildren(parentId);
    }
};

ensureDesktopSample();

const CLIPBOARD_HISTORY_KEY = 'mxos_clipboard_history';
const CLIPBOARD_HISTORY_MAX = 20;
function loadClipboardHistory() {
    try {
        return JSON.parse(localStorage.getItem(CLIPBOARD_HISTORY_KEY) || '[]');
    } catch (e) {
        return [];
    }
}
function pushClipboardHistory(text) {
    if (!text) return;
    const list = loadClipboardHistory();
    list.unshift({ text: String(text), timestamp: Date.now() });
    while (list.length > CLIPBOARD_HISTORY_MAX) list.pop();
    try {
        localStorage.setItem(CLIPBOARD_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {}
}

MXOS.clipboard = {
    async set(text) {
        const str = String(text);
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(str);
            }
        } catch (e) {}
        pushClipboardHistory(str);
        state.clipboard = { type: 'text', text: str, fileId: null };
        eventBus.emit('clipboard:set', { text: str });
    },
    async get() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                return await navigator.clipboard.readText();
            }
        } catch (e) {}
        return state.clipboard && state.clipboard.text ? state.clipboard.text : '';
    },
    history() {
        return loadClipboardHistory();
    }
};

MXOS.storage = {
    get(key) {
        try {
            const raw = localStorage.getItem('mxos_storage_' + key);
            if (raw === null) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem('mxos_storage_' + key, JSON.stringify(value));
            eventBus.emit('storage:set', { key, value });
            return true;
        } catch (e) {
            return false;
        }
    },
    remove(key) {
        try {
            localStorage.removeItem('mxos_storage_' + key);
            eventBus.emit('storage:remove', { key });
            return true;
        } catch (e) {
            return false;
        }
    }
};

const THEME_MODE_KEY = 'mxos_theme_mode';
function readThemeMode() {
    try {
        const v = localStorage.getItem(THEME_MODE_KEY);
        if (v === 'light' || v === 'dark') return v;
    } catch (e) {}
    return (window.MXOS.WallpaperColor && typeof window.MXOS.WallpaperColor.getTheme === 'function')
        ? window.MXOS.WallpaperColor.getTheme()
        : 'dark';
}

MXOS.theme = {
    get() {
        return {
            mode: readThemeMode(),
            accent: state.personalizationSettings.accentColor || '#60a5fa'
        };
    },
    set(mode, accent) {
        if (mode === 'light' || mode === 'dark') {
            try { localStorage.setItem(THEME_MODE_KEY, mode); } catch (e) {}
            if (window.MXOS.WallpaperColor && typeof window.MXOS.WallpaperColor.setTheme === 'function') {
                window.MXOS.WallpaperColor.setTheme(mode);
            }
            window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: mode } }));
        }
        if (accent) {
            state.personalizationSettings.accentColor = accent;
            document.documentElement.style.setProperty('--accent-color', accent);
            try { localStorage.setItem('accentColor', accent); } catch (e) {}
        }
        eventBus.emit('theme:change', { mode, accent });
    },
    onChange(callback) {
        if (typeof callback !== 'function') return () => {};
        const handler = (data) => callback(data || MXOS.theme.get());
        eventBus.on('theme:change', handler);
        const domHandler = () => callback(MXOS.theme.get());
        window.addEventListener('theme-change', domHandler);
        return () => {
            eventBus.off('theme:change', handler);
            window.removeEventListener('theme-change', domHandler);
        };
    }
};

MXOS.events = {
    on(event, callback) {
        return eventBus.on(event, callback);
    },
    off(event, callback) {
        return eventBus.off(event, callback);
    },
    emit(event, data) {
        return eventBus.emit(event, data);
    },
    once(event, callback) {
        return eventBus.once(event, callback);
    }
};

MXOS.system = {
    lock() {
        const lockScreen = document.getElementById('lock-screen');
        if (!lockScreen) return false;
        state.isLocked = true;
        lockScreen.style.display = 'flex';
        lockScreen.classList.remove('hidden');
        eventBus.emit('system:lock');
        return true;
    },
    async screenshot() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                dialogToast('当前环境不支持屏幕截图', 'warning');
                return null;
            }
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const track = stream.getVideoTracks()[0];
            const ms = new MediaStream(track);
            const video = document.createElement('video');
            video.srcObject = ms;
            await video.play();
            await new Promise(r => setTimeout(r, 200));
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            track.stop();
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mxos-screenshot-' + Date.now() + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            eventBus.emit('system:screenshot', { url });
            return url;
        } catch (e) {
            dialogToast('截图已取消或失败', 'info');
            return null;
        }
    },
    getOSInfo() {
        const bootMs = window.MXOS.System && window.MXOS.System.perfTrace
            ? window.MXOS.System.perfTrace.bootTrace.totalBootMs
            : null;
        const uptime = bootMs != null ? (performance.now() - (window.MXOS.System.perfTrace.bootTrace.scriptLoadAt || 0)) : performance.now();
        return {
            name: 'MXOS',
            version: '1.1',
            build: 'stage-10',
            uptime: Math.round(uptime),
            bootMs: bootMs,
            online: navigator.onLine,
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            cores: navigator.hardwareConcurrency || null,
            memory: navigator.deviceMemory || null,
            timestamp: Date.now()
        };
    }
};

const shortcuts = new Map();
let shortcutListenerBound = false;
function normalizeCombo(combo) {
    if (typeof combo !== 'string') return null;
    return combo.toLowerCase().replace(/\s+/g, '').split('+').sort().join('+');
}
function bindShortcutListener() {
    if (shortcutListenerBound) return;
    shortcutListenerBound = true;
    document.addEventListener('keydown', (e) => {
        if (state.isLocked) return;
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey) parts.push('meta');
        const key = e.key.toLowerCase();
        if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
            parts.push(key);
        }
        if (parts.length === 0) return;
        const combo = parts.sort().join('+');
        const cb = shortcuts.get(combo);
        if (cb) {
            e.preventDefault();
            try { cb(e); } catch (err) { console.error('[MXOS.shortcut] 回调错误:', err); }
        }
    });
}

MXOS.shortcut = {
    register(combo, callback) {
        const c = normalizeCombo(combo);
        if (!c || typeof callback !== 'function') return false;
        bindShortcutListener();
        shortcuts.set(c, callback);
        eventBus.emit('shortcut:register', { combo: c });
        return true;
    },
    unregister(combo) {
        const c = normalizeCombo(combo);
        if (!c) return false;
        const had = shortcuts.delete(c);
        if (had) eventBus.emit('shortcut:unregister', { combo: c });
        return had;
    }
};

MXOS.eventBus = eventBus;

MXOS.state = state;

function notLoaded(name) {
    return function () {
        throw new Error('MXOS.' + name + ' 模块尚未加载');
    };
}

function proxy(getTarget, method, name) {
    return function (...args) {
        const target = typeof getTarget === 'function' ? getTarget() : getTarget;
        if (target && typeof target[method] === 'function') {
            return target[method](...args);
        }
        throw new Error('MXOS.' + name + ' 模块尚未加载');
    };
}

MXOS.user = {
    getInfo: proxy(() => MXOS.User, 'getInfo', 'user'),
    login: proxy(() => MXOS.User, 'login', 'user'),
    logout: proxy(() => MXOS.User, 'logout', 'user'),
    isLoggedIn: proxy(() => MXOS.User, 'isLoggedIn', 'user'),
    openAuthModal: proxy(() => MXOS.User, 'openAuthModal', 'user')
};

MXOS.cloud = {
    sync: proxy(() => MXOS.Cloud, 'sync', 'cloud'),
    pull: proxy(() => MXOS.Cloud, 'pull', 'cloud'),
    getStatus: proxy(() => MXOS.Cloud, 'getStatus', 'cloud')
};

const getShellTarget = () => MXOS.Shell || (MXOS.Terminal && typeof MXOS.Terminal.runCommand === 'function' ? MXOS.Terminal : null);
MXOS.shell = {
    runCommand: proxy(getShellTarget, 'runCommand', 'shell')
};

const getStoreTarget = () => MXOS.Store || null;
MXOS.store = {
    search: proxy(getStoreTarget, 'search', 'store'),
    install: proxy(getStoreTarget, 'install', 'store'),
    uninstall: proxy(getStoreTarget, 'uninstall', 'store'),
    update: proxy(getStoreTarget, 'update', 'store'),
    getDetail: proxy(getStoreTarget, 'getDetail', 'store')
};

const getWidgetTarget = () => MXOS.Widgets || MXOS.Widget || null;
MXOS.widget = {
    add: proxy(getWidgetTarget, 'add', 'widget'),
    remove: proxy(getWidgetTarget, 'remove', 'widget'),
    list: proxy(getWidgetTarget, 'list', 'widget')
};

const getPetTarget = () => MXOS.Pet || (MXOS.Features && MXOS.Features.pet) || (MXOS.Features && MXOS.Features.desktopPet) || null;
MXOS.pet = {
    feed: proxy(getPetTarget, 'feed', 'pet'),
    interact: proxy(getPetTarget, 'interact', 'pet'),
    getState: proxy(getPetTarget, 'getState', 'pet')
};

const getWeatherTarget = () => MXOS.Features && MXOS.Features.weather ? MXOS.Features.weather : null;
MXOS.weather = {
    get: proxy(getWeatherTarget, 'get', 'weather'),
    refresh: proxy(getWeatherTarget, 'refresh', 'weather'),
    onWeatherChange: proxy(getWeatherTarget, 'onWeatherChange', 'weather')
};

const getAmbientTarget = () => MXOS.Features && MXOS.Features.ambientSound ? MXOS.Features.ambientSound : null;
MXOS.ambient = {
    play: proxy(getAmbientTarget, 'play', 'ambient'),
    stop: proxy(getAmbientTarget, 'stop', 'ambient'),
    mix: proxy(getAmbientTarget, 'mix', 'ambient')
};

const getRadioTarget = () => MXOS.Features && MXOS.Features.radio ? MXOS.Features.radio : null;
MXOS.radio = {
    play: proxy(getRadioTarget, 'play', 'radio'),
    pause: proxy(getRadioTarget, 'pause', 'radio'),
    togglePlay: proxy(getRadioTarget, 'togglePlay', 'radio'),
    next: proxy(getRadioTarget, 'next', 'radio'),
    setStyle: proxy(getRadioTarget, 'setStyle', 'radio'),
    getNowPlaying: proxy(getRadioTarget, 'getNowPlaying', 'radio')
};

const getStampsTarget = () => MXOS.Features && MXOS.Features.stamps ? MXOS.Features.stamps : null;
MXOS.stamps = {
    collect: proxy(getStampsTarget, 'collect', 'stamps'),
    list: proxy(getStampsTarget, 'list', 'stamps'),
    has: proxy(getStampsTarget, 'has', 'stamps')
};

const getEvolutionTarget = () => MXOS.Features && MXOS.Features.evolution ? MXOS.Features.evolution : null;
MXOS.evolution = {
    getLevel: proxy(getEvolutionTarget, 'getLevel', 'evolution'),
    addXp: proxy(getEvolutionTarget, 'addXp', 'evolution'),
    getProgress: proxy(getEvolutionTarget, 'getProgress', 'evolution'),
    getAll: proxy(getEvolutionTarget, 'getAll', 'evolution')
};

const getTimeCapsuleTarget = () => MXOS.Features && MXOS.Features.timeCapsule ? MXOS.Features.timeCapsule : null;
MXOS.timeCapsule = {
    bury: proxy(getTimeCapsuleTarget, 'bury', 'timeCapsule'),
    list: proxy(getTimeCapsuleTarget, 'list', 'timeCapsule'),
    open: proxy(getTimeCapsuleTarget, 'open', 'timeCapsule')
};

const getDoodleTarget = () => MXOS.Doodle || (MXOS.Features && MXOS.Features.doodle) || null;
MXOS.doodle = {
    start: proxy(getDoodleTarget, 'start', 'doodle'),
    clear: proxy(getDoodleTarget, 'clear', 'doodle'),
    save: proxy(getDoodleTarget, 'save', 'doodle')
};

const getGraveyardTarget = () => MXOS.Features && MXOS.Features.graveyard ? MXOS.Features.graveyard : null;
MXOS.graveyard = {
    visit: proxy(getGraveyardTarget, 'visit', 'graveyard'),
    list: proxy(getGraveyardTarget, 'list', 'graveyard'),
    bury: proxy(getGraveyardTarget, 'bury', 'graveyard')
};

const getTranslateTarget = () => MXOS.Translate || (MXOS.Features && MXOS.Features.translator) || (MXOS.Features && MXOS.Features.translate) || null;
MXOS.translate = {
    translate: proxy(getTranslateTarget, 'translate', 'translate')
};

MXOS.achievements = {
    unlock: proxy(getStampsTarget, 'collect', 'achievements'),
    list: proxy(getStampsTarget, 'list', 'achievements')
};

const getLauncherTarget = () => MXOS.Launcher || (MXOS.Features && MXOS.Features.launcher) || null;
MXOS.launcher = {
    open: proxy(getLauncherTarget, 'open', 'launcher'),
    close: proxy(getLauncherTarget, 'close', 'launcher')
};

const getFocusTarget = () => MXOS.Focus || (MXOS.Features && MXOS.Features.focusMode) || null;
MXOS.focus = {
    enter: proxy(getFocusTarget, 'enter', 'focus'),
    exit: proxy(getFocusTarget, 'exit', 'focus'),
    toggle: proxy(getFocusTarget, 'toggle', 'focus')
};

const getSoundTarget = () => MXOS.Sound || (MXOS.Features && MXOS.Features.soundFeedback) || null;
MXOS.sound = {
    play: proxy(getSoundTarget, 'play', 'sound'),
    enable: function () {
        const t = getSoundTarget();
        if (t && typeof t.setEnabled === 'function') { t.setEnabled(true); return; }
        throw new Error('MXOS.sound 模块尚未加载');
    },
    disable: function () {
        const t = getSoundTarget();
        if (t && typeof t.setEnabled === 'function') { t.setEnabled(false); return; }
        throw new Error('MXOS.sound 模块尚未加载');
    }
};

const SCROLL_STYLE_PROPS = ['--scroll-size', '--scroll-radius', '--scroll-thumb', '--scroll-thumb-hover', '--scroll-thumb-active', '--scroll-track'];
function _applyScrollVars(el, opts) {
    if (opts.width != null) el.style.setProperty('--scroll-size', typeof opts.width === 'number' ? opts.width + 'px' : opts.width);
    if (opts.radius != null) el.style.setProperty('--scroll-radius', typeof opts.radius === 'number' ? opts.radius + 'px' : opts.radius);
    if (opts.color != null) el.style.setProperty('--scroll-thumb', opts.color);
    if (opts.hoverColor != null) el.style.setProperty('--scroll-thumb-hover', opts.hoverColor);
    if (opts.activeColor != null) el.style.setProperty('--scroll-thumb-active', opts.activeColor);
    if (opts.track != null) el.style.setProperty('--scroll-track', opts.track);
}

MXOS.scroll = {
    apply(element, options = {}) {
        if (!element) return null;
        const opts = { autoHide: false, ...options };
        element.classList.remove('mxos-scroll', 'mxos-scroll-auto');
        element.classList.add(opts.autoHide ? 'mxos-scroll-auto' : 'mxos-scroll');
        _applyScrollVars(element, opts);
        return element;
    },
    remove(element) {
        if (!element) return;
        element.classList.remove('mxos-scroll', 'mxos-scroll-auto');
        SCROLL_STYLE_PROPS.forEach(k => element.style.removeProperty(k));
    },
    scrollTo(element, options = {}) {
        if (!element) return;
        const opts = { top: 0, left: 0, behavior: 'smooth', ...options };
        element.scrollTo({ top: opts.top, left: opts.left, behavior: opts.behavior });
    },
    scrollBy(element, options = {}) {
        if (!element) return;
        const opts = { top: 0, left: 0, behavior: 'smooth', ...options };
        element.scrollBy({ top: opts.top, left: opts.left, behavior: opts.behavior });
    },
    scrollToTop(element, behavior = 'smooth') {
        if (element) element.scrollTo({ top: 0, behavior });
    },
    scrollToBottom(element, behavior = 'smooth') {
        if (element) element.scrollTo({ top: element.scrollHeight, behavior });
    },
    setTheme(options = {}) {
        _applyScrollVars(document.documentElement, options);
    },
    getTheme() {
        const cs = getComputedStyle(document.documentElement);
        return {
            width: cs.getPropertyValue('--scroll-size').trim(),
            radius: cs.getPropertyValue('--scroll-radius').trim(),
            color: cs.getPropertyValue('--scroll-thumb').trim(),
            hoverColor: cs.getPropertyValue('--scroll-thumb-hover').trim(),
            activeColor: cs.getPropertyValue('--scroll-thumb-active').trim(),
            track: cs.getPropertyValue('--scroll-track').trim()
        };
    },
    isScrollable(element) {
        if (!element) return false;
        return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
    },
    getInfo(element) {
        if (!element) return null;
        return {
            scrollTop: element.scrollTop,
            scrollLeft: element.scrollLeft,
            scrollHeight: element.scrollHeight,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            clientWidth: element.clientWidth,
            scrollableY: element.scrollHeight > element.clientHeight,
            scrollableX: element.scrollWidth > element.clientWidth,
            atTop: element.scrollTop <= 0,
            atBottom: element.scrollTop + element.clientHeight >= element.scrollHeight - 1
        };
    }
};

MXOS.apiHelp = function () {
    return [
        { api: 'MXOS.notify(options)', desc: '系统通知（由 notifications 模块提供）', available: typeof MXOS.notify === 'function' },
        { api: 'MXOS.dialog.alert/confirm/prompt/toast(...)', desc: '对话框与提示', available: !!MXOS.dialog },
        { api: 'MXOS.openApp(id, args)', desc: '打开应用', available: typeof MXOS.openApp === 'function' },
        { api: 'MXOS.closeApp(id)', desc: '关闭应用', available: typeof MXOS.closeApp === 'function' },
        { api: 'MXOS.listApps()', desc: '列出所有应用', available: typeof MXOS.listApps === 'function' },
        { api: 'MXOS.getAppConfig(id)', desc: '获取应用配置', available: typeof MXOS.getAppConfig === 'function' },
        { api: 'MXOS.window.minimize/maximize/close/snap/focus/getBounds/setBounds(id, ...)', desc: '窗口控制', available: !!MXOS.window },
        { api: 'MXOS.fs.readFile/writeFile/listFiles/createFolder/delete/move/copy/exists(path, ...)', desc: '文件系统', available: !!MXOS.fs },
        { api: 'MXOS.FS.search/listAll/getChildren(...)', desc: '虚拟文件系统高级接口', available: !!MXOS.FS },
        { api: 'MXOS.clipboard.set/get/history()', desc: '剪贴板', available: !!MXOS.clipboard },
        { api: 'MXOS.storage.get/set/remove(key, value)', desc: '本地键值存储', available: !!MXOS.storage },
        { api: 'MXOS.theme.get/set/onChange(mode, accent, callback)', desc: '主题管理', available: !!MXOS.theme },
        { api: 'MXOS.system.lock/screenshot/getOSInfo()', desc: '系统操作', available: !!MXOS.system },
        { api: 'MXOS.shortcut.register/unregister(combo, callback)', desc: '全局快捷键', available: !!MXOS.shortcut },
        { api: 'MXOS.events.on/off/emit/once(event, callback, data)', desc: '事件总线', available: !!MXOS.events },
        { api: 'MXOS.user.getInfo/login/logout/isLoggedIn/openAuthModal()', desc: '用户账户', available: !!MXOS.User },
        { api: 'MXOS.cloud.sync/pull/getStatus()', desc: '云同步', available: !!MXOS.Cloud },
        { api: 'MXOS.shell.runCommand(cmd)', desc: '终端命令执行', available: !!(MXOS.Shell || (MXOS.Terminal && MXOS.Terminal.runCommand)) },
        { api: 'MXOS.store.search/install/uninstall/update/getDetail(...)', desc: '应用商店', available: !!MXOS.Store },
        { api: 'MXOS.widget.add/remove/list(type, x, y, id)', desc: '桌面小组件', available: !!(MXOS.Widgets || MXOS.Widget) },
        { api: 'MXOS.pet.feed/interact/getState()', desc: '桌面宠物', available: !!(MXOS.Pet || (MXOS.Features && (MXOS.Features.pet || MXOS.Features.desktopPet))) },
        { api: 'MXOS.weather.get/refresh/onWeatherChange()', desc: '天气', available: !!(MXOS.Features && MXOS.Features.weather) },
        { api: 'MXOS.ambient.play/stop/mix(type, types)', desc: '环境音', available: !!(MXOS.Features && MXOS.Features.ambientSound) },
        { api: 'MXOS.radio.play/pause/togglePlay/next/setStyle/getNowPlaying()', desc: 'MXOS 电台', available: !!(MXOS.Features && MXOS.Features.radio) },
        { api: 'MXOS.stamps.collect/list/has(id)', desc: '邮票收集', available: !!(MXOS.Features && MXOS.Features.stamps) },
        { api: 'MXOS.evolution.getLevel/addXp/getProgress/getAll(id, xp)', desc: '应用进化', available: !!(MXOS.Features && MXOS.Features.evolution) },
        { api: 'MXOS.timeCapsule.bury/list/open(data, id)', desc: '时光胶囊', available: !!(MXOS.Features && MXOS.Features.timeCapsule) },
        { api: 'MXOS.doodle.start/clear/save()', desc: '桌面涂鸦', available: !!(MXOS.Doodle || (MXOS.Features && MXOS.Features.doodle)) },
        { api: 'MXOS.graveyard.visit/list/bury(id)', desc: '应用墓园', available: !!(MXOS.Features && MXOS.Features.graveyard) },
        { api: 'MXOS.translate.translate(text, from, to)', desc: '翻译', available: !!(MXOS.Translate || (MXOS.Features && (MXOS.Features.translator || MXOS.Features.translate))) },
        { api: 'MXOS.achievements.unlock/list(id)', desc: '成就系统', available: !!(MXOS.Features && MXOS.Features.stamps) },
        { api: 'MXOS.launcher.open/close()', desc: '全局启动器', available: !!(MXOS.Launcher || (MXOS.Features && MXOS.Features.launcher)) },
        { api: 'MXOS.focus.enter/exit/toggle()', desc: '专注模式', available: !!(MXOS.Focus || (MXOS.Features && MXOS.Features.focusMode)) },
        { api: 'MXOS.sound.play/enable/disable(type)', desc: '声音反馈', available: !!(MXOS.Sound || (MXOS.Features && MXOS.Features.soundFeedback)) },
        { api: 'MXOS.scroll.apply/remove/scrollTo/scrollBy/scrollToTop/scrollToBottom/setTheme/getTheme/isScrollable/getInfo(el, options)', desc: '自定义滚动条', available: !!MXOS.scroll }
    ];
};

console.log('[MXOS API] 公共 API 层已加载', Object.keys(MXOS).join(', '));

export { MXOS };
export default MXOS;
