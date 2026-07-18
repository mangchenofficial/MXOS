window.MXOS = window.MXOS || {};

let mediaStream = null;
let mediaRecorder = null;
let chunks = [];
let state = 'idle';
let startTime = 0;
let elapsedMs = 0;
let timerInterval = null;
let uiEl = null;
let withMic = false;
let pendingOptions = null;

function injectStyles() {
    if (document.getElementById('mxos-recorder-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-recorder-styles';
    style.textContent = `
.mxos-recorder-ui {
    position: fixed;
    bottom: 60px;
    right: 20px;
    z-index: 9999;
    display: none;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(20, 25, 35, 0.78);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 13px;
    user-select: none;
}
.mxos-recorder-ui.show { display: flex; }
.mxos-recorder-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: #ef4444;
    animation: mxosRecPulse 1.2s ease-in-out infinite;
    flex-shrink: 0;
}
.mxos-recorder-dot.paused { background: #f59e0b; animation: none; }
@keyframes mxosRecPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
}
.mxos-recorder-timer {
    font-family: 'Consolas', 'Courier New', monospace;
    font-weight: 600;
    min-width: 64px;
    letter-spacing: 0.5px;
}
.mxos-recorder-btn {
    width: 28px; height: 28px;
    border: none; cursor: pointer;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 0.15s ease;
}
.mxos-recorder-btn:hover { background: rgba(255, 255, 255, 0.2); }
.mxos-recorder-btn svg { width: 14px; height: 14px; }
.mxos-recorder-btn.stop:hover { background: rgba(239, 68, 68, 0.4); }
    `;
    document.head.appendChild(style);
}

function buildUI() {
    if (uiEl) return;
    uiEl = document.createElement('div');
    uiEl.className = 'mxos-recorder-ui';
    uiEl.setAttribute('role', 'status');
    uiEl.setAttribute('aria-label', '屏幕录制控制');
    uiEl.innerHTML = `
        <span class="mxos-recorder-dot" aria-hidden="true"></span>
        <span class="mxos-recorder-timer" data-timer>00:00</span>
        <button class="mxos-recorder-btn" data-act="pause" title="暂停" aria-label="暂停">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="mxos-recorder-btn stop" data-act="stop" title="停止" aria-label="停止">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
        </button>
    `;
    document.body.appendChild(uiEl);
    uiEl.querySelector('[data-act="pause"]').addEventListener('click', () => {
        if (state === 'recording') pause();
        else if (state === 'paused') resume();
    });
    uiEl.querySelector('[data-act="stop"]').addEventListener('click', () => stop());
}

function showUI() {
    if (!uiEl) buildUI();
    uiEl.classList.add('show');
}

function hideUI() {
    if (uiEl) uiEl.classList.remove('show');
}

function updateUI() {
    if (!uiEl) return;
    const dot = uiEl.querySelector('.mxos-recorder-dot');
    const pauseBtn = uiEl.querySelector('[data-act="pause"]');
    if (state === 'paused') {
        dot.classList.add('paused');
        pauseBtn.title = '继续';
        pauseBtn.setAttribute('aria-label', '继续');
        pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    } else {
        dot.classList.remove('paused');
        pauseBtn.title = '暂停';
        pauseBtn.setAttribute('aria-label', '暂停');
        pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function tickTimer() {
    if (state !== 'recording') return;
    const current = elapsedMs + (Date.now() - startTime);
    if (uiEl) {
        const t = uiEl.querySelector('[data-timer]');
        if (t) t.textContent = formatTime(current);
    }
}

async function start(options = {}) {
    if (state !== 'idle') return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('当前环境不支持屏幕录制', 'warning');
        return false;
    }
    withMic = !!options.microphone;
    pendingOptions = options;
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: options.frameRate || 30 },
            audio: options.systemAudio !== false
        });
        mediaStream = new MediaStream();
        displayStream.getVideoTracks().forEach(t => mediaStream.addTrack(t));
        displayStream.getAudioTracks().forEach(t => mediaStream.addTrack(t));
        if (withMic) {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                micStream.getAudioTracks().forEach(t => mediaStream.addTrack(t));
            } catch (e) {
                if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('无法访问麦克风，将仅录制系统音频', 'info');
            }
        }
        displayStream.getVideoTracks()[0].addEventListener('ended', () => {
            if (state === 'recording' || state === 'paused') stop();
        });

        const mime = pickMime();
        mediaRecorder = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined);
        chunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.onstop = handleStop;
        mediaRecorder.start(1000);
        state = 'recording';
        startTime = Date.now();
        elapsedMs = 0;
        showUI();
        updateUI();
        timerInterval = setInterval(tickTimer, 500);
        if (window.MXOS?.notify) {
            window.MXOS.notify({ title: '屏幕录制', body: '录制已开始', type: 'info' });
        }
        return true;
    } catch (e) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已取消屏幕录制', 'info');
        cleanup();
        return false;
    }
}

