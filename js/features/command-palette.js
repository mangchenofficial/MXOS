import { state, appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};

const ICONS = {
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
    minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    enter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>'
};

const customCommands = new Map();
let rootEl = null;
let inputEl = null;
let listEl = null;
let isOpen = false;
let results = [];
let selectedIndex = 0;

function buildCommands() {
    const commands = [];

    Object.keys(appConfigs).forEach(id => {
        const cfg = appConfigs[id];
        if (!cfg || cfg.hidden) return;
        commands.push({
            id: 'app:' + id,
            title: cfg.title,
            subtitle: '打开应用',
            category: '应用',
            icon: 'app',
            keywords: [cfg.title, id, '打开', '应用'],
            action: () => {
                import('../core.js').then(core => {
                    if (typeof core.createWindow === 'function') core.createWindow(id);
                });
            }
        });
    });

    state.installedApps.forEach(app => {
        if (app.appBin) {
            commands.push({
                id: 'app:' + app.id,
                title: app.name,
                subtitle: '打开应用',
                category: '应用',
                icon: 'app',
                keywords: [app.name, app.id, '打开', '应用'],
                action: () => {
                    import('../core.js').then(core => {
                        if (typeof core.launchThirdPartyApp === 'function') core.launchThirdPartyApp(app);
                    });
                }
            });
        }
    });

    const qs = (window.MXOS.QuickSettings && typeof window.MXOS.QuickSettings.getSettings === 'function')
        ? window.MXOS.QuickSettings.getSettings() : {};
    commands.push({
        id: 'toggle:nightMode',
        title: '夜间模式',
        subtitle: qs.nightMode ? '已开启 · 点击关闭' : '已关闭 · 点击开启',
        category: '切换设置',
        icon: 'moon',
        keywords: ['夜间', '护眼', 'night', '模式'],
        action: () => { window.MXOS.QuickSettings && window.MXOS.QuickSettings.toggle('nightMode'); }
    });
    commands.push({
        id: 'toggle:dnd',
        title: '勿扰模式',
        subtitle: qs.dnd ? '已开启 · 点击关闭' : '已关闭 · 点击开启',
        category: '切换设置',
        icon: qs.dnd ? 'bellOff' : 'bell',
        keywords: ['勿扰', '静音', 'dnd', '通知'],
        action: () => { window.MXOS.QuickSettings && window.MXOS.QuickSettings.toggle('dnd'); }
    });
    commands.push({
        id: 'toggle:powerSaver',
        title: '节能模式',
        subtitle: qs.powerSaver ? '已开启 · 点击关闭' : '已关闭 · 点击开启',
        category: '切换设置',
        icon: 'leaf',
        keywords: ['节能', '省电', 'power', 'saver'],
        action: () => { window.MXOS.QuickSettings && window.MXOS.QuickSettings.toggle('powerSaver'); }
    });

    const themeMode = (window.MXOS.theme && typeof window.MXOS.theme.get === 'function')
        ? window.MXOS.theme.get().mode : 'dark';
    commands.push({
        id: 'theme:dark',
        title: '深色主题',
        subtitle: themeMode === 'dark' ? '当前主题' : '切换到深色',
        category: '切换主题',
        icon: 'moon',
        keywords: ['深色', '暗色', 'dark', '主题'],
        action: () => { window.MXOS.theme && window.MXOS.theme.set('dark'); }
    });
    commands.push({
        id: 'theme:light',
        title: '浅色主题',
        subtitle: themeMode === 'light' ? '当前主题' : '切换到浅色',
        category: '切换主题',
        icon: 'sun',
        keywords: ['浅色', '亮色', 'light', '主题'],
        action: () => { window.MXOS.theme && window.MXOS.theme.set('light'); }
    });
    commands.push({
        id: 'theme:system',
        title: '跟随系统主题',
        subtitle: '使用系统偏好',
        category: '切换主题',
        icon: 'monitor',
        keywords: ['系统', '自动', 'system', '跟随'],
        action: () => {
            try { localStorage.removeItem('mxos_theme_mode'); } catch (e) {}
            const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
            window.MXOS.theme && window.MXOS.theme.set(prefersLight ? 'light' : 'dark');
        }
    });

    commands.push({
        id: 'cmd:lock',
        title: '锁屏',
        subtitle: '立即锁定系统',
        category: '执行命令',
        icon: 'lock',
        keywords: ['锁屏', '锁定', 'lock'],
        action: () => { window.MXOS.system && window.MXOS.system.lock(); }
    });
    commands.push({
        id: 'cmd:screenshot',
        title: '截图',
        subtitle: '捕获屏幕画面',
        category: '执行命令',
        icon: 'camera',
        keywords: ['截图', '截屏', 'screenshot', '捕获'],
        action: () => { window.MXOS.system && window.MXOS.system.screenshot(); }
    });
    commands.push({
        id: 'cmd:checkUpdate',
        title: '检查更新',
        subtitle: '检查系统新版本',
        category: '执行命令',
        icon: 'refresh',
        keywords: ['更新', '升级', 'update', '检查'],
        action: () => {
            if (window.MXOS.System && window.MXOS.System.update && window.MXOS.System.update.check) {
                window.MXOS.System.update.check({ silent: false });
            }
        }
    });
    commands.push({
        id: 'cmd:exportData',
        title: '导出数据',
        subtitle: '备份系统数据',
        category: '执行命令',
        icon: 'download',
        keywords: ['导出', '备份', 'export', '数据'],
        action: () => {
            if (window.MXOS.System && window.MXOS.System.dataExport && window.MXOS.System.dataExport.export) {
                window.MXOS.System.dataExport.export({});
            }
        }
    });

    commands.push({
        id: 'win:minimizeAll',
        title: '最小化所有窗口',
        subtitle: '收起全部窗口到任务栏',
        category: '窗口操作',
        icon: 'minimize',
        keywords: ['最小化', '收起', 'minimize', '全部'],
        action: () => {
            state.windows.forEach(w => {
                if (!w.minimized) import('../core.js').then(core => core.minimizeWindow(w));
            });
        }
    });
    commands.push({
        id: 'win:closeAll',
        title: '关闭所有窗口',
        subtitle: '关闭全部已打开窗口',
        category: '窗口操作',
        icon: 'close',
        keywords: ['关闭', '全部', 'close', 'all'],
        action: () => {
            [...state.windows].forEach(w => {
                import('../core.js').then(core => core.closeWindow(w));
            });
        }
    });
    commands.push({
        id: 'win:cascade',
        title: '层叠窗口',
        subtitle: '整齐排列所有窗口',
        category: '窗口操作',
        icon: 'layers',
        keywords: ['层叠', '排列', 'cascade', '窗口'],
        action: () => cascadeWindows()
    });

    customCommands.forEach(cmd => commands.push(cmd));
    return commands;
}

