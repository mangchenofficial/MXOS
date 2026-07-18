import { eventBus } from '../utils/event-bus.js';

window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};
window.MXOS.Health = window.MXOS.Health || {};

function getPerf() {
    if (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.perf === 'function') {
        try { return window.MXOS.Real.perf(); } catch (e) { return null; }
    }
    return null;
}

function getHardware() {
    if (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.hardware === 'function') {
        try { return window.MXOS.Real.hardware(); } catch (e) { return null; }
    }
    return null;
}

function getBootMs() {
    try {
        if (window.MXOS && window.MXOS.System && window.MXOS.System.perfTrace) {
            const ms = window.MXOS.System.perfTrace.bootTrace.totalBootMs;
            if (typeof ms === 'number') return ms;
        }
        const v = localStorage.getItem('mxos_boot_time_ms');
        if (v) return parseInt(v, 10);
    } catch (e) {}
    return null;
}

function getCrashCount() {
    try {
        if (window.MXOS && window.MXOS.System && window.MXOS.System.crashReporter) {
            const reports = window.MXOS.System.crashReporter.getAllReports();
            if (Array.isArray(reports)) return reports.length;
        }
    } catch (e) {}
    return 0;
}

function getStorageUsage() {
    try {
        const nav = navigator;
        if (nav && nav.storage && nav.storage.estimate) {
            return nav.storage.estimate();
        }
    } catch (e) {}
    return Promise.resolve(null);
}

function clampScore(v) {
    if (!isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 100) return 100;
    return Math.round(v);
}

function scoreFromFps(fps) {
    if (fps == null) return 70;
    if (fps >= 55) return 100;
    if (fps >= 45) return 90;
    if (fps >= 30) return 75;
    if (fps >= 20) return 55;
    if (fps >= 10) return 30;
    return 10;
}

function scoreFromMemory(perfMem, hwMem) {
    if (!perfMem || !perfMem.supported || !perfMem.jsHeapSizeLimit) return 70;
    const used = perfMem.usedJSHeapSize || 0;
    const limit = perfMem.jsHeapSizeLimit || 1;
    const ratio = used / limit;
    if (ratio < 0.3) return 100;
    if (ratio < 0.5) return 90;
    if (ratio < 0.7) return 75;
    if (ratio < 0.85) return 55;
    return 30;
}

function scoreFromBoot(bootMs) {
    if (bootMs == null) return 70;
    if (bootMs < 800) return 100;
    if (bootMs < 1500) return 92;
    if (bootMs < 2500) return 82;
    if (bootMs < 4000) return 70;
    if (bootMs < 7000) return 55;
    return 35;
}

function scoreFromCpu(perf) {
    if (!perf || !perf.longTasks) return 70;
    const recent = perf.longTasks.recent || [];
    if (recent.length === 0) return 95;
    const totalMs = recent.reduce((s, t) => s + (t.duration || 0), 0);
    if (totalMs < 100) return 90;
    if (totalMs < 500) return 78;
    if (totalMs < 1500) return 62;
    if (totalMs < 3000) return 45;
    return 25;
}

function scoreFromStorage(est) {
    if (!est || !est.quota) return 75;
    const used = est.usage || 0;
    const quota = est.quota || 1;
    const ratio = used / quota;
    if (ratio < 0.3) return 100;
    if (ratio < 0.5) return 90;
    if (ratio < 0.7) return 78;
    if (ratio < 0.85) return 60;
    if (ratio < 0.95) return 35;
    return 15;
}

function scoreFromCrashes(count) {
    if (!count || count === 0) return 100;
    if (count === 1) return 85;
    if (count <= 3) return 70;
    if (count <= 6) return 50;
    return 25;
}

const WEIGHTS = {
    cpu: 0.18,
    memory: 0.18,
    storage: 0.18,
    boot: 0.16,
    crashes: 0.12,
    fps: 0.18
};

