window.MXOS = window.MXOS || {};
window.MXOS.IME = window.MXOS.IME || {};

let panelEl = null;
let searchEl = null;
let tabsEl = null;
let gridEl = null;
let isOpen = false;
let lastFocused = null;
let currentCategory = 'emoji';

const CATEGORIES = {
    emoji: { label: '表情', items: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕'.split(' ') },
    symbol: { label: '符号', items: '★ ☆ ✦ ✧ ✩ ✪ ✫ ✬ ✭ ✮ ✯ ✰ ✓ ✔ ✗ ✘ ✕ ✖ ☑ ☒ ☐ ✚ ✛ ✜ ✝ ✞ ✟ ✠ ✡ ❀ ❁ ❂ ❃ ❄ ❅ ❆ ❇ ❈ ❉ ❊ ❋ ✱ ✲ ✳ ✴ ✵ ✶ ✷ ✸ ✹ ✺ ✻ ✼ ✽ ✾ ✿ ❃ ❅ ❆ ❉ ❊ ❋ ❖ ◆ ◇ ■ □ ▢ ▣ ▤ ▥ ▦ ▧ ▨ ▩ ◐ ◑ ◒ ◓ ◔ ◕ ◖ ◗'.split(' ') },
    math: { label: '数学', items: '± × ÷ √ ∛ ∜ ∝ ∞ ∑ ∏ ∫ ∂ ∇ ∆ ∇ ∈ ∉ ∋ ∌ ∀ ∃ ∄ ∅ ∪ ∩ ⊂ ⊃ ⊄ ⊅ ⊆ ⊇ ⊕ ⊖ ⊗ ⊘ ⊙ ⊚ ⊛ ⊜ ⊝ ⊞ ⊟ ≡ ≢ ≅ ≆ ≈ ≉ ≤ ≥ ≦ ≧ ≪ ≫ ≮ ≯ ¬ ∧ ∨ ⊻ ⊼ ⊽ ⊾ ⊿ ⌈ ⌉ ⌊ ⌋ 〈 〉 《 》 「 」 『 』'.split(' ') },
    arrow: { label: '箭头', items: '← → ↑ ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇑ ⇓ ⇔ ⇕ ⇖ ⇗ ⇘ ⇙ ➜ ➝ ➞ ➟ ➠ ➡ ➢ ➣ ➤ ➥ ➦ ➧ ➨ ➩ ➪ ➫ ➬ ➭ ➮ ➯ ➰ ➱ ➲ ➳ ➴ ➵ ➶ ➷ ➸ ➹ ➺ ➻ ➼ ➽ ➾'.split(' ') },
    greek: { label: '希腊', items: 'Α α Β β Γ γ Δ δ Ε ε Ζ ζ Η η Θ θ Ι ι Κ κ Λ λ Μ μ Ν ν Ξ ξ Ο ο Π π Ρ ρ Σ σ ς Τ τ Υ υ Φ φ Χ χ Ψ ψ Ω ω'.split(' ') },
    latin: { label: '拉丁', items: 'À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ð Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý Þ ß à á â ã ä å æ ç è é ê ë ì í î ï ð ñ ò ó ô õ ö ø ù ú û ü ý þ ÿ'.split(' ') }
};

function injectStyles() {
    if (document.getElementById('mxos-symbol-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-symbol-panel-styles';
    style.textContent = `
.mxos-symbol-panel {
    position: fixed;
    bottom: 56px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    z-index: 9999;
    width: min(560px, 92vw);
    max-height: 420px;
    background: rgba(20, 25, 35, 0.85);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
    color: #fff;
    display: none;
    flex-direction: column;
    overflow: hidden;
    opacity: 0;
    transition: opacity 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mxos-symbol-panel.show { display: flex; }
.mxos-symbol-panel.show-active { opacity: 1; transform: translateX(-50%) translateY(0); }
.mxos-symbol-header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.mxos-symbol-search {
    flex: 1;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #fff;
    padding: 7px 12px;
    font-size: 13px;
    outline: none;
}
.mxos-symbol-search:focus { border-color: var(--accent-color, #60a5fa); }
.mxos-symbol-close {
    width: 28px; height: 28px;
    background: transparent; border: none; cursor: pointer;
    color: #fff; border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
}
.mxos-symbol-close:hover { background: rgba(255, 255, 255, 0.1); }
.mxos-symbol-tabs {
    display: flex; gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    scrollbar-width: none;
}
.mxos-symbol-tabs::-webkit-scrollbar { display: none; }
.mxos-symbol-tab {
    padding: 6px 12px;
    border: none; cursor: pointer;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    border-radius: 6px;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
}
.mxos-symbol-tab:hover { background: rgba(255, 255, 255, 0.06); color: #fff; }
.mxos-symbol-tab.active { background: rgba(96, 165, 250, 0.25); color: #fff; }
.mxos-symbol-grid {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 2px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
.mxos-symbol-grid::-webkit-scrollbar { width: 6px; }
.mxos-symbol-grid::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 3px; }
.mxos-symbol-item {
    display: flex; align-items: center; justify-content: center;
    width: 40px; height: 40px;
    border: none; cursor: pointer;
    background: transparent;
    color: #fff;
    font-size: 22px;
    border-radius: 6px;
    transition: background 0.12s ease, transform 0.12s ease;
}
.mxos-symbol-item:hover { background: rgba(96, 165, 250, 0.2); transform: scale(1.1); }
.mxos-symbol-item:active { transform: scale(0.95); }
.mxos-symbol-empty {
    grid-column: 1 / -1;
    padding: 32px 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
}
    `;
    document.head.appendChild(style);
}

function buildPanel() {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.className = 'mxos-symbol-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', '符号面板');
    panelEl.innerHTML = `
        <div class="mxos-symbol-header">
            <input type="text" class="mxos-symbol-search" placeholder="搜索符号…" aria-label="搜索符号">
            <button class="mxos-symbol-close" title="关闭" aria-label="关闭">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="mxos-symbol-tabs" role="tablist"></div>
        <div class="mxos-symbol-grid" role="grid"></div>
    `;
    document.body.appendChild(panelEl);
    searchEl = panelEl.querySelector('.mxos-symbol-search');
    tabsEl = panelEl.querySelector('.mxos-symbol-tabs');
    gridEl = panelEl.querySelector('.mxos-symbol-grid');

    searchEl.addEventListener('input', renderGrid);
    panelEl.querySelector('.mxos-symbol-close').addEventListener('click', closeSymbolPanel);
    panelEl.addEventListener('click', (e) => {
        if (e.target === panelEl) closeSymbolPanel();
    });

    Object.keys(CATEGORIES).forEach(key => {
        const tab = document.createElement('button');
        tab.className = 'mxos-symbol-tab' + (key === currentCategory ? ' active' : '');
        tab.textContent = CATEGORIES[key].label;
        tab.setAttribute('role', 'tab');
        tab.dataset.cat = key;
        tab.addEventListener('click', () => {
            currentCategory = key;
            tabsEl.querySelectorAll('.mxos-symbol-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === key));
            searchEl.value = '';
            renderGrid();
        });
        tabsEl.appendChild(tab);
    });

    gridEl.addEventListener('click', (e) => {
        const item = e.target.closest('.mxos-symbol-item');
        if (!item) return;
        insertSymbol(item.textContent);
    });

    document.addEventListener('keydown', (e) => {
        if (isOpen && e.key === 'Escape') {
            e.preventDefault();
            closeSymbolPanel();
        }
    }, true);
}

function renderGrid() {
    if (!gridEl) return;
    const query = (searchEl.value || '').trim().toLowerCase();
    let items = CATEGORIES[currentCategory].items.slice();
    if (query) {
        items = items.filter(ch => {
            const code = ch.codePointAt(0).toString(16);
            return ch.includes(query) || code.includes(query);
        });
        Object.keys(CATEGORIES).forEach(key => {
            if (key === currentCategory) return;
            CATEGORIES[key].items.forEach(ch => {
                const code = ch.codePointAt(0).toString(16);
                if (ch.includes(query) || code.includes(query)) items.push(ch);
            });
        });
    }
    gridEl.innerHTML = '';
    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'mxos-symbol-empty';
        empty.textContent = '未找到匹配的符号';
        gridEl.appendChild(empty);
        return;
    }
    items.forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'mxos-symbol-item';
        btn.textContent = ch;
        btn.setAttribute('role', 'gridcell');
        btn.setAttribute('aria-label', '插入符号 ' + ch);
        gridEl.appendChild(btn);
    });
}

