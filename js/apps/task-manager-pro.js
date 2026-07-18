import { registerAppRenderer, closeWindow, openApp, loadAppContent } from '../core.js';
import { state, appConfigs } from '../state.js';

const MAX_SAMPLES = 60;
const cpuHistory = [];
const memHistory = [];
const fpsHistory = [];

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

const openTimes = new WeakMap();
const openPerfTimes = new WeakMap();
function ensureOpenTime(windowEl) {
    if (!openTimes.has(windowEl)) {
        openTimes.set(windowEl, Date.now());
        openPerfTimes.set(windowEl, performance.now());
    }
    return openTimes.get(windowEl);
}

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
    try { return el.querySelectorAll('*').length; } catch (e) { return 0; }
}

function getMemoryInfo() {
    if (performance.memory) {
        return { supported: true, used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize };
    }
    return { supported: false };
}

function getResourceEntries() {
    try { return performance.getEntriesByType('resource'); } catch (e) { return []; }
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

function estimateWindowCpu(winObj, isActive) {
    const nodes = domNodeCount(winObj.element);
    let cpu = Math.min(15, nodes / 120);
    if (isActive) cpu += Math.min(80, longTaskMsThisSec / 10);
    if (winObj.minimized) cpu *= 0.3;
    return Math.min(100, Math.max(0, cpu));
}

function estimateWindowMemory(winObj, memInfo) {
    const nodes = domNodeCount(winObj.element);
    if (memInfo.supported) {
        const totalNodes = state.windows.reduce((s, w) => s + domNodeCount(w.element), 0) || 1;
        return memInfo.used * (nodes / totalNodes);
    }
    return nodes * 2048;
}

function windowRequestCount(winObj) {
    const openPerf = openPerfTimes.get(winObj.element) || 0;
    return getResourceEntries().filter(r => r.startTime >= openPerf).length;
}

registerAppRenderer('task-manager-pro', (contentEl, windowEl, appId) => {
    state.windows.forEach(w => ensureOpenTime(w.element));

    contentEl.style.padding = '0';
    contentEl.style.display = 'flex';
    contentEl.style.flexDirection = 'column';
    contentEl.style.fontFamily = '"MiSans","Microsoft YaHei",sans-serif';

    contentEl.innerHTML =
        '<div class="tmp-root" style="display:flex;flex-direction:column;height:100%;background:rgba(15,20,30,0.35);position:relative;overflow:hidden">' +
            '<div class="tmp-tabs" style="display:flex;gap:2px;padding:8px 8px 0 8px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">' +
                '<div class="tmp-tab" data-tab="process" style="padding:8px 16px;cursor:pointer;border-radius:6px 6px 0 0;font-size:13px;color:#cbd5e1;border-bottom:2px solid transparent">进程</div>' +
                '<div class="tmp-tab" data-tab="perf" style="padding:8px 16px;cursor:pointer;border-radius:6px 6px 0 0;font-size:13px;color:#cbd5e1;border-bottom:2px solid transparent">性能</div>' +
                '<div class="tmp-tab" data-tab="net" style="padding:8px 16px;cursor:pointer;border-radius:6px 6px 0 0;font-size:13px;color:#cbd5e1;border-bottom:2px solid transparent">网络</div>' +
                '<div style="flex:1"></div>' +
                '<div class="tmp-status" style="padding:8px 12px;font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:6px"></div>' +
            '</div>' +
            '<div class="tmp-body" style="flex:1;overflow:auto;padding:12px"></div>' +
            '<div class="tmp-modal"></div>' +
        '</div>';

    const tabsEl = contentEl.querySelector('.tmp-tabs');
    const bodyEl = contentEl.querySelector('.tmp-body');
    const statusEl = contentEl.querySelector('.tmp-status');
    const modalEl = contentEl.querySelector('.tmp-modal');

    let activeTab = 'process';

    function setTabStyle() {
        tabsEl.querySelectorAll('.tmp-tab').forEach(t => {
            const on = t.dataset.tab === activeTab;
            t.style.borderBottomColor = on ? 'var(--accent-color)' : 'transparent';
            t.style.color = on ? '#fff' : '#9ca3af';
            t.style.background = on ? 'rgba(255,255,255,0.06)' : 'transparent';
        });
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function showConfirm(message, onYes) {
        modalEl.innerHTML =
            '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:10">' +
                '<div style="background:rgba(30,35,45,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:20px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">' +
                    '<div style="font-size:14px;color:#fff;margin-bottom:16px;line-height:1.5">' + esc(message) + '</div>' +
                    '<div style="display:flex;justify-content:flex-end;gap:8px">' +
                        '<button class="tmp-cancel" style="padding:7px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;cursor:pointer;font-size:13px;font-family:inherit">取消</button>' +
                        '<button class="tmp-ok" style="padding:7px 16px;border-radius:6px;border:none;background:#ef4444;color:#fff;cursor:pointer;font-size:13px;font-family:inherit">确定</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        modalEl.querySelector('.tmp-cancel').onclick = () => { modalEl.innerHTML = ''; };
        modalEl.querySelector('.tmp-ok').onclick = () => { modalEl.innerHTML = ''; onYes(); };
    }

    function endTask(winObj) {
        const cfg = appConfigs[winObj.appId] || {};
        const name = cfg.title || winObj.appId;
        showConfirm('确定要结束任务 "' + name + '" 吗？未保存的数据可能会丢失。', () => {
            try { closeWindow(winObj); } catch (e) {}
            setTimeout(refreshActive, 200);
        });
    }

    function forceReload(winObj) {
        const cfg = appConfigs[winObj.appId] || {};
        const name = cfg.title || winObj.appId;
        showConfirm('强制重载 "' + name + '"？该窗口内容将重新加载。', () => {
            const cEl = winObj.element.querySelector('.window-content');
            if (cEl) {
                cEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:13px">重载中...</div>';
                try { loadAppContent(winObj.appId, cEl, winObj.element); } catch (e) {}
            }
            setTimeout(refreshActive, 400);
        });
    }

    function renderProcess() {
        state.windows.forEach(w => ensureOpenTime(w.element));
        const memInfo = getMemoryInfo();
        const activeEl = state.activeWindow;
        let rows = '';
        const wins = state.windows.slice();
        if (wins.length === 0) {
            rows = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#6b7280">暂无运行中的窗口</td></tr>';
        }
        wins.forEach(w => {
            const cfg = appConfigs[w.appId] || {};
            const name = cfg.title || w.appId;
            const isActive = w.element === activeEl;
            const cpu = estimateWindowCpu(w, isActive);
            const mem = estimateWindowMemory(w, memInfo);
            const net = windowRequestCount(w);
            const uptime = Date.now() - (openTimes.get(w.element) || Date.now());
            const stateLabel = w.minimized ? '<span style="color:#9ca3af;font-size:11px"> (最小化)</span>' : (isActive ? '<span style="color:var(--accent-color);font-size:11px"> (活动)</span>' : '');
            rows +=
                '<tr data-app="' + esc(w.appId) + '" style="border-bottom:1px solid rgba(255,255,255,0.05)">' +
                    '<td style="padding:8px 10px;color:#fff;font-size:13px">' + esc(name) + stateLabel + '</td>' +
                    '<td style="padding:8px 10px;font-size:12px;color:#cbd5e1;font-variant-numeric:tabular-nums">' + cpu.toFixed(1) + '%</td>' +
                    '<td style="padding:8px 10px;font-size:12px;color:#cbd5e1;font-variant-numeric:tabular-nums">' + formatBytes(mem) + '</td>' +
                    '<td style="padding:8px 10px;font-size:12px;color:#cbd5e1;font-variant-numeric:tabular-nums">' + net + '</td>' +
                    '<td style="padding:8px 10px;font-size:12px;color:#9ca3af">' + formatDuration(uptime) + '</td>' +
                    '<td style="padding:8px 10px;white-space:nowrap">' +
                        '<button class="tmp-end" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(239,68,68,0.5);background:rgba(239,68,68,0.15);color:#fca5a5;cursor:pointer;font-size:12px;font-family:inherit;margin-right:4px">结束任务</button>' +
                        '<button class="tmp-reload" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#cbd5e1;cursor:pointer;font-size:12px;font-family:inherit">重载</button>' +
                    '</td>' +
                '</tr>';
        });

        bodyEl.innerHTML =
            '<div style="margin-bottom:10px;display:flex;gap:10px;flex-wrap:wrap">' +
                '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:10px 14px;flex:1;min-width:140px">' +
                    '<div style="font-size:11px;color:#9ca3af">窗口数</div>' +
                    '<div style="font-size:20px;color:#fff;font-weight:600;margin-top:2px">' + wins.length + '</div>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:10px 14px;flex:1;min-width:140px">' +
                    '<div style="font-size:11px;color:#9ca3af">CPU 估算</div>' +
                    '<div style="font-size:20px;color:#fff;font-weight:600;margin-top:2px">' + (wins.reduce((s, w) => s + estimateWindowCpu(w, w.element === activeEl), 0)).toFixed(1) + '%</div>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:10px 14px;flex:1;min-width:140px">' +
                    '<div style="font-size:11px;color:#9ca3af">JS 堆内存</div>' +
                    '<div style="font-size:20px;color:#fff;font-weight:600;margin-top:2px">' + (memInfo.supported ? formatBytes(memInfo.used) : '不可用') + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.04);border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06)">' +
                '<table style="width:100%;border-collapse:collapse">' +
                    '<thead>' +
                        '<tr style="background:rgba(255,255,255,0.04)">' +
                            '<th style="padding:8px 10px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600">应用名</th>' +
                            '<th style="padding:8px 10px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600">CPU</th>' +
                            '<th style="padding:8px 10px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600">内存</th>' +
                            '<th style="padding:8px 10px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600">网络请求</th>' +
                            '<th style="padding:8px 10px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600">运行时长</th>' +
                            '<th style="padding:8px 10px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600">操作</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>';

        bodyEl.querySelectorAll('tr[data-app]').forEach(tr => {
            const appId2 = tr.dataset.app;
            const target = state.windows.find(w => w.appId === appId2);
            const endBtn = tr.querySelector('.tmp-end');
            const reloadBtn = tr.querySelector('.tmp-reload');
            if (endBtn && target) endBtn.onclick = () => endTask(target);
            if (reloadBtn && target) reloadBtn.onclick = () => forceReload(target);
        });
    }

    function renderPerf() {
        const hw = getHardwareInfo();
        let hwLine = '';
        if (hw) {
            const parts = [];
            if (hw.cpuCores) parts.push('CPU 核心: ' + hw.cpuCores);
            if (hw.deviceMemoryGB) parts.push('内存: ' + hw.deviceMemoryGB + ' GB');
            if (hw.platform) parts.push('平台: ' + hw.platform);
            if (hw.screen) parts.push('屏幕: ' + hw.screen.width + 'x' + hw.screen.height);
            hwLine = '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px;border:1px solid rgba(255,255,255,0.06);font-size:12px;color:#cbd5e1;line-height:1.7">' + esc(parts.join(' · ')) + '</div>';
        }
        bodyEl.innerHTML =
            '<div style="display:flex;flex-direction:column;gap:12px">' +
                (hw ? hwLine : '') +
                '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.06)">' +
                    '<div style="font-size:12px;color:#9ca3af;margin-bottom:6px;display:flex;justify-content:space-between"><span>CPU 使用率</span><span style="color:#6b7280">每秒采样 / 保留 60 秒</span></div>' +
                    '<canvas class="tmp-cpu" style="width:100%;height:120px;display:block"></canvas>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.06)">' +
                    '<div style="font-size:12px;color:#9ca3af;margin-bottom:6px;display:flex;justify-content:space-between"><span>内存 (MB)</span><span style="color:#6b7280">JS 堆使用</span></div>' +
                    '<canvas class="tmp-mem" style="width:100%;height:120px;display:block"></canvas>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.06)">' +
                    '<div style="font-size:12px;color:#9ca3af;margin-bottom:6px;display:flex;justify-content:space-between"><span>FPS</span><span style="color:#6b7280">帧率</span></div>' +
                    '<canvas class="tmp-fps" style="width:100%;height:120px;display:block"></canvas>' +
                '</div>' +
                '<div style="font-size:11px;color:#6b7280">' + (realAvailable() ? '数据来源: MXOS.Real 真机模块 (perf-monitor + hardware-info)' : '数据来源: 浏览器 Performance API (真机模块未加载，使用内置监测)') + '</div>' +
            '</div>';
    }

    function renderNet() {
        const snap = getPerfSnapshot();
        const entries = getResourceEntries();
        let totalBytes = 0;
        let reqCount = entries.length;
        if (snap && snap.resources) {
            totalBytes = snap.resources.totalTransferSize || 0;
            if (typeof snap.resources.total === 'number') reqCount = snap.resources.total;
        } else {
            entries.forEach(r => { totalBytes += (r.transferSize || r.encodedBodySize || 0); });
        }
        const slow = entries.filter(r => r.duration > 500).sort((a, b) => b.duration - a.duration).slice(0, 15);
        let slowRows = '';
        if (slow.length === 0) {
            slowRows = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:13px">暂无慢请求 (>500ms)</div>';
        } else {
            slowRows = '<table style="width:100%;border-collapse:collapse">' +
                '<thead><tr style="background:rgba(255,255,255,0.04)"><th style="padding:7px 10px;text-align:left;font-size:12px;color:#9ca3af">资源</th><th style="padding:7px 10px;text-align:left;font-size:12px;color:#9ca3af">类型</th><th style="padding:7px 10px;text-align:left;font-size:12px;color:#9ca3af">耗时</th><th style="padding:7px 10px;text-align:left;font-size:12px;color:#9ca3af">大小</th></tr></thead><tbody>';
            slow.forEach(r => {
                const name = r.name ? r.name.split('/').pop().split('?')[0].substring(0, 40) : '(unknown)';
                slowRows += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:7px 10px;font-size:12px;color:#cbd5e1;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</td><td style="padding:7px 10px;font-size:12px;color:#9ca3af">' + esc(r.initiatorType || '-') + '</td><td style="padding:7px 10px;font-size:12px;color:#fbbf24">' + r.duration.toFixed(0) + ' ms</td><td style="padding:7px 10px;font-size:12px;color:#9ca3af">' + formatBytes(r.transferSize || r.encodedBodySize || 0) + '</td></tr>';
            });
            slowRows += '</tbody></table>';
        }
        bodyEl.innerHTML =
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
                '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px 16px;flex:1;min-width:140px">' +
                    '<div style="font-size:11px;color:#9ca3af">总网络流量</div>' +
                    '<div style="font-size:20px;color:#fff;font-weight:600;margin-top:2px">' + formatBytes(totalBytes) + '</div>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px 16px;flex:1;min-width:140px">' +
                    '<div style="font-size:11px;color:#9ca3af">请求总数</div>' +
                    '<div style="font-size:20px;color:#fff;font-weight:600;margin-top:2px">' + reqCount + '</div>' +
                '</div>' +
                '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px 16px;flex:1;min-width:140px">' +
                    '<div style="font-size:11px;color:#9ca3af">慢请求 (>500ms)</div>' +
                    '<div style="font-size:20px;color:#fff;font-weight:600;margin-top:2px">' + slow.length + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.04);border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06)">' +
                '<div style="padding:10px 12px;font-size:13px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.06)">慢请求列表</div>' +
                slowRows +
            '</div>';
    }

    function refreshActive() {
        if (!contentEl.isConnected) return;
        if (activeTab === 'process') renderProcess();
        else if (activeTab === 'net') renderNet();
        else if (activeTab === 'perf') drawPerfCharts();
        statusEl.textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function drawPerfCharts() {
        const c1 = bodyEl.querySelector('.tmp-cpu');
        const c2 = bodyEl.querySelector('.tmp-mem');
        const c3 = bodyEl.querySelector('.tmp-fps');
        const color = getAccentColor();
        if (c1) drawChart(c1, cpuHistory, color, 'CPU', '%', 100);
        if (c2) drawChart(c2, memHistory, color, '内存', ' MB');
        if (c3) drawChart(c3, fpsHistory, color, 'FPS', '', 120);
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
        fpsHistory.push(Math.max(0, fpsVal));
        while (cpuHistory.length > MAX_SAMPLES) cpuHistory.shift();
        while (memHistory.length > MAX_SAMPLES) memHistory.shift();
        while (fpsHistory.length > MAX_SAMPLES) fpsHistory.shift();
        longTaskMsThisSec = 0;
    }

    tabsEl.querySelectorAll('.tmp-tab').forEach(t => {
        t.onclick = () => {
            activeTab = t.dataset.tab;
            setTabStyle();
            if (activeTab === 'process') renderProcess();
            else if (activeTab === 'net') renderNet();
            else if (activeTab === 'perf') { renderPerf(); drawPerfCharts(); }
        };
    });

    function onResize() { if (activeTab === 'perf') drawPerfCharts(); }
    contentEl.addEventListener('windowResize', onResize);
    contentEl.addEventListener('windowResizeEnd', onResize);

    setTabStyle();
    renderProcess();

    const intervalId = setInterval(() => {
        if (!contentEl.isConnected) { clearInterval(intervalId); return; }
        samplePerformance();
        refreshActive();
    }, 1000);
    samplePerformance();

    refreshActive();
});

window.MXOS = window.MXOS || {};
window.MXOS.core = window.MXOS.core || {};
window.MXOS.core.closeWindow = closeWindow;
window.MXOS.core.openApp = openApp;
