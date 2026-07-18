import { state, appConfigs, iconSvg } from '../state.js';

window.MXOS = window.MXOS || {};

const ICONS = {
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
    setting: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="14" y1="18" x2="16" y2="18"/></svg>',
    translate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h7"/><path d="M9 3v2c0 4.418-2.239 8-5 8"/><path d="M5 9c0 2.144 2.952 3.908 6.7 4"/><path d="M12 20l4-9 4 9"/><path d="M19.1 18h-6.2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    enter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>'
};

let rootEl = null;
let inputEl = null;
let listEl = null;
let hintEl = null;
let isOpen = false;
let results = [];
let selectedIndex = 0;
let activeCategory = 'all';

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function tryEval(expr) {
    if (!/^[-+*/().%\d\s]+$/.test(expr)) return null;
    if (!/[-+*/%]/.test(expr)) return null;
    try {
        const result = Function('"use strict";return (' + expr + ')')();
        if (typeof result === 'number' && isFinite(result)) {
            return result;
        }
    } catch (e) {}
    return null;
}

function buildApps() {
    const items = [];
    Object.keys(appConfigs).forEach(id => {
        const cfg = appConfigs[id];
        if (!cfg || cfg.hidden) return;
        items.push({
            id: 'app:' + id,
            title: cfg.title,
            subtitle: '打开应用',
            category: '应用',
            icon: 'app',
            iconSvg: iconSvg(cfg.icon, 16),
            keywords: [cfg.title, id, '应用'],
            action: () => {
                import('../core.js').then(core => {
                    if (typeof core.createWindow === 'function') core.createWindow(id);
                });
            }
        });
    });
    state.installedApps.forEach(app => {
        if (app.appBin) {
            items.push({
                id: 'app:' + app.id,
                title: app.name,
                subtitle: '打开应用',
                category: '应用',
                icon: 'app',
                iconSvg: '<svg width="16" height="16" viewBox="0 0 40 40"><use href="#svg-' + (app.icon || 'app-default') + '"/></svg>',
                keywords: [app.name, app.id, '应用'],
                action: () => {
                    import('../core.js').then(core => {
                        if (typeof core.launchThirdPartyApp === 'function') core.launchThirdPartyApp(app);
                    });
                }
            });
        }
    });
    return items;
}

function buildSettings() {
    const settings = [
        { id: 'settings:personalization', title: '个性化设置', action: () => openSettingsTab('personalization') },
        { id: 'settings:display', title: '显示设置', action: () => openSettingsTab('display') },
        { id: 'settings:app', title: '应用管理', action: () => openSettingsTab('app') },
        { id: 'settings:account', title: '账户设置', action: () => openSettingsTab('account') },
        { id: 'settings:accessibility', title: '辅助功能', action: () => openSettingsTab('accessibility') },
        { id: 'settings:network', title: '网络和 Internet', action: () => openSettingsTab('network') },
        { id: 'settings:time', title: '时间和语言', action: () => openSettingsTab('time') },
        { id: 'settings:update', title: '更新和安全', action: () => openSettingsTab('update') },
        { id: 'settings:privacy', title: '隐私', action: () => openSettingsTab('privacy') }
    ];
    return settings.map(s => ({
        id: s.id,
        title: s.title,
        subtitle: '系统设置',
        category: '设置',
        icon: 'setting',
        iconSvg: '<svg width="16" height="16" viewBox="0 0 40 40"><use href="#svg-settings"/></svg>',
        keywords: [s.title, '设置'],
        action: s.action
    }));
}

function openSettingsTab(tab) {
    import('../core.js').then(core => {
        if (typeof core.createWindow === 'function') {
            core.createWindow('settings');
            setTimeout(() => {
                const evt = new CustomEvent('mxos:settings-navigate', { detail: { tab } });
                window.dispatchEvent(evt);
            }, 400);
        }
    });
}

