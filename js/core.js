import { state, appConfigs, iconSvg } from './state.js';

export const appRenderers = {};

export function registerAppRenderer(id, fn) {
    appRenderers[id] = fn;
}

export function openApp(appId) {
    createWindow(appId);
}

export function createWindow(appId) {
    const config = appConfigs[appId];
    if (!config) { if (window.MXOS.dialog && window.MXOS.dialog.toast) window.MXOS.dialog.toast('应用正在加载中，请稍后再试'); return; }

    const existingWindow = state.windows.find(w => w.appId === appId);
    if (existingWindow) {
        if (existingWindow.minimized) {
            updateTaskbar();
            const taskbarItem = getTaskbarItemForWindow(existingWindow);
            restoreWindow(existingWindow, taskbarItem);
        } else {
            bringToFront(existingWindow.element);
        }
        updateTaskbar();
        return;
    }

    const windowEl = document.createElement('div');
    windowEl.className = 'window animating animating-open window-opening';
    windowEl.style.width = config.width + 'px';
    windowEl.style.height = config.height + 'px';
    const maxOffset = Math.min(window.innerWidth - 400, window.innerHeight - 300);
    let offset = state.windows.length * 30;
    if (offset > maxOffset) offset = offset % maxOffset;
    windowEl.style.left = 100 + offset + 'px';
    windowEl.style.top = 50 + offset + 'px';
    windowEl.style.zIndex = ++state.zIndex;

    setTimeout(() => {
        windowEl.classList.remove('animating', 'animating-open', 'window-opening');
    }, 300);

    windowEl.innerHTML = `
        <div class="resize-handle top-left"></div>
        <div class="resize-handle top"></div>
        <div class="resize-handle top-right"></div>
        <div class="resize-handle right"></div>
        <div class="resize-handle bottom-right"></div>
        <div class="resize-handle bottom"></div>
        <div class="resize-handle bottom-left"></div>
        <div class="resize-handle left"></div>
        <div class="window-header">
            <div class="window-title">
                ${iconSvg(config.icon, 16)}
                <span>${config.title}</span>
            </div>
            <div class="window-controls">
                <div class="window-control minimize"><svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5"/></svg></div>
                <div class="window-control maximize"><svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></div>
                <div class="window-control close"><svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/></svg></div>
            </div>
        </div>
        <div class="window-content"></div>
    `;

    document.body.appendChild(windowEl);

    const abortController = new AbortController();
    const windowObj = {
        id: 'win_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        appId: appId,
        element: windowEl,
        minimized: false,
        abortController: abortController,
        desktopId: (window.MXOS && window.MXOS.Desktop && typeof window.MXOS.Desktop.getCurrentDesktop === 'function')
            ? window.MXOS.Desktop.getCurrentDesktop()
            : 'd1'
    };
    state.windows.push(windowObj);

    const headerSignal = abortController.signal;
    windowEl.querySelector('.window-header').addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-control')) return;
        startDrag(e, windowEl);
    }, { signal: headerSignal });
    windowEl.querySelector('.window-header').addEventListener('touchstart', (e) => {
        if (e.target.closest('.window-control')) return;
        startDrag(e, windowEl);
    }, { signal: headerSignal });

    windowEl.querySelector('.minimize').addEventListener('click', () => minimizeWindow(windowObj), { signal: headerSignal });
    windowEl.querySelector('.maximize').addEventListener('click', () => toggleMaximize(windowEl), { signal: headerSignal });
    windowEl.querySelector('.close').addEventListener('click', () => closeWindow(windowObj), { signal: headerSignal });

    windowEl.addEventListener('mousedown', () => bringToFront(windowEl), { signal: headerSignal });

    const resizeHandles = windowEl.querySelectorAll('.resize-handle');
    resizeHandles.forEach(handle => {
        const direction = handle.className.replace('resize-handle ', '').trim();
        handle.addEventListener('mousedown', (e) => startResize(e, windowEl, direction), { signal: headerSignal });
        handle.addEventListener('touchstart', (e) => startResize(e, windowEl, direction), { signal: headerSignal, passive: false });
    });

    loadAppContent(appId, windowEl.querySelector('.window-content'), windowEl);
    bringToFront(windowEl);
    updateTaskbar();
    updateGlassPerformanceMode();
    window.dispatchEvent(new CustomEvent('mxos:window-opened', { detail: { appId, window: windowObj } }));
}

