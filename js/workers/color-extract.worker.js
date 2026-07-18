const SAMPLE_SIZE = 64;
const TARGET_CLUSTERS = 5;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function medianCut(pixels, depth, maxDepth) {
    if (pixels.length === 0) return [];
    if (depth >= maxDepth || pixels.length <= 1) {
        let r = 0, g = 0, b = 0;
        for (const p of pixels) {
            r += p[0]; g += p[1]; b += p[2];
        }
        const n = pixels.length || 1;
        return [{
            r: r / n,
            g: g / n,
            b: b / n,
            population: n
        }];
    }
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const p of pixels) {
        if (p[0] < rMin) rMin = p[0]; if (p[0] > rMax) rMax = p[0];
        if (p[1] < gMin) gMin = p[1]; if (p[1] > gMax) gMax = p[1];
        if (p[2] < bMin) bMin = p[2]; if (p[2] > bMax) bMax = p[2];
    }
    const rRange = rMax - rMin;
    const gRange = gMax - gMin;
    const bRange = bMax - bMin;
    let channel = 0;
    if (gRange >= rRange && gRange >= bRange) channel = 1;
    else if (bRange >= rRange && bRange >= gRange) channel = 2;
    pixels.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(pixels.length / 2);
    const left = pixels.slice(0, mid);
    const right = pixels.slice(mid);
    return medianCut(left, depth + 1, maxDepth).concat(medianCut(right, depth + 1, maxDepth));
}

function extractClusters(bitmap) {
    let canvas;
    if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
    } else {
        canvas = { width: SAMPLE_SIZE, height: SAMPLE_SIZE, getContext: () => null };
        return [];
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    } catch (e) {
        return [];
    }
    const data = imageData.data;
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 125) continue;
        pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (pixels.length === 0) return [];
    const maxDepth = Math.ceil(Math.log2(TARGET_CLUSTERS));
    let clusters = medianCut(pixels, 0, maxDepth);
    const total = clusters.reduce((s, c) => s + c.population, 0) || 1;
    clusters.forEach(c => { c.ratio = c.population / total; });
    clusters.sort((a, b) => b.population - a.population);
    return clusters;
}

self.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type !== 'extract') return;
    const bitmap = msg.bitmap;
    if (!bitmap) {
        self.postMessage({ type: 'extract-error', error: '未接收到 bitmap' });
        return;
    }
    try {
        const clusters = extractClusters(bitmap);
        self.postMessage({ type: 'extract-result', clusters });
    } catch (err) {
        self.postMessage({ type: 'extract-error', error: (err && err.message) || '提取异常' });
    } finally {
        if (bitmap && typeof bitmap.close === 'function') {
            try { bitmap.close(); } catch (e) {}
        }
    }
};
