import { registerAppRenderer } from '../core.js';
import { state } from '../state.js';

window.MXOS = window.MXOS || {};

const MAX_SAMPLES = 60;
const cpuHistory = [];
const memHistory = [];
const netHistory = [];
let lastNetBytes = 0;

let longTaskMsThisSec = 0;
try {
    const po = new PerformanceObserver((list) => {
        list.getEntries().forEach(e => { longTaskMsThisSec += e.duration; });
    });
    po.observe({ entryTypes: ['longtask'] });
} catch (e) {}

let fps = 60;
let frameCount = 0;
let lastFpsTime = performance.now();
function fpsLoop() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
        fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
    }
    requestAnimationFrame(fpsLoop);
}
requestAnimationFrame(fpsLoop);

function realAvailable() {
    return !!(window.MXOS && window.MXOS.Real && window.MXOS.Real.perf);
}

function getPerfSnapshot() {
    if (realAvailable() && typeof window.MXOS.Real.perf.getSnapshot === 'function') {
        try { return window.MXOS.Real.perf.getSnapshot(); } catch (e) { return null; }
    }
    return null;
}

function getHardwareInfo() {
    if (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.hardware === 'function') {
        try { return window.MXOS.Real.hardware(); } catch (e) { return null; }
    }
    return null;
}

function getMemoryInfo() {
    if (performance.memory) {
        return { supported: true, used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize, limit: performance.memory.jsHeapSizeLimit };
    }
    return { supported: false };
}

function getResourceEntries() {
    try { return performance.getEntriesByType('resource'); } catch (e) { return []; }
}

function getAccentColor() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    if (v && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
    return '#3b82f6';
}

function formatBytes(b) {
    if (!b || b < 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + '时' + m + '分' + sec + '秒';
    if (m > 0) return m + '分' + sec + '秒';
    return sec + '秒';
}

function domNodeCount(el) {
    try { return el ? el.querySelectorAll('*').length : 0; } catch (e) { return 0; }
}

function getDiskInfo() {
    let used = 0;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key) || '';
            used += (key.length + val.length) * 2;
        }
    } catch (e) {}
    let total = 5 * 1024 * 1024;
    try {
        if (navigator.storage && navigator.storage.estimate) {
            return navigator.storage.estimate().then(est => {
                return {
                    supported: true,
                    used: est.usage || used,
                    total: est.quota || total
                };
            });
        }
    } catch (e) {}
    return Promise.resolve({ supported: true, used, total });
}

