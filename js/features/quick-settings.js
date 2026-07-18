const STORAGE_KEY = 'mxos_quick_settings';

const DEFAULT_SETTINGS = {
    wifi: true,
    bluetooth: false,
    nightMode: false,
    dnd: false,
    airplane: false,
    powerSaver: false,
    brightness: 100,
    volume: 60
};

let settings = loadSettings();
let panelEl = null;
let isOpen = false;
let clockTimer = null;
let batteryUnsub = null;

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
}

function svgIcon(name, size = 22) {
    const icons = {
        wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
        wifiOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
        bluetooth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>',
        moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
        bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
        bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
        plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
        leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
        sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
        volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
        battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>',
        charging: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor"/></svg>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${icons[name] || ''}</svg>`;
}

function buildPanel() {
    const panel = document.getElementById('quickSettingsPanel');
    if (!panel) return null;
    panel.innerHTML = `
        <div class="qs-tiles">
            <button class="qs-tile" data-setting="wifi">
                <span class="qs-tile-icon">${svgIcon('wifi')}</span>
                <span class="qs-tile-label">Wi-Fi</span>
                <span class="qs-tile-status">已连接</span>
            </button>
            <button class="qs-tile" data-setting="bluetooth">
                <span class="qs-tile-icon">${svgIcon('bluetooth')}</span>
                <span class="qs-tile-label">蓝牙</span>
                <span class="qs-tile-status">未连接</span>
            </button>
            <button class="qs-tile" data-setting="nightMode">
                <span class="qs-tile-icon">${svgIcon('moon')}</span>
                <span class="qs-tile-label">夜间模式</span>
                <span class="qs-tile-status">关闭</span>
            </button>
            <button class="qs-tile" data-setting="dnd">
                <span class="qs-tile-icon">${svgIcon('bell')}</span>
                <span class="qs-tile-label">勿扰</span>
                <span class="qs-tile-status">关闭</span>
            </button>
            <button class="qs-tile" data-setting="airplane">
                <span class="qs-tile-icon">${svgIcon('plane')}</span>
                <span class="qs-tile-label">飞行模式</span>
                <span class="qs-tile-status">关闭</span>
            </button>
            <button class="qs-tile" data-setting="powerSaver">
                <span class="qs-tile-icon">${svgIcon('leaf')}</span>
                <span class="qs-tile-label">节能</span>
                <span class="qs-tile-status">关闭</span>
            </button>
        </div>
        <div class="qs-sliders">
            <div class="qs-slider-row">
                <span class="qs-slider-icon">${svgIcon('sun', 18)}</span>
                <input type="range" class="qs-slider" id="qsBrightness" min="0" max="100" value="${settings.brightness}">
                <span class="qs-slider-value" id="qsBrightnessVal">${settings.brightness}%</span>
            </div>
            <div class="qs-slider-row">
                <span class="qs-slider-icon">${svgIcon('volume', 18)}</span>
                <input type="range" class="qs-slider" id="qsVolume" min="0" max="100" value="${settings.volume}">
                <span class="qs-slider-value" id="qsVolumeVal">${settings.volume}%</span>
            </div>
        </div>
        <div class="qs-footer">
            <div class="qs-datetime">
                <div class="qs-time" id="qsTime">00:00</div>
                <div class="qs-date" id="qsDate">2024年1月1日</div>
            </div>
            <div class="qs-battery" id="qsBattery">
                <span class="qs-battery-icon">${svgIcon('battery', 18)}</span>
                <span class="qs-battery-text">--</span>
            </div>
        </div>
    `;

    panel.querySelectorAll('.qs-tile').forEach(tile => {
        tile.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = tile.dataset.setting;
            toggle(key);
        });
    });

    const brightness = panel.querySelector('#qsBrightness');
    const brightnessVal = panel.querySelector('#qsBrightnessVal');
    brightness.addEventListener('input', (e) => {
        e.stopPropagation();
        const v = parseInt(e.target.value, 10);
        settings.brightness = v;
        brightnessVal.textContent = v + '%';
        applyBrightness();
        saveSettings();
    });

    const volume = panel.querySelector('#qsVolume');
    const volumeVal = panel.querySelector('#qsVolumeVal');
    volume.addEventListener('input', (e) => {
        e.stopPropagation();
        const v = parseInt(e.target.value, 10);
        settings.volume = v;
        volumeVal.textContent = v + '%';
        saveSettings();
    });

    panel.addEventListener('click', (e) => {
        if (e.target === panel) e.stopPropagation();
    });

    return panel;
}