export async function loadAppContent(appId, contentEl, windowEl) {
    const config = appConfigs[appId];
    let key = appId;
    if (config) {
        if (appId.startsWith('notepad-') || config.content === 'notepad') key = 'notepad';
        else if (appId.startsWith('thirdparty_')) key = 'thirdparty';
    }
    let renderer = appRenderers[key];
    if (!renderer) {
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 150));
            renderer = appRenderers[key];
            if (renderer) break;
        }
    }
    if (renderer) {
        contentEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary)"><div class="mxos-loading-spinner"></div></div>';
        try {
            await renderer(contentEl, windowEl, appId);
        } catch (e) {
            console.error('MXOS render error [' + appId + ']:', e);
            contentEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);gap:12px;padding:20px;text-align:center"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><div>应用加载失败</div><div style="font-size:12px;opacity:0.6">' + (e && e.message || '未知错误') + '</div></div>';
        }
    } else {
        contentEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);gap:12px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div>应用未加载</div></div>';
    }
}

export function minimizeWindow(windowObj) {
    if (windowObj.element.classList.contains('animating')) return;
    windowObj.element.classList.add('animating', 'window-minimizing');

    updateTaskbar();

    const taskbarItem = getTaskbarItemForWindow(windowObj);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight - 24;
    if (taskbarItem) {
        const rect = taskbarItem.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
    }

    const windowRect = windowObj.element.getBoundingClientRect();
    const windowCenterX = windowRect.left + windowRect.width / 2;
    const windowCenterY = windowRect.top + windowRect.height / 2;

    const offsetX = targetX - windowCenterX;
    const offsetY = targetY - windowCenterY;

    windowObj.element.style.transformOrigin = 'center center';
    windowObj.element.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
    windowObj.element.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(0.05)`;
    windowObj.element.style.opacity = '0';

    setTimeout(() => {
        windowObj.element.classList.remove('animating', 'window-minimizing');
        windowObj.element.classList.add('minimized');
        windowObj.minimized = true;
        windowObj.element.style.display = 'none';
        windowObj.element.style.transform = '';
        windowObj.element.style.opacity = '';
        windowObj.element.style.transformOrigin = '';
        windowObj.element.style.transition = '';
        if (state.activeWindow === windowObj.element) {
            const nextWindow = state.windows
                .filter(w => w !== windowObj && !w.minimized)
                .sort((a, b) => (parseInt(b.element.style.zIndex) || 0) - (parseInt(a.element.style.zIndex) || 0))[0] || null;
            if (nextWindow) {
                bringToFront(nextWindow.element);
            } else {
                windowObj.element.classList.remove('active');
                const title = windowObj.element.querySelector('.window-title');
                if (title) title.style.fontWeight = 'normal';
                state.activeWindow = null;
            }
        }
        updateTaskbar();
        updateGlassPerformanceMode();
        window.dispatchEvent(new CustomEvent('mxos:window-minimized', { detail: { window: windowObj } }));
    }, 350);
}

export function toggleMaximize(windowEl) {
    if (windowEl.classList.contains('animating')) return;
    const isMaximized = windowEl.classList.contains('maximized');

    if (!isMaximized) {
        if (windowEl.style.transform) {
            windowEl.style.transform = '';
            windowEl.offsetHeight;
        }
        windowEl.dataset.prevTop = windowEl.offsetTop + 'px';
        windowEl.dataset.prevLeft = windowEl.offsetLeft + 'px';
        windowEl.dataset.prevWidth = windowEl.offsetWidth + 'px';
        windowEl.dataset.prevHeight = windowEl.offsetHeight + 'px';
    }

    windowEl.classList.add('animating');
    windowEl.classList.toggle('maximized');

    if (isMaximized) {
        windowEl.style.top = windowEl.dataset.prevTop;
        windowEl.style.left = windowEl.dataset.prevLeft;
        windowEl.style.width = windowEl.dataset.prevWidth;
        windowEl.style.height = windowEl.dataset.prevHeight;
        windowEl.style.borderRadius = '8px';
        windowEl.style.boxShadow = 'var(--shadow)';
    } else {
        windowEl.style.top = '0';
        windowEl.style.left = '0';
        windowEl.style.width = '100vw';
        windowEl.style.height = 'calc(100vh - 48px)';
        windowEl.style.borderRadius = '0';
        windowEl.style.boxShadow = 'none';
        windowEl.classList.add('window-maximizing');
        setTimeout(() => windowEl.classList.remove('window-maximizing'), 400);
    }

    setTimeout(() => {
        windowEl.classList.remove('animating');
    }, 350);
}

export function closeWindow(windowObj) {
    if (windowObj.element.classList.contains('animating')) return;
    if (windowObj.abortController) {
        windowObj.abortController.abort();
    }
    windowObj.element.classList.add('animating', 'animating-close', 'window-closing');
    const closedAppId = windowObj.appId;
    window.dispatchEvent(new CustomEvent('mxos:window-closed', { detail: { appId: closedAppId, window: windowObj } }));
    setTimeout(() => {
        windowObj.element.remove();
        state.windows = state.windows.filter(w => w !== windowObj);
        recalcZIndex();
        updateTaskbar();
        updateGlassPerformanceMode();
        const visibleWindows = state.windows.filter(w => !w.minimized);
        const lastActiveWindow = visibleWindows.sort((a, b) => (parseInt(b.element.style.zIndex) || 0) - (parseInt(a.element.style.zIndex) || 0))[0] || null;
        state.activeWindow = lastActiveWindow ? lastActiveWindow.element : null;
    }, 250);
}

export function recalcZIndex() {
    const sorted = [...state.windows].sort((a, b) => {
        const za = parseInt(a.element.style.zIndex) || 0;
        const zb = parseInt(b.element.style.zIndex) || 0;
        return za - zb;
    });
    let z = 1000;
    sorted.forEach(w => {
        w.element.style.zIndex = z++;
    });
    state.zIndex = z - 1;
}

export function bringToFront(windowEl) {
    let newZ = ++state.zIndex;
    if (newZ > 9999) {
        recalcZIndex();
        newZ = state.zIndex = ++state.zIndex;
    }
    windowEl.style.zIndex = newZ;
    state.windows.forEach(w => {
        w.element.querySelector('.window-title').style.fontWeight = 'normal';
        w.element.classList.remove('active');
    });
    windowEl.querySelector('.window-title').style.fontWeight = '600';
    windowEl.classList.add('active');
    state.activeWindow = windowEl;
    if (document.getElementById('taskbarItems')) {
        updateTaskbar();
    }
}

function updateGlassPerformanceMode() {
    const visibleWindows = state.windows.filter(w => !w.minimized);
    if (visibleWindows.length > 5) {
        document.body.classList.add('heavy-windows');
    } else {
        document.body.classList.remove('heavy-windows');
    }
}

export function startDrag(e, windowEl) {
    e.preventDefault();
    if (windowEl.classList.contains('maximized')) {
        var mx = e.touches ? e.touches[0].clientX : e.clientX;
        var my = e.touches ? e.touches[0].clientY : e.clientY;
        var ratio = (mx - windowEl.offsetLeft) / windowEl.offsetWidth;
        var prevW = parseInt(windowEl.dataset.prevWidth) || 800;
        var prevH = parseInt(windowEl.dataset.prevHeight) || 600;
        windowEl.classList.remove('maximized');
        windowEl.style.width = prevW + 'px';
        windowEl.style.height = prevH + 'px';
        windowEl.style.top = Math.max(0, my - 20) + 'px';
        windowEl.style.left = Math.max(0, mx - prevW * ratio) + 'px';
        windowEl.style.borderRadius = '8px';
        windowEl.style.boxShadow = 'var(--shadow)';
        void windowEl.offsetHeight;
    }
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    state.dragState = {
        element: windowEl,
        startX: clientX,
        startY: clientY,
        startLeft: windowEl.offsetLeft,
        startTop: windowEl.offsetTop
    };
    document.body.classList.add('dragging');
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
}

function onDrag(e) {
    if (!state.dragState) return;
    e.preventDefault();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var ds = state.dragState;
    var dx = clientX - ds.startX;
    var dy = clientY - ds.startY;
    var newLeft = ds.startLeft + dx;
    var newTop = ds.startTop + dy;
    var maxTop = window.innerHeight - 32;
    var maxLeft = window.innerWidth - 50;
    newLeft = Math.max(0, Math.min(maxLeft, newLeft));
    newTop = Math.max(0, Math.min(maxTop, newTop));
    ds.element.style.left = newLeft + 'px';
    ds.element.style.top = newTop + 'px';
}

function stopDrag() {
    document.body.classList.remove('dragging');
    state.dragState = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
}

export function startResize(e, windowEl, direction) {
    if (windowEl.classList.contains('maximized')) return;
    windowEl.style.transition = 'none';
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    state.resizeState = {
        element: windowEl,
        direction: direction,
        startX: clientX,
        startY: clientY,
        startWidth: windowEl.offsetWidth,
        startHeight: windowEl.offsetHeight,
        startLeft: windowEl.offsetLeft,
        startTop: windowEl.offsetTop,
        currentX: clientX,
        currentY: clientY,
        rafId: null
    };
    windowEl.style.willChange = 'transform, width, height';
    document.body.classList.add('dragging');
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', onResize, { passive: false });
    document.addEventListener('touchend', stopResize);
}

function onResize(e) {
    if (!state.resizeState) return;
    e.preventDefault();
    state.resizeState.currentX = e.touches ? e.touches[0].clientX : e.clientX;
    state.resizeState.currentY = e.touches ? e.touches[0].clientY : e.clientY;

    if (!state.resizeState.rafId) {
        state.resizeState.rafId = requestAnimationFrame(updateResize);
    }
}

function updateResize() {
    if (!state.resizeState) return;
    const dx = state.resizeState.currentX - state.resizeState.startX;
    const dy = state.resizeState.currentY - state.resizeState.startY;

    let newWidth = state.resizeState.startWidth;
    let newHeight = state.resizeState.startHeight;
    let translateX = 0;
    let translateY = 0;

    const direction = state.resizeState.direction;

    if (direction.includes('right')) {
        newWidth = Math.max(300, state.resizeState.startWidth + dx);
    }
    if (direction.includes('left')) {
        newWidth = Math.max(300, state.resizeState.startWidth - dx);
        if (newWidth > 300) {
            translateX = dx;
        } else {
            translateX = state.resizeState.startWidth - 300;
        }
    }
    if (direction.includes('bottom')) {
        newHeight = Math.max(200, state.resizeState.startHeight + dy);
    }
    if (direction.includes('top')) {
        newHeight = Math.max(200, state.resizeState.startHeight - dy);
        if (newHeight > 200) {
            translateY = dy;
        } else {
            translateY = state.resizeState.startHeight - 200;
        }
    }

    state.resizeState.element.style.width = newWidth + 'px';
    state.resizeState.element.style.height = newHeight + 'px';
    state.resizeState.element.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;

    const contentEl = state.resizeState.element.querySelector('.window-content');
    if (contentEl) {
        const event = new CustomEvent('windowResize', {
            detail: { width: newWidth, height: newHeight }
        });
        contentEl.dispatchEvent(event);
    }
    state.resizeState.rafId = null;
}

function stopResize() {
    if (state.resizeState && state.resizeState.rafId) {
        cancelAnimationFrame(state.resizeState.rafId);
    }
    if (state.resizeState && state.resizeState.element) {
        var el = state.resizeState.element;
        var transform = el.style.transform;
        if (transform) {
            var match = transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0px\)/);
            if (match) {
                var dx = parseFloat(match[1]);
                var dy = parseFloat(match[2]);
                if (dx !== 0) el.style.left = (el.offsetLeft + dx) + 'px';
                if (dy !== 0) el.style.top = (el.offsetTop + dy) + 'px';
            }
            el.style.transform = '';
        }
        el.style.willChange = '';
        el.style.transition = '';

        const contentEl = el.querySelector('.window-content');
        if (contentEl) {
            const event = new CustomEvent('windowResizeEnd', {
                detail: {
                    width: el.offsetWidth,
                    height: el.offsetHeight
                }
            });
            contentEl.dispatchEvent(event);
        }
    }
    document.body.classList.remove('dragging');
    state.resizeState = null;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', onResize);
    document.removeEventListener('touchend', stopResize);
}

const DEFAULT_TASKBAR_PINNED_APPS = ['this-pc', 'browser', 'store', 'settings', 'music', 'office', 'calculator', 'terminal'];
const TASKBAR_PINNED_STORAGE_KEY = 'mxos_taskbar_pinned_apps';
const taskbarStatusCache = new Map();

function safeJsonParse(value, fallback) {
    try {
        return JSON.parse(value);
    } catch (e) {
        return fallback;
    }
}

function dedupeStrings(values) {
    const seen = new Set();
    return values.filter(value => {
        if (typeof value !== 'string' || !value.trim()) return false;
        const normalized = value.trim();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    }).map(value => value.trim());
}

function getPinnedTaskbarAppIds() {
    let saved = null;
    try { saved = safeJsonParse(localStorage.getItem(TASKBAR_PINNED_STORAGE_KEY) || 'null', null); } catch (e) {}
    const savedPinned = Array.isArray(saved) ? dedupeStrings(saved) : [];
    const pinned = savedPinned.length ? savedPinned : DEFAULT_TASKBAR_PINNED_APPS.slice();
    const validPinned = pinned.filter(appId => getTaskbarAppEntry(appId));
    if (!Array.isArray(saved) || !savedPinned.length) {
        try { localStorage.setItem(TASKBAR_PINNED_STORAGE_KEY, JSON.stringify(validPinned)); } catch (e) {}
    }
    return validPinned;
}

function getInstalledTaskbarApp(appId) {
    const normalizedId = String(appId || '').startsWith('thirdparty_') ? String(appId).slice('thirdparty_'.length) : String(appId || '');
    return state.installedApps.find(app => app && app.id === normalizedId)
        || state.thirdPartyAppData[normalizedId]
        || null;
}

function getTaskbarAppEntry(appId) {
    if (!appId) return null;
    const config = appConfigs[appId];
    if (config) {
        return {
            id: appId,
            windowAppId: appId,
            title: config.title || appId,
            icon: config.icon || 'windows',
            launch: () => createWindow(appId)
        };
    }

    const installedApp = getInstalledTaskbarApp(appId);
    if (installedApp) {
        const normalizedId = String(appId).startsWith('thirdparty_') ? String(appId).slice('thirdparty_'.length) : String(appId);
        return {
            id: normalizedId,
            windowAppId: 'thirdparty_' + normalizedId,
            title: installedApp.name || normalizedId,
            icon: installedApp.icon || 'windows',
            launch: () => launchThirdPartyApp(installedApp)
        };
    }

    const runningWindow = state.windows.find(w => w.appId === appId);
    if (runningWindow) {
        const runningConfig = appConfigs[runningWindow.appId] || {};
        return {
            id: runningWindow.appId,
            windowAppId: runningWindow.appId,
            title: runningConfig.title || runningWindow.appId,
            icon: runningConfig.icon || 'windows',
            launch: () => createWindow(runningWindow.appId)
        };
    }

    return null;
}

function isWindowOnDesktop(windowObj, desktopId) {
    return !desktopId || !windowObj.desktopId || windowObj.desktopId === desktopId;
}

function pickTaskbarWindow(windows, desktopId) {
    const currentDesktopWindows = windows.filter(w => isWindowOnDesktop(w, desktopId));
    const pool = currentDesktopWindows.length ? currentDesktopWindows : windows;
    const active = pool.find(w => w.element === state.activeWindow);
    if (active) return active;
    const visible = pool
        .filter(w => !w.minimized)
        .sort((a, b) => (parseInt(b.element.style.zIndex) || 0) - (parseInt(a.element.style.zIndex) || 0));
    if (visible[0]) return visible[0];
    return pool[0] || null;
}

function cssAttrEscape(value) {
    const str = String(value == null ? '' : value);
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(str);
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}


function getTaskbarStatus(running, active, visible, minimized) {
    if (!running) return 'closed';
    if (active) return 'active';
    if (minimized) return 'minimized';
    if (visible) return 'visible';
    return 'running-other-desktop';
}

function getTaskbarTransitionClass(previousStatus, nextStatus) {
    if (!previousStatus || previousStatus === nextStatus) return '';
    if (previousStatus === 'closed' && nextStatus !== 'closed') return ' taskbar-anim-opened';
    if (nextStatus === 'closed') return ' taskbar-anim-closed';
    if (nextStatus === 'minimized') return ' taskbar-anim-minimized';
    if (previousStatus === 'minimized' && nextStatus !== 'minimized') return ' taskbar-anim-restored';
    if (nextStatus === 'active') return ' taskbar-anim-activated';
    return '';
}

export function getTaskbarItemForWindow(windowObj) {
    if (!windowObj) return null;
    const taskbarItems = document.getElementById('taskbarItems');
    if (!taskbarItems) return null;
    if (windowObj.id) {
        const byWindowId = taskbarItems.querySelector('.taskbar-item[data-window-id="' + cssAttrEscape(windowObj.id) + '"]');
        if (byWindowId) return byWindowId;
    }
    return taskbarItems.querySelector('.taskbar-item[data-window-app-id="' + cssAttrEscape(windowObj.appId) + '"]');
}

function handleTaskbarAppClick(entry, item) {
    const getCurrentDesktop = () => (window.MXOS && window.MXOS.Desktop && typeof window.MXOS.Desktop.getCurrentDesktop === 'function')
        ? window.MXOS.Desktop.getCurrentDesktop()
        : null;

    let currentDesktop = getCurrentDesktop();
    const appWindows = state.windows.filter(w => w.appId === entry.windowAppId);
    if (!appWindows.length) {
        entry.launch();
        updateTaskbar();
        return;
    }

    const targetWindow = pickTaskbarWindow(appWindows, currentDesktop);
    if (!targetWindow) return;

    if (targetWindow.desktopId && currentDesktop && targetWindow.desktopId !== currentDesktop) {
        if (window.MXOS && window.MXOS.Desktop && typeof window.MXOS.Desktop.switchTo === 'function') {
            window.MXOS.Desktop.switchTo(targetWindow.desktopId);
            currentDesktop = targetWindow.desktopId;
        }
    }

    if (targetWindow.minimized) {
        restoreWindow(targetWindow, item);
    } else if (targetWindow.element === state.activeWindow) {
        minimizeWindow(targetWindow);
    } else {
        targetWindow.element.style.display = 'flex';
        targetWindow.element.classList.remove('minimized');
        targetWindow.minimized = false;
        bringToFront(targetWindow.element);
    }
    updateTaskbar();
}

export function updateTaskbar() {
    const taskbarItems = document.getElementById('taskbarItems');
    if (!taskbarItems) return;

    const preserved = [];
    taskbarItems.querySelectorAll(':scope > :not(.taskbar-item)').forEach(el => preserved.push(el));
    taskbarItems.innerHTML = '';
    preserved.forEach(el => taskbarItems.appendChild(el));

    const currentDesktop = (window.MXOS && window.MXOS.Desktop && typeof window.MXOS.Desktop.getCurrentDesktop === 'function')
        ? window.MXOS.Desktop.getCurrentDesktop()
        : null;

    const orderedEntries = [];
    const renderedWindowAppIds = new Set();
    const addEntry = (appId, pinned = false) => {
        const entry = getTaskbarAppEntry(appId);
        if (!entry || renderedWindowAppIds.has(entry.windowAppId)) return;
        orderedEntries.push({ ...entry, pinned });
        renderedWindowAppIds.add(entry.windowAppId);
    };

    getPinnedTaskbarAppIds().forEach(appId => addEntry(appId, true));
    state.windows.forEach(w => addEntry(w.appId, false));

    const nextTaskbarStateKeys = new Set();

    orderedEntries.forEach((entry) => {
        const appWindows = state.windows.filter(w => w.appId === entry.windowAppId);
        const running = appWindows.length > 0;
        const onCurrentDesktop = !running || appWindows.some(w => isWindowOnDesktop(w, currentDesktop));
        const active = appWindows.some(w => isWindowOnDesktop(w, currentDesktop) && !w.minimized && w.element === state.activeWindow);
        const visible = appWindows.some(w => isWindowOnDesktop(w, currentDesktop) && !w.minimized);
        const minimized = running && !visible;
        const targetWindow = pickTaskbarWindow(appWindows, currentDesktop);
        const status = getTaskbarStatus(running, active, visible, minimized);
        const stateKey = entry.windowAppId;
        const animationClass = getTaskbarTransitionClass(taskbarStatusCache.get(stateKey), status);
        nextTaskbarStateKeys.add(stateKey);

        const item = document.createElement('div');
        item.className = 'taskbar-item'
            + (entry.pinned ? ' pinned' : '')
            + (running ? ' running' : '')
            + (minimized ? ' minimized' : '')
            + (active ? ' active' : '')
            + (visible && !active ? ' visible' : '')
            + (onCurrentDesktop ? '' : ' other-desktop')
            + animationClass;
        item.dataset.app = entry.id;
        item.dataset.appId = entry.id;
        item.dataset.windowAppId = entry.windowAppId;
        item.dataset.taskbarState = status;
        if (targetWindow && targetWindow.id) item.dataset.windowId = targetWindow.id;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', (running ? '切换 ' : '启动 ') + entry.title);
        item.title = entry.title + (running ? '' : ' - 单击启动');
        item.innerHTML = iconSvg(entry.icon || 'windows', 24);
        item.addEventListener('click', () => handleTaskbarAppClick(entry, item));
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTaskbarAppClick(entry, item);
            }
        });
        taskbarItems.appendChild(item);
        taskbarStatusCache.set(stateKey, status);
    });

    Array.from(taskbarStatusCache.keys()).forEach(key => {
        if (!nextTaskbarStateKeys.has(key)) taskbarStatusCache.delete(key);
    });
}

export function restoreWindow(windowObj, taskbarItem) {
    windowObj.element.classList.add('animating');
    windowObj.element.style.display = 'flex';
    windowObj.element.classList.remove('minimized');

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight - 24;
    if (taskbarItem) {
        const rect = taskbarItem.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
    }

    const windowRect = windowObj.element.getBoundingClientRect();
    const windowCenterX = windowRect.left + windowRect.width / 2;
    const windowCenterY = windowRect.top + windowRect.height / 2;

    const offsetX = targetX - windowCenterX;
    const offsetY = targetY - windowCenterY;

    windowObj.element.style.transformOrigin = 'center center';
    windowObj.element.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(0.05)`;
    windowObj.element.style.opacity = '0';

    windowObj.element.offsetHeight;

    windowObj.element.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
    windowObj.element.style.transform = 'scale(1)';
    windowObj.element.style.opacity = '1';

    windowObj.minimized = false;
    setTimeout(() => {
        windowObj.element.classList.remove('animating');
        windowObj.element.style.transform = '';
        windowObj.element.style.opacity = '';
        windowObj.element.style.transformOrigin = '';
        windowObj.element.style.transition = '';
    }, 350);
    bringToFront(windowObj.element);
    updateGlassPerformanceMode();
    window.dispatchEvent(new CustomEvent('mxos:window-restored', { detail: { window: windowObj } }));
}

