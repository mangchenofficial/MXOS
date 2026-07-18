import { vfs } from '../vfs.js';

window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

function randomFill(arr) {
    try {
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(arr);
            return;
        }
    } catch (e) {}
    for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
    }
}

function randomString(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < len; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
}

async function overwriteKey(key) {
    try {
        const original = localStorage.getItem(key);
        if (original === null) return;
        const len = Math.max(original.length, 1024);
        localStorage.setItem(key, randomString(len));
        localStorage.setItem(key, new Array(len + 1).join('0'));
        localStorage.removeItem(key);
    } catch (e) {}
}

async function overwriteVFS() {
    try {
        await vfs.ensureInitialized();
        const all = await vfs.getAll();
        for (const file of all) {
            try {
                if (file.content) {
                    const len = Math.max(String(file.content).length, 512);
                    await vfs.update(file.id, { content: randomString(len) });
                    await vfs.update(file.id, { content: new Array(len + 1).join('0') });
                }
                await vfs.delete(file.id);
            } catch (e) {}
        }
    } catch (e) {}
}

async function clearIndexedDB() {
    try {
        if (indexedDB.databases) {
            const dbs = await indexedDB.databases();
            for (const db of dbs) {
                if (db.name) {
                    try { await new Promise((res) => {
                        const req = indexedDB.deleteDatabase(db.name);
                        req.onsuccess = res;
                        req.onerror = res;
                        req.onblocked = res;
                    }); } catch (e) {}
                }
            }
        } else {
            ['MXOS_FileSystem', 'MXOSDB'].forEach(name => {
                try { indexedDB.deleteDatabase(name); } catch (e) {}
            });
        }
    } catch (e) {}
}

async function clearCaches() {
    try {
        if (window.caches && window.caches.keys) {
            const keys = await window.caches.keys();
            for (const k of keys) {
                try { await window.caches.delete(k); } catch (e) {}
            }
        }
    } catch (e) {}
}

function showConfirmDialog(onConfirm, onCancel) {
    if (document.getElementById('mxos-erase-dialog')) return;
    const overlay = document.createElement('div');
    overlay.id = 'mxos-erase-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:MiSans,Microsoft YaHei,sans-serif';
    overlay.innerHTML = `
        <div style="background:#1e1e1e;color:#fff;border-radius:12px;padding:24px;width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.6);border:1px solid #ef4444">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div style="font-size:18px;font-weight:600;color:#ef4444">危险：数据彻底清除</div>
            </div>
            <div style="color:#cbd5e1;font-size:13px;line-height:1.6;margin-bottom:16px">
                此操作将<span style="color:#ef4444;font-weight:600">永久删除</span>所有数据，包括文件、设置、应用数据，且无法恢复。<br>
                为防止误操作，请输入 <span style="color:#fbbf24;font-weight:600">DELETE</span> 以确认：
            </div>
            <input id="mxos-erase-input" type="text" placeholder="请输入 DELETE" style="width:100%;padding:10px;background:#0f172a;color:#fff;border:1px solid #475569;border-radius:6px;font-size:14px;box-sizing:border-box">
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
                <button id="mxos-erase-cancel" style="padding:8px 18px;background:transparent;color:#cbd5e1;border:1px solid #475569;border-radius:6px;cursor:pointer">取消</button>
                <button id="mxos-erase-ok" style="padding:8px 18px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer" disabled>确认清除</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#mxos-erase-input');
    const okBtn = overlay.querySelector('#mxos-erase-ok');
    const cancelBtn = overlay.querySelector('#mxos-erase-cancel');
    input.addEventListener('input', () => {
        okBtn.disabled = input.value !== 'DELETE';
    });
    okBtn.onclick = () => {
        overlay.remove();
        onConfirm();
    };
    cancelBtn.onclick = () => {
        overlay.remove();
        if (onCancel) onCancel();
    };
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            if (onCancel) onCancel();
        }
    });
}

async function erase(options) {
    const opts = options || {};
    if (!opts.skipConfirm) {
        return new Promise((resolve) => {
            showConfirmDialog(async () => {
                const res = await doErase();
                resolve(res);
            }, () => {
                resolve({ ok: false, cancelled: true });
            });
        });
    }
    return doErase();
}

async function doErase() {
    try {
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '开始清除数据', body: '正在覆盖式删除...', type: 'warning', duration: 3000 });
        }
        await overwriteVFS();
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            keys.push(localStorage.key(i));
        }
        for (const k of keys) {
            await overwriteKey(k);
        }
        try { localStorage.clear(); } catch (e) {}
        await clearIndexedDB();
        await clearCaches();
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const r of regs) {
                    try { await r.unregister(); } catch (e) {}
                }
            }
        } catch (e) {}
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '数据已彻底清除', body: '系统将在 3 秒后刷新', type: 'success', duration: 3000 });
        }
        setTimeout(() => {
            try { location.reload(); } catch (e) {}
        }, 3000);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }
}

const dataErase = { erase };

window.MXOS.System.dataErase = dataErase;

export { dataErase };
