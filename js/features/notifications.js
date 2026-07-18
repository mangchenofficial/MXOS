const TYPE_CONFIG = {
    info: {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></svg>'
    },
    success: {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5-6"/></svg>'
    },
    warning: {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L22 20H2L12 3z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>'
    },
    error: {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/></svg>'
    }
};

const BELL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

const MAX_VISIBLE = 5;
const DEFAULT_DURATION = 5000;
const MAX_HISTORY = 50;

const activeNotifications = [];
const history = [];
let nextId = 1;
let unreadCount = 0;
let centerOpen = false;

function getContainer() {
    return document.getElementById('notificationContainer');
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function notify(options = {}) {
    const opts = options || {};
    const type = TYPE_CONFIG[opts.type] ? opts.type : 'info';
    const duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATION;

    const record = {
        id: nextId++,
        title: opts.title || '通知',
        body: opts.body || '',
        type,
        icon: opts.icon || null,
        timestamp: Date.now(),
        read: false,
        actions: Array.isArray(opts.actions) ? opts.actions : []
    };

    history.unshift(record);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    unreadCount++;
    updateBadge();

    const dndActive = !!(window.MXOS && window.MXOS.notify && window.MXOS.notify.dnd);
    if (dndActive && !opts.bypassDnd) {
        refreshCenterIfOpen();
        return record.id;
    }

    const card = buildCard(record, duration);
    const container = getContainer();
    if (container) container.appendChild(card);

    const entry = { id: record.id, element: card, timer: null };
    activeNotifications.push(entry);

    if (activeNotifications.length > MAX_VISIBLE) {
        const oldest = activeNotifications[0];
        removeNotification(oldest.id, true);
    }

    if (duration > 0) {
        entry.timer = setTimeout(() => removeNotification(record.id, true), duration);
        const progress = card.querySelector('.notification-progress');
        if (progress) {
            progress.style.transition = `width ${duration}ms linear`;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { progress.style.width = '0%'; });
            });
        }
    } else {
        const progress = card.querySelector('.notification-progress');
        if (progress) progress.style.display = 'none';
    }

    refreshCenterIfOpen();
    window.dispatchEvent(new CustomEvent('mxos:notification-shown', { detail: { id: record.id, type: record.type } }));
    return record.id;
}

function buildCard(record, duration) {
    const cfg = TYPE_CONFIG[record.type];
    const card = document.createElement('div');
    card.className = 'notification-card';
    card.dataset.id = record.id;

    const iconHtml = record.icon
        ? `<div class="notification-icon ${record.type}">${record.icon}</div>`
        : `<div class="notification-icon ${record.type}">${cfg.icon}</div>`;

    let actionsHtml = '';
    if (record.actions && record.actions.length) {
        actionsHtml = '<div class="notification-actions">' +
            record.actions.map((a, i) =>
                `<button class="notification-action" data-action-idx="${i}">${escapeHtml(a.label || '')}</button>`
            ).join('') + '</div>';
    }

    const progressStyle = duration > 0 ? 'width:100%' : 'display:none';

    card.innerHTML = `
        ${iconHtml}
        <div class="notification-content">
            <div class="notification-title">${escapeHtml(record.title)}</div>
            ${record.body ? `<div class="notification-body">${escapeHtml(record.body)}</div>` : ''}
            ${actionsHtml}
        </div>
        <div class="notification-close" role="button" aria-label="关闭">${CLOSE_ICON}</div>
        <div class="notification-progress" style="${progressStyle}"></div>
    `;

    card.querySelector('.notification-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeWithScale(record.id);
    });

    if (record.actions && record.actions.length) {
        card.querySelectorAll('.notification-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.actionIdx, 10);
                const action = record.actions[idx];
                if (action && typeof action.onClick === 'function') {
                    try { action.onClick(); } catch (err) { console.error('通知 action 执行错误', err); }
                }
                closeWithScale(record.id);
            });
        });
    }

    return card;
}

function removeEntry(id) {
    const idx = activeNotifications.findIndex(n => n.id === id);
    if (idx === -1) return null;
    const entry = activeNotifications[idx];
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
    activeNotifications.splice(idx, 1);
    return entry;
}

function removeNotification(id, animate = true) {
    const entry = removeEntry(id);
    if (!entry) return;
    if (animate) {
        entry.element.classList.add('exiting');
        const onEnd = () => { entry.element.style.willChange = 'auto'; entry.element.remove(); };
        entry.element.addEventListener('animationend', onEnd, { once: true });
        setTimeout(onEnd, 260);
    } else {
        entry.element.style.willChange = 'auto';
        entry.element.remove();
    }
}

