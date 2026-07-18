window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

const REQUIRED_NAMESPACES = [
    'dialog', 'openApp', 'closeApp', 'listApps', 'window', 'fs', 'FS',
    'clipboard', 'storage', 'theme', 'events', 'system', 'shortcut',
    'eventBus', 'notify', 'state', 'anim', 'AnimLevel',
    'i18n', 'AI', 'Sandbox'
];

const REQUIRED_REAL = ['perf', 'battery', 'hardware', 'sensors', 'mediaDevices', 'weather', 'location'];
const REQUIRED_SYSTEM = ['smokeTest', 'perfTrace', 'crashReporter', 'incognito', 'dataExport', 'dataErase', 'offlineMode', 'weakNetwork', 'update', 'backup', 'health', 'integrationCheck'];

const REQUIRED_DOM = [
    'brightness-overlay', 'mxos-status-bar-container', 'lock-screen',
    'wallpaper-bg', 'desktop', 'taskbar', 'startMenu', 'contextMenu'
];

function checkNamespaces() {
    const results = [];
    const mxos = window.MXOS || {};
    REQUIRED_NAMESPACES.forEach(key => {
        const has = key in mxos;
        results.push({ key, ok: has, type: 'namespace' });
    });
    return results;
}

function checkReal() {
    const results = [];
    const real = (window.MXOS && window.MXOS.Real) || {};
    REQUIRED_REAL.forEach(key => {
        const has = key in real;
        results.push({ key: 'Real.' + key, ok: has, type: 'real' });
    });
    return results;
}

function checkSystem() {
    const results = [];
    const sys = (window.MXOS && window.MXOS.System) || {};
    REQUIRED_SYSTEM.forEach(key => {
        const has = key in sys;
        results.push({ key: 'System.' + key, ok: has, type: 'system' });
    });
    return results;
}

function checkDom() {
    const results = [];
    REQUIRED_DOM.forEach(id => {
        const el = document.getElementById(id);
        results.push({ key: '#' + id, ok: !!el, type: 'dom' });
    });
    return results;
}

function checkAnimLevel() {
    const results = [];
    const body = document.body;
    const hasAttr = body && body.hasAttribute('data-anim-level');
    results.push({ key: 'body[data-anim-level]', ok: !!hasAttr, type: 'anim' });
    const al = window.MXOS && window.MXOS.AnimLevel;
    results.push({ key: 'AnimLevel.set', ok: !!(al && typeof al.set === 'function'), type: 'anim' });
    results.push({ key: 'AnimLevel.get', ok: !!(al && typeof al.get === 'function'), type: 'anim' });
    return results;
}

function integrationCheck(opts) {
    const verbose = !opts || opts.verbose !== false;
    const checks = []
        .concat(checkNamespaces())
        .concat(checkReal())
        .concat(checkSystem())
        .concat(checkDom())
        .concat(checkAnimLevel());

    const passed = checks.filter(c => c.ok).length;
    const failed = checks.filter(c => !c.ok).length;
    const total = checks.length;
    const allOk = failed === 0;

    const report = {
        timestamp: Date.now(),
        ok: allOk,
        summary: {
            total,
            passed,
            failed,
            passRate: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0
        },
        checks,
        details: {
            userAgent: navigator.userAgent,
            online: navigator.onLine,
            animLevel: (window.MXOS && window.MXOS.AnimLevel && typeof window.MXOS.AnimLevel.get === 'function') ? window.MXOS.AnimLevel.get() : (document.body && document.body.getAttribute('data-anim-level')),
            reducedMotion: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
            deviceMemory: navigator.deviceMemory || null,
            hardwareConcurrency: navigator.hardwareConcurrency || null
        }
    };

    if (verbose) {
        const style = (s) => s;
        console.group('%c[MXOS 集成验证]', style('color:#60a5fa;font-weight:bold;'));
        console.log('结果: ' + (allOk ? '%c通过' : '%c失败'), style(allOk ? 'color:#22c55e;font-weight:bold;' : 'color:#ef4444;font-weight:bold;'));
        console.log('通过 ' + passed + '/' + total + ' (' + report.summary.passRate + '%)');
        if (failed > 0) {
            console.group('失败项:');
            checks.filter(c => !c.ok).forEach(c => {
                console.warn('  [' + c.type + '] ' + c.key);
            });
            console.groupEnd();
        }
        console.log('详情:', report.details);
        console.groupEnd();
    }

    return report;
}

window.MXOS.System.integrationCheck = integrationCheck;

export { integrationCheck };
