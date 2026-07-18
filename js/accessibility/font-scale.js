const STORAGE_KEY = 'mxos_font_scale';
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.0;
const STEP = 0.05;
const DEFAULT_SCALE = 1;

function clampScale(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return DEFAULT_SCALE;
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, num));
}

export function getFontScale() {
    const root = document.documentElement;
    const value = root.style.getPropertyValue('--font-scale');
    return value ? clampScale(value) : DEFAULT_SCALE;
}

export function setFontScale(scale) {
    const value = clampScale(scale);
    document.documentElement.style.setProperty('--font-scale', String(value));
    try {
        localStorage.setItem(STORAGE_KEY, String(value));
    } catch (err) {}
    if (window.mxosAnnounceUrgent) {
        window.mxosAnnounceUrgent(`字号已调整为 ${Math.round(value * 100)}%`);
    }
    window.dispatchEvent(new CustomEvent('mxos-font-scale-change', { detail: { scale: value } }));
    return value;
}

export function increaseFontScale() {
    return setFontScale(getFontScale() + STEP);
}

export function decreaseFontScale() {
    return setFontScale(getFontScale() - STEP);
}

export function resetFontScale() {
    return setFontScale(DEFAULT_SCALE);
}

export function initFontScale() {
    let saved = DEFAULT_SCALE;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) saved = clampScale(raw);
    } catch (err) {}
    document.documentElement.style.setProperty('--font-scale', String(saved));
}

window.mxosSetFontScale = setFontScale;
window.mxosGetFontScale = getFontScale;
