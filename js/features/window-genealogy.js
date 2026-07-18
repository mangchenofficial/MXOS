import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_window_genealogy';

let lastOpenApp = null;

function loadData() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {}
    return { trees: {}, history: [] };
}

let data = loadData();

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

const liveTree = new Map();

function recordOpen(appId, parentId) {
    const node = {
        appId,
        parentId: parentId || null,
        openedAt: Date.now(),
        children: [],
        closed: false
    };
    liveTree.set(appId, node);
    if (parentId && liveTree.has(parentId)) {
        liveTree.get(parentId).children.push(appId);
    }
    data.history.unshift({ appId, parentId, ts: Date.now() });
    if (data.history.length > 200) data.history.length = 200;
    saveData();
    return node;
}

function recordClose(appId) {
    const node = liveTree.get(appId);
    if (node) {
        node.closed = true;
        node.closedAt = Date.now();
    }
}

function getLiveTree() {
    const roots = [];
    liveTree.forEach(node => {
        if (!node.parentId || !liveTree.has(node.parentId)) {
            roots.push(buildTreeNode(node));
        }
    });
    return roots;
}

function buildTreeNode(node) {
    const cfg = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(node.appId)) || {};
    return {
        appId: node.appId,
        name: cfg.title || node.appId,
        icon: cfg.icon || null,
        openedAt: node.openedAt,
        closed: node.closed,
        children: node.children.map(cid => {
            const c = liveTree.get(cid);
            return c ? buildTreeNode(c) : null;
        }).filter(Boolean)
    };
}

function getHistory() {
    return data.history.slice();
}

function clearHistory() {
    data.history = [];
    liveTree.clear();
    saveData();
}