function buildFiles() {
    const files = [];
    try {
        const all = JSON.parse(localStorage.getItem('mxos_vfs') || '{}');
        const collect = (node, path) => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'file') {
                files.push({
                    id: 'file:' + path,
                    title: node.name || path.split('/').pop(),
                    subtitle: path,
                    category: '文件',
                    icon: 'file',
                    iconSvg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
                    keywords: [node.name || path, path, '文件'],
                    action: () => {
                        import('../core.js').then(core => {
                            if (typeof core.createWindow === 'function') core.createWindow('this-pc');
                        });
                    }
                });
            } else if (node.type === 'directory' && node.children) {
                Object.keys(node.children).forEach(k => collect(node.children[k], path + '/' + k));
            }
        };
        Object.keys(all).forEach(k => collect(all[k], k));
    } catch (e) {}
    return files;
}

function buildActions() {
    const actions = [];
    const sel = window.getSelection ? window.getSelection().toString().trim() : '';
    if (sel) {
        actions.push({
            id: 'action:translate',
            title: '翻译选中文字',
            subtitle: sel.length > 30 ? sel.slice(0, 30) + '…' : sel,
            category: '快捷动作',
            icon: 'translate',
            iconSvg: ICONS.translate,
            keywords: ['翻译', 'translate', '选中'],
            action: () => {
                if (window.MXOS?.Translate?.translate) {
                    window.MXOS.Translate.translate(sel);
                }
            }
        });
        actions.push({
            id: 'action:search',
            title: '在网页搜索选中文字',
            subtitle: sel.length > 30 ? sel.slice(0, 30) + '…' : sel,
            category: '快捷动作',
            icon: 'search',
            iconSvg: ICONS.search,
            keywords: ['搜索', '网页', 'search'],
            action: () => {
                window.open('https://www.bing.com/search?q=' + encodeURIComponent(sel), '_blank');
            }
        });
    }
    return actions;
}

function buildAll() {
    const items = [];
    items.push(...buildApps());
    items.push(...buildSettings());
    items.push(...buildFiles());
    items.push(...buildActions());
    return items;
}

function fuzzyMatch(query, target) {
    if (!query) return { score: 1, matched: true };
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t.includes(q)) return { score: 100 - t.indexOf(q), matched: true };
    let qi = 0, score = 0, last = -1;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
            score += (last === ti - 1) ? 10 : 1;
            last = ti;
            qi++;
        }
    }
    if (qi === q.length) return { score, matched: true };
    return { score: 0, matched: false };
}

function search(query) {
    const items = buildAll();
    if (!query || !query.trim()) return items.slice(0, 50);
    const q = query.trim();
    const scored = [];
    items.forEach(item => {
        let best = fuzzyMatch(q, item.title || '');
        if (item.keywords) {
            item.keywords.forEach(k => {
                const r = fuzzyMatch(q, k);
                if (r.matched && r.score > best.score) best = r;
            });
        }
        if (best.matched) scored.push({ item, score: best.score });
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 50).map(s => s.item);
}

function renderResults() {
    listEl.innerHTML = '';

    if (inputEl && inputEl.value) {
        const calc = tryEval(inputEl.value);
        if (calc !== null) {
            const calcRow = document.createElement('div');
            calcRow.className = 'lc-item lc-calc';
            calcRow.innerHTML = `
                <span class="lc-cmd-icon">${ICONS.calc}</span>
                <div class="lc-item-text">
                    <div class="lc-item-title">${escapeHtml(inputEl.value)} = <b style="color:var(--accent-color,#60a5fa)">${escapeHtml(String(calc))}</b></div>
                    <div class="lc-item-sub">计算结果 · 回车复制</div>
                </div>
                <div class="lc-item-cat">计算</div>
            `;
            calcRow.addEventListener('mousedown', (e) => {
                e.preventDefault();
                try { navigator.clipboard.writeText(String(calc)); } catch (e) {}
                close();
            });
            listEl.appendChild(calcRow);
        }
    }

    const filtered = activeCategory === 'all'
        ? results
        : results.filter(r => r.category === activeCategory);

    if (filtered.length === 0 && listEl.children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'lc-empty';
        empty.textContent = '未找到匹配项';
        listEl.appendChild(empty);
        return;
    }

    filtered.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'lc-item';
        if (idx === selectedIndex) row.classList.add('selected');
        row.style.animationDelay = (idx * 22) + 'ms';
        row.innerHTML = `
            <span class="lc-cmd-icon">${item.iconSvg || ICONS[item.icon] || ICONS.app}</span>
            <div class="lc-item-text">
                <div class="lc-item-title">${escapeHtml(item.title)}</div>
                <div class="lc-item-sub">${escapeHtml(item.subtitle || '')}</div>
            </div>
            <div class="lc-item-cat">${escapeHtml(item.category || '')}</div>
        `;
        row.addEventListener('mouseenter', () => {
            selectedIndex = idx;
            updateSelection();
        });
        row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectedIndex = idx;
            executeSelected();
        });
        listEl.appendChild(row);
    });
}

