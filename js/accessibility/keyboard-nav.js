import { state } from '../state.js';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '.desktop-icon',
    '.start-app',
    '.start-button',
    '.taskbar-item',
    '.system-tray',
    '.window-control',
    '.toggle-switch',
    '.settings-item',
    '.settings-menu-item',
    '.context-menu-item',
    '.wifi-network-item',
    '.wallpaper-thumbnail',
    '.accent-color-option'
].join(',');

function getVisibleFocusable(root = document) {
    const elements = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
    return elements.filter(el => {
        if (el.getAttribute('tabindex') === '-1' && !el.matches('.context-menu-item')) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
    });
}

function isInModalContext(el) {
    return !!(el.closest('#lock-screen:not(.hidden)') ||
              el.closest('.start-menu.show') ||
              el.closest('.context-menu[style*="block"]') ||
              el.closest('.notification-center.show'));
}

function handleEnterSpace(e) {
    const target = e.target;
    if (!target || !target.matches || !target.matches(FOCUSABLE_SELECTOR)) return;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    target.click();
}

function handleEscape(e) {
    const startMenu = document.getElementById('startMenu');
    if (startMenu && startMenu.classList.contains('show')) {
        window.MXOS.closeStartMenu();
        const startBtn = document.getElementById('startButton');
        if (startBtn) startBtn.focus();
        e.preventDefault();
        return;
    }

    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu && contextMenu.style.display === 'block') {
        contextMenu.style.display = 'none';
        e.preventDefault();
        return;
    }

    const notifCenter = document.querySelector('.notification-center.show');
    if (notifCenter) {
        notifCenter.classList.remove('show');
        e.preventDefault();
        return;
    }

    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isEditable = activeTag === 'INPUT' || activeTag === 'TEXTAREA' ||
        (document.activeElement && document.activeElement.isContentEditable);
    if (isEditable) return;

    if (state.activeWindow && !state.activeWindow.minimized) {
        const closeBtn = state.activeWindow.element.querySelector('.window-control.close');
        if (closeBtn) {
            closeBtn.click();
            e.preventDefault();
        }
    }
}

function handleArrowKeys(e) {
    const target = e.target;
    const container = target.closest('.start-apps-grid, .start-search-results, .wifi-networks-section, .notification-center-list, .context-menu, .desktop-icons, .taskbar-items, .wallpaper-thumbnails, .accent-color-palette');
    if (!container) return;

    const items = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
    });
    if (items.length === 0) return;

    const currentIndex = items.indexOf(target);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    const isHorizontal = container.matches('.start-apps-grid, .wallpaper-thumbnails, .accent-color-palette, .taskbar-items');
    const isVertical = container.matches('.wifi-networks-section, .notification-center-list, .context-menu');

    if (isVertical) {
        if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
        else if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
        else return;
    } else if (isHorizontal) {
        if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % items.length;
        else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + items.length) % items.length;
        else return;
    } else {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % items.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + items.length) % items.length;
        else return;
    }

    e.preventDefault();
    items[nextIndex].focus();
}

function openStartMenu() {
    const startMenu = document.getElementById('startMenu');
    const startBtn = document.getElementById('startButton');
    if (!startMenu) return;
    window.MXOS.openStartMenu();
    setTimeout(() => {
        const search = startMenu.querySelector('.start-search');
        if (search) search.focus();
        else if (startBtn) startBtn.focus();
    }, 50);
}

function showDesktop() {
    import('../core.js').then(core => {
        state.windows.forEach(w => {
            if (!w.minimized && typeof core.minimizeWindow === 'function') {
                core.minimizeWindow(w);
            }
        });
    });
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已显示桌面');
}

function lockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    if (!lockScreen) return;
    state.isLocked = true;
    lockScreen.style.display = 'flex';
    lockScreen.classList.remove('hidden');
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已锁屏');
}

