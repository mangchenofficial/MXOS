import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_fortune_today';
const APP_ID = 'fortune';

const YI = [
    '写代码', '重构', '清理桌面', '听音乐', '泡杯咖啡',
    '备份重要文件', '整理收藏夹', '更新系统', '回复积压的消息',
    '尝试新应用', '关闭多余标签页', '写随笔', '调换壁纸',
    '与桌面宠物互动', '整理下载文件夹', '学习一个快捷键'
];

const JI = [
    '删库不备份', '在凌晨改配置', '同时打开 20 个窗口',
    '跳过更新', '忽视警告弹窗', '在终端跑未知命令',
    '吃外卖弄脏键盘', '熬夜到天亮', '强行重启',
    '在锁屏时离开电脑', '无视宠物饥饿', '把密码写在便签上'
];

const COLORS = [
    { name: '暖橙', hex: '#f59e0b' },
    { name: '青绿', hex: '#10b981' },
    { name: '玫红', hex: '#ec4899' },
    { name: '靛蓝', hex: '#a5b4fc' },
    { name: '琥珀', hex: '#fbbf24' },
    { name: '青柠', hex: '#84cc16' },
    { name: '珊瑚', hex: '#fb7185' },
    { name: '薄荷', hex: '#34d399' }
];

const DIRECTIONS = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];
const LUCKY_ITEMS = ['一本书', '一杯热茶', '一支笔', '一盆绿植', '一张老照片', '一盏暖灯'];

const FORTUNE_TIERS = [
    { name: '大吉', weight: 1, color: '#ef4444' },
    { name: '中吉', weight: 3, color: '#f59e0b' },
    { name: '小吉', weight: 5, color: '#fbbf24' },
    { name: '平', weight: 4, color: '#9ca3af' },
    { name: '小凶', weight: 2, color: '#6b7280' }
];

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(arr) {
    const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
    let r = Math.random() * total;
    for (const x of arr) {
        r -= (x.weight || 1);
        if (r <= 0) return x;
    }
    return arr[arr.length - 1];
}

function shuffleN(arr, n) {
    const copy = arr.slice();
    const result = [];
    for (let i = 0; i < n && copy.length; i++) {
        const idx = Math.floor(Math.random() * copy.length);
        result.push(copy.splice(idx, 1)[0]);
    }
    return result;
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function generate() {
    const tier = pickWeighted(FORTUNE_TIERS);
    const color = pick(COLORS);
    return {
        date: todayKey(),
        tier: tier.name,
        tierColor: tier.color,
        yi: shuffleN(YI, 3),
        ji: shuffleN(JI, 2),
        luckyColor: color,
        luckyNumber: Math.floor(Math.random() * 99) + 1,
        luckyDirection: pick(DIRECTIONS),
        luckyItem: pick(LUCKY_ITEMS),
        generatedAt: Date.now()
    };
}

function loadToday() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (raw && raw.date === todayKey()) return raw;
    } catch (e) {}
    const f = generate();
    saveToday(f);
    return f;
}

function saveToday(f) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch (e) {}
}

function getToday() {
    return loadToday();
}

