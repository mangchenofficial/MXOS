import { createWindow } from './core.js';
import { state, appConfigs } from './state.js';
import { debounce } from './utils/debounce.js';

function isImageIcon(icon) {
    return typeof icon === 'string' && /^(https?:|\/api\/|data:image|blob:)/.test(icon);
}

function updateDesktopIconImage(iconEl, iconUrl) {
    if (!isImageIcon(iconUrl)) return;
    const svg = iconEl.querySelector('svg');
    if (!svg) return;
    const img = document.createElement('img');
    img.src = iconUrl;
    img.alt = '';
    img.style.cssText = 'width:40px;height:40px;object-fit:contain;display:block';
    img.onerror = () => { img.onerror = null; img.style.visibility = 'hidden'; img.title = '图标加载失败'; };
    svg.replaceWith(img);
}

function getIconPositions() {
    try {
        return JSON.parse(localStorage.getItem('mxos_icon_positions') || '{}');
    } catch {
        return {};
    }
}

let pendingIconSaves = {};
const flushIconSaves = debounce(function () {
    try {
        const existing = getIconPositions();
        const merged = Object.assign(existing, pendingIconSaves);
        localStorage.setItem('mxos_icon_positions', JSON.stringify(merged));
        pendingIconSaves = {};
    } catch (e) {}
}, 300);

function saveIconPositionsBatched(positionsObj) {
    Object.assign(pendingIconSaves, positionsObj);
    flushIconSaves();
}

let startMenuCloseTimer = null;
let startMenuCloseCleanup = null;

function cancelPendingStartMenuClose(startMenu) {
    if (startMenuCloseTimer) {
        clearTimeout(startMenuCloseTimer);
        startMenuCloseTimer = null;
    }
    if (startMenuCloseCleanup && startMenu) {
        startMenu.removeEventListener('animationend', startMenuCloseCleanup);
    }
    startMenuCloseCleanup = null;
}

export function openStartMenu() {
    const startMenu = document.getElementById('startMenu');
    if (!startMenu) return;
    const wasHiding = startMenu.classList.contains('hiding');
    cancelPendingStartMenuClose(startMenu);

    if (wasHiding) {
        startMenu.classList.remove('hiding');
        startMenu.classList.remove('show');
        void startMenu.offsetWidth;
    }

    startMenu.classList.add('show');
    const startButton = document.getElementById('startButton');
    if (startButton) startButton.setAttribute('aria-expanded', 'true');
}

export function closeStartMenu() {
    const startMenu = document.getElementById('startMenu');
    if (!startMenu || !startMenu.classList.contains('show')) return;
    if (startMenu.classList.contains('hiding')) return;

    startMenu.classList.add('hiding');
    const startButton = document.getElementById('startButton');
    if (startButton) startButton.setAttribute('aria-expanded', 'false');

    let done = false;
    const cleanup = (event) => {
        if (event && (event.target !== startMenu || event.animationName !== 'startMenuSlideOut')) return;
        if (done) return;
        done = true;
        startMenu.classList.remove('show');
        startMenu.classList.remove('hiding');
        cancelPendingStartMenuClose(startMenu);
    };

    startMenuCloseCleanup = cleanup;
    startMenu.addEventListener('animationend', cleanup);
    startMenuCloseTimer = setTimeout(() => cleanup(), 360);
}

export function toggleStartMenu() {
    const startMenu = document.getElementById('startMenu');
    if (!startMenu) return;
    if (startMenu.classList.contains('show') && !startMenu.classList.contains('hiding')) {
        closeStartMenu();
    } else {
        openStartMenu();
    }
}

window.MXOS = window.MXOS || {};
window.MXOS.openStartMenu = openStartMenu;
window.MXOS.closeStartMenu = closeStartMenu;
window.MXOS.toggleStartMenu = toggleStartMenu;

export function updateClock() {
    const now = new Date();
    document.getElementById('time').textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('date').textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });

    if (document.getElementById('lockTime')) {
        document.getElementById('lockTime').textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('lockDate').textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    }
}

export function unlockScreen() {
    if (!state.isLocked) return;
    state.isLocked = false;
    const lockScreen = document.getElementById('lock-screen');
    lockScreen.classList.add('hidden');
    setTimeout(() => {
        lockScreen.style.display = 'none';
    }, 500);
    if (window.MXOS && window.MXOS.Lock && typeof window.MXOS.Lock.hideAuthInput === 'function') {
        window.MXOS.Lock.hideAuthInput();
    }
}