function switchWindow(direction) {
    const visible = state.windows.filter(w => !w.minimized);
    if (visible.length === 0) return;
    const activeIdx = visible.findIndex(w => w.element === state.activeWindow);
    let nextIdx;
    if (direction === 'forward') {
        nextIdx = activeIdx < 0 ? 0 : (activeIdx + 1) % visible.length;
    } else {
        nextIdx = activeIdx < 0 ? visible.length - 1 : (activeIdx - 1 + visible.length) % visible.length;
    }
    const target = visible[nextIdx];
    if (target) {
        target.element.style.display = 'flex';
        target.element.classList.remove('minimized');
        target.minimized = false;
        target.element.style.zIndex = ++state.zIndex;
        state.windows.forEach(w => w.element.classList.remove('active'));
        target.element.classList.add('active');
        state.activeWindow = target.element;
        const header = target.element.querySelector('.window-header');
        if (header) header.focus();
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent(`已切换到 ${target.appId}`);
    }
}

function closeActiveWindow() {
    if (state.activeWindow && !state.activeWindow.minimized) {
        const closeBtn = state.activeWindow.element.querySelector('.window-control.close');
        if (closeBtn) {
            closeBtn.click();
            if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已关闭当前窗口');
        }
    }
}

function openTaskManager() {
    import('../core.js').then(core => {
        if (typeof core.openApp === 'function') {
            core.openApp('task-manager-pro');
        }
    });
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已打开任务管理器');
}

let metaKeyDownTime = 0;
let metaChordUsed = false;

