window.MXOS = window.MXOS || {};

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js';
let tesseractLoading = null;
let workerCache = new Map();
let resultDialogEl = null;

function isSupported() {
    return typeof window !== 'object' || !!window.Worker;
}

function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractLoading) return tesseractLoading;
    tesseractLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = TESSERACT_CDN;
        script.async = true;
        script.onload = () => {
            if (window.Tesseract) {
                resolve(window.Tesseract);
            } else {
                reject(new Error('Tesseract.js 加载完成但未找到全局对象'));
            }
        };
        script.onerror = () => reject(new Error('Tesseract.js 加载失败'));
        document.head.appendChild(script);
    });
    return tesseractLoading;
}

function parseLangs(langs) {
    if (!langs) return 'eng';
    if (typeof langs === 'string') return langs;
    if (Array.isArray(langs)) return langs.join('+');
    return 'eng';
}

async function recognize(input, langs = 'chi_sim+eng') {
    if (!isSupported()) {
        throw new Error('当前环境不支持 OCR');
    }
    const Tesseract = await loadTesseract();
    const langStr = parseLangs(langs);
    let imageBlob = input;
    if (typeof input === 'string') {
        if (input.startsWith('data:') || input.startsWith('blob:')) {
            imageBlob = input;
        } else {
            const res = await fetch(input);
            imageBlob = await res.blob();
        }
    } else if (input instanceof Blob) {
        // ok
    } else if (input instanceof HTMLCanvasElement) {
        imageBlob = await new Promise(resolve => input.toBlob(resolve, 'image/png'));
    } else if (input instanceof HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = input.naturalWidth || input.width;
        canvas.height = input.naturalHeight || input.height;
        canvas.getContext('2d').drawImage(input, 0, 0);
        imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    } else {
        throw new Error('不支持的输入类型');
    }

    const cacheKey = langStr;
    let worker = workerCache.get(cacheKey);
    if (!worker) {
        worker = await Tesseract.createWorker(langStr, 1, {
            logger: () => {}
        });
        workerCache.set(cacheKey, worker);
    }
    const result = await worker.recognize(imageBlob);
    return {
        text: result?.data?.text || '',
        confidence: result?.data?.confidence ?? null,
        languages: langStr
    };
}

async function recognizeWithUI(input, langs) {
    showProgressDialog();
    try {
        const result = await recognize(input, langs);
        showResultDialog(result.text);
        return result;
    } catch (e) {
        if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('OCR 识别失败：' + e.message, 'error');
        throw e;
    } finally {
        hideProgressDialog();
    }
}

function injectStyles() {
    if (document.getElementById('mxos-ocr-styles')) return;
    const style = document.createElement('style');
    style.id = 'mxos-ocr-styles';
    style.textContent = `
.mxos-ocr-progress {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
}
.mxos-ocr-progress.show { display: flex; }
.mxos-ocr-progress-box {
    background: rgba(20, 25, 35, 0.9);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    padding: 24px 32px;
    color: #fff;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
    min-width: 280px;
}
.mxos-ocr-progress-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
}
.mxos-ocr-progress-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--accent-color, #60a5fa);
    border-radius: 50%;
    animation: mxosOcrSpin 0.8s linear infinite;
}
@keyframes mxosOcrSpin { to { transform: rotate(360deg); } }
.mxos-ocr-progress-text { font-size: 12px; color: rgba(255, 255, 255, 0.6); }
.mxos-ocr-result {
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
.mxos-ocr-result.show { display: flex; }
.mxos-ocr-result-box {
    width: min(640px, 92vw);
    max-height: 80vh;
    background: rgba(20, 25, 35, 0.92);
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
    color: #fff;
    display: flex; flex-direction: column;
    overflow: hidden;
}
.mxos-ocr-result-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 14px; font-weight: 600;
}
.mxos-ocr-result-close {
    width: 28px; height: 28px;
    background: transparent; border: none; cursor: pointer;
    color: #fff; border-radius: 6px;
    display: inline-flex; align-items: center; justify-content: center;
}
.mxos-ocr-result-close:hover { background: rgba(255, 255, 255, 0.1); }
.mxos-ocr-result-text {
    flex: 1;
    overflow: auto;
    padding: 16px 18px;
    font-size: 14px;
    line-height: 1.6;
    color: #fff;
    white-space: pre-wrap;
    word-break: break-word;
    background: rgba(0, 0, 0, 0.2);
    margin: 12px 18px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    outline: none;
}
.mxos-ocr-result-text:focus { border-color: var(--accent-color, #60a5fa); }
.mxos-ocr-result-actions {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.mxos-ocr-btn {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: #fff; font-size: 13px; font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
}
.mxos-ocr-btn:hover { background: rgba(255, 255, 255, 0.16); }
.mxos-ocr-btn.primary {
    background: var(--accent-color, #60a5fa);
    border-color: transparent;
}
.mxos-ocr-btn.primary:hover { filter: brightness(1.1); }
    `;
    document.head.appendChild(style);
}

