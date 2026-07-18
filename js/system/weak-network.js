window.MXOS = window.MXOS || {};
window.MXOS.System = window.MXOS.System || {};

let weakMode = false;
let connection = null;
let listeners = [];

function getConnection() {
    try {
        return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    } catch (e) {
        return null;
    }
}

function isWeak(conn) {
    if (!conn) return false;
    if (conn.saveData) return true;
    const type = conn.effectiveType;
    if (type === 'slow-2g' || type === '2g') return true;
    return false;
}

function downgradeImageUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.indexOf('images.unsplash.com') >= 0) {
        if (url.indexOf('w=') >= 0) {
            return url.replace(/w=\d+/, 'w=400').replace(/q=\d+/, 'q=50');
        }
        const sep = url.indexOf('?') >= 0 ? '&' : '?';
        return url + sep + 'w=400&q=50';
    }
    if (url.indexOf('?w=') >= 0 || url.indexOf('&w=') >= 0) {
        return url.replace(/w=\d+/, 'w=400');
    }
    return url;
}

function downgradeImages() {
    document.querySelectorAll('img').forEach(img => {
        if (img.dataset.mxosOrigSrc) return;
        const src = img.getAttribute('src') || img.src;
        if (!src) return;
        img.dataset.mxosOrigSrc = src;
        const newSrc = downgradeImageUrl(src);
        if (newSrc !== src) {
            img.setAttribute('src', newSrc);
        }
    });
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
        const bg = el.style.backgroundImage;
        if (!bg || bg.indexOf('url(') < 0) return;
        if (el.dataset.mxosOrigBg) return;
        const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!match) return;
        const orig = match[1];
        el.dataset.mxosOrigBg = orig;
        const down = downgradeImageUrl(orig);
        if (down !== orig) {
            el.style.backgroundImage = `url('${down}')`;
        }
    });
}

function pauseVideoWallpapers() {
    const video = document.getElementById('wallpaper-video');
    if (video && !video.paused) {
        video.dataset.mxosWasPlaying = '1';
        video.pause();
    }
}

function resumeVideoWallpapers() {
    const video = document.getElementById('wallpaper-video');
    if (video && video.dataset.mxosWasPlaying === '1') {
        video.play().catch(() => {});
        delete video.dataset.mxosWasPlaying;
    }
}

const abortedRequests = new WeakSet();
function interceptFetch() {
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
        if (weakMode) {
            try {
                const url = typeof input === 'string' ? input : (input && input.url);
                if (url) {
                    const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url) || url.indexOf('images.unsplash.com') >= 0;
                    const isCritical = url.indexOf('/api/') >= 0;
                    if (isImage && url.indexOf('w=400') < 0) {
                        if (typeof input === 'string') {
                            input = downgradeImageUrl(input);
                        } else if (input && input.url) {
                            input = new Request(downgradeImageUrl(input.url), input);
                        }
                    } else if (!isCritical && (init && init.mxosOptional)) {
                        return Promise.reject(new DOMException('Aborted: weak network', 'AbortError'));
                    }
                }
            } catch (e) {}
        }
        return origFetch.call(this, input, init);
    };
    if (!window.fetch.__mxosIntercepted) {
        window.fetch.__mxosIntercepted = true;
    }
}

function enableLazyLoad() {
    document.querySelectorAll('img').forEach(img => {
        if (!img.dataset.mxosLazyInit) {
            img.dataset.mxosLazyInit = '1';
            if (img.loading !== 'lazy') {
                img.loading = 'lazy';
            }
        }
    });
    if (!window.mxosLazyObserver) {
        try {
            window.mxosLazyObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && entry.target.dataset.mxosLazySrc) {
                        const el = entry.target;
                        el.setAttribute('src', el.dataset.mxosLazySrc);
                        delete el.dataset.mxosLazySrc;
                        window.mxosLazyObserver.unobserve(el);
                    }
                });
            }, { rootMargin: '200px' });
        } catch (e) {}
    }
}

function applyWeakMode() {
    document.body.classList.add('mxos-weak-network');
    downgradeImages();
    pauseVideoWallpapers();
    enableLazyLoad();
    window.dispatchEvent(new CustomEvent('mxos:weak-network', { detail: { weak: true } }));
    listeners.forEach(l => { try { l(true); } catch (e) {} });
}

function disableWeakMode() {
    document.body.classList.remove('mxos-weak-network');
    resumeVideoWallpapers();
    window.dispatchEvent(new CustomEvent('mxos:weak-network', { detail: { weak: false } }));
    listeners.forEach(l => { try { l(false); } catch (e) {} });
}

function updateMode() {
    const wasWeak = weakMode;
    weakMode = isWeak(connection);
    if (weakMode && !wasWeak) {
        applyWeakMode();
    } else if (!weakMode && wasWeak) {
        disableWeakMode();
    }
}

function onWeakChange(listener) {
    if (typeof listener === 'function') {
        listeners.push(listener);
    }
}

function isWeakMode() {
    return weakMode;
}

function markOptional(url, options) {
    const opts = options || {};
    opts.mxosOptional = true;
    return [url, opts];
}

function init() {
    connection = getConnection();
    if (connection) {
        connection.addEventListener('change', updateMode);
    }
    updateMode();
    interceptFetch();
    let lastCheck = 0;
    setInterval(() => {
        const now = Date.now();
        if (now - lastCheck > 3000) {
            lastCheck = now;
            if (weakMode) {
                downgradeImages();
                enableLazyLoad();
            }
        }
    }, 3000);
}

const weakNetwork = {
    init,
    isWeakMode,
    onWeakChange,
    downgradeImageUrl,
    markOptional,
    pauseVideoWallpapers,
    resumeVideoWallpapers
};

window.MXOS.System.weakNetwork = weakNetwork;

init();

export { weakNetwork };
