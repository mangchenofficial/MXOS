import { registerAppRenderer } from '../core.js';

window.MXOS = window.MXOS || {};

const EVENTS_KEY = 'mxos_calendar_events';

function loadEvents() {
    try {
        return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function saveEvents(list) {
    try {
        localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
    } catch (e) {}
}

function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

registerAppRenderer('calendar', (contentEl) => {
    let viewDate = new Date();
    let selectedDate = new Date();
    let events = loadEvents();
    let editingId = null;

    const root = document.createElement('div');
    root.className = 'cal-app';
    root.innerHTML = `
        <style>
            .cal-app{display:flex;flex-direction:column;height:100%;color:#fff;font-family:'MiSans',sans-serif}
            .cal-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
            .cal-nav{display:flex;gap:6px;align-items:center}
            .cal-month{font-size:18px;font-weight:600;min-width:160px;text-align:center}
            .cal-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;cursor:pointer}
            .cal-btn:hover{background:rgba(255,255,255,.18)}
            .cal-btn.today{width:auto;padding:0 12px;font-size:12px}
            .cal-body{display:flex;flex:1;overflow:hidden}
            .cal-grid-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden}
            .cal-weekdays{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid rgba(255,255,255,.06)}
            .cal-weekday{padding:8px;text-align:center;font-size:12px;color:rgba(255,255,255,.55)}
            .cal-weekday.weekend{color:#f87171}
            .cal-grid{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr}
            .cal-cell{border-right:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);padding:4px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;position:relative;transition:.1s}
            .cal-cell:hover{background:rgba(59,130,246,.15)}
            .cal-cell.other{opacity:.3}
            .cal-cell.today .cal-daynum{background:var(--accent-color,#3b82f6);border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center}
            .cal-cell.selected{background:rgba(59,130,246,.25)}
            .cal-daynum{font-size:13px;margin-bottom:2px}
            .cal-dots{display:flex;gap:3px;margin-top:auto;flex-wrap:wrap}
            .cal-dot{width:5px;height:5px;border-radius:50%;background:var(--accent-color,#3b82f6)}
            .cal-side{width:260px;border-left:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;overflow:hidden}
            .cal-side-head{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)}
            .cal-side-date{font-size:15px;font-weight:600}
            .cal-side-sub{font-size:11px;color:rgba(255,255,255,.5);margin-top:2px}
            .cal-event-list{flex:1;overflow-y:auto;padding:8px}
            .cal-event{background:rgba(255,255,255,.06);border-left:3px solid var(--accent-color,#3b82f6);padding:8px 10px;border-radius:6px;margin-bottom:6px;cursor:pointer}
            .cal-event:hover{background:rgba(255,255,255,.12)}
            .cal-event-title{font-size:13px;font-weight:500}
            .cal-event-time{font-size:11px;color:#93c5fd;margin-top:2px}
            .cal-event-desc{font-size:11px;color:rgba(255,255,255,.6);margin-top:2px}
            .cal-add-btn{margin:10px;padding:8px;background:var(--accent-color,#3b82f6);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;text-align:center}
            .cal-add-btn:hover{filter:brightness(1.1)}
            .cal-empty{color:rgba(255,255,255,.35);text-align:center;padding:24px 8px;font-size:12px}
            .cal-modal-bg{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:10}
            .cal-modal{background:#1e293b;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:16px;width:300px;backdrop-filter:blur(20px)}
            .cal-modal h3{margin:0 0 12px;font-size:15px}
            .cal-modal label{display:block;font-size:11px;color:rgba(255,255,255,.6);margin:8px 0 3px}
            .cal-modal input,.cal-modal textarea{width:100%;box-sizing:border-box;padding:6px 8px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;font-size:13px;font-family:inherit}
            .cal-modal textarea{resize:vertical;min-height:50px}
            .cal-modal-actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}
            .cal-modal-actions button{padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px}
            .cal-modal-actions .save{background:var(--accent-color,#3b82f6);color:#fff}
            .cal-modal-actions .cancel{background:rgba(255,255,255,.12);color:#fff}
            .cal-modal-actions .del{background:rgba(239,68,68,.3);color:#fca5a5;margin-right:auto}
        </style>
        <div class="cal-header">
            <div class="cal-nav">
                <button class="cal-btn" id="calPrev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <div class="cal-month" id="calMonth"></div>
                <button class="cal-btn" id="calNext"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
            </div>
            <button class="cal-btn today" id="calToday">今天</button>
        </div>
        <div class="cal-body">
            <div class="cal-grid-wrap">
                <div class="cal-weekdays">
                    <div class="cal-weekday weekend">日</div>
                    <div class="cal-weekday">一</div>
                    <div class="cal-weekday">二</div>
                    <div class="cal-weekday">三</div>
                    <div class="cal-weekday">四</div>
                    <div class="cal-weekday">五</div>
                    <div class="cal-weekday weekend">六</div>
                </div>
                <div class="cal-grid" id="calGrid"></div>
            </div>
            <div class="cal-side">
                <div class="cal-side-head">
                    <div class="cal-side-date" id="calSideDate"></div>
                    <div class="cal-side-sub" id="calSideSub"></div>
                </div>
                <button class="cal-add-btn" id="calAdd">+ 添加事件</button>
                <div class="cal-event-list" id="calEventList"></div>
            </div>
        </div>
        <div id="calModalSlot"></div>
    `;
    contentEl.appendChild(root);

    const grid = root.querySelector('#calGrid');
    const monthEl = root.querySelector('#calMonth');
    const sideDate = root.querySelector('#calSideDate');
    const sideSub = root.querySelector('#calSideSub');
    const eventList = root.querySelector('#calEventList');
    const modalSlot = root.querySelector('#calModalSlot');

    const today = new Date();
    const todayKey = dateKey(today);

    function render() {
        const y = viewDate.getFullYear();
        const m = viewDate.getMonth();
        monthEl.textContent = `${y}年${m + 1}月`;

        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        const startWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const prevLast = new Date(y, m, 0).getDate();

        grid.innerHTML = '';

        for (let i = 0; i < startWeekday; i++) {
            const d = prevLast - startWeekday + i + 1;
            grid.appendChild(makeCell(new Date(y, m - 1, d), true));
        }
        for (let d = 1; d <= daysInMonth; d++) {
            grid.appendChild(makeCell(new Date(y, m, d), false));
        }
        const totalCells = startWeekday + daysInMonth;
        const remain = (7 - totalCells % 7) % 7;
        for (let d = 1; d <= remain; d++) {
            grid.appendChild(makeCell(new Date(y, m + 1, d), true));
        }

        renderSide();
    }

    function makeCell(d, other) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        if (other) cell.classList.add('other');
        const dk = dateKey(d);
        if (dk === todayKey) cell.classList.add('today');
        if (dk === dateKey(selectedDate)) cell.classList.add('selected');

        const dayNum = document.createElement('div');
        dayNum.className = 'cal-daynum';
        dayNum.textContent = d.getDate();
        cell.appendChild(dayNum);

        const dayEvents = events.filter(e => e.date === dk);
        if (dayEvents.length) {
            const dots = document.createElement('div');
            dots.className = 'cal-dots';
            const max = Math.min(dayEvents.length, 4);
            for (let i = 0; i < max; i++) {
                const dot = document.createElement('div');
                dot.className = 'cal-dot';
                dots.appendChild(dot);
            }
            cell.appendChild(dots);
        }

        cell.addEventListener('click', () => {
            selectedDate = new Date(d);
            render();
        });
        return cell;
    }

    function renderSide() {
        const dk = dateKey(selectedDate);
        sideDate.textContent = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;
        const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
        sideSub.textContent = weekdays[selectedDate.getDay()];

        const dayEvents = events.filter(e => e.date === dk).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        if (!dayEvents.length) {
            eventList.innerHTML = '<div class="cal-empty">当日无事件</div>';
            return;
        }
        eventList.innerHTML = dayEvents.map(e => `
            <div class="cal-event" data-id="${e.id}">
                <div class="cal-event-title">${escapeHtml(e.title)}</div>
                ${e.time ? `<div class="cal-event-time">${escapeHtml(e.time)}</div>` : ''}
                ${e.desc ? `<div class="cal-event-desc">${escapeHtml(e.desc)}</div>` : ''}
            </div>
        `).join('');
        eventList.querySelectorAll('.cal-event').forEach(el => {
            el.addEventListener('click', () => {
                openEditModal(el.dataset.id);
            });
        });
    }

    function openAddModal() {
        editingId = null;
        const dk = dateKey(selectedDate);
        showModal({ id: null, date: dk, time: '', title: '', desc: '' });
    }

    function openEditModal(id) {
        const ev = events.find(e => String(e.id) === String(id));
        if (!ev) return;
        editingId = ev.id;
        showModal(ev);
    }

    function showModal(ev) {
        modalSlot.innerHTML = `
            <div class="cal-modal-bg" id="calModalBg">
                <div class="cal-modal">
                    <h3>${editingId ? '编辑事件' : '添加事件'}</h3>
                    <label>标题</label>
                    <input type="text" id="evTitle" value="${escapeHtml(ev.title)}">
                    <label>时间</label>
                    <input type="time" id="evTime" value="${escapeHtml(ev.time)}">
                    <label>日期</label>
                    <input type="date" id="evDate" value="${escapeHtml(ev.date)}">
                    <label>描述</label>
                    <textarea id="evDesc">${escapeHtml(ev.desc)}</textarea>
                    <div class="cal-modal-actions">
                        ${editingId ? '<button class="del" id="evDel">删除</button>' : ''}
                        <button class="cancel" id="evCancel">取消</button>
                        <button class="save" id="evSave">保存</button>
                    </div>
                </div>
            </div>
        `;
        const bg = root.querySelector('#calModalBg');
        root.querySelector('#evCancel').addEventListener('click', () => { modalSlot.innerHTML = ''; });
        bg.addEventListener('click', (e) => { if (e.target === bg) modalSlot.innerHTML = ''; });
        root.querySelector('#evSave').addEventListener('click', () => {
            const title = root.querySelector('#evTitle').value.trim();
            if (!title) return;
            const data = {
                title,
                time: root.querySelector('#evTime').value,
                date: root.querySelector('#evDate').value,
                desc: root.querySelector('#evDesc').value.trim()
            };
            if (editingId) {
                const idx = events.findIndex(e => e.id === editingId);
                if (idx >= 0) events[idx] = { ...events[idx], ...data };
            } else {
                events.push({ id: Date.now(), ...data });
            }
            saveEvents(events);
            modalSlot.innerHTML = '';
            render();
        });
        const delBtn = root.querySelector('#evDel');
        if (delBtn) delBtn.addEventListener('click', () => {
            events = events.filter(e => e.id !== editingId);
            saveEvents(events);
            modalSlot.innerHTML = '';
            render();
        });
    }

    root.querySelector('#calPrev').addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        render();
    });
    root.querySelector('#calNext').addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        render();
    });
    root.querySelector('#calToday').addEventListener('click', () => {
        viewDate = new Date();
        selectedDate = new Date();
        render();
    });
    root.querySelector('#calAdd').addEventListener('click', openAddModal);

    render();
});

window.MXOS.Calendar = {
    getEvents: () => loadEvents(),
    getEventsByDate(dateStr) { return loadEvents().filter(e => e.date === dateStr); },
    addEvent(event) {
        const list = loadEvents();
        const ev = { id: Date.now(), ...event };
        list.push(ev);
        saveEvents(list);
        return ev;
    },
    updateEvent(id, updates) {
        const list = loadEvents();
        const idx = list.findIndex(e => e.id === id);
        if (idx < 0) return false;
        list[idx] = { ...list[idx], ...updates };
        saveEvents(list);
        return true;
    },
    deleteEvent(id) {
        const list = loadEvents();
        const filtered = list.filter(e => e.id !== id);
        saveEvents(filtered);
        return filtered.length !== list.length;
    }
};

console.log('[MXOS.Calendar] 日历应用已加载');
