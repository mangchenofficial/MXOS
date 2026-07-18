import { callChatApi, streamSse, isConfigured, getConfig, callChatSimple } from './ai-registry.js';

window.MXOS = window.MXOS || {};
window.MXOS.AI = window.MXOS.AI || {};

const HISTORY_KEY = 'mxos_ai_chat_history';
const HISTORY_FILE_PATH = '/AI/chat-history.json';
const MAX_HISTORY = 100;

let panelEl = null;
let messagesEl = null;
let inputEl = null;
let sendBtn = null;
let isOpen = false;
let history = [];
let streamingController = null;
let lastFocused = null;

function injectStyles() {
    if (document.getElementById('mxos-ai-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-ai-chat-styles';
    style.textContent = `
.mxos-ai-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 92vw);
    z-index: 9999;
    background: rgba(20, 25, 35, 0.75);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: -12px 0 40px rgba(0, 0, 0, 0.4);
    color: #fff;
    display: none;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mxos-ai-panel.show { display: flex; }
.mxos-ai-panel.show-active { transform: translateX(0); }
.mxos-ai-header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.mxos-ai-title {
    flex: 1;
    font-size: 15px; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
}
.mxos-ai-title svg { width: 18px; height: 18px; color: var(--accent-color, #60a5fa); }
.mxos-ai-actions { display: flex; gap: 4px; }
.mxos-ai-icon-btn {
    width: 30px; height: 30px;
    background: transparent; border: none; cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
}
.mxos-ai-icon-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.mxos-ai-icon-btn svg { width: 14px; height: 14px; }
.mxos-ai-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex; flex-direction: column; gap: 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
.mxos-ai-messages::-webkit-scrollbar { width: 6px; }
.mxos-ai-messages::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 3px; }
.mxos-ai-msg {
    max-width: 88%;
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.55;
    word-break: break-word;
    white-space: pre-wrap;
    animation: mxosAiFadeIn 200ms ease both;
}
@keyframes mxosAiFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
.mxos-ai-msg.user {
    align-self: flex-end;
    background: linear-gradient(135deg, var(--accent-color, #3b82f6), #2563eb);
    color: #fff;
    border-bottom-right-radius: 4px;
}
.mxos-ai-msg.assistant {
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-bottom-left-radius: 4px;
}
.mxos-ai-msg.system {
    align-self: center;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    border-radius: 8px;
}
.mxos-ai-msg.error {
    align-self: center;
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    font-size: 12px;
    border-radius: 8px;
    border: 1px solid rgba(239, 68, 68, 0.3);
}
.mxos-ai-empty {
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    padding: 40px 16px;
}
.mxos-ai-typing {
    display: inline-flex; gap: 3px; padding: 4px 0;
}
.mxos-ai-typing span {
    width: 6px; height: 6px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    animation: mxosAiTyping 1.2s ease-in-out infinite;
}
.mxos-ai-typing span:nth-child(2) { animation-delay: 0.2s; }
.mxos-ai-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes mxosAiTyping {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-3px); }
}
.mxos-ai-input-wrap {
    display: flex; align-items: flex-end; gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
}
.mxos-ai-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #fff;
    padding: 10px 12px;
    font-size: 13px;
    font-family: inherit;
    resize: none;
    max-height: 120px;
    min-height: 42px;
    outline: none;
    line-height: 1.4;
}
.mxos-ai-input:focus { border-color: var(--accent-color, #3b82f6); }
.mxos-ai-send {
    width: 38px; height: 38px;
    border: none; cursor: pointer;
    background: var(--accent-color, #3b82f6);
    color: #fff;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.15s ease, transform 0.1s ease;
    flex-shrink: 0;
}
.mxos-ai-send:hover { filter: brightness(1.1); }
.mxos-ai-send:active { transform: scale(0.95); }
.mxos-ai-send:disabled { opacity: 0.5; cursor: not-allowed; }
.mxos-ai-send svg { width: 16px; height: 16px; }
.mxos-ai-send.stop { background: #ef4444; }
    `;
    document.head.appendChild(style);
}

function buildPanel() {
    if (panelEl) return;
    injectStyles();
    panelEl = document.createElement('div');
    panelEl.className = 'mxos-ai-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', 'AI 助手');
    panelEl.innerHTML = `
        <div class="mxos-ai-header">
            <div class="mxos-ai-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 1 3 3c0 1.31-.83 2.42-2 2.83V20l-4-2V7.83A3 3 0 0 1 12 2z"/><path d="M5 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/><path d="M19 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
                <span>AI 助手</span>
            </div>
            <div class="mxos-ai-actions">
                <button class="mxos-ai-icon-btn" data-act="clear" title="清空对话" aria-label="清空对话">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
                <button class="mxos-ai-icon-btn" data-act="close" title="关闭" aria-label="关闭">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
        <div class="mxos-ai-messages" data-messages></div>
        <div class="mxos-ai-input-wrap">
            <textarea class="mxos-ai-input" placeholder="输入消息… (Enter 发送，Shift+Enter 换行)" rows="1"></textarea>
            <button class="mxos-ai-send" data-act="send" title="发送" aria-label="发送">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
        </div>
    `;
    const host = document.getElementById('aiPanel') || document.body;
    host.appendChild(panelEl);
    messagesEl = panelEl.querySelector('[data-messages]');
    inputEl = panelEl.querySelector('.mxos-ai-input');
    sendBtn = panelEl.querySelector('[data-act="send"]');

    panelEl.querySelector('[data-act="close"]').addEventListener('click', closePanel);
    panelEl.querySelector('[data-act="clear"]').addEventListener('click', () => {
        if (history.length > 0 && confirm('确定清空所有对话历史？')) {
            clearHistory();
            renderMessages();
        }
    });
    sendBtn.addEventListener('click', onSend);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    });
    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(120, inputEl.scrollHeight) + 'px';
    });

    document.addEventListener('keydown', (e) => {
        if (isOpen && e.key === 'Escape') {
            e.preventDefault();
            closePanel();
        }
    }, true);
}

