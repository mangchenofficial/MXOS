import { vfs } from '../vfs.js';
import { state } from '../state.js';
import { eventBus } from '../utils/event-bus.js';

window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};
window.MXOS.Backup = window.MXOS.Backup || {};

const BACKUP_INDEX_KEY = 'mxos_backup_index';
const SCHEDULE_KEY = 'mxos_backup_schedule';
const MAX_KEEP = 5;

function getJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('JSZip 加载失败'));
        document.head.appendChild(script);
    });
}

function loadIndex() {
    try {
        const arr = JSON.parse(localStorage.getItem(BACKUP_INDEX_KEY) || '[]');
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

function saveIndex(list) {
    try { localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(list)); } catch (e) {}
}

function getSettings() {
    const keys = [
        'wallpaper', 'wallpaperType', 'accentColor', 'mxos_theme_mode',
        'mxos_reduce_motion', 'mxos_version', 'mxos_installed_apps',
        'mxos_boot_time_ms', 'mxos_smoke_test_last', 'mxos_theme_mode_pref',
        'mxos_icon_positions', 'mxos_clipboard_history'
    ];
    const out = {};
    keys.forEach(k => {
        try {
            const v = localStorage.getItem(k);
            if (v !== null) out[k] = v;
        } catch (e) {}
    });
    return out;
}

function getDesktopLayout() {
    const layout = { icons: [], taskbar: [] };
    try {
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            layout.icons.push({
                app: icon.dataset.app,
                label: icon.querySelector('span') ? icon.querySelector('span').textContent : ''
            });
        });
    } catch (e) {}
    return layout;
}

async function collectVfs() {
    try {
        await vfs.ensureInitialized();
        const all = await vfs.getAll();
        return all.filter(f => !f.inTrash).map(f => ({
            id: f.id,
            name: f.name,
            type: f.type,
            content: f.content || '',
            parentId: f.parentId,
            createdAt: f.createdAt,
            modifiedAt: f.modifiedAt
        }));
    } catch (e) {
        return [];
    }
}

function getAppData() {
    const data = {};
    try {
        Object.keys(state.thirdPartyAppData).forEach(appId => {
            const app = state.thirdPartyAppData[appId];
            if (app) {
                data[appId] = {
                    name: app.name || app.title,
                    version: app.version,
                    icon: app.icon,
                    window: app.window,
                    appBin: app.appBin || ''
                };
            }
        });
    } catch (e) {}
    try {
        data.installedApps = state.installedApps || [];
    } catch (e) {
        data.installedApps = [];
    }
    return data;
}

async function buildBackupBlob() {
    const JSZip = await getJSZip();
    const zip = new JSZip();
    const root = zip.folder('mxos-backup');

    const vfsFiles = await collectVfs();
    const vfsFolder = root.folder('vfs');
    vfsFiles.forEach(f => {
        const safeName = String(f.name).replace(/[\\/:*?"<>|]/g, '_');
        vfsFolder.file(safeName + '_' + f.id + '.json', JSON.stringify(f, null, 2));
    });

    const settings = getSettings();
    root.file('settings.json', JSON.stringify(settings, null, 2));

    const appData = getAppData();
    root.file('app-data.json', JSON.stringify(appData, null, 2));

    const desktopLayout = getDesktopLayout();
    root.file('desktop-layout.json', JSON.stringify(desktopLayout, null, 2));

    const manifest = {
        app: 'MXOS',
        version: '1.6',
        createdAt: new Date().toISOString(),
        contents: {
            vfs: vfsFiles.length,
            settings: Object.keys(settings).length,
            apps: Object.keys(appData).length,
            desktopIcons: desktopLayout.icons.length
        }
    };
    root.file('manifest.json', JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return { blob, manifest };
}

async function backup(options) {
    const opts = options || {};
    try {
        const { blob, manifest } = await buildBackupBlob();
        const filename = 'mxos-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.mxbak';
        const id = 'bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const record = {
            id,
            filename,
            size: blob.size,
            createdAt: new Date().toISOString(),
            manifest,
            automatic: !!opts.automatic,
            blobStored: false
        };

        if (opts.store !== false) {
            try {
                const list = loadIndex();
                list.unshift(record);
                while (list.length > MAX_KEEP) list.pop();
                saveIndex(list);
            } catch (e) {}
        }

        if (opts.download !== false) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: opts.automatic ? '已自动备份' : '备份完成', body: filename, type: 'success', duration: 3000 });
        }
        eventBus.emit('backup:created', { record });
        return { ok: true, record, filename };
    } catch (e) {
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '备份失败', body: String(e.message || e), type: 'error', duration: 4000 });
        }
        return { ok: false, error: String(e.message || e) };
    }
}

async function readMxbakBlob(file) {
    const JSZip = await getJSZip();
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    return zip;
}

function applySettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    Object.keys(settings).forEach(k => {
        try { localStorage.setItem(k, settings[k]); } catch (e) {}
    });
}

async function applyVfs(files) {
    if (!files || files.length === 0) return;
    try {
        await vfs.ensureInitialized();
        const existing = await vfs.getAll();
        const existingIds = new Set(existing.map(f => f.id));
        for (const f of files) {
            if (existingIds.has(f.id)) {
                await vfs.update(f.id, {
                    name: f.name,
                    type: f.type,
                    content: f.content || '',
                    parentId: f.parentId
                });
            } else {
                try {
                    await vfs.add({
                        name: f.name,
                        type: f.type,
                        content: f.content || '',
                        parentId: f.parentId,
                        createdAt: f.createdAt,
                        modifiedAt: f.modifiedAt,
                        inTrash: false
                    });
                } catch (e) {}
            }
        }
    } catch (e) {}
}

