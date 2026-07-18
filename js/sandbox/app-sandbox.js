import { state } from '../state.js';
import { eventBus } from '../utils/event-bus.js';
import Permissions, { parseManifestPermissions, requestPermissionBundle, getGrantedPermissions, isGranted, revokePermission as permRevoke, grantPermission as permGrant, listAppPermissions, listAllAppsWithPermissions } from './permissions.js';
import Rpc, { attach, detach, emitEvent, genId, genToken } from './postmessage-rpc.js';

window.MXOS = window.MXOS || {};
window.MXOS.Sandbox = window.MXOS.Sandbox || {};

const TOKEN_KEY = 'mxos_sandbox_tokens';
const sandboxEntries = new Map();

function loadTokens() {
    try {
        const obj = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
        return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
}

function saveTokens(data) {
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(data)); } catch (e) {}
}

function getTokenForApp(appId) {
    if (!appId) return null;
    const tokens = loadTokens();
    if (!tokens[appId]) {
        tokens[appId] = { token: genToken(), createdAt: Date.now() };
        saveTokens(tokens);
    }
    return tokens[appId].token;
}

function clearTokenForApp(appId) {
    const tokens = loadTokens();
    if (tokens[appId]) {
        delete tokens[appId];
        saveTokens(tokens);
    }
}

function buildSandboxAttribute() {
    return [
        'allow-scripts',
        'allow-forms',
        'allow-popups',
        'allow-modals',
        'allow-same-origin',
        'allow-downloads',
        'allow-pointer-lock',
        'allow-popups-to-escape-sandbox'
    ].join(' ');
}

function buildHostScript(appId, token) {
    return `
(function() {
    if (window.__mxos_sandbox_injected) return;
    window.__mxos_sandbox_injected = true;
    var APP_ID = ${JSON.stringify(appId)};
    var TOKEN = ${JSON.stringify(token)};
    var pendingCalls = {};
    var eventListeners = {};
    var ready = false;
    var readyQueue = [];

    function post(msg) {
        msg.__mxos = 'sandbox';
        msg.appId = APP_ID;
        msg.token = TOKEN;
        window.parent.postMessage(msg, '*');
    }

    window.addEventListener('message', function(evt) {
        var data = evt.data;
        if (!data || data.__mxos !== 'sandbox') return;
        if (data.appId !== APP_ID || data.token !== TOKEN) return;
        if (data.type === 'handshake-ack') {
            ready = true;
            window.dispatchEvent(new CustomEvent('mxos:ready'));
            while (readyQueue.length) {
                try { readyQueue.shift()(); } catch (e) {}
            }
            return;
        }
        if (data.type === 'api-response') {
            var entry = pendingCalls[data.callId];
            if (entry) {
                delete pendingCalls[data.callId];
                clearTimeout(entry.timer);
                if (data.ok) entry.resolve(data.result);
                else entry.reject(new Error(data.error || 'API 调用失败'));
            }
            return;
        }
        if (data.type === 'event') {
            var cbs = eventListeners[data.name] || [];
            cbs.forEach(function(cb) {
                try { cb(data.payload); } catch (e) {}
            });
        }
    });

    function callApi(name, args, options) {
        var opts = options || {};
        var timeout = opts.timeout || 30000;
        return new Promise(function(resolve, reject) {
            var callId = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            var timer = setTimeout(function() {
                if (pendingCalls[callId]) {
                    delete pendingCalls[callId];
                    reject(new Error('API 调用超时: ' + name));
                }
            }, timeout);
            pendingCalls[callId] = { resolve: resolve, reject: reject, timer: timer };
            post({ type: 'api-call', callId: callId, name: name, args: args || [] });
        });
    }

    window.MXOS = {
        ready: function(cb) {
            if (ready) { cb(); return; }
            readyQueue.push(cb);
        },
        call: callApi,
        on: function(eventName, cb) {
            if (typeof cb !== 'function') return function() {};
            if (!eventListeners[eventName]) eventListeners[eventName] = [];
            eventListeners[eventName].push(cb);
            return function() {
                var arr = eventListeners[eventName] || [];
                var idx = arr.indexOf(cb);
                if (idx >= 0) arr.splice(idx, 1);
            };
        },
        getSystemInfo: function() { return callApi('getSystemInfo'); },
        getAppInfo: function() { return callApi('getAppInfo'); },
        Storage: {
            set: function(k, v) { return callApi('storage.set', [k, v]); },
            get: function(k) { return callApi('storage.get', [k]); },
            remove: function(k) { return callApi('storage.remove', [k]); },
            clear: function() { return callApi('storage.clear', []); },
            keys: function() { return callApi('storage.keys', []); }
        },
        Notification: {
            show: function(opts) { return callApi('notification.show', [opts]); }
        },
        Network: {
            fetch: function(url, opts) { return callApi('network.fetch', [url, opts]); }
        },
        Window: {
            setTitle: function(t) { return callApi('window.setTitle', [t]); },
            setSize: function(w, h) { return callApi('window.setSize', [w, h]); }
        }
    };

    post({ type: 'handshake' });
    setTimeout(function() {
        window.dispatchEvent(new CustomEvent('mxos:bridge-ready'));
    }, 0);
})();
`;
}