function closeWithScale(id) {
    const entry = removeEntry(id);
    if (!entry) return;
    entry.element.classList.add('closing');
    const onEnd = () => { entry.element.style.willChange = 'auto'; entry.element.remove(); };
    entry.element.addEventListener('animationend', onEnd, { once: true });
    setTimeout(onEnd, 220);
}

function buildNotificationCenter() {
    if (document.getElementById('notificationCenter')) {
        return document.getElementById('notificationCenter');
    }
    const panel = document.createElement('div');
    panel.className = 'notification-center';
    panel.id = 'notificationCenter';
    panel.innerHTML = `
        <div class="notification-center-header">
            <div class="notification-center-title">通知中心</div>
            <button class="notification-center-clear" id="notifClearBtn">清空</button>
        </div>
        <div class="notification-center-list" id="notifCenterList"></div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#notifClearBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        clearHistory();
    });

    document.addEventListener('click', (e) => {
        if (!centerOpen) return;
        if (e.target.closest('#notificationCenter')) return;
        if (e.target.closest('.taskbar-notification-btn')) return;
        hideCenter();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && centerOpen) hideCenter();
    });

    return panel;
}

function refreshCenterIfOpen() {
    if (centerOpen) renderList(false);
}

function renderList(animate = true) {
    const list = document.getElementById('notifCenterList');
    if (!list) return;
    if (!history.length) {
        list.innerHTML = `<div class="nc-empty">${BELL_ICON}<div>暂无通知</div></div>`;
        return;
    }
    list.innerHTML = '';
    history.forEach((item, i) => {
        const cfg = TYPE_CONFIG[item.type];
        const el = document.createElement('div');
        el.className = 'nc-item';
        if (animate) {
            el.style.animationDelay = (i * 50) + 'ms';
        } else {
            el.style.animation = 'none';
        }
        const iconHtml = item.icon ? item.icon : cfg.icon;
        el.innerHTML = `
            <div class="nc-item-icon ${item.type}">${iconHtml}</div>
            <div class="nc-item-content">
                <div class="nc-item-title">${escapeHtml(item.title)}</div>
                ${item.body ? `<div class="nc-item-body">${escapeHtml(item.body)}</div>` : ''}
                <div class="nc-item-time">${formatTime(item.timestamp)}</div>
            </div>
        `;
        list.appendChild(el);
    });
}

function formatTime(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return '刚刚';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' 分钟前';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' 小时前';
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showCenter() {
    let panel = document.getElementById('notificationCenter');
    if (!panel) panel = buildNotificationCenter();
    panel.style.display = '';
    panel.classList.remove('closing');
    panel.classList.add('show');
    centerOpen = true;
    markAllRead();
    renderList(true);
}

function hideCenter() {
    const panel = document.getElementById('notificationCenter');
    if (!panel || !centerOpen) return;
    panel.classList.remove('show');
    panel.classList.add('closing');
    centerOpen = false;
    const cleanup = () => panel.classList.remove('closing');
    panel.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 260);
}

function toggleCenter() {
    if (centerOpen) hideCenter();
    else showCenter();
}

function markAllRead() {
    unreadCount = 0;
    history.forEach(h => { h.read = true; });
    updateBadge();
}

function clearHistory() {
    history.length = 0;
    unreadCount = 0;
    updateBadge();
    renderList(false);
}

function updateBadge() {
    const badge = document.querySelector('.taskbar-notification-btn .notif-badge');
    if (!badge) return;
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.classList.add('show');
    } else {
        badge.classList.remove('show');
        badge.textContent = '';
    }
}

function addTaskbarButton() {
    const trayRight = document.querySelector('.taskbar-right');
    if (!trayRight) return;
    if (document.querySelector('.taskbar-notification-btn')) return;
    const btn = document.createElement('div');
    btn.className = 'taskbar-notification-btn';
    btn.title = '通知中心';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', '通知中心');
    btn.innerHTML = `${BELL_ICON}<span class="notif-badge"></span>`;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCenter();
    });
    const clock = trayRight.querySelector('.system-tray') || trayRight.querySelector('.clock')?.parentElement;
    if (clock) {
        trayRight.insertBefore(btn, clock);
    } else {
        trayRight.appendChild(btn);
    }
}

function init() {
    addTaskbarButton();
    window.MXOS = window.MXOS || {};
    window.MXOS.notify = notify;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { notify };
