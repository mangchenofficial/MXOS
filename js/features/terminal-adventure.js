import { state } from '../state.js';
import { registerAppRenderer } from '../core.js';
import { appConfigs } from '../state.js';

window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_adventure_save';
const APP_ID = 'adventure';

const SCENES = {
    entrance: {
        name: '地下城入口',
        desc: '你站在阴森的地下城入口前。腐朽的木门半开着，里面传来阵阵冷风。墙上的火把摇曳不定，映出诡异的影子。',
        choices: [
            { text: '推开门走进去', next: 'treasure', effect: { mp: -5 } },
            { text: '仔细观察周围', next: 'entrance_look', effect: {} },
            { text: '大声喊话试探', next: 'entrance_shout', effect: { hp: -10 } }
        ]
    },
    entrance_look: {
        name: '入口观察',
        desc: '你发现门框上刻着古老的符文，似乎是某种祝福。火把旁有一把生锈的钥匙，你捡了起来。',
        choices: [
            { text: '拿上钥匙进入', next: 'treasure', effect: { mp: 5 }, flag: 'has_key' },
            { text: '弃之不理进入', next: 'treasure', effect: {} }
        ]
    },
    entrance_shout: {
        name: '入口喊话',
        desc: '你的回声在地下城回荡，惊动了里面的蝙蝠群。它们蜂拥而出，扑到你身上！',
        choices: [
            { text: '挥剑驱赶蝙蝠', next: 'treasure', effect: { hp: -5, mp: -3 } },
            { text: '趴下躲避', next: 'treasure', effect: { hp: -3 } }
        ]
    },
    treasure: {
        name: '宝藏室',
        desc: '一间闪烁着金光的房间。中央有个巨大的宝箱，墙角还散落着几枚金币。但地面有不寻常的磨损痕迹。',
        choices: [
            { text: '直接打开宝箱', next: 'monster', effect: {}, flag: 'trap' },
            { text: '检查地面陷阱', next: 'treasure_check', effect: { mp: -5 } },
            { text: '只捡地上的金币', next: 'puzzle', effect: { gold: 20 } }
        ]
    },
    treasure_check: {
        name: '宝藏室·检查',
        desc: '果然！宝箱前有压力板陷阱。你小心地绕过它，从宝箱里取得了一颗红宝石和一瓶治疗药水。',
        choices: [
            { text: '前往下一间房', next: 'puzzle', effect: { gold: 50, hp: 20, item: '红宝石' } }
        ]
    },
    puzzle: {
        name: '谜题房',
        desc: '房间中央有一座石碑，上面刻着谜语：「我白天行走千万里，夜晚却寸步不离。我是什么？」门前有两扇门，分别画着太阳和影子。',
        choices: [
            { text: '回答：影子', next: 'boss', effect: { mp: 10 }, flag: 'puzzle_solved' },
            { text: '回答：太阳', next: 'puzzle_wrong', effect: { hp: -15 } },
            { text: '强行推开两扇门', next: 'puzzle_force', effect: { hp: -10, mp: -10 } }
        ]
    },
    puzzle_wrong: {
        name: '谜题房·错误',
        desc: '石碑发出红光，你感到一阵灼烧。看来答错了。',
        choices: [
            { text: '重新选择影子', next: 'boss', effect: {}, flag: 'puzzle_solved' },
            { text: '强行破门', next: 'puzzle_force', effect: { hp: -5 } }
        ]
    },
    puzzle_force: {
        name: '谜题房·强闯',
        desc: '你用尽全力撞开门，但也被反弹的魔法击退。',
        choices: [
            { text: '进入Boss房', next: 'boss', effect: {} }
        ]
    },
    monster: {
        name: '怪物房',
        desc: '宝箱突然变成了一个宝箱怪！它张开满是利齿的大嘴扑向你。',
        choices: [
            { text: '挥剑猛攻', next: 'boss', effect: { hp: -20, mp: -10 }, flag: 'fought_mimic' },
            { text: '使用火球术', next: 'boss', effect: { hp: -10, mp: -20 }, flag: 'fought_mimic' },
            { text: '逃跑', next: 'puzzle', effect: { hp: -15 } }
        ]
    },
    boss: {
        name: '最终 Boss',
        desc: '地下城深处，一头巨大的暗影龙盘踞在祭坛上。它的眼睛燃烧着紫色的火焰，咆哮震得你耳膜生疼。',
        choices: [
            { text: '正面冲锋', next: 'end_win', effect: { hp: -30, mp: -20 }, require: (s) => s.hp > 30 },
            { text: '使用红宝石', next: 'end_win', effect: { hp: -10 }, require: (s) => s.items && s.items.includes('红宝石') },
            { text: '投掷治疗药水', next: 'end_lose', effect: { hp: -50 }, require: (s) => !s.items || !s.items.includes('红宝石') },
            { text: '谈判求和', next: 'end_negotiate', effect: { mp: -30 } }
        ]
    },
    end_win: {
        name: '胜利结局',
        desc: '暗影龙倒下了，化作一缕青烟。你从祭坛上取回了传说中的圣剑，地下城恢复了平静。你成为了传说中的英雄！',
        choices: [
            { text: '结束冒险', next: '__end__', effect: { win: true } }
        ]
    },
    end_lose: {
        name: '失败结局',
        desc: '你的攻击毫无作用，暗影龙一口火焰将你吞噬……但似乎命运给了你再一次的机会。',
        choices: [
            { text: '重新挑战', next: 'boss', effect: { hp: 50, mp: 30 } },
            { text: '结束冒险', next: '__end__', effect: { win: false } }
        ]
    },
    end_negotiate: {
        name: '谈判结局',
        desc: '出乎意料，暗影龙竟然听懂了你的话。它讲述了自己被诅咒的故事，你用智慧解开了它的封印。它赠你一片龙鳞，化作夜空飞走。',
        choices: [
            { text: '结束冒险', next: '__end__', effect: { win: true, item: '龙鳞' } }
        ]
    }
};

