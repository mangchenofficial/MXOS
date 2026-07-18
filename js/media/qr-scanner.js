window.MXOS = window.MXOS || {};

const JSQR_CDN = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
let jsqrLoading = null;
let scanStream = null;
let scanVideo = null;
let scanCanvas = null;
let scanCtx = null;
let scanOverlay = null;
let scanRAF = null;
let scanning = false;
let lastResultTime = 0;

function loadJsQR() {
    if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
    if (jsqrLoading) return jsqrLoading;
    jsqrLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = JSQR_CDN;
        script.async = true;
        script.onload = () => {
            if (typeof window.jsQR === 'function') resolve(window.jsQR);
            else reject(new Error('jsQR 加载后未找到全局对象'));
        };
        script.onerror = () => reject(new Error('jsQR 加载失败'));
        document.head.appendChild(script);
    });
    return jsqrLoading;
}

function injectStyles() {
    if (document.getElementById('mxos-qr-scanner-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-qr-scanner-styles';
    style.textContent = `
.mxos-qr-scanner-overlay {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: none;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
}
.mxos-qr-scanner-overlay.show { display: flex; }
.mxos-qr-scanner-header {
    position: absolute;
    top: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px;
    color: #fff;
    font-size: 14px;
}
.mxos-qr-scanner-close {
    width: 36px; height: 36px;
    background: rgba(255, 255, 255, 0.1);
    border: none; cursor: pointer;
    color: #fff; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
}
.mxos-qr-scanner-close:hover { background: rgba(255, 255, 255, 0.2); }
.mxos-qr-scanner-video-wrap {
    position: relative;
    width: min(640px, 92vw);
    max-height: 80vh;
    border-radius: 14px;
    overflow: hidden;
    background: #000;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}
.mxos-qr-scanner-video {
    display: block;
    width: 100%;
    height: auto;
    max-height: 80vh;
    object-fit: contain;
}
.mxos-qr-scanner-frame {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    aspect-ratio: 1 / 1;
    border: 2px solid rgba(96, 165, 250, 0.7);
    border-radius: 12px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
    pointer-events: none;
}
.mxos-qr-scanner-frame::before,
.mxos-qr-scanner-frame::after {
    content: '';
    position: absolute;
    width: 28px; height: 28px;
    border: 3px solid var(--accent-color, #60a5fa);
}
.mxos-qr-scanner-frame::before {
    top: -3px; left: -3px;
    border-right: none; border-bottom: none;
    border-radius: 12px 0 0 0;
}
.mxos-qr-scanner-frame::after {
    bottom: -3px; right: -3px;
    border-left: none; border-top: none;
    border-radius: 0 0 12px 0;
}
.mxos-qr-scanner-hint {
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 25, 35, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    padding: 8px 18px;
    font-size: 13px;
    color: #fff;
}
.mxos-qr-scanner-result {
    position: absolute;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 25, 35, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(96, 165, 250, 0.4);
    border-radius: 10px;
    padding: 12px 16px;
    color: #fff;
    max-width: 90vw;
    font-size: 13px;
    word-break: break-all;
    display: none;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.mxos-qr-scanner-result.show { display: block; }
.mxos-qr-scanner-result-actions {
    margin-top: 8px;
    display: flex; gap: 6px;
}
.mxos-qr-scanner-result-btn {
    padding: 4px 10px;
    background: rgba(96, 165, 250, 0.3);
    border: 1px solid rgba(96, 165, 250, 0.4);
    border-radius: 6px;
    color: #fff; font-size: 12px;
    cursor: pointer;
}
.mxos-qr-scanner-result-btn:hover { background: rgba(96, 165, 250, 0.5); }
    `;
    document.head.appendChild(style);
}

function buildOverlay() {
    if (scanOverlay) return;
    injectStyles();
    scanOverlay = document.createElement('div');
    scanOverlay.className = 'mxos-qr-scanner-overlay';
    scanOverlay.innerHTML = `
        <div class="mxos-qr-scanner-header">
            <span>二维码扫描</span>
            <button class="mxos-qr-scanner-close" aria-label="关闭">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="mxos-qr-scanner-video-wrap">
            <video class="mxos-qr-scanner-video" autoplay playsinline muted></video>
            <div class="mxos-qr-scanner-frame"></div>
        </div>
        <div class="mxos-qr-scanner-hint">将二维码对准框内</div>
        <div class="mxos-qr-scanner-result" data-result></div>
    `;
    document.body.appendChild(scanOverlay);
    scanOverlay.querySelector('.mxos-qr-scanner-close').addEventListener('click', stop);
    scanVideo = scanOverlay.querySelector('.mxos-qr-scanner-video');
    scanCanvas = document.createElement('canvas');
    scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
}

async function start(camera = 'environment') {
    if (scanning) return false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('当前环境不支持摄像头扫描', 'warning');
        return false;
    }
    try {
        await loadJsQR();
    } catch (e) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('jsQR 库加载失败', 'error');
        return false;
    }
    try {
        scanStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: camera },
            audio: false
        });
    } catch (e) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('无法访问摄像头：' + e.message, 'error');
        return false;
    }
    if (!scanOverlay) buildOverlay();
    scanVideo.srcObject = scanStream;
    await scanVideo.play();
    scanOverlay.classList.add('show');
    scanning = true;
    lastResultTime = 0;
    hideResult();
    tickScan();
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('二维码扫描已启动');
    return true;
}