window.unlockScreen = unlockScreen;

function attemptUnlock() {
    if (!state.isLocked) return;
    const lockType = (window.MXOS && window.MXOS.Lock) ? window.MXOS.Lock.getType() : 'none';
    if (lockType === 'none') {
        unlockScreen();
    } else {
        window.MXOS.Lock.showAuthInput();
    }
}

document.getElementById('lock-screen').addEventListener('click', attemptUnlock);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.isLocked) {
        const lockType = (window.MXOS && window.MXOS.Lock) ? window.MXOS.Lock.getType() : 'none';
        if (lockType === 'none') {
            unlockScreen();
        } else if (window.MXOS.Lock) {
            window.MXOS.Lock.showAuthInput();
        }
    }
});

updateClock();
setInterval(updateClock, 1000);

let mxbakDropOverlay = null;
function showMxbakDropOverlay() {
    if (mxbakDropOverlay) return;
    mxbakDropOverlay = document.createElement('div');
    mxbakDropOverlay.id = 'mxos-mxbak-drop-overlay';
    mxbakDropOverlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);pointer-events:none';
    mxbakDropOverlay.innerHTML = `
        <div style="background:var(--glass-bg,rgba(20,25,35,0.9));border:2px dashed var(--accent-color,#60a5fa);border-radius:16px;padding:40px 56px;text-align:center;max-width:480px">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-color,#60a5fa);margin:0 auto 16px;display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <div style="font-size:18px;font-weight:600;color:#fff;margin-bottom:6px">释放以恢复备份</div>
            <div style="font-size:13px;color:#9ca3af">检测到 .mxbak 文件，松开鼠标即可恢复</div>
        </div>
    `;
    document.body.appendChild(mxbakDropOverlay);
}
function hideMxbakDropOverlay() {
    if (mxbakDropOverlay) {
        mxbakDropOverlay.remove();
        mxbakDropOverlay = null;
    }
}

function setupMxbakDropZone() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    let dragCounter = 0;

    desktop.addEventListener('dragenter', (e) => {
        if (!e.dataTransfer || !e.dataTransfer.types) return;
        const hasFiles = Array.from(e.dataTransfer.types).indexOf('Files') >= 0;
        if (!hasFiles) return;
        e.preventDefault();
        dragCounter++;
        showMxbakDropOverlay();
    });

    desktop.addEventListener('dragover', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        }
    });

    desktop.addEventListener('dragleave', (e) => {
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) hideMxbakDropOverlay();
    });

    desktop.addEventListener('drop', async (e) => {
        dragCounter = 0;
        hideMxbakDropOverlay();
        if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const mxbakFile = files.find(f => f.name && f.name.toLowerCase().endsWith('.mxbak'));
        if (!mxbakFile) return;
        if (window.MXOS && window.MXOS.Backup && typeof window.MXOS.Backup.restore === 'function') {
            await window.MXOS.Backup.restore(mxbakFile);
        }
    });
}

