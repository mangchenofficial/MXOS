window.MXOS = window.MXOS || {};
window.MXOS.AnimLevel = window.MXOS.AnimLevel || {};

const STORAGE_KEY = 'mxos_anim_level';
const VALID_LEVELS = ['minimal', 'comfort', 'rich', 'extreme'];
const LEVEL_LABELS = {
    minimal: '极简',
    comfort: '适度',
    rich: '丰富',
    extreme: '极致'
};

let userLevel = null;
let autoDowngraded = false;
let fpsWatcherStarted = false;
let batteryWatcherStarted = false;

const DECOR_KEYS = ['crack', 'particles', 'cursor-trail', 'particle-art'];
const DECOR_DEFAULTS = { crack: false, particles: false, 'cursor-trail': false, 'particle-art': false };
const DECOR_STORAGE_KEY = 'mxos_decor_toggles';

function readStored() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v && VALID_LEVELS.indexOf(v) !== -1) return v;
    } catch (e) {}
    return null;
}

function writeStored(level) {
    try { localStorage.setItem(STORAGE_KEY, level); } catch (e) {}
}

function resolveDefault() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return 'minimal';
    }
    const dm = navigator.deviceMemory;
    if (typeof dm === 'number' && dm < 4) {
        return 'minimal';
    }
    return 'minimal';
}

function applyLevel(level) {
    if (VALID_LEVELS.indexOf(level) === -1) return;
    const body = document.body;
    if (!body) return;
    body.setAttribute('data-anim-level', level);
    window.dispatchEvent(new CustomEvent('mxos:anim-level-change', { detail: { level, auto: autoDowngraded } }));
}

function set(level, opts) {
    if (VALID_LEVELS.indexOf(level) === -1) return false;
    const persist = !opts || opts.persist !== false;
    userLevel = level;
    autoDowngraded = false;
    if (persist) writeStored(level);
    applyLevel(level);
    startAutoDowngrade();
    return true;
}

function get() {
    const body = document.body;
    return body ? (body.getAttribute('data-anim-level') || 'comfort') : 'comfort';
}

function getUserLevel() {
    return userLevel || readStored() || resolveDefault();
}

function getLevels() {
    return VALID_LEVELS.map(l => ({ value: l, label: LEVEL_LABELS[l] }));
}

function downgradeTo(target) {
    const order = VALID_LEVELS;
    const current = get();
    if (order.indexOf(target) < order.indexOf(current)) {
        autoDowngraded = true;
        applyLevel(target);
        if (window.MXOS && window.MXOS.dialog && typeof window.MXOS.dialog.toast === 'function') {
            window.MXOS.dialog.toast('动画已自动降级至「' + LEVEL_LABELS[target] + '」', 'info');
        }
        return true;
    }
    return false;
}

function startFpsWatcher() {
    if (fpsWatcherStarted) return;
    if (!window.MXOS || !window.MXOS.Real || typeof window.MXOS.Real.perf !== 'function') return;
    fpsWatcherStarted = true;
    let lowSince = 0;
    let lastCheck = 0;
    const check = () => {
        if (!fpsWatcherStarted) return;
        const now = Date.now();
        if (now - lastCheck < 1000) {
            requestAnimationFrame(check);
            return;
        }
        lastCheck = now;
        try {
            const snap = window.MXOS.Real.perf();
            if (snap && typeof snap.fps === 'number') {
                if (snap.fps < 30) {
                    if (!lowSince) lowSince = now;
                    else if (now - lowSince >= 3000) {
                        const cur = get();
                        if (cur === 'extreme') downgradeTo('rich');
                        else if (cur === 'rich') downgradeTo('comfort');
                        else if (cur === 'comfort') downgradeTo('minimal');
                        lowSince = 0;
                    }
                } else {
                    lowSince = 0;
                }
            }
        } catch (e) {}
        requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
}

function startBatteryWatcher() {
    if (batteryWatcherStarted) return;
    if (!window.MXOS || !window.MXOS.Real || typeof window.MXOS.Real.battery !== 'function') return;
    if (typeof window.MXOS.Real.battery.onChange !== 'function') return;
    batteryWatcherStarted = true;
    window.MXOS.Real.battery.onChange((info) => {
        if (!info) return;
        if (typeof info.level === 'number' && info.level < 20 && !info.charging) {
            downgradeTo('minimal');
        }
    });
}

function startAutoDowngrade() {
    startFpsWatcher();
    startBatteryWatcher();
}

function init() {
    const stored = readStored();
    const initial = stored || resolveDefault();
    userLevel = stored || null;
    applyLevel(initial);
    initDecor();
    startAutoDowngrade();
}

MXOS.AnimLevel.set = set;
MXOS.AnimLevel.get = get;
MXOS.AnimLevel.getUserLevel = getUserLevel;
MXOS.AnimLevel.getLevels = getLevels;
MXOS.AnimLevel.isAutoDowngraded = () => autoDowngraded;
MXOS.AnimLevel.restore = () => {
    autoDowngraded = false;
    const target = userLevel || readStored() || resolveDefault();
    applyLevel(target);
};

function readDecorStored() {
    try {
        const raw = localStorage.getItem(DECOR_STORAGE_KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw);
        return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
}

function writeDecorStored(obj) {
    try { localStorage.setItem(DECOR_STORAGE_KEY, JSON.stringify(obj)); } catch (e) {}
}

function applyDecorToggle(key, on) {
    const body = document.body;
    if (!body) return;
    const attr = 'data-decor-' + key;
    if (on) body.setAttribute(attr, 'on');
    else body.removeAttribute(attr);
}

function setDecor(key, on) {
    if (DECOR_KEYS.indexOf(key) === -1) return false;
    const stored = readDecorStored();
    stored[key] = !!on;
    writeDecorStored(stored);
    applyDecorToggle(key, !!on);
    return true;
}

function getDecor(key) {
    if (DECOR_KEYS.indexOf(key) === -1) return false;
    const stored = readDecorStored();
    if (key in stored) return !!stored[key];
    return !!DECOR_DEFAULTS[key];
}

function getDecorList() {
    return DECOR_KEYS.map(k => ({ key: k, on: getDecor(k) }));
}

function disableAllDecor() {
    const stored = {};
    DECOR_KEYS.forEach(k => { stored[k] = false; applyDecorToggle(k, false); });
    writeDecorStored(stored);
}

function initDecor() {
    const stored = readDecorStored();
    DECOR_KEYS.forEach(k => {
        const on = (k in stored) ? !!stored[k] : !!DECOR_DEFAULTS[k];
        applyDecorToggle(k, on);
    });
}

MXOS.AnimLevel.setDecor = setDecor;
MXOS.AnimLevel.getDecor = getDecor;
MXOS.AnimLevel.getDecorList = getDecorList;
MXOS.AnimLevel.disableAllDecor = disableAllDecor;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { set, get, getUserLevel, getLevels };
