import { registerAppRenderer, handleInstallerFileSimple, launchThirdPartyApp, updateAppStartMenu } from '../core.js';
import { state } from '../state.js';
import { createVirtualScroll } from '../utils/virtual-scroll.js';

const STORE_VIRTUAL_THRESHOLD = 50;
const STORE_CARD_HEIGHT = 140;
import { http } from '../utils/http.js';

if (!document.getElementById('mxos-store-style')) {
    const style = document.createElement('style');
    style.id = 'mxos-store-style';
    style.textContent = `
@keyframes mxosStoreSpin { to { transform: rotate(360deg); } }
@keyframes mxosStoreFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mxosStoreSlide { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.store-banner-wrap{position:relative;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#1e293b 0%,#312e81 100%);margin-bottom:22px;min-height:180px;box-shadow:0 10px 30px rgba(0,0,0,0.35)}
.store-banner-track{position:relative;height:180px}
.store-banner-slide{position:absolute;inset:0;display:flex;align-items:center;padding:24px 28px;opacity:0;transition:opacity 0.6s;background-size:cover;background-position:center}
.store-banner-slide.active{opacity:1}
.store-banner-slide::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.25) 60%,transparent 100%)}
.store-banner-content{position:relative;z-index:1;color:#fff;max-width:60%}
.store-banner-title{font-size:22px;font-weight:700;margin:0 0 6px;text-shadow:0 2px 8px rgba(0,0,0,0.4)}
.store-banner-desc{font-size:13px;color:rgba(255,255,255,0.85);margin:0 0 12px;line-height:1.5}
.store-banner-btn{background:rgba(255,255,255,0.95);color:#111;border:none;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:transform 0.1s}
.store-banner-btn:hover{transform:scale(1.03)}
.store-banner-dots{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2}
.store-banner-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.4);cursor:pointer;transition:background 0.2s,width 0.2s}
.store-banner-dot.active{background:#fff;width:18px;border-radius:3px}
.store-banner-arrow{position:absolute;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.4);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;opacity:0;transition:opacity 0.2s}
.store-banner-wrap:hover .store-banner-arrow{opacity:1}
.store-banner-arrow.prev{left:8px}
.store-banner-arrow.next{right:8px}
.store-layout{display:flex;gap:18px;height:100%}
.store-sidebar{width:160px;flex-shrink:0;overflow-y:auto;padding:14px 8px 14px 0}
.store-sidebar-title{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;padding:0 8px}
.store-sidebar-item{padding:8px 12px;border-radius:8px;font-size:13px;color:#cbd5e1;cursor:pointer;transition:background 0.12s,color 0.12s;margin-bottom:2px;display:flex;align-items:center;gap:8px}
.store-sidebar-item:hover{background:rgba(255,255,255,0.05)}
.store-sidebar-item.active{background:rgba(96,165,250,0.18);color:#60a5fa}
.store-main{flex:1;overflow:auto;padding:18px 20px 18px 0;scrollbar-width:none}
.store-main::-webkit-scrollbar{display:none}
.store-section{margin-bottom:26px}
.store-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.store-section-title{font-size:15px;font-weight:600;margin:0;display:flex;align-items:center;gap:8px}
.store-section-more{font-size:11px;color:#60a5fa;cursor:pointer;background:none;border:none}
.store-section-more:hover{text-decoration:underline}
.store-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.store-card-mini{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;cursor:pointer;transition:transform 0.2s,border-color 0.2s}
.store-card-mini:hover{transform:translateY(-2px);border-color:rgba(255,255,255,0.18)}
.store-card-mini .icon-box{width:40px;height:40px;border-radius:9px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;margin-bottom:8px;overflow:hidden}
.store-card-mini .name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.store-card-mini .meta{font-size:11px;color:#6b7280;display:flex;align-items:center;gap:6px}
.store-update-banner{background:linear-gradient(135deg,rgba(245,158,11,0.18),rgba(245,158,11,0.06));border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.store-update-banner-text{display:flex;align-items:center;gap:10px;color:#fbbf24;font-size:13px}
.store-update-banner-btn{background:#f59e0b;color:#111;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer}
.store-screenshots{display:flex;gap:10px;overflow-x:auto;padding:4px 0 8px;margin-top:14px}
.store-screenshots img{width:240px;height:135px;object-fit:cover;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);flex-shrink:0}
.store-rating-overview{display:flex;gap:24px;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-top:16px}
.store-rating-avg{font-size:36px;font-weight:700;color:#fbbf24;line-height:1}
.store-rating-stars{color:#fbbf24;font-size:14px;margin-top:4px}
.store-rating-count{font-size:11px;color:#94a3b8;margin-top:2px}
.store-rating-dist{flex:1;max-width:280px}
.store-rating-bar{display:flex;align-items:center;gap:8px;font-size:11px;color:#94a3b8;margin-bottom:3px}
.store-rating-bar .bar{flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}
.store-rating-bar .bar > div{height:100%;background:#fbbf24;border-radius:3px}
.store-comment{padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)}
.store-comment-header{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.store-comment-avatar{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#a5b4fc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600}
.store-comment-user{font-size:12px;font-weight:600;color:#e2e8f0}
.store-comment-stars{color:#fbbf24;font-size:11px}
.store-comment-date{font-size:11px;color:#6b7280;margin-left:auto}
.store-comment-body{font-size:13px;color:#cbd5e1;line-height:1.6}
.store-comment-form{margin-top:14px;padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px}
.store-comment-form textarea{width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;color:#fff;font-size:13px;resize:vertical;min-height:70px;font-family:inherit;outline:none}
.store-comment-form textarea:focus{border-color:#60a5fa}
.store-stars-input{display:flex;gap:4px;margin:8px 0;cursor:pointer}
.store-stars-input span{font-size:20px;color:#475569;transition:color 0.1s}
.store-stars-input span.active{color:#fbbf24}
.store-history-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:8px}
.store-history-row:hover{background:rgba(255,255,255,0.06)}
.store-history-info{flex:1;min-width:0}
.store-history-name{font-size:13px;font-weight:600}
.store-history-meta{font-size:11px;color:#6b7280;margin-top:2px}
.store-history-btn{background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.3);padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer}
.store-history-btn:hover{background:rgba(96,165,250,0.25)}
.store-badge-update{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:600;border-radius:8px;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:1.5px solid rgba(0,0,0,0.4)}
.start-app{position:relative}
.start-app .store-badge-update{top:0;right:0;transform:translate(40%,-30%)}
.store-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:14px}
.store-tab{padding:8px 14px;font-size:13px;color:#94a3b8;cursor:pointer;border-bottom:2px solid transparent;transition:color 0.15s,border-color 0.15s;background:none;border-top:none;border-left:none;border-right:none}
.store-tab:hover{color:#e2e8f0}
.store-tab.active{color:#60a5fa;border-bottom-color:#60a5fa}
`;
    document.head.appendChild(style);
}