function insertSymbol(symbol) {
    const target = lastFocused || document.activeElement;
    let inserted = false;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const value = target.value;
        target.value = value.slice(0, start) + symbol + value.slice(end);
        const pos = start + symbol.length;
        target.selectionStart = pos;
        target.selectionEnd = pos;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.focus();
        inserted = true;
    } else if (target && target.isContentEditable) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(symbol));
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            target.focus();
            inserted = true;
        }
    }
    if (!inserted) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(symbol);
                if (window.MXOS?.notify) window.MXOS.notify({ title: '符号面板', body: '符号已复制到剪贴板', type: 'info' });
            }
        } catch (e) {}
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}

function openSymbolPanel() {
    if (!panelEl) buildPanel();
    if (isOpen) return;
    lastFocused = document.activeElement;
    isOpen = true;
    panelEl.classList.add('show');
    requestAnimationFrame(() => panelEl.classList.add('show-active'));
    searchEl.value = '';
    currentCategory = 'emoji';
    tabsEl.querySelectorAll('.mxos-symbol-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'emoji'));
    renderGrid();
    setTimeout(() => searchEl.focus(), 80);
}

function closeSymbolPanel() {
    if (!panelEl || !isOpen) return;
    isOpen = false;
    panelEl.classList.remove('show-active');
    setTimeout(() => { if (!isOpen) panelEl.classList.remove('show'); }, 200);
    if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus(); } catch (e) {}
    }
}

function init() {
    injectStyles();
    window.MXOS.IME.openSymbolPanel = openSymbolPanel;
    window.MXOS.IME.closeSymbolPanel = closeSymbolPanel;
    window.MXOS.IME.isSymbolPanelOpen = () => isOpen;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { openSymbolPanel, closeSymbolPanel };
