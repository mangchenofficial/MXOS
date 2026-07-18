window.MXOS = window.MXOS || {};

const STORAGE_KEY = 'mxos_desktop_pet_state';
const ENABLED_KEY = 'mxos_desktop_pet_enabled';
const IDLE_THRESHOLD = 30 * 1000;

function loadEnabled() {
    try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(ENABLED_KEY, v ? '1' : '0'); } catch {}
}

let enabled = false;
let petEl = null;
let petState = null;
let currentState = 'walk';
let rafId = null;
let lastInteractionTime = Date.now();
let lastFrameTime = 0;
let velocity = { x: 0, y: 0 };
let targetPos = null;
let jumpStart = 0;
let lastUserEventTime = Date.now();

function defaultState() {
    return {
        x: Math.max(40, window.innerWidth - 200),
        y: window.innerHeight - 120,
        satiety: 60,
        mood: 80,
        skin: '#60a5fa'
    };
}

function loadState() {
    try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (s) return Object.assign(defaultState(), s);
    } catch (e) {}
    return defaultState();
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            x: petState.x,
            y: petState.y,
            satiety: petState.satiety,
            mood: petState.mood,
            skin: petState.skin
        }));
    } catch (e) {}
}

function injectStyles() {
    if (document.getElementById('mxos-pet-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-pet-styles';
    style.textContent = `
#mxosDesktopPet {
    position: fixed; z-index: 1500;
    width: 64px; height: 64px;
    pointer-events: auto;
    cursor: grab;
    user-select: none;
    transition: filter 200ms ease;
    filter: drop-shadow(0 6px 10px rgba(0,0,0,0.35));
}
#mxosDesktopPet.dragging { cursor: grabbing; }
#mxosDesktopPet svg { width: 100%; height: 100%; display: block; overflow: visible; }
#mxosDesktopPet .pet-body { transform-origin: 32px 48px; transition: transform 200ms ease; }
#mxosDesktopPet.jump .pet-body { animation: petJump 600ms cubic-bezier(0.34,1.56,0.64,1); }
#mxosDesktopPet.sleep .pet-eye { display: none; }
#mxosDesktopPet.sleep .pet-eye-closed { display: block; }
#mxosDesktopPet .pet-eye-closed { display: none; }
#mxosDesktopPet.walk .pet-body { animation: petWalk 0.6s ease-in-out infinite; }
#mxosDesktopPet.flee .pet-body { animation: petFlee 0.25s ease-in-out infinite; }
#mxosDesktopPet.follow .pet-body { animation: petFollow 0.4s ease-in-out infinite; }
#mxosDesktopPet.sleep .pet-body { animation: petBreathe 3s ease-in-out infinite; }
@keyframes petJump {
    0% { transform: translateY(0) scale(1,1); }
    40% { transform: translateY(-22px) scale(0.95,1.08); }
    70% { transform: translateY(-12px) scale(1.05,0.95); }
    100% { transform: translateY(0) scale(1,1); }
}
@keyframes petWalk {
    0%,100% { transform: translateY(0) rotate(-3deg); }
    50% { transform: translateY(-3px) rotate(3deg); }
}
@keyframes petFlee {
    0%,100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-4px) rotate(0); }
}
@keyframes petFollow {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
}
@keyframes petBreathe {
    0%,100% { transform: scale(1,1); }
    50% { transform: scale(1.04,0.96); }
}
#mxosPetStatus {
    position: absolute;
    top: -28px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.55); color: #fff;
    font-size: 10px; padding: 2px 8px; border-radius: 8px;
    white-space: nowrap; pointer-events: none;
    opacity: 0; transition: opacity 180ms ease;
}
#mxosDesktopPet:hover #mxosPetStatus { opacity: 1; }
.pet-z { display: none; }
#mxosDesktopPet.sleep .pet-z { display: block; }
body.reduce-motion #mxosDesktopPet .pet-body { animation: none !important; }
    `;
    document.head.appendChild(style);
}

function buildPetSvg(state) {
    const body = state.skin || 'rgba(255,255,255,0.85)';
    const bodyDark = shade(body, -25);
    return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g class="pet-body">
        <circle cx="32" cy="34" r="22" fill="none" stroke="rgba(255,255,255,0.7)"/>
        <circle cx="24" cy="30" r="2" fill="rgba(255,255,255,0.85)" stroke="none"/>
        <circle cx="40" cy="30" r="2" fill="rgba(255,255,255,0.85)" stroke="none"/>
        <circle class="pet-eye" cx="25" cy="31" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none"/>
        <circle class="pet-eye" cx="41" cy="31" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none"/>
        <path class="pet-eye-closed" d="M22 31 Q24 33 26 31" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path class="pet-eye-closed" d="M38 31 Q40 33 42 31" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M28 38 Q32 41 36 38" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <circle cx="20" cy="36" r="2" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        <circle cx="44" cy="36" r="2" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    </g>
    <g class="pet-z">
        <text x="48" y="14" font-size="14" fill="rgba(255,255,255,0.85)" stroke="none" font-family="sans-serif" font-weight="bold">Z</text>
        <text x="52" y="8" font-size="10" fill="rgba(255,255,255,0.7)" stroke="none" font-family="sans-serif" font-weight="bold">z</text>
    </g>
</svg>
    `;
}

function shade(hex, percent) {
    try {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const f = (c) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)));
        return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch (e) { return hex; }
}

function buildPet() {
    if (petEl) return;
    petEl = document.createElement('div');
    petEl.id = 'mxosDesktopPet';
    petEl.setAttribute('role', 'button');
    petEl.setAttribute('aria-label', '桌面宠物');
    petEl.setAttribute('tabindex', '0');
    petEl.innerHTML = buildPetSvg(petState) + '<div id="mxosPetStatus"></div>';
    document.body.appendChild(petEl);

    petEl.addEventListener('dblclick', onDoubleClick);
    petEl.addEventListener('mousedown', onDragStart);
    petEl.addEventListener('touchstart', onDragStart, { passive: false });

    petEl.addEventListener('dragover', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) {
            e.preventDefault();
            petEl.style.filter = 'drop-shadow(0 0 12px #fbbf24)';
        }
    });
    petEl.addEventListener('dragleave', () => {
        petEl.style.filter = '';
    });
    petEl.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            e.preventDefault();
            petEl.style.filter = '';
            feed();
        }
    });

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach(ev => {
        document.addEventListener(ev, () => { lastUserEventTime = Date.now(); }, { passive: true });
    });
}

function updatePosition() {
    petEl.style.left = petState.x + 'px';
    petEl.style.top = petState.y + 'px';
}

function setState(s) {
    currentState = s;
    petEl.classList.remove('walk', 'sleep', 'follow', 'flee', 'jump');
    if (s !== 'jump') petEl.classList.add(s);
    updateStatus();
}

function updateStatus() {
    const status = petEl.querySelector('#mxosPetStatus');
    if (!status) return;
    const mood = petState.mood > 70 ? '心情愉悦' : petState.mood > 30 ? '心情一般' : '心情低落';
    const sat = petState.satiety > 70 ? '饱腹' : petState.satiety > 30 ? '微饿' : '饥饿';
    status.textContent = `${sat} · ${mood} · ${currentState}`;
}

function onDoubleClick() {
    interact();
}

let dragInfo = null;
function onDragStart(e) {
    if (e.type === 'touchstart' && e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const p = getPos(e);
    const rect = petEl.getBoundingClientRect();
    dragInfo = { dx: p.x - rect.left, dy: p.y - rect.top };
    petEl.classList.add('dragging');
    setState('follow');
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
    if (!dragInfo) return;
    e.preventDefault();
    const p = getPos(e);
    petState.x = Math.max(0, Math.min(window.innerWidth - 64, p.x - dragInfo.dx));
    petState.y = Math.max(0, Math.min(window.innerHeight - 80, p.y - dragInfo.dy));
    updatePosition();
}

function onDragEnd() {
    if (!dragInfo) return;
    dragInfo = null;
    petEl.classList.remove('dragging');
    saveState();
    lastInteractionTime = Date.now();
    setState('walk');
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchend', onDragEnd);
}

function getPos(e) {
    if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length) {
        return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function pickTarget() {
    const margin = 80;
    targetPos = {
        x: margin + Math.random() * (window.innerWidth - margin * 2),
        y: margin + Math.random() * (window.innerHeight - margin - 100)
    };
}

function frame(ts) {
    if (!petEl) return;
    if (!lastFrameTime) lastFrameTime = ts;
    const dt = Math.min(64, ts - lastFrameTime);
    lastFrameTime = ts;

    const idleTime = Date.now() - lastUserEventTime;
    if (currentState !== 'sleep' && idleTime > IDLE_THRESHOLD && !dragInfo) {
        setState('sleep');
    } else if (currentState === 'sleep' && idleTime < IDLE_THRESHOLD) {
        setState('walk');
        pickTarget();
    }

    if (currentState === 'walk' && !dragInfo) {
        if (!targetPos || Math.abs(petState.x - targetPos.x) < 8) {
            pickTarget();
        }
        const dx = targetPos.x - petState.x;
        const speed = 0.04;
        petState.x += dx * speed * (dt / 16);
        petState.x = Math.max(0, Math.min(window.innerWidth - 64, petState.x));
        updatePosition();
    } else if (currentState === 'flee' && !dragInfo) {
        if (!targetPos) pickTarget();
        const dx = targetPos.x - petState.x;
        petState.x += dx * 0.12 * (dt / 16);
        petState.x = Math.max(0, Math.min(window.innerWidth - 64, petState.x));
        updatePosition();
        if (Math.abs(dx) < 8) {
            setState('walk');
            pickTarget();
        }
    }

    petState.satiety = Math.max(0, petState.satiety - dt * 0.001);
    if (petState.satiety < 20) {
        petState.mood = Math.max(0, petState.mood - dt * 0.002);
    } else {
        petState.mood = Math.min(100, petState.mood + dt * 0.0005);
    }
    updateStatus();

    if (Math.random() < 0.002) saveState();

    rafId = requestAnimationFrame(frame);
}

function interact() {
    if (!petEl) return;
    petEl.classList.remove('jump');
    void petEl.offsetWidth;
    petEl.classList.add('jump');
    setTimeout(() => petEl.classList.remove('jump'), 600);
    petState.mood = Math.min(100, petState.mood + 5);
    lastInteractionTime = Date.now();
    lastUserEventTime = Date.now();
    if (currentState === 'sleep') setState('walk');
    saveState();
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('宠物很开心');
}

function feed() {
    if (!petState) return;
    petState.satiety = Math.min(100, petState.satiety + 10);
    petState.mood = Math.min(100, petState.mood + 8);
    lastInteractionTime = Date.now();
    lastUserEventTime = Date.now();
    if (currentState === 'sleep') setState('walk');
    saveState();
    petEl.classList.remove('jump');
    void petEl.offsetWidth;
    petEl.classList.add('jump');
    setTimeout(() => petEl.classList.remove('jump'), 600);
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('宠物吃饱了 +10');
}

function fleeFrom(x, y) {
    if (currentState === 'sleep') return;
    const cx = petState.x + 32;
    const dx = cx - x;
    targetPos = {
        x: petState.x + (dx > 0 ? 200 : -200),
        y: petState.y
    };
    setState('flee');
}

function getState() {
    return Object.assign({}, petState, { state: currentState });
}

function start() {
    if (petEl) return;
    injectStyles();
    petState = loadState();
    buildPet();
    updatePosition();
    setState('walk');
    pickTarget();
    rafId = requestAnimationFrame(frame);
}

function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (petEl) petEl.remove();
    petEl = null;
}

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
    if (enabled) start();
    else stop();
}
function isEnabled() { return enabled; }

function init() {
    try {
        enabled = loadEnabled();
        injectStyles();
        window.MXOS.Pet = { start, stop, feed, interact, getState, fleeFrom, setEnabled, isEnabled };
        if (enabled) setTimeout(start, 800);
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, feed, interact, getState, setEnabled, isEnabled };
