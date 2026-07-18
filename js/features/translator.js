window.MXOS = window.MXOS || {};

const LANGUAGES = [
    { code: 'zh', name: '中文' },
    { code: 'en', name: '英语' },
    { code: 'ja', name: '日语' },
    { code: 'ko', name: '韩语' },
    { code: 'fr', name: '法语' },
    { code: 'de', name: '德语' },
    { code: 'es', name: '西班牙语' },
    { code: 'ru', name: '俄语' },
    { code: 'it', name: '意大利语' },
    { code: 'pt', name: '葡萄牙语' }
];

const STORAGE_KEY = 'mxos_translator_settings';

function loadSettings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { from: 'zh', to: 'en' };
    } catch (e) {
        return { from: 'zh', to: 'en' };
    }
}

function saveSettings(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

let settings = loadSettings();

let cardEl = null;
let fromSelEl = null;
let toSelEl = null;
let srcEl = null;
let dstEl = null;
let speakBtnEl = null;
let swapBtnEl = null;
let closeBtnEl = null;
let loadingEl = null;
let currentText = '';

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function buildLanguageOptions(selected) {
    return LANGUAGES.map(l =>
        '<option value="' + l.code + '"' + (l.code === selected ? ' selected' : '') + '>' + l.name + '</option>'
    ).join('');
}

function injectStyles() {
    if (document.getElementById('mxos-translator-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-translator-styles';
    style.textContent = `
#mxosTranslatorCard {
    position: fixed; z-index: 3400;
    top: 80px; right: 24px;
    width: 360px; max-width: calc(100vw - 48px);
    background: rgba(24,28,38,0.82);
    backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
    -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.05);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.55);
    color: #e5e7eb; font-family: inherit;
    transform: translateY(-12px) scale(0.96); opacity: 0;
    transition: transform 240ms var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)), opacity 200ms ease;
    pointer-events: none;
    overflow: hidden;
}
#mxosTranslatorCard.show {
    transform: translateY(0) scale(1); opacity: 1; pointer-events: auto;
}
.tr-header {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.tr-header-icon { display: flex; color: var(--accent-color, #60a5fa); }
.tr-header-icon svg { width: 18px; height: 18px; }
.tr-title { flex: 1; font-size: 13px; font-weight: 600; color: #fff; }
.tr-close {
    width: 24px; height: 24px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; color: #9ca3af; cursor: pointer;
}
.tr-close:hover { background: rgba(255,255,255,0.08); color: #fff; }
.tr-close svg { width: 14px; height: 14px; }
.tr-langs {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
.tr-lang-sel {
    flex: 1; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e5e7eb; padding: 6px 8px; border-radius: 6px;
    font-size: 12px; font-family: inherit; cursor: pointer;
}
.tr-lang-sel option { background: #1f2937; color: #e5e7eb; }
.tr-swap {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: #cbd5e1; width: 28px; height: 28px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
}
.tr-swap:hover { background: rgba(96,165,250,0.2); color: #fff; }
.tr-swap svg { width: 14px; height: 14px; }
.tr-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto; }
.tr-section-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
.tr-src {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
    padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.5;
    color: #f3f4f6; word-break: break-word; white-space: pre-wrap;
    max-height: 100px; overflow-y: auto;
}
.tr-dst {
    background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2);
    padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.5;
    color: #fff; word-break: break-word; white-space: pre-wrap;
    min-height: 50px; max-height: 140px; overflow-y: auto;
}
.tr-dst.empty { color: #6b7280; font-style: italic; }
.tr-loading {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; color: #9ca3af;
}
.tr-loading-spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(96,165,250,0.2);
    border-top-color: var(--accent-color, #60a5fa);
    animation: trSpin 0.8s linear infinite;
}
@keyframes trSpin { to { transform: rotate(360deg); } }
.tr-footer {
    display: flex; gap: 8px; padding: 10px 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
}
.tr-btn {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: #cbd5e1; padding: 6px 12px; border-radius: 6px;
    font-size: 12px; font-family: inherit; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
}
.tr-btn:hover { background: rgba(96,165,250,0.2); color: #fff; }
.tr-btn svg { width: 13px; height: 13px; }
.tr-error { color: #fca5a5; font-size: 12px; padding: 6px 0; }
body.reduce-motion #mxosTranslatorCard { transition-duration: 0.01ms !important; }
    `;
    document.head.appendChild(style);
}

function buildCard() {
    if (cardEl) return cardEl;
    cardEl = document.createElement('div');
    cardEl.id = 'mxosTranslatorCard';
    cardEl.setAttribute('role', 'dialog');
    cardEl.setAttribute('aria-label', '翻译结果');
    cardEl.innerHTML = `
        <div class="tr-header">
            <span class="tr-header-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7"/><path d="M9 3v2c0 4.418-2.239 8-5 8"/><path d="M5 9c0 2.144 2.952 3.908 6.7 4"/><path d="M12 20l4-9 4 9"/><path d="M19.1 18h-6.2"/></svg></span>
            <span class="tr-title">MXOS 翻译官</span>
            <button class="tr-close" aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="tr-langs">
            <select class="tr-lang-sel tr-from"></select>
            <button class="tr-swap" aria-label="交换语言"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></button>
            <select class="tr-lang-sel tr-to"></select>
        </div>
        <div class="tr-body">
            <div class="tr-section-label">原文</div>
            <div class="tr-src"></div>
            <div class="tr-section-label">译文</div>
            <div class="tr-dst empty">点击翻译按钮或选择文字后按 Ctrl+Shift+T</div>
        </div>
        <div class="tr-footer">
            <button class="tr-btn tr-speak"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>朗读</button>
            <button class="tr-btn tr-copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制</button>
        </div>
    `;
    document.body.appendChild(cardEl);
    fromSelEl = cardEl.querySelector('.tr-from');
    toSelEl = cardEl.querySelector('.tr-to');
    srcEl = cardEl.querySelector('.tr-src');
    dstEl = cardEl.querySelector('.tr-dst');
    closeBtnEl = cardEl.querySelector('.tr-close');
    swapBtnEl = cardEl.querySelector('.tr-swap');
    speakBtnEl = cardEl.querySelector('.tr-speak');
    const copyBtnEl = cardEl.querySelector('.tr-copy');

    fromSelEl.innerHTML = buildLanguageOptions(settings.from);
    toSelEl.innerHTML = buildLanguageOptions(settings.to);
    fromSelEl.value = settings.from;
    toSelEl.value = settings.to;

    fromSelEl.addEventListener('change', () => {
        settings.from = fromSelEl.value;
        saveSettings(settings);
        if (currentText) translate(currentText);
    });
    toSelEl.addEventListener('change', () => {
        settings.to = toSelEl.value;
        saveSettings(settings);
        if (currentText) translate(currentText);
    });
    swapBtnEl.addEventListener('click', () => {
        const f = settings.from;
        settings.from = settings.to;
        settings.to = f;
        fromSelEl.value = settings.from;
        toSelEl.value = settings.to;
        saveSettings(settings);
        if (currentText) translate(currentText);
    });
    closeBtnEl.addEventListener('click', close);
    speakBtnEl.addEventListener('click', () => {
        const txt = dstEl.textContent;
        if (txt && !dstEl.classList.contains('empty')) {
            speak(txt, settings.to);
        }
    });
    copyBtnEl.addEventListener('click', () => {
        const txt = dstEl.textContent;
        if (txt && !dstEl.classList.contains('empty')) {
            try { navigator.clipboard.writeText(txt); } catch (e) {}
            if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('译文已复制');
        }
    });

    let dragOff = null;
    const header = cardEl.querySelector('.tr-header');
    header.style.cursor = 'move';
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.tr-close')) return;
        const rect = cardEl.getBoundingClientRect();
        dragOff = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragOff) return;
        const x = Math.max(0, Math.min(window.innerWidth - cardEl.offsetWidth, e.clientX - dragOff.x));
        const y = Math.max(0, Math.min(window.innerHeight - cardEl.offsetHeight, e.clientY - dragOff.y));
        cardEl.style.left = x + 'px';
        cardEl.style.top = y + 'px';
        cardEl.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { dragOff = null; });

    return cardEl;
}

function setLoading(loading) {
    if (!dstEl) return;
    if (loading) {
        dstEl.classList.remove('empty');
        dstEl.innerHTML = '<div class="tr-loading"><div class="tr-loading-spinner"></div>翻译中…</div>';
    }
}

function setError(msg) {
    if (!dstEl) return;
    dstEl.classList.remove('empty');
    dstEl.innerHTML = '<div class="tr-error">' + escapeHtml(msg) + '</div>';
}

function getSelectedText() {
    try {
        const sel = window.getSelection();
        if (sel && sel.toString().trim()) return sel.toString().trim();
    } catch (e) {}
    const target = document.activeElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        if (end > start) return target.value.slice(start, end).trim();
    }
    return '';
}

