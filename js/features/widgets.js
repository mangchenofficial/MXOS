window.MXOS = window.MXOS || {};

const STORAGE_KEY = 'mxos_widgets';

const WIDGET_ICONS = {
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    weather: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    world: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    resize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 22 22 17 22"/><polyline points="2 7 2 2 7 2"/><line x1="22" y1="22" x2="14" y2="14"/><line x1="2" y1="2" x2="10" y2="10"/></svg>'
};

const WIDGET_TYPES = {
    clock: { label: '时钟', icon: 'clock', defaultSize: { w: 220, h: 220 } },
    weather: { label: '天气', icon: 'weather', defaultSize: { w: 260, h: 180 } },
    note: { label: '便签', icon: 'note', defaultSize: { w: 240, h: 220 } },
    todo: { label: '待办', icon: 'todo', defaultSize: { w: 260, h: 280 } },
    monitor: { label: '系统监控', icon: 'monitor', defaultSize: { w: 280, h: 220 } },
    battery: { label: '电池', icon: 'battery', defaultSize: { w: 220, h: 140 } },
    calendar: { label: '日历', icon: 'calendar', defaultSize: { w: 280, h: 300 } },
    world: { label: '世界时钟', icon: 'world', defaultSize: { w: 240, h: 260 } }
};

const WORLD_CITIES = [
    { name: '北京', tz: 'Asia/Shanghai' },
    { name: '纽约', tz: 'America/New_York' },
    { name: '伦敦', tz: 'Europe/London' },
    { name: '东京', tz: 'Asia/Tokyo' },
    { name: '巴黎', tz: 'Europe/Paris' }
];

let widgets = [];
let widgetCounter = 0;
let layerEl = null;
let addMenuEl = null;
const widgetTimers = new Map();

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        widgets = Array.isArray(saved) ? saved : [];
        widgetCounter = widgets.reduce((m, w) => Math.max(m, parseInt(w.id.replace('w-', ''), 10) || 0), 0);
    } catch {
        widgets = [];
        widgetCounter = 0;
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    } catch (e) {}
}

function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function getLayer() {
    if (layerEl) return layerEl;
    layerEl = document.getElementById('widgetsLayer');
    if (!layerEl) {
        const l = document.createElement('div');
        l.id = 'widgetsLayer';
        document.body.appendChild(l);
        layerEl = l;
    }
    return layerEl;
}

function buildWidgetElement(widget) {
    const el = document.createElement('div');
    el.className = 'mx-widget';
    el.dataset.id = widget.id;
    el.dataset.type = widget.type;
    el.style.left = widget.x + 'px';
    el.style.top = widget.y + 'px';
    el.style.width = widget.w + 'px';
    el.style.height = widget.h + 'px';

    const type = WIDGET_TYPES[widget.type];
    const header = document.createElement('div');
    header.className = 'mx-widget-header';
    header.innerHTML = `
        <span class="mx-widget-icon">${WIDGET_ICONS[type.icon]}</span>
        <span class="mx-widget-title">${escapeHtml(type.label)}</span>
        <button class="mx-widget-close" aria-label="移除小组件">${WIDGET_ICONS.close}</button>
    `;

    const body = document.createElement('div');
    body.className = 'mx-widget-body';

    const resize = document.createElement('div');
    resize.className = 'mx-widget-resize';
    resize.innerHTML = WIDGET_ICONS.resize;

    el.appendChild(header);
    el.appendChild(body);
    el.appendChild(resize);

    header.querySelector('.mx-widget-close').addEventListener('click', (e) => {
        e.stopPropagation();
        remove(widget.id);
    });

    bindDrag(el, header, widget);
    bindResize(el, resize, widget);

    renderBody(body, widget);
    return el;
}

