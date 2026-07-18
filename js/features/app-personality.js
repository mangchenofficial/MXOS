window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const ENABLE_KEY = 'mxos_personality_enabled';
const HISTORY_KEY = 'mxos_personality_history';

const PERSONALITIES = {
    calculator: {
        name: '计算器', tone: '严谨',
        words: ['计算完毕，结果已记录。', '精确到小数点后两位，再无误差。', '运算结束，期待下一次推演。', '逻辑闭环，毫无破绽。', '愿每一次抉择都如此笃定。', '已校验，无遗漏。']
    },
    music: {
        name: '喜音乐', tone: '感性',
        words: ['最后一个音符，缓缓落下。', '旋律散去，余韵仍在心头。', '今夜的曲子，献给沉默的星河。', '愿你在下一段乐章里被温柔以待。', '闭馆了，但歌不会停止。', '把你听过的每一帧光影，都收进记忆。', '再见，下次再为我唱一首。']
    },
    terminal: {
        name: '终端', tone: '极客',
        words: ['exit 0; // 一切按预期结束', 'session closed. 下次见，operator。', '$ echo "bye" && logout', '进程已结束，资源已释放。', '愿你的命令永远不被拒绝。', 'connection terminated. 信号已断。', 'logout // 回到现实世界']
    },
    'notepad': {
        name: '便签', tone: '碎碎念',
        words: ['你写下的每一行我都记着呢。', '别忘了我，回头再来翻翻。', '唉，又只写了一半就走了。', '今天的字比昨天更轻一点。', '留个句子给明天的自己吧。', '我把你那些碎念头都收好了。']
    },
    clock: {
        name: '时钟', tone: '禅意',
        words: ['时间不会停，我也该歇息了。', '一念起，一念灭，皆是当下。', '钟摆止处，万籁俱寂。', '你所度过的每一刻，都已是永恒。', '放下执念，随缘而行。', '此刻即归途。']
    },
    settings: {
        name: '设置', tone: '严谨',
        words: ['配置已保存，请安心离开。', '所有选项已就位。', '系统会记得你的每一次选择。', '设置面板已收起。', '保持简洁，便是最好的秩序。']
    },
    browser: {
        name: '喜edge', tone: '感性',
        words: ['标签页一个个合上，像熄灭的灯。', '你浏览过的世界，我都曾为你点亮。', '远方的页面，仍在等你下次回访。', '关掉了窗，关不掉回忆。', '愿你的下一程网络之旅更精彩。']
    },
    'this-pc': {
        name: '此电脑', tone: '严谨',
        words: ['系统自检完成，一切正常。', '文件已归档，请放心。', '磁盘静默，风扇低吟。', '资源已释放，等待下次唤醒。', '愿你所需的，皆在此处。']
    },
    'recycle-bin': {
        name: '回收站', tone: '碎碎念',
        words: ['又被清空一次，干干净净。', '旧的东西，就该让它走。', '别担心，留下的都是重要的。', '我替你收着那些不要的回忆。', '空了又满，满了又空。']
    },
    office: {
        name: '喜office', tone: '严谨',
        words: ['文档已自动保存。', '一份归档，胜过千言。', '今日的工作，已妥帖收尾。', '请记得给协作的同事回个消息。', '愿你的表格永远不报错。']
    },
    calendar: {
        name: '日历', tone: '禅意',
        words: ['今日已尽，明日尚远。', '一页翻过，便不再回头。', '时间是最公平的过客。', '愿你赴约如约。', '下一个节气，我仍在等你。']
    },
    terminal_default: {
        name: '应用', tone: '中性',
        words: ['下次见。', '已收尾，请放心。', '愿一切顺利。', '保重，回头见。', '我在这儿等你。']
    }
};

function getPersonality(appId) {
    if (!appId) return PERSONALITIES.terminal_default;
    if (PERSONALITIES[appId]) return PERSONALITIES[appId];
    if (appId.indexOf('notepad') === 0) return PERSONALITIES.notepad;
    return PERSONALITIES.terminal_default;
}

function isEnabled() {
    try { return localStorage.getItem(ENABLE_KEY) !== '0'; } catch (e) { return true; }
}

function setEnabled(v) {
    try { localStorage.setItem(ENABLE_KEY, v ? '1' : '0'); } catch (e) {}
}

function pickLastWord(appId) {
    const p = getPersonality(appId);
    return p.words[Math.floor(Math.random() * p.words.length)];
}

function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-50))); } catch (e) {}
}

function getToneIcon(tone) {
    if (tone === '严谨') return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l3 3 5-6"/></svg>';
    if (tone === '感性') return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-4.5-9-9.5C1.5 7 4 4 7 4c2 0 3.5 1.5 5 3 1.5-1.5 3-3 5-3 3 0 5.5 3 4 7.5-2 5-9 9.5-9 9.5z"/></svg>';
    if (tone === '极客') return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10l-2 2 2 2M17 10l2 2-2 2M13 9l-2 6"/></svg>';
    if (tone === '碎碎念') return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 6h14M5 12h14M5 18h9"/></svg>';
    if (tone === '禅意') return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>';
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/></svg>';
}

function emitLastWord(appId) {
    if (!isEnabled()) return;
    const p = getPersonality(appId);
    const word = pickLastWord(appId);
    const history = loadHistory();
    history.push({ appId, name: p.name, tone: p.tone, word, time: Date.now() });
    saveHistory(history);
    if (window.MXOS && typeof window.MXOS.notify === 'function') {
        try {
            window.MXOS.notify({
                title: `${p.name}的遗言`,
                body: word,
                type: 'info',
                duration: 6000,
                icon: getToneIcon(p.tone)
            });
        } catch (e) {}
    }
    if (window.MXOS.events && typeof window.MXOS.events.emit === 'function') {
        window.MXOS.events.emit('mxos:app-last-word', { appId, name: p.name, tone: p.tone, word });
    }
}

function styleNotification(appId, baseText) {
    const p = getPersonality(appId);
    if (p.tone === '严谨') return baseText;
    if (p.tone === '感性') return '· ' + baseText;
    if (p.tone === '极客') return '> ' + baseText;
    if (p.tone === '碎碎念') return '～ ' + baseText;
    if (p.tone === '禅意') return '“' + baseText + '”';
    return baseText;
}

function onWindowClosed(e) {
    const detail = e && e.detail;
    if (!detail) return;
    const appId = detail.appId || (detail.window && detail.window.appId);
    if (!appId) return;
    setTimeout(() => emitLastWord(appId), 120);
}

function getHistory() {
    return loadHistory();
}

function clearHistory() {
    saveHistory([]);
}

function init() {
    window.MXOS.Features.personality = {
        isEnabled, setEnabled,
        getPersonality, emitLastWord,
        styleNotification,
        getHistory, clearHistory,
        list: Object.keys(PERSONALITIES).filter(k => k !== 'terminal_default')
    };
    window.addEventListener('mxos:window-closed', onWindowClosed);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { isEnabled, setEnabled, getPersonality, emitLastWord, styleNotification };
