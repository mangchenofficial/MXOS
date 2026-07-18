const STORAGE_KEY = 'mxos_high_contrast';
const CLASS_NAME = 'high-contrast';

export function isHighContrast() {
    return document.body.classList.contains(CLASS_NAME);
}

export function setHighContrast(enabled) {
    if (enabled) {
        document.body.classList.add(CLASS_NAME);
    } else {
        document.body.classList.remove(CLASS_NAME);
    }
    try {
        localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch (err) {}
    if (window.mxosAnnounceUrgent) {
        window.mxosAnnounceUrgent(enabled ? '高对比度模式已开启' : '高对比度模式已关闭');
    }
    window.dispatchEvent(new CustomEvent('mxos-high-contrast-change', { detail: { enabled } }));
}

export function toggleHighContrast() {
    setHighContrast(!isHighContrast());
    return isHighContrast();
}

export function initHighContrast() {
    let saved = false;
    try {
        saved = localStorage.getItem(STORAGE_KEY) === '1';
    } catch (err) {}
    if (saved) {
        document.body.classList.add(CLASS_NAME);
    }
}

window.mxosToggleHighContrast = toggleHighContrast;
window.mxosSetHighContrast = setHighContrast;
