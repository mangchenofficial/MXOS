window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_sticky_wall';

let panel = null;
let notes = [];

function loadFromStickyModule() {
    if (window.MXOS?.Sticky?.getAll) {
        try { return window.MXOS.Sticky.getAll() || []; } catch {}
    }
    try {
        return JSON.parse(localStorage.getItem('mxos_sticky_notes') || '[]');
    } catch { return []; }
}

function injectStyles() {
    if (document.getElementById('mxos-sticky-wall-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-sticky-wall-styles';
    style.textContent = `
#mxosStickyWallPanel {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 880px; max-width: 94vw; max-height: 86vh;
    overflow-y: auto;
    background: var(--glass-bg, rgba(20,20,22,0.85));
    backdrop-filter: blur(28px) saturate(1.4);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
    border-radius: var(--radius-lg, 16px);
    box-shadow: var(--shadow, 0 20px 60px rgba(0,0,0,0.5));
    color: var(--text-color, #fff);
    z-index: 9990;
    padding: 24px;
    display: none;
}
#mxosStickyWallPanel.show { display: block; animation: mxosStickyWallIn 0.4s var(--ease-out, ease); }
@keyframes mxosStickyWallIn {
    from { opacity: 0; transform: translate(-50%, -48%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
}
.mxos-sticky-wall-grid {
    column-count: 3;
    column-gap: 14px;
}
.mxos-sticky-wall-item {
    break-inside: avoid;
    margin-bottom: 14px;
    padding: 14px;
    border-radius: var(--radius-md, 10px);
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    font-size: 13px;
    line-height: 1.5;
    color: #1a1a1a;
    white-space: pre-wrap;
    word-break: break-word;
}
.mxos-sticky-wall-item .sw-time {
    font-size: 11px;
    opacity: 0.6;
    margin-bottom: 6px;
}
    `;
    document.head.appendChild(style);
}

function colorBg(c) {
    const m = {
        yellow: '#fef3c7',
        pink: '#fbcfe8',
        blue: '#bfdbfe',
        green: '#bbf7d0',
        purple: '#ddd6fe',
        orange: '#fed7aa',
        white: '#f9fafb'
    };
    return m[c] || m.yellow;
}

function renderWall() {
    if (!panel) return;
    notes = loadFromStickyModule();
    const grid = panel.querySelector('.mxos-sticky-wall-grid');
    if (!grid) return;
    if (!notes.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px">还没有便签，先去创建一些吧</div>';
        return;
    }
    grid.innerHTML = notes.map(n => {
        const text = (n.text || n.content || '').replace(/[<>&]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[s]));
        const time = n.updatedAt ? new Date(n.updatedAt).toLocaleString('zh-CN') : '';
        return `<div class="mxos-sticky-wall-item" style="background:${colorBg(n.color)}">
            ${time ? `<div class="sw-time">${time}</div>` : ''}
            ${text || '（空便签）'}
        </div>`;
    }).join('');
}

function buildPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'mxosStickyWallPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '便签墙');
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
            <h2 style="font-size:20px;margin:0">便签墙</h2>
            <button id="mxosStickyWallClose" style="background:rgba(255,255,255,0.08);border:1px solid var(--glass-border);color:var(--text-color);padding:6px 12px;border-radius:8px;cursor:pointer">关闭</button>
        </div>
        <div class="mxos-sticky-wall-grid"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#mxosStickyWallClose').addEventListener('click', hide);
    panel.addEventListener('click', (e) => { if (e.target === panel) hide(); });
}

function show() {
    buildPanel();
    renderWall();
    panel.classList.add('show');
}
function hide() {
    if (panel) panel.classList.remove('show');
}

function refresh() {
    if (panel && panel.classList.contains('show')) renderWall();
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-stickyWall')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.innerHTML = `
            <div class="settings-card-title">便签墙</div>
            <div class="settings-card-desc">以瀑布流方式查看所有便签</div>
            <button class="btn" id="setting-stickyWall" style="margin-top:8px">打开便签墙</button>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-stickyWall').addEventListener('click', show);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    injectStyles();
    injectSettingsIntoPanel();
    window.addEventListener('mxos:sticky-updated', refresh);
    window.MXOS.Features.stickyWall = { show, hide, refresh };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { show, hide };
