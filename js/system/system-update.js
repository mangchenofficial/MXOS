import { dataExport } from './data-export.js';
import { http } from '../utils/http.js';

window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

const VERSION_KEY = 'mxos_version';
const MANIFEST_KEY = 'mxos_update_manifest';
const BACKUP_FLAG_KEY = 'mxos_update_backup';
const ROLLBACK_FLAG_KEY = 'mxos_update_rollback';

const DEFAULT_REPORT_URL = '/crash-report';

function getCurrentVersion() {
    let v = null;
    try { v = localStorage.getItem(VERSION_KEY); } catch (e) {}
    if (!v) v = '1.5';
    return v;
}

function setCurrentVersion(v) {
    try { localStorage.setItem(VERSION_KEY, v); } catch (e) {}
}

function compareVersions(a, b) {
    const pa = String(a || '0').split('.').map(x => parseInt(x, 10) || 0);
    const pb = String(b || '0').split('.').map(x => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const da = pa[i] || 0;
        const db = pb[i] || 0;
        if (da > db) return 1;
        if (da < db) return -1;
    }
    return 0;
}

function computeHash(str) {
    let hash = 5381;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i);
        hash = hash & hash;
    }
    return String(hash >>> 0);
}

async function fetchManifest() {
    return await http.get('/updates/manifest', { retry: 0 });
}

async function createBackup() {
    try {
        localStorage.setItem(BACKUP_FLAG_KEY, String(Date.now()));
        const res = await dataExport.export({ silent: true });
        return res && res.ok;
    } catch (e) {
        return false;
    }
}

async function downloadFile(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('下载失败: ' + url + ' ' + res.status);
    return await res.text();
}

async function incrementalDownload(manifest) {
    const files = (manifest.files || []).slice();
    const results = [];
    for (const file of files) {
        try {
            const localHash = localStorage.getItem('mxos_file_hash_' + file.path);
            if (file.hash && localHash === file.hash) {
                results.push({ path: file.path, skipped: true });
                continue;
            }
            if (!file.url) {
                results.push({ path: file.path, skipped: true });
                continue;
            }
            const content = await downloadFile(file.url);
            const actualHash = computeHash(content);
            results.push({
                path: file.path,
                url: file.url,
                hash: actualHash,
                expectedHash: file.hash,
                matched: !file.hash || actualHash === file.hash,
                size: content.length
            });
            try { localStorage.setItem('mxos_file_hash_' + file.path, actualHash); } catch (e) {}
        } catch (e) {
            results.push({ path: file.path, error: String(e.message || e) });
        }
    }
    return results;
}

