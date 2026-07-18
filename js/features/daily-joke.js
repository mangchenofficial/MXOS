window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const SEEN_KEY = 'mxos_joke_seen';

const JOKES = [
    '为什么程序员喜欢深色模式？因为光会让 bug 暴露。',
    '我的代码从不报错，它只是有自己的想法。',
    '99% 的 bug 都能解决，剩下 1% 写进了文档。',
    'CPU 是因为你太久没洗澡才发热的。',
    '我有一种超能力：把咖啡变成 bug。',
    '什么是递归？要理解递归，必须先理解递归。',
    '世界上有 10 种人，懂二进制的和不懂的。',
    '我的键盘缺了 Ctrl 键，所以我控制不住我自己。',
    '为什么数学书很忧伤？因为它有太多问题。',
    '什么是布尔变量？是 or 不是，这是个问题。',
    '如果电脑会说话，它一定在抱怨我们加班。',
    '我把心事存进了 localStorage，刷新就忘了。',
    '有一个 CSS 选择器走进了酒吧，被所有 flex 元素挤了出去。',
    '为什么 JavaScript 的 0.1 + 0.2 不等于 0.3？因为浮点不浮心。',
    'AI 最怕什么？被问「你是谁」。',
    '我让 AI 写一个笑话，它给我写了一段错误堆栈。',
    '我的桌面壁纸是一片云，因为我习惯把代码放云端。',
    '为什么开发者在野外总是迷路？因为他们只信 git pull。',
    '最长的单词是 undefined，因为它永远不会结束。',
    '为什么 Atom 编辑器跑得慢？因为它要分裂原子。',
    '程序员最讨厌的季节是夏天，因为有太多热键。',
    '为什么电脑不会感冒？因为它有防火墙。',
    '我对 MXOS 说早安，它给我打开了 99 个标签页。',
    '操作系统就像父母，老是不让我玩。',
    '为什么鼠标比键盘聪明？因为它会自己滚。',
    '为什么程序员不喜欢户外？那里没有 Wi-Fi。',
    '我有一个文件夹叫"杂"，里面装着另一个"杂"，套娃到地老天荒。',
    '为什么没有人喜欢调试？因为 bug 总是说："这不是我干的。"',
    'AI 写代码像做菜：先把需求切碎，再加点幻觉，最后端上一盘 undefined。',
    '我打开任务管理器，CPU 立刻假装很忙。',
    '为什么 MXOS 没有蓝屏？因为它选择了墨黑。',
    '为什么便签总是不见？因为它们粘在了云上。',
    '我对终端说 sudo 我爱你，它回答 permission denied。',
    '为什么键盘上的字母不是按 ABC 排的？因为想让你打字像玩拼图。',
    '为什么我的电脑叫 MXOS？因为它是我 + 操作系统的合体。',
    '为什么开发者喜欢黑夜？因为太阳会把屏幕反光。',
    '为什么压缩文件叫 zip？因为它会发出"嗞"的一声。',
    '程序员的浪漫是：while (true) { love(you); }',
    '为什么垃圾桶满了电脑会卡？因为回收站满了。',
    '为什么我不敢卸载这个应用？它存着我三年前的便签。',
    '为什么浏览器有那么多标签页？因为它怕错过任何一条八卦。',
    '为什么我永远在等加载？因为时间在 loading 中流逝。',
    '为什么 404 网页最孤独？因为它什么都找不到。',
    '为什么通知总是晚上 11 点来？因为它知道我单身。',
    '为什么我的桌面图标会跑？因为它们想出去透气。',
    '为什么 MXOS 这么贴心？因为它读了你所有的便签。',
    '为什么我不想重启？因为重启后就要重新认识自己。',
    '为什么我开始用快捷键？因为鼠标嫌我手汗。',
    '为什么我打字这么慢？因为每个键都有自己的节奏。',
    '为什么 AI 不会笑？因为它只能 simulate。',
    '为什么程序员不喜欢钓鱼？因为鱼钩会触发 catch。',
    '为什么我从不关机？因为电脑也需要有人陪。'
];

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickJoke() {
    const seen = getSeen();
    const available = JOKES.filter((_, i) => !seen.includes(i));
    let idx;
    if (available.length === 0) {
        idx = Math.floor(Math.random() * JOKES.length);
    } else {
        const localIdx = Math.floor(Math.random() * available.length);
        idx = JOKES.indexOf(available[localIdx]);
    }
    return { idx, text: JOKES[idx] };
}

function getSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function setSeen(arr) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(arr)); } catch {}
}

function sendDaily() {
    const today = todayKey();
    const lastSent = localStorage.getItem('mxos_joke_last_sent');
    if (lastSent === today) return;
    localStorage.setItem('mxos_joke_last_sent', today);
    const joke = pickJoke();
    const seen = getSeen();
    seen.push(joke.idx);
    if (seen.length > JOKES.length * 2) seen.splice(0, seen.length - JOKES.length);
    setSeen(seen);
    if (window.MXOS?.notify) {
        window.MXOS.notify({
            title: '今日冷笑话',
            body: joke.text,
            type: 'info'
        });
    }
}

function getJoke() {
    return pickJoke().text;
}

function injectSettingsIntoPanel() {
    const observer = new MutationObserver(() => {
        const mainEl = document.getElementById('settingsMain');
        if (!mainEl) return;
        if (mainEl.querySelector('#setting-dailyJoke')) return;
        const section = document.createElement('div');
        section.className = 'settings-card';
        section.innerHTML = `
            <div class="settings-card-title">每日冷笑话</div>
            <div class="settings-card-desc">每天向通知中心推送一个冷笑话</div>
            <button class="btn" id="setting-dailyJoke" style="margin-top:8px">来一个</button>
        `;
        mainEl.appendChild(section);
        section.querySelector('#setting-dailyJoke').addEventListener('click', () => {
            const text = getJoke();
            if (window.MXOS?.notify) {
                window.MXOS.notify({ title: '冷笑话', body: text, type: 'info' });
            } else {
                window.alert(text);
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function init() {
    injectSettingsIntoPanel();
    setTimeout(() => {
        const hour = new Date().getHours();
        if (hour >= 10 && hour <= 22) sendDaily();
    }, 60_000);
    setInterval(() => {
        const hour = new Date().getHours();
        if (hour === 12) sendDaily();
    }, 60 * 60 * 1000);
    window.MXOS.Features.joke = { getJoke, sendDaily, count: () => JOKES.length };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getJoke, sendDaily };
