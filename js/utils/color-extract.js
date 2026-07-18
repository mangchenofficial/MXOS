const DEFAULT_ACCENT = '#60a5fa';
const DEFAULT_COLORS = {
    primary: '#60a5fa',
    secondary: '#60a5fa',
    bg: '#0e1513',
    highlight: '#fbbf24',
    text: '#ffffff'
};

let workerInstance = null;
let workerSupported = typeof Worker !== 'undefined';

function getWorker() {
    if (!workerSupported) return null;
    if (!workerInstance) {
        try {
            workerInstance = new Worker(new URL('../workers/color-extract.worker.js', import.meta.url));
        } catch (e) {
            workerSupported = false;
            console.warn('[color-extract] Worker 创建失败，回退主线程:', e);
            return null;
        }
    }
    return workerInstance;
}

function loadImage(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error('图片加载失败: ' + imageUrl));
        img.src = imageUrl;
    });
}

function imageToBitmap(img) {
    if (typeof createImageBitmap === 'function') {
        return createImageBitmap(img);
    }
    return Promise.resolve(img);
}

function extractInWorker(bitmap) {
    return new Promise((resolve, reject) => {
        const worker = getWorker();
        if (!worker) {
            reject(new Error('Worker 不可用'));
            return;
        }
        const timeout = setTimeout(() => {
            reject(new Error('Worker 提取超时'));
        }, 8000);
        const handler = (e) => {
            if (e.data && e.data.type === 'extract-result') {
                worker.removeEventListener('message', handler);
                clearTimeout(timeout);
                resolve(e.data.clusters);
            } else if (e.data && e.data.type === 'extract-error') {
                worker.removeEventListener('message', handler);
                clearTimeout(timeout);
                reject(new Error(e.data.error || 'Worker 提取失败'));
            }
        };
        worker.addEventListener('message', handler);
        const transferList = (typeof bitmap.close === 'function') ? [bitmap] : [];
        worker.postMessage({ type: 'extract', bitmap }, transferList);
    });
}

function luminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function rgbToHex(r, g, b) {
    const toHex = (v) => {
        const i = Math.max(0, Math.min(255, Math.round(v)));
        return i.toString(16).padStart(2, '0');
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function pickColorsFromClusters(clusters) {
    if (!clusters || !clusters.length) {
        return { ...DEFAULT_COLORS };
    }
    const filtered = clusters.filter(c => {
        const lum = luminance(c.r, c.g, c.b);
        return lum >= 0.10 && lum <= 0.95;
    });
    const pool = filtered.length >= 2 ? filtered : clusters.slice();
    pool.sort((a, b) => b.population - a.population);
    const top = pool.slice(0, 5);
    if (!top.length) {
        return { ...DEFAULT_COLORS };
    }
    const primary = rgbToHex(top[0].r, top[0].g, top[0].b);
    const secondary = top[1] ? rgbToHex(top[1].r, top[1].g, top[1].b) : primary;
    const bgCluster = pool.slice().reverse().find(c => luminance(c.r, c.g, c.b) < 0.5) || top[top.length - 1];
    const bg = rgbToHex(bgCluster.r * 0.18, bgCluster.g * 0.18, bgCluster.b * 0.18);
    const highlightCluster = top.find(c => {
        const lum = luminance(c.r, c.g, c.b);
        return lum > 0.55;
    }) || top[0];
    const highlight = rgbToHex(highlightCluster.r, highlightCluster.g, highlightCluster.b);
    const bgLum = luminance(bgCluster.r * 0.18, bgCluster.g * 0.18, bgCluster.b * 0.18);
    const text = bgLum < 0.5 ? '#ffffff' : '#0a0a0a';
    return { primary, secondary, bg, highlight, text };
}

export async function extractColors(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
        return { ...DEFAULT_COLORS };
    }
    try {
        const img = await loadImage(imageUrl);
        const bitmap = await imageToBitmap(img);
        let clusters;
        try {
            clusters = await extractInWorker(bitmap);
        } catch (err) {
            console.warn('[color-extract] Worker 提取失败，使用默认色:', err.message);
            return { ...DEFAULT_COLORS };
        }
        if (bitmap && typeof bitmap.close === 'function') {
            try { bitmap.close(); } catch (e) {}
        }
        return pickColorsFromClusters(clusters);
    } catch (e) {
        console.warn('[color-extract] 提取失败，回退默认色:', e.message);
        return { ...DEFAULT_COLORS };
    }
}

export function getDefaultColors() {
    return { ...DEFAULT_COLORS };
}

export const DEFAULT_ACCENT_COLOR = DEFAULT_ACCENT;
