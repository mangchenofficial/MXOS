window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_story_history';
const SEEN_KEY = 'mxos_story_seen';

let history = [];

function load() {
    try { history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { history = []; }
}
function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch {}
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getUsage() {
    try {
        const raw = localStorage.getItem('mxos_usage_report');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function getFocus() {
    try {
        const raw = localStorage.getItem('mxos_focus_stats');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function getStickyCount() {
    if (window.MXOS?.Sticky?.getAll) {
        try { return (window.MXOS.Sticky.getAll() || []).length; } catch {}
    }
    try { return JSON.parse(localStorage.getItem('mxos_sticky_notes') || '[]').length; } catch { return 0; }
}

function generateStory() {
    const today = todayKey();
    const usage = getUsage();
    const focus = getFocus();
    const stickyCount = getStickyCount();
    const todayUsage = usage?.daily?.[today] || { events: 0, apps: {}, focusMs: 0 };
    const todayFocus = focus?.daily?.[today] || { focusMs: 0, sessions: 0 };

    const events = todayUsage.events || 0;
    const appCount = Object.keys(todayUsage.apps || {}).length;
    const topApp = Object.entries(todayUsage.apps || {}).sort((a, b) => b[1] - a[1])[0];
    const focusMs = todayFocus.focusMs || 0;
    const focusSessions = todayFocus.sessions || 0;

    const weather = ['晴朗', '微云', '细雨', '薄雾', '微风'][new Date().getDate() % 5];
    const mood = focusMs > 30 * 60 * 1000 ? '高效专注' : (events > 80 ? '忙碌活跃' : (events > 20 ? '悠然自得' : '静谧恬淡'));

    const lines = [];
    lines.push(`今天是 ${today}，${weather}的一天。`);
    lines.push(`你今天和 MXOS 进行了 ${events} 次互动，使用了 ${appCount} 个不同的应用。`);
    if (topApp) {
        lines.push(`最常驻足的是「${appLabel(topApp[0])}」，被唤起 ${topApp[1]} 次。`);
    }
    if (focusMs > 0) {
        const mins = Math.floor(focusMs / 60000);
        lines.push(`你进入了 ${focusSessions} 次专注模式，累计沉浸 ${mins} 分钟，心无旁骛。`);
    } else {
        lines.push(`今天还没进入过专注模式，不妨试试？`);
    }
    if (stickyCount > 0) {
        lines.push(`桌面上躺着 ${stickyCount} 张便签，记录着你稍纵即逝的灵感。`);
    }
    lines.push(`整体状态：${mood}。`);
    lines.push(`愿明天的你，依然与 MXOS 一同前行。`);

    return { date: today, content: lines.join('\n'), stats: { events, appCount, focusMs, focusSessions, stickyCount, mood } };
}

function appLabel(id) {
    const m = {
        'this-pc': '此电脑', 'browser': '浏览器', 'settings': '设置',
        'office': '办公套件', 'music': '音乐', 'calculator': '计算器',
        'terminal': '终端', 'calendar': '日历', 'notepad': '记事本',
        'store': '应用商店', 'task-manager-pro': '任务管理器'
    };
    return m[id] || id;
}

function showStory() {
    const story = generateStory();
    let panel = document.getElementById('mxosStoryPanel');
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'mxosStoryPanel';
    panel.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 480px; max-width: 92vw; max-height: 80vh;
        overflow-y: auto;
        background: var(--glass-bg, rgba(20,20,22,0.85));
        backdrop-filter: blur(28px) saturate(1.4);
        border: 1px solid var(--glass-border, rgba(255,255,255,0.1));
        border-radius: var(--radius-lg, 16px);
        box-shadow: var(--shadow, 0 20px 60px rgba(0,0,0,0.5));
        color: var(--text-color, #fff);
        z-index: 9990;
        padding: 28px;
    `;
    panel.innerHTML = `
        <div style="text-align:center;margin-bottom:14px">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #a78bfa)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/>
                <line x1="8" y1="17" x2="14" y2="17"/>
            </svg>
        </div>
        <h2 style="font-size:18px;margin:0 0 4px;text-align:center">MXOS 日记 · ${story.date}</h2>
        <div style="font-size:12px;color:var(--text-secondary);text-align:center;margin-bottom:18px">${story.stats.mood}</div>
        <div style="font-size:14px;line-height:1.9;white-space:pre-wrap;color:var(--text-color)">${escapeHtml(story.content)}</div>
        <div style="margin-top:18px;text-align:center">
            <button id="mxosStoryClose" style="background:rgba(255,255,255,0.08);border:1px solid var(--glass-border);color:var(--text-color);padding:6px 16px;border-radius:8px;cursor:pointer">关闭</button>
        </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#mxosStoryClose').addEventListener('click', () => panel.remove());
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.remove(); });
}

function escapeHtml(s) {
    return String(s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

function maybeNotify() {
    const today = todayKey();
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch {}
    if (seen.includes(today)) return;
    seen.push(today);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-30))); } catch {}
    const story = generateStory();
    history.push(story);
    if (history.length > 30) history = history.slice(-30);
    save();
    if (window.MXOS?.notify) {
        window.MXOS.notify({
            title: '今日 MXOS 日记已生成',
            body: `今日互动 ${story.stats.events} 次，专注 ${Math.floor(story.stats.focusMs / 60000)} 分钟`,
            type: 'info'
        });
    }
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-mxosStory')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.innerHTML = `
            <div class="settings-card-title">MXOS 日记</div>
            <div class="settings-card-desc">查看今天由系统使用数据生成的小故事</div>
            <button class="btn" id="setting-mxosStory" style="margin-top:8px">查看今日日记</button>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-mxosStory').addEventListener('click', showStory);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    load();
    injectSettingsIntoPanel();
    setTimeout(maybeNotify, 30_000);
    window.MXOS.Features.story = { generateStory, showStory, getHistory: () => [...history] };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { generateStory, showStory };