function defaultState() {
    return {
        hp: 100, maxHp: 100,
        mp: 50, maxMp: 50,
        atk: 15, def: 10,
        gold: 0,
        items: [],
        flags: [],
        scene: 'entrance',
        log: [],
        win: null,
        startedAt: null
    };
}

function loadSave() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (raw && typeof raw === 'object') return raw;
    } catch (e) {}
    return null;
}

function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

function clearSave() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

function getState() {
    return loadSave();
}

function newGame() {
    const s = defaultState();
    s.startedAt = Date.now();
    saveState(s);
    return s;
}

function choose(idx) {
    const s = loadSave();
    if (!s || s.win !== null) return null;
    const scene = SCENES[s.scene];
    if (!scene) return null;
    const choice = scene.choices[idx];
    if (!choice) return null;
    if (choice.require && !choice.require(s)) return { error: '不满足条件' };
    if (choice.effect) {
        const e = choice.effect;
        if (e.hp) s.hp = Math.max(0, Math.min(s.maxHp, s.hp + e.hp));
        if (e.mp) s.mp = Math.max(0, Math.min(s.maxMp, s.mp + e.mp));
        if (e.gold) s.gold = Math.max(0, s.gold + e.gold);
        if (e.item) { s.items = s.items || []; s.items.push(e.item); }
        if (e.win !== undefined) s.win = e.win;
    }
    if (choice.flag && !s.flags.includes(choice.flag)) s.flags.push(choice.flag);
    s.log.unshift({ scene: scene.name, choice: choice.text, ts: Date.now() });
    if (s.log.length > 20) s.log.length = 20;
    if (choice.next === '__end__') {
        s.scene = '__end__';
    } else {
        s.scene = choice.next;
    }
    saveState(s);
    if (s.win === true) {
        if (window.MXOS.notify) {
            window.MXOS.notify({ title: '冒险胜利', body: '你完成了地下城冒险，载誉而归！', type: 'success' });
        }
    }
    return s;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectStyles() {
    if (document.getElementById('mxos-adventure-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-adventure-styles';
    style.textContent = `
.mxos-adv-app{display:flex;flex-direction:column;height:100%;background:linear-gradient(180deg,#0a0a0b,#1a0f1f);color:#e5e7eb;font-family:'Georgia','Times New Roman',serif;position:relative;overflow:hidden}
.mxos-adv-app::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,rgba(168,85,247,0.08),transparent 50%),radial-gradient(circle at 70% 80%,rgba(220,38,38,0.08),transparent 50%);pointer-events:none}
.mxos-adv-header{padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.mxos-adv-title{font-size:16px;font-weight:700;color:#fbbf24;letter-spacing:1px}
.mxos-adv-stats{display:flex;gap:12px;font-size:11px}
.mxos-adv-stat{display:flex;align-items:center;gap:4px}
.mxos-adv-stat .bar{width:60px;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden}
.mxos-adv-stat .bar > div{height:100%;border-radius:3px;transition:width 0.4s}
.mxos-adv-hp .bar > div{background:linear-gradient(90deg,#ef4444,#f87171)}
.mxos-adv-mp .bar > div{background:linear-gradient(90deg,#60a5fa,#60a5fa)}
.mxos-adv-body{flex:1;overflow:auto;padding:20px;position:relative;z-index:1}
.mxos-adv-scene-name{font-size:13px;color:#a78bfa;margin-bottom:8px;font-style:italic}
.mxos-adv-scene-desc{font-size:14px;line-height:1.8;color:#d1d5db;margin-bottom:20px;text-indent:2em}
.mxos-adv-choices{display:flex;flex-direction:column;gap:8px}
.mxos-adv-choice{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e5e7eb;padding:10px 16px;border-radius:8px;cursor:pointer;text-align:left;font-family:inherit;font-size:13px;transition:all 0.2s;position:relative}
.mxos-adv-choice:hover{background:rgba(251,191,36,0.1);border-color:rgba(251,191,36,0.4);color:#fbbf24;transform:translateX(4px)}
.mxos-adv-choice:disabled{opacity:0.4;cursor:not-allowed;transform:none}
.mxos-adv-choice::before{content:"▸";margin-right:8px;color:#fbbf24}
.mxos-adv-end{padding:30px 20px;text-align:center}
.mxos-adv-end-title{font-size:20px;font-weight:700;color:#fbbf24;margin-bottom:12px}
.mxos-adv-items{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.mxos-adv-item{background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;padding:2px 10px;border-radius:12px;font-size:11px}
.mxos-adv-menu{padding:30px 20px;text-align:center}
.mxos-adv-menu h2{font-size:22px;color:#fbbf24;margin:0 0 8px}
.mxos-adv-menu p{color:#9ca3af;font-size:13px;margin:0 0 20px}
.mxos-adv-btn{background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1a1a1a;border:none;padding:10px 24px;border-radius:8px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin:4px;transition:transform 0.15s}
.mxos-adv-btn:hover{transform:scale(1.04)}
.mxos-adv-btn.secondary{background:rgba(255,255,255,0.06);color:#d1d5db;border:1px solid rgba(255,255,255,0.15)}
    `;
    document.head.appendChild(style);
}

function renderScene(contentEl, s) {
    const root = document.createElement('div');
    root.className = 'mxos-adv-app';
    if (s.scene === '__end__' || s.win !== null) {
        root.innerHTML = `
            <div class="mxos-adv-end">
                <div class="mxos-adv-end-title">${s.win ? '冒险胜利' : '冒险终结'}</div>
                <div style="color:#d1d5db;font-size:14px;line-height:1.8;margin-bottom:16px">${escapeHtml(SCENES[s.win ? 'end_win' : 'end_lose'].desc)}</div>
                <div>金币：${s.gold} · 物品：${s.items.length ? s.items.map(i => `<span class="mxos-adv-item">${escapeHtml(i)}</span>`).join('') : '无'}</div>
                <div style="margin-top:20px">
                    <button class="mxos-adv-btn" id="mxosAdvNew">再来一次</button>
                    <button class="mxos-adv-btn secondary" id="mxosAdvClose">关闭</button>
                </div>
            </div>
        `;
        contentEl.innerHTML = '';
        contentEl.appendChild(root);
        root.querySelector('#mxosAdvNew').addEventListener('click', () => {
            const ns = newGame();
            renderScene(contentEl, ns);
        });
        root.querySelector('#mxosAdvClose').addEventListener('click', () => {
            const w = state.windows.find(w => w.element && w.element.contains(contentEl));
            if (w && window.MXOS.closeApp) window.MXOS.closeApp('adventure');
        });
        return;
    }
    const scene = SCENES[s.scene] || SCENES.entrance;
    const hpPct = (s.hp / s.maxHp) * 100;
    const mpPct = (s.mp / s.maxMp) * 100;
    root.innerHTML = `
        <div class="mxos-adv-header">
            <div class="mxos-adv-title">⚔ 地下城冒险</div>
            <div class="mxos-adv-stats">
                <div class="mxos-adv-stat mxos-adv-hp">HP <div class="bar"><div style="width:${hpPct}%"></div></div> ${s.hp}</div>
                <div class="mxos-adv-stat mxos-adv-mp">MP <div class="bar"><div style="width:${mpPct}%"></div></div> ${s.mp}</div>
                <div class="mxos-adv-stat" style="color:#fbbf24">金 ${s.gold}</div>
            </div>
        </div>
        <div class="mxos-adv-body">
            <div class="mxos-adv-scene-name">【${escapeHtml(scene.name)}】</div>
            <div class="mxos-adv-scene-desc">${escapeHtml(scene.desc)}</div>
            ${s.items.length ? `<div style="margin-bottom:16px"><div style="font-size:11px;color:#9ca3af;margin-bottom:4px">背包</div><div class="mxos-adv-items">${s.items.map(i => `<span class="mxos-adv-item">${escapeHtml(i)}</span>`).join('')}</div></div>` : ''}
            <div class="mxos-adv-choices" id="mxosAdvChoices"></div>
        </div>
    `;
    contentEl.innerHTML = '';
    contentEl.appendChild(root);
    const choicesEl = root.querySelector('#mxosAdvChoices');
    scene.choices.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'mxos-adv-choice';
        btn.textContent = c.text;
        if (c.require && !c.require(s)) { btn.disabled = true; }
        btn.addEventListener('click', () => {
            const ns = choose(i);
            if (ns) renderScene(contentEl, ns);
        });
        choicesEl.appendChild(btn);
    });
}

function renderApp(contentEl) {
    injectStyles();
    let s = getState();
    if (!s || s.win !== null && s.scene === '__end__') {
        if (!s) {
            const root = document.createElement('div');
            root.className = 'mxos-adv-app';
            root.innerHTML = `
                <div class="mxos-adv-menu">
                    <h2>地下城冒险</h2>
                    <p>一段文字 RPG · 探索 5 个场景 · 多种结局</p>
                    <div>
                        <button class="mxos-adv-btn" id="mxosAdvStart">开始冒险</button>
                    </div>
                    <p style="margin-top:16px;font-size:11px;color:#6b7280">提示：在终端输入 mxos adventure 也可启动</p>
                </div>
            `;
            contentEl.innerHTML = '';
            contentEl.appendChild(root);
            root.querySelector('#mxosAdvStart').addEventListener('click', () => {
                const ns = newGame();
                renderScene(contentEl, ns);
            });
            return;
        }
    }
    renderScene(contentEl, s);
}

function setupTerminalHook() {
    document.addEventListener('keydown', (e) => {
        const input = e.target;
        if (!input || !input.classList || !input.classList.contains('term-input')) return;
        if (e.key !== 'Enter') return;
        const cmd = (input.value || '').trim().toLowerCase();
        if (cmd === 'mxos adventure') {
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
            if (window.MXOS.openApp) {
                if (!state.windows.find(w => w.appId === 'adventure')) {
                    window.MXOS.openApp('adventure');
                }
            }
            if (window.MXOS.dialog && window.MXOS.dialog.toast) {
                window.MXOS.dialog.toast('冒险已启动，请查看冒险窗口', 'success');
            }
        }
    }, true);
}

function registerAppRenderer_() {
    if (appConfigs[APP_ID]) return;
    appConfigs[APP_ID] = { title: '地下城冒险', icon: 'cmd', width: 720, height: 560, content: APP_ID };
    registerAppRenderer(APP_ID, (contentEl) => renderApp(contentEl));
    const grid = document.querySelector('.start-apps-grid');
    if (!grid) { setTimeout(registerAppRenderer_, 1500); return; }
    if (grid.querySelector(`.start-app[data-app="${APP_ID}"]`)) return;
    const entry = document.createElement('div');
    entry.className = 'start-app';
    entry.dataset.app = APP_ID;
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.innerHTML = `<svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><use href="#svg-cmd"/></svg><span>地下城冒险</span>`;
    entry.addEventListener('click', () => {
        if (window.MXOS.openApp) window.MXOS.openApp(APP_ID);
    });
    grid.appendChild(entry);
}

function init() {
    injectStyles();
    setupTerminalHook();
    window.MXOS.Features.adventure = {
        newGame, choose, getState, clearSave, renderApp,
        getScenes: () => Object.keys(SCENES)
    };
    setTimeout(registerAppRenderer_, 3000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { newGame, choose, getState, clearSave };
