import { registerAppRenderer, getTaskbarItemForWindow } from '../core.js';
import { state } from '../state.js';

function isImageIcon(icon) {
    return typeof icon === 'string' && /^(https?:|\/api\/|data:image|blob:)/.test(icon);
}

function updateWindowAndTaskbarIcon(windowEl, icon) {
    if (!isImageIcon(icon)) return;
    const titleWrap = windowEl.querySelector('.window-title');
    if (titleWrap) {
        const svg = titleWrap.querySelector('svg');
        if (svg) {
            const img = document.createElement('img');
            img.src = icon;
            img.alt = '';
            img.style.cssText = 'width:16px;height:16px;object-fit:contain;display:block';
            img.onerror = () => { img.style.visibility = 'hidden'; img.title = '图标加载失败'; };
            svg.replaceWith(img);
        }
    }
    const winObj = state.windows.find(w => w.element === windowEl);
    if (!winObj) return;
    const item = getTaskbarItemForWindow(winObj);
    if (item) {
        item.innerHTML = '<img src="' + icon + '" alt="" style="width:24px;height:24px;object-fit:contain;display:block" onerror="this.style.visibility=\'hidden\';this.title=\'图标加载失败\';">';
    }
}

function buildAppApi(originalAppId, appData) {
    return {
        storage: {
            set: function (key, value) {
                try {
                    const data = typeof value === 'string' ? value : JSON.stringify(value);
                    localStorage.setItem('mxos_app_' + originalAppId + '_' + key, data);
                } catch (e) { console.error('Storage error', e); }
            },
            get: function (key) {
                try {
                    const data = localStorage.getItem('mxos_app_' + originalAppId + '_' + key);
                    if (!data) return null;
                    try { return JSON.parse(data); } catch { return data; }
                } catch (e) { return null; }
            },
            remove: function (key) { localStorage.removeItem('mxos_app_' + originalAppId + '_' + key); },
            clear: function () {
                Object.keys(localStorage).filter(k => k.startsWith('mxos_app_' + originalAppId + '_')).forEach(k => localStorage.removeItem(k));
            },
            keys: function () {
                return Object.keys(localStorage).filter(k => k.startsWith('mxos_app_' + originalAppId + '_')).map(k => k.replace('mxos_app_' + originalAppId + '_', ''));
            }
        },
        notify: function (opts) {
            if (window.MXOS && window.MXOS.dialog && window.MXOS.dialog.toast) {
                window.MXOS.dialog.toast((opts.title || '通知') + ': ' + (opts.message || opts.body || ''), 'info');
            }
        },
        dialog: {
            confirm: function (msg, desc) { return confirm(msg + (desc ? '\n' + desc : '')); },
            prompt: function (msg, def) { return prompt(msg, def); }
        },
        getAppInfo: function () { return appData; },
        getSystemInfo: function () { return { os: 'MXOS', version: '1.6', language: 'zh-CN' }; }
    };
}

function looksLikeHtml(content) {
    if (typeof content !== 'string') return false;
    const trimmed = content.trim();
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || /<html[\s>]/i.test(trimmed.slice(0, 500));
}

function launchHtmlApp(contentEl, windowEl, appData, originalAppId) {
    const html = appData.appBin;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100%;border:0;background:transparent;display:block;';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
    iframe.setAttribute('title', appData.name || '应用');

    const api = buildAppApi(originalAppId, appData);
    const previousParentMxos = window.MXOS;
    const exposeApi = function () {
        try {
            const win = iframe.contentWindow;
            if (win) win.MXOS = api;
        } catch (e) {}
        // v2 demo apps commonly read window.parent.MXOS during script execution.
        // Keep the parent API available while this third-party window is open.
        try { window.MXOS = Object.assign({}, previousParentMxos || {}, api); } catch (e) {}
    };

    contentEl.innerHTML = '';
    exposeApi();
    iframe.addEventListener('load', exposeApi);
    iframe.srcdoc = html;
    contentEl.appendChild(iframe);

    const cleanup = () => {
        try {
            if (previousParentMxos) window.MXOS = previousParentMxos;
        } catch (e) {}
        window.removeEventListener('mxos:window-closed', onClosed);
    };
    const onClosed = function (event) {
        if (event && event.detail && event.detail.window && event.detail.window.element === windowEl) cleanup();
    };
    window.addEventListener('mxos:window-closed', onClosed);
}

function launchScriptApp(contentEl, windowEl, appData, originalAppId) {
    const appAPI = {
        getCurrentWindow: function () { return windowEl; },
        setWindowTitle: function (title) {
            const titleEl = windowEl.querySelector('.window-title span:last-child');
            if (titleEl) titleEl.textContent = title;
        },
        setWindowSize: function (w, h) {
            windowEl.style.width = w + 'px';
            windowEl.style.height = h + 'px';
        },
        Storage: buildAppApi(originalAppId, appData).storage,
        Notification: { show: function (opts) { alert((opts.title || '通知') + ': ' + (opts.message || '')); } },
        Dialog: {
            confirm: function (msg, desc) { return confirm(msg + (desc ? '\n' + desc : '')); },
            prompt: function (msg, def) { return prompt(msg, def); }
        },
        Network: { fetch: async function (url, opts) { return fetch(url, opts || {}); } },
        getSystemInfo: function () { return { os: 'MXOS', version: '1.6', language: 'zh-CN' }; },
        getAppInfo: function () { return appData; }
    };

    try {
        window.__MXOS_APP_API__ = appAPI;
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.textContent = appData.appBin;
        document.head.appendChild(script);

        setTimeout(() => {
            if (window.MXOS_APP && window.MXOS_APP.init) {
                try {
                    window.MXOS_APP.init(windowEl);
                } catch (e) {
                    contentEl.innerHTML = `<div style="padding:40px;text-align:center;color:#ff6b6b;"><h3>应用启动失败</h3><p style="margin-top:10px;">${e.message}</p></div>`;
                }
            } else {
                contentEl.innerHTML = `<div style="padding:40px;text-align:center;"><h3 style="color:#fbbf24">app.bin 中未找到 window.MXOS_APP</h3><p style="margin-top:10px;color:#9ca3af;">请确保代码中有 window.MXOS_APP = { init: function() { ... } }</p></div>`;
            }

            document.head.removeChild(script);
            window.__MXOS_APP_API__ = null;
        }, 100);
    } catch (e) {
        contentEl.innerHTML = `<div style="padding:40px;text-align:center;color:#ff6b6b;"><h3>执行 app.bin 失败</h3><p style="margin-top:10px;">${e.message}</p></div>`;
        window.__MXOS_APP_API__ = null;
    }
}

registerAppRenderer('thirdparty', async (contentEl, windowEl, appId) => {
    const originalAppId = appId.replace('thirdparty_', '');
    const appData = state.thirdPartyAppData[originalAppId];

    if (!appData || !appData.appBin) {
        contentEl.innerHTML = `<div style="padding:40px;text-align:center;"><h3 style="color:#fbbf24">应用数据丢失</h3><p style="margin-top:10px;color:#9ca3af;">请重新安装应用</p></div>`;
        return;
    }

    updateWindowAndTaskbarIcon(windowEl, appData.icon);

    if (looksLikeHtml(appData.appBin)) {
        launchHtmlApp(contentEl, windowEl, appData, originalAppId);
    } else {
        launchScriptApp(contentEl, windowEl, appData, originalAppId);
    }
});