async function compute() {
    const perf = getPerf();
    const hw = getHardware();
    const bootMs = getBootMs();
    const crashCount = getCrashCount();
    let storageEst = null;
    try { storageEst = await getStorageUsage(); } catch (e) {}

    const fpsScore = scoreFromFps(perf ? perf.fps : null);
    const memScore = scoreFromMemory(perf ? perf.memory : null, hw ? hw.deviceMemoryGB : null);
    const bootScore = scoreFromBoot(bootMs);
    const cpuScore = scoreFromCpu(perf);
    const storageScore = scoreFromStorage(storageEst);
    const crashScore = scoreFromCrashes(crashCount);

    const total =
        cpuScore * WEIGHTS.cpu +
        memScore * WEIGHTS.memory +
        storageScore * WEIGHTS.storage +
        bootScore * WEIGHTS.boot +
        crashScore * WEIGHTS.crashes +
        fpsScore * WEIGHTS.fps;

    const overall = clampScore(total);

    return {
        overall,
        dimensions: {
            cpu: { score: cpuScore, label: 'CPU 使用率', detail: perf && perf.longTasks ? (perf.longTasks.totalDuration + 'ms 长任务') : '暂无数据' },
            memory: { score: memScore, label: '内存占用', detail: perf && perf.memory && perf.memory.supported ? Math.round((perf.memory.usedJSHeapSize || 0) / 1024 / 1024) + 'MB / ' + Math.round((perf.memory.jsHeapSizeLimit || 0) / 1024 / 1024) + 'MB' : '不可用' },
            storage: { score: storageScore, label: '存储空间', detail: storageEst ? (Math.round((storageEst.usage || 0) / 1024 / 1024) + 'MB / ' + Math.round((storageEst.quota || 0) / 1024 / 1024) + 'MB') : '不可用' },
            boot: { score: bootScore, label: '启动速度', detail: bootMs != null ? bootMs + 'ms' : '未测量' },
            crashes: { score: crashScore, label: '崩溃次数', detail: crashCount + ' 次' },
            fps: { score: fpsScore, label: 'FPS', detail: perf ? (perf.fps + ' FPS') : '不可用' }
        },
        metrics: {
            fps: perf ? perf.fps : null,
            memory: perf ? perf.memory : null,
            longTasks: perf ? perf.longTasks : null,
            bootMs,
            crashCount,
            storageEst,
            hardware: hw
        },
        timestamp: Date.now()
    };
}

async function score() {
    const r = await compute();
    return r.overall;
}

async function getDetails() {
    return await compute();
}

function buildSuggestions(details) {
    const list = [];
    const dims = details.dimensions;
    if (dims.fps.score < 70) {
        list.push({
            title: '关闭部分动画效果',
            desc: '当前帧率较低，可在"设置 > 辅助功能 > 减少动画"中关闭动画',
            priority: 'high',
            action: { type: 'open-settings', page: 'accessibility' }
        });
    }
    if (dims.memory.score < 70) {
        list.push({
            title: '关闭未使用的应用窗口',
            desc: '当前 JS 堆内存占用偏高，关闭后台窗口可释放内存',
            priority: 'high',
            action: { type: 'open-app', app: 'task-manager-pro' }
        });
    }
    if (dims.cpu.score < 70) {
        list.push({
            title: 'CPU 长任务较多',
            desc: '尝试关闭占用 CPU 较高的第三方应用',
            priority: 'medium',
            action: { type: 'open-app', app: 'task-manager-pro' }
        });
    }
    if (dims.storage.score < 70) {
        list.push({
            title: '清理存储空间',
            desc: '本地存储占用较高，建议清理回收站或导出/备份数据',
            priority: 'high',
            action: { type: 'open-app', app: 'recycle-bin' }
        });
    }
    if (dims.crashes.score < 70) {
        list.push({
            title: '检查崩溃报告',
            desc: '系统近期存在崩溃记录，请查看崩溃详情',
            priority: 'medium',
            action: { type: 'open-settings', page: 'system-tools' }
        });
    }
    if (dims.boot.score < 70) {
        list.push({
            title: '开机耗时偏长',
            desc: '可关闭启动时自动运行的应用以加快启动',
            priority: 'low'
        });
    }
    if (list.length === 0) {
        list.push({
            title: '系统运行良好',
            desc: '所有维度均处于良好水平，请继续保持',
            priority: 'info'
        });
    }
    return list;
}

