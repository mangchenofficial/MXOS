import { state } from '../state.js';
import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_graveyard_data';
const APP_ID = 'app-graveyard';

const LAST_WORDS = [
    '感谢你曾经的陪伴',
    '我曾努力过……',
    '再见，我的老朋友',
    '请记得我',
    '是时候说再见了',
    '愿天堂没有 bug',
    '我尽力了，真的',
    '不要为我哭泣',
    '我曾闪耀过',
    '把我的位置让给新人吧'
];

function loadData() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return [];
}

let graves = loadData();

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(graves)); } catch (e) {}
}

function bury(appId, appInfo) {
    const info = appInfo || {};
    const useMs = (window.MXOS.Features && window.MXOS.Features.evolution && window.MXOS.Features.evolution.getUseMs(appId)) || 0;
    const grave = {
        id: appId + '_' + Date.now(),
        appId: appId,
        name: info.name || info.title || appId,
        version: info.version || '1.0',
        icon: info.icon || null,
        installedAt: info.installedAt || null,
        buriedAt: new Date().toISOString(),
        useMs: useMs,
        lastWord: LAST_WORDS[Math.floor(Math.random() * LAST_WORDS.length)],
        epitaph: generateEpitaph(useMs),
        tributes: 0
    };
    graves.unshift(grave);
    if (graves.length > 50) graves.length = 50;
    saveData();
    if (window.MXOS.notify) {
        window.MXOS.notify({
            title: '应用墓园 · 新墓碑',
            body: `${grave.name} 已入土为安。${grave.lastWord}`,
            type: 'info'
        });
    }
    window.dispatchEvent(new CustomEvent('mxos:grave-buried', { detail: grave }));
    return grave;
}

function generateEpitaph(useMs) {
    const minutes = Math.round(useMs / 60000);
    if (minutes < 1) return '匆匆一瞥，便已离去';
    if (minutes < 60) return `陪伴了 ${minutes} 分钟，短暂却真诚`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `共度 ${hours} 小时，留下不少回忆`;
    const days = Math.round(hours / 24);
    return `携手 ${days} 天，情谊深厚`;
}

function list() {
    return graves.slice();
}

function visit(id) {
    const g = graves.find(g => g.id === id);
    if (!g) return null;
    g.tributes = (g.tributes || 0) + 1;
    g.lastTribute = new Date().toISOString();
    saveData();
    spawnTributeParticles();
    return g;
}

function remove(id) {
    const idx = graves.findIndex(g => g.id === id);
    if (idx >= 0) {
        graves.splice(idx, 1);
        saveData();
        return true;
    }
    return false;
}

function spawnTributeParticles() {
    const host = document.createElement('canvas');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
    host.width = window.innerWidth;
    host.height = window.innerHeight;
    document.body.appendChild(host);
    const ctx = host.getContext('2d');
    const petals = [];
    const colors = ['#f9a8d4', '#fbcfe8', '#fda4af', '#fecaca', '#fef3c7'];
    for (let i = 0; i < 40; i++) {
        petals.push({
            x: Math.random() * host.width,
            y: -20 - Math.random() * 200,
            vx: -0.5 + Math.random(),
            vy: 1 + Math.random() * 2,
            size: 4 + Math.random() * 6,
            color: colors[i % colors.length],
            rot: Math.random() * Math.PI * 2,
            vrot: -0.05 + Math.random() * 0.1,
            life: 1
        });
    }
    let raf;
    function frame() {
        ctx.clearRect(0, 0, host.width, host.height);
        let alive = false;
        petals.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx += Math.sin(p.y * 0.02) * 0.05;
            p.rot += p.vrot;
            if (p.y > host.height + 20) { p.life = 0; return; }
            alive = true;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 1.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        if (alive) raf = requestAnimationFrame(frame);
        else { cancelAnimationFrame(raf); host.remove(); }
    }
    raf = requestAnimationFrame(frame);
}

function tombstoneSvg(name) {
    return `<svg viewBox="0 0 80 90" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 40 Q16 14 40 14 Q64 14 64 40 L64 80 L16 80 Z"/>
        <rect x="24" y="34" width="32" height="2" stroke="rgba(255,255,255,0.4)"/>
        <text x="40" y="56" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.7)" stroke="none" font-family="sans-serif" font-weight="600">${escapeHtmlShort(name || 'App').slice(0, 6)}</text>
        <path d="M32 64 L48 64 M34 70 L46 70" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
    </svg>`;
}

function escapeHtmlShort(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(iso) {
    if (!iso) return '未知';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return '未知'; }
}

function formatDuration(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return '不足 1 分钟';
    if (m < 60) return m + ' 分钟';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' 小时';
    return Math.round(h / 24) + ' 天';
}

