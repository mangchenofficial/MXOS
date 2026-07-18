window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

const SCRIPT_LOAD_TIME = performance.now ? performance.now() : Date.now();

const bootTrace = {
    scriptLoadAt: SCRIPT_LOAD_TIME,
    desktopReadyAt: null,
    totalBootMs: null
};

const windowOpenTimes = new Map();
const windowOpenRecords = [];

const FPS_WINDOW = 60;
const fpsSamples = [];
let fpsFrameCount = 0;
let fpsLastSample = performance.now();
let fpsRafId = null;

const MEMORY_WINDOW = 60;
const memorySamples = [];
let memoryIntervalId = null;

function markDesktopReady() {
    if (bootTrace.desktopReadyAt !== null) return;
    bootTrace.desktopReadyAt = performance.now ? performance.now() : Date.now();
    bootTrace.totalBootMs = Math.round(bootTrace.desktopReadyAt - bootTrace.scriptLoadAt);
    try {
        localStorage.setItem('mxos_boot_time_ms', String(bootTrace.totalBootMs));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('mxos:boot-ready', { detail: bootTrace }));
}

function startFpsSampling() {
    if (fpsRafId !== null) return;
    const tick = (now) => {
        fpsFrameCount++;
        if (now - fpsLastSample >= 1000) {
            const fps = Math.round((fpsFrameCount * 1000) / (now - fpsLastSample));
            fpsSamples.push({ t: Date.now(), fps });
            if (fpsSamples.length > FPS_WINDOW) fpsSamples.shift();
            fpsFrameCount = 0;
            fpsLastSample = now;
        }
        fpsRafId = requestAnimationFrame(tick);
    };
    fpsLastSample = performance.now();
    fpsRafId = requestAnimationFrame(tick);
}

function stopFpsSampling() {
    if (fpsRafId !== null) {
        cancelAnimationFrame(fpsRafId);
        fpsRafId = null;
    }
}

function sampleMemory() {
    const sample = { t: Date.now() };
    if (performance.memory) {
        sample.usedJSHeap = performance.memory.usedJSHeapSize;
        sample.totalJSHeap = performance.memory.totalJSHeapSize;
        sample.jsHeapLimit = performance.memory.jsHeapSizeLimit;
    } else if (navigator.deviceMemory) {
        sample.deviceMemory = navigator.deviceMemory;
    }
    memorySamples.push(sample);
    if (memorySamples.length > MEMORY_WINDOW) memorySamples.shift();
}

function startMemorySampling() {
    if (memoryIntervalId !== null) return;
    sampleMemory();
    memoryIntervalId = setInterval(sampleMemory, 60000);
}

function stopMemorySampling() {
    if (memoryIntervalId !== null) {
        clearInterval(memoryIntervalId);
        memoryIntervalId = null;
    }
}

function recordWindowOpen(appId, windowEl) {
    if (!windowEl) return;
    const start = performance.now();
    windowOpenTimes.set(windowEl, { appId, start });
    const check = () => {
        if (!windowEl.classList.contains('animating-open')) {
            const duration = Math.round(performance.now() - start);
            const rec = { appId, duration, timestamp: Date.now() };
            windowOpenRecords.push(rec);
            if (windowOpenRecords.length > 100) windowOpenRecords.shift();
            windowOpenTimes.delete(windowEl);
        } else {
            setTimeout(check, 30);
        }
    };
    setTimeout(check, 30);
}

function setupWindowObserver() {
    try {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('window') && node.classList.contains('animating-open')) {
                        const titleEl = node.querySelector('.window-title span');
                        if (titleEl) {
                            recordWindowOpen(titleEl.textContent, node);
                        }
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: false });
    } catch (e) {}
}

setupWindowObserver();

function getDashboard() {
    const realPerf = window.MXOS.Real && window.MXOS.Real.perf ? window.MXOS.Real.perf.getSnapshot() : null;
    return {
        boot: bootTrace,
        fps: {
            current: fpsSamples.length ? fpsSamples[fpsSamples.length - 1].fps : null,
            samples: fpsSamples.slice()
        },
        memory: {
            samples: memorySamples.slice()
        },
        windowOpen: windowOpenRecords.slice(),
        realPerf: realPerf,
        timestamp: Date.now()
    };
}

function exportJSON() {
    const data = getDashboard();
    const json = JSON.stringify(data, null, 2);
    try {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mxos-perf-trace-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        return false;
    }
}

function openDashboard() {
    if (window.MXOS && window.MXOS.openApp) {
        try { window.MXOS.openApp('task-manager-pro'); return true; } catch (e) {}
    }
    const data = getDashboard();
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        window.MXOS.notify({
            title: '性能仪表盘',
            body: `开机 ${bootTrace.totalBootMs || 'N/A'}ms | FPS ${data.fps.current || 'N/A'} | 内存样本 ${data.memory.samples.length}`,
            type: 'info',
            duration: 5000
        });
    }
    return data;
}

function init() {
    startFpsSampling();
    startMemorySampling();
    const ready = () => {
        if (document.querySelector('#desktop') && document.querySelector('#taskbar')) {
            markDesktopReady();
        } else {
            setTimeout(ready, 200);
        }
    };
    setTimeout(ready, 300);
    window.addEventListener('mxos:desktop-ready', markDesktopReady);
    if (document.readyState === 'complete') {
        setTimeout(markDesktopReady, 500);
    } else {
        window.addEventListener('load', () => setTimeout(markDesktopReady, 500));
    }
}

const perfTrace = {
    markDesktopReady,
    recordWindowOpen,
    startFpsSampling,
    stopFpsSampling,
    startMemorySampling,
    stopMemorySampling,
    getDashboard,
    openDashboard,
    exportJSON,
    bootTrace,
    init
};

window.MXOS.System.perfTrace = perfTrace;

init();

export { perfTrace };
