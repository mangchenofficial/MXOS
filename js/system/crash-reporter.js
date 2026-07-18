import { http } from '../utils/http.js';

window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

const CRASH_KEY = 'mxos_crash_report';
const OPERATION_LOG_KEY = 'mxos_recent_ops';
const MAX_OPS = 50;

function getRecentOps() {
    try {
        return JSON.parse(localStorage.getItem(OPERATION_LOG_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function logOperation(name, data) {
    try {
        const ops = getRecentOps();
        ops.unshift({ name, data: data || null, t: Date.now(), time: new Date().toISOString() });
        if (ops.length > MAX_OPS) ops.length = MAX_OPS;
        localStorage.setItem(OPERATION_LOG_KEY, JSON.stringify(ops));
    } catch (e) {}
}

function buildStateSnapshot() {
    const snapshot = {
        url: location.href,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        language: navigator.language,
        platform: navigator.platform
    };
    try {
        if (window.MXOS && window.MXOS.System && window.MXOS.System.perfTrace) {
            snapshot.perf = window.MXOS.System.perfTrace.getDashboard();
        }
    } catch (e) {}
    try {
        snapshot.openApps = (window.MXOS && window.MXOS.state) ? window.MXOS.state.windows.map(w => w.appId) : [];
    } catch (e) {}
    return snapshot;
}

function saveCrash(report) {
    try {
        localStorage.setItem(CRASH_KEY, JSON.stringify(report));
        return true;
    } catch (e) {
        return false;
    }
}

function getStoredCrash() {
    try {
        const raw = localStorage.getItem(CRASH_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function clearStoredCrash() {
    try { localStorage.removeItem(CRASH_KEY); } catch (e) {}
}

function reportError(type, message, source, lineno, colno, error) {
    const stack = error && error.stack ? error.stack : (new Error().stack || '');
    const report = {
        id: 'crash-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        type,
        message: String(message || ''),
        source: source || null,
        line: lineno || null,
        column: colno || null,
        stack,
        timestamp: new Date().toISOString(),
        recentOps: getRecentOps(),
        state: buildStateSnapshot()
    };
    saveCrash(report);
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        try {
            window.MXOS.notify({
                title: '系统异常已记录',
                body: message ? String(message).slice(0, 80) : type,
                type: 'error',
                duration: 4000
            });
        } catch (e) {}
    }
    return report;
}

function setupGlobalHandlers() {
    window.addEventListener('error', (e) => {
        reportError('error', e.message, e.filename, e.lineno, e.colno, e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason;
        const msg = reason && reason.message ? reason.message : String(reason || 'Unhandled Rejection');
        const err = reason instanceof Error ? reason : null;
        reportError('unhandledrejection', msg, null, null, null, err);
    });
}

function buildCrashDialog(report) {
    if (document.getElementById('mxos-crash-dialog')) return;
    const overlay = document.createElement('div');
    overlay.id = 'mxos-crash-dialog';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.55);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:MiSans,Microsoft YaHei,sans-serif';
    const time = new Date(report.timestamp).toLocaleString();
    const msg = String(report.message || '').slice(0, 200);
    overlay.innerHTML = `
        <div style="background:#1e293b;color:#fff;border-radius:12px;padding:24px;width:420px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div style="font-size:18px;font-weight:600">检测到上次异常退出</div>
            </div>
            <div style="color:#cbd5e1;font-size:13px;line-height:1.6;margin-bottom:18px">
                已生成报告，是否提交？<br>
                <div style="margin-top:8px;color:#94a3b8;font-size:12px">时间：${time}</div>
                <div style="color:#94a3b8;font-size:12px">类型：${report.type}</div>
                <div style="color:#94a3b8;font-size:12px">消息：${msg.replace(/</g,'&lt;')}</div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button id="mxos-crash-skip" style="padding:8px 18px;background:transparent;color:#cbd5e1;border:1px solid #475569;border-radius:6px;cursor:pointer">不提交</button>
                <button id="mxos-crash-view" style="padding:8px 18px;background:transparent;color:#cbd5e1;border:1px solid #475569;border-radius:6px;cursor:pointer">查看详情</button>
                <button id="mxos-crash-submit" style="padding:8px 18px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">提交</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#mxos-crash-skip').onclick = () => {
        clearStoredCrash();
        overlay.remove();
    };
    overlay.querySelector('#mxos-crash-view').onclick = () => {
        try {
            console.log('MXOS 崩溃报告详情:', report);
            const json = JSON.stringify(report, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) {}
    };
    overlay.querySelector('#mxos-crash-submit').onclick = async () => {
        const btn = overlay.querySelector('#mxos-crash-submit');
        btn.textContent = '提交中...';
        btn.disabled = true;
        try {
            await http.post('/crash-report', report, { retry: 0 });
            clearStoredCrash();
            if (window.MXOS && typeof window.MXOS.notify === 'function') {
                window.MXOS.notify({ title: '崩溃报告已提交', body: '感谢反馈', type: 'success', duration: 2500 });
            }
            overlay.remove();
        } catch (e) {
            btn.textContent = '重试';
            btn.disabled = false;
            if (window.MXOS && typeof window.MXOS.notify === 'function') {
                window.MXOS.notify({ title: '提交失败', body: '网络异常，报告已保留', type: 'warning', duration: 3000 });
            }
        }
    };
}

function checkPreviousCrash() {
    const stored = getStoredCrash();
    if (stored) {
        setTimeout(() => buildCrashDialog(stored), 1500);
    }
}

function getAllReports() {
    const stored = getStoredCrash();
    return stored ? [stored] : [];
}

const crashReporter = {
    reportError,
    getStoredCrash,
    clearStoredCrash,
    getAllReports,
    logOperation,
    checkPreviousCrash,
    setupGlobalHandlers
};

window.MXOS.System.crashReporter = crashReporter;

setupGlobalHandlers();
setTimeout(checkPreviousCrash, 2000);

export { crashReporter };
