window.MXOS = window.MXOS || {};
window.MXOS.Features = window.MXOS.Features || {};

const STORAGE_KEY = 'mxos_vinyl_state';
const ENABLED_KEY = 'mxos_vinyl_enabled';

function loadEnabled() {
    try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
}
function saveEnabled(v) {
    try { localStorage.setItem(ENABLED_KEY, v ? '1' : '0'); } catch {}
}

function loadData() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {}
    return { pinned: false, x: null, y: null };
}

let pos = loadData();

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch (e) {}
}

let enabled = false;
let panel = null;
let isPlaying = false;
let spinAngle = 0;
let tonearmProgress = 0;
let rafId = null;
let lastFrame = 0;
let trackedAudio = null;

function injectStyles() {
    if (document.getElementById('mxos-vinyl-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-vinyl-styles';
    style.textContent = `
#mxosVinylPanel{position:fixed;bottom:60px;left:20px;width:200px;background:rgba(10,10,11,0.7);backdrop-filter:blur(40px) saturate(200%);-webkit-backdrop-filter:blur(40px) saturate(200%);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:14px;z-index:1500;box-shadow:0 12px 40px rgba(0,0,0,0.5);transition:transform 0.3s ease}
#mxosVinylPanel.hidden{transform:translateX(-220px);opacity:0;pointer-events:none}
.mxos-vinyl-wrap{position:relative;width:160px;height:160px;margin:0 auto}
.mxos-vinyl-disc{width:160px;height:160px;display:block;transition:none}
.mxos-vinyl-disc.spinning{animation:mxosVinylSpin 1.818s linear infinite}
@keyframes mxosVinylSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.mxos-vinyl-tonearm{position:absolute;top:-8px;right:0;width:80px;height:80px;transform-origin:75% 15%;transform:rotate(0deg);transition:transform 0.6s ease}
.mxos-vinyl-tonearm.playing{transform:rotate(22deg)}
.mxos-vinyl-info{text-align:center;margin-top:10px;font-size:11px;color:#9ca3af}
.mxos-vinyl-title{font-size:12px;font-weight:600;color:#e5e7eb;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mxos-vinyl-toggle{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;color:#9ca3af;cursor:pointer;display:flex;align-items:center;justify-content:center}
.mxos-vinyl-toggle:hover{background:rgba(251,191,36,0.2);color:#fbbf24}
body.reduce-motion #mxosVinylPanel .mxos-vinyl-disc.spinning{animation-duration:8s}
    `;
    document.head.appendChild(style);
}

function vinylSvg() {
    return `<svg class="mxos-vinyl-disc" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="mxosVinylShine" cx="0%" cy="0%" r="100%">
                <stop offset="0%" stop-color="rgba(255,255,255,0.25)"/>
                <stop offset="40%" stop-color="rgba(255,255,255,0)"/>
                <stop offset="60%" stop-color="rgba(255,255,255,0)"/>
                <stop offset="100%" stop-color="rgba(255,255,255,0.15)"/>
            </radialGradient>
        </defs>
        <circle cx="80" cy="80" r="76" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
        ${Array.from({length: 18}, (_, i) => `<circle cx="80" cy="80" r="${34 + i * 2.4}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>`).join('')}
        <circle cx="80" cy="80" r="76" fill="url(#mxosVinylShine)" opacity="0.6"/>
        <circle cx="80" cy="80" r="30" fill="rgba(255,255,255,0.1)"/>
        <circle cx="80" cy="80" r="30" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
        <text x="80" y="74" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.8)" stroke="none" font-family="sans-serif" font-weight="700">MXOS</text>
        <text x="80" y="86" text-anchor="middle" font-size="5" fill="rgba(255,255,255,0.6)" stroke="none" font-family="sans-serif" opacity="0.7">RECORDS</text>
        <text x="80" y="96" text-anchor="middle" font-size="4" fill="rgba(255,255,255,0.5)" stroke="none" font-family="sans-serif" opacity="0.6">33⅓ RPM</text>
        <circle cx="80" cy="80" r="3" fill="rgba(255,255,255,0.3)" stroke="none"/>
        <circle cx="80" cy="80" r="1.5" fill="rgba(255,255,255,0.6)" stroke="none"/>
    </svg>`;
}

function tonearmSvg() {
    return `<svg class="mxos-vinyl-tonearm" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5">
        <circle cx="60" cy="12" r="10" stroke="rgba(255,255,255,0.4)"/>
        <circle cx="60" cy="12" r="6" fill="rgba(255,255,255,0.15)" stroke="none"/>
        <circle cx="60" cy="12" r="3" fill="rgba(255,255,255,0.4)" stroke="none"/>
        <rect x="20" y="11" width="42" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" stroke="none"/>
        <rect x="18" y="10" width="6" height="5" rx="1" fill="rgba(255,255,255,0.15)" stroke="none"/>
        <circle cx="20" cy="13" r="2.5" fill="rgba(255,255,255,0.5)" stroke="none"/>
        <rect x="16" y="13" width="4" height="2" fill="rgba(255,255,255,0.3)" stroke="none"/>
    </svg>`;
}

function buildPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'mxosVinylPanel';
    panel.innerHTML = `
        <button class="mxos-vinyl-toggle" id="mxosVinylToggle" title="收起">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div class="mxos-vinyl-wrap">
            ${vinylSvg()}
            ${tonearmSvg()}
        </div>
        <div class="mxos-vinyl-info">
            <div class="mxos-vinyl-title" id="mxosVinylTitle">未在播放</div>
            <div id="mxosVinylStatus">点击喜音乐开始播放</div>
        </div>
    `;
    document.body.appendChild(panel);
    if (pos.x != null) { panel.style.left = pos.x + 'px'; panel.style.bottom = 'auto'; panel.style.top = pos.y + 'px'; }
    panel.querySelector('#mxosVinylToggle').addEventListener('click', () => {
        panel.classList.toggle('hidden');
        pos.hidden = panel.classList.contains('hidden');
        saveData();
    });
    if (pos.hidden) panel.classList.add('hidden');
    makeDraggable(panel, panel.querySelector('.mxos-vinyl-wrap'));
}

function makeDraggable(el, handle) {
    let drag = null;
    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    function onMove(e) {
        if (!drag) return;
        el.style.left = Math.max(0, Math.min(window.innerWidth - 200, drag.l + e.clientX - drag.x)) + 'px';
        el.style.top = Math.max(0, Math.min(window.innerHeight - 60, drag.t + e.clientY - drag.y)) + 'px';
        el.style.bottom = 'auto';
    }
    function onUp() {
        if (!drag) return;
        drag = null;
        pos.x = el.offsetLeft;
        pos.y = el.offsetTop;
        saveData();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }
}

function setPlaying(playing, title) {
    isPlaying = !!playing;
    if (!panel) return;
    const disc = panel.querySelector('.mxos-vinyl-disc');
    const arm = panel.querySelector('.mxos-vinyl-tonearm');
    const titleEl = panel.querySelector('#mxosVinylTitle');
    const statusEl = panel.querySelector('#mxosVinylStatus');
    if (isPlaying) {
        disc.classList.add('spinning');
        arm.classList.add('playing');
        titleEl.textContent = title || '正在播放';
        statusEl.textContent = '33⅓ RPM';
    } else {
        disc.classList.remove('spinning');
        arm.classList.remove('playing');
        if (title) titleEl.textContent = title;
        statusEl.textContent = '已暂停';
    }
}

function findAudio() {
    const audios = document.querySelectorAll('audio');
    return audios.length ? audios[0] : null;
}

function attachAudio(audio) {
    if (trackedAudio === audio) return;
    if (trackedAudio) {
        trackedAudio.removeEventListener('play', onAudioPlay);
        trackedAudio.removeEventListener('pause', onAudioPause);
        trackedAudio.removeEventListener('ended', onAudioPause);
    }
    trackedAudio = audio;
    if (!audio) return;
    audio.addEventListener('play', onAudioPlay);
    audio.addEventListener('pause', onAudioPause);
    audio.addEventListener('ended', onAudioPause);
    if (!audio.paused) onAudioPlay();
}

function onAudioPlay() {
    let title = '正在播放';
    try {
        const musicWin = document.querySelector('[data-app-id="music"], .window[data-app-id="music"]');
        if (musicWin) {
            const t = musicWin.querySelector('.music-title, .now-playing-title, [class*="title"]');
            if (t) title = t.textContent.trim();
        }
    } catch (e) {}
    setPlaying(true, title);
}

function onAudioPause() {
    setPlaying(false);
}

function watchAudio() {
    const audio = findAudio();
    if (audio) attachAudio(audio);
}

function show() {
    if (!enabled) return;
    if (!panel) buildPanel();
    panel.classList.remove('hidden');
    pos.hidden = false;
    saveData();
}

function hide() {
    if (panel) {
        panel.classList.add('hidden');
        pos.hidden = true;
        saveData();
    }
}

function isShown() {
    return !!panel && !panel.classList.contains('hidden');
}

function setEnabled(v) {
    enabled = !!v;
    saveEnabled(enabled);
    if (enabled) {
        show();
        setInterval(watchAudio, 2000);
        watchAudio();
    } else {
        hide();
    }
}
function isEnabled() { return enabled; }

function init() {
    try {
        enabled = loadEnabled();
        injectStyles();
        if (enabled) {
            setTimeout(() => {
                buildPanel();
                setInterval(watchAudio, 2000);
                watchAudio();
            }, 2000);
        }
        window.addEventListener('mxos:window-opened', (e) => {
            if (e.detail && e.detail.appId === 'music') {
                show();
                setTimeout(watchAudio, 500);
            }
        });
        window.MXOS.Features.vinyl = { show, hide, isShown, setPlaying, setEnabled, isEnabled };
    } catch {}
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { show, hide, setPlaying, setEnabled, isEnabled };
