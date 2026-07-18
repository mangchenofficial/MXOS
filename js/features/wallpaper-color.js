import { extractColors, getDefaultColors } from '../utils/color-extract.js';

const STORAGE_KEY_HISTORY = 'mxos_wallpaper_color_history';
const STORAGE_KEY_MODE = 'mxos_wallpaper_color_mode';
const STORAGE_KEY_THEME = 'mxos_theme_mode';
const TRANSITION_MS = 300;
const MAX_HISTORY = 5;
const DEFAULT_THEME = 'dark';

const state = {
    mode: 'auto',
    theme: DEFAULT_THEME,
    cache: new Map(),
    history: [],
    currentUrl: null,
    currentColors: null
};

function readMode() {
    try {
        const v = localStorage.getItem(STORAGE_KEY_MODE);
        if (v === 'auto' || v === 'manual' || v === 'custom' || v === 'off') return v;
    } catch (e) {}
    return 'auto';
}

function readTheme() {
    try {
        const v = localStorage.getItem(STORAGE_KEY_THEME);
        if (v === 'light' || v === 'dark') return v;
    } catch (e) {}
    return DEFAULT_THEME;
}

function readHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
    } catch (e) {
        return [];
    }
}

function saveHistory() {
    try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.history.slice(0, MAX_HISTORY)));
    } catch (e) {}
}

function saveMode() {
    try {
        localStorage.setItem(STORAGE_KEY_MODE, state.mode);
    } catch (e) {}
}

function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return { r: 59, g: 130, b: 246 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r, g, b) {
    const toHex = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
}

function adjustForTheme(hex, theme) {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    if (theme === 'light') {
        hsl.l = clamp(hsl.l * 1.15, 0, 1);
        hsl.s = clamp(hsl.s * 0.90, 0, 1);
    } else {
        hsl.l = clamp(hsl.l * 0.80, 0, 1);
    }
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function adjustBgForTheme(hex, theme) {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    if (theme === 'light') {
        hsl.l = clamp(Math.min(hsl.l, 0.20) * 0.6 + 0.92, 0, 1);
        hsl.s = clamp(hsl.s * 0.5, 0, 1);
    } else {
        hsl.l = clamp(hsl.l * 0.18, 0, 0.15);
    }
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function relativeLuminance(r, g, b) {
    const toLin = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(rgb1, rgb2) {
    const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

function ensureTextContrast(textHex, bgHex) {
    const text = hexToRgb(textHex);
    const bg = hexToRgb(bgHex);
    let ratio = contrastRatio(text, bg);
    if (ratio >= 4.5) return textHex;
    const bgLum = relativeLuminance(bg.r, bg.g, bg.b);
    let bestColor = textHex;
    let bestRatio = ratio;
    const candidates = bgLum < 0.5
        ? ['#ffffff', '#f5f5f5', '#e5e5e5', '#dddddd']
        : ['#000000', '#0a0a0a', '#1a1a1a', '#222222'];
    for (const c of candidates) {
        const cr = hexToRgb(c);
        const r = contrastRatio(cr, bg);
        if (r > bestRatio) {
            bestRatio = r;
            bestColor = c;
        }
        if (bestRatio >= 4.5) break;
    }
    return bestColor;
}

function applyColors(colors) {
    const root = document.documentElement;
    const theme = state.theme;
    const primary = adjustForTheme(colors.primary, theme);
    const secondary = adjustForTheme(colors.secondary, theme);
    const bg = adjustBgForTheme(colors.bg, theme);
    const highlight = adjustForTheme(colors.highlight, theme);
    let text = theme === 'light' ? '#0a0a0a' : '#ffffff';
    text = ensureTextContrast(text, bg);
    root.style.setProperty('--accent-color', primary);
    root.style.setProperty('--accent-secondary', secondary);
    root.style.setProperty('--bg-base', bg);
    root.style.setProperty('--highlight', highlight);
    root.style.setProperty('--text-color', text);
    document.body.style.transition = 'background-color ' + TRANSITION_MS + 'ms ease';
    state.currentColors = { primary, secondary, bg, highlight, text };
}

function pushHistory(url, colors) {
    if (!url) return;
    const entry = { url, colors, ts: Date.now() };
    state.history = state.history.filter(h => h.url !== url);
    state.history.unshift(entry);
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
}

function onWallpaperChange(detail) {
    if (state.mode === 'off') return;
    const url = detail && detail.url;
    const type = detail && detail.type;
    if (!url) return;
    state.currentUrl = url;
    if (type === 'video') {
        applyColors(getDefaultColors());
        return;
    }
    if (state.mode === 'manual' || state.mode === 'custom') {
        return;
    }
    if (state.cache.has(url)) {
        applyColors(state.cache.get(url));
        return;
    }
    extractColors(url).then(colors => {
        state.cache.set(url, colors);
        applyColors(colors);
        pushHistory(url, colors);
    }).catch(err => {
        console.warn('[wallpaper-color] 提取失败:', err);
        const fallback = getDefaultColors();
        applyColors(fallback);
    });
}

function init() {
    state.mode = readMode();
    state.theme = readTheme();
    state.history = readHistory();
    state.history.forEach(h => state.cache.set(h.url, h.colors));
    window.addEventListener('wallpaper-change', (e) => {
        onWallpaperChange(e.detail || {});
    });
    window.addEventListener('theme-change', (e) => {
        const t = e.detail && e.detail.theme;
        if (t === 'light' || t === 'dark') {
            state.theme = t;
            try { localStorage.setItem(STORAGE_KEY_THEME, t); } catch (err) {}
            if (state.currentColors) {
                const raw = state.cache.get(state.currentUrl) || getDefaultColors();
                applyColors(raw);
            }
        }
    });
}

const WallpaperColor = {
    extract(url) {
        return extractColors(url);
    },
    apply(colors) {
        if (!colors || typeof colors !== 'object') return;
        const merged = { ...getDefaultColors(), ...colors };
        applyColors(merged);
        if (state.currentUrl) {
            state.cache.set(state.currentUrl, merged);
            pushHistory(state.currentUrl, merged);
        }
    },
    reset() {
        const defaults = getDefaultColors();
        state.cache.clear();
        state.history = [];
        try {
            localStorage.removeItem(STORAGE_KEY_HISTORY);
        } catch (e) {}
        applyColors(defaults);
    },
    setMode(mode) {
        if (mode !== 'auto' && mode !== 'manual' && mode !== 'custom' && mode !== 'off') return;
        state.mode = mode;
        saveMode();
        if (mode === 'off') {
            applyColors(getDefaultColors());
        } else if (mode === 'auto' && state.currentUrl) {
            onWallpaperChange({ url: state.currentUrl, type: 'image' });
        }
    },
    getMode() {
        return state.mode;
    },
    getHistory() {
        return state.history.slice();
    },
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') return;
        state.theme = theme;
        try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch (e) {}
        if (state.currentColors) {
            const raw = state.cache.get(state.currentUrl) || getDefaultColors();
            applyColors(raw);
        }
    },
    getTheme() {
        return state.theme;
    }
};

init();

window.MXOS = window.MXOS || {};
window.MXOS.WallpaperColor = WallpaperColor;

export { WallpaperColor };