function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (raw) history = JSON.parse(raw) || [];
    } catch (e) {
        history = [];
    }
    return history;
}

function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (e) {}
    saveHistoryToVFS();
}

let vfsSaveTimer = null;
function saveHistoryToVFS() {
    if (vfsSaveTimer) clearTimeout(vfsSaveTimer);
    vfsSaveTimer = setTimeout(async () => {
        try {
            const { vfs } = await import('../vfs.js');
            const rootItems = await vfs.getChildren(null);
            let aiFolder = rootItems.find(f => f.type === 'folder' && f.name === 'AI');
            let parentId = null;
            if (!aiFolder) {
                parentId = await vfs.add({ name: 'AI', type: 'folder', parentId: null, inTrash: false });
            } else {
                parentId = aiFolder.id;
            }
            const children = await vfs.getChildren(parentId);
            const existing = children.find(f => f.name === 'chat-history.json');
            const content = JSON.stringify(history, null, 2);
            if (existing) {
                await vfs.update(existing.id, { content, size: content.length, modifiedAt: new Date().toISOString() });
            } else {
                await vfs.add({
                    name: 'chat-history.json',
                    type: 'file',
                    mime: 'application/json',
                    content,
                    size: content.length,
                    parentId,
                    inTrash: false
                });
            }
        } catch (e) {}
    }, 1000);
}