export function updateAppStartMenu() {
    const startMenu = document.getElementById('startMenu');
    const appsGrid = startMenu.querySelector('.start-apps-grid');

    const existingCustomApps = appsGrid.querySelectorAll('.start-app:not([data-app="this-pc"]):not([data-app="recycle-bin"]):not([data-app="browser"]):not([data-app="settings"]):not([data-app="music"]):not([data-app="office"]):not([data-app="calculator"]):not([data-app="clock"]):not([data-app="terminal"]):not([data-app="calendar"]):not([data-app="store"])');
    existingCustomApps.forEach(el => el.remove());

    state.installedApps.forEach(app => {
        const appEl = document.createElement('div');
        appEl.className = 'start-app';
        appEl.dataset.app = app.id;
        appEl.innerHTML = iconSvg(app.icon, 32) + '<span>' + app.name + '</span>';
        appEl.addEventListener('click', () => {
            window.MXOS.closeStartMenu();
            launchThirdPartyApp(app);
        });
        appEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showUninstallMenu(e, app.id, app.name);
        });
        appsGrid.appendChild(appEl);
    });
}

function showUninstallMenu(e, appId, appName) {
    const existing = document.querySelector('.start-uninstall-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'start-uninstall-menu';
    menu.innerHTML = '<div class="start-uninstall-item">卸载 ' + appName + '</div>';
    menu.style.cssText = 'position:fixed;z-index:99999;background:rgba(30,30,35,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px;box-shadow:0 8px 28px rgba(0,0,0,0.5);min-width:160px';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    menu.querySelector('.start-uninstall-item').style.cssText = 'padding:8px 14px;font-size:13px;color:#f87171;cursor:pointer;border-radius:6px;transition:background 0.12s';
    menu.querySelector('.start-uninstall-item').addEventListener('mouseenter', function() { this.style.background = 'rgba(248,113,113,0.12)'; });
    menu.querySelector('.start-uninstall-item').addEventListener('mouseleave', function() { this.style.background = ''; });

    menu.querySelector('.start-uninstall-item').addEventListener('click', () => {
        menu.remove();
        if (confirm('确定要卸载 "' + appName + '" 吗？')) {
            const idx = state.installedApps.findIndex(a => a.id === appId);
            if (idx >= 0) state.installedApps.splice(idx, 1);
            delete state.thirdPartyAppData[appId];
            localStorage.setItem('mxos_installed_apps', JSON.stringify(state.installedApps));
            updateAppStartMenu();
            if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                window.MXOS.dialog.toast('已卸载: ' + appName, 'success');
            }
        }
    });

    document.body.appendChild(menu);

    const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('contextmenu', closeMenu);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', closeMenu);
    }, 0);
}

