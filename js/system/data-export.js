import { vfs } from '../vfs.js';
import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

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

async function collectVFSFiles() {
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
            path: f.name
        }));
    } catch (e) {
        return [];
    }
}

function collectSettings() {
    const settings = {};
    const keys = [
        'wallpaper', 'wallpaperType', 'accentColor', 'mxos_theme_mode',
        'mxos_reduce_motion', 'mxos_version', 'mxos_installed_apps',
        'mxos_boot_time_ms', 'mxos_smoke_test_last'
    ];
    keys.forEach(k => {
        try {
            const v = localStorage.getItem(k);
            if (v !== null) settings[k] = v;
        } catch (e) {}
    });
    return settings;
}

function collectAppData() {
    const data = {};
    try {
        if (state.thirdPartyAppData) {
            Object.keys(state.thirdPartyAppData).forEach(appId => {
                const app = state.thirdPartyAppData[appId];
                if (app) {
                    data[appId] = {
                        name: app.name || app.title,
                        version: app.version,
                        appBin: app.appBin ? '[binary]' : undefined
                    };
                }
            });
        }
    } catch (e) {}
    try {
        data.installedApps = JSON.parse(localStorage.getItem('mxos_installed_apps') || '[]');
    } catch (e) {
        data.installedApps = [];
    }
    return data;
}

function collectDesktopLayout() {
    const layout = { icons: [], taskbar: [] };
    try {
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            layout.icons.push({
                app: icon.dataset.app,
                label: icon.querySelector('span') ? icon.querySelector('span').textContent : ''
            });
        });
    } catch (e) {}
    try {
        document.querySelectorAll('#taskbarItems .taskbar-item').forEach(item => {
            layout.taskbar.push({
                app: item.dataset.appId || item.dataset.app || '',
                label: item.querySelector('span') ? item.querySelector('span').textContent : ''
            });
        });
    } catch (e) {}
    return layout;
}

async function export_(options) {
    const opts = options || {};
    try {
        const JSZip = await getJSZip();
        const zip = new JSZip();
        const root = zip.folder('mxos-backup');

        const vfsFiles = await collectVFSFiles();
        const vfsFolder = root.folder('vfs');
        vfsFiles.forEach(f => {
            const safeName = String(f.name).replace(/[\\/:*?"<>|]/g, '_');
            vfsFolder.file(safeName + '.json', JSON.stringify(f, null, 2));
        });
        vfsFolder.file('_manifest.json', JSON.stringify({ count: vfsFiles.length, exportedAt: new Date().toISOString() }, null, 2));

        const settings = collectSettings();
        root.file('settings.json', JSON.stringify(settings, null, 2));

        const appData = collectAppData();
        root.file('app-data.json', JSON.stringify(appData, null, 2));

        const desktopLayout = collectDesktopLayout();
        root.file('desktop-layout.json', JSON.stringify(desktopLayout, null, 2));

        const manifest = {
            app: 'MXOS',
            version: '1.5',
            exportedAt: new Date().toISOString(),
            contents: {
                vfs: vfsFiles.length,
                settings: Object.keys(settings).length,
                apps: Object.keys(appData).length,
                desktopIcons: desktopLayout.icons.length
            }
        };
        root.file('manifest.json', JSON.stringify(manifest, null, 2));

        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const filename = 'mxos-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.mxbak';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '备份已导出', body: filename, type: 'success', duration: 3500 });
        }
        return { ok: true, filename, manifest };
    } catch (e) {
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '导出失败', body: String(e.message || e), type: 'error', duration: 4000 });
        }
        return { ok: false, error: String(e.message || e) };
    }
}

const dataExport = { export: export_ };

window.MXOS.System.dataExport = dataExport;

export { dataExport };