function showUpdateDialog(manifest, onApply, onSkip) {
    if (document.getElementById('mxos-update-dialog')) return;
    const overlay = document.createElement('div');
    overlay.id = 'mxos-update-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);z-index:999997;display:flex;align-items:center;justify-content:center;font-family:MiSans,Microsoft YaHei,sans-serif';
    const features = (manifest.features || []).map(f => '<li>' + String(f).replace(/</g, '&lt;') + '</li>').join('');
    overlay.innerHTML = `
        <div style="background:#1e293b;color:#fff;border-radius:12px;padding:24px;width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <div style="font-size:18px;font-weight:600">发现新版本</div>
            </div>
            <div style="color:#cbd5e1;font-size:13px;line-height:1.6;margin-bottom:8px">
                当前版本：<strong>${getCurrentVersion()}</strong> &nbsp;→&nbsp; 新版本：<strong style="color:#3b82f6">${manifest.version || '?'}</strong>
            </div>
            ${features ? '<div style="color:#94a3b8;font-size:13px;margin-bottom:14px"><strong style="color:#cbd5e1">更新内容：</strong><ul style="margin:6px 0 0 18px">' + features + '</ul></div>' : ''}
            <div style="color:#94a3b8;font-size:12px;margin-bottom:16px">更新前将自动创建备份，失败可自动回滚。</div>
            <div id="mxos-update-progress" style="display:none;color:#94a3b8;font-size:12px;margin-bottom:14px"></div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button id="mxos-update-skip" style="padding:8px 18px;background:transparent;color:#cbd5e1;border:1px solid #475569;border-radius:6px;cursor:pointer">稍后</button>
                <button id="mxos-update-apply" style="padding:8px 18px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">立即更新</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#mxos-update-skip').onclick = () => {
        overlay.remove();
        if (onSkip) onSkip();
    };
    overlay.querySelector('#mxos-update-apply').onclick = () => onApply(overlay);
}

function showProgress(overlay, text) {
    const el = overlay.querySelector('#mxos-update-progress');
    if (el) {
        el.style.display = 'block';
        el.textContent = text;
    }
}

async function check(options) {
    const opts = options || {};
    try {
        const manifest = await fetchManifest();
        try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest)); } catch (e) {}
        const current = getCurrentVersion();
        const cmp = compareVersions(current, manifest.version);
        const hasUpdate = cmp < 0;
        if (opts.silent !== true) {
            if (hasUpdate) {
                showUpdateDialog(manifest, async (overlay) => {
                    showProgress(overlay, '正在创建备份...');
                    await createBackup();
                    showProgress(overlay, '正在下载增量更新...');
                    const results = await incrementalDownload(manifest);
                    showProgress(overlay, '正在应用更新...');
                    const rollbackKey = ROLLBACK_FLAG_KEY;
                    try { localStorage.setItem(rollbackKey, manifest.version); } catch (e) {}
                    setCurrentVersion(manifest.version);
                    const failed = results.filter(r => r.error || (r.matched === false));
                    if (failed.length > 0) {
                        showProgress(overlay, '部分更新失败，正在回滚...');
                        setCurrentVersion(current);
                        try { localStorage.removeItem(rollbackKey); } catch (e) {}
                        if (window.MXOS && typeof window.MXOS.notify === 'function') {
                            window.MXOS.notify({ title: '更新失败', body: '已自动回滚到旧版本', type: 'error', duration: 4000 });
                        }
                        setTimeout(() => { overlay.remove(); }, 2000);
                        return { ok: false, rolledBack: true, failed };
                    }
                    try { localStorage.removeItem(rollbackKey); } catch (e) {}
                    if (window.MXOS && typeof window.MXOS.notify === 'function') {
                        window.MXOS.notify({ title: '更新成功', body: '已更新到 ' + manifest.version, type: 'success', duration: 3000 });
                    }
                    showProgress(overlay, '更新完成，3 秒后刷新...');
                    setTimeout(() => {
                        try { location.reload(); } catch (e) {}
                    }, 3000);
                });
            } else {
                if (window.MXOS && typeof window.MXOS.notify === 'function') {
                    window.MXOS.notify({ title: '已是最新版本', body: '当前 ' + current, type: 'success', duration: 2500 });
                }
            }
        }
        return { hasUpdate, current, latest: manifest.version, manifest };
    } catch (e) {
        if (opts.silent !== true) {
            if (window.MXOS && typeof window.MXOS.notify === 'function') {
                window.MXOS.notify({ title: '检查更新失败', body: String(e.message || e), type: 'error', duration: 3000 });
            }
        }
        return { hasUpdate: false, error: String(e.message || e) };
    }
}

async function apply(manifest) {
    if (!manifest) {
        try { manifest = JSON.parse(localStorage.getItem(MANIFEST_KEY) || 'null'); } catch (e) { manifest = null; }
    }
    if (!manifest) return { ok: false, error: '无可用 manifest' };
    try {
        await createBackup();
        const results = await incrementalDownload(manifest);
        const failed = results.filter(r => r.error || (r.matched === false));
        if (failed.length > 0) {
            return { ok: false, failed };
        }
        setCurrentVersion(manifest.version);
        return { ok: true, results };
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }
}

function checkRollbackOnBoot() {
    try {
        const flag = localStorage.getItem(ROLLBACK_FLAG_KEY);
        if (flag) {
            localStorage.removeItem(ROLLBACK_FLAG_KEY);
            if (window.MXOS && typeof window.MXOS.notify === 'function') {
                setTimeout(() => {
                    window.MXOS.notify({ title: '上次更新可能失败', body: '已自动回滚，请重试更新', type: 'warning', duration: 5000 });
                }, 2000);
            }
        }
    } catch (e) {}
}

const update = { check, apply, getCurrentVersion, setCurrentVersion, compareVersions };

window.MXOS.System.update = update;

checkRollbackOnBoot();

export { update };
