import { state } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_app_dating';

const COUPLES = [
    {
        id: 'music-notepad',
        apps: ['music', 'notepad'],
        name: '音乐爱好者',
        lines: [
            { from: 'music', text: '听到我放的曲子了吗？很适合写点什么。' },
            { from: 'notepad', text: '正有此意，灵感正在流淌。' }
        ]
    },
    {
        id: 'terminal-calc',
        apps: ['terminal', 'calculator'],
        name: '极客组合',
        lines: [
            { from: 'terminal', text: 'hey，你的算力借我用用？' },
            { from: 'calculator', text: '只要你不把我弄崩溃就行。' }
        ]
    },
    {
        id: 'clock-notepad',
        apps: ['clock', 'notepad'],
        name: '效率党',
        lines: [
            { from: 'clock', text: '时间就是效率，记下来吧。' },
            { from: 'notepad', text: '已经规划好下一步了。' }
        ]
    },
    {
        id: 'browser-music',
        apps: ['browser', 'music'],
        name: '冲浪搭档',
        lines: [
            { from: 'browser', text: '网上有好多新歌，要不要听？' },
            { from: 'music', text: '放马过来，我的播放列表正空着。' }
        ]
    },
    {
        id: 'terminal-music',
        apps: ['terminal', 'music'],
        name: '黑客电台',
        lines: [
            { from: 'terminal', text: '敲代码哪能没有 BGM？' },
            { from: 'music', text: '赛博朋克风已为你备好。' }
        ]
    },
    {
        id: 'calc-clock',
        apps: ['calculator', 'clock'],
        name: '数据控',
        lines: [
            { from: 'clock', text: '现在几点，你知道吗？' },
            { from: 'calculator', text: '让我算算时差……哦，刚好。' }
        ]
    },
    {
        id: 'notepad-music',
        apps: ['notepad', 'music'],
        name: '诗意搭档',
        lines: [
            { from: 'notepad', text: '这旋律让我想写首诗。' },
            { from: 'music', text: '那我就为你再弹一曲。' }
        ]
    },
    {
        id: 'settings-clock',
        apps: ['settings', 'clock'],
        name: '时间管家',
        lines: [
            { from: 'settings', text: '要不要调整一下时区？' },
            { from: 'clock', text: '我跟着你走就行。' }
        ]
    },
    {
        id: 'terminal-browser',
        apps: ['terminal', 'browser'],
        name: '双面特工',
        lines: [
            { from: 'terminal', text: '黑底白字才是真理。' },
            { from: 'browser', text: '别闹，花花世界也很精彩。' }
        ]
    },
    {
        id: 'recycle-bin-store',
        apps: ['recycle-bin', 'store'],
        name: '轮回哲学',
        lines: [
            { from: 'recycle-bin', text: '有人扔东西，就有人捡宝。' },
            { from: 'store', text: '说得好，来我这儿逛逛吧。' }
        ]
    }
];

function loadData() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {}
    return { triggered: [], lastTrigger: {} };
}

let data = loadData();

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function getOpenAppIds() {
    return state.windows.filter(w => !w.minimized).map(w => w.appId).filter(Boolean);
}

function findMatch() {
    const open = getOpenAppIds();
    if (open.length < 2) return null;
    const openSet = new Set(open);
    for (const c of COUPLES) {
        if (c.apps.every(a => openSet.has(a))) {
            const now = Date.now();
            const last = data.lastTrigger[c.id] || 0;
            if (now - last > 30 * 60 * 1000) {
                return c;
            }
        }
    }
    return null;
}

function trigger(couple) {
    if (!couple) return;
    data.lastTrigger[couple.id] = Date.now();
    if (!data.triggered.includes(couple.id)) {
        data.triggered.push(couple.id);
    }
    saveData();
    const cfgA = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(couple.apps[0])) || {};
    const cfgB = (window.MXOS.getAppConfig && window.MXOS.getAppConfig(couple.apps[1])) || {};
    couple.lines.forEach((line, i) => {
        const cfg = line.from === couple.apps[0] ? cfgA : cfgB;
        const name = cfg.title || line.from;
        setTimeout(() => {
            if (window.MXOS.notify) {
                window.MXOS.notify({
                    title: `${name} · ${couple.name}`,
                    body: line.text,
                    type: 'info',
                    duration: 6000
                });
            }
        }, i * 2500);
    });
    window.dispatchEvent(new CustomEvent('mxos:app-dating', { detail: { couple: couple.id, name: couple.name } }));
}

function checkLoop() {
    const m = findMatch();
    if (m) trigger(m);
}

function listCouples() {
    return COUPLES.map(c => ({
        id: c.id, name: c.name, apps: c.apps,
        triggered: data.triggered.includes(c.id)
    }));
}

function init() {
    setInterval(checkLoop, 15000);
    setTimeout(checkLoop, 8000);
    window.addEventListener('mxos:window-opened', () => setTimeout(checkLoop, 1000));
    window.MXOS.Features.dating = {
        listCouples, findMatch, trigger, checkLoop
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { listCouples, findMatch, trigger };