function applyAppData(data) {
    if (!data || typeof data !== 'object') return;
    try {
        const installed = data.installedApps || [];
        state.installedApps = installed;
        localStorage.setItem('mxos_installed_apps', JSON.stringify(installed));
        Object.keys(data).forEach(k => {
            if (k === 'installedApps') return;
            const app = data[k];
            if (app && app.appBin) {
                state.thirdPartyAppData[k] = app;
            }
        });
    } catch (e) {}
}

async function restore(file, options) {
    const opts = options || {};
    try {
        if (!file) throw new Error('未提供备份文件');
        const name = file.name || '';
        if (!name.toLowerCase().endsWith('.mxbak') && !name.toLowerCase().endsWith('.zip')) {
            throw new Error('请选择 .mxbak 文件');
        }

        const zip = await readMxbakBlob(file);
        const root = zip.folder('mxos-backup') || zip;

        let manifest = null;
        if (root.file('manifest.json')) {
            try { manifest = JSON.parse(await root.file('manifest.json').async('text')); } catch (e) {}
        }

        if (!opts.skipConfirm) {
            if (typeof window.MXOS.dialog === 'object' && window.MXOS.dialog.confirm) {
                const ok = await window.MXOS.dialog.confirm('恢复备份', '此操作将覆盖当前系统数据，确定继续吗？');
                if (!ok) return { ok: false, cancelled: true };
            } else if (!confirm('此操作将覆盖当前系统数据，确定继续吗？')) {
                return { ok: false, cancelled: true };
            }
        }

        if (root.file('settings.json')) {
            try {
                const settings = JSON.parse(await root.file('settings.json').async('text'));
                applySettings(settings);
            } catch (e) {}
        }

        const vfsFiles = [];
        const vfsFolder = root.folder('vfs');
        if (vfsFolder) {
            const paths = [];
            vfsFolder.forEach((path, entry) => { if (!entry.dir) paths.push(path); });
            for (const p of paths) {
                try {
                    const f = JSON.parse(await vfsFolder.file(p).async('text'));
                    vfsFiles.push(f);
                } catch (e) {}
            }
        }
        await applyVfs(vfsFiles);

        if (root.file('app-data.json')) {
            try {
                const appData = JSON.parse(await root.file('app-data.json').async('text'));
                applyAppData(appData);
            } catch (e) {}
        }

        eventBus.emit('backup:restored', { filename: name, manifest });

        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '恢复完成', body: name + '，刷新后生效', type: 'success', duration: 4000 });
        }
        return { ok: true, manifest, filename: name };
    } catch (e) {
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '恢复失败', body: String(e.message || e), type: 'error', duration: 4000 });
        }
        return { ok: false, error: String(e.message || e) };
    }
}

function list() {
    return loadIndex().slice();
}

function remove(id) {
    const list = loadIndex();
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return false;
    list.splice(idx, 1);
    saveIndex(list);
    eventBus.emit('backup:removed', { id });
    return true;
}

function clearAll() {
    saveIndex([]);
    eventBus.emit('backup:cleared');
    return true;
}

function getSchedule() {
    try {
        const s = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || 'null');
        if (s && s.enabled) return s;
    } catch (e) {}
    return { enabled: false, interval: 'manual', lastRun: 0 };
}

let scheduleTimerId = null;

function schedule(interval) {
    let s;
    if (interval && typeof interval === 'object') {
        s = Object.assign({}, getSchedule(), interval);
    } else {
        const cur = getSchedule();
        s = { enabled: !!interval, interval: interval || 'manual', lastRun: cur.lastRun || 0 };
    }
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s)); } catch (e) {}

    if (scheduleTimerId) {
        clearInterval(scheduleTimerId);
        scheduleTimerId = null;
    }
    if (!s.enabled || s.interval === 'manual') {
        eventBus.emit('backup:schedule', { enabled: false });
        return s;
    }

    const periods = { daily: 24 * 3600 * 1000, weekly: 7 * 24 * 3600 * 1000 };
    const period = periods[s.interval] || periods.daily;
    scheduleTimerId = setInterval(() => {
        const now = Date.now();
        if (!s.lastRun || (now - s.lastRun) >= period) {
            backup({ automatic: true, download: false }).then(() => {
                s.lastRun = now;
                try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s)); } catch (e) {}
            });
        }
    }, 60 * 1000);

    eventBus.emit('backup:schedule', { enabled: true, interval: s.interval });
    return s;
}

function initSchedule() {
    const s = getSchedule();
    if (s.enabled && s.interval !== 'manual') {
        schedule(s);
    }
}

const Backup = {
    backup,
    restore,
    list,
    remove,
    clearAll,
    schedule,
    getSchedule,
    initSchedule,
    MAX_KEEP
};

window.MXOS.Backup = Backup;
window.MXOS.System.backup = Backup;

initSchedule();

window.addEventListener('mxos:desktop-ready', () => {
    setTimeout(() => {
        const s = getSchedule();
        if (s.enabled && s.interval !== 'manual') {
            const period = (s.interval === 'weekly' ? 7 : 1) * 24 * 3600 * 1000;
            if (!s.lastRun || (Date.now() - s.lastRun) >= period) {
                backup({ automatic: true, download: false });
            }
        }
    }, 5000);
});

export { backup, restore, list, remove, clearAll, schedule, getSchedule };
export default Backup;
