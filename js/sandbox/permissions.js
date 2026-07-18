window.MXOS = window.MXOS || {};
window.MXOS.Sandbox = window.MXOS.Sandbox || {};

const PERM_KEY = 'mxos_sandbox_permissions';

export const PERMISSION_DEFS = {
    'storage': { label: '本地存储', desc: '允许应用在本地保存数据', risk: 'low' },
    'notifications': { label: '通知', desc: '允许应用发送系统通知', risk: 'low' },
    'network': { label: '网络访问', desc: '允许应用访问互联网', risk: 'medium' },
    'clipboard': { label: '剪贴板', desc: '允许应用读写剪贴板', risk: 'medium' },
    'geolocation': { label: '位置信息', desc: '允许应用获取地理位置', risk: 'high' },
    'camera': { label: '摄像头', desc: '允许应用使用摄像头', risk: 'high' },
    'microphone': { label: '麦克风', desc: '允许应用使用麦克风', risk: 'high' },
    'fullscreen': { label: '全屏', desc: '允许应用进入全屏模式', risk: 'low' },
    'window': { label: '窗口控制', desc: '允许应用修改窗口大小和标题', risk: 'low' },
    'system-info': { label: '系统信息', desc: '允许应用读取系统基本信息', risk: 'low' },
    'file-read': { label: '文件读取', desc: '允许应用读取 VFS 文件', risk: 'medium' },
    'file-write': { label: '文件写入', desc: '允许应用写入 VFS 文件', risk: 'high' },
    'theme': { label: '主题', desc: '允许应用读取和修改主题', risk: 'low' }
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_DEFS);

function loadPermissions() {
    try {
        const obj = JSON.parse(localStorage.getItem(PERM_KEY) || '{}');
        return obj && typeof obj === 'object' ? obj : {};
    } catch (e) {
        return {};
    }
}

function savePermissions(data) {
    try { localStorage.setItem(PERM_KEY, JSON.stringify(data)); } catch (e) {}
}

export function getGrantedPermissions(appId) {
    if (!appId) return [];
    const all = loadPermissions();
    const rec = all[appId];
    if (!rec) return [];
    return (rec.granted || []).slice();
}

export function getDeniedPermissions(appId) {
    if (!appId) return [];
    const all = loadPermissions();
    const rec = all[appId];
    if (!rec) return [];
    return (rec.denied || []).slice();
}

export function isGranted(appId, perm) {
    if (!appId || !perm) return false;
    const granted = getGrantedPermissions(appId);
    return granted.indexOf(perm) >= 0;
}

export function isDenied(appId, perm) {
    if (!appId || !perm) return false;
    const denied = getDeniedPermissions(appId);
    return denied.indexOf(perm) >= 0;
}

export function grantPermission(appId, perm) {
    if (!appId || !perm || !PERMISSION_DEFS[perm]) return false;
    const all = loadPermissions();
    if (!all[appId]) all[appId] = { granted: [], denied: [], asked: [], ts: Date.now() };
    const rec = all[appId];
    if (rec.granted.indexOf(perm) < 0) rec.granted.push(perm);
    const di = rec.denied.indexOf(perm);
    if (di >= 0) rec.denied.splice(di, 1);
    rec.ts = Date.now();
    savePermissions(all);
    return true;
}

export function revokePermission(appId, perm) {
    if (!appId || !perm) return false;
    const all = loadPermissions();
    if (!all[appId]) return false;
    const rec = all[appId];
    const gi = rec.granted.indexOf(perm);
    if (gi < 0) return false;
    rec.granted.splice(gi, 1);
    if (rec.denied.indexOf(perm) < 0) rec.denied.push(perm);
    rec.ts = Date.now();
    savePermissions(all);
    return true;
}

export function revokeAll(appId) {
    if (!appId) return false;
    const all = loadPermissions();
    if (!all[appId]) return false;
    delete all[appId];
    savePermissions(all);
    return true;
}

