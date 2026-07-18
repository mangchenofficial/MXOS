window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_window_mood_enabled';
const USAGE_KEY = 'mxos_app_usage_stats';
const EXCITED_WINDOW = 60 * 1000;
const CALM_WINDOW = 5 * 60 * 1000;
const BORED_WINDOW = 5 * 60 * 1000;
const SLEEPING_WINDOW = 30 * 60 * 1000;

function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
}

let enabled = false;
let usageStats = {};
let trackedWindows = new WeakMap();
let rafId = null;
let lastUpdateTime = 0;

const MOODS = {
    excited: {
        name: '兴奋',
        tip: '活力满满，正在专注使用中',
        face: '<g><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="9" r="1.4" fill="currentColor"/><path d="M7 14 Q12 18 17 14" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>'
    },
    calm: {
        name: '平静',
        tip: '一切安稳，偶尔会被唤起',
        face: '<g><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><path d="M8 14 H16" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>'
    },
    bored: {
        name: '无聊',
        tip: '已经 5 分钟没人理我了',
        face: '<g><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><path d="M8 15 Q12 13 16 15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>'
    },
    sleeping: {
        name: '沉睡',
        tip: '太久没活动，已进入小憩',
        face: '<g><path d="M7 10 Q9 8 11 10" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M13 10 Q15 8 17 10" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M9 15 H15" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>'
    }
};

