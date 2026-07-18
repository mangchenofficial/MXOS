import { state, appConfigs, iconSvg } from '../state.js';
import { updateTaskbar, getTaskbarItemForWindow } from '../core.js';

const STORAGE_KEY = 'mxos_virtual_desktops';
const MAX_DESKTOPS = 4;
const TASK_VIEW_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><rect x="6" y="12" width="5" height="4" rx="1"/><rect x="13" y="12" width="5" height="4" rx="1"/></svg>';
const PLUS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

let overlayEl = null;
let isOpen = false;
let desktops = [];
let currentDesktopId = null;
let desktopCounter = 0;

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (Array.isArray(saved.desktops) && saved.desktops.length > 0) {
            desktops = saved.desktops.slice(0, MAX_DESKTOPS);
            currentDesktopId = saved.currentDesktopId || desktops[0].id;
        } else {
            desktops = [{ id: 'd1', name: '桌面 1' }];
            currentDesktopId = 'd1';
        }
        desktopCounter = saved.desktopCounter || desktops.length;
    } catch {
        desktops = [{ id: 'd1', name: '桌面 1' }];
        currentDesktopId = 'd1';
        desktopCounter = 1;
    }
    if (!desktops.find(d => d.id === currentDesktopId)) {
        currentDesktopId = desktops[0].id;
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            desktops,
            currentDesktopId,
            desktopCounter
        }));
    } catch {}
}

function list() {
    return desktops.map(d => ({ ...d }));
}

function getCurrentDesktop() {
    return currentDesktopId;
}

function ensureWindowDesktopId(windowObj) {
    if (!windowObj) return;
    if (!windowObj.desktopId) {
        windowObj.desktopId = currentDesktopId;
    }
    if (!desktops.find(d => d.id === windowObj.desktopId)) {
        windowObj.desktopId = currentDesktopId;
    }
}

function applyDesktopVisibility() {
    state.windows.forEach(w => {
        ensureWindowDesktopId(w);
        const visible = w.desktopId === currentDesktopId;
        if (visible) {
            if (w.minimized) {
                w.element.style.display = 'none';
            } else {
                w.element.style.display = 'flex';
            }
        } else {
            w.element.style.display = 'none';
        }
    });
}

function switchTo(id, animate = true) {
    if (!desktops.find(d => d.id === id)) return false;
    if (id === currentDesktopId) {
        if (isOpen) close();
        return true;
    }
    const oldId = currentDesktopId;
    currentDesktopId = id;
    saveState();

    if (animate) {
        const direction = desktops.findIndex(d => d.id === id) > desktops.findIndex(d => d.id === oldId) ? 1 : -1;
        animateDesktopSwitch(direction);
    }

    setTimeout(() => {
        applyDesktopVisibility();
        try { updateTaskbar(); } catch {}
    }, animate ? 50 : 0);

    if (isOpen) renderTaskView();
    return true;
}

function animateDesktopSwitch(direction) {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    const offset = 60 * direction;
    desktop.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    desktop.style.transform = `translateX(${offset}px)`;
    desktop.style.opacity = '0.4';
    setTimeout(() => {
        desktop.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
        desktop.style.transform = 'translateX(0)';
        desktop.style.opacity = '1';
        setTimeout(() => {
            desktop.style.transition = '';
            desktop.style.transform = '';
            desktop.style.opacity = '';
        }, 360);
    }, 50);

    const taskbar = document.getElementById('taskbar');
    if (taskbar) {
        taskbar.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
        taskbar.style.transform = `translateX(${offset * 0.5}px)`;
        taskbar.style.opacity = '0.7';
        setTimeout(() => {
            taskbar.style.transform = 'translateX(0)';
            taskbar.style.opacity = '1';
            setTimeout(() => {
                taskbar.style.transition = '';
                taskbar.style.transform = '';
                taskbar.style.opacity = '';
            }, 360);
        }, 50);
    }
}

function create() {
    if (desktops.length >= MAX_DESKTOPS) return null;
    desktopCounter++;
    const newDesktop = {
        id: 'd' + desktopCounter,
        name: '桌面 ' + desktopCounter
    };
    desktops.push(newDesktop);
    saveState();
    switchTo(newDesktop.id, true);
    if (isOpen) renderTaskView();
    return newDesktop;
}

