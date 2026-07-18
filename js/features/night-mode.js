window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_night_mode';
const AUTO_KEY = 'mxos_night_auto';

let overlay = null;
let enabled = false;
let autoMode = true;
let scheduleTimer = null;

function loadSettings() {
    try {
        enabled = localStorage.getItem(STORAGE_KEY) === '1';
        const a = localStorage.getItem(AUTO_KEY);
        autoMode = a === null ? false : a === '1';
    } catch {}
}
function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
        localStorage.setItem(AUTO_KEY, autoMode ? '1' : '0');
    } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-night-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-night-mode-styles';
    style.textContent = `
#mxosNightOverlay {
    position: fixed; inset: 0;
    z-index: 9998;
    pointer-events: none;
    background: linear-gradient(rgba(255, 138, 60, 0.18), rgba(255, 90, 30, 0.22));
    mix-blend-mode: multiply;
    opacity: 0;
    transition: opacity 0.8s var(--ease-out, ease);
}
body.night-mode-on #mxosNightOverlay { opacity: 1; }
body.night-mode-on #desktop { filter: brightness(0.78) saturate(0.92); transition: filter 0.8s var(--ease-out, ease); }
body.night-mode-on .taskbar,
body.night-mode-on .window-content { filter: brightness(0.92); }
    `;
    document.head.appendChild(style);
}

function buildOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'mxosNightOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
}

function inNightHours() {
    const h = new Date().getHours();
    return h >= 20 || h < 6;
}

function applyState() {
    if (enabled) {
        document.body.classList.add('night-mode-on');
    } else {
        document.body.classList.remove('night-mode-on');
    }
}

function refresh() {
    if (autoMode) {
        const want = inNightHours();
        if (want !== enabled) {
            enabled = want;
            applyState();
            saveSettings();
            if (window.MXOS?.notify) {
                window.MXOS.notify({
                    title: enabled ? '已进入夜景模式' : '已退出夜景模式',
                    body: enabled ? '已降低亮度与蓝光以保护视力' : '系统恢复常规亮度',
                    type: 'info'
                });
            }
        }
    } else {
        applyState();
    }
}

function setEnabled(v) {
    enabled = !!v;
    applyState();
    saveSettings();
    refresh();
}

function setAuto(v) {
    autoMode = !!v;
    saveSettings();
    refresh();
}

function isEnabled() { return enabled; }
function isAuto() { return autoMode; }

function startSchedule() {
    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = setInterval(refresh, 60_000);
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-nightMode')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">桌面夜景模式</div>
                <div class="settings-card-desc">降低亮度、过滤蓝光（20:00-06:00 自动开启）</div>
            </div>
            <div class="toggle-switch ${enabled ? 'on' : ''}" id="setting-nightMode" role="switch" aria-checked="${enabled}"></div>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-nightMode').addEventListener('click', () => {
            autoMode = false;
            const next = !enabled;
            setEnabled(next);
            section.querySelector('#setting-nightMode').classList.toggle('on', next);
            section.querySelector('#setting-nightMode').setAttribute('aria-checked', next ? 'true' : 'false');
        });
        const autoSection = document.createElement('div');
        autoSection.className = 'settings-card';
        autoSection.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        autoSection.innerHTML = `
            <div>
                <div class="settings-card-title">自动夜景</div>
                <div class="settings-card-desc">根据时间自动切换夜景模式</div>
            </div>
            <div class="toggle-switch ${autoMode ? 'on' : ''}" id="setting-nightModeAuto" role="switch" aria-checked="${autoMode}"></div>
        `;
        mainEl.appendChild(autoSection);
        autoSection.querySelector('#setting-nightModeAuto').addEventListener('click', () => {
            setAuto(!autoMode);
            autoSection.querySelector('#setting-nightModeAuto').classList.toggle('on', autoMode);
            autoSection.querySelector('#setting-nightModeAuto').setAttribute('aria-checked', autoMode ? 'true' : 'false');
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    try {
        loadSettings();
        injectStyles();
        buildOverlay();
        injectSettingsIntoPanel();
        applyState();
        refresh();
        startSchedule();
        window.MXOS.Features.nightMode = {
            setEnabled, setAuto, isEnabled, isAuto, refresh
        };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, setAuto, isEnabled, isAuto };