function cascadeWindows() {
    const wins = state.windows.filter(w => !w.minimized);
    const offset = 32;
    const startX = 40;
    const startY = 40;
    const taskbarH = 48;
    wins.forEach((w, i) => {
        const el = w.element;
        el.classList.remove('maximized');
        const x = startX + (i % 6) * offset;
        const y = startY + (i % 6) * offset;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = Math.min(720, window.innerWidth - x - 40) + 'px';
        el.style.height = Math.min(520, window.innerHeight - y - taskbarH) + 'px';
    });
}

function fuzzyMatch(query, target) {
    if (!query) return { score: 1, matched: true };
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t.includes(q)) {
        return { score: 100 - (t.indexOf(q)), matched: true };
    }
    let qi = 0;
    let score = 0;
    let lastMatch = -1;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
            score += (lastMatch === ti - 1) ? 10 : 1;
            lastMatch = ti;
            qi++;
        }
    }
    if (qi === q.length) return { score: score, matched: true };
    return { score: 0, matched: false };
}

function search(query) {
    const commands = buildCommands();
    if (!query || !query.trim()) {
        return commands.slice(0, 30);
    }
    const q = query.trim();
    const scored = [];
    commands.forEach(cmd => {
        const titleStr = cmd.title || '';
        let best = fuzzyMatch(q, titleStr);
        if (cmd.keywords) {
            cmd.keywords.forEach(k => {
                const r = fuzzyMatch(q, k);
                if (r.matched && r.score > best.score) best = r;
            });
        }
        if (best.matched) {
            scored.push({ cmd, score: best.score });
        }
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 30).map(s => s.cmd);
}

function iconSvg(name) {
    if (ICONS[name]) {
        return `<span class="cp-cmd-icon">${ICONS[name]}</span>`;
    }
    return `<span class="cp-cmd-icon">${ICONS.app}</span>`;
}

function renderResults() {
    listEl.innerHTML = '';
    results.forEach((cmd, index) => {
        const item = document.createElement('div');
        item.className = 'cp-item';
        if (index === selectedIndex) item.classList.add('selected');
        item.style.animationDelay = (index * 28) + 'ms';
        item.innerHTML = `
            ${iconSvg(cmd.icon)}
            <div class="cp-item-text">
                <div class="cp-item-title">${escapeHtml(cmd.title)}</div>
                <div class="cp-item-sub">${escapeHtml(cmd.subtitle || '')}</div>
            </div>
            <div class="cp-item-cat">${escapeHtml(cmd.category || '')}</div>
        `;
        item.addEventListener('mouseenter', () => {
            selectedIndex = index;
            updateSelection();
        });
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectedIndex = index;
            executeSelected();
        });
        listEl.appendChild(item);
    });
    if (results.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cp-empty';
        empty.textContent = '未找到匹配的命令';
        listEl.appendChild(empty);
    }
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function updateSelection() {
    const items = listEl.querySelectorAll('.cp-item');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === selectedIndex);
    });
    const sel = items[selectedIndex];
    if (sel) {
        const listRect = listEl.getBoundingClientRect();
        const itemRect = sel.getBoundingClientRect();
        if (itemRect.top < listRect.top) {
            listEl.scrollTop -= (listRect.top - itemRect.top + 4);
        } else if (itemRect.bottom > listRect.bottom) {
            listEl.scrollTop += (itemRect.bottom - listRect.bottom + 4);
        }
    }
}