function injectStyles() {
    if (document.getElementById('mxos-graveyard-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-graveyard-styles';
    style.textContent = `
.mxos-grave-app{padding:24px;color:#d1d5db;height:100%;overflow:auto;background:linear-gradient(180deg,rgba(10,10,11,0.7),rgba(20,15,20,0.7))}
.mxos-grave-header{margin-bottom:20px;text-align:center}
.mxos-grave-title{font-size:22px;font-weight:700;margin:0 0 4px;color:#e5e7eb}
.mxos-grave-sub{font-size:13px;color:#6b7280}
.mxos-grave-empty{text-align:center;padding:60px 20px;color:#6b7280}
.mxos-grave-empty svg{width:64px;height:64px;margin:0 auto 12px;opacity:0.4}
.mxos-grave-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.mxos-grave-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px;display:flex;gap:12px;backdrop-filter:blur(40px) saturate(200%);-webkit-backdrop-filter:blur(40px) saturate(200%);transition:transform 0.2s,border-color 0.2s}
.mxos-grave-card:hover{transform:translateY(-2px);border-color:rgba(156,163,175,0.3)}
.mxos-grave-icon{width:64px;height:72px;flex-shrink:0}
.mxos-grave-info{flex:1;min-width:0}
.mxos-grave-name{font-size:14px;font-weight:600;color:#e5e7eb;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mxos-grave-meta{font-size:11px;color:#6b7280;margin-bottom:6px}
.mxos-grave-epitaph{font-size:12px;color:#9ca3af;font-style:italic;line-height:1.5;margin-bottom:8px}
.mxos-grave-lastword{font-size:11px;color:#a78bfa;font-style:italic;margin-bottom:8px}
.mxos-grave-actions{display:flex;gap:8px}
.mxos-grave-btn{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#d1d5db;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all 0.15s}
.mxos-grave-btn:hover{background:rgba(251,191,36,0.15);border-color:rgba(251,191,36,0.4);color:#fbbf24}
.mxos-grave-btn.del:hover{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171}
    `;
    document.head.appendChild(style);
}

function renderApp(contentEl) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'mxos-grave-app';
    root.innerHTML = `
        <div class="mxos-grave-header">
            <div class="mxos-grave-title">应用墓园</div>
            <div class="mxos-grave-sub">在此缅怀曾陪伴过你的应用 · 共 ${graves.length} 座</div>
        </div>
        <div id="mxosGraveList"></div>
    `;
    contentEl.appendChild(root);
    const list = root.querySelector('#mxosGraveList');
    if (!graves.length) {
        list.innerHTML = `<div class="mxos-grave-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 6h18M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6M9 10v6M15 10v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            <div>墓园还很安静，没有应用长眠于此</div>
        </div>`;
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'mxos-grave-list';
    graves.forEach(g => {
        const card = document.createElement('div');
        card.className = 'mxos-grave-card';
        card.innerHTML = `
            <div class="mxos-grave-icon">${tombstoneSvg(g.name)}</div>
            <div class="mxos-grave-info">
                <div class="mxos-grave-name" title="${escapeHtmlShort(g.name)}">${escapeHtmlShort(g.name)} <span style="color:#6b7280;font-weight:400">v${escapeHtmlShort(g.version || '1.0')}</span></div>
                <div class="mxos-grave-meta">入土：${formatDate(g.buriedAt)} · 陪伴：${formatDuration(g.useMs)}</div>
                <div class="mxos-grave-epitaph">${escapeHtmlShort(g.epitaph)}</div>
                <div class="mxos-grave-lastword">"${escapeHtmlShort(g.lastWord)}"</div>
                <div class="mxos-grave-actions">
                    <button class="mxos-grave-btn" data-act="tribute">祭奠 (${g.tributes || 0})</button>
                    <button class="mxos-grave-btn del" data-act="del">迁坟</button>
                </div>
            </div>
        `;
        card.querySelector('[data-act="tribute"]').addEventListener('click', () => {
            visit(g.id);
            card.querySelector('[data-act="tribute"]').textContent = `祭奠 (${g.tributes || 0})`;
        });
        card.querySelector('[data-act="del"]').addEventListener('click', () => {
            if (window.MXOS.dialog && window.MXOS.dialog.confirm) {
                window.MXOS.dialog.confirm('迁坟', `确定将 ${g.name} 的墓碑迁出墓园吗？`);
            }
            remove(g.id);
            card.style.transition = 'opacity 0.2s';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 200);
        });
        grid.appendChild(card);
    });
    list.appendChild(grid);
}

let lastAppIds = [];

function watchUninstalls() {
    try {
        const current = state.installedApps.map(a => a.id);
        const removed = lastAppIds.filter(id => !current.includes(id));
        removed.forEach(id => {
            if (graves.find(g => g.appId === id && Date.now() - new Date(g.buriedAt).getTime() < 60000)) return;
            const info = lastAppSnapshots[id];
            if (info) bury(id, info);
        });
        lastAppIds = current;
        state.installedApps.forEach(a => {
            lastAppSnapshots[a.id] = a;
        });
    } catch (e) {}
}

const lastAppSnapshots = {};

function registerApp() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: '应用墓园', icon: 'recycle-bin', width: 820, height: 600, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(registerApp, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-recycle-bin"/></svg><span>应用墓园</span>`;
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    lastAppIds = state.installedApps.map(a => a.id);
    state.installedApps.forEach(a => { lastAppSnapshots[a.id] = a; });
    setInterval(watchUninstalls, 2000);
    window.MXOS.Features.graveyard = { bury, list, visit, remove, renderApp };
    setTimeout(registerApp, 1800);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { bury, list, visit, remove };