function remove(id) {
    if (desktops.length <= 1) return false;
    const idx = desktops.findIndex(d => d.id === id);
    if (idx === -1) return false;

    const targetDesktop = desktops[0].id === id ? desktops[1].id : desktops[0].id;

    state.windows.forEach(w => {
        if (w.desktopId === id) {
            w.desktopId = targetDesktop;
        }
    });

    desktops.splice(idx, 1);

    if (currentDesktopId === id) {
        currentDesktopId = targetDesktop;
        applyDesktopVisibility();
        try { updateTaskbar(); } catch {}
    }
    saveState();
    if (isOpen) renderTaskView();
    return true;
}

function injectStyles() {
    if (document.getElementById('vd-styles')) return;
    const style = document.createElement('style');
    style.id = 'vd-styles';
    style.textContent = `
#taskViewOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 14, 20, 0.78);
    backdrop-filter: blur(28px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.1);
    z-index: 5000;
    display: none;
    flex-direction: column;
    padding: 40px 60px 20px;
    color: #fff;
    opacity: 0;
    transition: opacity 0.25s ease;
    overflow: hidden;
}
#taskViewOverlay.show {
    display: flex;
    opacity: 1;
    animation: tvFadeIn 0.3s ease;
}
@keyframes tvFadeIn {
    from { opacity: 0; backdrop-filter: blur(0px); }
    to { opacity: 1; backdrop-filter: blur(28px); }
}
.tv-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
}
.tv-title {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
}
.tv-close-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    color: #fff;
}
.tv-close-btn svg { width: 18px; height: 18px; }
.tv-close-btn:hover {
    background: rgba(255, 255, 255, 0.22);
    transform: rotate(90deg);
}
.tv-windows-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    grid-auto-rows: 180px;
    gap: 18px;
    overflow-y: auto;
    padding: 4px;
    align-content: start;
}
.tv-windows-grid::-webkit-scrollbar { width: 8px; }
.tv-windows-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 4px; }
.tv-window-card {
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    animation: tvCardIn 0.35s cubic-bezier(0.34, 1.4, 0.64, 1) backwards;
}
@keyframes tvCardIn {
    from { opacity: 0; transform: translateY(20px) scale(0.92); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
.tv-window-card:hover {
    transform: translateY(-4px) scale(1.02);
    border-color: rgba(96, 165, 250, 0.7);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(96, 165, 250, 0.4);
}
.tv-window-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.25);
    font-size: 13px;
    flex-shrink: 0;
}
.tv-window-card-header svg, .tv-window-card-header img {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}
.tv-window-card-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #fff;
}
.tv-window-card-close {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
    color: #cbd5e1;
}
.tv-window-card:hover .tv-window-card-close {
    opacity: 1;
}
.tv-window-card-close:hover {
    background: rgba(239, 68, 68, 0.6);
    color: #fff;
}
.tv-window-card-close svg { width: 12px; height: 12px; }
.tv-window-card-thumb {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}
.tv-window-card-thumb-content {
    transform-origin: top left;
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
}
.tv-window-card-thumb-placeholder {
    color: rgba(255, 255, 255, 0.3);
    font-size: 13px;
    text-align: center;
    padding: 20px;
}
.tv-empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
    padding: 60px 20px;
    gap: 12px;
}
.tv-empty svg { width: 64px; height: 64px; opacity: 0.4; }
.tv-desktops-bar {
    display: flex;
    gap: 12px;
    padding: 16px 0 4px;
    overflow-x: auto;
    align-items: center;
}
.tv-desktops-bar::-webkit-scrollbar { height: 6px; }
.tv-desktops-bar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 3px; }
.tv-desktop-pill {
    min-width: 200px;
    height: 110px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 2px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 10px 14px;
    position: relative;
    flex-shrink: 0;
    color: #fff;
}
.tv-desktop-pill:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
}
.tv-desktop-pill.active {
    border-color: var(--accent-color, #3b82f6);
    background: rgba(59, 130, 246, 0.22);
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.25);
}
.tv-desktop-pill-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
}
.tv-desktop-pill-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
}
.tv-desktop-pill-preview {
    flex: 1;
    display: flex;
    gap: 3px;
    padding: 4px 0;
    overflow: hidden;
}
.tv-desktop-pill-preview-dot {
    width: 24px;
    height: 18px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
}
.tv-desktop-pill-close {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #fff;
}
.tv-desktop-pill:hover .tv-desktop-pill-close {
    display: flex;
}
.tv-desktop-pill-close:hover {
    background: rgba(239, 68, 68, 0.8);
}
.tv-desktop-pill-close svg { width: 10px; height: 10px; }
.tv-add-desktop {
    min-width: 110px;
    height: 110px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 2px dashed rgba(255, 255, 255, 0.2);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s ease;
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.7);
}
.tv-add-desktop svg { width: 24px; height: 24px; }
.tv-add-desktop:hover {
    background: rgba(59, 130, 246, 0.18);
    border-color: var(--accent-color, #3b82f6);
    color: #fff;
    transform: translateY(-2px);
}
.tv-add-desktop-label {
    font-size: 11px;
}
.tv-add-desktop.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
}
.taskbar-taskview-btn {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    position: relative;
    color: #fff;
    margin-left: 4px;
}
.taskbar-taskview-btn:hover {
    background: var(--hover-bg);
}
.taskbar-taskview-btn:active {
    transform: scale(0.92);
}
.taskbar-taskview-btn svg {
    width: 20px;
    height: 20px;
}
.taskbar-taskview-btn.active {
    background: rgba(59, 130, 246, 0.3);
}
.taskbar-item.other-desktop {
    opacity: 0.45;
}
.taskbar-item.other-desktop::after {
    background: rgba(156, 163, 175, 0.6) !important;
}
    `;
    document.head.appendChild(style);
}

