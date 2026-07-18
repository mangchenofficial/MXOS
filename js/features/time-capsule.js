import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_time_capsules';
const APP_ID = 'time-capsule';

function loadData() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return [];
}

let capsules = loadData();

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules)); } catch (e) {}
}

function bury({ title, content, image, unlockDate }) {
    if (!content || !unlockDate) return null;
    const unlockTs = new Date(unlockDate).getTime();
    if (isNaN(unlockTs)) return null;
    const cap = {
        id: 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        title: title || '时光胶囊',
        content: String(content),
        image: image || null,
        buriedAt: Date.now(),
        unlockTs: unlockTs,
        opened: false
    };
    capsules.unshift(cap);
    saveData();
    if (window.MXOS.notify) {
        const days = Math.ceil((unlockTs - Date.now()) / 86400000);
        window.MXOS.notify({
            title: '时光胶囊已埋藏',
            body: `"${cap.title}" 将在 ${days > 0 ? days + ' 天后' : '稍后'}开启`,
            type: 'success'
        });
    }
    return cap;
}

function list() {
    return capsules.map(c => {
        const remaining = c.unlockTs - Date.now();
        return Object.assign({}, c, {
            remainingMs: remaining,
            canOpen: remaining <= 0,
            remainingDays: Math.max(0, Math.ceil(remaining / 86400000))
        });
    });
}

function open(id) {
    const c = capsules.find(c => c.id === id);
    if (!c) return null;
    if (c.unlockTs > Date.now()) return { error: '尚未到期', remainingMs: c.unlockTs - Date.now() };
    c.opened = true;
    c.openedAt = Date.now();
    saveData();
    return Object.assign({}, c);
}

function remove(id) {
    const idx = capsules.findIndex(c => c.id === id);
    if (idx >= 0) {
        capsules.splice(idx, 1);
        saveData();
        return true;
    }
    return false;
}

function checkDue() {
    capsules.forEach(c => {
        if (!c.opened && !c.notified && c.unlockTs <= Date.now()) {
            c.notified = true;
            saveData();
            if (window.MXOS.notify) {
                window.MXOS.notify({
                    title: '时光胶囊到期',
                    body: `"${c.title}" 可以开启啦！`,
                    type: 'success',
                    actions: [{ label: '查看', onClick: () => { if (window.MXOS.openApp) window.MXOS.openApp('time-capsule'); } }]
                });
            }
        }
    });
}

