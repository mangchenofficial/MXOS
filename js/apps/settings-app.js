import { registerAppRenderer } from '../core.js';
import { state } from '../state.js';
import { saveWallpaperSettings, updateLockScreenWallpaper, saveVideoToIndexedDB } from '../settings.js';
import { isHighContrast, setHighContrast } from '../accessibility/high-contrast.js';
import { getFontScale, setFontScale } from '../accessibility/font-scale.js';
import { getLocale, setLocale } from '../i18n/index.js';

const personalizationSettings = state.personalizationSettings;

registerAppRenderer('settings', async (contentEl, windowEl, appId) => {
    const saved = localStorage.getItem('mxos-system-settings');
    const savedSettings = saved ? JSON.parse(saved) : {};
    let systemSettings = {
        brightness: savedSettings.brightness ?? 80,
        displayScale: savedSettings.displayScale ?? 100,
        volume: savedSettings.volume ?? 70,
        notifications: true,
        powerMode: 'balanced',
        nightLight: false,
        darkMode: true,
        lastBrightness: 80,
        wifiOn: true
    };

    const systemSubPages = {
        'display': {
            title: '显示',
            icon: 'svg-display',
            items: [
                { type: 'slider', id: 'brightness', title: '屏幕亮度', desc: '调整屏幕亮度', min: 0, max: 100, value: systemSettings.brightness, suffix: '%' },
                { type: 'select', id: 'scale', title: '显示比例', desc: '更改文本和应用的大小', options: [
                    { value: '75', label: '75%' },
                    { value: '100', label: '100% (默认)' },
                    { value: '125', label: '125%' },
                    { value: '150', label: '150%' },
                    { value: '175', label: '175%' },
                    { value: '200', label: '200%' }
                ], value: String(systemSettings.displayScale) },
                { type: 'toggle', id: 'nightLight', title: '夜间模式', desc: '减少屏幕蓝光', value: systemSettings.nightLight }
            ]
        },
        'sound': {
            title: '声音',
            icon: 'svg-volume',
            items: [
                { type: 'slider', id: 'volume', title: '主音量', desc: '调整系统音量', min: 0, max: 100, value: systemSettings.volume, suffix: '%' },
                { type: 'slider', id: 'micVolume', title: '麦克风音量', desc: '调整麦克风输入音量', min: 0, max: 100, value: 80, suffix: '%' }
            ]
        },
        'notification': {
            title: '通知',
            icon: 'svg-bell',
            items: [
                { type: 'toggle', id: 'notifications', title: '获取通知', desc: '允许应用发送通知', value: systemSettings.notifications },
                { type: 'toggle', id: 'lockScreenNotifications', title: '锁屏通知', desc: '在锁屏上显示通知', value: true }
            ]
        },
        'power': {
            title: '电源和电池',
            icon: 'svg-battery',
            items: [
                { type: 'select', id: 'powerMode', title: '电源模式', desc: '选择电源模式', options: [
                    { value: 'power-saver', label: '省电模式' },
                    { value: 'balanced', label: '平衡模式' },
                    { value: 'high-performance', label: '高性能模式' }
                ], value: systemSettings.powerMode },
                { type: 'info', title: '电池电量', desc: '85% (接通电源)', value: '85%' }
            ]
        }
    };

    const networkSettings = {
        wifiOn: true,
        airplaneMode: false,
        wifiNetworks: [
            { name: 'TP-Link_5G', signal: 90, connected: true },
            { name: 'Xiaomi_1234', signal: 75, connected: false },
            { name: 'ChinaNet', signal: 60, connected: false },
            { name: 'Huawei_5G', signal: 45, connected: false },
            { name: 'CMCC', signal: 30, connected: false }
        ]
    };

    const networkSubPages = {
        'wifi': {
            title: 'WLAN',
            icon: 'svg-wifi',
            items: [
                { type: 'toggle', id: 'wifiOn', title: 'WLAN', desc: '无线网络连接', value: systemSettings.wifiOn },
                { type: 'wifi-networks', id: 'wifiNetworks', networks: networkSettings.wifiNetworks }
            ]
        },
        'ethernet': {
            title: '以太网',
            icon: 'svg-hard-disk',
            items: [
                { type: 'info', title: '以太网', desc: '已连接', value: '连接中' }
            ]
        }
    };

    const wallPaperOptions = [
        { value: 'sunset', label: '日落', url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80' },
        { value: 'ocean', label: '海洋', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80' },
        { value: 'forest', label: '森林', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80' },
        { value: 'city', label: '城市', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80' },
        { value: 'mountain', label: '山脉', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
        { value: 'space', label: '星空', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80' }
    ];

    const RECOMMENDED_WALLPAPERS_URL = 'https://blog.neocn.top/manifest.json';
    const RECOMMENDED_WALLPAPERS_BASE = 'https://blog.neocn.top/%E5%A3%81%E7%BA%B8/';
    const RECOMMENDED_CACHE_KEY = 'mxos_recommended_wallpapers';
    const RECOMMENDED_CACHE_TTL = 24 * 60 * 60 * 1000;

    async function fetchRecommendedWallpapers() {
        try {
            const cached = JSON.parse(localStorage.getItem(RECOMMENDED_CACHE_KEY) || 'null');
            if (cached && cached.ts && (Date.now() - cached.ts < RECOMMENDED_CACHE_TTL) && Array.isArray(cached.items)) {
                return cached.items;
            }
        } catch (e) {}
        try {
            const res = await fetch(RECOMMENDED_WALLPAPERS_URL);
            if (!res.ok) throw new Error('fetch failed');
            const items = await res.json();
            if (Array.isArray(items)) {
                try { localStorage.setItem(RECOMMENDED_CACHE_KEY, JSON.stringify({ ts: Date.now(), items })); } catch (e) {}
                return items;
            }
        } catch (e) {}
        return [];
    }

    function applyImageWallpaper(wallpaperUrl) {
        personalizationSettings.wallpaper = wallpaperUrl;
        personalizationSettings.wallpaperType = 'image';
        const wallpaperBg = document.getElementById('wallpaper-bg');
        const wallpaperVideo = document.getElementById('wallpaper-video');
        if (wallpaperBg) {
            wallpaperBg.style.backgroundImage = `url('${wallpaperUrl}')`;
            wallpaperBg.style.display = 'block';
        }
        if (wallpaperVideo) {
            if (wallpaperVideo.src && wallpaperVideo.src.startsWith('blob:')) {
                URL.revokeObjectURL(wallpaperVideo.src);
                wallpaperVideo.removeAttribute('src');
            }
            wallpaperVideo.style.display = 'none';
            wallpaperVideo.pause();
        }
        const preview = document.getElementById('wallpaper-preview');
        if (preview) {
            preview.style.backgroundImage = `url('${wallpaperUrl}')`;
        }
        saveWallpaperSettings();
        updateLockScreenWallpaper(wallpaperUrl, 'image');
        window.dispatchEvent(new CustomEvent('wallpaper-change', { detail: { url: wallpaperUrl, type: 'image' } }));
    }

    const personalizationSubPages = {
        'background': {
            title: '背景',
            icon: 'svg-folder',
            items: [
                { type: 'wallpaper', id: 'wallpaper', title: '背景', desc: '选择桌面背景' }
            ]
        },
        'color': {
            title: '颜色',
            icon: 'svg-personalization',
            items: [
                { type: 'accentColor', id: 'accentColor', title: '强调颜色', desc: '选择系统强调色' },
                { type: 'toggle', id: 'transparency', title: '透明效果', desc: '启用窗口透明效果', value: true }
            ]
        }
    };

    const themeSettings = {
        themeMode: (function() {
            try {
                const v = localStorage.getItem('mxos_theme_mode_pref');
                if (v === 'light' || v === 'dark' || v === 'auto') return v;
            } catch (e) {}
            return 'dark';
        })(),
        animation: true
    };

    const themeSubPages = {
        'theme-settings': {
            title: '主题设置',
            icon: 'svg-theme',
            items: [
                { type: 'select', id: 'themeMode', title: '颜色模式', desc: '选择浅色、深色或跟随系统', options: [
                    { value: 'dark', label: '深色' },
                    { value: 'light', label: '浅色' },
                    { value: 'auto', label: '跟随系统' }
                ], value: themeSettings.themeMode },
                { type: 'toggle', id: 'animation', title: '动画效果', desc: '启用系统动画', value: themeSettings.animation }
            ]
        }
    };

    const timeSettings = {
        autoTime: true,
        timezone: 'UTC+8',
        year: 2024,
        month: 1,
        day: 1,
        hour: 12,
        minute: 0,
        use12Hour: false
    };

    const timeSubPages = {
        'datetime': {
            title: '日期和时间',
            icon: 'svg-clock',
            items: [
                { type: 'toggle', id: 'autoTime', title: '自动设置时间', desc: '自动从网络获取时间', value: timeSettings.autoTime },
                { type: 'select', id: 'timezone', title: '时区', desc: '选择时区', options: [
                    { value: 'UTC+8', label: '中国标准时间 (UTC+8)' },
                    { value: 'UTC+9', label: '日本标准时间 (UTC+9)' },
                    { value: 'UTC-5', label: '美国东部时间 (UTC-5)' },
                    { value: 'UTC', label: '世界协调时间 (UTC)' }
                ], value: timeSettings.timezone },
                { type: 'select', id: 'use12Hour', title: '时间格式', desc: '选择12小时或24小时制', options: [
                    { value: 'false', label: '24小时制' },
                    { value: 'true', label: '12小时制 (上午/下午)' }
                ], value: String(timeSettings.use12Hour) },
                { type: 'number', id: 'year', title: '年份', desc: '设置年份', value: timeSettings.year, min: 2000, max: 2100 },
                { type: 'number', id: 'month', title: '月份', desc: '设置月份', value: timeSettings.month, min: 1, max: 12 },
                { type: 'number', id: 'day', title: '日期', desc: '设置日期', value: timeSettings.day, min: 1, max: 31 },
                { type: 'number', id: 'hour', title: '小时', desc: '设置小时', value: timeSettings.hour, min: 0, max: 23 },
                { type: 'number', id: 'minute', title: '分钟', desc: '设置分钟', value: timeSettings.minute, min: 0, max: 59 }
            ]
        },
        'language': {
            title: '语言',
            icon: 'svg-settings',
            items: [
                { type: 'select', id: 'locale', title: '显示语言', desc: '选择系统显示语言', options: [
                    { value: 'zh-CN', label: '简体中文' },
                    { value: 'en-US', label: 'English' }
                ], value: getLocale() }
            ]
        }
    };

    const gameSettings = {
        gameMode: false,
        gameBar: true
    };

    const gameSubPages = {
        'game-mode': {
            title: '游戏模式',
            icon: 'svg-game',
            items: [
                { type: 'toggle', id: 'gameMode', title: '游戏模式', desc: '优化游戏性能', value: gameSettings.gameMode },
                { type: 'toggle', id: 'gameBar', title: '游戏栏', desc: '使用游戏栏录制和广播', value: gameSettings.gameBar }
            ]
        }
    };

    const accessibilitySettings = {
        narrator: false,
        magnifier: false,
        highContrast: isHighContrast(),
        reduceMotion: document.body.classList.contains('reduce-motion'),
        fontScale: Math.round(getFontScale() * 100),
        animLevel: (window.MXOS && window.MXOS.AnimLevel && typeof window.MXOS.AnimLevel.get === 'function') ? window.MXOS.AnimLevel.get() : (document.body.getAttribute('data-anim-level') || 'comfort')
    };

    const accessibilitySubPages = {
        'visual': {
            title: '视觉',
            icon: 'svg-contrast',
            items: [
                { type: 'toggle', id: 'highContrast', title: '高对比度模式', desc: '使用纯黑背景、纯白文字和高亮强调色，便于辨识', value: accessibilitySettings.highContrast },
                { type: 'slider', id: 'fontScale', title: '字体大小', desc: '调整系统字号（80% - 200%）', min: 80, max: 200, step: 5, value: accessibilitySettings.fontScale, suffix: '%' },
                { type: 'select', id: 'animLevel', title: '动画级别', desc: '控制系统动画强度（极简/适度/丰富/极致）', options: [
                    { value: 'minimal', label: '极简（仅核心动画）' },
                    { value: 'comfort', label: '适度（核心+舒适，默认）' },
                    { value: 'rich', label: '丰富（核心+舒适+部分装饰）' },
                    { value: 'extreme', label: '极致（全部动画）' }
                ], value: accessibilitySettings.animLevel },
                { type: 'toggle', id: 'reduceMotion', title: '减少动画', desc: '降低系统动画和过渡效果的时长', value: accessibilitySettings.reduceMotion },
                { type: 'toggle', id: 'narrator', title: '讲述人', desc: '屏幕阅读器', value: accessibilitySettings.narrator },
                { type: 'toggle', id: 'magnifier', title: '放大镜', desc: '放大屏幕内容', value: accessibilitySettings.magnifier },
                { type: 'slider', id: 'cursorSize', title: '光标大小', desc: '调整鼠标光标大小', min: 1, max: 5, value: 2, suffix: '' }
            ]
        }
    };

    const privacySettings = {
        location: false,
        camera: true,
        microphone: true
    };

    const privacySubPages = {
        'privacy-location': {
            title: '位置服务',
            icon: 'svg-map',
            items: [
                { type: 'toggle', id: 'location', title: '位置服务', desc: '允许应用访问位置', value: privacySettings.location }
            ]
        },
        'privacy-camera': {
            title: '相机',
            icon: 'svg-camera',
            items: [
                { type: 'toggle', id: 'camera', title: '相机', desc: '允许应用访问相机', value: privacySettings.camera }
            ]
        },
        'privacy-mic': {
            title: '麦克风',
            icon: 'svg-mic',
            items: [
                { type: 'toggle', id: 'microphone', title: '麦克风', desc: '允许应用访问麦克风', value: privacySettings.microphone }
            ]
        },
        'security-lock': {
            title: '配置解锁方式',
            icon: 'svg-shield',
            items: [
                { type: 'select', id: 'lockType', title: '解锁方式', desc: '设置锁屏时的验证方式（无 / 4 位 PIN / 密码）', options: [
                    { value: 'none', label: '无（直接解锁）' },
                    { value: 'pin', label: '4 位 PIN' },
                    { value: 'password', label: '密码' }
                ], value: (window.MXOS.Lock && window.MXOS.Lock.getType()) || 'none' }
            ]
        }
    };

    let currentSettingsPage = 'system';
    let currentSubPages = systemSubPages;
    let currentSubPage = null;

    contentEl.innerHTML = `
        <div class="settings-container">
            <div class="settings-sidebar">
                <input type="text" class="settings-search" placeholder="查找设置">
                <div class="settings-item active" data-page="system">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-display"/></svg>
                    <span>系统</span>
                </div>
                <div class="settings-item" data-page="network">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-wifi"/></svg>
                    <span>网络和 Internet</span>
                </div>
                <div class="settings-item" data-page="personalization">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-personalization"/></svg>
                    <span>个性化</span>
                </div>
                <div class="settings-item" data-page="theme">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-theme"/></svg>
                    <span>主题</span>
                </div>
                <div class="settings-item" data-page="time">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-clock"/></svg>
                    <span>时间和语言</span>
                </div>
                <div class="settings-item" data-page="account">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-user"/></svg>
                    <span>账户</span>
                </div>
                <div class="settings-item" data-page="app">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-store"/></svg>
                    <span>应用</span>
                </div>
                <div class="settings-item" data-page="privacy">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-shield"/></svg>
                    <span>隐私和安全性</span>
                </div>
                <div class="settings-item" data-page="accessibility">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-contrast"/></svg>
                    <span>辅助功能</span>
                </div>
                <div class="settings-item" data-page="game">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-game"/></svg>
                    <span>游戏</span>
                </div>
                <div class="settings-item" data-page="system-tools">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-system"/></svg>
                    <span>系统工具</span>
                </div>
                <div class="settings-item" data-page="health">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    <span>系统健康</span>
                </div>
                <div class="settings-item" data-page="backup">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>备份与恢复</span>
                </div>
                <div class="settings-item" data-page="permissions">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>权限管理</span>
                </div>
                <div class="settings-item" data-page="info">
                    <svg width="20" height="20" viewBox="0 0 40 40"><use href="#svg-system"/></svg>
                    <span>关于</span>
                </div>
            </div>
            <div class="settings-main" id="settingsMain"></div>
        </div>
    `;

    const renderSystemPage = (direction = 'back') => {
        const mainEl = contentEl.querySelector('#settingsMain');
        currentSubPages = systemSubPages;
        currentSettingsPage = 'system';
        mainEl.innerHTML = `
            <div class="settings-title">系统</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="display" onclick="window.renderSettingsSubPage('display', event)">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-display"/></svg>显示</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="sound" onclick="window.renderSettingsSubPage('sound', event)">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-volume"/></svg>声音</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="notification" onclick="window.renderSettingsSubPage('notification', event)">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-bell"/></svg>通知</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="power" onclick="window.renderSettingsSubPage('power', event)">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-battery"/></svg>电源和电池</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;

        window.renderSettingsSubPage = function(subpage, event) {
            if (event) event.stopPropagation();
            renderSubPage(subpage, 'forward', currentSubPages);
        };

        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.style.pointerEvents = 'auto';
        });
    };

    const renderSubPage = (subpageId, direction = 'forward', subPages = currentSubPages) => {
        currentSubPage = subpageId;
        const subPage = subPages[subpageId];
        const mainEl = contentEl.querySelector('#settingsMain');

        let itemsHtml = '';
        subPage.items.forEach((item, index) => {
            if (item.type === 'slider') {
                itemsHtml += `
                    <div class="settings-card">
                        <svg width="32" height="32" viewBox="0 0 40 40" style="float:left;margin-right:12px"><use href="#${subPage.icon}"/></svg>
                        <div class="settings-card-title">${item.title}</div>
                        <div class="settings-card-desc">${item.desc}</div>
                        <div class="slider-container">
                            <input type="range" class="settings-slider" id="setting-${item.id}" min="${item.min}" max="${item.max}" ${item.step ? 'step="' + item.step + '"' : ''} value="${item.value}">
                            <span class="slider-value">${item.value}${item.suffix || ''}</span>
                        </div>
                    </div>
                `;
            } else if (item.type === 'toggle') {
                itemsHtml += `
                    <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <div class="settings-card-title">${item.title}</div>
                            <div class="settings-card-desc">${item.desc}</div>
                        </div>
                        <div class="toggle-switch ${item.value ? 'on' : ''}" id="setting-${item.id}"></div>
                    </div>
                `;
            } else if (item.type === 'select') {
                let optionsHtml = item.options.map(opt => `<option value="${opt.value}" ${opt.value === item.value ? 'selected' : ''}>${opt.label}</option>`).join('');
                itemsHtml += `
                    <div class="settings-card">
                        <svg width="32" height="32" viewBox="0 0 40 40" style="float:left;margin-right:12px"><use href="#${subPage.icon}"/></svg>
                        <div class="settings-card-title">${item.title}</div>
                        <div class="settings-card-desc">${item.desc}</div>
                        <select class="settings-select" id="setting-${item.id}">
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            } else if (item.type === 'number') {
                itemsHtml += `
                    <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <div class="settings-card-title">${item.title}</div>
                            <div class="settings-card-desc">${item.desc}</div>
                        </div>
                        <input type="number" class="settings-number-input" id="setting-${item.id}" min="${item.min}" max="${item.max}" value="${item.value}">
                    </div>
                `;
            } else if (item.type === 'wallpaper') {
                let currentPreviewUrl = personalizationSettings.wallpaper;
                let currentPreviewIsVideo = personalizationSettings.wallpaperType === 'video';

                const defaultWallpaper = wallPaperOptions[0].url;

                let thumbnailsHtml = wallPaperOptions.map(w => `
                    <div class="wallpaper-thumbnail ${w.url === personalizationSettings.wallpaper && personalizationSettings.wallpaperType === 'image' ? 'active' : ''}"
                         data-wallpaper="${w.value}"
                         data-url="${w.url}"
                         data-type="image"
                         style="background-image: url('${w.url}')">
                    </div>
                `).join('');
                const slideshowList = (window.MXOS.WallpaperSlideshow && window.MXOS.WallpaperSlideshow.getList()) || [];
                const slideshowInterval = (window.MXOS.WallpaperSlideshow && window.MXOS.WallpaperSlideshow.getInterval()) || '30min';
                const slideshowRunning = window.MXOS.WallpaperSlideshow && window.MXOS.WallpaperSlideshow.isRunning();
                const intervalOptions = [
                    { value: '10min', label: '10 分钟' },
                    { value: '30min', label: '30 分钟' },
                    { value: '1hour', label: '1 小时' },
                    { value: 'daily', label: '每天' }
                ];
                const intervalOptsHtml = intervalOptions.map(o => `<option value="${o.value}" ${o.value === slideshowInterval ? 'selected' : ''}>${o.label}</option>`).join('');
                const slideshowThumbsHtml = slideshowList.map((url, idx) => `
                    <div class="wallpaper-thumbnail slideshow-thumb" data-idx="${idx}" style="background-image: url('${url}'); position: relative;">
                        <span class="slideshow-remove" data-idx="${idx}" style="position:absolute; top:-4px; right:-4px; width:16px; height:16px; background:#ef4444; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; line-height:1;">×</span>
                    </div>
                `).join('');
                itemsHtml += `
                    <div class="settings-card">
                        <svg width="32" height="32" viewBox="0 0 40 40" style="float:left;margin-right:12px"><use href="#${subPage.icon}"/></svg>
                        <div class="settings-card-title">${item.title}</div>
                        <div class="settings-card-desc">${item.desc}</div>
                    </div>
                    <div class="wallpaper-preview-container">
                        <div class="wallpaper-preview-label">预览</div>
                        <div class="wallpaper-preview-large" id="wallpaper-preview" style="background-image: ${currentPreviewIsVideo ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'url(\'' + (currentPreviewUrl || defaultWallpaper) + '\')'}"></div>
                        <div class="wallpaper-thumbnails">${thumbnailsHtml}
                            <div class="wallpaper-import-btn" id="wallpaper-import" title="导入本地壁纸">+</div>
                            <div class="wallpaper-import-btn" id="wallpaper-import-video" title="导入视频壁纸" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">V</div>
                        </div>
                    </div>
                    <div class="wallpaper-preview-container">
                        <div class="wallpaper-preview-label">壁纸轮播</div>
                        <div class="settings-card-desc" style="margin-bottom:10px">选择多张壁纸，按设定间隔自动切换</div>
                        <div class="wallpaper-thumbnails" id="slideshow-thumbnails">${slideshowThumbsHtml}
                            <div class="wallpaper-import-btn" id="slideshow-add-current" title="添加当前壁纸到轮播">+</div>
                        </div>
                        <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
                            <div>
                                <div class="settings-card-title">切换间隔</div>
                                <div class="settings-card-desc">壁纸自动切换的时间间隔</div>
                            </div>
                            <select class="settings-select" id="setting-slideshow-interval" style="min-width:120px">
                                ${intervalOptsHtml}
                            </select>
                        </div>
                        <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
                            <div>
                                <div class="settings-card-title">轮播状态</div>
                                <div class="settings-card-desc" id="slideshow-status">${slideshowRunning ? '运行中' : '已停止'}</div>
                            </div>
                            <div style="display:flex; gap:8px">
                                <button id="slideshow-prev" class="mxos-tool-btn" style="padding:6px 12px;background:rgba(255,255,255,0.1);color:var(--text-color);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer">上一张</button>
                                <button id="slideshow-next" class="mxos-tool-btn" style="padding:6px 12px;background:rgba(255,255,255,0.1);color:var(--text-color);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer">下一张</button>
                                <button id="slideshow-toggle" class="mxos-tool-btn" style="padding:6px 14px;background:${slideshowRunning ? '#ef4444' : '#3b82f6'};color:#fff;border:none;border-radius:6px;cursor:pointer">${slideshowRunning ? '停止' : '开始'}</button>
                            </div>
                        </div>
                    </div>
                    <div class="wallpaper-preview-container">
                        <div class="wallpaper-preview-label">推荐壁纸</div>
                        <div class="wallpaper-thumbnails" id="recommended-wallpapers">
                            <div style="color:#888;font-size:12px;padding:8px 0">加载中...</div>
                        </div>
                    </div>
                `;
            } else if (item.type === 'accentColor') {
                const accentColors = [
                    { value: '#3b82f6', label: '蓝色' },
                    { value: '#22c55e', label: '绿色' },
                    { value: '#ef4444', label: '红色' },
                    { value: '#f59e0b', label: '橙色' },
                    { value: '#8b5cf6', label: '紫色' },
                    { value: '#ec4899', label: '粉色' },
                    { value: '#14b8a6', label: '青色' },
                    { value: '#f97316', label: '黄色' }
                ];
                let accentColorsHtml = accentColors.map(c => `
                    <div class="accent-color-option ${c.value === personalizationSettings.accentColor ? 'active' : ''}"
                         data-color="${c.value}"
                         style="background-color: ${c.value}">
                    </div>
                `).join('');
                itemsHtml += `
                    <div class="settings-card">
                        <svg width="32" height="32" viewBox="0 0 40 40" style="float:left;margin-right:12px"><use href="#${subPage.icon}"/></svg>
                        <div class="settings-card-title">${item.title}</div>
                        <div class="settings-card-desc">${item.desc}</div>
                    </div>
                    <div class="accent-color-container">
                        <div class="accent-color-palette">${accentColorsHtml}</div>
                    </div>
                `;
            } else if (item.type === 'info') {
                itemsHtml += `
                    <div class="settings-card">
                        <svg width="32" height="32" viewBox="0 0 40 40" style="float:left;margin-right:12px"><use href="#${subPage.icon}"/></svg>
                        <div class="settings-card-title">${item.title}</div>
                        <div class="settings-card-desc">${item.desc}</div>
                        <div class="battery-indicator" style="margin-top:8px">
                            <div class="battery-level" style="width: ${item.value}"></div>
                        </div>
                    </div>
                `;
            } else if (item.type === 'wifi-networks') {
                if (systemSettings.wifiOn) {
                    itemsHtml += '<div class="wifi-networks-section"><div class="wifi-networks-title">可用网络</div>';
                    item.networks.forEach((network, idx) => {
                        itemsHtml += `
                            <div class="wifi-network-item" data-network="${network.name}">
                                <svg width="20" height="20" viewBox="0 0 40 40" style="margin-right:12px"><use href="#svg-wifi"/></svg>
                                <span class="wifi-network-name">${network.name}</span>
                                <span class="wifi-network-signal">${network.signal}%</span>
                                ${network.connected ? '<span class="wifi-connected-tag">已连接</span>' : ''}
                            </div>
                        `;
                    });
                    itemsHtml += '</div>';
                }
            }
        });

        mainEl.innerHTML = `
            <div class="settings-subpage-header">
                <div class="back-btn" id="backToSystem"><svg width="16" height="16" viewBox="0 0 40 40"><use href="#svg-arrow-left"/></svg>返回</div>
                <div class="settings-title">${subPage.title}</div>
            </div>
            <div class="settings-section">
                ${itemsHtml}
            </div>
        `;

        if (subpageId === 'background') {
            fetchRecommendedWallpapers().then(items => {
                const container = document.getElementById('recommended-wallpapers');
                if (!container) return;
                if (!items.length) {
                    container.innerHTML = '<div style="color:#888;font-size:12px;padding:8px 0">暂无推荐壁纸</div>';
                    return;
                }
                container.innerHTML = items.slice(0, 24).map(name => {
                    const url = RECOMMENDED_WALLPAPERS_BASE + encodeURIComponent(name);
                    return `<div class="wallpaper-thumbnail recommended-wallpaper" data-url="${url}" style="background-image: url('${url}')"></div>`;
                }).join('');
                container.querySelectorAll('.recommended-wallpaper').forEach(thumb => {
                    thumb.addEventListener('click', () => {
                        applyImageWallpaper(thumb.dataset.url);
                        mainEl.querySelectorAll('.wallpaper-thumbnail').forEach(t => t.classList.remove('active'));
                        thumb.classList.add('active');
                    });
                });
            });
        }

        const backBtn = document.getElementById('backToSystem');
        if (backBtn) {
            backBtn.onclick = function() {
                const mainEl = contentEl.querySelector('#settingsMain');
                mainEl.style.opacity = '0';
                mainEl.style.transform = 'translateX(-20px)';
                setTimeout(function() {
                    getBackFunction()();
                    setTimeout(function() {
                        const newMainEl = contentEl.querySelector('#settingsMain');
                        newMainEl.style.opacity = '1';
                        newMainEl.style.transform = 'translateX(0)';
                    }, 50);
                }, 200);
            };
        }

        mainEl.querySelectorAll('.settings-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const settingId = e.target.id.replace('setting-', '');
                const valueEl = e.target.nextElementSibling;
                const valueSpan = e.target.parentElement.querySelector('.slider-value');
                const suffix = valueSpan && valueSpan.textContent ? (valueSpan.textContent.match(/[^0-9.\-]+$/) ? valueSpan.textContent.match(/[^0-9.\-]+$/)[0] : '') : '%';

                if (settingId === 'fontScale') {
                    const percent = parseInt(e.target.value);
                    setFontScale(percent / 100);
                    accessibilitySettings.fontScale = percent;
                    if (valueEl) valueEl.textContent = percent + '%';
                    return;
                }

                if (settingId === 'cursorSize') {
                    accessibilitySettings.cursorSize = parseInt(e.target.value);
                    if (valueEl) valueEl.textContent = e.target.value;
                    return;
                }

                systemSettings[settingId] = e.target.value;
                if (valueEl) valueEl.textContent = e.target.value + (suffix || '%');
                if (settingId === 'brightness' || settingId === 'volume' || settingId === 'displayScale') {
                    try { localStorage.setItem('mxos-system-settings', JSON.stringify(systemSettings)); } catch (err) {}
                }

                if (settingId === 'brightness') {
                    const brightnessOverlay = document.getElementById('brightness-overlay');
                    if (brightnessOverlay) {
                        brightnessOverlay.style.opacity = (100 - e.target.value) / 100 * 0.85;
                    }
                }

                if (settingId === 'nightLight') {
                    const brightnessOverlay = document.getElementById('brightness-overlay');
                    if (e.target.checked) {
                        if (brightnessOverlay) {
                            brightnessOverlay.style.backgroundColor = 'rgba(255, 180, 0, 0.2)';
                            brightnessOverlay.style.opacity = 1;
                        }
                        systemSettings.brightness = 60;
                        try { localStorage.setItem('mxos-system-settings', JSON.stringify(systemSettings)); } catch (err) {}
                        const brightnessSlider = document.getElementById('setting-brightness');
                        if (brightnessSlider) {
                            brightnessSlider.value = 60;
                            brightnessSlider.nextElementSibling.textContent = '60%';
                        }
                    } else {
                        if (brightnessOverlay) {
                            brightnessOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
                            brightnessOverlay.style.opacity = (100 - systemSettings.brightness) / 100 * 0.85;
                        }
                    }
                }

                if (settingId === 'scale') {
                    const scale = parseInt(e.target.value) / 100;
                    document.body.style.zoom = scale;
                    const wallpaperBg = document.getElementById('wallpaper-bg');
                    if (wallpaperBg) {
                        wallpaperBg.style.transform = 'scale(' + (1 / scale) + ')';
                        wallpaperBg.style.transformOrigin = 'center center';
                    }
                }
            });
        });

        mainEl.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const settingId = toggle.id.replace('setting-', '');

                if (settingId === 'highContrast') {
                    const next = !isHighContrast();
                    setHighContrast(next);
                    accessibilitySettings.highContrast = next;
                    toggle.classList.toggle('on', next);
                    toggle.setAttribute('aria-checked', next ? 'true' : 'false');
                    return;
                }

                if (settingId === 'reduceMotion') {
                    const next = !document.body.classList.contains('reduce-motion');
                    if (next) document.body.classList.add('reduce-motion');
                    else document.body.classList.remove('reduce-motion');
                    accessibilitySettings.reduceMotion = next;
                    toggle.classList.toggle('on', next);
                    toggle.setAttribute('aria-checked', next ? 'true' : 'false');
                    try { localStorage.setItem('mxos_reduce_motion', next ? '1' : '0'); } catch (err) {}
                    return;
                }

                if (settingId === 'narrator' || settingId === 'magnifier') {
                    accessibilitySettings[settingId] = !accessibilitySettings[settingId];
                    toggle.classList.toggle('on', accessibilitySettings[settingId]);
                    toggle.setAttribute('aria-checked', accessibilitySettings[settingId] ? 'true' : 'false');
                    return;
                }

                systemSettings[settingId] = !systemSettings[settingId];
                toggle.classList.toggle('on');
                toggle.setAttribute('aria-checked', systemSettings[settingId] ? 'true' : 'false');

                if (settingId === 'nightLight') {
                    const brightnessOverlay = document.getElementById('brightness-overlay');
                    if (systemSettings[settingId]) {
                        systemSettings.lastBrightness = systemSettings.brightness;
                        if (brightnessOverlay) {
                            brightnessOverlay.style.backgroundColor = 'rgba(255, 180, 0, 0.2)';
                            brightnessOverlay.style.opacity = 1;
                        }
                        systemSettings.brightness = 60;
                        try { localStorage.setItem('mxos-system-settings', JSON.stringify(systemSettings)); } catch (err) {}
                        const brightnessSlider = document.getElementById('setting-brightness');
                        if (brightnessSlider) {
                            brightnessSlider.value = 60;
                            brightnessSlider.nextElementSibling.textContent = '60%';
                        }
                    } else {
                        if (brightnessOverlay) {
                            brightnessOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
                        }
                        const prevBrightness = systemSettings.lastBrightness;
                        systemSettings.brightness = prevBrightness;
                        try { localStorage.setItem('mxos-system-settings', JSON.stringify(systemSettings)); } catch (err) {}
                        const brightnessSlider = document.getElementById('setting-brightness');
                        if (brightnessSlider) {
                            brightnessSlider.value = prevBrightness;
                            brightnessSlider.nextElementSibling.textContent = prevBrightness + '%';
                        }
                        if (brightnessOverlay) {
                            brightnessOverlay.style.opacity = (100 - prevBrightness) / 100 * 0.85;
                        }
                    }
                }

                if (settingId === 'wifiOn') {
                    const wifiSection = document.querySelector('.wifi-networks-section');
                    if (wifiSection) {
                        if (systemSettings.wifiOn) {
                            wifiSection.style.display = 'block';
                            const firstNetwork = wifiSection.querySelector('.wifi-network-item');
                            if (firstNetwork) {
                                const tag = firstNetwork.querySelector('.wifi-connected-tag');
                                if (tag) {
                                    tag.remove();
                                }
                                const spinner = firstNetwork.querySelector('.wifi-connecting');
                                if (spinner) {
                                    spinner.remove();
                                }
                                const connectingSpinner = document.createElement('span');
                                connectingSpinner.className = 'wifi-connecting';
                                firstNetwork.querySelector('.wifi-network-signal').appendChild(connectingSpinner);
                                setTimeout(() => {
                                    const sp = firstNetwork.querySelector('.wifi-connecting');
                                    if (sp) sp.remove();
                                    const connectedTag = document.createElement('span');
                                    connectedTag.className = 'wifi-connected-tag';
                                    connectedTag.textContent = '已连接';
                                    firstNetwork.querySelector('.wifi-network-signal').appendChild(connectedTag);
                                }, 3000);
                            }
                        } else {
                            wifiSection.style.display = 'none';
                        }
                    }
                }
            });
        });

        mainEl.querySelectorAll('.settings-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const settingId = e.target.id.replace('setting-', '');

                if (settingId === 'animLevel') {
                    const level = e.target.value;
                    accessibilitySettings.animLevel = level;
                    if (window.MXOS && window.MXOS.AnimLevel && typeof window.MXOS.AnimLevel.set === 'function') {
                        window.MXOS.AnimLevel.set(level);
                    } else if (document.body) {
                        document.body.setAttribute('data-anim-level', level);
                        try { localStorage.setItem('mxos_anim_level', level); } catch (err) {}
                    }
                    if (window.MXOS && window.MXOS.dialog && typeof window.MXOS.dialog.toast === 'function') {
                        const labels = { minimal: '极简', comfort: '适度', rich: '丰富', extreme: '极致' };
                        window.MXOS.dialog.toast('动画级别已切换为「' + (labels[level] || level) + '」', 'info');
                    }
                    return;
                }

                const settingsObj = currentSettingsPage === 'time' ? timeSettings : systemSettings;
                settingsObj[settingId] = e.target.value;

                if (settingId === 'locale') {
                    setLocale(e.target.value);
                    return;
                }

                if (settingId === 'scale') {
                    const scale = parseInt(e.target.value) / 100;
                    document.body.style.zoom = scale;
                    const wallpaperBg = document.getElementById('wallpaper-bg');
                    if (wallpaperBg) {
                        wallpaperBg.style.transform = 'scale(' + (1 / scale) + ')';
                        wallpaperBg.style.transformOrigin = 'center center';
                    }
                    systemSettings.displayScale = parseInt(e.target.value);
                    try { localStorage.setItem('mxos-system-settings', JSON.stringify(systemSettings)); } catch (err) {}
                }
                if (settingId === 'themeMode') {
                    themeSettings.themeMode = e.target.value;
                    const pref = e.target.value;
                    try { localStorage.setItem('mxos_theme_mode_pref', pref); } catch (err) {}
                    let actualTheme = pref;
                    if (pref === 'auto') {
                        actualTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
                    }
                    try { localStorage.setItem('mxos_theme_mode', actualTheme); } catch (err) {}
                    const selectRect = e.target.getBoundingClientRect();
                    const cx = selectRect.left + selectRect.width / 2;
                    const cy = selectRect.top + selectRect.height / 2;
                    if (window.MXOS && window.MXOS.anim && typeof window.MXOS.anim.themeTransition === 'function') {
                        const transitionColor = actualTheme === 'light' ? '#f5f5f7' : '#0e1513';
                        window.MXOS.anim.themeTransition(cx, cy, transitionColor);
                        setTimeout(() => {
                            document.body.setAttribute('data-theme', actualTheme);
                            window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: actualTheme, pref } }));
                        }, 280);
                    } else {
                        document.body.setAttribute('data-theme', actualTheme);
                        window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: actualTheme, pref } }));
                    }
                }
                if (settingId === 'lockType') {
                    const lock = window.MXOS.Lock;
                    if (!lock) return;
                    const choice = e.target.value;
                    if (choice === 'none') {
                        lock.clear();
                        if (window.MXOS.dialog) window.MXOS.dialog.toast('已清除解锁验证', 'info');
                    } else if (choice === 'pin') {
                        const input = await window.MXOS.dialog.prompt('请输入 4 位数字 PIN：');
                        if (input == null) {
                            e.target.value = lock.getType();
                            return;
                        }
                        if (!/^\d{4}$/.test(input)) {
                            if (window.MXOS.dialog) window.MXOS.dialog.toast('PIN 必须为 4 位数字', 'error');
                            e.target.value = lock.getType();
                            return;
                        }
                        const confirmInput = await window.MXOS.dialog.prompt('请再次输入 PIN 以确认：');
                        if (confirmInput !== input) {
                            if (window.MXOS.dialog) window.MXOS.dialog.toast('两次输入不一致', 'error');
                            e.target.value = lock.getType();
                            return;
                        }
                        lock.setPin(input);
                        if (window.MXOS.dialog) window.MXOS.dialog.toast('PIN 已设置', 'success');
                    } else if (choice === 'password') {
                        const input = await window.MXOS.dialog.prompt('请输入密码：');
                        if (input == null || input === '') {
                            e.target.value = lock.getType();
                            return;
                        }
                        const confirmInput = await window.MXOS.dialog.prompt('请再次输入密码以确认：');
                        if (confirmInput !== input) {
                            if (window.MXOS.dialog) window.MXOS.dialog.toast('两次输入不一致', 'error');
                            e.target.value = lock.getType();
                            return;
                        }
                        lock.setPassword(input);
                        if (window.MXOS.dialog) window.MXOS.dialog.toast('密码已设置', 'success');
                    }
                }
            });
        });

        mainEl.querySelectorAll('.settings-number-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const settingId = e.target.id.replace('setting-', '');
                const newValue = parseInt(e.target.value);
                const min = parseInt(e.target.min);
                const max = parseInt(e.target.max);

                if (newValue >= min && newValue <= max) {
                    timeSettings[settingId] = newValue;
                }
            });
        });

        mainEl.querySelectorAll('.wallpaper-thumbnail').forEach(thumb => {
            thumb.addEventListener('click', () => {
                const wallpaperUrl = thumb.dataset.url;
                applyImageWallpaper(wallpaperUrl);
                mainEl.querySelectorAll('.wallpaper-thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });

        const importBtn = document.getElementById('wallpaper-import');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const img = new Image();
                            img.onload = () => {
                                applyImageWallpaper(event.target.result);
                                mainEl.querySelectorAll('.wallpaper-thumbnail').forEach(t => t.classList.remove('active'));
                            };
                            img.src = event.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            });
        }

        const importVideoBtn = document.getElementById('wallpaper-import-video');
        if (importVideoBtn) {
            importVideoBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const wallpaperVideo = document.getElementById('wallpaper-video');
                        const oldUrl = wallpaperVideo && wallpaperVideo.src ? wallpaperVideo.src : '';
                        if (oldUrl && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
                        const url = URL.createObjectURL(file);
                        const wallpaperBg = document.getElementById('wallpaper-bg');
                        if (wallpaperBg) {
                            wallpaperBg.style.display = 'none';
                        }
                        if (wallpaperVideo) {
                            wallpaperVideo.src = url;
                            wallpaperVideo.style.display = 'block';
                            wallpaperVideo.play();
                        }
                        personalizationSettings.wallpaper = '';
                        personalizationSettings.wallpaperType = 'video';
                        saveVideoToIndexedDB(file).then(() => {
                            saveWallpaperSettings();
                        });
                        const preview = document.getElementById('wallpaper-preview');
                        if (preview) {
                            preview.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        }
                        mainEl.querySelectorAll('.wallpaper-thumbnail').forEach(t => t.classList.remove('active'));
                        updateLockScreenWallpaper(url, 'video');
                        window.dispatchEvent(new CustomEvent('wallpaper-change', { detail: { url: url, type: 'video' } }));
                    }
                };
                input.click();
            });
        }

        const slideshowAddBtn = document.getElementById('slideshow-add-current');
        if (slideshowAddBtn) {
            slideshowAddBtn.addEventListener('click', () => {
                const ws = window.MXOS.WallpaperSlideshow;
                if (!ws) return;
                const currentUrl = personalizationSettings.wallpaper;
                if (!currentUrl) {
                    if (window.MXOS.dialog) window.MXOS.dialog.toast('请先选择一张壁纸', 'warning');
                    return;
                }
                const list = ws.getList();
                if (list.indexOf(currentUrl) !== -1) {
                    if (window.MXOS.dialog) window.MXOS.dialog.toast('该壁纸已在轮播列表中', 'info');
                    return;
                }
                list.push(currentUrl);
                ws.setList(list);
                if (window.MXOS.dialog) window.MXOS.dialog.toast('已添加到轮播列表', 'success');
                renderSubPage(currentSubPage, 'forward', currentSubPages);
            });
        }

        mainEl.querySelectorAll('.slideshow-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ws = window.MXOS.WallpaperSlideshow;
                if (!ws) return;
                const idx = parseInt(btn.dataset.idx, 10);
                const list = ws.getList();
                if (idx >= 0 && idx < list.length) {
                    list.splice(idx, 1);
                    ws.setList(list);
                    renderSubPage(currentSubPage, 'forward', currentSubPages);
                }
            });
        });

        const slideshowIntervalSel = document.getElementById('setting-slideshow-interval');
        if (slideshowIntervalSel) {
            slideshowIntervalSel.addEventListener('change', (e) => {
                const ws = window.MXOS.WallpaperSlideshow;
                if (ws) ws.setInterval(e.target.value);
            });
        }

        const slideshowToggleBtn = document.getElementById('slideshow-toggle');
        if (slideshowToggleBtn) {
            slideshowToggleBtn.addEventListener('click', () => {
                const ws = window.MXOS.WallpaperSlideshow;
                if (!ws) return;
                if (ws.isRunning()) {
                    ws.stop();
                    if (window.MXOS.dialog) window.MXOS.dialog.toast('壁纸轮播已停止', 'info');
                } else {
                    if (ws.getList().length === 0) {
                        if (window.MXOS.dialog) window.MXOS.dialog.toast('请先添加壁纸到轮播列表', 'warning');
                        return;
                    }
                    ws.start();
                    if (window.MXOS.dialog) window.MXOS.dialog.toast('壁纸轮播已开始', 'success');
                }
                renderSubPage(currentSubPage, 'forward', currentSubPages);
            });
        }

        const slideshowPrevBtn = document.getElementById('slideshow-prev');
        if (slideshowPrevBtn) {
            slideshowPrevBtn.addEventListener('click', () => {
                const ws = window.MXOS.WallpaperSlideshow;
                if (ws && ws.getList().length > 0) ws.prev();
            });
        }

        const slideshowNextBtn = document.getElementById('slideshow-next');
        if (slideshowNextBtn) {
            slideshowNextBtn.addEventListener('click', () => {
                const ws = window.MXOS.WallpaperSlideshow;
                if (ws && ws.getList().length > 0) ws.next();
            });
        }

        mainEl.querySelectorAll('.accent-color-option').forEach(option => {
            option.addEventListener('click', () => {
                const colorValue = option.dataset.color;
                personalizationSettings.accentColor = colorValue;
                document.documentElement.style.setProperty('--accent-color', colorValue);
                document.querySelectorAll('.toggle-switch.on').forEach(toggle => {
                    toggle.style.background = colorValue;
                });
                mainEl.querySelectorAll('.accent-color-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                saveWallpaperSettings();
            });
        });
    };

    const renderNetworkPage = () => {
        currentSettingsPage = 'network';
        currentSubPages = networkSubPages;
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">网络和 Internet</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="wifi">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-wifi"/></svg>WLAN</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="ethernet">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-hard-disk"/></svg>以太网</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;
        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                renderSubPage(item.dataset.subpage, 'forward', networkSubPages);
            });
        });
    };

    const renderPersonalizationPage = () => {
        currentSettingsPage = 'personalization';
        currentSubPages = personalizationSubPages;
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">个性化</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="background">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-folder"/></svg>背景</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="color">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-personalization"/></svg>颜色</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;
        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                renderSubPage(item.dataset.subpage, 'forward', personalizationSubPages);
            });
        });
    };

    const renderThemePage = () => {
        currentSettingsPage = 'theme';
        currentSubPages = themeSubPages;
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">主题</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="theme-settings">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-theme"/></svg>主题设置</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;
        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                renderSubPage(item.dataset.subpage, 'forward', themeSubPages);
            });
        });
    };

    const renderTimePage = () => {
        currentSettingsPage = 'time';
        currentSubPages = timeSubPages;
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">时间和语言</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="datetime">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-clock"/></svg>日期和时间</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="language">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-settings"/></svg>语言</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;
        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                renderSubPage(item.dataset.subpage, 'forward', timeSubPages);
            });
        });
    };

    const renderGamePage = () => {
        currentSettingsPage = 'game';
        currentSubPages = gameSubPages;
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">游戏</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="game-mode">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-game"/></svg>游戏模式</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;
        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                renderSubPage(item.dataset.subpage, 'forward', gameSubPages);
            });
        });
    };

    const renderAccessibilityPage = () => {
        currentSettingsPage = 'accessibility';
        currentSubPages = accessibilitySubPages;
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">辅助功能</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="visual">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-contrast"/></svg>视觉</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;
        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                renderSubPage(item.dataset.subpage, 'forward', accessibilitySubPages);
            });
        });
    };

    const renderPrivacyPage = () => {
        currentSettingsPage = 'privacy';
        currentSubPages = privacySubPages;
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">隐私和安全性</div>
            <div class="settings-section">
                <div class="settings-menu-item" data-subpage="privacy-location">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-map"/></svg>位置服务</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="privacy-camera">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-camera"/></svg>相机</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="privacy-mic">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-mic"/></svg>麦克风</span>
                    <span class="menu-arrow">›</span>
                </div>
                <div class="settings-menu-item" data-subpage="security-lock">
                    <span><svg width="20" height="20" viewBox="0 0 40 40" style="vertical-align:middle;margin-right:8px"><use href="#svg-shield"/></svg>配置解锁方式</span>
                    <span class="menu-arrow">›</span>
                </div>
            </div>
        `;
        mainEl.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                renderSubPage(item.dataset.subpage, 'forward', privacySubPages);
            });
        });
    };

    const renderAppPage = () => {
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">应用</div>
            <div class="settings-section">
                <div class="settings-card">
                    <div class="settings-card-title">应用和功能</div>
                    <div class="settings-card-desc">查看和管理已安装的应用程序</div>
                </div>
                <div class="settings-card">
                    <div class="settings-card-title">默认应用</div>
                    <div class="settings-card-desc">设置默认程序</div>
                </div>
            </div>
        `;
    };

    const ACCOUNT_AVATAR_MAX_BYTES = 1024 * 1024;

    function readAccountAvatarFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) { resolve(''); return; }
            if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type || '')) { reject(new Error('头像仅支持 png/jpeg/webp/gif')); return; }
            if (file.size > ACCOUNT_AVATAR_MAX_BYTES) { reject(new Error('头像不能超过 1MB')); return; }
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('头像读取失败'));
            reader.readAsDataURL(file);
        });
    }

    function validateAccountAvatarUrl(url) {
        return new Promise((resolve, reject) => {
            const raw = String(url || '').trim();
            if (!raw) { resolve(''); return; }
            let parsed;
            try { parsed = new URL(raw); } catch { reject(new Error('头像链接格式无效')); return; }
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') { reject(new Error('头像链接仅支持 http/https')); return; }
            const img = new Image();
            const timer = setTimeout(() => { img.onload = img.onerror = null; reject(new Error('头像链接加载超时')); }, 8000);
            img.onload = () => { clearTimeout(timer); resolve(parsed.toString()); };
            img.onerror = () => { clearTimeout(timer); reject(new Error('头像链接无法加载')); };
            img.src = parsed.toString();
        });
    }

    const renderAccountPage = () => {
        currentSettingsPage = 'account';
        currentSubPages = {};
        const mainEl = contentEl.querySelector('#settingsMain');
        const user = (state.user && state.user.isLoggedIn) ? state.user : null;
        const cloudStatus = (window.MXOS && window.MXOS.Cloud && window.MXOS.Cloud.getStatus)
            ? window.MXOS.Cloud.getStatus()
            : { status: 'idle', lastSync: 0, lastSyncLabel: '尚未同步', loggedIn: false };
        const serviceOk = (window.MXOS && window.MXOS.User && window.MXOS.User.isServiceAvailable)
            ? window.MXOS.User.isServiceAvailable()
            : false;

        const avatarHtml = user && user.avatar
            ? `<img src="${user.avatar}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover" onerror="this.style.display='none';this.parentNode.innerHTML='<svg width=&quot;64&quot; height=&quot;64&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><use href=&quot;#icon-user&quot;/></svg>'">`
            : (user && user.name
                ? `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:600">${escapeHtmlAccount(user.name.charAt(0).toUpperCase())}</div>`
                : `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-user"/></svg>`);

        const statusLabel = {
            idle: '空闲',
            pushing: '上传中',
            pulling: '下载中',
            syncing: '同步中',
            success: '已同步',
            error: '同步失败'
        }[cloudStatus.status] || cloudStatus.status;
        const statusColor = cloudStatus.status === 'success' ? '#10b981'
            : (cloudStatus.status === 'error' ? '#ef4444' : '#60a5fa');

        mainEl.innerHTML = `
            <div class="settings-title">账户</div>
            <div class="settings-section">
                ${user ? `
                    <div class="settings-card" style="display:flex;align-items:center;gap:16px">
                        <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#cbd5e1">${avatarHtml}</div>
                        <div style="flex:1;min-width:0">
                            <div class="settings-card-title" style="font-size:16px">${escapeHtmlAccount(user.name || '用户')}</div>
                            <div class="settings-card-desc">已登录 · ${escapeHtmlAccount(user.id || '')}</div>
                        </div>
                        <button id="mxos-account-logout" style="background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">退出登录</button>
                    </div>
                    <div class="settings-card">
                        <div class="settings-card-title">编辑资料</div>
                        <div class="settings-card-desc">用户名允许重复；头像可上传本地图片或使用可加载的外部图片链接</div>
                        <div style="display:grid;grid-template-columns:88px 1fr;gap:16px;margin-top:14px;align-items:start">
                            <div id="mxos-profile-avatar-preview" style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#cbd5e1">${avatarHtml}</div>
                            <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
                                <label style="font-size:12px;color:#9ca3af">用户名</label>
                                <input id="mxos-profile-name" value="${escapeHtmlAccount(user.name || '')}" maxlength="24" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:8px;padding:9px 10px;outline:none">
                                <label style="font-size:12px;color:#9ca3af">上传头像</label>
                                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                                    <input id="mxos-profile-avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none">
                                    <label for="mxos-profile-avatar-file" style="display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;padding:9px 14px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 8px 20px rgba(59,130,246,.28);user-select:none">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        选择图片
                                    </label>
                                    <span id="mxos-profile-avatar-file-name" style="min-width:120px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:7px 10px">未选择图片</span>
                                </div>
                                <div style="font-size:11px;color:#64748b;margin-top:-4px">支持 png / jpeg / webp / gif，最大 1MB</div>
                                <label style="font-size:12px;color:#9ca3af">外部头像链接</label>
                                <div style="display:flex;gap:8px">
                                    <input id="mxos-profile-avatar-url" value="${escapeHtmlAccount(user.avatar && !/\/api\/users\/[^/]+\/avatar/.test(user.avatar) ? user.avatar : '')}" placeholder="https://example.com/avatar.png" style="flex:1;min-width:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:8px;padding:9px 10px;outline:none">
                                    <button id="mxos-profile-preview-url" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">验证</button>
                                </div>
                                <div id="mxos-profile-message" style="min-height:16px;font-size:12px;color:#9ca3af"></div>
                                <div style="display:flex;gap:8px;flex-wrap:wrap">
                                    <button id="mxos-profile-save" style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">保存资料</button>
                                    <button id="mxos-profile-clear-avatar" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">清除头像</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="settings-card">
                        <div class="settings-card-title">云同步状态</div>
                        <div class="settings-card-desc">本地与云端数据的同步情况</div>
                        <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
                            <span style="width:8px;height:8px;border-radius:50%;background:${statusColor}"></span>
                            <span style="font-size:13px;color:#e2e8f0">${statusLabel}</span>
                            <span style="font-size:12px;color:#6b7280;margin-left:8px">· ${escapeHtmlAccount(cloudStatus.lastSyncLabel || '尚未同步')}</span>
                        </div>
                        <div style="margin-top:12px;display:flex;gap:8px">
                            <button id="mxos-account-sync" style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">立即同步</button>
                            <button id="mxos-account-pull" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">从云端拉取</button>
                        </div>
                    </div>
                    <div class="settings-card">
                        <div class="settings-card-title">云盘使用情况</div>
                        <div class="settings-card-desc">查看云端存储用量</div>
                        <div id="mxos-cloud-usage" style="margin-top:12px;color:#9ca3af;font-size:13px">加载中...</div>
                    </div>
                    <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <div class="settings-card-title">切换账号</div>
                            <div class="settings-card-desc">退出当前账号并登录新账号</div>
                        </div>
                        <button id="mxos-account-switch" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">切换</button>
                    </div>
                    <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center;border-color:rgba(239,68,68,0.28)">
                        <div>
                            <div class="settings-card-title" style="color:#fca5a5">注销账号</div>
                            <div class="settings-card-desc">永久删除当前账号和云端数据，此操作不可恢复</div>
                        </div>
                        <button id="mxos-account-delete" style="background:rgba(239,68,68,0.14);color:#fca5a5;border:1px solid rgba(239,68,68,0.35);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">注销账号</button>
                    </div>
                ` : `
                    <div class="settings-card" style="text-align:center;padding:24px">
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 14px;display:block;color:#64748b"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <div class="settings-card-title" style="margin-bottom:6px">尚未登录</div>
                        <div class="settings-card-desc" style="margin-bottom:16px">登录 MXOS 账户以启用云同步、评论等更多功能</div>
                        <div style="display:flex;gap:10px;justify-content:center">
                            <button id="mxos-account-login" style="background:#3b82f6;color:#fff;border:none;padding:9px 22px;border-radius:8px;cursor:pointer;font-size:13px">登录</button>
                            <button id="mxos-account-register" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);padding:9px 22px;border-radius:8px;cursor:pointer;font-size:13px">注册</button>
                        </div>
                    </div>
                    <div class="settings-card">
                        <div class="settings-card-title">服务状态</div>
                        <div class="settings-card-desc">云端账户与同步服务可用性</div>
                        <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
                            <span style="width:8px;height:8px;border-radius:50%;background:${serviceOk ? '#10b981' : '#ef4444'}"></span>
                            <span style="font-size:13px;color:#e2e8f0">${serviceOk ? '认证服务在线' : '认证服务不可用'}</span>
                        </div>
                        <div style="font-size:11px;color:#6b7280;margin-top:6px">服务暂不可用时，登录与同步功能将无法使用</div>
                    </div>
                `}
            </div>
        `;

        const loginBtn = mainEl.querySelector('#mxos-account-login');
        if (loginBtn) loginBtn.onclick = () => {
            if (window.MXOS && window.MXOS.User && window.MXOS.User.openAuthModal) {
                window.MXOS.User.openAuthModal('login');
            }
        };
        const registerBtn = mainEl.querySelector('#mxos-account-register');
        if (registerBtn) registerBtn.onclick = () => {
            if (window.MXOS && window.MXOS.User && window.MXOS.User.openAuthModal) {
                window.MXOS.User.openAuthModal('register');
            }
        };
        let pendingAvatarDataUrl = '';
        const profileNameInput = mainEl.querySelector('#mxos-profile-name');
        const avatarFileInput = mainEl.querySelector('#mxos-profile-avatar-file');
        const avatarUrlInput = mainEl.querySelector('#mxos-profile-avatar-url');
        const avatarFileName = mainEl.querySelector('#mxos-profile-avatar-file-name');
        const avatarPreview = mainEl.querySelector('#mxos-profile-avatar-preview');
        const profileMsg = mainEl.querySelector('#mxos-profile-message');
        const setProfileMsg = (text, color = '#9ca3af') => { if (profileMsg) { profileMsg.textContent = text || ''; profileMsg.style.color = color; } };
        const setProfilePreview = (src) => {
            if (!avatarPreview) return;
            if (src) avatarPreview.innerHTML = '<img src="' + escapeHtmlAccount(src) + '" alt="" style="width:80px;height:80px;border-radius:50%;object-fit:cover">';
            else avatarPreview.innerHTML = '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><use href="#icon-user"/></svg>';
        };
        if (avatarFileInput) avatarFileInput.onchange = async () => {
            const file = avatarFileInput.files && avatarFileInput.files[0];
            if (!file) { pendingAvatarDataUrl = ''; if (avatarFileName) avatarFileName.textContent = '未选择图片'; return; }
            try {
                pendingAvatarDataUrl = await readAccountAvatarFile(file);
                if (avatarUrlInput) avatarUrlInput.value = '';
                if (avatarFileName) avatarFileName.textContent = file.name || '已选择图片';
                setProfilePreview(pendingAvatarDataUrl);
                setProfileMsg('本地头像已选择，点击保存后生效', '#60a5fa');
            } catch (e) {
                pendingAvatarDataUrl = '';
                avatarFileInput.value = '';
                if (avatarFileName) avatarFileName.textContent = '未选择图片';
                setProfileMsg(e.message || '头像读取失败', '#ef4444');
            }
        };
        const previewUrlBtn = mainEl.querySelector('#mxos-profile-preview-url');
        if (previewUrlBtn) previewUrlBtn.onclick = async () => {
            const raw = avatarUrlInput ? avatarUrlInput.value.trim() : '';
            if (!raw) { setProfileMsg('请输入头像链接', '#ef4444'); return; }
            previewUrlBtn.disabled = true;
            previewUrlBtn.textContent = '验证中...';
            try {
                const url = await validateAccountAvatarUrl(raw);
                pendingAvatarDataUrl = '';
                if (avatarFileInput) avatarFileInput.value = '';
                if (avatarFileName) avatarFileName.textContent = '使用外部链接';
                setProfilePreview(url);
                setProfileMsg('头像链接验证通过，点击保存后生效', '#10b981');
            } catch (e) {
                setProfileMsg(e.message || '头像链接无法加载', '#ef4444');
            } finally {
                previewUrlBtn.disabled = false;
                previewUrlBtn.textContent = '验证';
            }
        };
        const saveProfileBtn = mainEl.querySelector('#mxos-profile-save');
        if (saveProfileBtn) saveProfileBtn.onclick = async () => {
            if (!window.MXOS || !window.MXOS.User || !window.MXOS.User.updateProfile) return;
            const name = profileNameInput ? profileNameInput.value.trim() : '';
            if (!name || name.length > 24) { setProfileMsg('用户名需为 1-24 个字符', '#ef4444'); return; }
            const payload = { displayName: name };
            const rawUrl = avatarUrlInput ? avatarUrlInput.value.trim() : '';
            const originalAvatarUrl = avatarUrlInput ? avatarUrlInput.defaultValue.trim() : '';
            saveProfileBtn.disabled = true;
            saveProfileBtn.textContent = '保存中...';
            try {
                if (pendingAvatarDataUrl) payload.avatarDataUrl = pendingAvatarDataUrl;
                else if (rawUrl && rawUrl !== originalAvatarUrl) payload.avatarUrl = await validateAccountAvatarUrl(rawUrl);
                await window.MXOS.User.updateProfile(payload);
                setProfileMsg('资料已保存', '#10b981');
                renderAccountPage();
            } catch (e) {
                setProfileMsg(e.message || '保存失败', '#ef4444');
            } finally {
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = '保存资料';
            }
        };
        const clearAvatarBtn = mainEl.querySelector('#mxos-profile-clear-avatar');
        if (clearAvatarBtn) clearAvatarBtn.onclick = async () => {
            if (!window.MXOS || !window.MXOS.User || !window.MXOS.User.updateProfile) return;
            clearAvatarBtn.disabled = true;
            try {
                await window.MXOS.User.updateProfile({ clearAvatar: true });
                renderAccountPage();
            } catch (e) { setProfileMsg(e.message || '清除头像失败', '#ef4444'); }
            finally { clearAvatarBtn.disabled = false; }
        };

        const logoutBtn = mainEl.querySelector('#mxos-account-logout');
        if (logoutBtn) logoutBtn.onclick = async () => {
            if (window.MXOS && window.MXOS.User && window.MXOS.User.logout) {
                await window.MXOS.User.logout();
                renderAccountPage();
            }
        };
        const deleteAccountBtn = mainEl.querySelector('#mxos-account-delete');
        if (deleteAccountBtn) deleteAccountBtn.onclick = async () => {
            if (!window.MXOS || !window.MXOS.User || !window.MXOS.User.deleteAccount) return;
            const ok = window.confirm('确定要永久注销账号吗？账号、云端文件、设置、评论等数据将被删除且不可恢复。');
            if (!ok) return;
            const ok2 = window.confirm('请再次确认：真的要删除当前账号吗？');
            if (!ok2) return;
            deleteAccountBtn.disabled = true;
            deleteAccountBtn.textContent = '注销中...';
            try {
                await window.MXOS.User.deleteAccount();
                renderAccountPage();
            } catch (e) {
                alert(e.message || '注销账号失败');
                deleteAccountBtn.disabled = false;
                deleteAccountBtn.textContent = '注销账号';
            }
        };
        const syncBtn = mainEl.querySelector('#mxos-account-sync');
        if (syncBtn) syncBtn.onclick = async () => {
            syncBtn.disabled = true;
            syncBtn.textContent = '同步中...';
            try {
                if (window.MXOS && window.MXOS.Cloud && window.MXOS.Cloud.sync) {
                    await window.MXOS.Cloud.sync();
                }
            } catch (e) {} finally {
                syncBtn.disabled = false;
                syncBtn.textContent = '立即同步';
                renderAccountPage();
            }
        };
        const pullBtn = mainEl.querySelector('#mxos-account-pull');
        if (pullBtn) pullBtn.onclick = async () => {
            pullBtn.disabled = true;
            pullBtn.textContent = '拉取中...';
            try {
                if (window.MXOS && window.MXOS.Cloud && window.MXOS.Cloud.pull) {
                    await window.MXOS.Cloud.pull({ askConflict: true });
                }
            } catch (e) {} finally {
                pullBtn.disabled = false;
                pullBtn.textContent = '从云端拉取';
            }
        };
        const switchBtn = mainEl.querySelector('#mxos-account-switch');
        if (switchBtn) switchBtn.onclick = async () => {
            if (window.MXOS && window.MXOS.User && window.MXOS.User.logout) {
                await window.MXOS.User.logout();
                setTimeout(() => {
                    if (window.MXOS.User.openAuthModal) window.MXOS.User.openAuthModal('login');
                }, 300);
            }
        };
        if (user) loadCloudUsage(mainEl);
    };

    async function loadCloudUsage(mainEl) {
        const el = mainEl.querySelector('#mxos-cloud-usage');
        if (!el) return;
        try {
            const stats = {
                settings: 1,
                apps: (state.installedApps || []).length,
                desktop: document.querySelectorAll('.desktop-icon').length
            };
            const total = stats.settings + stats.apps + stats.desktop;
            const percent = Math.min(100, Math.round(total / 100 * 10));
            el.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:10px">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#cbd5e1">
                        <span>设置项</span><span>${stats.settings} 项</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#cbd5e1">
                        <span>已同步应用</span><span>${stats.apps} 个</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#cbd5e1">
                        <span>桌面布局</span><span>${stats.desktop} 个图标</span>
                    </div>
                    <div style="margin-top:6px">
                        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
                            <div style="height:100%;width:${percent}%;background:linear-gradient(90deg,#3b82f6,#6366f1);border-radius:3px"></div>
                        </div>
                        <div style="font-size:11px;color:#6b7280;margin-top:6px">已使用约 ${total} 条数据 · 占用 ${percent}%</div>
                    </div>
                </div>
            `;
        } catch (e) {
            el.textContent = '无法获取云盘使用情况';
        }
    }

    function escapeHtmlAccount(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    const renderSystemToolsPage = () => {
        currentSettingsPage = 'system-tools';
        currentSubPages = {};
        const mainEl = contentEl.querySelector('#settingsMain');
        const incognitoEnabled = window.MXOS.System && window.MXOS.System.incognito ? window.MXOS.System.incognito.isEnabled() : false;
        mainEl.innerHTML = `
            <div class="settings-title">系统工具</div>
            <div class="settings-section">
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">冒烟测试</div>
                        <div class="settings-card-desc">运行 30 秒验证核心功能（VFS、窗口、通知、剪贴板、设置、应用商店）</div>
                    </div>
                    <button id="mxos-tool-smoke" class="mxos-tool-btn" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">运行</button>
                </div>
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">数据导出</div>
                        <div class="settings-card-desc">导出 .mxbak ZIP 备份（VFS + 设置 + 应用数据 + 桌面布局）</div>
                    </div>
                    <button id="mxos-tool-export" class="mxos-tool-btn" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">导出</button>
                </div>
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">数据彻底清除</div>
                        <div class="settings-card-desc">覆盖式删除所有数据（不可恢复，需二次确认）</div>
                    </div>
                    <button id="mxos-tool-erase" class="mxos-tool-btn" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer">清除</button>
                </div>
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">检查更新</div>
                        <div class="settings-card-desc">检查系统新版本并增量下载</div>
                    </div>
                    <button id="mxos-tool-update" class="mxos-tool-btn" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">检查</button>
                </div>
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">性能仪表盘</div>
                        <div class="settings-card-desc">查看 FPS/内存曲线、开机耗时，可导出 JSON</div>
                    </div>
                    <button id="mxos-tool-perf" class="mxos-tool-btn" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">查看</button>
                </div>
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">无痕模式</div>
                        <div class="settings-card-desc">启用后不保留 localStorage/IndexedDB/缓存数据</div>
                    </div>
                    <div class="toggle-switch ${incognitoEnabled ? 'on' : ''}" id="setting-incognito"></div>
                </div>
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">崩溃报告</div>
                        <div class="settings-card-desc">查看上次崩溃报告记录</div>
                    </div>
                    <button id="mxos-tool-crash" class="mxos-tool-btn" style="padding:8px 16px;background:#475569;color:#fff;border:none;border-radius:6px;cursor:pointer">查看</button>
                </div>
            </div>
        `;
        const smokeBtn = mainEl.querySelector('#mxos-tool-smoke');
        if (smokeBtn) {
            smokeBtn.onclick = async () => {
                smokeBtn.disabled = true;
                smokeBtn.textContent = '运行中...';
                try {
                    const report = await window.MXOS.System.smokeTest.run();
                    smokeBtn.textContent = `通过 ${report.passed}/${report.total}`;
                } catch (e) {
                    smokeBtn.textContent = '失败';
                }
                setTimeout(() => {
                    smokeBtn.disabled = false;
                    smokeBtn.textContent = '运行';
                }, 4000);
            };
        }
        const exportBtn = mainEl.querySelector('#mxos-tool-export');
        if (exportBtn) {
            exportBtn.onclick = async () => {
                exportBtn.disabled = true;
                exportBtn.textContent = '导出中...';
                try { await window.MXOS.System.dataExport.export(); } catch (e) {}
                exportBtn.disabled = false;
                exportBtn.textContent = '导出';
            };
        }
        const eraseBtn = mainEl.querySelector('#mxos-tool-erase');
        if (eraseBtn) {
            eraseBtn.onclick = () => {
                window.MXOS.System.dataErase.erase();
            };
        }
        const updateBtn = mainEl.querySelector('#mxos-tool-update');
        if (updateBtn) {
            updateBtn.onclick = async () => {
                updateBtn.disabled = true;
                updateBtn.textContent = '检查中...';
                try {
                    const res = await window.MXOS.System.update.check();
                    if (!res.hasUpdate && !res.error) {
                        updateBtn.textContent = '已是最新';
                    } else if (res.error) {
                        updateBtn.textContent = '失败';
                    } else {
                        updateBtn.textContent = '有更新';
                    }
                } catch (e) {
                    updateBtn.textContent = '失败';
                }
                setTimeout(() => {
                    updateBtn.disabled = false;
                    updateBtn.textContent = '检查';
                }, 4000);
            };
        }
        const perfBtn = mainEl.querySelector('#mxos-tool-perf');
        if (perfBtn) {
            perfBtn.onclick = () => {
                window.MXOS.System.perfTrace.exportJSON();
            };
        }
        const crashBtn = mainEl.querySelector('#mxos-tool-crash');
        if (crashBtn) {
            crashBtn.onclick = () => {
                const reports = window.MXOS.System.crashReporter.getAllReports();
                if (reports.length === 0) {
                    if (window.MXOS && window.MXOS.notify) {
                        window.MXOS.notify({ title: '无崩溃记录', body: '系统运行正常', type: 'success', duration: 2500 });
                    }
                } else {
                    console.log('MXOS 崩溃记录:', reports);
                    if (window.MXOS && window.MXOS.notify) {
                        window.MXOS.notify({ title: '崩溃记录已输出到控制台', body: '共 ' + reports.length + ' 条', type: 'info', duration: 3000 });
                    }
                }
            };
        }
        const incognitoToggle = mainEl.querySelector('#setting-incognito');
        if (incognitoToggle) {
            incognitoToggle.onclick = () => {
                const en = !window.MXOS.System.incognito.isEnabled();
                if (en) window.MXOS.System.incognito.enable();
                else window.MXOS.System.incognito.disable();
                incognitoToggle.classList.toggle('on', en);
            };
        }
    };

    const renderInfoPage = () => {
        const mainEl = contentEl.querySelector('#settingsMain');
        const hw = (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.hardware === 'function')
            ? window.MXOS.Real.hardware()
            : { cpuCores: null, deviceMemoryGB: null, platform: '' };
        const memGB = hw.deviceMemoryGB ? hw.deviceMemoryGB + ' GB' : '未知';
        const archLabel = /64/.test(hw.platform + '') ? '64 位操作系统' : (/32/.test(hw.platform + '') || /86/.test(hw.platform + '') ? '32 位操作系统' : (hw.platform || '未知'));
        let cpuLabel = '未知';
        try {
            if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
                navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'model']).then(d => {
                    const model = d.model || '';
                    const arch = (d.architecture || '') + (d.bitness ? '-' + d.bitness : '');
                    const label = model || arch || 'x86';
                    const el = mainEl.querySelector('.about-item[data-cpu] .about-item-value');
                    if (el) el.textContent = label;
                    mainEl.querySelector('.about-item[data-cpu]').dataset.cpuDone = '1';
                });
                cpuLabel = `<span class="cpu-loading" style="opacity:0.6">检测中...</span>`;
            } else {
                cpuLabel = hw.platform || 'x86';
            }
        } catch (e) {
            cpuLabel = hw.platform || 'x86';
        }
        mainEl.innerHTML = `
            <div class="about-header">
                <div class="about-logo">
                    <svg width="80" height="80" viewBox="0 0 256 256"><use href="#svg-windows"/></svg>
                </div>
                <div class="about-title">MXOS</div>
                <div class="about-version">版本 1.5</div>
            </div>
            <div class="about-section">
                <div class="about-section-title">设备信息</div>
                <div class="about-grid">
                    <div class="about-item" data-cpu>
                        <div class="about-item-label">处理器</div>
                        <div class="about-item-value">${cpuLabel}</div>
                    </div>
                    <div class="about-item">
                        <div class="about-item-label">内存</div>
                        <div class="about-item-value">${memGB}</div>
                    </div>
                    <div class="about-item">
                        <div class="about-item-label">设备名称</div>
                        <div class="about-item-value">DESKTOP-XXXXX</div>
                    </div>
                </div>
            </div>
            <div class="about-section">
                <div class="about-section-title">系统信息</div>
                <div class="about-grid">
                    <div class="about-item">
                        <div class="about-item-label">系统版本</div>
                        <div class="about-item-value">MXOS 1.5</div>
                    </div>
                    <div class="about-item">
                        <div class="about-item-label">系统类型</div>
                        <div class="about-item-value">${archLabel}</div>
                    </div>
                </div>
            </div>
        `;
    };

    const renderHealthPage = () => {
        currentSettingsPage = 'health';
        currentSubPages = {};
        const mainEl = contentEl.querySelector('#settingsMain');
        mainEl.innerHTML = `
            <div class="settings-title">系统健康度</div>
            <div class="settings-section">
                <div class="settings-card">
                    <div class="settings-card-title">综合评分</div>
                    <div class="settings-card-desc">基于 CPU、内存、存储、启动速度、崩溃次数、FPS 等维度</div>
                </div>
                <div id="mxos-health-dashboard" style="background:rgba(255,255,255,0.02);border:1px solid var(--glass-border,rgba(255,255,255,0.08));border-radius:12px;padding:20px;margin-top:10px">
                    <div style="display:flex;align-items:center;justify-content:center;padding:40px 0;color:#9ca3af;font-size:13px">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;animation:icon-spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        正在评估...
                    </div>
                </div>
            </div>
        `;
        if (window.MXOS && window.MXOS.Health && typeof window.MXOS.Health.renderDashboard === 'function') {
            const container = mainEl.querySelector('#mxos-health-dashboard');
            window.MXOS.Health.renderDashboard(container);
            const refreshBtn = mainEl.querySelector('#mxos-health-refresh');
            if (refreshBtn) refreshBtn.onclick = () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '评估中...';
                window.MXOS.Health.renderDashboard(container).then(() => {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '刷新';
                });
            };
        }
    };

    const renderBackupPage = () => {
        currentSettingsPage = 'backup';
        currentSubPages = {};
        const mainEl = contentEl.querySelector('#settingsMain');
        const Backup = (window.MXOS && window.MXOS.Backup) || {};
        const schedule = (typeof Backup.getSchedule === 'function') ? Backup.getSchedule() : { enabled: false, interval: 'manual' };
        const list = (typeof Backup.list === 'function') ? Backup.list() : [];

        const intervalOpts = [{ value: 'manual', label: '手动' }, { value: 'daily', label: '每日' }, { value: 'weekly', label: '每周' }]
            .map(o => `<option value="${o.value}" ${schedule.interval === o.value ? 'selected' : ''}>${o.label}</option>`).join('');

        const listHtml = list.length === 0
            ? '<div style="text-align:center;color:#9ca3af;padding:20px;font-size:13px">暂无备份记录</div>'
            : list.map(r => `
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.filename || r.id}</div>
                        <div style="font-size:11px;color:#9ca3af;margin-top:2px">
                            ${new Date(r.createdAt).toLocaleString('zh-CN')} · ${formatBytesLocal(r.size || 0)}${r.automatic ? ' · 自动' : ''}
                        </div>
                    </div>
                    <button data-id="${r.id}" class="mxos-backup-remove" style="background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">删除</button>
                </div>
            `).join('');

        mainEl.innerHTML = `
            <div class="settings-title">备份与恢复</div>
            <div class="settings-section">
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">立即备份</div>
                        <div class="settings-card-desc">将 VFS、设置、应用数据、桌面布局打包为 .mxbak 文件</div>
                    </div>
                    <button id="mxos-backup-now" style="background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">备份</button>
                </div>
                <div class="settings-card" style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div class="settings-card-title">从文件恢复</div>
                        <div class="settings-card-desc">选择 .mxbak 文件恢复系统数据，或将文件拖到桌面</div>
                    </div>
                    <button id="mxos-backup-restore" style="background:rgba(255,255,255,0.06);color:#fff;border:1px solid var(--glass-border,rgba(255,255,255,0.12));padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px">选择文件</button>
                </div>
                <div class="settings-card">
                    <div class="settings-card-title">定时备份</div>
                    <div class="settings-card-desc">自动备份数据，保留最近 ${Backup.MAX_KEEP || 5} 份</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
                        <span style="font-size:13px;color:#cbd5e1">${schedule.enabled ? '已启用' : '未启用'}</span>
                        <select id="mxos-backup-schedule" style="background:rgba(0,0,0,0.25);color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px 10px;font-size:13px">
                            ${intervalOpts}
                        </select>
                    </div>
                </div>
                <div class="settings-card" style="padding:14px">
                    <div class="settings-card-title" style="margin-bottom:10px">备份记录</div>
                    <div id="mxos-backup-list" style="display:flex;flex-direction:column;gap:8px">${listHtml}</div>
                </div>
            </div>
        `;

        const backupBtn = mainEl.querySelector('#mxos-backup-now');
        if (backupBtn) {
            backupBtn.onclick = async () => {
                backupBtn.disabled = true;
                backupBtn.textContent = '备份中...';
                try {
                    if (typeof Backup.backup === 'function') await Backup.backup();
                } catch (e) {}
                backupBtn.disabled = false;
                backupBtn.textContent = '备份';
                renderBackupPage();
            };
        }
        const restoreBtn = mainEl.querySelector('#mxos-backup-restore');
        if (restoreBtn) {
            restoreBtn.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.mxbak,.zip';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file && typeof Backup.restore === 'function') {
                        await Backup.restore(file);
                    }
                };
                input.click();
            };
        }
        const schedSel = mainEl.querySelector('#mxos-backup-schedule');
        if (schedSel) {
            schedSel.onchange = () => {
                const v = schedSel.value;
                if (typeof Backup.schedule === 'function') {
                    Backup.schedule(v === 'manual' ? { enabled: false, interval: 'manual' } : v);
                }
                renderBackupPage();
            };
        }
        mainEl.querySelectorAll('.mxos-backup-remove').forEach(btn => {
            btn.onclick = () => {
                if (typeof Backup.remove === 'function') {
                    Backup.remove(btn.dataset.id);
                }
                renderBackupPage();
            };
        });
    };

    const renderPermissionsPage = () => {
        currentSettingsPage = 'permissions';
        currentSubPages = {};
        const mainEl = contentEl.querySelector('#settingsMain');
        const perms = window.MXOS && window.MXOS.Sandbox && window.MXOS.Sandbox.permissions;
        const allApps = perms && typeof perms.listAllAppsWithPermissions === 'function' ? perms.listAllAppsWithPermissions() : [];

        const appListHtml = allApps.length === 0
            ? '<div style="text-align:center;color:#9ca3af;padding:20px;font-size:13px">暂无应用申请过权限</div>'
            : allApps.map(rec => {
                const granted = rec.granted || [];
                const app = (state.installedApps || []).find(a => a.id === rec.appId);
                const appName = (app && app.name) || rec.appId;
                const permHtml = granted.length === 0
                    ? '<div style="font-size:11px;color:#6b7280;margin-top:4px">未授予任何权限</div>'
                    : granted.map(p => {
                        const def = perms.PERMISSION_DEFS[p] || { label: p, risk: 'unknown' };
                        const color = { low: '#10b981', medium: '#fbbf24', high: '#ef4444' }[def.risk] || '#9ca3af';
                        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                            <div style="display:flex;align-items:center;gap:8px">
                                <span style="width:6px;height:6px;border-radius:50%;background:${color}"></span>
                                <div>
                                    <div style="font-size:12px;color:#cbd5e1">${def.label}</div>
                                    <div style="font-size:10px;color:#6b7280">${def.desc || ''}</div>
                                </div>
                            </div>
                            <button data-app="${rec.appId}" data-perm="${p}" class="mxos-perm-revoke" style="background:rgba(239,68,68,0.1);color:#fca5a5;border:1px solid rgba(239,68,68,0.25);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px">撤销</button>
                        </div>`;
                    }).join('');
                return `<div class="settings-card" style="padding:14px">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                        <svg width="24" height="24" viewBox="0 0 40 40"><use href="#svg-${(app && app.icon) || 'app-default'}"/></svg>
                        <div style="flex:1">
                            <div style="font-size:13px;font-weight:500;color:#fff">${escapeHtmlLocal(appName)}</div>
                            <div style="font-size:11px;color:#9ca3af">${granted.length} 个已授予权限</div>
                        </div>
                    </div>
                    <div style="margin-top:4px">${permHtml}</div>
                </div>`;
            }).join('');

        mainEl.innerHTML = `
            <div class="settings-title">权限管理</div>
            <div class="settings-section">
                <div class="settings-card">
                    <div class="settings-card-title">第三方应用权限</div>
                    <div class="settings-card-desc">管理已安装的第三方应用所申请的权限，可随时撤销</div>
                </div>
                <div id="mxos-perm-list" style="display:flex;flex-direction:column;gap:10px">${appListHtml}</div>
            </div>
        `;

        mainEl.querySelectorAll('.mxos-perm-revoke').forEach(btn => {
            btn.onclick = () => {
                const appId = btn.dataset.app;
                const perm = btn.dataset.perm;
                if (window.MXOS.Sandbox && typeof window.MXOS.Sandbox.revokePermission === 'function') {
                    window.MXOS.Sandbox.revokePermission(appId, perm);
                } else if (perms && typeof perms.revokePermission === 'function') {
                    perms.revokePermission(appId, perm);
                }
                renderPermissionsPage();
            };
        });
    };

    function formatBytesLocal(b) {
        if (!b || b < 0) return '0 B';
        const u = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
        return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
    }
    function escapeHtmlLocal(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    const getBackFunction = () => {
        return () => {
            switch (currentSettingsPage) {
                case 'network': renderNetworkPage(); break;
                case 'personalization': renderPersonalizationPage(); break;
                case 'theme': renderThemePage(); break;
                case 'time': renderTimePage(); break;
                case 'game': renderGamePage(); break;
                case 'accessibility': renderAccessibilityPage(); break;
                case 'privacy': renderPrivacyPage(); break;
                default: renderSystemPage();
            }
        };
    };

    contentEl.querySelectorAll('.settings-item').forEach(item => {
        const page = item.dataset.page;
        if (page) {
            item.addEventListener('click', () => {
                contentEl.querySelectorAll('.settings-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                switch (page) {
                    case 'system': renderSystemPage(); break;
                    case 'network': renderNetworkPage(); break;
                    case 'personalization': renderPersonalizationPage(); break;
                    case 'account': renderAccountPage(); break;
                    case 'theme': renderThemePage(); break;
                    case 'time': renderTimePage(); break;
                    case 'game': renderGamePage(); break;
                    case 'accessibility': renderAccessibilityPage(); break;
                    case 'privacy': renderPrivacyPage(); break;
                    case 'app': renderAppPage(); break;
                    case 'system-tools': renderSystemToolsPage(); break;
                    case 'health': renderHealthPage(); break;
                    case 'backup': renderBackupPage(); break;
                    case 'permissions': renderPermissionsPage(); break;
                    case 'info': renderInfoPage(); break;
                }
            });
        }
    });

    function navigateSettingsPage(page) {
        const aliases = { accounts: 'account', apps: 'app', display: 'system', update: 'system-tools' };
        const target = aliases[page] || page || 'system';
        const item = contentEl.querySelector('.settings-item[data-page="' + target + '"]');
        if (item) item.click();
    }

    const navigateHandler = (event) => {
        const tab = event && event.detail && event.detail.tab;
        navigateSettingsPage(tab);
    };
    window.addEventListener('mxos:settings-navigate', navigateHandler, { once: true });

    renderSystemPage();

    const initDisplayScale = function() {
        const scale = systemSettings.displayScale / 100;
        document.body.style.zoom = scale;
        const wallpaperBg = document.getElementById('wallpaper-bg');
        if (wallpaperBg) {
            wallpaperBg.style.transform = 'scale(' + (1 / scale) + ')';
            wallpaperBg.style.transformOrigin = 'center center';
        }
    };
    setTimeout(initDisplayScale, 100);
});
