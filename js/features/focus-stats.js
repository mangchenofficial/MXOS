window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_focus_stats';

let data = { daily: {} };
let focusSessionStart = 0;
let inFocus = false;

function load() {
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"daily":{}}'); } catch {}
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ensureDay(key) {
    if (!data.daily[key]) data.daily[key] = { focusMs: 0, sessions: 0 };
    return data.daily[key];
}

function onFocusEnter() {
    inFocus = true;
    focusSessionStart = Date.now();
}

function onFocusExit() {
    if (!inFocus) return;
    inFocus = false;
    const ms = Date.now() - focusSessionStart;
    const day = ensureDay(todayKey());
    day.focusMs += ms;
    day.sessions += 1;
    save();
}

function onFocusChange(e) {
    if (e && e.detail && e.detail.active) onFocusEnter();
    else onFocusExit();
}

function getWeeklyReport() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    const days = [];
    let totalMs = 0;
    let totalSessions = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayData = data.daily[key] || { focusMs: 0, sessions: 0 };
        days.push({ date: key, ...dayData });
        totalMs += dayData.focusMs;
        totalSessions += dayData.sessions;
    }
    return { days, totalMs, totalSessions };
}

function formatDuration(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (h > 0) return `${h}小时${m}分钟`;
    if (m > 0) return `${m}分钟`;
    return `${total}秒`;
}

function showReport() {
    const report = getWeeklyReport();
    let panel = document.getElementById('mxosFocusStatsPanel');
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'mxosFocusStatsPanel';
    panel.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 560px; max-width: 92vw;
        background: var(--glass-bg, rgba(20,20,22,0.85));
        backdrop-filter: blur(28px) saturate(1.4);
        border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        border-radius: var(--radius-lg, 16px);
        box-shadow: var(--shadow, 0 20px 60px rgba(0,0,0,0.5));
        color: var(--text-color, #fff);
        z-index: 9990;
        padding: 24px;
    `;
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h2 style="font-size:20px;margin:0">本周专注统计</h2>
            <button id="mxosFocusStatsClose" style="background:rgba(255,255,255,0.08);border:1px solid var(--glass-border);color:var(--text-color);padding:6px 12px;border-radius:8px;cursor:pointer">关闭</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px">
            <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px">
                <div style="font-size:11px;color:var(--text-secondary)">总专注时长</div>
                <div style="font-size:22px;font-weight:600;margin-top:4px">${formatDuration(report.totalMs)}</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:10px">
                <div style="font-size:11px;color:var(--text-secondary)">专注次数</div>
                <div style="font-size:22px;font-weight:600;margin-top:4px">${report.totalSessions}</div>
            </div>
        </div>
        <canvas id="mxosFocusChart" width="520" height="160" style="width:100%;height:auto;background:rgba(255,255,255,0.03);border-radius:10px"></canvas>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#mxosFocusStatsClose').addEventListener('click', () => panel.remove());
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.remove(); });
    drawChart(report);
}

function drawChart(report) {
    const canvas = document.getElementById('mxosFocusChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const pad = 32;
    const cw = w - pad * 2;
    const ch = h - pad * 2;
    const max = Math.max(1, ...report.days.map(d => d.focusMs));
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
        const bh = (d.focusMs / max) * ch;
        ctx.fillStyle = 'rgba(167,139,250,0.75)';
        ctx.fillRect(x - 14, h - pad - bh, 28, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '11px "MiSans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x, h - pad + 14);
    });
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-focusStats')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.innerHTML = `
            <div class="settings-card-title">专注统计</div>
            <div class="settings-card-desc">查看本周专注模式时长与次数</div>
            <button class="btn" id="setting-focusStats" style="margin-top:8px">查看周报</button>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-focusStats').addEventListener('click', showReport);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    load();
    injectSettingsIntoPanel();
    window.addEventListener('focus-mode:change', onFocusChange);
    window.MXOS.Features.focusStats = { getWeeklyReport, showReport };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getWeeklyReport, showReport };
