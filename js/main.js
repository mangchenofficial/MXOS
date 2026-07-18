async function boot() {
    function recordError(module, e) {
        const errs = window.__MXOS_BOOT_ERRORS || [];
        errs.push({ type: 'module', module: module, message: e && e.message || String(e), stack: e && e.stack || '' });
        window.__MXOS_BOOT_ERRORS = errs;
        console.error('MXOS boot error [' + module + ']:', e);
    }

    async function safeImport(module) {
        try {
            return await import(module);
        } catch (e) {
            recordError(module, e);
            return null;
        }
    }

    async function safeImportGroup(modules) {
        return await Promise.allSettled(modules.map(m => import(m).catch(e => { recordError(m, e); return null; })));
    }

    try {
        await import('./config.js');
        const stateMod = await import('./state.js');
        const state = stateMod.state;
        const coreMod = await import('./core.js');
        const openApp = coreMod.openApp;
        const updateAppStartMenu = coreMod.updateAppStartMenu;
        const updateTaskbar = coreMod.updateTaskbar;
        const desktopMod = await import('./desktop.js');
        const initDesktop = desktopMod.initDesktop;
        await import('./settings.js');
        await import('./api.js');
        await import('./features/lock.js');
        await import('./features/theme.js');
        await import('./features/notifications.js');
        await import('./features/animations.js');
        await import('./features/anim-level.js');
        await import('./utils/event-bus.js');
        await import('./utils/logger.js');

        window.MXOS = window.MXOS || {};
        window.MXOS.Real = window.MXOS.Real || {};
        window.MXOS.System = window.MXOS.System || {};
        if (window.MXOS.Real.perf && typeof window.MXOS.Real.perf.start === 'function' && !window.MXOS.Real.perf.isRunning()) {
            window.MXOS.Real.perf.start();
        }

        state.installedApps.forEach(app => {
            if (app.appBin) {
                state.thirdPartyAppData[app.id] = app;
            }
        });

        const storeEntry = document.createElement('div');
        storeEntry.className = 'start-app';
        storeEntry.dataset.app = 'store';
        storeEntry.innerHTML = '<svg width="32" height="32" viewBox="0 0 40 40"><use href="#svg-store"/></svg><span>应用商店</span>';
        const startGrid = document.querySelector('.start-apps-grid');
        if (startGrid && !startGrid.querySelector('.start-app[data-app="store"]')) {
            startGrid.insertBefore(storeEntry, startGrid.firstChild);
        }

        const taskMgrEntry = document.createElement('div');
        taskMgrEntry.className = 'start-app';
        taskMgrEntry.dataset.app = 'task-manager-pro';
        taskMgrEntry.innerHTML = '<svg width="32" height="32" viewBox="0 0 40 40"><use href="#svg-task-manager-pro"/></svg><span>任务管理器</span>';
        if (startGrid && !startGrid.querySelector('.start-app[data-app="task-manager-pro"]')) {
            startGrid.appendChild(taskMgrEntry);
        }

        const drawingEntry = document.createElement('div');
        drawingEntry.className = 'start-app';
        drawingEntry.dataset.app = 'drawing-app';
        drawingEntry.innerHTML = '<svg width="32" height="32" viewBox="0 0 40 40"><use href="#svg-drawing"/></svg><span>画板</span>';
        if (startGrid && !startGrid.querySelector('.start-app[data-app="drawing-app"]')) {
            startGrid.appendChild(drawingEntry);
        }

        const pixelEntry = document.createElement('div');
        pixelEntry.className = 'start-app';
        pixelEntry.dataset.app = 'pixel-editor';
        pixelEntry.innerHTML = '<svg width="32" height="32" viewBox="0 0 40 40"><use href="#svg-pixel"/></svg><span>像素画</span>';
        if (startGrid && !startGrid.querySelector('.start-app[data-app="pixel-editor"]')) {
            startGrid.appendChild(pixelEntry);
        }

        const emailVerifyEntry = document.createElement('div');
        emailVerifyEntry.className = 'start-app';
        emailVerifyEntry.dataset.app = 'email-verification';
        emailVerifyEntry.innerHTML = '<svg width="32" height="32" viewBox="0 0 40 40"><use href="#svg-settings"/></svg><span>邮箱验证</span>';
        if (startGrid && !startGrid.querySelector('.start-app[data-app="email-verification"]')) {
            startGrid.appendChild(emailVerifyEntry);
        }

        const featureCenterEntry = document.createElement('div');
        featureCenterEntry.className = 'start-app';
        featureCenterEntry.dataset.app = 'feature-center';
        featureCenterEntry.innerHTML = '<svg width="32" height="32" viewBox="0 0 40 40"><use href="#svg-feature-center"/></svg><span>功能中心</span>';
        if (startGrid && !startGrid.querySelector('.start-app[data-app="feature-center"]')) {
            startGrid.appendChild(featureCenterEntry);
        }

        async function lazyOpenApp(id, modulePath) {
            try {
                await import(modulePath);
                const { appConfigs } = await import('./state.js');
                let tries = 0;
                while (!appConfigs[id] && tries < 60) {
                    await new Promise(r => setTimeout(r, 50));
                    tries++;
                }
                if (appConfigs[id]) {
                    openApp(id);
                }
            } catch (e) {
                console.error('MXOS lazy open failed:', id, e);
                if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                    window.MXOS.dialog.toast('加载功能失败，请重试', 'error');
                }
            }
        }

        async function lazyToggleFeature(id, modulePath, toggleFn) {
            try {
                const mod = await import(modulePath);
                if (mod && typeof mod[toggleFn] === 'function') mod[toggleFn]();
            } catch (e) {
                console.error('MXOS lazy toggle failed:', id, e);
            }
        }

        function addLazyStartEntry(id, label, icon, modulePath, opts) {
            if (!startGrid) return;
            if (startGrid.querySelector(`.start-app[data-app="${id}"]`)) return;
            const entry = document.createElement('div');
            entry.className = 'start-app';
            entry.dataset.app = id;
            entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40"><use href="#svg-${icon}"/></svg><span>${label}</span>`;
            entry.addEventListener('click', async (e) => {
                e.stopPropagation();
                window.MXOS.closeStartMenu();
                if (opts && opts.toggleFn) {
                    await lazyToggleFeature(id, modulePath, opts.toggleFn);
                } else {
                    await lazyOpenApp(id, modulePath);
                }
            });
            startGrid.appendChild(entry);
        }

        addLazyStartEntry('stamps', '邮票册', 'store', './features/stamps.js');
        addLazyStartEntry('app-graveyard', '应用墓园', 'recycle-bin', './features/app-graveyard.js');
        addLazyStartEntry('time-machine', '时光机', 'clock', './features/time-machine.js');
        addLazyStartEntry('time-capsule', '时光胶囊', 'installer', './features/time-capsule.js');
        addLazyStartEntry('app-leaderboard', '排行榜', 'dashboard', './features/app-leaderboard.js');
        addLazyStartEntry('fortune', '今日运势', 'weather', './features/fortune.js');
        addLazyStartEntry('desktop-piano', '桌面钢琴', 'music', './features/desktop-piano.js', { toggleFn: 'toggle' });
        addLazyStartEntry('desktop-drum', '桌面鼓机', 'music', './features/desktop-drum.js', { toggleFn: 'toggle' });

        initDesktop();
        updateAppStartMenu();
        updateTaskbar();

        const ariaMod = await safeImport('./accessibility/aria.js');
        const highContrastMod = await safeImport('./accessibility/high-contrast.js');
        const fontScaleMod = await safeImport('./accessibility/font-scale.js');
        const keyboardNavMod = await safeImport('./accessibility/keyboard-nav.js');
        if (highContrastMod && typeof highContrastMod.initHighContrast === 'function') highContrastMod.initHighContrast();
        if (fontScaleMod && typeof fontScaleMod.initFontScale === 'function') fontScaleMod.initFontScale();
        if (ariaMod && typeof ariaMod.initAria === 'function') ariaMod.initAria();
        if (keyboardNavMod && typeof keyboardNavMod.initKeyboardNav === 'function') keyboardNavMod.initKeyboardNav();

        window.dispatchEvent(new CustomEvent('mxos:desktop-ready'));
        window.openApp = openApp;

        setTimeout(async () => {
            await safeImportGroup([
                './features/quick-settings.js',
                './features/auth.js?v=25',
                './features/cloud-sync.js',
                './features/window-snap.js',
                './features/virtual-desktop.js',
                './features/command-palette.js',
                './features/widgets.js',
                './features/clipboard-history.js',
                './features/focus-mode.js',
                './features/sticky-notes.js',
                './features/sound-feedback.js',
                './features/color-picker.js',
                './features/window-shake.js',
                './features/start-search.js',
                './features/launcher.js?v=25',
                './features/translator.js',
                './features/wallpaper-color.js',
                './features/wallpaper-slideshow.js'
            ]);

            await safeImportGroup([
                './real/hardware-info.js',
                './real/battery.js',
                './real/location-weather.js',
                './real/sensors.js',
                './real/media-devices.js',
                './real/perf-monitor.js'
            ]);

            await safeImportGroup([
                './apps/notepad.js',
                './apps/this-pc.js',
                './apps/recycle-bin.js',
                './apps/browser.js',
                './apps/office.js',
                './apps/music.js',
                './apps/thirdparty.js',
        
                './apps/settings-app.js?v=26',
                './apps/store.js',
                './apps/email-verification.js',
                './apps/task-manager-pro.js',
                './apps/calculator.js',
                './apps/clock.js',
                './apps/terminal.js',
                './apps/calendar.js',
                './apps/dashboard.js',
                './apps/drawing-app.js',
                './apps/pixel-editor.js',
                './apps/feature-center.js'
            ]);

            await safeImportGroup([
                './system/smoke-test.js',
                './system/integration-check.js',
                './system/perf-trace.js',
                './system/crash-reporter.js',
                './system/incognito.js',
                './system/data-export.js',
                './system/data-erase.js',
                './system/offline-mode.js',
                './system/weak-network.js',
                './system/system-update.js',
                './system/backup-restore.js',
                './system/health-score.js',
                './system/smart-recommend.js'
            ]);

            await safeImportGroup([
                './media/screen-recorder.js',
                './media/ocr.js',
                './media/qr-code.js',
                './media/qr-scanner.js'
            ]);

            await safeImportGroup([
                './ime/symbol-panel.js',
                './ime/text-replace.js'
            ]);

            await safeImportGroup([
                './ai/ai-registry.js',
                './ai/chat-panel.js',
                './ai/ai-actions.js'
            ]);

            await safeImportGroup([
                './utils/search-query.js'
            ]);

            await safeImportGroup([
                './sandbox/permissions.js',
                './sandbox/postmessage-rpc.js',
                './sandbox/app-sandbox.js'
            ]);

            if (window.MXOS.System && window.MXOS.System.perfTrace) {
                window.MXOS.System.perfTrace.markDesktopReady();
            }

            if (window.MXOS.Sandbox && typeof window.MXOS.Sandbox.permissions === 'object') {
                state.installedApps.forEach(app => {
                    if (app && app.appBin && app.id && !state.thirdPartyAppData[app.id]) {
                        state.thirdPartyAppData[app.id] = app;
                    }
                });
            }
        }, 800);
    } catch (e) {
        recordError('core', e);
        const panel = document.getElementById('mxos-boot-error-panel');
        if (panel) {
            panel.style.display = 'block';
            panel.textContent = 'MXOS 核心启动失败: ' + (e && e.message || String(e));
        }
    }
}

boot();