const STORE_CACHE_KEY = 'mxos_store_apps_cache_v2';
const STORE_CACHE_TTL = 5 * 60 * 1000;
const STORE_HISTORY_KEY = 'mxos_store_download_history';
const STORE_RATINGS_CACHE_KEY = 'mxos_store_ratings_cache';
const STORE_BANNERS = [
    { id: 'banner-tools', title: '效率工具合集', desc: '精选办公、记事、终端工具，提升你的工作流', btn: '立即探索', cat: '工具' },
    { id: 'banner-new', title: '本周新上架', desc: '发现社区开发者最新提交的应用', btn: '查看新应用', cat: '新品' },
    { id: 'banner-hot', title: '热门下载 TOP 榜', desc: '看看其他用户都在用什么', btn: '查看榜单', cat: '热门' }
];

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function isImageIcon(icon) {
    return typeof icon === 'string' && /^(https?:|\/api\/|data:image|blob:)/.test(icon);
}

function getAppIcon(app) {
    if (!app) return null;
    if (isImageIcon(app.icon)) return app.icon;
    if (app.manifest && isImageIcon(app.manifest.icon)) return app.manifest.icon;
    const iconList = [];
    if (Array.isArray(app.icons)) iconList.push(...app.icons);
    if (app.manifest && Array.isArray(app.manifest.icons)) iconList.push(...app.manifest.icons);
    if (iconList.length) {
        const srcOf = i => typeof i === 'string' ? i : (i && typeof i.src === 'string' ? i.src : '');
        const findIcon = ext => iconList.map(srcOf).find(src => src && src.toLowerCase().endsWith(ext));
        const svgPng = findIcon('svg.png');
        if (svgPng) return svgPng;
        const png = findIcon('.png');
        if (png) return png;
        const svg = findIcon('.svg');
        if (svg) return svg;
        const first = iconList.map(srcOf).find(src => isImageIcon(src));
        if (first) return first;
    }
    return app.icon;
}

function renderIcon(icon, size = 28) {
    if (isImageIcon(icon)) {
        return '<img src="' + escapeHtml(icon) + '" alt="" style="width:' + size + 'px;height:' + size + 'px;border-radius:8px;object-fit:contain;display:block" onerror="this.style.visibility=\'hidden\';this.title=\'图标加载失败\';">';
    }
    if (!icon) return '<span style="width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center;color:#ef4444;font-size:12px">!</span>';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 40 40"><use href="#svg-' + escapeHtml(icon) + '"/></svg>';
}

function isInstalled(appId) {
    return state.installedApps.some(a => a.id === appId);
}

function getDownloadUrl(app) {
    if (app && app.id) return '/api/apps/' + encodeURIComponent(app.id) + '/download';
    if (app && typeof app.downloadUrl === 'string' && app.downloadUrl && app.downloadUrl !== 'undefined' && app.downloadUrl !== 'null') {
        return app.downloadUrl;
    }
    return '';
}

function isApiDownloadUrl(url) {
    return typeof url === 'string' && /^(https?:\/\/[^/]+)?\/api\/apps\/[^/]+\/download$/.test(url);
}

function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function fetchAppPackage(app) {
    const url = getDownloadUrl(app);
    if (!url) throw new Error('该应用未提供下载地址');
    if (isApiDownloadUrl(url)) {
        const data = await http.post('/apps/' + encodeURIComponent(app.id) + '/download');
        const pkg = data?.data?.package ?? data?.package;
        if (!pkg) throw new Error('服务器未返回安装包');
        const bytes = base64ToUint8Array(pkg);
        if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
            throw new Error('服务器返回的安装包不是完整 .mx zip，请在后台重新上传完整 mx 包');
        }
        return new Blob([bytes], { type: 'application/octet-stream' });
    }
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`下载失败 (${res.status})`);
        return await res.blob();
    } catch (e) {
        throw new Error('下载失败: ' + (e.message || '网络错误'));
    }
}

async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('JSZip 加载失败'));
        document.head.appendChild(script);
    });
}

async function extractMxIconInfo(file) {
    const JSZip = await ensureJSZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('manifest.json 不存在');
    let manifest;
    try { manifest = JSON.parse(await manifestFile.async('text')); }
    catch { throw new Error('manifest.json 解析失败'); }
    const iconPath = String(manifest.icon || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!iconPath) throw new Error('manifest.icon 缺失，必须指向包内 svg.png');
    if (iconPath.split('/').pop() !== 'svg.png') throw new Error('manifest.icon 必须指向文件名严格为 svg.png 的包内图标');
    const iconFile = zip.file(iconPath);
    if (!iconFile) throw new Error('mx 包缺少 manifest.icon 指向的 svg.png：' + iconPath);
    return { appId: manifest.id || 'app_' + Date.now(), iconUrl: 'data:image/png;base64,' + await iconFile.async('base64'), iconPath };
}

async function patchInstalledIcon(file) {
    try {
        const info = await extractMxIconInfo(file);
        if (!info || !info.iconUrl) return;
        const app = state.installedApps.find(a => a.id === info.appId);
        if (app) {
            app.icon = info.iconUrl;
            if (state.thirdPartyAppData[app.id]) {
                state.thirdPartyAppData[app.id].icon = info.iconUrl;
            }
            localStorage.setItem('mxos_installed_apps', JSON.stringify(state.installedApps));
            if (typeof updateAppStartMenu === 'function') updateAppStartMenu();
        }
    } catch (e) {}
}

function getInstallDeviceId() {
    try {
        let id = localStorage.getItem('mxos_install_device_id');
        if (!id) {
            id = 'mxos-browser-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem('mxos_install_device_id', id);
        }
        return id;
    } catch {
        return 'mxos-browser-unknown';
    }
}

async function reportInstallation(app, source = 'store') {
    if (!app || !app.id) return;
    const installed = state.installedApps.find(a => a.id === app.id) || app;
    try {
        await http.post('/apps/' + encodeURIComponent(app.id) + '/installations', {
            status: 'installed',
            version: installed.version || app.version || 'unknown',
            deviceId: getInstallDeviceId(),
            source,
            installedAt: new Date().toISOString()
        });
    } catch (e) {
        if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
            window.MXOS.dialog.toast('安装状态同步失败：' + (e.message || '网络错误'), 'warning');
        }
    }
}

