const assertiveLiveId = 'mxos-assertive-live';

function ensureAssertiveRegion() {
    let region = document.getElementById(assertiveLiveId);
    if (!region) {
        region = document.createElement('div');
        region.id = assertiveLiveId;
        region.setAttribute('aria-live', 'assertive');
        region.setAttribute('aria-atomic', 'true');
        region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;';
        document.body.appendChild(region);
    }
    return region;
}

export function announceUrgent(message) {
    const region = ensureAssertiveRegion();
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 50);
}

function labelInteractiveElements() {
    const startBtn = document.getElementById('startButton');
    if (startBtn && !startBtn.getAttribute('aria-label')) {
        startBtn.setAttribute('role', 'button');
        startBtn.setAttribute('aria-label', '开始菜单');
        startBtn.setAttribute('tabindex', '0');
    }

    const taskbarItems = document.getElementById('taskbarItems');
    if (taskbarItems && !taskbarItems.getAttribute('role')) {
        taskbarItems.setAttribute('role', 'toolbar');
        taskbarItems.setAttribute('aria-label', '任务栏运行中的应用');
    }

    const startMenu = document.getElementById('startMenu');
    if (startMenu && !startMenu.getAttribute('role')) {
        startMenu.setAttribute('role', 'dialog');
        startMenu.setAttribute('aria-label', '开始菜单');
    }

    const startSearch = startMenu ? startMenu.querySelector('.start-search') : null;
    if (startSearch && !startSearch.getAttribute('aria-label')) {
        startSearch.setAttribute('aria-label', '搜索应用、设置和文档');
    }

    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu && !contextMenu.getAttribute('role')) {
        contextMenu.setAttribute('role', 'menu');
        contextMenu.setAttribute('aria-label', '桌面右键菜单');
        contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.setAttribute('role', 'menuitem');
            if (!item.getAttribute('tabindex')) item.setAttribute('tabindex', '-1');
        });
    }

    const systemTray = document.querySelector('.system-tray');
    if (systemTray && !systemTray.getAttribute('role')) {
        systemTray.setAttribute('role', 'button');
        systemTray.setAttribute('aria-label', '快速设置和时钟');
        systemTray.setAttribute('tabindex', '0');
    }

    const clock = document.getElementById('clock');
    if (clock && !clock.getAttribute('aria-label')) {
        const timeEl = document.getElementById('time');
        const dateEl = document.getElementById('date');
        if (timeEl && dateEl) {
            const updateClockLabel = () => {
                clock.setAttribute('aria-label', `当前时间 ${timeEl.textContent}，${dateEl.textContent}`);
            };
            updateClockLabel();
            const observer = new MutationObserver(updateClockLabel);
            observer.observe(timeEl, { childList: true, characterData: true, subtree: true });
            observer.observe(dateEl, { childList: true, characterData: true, subtree: true });
        }
    }

    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen && !lockScreen.getAttribute('role')) {
        lockScreen.setAttribute('role', 'dialog');
        lockScreen.setAttribute('aria-label', '锁屏');
    }

    const lockHint = document.querySelector('.lock-hint');
    if (lockHint && !lockHint.getAttribute('aria-label')) {
        lockHint.setAttribute('aria-label', '按回车键或点击任意位置解锁');
    }

    const desktopRoot = document.getElementById('desktop');
    if (desktopRoot && !desktopRoot.getAttribute('role')) {
        desktopRoot.setAttribute('role', 'application');
        desktopRoot.setAttribute('aria-label', 'MXOS 桌面');
    }

    document.querySelectorAll('.desktop-icon').forEach(icon => {
        if (!icon.getAttribute('role')) {
            icon.setAttribute('role', 'button');
            icon.setAttribute('tabindex', '0');
        }
        const nameSpan = icon.querySelector('span');
        const name = nameSpan ? nameSpan.textContent.trim() : '';
        if (name && !icon.getAttribute('aria-label')) {
            icon.setAttribute('aria-label', `打开 ${name}`);
        }
    });

    document.querySelectorAll('.start-app').forEach(app => {
        if (!app.getAttribute('role')) {
            app.setAttribute('role', 'button');
            app.setAttribute('tabindex', '0');
        }
        const nameSpan = app.querySelector('span');
        const name = nameSpan ? nameSpan.textContent.trim() : '';
        if (name && !app.getAttribute('aria-label')) {
            app.setAttribute('aria-label', `启动 ${name}`);
        }
    });

    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        if (!toggle.getAttribute('role')) {
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('tabindex', '0');
        }
        toggle.setAttribute('aria-checked', toggle.classList.contains('on') ? 'true' : 'false');
        const card = toggle.closest('.settings-card');
        if (card) {
            const titleEl = card.querySelector('.settings-card-title');
            if (titleEl && !toggle.getAttribute('aria-label')) {
                toggle.setAttribute('aria-label', titleEl.textContent.trim());
            }
        }
    });

    document.querySelectorAll('.window-control').forEach(ctrl => {
        if (!ctrl.getAttribute('role')) {
            ctrl.setAttribute('role', 'button');
            ctrl.setAttribute('tabindex', '0');
        }
        if (!ctrl.getAttribute('aria-label')) {
            if (ctrl.classList.contains('close')) ctrl.setAttribute('aria-label', '关闭窗口');
            else if (ctrl.classList.contains('minimize')) ctrl.setAttribute('aria-label', '最小化窗口');
            else if (ctrl.classList.contains('maximize')) ctrl.setAttribute('aria-label', '最大化/还原窗口');
        }
    });

    document.querySelectorAll('.taskbar-item').forEach(item => {
        if (!item.getAttribute('role')) {
            item.setAttribute('role', 'button');
            item.setAttribute('tabindex', '0');
        }
    });

    document.querySelectorAll('.window').forEach(win => {
        if (!win.getAttribute('role')) {
            win.setAttribute('role', 'dialog');
            win.setAttribute('aria-label', '窗口');
        }
        const titleEl = win.querySelector('.window-title span');
        if (titleEl) {
            win.setAttribute('aria-label', titleEl.textContent.trim());
        }
    });
}

let reduceMotionQuery = null;
function applyReduceMotion() {
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) {
        document.body.classList.add('reduce-motion');
    } else {
        document.body.classList.remove('reduce-motion');
    }
}

export function initAria() {
    ensureAssertiveRegion();
    labelInteractiveElements();

    if (window.matchMedia) {
        reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        applyReduceMotion();
        const handler = applyReduceMotion;
        if (reduceMotionQuery.addEventListener) {
            reduceMotionQuery.addEventListener('change', handler);
        } else if (reduceMotionQuery.addListener) {
            reduceMotionQuery.addListener(handler);
        }
    }

    const startMenu = document.getElementById('startMenu');
    const startButton = document.getElementById('startButton');
    if (startMenu && startButton) {
        const syncExpanded = () => {
            startButton.setAttribute('aria-expanded', startMenu.classList.contains('show') ? 'true' : 'false');
        };
        syncExpanded();
        const startObserver = new MutationObserver(syncExpanded);
        startObserver.observe(startMenu, { attributes: true, attributeFilter: ['class'] });
    }

    const savedReduce = (() => {
        try { return localStorage.getItem('mxos_reduce_motion') === '1'; } catch (err) { return false; }
    })();
    if (savedReduce) document.body.classList.add('reduce-motion');

    const observer = new MutationObserver(() => {
        labelInteractiveElements();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

window.mxosAnnounceUrgent = announceUrgent;