function buildDefaultApi(appId, token, sandbox) {
    return {
        'getSystemInfo'() {
            return {
                os: 'MXOS',
                version: '1.6',
                language: navigator.language || 'zh-CN',
                online: navigator.onLine
            };
        },
        'getAppInfo'() {
            const data = state.thirdPartyAppData[appId];
            return data ? {
                id: appId,
                name: data.name,
                version: data.version,
                description: data.description
            } : { id: appId };
        },
        async 'storage.set'(key, value) {
            if (!isGranted(appId, 'storage')) {
                const ok = await Permissions.requestPermission(appId, 'storage');
                if (!ok) throw new Error('未授予 storage 权限');
            }
            const k = 'mxos_app_' + appId + '_' + key;
            try {
                localStorage.setItem(k, typeof value === 'string' ? value : JSON.stringify(value));
            } catch (e) { throw new Error('存储失败: ' + e.message); }
        },
        async 'storage.get'(key) {
            if (!isGranted(appId, 'storage')) {
                const ok = await Permissions.requestPermission(appId, 'storage');
                if (!ok) throw new Error('未授予 storage 权限');
            }
            const k = 'mxos_app_' + appId + '_' + key;
            try {
                const v = localStorage.getItem(k);
                if (!v) return null;
                try { return JSON.parse(v); } catch (e) { return v; }
            } catch (e) { return null; }
        },
        async 'storage.remove'(key) {
            if (!isGranted(appId, 'storage')) throw new Error('未授予 storage 权限');
            localStorage.removeItem('mxos_app_' + appId + '_' + key);
        },
        async 'storage.clear'() {
            if (!isGranted(appId, 'storage')) throw new Error('未授予 storage 权限');
            Object.keys(localStorage).filter(k => k.startsWith('mxos_app_' + appId + '_')).forEach(k => localStorage.removeItem(k));
        },
        async 'storage.keys'() {
            if (!isGranted(appId, 'storage')) throw new Error('未授予 storage 权限');
            return Object.keys(localStorage).filter(k => k.startsWith('mxos_app_' + appId + '_')).map(k => k.replace('mxos_app_' + appId + '_', ''));
        },
        async 'notification.show'(opts) {
            if (!isGranted(appId, 'notifications')) {
                const ok = await Permissions.requestPermission(appId, 'notifications');
                if (!ok) throw new Error('未授予 notifications 权限');
            }
            if (window.MXOS && typeof window.MXOS.notify === 'function') {
                window.MXOS.notify({
                    title: (opts && opts.title) || '应用通知',
                    body: (opts && opts.message) || '',
                    type: (opts && opts.type) || 'info',
                    duration: (opts && opts.duration) || 3000
                });
            }
        },
        async 'network.fetch'(url, opts) {
            if (!isGranted(appId, 'network')) {
                const ok = await Permissions.requestPermission(appId, 'network');
                if (!ok) throw new Error('未授予 network 权限');
            }
            const res = await fetch(url, opts || {});
            return {
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                headers: res.headers && typeof res.headers.forEach === 'function' ? (function() {
                    const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); return h;
                })() : {},
                text: async () => res.text(),
                json: async () => res.json()
            };
        },
        async 'window.setTitle'(title) {
            if (!isGranted(appId, 'window')) {
                const ok = await Permissions.requestPermission(appId, 'window');
                if (!ok) throw new Error('未授予 window 权限');
            }
            const w = sandbox.windowEl;
            if (w) {
                const titleEl = w.querySelector('.window-title span:last-child');
                if (titleEl) titleEl.textContent = title;
            }
        },
        async 'window.setSize'(width, height) {
            if (!isGranted(appId, 'window')) {
                const ok = await Permissions.requestPermission(appId, 'window');
                if (!ok) throw new Error('未授予 window 权限');
            }
            const w = sandbox.windowEl;
            if (w) {
                w.style.width = width + 'px';
                w.style.height = height + 'px';
            }
        }
    };
}

