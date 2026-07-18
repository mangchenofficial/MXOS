import { registerAppRenderer } from '../core.js';

window.MXOS = window.MXOS || {};

const ALARM_KEY = 'mxos_clock_alarms';

function loadAlarms() {
    try {
        return JSON.parse(localStorage.getItem(ALARM_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function saveAlarms(list) {
    try {
        localStorage.setItem(ALARM_KEY, JSON.stringify(list));
    } catch (e) {}
}

const CITIES = [
    { name: '北京', tz: 'Asia/Shanghai' },
    { name: '纽约', tz: 'America/New_York' },
    { name: '伦敦', tz: 'Europe/London' },
    { name: '东京', tz: 'Asia/Tokyo' },
    { name: '悉尼', tz: 'Australia/Sydney' }
];

function getCityTime(tz) {
    try {
        const fmt = new Intl.DateTimeFormat('zh-CN', {
            timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        return fmt.format(new Date());
    } catch (e) {
        return '--:--:--';
    }
}

function getCityDate(tz) {
    try {
        return new Intl.DateTimeFormat('zh-CN', { timeZone: tz, month: 'short', day: 'numeric', weekday: 'short' }).format(new Date());
    } catch (e) {
        return '';
    }
}

function svgClock(h, m, s) {
    const hr = ((h % 12) + m / 60) * 30;
    const mr = (m + s / 60) * 6;
    const sr = s * 6;
    return `<svg viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke="rgba(255,255,255,0.85)" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
        ${[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>{
            const r=a*Math.PI/180;
            const x1=50+Math.sin(r)*40, y1=50-Math.cos(r)*40;
            const x2=50+Math.sin(r)*44, y2=50-Math.cos(r)*44;
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>`;
        }).join('')}
        <line x1="50" y1="50" x2="${50+Math.sin(hr*Math.PI/180)*24}" y2="${50-Math.cos(hr*Math.PI/180)*24}" stroke="rgba(255,255,255,0.9)" stroke-width="4"/>
        <line x1="50" y1="50" x2="${50+Math.sin(mr*Math.PI/180)*34}" y2="${50-Math.cos(mr*Math.PI/180)*34}" stroke="rgba(255,255,255,0.7)" stroke-width="2.5"/>
        <line x1="50" y1="50" x2="${50+Math.sin(sr*Math.PI/180)*38}" y2="${50-Math.cos(sr*Math.PI/180)*38}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
        <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.85)" stroke="none"/>
    </svg>`;
}

registerAppRenderer('clock', (contentEl) => {
    let tab = 'world';
    let alarms = loadAlarms();
    let timerInput = { h: 0, m: 5, s: 0 };
    let timerRemaining = 0;
    let timerRunning = false;
    let timerInterval = null;
    let swRunning = false;
    let swElapsed = 0;
    let swStart = 0;
    let swInterval = null;
    let swLaps = [];
    let tickInterval = null;
    let alarmChecked = {};

    const root = document.createElement('div');
    root.className = 'clock-app';
    root.innerHTML = `
        <style>
            .clock-app{display:flex;flex-direction:column;height:100%;color:#fff;font-family:'MiSans',sans-serif}
            .clock-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.08)}
            .clock-tab{flex:1;padding:12px;text-align:center;cursor:pointer;color:rgba(255,255,255,.55);font-size:13px;border-bottom:2px solid transparent;transition:.15s}
            .clock-tab.active{color:#fff;border-color:var(--accent-color,#3b82f6)}
            .clock-tab:hover{color:#fff}
            .clock-body{flex:1;overflow-y:auto;padding:20px}
            .world-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
            .world-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;text-align:center;backdrop-filter:blur(10px)}
            .world-time{font-size:26px;font-weight:300;margin-top:6px}
            .world-name{font-size:13px;color:#93c5fd}
            .world-date{font-size:11px;color:rgba(255,255,255,.5);margin-top:4px}
            .clock-main{display:flex;flex-direction:column;align-items:center;gap:16px;margin-bottom:20px}
            .clock-face{width:160px;height:160px}
            .clock-local{font-size:32px;font-weight:300}
            .clock-label{font-size:12px;color:rgba(255,255,255,.5)}
            .alarm-row{display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;margin-bottom:8px}
            .alarm-time{font-size:24px;font-weight:300}
            .alarm-toggle{width:42px;height:22px;background:rgba(255,255,255,.15);border-radius:11px;position:relative;cursor:pointer;transition:.2s}
            .alarm-toggle.on{background:var(--accent-color,#3b82f6)}
            .alarm-toggle::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;background:#fff;border-radius:50%;transition:.2s}
            .alarm-toggle.on::after{left:22px}
            .alarm-del{color:#ef4444;cursor:pointer;font-size:12px}
            .alarm-add{display:flex;gap:8px;margin-bottom:14px;align-items:center}
            .alarm-add input{width:54px;padding:6px;text-align:center;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:16px}
            .btn{padding:8px 16px;background:var(--accent-color,#3b82f6);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px}
            .btn.sec{background:rgba(255,255,255,.12)}
            .timer-display{font-size:48px;font-weight:300;text-align:center;margin:14px 0}
            .timer-controls{display:flex;gap:8px;justify-content:center}
            .timer-inputs{display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:10px}
            .timer-inputs input{width:54px;padding:6px;text-align:center;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:16px}
            .sw-display{font-size:42px;font-weight:300;text-align:center;margin:14px 0}
            .sw-laps{max-height:200px;overflow-y:auto;margin-top:10px}
            .sw-lap{display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}
            .section-title{font-size:13px;color:rgba(255,255,255,.55);margin-bottom:10px}
        </style>
        <div class="clock-tabs">
            <div class="clock-tab" data-tab="world">世界时钟</div>
            <div class="clock-tab" data-tab="alarm">闹钟</div>
            <div class="clock-tab" data-tab="timer">计时器</div>
            <div class="clock-tab" data-tab="stopwatch">秒表</div>
        </div>
        <div class="clock-body" id="clockBody"></div>
    `;
    contentEl.appendChild(root);

    const body = root.querySelector('#clockBody');

    root.querySelectorAll('.clock-tab').forEach(el => {
        el.addEventListener('click', () => {
            tab = el.dataset.tab;
            render();
        });
    });

    function render() {
        root.querySelectorAll('.clock-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });
        if (tab === 'world') renderWorld();
        else if (tab === 'alarm') renderAlarm();
        else if (tab === 'timer') renderTimer();
        else if (tab === 'stopwatch') renderStopwatch();
    }

    function renderWorld() {
        const now = new Date();
        const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
        let html = `<div class="clock-main">
            <div class="clock-face">${svgClock(h, m, s)}</div>
            <div class="clock-local" id="localTime">${pad(h)}:${pad(m)}:${pad(s)}</div>
            <div class="clock-label">本地时间</div>
        </div>
        <div class="world-grid">`;
        CITIES.forEach(c => {
            html += `<div class="world-card">
                <div class="world-name">${c.name}</div>
                <div class="world-time" data-tz="${c.tz}">${getCityTime(c.tz)}</div>
                <div class="world-date">${getCityDate(c.tz)}</div>
            </div>`;
        });
        html += '</div>';
        body.innerHTML = html;
    }

    function renderAlarm() {
        let html = `<div class="section-title">添加闹钟</div>
        <div class="alarm-add">
            <input type="number" id="alarmH" min="0" max="23" value="07" style="width:54px"> :
            <input type="number" id="alarmM" min="0" max="59" value="00" style="width:54px">
            <button class="btn" id="alarmAddBtn">添加</button>
        </div>
        <div class="section-title">闹钟列表</div>`;
        if (!alarms.length) {
            html += '<div style="color:rgba(255,255,255,.4);text-align:center;padding:30px;font-size:13px">暂无闹钟</div>';
        } else {
            alarms.forEach((a, i) => {
                html += `<div class="alarm-row">
                    <div class="alarm-time">${pad(a.h)}:${pad(a.m)}</div>
                    <div style="display:flex;gap:12px;align-items:center">
                        <div class="alarm-toggle ${a.on?'on':''}" data-i="${i}"></div>
                        <div class="alarm-del" data-i="${i}">删除</div>
                    </div>
                </div>`;
            });
        }
        body.innerHTML = html;

        body.querySelector('#alarmAddBtn').addEventListener('click', () => {
            const h = parseInt(body.querySelector('#alarmH').value) || 0;
            const m = parseInt(body.querySelector('#alarmM').value) || 0;
            if (h < 0 || h > 23 || m < 0 || m > 59) return;
            alarms.push({ h, m, on: true });
            saveAlarms(alarms);
            renderAlarm();
        });
        body.querySelectorAll('.alarm-toggle').forEach(el => {
            el.addEventListener('click', () => {
                const i = parseInt(el.dataset.i);
                alarms[i].on = !alarms[i].on;
                saveAlarms(alarms);
                el.classList.toggle('on', alarms[i].on);
            });
        });
        body.querySelectorAll('.alarm-del').forEach(el => {
            el.addEventListener('click', () => {
                alarms.splice(parseInt(el.dataset.i), 1);
                saveAlarms(alarms);
                renderAlarm();
            });
        });
    }

    function renderTimer() {
        body.innerHTML = `
            <div class="timer-display" id="timerDisplay">${formatTime(timerRemaining)}</div>
            ${!timerRunning && timerRemaining === 0 ? `
            <div class="timer-inputs">
                <input type="number" id="tH" min="0" max="23" value="${timerInput.h}" style="width:54px"> 时
                <input type="number" id="tM" min="0" max="59" value="${timerInput.m}" style="width:54px"> 分
                <input type="number" id="tS" min="0" max="59" value="${timerInput.s}" style="width:54px"> 秒
            </div>` : ''}
            <div class="timer-controls">
                ${!timerRunning ? '<button class="btn" id="timerStart">开始</button>' : '<button class="btn" id="timerPause">暂停</button>'}
                <button class="btn sec" id="timerReset">重置</button>
            </div>
        `;
        const disp = body.querySelector('#timerDisplay');
        const hIn = body.querySelector('#tH');
        const mIn = body.querySelector('#tM');
        const sIn = body.querySelector('#tS');
        const startBtn = body.querySelector('#timerStart');
        const pauseBtn = body.querySelector('#timerPause');
        const resetBtn = body.querySelector('#timerReset');

        if (startBtn) startBtn.addEventListener('click', () => {
            if (timerRemaining === 0 && hIn) {
                timerInput = { h: parseInt(hIn.value)||0, m: parseInt(mIn.value)||0, s: parseInt(sIn.value)||0 };
                timerRemaining = timerInput.h*3600 + timerInput.m*60 + timerInput.s;
            }
            if (timerRemaining <= 0) return;
            timerRunning = true;
            startTimerInterval(disp);
            renderTimer();
        });
        if (pauseBtn) pauseBtn.addEventListener('click', () => {
            timerRunning = false;
            clearInterval(timerInterval);
            renderTimer();
        });
        if (resetBtn) resetBtn.addEventListener('click', () => {
            timerRunning = false;
            clearInterval(timerInterval);
            timerRemaining = 0;
            renderTimer();
        });
    }

    function startTimerInterval(disp) {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerRemaining--;
            if (disp) disp.textContent = formatTime(Math.max(0, timerRemaining));
            if (timerRemaining <= 0) {
                timerRunning = false;
                clearInterval(timerInterval);
                notifyTimerDone();
                renderTimer();
            }
        }, 1000);
    }

    function notifyTimerDone() {
        if (window.MXOS && typeof window.MXOS.notify === 'function') {
            window.MXOS.notify({ title: '计时器', body: '计时器时间到！', type: 'info' });
        }
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
            osc.stop(ctx.currentTime + 1.5);
        } catch (e) {}
    }

    function renderStopwatch() {
        body.innerHTML = `
            <div class="sw-display" id="swDisplay">${formatSW(swRunning ? swElapsed + (Date.now()-swStart) : swElapsed)}</div>
            <div class="timer-controls">
                ${!swRunning ? '<button class="btn" id="swStart">开始</button>' : '<button class="btn" id="swPause">暂停</button>'}
                <button class="btn sec" id="swLap">计次</button>
                <button class="btn sec" id="swReset">重置</button>
            </div>
            <div class="sw-laps">${swLaps.map((l,i)=>`<div class="sw-lap"><span>第${i+1}次</span><span>${formatSW(l)}</span></div>`).join('')}</div>
        `;
        const disp = body.querySelector('#swDisplay');
        const startBtn = body.querySelector('#swStart');
        const pauseBtn = body.querySelector('#swPause');
        const lapBtn = body.querySelector('#swLap');
        const resetBtn = body.querySelector('#swReset');

        if (startBtn) startBtn.addEventListener('click', () => {
            swRunning = true;
            swStart = Date.now();
            startSWInterval(disp);
            renderStopwatch();
        });
        if (pauseBtn) pauseBtn.addEventListener('click', () => {
            swElapsed += Date.now() - swStart;
            swRunning = false;
            clearInterval(swInterval);
            renderStopwatch();
        });
        if (lapBtn) lapBtn.addEventListener('click', () => {
            const total = swRunning ? swElapsed + (Date.now()-swStart) : swElapsed;
            swLaps.unshift(total);
            renderStopwatch();
        });
        if (resetBtn) resetBtn.addEventListener('click', () => {
            swRunning = false;
            swElapsed = 0;
            swLaps = [];
            clearInterval(swInterval);
            renderStopwatch();
        });
    }

    function startSWInterval(disp) {
        clearInterval(swInterval);
        swInterval = setInterval(() => {
            if (disp) disp.textContent = formatSW(swElapsed + (Date.now()-swStart));
        }, 50);
    }

    function pad(n) { return String(n).padStart(2, '0'); }
    function formatTime(sec) {
        sec = Math.max(0, sec);
        const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    function formatSW(ms) {
        const total = Math.floor(ms/10);
        const cs = total%100, s = Math.floor(total/100)%60, m = Math.floor(total/6000)%60, h = Math.floor(total/360000);
        return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}` : `${pad(m)}:${pad(s)}.${pad(cs)}`;
    }

    function tick() {
        if (tab === 'world') {
            const now = new Date();
            const lt = body.querySelector('#localTime');
            if (lt) lt.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            const face = body.querySelector('.clock-face');
            if (face) face.innerHTML = svgClock(now.getHours(), now.getMinutes(), now.getSeconds());
            body.querySelectorAll('.world-time').forEach(el => {
                el.textContent = getCityTime(el.dataset.tz);
            });
        }
        if (tab === 'stopwatch' && swRunning) {
            const disp = body.querySelector('#swDisplay');
            if (disp) disp.textContent = formatSW(swElapsed + (Date.now()-swStart));
        }
        checkAlarms();
    }

    function checkAlarms() {
        const now = new Date();
        const key = `${now.getHours()}:${now.getMinutes()}`;
        alarms.forEach(a => {
            const ak = `${a.h}:${a.m}`;
            if (a.on && ak === key) {
                if (!alarmChecked[key]) {
                    alarmChecked[key] = true;
                    if (window.MXOS && typeof window.MXOS.notify === 'function') {
                        window.MXOS.notify({ title: '闹钟', body: `现在是 ${pad(a.h)}:${pad(a.m)}`, type: 'warning' });
                    }
                    try {
                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain); gain.connect(ctx.destination);
                        osc.frequency.value = 660;
                        gain.gain.setValueAtTime(0.3, ctx.currentTime);
                        osc.start();
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
                        osc.stop(ctx.currentTime + 2);
                    } catch (e) {}
                }
            }
        });
        const cur = new Date();
        if (cur.getSeconds() === 0) {
            Object.keys(alarmChecked).forEach(k => { if (k !== key) delete alarmChecked[k]; });
        }
    }

    tickInterval = setInterval(tick, 1000);
    render();

    const observer = new MutationObserver(() => {
        if (!document.body.contains(root)) {
            clearInterval(tickInterval);
            clearInterval(timerInterval);
            clearInterval(swInterval);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

window.MXOS.Clock = {
    getCities: () => CITIES.slice(),
    getCityTime,
    getAlarms: () => loadAlarms(),
    setAlarms(list) { saveAlarms(list); }
};

console.log('[MXOS.Clock] 时钟应用已加载');
