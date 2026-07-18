window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_usage_report';

const APP_LABELS = {
    'this-pc': '此电脑',
    'browser': '浏览器',
    'settings': '设置',
    'office': '办公套件',
    'music': '音乐',
    'calculator': '计算器',
    'terminal': '终端',
    'calendar': '日历',
    'notepad': '记事本',
    'store': '应用商店',
    'task-manager-pro': '任务管理器'
};

let data = { daily: {}, events: 0 };
let currentApp = null;
let appStart = 0;
let tickTimer = null;

function load() {
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"daily":{},"events":0}'); } catch {}
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ensureDay(key) {
    if (!data.daily[key]) data.daily[key] = { apps: {}, events: 0, focusMs: 0 };
    return data.daily[key];
}

function recordApp(appId) {
    const day = ensureDay(todayKey());
    day.apps[appId] = (day.apps[appId] || 0) + 1;
    save();
}

function recordEvent() {
    const day = ensureDay(todayKey());
    day.events += 1;
    data.events = (data.events || 0) + 1;
    save();
}

function recordFocus(ms) {
    const day = ensureDay(todayKey());
    day.focusMs = (day.focusMs || 0) + ms;
    save();
}

function onFocusChange(e) {
    const d = e && e.detail;
    if (currentApp) {
        const elapsed = Date.now() - appStart;
        if (elapsed > 1000) recordFocus(elapsed);
    }
    currentApp = d?.appId || null;
    appStart = Date.now();
}

function onAppLaunch(e) {
    const appId = (e && e.detail && (e.detail.appId || e.detail.app)) || 'unknown';
    recordApp(appId);
}

function getWeekRange() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
}

function getWeeklyReport() {
    const { monday, sunday } = getWeekRange();
    const apps = {};
    let events = 0;
    let focusMs = 0;
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const day = data.daily[key];
        days.push({
            date: key,
            events: day?.events || 0,
            focusMs: day?.focusMs || 0,
            apps: day?.apps || {}
        });
        if (day) {
            events += day.events || 0;
            focusMs += day.focusMs || 0;
            for (const k in day.apps) apps[k] = (apps[k] || 0) + day.apps[k];
        }
    }
    return { monday, sunday, apps, events, focusMs, days };
}

function formatDuration(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) return `${h}小时${m}分钟`;
    if (m > 0) return `${m}分钟`;
    return `${total}秒`;
}

function appLabel(id) {
    return APP_LABELS[id] || id;
}

function showReport() {
    const report = getWeeklyReport();
    let panel = document.getElementById('mxosUsageReportPanel');
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'mxosUsageReportPanel';
    panel.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 680px; max-width: 92vw; max-height: 86vh;
        overflow-y: auto;
        background: var(--glass-bg, rgba(20,20,22,0.85));
        backdrop-filter: blur(28px) saturate(1.4);
        border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        border-radius: var(--radius-lg, 16px);
        box-shadow: var(--shadow, 0 20px 60px rgba(0,0,0,0.5));
        color: var(--text-color, #fff);
        z-index: 9990;
        padding: 24px;
    `;
    const sortedApps = Object.entries(report.apps).sort((a, b) => b[1] - a[1]);
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h2 style="font-size:20px;margin:0">本周系统使用报告</h2>
            <button id="mxosUsageClose" style="background:rgba(255,255,255,0.08);border:1px solid var(--glass-border);color:var(--text-color);padding:6px 12px;border-radius:8px;cursor:pointer">关闭</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
            <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px">
                <div style="font-size:11px;color:var(--text-secondary)">事件总数</div>
                <div style="font-size:22px;font-weight:600;margin-top:4px">${report.events}</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px">
                <div style="font-size:11px;color:var(--text-secondary)">专注时长</div>
                <div style="font-size:22px;font-weight:600;margin-top:4px">${formatDuration(report.focusMs)}</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px">
                <div style="font-size:11px;color:var(--text-secondary)">使用应用数</div>
                <div style="font-size:22px;font-weight:600;margin-top:4px">${sortedApps.length}</div>
            </div>
        </div>
        <canvas id="mxosUsageChart" width="640" height="180" style="width:100%;height:auto;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:16px"></canvas>
        <h3 style="font-size:14px;margin:0 0 10px">应用使用次数</h3>
        <div style="display:flex;flex-direction:column;gap:6px">
            ${sortedApps.length ? sortedApps.map(([id, c]) => {
                const max = sortedApps[0][1] || 1;
                const w = Math.round((c / max) * 100);
                return `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
                    <div style="width:90px;color:var(--text-secondary)">${appLabel(id)}</div>
                    <div style="flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
                        <div style="width:${w}%;height:100%;background:var(--accent,#a78bfa)"></div>
                    </div>
                    <div style="width:40px;text-align:right">${c}</div>
                </div>`;
            }).join('') : '<div style="font-size:12px;color:var(--text-secondary)">本周暂无数据</div>'}
        </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#mxosUsageClose').addEventListener('click', () => panel.remove());
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.remove(); });
    drawChart(report);
}

function drawChart(report) {
    const canvas = document.getElementById('mxosUsageChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pad = 32;
    const cw = w - pad * 2;
    const ch = h - pad * 2;
    const max = Math.max(1, ...report.days.map(d => d.events));
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    report.days.forEach((d, i) => {
        const x = pad + (i + 0.5) * (cw / 7);
        const bh = (d.events / max) * ch;
        ctx.fillStyle = 'rgba(167,139,250,0.75)';
        ctx.fillRect(x - 14, h - pad - bh, 28, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '11px "MiSans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x, h - pad + 14);
        ctx.fillText(String(d.events), x, h - pad - bh - 4);
    });
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-usageReport')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.innerHTML = `
            <div class="settings-card-title">系统使用报告</div>
            <div class="settings-card-desc">查看本周应用使用时长、操作次数、专注统计</div>
            <button class="btn" id="setting-usageReport" style="margin-top:8px">查看周报</button>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-usageReport').addEventListener('click', showReport);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function tick() {
    if (currentApp) {
        const elapsed = Date.now() - appStart;
        if (elapsed > 60000) recordFocus(60000);
        appStart = Date.now();
    }
}

function init() {
    load();
    injectSettingsIntoPanel();
    window.addEventListener('mxos:app-launch', onAppLaunch);
    window.addEventListener('mxos:window-focus', onFocusChange);
    document.addEventListener('pointerdown', recordEvent, { passive: true });
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 60_000);
    window.MXOS.Features.usageReport = {
        getWeeklyReport, showReport, recordApp, recordEvent, recordFocus
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getWeeklyReport, showReport };