function refresh() {
    results = search(inputEl.value);
    selectedIndex = 0;
    renderResults();
}

function executeSelected() {
    const cmd = results[selectedIndex];
    if (!cmd) return;
    close();
    try {
        cmd.action();
    } catch (e) {
        console.error('[CommandPalette] 执行命令失败:', e);
    }
}

function open() {
    if (isOpen) return;
    if (!rootEl) build();
    refresh();
    rootEl.classList.add('show');
    requestAnimationFrame(() => {
        rootEl.classList.add('show-active');
        inputEl.focus();
    });
    isOpen = true;
    document.addEventListener('keydown', onKeydown, true);
}

function close() {
    if (!isOpen || !rootEl) return;
    rootEl.classList.remove('show-active');
    setTimeout(() => {
        rootEl.classList.remove('show');
        inputEl.value = '';
        results = [];
        selectedIndex = 0;
        listEl.innerHTML = '';
    }, 200);
    isOpen = false;
    document.removeEventListener('keydown', onKeydown, true);
}

function onKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (results.length === 0) return;
        selectedIndex = (selectedIndex + 1) % results.length;
        updateSelection();
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (results.length === 0) return;
        selectedIndex = (selectedIndex - 1 + results.length) % results.length;
        updateSelection();
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
        return;
    }
}

function build() {
    const container = document.getElementById('commandPalette');
    if (!container) {
        const c = document.createElement('div');
        c.id = 'commandPalette';
        document.body.appendChild(c);
        container = c;
    }
    container.innerHTML = `
        <div class="cp-backdrop">
            <div class="cp-dialog" role="dialog" aria-label="命令面板" aria-modal="true">
                <div class="cp-input-wrap">
                    <span class="cp-search-icon">${ICONS.search}</span>
                    <input type="text" class="cp-input" placeholder="输入命令名称搜索…" autocomplete="off" spellcheck="false" aria-label="搜索命令">
                    <span class="cp-hint">Esc 关闭</span>
                </div>
                <div class="cp-list" role="listbox"></div>
                <div class="cp-footer">
                    <span class="cp-footer-item"><span class="cp-kbd">${ICONS.arrowUp}${ICONS.arrowDown}</span> 导航</span>
                    <span class="cp-footer-item"><span class="cp-kbd">${ICONS.enter}</span> 执行</span>
                    <span class="cp-footer-item"><span class="cp-kbd">Esc</span> 关闭</span>
                </div>
            </div>
        </div>
    `;
    rootEl = container;
    inputEl = container.querySelector('.cp-input');
    listEl = container.querySelector('.cp-list');

    inputEl.addEventListener('input', refresh);
    container.querySelector('.cp-backdrop').addEventListener('mousedown', (e) => {
        if (e.target === e.currentTarget) close();
    });

    injectStyles();
}

