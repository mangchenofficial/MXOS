window.MXOS = window.MXOS || {};

const QRCODE_CDN = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
let qrcodeLoading = null;
let dialogEl = null;

function loadQrLib() {
    if (typeof window.qrcode === 'function') return Promise.resolve(window.qrcode);
    if (qrcodeLoading) return qrcodeLoading;
    qrcodeLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = QRCODE_CDN;
        script.async = true;
        script.onload = () => {
            if (typeof window.qrcode === 'function') resolve(window.qrcode);
            else reject(new Error('qrcode 库加载后未找到全局对象'));
        };
        script.onerror = () => reject(new Error('qrcode 库加载失败'));
        document.head.appendChild(script);
    });
    return qrcodeLoading;
}

function generate(text, options = {}) {
    const typeNumber = options.typeNumber || 0;
    const errorCorrectionLevel = options.errorCorrectionLevel || 'M';
    const cellSize = options.cellSize || 6;
    const margin = options.margin != null ? options.margin : 4;
    const fg = options.foreground || '#000000';
    const bg = options.background || '#ffffff';

    const qr = window.qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(text || '');
    qr.make();
    const moduleCount = qr.getModuleCount();
    const totalSize = (moduleCount + margin * 2) * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = totalSize;
    canvas.height = totalSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, totalSize, totalSize);
    ctx.fillStyle = fg;
    for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
            if (qr.isDark(r, c)) {
                ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
            }
        }
    }
    return canvas;
}

async function generateAsync(text, options) {
    await loadQrLib();
    return generate(text, options);
}

function saveAsPng(canvas, filename) {
    if (!canvas) return false;
    const name = filename || ('mxos-qrcode-' + Date.now() + '.png');
    try {
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
        return true;
    } catch (e) {
        return false;
    }
}

async function saveToVFS(canvas, filename) {
    try {
        const { vfs } = await import('../vfs.js');
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const buffer = await blob.arrayBuffer();
        const rootItems = await vfs.getChildren(null);
        let picsFolder = rootItems.find(f => f.type === 'folder' && f.name === '图片');
        let parentId = null;
        if (!picsFolder) {
            parentId = await vfs.add({ name: '图片', type: 'folder', parentId: null, inTrash: false });
        } else {
            parentId = picsFolder.id;
        }
        await vfs.add({
            name: filename || ('mxos-qrcode-' + Date.now() + '.png'),
            type: 'file',
            mime: 'image/png',
            content: buffer,
            size: blob.size,
            parentId,
            inTrash: false
        });
        return true;
    } catch (e) {
        return false;
    }
}

function injectStyles() {
    if (document.getElementById('mxos-qr-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-qr-styles';
    style.textContent = `
.mxos-qr-dialog {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
}
.mxos-qr-dialog.show { display: flex; }
.mxos-qr-dialog-box {
    width: min(360px, 92vw);
    background: rgba(20, 25, 35, 0.92);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
    color: #fff;
    overflow: hidden;
}
.mxos-qr-dialog-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 14px; font-weight: 600;
}
.mxos-qr-dialog-close {
    width: 28px; height: 28px;
    background: transparent; border: none; cursor: pointer;
    color: #fff; border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
}
.mxos-qr-dialog-close:hover { background: rgba(255, 255, 255, 0.1); }
.mxos-qr-dialog-body {
    padding: 18px;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.mxos-qr-canvas-wrap {
    background: #fff;
    padding: 8px;
    border-radius: 8px;
    line-height: 0;
}
.mxos-qr-canvas-wrap canvas { display: block; max-width: 100%; height: auto; }
.mxos-qr-source {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    max-width: 100%;
    word-break: break-all;
    text-align: center;
    max-height: 60px;
    overflow: auto;
}
.mxos-qr-dialog-actions {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.mxos-qr-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #fff; font-size: 13px; font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
}
.mxos-qr-btn:hover { background: rgba(255, 255, 255, 0.16); }
.mxos-qr-btn.primary {
    background: var(--accent-color, #60a5fa);
    border-color: transparent;
}
.mxos-qr-btn.primary:hover { filter: brightness(1.1); }
.mxos-qr-loading {
    width: 100px; height: 100px;
    display: flex; align-items: center; justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
}
.mxos-qr-loading-spinner {
    width: 28px; height: 28px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--accent-color, #60a5fa);
    border-radius: 50%;
    animation: mxosQrSpin 0.8s linear infinite;
}
@keyframes mxosQrSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
}

function ensureDialog() {
    if (dialogEl) return;
    injectStyles();
    dialogEl = document.createElement('div');
    dialogEl.className = 'mxos-qr-dialog';
    dialogEl.innerHTML = `
        <div class="mxos-qr-dialog-box">
            <div class="mxos-qr-dialog-header">
                <span>二维码</span>
                <button class="mxos-qr-dialog-close" aria-label="关闭">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="mxos-qr-dialog-body">
                <div class="mxos-qr-canvas-wrap" data-canvas></div>
                <div class="mxos-qr-source" data-source></div>
            </div>
            <div class="mxos-qr-dialog-actions">
                <button class="mxos-qr-btn" data-act="savevfs">保存到 VFS</button>
                <button class="mxos-qr-btn primary" data-act="download">下载 PNG</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('.mxos-qr-dialog-close').addEventListener('click', closeDialog);
    dialogEl.addEventListener('click', (e) => {
        if (e.target === dialogEl) closeDialog();
    });
    dialogEl.querySelector('[data-act="download"]').addEventListener('click', () => {
        const canvas = dialogEl.querySelector('canvas');
        if (canvas) saveAsPng(canvas);
    });
    dialogEl.querySelector('[data-act="savevfs"]').addEventListener('click', async () => {
        const canvas = dialogEl.querySelector('canvas');
        if (!canvas) return;
        const ok = await saveToVFS(canvas);
        if (window.MXOS?.dialog?.toast) {
            window.MXOS.dialog.toast(ok ? '已保存到 VFS' : '保存失败', ok ? 'success' : 'error');
        }
    });
}

function closeDialog() {
    if (dialogEl) dialogEl.classList.remove('show');
}

async function showDialog(text, options) {
    ensureDialog();
    const wrap = dialogEl.querySelector('[data-canvas]');
    const sourceEl = dialogEl.querySelector('[data-source]');
    wrap.innerHTML = '<div class="mxos-qr-loading"><span class="mxos-qr-loading-spinner"></span></div>';
    sourceEl.textContent = text;
    dialogEl.classList.add('show');
    try {
        const canvas = await generateAsync(text, options);
        wrap.innerHTML = '';
        wrap.appendChild(canvas);
    } catch (e) {
        wrap.innerHTML = '<div style="color:#f87171;font-size:12px;">生成失败：' + e.message + '</div>';
    }
}

function init() {
    injectStyles();
    window.MXOS.QR = {
        generate: generateAsync,
        generateSync: generate,
        saveAsPng,
        saveToVFS,
        showDialog,
        closeDialog
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { generateAsync as generate, saveAsPng, saveToVFS, showDialog };
