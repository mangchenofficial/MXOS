import { state } from '../state.js';

window.MXOS = window.MXOS || {};

let active = false;
let timerEl = null;
let intervalId = null;
let startTime = 0;
let savedBounds = null;
let savedHidden = [];

function injectStyles() {
    if (document.getElementById('focus-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'focus-mode-styles';
    style.textContent = `
body.focus-mode .taskbar,
body.focus-mode .desktop-icons,
body.focus-mode .widget-layer,
body.focus-mode #startMenu,
body.focus-mode #quickSettingsPanel,
body.focus-mode .notification-center,
body.focus-mode .system-tray {
    opacity: 0 !important;
    pointer-events: none !important;
    transition: opacity 0.35s var(--ease-out) !important;
}
body.focus-mode .desktop-icons,
body.focus-mode .widget-layer {
    visibility: hidden;
}
#focusTimer {
    position: fixed;
    top: 16px;
    right: 16px;
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur-active)) saturate(var(--glass-saturation));
    -webkit-backdrop-filter: blur(var(--glass-blur-active)) saturate(var(--glass-saturation));
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    padding: 10px 14px;
    color: var(--text-color);
    font-size: 14px;
    font-weight: var(--font-weight-medium);
    z-index: 9500;
    display: none;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
}
#focusTimer.show {
    display: flex;
    animation: focusTimerIn 0.4s var(--ease-out);
}
@keyframes focusTimerIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
}
.focus-timer-icon {
    display: inline-flex;
    color: var(--accent);
}
.focus-timer-text {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
}
.focus-timer-label {
    font-size: 11px;
    color: var(--text-secondary);
    margin-right: 4px;
}
.focus-exit-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--glass-border);
    color: var(--text-color);
    border-radius: var(--radius-md);
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    margin-left: 4px;
}
.focus-exit-btn:hover {
    background: var(--hover-bg);
}
    `;
    document.head.appendChild(style);
}

function formatDuration(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function updateTimer() {
    if (!timerEl) return;
    const elapsed = Date.now() - startTime;
    const textEl = timerEl.querySelector('.focus-timer-text');
    if (textEl) textEl.textContent = formatDuration(elapsed);
}

function buildTimer() {
    let el = document.getElementById('focusTimer');
    if (!el) {
        el = document.createElement('div');
        el.id = 'focusTimer';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-label', '专注模式计时器');
        el.innerHTML = `
            <span class="focus-timer-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <span class="focus-timer-label">专注中</span>
            <span class="focus-timer-text">00:00</span>
            <button class="focus-exit-btn" id="focusExitBtn" aria-label="退出专注模式">退出</button>
        `;
        document.body.appendChild(el);
        el.querySelector('#focusExitBtn').addEventListener('click', exit);
    }
    return el;
}

function enter() {
    if (active) return;
    const winObj = state.activeWindow
        ? state.windows.find(w => w.element === state.activeWindow)
        : null;
    if (!winObj) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('请先聚焦一个窗口再进入专注模式', 'warning');
        return false;
    }
    active = true;
    document.body.classList.add('focus-mode');
    savedBounds = {
        left: winObj.element.style.left,
        top: winObj.element.style.top,
        width: winObj.element.style.width,
        height: winObj.element.style.height,
        maximized: winObj.element.classList.contains('maximized')
    };
    savedHidden = [];
    state.windows.forEach(w => {
        if (w !== winObj && !w.minimized) {
            savedHidden.push(w);
            if (w.element.style.display !== 'none') {
                w.element.style.transition = 'opacity 0.25s ease';
                w.element.style.opacity = '0';
                setTimeout(() => {
                    if (active && w !== state.activeWindow) w.element.style.display = 'none';
                    w.element.style.opacity = '';
                    w.element.style.transition = '';
                }, 250);
            }
        }
    });
    if (savedBounds.maximized) {
        winObj.element.classList.remove('maximized');
    }
    const margin = 64;
    const targetWidth = Math.min(1100, window.innerWidth - margin * 2);
    const targetHeight = Math.min(window.innerHeight - margin - 32, 720);
    winObj.element.style.transition = 'top 0.4s var(--ease-out), left 0.4s var(--ease-out), width 0.4s var(--ease-out), height 0.4s var(--ease-out)';
    winObj.element.style.left = Math.floor((window.innerWidth - targetWidth) / 2) + 'px';
    winObj.element.style.top = Math.floor((window.innerHeight - targetHeight) / 2) + 'px';
    winObj.element.style.width = targetWidth + 'px';
    winObj.element.style.height = targetHeight + 'px';
    winObj.element.style.zIndex = 9400;
    setTimeout(() => { winObj.element.style.transition = ''; }, 450);

    timerEl = buildTimer();
    startTime = Date.now();
    updateTimer();
    timerEl.classList.add('show');
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(updateTimer, 1000);

    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已进入专注模式');
    window.dispatchEvent(new CustomEvent('focus-mode:change', { detail: { active: true } }));
    return true;
}

function exit() {
    if (!active) return false;
    active = false;
    document.body.classList.remove('focus-mode');
    if (timerEl) timerEl.classList.remove('show');
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (savedHidden.length) {
        savedHidden.forEach(w => {
            if (w.element.style.display === 'none') {
                w.element.style.display = 'flex';
                w.element.style.opacity = '0';
                requestAnimationFrame(() => {
                    w.element.style.transition = 'opacity 0.25s ease';
                    w.element.style.opacity = '1';
                    setTimeout(() => { w.element.style.transition = ''; w.element.style.opacity = ''; }, 260);
                });
            }
        });
        savedHidden = [];
    }
    if (savedBounds && state.activeWindow) {
        const el = state.activeWindow;
        if (savedBounds.maximized) el.classList.add('maximized');
        el.style.transition = 'top 0.3s var(--ease-out), left 0.3s var(--ease-out), width 0.3s var(--ease-out), height 0.3s var(--ease-out)';
        el.style.left = savedBounds.left;
        el.style.top = savedBounds.top;
        el.style.width = savedBounds.width;
        el.style.height = savedBounds.height;
        setTimeout(() => { el.style.transition = ''; }, 320);
    }
    savedBounds = null;
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已退出专注模式');
    window.dispatchEvent(new CustomEvent('focus-mode:change', { detail: { active: false } }));
    return true;
}

function toggle() {
    if (active) exit();
    else enter();
}

function isActive() {
    return active;
}

function init() {
    injectStyles();
    buildTimer();
    window.MXOS.Focus = {
        enter,
        exit,
        toggle,
        isActive
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { enter, exit, toggle, isActive };