function injectStyles() {
    if (document.getElementById('cp-styles')) return;
    const style = document.createElement('style');
    style.id = 'cp-styles';
    style.textContent = `
#commandPalette {
    position: fixed;
    inset: 0;
    z-index: 3000;
    pointer-events: none;
}
#commandPalette.show { pointer-events: auto; }
#commandPalette .cp-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(8, 10, 16, 0.45);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
    opacity: 0;
    transition: opacity 220ms var(--ease-out, ease);
}
#commandPalette.show-active .cp-backdrop { opacity: 1; }
#commandPalette .cp-dialog {
    width: min(640px, 92vw);
    max-height: 70vh;
    background: rgba(24, 28, 38, 0.78);
    backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55), 0 2px 0 rgba(255,255,255,0.06) inset;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: translateY(-24px) scale(0.96);
    opacity: 0;
    transition: transform 260ms var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)), opacity 220ms ease;
}
#commandPalette.show-active .cp-dialog {
    transform: translateY(0) scale(1);
    opacity: 1;
}
#commandPalette .cp-input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
#commandPalette .cp-search-icon {
    display: flex;
    color: var(--accent, #60a5fa);
}
#commandPalette .cp-search-icon svg { width: 20px; height: 20px; }
#commandPalette .cp-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #fff;
    font-size: 16px;
    font-family: inherit;
    letter-spacing: 0.2px;
}
#commandPalette .cp-input::placeholder { color: rgba(255,255,255,0.4); }
#commandPalette .cp-hint {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    padding: 3px 8px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
}
#commandPalette .cp-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.2) transparent;
}
#commandPalette .cp-list::-webkit-scrollbar { width: 6px; }
#commandPalette .cp-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.18);
    border-radius: 3px;
}
#commandPalette .cp-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    color: #e5e7eb;
    opacity: 0;
    transform: translateX(12px);
    animation: cpItemEnter 280ms var(--ease-out, ease) forwards;
    transition: background 120ms ease;
}
#commandPalette .cp-item.selected {
    background: linear-gradient(90deg, rgba(96,165,250,0.22), rgba(96,165,250,0.08));
    color: #fff;
}
#commandPalette .cp-item:hover { background: rgba(255,255,255,0.08); }
#commandPalette .cp-item.selected:hover { background: linear-gradient(90deg, rgba(96,165,250,0.28), rgba(96,165,250,0.12)); }
#commandPalette .cp-cmd-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    color: var(--accent, #60a5fa);
    flex-shrink: 0;
}
#commandPalette .cp-cmd-icon svg { width: 16px; height: 16px; }
#commandPalette .cp-item.selected .cp-cmd-icon { background: rgba(96,165,250,0.25); color: #fff; }
#commandPalette .cp-item-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
#commandPalette .cp-item-title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
#commandPalette .cp-item-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
#commandPalette .cp-item-cat {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(255,255,255,0.05);
    flex-shrink: 0;
}
#commandPalette .cp-empty {
    padding: 32px 16px;
    text-align: center;
    color: rgba(255,255,255,0.4);
    font-size: 13px;
}
#commandPalette .cp-footer {
    display: flex;
    gap: 16px;
    padding: 10px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    color: rgba(255,255,255,0.5);
}
#commandPalette .cp-footer-item {
    display: flex;
    align-items: center;
    gap: 6px;
}
#commandPalette .cp-kbd {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: rgba(255,255,255,0.7);
}
#commandPalette .cp-kbd svg { width: 12px; height: 12px; }
@keyframes cpItemEnter {
    from { opacity: 0; transform: translateX(12px); }
    to { opacity: 1; transform: translateX(0); }
}
body.high-contrast #commandPalette .cp-dialog {
    background: #000 !important;
    border: 2px solid #fff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
body.high-contrast #commandPalette .cp-backdrop {
    background: rgba(0,0,0,0.7) !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
body.reduce-motion #commandPalette .cp-item,
body.reduce-motion #commandPalette .cp-dialog,
body.reduce-motion #commandPalette .cp-backdrop {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
}
    `;
    document.head.appendChild(style);
}

function register(command) {
    if (!command || !command.id || typeof command.action !== 'function') return false;
    const cmd = {
        id: 'custom:' + command.id,
        title: command.title || command.id,
        subtitle: command.subtitle || '',
        category: command.category || '自定义',
        icon: command.icon || 'app',
        keywords: command.keywords || [command.title || ''],
        action: command.action
    };
    customCommands.set(command.id, cmd);
    return true;
}

function init() {
    injectStyles();
    window.MXOS.CommandPalette = {
        register,
        open,
        close,
        isOpen: () => isOpen
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { register, open, close };
