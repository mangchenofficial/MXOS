window.MXOS = window.MXOS || {};

const STORAGE_KEY = 'mxos_clipboard_history';
const PINNED_KEY = 'mxos_clipboard_pinned';
const MAX_ITEMS = 50;

let panelEl = null;
let searchEl = null;
let listEl = null;
let isOpen = false;
let lastFocusedElement = null;

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveHistory(list) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
}

function loadPinned() {
    try {
        return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]');
    } catch {
        return [];
    }
}

function savePinned(list) {
    try {
        localStorage.setItem(PINNED_KEY, JSON.stringify(list));
    } catch {}
}

function isPinned(text) {
    return loadPinned().some(p => p.text === text);
}

function pushHistory(text) {
    if (!text || typeof text !== 'string') return;
    if (text.trim().length === 0) return;
    if (text.length > 4096) text = text.slice(0, 4096);
    const list = loadHistory();
    const existing = list.findIndex(item => item.text === text);
    if (existing !== -1) list.splice(existing, 1);
    list.unshift({ text, timestamp: Date.now() });
    while (list.length > MAX_ITEMS) list.pop();
    saveHistory(list);
    if (isOpen) renderList();
}

function pin(text) {
    const pinned = loadPinned();
    if (!pinned.some(p => p.text === text)) {
        pinned.push({ text, timestamp: Date.now() });
        savePinned(pinned);
    }
    if (isOpen) renderList();
}

function unpin(text) {
    const pinned = loadPinned().filter(p => p.text !== text);
    savePinned(pinned);
    if (isOpen) renderList();
}

