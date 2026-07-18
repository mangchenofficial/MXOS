window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_app_badges';

let counts = {};

function load() {
    try { counts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { counts = {}; }
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(counts)); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-app-badges-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-app-badges-styles';
    style.textContent = `
.mxos-badge {
    position: absolute;
    top: 4px; right: 4px;
    min-width: 16px; height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: #e53935;
    color: #fff;
    font-size: 10px;
    line-height: 16px;
    text-align: center;
    font-weight: 600;
    box-shadow: 0 0 0 1.5px rgba(10, 10, 11, 0.85), 0 2px 6px rgba(229, 57, 53, 0.4);
    pointer-events: none;
    z-index: 5;
    font-family: var(--font-ui, system-ui, sans-serif);
}
.mxos-badge.pulse {
    animation: mxosBadgePulse 1.4s ease-in-out infinite;
}
@keyframes mxosBadgePulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 1.5px rgba(10,10,11,0.85), 0 0 0 0 rgba(229,57,53,0.55); }
    50% { transform: scale(1.12); box-shadow: 0 0 0 1.5px rgba(10,10,11,0.85), 0 0 0 6px rgba(229,57,53,0); }
}
.start-app, .taskbar-item, .desktop-icon {
    position: relative;
}
    `;
    document.head.appendChild(style);
}

function findContainer(appId) {
    const sels = [
        `.start-app[data-app="${appId}"]`,
        `.taskbar-item[data-app="${appId}"]`,
        `.desktop-icon[data-app="${appId}"]`
    ];
    for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

function setCount(appId, count) {
    const c = Math.max(0, Math.min(99, Math.floor(count || 0)));
    counts[appId] = c;
    save();
    renderApp(appId);
}

function increment(appId, n = 1) {
    counts[appId] = (counts[appId] || 0) + n;
    save();
    renderApp(appId);
}

function clear(appId) {
    if (counts[appId] !== undefined) {
        delete counts[appId];
        save();
        renderApp(appId);
    }
}

function getCount(appId) {
    return counts[appId] || 0;
}

function renderApp(appId) {
    const el = findContainer(appId);
    if (!el) return;
    const existing = el.querySelector('.mxos-badge');
    const c = counts[appId] || 0;
    if (c <= 0) {
        if (existing) existing.remove();
        return;
    }
    if (!existing) {
        const b = document.createElement('span');
        b.className = 'mxos-badge';
        b.setAttribute('aria-label', `${c} 条未读`);
        el.appendChild(b);
    }
    const b = el.querySelector('.mxos-badge');
    b.textContent = c > 9 ? '9+' : String(c);
    b.classList.add('pulse');
    setTimeout(() => b.classList.remove('pulse'), 2400);
}

function renderAll() {
    Object.keys(counts).forEach(renderApp);
}

function onNotification(e) {
    const d = e && e.detail;
    if (!d) return;
    const appId = d.appId || d.app || 'system';
    increment(appId, 1);
}

let observer = null;
function observeDom() {
    if (observer) return;
    observer = new MutationObserver(() => renderAll());
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    load();
    injectStyles();
    observeDom();
    setTimeout(renderAll, 600);
    window.addEventListener('mxos:notification-shown', onNotification);
    window.MXOS.Features.badges = {
        setCount, increment, clear, getCount, renderAll
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setCount, increment, clear, getCount };