function formatTime(ts) {
    try {
        return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) { return ''; }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function appIcon(name) {
    if (!name) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
    if (window.MXOS.state && window.MXOS.state.iconSvg) return window.MXOS.state.iconSvg(name, 16);
    return `<svg width="16" height="16" viewBox="0 0 40 40"><use href="#svg-${name}"/></svg>`;
}

function renderTreeNode(node) {
    const hasChildren = node.children && node.children.length;
    return `<li class="mxos-gene-node">
        <div class="mxos-gene-row${node.closed ? ' closed' : ''}">
            ${hasChildren ? `<span class="mxos-gene-toggle" data-app="${escapeHtml(node.appId)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></span>` : '<span class="mxos-gene-leaf"></span>'}
            <span class="mxos-gene-icon">${appIcon(node.icon)}</span>
            <span class="mxos-gene-name">${escapeHtml(node.name)}</span>
            <span class="mxos-gene-time">${formatTime(node.openedAt)}</span>
            ${node.closed ? '<span class="mxos-gene-status">已关闭</span>' : '<span class="mxos-gene-status live">运行中</span>'}
        </div>
        ${hasChildren ? `<ul class="mxos-gene-children">${node.children.map(renderTreeNode).join('')}</ul>` : ''}
    </li>`;
}

function injectStyles() {
    if (document.getElementById('mxos-gene-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-gene-styles';
    style.textContent = `
.mxos-gene-app{padding:24px;color:#e5e7eb;height:100%;overflow:auto;background:rgba(10,10,11,0.6);display:flex;flex-direction:column}
.mxos-gene-header{margin-bottom:16px}
.mxos-gene-title{font-size:22px;font-weight:700;margin:0}
.mxos-gene-sub{font-size:13px;color:#9ca3af;margin-top:4px}
.mxos-gene-section{margin-bottom:24px}
.mxos-gene-section-title{font-size:14px;font-weight:600;color:#fbbf24;margin:0 0 12px}
.mxos-gene-tree,.mxos-gene-children{list-style:none;margin:0;padding:0}
.mxos-gene-children{margin-left:18px;padding-left:14px;border-left:1px dashed rgba(255,255,255,0.15)}
.mxos-gene-node{margin-bottom:4px}
.mxos-gene-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.03);transition:background 0.15s}
.mxos-gene-row:hover{background:rgba(255,255,255,0.06)}
.mxos-gene-row.closed{opacity:0.55}
.mxos-gene-toggle{cursor:pointer;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;transition:transform 0.2s;color:#9ca3af}
.mxos-gene-toggle.collapsed{transform:rotate(-90deg)}
.mxos-gene-toggle svg{width:12px;height:12px}
.mxos-gene-leaf{display:inline-block;width:16px;height:1px;background:rgba(255,255,255,0.2)}
.mxos-gene-icon{display:inline-flex;width:18px;height:18px}
.mxos-gene-icon svg{width:16px;height:16px;color:#fbbf24}
.mxos-gene-name{flex:1;font-size:13px}
.mxos-gene-time{font-size:11px;color:#6b7280}
.mxos-gene-status{font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(34,197,94,0.15);color:#22c55e}
.mxos-gene-status:not(.live){background:rgba(107,114,128,0.15);color:#9ca3af}
.mxos-gene-history{max-height:200px;overflow:auto;background:rgba(0,0,0,0.2);border-radius:8px;padding:10px}
.mxos-gene-hist-row{display:flex;gap:10px;font-size:11px;color:#9ca3af;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
.mxos-gene-hist-row:last-child{border-bottom:none}
.mxos-gene-hist-time{color:#6b7280;width:80px;flex-shrink:0}
.mxos-gene-hist-app{color:#fbbf24;font-weight:600}
.mxos-gene-empty{text-align:center;padding:30px 20px;color:#6b7280;font-size:13px}
    `;
    document.head.appendChild(style);
}

function renderApp(contentEl) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'mxos-gene-app';
    const trees = getLiveTree();
    root.innerHTML = `
        <div class="mxos-gene-header">
            <div class="mxos-gene-title">窗口族谱</div>
            <div class="mxos-gene-sub">追踪应用之间的父子关系 · 当前 ${liveTree.size} 个节点</div>
        </div>
        <div class="mxos-gene-section">
            <div class="mxos-gene-section-title">活动家族树</div>
            <div id="mxosGeneTree"></div>
        </div>
        <div class="mxos-gene-section">
            <div class="mxos-gene-section-title">历史记录</div>
            <div class="mxos-gene-history" id="mxosGeneHist"></div>
        </div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(root);
    const treeEl = root.querySelector('#mxosGeneTree');
    if (!trees.length) {
        treeEl.innerHTML = `<div class="mxos-gene-empty">还没有窗口被打开，族谱是空的</div>`;
    } else {
        const ul = document.createElement('ul');
        ul.className = 'mxos-gene-tree';
        ul.innerHTML = trees.map(renderTreeNode).join('');
        treeEl.innerHTML = '';
        treeEl.appendChild(ul);
        ul.querySelectorAll('.mxos-gene-toggle').forEach(t => {
            t.addEventListener('click', (e) => {
                e.stopPropagation();
                const li = t.closest('.mxos-gene-node');
                const children = li.querySelector(':scope > .mxos-gene-children');
                if (children) {
                    const hidden = children.style.display === 'none';
                    children.style.display = hidden ? '' : 'none';
                    t.classList.toggle('collapsed', !hidden);
                }
            });
        });
    }
    const histEl = root.querySelector('#mxosGeneHist');
    const hist = getHistory().slice(0, 50);
    if (!hist.length) {
        histEl.innerHTML = `<div class="mxos-gene-empty">暂无历史</div>`;
    } else {
        histEl.innerHTML = hist.map(h => {
            const cfg = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(h.appId)) || {};
            const parentCfg = h.parentId ? ((window.MXOS.getAppConfig && window.MXOS.getAppConfig(h.parentId)) || {}) : null;
            return `<div class="mxos-gene-hist-row">
                <span class="mxos-gene-hist-time">${formatTime(h.ts)}</span>
                <span><span class="mxos-gene-hist-app">${escapeHtml(cfg.title || h.appId)}</span>${parentCfg ? ` ← ${escapeHtml(parentCfg.title || h.parentId)}` : ' ← 桌面'}</span>
            </div>`;
        }).join('');
    }
}

function setupListeners() {
    window.addEventListener('mxos:window-opened', (e) => {
        const appId = e.detail && e.detail.appId;
        if (!appId) return;
        const parentId = lastOpenApp;
        recordOpen(appId, parentId);
        lastOpenApp = appId;
    });
    window.addEventListener('mxos:window-closed', (e) => {
        const appId = e.detail && e.detail.appId;
        if (appId) recordClose(appId);
        if (lastOpenApp === appId) lastOpenApp = null;
    });
    document.addEventListener('mousedown', (e) => {
        const winEl = e.target.closest('.window');
        if (!winEl) return;
        const w = state.windows.find(w => w.element === winEl);
        if (w) lastOpenApp = w.appId;
    }, true);
}

function injectTaskManagerTab() {
    const tm = document.querySelector('.task-manager-pro-app, [data-app="task-manager-pro"]');
    if (!tm) return;
    if (tm.querySelector('.mxos-gene-tab-btn')) return;
}

let refreshHandle = null;

function init() {
    injectStyles();
    setupListeners();
    window.MXOS.Features.genealogy = {
        getLiveTree, getHistory, clearHistory, renderApp, recordOpen, recordClose
    };
    refreshHandle = setInterval(injectTaskManagerTab, 10000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getLiveTree, getHistory, recordOpen, recordClose };
