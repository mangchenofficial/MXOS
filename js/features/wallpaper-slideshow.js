(function() {
    const MXOS = window.MXOS = window.MXOS || {};
    const LIST_KEY = 'mxos_slideshow_list';
    const INTERVAL_KEY = 'mxos_slideshow_interval';
    const ENABLED_KEY = 'mxos_slideshow_enabled';
    const FADE_MS = 500;

    const INTERVAL_MS = {
        '10min': 10 * 60 * 1000,
        '30min': 30 * 60 * 1000,
        '1hour': 60 * 60 * 1000,
        'daily': 24 * 60 * 60 * 1000
    };

    let timer = null;
    let currentIndex = 0;
    let running = false;

    function readList() {
        try {
            const raw = localStorage.getItem(LIST_KEY);
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr.filter(u => typeof u === 'string' && u) : [];
        } catch (e) {
            return [];
        }
    }

    function writeList(list) {
        try {
            localStorage.setItem(LIST_KEY, JSON.stringify(list));
        } catch (e) {}
    }

    function readInterval() {
        try {
            const v = localStorage.getItem(INTERVAL_KEY);
            if (v && INTERVAL_MS[v]) return v;
        } catch (e) {}
        return '30min';
    }

    function writeInterval(key) {
        if (!INTERVAL_MS[key]) return;
        try { localStorage.setItem(INTERVAL_KEY, key); } catch (e) {}
    }

    function isPersistentEnabled() {
        try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch (e) { return false; }
    }

    function setPersistentEnabled(v) {
        try { localStorage.setItem(ENABLED_KEY, v ? '1' : '0'); } catch (e) {}
    }

    function applyWallpaper(url) {
        const wallpaperBg = document.getElementById('wallpaper-bg');
        const wallpaperVideo = document.getElementById('wallpaper-video');
        if (wallpaperBg && wallpaperVideo) {
            if (wallpaperBg.style.opacity === '' || wallpaperBg.style.opacity === '1') {
                wallpaperBg.style.transition = 'opacity ' + FADE_MS + 'ms ease';
                wallpaperBg.style.opacity = '0';
                setTimeout(() => {
                    wallpaperBg.style.backgroundImage = `url('${url}')`;
                    requestAnimationFrame(() => {
                        wallpaperBg.style.opacity = '1';
                    });
                }, FADE_MS);
            } else {
                wallpaperBg.style.backgroundImage = `url('${url}')`;
            }
            wallpaperVideo.style.display = 'none';
            wallpaperVideo.pause();
        }
        window.dispatchEvent(new CustomEvent('wallpaper-change', { detail: { url: url, type: 'image' } }));
    }

    function show() {
        const list = readList();
        if (list.length === 0) return;
        if (currentIndex >= list.length) currentIndex = 0;
        const url = list[currentIndex];
        applyWallpaper(url);
    }

    function next() {
        const list = readList();
        if (list.length === 0) return;
        currentIndex = (currentIndex + 1) % list.length;
        show();
    }

    function prev() {
        const list = readList();
        if (list.length === 0) return;
        currentIndex = (currentIndex - 1 + list.length) % list.length;
        show();
    }

    function clearTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function start() {
        const list = readList();
        if (list.length === 0) return false;
        clearTimer();
        running = true;
        setPersistentEnabled(true);
        currentIndex = 0;
        show();
        const interval = INTERVAL_MS[readInterval()] || INTERVAL_MS['30min'];
        timer = setInterval(next, interval);
        return true;
    }

    function stop() {
        clearTimer();
        running = false;
        setPersistentEnabled(false);
    }

    function isRunning() {
        return running;
    }

    function setList(list) {
        writeList(list);
        if (running) {
            currentIndex = 0;
            show();
            clearTimer();
            const interval = INTERVAL_MS[readInterval()] || INTERVAL_MS['30min'];
            timer = setInterval(next, interval);
        }
    }

    function getList() {
        return readList();
    }

    function setIntervalKey(key) {
        writeInterval(key);
        if (running) {
            clearTimer();
            const interval = INTERVAL_MS[key] || INTERVAL_MS['30min'];
            timer = setInterval(next, interval);
        }
    }

    function getIntervalKey() {
        return readInterval();
    }

    function autoStartIfNeeded() {
        if (isPersistentEnabled()) {
            const list = readList();
            if (list.length > 0) {
                start();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoStartIfNeeded);
    } else {
        autoStartIfNeeded();
    }

    MXOS.WallpaperSlideshow = {
        start,
        stop,
        next,
        prev,
        isRunning,
        setList,
        getList,
        setInterval: setIntervalKey,
        getInterval: getIntervalKey
    };
})();
