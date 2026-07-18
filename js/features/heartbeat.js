window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const SAMPLE_LIMIT = 60;
const CPU_SAMPLE_INTERVAL = 2000;

let trayEl = null;
let panelEl = null;
let panelCanvas = null;
let panelCtx = null;
let rafId = null;
let currentBpm = 60;
let currentCpu = 0;
let cpuSamples = [];
let ecgSamples = [];
let lastCpuSampleTime = 0;
let beatPhase = 0;

function cpuToBpm(cpu) {
    if (cpu < 30) return 60;
    if (cpu < 60) return 80;
    if (cpu < 80) return 100;
    return 120;
}

function injectStyles() {
    if (document.getElementById('mxos-heartbeat-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-heartbeat-styles';
    style.textContent = `
.mxos-heartbeat-tray {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0 8px;
    height: 28px;
    color: var(--text-primary, #e5e7eb);
    cursor: pointer;
    border-radius: 6px;
    transition: background 150ms ease;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
}
.mxos-heartbeat-tray:hover { background: rgba(255,255,255,0.08); }
.mxos-heartbeat-icon { width: 22px; height: 18px; display: flex; align-items: center; }
.mxos-heartbeat-icon svg { width: 22px; height: 22px; color: #ef4444; }
.mxos-heartbeat-tray.beat .mxos-heartbeat-icon svg { animation: heartBeat var(--beat-dur, 1s) ease-in-out infinite; }
@keyframes heartBeat {
    0%, 100% { transform: scale(1); }
    14% { transform: scale(1.25); }
    28% { transform: scale(1); }
    42% { transform: scale(1.18); }
    70% { transform: scale(1); }
}
.mxos-heartbeat-bpm { color: #fca5a5; font-weight: 600; }
#mxosHeartbeatPanel {
    position: fixed;
    bottom: 56px;
    right: 12px;
    z-index: 3500;
    width: 320px;
    background: rgba(20,22,28,0.78);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.5);
    color: #e5e7eb;
    overflow: hidden;
    transform: translateY(12px) scale(0.96);
    opacity: 0;
    pointer-events: none;
    transition: transform 220ms var(--ease-out, ease), opacity 200ms ease;
}
#mxosHeartbeatPanel.show { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
.mxos-hp-head { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
.mxos-hp-title { font-size: 13px; color: #9ca3af; }
.mxos-hp-bpm-big { font-size: 24px; color: #fff; font-weight: 700; }
.mxos-hp-bpm-big span { font-size: 12px; color: #9ca3af; font-weight: 400; margin-left: 4px; }
.mxos-hp-chart { padding: 12px 16px; }
.mxos-hp-chart-title { font-size: 11px; color: #9ca3af; margin-bottom: 6px; }
.mxos-hp-canvas { width: 100%; height: 80px; display: block; background: rgba(255,255,255,0.03); border-radius: 6px; }
.mxos-hp-cpu { padding: 8px 16px 14px; }
.mxos-hp-cpu-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
.mxos-hp-cpu-row span { color: #9ca3af; }
.mxos-hp-cpu-row b { color: #e5e7eb; font-weight: 500; }
body.reduce-motion .mxos-heartbeat-tray.beat .mxos-heartbeat-icon svg,
body.reduce-motion #mxosHeartbeatPanel { animation: none !important; transition: none !important; }
    `;
    document.head.appendChild(style);
}

function buildTray() {
    if (trayEl) return;
    const trayRight = document.querySelector('.taskbar-right');
    if (!trayRight) return;
    trayEl = document.createElement('div');
    trayEl.className = 'mxos-heartbeat-tray beat';
    trayEl.setAttribute('role', 'button');
    trayEl.setAttribute('tabindex', '0');
    trayEl.setAttribute('aria-label', '系统心率');
    trayEl.innerHTML = `
        <span class="mxos-heartbeat-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9-9.5C1.5 7 4 4 7 4c2 0 3.5 1.5 5 3 1.5-1.5 3-3 5-3 3 0 5.5 3 4 7.5-2 5-9 9.5-9 9.5z"/></svg></span>
        <span class="mxos-heartbeat-bpm">60</span>
    `;
    trayEl.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
    });
    trayRight.insertBefore(trayEl, trayRight.firstChild);
}