function handleGlobalShortcuts(e) {
    if (e.type === 'keydown' && e.key === 'Meta' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        metaKeyDownTime = Date.now();
        metaChordUsed = false;
        return;
    }

    if (e.type === 'keydown' && e.metaKey && !e.ctrlKey && !e.altKey) {
        metaChordUsed = true;
    }

    if (e.type === 'keyup' && e.key === 'Meta') {
        if (!metaChordUsed && metaKeyDownTime > 0) {
            e.preventDefault();
            const startMenu = document.getElementById('startMenu');
            if (startMenu) {
                if (startMenu.classList.contains('show')) {
                    window.MXOS.closeStartMenu();
                } else {
                    openStartMenu();
                }
            }
        }
        metaKeyDownTime = 0;
        metaChordUsed = false;
        return;
    }

    if (e.type !== 'keydown') return;

    if (e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        metaChordUsed = true;
        import('../core.js').then(core => {
            if (typeof core.openApp === 'function') core.openApp('this-pc');
        });
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('已打开文件管理器');
        return;
    }

    if (e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        metaChordUsed = true;
        showDesktop();
        return;
    }

    if (e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        metaChordUsed = true;
        lockScreen();
        return;
    }

    if (e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        metaChordUsed = true;
        if (window.MXOS && window.MXOS.Clipboard && typeof window.MXOS.Clipboard.toggle === 'function') {
            window.MXOS.Clipboard.toggle();
        }
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('剪贴板历史');
        return;
    }

    if (e.metaKey && !e.ctrlKey && !e.altKey && e.key === ';') {
        e.preventDefault();
        metaChordUsed = true;
        if (window.MXOS && window.MXOS.IME && typeof window.MXOS.IME.openSymbolPanel === 'function') {
            if (window.MXOS.IME.isSymbolPanelOpen && window.MXOS.IME.isSymbolPanelOpen()) {
                window.MXOS.IME.closeSymbolPanel();
            } else {
                window.MXOS.IME.openSymbolPanel();
            }
        }
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('符号面板');
        return;
    }

    if (e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        metaChordUsed = true;
        if (window.MXOS && window.MXOS.AI && typeof window.MXOS.AI.togglePanel === 'function') {
            window.MXOS.AI.togglePanel();
        }
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('AI 助手');
        return;
    }

    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (window.MXOS && window.MXOS.Focus) {
            if (window.MXOS.Focus.isActive()) window.MXOS.Focus.exit();
            else window.MXOS.Focus.enter();
        }
        return;
    }

    if (e.altKey && e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        switchWindow(e.shiftKey ? 'backward' : 'forward');
        return;
    }

    if (e.altKey && e.key === 'F4' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        closeActiveWindow();
        return;
    }

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'escape') {
        e.preventDefault();
        openTaskManager();
        return;
    }

    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (window.MXOS && window.MXOS.CommandPalette) {
            if (window.MXOS.CommandPalette.isOpen()) window.MXOS.CommandPalette.close();
            else window.MXOS.CommandPalette.open();
        }
        return;
    }

    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === ' ') {
        e.preventDefault();
        if (window.MXOS && window.MXOS.Launcher) {
            if (window.MXOS.Launcher.isOpen && window.MXOS.Launcher.isOpen()) window.MXOS.Launcher.close();
            else if (typeof window.MXOS.Launcher.open === 'function') window.MXOS.Launcher.open();
        }
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('全局启动器');
        return;
    }

    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (window.MXOS && window.MXOS.Translate && typeof window.MXOS.Translate.toggle === 'function') {
            window.MXOS.Translate.toggle();
        }
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('翻译官');
        return;
    }

    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (window.MXOS && window.MXOS.Doodle && typeof window.MXOS.Doodle.toggle === 'function') {
            window.MXOS.Doodle.toggle();
        }
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('桌面涂鸦');
        return;
    }

    if (e.metaKey && e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        metaChordUsed = true;
        if (window.MXOS && window.MXOS.Desktop) {
            window.MXOS.Desktop.toggleTaskView();
        }
        return;
    }

    if (e.metaKey && e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        metaChordUsed = true;
        if (window.MXOS && window.MXOS.Desktop) {
            window.MXOS.Desktop.create();
        }
        return;
    }

    if (e.metaKey && e.ctrlKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        metaChordUsed = true;
        if (window.MXOS && window.MXOS.Desktop) {
            const list = window.MXOS.Desktop.list();
            const current = window.MXOS.Desktop.getCurrentDesktop();
            const idx = list.findIndex(d => d.id === current);
            if (idx !== -1) {
                const nextIdx = e.key === 'ArrowLeft'
                    ? (idx - 1 + list.length) % list.length
                    : (idx + 1) % list.length;
                window.MXOS.Desktop.switchTo(list[nextIdx].id);
            }
        }
        return;
    }

    if (e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp')) {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        const isEditable = activeTag === 'INPUT' || activeTag === 'TEXTAREA' ||
            (document.activeElement && document.activeElement.isContentEditable);
        if (isEditable) return;
        e.preventDefault();
        metaChordUsed = true;
        const dir = e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : 'top';
        if (window.MXOS && window.MXOS.window && window.MXOS.window.snap && state.activeWindow) {
            window.MXOS.window.snap({ element: state.activeWindow }, dir);
        }
        return;
    }
}

function onKeyDown(e) {
    handleGlobalShortcuts(e);
    if (e.defaultPrevented) return;

    if (e.key === 'Escape') {
        handleEscape(e);
        return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
        handleEnterSpace(e);
        return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        handleArrowKeys(e);
    }
}

function setupTabOrder() {
    document.querySelectorAll('.window-control, .toggle-switch, .settings-item, .settings-menu-item').forEach(el => {
        if (!el.hasAttribute('tabindex')) {
            el.setAttribute('tabindex', '0');
        }
    });
}

export function initKeyboardNav() {
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Meta') handleGlobalShortcuts(e);
    }, true);
    setupTabOrder();

    const observer = new MutationObserver(() => {
        setupTabOrder();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const desktop = document.getElementById('desktop');
    if (desktop) {
        desktop.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('desktop-icon')) {
                e.preventDefault();
                import('../core.js').then(core => {
                    if (typeof core.createWindow === 'function') {
                        core.createWindow(e.target.dataset.app);
                    }
                });
            }
        });
    }

    const startMenu = document.getElementById('startMenu');
    if (startMenu) {
        startMenu.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('start-app')) {
                e.preventDefault();
                e.target.click();
            }
        });
    }
}

