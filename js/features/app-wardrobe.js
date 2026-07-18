import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_app_wardrobe';
const APP_ID = 'app-wardrobe';

const SKINS = {
    default: {
        name: '默认',
        desc: 'MXOS 原生风格',
        vars: {}
    },
    midnight: {
        name: '暗夜',
        desc: '深邃黑色，强调对比',
        vars: {
            '--app-bg': '#08080a',
            '--app-fg': '#e5e7eb',
            '--app-accent': '#a855f7',
            '--app-border': 'rgba(168,85,247,0.2)',
            '--app-card': 'rgba(168,85,247,0.06)'
        }
    },
    retro: {
        name: '复古',
        desc: '暖色调，怀旧氛围',
        vars: {
            '--app-bg': '#1f1410',
            '--app-fg': '#f5e6d3',
            '--app-accent': '#d97706',
            '--app-border': 'rgba(217,119,6,0.25)',
            '--app-card': 'rgba(217,119,6,0.08)'
        }
    },
    cyber: {
        name: '赛博',
        desc: '霓虹光感，未来主义',
        vars: {
            '--app-bg': '#0a0f1f',
            '--app-fg': '#22d3ee',
            '--app-accent': '#22d3ee',
            '--app-border': 'rgba(34,211,238,0.3)',
            '--app-card': 'rgba(34,211,238,0.05)'
        }
    },
    minimal: {
        name: '极简',
        desc: '低对比，灰阶主导',
        vars: {
            '--app-bg': '#1a1a1c',
            '--app-fg': '#d4d4d8',
            '--app-accent': '#a1a1aa',
            '--app-border': 'rgba(255,255,255,0.08)',
            '--app-card': 'rgba(255,255,255,0.03)'
        }
    }
};

const APP_SKINS = {
    'notepad': ['default', 'midnight', 'retro', 'minimal'],
    'calculator': ['default', 'cyber', 'retro', 'minimal'],
    'terminal': ['default', 'cyber', 'midnight'],
    'music': ['default', 'retro', 'cyber', 'minimal'],
    'clock': ['default', 'midnight', 'minimal'],
    'calendar': ['default', 'retro', 'minimal'],
    'browser': ['default', 'cyber', 'midnight'],
    'settings': ['default', 'midnight', 'minimal']
};

function loadData() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {}
    return {};
}

let wardrobe = loadData();

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wardrobe)); } catch (e) {}
}

function getSkin(appId) {
    return wardrobe[appId] || 'default';
}

function setSkin(appId, skinId) {
    if (!SKINS[skinId]) return false;
    wardrobe[appId] = skinId;
    saveData();
    applySkin(appId);
    if (window.MXOS.dialog && window.MXOS.dialog.toast) {
        window.MXOS.dialog.toast(`${appId} 已切换为「${SKINS[skinId].name}」皮肤`, 'success');
    }
    window.dispatchEvent(new CustomEvent('mxos:wardrobe-change', { detail: { appId, skinId } }));
    return true;
}

function applySkin(appId) {
    const skinId = getSkin(appId);
    const skin = SKINS[skinId];
    if (!skin) return;
    const win = document.querySelector(`.window[data-app-id="${appId}"], [data-app="${appId}"]`);
    if (!win) return;
    const content = win.querySelector('.window-content') || win;
    Object.keys(SKINS.default.vars).forEach(k => {
        content.style.removeProperty(k);
    });
    Object.keys(skin.vars).forEach(k => {
        content.style.setProperty(k, skin.vars[k]);
    });
    content.classList.add('mxos-wardrobe-styled');
}

function applyAll() {
    Object.keys(wardrobe).forEach(appId => applySkin(appId));
}

function getAppSkins(appId) {
    const list = APP_SKINS[appId] || ['default', 'midnight', 'minimal'];
    return list.map(id => ({ id, name: SKINS[id].name, desc: SKINS[id].desc, active: getSkin(appId) === id }));
}