function updateSelection() {
    const items = listEl.querySelectorAll('.lc-item:not(.lc-calc)');
    items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
    const sel = items[selectedIndex];
    if (sel) {
        const lr = listEl.getBoundingClientRect();
        const ir = sel.getBoundingClientRect();
        if (ir.top < lr.top) listEl.scrollTop -= (lr.top - ir.top + 4);
        else if (ir.bottom > lr.bottom) listEl.scrollTop += (ir.bottom - lr.bottom + 4);
    }
}

function refresh() {
    results = search(inputEl.value);
    selectedIndex = 0;
    renderResults();
}

function executeSelected() {
    const calc = tryEval(inputEl.value);
    if (calc !== null && selectedIndex === 0 && listEl.querySelector('.lc-calc')) {
        try { navigator.clipboard.writeText(String(calc)); } catch (e) {}
        close();
        return;
    }
    const filtered = activeCategory === 'all'
        ? results
        : results.filter(r => r.category === activeCategory);
    const item = filtered[selectedIndex];
    if (!item) return;
    close();
    try { item.action(); } catch (e) { console.error('[Launcher] 执行失败', e); }
}

function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const n = listEl.querySelectorAll('.lc-item:not(.lc-calc)').length;
        if (n === 0) return;
        selectedIndex = (selectedIndex + 1) % n;
        updateSelection();
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const n = listEl.querySelectorAll('.lc-item:not(.lc-calc)').length;
        if (n === 0) return;
        selectedIndex = (selectedIndex - 1 + n) % n;
        updateSelection();
        return;
    }
    if (e.key === 'Enter') { e.preventDefault(); executeSelected(); return; }
    if (e.key === 'Tab') {
        e.preventDefault();
        const cats = ['all', '应用', '设置', '文件', '快捷动作'];
        const i = cats.indexOf(activeCategory);
        activeCategory = cats[(i + (e.shiftKey ? -1 : 1) + cats.length) % cats.length];
        refresh();
        return;
    }
}

function open() {
    if (isOpen) return;
    if (!rootEl) build();
    inputEl.value = '';
    activeCategory = 'all';
    refresh();
    rootEl.classList.add('show');
    requestAnimationFrame(() => {
        rootEl.classList.add('show-active');
        inputEl.focus();
    });
    isOpen = true;
    document.addEventListener('keydown', onKeydown, true);
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('启动器已打开');
}

function close() {
    if (!isOpen || !rootEl) return;
    rootEl.classList.remove('show-active');
    setTimeout(() => {
        rootEl.classList.remove('show');
        if (inputEl) inputEl.value = '';
        results = [];
        selectedIndex = 0;
        if (listEl) listEl.innerHTML = '';
    }, 200);
    isOpen = false;
    document.removeEventListener('keydown', onKeydown, true);
}