function drawChart(canvas, data, color, label, unit, fixedMax) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 120;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
        const x = (w / 6) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    if (data.length < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '12px "MiSans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('采集中...', 10, 20);
        return;
    }

    let max = fixedMax || (Math.max.apply(null, data) * 1.15);
    if (max <= 0) max = 1;
    const stepX = w / (MAX_SAMPLES - 1);

    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((v, i) => {
        const x = i * stepX;
        const y = h - (v / max) * h;
        ctx.lineTo(x, y);
    });
    ctx.lineTo((data.length - 1) * stepX, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '66');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    data.forEach((v, i) => {
        const x = i * stepX;
        const y = h - (v / max) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const last = data[data.length - 1];
    const lx = (data.length - 1) * stepX;
    const ly = h - (last / max) * h;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '600 12px "MiSans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label + ': ' + last.toFixed(1) + unit, w - 8, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('最大 ' + max.toFixed(1) + unit, 8, h - 6);
}

function samplePerformance() {
    const snap = getPerfSnapshot();
    const memInfo = getMemoryInfo();
    let fpsVal = fps;
    let memMb;
    if (snap) {
        if (typeof snap.fps === 'number' && snap.fps > 0) fpsVal = snap.fps;
        if (snap.memory && snap.memory.supported) {
            memMb = snap.memory.usedJSHeapSize / (1024 * 1024);
        } else if (memInfo.supported) {
            memMb = memInfo.used / (1024 * 1024);
        } else {
            memMb = state.windows.reduce((s, w) => s + domNodeCount(w.element), 0) * 2 / 1024;
        }
    } else {
        if (memInfo.supported) {
            memMb = memInfo.used / (1024 * 1024);
        } else {
            memMb = state.windows.reduce((s, w) => s + domNodeCount(w.element), 0) * 2 / 1024;
        }
    }
    const cpu = Math.min(100, longTaskMsThisSec / 10 + (fpsVal < 50 ? (50 - fpsVal) * 0.4 : 0));
    cpuHistory.push(cpu);
    memHistory.push(memMb);

    let netBytes = 0;
    const entries = getResourceEntries();
    entries.forEach(r => { netBytes += (r.transferSize || r.encodedBodySize || 0); });
    const deltaBytes = Math.max(0, netBytes - lastNetBytes);
    lastNetBytes = netBytes;
    netHistory.push(deltaBytes / 1024);

    while (cpuHistory.length > MAX_SAMPLES) cpuHistory.shift();
    while (memHistory.length > MAX_SAMPLES) memHistory.shift();
    while (netHistory.length > MAX_SAMPLES) netHistory.shift();
    longTaskMsThisSec = 0;
    return { cpu, memMb, fpsVal, netBytes, deltaBytes };
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

registerAppRenderer('dashboard', (contentEl, windowEl) => {
    contentEl.style.padding = '0';
    contentEl.style.display = 'flex';
    contentEl.style.flexDirection = 'column';
    contentEl.style.fontFamily = '"MiSans","Microsoft YaHei",sans-serif';

    contentEl.innerHTML =
        '<div class="db-root" style="display:flex;flex-direction:column;height:100%;background:rgba(15,20,30,0.35);position:relative;overflow:hidden">' +
            '<div class="db-header" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-color,#3b82f6)"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' +
                '<div style="font-size:14px;font-weight:600;color:#fff;flex:1">系统仪表盘</div>' +
                '<div class="db-status" style="font-size:11px;color:#9ca3af"></div>' +
            '</div>' +
            '<div class="db-body" style="flex:1;overflow:auto;padding:14px"></div>' +
        '</div>';

    const bodyEl = contentEl.querySelector('.db-body');
    const statusEl = contentEl.querySelector('.db-status');

    async function render() {
        const snap = getPerfSnapshot();
        const memInfo = getMemoryInfo();
        const hw = getHardwareInfo();
        const disk = await getDiskInfo();

        const cpu = cpuHistory.length ? cpuHistory[cpuHistory.length - 1] : 0;
        const mem = memHistory.length ? memHistory[memHistory.length - 1] : 0;
        const net = netHistory.length ? netHistory[netHistory.length - 1] : 0;
        const fpsVal = snap?.fps || fps;

        let hwLine = '';
        if (hw) {
            const parts = [];
            if (hw.cpuCores) parts.push('CPU 核心: ' + hw.cpuCores);
            if (hw.deviceMemoryGB) parts.push('内存: ' + hw.deviceMemoryGB + ' GB');
            if (hw.platform) parts.push('平台: ' + hw.platform);
            if (hw.screen) parts.push('屏幕: ' + hw.screen.width + 'x' + hw.screen.height);
            hwLine = '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px;border:1px solid rgba(255,255,255,0.06);font-size:12px;color:#cbd5e1;line-height:1.7;margin-bottom:12px">' + escapeHtml(parts.join(' · ')) + '</div>';
        }

        bodyEl.innerHTML =
            '<div style="display:flex;flex-direction:column;gap:12px">' +
                (hw ? hwLine : '') +
                '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
                    statCard('CPU', cpu.toFixed(1) + '%', '#3b82f6') +
                    statCard('内存', mem.toFixed(1) + ' MB', '#10b981') +
                    statCard('FPS', String(fpsVal), '#fbbf24') +
                    statCard('网络', net.toFixed(1) + ' KB/s', '#a855f7') +
                    statCard('磁盘', disk.supported ? (disk.used / 1024 / 1024).toFixed(1) + ' MB' : '不可用', '#ec4899') +
                    statCard('窗口数', String(state.windows.length), '#64748b') +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.06)">' +
                    '<div style="font-size:12px;color:#9ca3af;margin-bottom:6px;display:flex;justify-content:space-between"><span>CPU 使用率</span><span style="color:#6b7280">每秒采样 / 60 秒</span></div>' +
                    '<canvas class="db-cpu" style="width:100%;height:120px;display:block"></canvas>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.06)">' +
                    '<div style="font-size:12px;color:#9ca3af;margin-bottom:6px;display:flex;justify-content:space-between"><span>内存 (MB)</span><span style="color:#6b7280">JS 堆使用</span></div>' +
                    '<canvas class="db-mem" style="width:100%;height:120px;display:block"></canvas>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.06)">' +
                    '<div style="font-size:12px;color:#9ca3af;margin-bottom:6px;display:flex;justify-content:space-between"><span>网络流量 (KB/s)</span><span style="color:#6b7280">增量</span></div>' +
                    '<canvas class="db-net" style="width:100%;height:120px;display:block"></canvas>' +
                '</div>' +
                '<div style="font-size:11px;color:#6b7280">' + (realAvailable() ? '数据来源: MXOS.Real 真机模块' : '数据来源: 浏览器 Performance API') + '</div>' +
            '</div>';

        const c1 = bodyEl.querySelector('.db-cpu');
        const c2 = bodyEl.querySelector('.db-mem');
        const c3 = bodyEl.querySelector('.db-net');
        const color = getAccentColor();
        if (c1) drawChart(c1, cpuHistory, color, 'CPU', '%', 100);
        if (c2) drawChart(c2, memHistory, '#10b981', '内存', ' MB');
        if (c3) drawChart(c3, netHistory, '#a855f7', '网络', ' KB/s');
    }

    function statCard(label, value, color) {
        return '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px 16px;flex:1;min-width:120px;border-left:3px solid ' + color + '">' +
            '<div style="font-size:11px;color:#9ca3af">' + label + '</div>' +
            '<div style="font-size:18px;color:#fff;font-weight:600;margin-top:2px">' + escapeHtml(value) + '</div>' +
        '</div>';
    }

    function drawCharts() {
        const c1 = bodyEl.querySelector('.db-cpu');
        const c2 = bodyEl.querySelector('.db-mem');
        const c3 = bodyEl.querySelector('.db-net');
        const color = getAccentColor();
        if (c1) drawChart(c1, cpuHistory, color, 'CPU', '%', 100);
        if (c2) drawChart(c2, memHistory, '#10b981', '内存', ' MB');
        if (c3) drawChart(c3, netHistory, '#a855f7', '网络', ' KB/s');
    }

    function onResize() { drawCharts(); }
    contentEl.addEventListener('windowResize', onResize);
    contentEl.addEventListener('windowResizeEnd', onResize);

    samplePerformance();
    render();
    const intervalId = setInterval(() => {
        if (!contentEl.isConnected) { clearInterval(intervalId); return; }
        samplePerformance();
        render();
        statusEl.textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, 1000);
});

window.MXOS.Dashboard = {
    open: () => {
        import('../core.js').then(core => {
            if (typeof core.createWindow === 'function') core.createWindow('dashboard');
        });
    }
};