function tickScan() {
    if (!scanning) return;
    scanRAF = requestAnimationFrame(tickScan);
    if (!scanVideo || scanVideo.readyState !== scanVideo.HAVE_ENOUGH_DATA) return;
    const w = scanVideo.videoWidth;
    const h = scanVideo.videoHeight;
    if (!w || !h) return;
    if (scanCanvas.width !== w) scanCanvas.width = w;
    if (scanCanvas.height !== h) scanCanvas.height = h;
    try {
        scanCtx.drawImage(scanVideo, 0, 0, w, h);
        const imageData = scanCtx.getImageData(0, 0, w, h);
        const code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
            const now = Date.now();
            if (now - lastResultTime > 2000) {
                lastResultTime = now;
                onScanResult(code.data, code.location);
            }
        }
    } catch (e) {}
}

function onScanResult(text, location) {
    showResult(text);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('success');
    if (window.MXOS?.notify) {
        window.MXOS.notify({
            title: '二维码扫描成功',
            body: text.length > 80 ? (text.slice(0, 80) + '…') : text,
            type: 'success'
        });
    }
}

function showResult(text) {
    if (!scanOverlay) return;
    const resultEl = scanOverlay.querySelector('[data-result]');
    if (!resultEl) return;
    const isUrl = /^(https?:\/\/|www\.)/i.test(text);
    const actionsHtml = isUrl
        ? `<div class="mxos-qr-scanner-result-actions">
             <button class="mxos-qr-scanner-result-btn" data-act="open">打开链接</button>
             <button class="mxos-qr-scanner-result-btn" data-act="copy">复制</button>
           </div>`
        : `<div class="mxos-qr-scanner-result-actions">
             <button class="mxos-qr-scanner-result-btn" data-act="copy">复制</button>
           </div>`;
    resultEl.innerHTML = `<div>${escapeHtml(text)}</div>${actionsHtml}`;
    resultEl.classList.add('show');
    resultEl.querySelector('[data-act="copy"]')?.addEventListener('click', async () => {
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
            if (window.MXOS?.clipboard?.set) await window.MXOS.clipboard.set(text);
            if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已复制到剪贴板', 'success');
        } catch (e) {}
    });
    resultEl.querySelector('[data-act="open"]')?.addEventListener('click', () => {
        let url = text;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        window.open(url, '_blank');
    });
}

function hideResult() {
    if (!scanOverlay) return;
    const resultEl = scanOverlay.querySelector('[data-result]');
    if (resultEl) {
        resultEl.classList.remove('show');
        resultEl.innerHTML = '';
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function stop() {
    if (!scanning) return false;
    scanning = false;
    if (scanRAF) {
        cancelAnimationFrame(scanRAF);
        scanRAF = null;
    }
    if (scanStream) {
        scanStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
        scanStream = null;
    }
    if (scanVideo) {
        try { scanVideo.srcObject = null; } catch (e) {}
    }
    if (scanOverlay) {
        scanOverlay.classList.remove('show');
        hideResult();
    }
    return true;
}

function isRunning() {
    return scanning;
}

function init() {
    injectStyles();
    window.MXOS.QRScanner = {
        start,
        stop,
        isRunning
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, isRunning };