function pickMime() {
    const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];
    for (const c of candidates) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
}

function pause() {
    if (state !== 'recording' || !mediaRecorder) return false;
    try {
        mediaRecorder.pause();
        elapsedMs += Date.now() - startTime;
        state = 'paused';
        updateUI();
        return true;
    } catch (e) {
        return false;
    }
}

function resume() {
    if (state !== 'paused' || !mediaRecorder) return false;
    try {
        mediaRecorder.resume();
        startTime = Date.now();
        state = 'recording';
        updateUI();
        return true;
    } catch (e) {
        return false;
    }
}

async function stop() {
    if (state === 'idle' || !mediaRecorder) return false;
    if (state === 'recording') elapsedMs += Date.now() - startTime;
    state = 'stopping';
    try {
        mediaRecorder.stop();
    } catch (e) {
        cleanup();
    }
    return true;
}

async function handleStop() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    hideUI();
    const blob = new Blob(chunks, { type: 'video/webm' });
    const filename = 'mxos-recording-' + new Date().toISOString().replace(/[:.]/g, '-') + '.webm';
    chunks = [];
    cleanup();

    try {
        await saveToVFS(filename, blob);
    } catch (e) {
        console.error('[Recorder] VFS 保存失败:', e);
    }

    try {
        await createShareLink(filename, blob);
    } catch (e) {
        console.error('[Recorder] 分享链接生成失败:', e);
    }

    if (window.MXOS?.notify) {
        window.MXOS.notify({ title: '屏幕录制', body: '录制已保存到 VFS：' + filename, type: 'success' });
    }
    state = 'idle';
}

async function saveToVFS(filename, blob) {
    try {
        const { vfs } = await import('../vfs.js');
        const buffer = await blob.arrayBuffer();
        const rootItems = await vfs.getChildren(null);
        let videosFolder = rootItems.find(f => f.type === 'folder' && f.name === '视频');
        let parentId = null;
        if (!videosFolder) {
            parentId = await vfs.add({ name: '视频', type: 'folder', parentId: null, inTrash: false });
        } else {
            parentId = videosFolder.id;
        }
        await vfs.add({
            name: filename,
            type: 'file',
            mime: 'video/webm',
            content: buffer,
            size: blob.size,
            parentId: parentId,
            inTrash: false
        });
    } catch (e) {
        console.error('[Recorder] VFS 写入失败:', e);
    }
}

async function createShareLink(filename, blob) {
    try {
        const res = await fetch('/api/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename,
                size: blob.size,
                type: 'video/webm',
                source: 'screen-recorder'
            })
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data && data.url ? data.url : null;
    } catch (e) {
        return null;
    }
}

function cleanup() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        mediaStream = null;
    }
    mediaRecorder = null;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function getState() {
    return state;
}

function init() {
    injectStyles();
    window.MXOS.Recorder = {
        start,
        stop,
        pause,
        resume,
        getState
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, pause, resume, getState };
