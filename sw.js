const SW_VERSION = 'mxos-sw-v26';
const STATIC_CACHE = SW_VERSION + '-static';
const RUNTIME_CACHE = SW_VERSION + '-runtime';

const STATIC_ASSETS = [
    './',
    './index.html',
    './js/main.js',
    './js/core.js',
    './js/state.js',
    './js/vfs.js',
    './js/settings.js',
    './js/desktop.js',
    './js/api.js',
    './js/utils/event-bus.js',
    './js/utils/dialog.js',
    './js/utils/debounce.js',
    './js/utils/logger.js',
    './js/utils/virtual-scroll.js',
    './js/utils/image-loader.js',
    './js/utils/http.js',
    './js/workers/vfs-search.worker.js',
    './js/workers/start-search.worker.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

const BILIBILI_DOMAINS = [
    'api.bilibili.com',
    'app.bilibili.com',
    's.search.bilibili.com'
];

function generateBuvid3() {
    const chars = 'ABCDEF0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    result += '-';
    for (let i = 0; i < 4; i++) result += chars[Math.floor(Math.random() * chars.length)];
    result += '-';
    for (let i = 0; i < 4; i++) result += chars[Math.floor(Math.random() * chars.length)];
    result += '-';
    for (let i = 0; i < 4; i++) result += chars[Math.floor(Math.random() * chars.length)];
    result += '-';
    for (let i = 0; i < 12; i++) result += chars[Math.floor(Math.random() * chars.length)];
    result += 'infoc';
    return result;
}

async function handleBilibiliRequest(request) {
    const newHeaders = new Headers(request.headers);
    newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    newHeaders.set('Accept', 'application/json, text/plain, */*');
    newHeaders.set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
    newHeaders.set('Referer', 'https://search.bilibili.com/');
    newHeaders.set('Origin', 'https://search.bilibili.com');
    newHeaders.set('Cookie', `buvid3=${generateBuvid3()}; b_nut=${Math.floor(Date.now() / 1000)}; CURRENT_FNVAL=4048`);
    const newRequest = new Request(request, { headers: newHeaders, mode: 'cors', credentials: 'omit' });
    try {
        const response = await fetch(newRequest);
        const corsHeaders = new Headers(response.headers);
        corsHeaders.set('Access-Control-Allow-Origin', '*');
        corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        corsHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers: corsHeaders });
    } catch (error) {
        return new Response(JSON.stringify({ code: -1, message: 'SW 代理失败: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => caches.delete(key)));
        }).then(() => {
            return caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    const isBilibiliAPI = BILIBILI_DOMAINS.some(domain => url.hostname.includes(domain));
    if (isBilibiliAPI) {
        event.respondWith(handleBilibiliRequest(event.request));
        return;
    }

    if (event.request.method !== 'GET') return;

    const sameOrigin = url.origin === self.location.origin;
    const isStaticAsset = sameOrigin && /\.(js|css|html|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)(\?|$)/i.test(url.pathname);
    const isCDN = !sameOrigin && (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('images.unsplash.com'));

    if (isStaticAsset || isCDN) {
        event.respondWith(
            fetch(event.request).then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone)).catch(() => {});
                }
                return response;
            }).catch(() => {
                return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
            })
        );
        return;
    }

    if (sameOrigin) {
        event.respondWith(
            fetch(event.request).then(response => {
                if (response && response.ok && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone)).catch(() => {});
                }
                return response;
            }).catch(() => {
                return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
            })
        );
    }
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
