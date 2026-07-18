import { state } from './state.js';
import { applyWallpaperWithFade } from './utils/image-loader.js';

const personalizationSettings = state.personalizationSettings;

let db = null;
let lastWallpaperUrl = null;
let lastWallpaperType = null;
let pendingWallpaperUnload = null;

function clearPendingWallpaperUnload() {
    if (pendingWallpaperUnload) {
        clearTimeout(pendingWallpaperUnload);
        pendingWallpaperUnload = null;
    }
}

function scheduleOldWallpaperUnload(el, oldUrl) {
    if (!el || !oldUrl || typeof URL === 'undefined' || oldUrl.indexOf('blob:') !== 0) return;
    clearPendingWallpaperUnload();
    pendingWallpaperUnload = setTimeout(() => {
        try {
            if (el.tagName === 'VIDEO' && el.src === oldUrl) {
                el.pause();
                el.removeAttribute('src');
                el.load();
            }
        } catch (e) {}
        try { URL.revokeObjectURL(oldUrl); } catch (e) {}
        pendingWallpaperUnload = null;
    }, 500);
}

export function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MXOSDB', 1);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const dbUpgrade = event.target.result;
            if (!dbUpgrade.objectStoreNames.contains('wallpapers')) {
                dbUpgrade.createObjectStore('wallpapers', { keyPath: 'id' });
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

export function saveVideoToIndexedDB(file) {
    return new Promise((resolve, reject) => {
        if (!db) {
            openIndexedDB().then(() => {
                saveVideoToIndexedDB(file).then(resolve).catch(reject);
            }).catch(reject);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const transaction = db.transaction(['wallpapers'], 'readwrite');
            const store = transaction.objectStore('wallpapers');
            store.put({ id: 'video-wallpaper', data: e.target.result, type: file.type });
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

export function loadVideoFromIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            openIndexedDB().then(() => {
                loadVideoFromIndexedDB().then(resolve).catch(reject);
            }).catch(reject);
            return;
        }
        const transaction = db.transaction(['wallpapers'], 'readonly');
        const store = transaction.objectStore('wallpapers');
        const request = store.get('video-wallpaper');
        request.onsuccess = () => {
            if (request.result) {
                const blob = new Blob([request.result.data], { type: request.result.type });
                const url = URL.createObjectURL(blob);
                resolve(url);
            } else {
                resolve(null);
            }
        };
        request.onerror = reject;
    });
}

export function updateLockScreenWallpaper(wallpaper, wallpaperType) {
}

export function saveWallpaperSettings() {
    localStorage.setItem('wallpaper', personalizationSettings.wallpaper);
    localStorage.setItem('wallpaperType', personalizationSettings.wallpaperType);
    localStorage.setItem('accentColor', personalizationSettings.accentColor);
}

export function loadWallpaperSettings() {
    const savedWallpaper = localStorage.getItem('wallpaper');
    const savedWallpaperType = localStorage.getItem('wallpaperType');
    const savedAccentColor = localStorage.getItem('accentColor');
    const DEFAULT_WALLPAPER = 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80';
    const isValidUrl = (v) => typeof v === 'string' && v && v !== 'undefined' && v !== 'null' && v.indexOf('blob:') !== 0;
    const wallpaper = isValidUrl(savedWallpaper) ? savedWallpaper : DEFAULT_WALLPAPER;
    if (!isValidUrl(savedWallpaper)) {
        try { localStorage.setItem('wallpaper', DEFAULT_WALLPAPER); } catch (e) {}
    }
    personalizationSettings.wallpaper = wallpaper;
    personalizationSettings.wallpaperType = savedWallpaperType && savedWallpaperType !== 'undefined' ? savedWallpaperType : 'image';
    const wallpaperBg = document.getElementById('wallpaper-bg');
    const wallpaperVideo = document.getElementById('wallpaper-video');
    if (wallpaperVideo) wallpaperVideo.preload = 'metadata';
    const ready = () => window.dispatchEvent(new CustomEvent('wallpaper-ready'));
    if (personalizationSettings.wallpaperType === 'video') {
        const prevVideoUrl = wallpaperVideo ? wallpaperVideo.src : '';
        loadVideoFromIndexedDB().then((videoUrl) => {
            if (videoUrl) {
                if (wallpaperBg) wallpaperBg.style.display = 'none';
                if (wallpaperVideo) {
                    wallpaperVideo.src = videoUrl;
                    wallpaperVideo.style.display = 'block';
                    wallpaperVideo.play().catch(() => {});
                    wallpaperVideo.oncanplay = ready;
                    wallpaperVideo.onerror = ready;
                    setTimeout(ready, 3000);
                } else {
                    ready();
                }
                scheduleOldWallpaperUnload(wallpaperVideo, prevVideoUrl);
                lastWallpaperUrl = videoUrl;
                lastWallpaperType = 'video';
            } else {
                personalizationSettings.wallpaperType = 'image';
                if (wallpaperBg) {
                    wallpaperBg.style.display = 'block';
                    applyWallpaperWithFade(wallpaperBg, wallpaper).then(ready);
                } else {
                    ready();
                }
                if (wallpaperVideo) wallpaperVideo.style.display = 'none';
                updateLockScreenWallpaper(wallpaper, 'image');
                window.dispatchEvent(new CustomEvent('wallpaper-change', { detail: { url: wallpaper, type: 'image' } }));
                lastWallpaperUrl = wallpaper;
                lastWallpaperType = 'image';
            }
        }).catch(() => {
            personalizationSettings.wallpaperType = 'image';
            personalizationSettings.wallpaper = DEFAULT_WALLPAPER;
            if (wallpaperBg) {
                wallpaperBg.style.display = 'block';
                applyWallpaperWithFade(wallpaperBg, DEFAULT_WALLPAPER).then(ready);
            } else {
                ready();
            }
            if (wallpaperVideo) {
                wallpaperVideo.style.display = 'none';
                wallpaperVideo.pause();
            }
            updateLockScreenWallpaper(DEFAULT_WALLPAPER, 'image');
            window.dispatchEvent(new CustomEvent('wallpaper-change', { detail: { url: DEFAULT_WALLPAPER, type: 'image' } }));
            lastWallpaperUrl = DEFAULT_WALLPAPER;
            lastWallpaperType = 'image';
        });
    } else {
        if (wallpaperBg) {
            wallpaperBg.style.display = 'block';
            applyWallpaperWithFade(wallpaperBg, wallpaper).then(ready);
        } else {
            ready();
        }
        if (wallpaperVideo) {
            const prevVideoUrl = wallpaperVideo.src;
            wallpaperVideo.style.display = 'none';
            wallpaperVideo.pause();
            scheduleOldWallpaperUnload(wallpaperVideo, prevVideoUrl);
        }
        updateLockScreenWallpaper(wallpaper, 'image');
        window.dispatchEvent(new CustomEvent('wallpaper-change', { detail: { url: wallpaper, type: 'image' } }));
        lastWallpaperUrl = wallpaper;
        lastWallpaperType = 'image';
    }
    if (savedAccentColor) {
        personalizationSettings.accentColor = savedAccentColor;
        document.documentElement.style.setProperty('--accent-color', savedAccentColor);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWallpaperSettings);
} else {
    loadWallpaperSettings();
}