export function listAppPermissions(appId) {
    if (!appId) return [];
    const all = loadPermissions();
    const rec = all[appId];
    if (!rec) return [];
    return (rec.granted || []).map(p => ({
        perm: p,
        label: (PERMISSION_DEFS[p] || {}).label || p,
        desc: (PERMISSION_DEFS[p] || {}).desc || '',
        risk: (PERMISSION_DEFS[p] || {}).risk || 'unknown',
        grantedAt: rec.ts
    }));
}

export function listAllAppsWithPermissions() {
    const all = loadPermissions();
    return Object.keys(all).map(appId => ({
        appId,
        granted: (all[appId].granted || []).slice(),
        denied: (all[appId].denied || []).slice(),
        ts: all[appId].ts || 0
    }));
}

export function parseManifestPermissions(manifest) {
    if (!manifest || typeof manifest !== 'object') return [];
    let perms = manifest.permissions;
    if (!perms) {
        if (Array.isArray(manifest.permissions_declared)) perms = manifest.permissions_declared;
        else if (typeof manifest.permissions === 'string') perms = manifest.permissions.split(',').map(s => s.trim()).filter(Boolean);
        else return [];
    }
    if (typeof perms === 'string') perms = perms.split(',').map(s => s.trim()).filter(Boolean);
    if (!Array.isArray(perms)) return [];
    return perms.filter(p => PERMISSION_DEFS[p]).slice();
}

export function markAsked(appId, perm) {
    if (!appId || !perm) return;
    const all = loadPermissions();
    if (!all[appId]) all[appId] = { granted: [], denied: [], asked: [], ts: Date.now() };
    if (!all[appId].asked) all[appId].asked = [];
    if (all[appId].asked.indexOf(perm) < 0) all[appId].asked.push(perm);
    all[appId].ts = Date.now();
    savePermissions(all);
}

export async function requestPermission(appId, perm, options) {
    if (!appId || !perm || !PERMISSION_DEFS[perm]) return false;
    if (isGranted(appId, perm)) return true;
    if (isDenied(appId, perm) && !(options && options.force)) return false;

    const def = PERMISSION_DEFS[perm];
    let accepted = false;
    if (window.MXOS && window.MXOS.dialog && typeof window.MXOS.dialog.confirm === 'function') {
        const title = def.label + ' 权限申请';
        const msg = `应用 "${appId}" 请求 "${def.label}" 权限。\n${def.desc}\n风险等级：${def.risk}`;
        try { accepted = await window.MXOS.dialog.confirm(title, msg); } catch (e) { accepted = false; }
    } else {
        try { accepted = confirm(`应用 "${appId}" 请求 "${def.label}" 权限`); } catch (e) { accepted = false; }
    }
    markAsked(appId, perm);
    if (accepted) {
        grantPermission(appId, perm);
        return true;
    } else {
        const all = loadPermissions();
        if (!all[appId]) all[appId] = { granted: [], denied: [], asked: [], ts: Date.now() };
        if (all[appId].denied.indexOf(perm) < 0) all[appId].denied.push(perm);
        savePermissions(all);
        return false;
    }
}

export async function requestPermissionBundle(appId, perms, options) {
    if (!appId || !Array.isArray(perms) || perms.length === 0) return { granted: [], denied: [] };
    const granted = [];
    const denied = [];
    for (const p of perms) {
        const ok = await requestPermission(appId, p, options);
        if (ok) granted.push(p); else denied.push(p);
    }
    return { granted, denied };
}

const Permissions = {
    PERMISSION_DEFS,
    ALL_PERMISSIONS,
    getGrantedPermissions,
    getDeniedPermissions,
    isGranted,
    isDenied,
    grantPermission,
    revokePermission,
    revokeAll,
    listAppPermissions,
    listAllAppsWithPermissions,
    parseManifestPermissions,
    requestPermission,
    requestPermissionBundle,
    markAsked
};

window.MXOS.Sandbox.permissions = Permissions;
window.MXOS.Sandbox.Permissions = Permissions;

export default Permissions;