async function getSuggestions() {
    const details = await getDetails();
    return buildSuggestions(details);
}

function levelLabel(score) {
    if (score >= 90) return { text: '优秀', color: '#10b981' };
    if (score >= 75) return { text: '良好', color: '#3b82f6' };
    if (score >= 60) return { text: '一般', color: '#fbbf24' };
    if (score >= 40) return { text: '较差', color: '#f97316' };
    return { text: '危险', color: '#ef4444' };
}

function renderGauge(container, score) {
    if (!container) return;
    const level = levelLabel(score);
    const size = 140;
    const stroke = 12;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - score / 100);
    container.innerHTML = `
        <div style="position:relative;display:inline-block;width:${size}px;height:${size}px">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}"/>
                <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${level.color}" stroke-width="${stroke}"
                    stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                    transform="rotate(-90 ${size/2} ${size/2})" style="transition:stroke-dashoffset 0.6s ease"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
                <div style="font-size:32px;font-weight:700;color:${level.color}">${score}</div>
                <div style="font-size:12px;color:var(--text-secondary,#9ca3af);margin-top:2px">${level.text}</div>
            </div>
        </div>
    `;
}

function renderDashboard(container) {
    if (!container) return null;
    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px">
            <div style="display:flex;align-items:center;gap:24px">
                <div id="mxos-health-gauge"></div>
                <div id="mxos-health-dims" style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px"></div>
            </div>
            <div id="mxos-health-suggestions" style="display:flex;flex-direction:column;gap:8px"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px">
                <button id="mxos-health-refresh" style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">刷新</button>
            </div>
        </div>
    `;
    return refreshDashboard(container);
}

async function refreshDashboard(container) {
    if (!container) return;
    const details = await getDetails();
    const gauge = container.querySelector('#mxos-health-gauge');
    if (gauge) renderGauge(gauge, details.overall);
    const dimsEl = container.querySelector('#mxos-health-dims');
    if (dimsEl) {
        const items = Object.keys(details.dimensions).map(key => {
            const d = details.dimensions[key];
            const lv = levelLabel(d.score);
            return `<div style="background:rgba(255,255,255,0.04);border:1px solid var(--glass-border,rgba(255,255,255,0.08));border-radius:10px;padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:12px;color:var(--text-secondary,#9ca3af)">${d.label}</span>
                    <span style="font-size:14px;font-weight:600;color:${lv.color}">${d.score}</span>
                </div>
                <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${d.score}%;background:${lv.color};border-radius:3px;transition:width 0.5s ease"></div>
                </div>
                <div style="font-size:11px;color:var(--text-secondary,#9ca3af);margin-top:4px">${d.detail}</div>
            </div>`;
        }).join('');
        dimsEl.innerHTML = items;
    }
    const sugEl = container.querySelector('#mxos-health-suggestions');
    if (sugEl) {
        const sugs = buildSuggestions(details);
        sugEl.innerHTML = sugs.map(s => {
            const colorMap = { high: '#ef4444', medium: '#fbbf24', low: '#3b82f6', info: '#10b981' };
            const color = colorMap[s.priority] || '#9ca3af';
            return `<div style="background:rgba(255,255,255,0.03);border-left:3px solid ${color};border-radius:6px;padding:10px 12px">
                <div style="font-size:13px;font-weight:600;color:var(--text-color,#fff)">${s.title}</div>
                <div style="font-size:12px;color:var(--text-secondary,#9ca3af);margin-top:2px">${s.desc}</div>
            </div>`;
        }).join('');
    }
}

const Health = {
    score,
    getDetails,
    getSuggestions,
    renderDashboard,
    renderGauge,
    levelLabel
};

window.MXOS.Health = Health;
window.MXOS.System.health = Health;

export { score, getDetails, getSuggestions, renderDashboard, renderGauge };
export default Health;