function build() {
    const container = document.getElementById('mxosLauncher');
    if (!container) {
        const c = document.createElement('div');
        c.id = 'mxosLauncher';
        document.body.appendChild(c);
    }
    const container2 = document.getElementById('mxosLauncher');
    container2.innerHTML = `
        <div class="lc-backdrop">
            <div class="lc-dialog" role="dialog" aria-label="全局启动器" aria-modal="true">
                <div class="lc-input-wrap">
                    <span class="lc-search-icon">${ICONS.search}</span>
                    <input type="text" class="lc-input" placeholder="搜索应用 / 文件 / 设置，或输入表达式（1+2）" autocomplete="off" spellcheck="false" aria-label="搜索">
                    <span class="lc-hint">Esc 关闭</span>
                </div>
                <div class="lc-categories">
                    <button class="lc-cat active" data-cat="all">全部</button>
                    <button class="lc-cat" data-cat="应用">应用</button>
                    <button class="lc-cat" data-cat="设置">设置</button>
                    <button class="lc-cat" data-cat="文件">文件</button>
                    <button class="lc-cat" data-cat="快捷动作">动作</button>
                </div>
                <div class="lc-list" role="listbox"></div>
                <div class="lc-footer">
                    <span class="lc-footer-item"><span class="lc-kbd">${ICONS.arrowUp}${ICONS.arrowDown}</span> 导航</span>
                    <span class="lc-footer-item"><span class="lc-kbd">${ICONS.enter}</span> 执行</span>
                    <span class="lc-footer-item"><span class="lc-kbd">Tab</span> 切换分类</span>
                    <span class="lc-footer-item"><span class="lc-kbd">Esc</span> 关闭</span>
                </div>
            </div>
        </div>
    `;
    rootEl = container2;
    inputEl = container2.querySelector('.lc-input');
    listEl = container2.querySelector('.lc-list');
    hintEl = container2.querySelector('.lc-hint');

    inputEl.addEventListener('input', refresh);
    container2.querySelector('.lc-backdrop').addEventListener('mousedown', (e) => {
        if (e.target === e.currentTarget) close();
    });
    container2.querySelectorAll('.lc-cat').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCategory = btn.dataset.cat;
            container2.querySelectorAll('.lc-cat').forEach(b => b.classList.toggle('active', b === btn));
            refresh();
            inputEl.focus();
        });
    });
    injectStyles();
}