function updateTray() {
    if (!trayEl) return;
    const bpmEl = trayEl.querySelector('.mxos-heartbeat-bpm');
    if (bpmEl) bpmEl.textContent = currentBpm;
    const beatDur = (60 / currentBpm).toFixed(3) + 's';
    trayEl.style.setProperty('--beat-dur', beatDur);
    trayEl.setAttribute('aria-label', `系统心率 ${currentBpm} BPM，CPU ${Math.round(currentCpu)}%`);
}

function getCpuUsage() {
    try {
        if (window.MXOS && window.MXOS.Real && window.MXOS.Real.perfMonitor && typeof window.MXOS.Real.perfMonitor.getCpuUsage === 'function') {
            const v = window.MXOS.Real.perfMonitor.getCpuUsage();
            if (typeof v === 'number') return v;
        }
        if (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.perf === 'function') {
            const snap = window.MXOS.Real.perf();
            if (snap && typeof snap.cpuUsage === 'number') return snap.cpuUsage;
        }
    } catch (e) {}
    return estimateCpuFromFrame();
}

let frameTimes = [];
let lastFrameStamp = 0;
function estimateCpuFromFrame() {
    if (frameTimes.length < 5) return 0;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const busy = Math.min(100, Math.max(0, (avg - 8) / 25 * 100));
    return busy;
}

function sampleCpu() {
    const now = performance.now();
    if (lastCpuSampleTime) {
        const dt = now - lastCpuSampleTime;
        frameTimes.push(dt);
        if (frameTimes.length > 20) frameTimes.shift();
    }
    lastCpuSampleTime = now;
    const cpu = getCpuUsage();
    currentCpu = cpu || 0;
    cpuSamples.push(currentCpu);
    if (cpuSamples.length > SAMPLE_LIMIT) cpuSamples.shift();
    const newBpm = cpuToBpm(currentCpu);
    if (newBpm !== currentBpm) {
        currentBpm = newBpm;
        updateTray();
        if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
            window.MXOS.events.emit('mxos:heartbeat-change', { bpm: currentBpm, cpu: currentCpu });
        }
    }
}

function ecgValue(phase) {
    const p = phase % 1;
    if (p < 0.05) return 0;
    if (p < 0.1) return Math.sin((p - 0.05) / 0.05 * Math.PI) * 0.15;
    if (p < 0.15) return 0;
    if (p < 0.17) return -0.25;
    if (p < 0.2) return 1.0;
    if (p < 0.22) return -0.4;
    if (p < 0.25) return 0;
    if (p < 0.4) return Math.sin((p - 0.25) / 0.15 * Math.PI) * 0.3;
    return 0;
}

function frame(ts) {
    if (!lastFrameStamp) lastFrameStamp = ts;
    lastFrameStamp = ts;
    const beatDur = 60 / currentBpm;
    beatPhase += 1 / 60 / beatDur;
    if (beatPhase > 1) beatPhase -= 1;
    ecgSamples.push(ecgValue(beatPhase));
    if (ecgSamples.length > SAMPLE_LIMIT) ecgSamples.shift();
    if (ts - lastCpuSampleTime > CPU_SAMPLE_INTERVAL || lastCpuSampleTime === 0) {
        sampleCpu();
    }
    drawPanelChart();
    rafId = requestAnimationFrame(frame);
}

function drawPanelChart() {
    if (!panelCtx) return;
    const w = panelCanvas.width;
    const h = panelCanvas.height;
    panelCtx.clearRect(0, 0, w, h);

    panelCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    panelCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const y = (h / 4) * i;
        panelCtx.beginPath();
        panelCtx.moveTo(0, y);
        panelCtx.lineTo(w, y);
        panelCtx.stroke();
    }

    if (ecgSamples.length > 1) {
        panelCtx.strokeStyle = '#ef4444';
        panelCtx.lineWidth = 1.6;
        panelCtx.shadowBlur = 6;
        panelCtx.shadowColor = 'rgba(239,68,68,0.6)';
        panelCtx.beginPath();
        const stepX = w / (SAMPLE_LIMIT - 1);
        ecgSamples.forEach((v, i) => {
            const x = i * stepX;
            const y = h * 0.5 - v * h * 0.35;
            if (i === 0) panelCtx.moveTo(x, y);
            else panelCtx.lineTo(x, y);
        });
        panelCtx.stroke();
        panelCtx.shadowBlur = 0;
    }

    if (cpuSamples.length > 1 && panelCtx) {
        panelCtx.strokeStyle = '#60a5fa';
        panelCtx.lineWidth = 1.2;
        panelCtx.globalAlpha = 0.7;
        panelCtx.beginPath();
        const stepX = w / (SAMPLE_LIMIT - 1);
        cpuSamples.forEach((v, i) => {
            const x = i * stepX;
            const y = h - (v / 100) * h * 0.9;
            if (i === 0) panelCtx.moveTo(x, y);
            else panelCtx.lineTo(x, y);
        });
        panelCtx.stroke();
        panelCtx.globalAlpha = 1;
    }
}