export function launchThirdPartyApp(app) {
    const appData = state.thirdPartyAppData[app.id] || app;

    if (!appData.appBin) {
        if (window.MXOS.dialog && window.MXOS.dialog.toast) window.MXOS.dialog.toast(`应用 "${app.name}" 缺少 app.bin 文件，请重新安装`, 'error');
        return;
    }

    const winConfig = appData.window || { width: 800, height: 600 };
    const appConfigId = 'thirdparty_' + app.id;
    appConfigs[appConfigId] = {
        title: appData.name,
        icon: appData.icon,
        width: winConfig.width || 800,
        height: winConfig.height || 600,
        minWidth: winConfig.minWidth || 400,
        minHeight: winConfig.minHeight || 300,
        resizable: winConfig.resizable !== false,
        content: 'thirdparty',
        appData: appData
    };

    createWindow(appConfigId);
}

async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('JSZip 加载失败'));
        document.head.appendChild(script);
    });
}

function escapeInstallerHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function normalizeMxPackagePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function validateMxSvgPngIconPath(iconPath) {
    const normalized = normalizeMxPackagePath(iconPath);
    if (!normalized) throw new Error('manifest.icon 缺失，必须指向包内 svg.png');
    if (/^(https?:|data:|blob:)/i.test(normalized)) throw new Error('manifest.icon 必须是包内 svg.png 相对路径，不能是 URL 或 data URI');
    if (normalized.split('/').pop() !== 'svg.png') throw new Error('manifest.icon 必须指向文件名严格为 svg.png 的包内图标');
    return normalized;
}