function refresh() {
    const f = generate();
    saveToday(f);
    return f;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectStyles() {
    if (document.getElementById('mxos-fortune-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-fortune-styles';
    style.textContent = `
.mxos-fortune-app{padding:30px;color:#e5e7eb;height:100%;overflow:auto;background:linear-gradient(180deg,rgba(20,10,15,0.7),rgba(10,10,11,0.7));display:flex;flex-direction:column;align-items:center}
.mxos-fortune-card{background:rgba(255,255,255,0.04);border:1px solid rgba(251,191,36,0.25);border-radius:18px;padding:28px 32px;backdrop-filter:blur(40px) saturate(200%);-webkit-backdrop-filter:blur(40px) saturate(200%);max-width:420px;width:100%;text-align:center;position:relative;overflow:hidden}
.mxos-fortune-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#fbbf24,transparent)}
.mxos-fortune-date{font-size:12px;color:#9ca3af;margin-bottom:6px}
.mxos-fortune-tier{font-size:42px;font-weight:900;margin:6px 0 16px;letter-spacing:4px;text-shadow:0 0 20px currentColor}
.mxos-fortune-section{margin:14px 0;text-align:left}
.mxos-fortune-section-label{font-size:12px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.mxos-fortune-section-label.yi{color:#22c55e}
.mxos-fortune-section-label.ji{color:#ef4444}
.mxos-fortune-tags{display:flex;flex-wrap:wrap;gap:6px}
.mxos-fortune-tag{padding:3px 10px;border-radius:12px;font-size:12px;background:rgba(255,255,255,0.06)}
.mxos-fortune-section-label.yi + .mxos-fortune-tags .mxos-fortune-tag{background:rgba(34,197,94,0.12);color:#86efac}
.mxos-fortune-section-label.ji + .mxos-fortune-tags .mxos-fortune-tag{background:rgba(239,68,68,0.12);color:#fca5a5}
.mxos-fortune-lucky{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.mxos-fortune-lucky-item{background:rgba(255,255,255,0.04);padding:10px;border-radius:10px;text-align:center}
.mxos-fortune-lucky-label{font-size:10px;color:#9ca3af;margin-bottom:2px}
.mxos-fortune-lucky-value{font-size:14px;font-weight:600;color:#fbbf24}
.mxos-fortune-color-swatch{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle;margin-right:4px}
.mxos-fortune-refresh{margin-top:18px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fbbf24;padding:6px 16px;border-radius:8px;font-size:12px;cursor:pointer;transition:all 0.15s}
.mxos-fortune-refresh:hover{background:rgba(251,191,36,0.15);border-color:#fbbf24}
.mxos-fortune-lock{position:fixed;top:30%;left:50%;transform:translateX(-50%);background:rgba(10,10,11,0.85);backdrop-filter:blur(40px) saturate(200%);-webkit-backdrop-filter:blur(40px) saturate(200%);border:1px solid rgba(251,191,36,0.3);border-radius:18px;padding:20px 28px;text-align:center;color:#e5e7eb;z-index:5000;max-width:340px;pointer-events:none}
.mxos-fortune-lock-title{font-size:12px;color:#9ca3af;margin-bottom:6px}
.mxos-fortune-lock-tier{font-size:32px;font-weight:900;margin-bottom:8px;letter-spacing:3px;text-shadow:0 0 16px currentColor}
.mxos-fortune-lock-yi{font-size:12px;color:#86efac}
    `;
    document.head.appendChild(style);
}

function renderFortuneCard(f) {
    return `
        <div class="mxos-fortune-date">${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
        <div class="mxos-fortune-tier" style="color:${f.tierColor}">${f.tier}</div>
        <div class="mxos-fortune-section">
            <div class="mxos-fortune-section yi">
                <div class="mxos-fortune-section-label yi"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12l5 5 9-11"/></svg>宜</div>
                <div class="mxos-fortune-tags">${f.yi.map(y => `<span class="mxos-fortune-tag">${escapeHtml(y)}</span>`).join('')}</div>
            </div>
        </div>
        <div class="mxos-fortune-section">
            <div class="mxos-fortune-section ji">
                <div class="mxos-fortune-section-label ji"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>忌</div>
                <div class="mxos-fortune-tags">${f.ji.map(j => `<span class="mxos-fortune-tag">${escapeHtml(j)}</span>`).join('')}</div>
            </div>
        </div>
        <div class="mxos-fortune-lucky">
            <div class="mxos-fortune-lucky-item">
                <div class="mxos-fortune-lucky-label">幸运色</div>
                <div class="mxos-fortune-lucky-value"><span class="mxos-fortune-color-swatch" style="background:${f.luckyColor.hex}"></span>${escapeHtml(f.luckyColor.name)}</div>
            </div>
            <div class="mxos-fortune-lucky-item">
                <div class="mxos-fortune-lucky-label">幸运数字</div>
                <div class="mxos-fortune-lucky-value">${f.luckyNumber}</div>
            </div>
            <div class="mxos-fortune-lucky-item">
                <div class="mxos-fortune-lucky-label">幸运方位</div>
                <div class="mxos-fortune-lucky-value">${escapeHtml(f.luckyDirection)}</div>
            </div>
            <div class="mxos-fortune-lucky-item">
                <div class="mxos-fortune-lucky-label">幸运之物</div>
                <div class="mxos-fortune-lucky-value">${escapeHtml(f.luckyItem)}</div>
            </div>
        </div>
    `;
}

function renderApp(contentEl) {
    injectStyles();
    const f = getToday();
    const root = document.createElement('div');
    root.className = 'mxos-fortune-app';
    root.innerHTML = `
        <div class="mxos-fortune-card" id="mxosFortuneCard">
            ${renderFortuneCard(f)}
            <button class="mxos-fortune-refresh" id="mxosFortuneRefresh">重新占卜</button>
        </div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(root);
    root.querySelector('#mxosFortuneRefresh').addEventListener('click', () => {
        const nf = refresh();
        const card = root.querySelector('#mxosFortuneCard');
        card.style.opacity = '0.4';
        setTimeout(() => {
            card.innerHTML = renderFortuneCard(nf) + '<button class="mxos-fortune-refresh" id="mxosFortuneRefresh">重新占卜</button>';
            card.style.opacity = '1';
            card.querySelector('#mxosFortuneRefresh').addEventListener('click', () => renderApp(contentEl));
        }, 200);
    });
}

function injectLockScreen() {
    const lock = document.getElementById('lock-screen');
    if (!lock) return;
    if (lock.querySelector('.mxos-fortune-lock')) return;
    const f = getToday();
    const el = document.createElement('div');
    el.className = 'mxos-fortune-lock';
    el.innerHTML = `
        <div class="mxos-fortune-lock-title">今日运势</div>
        <div class="mxos-fortune-lock-tier" style="color:${f.tierColor}">${f.tier}</div>
        <div class="mxos-fortune-lock-yi">宜：${escapeHtml(f.yi.slice(0, 2).join('、'))}</div>
    `;
    lock.appendChild(el);
}

function scheduleMorningPush() {
    function push() {
        const now = new Date();
        const target = new Date(now);
        target.setHours(8, 0, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        const ms = target - now;
        setTimeout(() => {
            const f = getToday();
            if (f.date !== todayKey()) {
                const nf = generate();
                saveToday(nf);
            }
            if (window.MXOS.notify) {
                const ff = getToday();
                window.MXOS.notify({
                    title: `今日运势 · ${ff.tier}`,
                    body: `宜：${ff.yi.join('、')} | 忌：${ff.ji.join('、')}`,
                    type: 'info'
                });
            }
            scheduleMorningPush();
        }, ms);
    }
    push();
}

function registerApp() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: 'MXOS 占卜', icon: 'calendar', width: 560, height: 620, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(registerApp, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-calendar"/></svg><span>占卜</span>`;
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    loadToday();
    setTimeout(injectLockScreen, 3000);
    setInterval(injectLockScreen, 30000);
    scheduleMorningPush();
    window.addEventListener('mxos:desktop-ready', injectLockScreen);
    window.MXOS.Features.fortune = { getToday, refresh, generate, renderApp };
    setTimeout(registerApp, 2800);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { getToday, refresh, generate };