async function fetchStoreApps(forceRefresh = false) {
    if (!forceRefresh) {
        try {
            const cached = JSON.parse(localStorage.getItem(STORE_CACHE_KEY) || 'null');
            if (cached && cached.ts && (Date.now() - cached.ts < STORE_CACHE_TTL) && Array.isArray(cached.apps)) {
                return cached.apps;
            }
        } catch (e) {}
    }
    const json = await http.get('/apps');
    let apps = [];
    if (Array.isArray(json)) apps = json;
    else if (Array.isArray(json.data)) apps = json.data;
    else if (json.data && Array.isArray(json.data.items)) apps = json.data.items;
    else if (Array.isArray(json.apps)) apps = json.apps;
    apps = apps.map(app => ({ ...app, downloadUrl: getDownloadUrl(app) }));
    try { localStorage.setItem(STORE_CACHE_KEY, JSON.stringify({ ts: Date.now(), apps })); } catch (e) {}
    return apps;
}

function loadDownloadHistory() {
    try { return JSON.parse(localStorage.getItem(STORE_HISTORY_KEY) || '[]'); } catch (e) { return []; }
}

function addDownloadHistory(app) {
    if (!app || !app.id) return;
    const list = loadDownloadHistory().filter(h => h.id !== app.id);
    list.unshift({
        id: app.id,
        name: app.name || '未命名',
        version: app.version || '1.0.0',
        icon: getAppIcon(app) || app.icon || null,
        icons: app.icons || null,
        time: Date.now()
    });
    while (list.length > 50) list.pop();
    try { localStorage.setItem(STORE_HISTORY_KEY, JSON.stringify(list)); } catch (e) {}
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hasUpdate(app) {
    if (!app || !app.id) return false;
    const installed = state.installedApps.find(a => a.id === app.id);
    if (!installed) return false;
    const cloudVer = String(app.version || '1.0.0').trim();
    const localVer = String(installed.version || '1.0.0').trim();
    return cloudVer !== localVer;
}

function countUpdates() {
    let n = 0;
    state.installedApps.forEach(installed => {
        const cloudApp = (window.__mxosStoreApps || []).find(a => a.id === installed.id);
        if (cloudApp && hasUpdate(cloudApp)) n++;
    });
    return n;
}

async function fetchRatings(appId) {
    if (!appId) return null;
    try {
        const cached = (() => { try { return JSON.parse(localStorage.getItem(STORE_RATINGS_CACHE_KEY) || '{}'); } catch (e) { return {}; } })();
        if (cached[appId] && cached[appId].ts && (Date.now() - cached[appId].ts < 60 * 1000)) {
            return cached[appId].data;
        }
    } catch (e) {}
    try {
        const json = await http.get('/ratings/' + encodeURIComponent(appId));
        const data = json.data || json;
        try {
            const cached = (() => { try { return JSON.parse(localStorage.getItem(STORE_RATINGS_CACHE_KEY) || '{}'); } catch (e) { return {}; } })();
            cached[appId] = { ts: Date.now(), data };
            localStorage.setItem(STORE_RATINGS_CACHE_KEY, JSON.stringify(cached));
        } catch (e) {}
        return data;
    } catch (e) {
        return null;
    }
}

async function postRating(appId, stars, content) {
    const token = (() => { try { return localStorage.getItem('mxos_session_token') || ''; } catch (e) { return ''; } })();
    if (!token) throw new Error('请先登录后再发表评论');
    try {
        const json = await http.post('/ratings/' + encodeURIComponent(appId), { score: stars, comment: content });
        try {
            const cached = (() => { try { return JSON.parse(localStorage.getItem(STORE_RATINGS_CACHE_KEY) || '{}'); } catch (e) { return {}; } })();
            delete cached[appId];
            localStorage.setItem(STORE_RATINGS_CACHE_KEY, JSON.stringify(cached));
        } catch (e) {}
        return json.data || json;
    } catch (e) {
        if (e.status === 404) throw new Error('评分服务暂不可用');
        throw new Error(e.message || '提交失败');
    }
}

function computeRatingStats(ratings) {
    if (!Array.isArray(ratings) || ratings.length === 0) {
        return { avg: 0, count: 0, dist: [0, 0, 0, 0, 0] };
    }
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    ratings.forEach(r => {
        const s = Math.max(1, Math.min(5, parseInt(r.score ?? r.stars) || 5));
        dist[5 - s]++;
        sum += s;
    });
    return { avg: sum / ratings.length, count: ratings.length, dist };
}

function starsHtml(stars, size = 12) {
    const n = Math.max(0, Math.min(5, parseInt(stars) || 0));
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${i <= n ? '#fbbf24' : 'none'}" stroke="${i <= n ? '#fbbf24' : '#475569'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    return html;
}

function applyStartMenuUpdateBadges(updateIds) {
    document.querySelectorAll('.start-apps-grid .start-app').forEach(el => {
        const existing = el.querySelector('.store-badge-update');
        if (existing) existing.remove();
        const appId = el.dataset.app;
        if (appId && updateIds.includes(appId)) {
            const badge = document.createElement('span');
            badge.className = 'store-badge-update';
            badge.textContent = '!';
            el.appendChild(badge);
        }
    });
}

registerAppRenderer('store', async (contentEl, windowEl, appId) => {
    let apps = [];
    let filtered = [];
    let selectedApp = null;
    let keyword = '';
    let activeCategory = '全部';
    let loading = true;
    let errorMsg = '';
    let currentView = 'home';
    let currentTab = 'recommend';
    let bannerIndex = 0;
    let bannerTimer = null;
    let currentRatings = null;
    let currentRatingStars = 5;

    function applyFilter() {
        const k = keyword.trim().toLowerCase();
        filtered = apps.filter(app => {
            const matchCat = activeCategory === '全部' || app.category === activeCategory;
            const matchKw = !k ||
                (app.name || '').toLowerCase().includes(k) ||
                (app.id || '').toLowerCase().includes(k) ||
                (app.author || '').toLowerCase().includes(k) ||
                (app.description || '').toLowerCase().includes(k);
            return matchCat && matchKw;
        });
    }

    function getCategories() {
        const set = new Set();
        apps.forEach(a => { if (a.category) set.add(a.category); });
        return ['全部', ...Array.from(set)];
    }

    function getTags(app) {
        if (Array.isArray(app.tags)) return app.tags;
        if (app.tags) return String(app.tags).split(',').map(t => t.trim()).filter(Boolean);
        return [];
    }

    function getDownloads(app) {
        return app.downloads ?? app.downloadCount ?? 0;
    }

    function loadingHtml() {
        return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:#9ca3af"><div style="width:30px;height:30px;border:3px solid rgba(255,255,255,0.1);border-top-color:#60a5fa;border-radius:50%;animation:mxosStoreSpin 0.8s linear infinite;margin-bottom:12px"></div>加载中...</div>`;
    }

    function errorHtml() {
        return `<div style="text-align:center;padding:60px 20px"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" style="margin:0 auto 12px;display:block;color:#fbbf24"><use href="#icon-warning"/></svg><div style="color:#ff6b6b;margin-bottom:6px">加载失败</div><div style="font-size:12px;color:#9ca3af;margin-bottom:16px">${escapeHtml(errorMsg)}</div><button id="storeRetryLoad" style="background:#60a5fa;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px">重试</button></div>`;
    }

    function cardHtml(app) {
        const installed = isInstalled(app.id);
        return `
            <div class="store-card" data-id="${escapeHtml(app.id)}" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;cursor:pointer;transition:border-color 0.2s,transform 0.2s" onmouseover="this.style.borderColor='rgba(255,255,255,0.18)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.transform=''">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                    <div style="width:48px;height:48px;border-radius:10px;background:rgba(255,255,255,0.06);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden">${renderIcon(getAppIcon(app), 28)}</div>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(app.name || '未命名')}</div>
                        <div style="font-size:11px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(app.id || '')}</div>
                    </div>
                </div>
                <div style="font-size:12px;color:#9ca3af;margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap">
                    <span>v${escapeHtml(app.version || '1.0.0')}</span>
                    ${app.category ? `<span>· ${escapeHtml(app.category)}</span>` : ''}
                    ${app.author ? `<span>· ${escapeHtml(app.author)}</span>` : ''}
                </div>
                <div style="font-size:12px;color:#6b7280;display:flex;align-items:center;justify-content:space-between">
                    <span>下载 ${getDownloads(app)}</span>
                    ${installed ? `<span style="color:#10b981;display:inline-flex;align-items:center;gap:3px"><svg class="icon" width="14" height="14"><use href="#icon-check"/></svg> 已安装</span>` : ''}
                </div>
            </div>
        `;
    }

    function gridHtml() {
        if (loading) return loadingHtml();
        if (errorMsg) return errorHtml();
        if (filtered.length === 0) return `<div style="text-align:center;color:#9ca3af;padding:60px 20px">没有找到应用</div>`;
        return renderGridContainer(filtered);
    }

    function renderGridContainer(list) {
        const batchSize = 30;
        const initial = list.slice(0, batchSize);
        const html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px" data-progressive-grid data-total="${list.length}" data-rendered="${initial.length}">${initial.map(cardHtml).join('')}</div>`;
        if (list.length > batchSize) {
            return html + `<div class="store-grid-sentinel" data-batch="${batchSize}" style="height:1px"></div>`;
        }
        return html;
    }

    function setupProgressiveGrid(mainEl, listGetter) {
        const sentinel = mainEl.querySelector('.store-grid-sentinel');
        const grid = mainEl.querySelector('[data-progressive-grid]');
        if (!sentinel || !grid) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const total = parseInt(grid.dataset.total);
                let rendered = parseInt(grid.dataset.rendered);
                if (rendered >= total) {
                    observer.disconnect();
                    sentinel.remove();
                    return;
                }
                const nextBatch = listGetter().slice(rendered, rendered + 30);
                const fragment = document.createDocumentFragment();
                nextBatch.forEach(app => {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = cardHtml(app);
                    const card = wrapper.firstElementChild;
                    if (card) fragment.appendChild(card);
                });
                grid.appendChild(fragment);
                grid.dataset.rendered = String(rendered + nextBatch.length);
                mainEl.querySelectorAll('.store-card').forEach(card => {
                    if (card.dataset.bound) return;
                    card.dataset.bound = '1';
                    card.addEventListener('click', (e) => {
                        if (e.target.closest('button')) return;
                        const id = card.dataset.id;
                        if (!id) return;
                        const app = apps.find(a => a.id === id);
                        if (app) { selectedApp = app; renderDetail(); }
                    });
                });
                if (parseInt(grid.dataset.rendered) >= total) {
                    observer.disconnect();
                    sentinel.remove();
                }
            });
        }, { root: mainEl, rootMargin: '200px' });
        observer.observe(sentinel);
    }

    function miniCardHtml(app) {
        const installed = isInstalled(app.id);
        const update = hasUpdate(app);
        return `
            <div class="store-card-mini" data-id="${escapeHtml(app.id)}">
                <div class="icon-box">${renderIcon(getAppIcon(app), 24)}</div>
                <div class="name">${escapeHtml(app.name || '未命名')}</div>
                <div class="meta">
                    <span>v${escapeHtml(app.version || '1.0.0')}</span>
                    ${installed ? '<span style="color:#10b981">· 已安装</span>' : ''}
                    ${update ? '<span style="color:#fbbf24">· 可更新</span>' : ''}
                </div>
            </div>
        `;
    }

    function getRecommended() {
        if (apps.length === 0) return [];
        const list = apps.slice();
        const installedIds = new Set(state.installedApps.map(a => a.id));
        const notInstalled = list.filter(a => !installedIds.has(a.id));
        const pool = notInstalled.length >= 4 ? notInstalled : list;
        const shuffled = pool.slice().sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 6);
    }

    function getHotApps() {
        if (apps.length === 0) return [];
        return apps.slice().sort((a, b) => getDownloads(b) - getDownloads(a)).slice(0, 6);
    }

    function getNewApps() {
        if (apps.length === 0) return [];
        return apps.slice().sort((a, b) => {
            const da = new Date(a.releaseDate || 0).getTime();
            const db = new Date(b.releaseDate || 0).getTime();
            return db - da;
        }).slice(0, 6);
    }

    function getUpdateApps() {
        return apps.filter(a => hasUpdate(a));
    }

    function bannerHtml() {
        const slides = STORE_BANNERS.map((b, i) => {
            const bgImage = b.cat && activeCategory !== '全部' ? '' : '';
            return `<div class="store-banner-slide ${i === bannerIndex ? 'active' : ''}" data-idx="${i}" style="${bgImage}">
                <div class="store-banner-content">
                    <h3 class="store-banner-title">${escapeHtml(b.title)}</h3>
                    <p class="store-banner-desc">${escapeHtml(b.desc)}</p>
                    <button class="store-banner-btn" data-banner-cat="${escapeHtml(b.cat)}">${escapeHtml(b.btn)}</button>
                </div>
            </div>`;
        }).join('');
        const dots = STORE_BANNERS.map((_, i) => `<div class="store-banner-dot ${i === bannerIndex ? 'active' : ''}" data-idx="${i}"></div>`).join('');
        return `
            <div class="store-banner-wrap">
                <div class="store-banner-track">${slides}</div>
                <button class="store-banner-arrow prev" aria-label="上一张"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
                <button class="store-banner-arrow next" aria-label="下一张"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
                <div class="store-banner-dots">${dots}</div>
            </div>
        `;
    }

    function updateBannerDisplay() {
        const wrap = contentEl.querySelector('.store-banner-wrap');
        if (!wrap) return;
        wrap.querySelectorAll('.store-banner-slide').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.idx) === bannerIndex);
        });
        wrap.querySelectorAll('.store-banner-dot').forEach(d => {
            d.classList.toggle('active', parseInt(d.dataset.idx) === bannerIndex);
        });
    }

    function startBannerTimer() {
        stopBannerTimer();
        bannerTimer = setInterval(() => {
            bannerIndex = (bannerIndex + 1) % STORE_BANNERS.length;
            updateBannerDisplay();
        }, 5000);
    }

    function stopBannerTimer() {
        if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }
    }

    function homeContentHtml() {
        if (loading) return loadingHtml();
        if (errorMsg) return errorHtml();
        const recommended = getRecommended();
        const hot = getHotApps();
        const newApps = getNewApps();
        const updates = getUpdateApps();
        const updateBanner = updates.length > 0 ? `
            <div class="store-update-banner">
                <div class="store-update-banner-text">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    <span>${updates.length} 个应用可更新</span>
                </div>
                <button class="store-update-banner-btn" id="storeUpdateAll">全部更新</button>
            </div>
        ` : '';

        const section = (title, list, id) => {
            if (!list || list.length === 0) return '';
            return `
                <div class="store-section">
                    <div class="store-section-header">
                        <h3 class="store-section-title">${escapeHtml(title)}</h3>
                        <button class="store-section-more" data-tab="${escapeHtml(id)}">查看更多 ›</button>
                    </div>
                    <div class="store-row">${list.map(miniCardHtml).join('')}</div>
                </div>
            `;
        };

        return `
            ${updateBanner}
            ${bannerHtml()}
            ${section('为你推荐', recommended, 'recommend')}
            ${section('热门下载', hot, 'hot')}
            ${section('本周新品', newApps, 'new')}
        `;
    }

    function categoryContentHtml() {
        if (loading) return loadingHtml();
        if (errorMsg) return errorHtml();
        if (currentTab === 'history') return historyHtml();
        let list;
        if (currentTab === 'recommend') list = getRecommended().concat(getHotApps()).slice(0, 12);
        else if (currentTab === 'hot') list = getHotApps().concat(apps).slice(0, 12);
        else if (currentTab === 'new') list = getNewApps();
        else list = filtered;
        if (!list || list.length === 0) return `<div style="text-align:center;color:#9ca3af;padding:60px 20px">没有找到应用</div>`;
        if (list.length > STORE_VIRTUAL_THRESHOLD) {
            return renderGridContainer(list);
        }
        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px">${list.map(cardHtml).join('')}</div>`;
    }

    function historyHtml() {
        const history = loadDownloadHistory();
        if (history.length === 0) {
            return `<div style="text-align:center;color:#9ca3af;padding:60px 20px">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;opacity:0.4"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                暂无下载历史
            </div>`;
        }
        return history.map(h => `
            <div class="store-history-row" data-id="${escapeHtml(h.id)}">
                <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">${renderIcon(getAppIcon(h), 20)}</div>
                <div class="store-history-info">
                    <div class="store-history-name">${escapeHtml(h.name || '未命名')}</div>
                    <div class="store-history-meta">v${escapeHtml(h.version || '1.0.0')} · ${formatTime(h.time)}</div>
                </div>
                <button class="store-history-btn" data-redownload="${escapeHtml(h.id)}">重新下载</button>
            </div>
        `).join('');
    }

    function renderHome() {
        currentView = 'home';
        const cats = getCategories();
        const sidebarItems = [
            { id: 'recommend', label: '为你推荐' },
            { id: 'hot', label: '热门下载' },
            { id: 'new', label: '本周新品' },
            { id: 'history', label: '下载历史' }
        ];
        contentEl.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%">
                <div style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                    <div>
                        <h2 style="margin:0;font-size:18px">应用商店</h2>
                        <p style="margin:2px 0 0;color:#9ca3af;font-size:12px">发现并安装 MXOS 应用</p>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        <input id="storeSearch" type="text" value="${escapeHtml(keyword)}" placeholder="搜索应用、作者..." style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;outline:none;width:220px;font-size:13px">
                        <button id="storeLocalInstall" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> 安装本地应用</button>
                        <button id="storeRefresh" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:#fff;cursor:pointer;font-size:13px">刷新</button>
                    </div>
                </div>
                <div class="store-layout">
                    <div class="store-sidebar">
                        <div class="store-sidebar-title">分类导航</div>
                        ${sidebarItems.map(it => `<div class="store-sidebar-item ${it.id === currentTab ? 'active' : ''}" data-tab="${escapeHtml(it.id)}">${escapeHtml(it.label)}</div>`).join('')}
                        <div class="store-sidebar-title" style="margin-top:14px">应用分类</div>
                        ${cats.map(c => `<div class="store-sidebar-item ${c === activeCategory && currentTab === 'category' ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</div>`).join('')}
                    </div>
                    <div class="store-main" id="storeMainContent">
                        ${currentTab === 'recommend' || currentTab === 'home' ? homeContentHtml() : categoryContentHtml()}
                    </div>
                </div>
            </div>
        `;
        bindHome();
    }

    function bindHome() {
        const search = document.getElementById('storeSearch');
        if (search) {
            search.addEventListener('input', () => {
                keyword = search.value;
                applyFilter();
                if (currentTab !== 'recommend') {
                    currentTab = 'category';
                    activeCategory = '全部';
                }
                const main = document.getElementById('storeMainContent');
                if (main) main.innerHTML = categoryContentHtml();
                bindHomeMain();
            });
        }
        const refresh = document.getElementById('storeRefresh');
        if (refresh) refresh.addEventListener('click', () => load(true));

        const localInstall = document.getElementById('storeLocalInstall');
        if (localInstall) {
            localInstall.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.mx';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    localInstall.disabled = true;
                    localInstall.innerHTML = '安装中...';
                    try {
                        const JSZip = await ensureJSZip();
                        const arrayBuffer = await file.arrayBuffer();
                        const zip = await JSZip.loadAsync(arrayBuffer);

                        let manifestContent = null;
                        if (zip.file('manifest.json')) {
                            manifestContent = await zip.file('manifest.json').async('text');
                        } else if (zip.file('manifest.xml')) {
                            manifestContent = await zip.file('manifest.xml').async('text');
                        }
                        if (!manifestContent) throw new Error('安装包缺少 manifest 文件');

                        let manifest = null;
                        try {
                            manifest = JSON.parse(manifestContent);
                        } catch {
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(manifestContent, 'text/xml');
                            manifest = {
                                id: xmlDoc.querySelector('id')?.textContent || 'app_' + Date.now(),
                                name: xmlDoc.querySelector('name')?.textContent || '未知应用',
                                version: xmlDoc.querySelector('version')?.textContent || '1.0.0',
                                description: xmlDoc.querySelector('description')?.textContent || '',
                                icon: xmlDoc.querySelector('icon')?.textContent || 'app-default'
                            };
                        }

                        let appBinContent = '';
                        if (zip.file('app.bin')) {
                            appBinContent = await zip.file('app.bin').async('text');
                        } else {
                            throw new Error('安装包缺少 app.bin 文件');
                        }

                        const appFiles = {};
                        const filePromises = [];
                        zip.forEach((relativePath, fileEntry) => {
                            if (!fileEntry.dir) {
                                filePromises.push(
                                    fileEntry.async('blob').then(blob => {
                                        appFiles[relativePath] = blob;
                                    })
                                );
                            }
                        });
                        await Promise.all(filePromises);

                        const appData = {
                            id: manifest.id || 'app_' + Date.now(),
                            name: manifest.name || '未知应用',
                            version: manifest.version || '1.0.0',
                            description: manifest.description || '',
                            icon: manifest.icon || 'app-default',
                            window: manifest.window || { width: 800, height: 600 },
                            installDate: new Date().toISOString(),
                            appBin: appBinContent,
                            files: appFiles,
                            permissions: manifest.permissions || []
                        };

                        const existingIndex = state.installedApps.findIndex(a => a.id === appData.id);
                        if (existingIndex >= 0) {
                            state.installedApps[existingIndex] = appData;
                        } else {
                            state.installedApps.push(appData);
                        }
                        state.thirdPartyAppData[appData.id] = appData;
                        localStorage.setItem('mxos_installed_apps', JSON.stringify(state.installedApps));
                        updateAppStartMenu();

                        if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                            window.MXOS.dialog.toast('安装成功: ' + appData.name, 'success');
                        }
                    } catch (err) {
                        console.error('本地安装失败:', err);
                        if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                            window.MXOS.dialog.toast('安装失败: ' + (err.message || '未知错误'), 'error');
                        }
                    }
                    localInstall.disabled = false;
                    localInstall.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> 安装本地应用';
                };
                input.click();
            });
        }

        const retryLoad = document.getElementById('storeRetryLoad');
        if (retryLoad) retryLoad.addEventListener('click', () => load(true));

        contentEl.querySelectorAll('.store-sidebar-item[data-tab]').forEach(el => {
            el.addEventListener('click', () => {
                currentTab = el.dataset.tab;
                if (currentTab === 'recommend') activeCategory = '全部';
                contentEl.querySelectorAll('.store-sidebar-item').forEach(s => s.classList.remove('active'));
                el.classList.add('active');
                const main = document.getElementById('storeMainContent');
                if (main) {
                    main.innerHTML = currentTab === 'recommend' ? homeContentHtml() : categoryContentHtml();
                    bindHomeMain();
                }
            });
        });

        contentEl.querySelectorAll('.store-sidebar-item[data-cat]').forEach(el => {
            el.addEventListener('click', () => {
                activeCategory = el.dataset.cat;
                currentTab = 'category';
                applyFilter();
                contentEl.querySelectorAll('.store-sidebar-item').forEach(s => s.classList.remove('active'));
                el.classList.add('active');
                const main = document.getElementById('storeMainContent');
                if (main) {
                    main.innerHTML = categoryContentHtml();
                    bindHomeMain();
                }
            });
        });

        bindHomeMain();
    }

    function bindHomeMain() {
        const main = document.getElementById('storeMainContent');
        if (!main) return;
        main.querySelectorAll('.store-card-mini, .store-card').forEach(card => {
            if (card.dataset.bound) return;
            card.dataset.bound = '1';
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const id = card.dataset.id;
                if (!id) return;
                selectedApp = apps.find(a => a.id === id);
                if (selectedApp) renderDetail();
            });
        });
        setupProgressiveGrid(main, () => filtered);
        main.querySelectorAll('.store-section-more').forEach(btn => {
            btn.addEventListener('click', () => {
                currentTab = btn.dataset.tab || 'recommend';
                contentEl.querySelectorAll('.store-sidebar-item').forEach(s => {
                    s.classList.toggle('active', s.dataset.tab === currentTab);
                });
                main.innerHTML = categoryContentHtml();
                bindHomeMain();
            });
        });
        main.querySelectorAll('.store-banner-dot').forEach(d => {
            d.addEventListener('click', () => {
                bannerIndex = parseInt(d.dataset.idx);
                updateBannerDisplay();
                startBannerTimer();
            });
        });
        const prevArrow = main.querySelector('.store-banner-arrow.prev');
        const nextArrow = main.querySelector('.store-banner-arrow.next');
        if (prevArrow) prevArrow.addEventListener('click', () => {
            bannerIndex = (bannerIndex - 1 + STORE_BANNERS.length) % STORE_BANNERS.length;
            updateBannerDisplay();
            startBannerTimer();
        });
        if (nextArrow) nextArrow.addEventListener('click', () => {
            bannerIndex = (bannerIndex + 1) % STORE_BANNERS.length;
            updateBannerDisplay();
            startBannerTimer();
        });
        main.querySelectorAll('.store-banner-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.bannerCat;
                if (cat === '热门') currentTab = 'hot';
                else if (cat === '新品') currentTab = 'new';
                else currentTab = 'recommend';
                contentEl.querySelectorAll('.store-sidebar-item').forEach(s => {
                    s.classList.toggle('active', s.dataset.tab === currentTab);
                });
                main.innerHTML = categoryContentHtml();
                bindHomeMain();
            });
        });
        const updateAllBtn = main.querySelector('#storeUpdateAll');
        if (updateAllBtn) updateAllBtn.addEventListener('click', () => updateAllApps());

        main.querySelectorAll('.store-history-btn[data-redownload]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.redownload;
                const app = apps.find(a => a.id === id);
                if (app) {
                    selectedApp = app;
                    installApp(app);
                } else {
                    if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                        window.MXOS.dialog.toast('应用已在商店下架，无法重新下载', 'warning');
                    }
                }
            });
        });

        if (main.querySelector('.store-banner-wrap')) startBannerTimer();
    }

    function renderList() {
        stopBannerTimer();
        renderHome();
    }

    function renderDetail() {
        stopBannerTimer();
        const app = selectedApp;
        if (!app) { renderList(); return; }
        currentView = 'detail';
        const installed = isInstalled(app.id);
        const update = hasUpdate(app);
        const tags = getTags(app);
        const screenshots = Array.isArray(app.screenshots) ? app.screenshots
            : (app.screenshots ? String(app.screenshots).split(',').map(s => s.trim()).filter(Boolean) : []);
        const related = apps.filter(a => a.id !== app.id && (a.category === app.category || (getTags(a).some(t => tags.includes(t))))).slice(0, 4);
        const actionBtn = installed
            ? (update
                ? `<button id="storeInstall" style="background:#f59e0b;color:#111;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">更新</button>`
                : `<button id="storeOpen" style="background:#10b981;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px">打开</button>`)
            : `<button id="storeInstall" style="background:#60a5fa;color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px">安装</button>`;
        contentEl.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%">
                <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">
                    <button id="storeBack" style="background:none;border:none;color:#fff;cursor:pointer;font-size:15px;display:flex;align-items:center;gap:6px"><span>‹</span> 返回商店</button>
                </div>
                <div style="flex:1;overflow:auto;padding:24px" id="storeDetailScroll">
                    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
                        <div style="width:80px;height:80px;border-radius:16px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">${renderIcon(getAppIcon(app), 48)}</div>
                        <div style="flex:1;min-width:200px">
                            <h2 style="margin:0 0 6px;font-size:22px">${escapeHtml(app.name || '未命名')}</h2>
                            <div style="color:#6b7280;font-size:12px;margin-bottom:8px;font-family:ui-monospace,monospace">${escapeHtml(app.id || '')}</div>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#9ca3af;margin-bottom:12px">
                                <span>v${escapeHtml(app.version || '1.0.0')}</span>
                                ${app.category ? `<span>· ${escapeHtml(app.category)}</span>` : ''}
                                ${app.author ? `<span>· 作者 ${escapeHtml(app.author)}</span>` : ''}
                                ${app.releaseDate ? `<span>· ${escapeHtml(String(app.releaseDate).slice(0, 10))}</span>` : ''}
                                <span>· 下载 ${getDownloads(app)}</span>
                            </div>
                            ${tags.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${tags.map(t => `<span style="background:rgba(255,255,255,0.06);padding:3px 10px;border-radius:6px;font-size:11px;color:#9ca3af">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px">
                            ${actionBtn}
                        </div>
                    </div>
                    <div style="margin-top:24px">
                        <h3 style="margin:0 0 10px;font-size:15px">应用介绍</h3>
                        <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(app.description || '暂无描述')}</p>
                    </div>
                    ${screenshots.length ? `
                        <div style="margin-top:20px">
                            <h3 style="margin:0 0 10px;font-size:15px">应用截图</h3>
                            <div class="store-screenshots">
                                ${screenshots.map(s => `<img loading="lazy" src="${escapeHtml(s)}" alt="截图" onerror="this.style.display='none'">`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    <div id="storeRatingsArea" style="margin-top:20px">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                            <h3 style="margin:0;font-size:15px">评分与评论</h3>
                        </div>
                        <div id="storeRatingsContent" style="color:#9ca3af;font-size:13px">加载中...</div>
                    </div>
                    ${related.length ? `
                        <div style="margin-top:24px">
                            <h3 style="margin:0 0 12px;font-size:15px">相关推荐</h3>
                            <div class="store-row">${related.map(miniCardHtml).join('')}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        bindDetail();
        loadRatingsAndRender(app.id);
    }

    function bindDetail() {
        const back = document.getElementById('storeBack');
        if (back) back.addEventListener('click', () => renderList());
        const installBtn = document.getElementById('storeInstall');
        if (installBtn) installBtn.addEventListener('click', () => installApp(selectedApp));
        const openBtn = document.getElementById('storeOpen');
        if (openBtn) openBtn.addEventListener('click', () => openInstalled(selectedApp.id));
        const scroll = document.getElementById('storeDetailScroll');
        if (scroll) {
            scroll.querySelectorAll('.store-card-mini').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    if (!id) return;
                    const app = apps.find(a => a.id === id);
                    if (app) {
                        selectedApp = app;
                        renderDetail();
                    }
                });
            });
        }
    }

    async function loadRatingsAndRender(appId) {
        const area = document.getElementById('storeRatingsContent');
        if (!area) return;
        currentRatings = null;
        const data = await fetchRatings(appId);
        currentRatings = data;
        renderRatings(area, data, appId);
    }

    function renderRatings(area, data, appId) {
        const ratings = (data && (data.ratings || data.items || data.list)) || [];
        const stats = (data && data.stats) || computeRatingStats(ratings);
        const isLoggedIn = !!(window.MXOS && window.MXOS.User && window.MXOS.User.isLoggedIn && window.MXOS.User.isLoggedIn());
        const distHtml = stats.dist.map((count, i) => {
            const star = 5 - i;
            const total = stats.count || 1;
            const percent = (count / total) * 100;
            return `<div class="store-rating-bar"><span>${star}星</span><div class="bar"><div style="width:${percent}%"></div></div><span>${count}</span></div>`;
        }).join('');
        const commentsHtml = ratings.length === 0
            ? `<div style="text-align:center;color:#6b7280;padding:24px;font-size:13px">暂无评论，快来发表第一条评论吧</div>`
            : ratings.slice(0, 20).map(r => {
                const user = r.user || r.username || r.name || '匿名用户';
                const initial = String(user).charAt(0).toUpperCase();
                const stars = parseInt(r.score ?? r.stars) || 5;
                const date = r.createdAt || r.time || r.date;
                return `
                    <div class="store-comment">
                        <div class="store-comment-header">
                            <div class="store-comment-avatar">${escapeHtml(initial)}</div>
                            <div class="store-comment-user">${escapeHtml(user)}</div>
                            <div class="store-comment-stars">${starsHtml(stars, 11)}</div>
                            <div class="store-comment-date">${date ? formatTime(new Date(date).getTime()) : ''}</div>
                        </div>
                        <div class="store-comment-body">${escapeHtml(r.content || r.comment || '')}</div>
                    </div>
                `;
            }).join('');
        area.innerHTML = `
            <div class="store-rating-overview">
                <div>
                    <div class="store-rating-avg">${stats.avg ? stats.avg.toFixed(1) : '—'}</div>
                    <div class="store-rating-stars">${starsHtml(Math.round(stats.avg), 14)}</div>
                    <div class="store-rating-count">共 ${stats.count} 条评分</div>
                </div>
                <div class="store-rating-dist">${distHtml}</div>
            </div>
            <div style="margin-top:18px">${commentsHtml}</div>
            <div class="store-comment-form">
                ${isLoggedIn ? `
                    <div style="font-size:13px;font-weight:600;margin-bottom:6px">发表评论</div>
                    <div class="store-stars-input" id="storeStarsInput">
                        ${[1,2,3,4,5].map(i => `<span data-val="${i}" class="${i <= currentRatingStars ? 'active' : ''}">★</span>`).join('')}
                    </div>
                    <textarea id="storeCommentInput" placeholder="说说你对这款应用的看法..." maxlength="500"></textarea>
                    <div style="display:flex;justify-content:flex-end;margin-top:8px">
                        <button id="storePostComment" style="background:#60a5fa;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:13px">发表</button>
                    </div>
                ` : `
                    <div style="text-align:center;padding:8px;color:#94a3b8;font-size:13px">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px"><rect x="3" y="11" width="18" height="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        请先登录后发表评论
                        <button id="storeLoginToComment" style="background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.3);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;margin-left:8px">去登录</button>
                    </div>
                `}
            </div>
        `;
        if (isLoggedIn) bindCommentForm(appId);
        const loginBtn = area.querySelector('#storeLoginToComment');
        if (loginBtn) loginBtn.addEventListener('click', () => {
            if (window.MXOS && window.MXOS.User && window.MXOS.User.openAuthModal) {
                window.MXOS.User.openAuthModal('login');
            }
        });
    }

    function bindCommentForm(appId) {
        const input = document.getElementById('storeStarsInput');
        if (input) {
            input.querySelectorAll('span').forEach(s => {
                s.addEventListener('click', () => {
                    currentRatingStars = parseInt(s.dataset.val);
                    input.querySelectorAll('span').forEach(ss => {
                        ss.classList.toggle('active', parseInt(ss.dataset.val) <= currentRatingStars);
                    });
                });
            });
        }
        const postBtn = document.getElementById('storePostComment');
        if (postBtn) postBtn.addEventListener('click', async () => {
            const textarea = document.getElementById('storeCommentInput');
            const content = textarea ? textarea.value.trim() : '';
            if (!content) {
                if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                    window.MXOS.dialog.toast('请输入评论内容', 'warning');
                }
                return;
            }
            postBtn.disabled = true;
            postBtn.textContent = '提交中...';
            try {
                await postRating(appId, currentRatingStars, content);
                if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                    window.MXOS.dialog.toast('评论已发表', 'success');
                }
                await loadRatingsAndRender(appId);
            } catch (e) {
                if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                    window.MXOS.dialog.toast(e.message || '提交失败', 'error');
                }
                postBtn.disabled = false;
                postBtn.textContent = '发表';
            }
        });
    }

    async function updateAllApps() {
        const updates = getUpdateApps();
        if (updates.length === 0) {
            if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                window.MXOS.dialog.toast('所有应用已是最新版本', 'info');
            }
            return;
        }
        if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.confirm) {
            const ok = await window.MXOS.dialog.confirm('全部更新', `将更新 ${updates.length} 个应用，是否继续？`);
            if (!ok) return;
        }
        for (const app of updates) {
            try {
                await installAppSilent(app);
            } catch (e) {}
        }
        applyStartMenuUpdateBadges([]);
        const main = document.getElementById('storeMainContent');
        if (main && currentView === 'home') {
            main.innerHTML = homeContentHtml();
            bindHomeMain();
        }
        if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
            window.MXOS.dialog.toast('已尝试更新所有应用', 'success');
        }
    }

    async function installAppSilent(app) {
        if (!app) return;
        try {
            const blob = await fetchAppPackage(app);
            const file = new File([blob], (app.id || 'app') + '.mx', { type: 'application/octet-stream' });
            const success = await handleInstallerFileSimple(file, contentEl, null, () => {});
            if (success) {
                await patchInstalledIcon(file);
                addDownloadHistory(app);
            }
        } catch (e) {}
    }

    function openInstalled(appId) {
        const installed = state.installedApps.find(a => a.id === appId);
        if (installed) {
            const menu = document.getElementById('startMenu');
            if (menu) window.MXOS.closeStartMenu();
            launchThirdPartyApp(installed);
        }
    }

    async function installApp(app) {
        const btn = document.getElementById('storeInstall');
        if (btn) { btn.disabled = true; btn.textContent = '下载中...'; }
        try {
            const blob = await fetchAppPackage(app);
            const file = new File([blob], (app.id || 'app') + '.mx', { type: 'application/octet-stream' });
            const success = await handleInstallerFileSimple(file, contentEl, null, () => renderDetail());
            if (success) {
                await patchInstalledIcon(file);
                addDownloadHistory(app);
            }
        } catch (e) {
            if (e.message === '该应用未提供下载地址') {
                if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                    window.MXOS.dialog.toast('该应用未提供下载地址', 'warning');
                }
                if (btn) { btn.disabled = false; btn.textContent = '安装'; }
                return;
            }
            contentEl.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;justify-content:center;align-items:center;padding:20px;text-align:center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" style="margin-bottom:16px;color:#ef4444"><use href="#icon-close"/></svg>
                    <h3 style="margin:0 0 8px">安装失败</h3>
                    <p style="color:#9ca3af;font-size:14px;margin:0 0 20px;max-width:400px">${escapeHtml(e.message)}</p>
                    <button id="storeRetry" style="background:#60a5fa;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer">返回</button>
                </div>
            `;
            const retry = document.getElementById('storeRetry');
            if (retry) retry.addEventListener('click', () => renderDetail());
        }
    }

    async function load(forceRefresh = false) {
        loading = true;
        errorMsg = '';
        renderList();
        try {
            apps = await fetchStoreApps(forceRefresh);
            window.__mxosStoreApps = apps;
        } catch (e) {
            errorMsg = e.message;
        } finally {
            loading = false;
            applyFilter();
            renderList();
            const updateIds = getUpdateApps().map(a => a.id);
            applyStartMenuUpdateBadges(updateIds);
        }
    }

    load();
});
