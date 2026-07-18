window.MXOS = window.MXOS || {};
window.MXOS.Real = window.MXOS.Real || {};

let running = false;
let rafId = null;
let frames = 0;
let lastSecond = 0;
let fps = 0;
let fpsMin = Infinity;
let fpsMax = 0;
let fpsSamples = 0;
let fpsSum = 0;
let lastFrameTime = 0;
let frameJitterSum = 0;
let frameJitterCount = 0;

let longTaskObserver = null;
let resourceObserver = null;

const longTasks = [];
const resources = [];
const MAX_LONG_TASKS = 100;
const MAX_RESOURCES = 200;

const resourceSummary = {
    total: 0,
    totalDuration: 0,
    totalTransferSize: 0,
    byType: {}
};

function resetCounters() {
    frames = 0;
    lastSecond = performance.now();
    fps = 0;
    fpsMin = Infinity;
    fpsMax = 0;
    fpsSamples = 0;
    fpsSum = 0;
    lastFrameTime = 0;
    frameJitterSum = 0;
    frameJitterCount = 0;
}

function rafLoop(now) {
    if (!running) return;
    frames++;
    if (lastFrameTime) {
        const delta = now - lastFrameTime;
        if (delta >= 0) {
            frameJitterSum += delta;
            frameJitterCount++;
        }
    }
    lastFrameTime = now;
    const elapsed = now - lastSecond;
    if (elapsed >= 1000) {
        fps = Math.round((frames * 1000) / elapsed);
        if (fps < fpsMin) fpsMin = fps;
        if (fps > fpsMax) fpsMax = fps;
        fpsSamples++;
        fpsSum += fps;
        frames = 0;
        lastSecond = now;
    }
    rafId = requestAnimationFrame(rafLoop);
}

function getMemory() {
    try {
        const m = performance.memory;
        if (m) {
            return {
                usedJSHeapSize: m.usedJSHeapSize,
                totalJSHeapSize: m.totalJSHeapSize,
                jsHeapSizeLimit: m.jsHeapSizeLimit,
                supported: true
            };
        }
    } catch (e) {}
    return { supported: false };
}

function setupLongTaskObserver() {
    if (longTaskObserver) return;
    try {
        if (typeof PerformanceObserver === 'undefined') return;
        longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                longTasks.push({
                    name: entry.name,
                    startTime: entry.startTime,
                    duration: entry.duration,
                    entryType: entry.entryType,
                    timestamp: Date.now()
                });
                if (longTasks.length > MAX_LONG_TASKS) longTasks.shift();
            }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {}
}

function setupResourceObserver() {
    if (resourceObserver) return;
    try {
        if (typeof PerformanceObserver === 'undefined') return;
        resourceObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const item = {
                    name: entry.name,
                    initiatorType: entry.initiatorType,
                    startTime: entry.startTime,
                    duration: entry.duration,
                    transferSize: entry.transferSize || 0,
                    encodedBodySize: entry.encodedBodySize || 0,
                    decodedBodySize: entry.decodedBodySize || 0,
                    responseEnd: entry.responseEnd,
                    timestamp: Date.now()
                };
                resources.push(item);
                if (resources.length > MAX_RESOURCES) resources.shift();
                resourceSummary.total++;
                resourceSummary.totalDuration += entry.duration || 0;
                resourceSummary.totalTransferSize += entry.transferSize || 0;
                const t = entry.initiatorType || 'other';
                if (!resourceSummary.byType[t]) {
                    resourceSummary.byType[t] = { count: 0, duration: 0, transferSize: 0 };
                }
                resourceSummary.byType[t].count++;
                resourceSummary.byType[t].duration += entry.duration || 0;
                resourceSummary.byType[t].transferSize += entry.transferSize || 0;
            }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {}
}

function teardownLongTaskObserver() {
    if (longTaskObserver) {
        try { longTaskObserver.disconnect(); } catch (e) {}
        longTaskObserver = null;
    }
}

function teardownResourceObserver() {
    if (resourceObserver) {
        try { resourceObserver.disconnect(); } catch (e) {}
        resourceObserver = null;
    }
}

function start() {
    if (running) return true;
    running = true;
    resetCounters();
    rafId = requestAnimationFrame(rafLoop);
    setupLongTaskObserver();
    setupResourceObserver();
    return true;
}

function stop() {
    running = false;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    teardownLongTaskObserver();
    teardownResourceObserver();
}

function getSnapshot() {
    const avgFrameTime = frameJitterCount > 0 ? (frameJitterSum / frameJitterCount) : 0;
    const avgFps = fpsSamples > 0 ? Math.round(fpsSum / fpsSamples) : fps;
    return {
        running: running,
        fps: fps,
        fpsAvg: avgFps,
        fpsMin: fpsMin === Infinity ? 0 : fpsMin,
        fpsMax: fpsMax,
        frameTimeMs: Math.round(avgFrameTime * 100) / 100,
        memory: getMemory(),
        longTasks: {
            count: longTasks.length,
            totalDuration: Math.round(longTasks.reduce((s, t) => s + t.duration, 0) * 100) / 100,
            recent: longTasks.slice(-10)
        },
        resources: {
            total: resourceSummary.total,
            totalDuration: Math.round(resourceSummary.totalDuration * 100) / 100,
            totalTransferSize: resourceSummary.totalTransferSize,
            byType: resourceSummary.byType,
            recent: resources.slice(-10)
        },
        timestamp: Date.now()
    };
}

function reset() {
    longTasks.length = 0;
    resources.length = 0;
    resourceSummary.total = 0;
    resourceSummary.totalDuration = 0;
    resourceSummary.totalTransferSize = 0;
    resourceSummary.byType = {};
    resetCounters();
}

const perf = () => getSnapshot();
perf.start = start;
perf.stop = stop;
perf.getSnapshot = getSnapshot;
perf.reset = reset;
perf.isRunning = () => running;

window.MXOS.Real.perf = perf;

export { perf };