function updateTileStates() {
    if (!panelEl) return;
    panelEl.querySelectorAll('.qs-tile').forEach(tile => {
        const key = tile.dataset.setting;
        const on = !!settings[key];
        tile.classList.toggle('on', on);
        const status = tile.querySelector('.qs-tile-status');
        if (!status) return;
        if (key === 'wifi') {
            status.textContent = on ? '已连接' : '未连接';
            tile.querySelector('.qs-tile-icon').innerHTML = svgIcon(on ? 'wifi' : 'wifiOff');
        } else if (key === 'bluetooth') {
            status.textContent = on ? '已开启' : '未连接';
        } else if (key === 'nightMode') {
            status.textContent = on ? '已开启' : '关闭';
        } else if (key === 'dnd') {
            status.textContent = on ? '已开启' : '关闭';
            tile.querySelector('.qs-tile-icon').innerHTML = svgIcon(on ? 'bellOff' : 'bell');
        } else if (key === 'airplane') {
            status.textContent = on ? '已开启' : '关闭';
        } else if (key === 'powerSaver') {
            status.textContent = on ? '已开启' : '关闭';
        }
    });
}

function applyBrightness() {
    const overlay = document.getElementById('brightness-overlay');
    if (!overlay) return;
    const opacity = Math.max(0, (100 - settings.brightness) / 100 * 0.7);
    overlay.style.opacity = opacity.toString();
}

function applyNightMode() {
    let filter = document.getElementById('nightModeFilter');
    if (settings.nightMode) {
        if (!filter) {
            filter = document.createElement('div');
            filter.id = 'nightModeFilter';
            filter.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(255,140,40,0.18);pointer-events:none;z-index:9997;transition:opacity 0.4s ease;';
            document.body.appendChild(filter);
        }
        filter.style.opacity = '1';
    } else if (filter) {
        filter.style.opacity = '0';
    }
}

function applyPowerSaver() {
    if (settings.powerSaver) {
        document.documentElement.style.setProperty('--glass-blur-active', '8px');
        document.documentElement.style.setProperty('--glass-blur-inactive', '3px');
        document.body.classList.add('qs-power-saver');
    } else {
        document.documentElement.style.removeProperty('--glass-blur-active');
        document.documentElement.style.removeProperty('--glass-blur-inactive');
        document.body.classList.remove('qs-power-saver');
    }
}

function applyDnd() {
    if (window.MXOS && window.MXOS.notify) {
        window.MXOS.notify.dnd = settings.dnd;
    }
    if (settings.dnd) {
        document.body.classList.add('qs-dnd');
    } else {
        document.body.classList.remove('qs-dnd');
    }
}

function applyAll() {
    applyBrightness();
    applyNightMode();
    applyPowerSaver();
    applyDnd();
    updateTileStates();
}

function toggle(setting) {
    if (!(setting in settings)) return;
    settings[setting] = !settings[setting];

    if (setting === 'airplane' && settings.airplane) {
        settings.wifi = false;
        settings.bluetooth = false;
    }
    if (setting === 'wifi' && settings.wifi && settings.airplane) {
        settings.airplane = false;
    }
    if (setting === 'bluetooth' && settings.bluetooth && settings.airplane) {
        settings.airplane = false;
    }

    saveSettings();
    applyAll();
    return settings[setting];
}

function updateClock() {
    if (!panelEl) return;
    const now = new Date();
    const time = panelEl.querySelector('#qsTime');
    const date = panelEl.querySelector('#qsDate');
    if (time) time.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    if (date) date.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

async function updateBattery() {
    if (!panelEl) return;
    const el = panelEl.querySelector('#qsBattery');
    if (!el) return;
    const text = el.querySelector('.qs-battery-text');
    const icon = el.querySelector('.qs-battery-icon');
    if (window.MXOS && window.MXOS.Real && typeof window.MXOS.Real.battery === 'function') {
        try {
            const b = await window.MXOS.Real.battery();
            if (b && typeof b.level === 'number') {
                text.textContent = b.level + '%';
                icon.innerHTML = svgIcon(b.charging ? 'charging' : 'battery', 18);
                return;
            }
        } catch {}
    }
    text.textContent = '100%';
}

function open() {
    if (isOpen) return;
    if (!panelEl) panelEl = buildPanel();
    if (!panelEl) return;
    panelEl.style.display = 'flex';
    panelEl.classList.add('show');
    isOpen = true;
    applyAll();
    updateClock();
    updateBattery();
    if (!clockTimer) {
        clockTimer = setInterval(updateClock, 1000);
    }
    if (window.MXOS && window.MXOS.Real && window.MXOS.Real.battery && window.MXOS.Real.battery.onChange) {
        if (batteryUnsub) batteryUnsub();
        batteryUnsub = window.MXOS.Real.battery.onChange(updateBattery);
    }
    requestAnimationFrame(() => {
        panelEl.classList.add('show-active');
    });
}

function close() {
    if (!isOpen || !panelEl) return;
    panelEl.classList.remove('show-active');
    setTimeout(() => {
        if (panelEl) {
            panelEl.classList.remove('show');
            panelEl.style.display = 'none';
        }
        isOpen = false;
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
        if (batteryUnsub) {
            batteryUnsub();
            batteryUnsub = null;
        }
    }, 200);
}

function togglePanel() {
    if (isOpen) close();
    else open();
}

function bindTray() {
    const tray = document.querySelector('.system-tray');
    if (!tray) return;
    if (tray.dataset.qsBound === '1') return;
    tray.dataset.qsBound = '1';
    tray.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
    });
    tray.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePanel();
        }
    });
}

