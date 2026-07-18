window.MXOS = window.MXOS || {};

let active = false;
let overlayEl = null;
let magnifierEl = null;
let infoEl = null;
let swatchEl = null;
let canvasEl = null;
let ctx = null;
let videoEl = null;
let captureStream = null;
let currentColor = { r: 0, g: 0, b: 0, hex: '#000000' };
let moveHandler = null;
let clickHandler = null;
let keyHandler = null;

function injectStyles() {
    if (document.getElementById('color-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'color-picker-styles';
    style.textContent = `
.cp-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    cursor: crosshair;
    display: none;
}
.cp-overlay.active {
    display: block;
}
.cp-magnifier {
    position: fixed;
    pointer-events: none;
    width: 144px;
    height: 144px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    transform: translate(20px, 20px);
    z-index: 10000;
    background: #000;
}
.cp-magnifier-canvas {
    width: 144px;
    height: 144px;
    display: block;
    image-rendering: pixelated;
}
.cp-magnifier-center {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 12px;
    height: 12px;
    margin-top: -6px;
    margin-left: -6px;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #000;
    pointer-events: none;
}
.cp-info {
    position: fixed;
    pointer-events: none;
    z-index: 10001;
    background: rgba(20, 25, 35, 0.85);
    backdrop-filter: blur(12px) saturate(160%);
    -webkit-backdrop-filter: blur(12px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 8px 10px;
    color: #fff;
    font-size: 12px;
    font-family: 'Consolas', 'Courier New', monospace;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    transform: translate(20px, 180px);
    min-width: 140px;
}
.cp-info-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    line-height: 1.6;
}
.cp-info-label {
    color: #9ca3af;
}
.cp-info-value {
    color: #fff;
    font-weight: 600;
}
.cp-swatch {
    width: 100%;
    height: 22px;
    border-radius: 4px;
    margin-bottom: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
}
.cp-hint {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20, 25, 35, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    padding: 8px 18px;
    color: #fff;
    font-size: 13px;
    z-index: 10001;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}
.cp-hint kbd {
    background: rgba(255, 255, 255, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    margin: 0 2px;
}
    `;
    document.head.appendChild(style);
}

function ensureCanvas() {
    if (!canvasEl) {
        canvasEl = document.createElement('canvas');
        canvasEl.width = 144;
        canvasEl.height = 144;
        ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    }
    return ctx;
}

function buildOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'cp-overlay';
    overlayEl.setAttribute('aria-hidden', 'true');

    magnifierEl = document.createElement('div');
    magnifierEl.className = 'cp-magnifier';
    magnifierEl.innerHTML = `
        <canvas class="cp-magnifier-canvas" width="144" height="144"></canvas>
        <div class="cp-magnifier-center"></div>
    `;
    overlayEl.appendChild(magnifierEl);
    const magCanvas = magnifierEl.querySelector('.cp-magnifier-canvas');
    canvasEl = magCanvas;
    ctx = canvasEl.getContext('2d', { willReadFrequently: true });

    infoEl = document.createElement('div');
    infoEl.className = 'cp-info';
    infoEl.innerHTML = `
        <div class="cp-swatch"></div>
        <div class="cp-info-row"><span class="cp-info-label">HEX</span><span class="cp-info-value" data-cp="hex">-</span></div>
        <div class="cp-info-row"><span class="cp-info-label">RGB</span><span class="cp-info-value" data-cp="rgb">-</span></div>
        <div class="cp-info-row"><span class="cp-info-label">HSL</span><span class="cp-info-value" data-cp="hsl">-</span></div>
    `;
    overlayEl.appendChild(infoEl);
    swatchEl = infoEl.querySelector('.cp-swatch');

    const hint = document.createElement('div');
    hint.className = 'cp-hint';
    hint.innerHTML = '点击复制颜色 · <kbd>Esc</kbd> 退出';
    overlayEl.appendChild(hint);

    document.body.appendChild(overlayEl);
}

function rgbToHex(r, g, b) {
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function sampleColor(x, y) {
    if (!videoEl || !videoEl.videoWidth) return { r: 0, g: 0, b: 0 };
    const ctxLocal = ensureCanvas();
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const sx = Math.max(0, Math.min(vw - 1, Math.floor(x / window.innerWidth * vw)));
    const sy = Math.max(0, Math.min(vh - 1, Math.floor(y / window.innerHeight * vh)));
    try {
        ctxLocal.drawImage(videoEl, sx, sy, 1, 1, 0, 0, 1, 1);
        const data = ctxLocal.getImageData(0, 0, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2] };
    } catch (e) {
        return { r: 0, g: 0, b: 0 };
    }
}

function updateMagnifier(x, y) {
    const ctxLocal = ensureCanvas();
    if (videoEl && videoEl.videoWidth) {
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const sx = Math.floor(x / window.innerWidth * vw);
        const sy = Math.floor(y / window.innerHeight * vh);
        const sampleW = Math.floor(vw / window.innerWidth * 144);
        const sampleH = Math.floor(vh / window.innerHeight * 144);
        const srcX = Math.max(0, Math.min(vw - sampleW, sx - Math.floor(sampleW / 2)));
        const srcY = Math.max(0, Math.min(vh - sampleH, sy - Math.floor(sampleH / 2)));
        try {
            ctxLocal.drawImage(videoEl, srcX, srcY, sampleW, sampleH, 0, 0, 144, 144);
        } catch (e) {
            ctxLocal.fillStyle = '#000';
            ctxLocal.fillRect(0, 0, 144, 144);
        }
        try {
            const cx = 72, cy = 72;
            const imageData = ctxLocal.getImageData(cx, cy, 1, 1).data;
            currentColor = { r: imageData[0], g: imageData[1], b: imageData[2] };
        } catch (e) {
            currentColor = { r: 0, g: 0, b: 0 };
        }
    } else {
        ctxLocal.fillStyle = '#000';
        ctxLocal.fillRect(0, 0, 144, 144);
        currentColor = { r: 0, g: 0, b: 0 };
    }
    currentColor.hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
    const [h, s, l] = rgbToHsl(currentColor.r, currentColor.g, currentColor.b);

    if (magnifierEl) {
        magnifierEl.style.left = x + 'px';
        magnifierEl.style.top = y + 'px';
    }
    if (infoEl) {
        infoEl.style.left = x + 'px';
        infoEl.style.top = y + 'px';
        infoEl.querySelector('[data-cp="hex"]').textContent = currentColor.hex.toUpperCase();
        infoEl.querySelector('[data-cp="rgb"]').textContent = `${currentColor.r}, ${currentColor.g}, ${currentColor.b}`;
        infoEl.querySelector('[data-cp="hsl"]').textContent = `${h}°, ${s}%, ${l}%`;
    }
    if (swatchEl) swatchEl.style.background = currentColor.hex;
}

function onMouseMove(e) {
    updateMagnifier(e.clientX, e.clientY);
}

async function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!currentColor.hex) return;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(currentColor.hex);
        }
    } catch {}
    if (window.MXOS?.clipboard?.set) {
        try { await window.MXOS.clipboard.set(currentColor.hex); } catch {}
    }
    if (window.MXOS?.notify) {
        window.MXOS.notify({
            title: '颜色已复制',
            body: currentColor.hex.toUpperCase() + ' 已复制到剪贴板',
            type: 'success'
        });
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('success');
    stop();
}

