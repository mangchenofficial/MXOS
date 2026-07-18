const cache = new Map();
const inflight = new Map();

function toPlaceholderUrl(url) {
    if (typeof url !== 'string') return url;
    if (url.indexOf('unsplash.com') !== -1) {
        return url.replace(/w=\d+/g, 'w=200').replace(/q=\d+/g, 'q=40');
    }
    if (url.indexOf('?') === -1) return null;
    return url + '&w=200&q=40';
}

export function loadImageWithPlaceholder(url, placeholderUrl) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    if (inflight.has(url)) return inflight.get(url);

    const ph = placeholderUrl || toPlaceholderUrl(url);
    const promise = new Promise((resolve) => {
        const result = { url, placeholder: null, full: null, state: 'placeholder' };
        const finish = (finalUrl) => {
            result.full = finalUrl || url;
            result.state = 'full';
            cache.set(url, result);
            inflight.delete(url);
            resolve(result);
        };

        if (ph && ph !== url) {
            const phImg = new Image();
            phImg.onload = () => {
                result.placeholder = ph;
                result.state = 'placeholder-loaded';
            };
            phImg.src = ph;
        }

        const img = new Image();
        img.onload = () => finish(url);
        img.onerror = () => {
            result.state = 'error';
            cache.set(url, result);
            inflight.delete(url);
            resolve(result);
        };
        img.src = url;
    });
    inflight.set(url, promise);
    return promise;
}

export function applyWallpaperWithFade(el, url, placeholderUrl) {
    if (!el) return Promise.resolve();
    return loadImageWithPlaceholder(url, placeholderUrl).then((info) => {
        if (info.placeholder && info.placeholder !== url) {
            el.style.backgroundImage = `url('${info.placeholder}')`;
            el.style.filter = 'blur(8px)';
        }
        const reveal = () => {
            el.style.transition = 'background-image 0.6s ease, filter 0.6s ease';
            el.style.backgroundImage = `url('${url}')`;
            el.style.filter = '';
            setTimeout(() => { el.style.transition = ''; }, 700);
        };
        if (info.state === 'full' || info.full === url) {
            setTimeout(reveal, 50);
        } else {
            setTimeout(reveal, 200);
        }
    });
}

window.MXOS = window.MXOS || {};
window.MXOS.loadImageWithPlaceholder = loadImageWithPlaceholder;
window.MXOS.applyWallpaperWithFade = applyWallpaperWithFade;

export default loadImageWithPlaceholder;