async function translate(text, from, to) {
    if (!text || !text.trim()) {
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('请先选中文字');
        return null;
    }
    const src = (from || settings.from);
    const dst = (to || settings.to);
    if (!cardEl) buildCard();
    show();
    currentText = text;
    srcEl.textContent = text;
    setLoading(true);
    try {
        const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(src + '|' + dst);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('网络错误 ' + resp.status);
        const data = await resp.json();
        const translated = data?.responseData?.translatedText;
        if (translated) {
            dstEl.classList.remove('empty');
            dstEl.textContent = translated;
            return translated;
        }
        setError('翻译失败：' + (data?.responseStatus || '未知错误'));
    } catch (e) {
        setError('翻译失败：' + e.message);
    }
    return null;
}

function speak(text, lang) {
    if (!('speechSynthesis' in window)) {
        if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('当前浏览器不支持语音合成');
        return;
    }
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'zh' ? 'zh-CN' : lang;
        u.rate = 1;
        u.pitch = 1;
        window.speechSynthesis.speak(u);
    } catch (e) {}
}

function show() {
    if (!cardEl) buildCard();
    cardEl.classList.add('show');
}

function close() {
    if (cardEl) cardEl.classList.remove('show');
}

function toggleFromSelection() {
    const text = getSelectedText();
    if (text) translate(text);
    else show();
}

function init() {
    injectStyles();
    window.MXOS.Translate = {
        translate,
        speak,
        show,
        close,
        toggle: toggleFromSelection,
        setLangs: (from, to) => {
            if (from) { settings.from = from; if (fromSelEl) fromSelEl.value = from; }
            if (to) { settings.to = to; if (toSelEl) toSelEl.value = to; }
            saveSettings(settings);
        }
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { translate, speak, close };