function addTaskbarButton() {
    const taskbarItems = document.getElementById('taskbarItems');
    if (!taskbarItems) return;
    if (document.querySelector('.taskbar-taskview-btn')) return;
    const btn = document.createElement('div');
    btn.className = 'taskbar-taskview-btn';
    btn.title = '任务视图 (Win+Tab)';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', '任务视图');
    btn.setAttribute('tabindex', '0');
    btn.innerHTML = TASK_VIEW_ICON;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
    });
    btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    });
    taskbarItems.insertBefore(btn, taskbarItems.firstChild);
}

function renderWindowCards() {
    const grid = overlayEl.querySelector('.tv-windows-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const currentWindows = state.windows.filter(w => {
        ensureWindowDesktopId(w);
        return w.desktopId === currentDesktopId;
    });

    if (currentWindows.length === 0) {
        grid.innerHTML = `<div class="tv-empty">${TASK_VIEW_ICON}<div>此桌面没有打开的窗口</div></div>`;
        return;
    }

    currentWindows.forEach((w, i) => {
        const config = appConfigs[w.appId] || { title: w.appId, icon: null };
        const card = document.createElement('div');
        card.className = 'tv-window-card';
        card.style.animationDelay = (i * 50) + 'ms';
        card.dataset.appId = w.appId;

        const iconHtml = config.icon ? iconSvg(config.icon, 16) : '';
        const title = config.title || w.appId;

        card.innerHTML = `
            <div class="tv-window-card-header">
                ${iconHtml}
                <div class="tv-window-card-title">${escapeHtml(title)}</div>
                <div class="tv-window-card-close" title="关闭">${CLOSE_ICON}</div>
            </div>
            <div class="tv-window-card-thumb">
                <div class="tv-window-card-thumb-placeholder">${iconHtml || TASK_VIEW_ICON}<div style="margin-top:8px">${escapeHtml(title)}</div></div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.tv-window-card-close')) return;
            focusWindow(w);
            close();
        });
        card.querySelector('.tv-window-card-close').addEventListener('click', (e) => {
            e.stopPropagation();
            const closeBtn = w.element.querySelector('.window-control.close');
            if (closeBtn) closeBtn.click();
            setTimeout(renderTaskView, 260);
        });

        grid.appendChild(card);
    });
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function focusWindow(w) {
    if (w.minimized) {
        const item = getTaskbarItemForWindow(w);
        if (item) {
            item.click();
        }
    } else {
        w.element.style.display = 'flex';
        const ev = new MouseEvent('mousedown', { bubbles: true });
        w.element.dispatchEvent(ev);
    }
}

function renderDesktopsBar() {
    const bar = overlayEl.querySelector('.tv-desktops-bar');
    if (!bar) return;
    bar.innerHTML = '';

    desktops.forEach((d, idx) => {
        const pill = document.createElement('div');
        pill.className = 'tv-desktop-pill' + (d.id === currentDesktopId ? ' active' : '');
        pill.dataset.desktopId = d.id;

        const count = state.windows.filter(w => {
            ensureWindowDesktopId(w);
            return w.desktopId === d.id;
        }).length;

        const previewDots = Math.min(count, 6);
        let dotsHtml = '';
        for (let i = 0; i < previewDots; i++) {
            dotsHtml += '<div class="tv-desktop-pill-preview-dot"></div>';
        }

        pill.innerHTML = `
            <div class="tv-desktop-pill-name">${escapeHtml(d.name)}</div>
            <div class="tv-desktop-pill-preview">${dotsHtml}</div>
            <div class="tv-desktop-pill-count">${count} 个窗口</div>
            ${desktops.length > 1 ? `<div class="tv-desktop-pill-close" title="关闭桌面">${CLOSE_ICON}</div>` : ''}
        `;

        pill.addEventListener('click', (e) => {
            if (e.target.closest('.tv-desktop-pill-close')) return;
            switchTo(d.id, true);
        });
        const closeBtn = pill.querySelector('.tv-desktop-pill-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                remove(d.id);
            });
        }

        bar.appendChild(pill);
    });

    const addBtn = document.createElement('div');
    addBtn.className = 'tv-add-desktop' + (desktops.length >= MAX_DESKTOPS ? ' disabled' : '');
    addBtn.innerHTML = `${PLUS_ICON}<div class="tv-add-desktop-label">新建桌面</div>`;
    addBtn.addEventListener('click', () => {
        if (desktops.length < MAX_DESKTOPS) create();
    });
    bar.appendChild(addBtn);
}

function renderTaskView() {
    if (!overlayEl) return;
    renderWindowCards();
    renderDesktopsBar();
    const btn = document.querySelector('.taskbar-taskview-btn');
    if (btn) btn.classList.toggle('active', isOpen);
}

function open() {
    if (isOpen) return;
    if (!overlayEl) overlayEl = buildOverlay();
    if (!overlayEl) return;
    overlayEl.style.display = 'flex';
    requestAnimationFrame(() => {
        overlayEl.classList.add('show');
    });
    isOpen = true;
    renderTaskView();
    const btn = document.querySelector('.taskbar-taskview-btn');
    if (btn) btn.classList.add('active');
}

function close() {
    if (!isOpen || !overlayEl) return;
    overlayEl.classList.remove('show');
    setTimeout(() => {
        if (overlayEl) overlayEl.style.display = 'none';
    }, 250);
    isOpen = false;
    const btn = document.querySelector('.taskbar-taskview-btn');
    if (btn) btn.classList.remove('active');
}

function toggle() {
    if (isOpen) close();
    else open();
}

function buildOverlay() {
    const el = document.getElementById('taskViewOverlay');
    if (!el) return null;
    el.innerHTML = `
        <div class="tv-header">
            <div class="tv-title">任务视图</div>
            <div class="tv-close-btn" role="button" aria-label="关闭">${CLOSE_ICON}</div>
        </div>
        <div class="tv-windows-grid"></div>
        <div class="tv-desktops-bar"></div>
    `;
    el.querySelector('.tv-close-btn').addEventListener('click', close);
    el.addEventListener('click', (e) => {
        if (e.target === el) close();
    });
    return el;
}

function bindOutsideClick() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            close();
            e.preventDefault();
        }
    });
}

function patchCreateWindow() {
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.classList && node.classList.contains('window')) {
                    setTimeout(() => {
                        const w = state.windows.find(win => win.element === node);
                        if (w) {
                            ensureWindowDesktopId(w);
                            if (w.desktopId !== currentDesktopId) {
                                w.element.style.display = 'none';
                            }
                        }
                    }, 0);
                }
            });
        }
    });
    observer.observe(document.body, { childList: true });
}

function patchWindowClose() {
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.removedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.classList && node.classList.contains('window')) {
                    if (isOpen) renderTaskView();
                }
            });
        }
    });
    observer.observe(document.body, { childList: true });
}

function init() {
    loadState();
    injectStyles();
    addTaskbarButton();
    overlayEl = buildOverlay();
    bindOutsideClick();
    patchCreateWindow();
    patchWindowClose();

    window.MXOS = window.MXOS || {};
    window.MXOS.Desktop = {
        list,
        switchTo: (id) => switchTo(id, true),
        create,
        remove,
        getCurrentDesktop,
        openTaskView: open,
        closeTaskView: close,
        toggleTaskView: toggle,
        isOpen: () => isOpen
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { list, switchTo, create, remove, open, close, toggle };