function showProgressDialog() {
    let el = document.querySelector('.mxos-ocr-progress');
    if (!el) {
        el = document.createElement('div');
        el.className = 'mxos-ocr-progress';
        el.innerHTML = `
            <div class="mxos-ocr-progress-box">
                <div class="mxos-ocr-progress-title">
                    <span class="mxos-ocr-progress-spinner"></span>
                    <span>正在识别文字…</span>
                </div>
                <div class="mxos-ocr-progress-text">首次加载语言包可能需要数秒</div>
            </div>
        `;
        document.body.appendChild(el);
    }
    el.classList.add('show');
}

function hideProgressDialog() {
    const el = document.querySelector('.mxos-ocr-progress');
    if (el) el.classList.remove('show');
}

function showResultDialog(text) {
    injectStyles();
    if (!resultDialogEl) {
        resultDialogEl = document.createElement('div');
        resultDialogEl.className = 'mxos-ocr-result';
        resultDialogEl.innerHTML = `
            <div class="mxos-ocr-result-box">
                <div class="mxos-ocr-result-header">
                    <span>OCR 识别结果</span>
                    <button class="mxos-ocr-result-close" aria-label="关闭">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="mxos-ocr-result-text" contenteditable="true" spellcheck="false" aria-label="识别结果"></div>
                <div class="mxos-ocr-result-actions">
                    <button class="mxos-ocr-btn" data-act="copy">复制</button>
                    <button class="mxos-ocr-btn" data-act="save">保存到记事本</button>
                    <button class="mxos-ocr-btn primary" data-act="close">完成</button>
                </div>
            </div>
        `;
        document.body.appendChild(resultDialogEl);
        resultDialogEl.querySelector('.mxos-ocr-result-close').addEventListener('click', () => hideResultDialog());
        resultDialogEl.addEventListener('click', (e) => {
            if (e.target === resultDialogEl) hideResultDialog();
        });
        resultDialogEl.querySelector('[data-act="close"]').addEventListener('click', hideResultDialog);
        resultDialogEl.querySelector('[data-act="copy"]').addEventListener('click', async () => {
            const txt = resultDialogEl.querySelector('.mxos-ocr-result-text').textContent;
            try {
                if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(txt);
                if (window.MXOS?.clipboard?.set) await window.MXOS.clipboard.set(txt);
                if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已复制到剪贴板', 'success');
            } catch (e) {}
        });
        resultDialogEl.querySelector('[data-act="save"]').addEventListener('click', async () => {
            const txt = resultDialogEl.querySelector('.mxos-ocr-result-text').textContent;
            try {
                const { vfs } = await import('../vfs.js');
                const rootItems = await vfs.getChildren(null);
                let docsFolder = rootItems.find(f => f.type === 'folder' && f.name === '文档');
                let parentId = null;
                if (!docsFolder) {
                    parentId = await vfs.add({ name: '文档', type: 'folder', parentId: null, inTrash: false });
                } else {
                    parentId = docsFolder.id;
                }
                await vfs.add({
                    name: 'ocr-' + Date.now() + '.txt',
                    type: 'file',
                    content: txt,
                    size: txt.length,
                    parentId,
                    inTrash: false
                });
                if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('已保存到 VFS', 'success');
            } catch (e) {
                if (window.MXOS?.dialog?.toast) window.MXOS.dialog.toast('保存失败：' + e.message, 'error');
            }
        });
    }
    resultDialogEl.querySelector('.mxos-ocr-result-text').textContent = text;
    resultDialogEl.classList.add('show');
}

function hideResultDialog() {
    if (resultDialogEl) resultDialogEl.classList.remove('show');
}

async function terminateAll() {
    for (const worker of workerCache.values()) {
        try { await worker.terminate(); } catch (e) {}
    }
    workerCache.clear();
}

function init() {
    injectStyles();
    window.MXOS.OCR = {
        recognize: recognizeWithUI,
        recognizeRaw: recognize,
        isSupported,
        terminateAll
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { recognize, recognizeWithUI, isSupported, terminateAll };