function clearHistory() {
    history = [];
    saveHistory();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    if (history.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'mxos-ai-empty';
        empty.textContent = '开始和 AI 对话吧！输入消息或选中文字右键使用 AI 操作。';
        messagesEl.appendChild(empty);
        return;
    }
    history.forEach(msg => {
        const el = document.createElement('div');
        el.className = 'mxos-ai-msg ' + (msg.role || 'system');
        if (msg.role === 'user' || msg.role === 'assistant') {
            el.textContent = msg.content;
        } else {
            el.textContent = msg.content;
        }
        messagesEl.appendChild(el);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(role, content) {
    history.push({ role, content, timestamp: Date.now() });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    saveHistory();
    renderMessages();
}

function appendStreamingMessage(role) {
    const el = document.createElement('div');
    el.className = 'mxos-ai-msg ' + role;
    el.textContent = '';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
}

function showTyping() {
    const el = document.createElement('div');
    el.className = 'mxos-ai-msg assistant';
    el.dataset.typing = '1';
    el.innerHTML = '<div class="mxos-ai-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
}

function removeTyping() {
    const t = messagesEl.querySelector('[data-typing="1"]');
    if (t) t.remove();
}

async function onSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    if (!isConfigured()) {
        appendMessage('error', '未配置 API Key，请通过 MXOS.AI.setConfig(provider, apiKey, endpoint) 配置');
        return;
    }
    if (streamingController) {
        streamingController.abort();
        return;
    }
    inputEl.value = '';
    inputEl.style.height = 'auto';
    appendMessage('user', text);
    await streamChat(text);
}

async function streamChat(userMessage, systemContext) {
    const messages = [];
    if (systemContext) {
        messages.push({ role: 'system', content: systemContext });
    }
    history.slice(-12).forEach(m => {
        if (m.role === 'user' || m.role === 'assistant') {
            messages.push({ role: m.role, content: m.content });
        }
    });
    if (!messages.some(m => m.role === 'user' && m.content === userMessage)) {
        messages.push({ role: 'user', content: userMessage });
    }

    const typingEl = showTyping();
    const msgEl = document.createElement('div');
    msgEl.className = 'mxos-ai-msg assistant';
    msgEl.style.display = 'none';

    streamingController = new AbortController();
    sendBtn.classList.add('stop');
    sendBtn.title = '停止';

    let accText = '';
    let msgAttached = false;
    try {
        const res = await callChatApi(messages, { stream: true });
        for await (const chunk of streamSse(res)) {
            if (!msgAttached) {
                removeTyping();
                typingEl.remove();
                msgEl.style.display = '';
                messagesEl.appendChild(msgEl);
                msgAttached = true;
            }
            const piece = chunk.text || chunk.delta || chunk.content || (chunk.choices && chunk.choices[0]?.delta?.content) || '';
            if (piece) {
                accText += piece;
                msgEl.textContent = accText;
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        }
        if (!msgAttached) {
            removeTyping();
            typingEl.remove();
        }
        if (!accText) {
            if (!msgAttached) {
                msgEl.style.display = '';
                messagesEl.appendChild(msgEl);
                msgAttached = true;
            }
            msgEl.textContent = '(空回复)';
        }
        history.push({ role: 'assistant', content: accText || '(空回复)', timestamp: Date.now() });
        if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
        saveHistory();
    } catch (e) {
        removeTyping();
        typingEl.remove();
        if (e.name === 'AbortError') {
            if (accText) {
                history.push({ role: 'assistant', content: accText, timestamp: Date.now() });
                saveHistory();
                if (msgAttached) msgEl.textContent = accText + ' (已停止)';
                else appendMessage('assistant', accText + ' (已停止)');
            } else {
                appendMessage('system', '已停止生成');
            }
        } else {
            appendMessage('error', '调用失败：' + e.message);
        }
    } finally {
        streamingController = null;
        sendBtn.classList.remove('stop');
        sendBtn.title = '发送';
    }
}

async function chat(message) {
    if (!panelEl) buildPanel();
    if (!isOpen) openPanel();
    appendMessage('user', message);
    await streamChat(message);
    return history[history.length - 1]?.content || '';
}

async function ask(question, context) {
    if (!isConfigured()) {
        throw new Error('未配置 API Key');
    }
    const messages = [];
    if (context) messages.push({ role: 'system', content: context });
    messages.push({ role: 'user', content: question });
    return await callChatSimple(messages, { stream: false });
}

function openPanel() {
    if (!panelEl) buildPanel();
    if (isOpen) return;
    lastFocused = document.activeElement;
    isOpen = true;
    panelEl.classList.add('show');
    requestAnimationFrame(() => panelEl.classList.add('show-active'));
    renderMessages();
    setTimeout(() => inputEl.focus(), 200);
}

function closePanel() {
    if (!panelEl || !isOpen) return;
    isOpen = false;
    panelEl.classList.remove('show-active');
    setTimeout(() => { if (!isOpen) panelEl.classList.remove('show'); }, 260);
    if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus(); } catch (e) {}
    }
}

function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
}

function init() {
    loadHistory();
    buildPanel();
    window.MXOS.AI.chat = chat;
    window.MXOS.AI.ask = ask;
    window.MXOS.AI.openPanel = openPanel;
    window.MXOS.AI.closePanel = closePanel;
    window.MXOS.AI.togglePanel = togglePanel;
    window.MXOS.AI.isPanelOpen = () => isOpen;
    window.MXOS.AI.getHistory = () => history.slice();
    window.MXOS.AI.clearHistory = clearHistory;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { chat, ask, openPanel, closePanel, togglePanel };
