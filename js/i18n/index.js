import zhCN from './zh-CN.js';

const STORAGE_KEY = 'mxos_locale';
const DEFAULT_LOCALE = 'zh-CN';
const FALLBACK_LOCALE = 'zh-CN';
const SUPPORTED_LOCALES = ['zh-CN', 'en-US'];

let currentLocale = DEFAULT_LOCALE;
const messages = { 'zh-CN': zhCN };
const loadedLocales = new Set(['zh-CN']);
const listeners = new Set();

function readStoredLocale() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (SUPPORTED_LOCALES.includes(v)) return v;
    } catch (e) {}
    return DEFAULT_LOCALE;
}

function persistLocale(locale) {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch (e) {}
}

currentLocale = readStoredLocale();

export function getLocale() {
    return currentLocale;
}

async function loadLocale(locale) {
    if (loadedLocales.has(locale)) return;
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    try {
        const mod = await import('./' + locale + '.js');
        messages[locale] = mod.default || mod;
        loadedLocales.add(locale);
    } catch (e) {
        console.error('[i18n] 加载语言包失败:', locale, e);
    }
}

export async function setLocale(locale) {
    if (!locale || locale === currentLocale) return;
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    await loadLocale(locale);
    currentLocale = locale;
    persistLocale(locale);
    applyDOM();
    listeners.forEach(cb => {
        try { cb(locale); } catch (e) { console.error('[i18n] onLocaleChange 回调错误:', e); }
    });
}

export function t(key, params) {
    if (typeof key !== 'string') return '';
    const lookup = (locale) => {
        const pack = messages[locale];
        if (pack && Object.prototype.hasOwnProperty.call(pack, key)) {
            return pack[key];
        }
        return undefined;
    };
    let result = lookup(currentLocale);
    if (result === undefined && currentLocale !== FALLBACK_LOCALE) {
        result = lookup(FALLBACK_LOCALE);
    }
    if (result === undefined) return key;
    if (params && typeof result === 'string') {
        result = result.replace(/\{(\w+)\}/g, (m, name) => {
            return params[name] !== undefined ? String(params[name]) : m;
        });
    }
    return result;
}

export function onLocaleChange(callback) {
    if (typeof callback !== 'function') return () => {};
    listeners.add(callback);
    return () => listeners.delete(callback);
}

export function applyDOM(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!key) return;
        el.setAttribute('placeholder', t(key));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        if (!key) return;
        el.setAttribute('aria-label', t(key));
    });
}

export async function init() {
    currentLocale = readStoredLocale();
    await loadLocale(currentLocale);
    applyDOM();
}

window.MXOS = window.MXOS || {};
window.MXOS.i18n = {
    t,
    setLocale,
    getLocale,
    onLocaleChange,
    applyDOM,
    init
};

init();

export default { t, setLocale, getLocale, onLocaleChange, applyDOM, init };