function injectStyles() {
    if (document.getElementById('lc-styles')) return;
    const style = document.createElement('style');
    style.id = 'lc-styles';
    style.textContent = `
#mxosLauncher { position: fixed; inset: 0; z-index: 3200; pointer-events: none; }
#mxosLauncher.show { pointer-events: auto; }
#mxosLauncher .lc-backdrop {
    position: absolute; inset: 0;
    background: rgba(8,10,16,0.45);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 12vh;
    opacity: 0; transition: opacity 220ms var(--ease-out, ease);
}
#mxosLauncher.show-active .lc-backdrop { opacity: 1; }
#mxosLauncher .lc-dialog {
    width: min(720px, 92vw); max-height: 72vh;
    background: rgba(24,28,38,0.78);
    backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 16px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.55), 0 2px 0 rgba(255,255,255,0.06) inset;
    display: flex; flex-direction: column; overflow: hidden;
    transform: translateY(-24px) scale(0.96); opacity: 0;
    transition: transform 260ms var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)), opacity 220ms ease;
}
#mxosLauncher.show-active .lc-dialog { transform: translateY(0) scale(1); opacity: 1; }
#mxosLauncher .lc-input-wrap {
    display: flex; align-items: center; gap: 10px;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
#mxosLauncher .lc-search-icon { display: flex; color: var(--accent-color, #60a5fa); }
#mxosLauncher .lc-search-icon svg { width: 20px; height: 20px; }
#mxosLauncher .lc-input {
    flex: 1; background: transparent; border: none; outline: none;
    color: #fff; font-size: 17px; font-family: inherit; letter-spacing: 0.2px;
}
#mxosLauncher .lc-input::placeholder { color: rgba(255,255,255,0.4); }
#mxosLauncher .lc-hint {
    font-size: 11px; color: rgba(255,255,255,0.4);
    padding: 3px 8px; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
}
#mxosLauncher .lc-categories {
    display: flex; gap: 4px; padding: 8px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
#mxosLauncher .lc-cat {
    background: transparent; border: 1px solid transparent;
    color: rgba(255,255,255,0.55); padding: 5px 12px; border-radius: 7px;
    font-size: 12px; cursor: pointer; font-family: inherit;
    transition: background 120ms ease, color 120ms ease;
}
#mxosLauncher .lc-cat:hover { background: rgba(255,255,255,0.06); color: #fff; }
#mxosLauncher .lc-cat.active {
    background: rgba(96,165,250,0.18); color: #fff;
    border-color: rgba(96,165,250,0.4);
}
#mxosLauncher .lc-list {
    flex: 1; overflow-y: auto; padding: 8px;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent;
}
#mxosLauncher .lc-list::-webkit-scrollbar { width: 6px; }
#mxosLauncher .lc-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 3px; }
#mxosLauncher .lc-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    color: #e5e7eb; opacity: 0; transform: translateX(12px);
    animation: lcItemEnter 280ms var(--ease-out, ease) forwards;
    transition: background 120ms ease;
}
#mxosLauncher .lc-item.selected {
    background: linear-gradient(90deg, rgba(96,165,250,0.22), rgba(96,165,250,0.08));
    color: #fff;
}
#mxosLauncher .lc-item:hover { background: rgba(255,255,255,0.08); }
#mxosLauncher .lc-item.selected:hover { background: linear-gradient(90deg, rgba(96,165,250,0.28), rgba(96,165,250,0.12)); }
#mxosLauncher .lc-calc { background: rgba(96,165,250,0.12); border: 1px dashed rgba(96,165,250,0.3); }
#mxosLauncher .lc-cmd-icon {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,0.06); color: var(--accent-color, #60a5fa);
    flex-shrink: 0;
}
#mxosLauncher .lc-cmd-icon svg { width: 16px; height: 16px; }
#mxosLauncher .lc-item.selected .lc-cmd-icon { background: rgba(96,165,250,0.25); color: #fff; }
#mxosLauncher .lc-item-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
#mxosLauncher .lc-item-title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#mxosLauncher .lc-item-sub { font-size: 11px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#mxosLauncher .lc-item-cat {
    font-size: 10px; color: rgba(255,255,255,0.5);
    padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,0.05); flex-shrink: 0;
}
#mxosLauncher .lc-empty { padding: 32px 16px; text-align: center; color: rgba(255,255,255,0.4); font-size: 13px; }
#mxosLauncher .lc-footer {
    display: flex; gap: 16px; padding: 10px 20px;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 11px; color: rgba(255,255,255,0.5);
}
#mxosLauncher .lc-footer-item { display: flex; align-items: center; gap: 6px; }
#mxosLauncher .lc-kbd { display: inline-flex; align-items: center; gap: 2px; color: rgba(255,255,255,0.7); }
#mxosLauncher .lc-kbd svg { width: 12px; height: 12px; }
@keyframes lcItemEnter { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
body.reduce-motion #mxosLauncher .lc-item,
body.reduce-motion #mxosLauncher .lc-dialog,
body.reduce-motion #mxosLauncher .lc-backdrop { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    `;
    document.head.appendChild(style);
}

function init() {
    injectStyles();
    window.MXOS.Launcher = { open, close, isOpen: () => isOpen };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { open, close };