function bindOutsideClick() {
    document.addEventListener('click', (e) => {
        if (!isOpen) return;
        if (e.target.closest('#quickSettingsPanel')) return;
        if (e.target.closest('.system-tray')) return;
        close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) close();
    });
}

function injectStyles() {
    if (document.getElementById('qs-styles')) return;
    const style = document.createElement('style');
    style.id = 'qs-styles';
    style.textContent = `
#quickSettingsPanel {
    position: fixed;
    bottom: 56px;
    right: 12px;
    width: 360px;
    background: var(--glass-bg);
    backdrop-filter: blur(30px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(30px) saturate(180%) brightness(1.1);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.12));
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    z-index: 2400;
    display: none;
    flex-direction: column;
    padding: 16px;
    gap: 14px;
    transform-origin: bottom right;
    transform: scale(0.85) translateY(10px);
    opacity: 0;
    transition: transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1), opacity 200ms ease;
    color: var(--text-color);
}
#quickSettingsPanel.show { display: flex; }
#quickSettingsPanel.show-active {
    transform: scale(1) translateY(0);
    opacity: 1;
}
.qs-tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.qs-tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 12px;
    background: var(--glass-bg, rgba(255,255,255,0.06));
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s, border-color 0.2s;
    color: var(--text-color);
    gap: 4px;
    text-align: left;
    min-height: 64px;
}
.qs-tile:hover {
    background: var(--hover-bg, rgba(255,255,255,0.12));
}
.qs-tile:active {
    transform: scale(0.96);
}
.qs-tile.on {
    background: rgba(59, 130, 246, 0.32);
    border-color: rgba(96, 165, 250, 0.6);
    color: var(--text-color, #fff);
}
.qs-tile-icon {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #cbd5e1);
}
.qs-tile.on .qs-tile-icon {
    color: var(--accent-color, #60a5fa);
}
.qs-tile-label {
    font-size: 12px;
    font-weight: 600;
}
.qs-tile-status {
    font-size: 10px;
    color: var(--text-tertiary, #9ca3af);
    line-height: 1;
}
.qs-tile.on .qs-tile-status {
    color: var(--accent-color, #60a5fa);
}
.qs-sliders {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
}
.qs-slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
.qs-slider-icon {
    width: 18px;
    height: 18px;
    color: var(--text-secondary, #cbd5e1);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
.qs-slider {
    flex: 1;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--glass-border, rgba(255,255,255,0.18));
    border-radius: 2px;
    outline: none;
}
.qs-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--text-color, #fff);
    border: 2px solid var(--accent-color, #60a5fa);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
.qs-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--text-color, #fff);
    border: 2px solid var(--accent-color, #60a5fa);
    border-radius: 50%;
    cursor: pointer;
}
.qs-slider-value {
    min-width: 38px;
    text-align: right;
    color: var(--text-secondary, #cbd5e1);
    font-size: 12px;
}
.qs-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid var(--glass-border, rgba(255,255,255,0.08));
}
.qs-time {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, #fff);
}
.qs-date {
    font-size: 11px;
    color: var(--text-tertiary, #9ca3af);
    margin-top: 2px;
}
.qs-battery {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary, #cbd5e1);
    font-size: 12px;
}
.qs-battery-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4ade80;
}
body.qs-power-saver .window {
    backdrop-filter: blur(6px) saturate(150%) brightness(1.05) !important;
    -webkit-backdrop-filter: blur(6px) saturate(150%) brightness(1.05) !important;
}
body.qs-dnd .notification-card {
    display: none !important;
}
    `;
    document.head.appendChild(style);
}

function init() {
    injectStyles();
    bindTray();
    bindOutsideClick();
    applyAll();

    window.MXOS = window.MXOS || {};
    window.MXOS.QuickSettings = {
        open,
        close,
        toggle,
        togglePanel,
        getSettings: () => ({ ...settings })
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { open, close, toggle, togglePanel };
