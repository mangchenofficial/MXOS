window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_eye_care';
const AUTO_KEY = 'mxos_eye_care_auto';

let overlay = null;
let enabled = false;
let autoMode = true;
let timer = null;

function load() {
    try {
        enabled = localStorage.getItem(STORAGE_KEY) === '1';
        autoMode = localStorage.getItem(AUTO_KEY) !== '0';
    } catch {}
}
function save() {
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
        localStorage.setItem(AUTO_KEY, autoMode ? '1' : '0');
    } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-eye-care-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-eye-care-styles';
    style.textContent = `
#mxosEyeCareOverlay {
    position: fixed; inset: 0;
    z-index: 9997;
    pointer-events: none;
    background: rgba(255, 170, 80, 0.10);
    opacity: 0;
    transition: opacity 0.6s ease;
}
body.eye-care-on #mxosEyeCareOverlay { opacity: 1; }
    `;
    document.head.appendChild(style);
}

function buildOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'mxosEyeCareOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
}

function applyState() {
    if (enabled) document.body.classList.add('eye-care-on');
    else document.body.classList.remove('eye-care-on');
}

function setEnabled(v) {
    enabled = !!v;
    save();
    applyState();
}
function setAuto(v) {
    autoMode = !!v;
    save();
    refresh();
}

function inEveningHours() {
    const h = new Date().getHours();
    return h >= 18 || h < 7;
}

function refresh() {
    if (autoMode) {
        const want = inEveningHours();
        if (want !== enabled) {
            enabled = want;
            applyState();
            save();
        }
    } else {
        applyState();
    }
}

function isEnabled() { return enabled; }
function isAuto() { return autoMode; }

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-eyeCare')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        section.innerHTML = `
            <div>
                <div class="settings-card-title">夜间护眼</div>
                <div class="settings-card-desc">叠加暖色滤镜以减少蓝光</div>
            </div>
            <div class="toggle-switch ${enabled ? 'on' : ''}" id="setting-eyeCare" role="switch" aria-checked="${enabled}"></div>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-eyeCare').addEventListener('click', () => {
            autoMode = false;
            const next = !enabled;
            setEnabled(next);
            section.querySelector('#setting-eyeCare').classList.toggle('on', next);
            section.querySelector('#setting-eyeCare').setAttribute('aria-checked', next ? 'true' : 'false');
        });
        const autoSection = document.createElement('div');
        autoSection.className = 'settings-card';
        autoSection.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
        autoSection.innerHTML = `
            <div>
                <div class="settings-card-title">自动护眼</div>
                <div class="settings-card-desc">18:00-07:00 自动开启</div>
            </div>
            <div class="toggle-switch ${autoMode ? 'on' : ''}" id="setting-eyeCareAuto" role="switch" aria-checked="${autoMode}"></div>
        `;
        mainEl.appendChild(autoSection);
        autoSection.querySelector('#setting-eyeCareAuto').addEventListener('click', () => {
            setAuto(!autoMode);
            autoSection.querySelector('#setting-eyeCareAuto').classList.toggle('on', autoMode);
            autoSection.querySelector('#setting-eyeCareAuto').setAttribute('aria-checked', autoMode ? 'true' : 'false');
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    load();
    injectStyles();
    buildOverlay();
    injectSettingsIntoPanel();
    applyState();
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 60_000);
    window.MXOS.Features.eyeCare = { setEnabled, setAuto, isEnabled, isAuto, refresh };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setEnabled, setAuto, isEnabled };
