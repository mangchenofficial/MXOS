import { openPanel, chat } from './chat-panel.js';
import { isConfigured, callChatSimple } from './ai-registry.js';

window.MXOS = window.MXOS || {};
window.MXOS.AI = window.MXOS.AI || {};

const ACTIONS = [
    { id: 'explain', label: '解释', prompt: (text) => `请用简洁清晰的语言解释以下内容：\n\n${text}` },
    { id: 'translate', label: '翻译', prompt: (text) => `请将以下内容翻译为中文（如果已经是中文，则翻译为英文）：\n\n${text}` },
    { id: 'summarize', label: '总结', prompt: (text) => `请用简洁的要点总结以下内容：\n\n${text}` },
    { id: 'rewrite', label: '改写', prompt: (text) => `请改写以下内容，使其更清晰、流畅、专业：\n\n${text}` }
];

function getSelectionText() {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) return sel.toString().trim();
    const target = document.activeElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        if (end > start) return target.value.slice(start, end).trim();
    }
    return '';
}

async function runAction(actionId, text) {
    const action = ACTIONS.find(a => a.id === actionId);
    if (!action) return;
    if (!text) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('请先选中文字', 'info');
        return;
    }
    if (!isConfigured()) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('未配置 AI，请先调用 MXOS.AI.setConfig', 'warning');
        return;
    }
    openPanel();
    await chat(action.prompt(text));
}

function registerCommandPalette() {
    if (!window.MXOS.CommandPalette || typeof window.MXOS.CommandPalette.register !== 'function') return;
    window.MXOS.CommandPalette.register({
        id: 'ai-open-panel',
        title: 'AI 助手',
        subtitle: '打开 AI 聊天面板',
        category: 'AI',
        icon: 'app',
        keywords: ['ai', '助手', '聊天', 'chat', 'gpt'],
        action: () => openPanel()
    });
    ACTIONS.forEach(action => {
        window.MXOS.CommandPalette.register({
            id: 'ai-action-' + action.id,
            title: 'AI ' + action.label,
            subtitle: '对选中文字执行 ' + action.label,
            category: 'AI',
            icon: 'app',
            keywords: ['ai', action.id, action.label, '智能'],
            action: () => runAction(action.id, getSelectionText())
        });
    });
    window.MXOS.CommandPalette.register({
        id: 'ai-ask',
        title: 'AI 询问',
        subtitle: '快速询问 AI',
        category: 'AI',
        icon: 'app',
        keywords: ['ai', 'ask', '问', '查询'],
        action: async () => {
            const text = getSelectionText();
            const question = window.prompt('询问 AI：', text || '');
            if (question) await chat(question);
        }
    });
}

function injectActionStyles() {
    if (document.getElementById('mxos-ai-action-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-ai-action-styles';
    style.textContent = `
.mxos-ai-context-group {
    display: flex; flex-direction: column;
}
.mxos-ai-context-label {
    padding: 6px 14px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    pointer-events: none;
}
.mxos-ai-context-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px;
    cursor: pointer;
    color: var(--text-color, #fff);
    font-size: 13px;
}
.mxos-ai-context-item:hover { background: var(--hover-bg, rgba(255, 255, 255, 0.1)); }
.mxos-ai-context-item svg { width: 14px; height: 14px; opacity: 0.8; }
    `;
    document.head.appendChild(style);
}

function buildAiContextGroup(selectedText) {
    injectActionStyles();
    const group = document.createElement('div');
    group.className = 'mxos-ai-context-group';
    const label = document.createElement('div');
    label.className = 'mxos-ai-context-label';
    label.textContent = 'AI 操作';
    group.appendChild(label);
    const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 1 3 3c0 1.31-.83 2.42-2 2.83V20l-4-2V7.83A3 3 0 0 1 12 2z"/></svg>';
    ACTIONS.forEach(action => {
        const item = document.createElement('div');
        item.className = 'mxos-ai-context-item context-menu-item';
        item.dataset.aiAction = action.id;
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '-1');
        item.innerHTML = icon + '<span>AI ' + action.label + '</span>';
        item.addEventListener('click', () => {
            runAction(action.id, selectedText || getSelectionText());
            const cm = document.getElementById('contextMenu');
            if (cm) cm.style.display = 'none';
        });
        group.appendChild(item);
    });
    return group;
}

function appendToContextMenu(contextMenu, selectedText) {
    if (!contextMenu) return;
    let group = contextMenu.querySelector('.mxos-ai-context-group');
    let divider = contextMenu.querySelector('.mxos-ai-context-divider');
    if (!group) {
        if (!selectedText) return;
        group = buildAiContextGroup(selectedText);
        divider = document.createElement('div');
        divider.className = 'context-menu-divider mxos-ai-context-divider';
        divider.setAttribute('role', 'separator');
        const personalizeItem = contextMenu.querySelector('[data-action="personalize"]');
        if (personalizeItem) {
            contextMenu.insertBefore(divider, personalizeItem);
            contextMenu.insertBefore(group, personalizeItem);
        } else {
            contextMenu.appendChild(divider);
            contextMenu.appendChild(group);
        }
    }
    const hasText = !!selectedText;
    if (divider) divider.style.display = hasText ? '' : 'none';
    if (group) group.style.display = hasText ? '' : 'none';
}

function init() {
    registerCommandPalette();
    window.MXOS.AI.runAction = runAction;
    window.MXOS.AI.getActions = () => ACTIONS.map(a => ({ ...a }));
    window.MXOS.AI.appendContextMenuItems = appendToContextMenu;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { runAction, appendToContextMenu, ACTIONS };