async function showInstallPermissionDialog(app, perms) {
    if (!perms || perms.length === 0) return { granted: [], denied: [] };
    const permList = perms.map(p => {
        const def = Permissions.PERMISSION_DEFS[p] || { label: p, desc: '', risk: 'unknown' };
        const riskColor = { low: '#10b981', medium: '#fbbf24', high: '#ef4444' }[def.risk] || '#9ca3af';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--glass-border,rgba(255,255,255,0.06))">
            <span style="width:8px;height:8px;border-radius:50%;background:${riskColor};flex-shrink:0"></span>
            <div style="flex:1">
                <div style="font-size:13px;color:var(--text-color,#fff);font-weight:500">${def.label}</div>
                <div style="font-size:11px;color:var(--text-secondary,#9ca3af)">${def.desc}</div>
            </div>
            <span style="font-size:10px;color:${riskColor};text-transform:uppercase">${def.risk}</span>
        </div>`;
    }).join('');

    return new Promise((resolve) => {
        if (!window.MXOS || !window.MXOS.dialog) {
            resolve({ granted: [], denied: perms });
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'mxos-dialog-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0);backdrop-filter:blur(0px);transition:background 0.2s ease,backdrop-filter 0.2s ease';
        const dlg = document.createElement('div');
        dlg.className = 'mxos-dialog';
        dlg.style.cssText = 'min-width:420px;max-width:90vw;background:var(--glass-bg,rgba(20,25,35,0.85));border:1px solid var(--glass-border,rgba(255,255,255,0.12));border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:var(--text-color,#fff);overflow:hidden;display:flex;flex-direction:column;opacity:0;transform:scale(0.95);transition:opacity 0.22s ease,transform 0.22s cubic-bezier(0.34,1.56,0.64,1)';
        dlg.innerHTML = `
            <div style="padding:18px 22px 12px;border-bottom:1px solid var(--glass-border,rgba(255,255,255,0.08))">
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center">
                        <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-${(app && app.icon) || 'app-default'}"/></svg>
                    </div>
                    <div>
                        <div style="font-size:15px;font-weight:600">${(app && app.name) || '应用'} 安装</div>
                        <div style="font-size:12px;color:var(--text-secondary,#9ca3af);margin-top:2px">该应用申请以下权限：</div>
                    </div>
                </div>
            </div>
            <div style="padding:8px 22px 16px;max-height:280px;overflow-y:auto">
                ${permList}
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 16px;border-top:1px solid var(--glass-border,rgba(255,255,255,0.08))">
                <button data-act="deny" style="padding:8px 18px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:rgba(255,255,255,0.06);color:var(--text-color,#fff);cursor:pointer;font-size:13px">全部拒绝</button>
                <button data-act="allow" style="padding:8px 18px;border:none;border-radius:8px;background:var(--accent-color,#3b82f6);color:#fff;cursor:pointer;font-size:13px;font-weight:500">全部允许</button>
            </div>
        `;
        overlay.appendChild(dlg);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.style.background = 'rgba(0,0,0,0.45)';
            overlay.style.backdropFilter = 'blur(6px) saturate(180%)';
            dlg.style.opacity = '1';
            dlg.style.transform = 'scale(1)';
        });
        const finish = (granted) => {
            overlay.style.background = 'rgba(0,0,0,0)';
            overlay.style.backdropFilter = 'blur(0px)';
            dlg.style.opacity = '0';
            dlg.style.transform = 'scale(0.95)';
            setTimeout(() => overlay.remove(), 220);
            if (granted) {
                perms.forEach(p => permGrant(app.id, p));
                resolve({ granted: perms.slice(), denied: [] });
            } else {
                perms.forEach(p => {
                    const all = JSON.parse(localStorage.getItem('mxos_sandbox_permissions') || '{}');
                    if (!all[app.id]) all[app.id] = { granted: [], denied: [], asked: [], ts: Date.now() };
                    if (all[app.id].denied.indexOf(p) < 0) all[app.id].denied.push(p);
                    localStorage.setItem('mxos_sandbox_permissions', JSON.stringify(all));
                });
                resolve({ granted: [], denied: perms.slice() });
            }
        };
        dlg.querySelector('[data-act="allow"]').addEventListener('click', () => finish(true));
        dlg.querySelector('[data-act="deny"]').addEventListener('click', () => finish(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    });
}

async function create(app, options) {
    if (!app || !app.id) throw new Error('缺少应用信息');
    const opts = options || {};
    const appId = app.id;

    if (sandboxEntries.has(appId)) {
        return sandboxEntries.get(appId);
    }

    const manifestPerms = parseManifestPermissions(app);
    if (manifestPerms.length > 0 && opts.checkPermissions !== false) {
        const ungranted = manifestPerms.filter(p => !isGranted(appId, p) && !Permissions.isDenied(appId, p));
        if (ungranted.length > 0) {
            await showInstallPermissionDialog(app, ungranted);
        }
    }

    const contentEl = opts.contentEl || (opts.windowEl ? opts.windowEl.querySelector('.window-content') : null);
    if (!contentEl) throw new Error('缺少内容容器');

    const token = getTokenForApp(appId);
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', buildSandboxAttribute());
    iframe.setAttribute('aria-label', app.name || '第三方应用');
    iframe.style.cssText = 'width:100%;height:100%;border:0;background:transparent;display:block';

    const appBin = app.appBin || '';
    const hostScript = buildHostScript(appId, token);
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<base target="_blank">
<style>html,body{margin:0;padding:0;height:100%;width:100%;background:transparent;font-family:'MiSans','Microsoft YaHei',sans-serif;overflow:auto}body{color:#fff}</style>
</head>
<body>
<script>
${hostScript}
</script>
<script>
${appBin}
</script>
</body>
</html>`;

    iframe.srcdoc = htmlContent;

    const sandboxEntry = {
        appId,
        token,
        iframe,
        contentEl,
        windowEl: opts.windowEl || null,
        app,
        createdAt: Date.now(),
        api: null,
        detach: null
    };

    const api = buildDefaultApi(appId, token, sandboxEntry);
    sandboxEntry.api = api;
    const origin = '*';
    sandboxEntry.detach = () => detach(appId, token);
    attach(iframe, appId, token, api, { origin });

    sandboxEntries.set(appId, sandboxEntry);
    contentEl.innerHTML = '';
    contentEl.appendChild(iframe);

    eventBus.emit('sandbox:create', { appId, token });

    iframe.addEventListener('load', () => {
        eventBus.emit('sandbox:load', { appId, token });
    });

    iframe.addEventListener('error', (e) => {
        eventBus.emit('sandbox:error', { appId, token, error: e.message || 'iframe error' });
    });

    return sandboxEntry;
}

function destroy(appId) {
    if (!appId) return false;
    const entry = sandboxEntries.get(appId);
    if (!entry) return false;
    try {
        if (entry.detach) entry.detach();
    } catch (e) {}
    try {
        if (entry.iframe && entry.iframe.parentNode) {
            entry.iframe.parentNode.removeChild(entry.iframe);
        }
    } catch (e) {}
    sandboxEntries.delete(appId);
    eventBus.emit('sandbox:destroy', { appId });
    return true;
}

async function grantPermission(appId, perm) {
    const ok = permGrant(appId, perm);
    if (ok) {
        const entry = sandboxEntries.get(appId);
        if (entry) {
            emitEvent(entry.iframe, appId, entry.token, 'permission-granted', { perm });
        }
        eventBus.emit('sandbox:permission-granted', { appId, perm });
    }
    return ok;
}

async function revokePermission(appId, perm) {
    const ok = permRevoke(appId, perm);
    if (ok) {
        const entry = sandboxEntries.get(appId);
        if (entry) {
            emitEvent(entry.iframe, appId, entry.token, 'permission-revoked', { perm });
        }
        eventBus.emit('sandbox:permission-revoked', { appId, perm });
    }
    return ok;
}

function getSandboxEntry(appId) {
    return sandboxEntries.get(appId) || null;
}

function listActive() {
    return Array.from(sandboxEntries.values()).map(e => ({
        appId: e.appId,
        createdAt: e.createdAt,
        hasWindow: !!e.windowEl
    }));
}

const Sandbox = {
    create,
    destroy,
    grantPermission,
    revokePermission,
    getSandboxEntry,
    listActive,
    permissions: Permissions,
    rpc: Rpc,
    showInstallPermissionDialog,
    buildSandboxAttribute
};

window.MXOS.Sandbox = Object.assign({}, window.MXOS.Sandbox, Sandbox);

export { create, destroy, grantPermission, revokePermission, getSandboxEntry, listActive, showInstallPermissionDialog };
export default Sandbox;