function buildPanel() {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'mxosHeartbeatPanel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', '系统心率仪表盘');
    panelEl.innerHTML = `
        <div class="mxos-hp-head">
            <div>
                <div class="mxos-hp-title">系统心率</div>
                <div class="mxos-hp-bpm-big" id="mxosHpBpm">60<span>BPM</span></div>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9-9.5C1.5 7 4 4 7 4c2 0 3.5 1.5 5 3 1.5-1.5 3-3 5-3 3 0 5.5 3 4 7.5-2 5-9 9.5-9 9.5z"/></svg>
        </div>
        <div class="mxos-hp-chart">
            <div class="mxos-hp-chart-title">实时心率波形（红）/ CPU 曲线（蓝）</div>
            <canvas class="mxos-hp-canvas" id="mxosHpCanvas"></canvas>
        </div>
        <div class="mxos-hp-cpu">
            <div class="mxos-hp-cpu-row"><span>当前 CPU 占用</span><b id="mxosHpCpu">0%</b></div>
            <div class="mxos-hp-cpu-row"><span>对应心率区间</span><b id="mxosHpZone">平静 (60 BPM)</b></div>
        </div>
    `;
    document.body.appendChild(panelEl);
    panelCanvas = panelEl.querySelector('#mxosHpCanvas');
    panelCtx = panelCanvas.getContext('2d');
    resizeCanvas();
    document.addEventListener('click', (e) => {
        if (!panelEl.classList.contains('show')) return;
        if (e.target.closest('#mxosHeartbeatPanel')) return;
        if (e.target.closest('.mxos-heartbeat-tray')) return;
        panelEl.classList.remove('show');
    });
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (!panelCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = panelCanvas.getBoundingClientRect();
    panelCanvas.width = Math.round(rect.width * dpr);
    panelCanvas.height = Math.round(rect.height * dpr);
    panelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    panelCanvas.width = panelCanvas.width;
    panelCanvas.height = panelCanvas.height;
    panelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getZone(bpm) {
    if (bpm <= 60) return '平静 (60 BPM)';
    if (bpm <= 80) return '正常 (80 BPM)';
    if (bpm <= 100) return '繁忙 (100 BPM)';
    return '紧张 (120 BPM)';
}

function refreshPanel() {
    if (!panelEl) return;
    const bpmEl = panelEl.querySelector('#mxosHpBpm');
    if (bpmEl) bpmEl.innerHTML = `${currentBpm}<span>BPM</span>`;
    const cpuEl = panelEl.querySelector('#mxosHpCpu');
    if (cpuEl) cpuEl.textContent = Math.round(currentCpu) + '%';
    const zoneEl = panelEl.querySelector('#mxosHpZone');
    if (zoneEl) zoneEl.textContent = getZone(currentBpm);
}

function togglePanel() {
    if (!panelEl) buildPanel();
    panelEl.classList.toggle('show');
    if (panelEl.classList.contains('show')) {
        resizeCanvas();
        refreshPanel();
    }
}

function getNow() {
    return { bpm: currentBpm, cpu: currentCpu, zone: getZone(currentBpm) };
}

let panelRefreshTimer = null;

function waitForTaskbar(callback) {
    const tray = document.querySelector('.taskbar-right');
    if (tray) { callback(); return; }
    const observer = new MutationObserver(() => {
        if (document.querySelector('.taskbar-right')) {
            observer.disconnect();
            callback();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
}

function init() {
    injectStyles();
    waitForTaskbar(() => { buildTray(); updateTray(); });
    window.MXOS.Features.heartbeat = {
        getNow,
        getCpuUsage,
        getCpuToBpm: cpuToBpm,
        togglePanel
    };
    rafId = requestAnimationFrame(frame);
    panelRefreshTimer = setInterval(() => {
        if (panelEl && panelEl.classList.contains('show')) refreshPanel();
    }, 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getNow, getCpuUsage };