function injectStyles() {
    if (document.getElementById('mxos-window-mood-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-window-mood-styles';
    style.textContent = `
.window-mood {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px;
    margin-right: 6px;
    color: var(--accent-color, #60a5fa);
    opacity: 0.85;
    transition: transform 200ms ease, opacity 200ms ease;
    cursor: help;
}
.window-mood:hover { opacity: 1; transform: scale(1.15); }
.window-mood svg { width: 18px; height: 18px; display: block; }
.window-mood.sleeping { animation: moodBreathe 3.2s ease-in-out infinite; }
.window-mood.excited { animation: moodWiggle 1.6s ease-in-out infinite; }
@keyframes moodBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(0.9); } }
@keyframes moodWiggle { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
.window-mood-tip {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: rgba(20,22,28,0.92);
    color: #f3f4f6;
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 180ms ease, transform 180ms ease;
    z-index: 9999;
}
.window-mood-tip.show { opacity: 1; transform: translateY(0); }
body.reduce-motion .window-mood { animation: none !important; transition: none !important; }
body.reduce-motion .window-mood-tip { transition: none !important; }
    `;
    document.head.appendChild(style);
}

function loadStats() {
    try {
        const raw = localStorage.getItem(USAGE_KEY);
        if (raw) usageStats = JSON.parse(raw) || {};
    } catch (e) { usageStats = {}; }
}

function saveStats() {
    try { localStorage.setItem(USAGE_KEY, JSON.stringify(usageStats)); } catch (e) {}
}

function recordActive(appId) {
    if (!appId) return;
    if (!usageStats[appId]) usageStats[appId] = { lastActive: 0, totalActiveMs: 0, sessions: 0 };
    const now = Date.now();
    const prev = usageStats[appId].lastActive || 0;
    if (prev && now - prev < 60000) {
        usageStats[appId].totalActiveMs += now - prev;
    } else {
        usageStats[appId].sessions += 1;
    }
    usageStats[appId].lastActive = now;
}

function getMoodForApp(appId) {
    const s = usageStats[appId];
    if (!s || !s.lastActive) return 'sleeping';
    const dt = Date.now() - s.lastActive;
    if (dt < EXCITED_WINDOW) return 'excited';
    if (dt < BORED_WINDOW) return 'calm';
    if (dt < SLEEPING_WINDOW) return 'bored';
    return 'sleeping';
}

function buildMoodEl(mood) {
    const cfg = MOODS[mood];
    const el = document.createElement('div');
    el.className = `window-mood ${mood}`;
    el.setAttribute('aria-label', `窗口心情：${cfg.name}`);
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${cfg.face}</svg>`;
    const tip = document.createElement('div');
    tip.className = 'window-mood-tip';
    tip.textContent = `${cfg.name} · ${cfg.tip}`;
    el.appendChild(tip);
    el.addEventListener('mouseenter', () => tip.classList.add('show'));
    el.addEventListener('mouseleave', () => tip.classList.remove('show'));
    el.addEventListener('focus', () => tip.classList.add('show'));
    el.addEventListener('blur', () => tip.classList.remove('show'));
    return el;
}

function setMoodForWindow(windowObj, mood) {
    if (!windowObj || !windowObj.element) return;
    const header = windowObj.element.querySelector('.window-controls');
    if (!header) return;
    let el = header.querySelector('.window-mood');
    if (el) {
        el.className = `window-mood ${mood}`;
        const cfg = MOODS[mood];
        el.setAttribute('aria-label', `窗口心情：${cfg.name}`);
        el.querySelector('svg').innerHTML = cfg.face;
        const tip = el.querySelector('.window-mood-tip');
        if (tip) tip.textContent = `${cfg.name} · ${cfg.tip}`;
    } else {
        el = buildMoodEl(mood);
        header.parentElement.style.position = 'relative';
        header.insertBefore(el, header.firstChild);
    }
}

function injectMoodForWindow(windowObj) {
    if (!windowObj || !windowObj.appId) return;
    const mood = getMoodForApp(windowObj.appId);
    setMoodForWindow(windowObj, mood);
    recordActive(windowObj.appId);
    saveStats();
}

function onWindowOpened(e) {
    if (!enabled) return;
    const detail = e && e.detail;
    if (!detail || !detail.window) return;
    const w = detail.window;
    setTimeout(() => injectMoodForWindow(w), 80);
}

function onWindowClosed(e) {
    if (!enabled) return;
    const detail = e && e.detail;
    if (!detail || !detail.appId) return;
    if (usageStats[detail.appId]) {
        usageStats[detail.appId].lastActive = Date.now();
        saveStats();
    }
}

function onWindowFocused(e) {
    if (!enabled) return;
    const detail = e && e.detail;
    if (!detail || !detail.window) return;
    const w = detail.window;
    if (w.appId) {
        recordActive(w.appId);
        saveStats();
    }
}

function tick(ts) {
    if (!enabled) { rafId = requestAnimationFrame(tick); return; }
    if (!lastUpdateTime) lastUpdateTime = ts;
    if (ts - lastUpdateTime > 5000) {
        lastUpdateTime = ts;
        const list = (window.MXOS && window.MXOS.state && window.MXOS.state.windows) || [];
        if (Array.isArray(list) && list.length) {
            list.forEach(w => {
                if (w && w.appId) setMoodForWindow(w, getMoodForApp(w.appId));
            });
        } else {
            document.querySelectorAll('.window').forEach(winEl => {
                const appId = winEl.dataset && winEl.dataset.appId;
                if (appId) {
                    const mood = getMoodForApp(appId);
                    const ctrl = winEl.querySelector('.window-controls');
                    if (ctrl) {
                        let el = ctrl.querySelector('.window-mood');
                        if (el) {
                            el.className = `window-mood ${mood}`;
                            const cfg = MOODS[mood];
                            const svg = el.querySelector('svg');
                            if (svg) svg.innerHTML = cfg.face;
                        }
                    }
                }
            });
        }
    }
    rafId = requestAnimationFrame(tick);
}

function getStats() {
    return JSON.parse(JSON.stringify(usageStats));
}

function getMood(appId) {
    return getMoodForApp(appId);
}

function resetStats() {
    usageStats = {};
    saveStats();
}

function refreshAllWindows() {
    const list = (window.MXOS && window.MXOS.state && window.MXOS.state.windows) || [];
    if (Array.isArray(list)) list.forEach(w => injectMoodForWindow(w));
    else document.querySelectorAll('.window').forEach(winEl => {
        const appId = winEl.dataset && winEl.dataset.appId;
        if (appId) setMoodForWindow({ element: winEl, appId }, getMoodForApp(appId));
    });
}

function clearAllMoods() {
    document.querySelectorAll('.window-mood').forEach(el => el.remove());
}

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
    if (enabled) refreshAllWindows();
    else clearAllMoods();
}
function isEnabled() { return enabled; }

function init() {
    try {
        enabled = loadEnabled();
        injectStyles();
        loadStats();
        window.MXOS.Features.windowMood = {
            getMood, getStats, resetStats, setEnabled, isEnabled,
            moods: Object.keys(MOODS)
        };
        window.addEventListener('mxos:window-opened', onWindowOpened);
        window.addEventListener('mxos:window-closed', onWindowClosed);
        window.addEventListener('mxos:window-focused', onWindowFocused);
        rafId = requestAnimationFrame(tick);
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getMood, getStats, resetStats, setEnabled, isEnabled };