function getAllSkins() {
    return Object.keys(SKINS).map(id => ({ id, name: SKINS[id].name, desc: SKINS[id].desc }));
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectStyles() {
    if (document.getElementById('mxos-wardrobe-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-wardrobe-styles';
    style.textContent = `
.mxos-wardrobe-app{padding:24px;color:#e5e7eb;height:100%;overflow:auto;background:rgba(10,10,11,0.6)}
.mxos-wardrobe-header{margin-bottom:20px}
.mxos-wardrobe-title{font-size:22px;font-weight:700;margin:0 0 4px}
.mxos-wardrobe-sub{font-size:13px;color:#9ca3af}
.mxos-wardrobe-apps{display:flex;flex-direction:column;gap:20px}
.mxos-wardrobe-app-section h3{font-size:14px;font-weight:600;margin:0 0 10px;color:#fbbf24}
.mxos-wardrobe-skins{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.mxos-wardrobe-skin-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;cursor:pointer;transition:all 0.2s;text-align:center}
.mxos-wardrobe-skin-card:hover{transform:translateY(-2px);border-color:rgba(251,191,36,0.4)}
.mxos-wardrobe-skin-card.active{background:linear-gradient(160deg,rgba(251,191,36,0.12),rgba(255,255,255,0.04));border-color:rgba(251,191,36,0.5)}
.mxos-wardrobe-skin-preview{width:60px;height:60px;border-radius:10px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;border:2px solid}
.mxos-wardrobe-skin-name{font-size:13px;font-weight:600;margin-bottom:2px}
.mxos-wardrobe-skin-desc{font-size:11px;color:#9ca3af;line-height:1.4}
.mxos-wardrobe-skin-check{width:18px;height:18px;border-radius:50%;background:#fbbf24;color:#1a1a1a;display:none;align-items:center;justify-content:center;margin:6px auto 0;font-size:11px}
.mxos-wardrobe-skin-card.active .mxos-wardrobe-skin-check{display:flex}
    `;
    document.head.appendChild(style);
}

function skinPreviewStyle(skinId) {
    const skin = SKINS[skinId];
    return `background:${skin.vars['--app-bg'] || '#1a1a1c'};color:${skin.vars['--app-fg'] || '#e5e7eb'};border-color:${skin.vars['--app-accent'] || '#fbbf24'}`;
}

function renderApp(contentEl) {
    injectStyles();
    const root = document.createElement('div');
    root.className = 'mxos-wardrobe-app';
    const apps = Object.keys(APP_SKINS);
    root.innerHTML = `
        <div class="mxos-wardrobe-header">
            <div class="mxos-wardrobe-title">应用化妆间</div>
            <div class="mxos-wardrobe-sub">为每个内置应用挑选专属皮肤 · 通过 CSS 变量切换</div>
        </div>
        <div class="mxos-wardrobe-apps" id="mxosWardrobeApps"></div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(root);
    const appsEl = root.querySelector('#mxosWardrobeApps');
    apps.forEach(appId => {
        const cfg = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(appId)) || {};
        const sec = document.createElement('div');
        sec.className = 'mxos-wardrobe-app-section';
        const skins = getAppSkins(appId);
        sec.innerHTML = `<h3>${escapeHtml(cfg.title || appId)}</h3><div class="mxos-wardrobe-skins"></div>`;
        const grid = sec.querySelector('.mxos-wardrobe-skins');
        skins.forEach(s => {
            const card = document.createElement('div');
            card.className = 'mxos-wardrobe-skin-card' + (s.active ? ' active' : '');
            card.innerHTML = `
                <div class="mxos-wardrobe-skin-preview" style="${skinPreviewStyle(s.id)}">${escapeHtml(s.name[0])}</div>
                <div class="mxos-wardrobe-skin-name">${escapeHtml(s.name)}</div>
                <div class="mxos-wardrobe-skin-desc">${escapeHtml(s.desc)}</div>
                <div class="mxos-wardrobe-skin-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12l5 5 9-11"/></svg></div>
            `;
            card.addEventListener('click', () => {
                setSkin(appId, s.id);
                grid.querySelectorAll('.mxos-wardrobe-skin-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
            grid.appendChild(card);
        });
        appsEl.appendChild(sec);
    });
}

function setupListeners() {
    window.addEventListener('mxos:window-opened', (e) => {
        const appId = e.detail && e.detail.appId;
        if (appId && wardrobe[appId]) {
            setTimeout(() => applySkin(appId), 300);
        }
    });
}

function registerApp() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: '应用化妆间', icon: 'settings', width: 760, height: 620, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(registerApp, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-settings"/></svg><span>应用化妆间</span>`;
    entry.addEventListener('click', () => {
        if (window.MXOS.openApp) window.MXOS.openApp(APP_ID);
    });
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    setupListeners();
    setTimeout(applyAll, 2000);
    window.MXOS.Features.wardrobe = {
        getSkin, setSkin, applySkin, applyAll,
        getAppSkins, getAllSkins, renderApp
    };
    setTimeout(registerApp, 2600);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getSkin, setSkin, applySkin, getAppSkins, getAllSkins };
