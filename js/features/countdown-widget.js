window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_countdowns';

let items = [];
let widgetEl = null;
let timer = null;

function load() {
    try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { items = []; }
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

function injectStyles() {
    if (document.getElementById('mxos-countdown-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-countdown-styles';
    style.textContent = `
#mxosCountdownWidget {
    position: fixed;
    bottom: 60px; right: 16px;
    width: 220px;
    background: var(--glass-bg, rgba(20,20,22,0.8));
    backdrop-filter: blur(22px) saturate(1.4);
    border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
    border-radius: var(--radius-lg, 14px);
    box-shadow: var(--shadow, 0 8px 24px rgba(0,0,0,0.4));
    color: var(--text-color, #fff);
    z-index: 9500;
    padding: 12px;
    display: none;
    flex-direction: column;
    gap: 8px;
    pointer-events: auto;
}
#mxosCountdownWidget.show { display: flex; }
.mxos-cd-item {
    display: flex; align-items: center; gap: 10px;
    padding: 6px;
    border-radius: 8px;
}
.mxos-cd-item:hover { background: rgba(255,255,255,0.05); }
.mxos-cd-ring {
    width: 36px; height: 36px;
    flex-shrink: 0;
}
.mxos-cd-info { flex: 1; min-width: 0; }
.mxos-cd-days {
    font-size: 18px; font-weight: 700;
    line-height: 1;
}
.mxos-cd-label {
    font-size: 11px; color: var(--text-secondary, #aaa);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mxos-cd-close {
    background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0 4px;
}
.mxos-cd-add {
    margin-top: 4px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--glass-border);
    color: var(--text-color);
    padding: 6px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
}
    `;
    document.head.appendChild(style);
}

function daysBetween(target, now) {
    const ms = new Date(target).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
    return Math.round(ms / 86400000);
}

function renderWidget() {
    if (!widgetEl) return;
    if (!items.length) {
        widgetEl.innerHTML = `
            <div style="font-size:13px;text-align:center;padding:8px;color:var(--text-secondary)">还没有倒计时</div>
            <button class="mxos-cd-add" id="mxosCdAdd">添加倒计时</button>
        `;
    } else {
        const now = new Date();
        widgetEl.innerHTML = items.map((it, i) => {
            const days = daysBetween(it.date, now);
            const progress = Math.max(0, Math.min(1, 1 - Math.abs(days) / 365));
            const circ = 2 * Math.PI * 14;
            const offset = circ * (1 - progress);
            const label = days > 0 ? `还有 ${days} 天` : days === 0 ? '就是今天' : `已过 ${-days} 天`;
            return `<div class="mxos-cd-item" data-idx="${i}">
                <svg class="mxos-cd-ring" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="var(--accent, #a78bfa)" stroke-width="3"
                        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
                        transform="rotate(-90 18 18)" stroke-linecap="round" />
                </svg>
                <div class="mxos-cd-info">
                    <div class="mxos-cd-days">${Math.abs(days)}</div>
                    <div class="mxos-cd-label">${escapeHtml(it.title)} · ${label}</div>
                </div>
                <button class="mxos-cd-close" data-del="${i}" aria-label="删除">
                    <svg width="14" height="14" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>
                </button>
            </div>`;
        }).join('') + `<button class="mxos-cd-add" id="mxosCdAdd">添加倒计时</button>`;
    }
    widgetEl.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = Number(btn.getAttribute('data-del'));
            items.splice(idx, 1);
            save();
            renderWidget();
        });
    });
    const addBtn = widgetEl.querySelector('#mxosCdAdd');
    if (addBtn) addBtn.addEventListener('click', promptAdd);
}

function escapeHtml(s) {
    return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

function promptAdd() {
    const title = window.prompt('倒计时标题：', '生日');
    if (!title) return;
    const dateStr = window.prompt('目标日期（YYYY-MM-DD）：', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('日期格式无效', 'error');
        return;
    }
    items.push({ title, date: dateStr });
    save();
    renderWidget();
}

function add(title, date) {
    items.push({ title, date });
    save();
    if (widgetEl) renderWidget();
}

function remove(idx) {
    items.splice(idx, 1);
    save();
    if (widgetEl) renderWidget();
}

function list() {
    return items.map(it => ({ ...it, days: daysBetween(it.date, new Date()) }));
}

function buildWidget() {
    if (widgetEl) return;
    widgetEl = document.createElement('div');
    widgetEl.id = 'mxosCountdownWidget';
    widgetEl.setAttribute('aria-label', '倒计时小工具');
    document.body.appendChild(widgetEl);
    renderWidget();
}

function show() {
    buildWidget();
    widgetEl.classList.add('show');
    renderWidget();
}
function hide() {
    if (widgetEl) widgetEl.classList.remove('show');
}

function init() {
    load();
    injectStyles();
    if (items.length) {
        buildWidget();
        widgetEl.classList.add('show');
    }
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        if (widgetEl && widgetEl.classList.contains('show')) renderWidget();
    }, 60_000);
    window.MXOS.Features.countdown = { add, remove, list, show, hide };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { add, remove, list, show, hide };