function bindDrag(el, handle, widget) {
    let startX, startY, startLeft, startTop, dragging = false;
    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('.mx-widget-close')) return;
        if (e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(el.style.left) || 0;
        startTop = parseInt(el.style.top) || 0;
        el.classList.add('dragging');
        raiseWidget(widget.id);
        const onMove = (ev) => {
            if (!dragging) return;
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            let nx = startLeft + dx;
            let ny = startTop + dy;
            nx = Math.max(0, Math.min(window.innerWidth - 60, nx));
            ny = Math.max(0, Math.min(window.innerHeight - 80, ny));
            el.style.left = nx + 'px';
            el.style.top = ny + 'px';
        };
        const onUp = () => {
            dragging = false;
            el.classList.remove('dragging');
            widget.x = parseInt(el.style.left) || 0;
            widget.y = parseInt(el.style.top) || 0;
            saveState();
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function bindResize(el, handle, widget) {
    let startX, startY, startW, startH, resizing = false;
    handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = el.offsetWidth;
        startH = el.offsetHeight;
        el.classList.add('resizing');
        const onMove = (ev) => {
            if (!resizing) return;
            const dw = ev.clientX - startX;
            const dh = ev.clientY - startY;
            let nw = Math.max(160, startW + dw);
            let nh = Math.max(120, startH + dh);
            el.style.width = nw + 'px';
            el.style.height = nh + 'px';
        };
        const onUp = () => {
            resizing = false;
            el.classList.remove('resizing');
            widget.w = el.offsetWidth;
            widget.h = el.offsetHeight;
            saveState();
            const body = el.querySelector('.mx-widget-body');
            if (body) renderBody(body, widget);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function raiseWidget(id) {
    const layer = getLayer();
    const el = layer.querySelector(`.mx-widget[data-id="${id}"]`);
    if (!el) return;
    layer.appendChild(el);
}

function renderBody(body, widget) {
    clearWidgetTimers(widget.id);
    body.innerHTML = '';
    switch (widget.type) {
        case 'clock': renderClock(body, widget); break;
        case 'weather': renderWeather(body, widget); break;
        case 'note': renderNote(body, widget); break;
        case 'todo': renderTodo(body, widget); break;
        case 'monitor': renderMonitor(body, widget); break;
        case 'battery': renderBattery(body, widget); break;
        case 'calendar': renderCalendar(body, widget); break;
        case 'world': renderWorld(body, widget); break;
    }
}

function addWidgetTimer(widgetId, timerId) {
    if (!widgetTimers.has(widgetId)) widgetTimers.set(widgetId, []);
    widgetTimers.get(widgetId).push(timerId);
}

function clearWidgetTimers(widgetId) {
    const arr = widgetTimers.get(widgetId);
    if (arr) {
        arr.forEach(t => clearInterval(t));
        widgetTimers.delete(widgetId);
    }
}

function renderClock(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-clock';
    wrap.innerHTML = `
        <div class="mw-clock-analog">
            <svg viewBox="0 0 100 100" class="mw-clock-svg">
                <circle cx="50" cy="50" r="46" class="mw-clock-face"/>
                <g class="mw-clock-marks"></g>
                <line x1="50" y1="50" x2="50" y2="22" class="mw-clock-hand mw-clock-hour"/>
                <line x1="50" y1="50" x2="50" y2="14" class="mw-clock-hand mw-clock-minute"/>
                <line x1="50" y1="56" x2="50" y2="20" class="mw-clock-hand mw-clock-second"/>
                <circle cx="50" cy="50" r="3" class="mw-clock-center"/>
            </svg>
        </div>
        <div class="mw-clock-digital">--:--</div>
        <div class="mw-clock-date">--</div>
    `;
    body.appendChild(wrap);

    let marks = '';
    for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * Math.PI / 180;
        const x1 = 50 + Math.sin(angle) * 40;
        const y1 = 50 - Math.cos(angle) * 40;
        const x2 = 50 + Math.sin(angle) * 44;
        const y2 = 50 - Math.cos(angle) * 44;
        marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="mw-clock-mark"/>`;
    }
    wrap.querySelector('.mw-clock-marks').innerHTML = marks;

    const hour = wrap.querySelector('.mw-clock-hour');
    const minute = wrap.querySelector('.mw-clock-minute');
    const second = wrap.querySelector('.mw-clock-second');
    const digital = wrap.querySelector('.mw-clock-digital');
    const dateEl = wrap.querySelector('.mw-clock-date');

    function tick() {
        const now = new Date();
        const h = now.getHours() % 12;
        const m = now.getMinutes();
        const s = now.getSeconds();
        const ms = now.getMilliseconds();
        const hourAngle = (h + m / 60) * 30;
        const minAngle = (m + s / 60) * 6;
        const secAngle = (s + ms / 1000) * 6;
        hour.setAttribute('transform', `rotate(${hourAngle} 50 50)`);
        minute.setAttribute('transform', `rotate(${minAngle} 50 50)`);
        second.setAttribute('transform', `rotate(${secAngle} 50 50)`);
        digital.textContent = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateEl.textContent = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    }
    tick();
    const t = setInterval(tick, 1000);
    addWidgetTimer(widget.id, t);
}

function renderWeather(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-weather';
    wrap.innerHTML = `
        <div class="mw-weather-loading">加载中…</div>
    `;
    body.appendChild(wrap);
    async function load() {
        if (!window.MXOS.Real || typeof window.MXOS.Real.weather !== 'function') {
            wrap.innerHTML = `<div class="mw-weather-empty">天气服务不可用</div>`;
            return;
        }
        try {
            const w = await window.MXOS.Real.weather();
            if (!w) {
                wrap.innerHTML = `<div class="mw-weather-empty">无法获取天气</div>`;
                return;
            }
            wrap.innerHTML = `
                <div class="mw-weather-main">
                    <div class="mw-weather-temp">${Math.round(w.temperature)}°</div>
                    <div class="mw-weather-desc">${escapeHtml(w.description || '')}</div>
                </div>
                <div class="mw-weather-extra">
                    <div class="mw-weather-row"><span>风速</span><span>${Math.round(w.windspeed)} km/h</span></div>
                    <div class="mw-weather-row"><span>来源</span><span>${w.isDay === false ? '夜间' : '日间'}</span></div>
                </div>
            `;
        } catch (e) {
            wrap.innerHTML = `<div class="mw-weather-empty">天气获取失败</div>`;
        }
    }
    load();
}

function renderNote(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-note';
    const ta = document.createElement('div');
    ta.className = 'mw-note-area';
    ta.contentEditable = 'true';
    ta.spellcheck = false;
    ta.textContent = widget.noteContent || '在这里输入笔记…';
    ta.addEventListener('input', () => {
        widget.noteContent = ta.textContent;
        saveState();
    });
    ta.addEventListener('mousedown', (e) => e.stopPropagation());
    wrap.appendChild(ta);
    body.appendChild(wrap);
}

function renderTodo(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-todo';
    if (!Array.isArray(widget.todos)) widget.todos = [];

    const inputRow = document.createElement('div');
    inputRow.className = 'mw-todo-input-row';
    inputRow.innerHTML = `
        <input type="text" class="mw-todo-input" placeholder="添加任务…">
        <button class="mw-todo-add">${WIDGET_ICONS.plus}</button>
    `;
    const list = document.createElement('div');
    list.className = 'mw-todo-list';
    wrap.appendChild(inputRow);
    wrap.appendChild(list);
    body.appendChild(wrap);

    const input = inputRow.querySelector('.mw-todo-input');
    const addBtn = inputRow.querySelector('.mw-todo-add');

    function rerender() {
        list.innerHTML = '';
        if (widget.todos.length === 0) {
            list.innerHTML = '<div class="mw-todo-empty">暂无任务</div>';
            return;
        }
        widget.todos.forEach((t, i) => {
            const item = document.createElement('div');
            item.className = 'mw-todo-item' + (t.done ? ' done' : '');
            item.innerHTML = `
                <button class="mw-todo-check" aria-label="切换完成">${t.done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</button>
                <span class="mw-todo-text">${escapeHtml(t.text)}</span>
                <button class="mw-todo-del" aria-label="删除">${WIDGET_ICONS.trash}</button>
            `;
            item.querySelector('.mw-todo-check').addEventListener('click', (e) => {
                e.stopPropagation();
                widget.todos[i].done = !widget.todos[i].done;
                saveState();
                rerender();
            });
            item.querySelector('.mw-todo-del').addEventListener('click', (e) => {
                e.stopPropagation();
                widget.todos.splice(i, 1);
                saveState();
                rerender();
            });
            list.appendChild(item);
        });
    }
    function addTodo() {
        const v = input.value.trim();
        if (!v) return;
        widget.todos.unshift({ text: v, done: false });
        input.value = '';
        saveState();
        rerender();
    }
    addBtn.addEventListener('click', (e) => { e.stopPropagation(); addTodo(); });
    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); addTodo(); }
    });
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    rerender();
}

function renderMonitor(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-monitor';
    wrap.innerHTML = `
        <div class="mw-monitor-row">
            <span class="mw-monitor-label">FPS</span>
            <div class="mw-monitor-bar"><div class="mw-monitor-fill mw-fill-fps"></div></div>
            <span class="mw-monitor-val mw-val-fps">--</span>
        </div>
        <div class="mw-monitor-row">
            <span class="mw-monitor-label">内存</span>
            <div class="mw-monitor-bar"><div class="mw-monitor-fill mw-fill-mem"></div></div>
            <span class="mw-monitor-val mw-val-mem">--</span>
        </div>
        <div class="mw-monitor-row">
            <span class="mw-monitor-label">长任务</span>
            <div class="mw-monitor-bar"><div class="mw-monitor-fill mw-fill-task"></div></div>
            <span class="mw-monitor-val mw-val-task">--</span>
        </div>
    `;
    body.appendChild(wrap);

    const fpsVal = wrap.querySelector('.mw-val-fps');
    const memVal = wrap.querySelector('.mw-val-mem');
    const taskVal = wrap.querySelector('.mw-val-task');
    const fpsFill = wrap.querySelector('.mw-fill-fps');
    const memFill = wrap.querySelector('.mw-fill-mem');
    const taskFill = wrap.querySelector('.mw-fill-task');

    function update() {
        if (!window.MXOS.Real || typeof window.MXOS.Real.perf !== 'function') return;
        try {
            const snap = window.MXOS.Real.perf();
            if (!snap) return;
            const fps = snap.fps || 0;
            fpsVal.textContent = fps;
            fpsFill.style.width = Math.min(100, (fps / 60) * 100) + '%';
            if (snap.memory && snap.memory.supported) {
                const used = snap.memory.usedJSHeapSize || 0;
                const limit = snap.memory.jsHeapSizeLimit || 1;
                const pct = Math.round((used / limit) * 100);
                memVal.textContent = (used / 1048576).toFixed(1) + ' MB';
                memFill.style.width = pct + '%';
            } else {
                memVal.textContent = 'N/A';
                memFill.style.width = '0%';
            }
            const lt = snap.longTasks ? snap.longTasks.count : 0;
            taskVal.textContent = lt;
            taskFill.style.width = Math.min(100, lt * 5) + '%';
        } catch (e) {}
    }
    update();
    const t = setInterval(update, 1500);
    addWidgetTimer(widget.id, t);
}

function renderBattery(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-battery';
    wrap.innerHTML = `
        <div class="mw-battery-icon-wrap">
            <div class="mw-battery-shell">
                <div class="mw-battery-level"></div>
                <div class="mw-battery-tip"></div>
            </div>
        </div>
        <div class="mw-battery-info">
            <div class="mw-battery-pct">--</div>
            <div class="mw-battery-status">读取中…</div>
        </div>
    `;
    body.appendChild(wrap);

    const levelEl = wrap.querySelector('.mw-battery-level');
    const pctEl = wrap.querySelector('.mw-battery-pct');
    const statusEl = wrap.querySelector('.mw-battery-status');

    async function update() {
        if (!window.MXOS.Real || typeof window.MXOS.Real.battery !== 'function') {
            pctEl.textContent = 'N/A';
            statusEl.textContent = '不支持';
            return;
        }
        try {
            const b = await window.MXOS.Real.battery();
            if (!b) {
                pctEl.textContent = 'N/A';
                statusEl.textContent = '不可用';
                return;
            }
            const pct = typeof b.level === 'number' ? b.level : null;
            if (pct != null) {
                levelEl.style.width = pct + '%';
                pctEl.textContent = pct + '%';
            } else {
                pctEl.textContent = '--';
            }
            if (pct != null) {
                if (pct <= 20) levelEl.style.background = '#ef4444';
                else if (pct <= 50) levelEl.style.background = '#fbbf24';
                else levelEl.style.background = '#4ade80';
            }
            statusEl.textContent = b.charging ? '充电中' : '使用电池';
        } catch (e) {}
    }
    update();
    const t = setInterval(update, 5000);
    addWidgetTimer(widget.id, t);
}

function renderCalendar(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-calendar';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    let html = `<div class="mw-calendar-title">${year}年${month + 1}月</div><div class="mw-calendar-grid">`;
    weekDays.forEach(d => { html += `<div class="mw-calendar-dow">${d}</div>`; });
    for (let i = 0; i < firstDay; i++) html += '<div class="mw-calendar-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === today;
        html += `<div class="mw-calendar-day${isToday ? ' today' : ''}">${d}</div>`;
    }
    html += '</div>';
    wrap.innerHTML = html;
    body.appendChild(wrap);
}

function renderWorld(body, widget) {
    const wrap = document.createElement('div');
    wrap.className = 'mw-world';
    const cities = WORLD_CITIES;
    let html = '';
    cities.forEach(c => {
        html += `<div class="mw-world-row" data-tz="${c.tz}">
            <span class="mw-world-name">${c.name}</span>
            <span class="mw-world-time">--:--</span>
        </div>`;
    });
    wrap.innerHTML = html;
    body.appendChild(wrap);

    const rows = wrap.querySelectorAll('.mw-world-row');
    function tick() {
        const now = new Date();
        rows.forEach(row => {
            const tz = row.dataset.tz;
            try {
                const time = now.toLocaleTimeString('zh-CN', {
                    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
                });
                row.querySelector('.mw-world-time').textContent = time;
            } catch (e) {
                row.querySelector('.mw-world-time').textContent = '--:--';
            }
        });
    }
    tick();
    const t = setInterval(tick, 1000);
    addWidgetTimer(widget.id, t);
}

function add(type, x, y) {
    const def = WIDGET_TYPES[type];
    if (!def) return null;
    widgetCounter++;
    const id = 'w-' + widgetCounter;
    const w = def.defaultSize.w;
    const h = def.defaultSize.h;
    const px = (typeof x === 'number') ? x : Math.max(20, Math.round((window.innerWidth - w) / 2));
    const py = (typeof y === 'number') ? y : Math.max(20, Math.round((window.innerHeight - h) / 2));
    const widget = {
        id, type, x: px, y: py, w, h,
        noteContent: type === 'note' ? '' : undefined,
        todos: type === 'todo' ? [] : undefined
    };
    widgets.push(widget);
    const el = buildWidgetElement(widget);
    getLayer().appendChild(el);
    requestAnimationFrame(() => el.classList.add('appear'));
    saveState();
    return id;
}

function remove(id) {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx === -1) return false;
    widgets.splice(idx, 1);
    clearWidgetTimers(id);
    const layer = getLayer();
    const el = layer.querySelector(`.mx-widget[data-id="${id}"]`);
    if (el) {
        el.classList.add('removing');
        setTimeout(() => el.remove(), 200);
    }
    saveState();
    return true;
}

function list() {
    return widgets.map(w => ({ ...w }));
}

function showAddMenu(x, y) {
    hideAddMenu();
    const menu = document.createElement('div');
    menu.className = 'mw-add-menu';
    menu.id = 'widgetAddMenu';
    let html = '<div class="mw-add-menu-title">添加小组件</div>';
    Object.keys(WIDGET_TYPES).forEach(key => {
        const t = WIDGET_TYPES[key];
        html += `<div class="mw-add-menu-item" data-type="${key}">
            <span class="mw-add-menu-icon">${WIDGET_ICONS[t.icon]}</span>
            <span class="mw-add-menu-label">${t.label}</span>
        </div>`;
    });
    menu.innerHTML = html;
    document.body.appendChild(menu);
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 10) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 10) + 'px';
    requestAnimationFrame(() => menu.classList.add('show'));

    menu.querySelectorAll('.mw-add-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const type = item.dataset.type;
            add(type, x, y);
            hideAddMenu();
        });
    });

    const closer = (e) => {
        if (e.target.closest('#widgetAddMenu')) return;
        hideAddMenu();
        document.removeEventListener('mousedown', closer, true);
    };
    setTimeout(() => {
        document.addEventListener('mousedown', closer, true);
    }, 0);
    addMenuEl = menu;
}

function hideAddMenu() {
    if (addMenuEl) {
        const m = addMenuEl;
        m.classList.remove('show');
        setTimeout(() => m.remove(), 180);
        addMenuEl = null;
    } else {
        const existing = document.getElementById('widgetAddMenu');
        if (existing) existing.remove();
    }
}

function renderAll() {
    const layer = getLayer();
    layer.innerHTML = '';
    widgetTimers.forEach((arr, id) => arr.forEach(t => clearInterval(t)));
    widgetTimers.clear();
    widgets.forEach(w => {
        const el = buildWidgetElement(w);
        layer.appendChild(el);
        requestAnimationFrame(() => el.classList.add('appear'));
    });
}

function injectStyles() {
    if (document.getElementById('mw-styles')) return;
    const style = document.createElement('style');
    style.id = 'mw-styles';
    style.textContent = `
#widgetsLayer {
    position: fixed;
    inset: 0;
    z-index: 1050;
    pointer-events: none;
}
.mx-widget {
    position: absolute;
    background: rgba(24, 28, 38, 0.55);
    backdrop-filter: blur(28px) saturate(180%) brightness(1.08);
    -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
    color: #fff;
    opacity: 0;
    transform: scale(0.92) translateY(8px);
    transition: opacity 240ms var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)),
                transform 240ms var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)),
                box-shadow 200ms ease;
}
.mx-widget.appear {
    opacity: 1;
    transform: scale(1) translateY(0);
}
.mx-widget.removing {
    opacity: 0;
    transform: scale(0.9);
    transition: opacity 180ms ease, transform 180ms ease;
}
.mx-widget.dragging {
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    cursor: grabbing;
}
.mx-widget.resizing { box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); }
.mx-widget-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    cursor: grab;
    flex-shrink: 0;
    user-select: none;
}
.mx-widget-header:active { cursor: grabbing; }
.mx-widget-icon {
    display: flex;
    color: var(--accent, #3b82f6);
}
.mx-widget-icon svg { width: 14px; height: 14px; }
.mx-widget-title {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0.3px;
}
.mx-widget-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    padding: 0;
    transition: background 120ms, color 120ms;
}
.mx-widget-close:hover { background: rgba(239, 68, 68, 0.3); color: #fff; }
.mx-widget-close svg { width: 12px; height: 12px; }
.mx-widget-body {
    flex: 1;
    overflow: hidden;
    padding: 12px;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.mx-widget-resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 18px;
    height: 18px;
    cursor: nwse-resize;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    color: rgba(255, 255, 255, 0.3);
    opacity: 0;
    transition: opacity 160ms ease;
}
.mx-widget:hover .mx-widget-resize { opacity: 1; }
.mx-widget-resize svg { width: 12px; height: 12px; }

/* Clock */
.mw-clock { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; }
.mw-clock-svg { width: 100%; max-width: 130px; height: auto; flex-shrink: 1; }
.mw-clock-face { fill: rgba(255,255,255,0.04); stroke: rgba(255,255,255,0.2); stroke-width: 2; }
.mw-clock-mark { stroke: rgba(255,255,255,0.5); stroke-width: 2; stroke-linecap: round; }
.mw-clock-hand { stroke-linecap: round; transform-origin: 50px 50px; }
.mw-clock-hour { stroke: #fff; stroke-width: 4; }
.mw-clock-minute { stroke: #fff; stroke-width: 3; }
.mw-clock-second { stroke: var(--accent, #3b82f6); stroke-width: 1.5; }
.mw-clock-center { fill: var(--accent, #3b82f6); }
.mw-clock-digital { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: 1px; }
.mw-clock-date { font-size: 11px; color: rgba(255,255,255,0.6); }

/* Weather */
.mw-weather { display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 8px; }
.mw-weather-main { display: flex; align-items: baseline; gap: 12px; }
.mw-weather-temp { font-size: 40px; font-weight: 700; line-height: 1; }
.mw-weather-desc { font-size: 14px; color: rgba(255,255,255,0.8); }
.mw-weather-extra { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: rgba(255,255,255,0.6); }
.mw-weather-row { display: flex; justify-content: space-between; }
.mw-weather-loading, .mw-weather-empty { color: rgba(255,255,255,0.5); font-size: 13px; text-align: center; padding: 20px 0; }

/* Note */
.mw-note { height: 100%; }
.mw-note-area {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px;
    color: #fff;
    font-size: 13px;
    font-family: inherit;
    line-height: 1.5;
    outline: none;
    overflow-y: auto;
    resize: none;
    cursor: text;
    user-select: text;
}
.mw-note-area:focus { border-color: var(--accent, #3b82f6); background: rgba(255, 255, 255, 0.06); }

/* Todo */
.mw-todo { display: flex; flex-direction: column; height: 100%; gap: 8px; }
.mw-todo-input-row { display: flex; gap: 6px; flex-shrink: 0; }
.mw-todo-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 10px;
    color: #fff;
    font-size: 12px;
    font-family: inherit;
    outline: none;
}
.mw-todo-input:focus { border-color: var(--accent, #3b82f6); }
.mw-todo-add {
    background: var(--accent-color, #3b82f6);
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    transition: opacity 120ms;
}
.mw-todo-add:hover { opacity: 0.85; }
.mw-todo-add svg { width: 14px; height: 14px; }
.mw-todo-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.mw-todo-empty { color: rgba(255,255,255,0.4); font-size: 12px; text-align: center; padding: 16px 0; }
.mw-todo-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    font-size: 12px;
    animation: mwFadeIn 200ms var(--ease-out, ease);
}
.mw-todo-item.done .mw-todo-text { text-decoration: line-through; color: rgba(255,255,255,0.4); }
.mw-todo-check {
    width: 18px; height: 18px;
    border-radius: 4px;
    border: 1.5px solid rgba(255,255,255,0.3);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
    color: #fff;
}
.mw-todo-item.done .mw-todo-check { background: var(--accent-color, #3b82f6); border-color: var(--accent-color, #3b82f6); }
.mw-todo-check svg { width: 12px; height: 12px; }
.mw-todo-text { flex: 1; min-width: 0; word-break: break-word; }
.mw-todo-del {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    padding: 0;
    width: 18px; height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    flex-shrink: 0;
}
.mw-todo-del:hover { color: #ef4444; }
.mw-todo-del svg { width: 12px; height: 12px; }

/* Monitor */
.mw-monitor { display: flex; flex-direction: column; justify-content: center; gap: 12px; height: 100%; }
.mw-monitor-row { display: flex; align-items: center; gap: 10px; }
.mw-monitor-label { font-size: 11px; color: rgba(255,255,255,0.7); width: 48px; flex-shrink: 0; }
.mw-monitor-bar { flex: 1; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
.mw-monitor-fill { height: 100%; width: 0%; border-radius: 4px; transition: width 400ms var(--ease-out, ease); }
.mw-fill-fps { background: linear-gradient(90deg, #4ade80, #22d3ee); }
.mw-fill-mem { background: linear-gradient(90deg, #fbbf24, #f97316); }
.mw-fill-task { background: linear-gradient(90deg, #a78bfa, #ec4899); }
.mw-monitor-val { font-size: 12px; font-weight: 600; width: 64px; text-align: right; font-variant-numeric: tabular-nums; flex-shrink: 0; }

/* Battery */
.mw-battery { display: flex; align-items: center; justify-content: center; gap: 16px; height: 100%; }
.mw-battery-icon-wrap { display: flex; align-items: center; }
.mw-battery-shell {
    position: relative;
    width: 60px; height: 30px;
    border: 2px solid rgba(255,255,255,0.5);
    border-radius: 4px;
    padding: 2px;
}
.mw-battery-level {
    height: 100%;
    width: 0%;
    background: #4ade80;
    border-radius: 2px;
    transition: width 400ms ease, background 300ms ease;
}
.mw-battery-tip { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); width: 3px; height: 12px; background: rgba(255,255,255,0.5); border-radius: 0 2px 2px 0; }
.mw-battery-info { display: flex; flex-direction: column; gap: 2px; }
.mw-battery-pct { font-size: 26px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.mw-battery-status { font-size: 11px; color: rgba(255,255,255,0.6); }

/* Calendar */
.mw-calendar { display: flex; flex-direction: column; height: 100%; }
.mw-calendar-title { font-size: 14px; font-weight: 600; text-align: center; margin-bottom: 8px; }
.mw-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; flex: 1; }
.mw-calendar-dow { font-size: 10px; color: rgba(255,255,255,0.5); text-align: center; padding: 4px 0; font-weight: 600; }
.mw-calendar-day {
    font-size: 11px; text-align: center; padding: 4px 0; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.85);
}
.mw-calendar-day.today { background: var(--accent-color, #3b82f6); color: #fff; font-weight: 700; }
.mw-calendar-empty { }

/* World clock */
.mw-world { display: flex; flex-direction: column; gap: 8px; justify-content: center; height: 100%; }
.mw-world-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: rgba(255,255,255,0.04);
    border-radius: 6px;
    font-size: 12px;
}
.mw-world-name { color: rgba(255,255,255,0.8); }
.mw-world-time { font-weight: 600; font-variant-numeric: tabular-nums; font-size: 14px; }

/* Add menu */
.mw-add-menu {
    position: fixed;
    z-index: 2900;
    background: rgba(24, 28, 38, 0.82);
    backdrop-filter: blur(30px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(30px) saturate(180%) brightness(1.1);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    padding: 6px;
    min-width: 200px;
    opacity: 0;
    transform: scale(0.92);
    transform-origin: top left;
    transition: opacity 160ms var(--ease-out, ease), transform 160ms var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1));
}
.mw-add-menu.show { opacity: 1; transform: scale(1); }
.mw-add-menu-title {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    padding: 6px 10px 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.mw-add-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: rgba(255,255,255,0.9);
    transition: background 120ms;
}
.mw-add-menu-item:hover { background: rgba(59,130,246,0.18); }
.mw-add-menu-icon { display: flex; color: var(--accent, #3b82f6); }
.mw-add-menu-icon svg { width: 16px; height: 16px; }

@keyframes mwFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
}
body.high-contrast .mx-widget {
    background: #000 !important;
    border: 2px solid #fff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
body.high-contrast .mw-add-menu {
    background: #000 !important;
    border: 2px solid #fff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
body.reduce-motion .mx-widget,
body.reduce-motion .mw-add-menu,
body.reduce-motion .mw-todo-item {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
}
    `;
    document.head.appendChild(style);
}

function init() {
    injectStyles();
    loadState();
    renderAll();
    window.MXOS.Widgets = {
        add,
        remove,
        list,
        showAddMenu,
        hideAddMenu,
        types: () => Object.keys(WIDGET_TYPES)
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { add, remove, list, showAddMenu, hideAddMenu };
