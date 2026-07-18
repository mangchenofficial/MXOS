import { vfs } from '../vfs.js';
import { state, appConfigs } from '../state.js';
import { openApp } from '../core.js';

window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

const TEST_TIMEOUT = 30000;
const LOG_PATH = '/System/Logs/smoke-test.json';

function withTimeout(promiseFactory, ms = 5000) {
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(false);
            }
        }, ms);
        Promise.resolve()
            .then(promiseFactory)
            .then((result) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(result !== false);
                }
            })
            .catch(() => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(false);
                }
            });
    });
}

async function ensureSystemLogsFolder() {
    try {
        await vfs.ensureInitialized();
        const all = await vfs.getAll();
        let systemFolder = all.find(f => f.name === 'System' && f.type === 'folder' && f.parentId === null);
        if (!systemFolder) {
            const sysId = await vfs.add({ name: 'System', type: 'folder', parentId: null, inTrash: false });
            systemFolder = { id: sysId };
        }
        let logsFolder = all.find(f => f.name === 'Logs' && f.type === 'folder' && f.parentId === systemFolder.id);
        if (!logsFolder) {
            const logsId = await vfs.add({ name: 'Logs', type: 'folder', parentId: systemFolder.id, inTrash: false });
            logsFolder = { id: logsId };
        }
        return logsFolder.id;
    } catch (e) {
        return null;
    }
}

async function saveLogToVFS(report) {
    const folderId = await ensureSystemLogsFolder();
    if (folderId === null) return false;
    try {
        await vfs.ensureInitialized();
        const all = await vfs.getAll();
        const existing = all.find(f => f.name === 'smoke-test.json' && f.parentId === folderId);
        if (existing) {
            await vfs.update(existing.id, { content: JSON.stringify(report, null, 2) });
        } else {
            await vfs.add({ name: 'smoke-test.json', type: 'file', parentId: folderId, content: JSON.stringify(report, null, 2), inTrash: false });
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function testVFS() {
    try {
        await vfs.ensureInitialized();
        const testName = 'smoke-test-' + Date.now() + '.tmp';
        const id = await vfs.add({ name: testName, type: 'file', parentId: null, content: 'smoke-data', inTrash: false });
        await vfs.update(id, { content: 'smoke-data-updated' });
        const all = await vfs.getAll();
        const found = all.find(f => f.id === id);
        const ok = !!found && found.content === 'smoke-data-updated';
        await vfs.delete(id);
        return ok;
    } catch (e) {
        return false;
    }
}

async function testWindowOpenClose() {
    const testAppId = 'smoke-notepad-' + Date.now();
    try {
        appConfigs[testAppId] = {
            title: '冒烟测试记事本',
            icon: 'notepad',
            width: 500,
            height: 350,
            content: 'notepad',
            fileId: null,
            initialContent: ''
        };
        const before = state.windows.length;
        openApp(testAppId);
        await new Promise(r => setTimeout(r, 800));
        const afterOpen = state.windows.length;
        const opened = afterOpen > before;
        const w = state.windows.find(w => w.appId === testAppId);
        if (w && w.element) {
            const closeBtn = w.element.querySelector('.window-control.close');
            if (closeBtn) closeBtn.click();
            await new Promise(r => setTimeout(r, 400));
        }
        const afterClose = state.windows.length;
        return opened && afterClose <= before;
    } catch (e) {
        return false;
    } finally {
        delete appConfigs[testAppId];
    }
}

async function testNotification() {
    try {
        if (!window.MXOS || typeof window.MXOS.notify !== 'function') return false;
        window.MXOS.notify({ title: '冒烟测试', body: '通知功能验证', type: 'info', duration: 1500 });
        return true;
    } catch (e) {
        return false;
    }
}

async function testClipboard() {
    try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) return false;
        await navigator.clipboard.writeText('mxos-smoke-test');
        const text = await navigator.clipboard.readText();
        return text === 'mxos-smoke-test';
    } catch (e) {
        return false;
    }
}

async function testSettingsSave() {
    try {
        const key = 'mxos_smoke_test';
        const value = 'ok-' + Date.now();
        localStorage.setItem(key, value);
        const got = localStorage.getItem(key);
        localStorage.removeItem(key);
        return got === value;
    } catch (e) {
        return false;
    }
}

async function testStoreLoad() {
    try {
        if (!window.MXOS || typeof window.MXOS.notify !== 'function') return false;
        const hasStoreConfig = !!appConfigs.store;
        const hasStoreEntry = !!document.querySelector('.start-app[data-app="store"]');
        return hasStoreConfig && hasStoreEntry;
    } catch (e) {
        return false;
    }
}

const tests = [
    { name: 'VFS 读写', fn: testVFS },
    { name: '窗口打开/关闭', fn: testWindowOpenClose },
    { name: '通知发送', fn: testNotification },
    { name: '剪贴板', fn: testClipboard },
    { name: '设置保存', fn: testSettingsSave },
    { name: '应用商店加载', fn: testStoreLoad }
];

async function run() {
    const report = {
        startedAt: new Date().toISOString(),
        duration: 0,
        total: tests.length,
        passed: 0,
        failed: 0,
        results: [],
        path: LOG_PATH
    };
    const start = performance.now();
    for (const t of tests) {
        const tStart = performance.now();
        const ok = await withTimeout(t.fn, 5000);
        const duration = Math.round(performance.now() - tStart);
        report.results.push({ name: t.name, status: ok ? 'pass' : 'fail', duration });
        if (ok) report.passed++; else report.failed++;
    }
    report.duration = Math.round(performance.now() - start);
    report.savedToVFS = await saveLogToVFS(report);
    try {
        localStorage.setItem('mxos_smoke_test_last', JSON.stringify(report));
    } catch (e) {}
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        window.MXOS.notify({
            title: '冒烟测试完成',
            body: `通过 ${report.passed}/${report.total}，失败 ${report.failed}`,
            type: report.failed === 0 ? 'success' : 'warning',
            duration: 4000
        });
    }
    return report;
}

const smokeTest = { run, tests };

window.MXOS.System.smokeTest = smokeTest;

export { smokeTest };