function clearHistory() {
    saveHistory([]);
    savePinned([]);
    if (isOpen) renderList();
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function renderList() {
    if (!listEl) return;
    const query = (searchEl?.value || '').toLowerCase().trim();
    const pinned = loadPinned();
    const history = loadHistory();
    const pinnedFiltered = pinned.filter(p => !query || p.text.toLowerCase().includes(query));
    const historyFiltered = history.filter(h => !query || h.text.toLowerCase().includes(query));

    let html = '';
    if (pinnedFiltered.length) {
        html += '<div class="cb-section-label">置顶</div>';
        pinnedFiltered.forEach(item => {
            html += renderItem(item, true);
        });
    }
    if (historyFiltered.length) {
        if (pinnedFiltered.length) html += '<div class="cb-section-label">历史</div>';
        historyFiltered.forEach(item => {
            html += renderItem(item, false);
        });
    }
    if (!html) {
        html = '<div class="cb-empty">' + (query ? '没有匹配项' : '暂无剪贴板历史') + '</div>';
    }
    listEl.innerHTML = html;
    bindItemEvents();
}

function renderItem(item, pinned) {
    const text = escapeHtml(item.text);
    const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;
    const time = item.timestamp ? formatTime(item.timestamp) : '';
    return `
        <div class="cb-item${pinned ? ' pinned' : ''}" data-text="${encodeURIComponent(item.text)}" role="button" tabindex="0">
            <div class="cb-item-text">${preview}</div>
            <div class="cb-item-meta">
                <span class="cb-item-time">${time}</span>
                <div class="cb-item-actions">
                    <button class="cb-action-btn pin-btn" data-action="${pinned ? 'unpin' : 'pin'}" title="${pinned ? '取消置顶' : '置顶'}" aria-label="${pinned ? '取消置顶' : '置顶'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="${pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
                    </button>
                    <button class="cb-action-btn copy-btn" data-action="copy" title="复制" aria-label="复制">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="cb-action-btn delete-btn" data-action="delete" title="删除" aria-label="删除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function bindItemEvents() {
    listEl.querySelectorAll('.cb-item').forEach(itemEl => {
        const text = decodeURIComponent(itemEl.dataset.text);
        const clickHandler = (e) => {
            if (e.target.closest('.cb-action-btn')) return;
            pasteToFocus(text);
        };
        itemEl.addEventListener('click', clickHandler);
        itemEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                pasteToFocus(text);
            }
        });
        itemEl.querySelectorAll('.cb-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'pin') pin(text);
                else if (action === 'unpin') unpin(text);
                else if (action === 'copy') {
                    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
                    close();
                } else if (action === 'delete') {
                    deleteItem(text);
                }
            });
        });
    });
}

function deleteItem(text) {
    saveHistory(loadHistory().filter(h => h.text !== text));
    savePinned(loadPinned().filter(p => p.text !== text));
    renderList();
}

async function pasteToFocus(text) {
    close();
    await new Promise(r => setTimeout(r, 60));
    const target = lastFocusedElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        target.value = target.value.slice(0, start) + text + target.value.slice(end);
        target.selectionStart = target.selectionEnd = start + text.length;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.focus();
    } else {
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
            if (window.MXOS?.notify) {
                window.MXOS.notify({ title: '剪贴板', body: '已复制到剪贴板', type: 'info' });
            }
        } catch {}
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('click');
}

function injectStyles() {
    if (document.getElementById('clipboard-history-styles')) return;
    const style = document.createElement('style');
    style.id = 'clipboard-history-styles';
    style.textContent = `
#clipboardPanel {
    position: fixed;
    right: 16px;
    bottom: 56px;
    width: 380px;
    max-width: calc(100vw - 32px);
    max-height: 70vh;
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur-active)) saturate(var(--glass-saturation));
    -webkit-backdrop-filter: blur(var(--glass-blur-active)) saturate(var(--glass-saturation));
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    z-index: 9500;
    display: none;
    flex-direction: column;
    overflow: hidden;
    transform: translateY(8px) scale(0.98);
    opacity: 0;
    transition: transform 0.22s var(--ease-out), opacity 0.22s var(--ease-out);
    color: var(--text-color);
}
#clipboardPanel.show {
    display: flex;
    transform: translateY(0) scale(1);
    opacity: 1;
}
.cb-header {
    padding: 12px 14px;
    border-bottom: 1px solid var(--glass-border);
    display: flex;
    align-items: center;
    gap: 8px;
}
.cb-title {
    font-size: 14px;
    font-weight: var(--font-weight-semibold);
    flex: 1;
}
.cb-search {
    flex: 2;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 6px 10px;
    color: var(--text-color);
    font-size: 13px;
    outline: none;
}
.cb-search:focus {
    border-color: var(--accent);
}
.cb-toolbar {
    display: flex;
    gap: 6px;
}
.cb-icon-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    color: var(--text-color);
    cursor: pointer;
    transition: background 0.15s ease;
}
.cb-icon-btn:hover {
    background: var(--hover-bg);
}
.cb-list {
    overflow-y: auto;
    padding: 8px;
    flex: 1;
}
.cb-section-label {
    font-size: 11px;
    color: var(--text-secondary);
    padding: 6px 6px 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.cb-item {
    padding: 10px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s ease;
    border: 1px solid transparent;
}
.cb-item:hover, .cb-item:focus-visible {
    background: rgba(255, 255, 255, 0.06);
    outline: none;
}
.cb-item.pinned {
    background: rgba(96, 165, 250, 0.1);
    border-color: rgba(96, 165, 250, 0.3);
}
.cb-item-text {
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
    white-space: pre-wrap;
    color: var(--text-color);
    max-height: 60px;
    overflow: hidden;
}
.cb-item-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
}
.cb-item-time {
    font-size: 11px;
    color: var(--text-secondary);
}
.cb-item-actions {
    display: flex;
    gap: 4px;
    opacity: 0.4;
    transition: opacity 0.15s ease;
}
.cb-item:hover .cb-item-actions, .cb-item:focus-within .cb-item-actions {
    opacity: 1;
}
.cb-action-btn {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-color);
    cursor: pointer;
    padding: 0;
}
.cb-action-btn:hover {
    background: rgba(255, 255, 255, 0.12);
}
.cb-action-btn.delete-btn:hover {
    color: #f87171;
}
.cb-empty {
    padding: 40px 16px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 13px;
}
.cb-list::-webkit-scrollbar {
    width: 6px;
}
.cb-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
}
    `;
    document.head.appendChild(style);
}

function buildPanel() {
    let el = document.getElementById('clipboardPanel');
    if (!el) {
        el = document.createElement('div');
        el.id = 'clipboardPanel';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', '剪贴板历史');
        document.body.appendChild(el);
    }
    el.innerHTML = `
        <div class="cb-header">
            <span class="cb-title">剪贴板历史</span>
            <input class="cb-search" type="text" placeholder="搜索…" aria-label="搜索剪贴板历史">
            <div class="cb-toolbar">
                <button class="cb-icon-btn" id="cbClearBtn" title="清空" aria-label="清空">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
                <button class="cb-icon-btn" id="cbCloseBtn" title="关闭" aria-label="关闭">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
        <div class="cb-list"></div>
    `;
    panelEl = el;
    searchEl = el.querySelector('.cb-search');
    listEl = el.querySelector('.cb-list');
    searchEl.addEventListener('input', renderList);
    el.querySelector('#cbClearBtn').addEventListener('click', () => {
        if (confirm('确定清空所有剪贴板历史？')) clearHistory();
    });
    el.querySelector('#cbCloseBtn').addEventListener('click', close);
    el.addEventListener('click', (e) => {
        if (e.target === el) close();
    });
}

function open() {
    if (!panelEl) buildPanel();
    lastFocusedElement = document.activeElement;
    isOpen = true;
    panelEl.style.display = 'flex';
    requestAnimationFrame(() => panelEl.classList.add('show'));
    searchEl.value = '';
    renderList();
    setTimeout(() => searchEl.focus(), 80);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}

function close() {
    if (!panelEl || !isOpen) return;
    isOpen = false;
    panelEl.classList.remove('show');
    setTimeout(() => { if (!isOpen) panelEl.style.display = 'none'; }, 220);
}

function toggle() {
    if (isOpen) close();
    else open();
}

function handleCopyEvents(e) {
    const sel = window.getSelection?.();
    if (sel && sel.toString().length > 0) {
        pushHistory(sel.toString());
        return;
    }
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        if (end > start) {
            pushHistory(target.value.slice(start, end));
        }
    }
}

function bindGlobalListeners() {
    document.addEventListener('copy', handleCopyEvents, true);
    document.addEventListener('cut', handleCopyEvents, true);
    document.addEventListener('keydown', (e) => {
        if (isOpen && e.key === 'Escape') {
            close();
            e.preventDefault();
        }
    }, true);
}

function init() {
    injectStyles();
    buildPanel();
    bindGlobalListeners();

    window.MXOS.Clipboard = {
        history: () => loadHistory(),
        pinned: () => loadPinned(),
        pin,
        unpin,
        clear: clearHistory,
        open,
        close,
        toggle,
        add: pushHistory
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { open, close, toggle, pushHistory, clearHistory };
