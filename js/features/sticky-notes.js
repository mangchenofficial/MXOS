window.MXOS = window.MXOS || {};

const STORAGE_KEY = 'mxos_sticky_notes';
const COLORS = {
    yellow: { bg: 'rgba(250, 230, 120, 0.85)', accent: '#facc15', text: '#1a1a1a' },
    pink: { bg: 'rgba(248, 180, 200, 0.85)', accent: '#ec4899', text: '#1a1a1a' },
    blue: { bg: 'rgba(150, 200, 250, 0.85)', accent: '#3b82f6', text: '#1a1a1a' },
    green: { bg: 'rgba(180, 230, 170, 0.85)', accent: '#22c55e', text: '#1a1a1a' },
    purple: { bg: 'rgba(200, 180, 240, 0.85)', accent: '#a855f7', text: '#1a1a1a' }
};

let notes = [];
let layerEl = null;
let nextId = 1;

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        notes = Array.isArray(saved) ? saved : [];
        nextId = notes.reduce((m, n) => Math.max(m, parseInt(n.id.replace('sn-', ''), 10) || 0), 0) + 1;
    } catch {
        notes = [];
        nextId = 1;
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {}
}

function injectStyles() {
    if (document.getElementById('sticky-notes-styles')) return;
    const style = document.createElement('style');
    style.id = 'sticky-notes-styles';
    style.textContent = `
.sticky-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 8800;
}
.sticky-note {
    position: absolute;
    width: 220px;
    min-height: 180px;
    border-radius: var(--radius-md);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    backdrop-filter: blur(10px) saturate(160%);
    -webkit-backdrop-filter: blur(10px) saturate(160%);
    transition: box-shadow 0.18s ease, transform 0.18s ease;
    animation: stickyIn 0.28s var(--ease-spring);
}
@keyframes stickyIn {
    from { opacity: 0; transform: scale(0.85) rotate(-3deg); }
    to { opacity: 1; transform: scale(1) rotate(0); }
}
.sticky-note.dragging {
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
    transform: scale(1.02);
    z-index: 9000;
}
.sticky-note-header {
    height: 26px;
    cursor: move;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 6px;
    gap: 4px;
    background: rgba(255, 255, 255, 0.18);
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.sticky-note-tools {
    display: flex;
    gap: 4px;
    align-items: center;
}
.sticky-color-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.15);
    transition: transform 0.15s ease;
}
.sticky-color-dot:hover {
    transform: scale(1.2);
}
.sticky-tool-btn {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--sticky-text);
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
    opacity: 0.7;
    transition: opacity 0.15s ease, background 0.15s ease;
}
.sticky-tool-btn:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
}
.sticky-note-body {
    flex: 1;
    padding: 10px 12px;
    color: var(--sticky-text);
    font-size: 13px;
    line-height: 1.5;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    width: 100%;
    font-family: inherit;
    min-height: 120px;
}
.sticky-note-body::placeholder {
    color: rgba(0, 0, 0, 0.35);
}
.sticky-note:focus-within {
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4);
}
    `;
    document.head.appendChild(style);
}

function getLayer() {
    if (!layerEl) {
        layerEl = document.querySelector('.sticky-layer') || document.createElement('div');
        layerEl.className = 'sticky-layer';
        document.body.appendChild(layerEl);
    }
    return layerEl;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function renderNote(note) {
    const color = COLORS[note.color] || COLORS.yellow;
    const el = document.createElement('div');
    el.className = 'sticky-note';
    el.dataset.id = note.id;
    el.style.left = note.x + 'px';
    el.style.top = note.y + 'px';
    el.style.background = color.bg;
    el.style.setProperty('--sticky-text', color.text);
    el.innerHTML = `
        <div class="sticky-note-header">
            <div class="sticky-note-tools">
                ${Object.entries(COLORS).map(([key, c]) => `
                    <span class="sticky-color-dot" data-color="${key}" style="background:${c.accent}" title="${key}" role="button" aria-label="换色 ${key}"></span>
                `).join('')}
                <button class="sticky-tool-btn delete-btn" title="删除" aria-label="删除便签">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
        <textarea class="sticky-note-body" placeholder="记下点什么…" aria-label="便签内容"></textarea>
    `;
    const body = el.querySelector('.sticky-note-body');
    body.value = note.content || '';
    body.addEventListener('input', () => {
        note.content = body.value;
        saveState();
    });

    el.querySelectorAll('.sticky-color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            setColor(note.id, dot.dataset.color);
        });
    });
    el.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        remove(note.id);
    });
    bindDrag(el, note);
    getLayer().appendChild(el);
    return el;
}

function bindDrag(el, note) {
    const header = el.querySelector('.sticky-note-header');
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let moved = false;

    function onMove(e) {
        if (!dragging) return;
        const pos = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        const dx = pos.x - startX;
        const dy = pos.y - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
        if (!moved) return;
        let left = startLeft + dx;
        let top = startTop + dy;
        left = Math.max(0, Math.min(window.innerWidth - 60, left));
        top = Math.max(0, Math.min(window.innerHeight - 60, top));
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        e.preventDefault();
    }
    function onUp(e) {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('dragging');
        if (moved) {
            note.x = parseInt(el.style.left);
            note.y = parseInt(el.style.top);
            saveState();
        }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
    }
    function onDown(e) {
        if (e.target.closest('.sticky-tool-btn, .sticky-color-dot, textarea')) return;
        dragging = true;
        moved = false;
        const pos = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
        startX = pos.x;
        startY = pos.y;
        startLeft = parseInt(el.style.left) || 0;
        startTop = parseInt(el.style.top) || 0;
        el.classList.add('dragging');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
        e.preventDefault();
    }
    header.addEventListener('mousedown', onDown);
    header.addEventListener('touchstart', onDown, { passive: false });
}

function renderAll() {
    getLayer().querySelectorAll('.sticky-note').forEach(el => el.remove());
    notes.forEach(note => renderNote(note));
}

function create(x, y, color = 'yellow') {
    const note = {
        id: 'sn-' + nextId++,
        x: x ?? Math.floor(window.innerWidth / 2 - 110 + Math.random() * 40),
        y: y ?? Math.floor(window.innerHeight / 2 - 90 + Math.random() * 40),
        color,
        content: '',
        createdAt: Date.now()
    };
    notes.push(note);
    saveState();
    const el = renderNote(note);
    setTimeout(() => el.querySelector('.sticky-note-body')?.focus(), 80);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('click');
    return note.id;
}

function remove(id) {
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) return false;
    notes.splice(idx, 1);
    saveState();
    const el = getLayer().querySelector(`.sticky-note[data-id="${id}"]`);
    if (el) {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.85)';
        setTimeout(() => el.remove(), 200);
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('click');
    return true;
}

function setColor(id, color) {
    const note = notes.find(n => n.id === id);
    if (!note || !COLORS[color]) return false;
    note.color = color;
    saveState();
    const el = getLayer().querySelector(`.sticky-note[data-id="${id}"]`);
    if (el) {
        el.style.background = COLORS[color].bg;
        el.style.setProperty('--sticky-text', COLORS[color].text);
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    return true;
}

function list() {
    return notes.slice();
}

function init() {
    injectStyles();
    loadState();
    renderAll();
    window.MXOS.StickyNotes = {
        create,
        remove,
        setColor,
        list,
        colors: () => Object.keys(COLORS)
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { create, remove, setColor, list };