export async function handleInstallerFileSimple(file, contentEl, currentViewRef, renderInstallerRef) {
    if (!file.name.endsWith('.mx')) {
        alert('请选择 .mx 格式的文件');
        return false;
    }

    contentEl.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;justify-content:center;align-items:center">' +
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" style="margin-bottom:20px;color:var(--accent-color);animation:icon-spin 1s linear infinite"><use href="#icon-loading"/></svg>' +
        '<h3 style="margin:0 0 8px 0">正在解压安装包...</h3>' +
        '<div class="installer-progress" style="width:300px"><div class="installer-progress-bar" id="progressBar"></div></div>' +
        '</div>';

    const progressBar = document.getElementById('progressBar');
    const setProgress = value => { if (progressBar) progressBar.style.width = value + '%'; };

    try {
        const arrayBuffer = await file.arrayBuffer();
        const header = new Uint8Array(arrayBuffer.slice(0, 4));
        if (header.length < 4 || header[0] !== 0x50 || header[1] !== 0x4b) {
            let preview = '';
            try { preview = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 120))).replace(/\s+/g, ' ').slice(0, 100); } catch (e) {}
            throw new Error('安装包不是有效的 .mx zip 文件。请清理旧缓存后重新从商店下载。' + (preview ? ' 返回内容：' + preview : ''));
        }
        setProgress(20);
        await ensureJSZip();
        const zip = await JSZip.loadAsync(arrayBuffer);
        setProgress(45);
        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) throw new Error('manifest.json 不存在');
        let manifest;
        try { manifest = JSON.parse(await manifestFile.async('text')); }
        catch { throw new Error('manifest.json 解析失败'); }
        setProgress(60);
        const appBinFile = zip.file('app.bin');
        if (!appBinFile) throw new Error('app.bin 不存在');
        const iconPath = validateMxSvgPngIconPath(manifest.icon);
        const iconFile = zip.file(iconPath);
        if (!iconFile) throw new Error('mx 包缺少 manifest.icon 指向的 svg.png：' + iconPath);
        const appBinContent = await appBinFile.async('text');
        const iconDataUrl = 'data:image/png;base64,' + await iconFile.async('base64');
        setProgress(75);
        const appFiles = {};
        const filePromises = [];
        zip.forEach((relativePath, fileEntry) => {
            if (!fileEntry.dir) filePromises.push(fileEntry.async('blob').then(blob => { appFiles[relativePath] = blob; }));
        });
        await Promise.all(filePromises);
        setProgress(90);
        const appData = {
            id: manifest.id || 'app_' + Date.now(),
            name: manifest.name || '未知应用',
            version: manifest.version || '1.0.0',
            description: manifest.description || '',
            icon: iconDataUrl,
            manifestIconPath: iconPath,
            window: manifest.window || { width: 800, height: 600 },
            installDate: new Date().toISOString(),
            appBin: appBinContent,
            files: appFiles,
            permissions: manifest.permissions || []
        };
        if (window.MXOS && window.MXOS.Sandbox && typeof window.MXOS.Sandbox.showInstallPermissionDialog === 'function') {
            const declaredPerms = window.MXOS.Sandbox.permissions ? window.MXOS.Sandbox.permissions.parseManifestPermissions(manifest) : [];
            if (declaredPerms.length > 0) {
                const existing = state.installedApps.find(a => a.id === appData.id);
                if (!existing) appData._installPermissionResult = await window.MXOS.Sandbox.showInstallPermissionDialog(appData, declaredPerms);
            }
        }
        const existingIndex = state.installedApps.findIndex(a => a.id === appData.id);
        if (existingIndex >= 0) state.installedApps[existingIndex] = appData;
        else state.installedApps.push(appData);
        state.thirdPartyAppData[appData.id] = appData;
        localStorage.setItem('mxos_installed_apps', JSON.stringify(state.installedApps));
        updateAppStartMenu();
        setProgress(100);
        await new Promise(r => setTimeout(r, 500));
        renderInstallerRef();
        if (window.MXOS.dialog && window.MXOS.dialog.toast) window.MXOS.dialog.toast('应用 "' + appData.name + '" 安装成功', 'success');
        return true;
    } catch (error) {
        contentEl.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;justify-content:center;align-items:center;padding:20px;text-align:center">' +
            '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" style="margin-bottom:20px;color:#ef4444"><use href="#icon-close"/></svg>' +
            '<h3 style="margin:0 0 8px 0">安装失败</h3>' +
            '<p style="color:#9ca3af;font-size:14px;max-width:420px">' + escapeInstallerHtml(error.message) + '</p>' +
            '<button id="retryBtn" style="margin-top:20px;background:#3b82f6;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer">返回</button>' +
            '</div>';
        document.getElementById('retryBtn').onclick = () => { renderInstallerRef(); };
        return false;
    }
}