export function initDesktop() {
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu && !contextMenu.querySelector('[data-action="new-sticky-note"]')) {
        const newFolderItem = contextMenu.querySelector('[data-action="new-folder"]');
        const stickyItem = document.createElement('div');
        stickyItem.className = 'context-menu-item';
        stickyItem.dataset.action = 'new-sticky-note';
        stickyItem.setAttribute('role', 'menuitem');
        stickyItem.setAttribute('tabindex', '-1');
        stickyItem.innerHTML = '<svg class="icon"><use href="#icon-grid"/></svg> 新建便签';
        if (newFolderItem && newFolderItem.nextSibling) {
            contextMenu.insertBefore(stickyItem, newFolderItem.nextSibling);
        } else {
            contextMenu.appendChild(stickyItem);
        }
    }

    if (contextMenu && !contextMenu.querySelector('[data-action="gen-qrcode"]')) {
        const personalizeItem = contextMenu.querySelector('[data-action="personalize"]');
        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        divider.setAttribute('role', 'separator');
        const qrItem = document.createElement('div');
        qrItem.className = 'context-menu-item';
        qrItem.dataset.action = 'gen-qrcode';
        qrItem.setAttribute('role', 'menuitem');
        qrItem.setAttribute('tabindex', '-1');
        qrItem.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="18" y1="14" x2="18" y2="18"/><line x1="21" y1="18" x2="21" y2="21"/></svg> 生成二维码';
        qrItem.style.display = 'none';
        const ocrItem = document.createElement('div');
        ocrItem.className = 'context-menu-item';
        ocrItem.dataset.action = 'ocr-image';
        ocrItem.setAttribute('role', 'menuitem');
        ocrItem.setAttribute('tabindex', '-1');
        ocrItem.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h12M9 3v2c0 4.418-2.239 8-5 8"/><path d="M5 9c0 2.144 2.952 3.908 6.7 4"/><path d="M12 20l4-9 4 9"/><path d="M19.1 18h-6.2"/></svg> 识别文字';
        ocrItem.style.display = 'none';
        const scanItem = document.createElement('div');
        scanItem.className = 'context-menu-item';
        scanItem.dataset.action = 'scan-qrcode';
        scanItem.setAttribute('role', 'menuitem');
        scanItem.setAttribute('tabindex', '-1');
        scanItem.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg> 扫描二维码';
        if (personalizeItem) {
            contextMenu.insertBefore(divider, personalizeItem);
            contextMenu.insertBefore(qrItem, personalizeItem);
            contextMenu.insertBefore(ocrItem, personalizeItem);
            contextMenu.insertBefore(scanItem, personalizeItem);
        } else {
            contextMenu.appendChild(divider);
            contextMenu.appendChild(qrItem);
            contextMenu.appendChild(ocrItem);
            contextMenu.appendChild(scanItem);
        }
    }

    const icons = document.querySelectorAll('.desktop-icon');
    icons.forEach(icon => {
        const appId = icon.dataset.app;
        const config = appConfigs[appId];
        if (config && isImageIcon(config.icon)) {
            updateDesktopIconImage(icon, config.icon);
        }
    });

    let draggedIcon = null;
    let iconDragState = null;
    let hasMoved = false;
    const GRID_SIZE = 88;
    const GRID_OFFSET = 12;
    const MOVE_THRESHOLD = 8;
    const LONG_PRESS_DURATION = 500;

    function snapToGrid(value) {
        const relative = value - GRID_OFFSET;
        const snapped = Math.round(relative / GRID_SIZE) * GRID_SIZE;
        return snapped + GRID_OFFSET;
    }

    function saveIconPosition(appId, x, y) {
        saveIconPositionsBatched({ [appId]: { x, y } });
    }

    const ICON_LAYOUT_GRID_KEY = 'mxos_icon_layout_grid';

    function getIconGridMetrics() {
        const maxX = Math.max(GRID_OFFSET, window.innerWidth - 88);
        const maxY = Math.max(GRID_OFFSET, window.innerHeight - 130);
        const rows = Math.max(1, Math.floor((maxY - GRID_OFFSET) / GRID_SIZE) + 1);
        const columns = Math.max(1, Math.floor((maxX - GRID_OFFSET) / GRID_SIZE) + 1);
        return {
            maxX,
            maxY,
            rows,
            columns,
            signature: `${rows}x${columns}`
        };
    }

    function getSavedGridSignature() {
        try {
            return localStorage.getItem(ICON_LAYOUT_GRID_KEY) || '';
        } catch (e) {
            return '';
        }
    }

    function persistIconLayout(changedPositions, signature) {
        flushIconSaves.cancel();
        pendingIconSaves = {};
        try {
            const positions = getIconPositions();
            Object.assign(positions, changedPositions);
            localStorage.setItem('mxos_icon_positions', JSON.stringify(positions));
            localStorage.setItem(ICON_LAYOUT_GRID_KEY, signature);
        } catch (e) {}
    }

    function arrangeIconsByColumns(metrics = getIconGridMetrics()) {
        const positions = {};
        icons.forEach((icon, index) => {
            const row = index % metrics.rows;
            const column = Math.floor(index / metrics.rows);
            const position = {
                x: GRID_OFFSET + column * GRID_SIZE,
                y: GRID_OFFSET + row * GRID_SIZE
            };
            icon.style.left = position.x + 'px';
            icon.style.top = position.y + 'px';
            positions[icon.dataset.app] = position;
        });
        persistIconLayout(positions, metrics.signature);
    }

    function setDefaultIconPositions() {
        const metrics = getIconGridMetrics();

        // 浏览器可容纳的行列数改变后，按“先向下、再向右”的顺序自动重排。
        if (getSavedGridSignature() !== metrics.signature) {
            arrangeIconsByColumns(metrics);
            return;
        }

        const positions = getIconPositions();
        const occupied = new Set();
        const normalizedPositions = {};
        const resolvedPositions = {};
        let nextSlot = 0;

        function positionKey(x, y) {
            return `${x},${y}`;
        }

        function normalizePosition(position) {
            return {
                x: Math.max(GRID_OFFSET, Math.min(metrics.maxX, snapToGrid(position.x))),
                y: Math.max(GRID_OFFSET, Math.min(metrics.maxY, snapToGrid(position.y)))
            };
        }

        // 先预留所有有效旧坐标，避免新增图标挤占后面图标的位置。
        icons.forEach((icon) => {
            const appId = icon.dataset.app;
            if (!positions[appId]) return;
            const position = normalizePosition(positions[appId]);
            const key = positionKey(position.x, position.y);
            if (!occupied.has(key)) {
                normalizedPositions[appId] = position;
                occupied.add(key);
            }
        });

        function findNextFreePosition() {
            const slotCount = Math.max(icons.length, metrics.rows * metrics.columns);
            for (let checked = 0; checked < slotCount; checked++, nextSlot++) {
                const row = nextSlot % metrics.rows;
                const column = Math.floor(nextSlot / metrics.rows);
                const position = {
                    x: GRID_OFFSET + column * GRID_SIZE,
                    y: GRID_OFFSET + row * GRID_SIZE
                };
                if (!occupied.has(positionKey(position.x, position.y))) {
                    nextSlot++;
                    return position;
                }
            }
            return { x: GRID_OFFSET, y: GRID_OFFSET };
        }

        icons.forEach((icon) => {
            const appId = icon.dataset.app;
            let position = normalizedPositions[appId] || null;

            // 新增图标或旧数据发生坐标冲突时，分配下一个空闲网格。
            if (!position) {
                position = findNextFreePosition();
                occupied.add(positionKey(position.x, position.y));
            }

            icon.style.left = position.x + 'px';
            icon.style.top = position.y + 'px';
            resolvedPositions[appId] = position;
        });

        persistIconLayout(resolvedPositions, metrics.signature);
    }

    function getClientPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        } else {
            return { x: e.clientX, y: e.clientY };
        }
    }

    let contextMenuAbortController = null;
    let lastContextMenuPos = { x: 0, y: 0 };

    function getSelectionTextForMenu() {
        const sel = window.getSelection();
        if (sel && sel.toString().trim()) return sel.toString().trim();
        const target = document.activeElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            const start = target.selectionStart ?? 0;
            const end = target.selectionEnd ?? 0;
            if (end > start) return target.value.slice(start, end).trim();
        }
        return '';
    }

    function updateContextMenuItems() {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;
        const text = getSelectionTextForMenu();
        const qrItem = contextMenu.querySelector('[data-action="gen-qrcode"]');
        const ocrItem = contextMenu.querySelector('[data-action="ocr-image"]');
        const scanItem = contextMenu.querySelector('[data-action="scan-qrcode"]');
        if (qrItem) qrItem.style.display = text ? 'flex' : 'none';
        if (ocrItem) ocrItem.style.display = window.MXOS?.OCR ? 'flex' : 'none';
        if (scanItem) scanItem.style.display = window.MXOS?.QRScanner ? 'flex' : 'none';
        const aiAppend = window.MXOS?.AI?.appendContextMenuItems;
        if (typeof aiAppend === 'function') {
            try { aiAppend(contextMenu, text); } catch (e) {}
        }
    }

    function openContextMenuAt(x, y) {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenuAbortController) {
            contextMenuAbortController.abort();
        }
        lastContextMenuPos = { x, y };
        updateContextMenuItems();
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        if (x + menuWidth > window.innerWidth - 8) contextMenu.style.left = (window.innerWidth - menuWidth - 8) + 'px';
        if (y + menuHeight > window.innerHeight - 8) contextMenu.style.top = (window.innerHeight - menuHeight - 8) + 'px';
        contextMenuAbortController = new AbortController();
        document.addEventListener('click', (ev) => {
            if (!ev.target.closest('.context-menu')) {
                closeContextMenu();
            }
        }, { signal: contextMenuAbortController.signal });
    }

    function closeContextMenu() {
        const menu = document.getElementById('contextMenu');
        if (menu) {
            menu.style.display = 'none';
        }
        if (contextMenuAbortController) {
            contextMenuAbortController.abort();
            contextMenuAbortController = null;
        }
    }

    function showContextMenu(e, icon, pos) {
        if (iconDragState && iconDragState.icon === icon) {
            iconDragState.icon.classList.remove('dragging');
            iconDragState.icon.style.zIndex = '';
            iconDragState = null;
            draggedIcon = null;
            document.removeEventListener('mousemove', onIconDrag);
            document.removeEventListener('mouseup', stopIconDrag);
            document.removeEventListener('touchmove', onIconDrag);
            document.removeEventListener('touchend', stopIconDrag);
            document.removeEventListener('touchcancel', stopIconDrag);
        }
        document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
        icon.classList.add('selected');
        openContextMenuAt(pos.x, pos.y);
    }

    let iconContextMenuAbortController = null;
    function showIconContextMenu(e, icon) {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
        icon.classList.add('selected');
        if (iconDragState) {
            iconDragState.icon.classList.remove('dragging');
            iconDragState.icon.style.zIndex = '';
            iconDragState = null;
            draggedIcon = null;
            document.removeEventListener('mousemove', onIconDrag);
            document.removeEventListener('mouseup', stopIconDrag);
            document.removeEventListener('touchmove', onIconDrag);
            document.removeEventListener('touchend', stopIconDrag);
            document.removeEventListener('touchcancel', stopIconDrag);
        }

        let menu = document.getElementById('iconContextMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'iconContextMenu';
            menu.className = 'context-menu';
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', '图标右键菜单');
            menu.innerHTML = `
                <div class="context-menu-item" data-icon-action="open" role="menuitem" tabindex="-1"><svg class="icon"><use href="#icon-folder"/></svg> 打开</div>
                <div class="context-menu-divider" role="separator"></div>
                <div class="context-menu-item" data-icon-action="delete" role="menuitem" tabindex="-1"><svg class="icon"><use href="#icon-refresh"/></svg> 删除</div>
                <div class="context-menu-item" data-icon-action="rename" role="menuitem" tabindex="-1"><svg class="icon"><use href="#icon-grid"/></svg> 重命名</div>
                <div class="context-menu-divider" role="separator"></div>
                <div class="context-menu-item" data-icon-action="properties" role="menuitem" tabindex="-1"><svg class="icon"><use href="#icon-monitor"/></svg> 属性</div>
            `;
            document.body.appendChild(menu);

            menu.addEventListener('click', (ev) => {
                const item = ev.target.closest('.context-menu-item');
                if (!item) return;
                const action = item.dataset.iconAction;
                const targetIcon = menu._targetIcon;
                menu.style.display = 'none';
                if (iconContextMenuAbortController) {
                    iconContextMenuAbortController.abort();
                    iconContextMenuAbortController = null;
                }
                if (!targetIcon) return;
                if (action === 'open') {
                    createWindow(targetIcon.dataset.app);
                } else if (action === 'delete') {
                    const appId = targetIcon.dataset.app;
                    const positions = getIconPositions();
                    if (positions[appId]) {
                        delete positions[appId];
                        try { localStorage.setItem('mxos_icon_positions', JSON.stringify(positions)); } catch (e) {}
                    }
                    targetIcon.remove();
                } else if (action === 'rename') {
                    const span = targetIcon.querySelector('span');
                    const currentName = span ? span.textContent : '';
                    const newName = prompt('重命名图标:', currentName);
                    if (newName && span) span.textContent = newName;
                } else if (action === 'properties') {
                    const appName = targetIcon.dataset.app;
                    const ariaLabel = targetIcon.getAttribute('aria-label') || appName;
                    alert('图标: ' + ariaLabel + '\n应用 ID: ' + appName);
                }
            });
        }
        menu._targetIcon = icon;

        if (iconContextMenuAbortController) {
            iconContextMenuAbortController.abort();
        }
        menu.style.display = 'block';
        let x = e.clientX, y = e.clientY;
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        if (x + menuWidth > window.innerWidth - 8) x = window.innerWidth - menuWidth - 8;
        if (y + menuHeight > window.innerHeight - 8) y = window.innerHeight - menuHeight - 8;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        iconContextMenuAbortController = new AbortController();
        document.addEventListener('click', (ev) => {
            if (!ev.target.closest('#iconContextMenu')) {
                menu.style.display = 'none';
                if (iconContextMenuAbortController) {
                    iconContextMenuAbortController.abort();
                    iconContextMenuAbortController = null;
                }
            }
        }, { signal: iconContextMenuAbortController.signal });
    }

    function startIconDrag(e, icon) {
        if (e.button !== 0) return;
        e.preventDefault();
        const pos = getClientPos(e);
        hasMoved = false;
        icon.classList.add('dragging');
        iconDragState = {
            icon: icon,
            startX: pos.x,
            startY: pos.y,
            startLeft: parseInt(icon.style.left) || 0,
            startTop: parseInt(icon.style.top) || 0
        };
        draggedIcon = icon;
        icon.style.zIndex = 1000;
        document.addEventListener('mousemove', onIconDrag, { passive: false });
        document.addEventListener('mouseup', stopIconDrag);
        document.addEventListener('touchmove', onIconDrag, { passive: false });
        document.addEventListener('touchend', stopIconDrag);
        document.addEventListener('touchcancel', stopIconDrag);
    }

    function onIconDrag(e) {
        if (!iconDragState) return;
        e.preventDefault();
        const pos = getClientPos(e);
        const dx = pos.x - iconDragState.startX;
        const dy = pos.y - iconDragState.startY;
        if (!hasMoved && (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD)) {
            hasMoved = true;
        }
        let newLeft = iconDragState.startLeft + dx;
        let newTop = iconDragState.startTop + dy;
        newLeft = Math.max(GRID_OFFSET, Math.min(window.innerWidth - 88, newLeft));
        newTop = Math.max(GRID_OFFSET, Math.min(window.innerHeight - 130, newTop));
        iconDragState.icon.style.left = newLeft + 'px';
        iconDragState.icon.style.top = newTop + 'px';
    }

    function stopIconDrag(e) {
        if (!iconDragState) return;
        iconDragState.icon.classList.remove('dragging');
        const pos = getClientPos(e);
        const dx = pos.x - iconDragState.startX;
        const dy = pos.y - iconDragState.startY;
        if (!hasMoved && (Math.abs(dx) <= MOVE_THRESHOLD && Math.abs(dy) <= MOVE_THRESHOLD)) {
            document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
            iconDragState.icon.classList.add('selected');
        } else {
            let newLeft = parseInt(iconDragState.icon.style.left);
            let newTop = parseInt(iconDragState.icon.style.top);
            newLeft = snapToGrid(newLeft);
            newTop = snapToGrid(newTop);
            newLeft = Math.max(GRID_OFFSET, Math.min(window.innerWidth - 88, newLeft));
            newTop = Math.max(GRID_OFFSET, Math.min(window.innerHeight - 130, newTop));

            const isOccupied = Array.from(icons).some((otherIcon) => {
                if (otherIcon === iconDragState.icon) return false;
                const otherLeft = parseInt(otherIcon.style.left);
                const otherTop = parseInt(otherIcon.style.top);
                return otherLeft === newLeft && otherTop === newTop;
            });

            if (isOccupied) {
                // 目标网格已有图标时，恢复拖动前的位置，不修改已保存坐标。
                iconDragState.icon.style.left = iconDragState.startLeft + 'px';
                iconDragState.icon.style.top = iconDragState.startTop + 'px';
            } else {
                iconDragState.icon.style.left = newLeft + 'px';
                iconDragState.icon.style.top = newTop + 'px';
                const appId = iconDragState.icon.dataset.app;
                saveIconPosition(appId, newLeft, newTop);
            }
        }
        iconDragState.icon.style.zIndex = '';
        iconDragState = null;
        draggedIcon = null;
        document.removeEventListener('mousemove', onIconDrag);
        document.removeEventListener('mouseup', stopIconDrag);
        document.removeEventListener('touchmove', onIconDrag);
        document.removeEventListener('touchend', stopIconDrag);
        document.removeEventListener('touchcancel', stopIconDrag);
    }

    icons.forEach(icon => {
        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        let isDoubleClick = false;
        let longPressTimer = null;
        let isLongPressTriggered = false;

        icon.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const now = Date.now();
                const pos = getClientPos(e);
                touchStartPos = pos;
                isLongPressTriggered = false;

                if (now - touchStartTime < 300 &&
                    Math.abs(pos.x - touchStartPos.x) < 30 &&
                    Math.abs(pos.y - touchStartPos.y) < 30) {
                    isDoubleClick = true;
                    createWindow(icon.dataset.app);
                    setTimeout(() => isDoubleClick = false, 300);
                } else {
                    isDoubleClick = false;
                    longPressTimer = setTimeout(() => {
                        isLongPressTriggered = true;
                        showContextMenu(e, icon, pos);
                    }, LONG_PRESS_DURATION);
                    startIconDrag(e, icon);
                }
                touchStartTime = now;
            }
        }, { passive: false });

        icon.addEventListener('touchmove', (e) => {
            if (longPressTimer && !isLongPressTriggered) {
                const pos = getClientPos(e);
                const dx = pos.x - touchStartPos.x;
                const dy = pos.y - touchStartPos.y;
                if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }
        }, { passive: false });

        icon.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        icon.addEventListener('touchcancel', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        icon.addEventListener('mousedown', (e) => startIconDrag(e, icon));

        icon.addEventListener('contextmenu', (e) => showIconContextMenu(e, icon));

        icon.addEventListener('dblclick', () => {
            createWindow(icon.dataset.app);
        });
    });

    setDefaultIconPositions();

    const handleDesktopResize = debounce(() => {
        if (iconDragState) return;
        const metrics = getIconGridMetrics();
        if (getSavedGridSignature() !== metrics.signature) {
            arrangeIconsByColumns(metrics);
        } else {
            setDefaultIconPositions();
        }
    }, 160);
    window.addEventListener('resize', handleDesktopResize);

    document.querySelectorAll('.start-app').forEach(app => {
        app.addEventListener('click', () => {
            createWindow(app.dataset.app);
            closeStartMenu();
        });
    });

    document.getElementById('startButton').addEventListener('click', () => {
        toggleStartMenu();
    });

    const powerBtn = document.getElementById('startMenuPowerBtn');
    const powerMenu = document.getElementById('startPowerMenu');
    if (powerBtn && powerMenu) {
        let powerMenuAbortController = null;

        function closePowerMenu() {
            powerMenu.classList.remove('show');
            powerBtn.setAttribute('aria-expanded', 'false');
            if (powerMenuAbortController) {
                powerMenuAbortController.abort();
                powerMenuAbortController = null;
            }
        }

        function openPowerMenu() {
            powerMenu.classList.add('show');
            powerBtn.setAttribute('aria-expanded', 'true');
            if (powerMenuAbortController) powerMenuAbortController.abort();
            powerMenuAbortController = new AbortController();
            document.addEventListener('click', (ev) => {
                if (!ev.target.closest('#startMenuPowerBtn') && !ev.target.closest('#startPowerMenu')) {
                    closePowerMenu();
                }
            }, { signal: powerMenuAbortController.signal });
        }

        powerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (powerMenu.classList.contains('show')) {
                closePowerMenu();
            } else {
                openPowerMenu();
            }
        });

        powerMenu.querySelectorAll('[data-action]').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                closePowerMenu();
                if (action === 'lock') {
                    if (window.MXOS.system && window.MXOS.system.lock) {
                        window.MXOS.system.lock();
                    }
                } else if (action === 'restart') {
                    window.location.reload();
                } else if (action === 'shutdown') {
                    const shutdownAnim = document.getElementById('mxos-shutdown-anim');
                    if (shutdownAnim) {
                        shutdownAnim.classList.add('show');
                        shutdownAnim.setAttribute('aria-hidden', 'false');
                    }
                    document.body.style.overflow = 'hidden';
                    setTimeout(() => {
                        window.open('about:blank', '_self');
                        window.close();
                    }, 3000);
                }
            });
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#startMenu') && !e.target.closest('#startButton')) {
            closeStartMenu();
        }
    });

    document.getElementById('desktop').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenuAt(e.clientX, e.clientY);
    });

    setupMxbakDropZone();

    let isSelecting = false;
    let selectionStart = { x: 0, y: 0 };
    const selectionBox = document.getElementById('selection-box');

    function getDesktopClientPos(e) {
        return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    }

    function handleDesktopDown(e) {
        if (e.target.closest('.desktop-icon')) return;
        document.querySelectorAll('.desktop-icon.selected').forEach(i => i.classList.remove('selected'));
        var pos = getDesktopClientPos(e);
        isSelecting = true;
        selectionStart = pos;
        selectionBox.style.left = pos.x + 'px';
        selectionBox.style.top = pos.y + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    }

    function handleSelectionMove(e) {
        if (!isSelecting) return;
        e.preventDefault();
        var pos = getDesktopClientPos(e);
        var currentX = pos.x;
        var currentY = pos.y;
        var left = Math.min(selectionStart.x, currentX);
        var top = Math.min(selectionStart.y, currentY);
        var width = Math.abs(currentX - selectionStart.x);
        var height = Math.abs(currentY - selectionStart.y);
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }

    function handleSelectionEnd() {
        if (isSelecting) {
            isSelecting = false;
            setTimeout(() => {
                selectionBox.style.display = 'none';
            }, 100);
        }
    }

    document.getElementById('desktop').addEventListener('mousedown', handleDesktopDown);
    document.getElementById('desktop').addEventListener('touchstart', handleDesktopDown, { passive: false });
    document.addEventListener('mousemove', handleSelectionMove);
    document.addEventListener('touchmove', handleSelectionMove, { passive: false });
    document.addEventListener('mouseup', handleSelectionEnd);
    document.addEventListener('touchend', handleSelectionEnd);

    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            if (action === 'refresh') {
                document.querySelectorAll('.desktop-icon').forEach(icon => {
                    icon.classList.add('refreshing');
                    setTimeout(() => icon.classList.remove('refreshing'), 300);
                });
            } else if (action === 'display-settings' || action === 'personalize') {
                createWindow('settings');
            } else if (action === 'add-widget') {
                if (window.MXOS && window.MXOS.Widgets && typeof window.MXOS.Widgets.showAddMenu === 'function') {
                    window.MXOS.Widgets.showAddMenu(lastContextMenuPos.x, lastContextMenuPos.y);
                }
            } else if (action === 'new-folder') {
                (async () => {
                    let name = '新建文件夹';
                    if (window.MXOS?.dialog?.prompt) {
                        try { name = await window.MXOS.dialog.prompt('输入文件夹名称', '新建文件夹'); } catch (e) { return; }
                        if (!name) return;
                    }
                    try {
                        if (window.MXOS && window.MXOS.fs && typeof window.MXOS.fs.createFolder === 'function') {
                            await window.MXOS.fs.createFolder('/桌面/' + name);
                            if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('文件夹已创建: /桌面/' + name, 'success');
                        } else {
                            if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('文件系统不可用，无法创建文件夹', 'error');
                        }
                    } catch (err) {
                        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('创建文件夹失败: ' + (err && err.message ? err.message : err), 'error');
                    }
                })();
            } else if (action === 'new-sticky-note') {
                if (window.MXOS && window.MXOS.StickyNotes && typeof window.MXOS.StickyNotes.create === 'function') {
                    window.MXOS.StickyNotes.create(lastContextMenuPos.x, lastContextMenuPos.y);
                }
            } else if (action === 'gen-qrcode') {
                const text = getSelectionTextForMenu();
                if (text && window.MXOS?.QR?.showDialog) {
                    window.MXOS.QR.showDialog(text);
                }
            } else if (action === 'ocr-image') {
                startOcrFromContextMenu();
            } else if (action === 'scan-qrcode') {
                if (window.MXOS?.QRScanner?.start) {
                    window.MXOS.QRScanner.start();
                }
            }
            closeContextMenu();
        });
    });

    async function startOcrFromContextMenu() {
        if (!window.MXOS?.OCR?.recognize) {
            if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('OCR 模块未加载', 'warning');
            return;
        }
        try {
            if (navigator.clipboard && navigator.clipboard.read) {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            await window.MXOS.OCR.recognize(blob, 'chi_sim+eng');
                            return;
                        }
                    }
                }
            }
        } catch (e) {}
        if (window.MXOS?.system?.screenshot) {
            if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('请先截图或复制图片到剪贴板', 'info');
            const url = await window.MXOS.system.screenshot();
            if (url) {
                await window.MXOS.OCR.recognize(url, 'chi_sim+eng');
            }
        } else if (window.MXOS?.dialog?.toast) {
            window.MXOS.dialog.toast('请先复制图片到剪贴板', 'info');
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeStartMenu();
            closeContextMenu();
        }
    });
}