function formatDate(ts) {
    try {
        return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '未知'; }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function capsuleSvg(opened, locked) {
    const color = opened ? '#fbbf24' : locked ? '#6b7280' : '#a78bfa';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="8" width="16" height="12" rx="6"/>
        <line x1="12" y1="3" x2="12" y2="8"/>
        <circle cx="12" cy="3" r="1.5" fill="${color}"/>
        ${locked ? '<rect x="9" y="12" width="6" height="5" rx="1" fill="none"/><path d="M10 12v-1a2 2 0 0 1 4 0v1"/>' : ''}
        ${opened ? '<path d="M9 14l2 2 4-4"/>' : ''}
    </svg>`;
}

function injectStyles() {
    if (document.getElementById('mxos-tc-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-tc-styles';
    style.textContent = `
.mxos-tc-app{padding:24px;color:#e5e7eb;height:100%;overflow:auto;background:rgba(10,10,11,0.6)}
.mxos-tc-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.mxos-tc-title{font-size:22px;font-weight:700;margin:0}
.mxos-tc-sub{font-size:13px;color:#9ca3af;margin-top:4px}
.mxos-tc-btn{background:linear-gradient(135deg,#a855f7,#c084fc);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:transform 0.15s}
.mxos-tc-btn:hover{transform:scale(1.04)}
.mxos-tc-list{display:flex;flex-direction:column;gap:12px}
.mxos-tc-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;display:flex;gap:14px;backdrop-filter:blur(40px) saturate(200%);-webkit-backdrop-filter:blur(40px) saturate(200%);transition:all 0.2s}
.mxos-tc-card:hover{border-color:rgba(168,85,247,0.4)}
.mxos-tc-card.opened{border-color:rgba(251,191,36,0.3);background:linear-gradient(160deg,rgba(251,191,36,0.08),rgba(255,255,255,0.03))}
.mxos-tc-icon{width:40px;height:40px;flex-shrink:0}
.mxos-tc-info{flex:1;min-width:0}
.mxos-tc-name{font-size:14px;font-weight:600;margin-bottom:4px}
.mxos-tc-meta{font-size:11px;color:#9ca3af;margin-bottom:6px}
.mxos-tc-preview{font-size:12px;color:#6b7280;font-style:italic}
.mxos-tc-content{font-size:13px;color:#d1d5db;line-height:1.6;margin-top:8px;white-space:pre-wrap}
.mxos-tc-img{max-width:200px;max-height:160px;border-radius:8px;margin-top:8px;display:block}
.mxos-tc-actions{display:flex;gap:8px;margin-top:8px}
.mxos-tc-mini-btn{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#d1d5db;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer}
.mxos-tc-mini-btn:hover{background:rgba(168,85,247,0.15);border-color:rgba(168,85,247,0.4);color:#c084fc}
.mxos-tc-mini-btn.danger:hover{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171}
.mxos-tc-form{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;margin-bottom:20px}
.mxos-tc-form h3{margin:0 0 12px;font-size:15px;color:#a78bfa}
.mxos-tc-field{margin-bottom:12px}
.mxos-tc-field label{display:block;font-size:11px;color:#9ca3af;margin-bottom:4px}
.mxos-tc-field input,.mxos-tc-field textarea{width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#e5e7eb;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box}
.mxos-tc-field input:focus,.mxos-tc-field textarea:focus{border-color:#a855f7}
.mxos-tc-empty{text-align:center;padding:40px 20px;color:#6b7280}
    `;
    document.head.appendChild(style);
}

function renderApp(contentEl) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'mxos-tc-app';
    root.innerHTML = `
        <div class="mxos-tc-header">
            <div>
                <div class="mxos-tc-title">时光胶囊</div>
                <div class="mxos-tc-sub">埋下今日的留言，给未来的自己</div>
            </div>
            <button class="mxos-tc-btn" id="mxosTcNew">埋新胶囊</button>
        </div>
        <div id="mxosTcForm" style="display:none"></div>
        <div id="mxosTcList"></div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(root);
    renderList(contentEl);
    root.querySelector('#mxosTcNew').addEventListener('click', () => {
        const form = root.querySelector('#mxosTcForm');
        if (form.style.display === 'none') showForm(contentEl); else form.style.display = 'none';
    });
}

function showForm(contentEl) {
    const form = contentEl.querySelector('#mxosTcForm');
    if (!form) return;
    const def = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    form.style.display = 'block';
    form.innerHTML = `
        <h3>埋藏新的时光胶囊</h3>
        <div class="mxos-tc-field">
            <label>标题</label>
            <input type="text" id="mxosTcTitle" placeholder="给未来的自己一句话" maxlength="50">
        </div>
        <div class="mxos-tc-field">
            <label>内容</label>
            <textarea id="mxosTcContent" rows="5" placeholder="写下你想对未来自己说的话……" maxlength="2000"></textarea>
        </div>
        <div class="mxos-tc-field">
            <label>解锁日期</label>
            <input type="date" id="mxosTcDate" value="${def}">
        </div>
        <div style="display:flex;gap:8px">
            <button class="mxos-tc-btn" id="mxosTcBury">埋藏</button>
            <button class="mxos-tc-mini-btn" id="mxosTcCancel">取消</button>
        </div>
    `;
    form.querySelector('#mxosTcBury').addEventListener('click', () => {
        const title = form.querySelector('#mxosTcTitle').value.trim();
        const content = form.querySelector('#mxosTcContent').value.trim();
        const date = form.querySelector('#mxosTcDate').value;
        if (!content) { if (window.MXOS.dialog && window.MXOS.dialog.toast) window.MXOS.dialog.toast('请填写胶囊内容', 'warning'); return; }
        if (!date) { if (window.MXOS.dialog && window.MXOS.dialog.toast) window.MXOS.dialog.toast('请选择解锁日期', 'warning'); return; }
        bury({ title, content, unlockDate: date });
        form.style.display = 'none';
        renderList(contentEl);
    });
    form.querySelector('#mxosTcCancel').addEventListener('click', () => { form.style.display = 'none'; });
}

function renderList(contentEl) {
    const listEl = contentEl.querySelector('#mxosTcList');
    if (!listEl) return;
    const items = list();
    if (!items.length) {
        listEl.innerHTML = `<div class="mxos-tc-empty">还没有时光胶囊，点击"埋新胶囊"给未来留言吧</div>`;
        return;
    }
    listEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'mxos-tc-list';
    items.forEach(c => {
        const card = document.createElement('div');
        card.className = 'mxos-tc-card' + (c.opened ? ' opened' : '');
        const locked = !c.opened && c.remainingMs > 0;
        card.innerHTML = `
            <div class="mxos-tc-icon">${capsuleSvg(c.opened, locked)}</div>
            <div class="mxos-tc-info">
                <div class="mxos-tc-name">${escapeHtml(c.title)}</div>
                <div class="mxos-tc-meta">埋于 ${formatDate(c.buriedAt)} · ${c.opened ? '已开启' : (locked ? c.remainingDays + ' 天后开启' : '可开启')}</div>
                ${c.opened ? `<div class="mxos-tc-content">${escapeHtml(c.content)}</div>${c.image ? `<img class="mxos-tc-img" src="${c.image}">` : ''}` : `<div class="mxos-tc-preview">${locked ? '内容尚未到期，无法查看' : '胶囊已到期，可以开启'}</div>`}
                <div class="mxos-tc-actions">
                    ${!c.opened && !locked ? `<button class="mxos-tc-mini-btn" data-act="open">开启</button>` : ''}
                    <button class="mxos-tc-mini-btn danger" data-act="del">删除</button>
                </div>
            </div>
        `;
        const openBtn = card.querySelector('[data-act="open"]');
        if (openBtn) openBtn.addEventListener('click', () => {
            open(c.id);
            renderList(contentEl);
        });
        card.querySelector('[data-act="del"]').addEventListener('click', () => {
            remove(c.id);
            renderList(contentEl);
        });
        wrap.appendChild(card);
    });
    listEl.appendChild(wrap);
}

function registerApp() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: '时光胶囊', icon: 'installer', width: 720, height: 600, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(registerApp, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-installer"/></svg><span>时光胶囊</span>`;
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    setInterval(checkDue, 60000);
    setTimeout(checkDue, 5000);
    window.MXOS.Features.timeCapsule = { bury, list, open, remove, renderApp };
    setTimeout(registerApp, 2400);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { bury, list, open, remove };