function onKey(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        stop();
    }
}

async function start() {
    if (active) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('当前环境不支持颜色拾取器', 'warning');
        return false;
    }
    try {
        captureStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'never' },
            audio: false
        });
    } catch (e) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已取消颜色拾取器', 'info');
        return false;
    }
    if (!overlayEl) buildOverlay();
    videoEl = document.createElement('video');
    videoEl.style.display = 'none';
    videoEl.srcObject = captureStream;
    videoEl.muted = true;
    document.body.appendChild(videoEl);
    try {
        await videoEl.play();
    } catch (e) {}
    captureStream.getVideoTracks()[0].addEventListener('ended', () => stop());

    active = true;
    overlayEl.classList.add('active');
    document.body.style.cursor = 'crosshair';
    document.documentElement.style.cursor = 'crosshair';
    moveHandler = onMouseMove;
    clickHandler = onClick;
    keyHandler = onKey;
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('click', clickHandler, true);
    document.addEventListener('keydown', keyHandler, true);
    document.addEventListener('contextmenu', preventDefault, true);
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
    if (window.mxosAnnounceUrgent) window.mxosAnnounceUrgent('颜色拾取器已启动，按 Esc 退出');
    return true;
}

function preventDefault(e) {
    e.preventDefault();
}

function stop() {
    if (!active) return;
    active = false;
    if (overlayEl) overlayEl.classList.remove('active');
    document.body.style.cursor = '';
    document.documentElement.style.cursor = '';
    if (moveHandler) {
        document.removeEventListener('mousemove', moveHandler);
        moveHandler = null;
    }
    if (clickHandler) {
        document.removeEventListener('click', clickHandler, true);
        clickHandler = null;
    }
    if (keyHandler) {
        document.removeEventListener('keydown', keyHandler, true);
        keyHandler = null;
    }
    document.removeEventListener('contextmenu', preventDefault, true);
    if (captureStream) {
        captureStream.getTracks().forEach(t => t.stop());
        captureStream = null;
    }
    if (videoEl) {
        videoEl.srcObject = null;
        videoEl.remove();
        videoEl = null;
    }
    if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
}

function isActive() {
    return active;
}

function init() {
    injectStyles();
    window.MXOS.ColorPicker = {
        start,
        stop,
        isActive,
        getColor: () => currentColor.hex ? { ...currentColor } : null
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { start, stop, isActive };
