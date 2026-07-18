import { CONFIG, apiUrl } from '../config.js';

function getToken() {
    try { return localStorage.getItem('mxos_session_token') || ''; } catch (e) { return ''; }
}

function fallbackApiUrl(path) {
    if (!CONFIG.API_FALLBACK_BASE) return '';
    if (!path) path = '';
    if (path.indexOf('http') === 0) return '';
    if (path.charAt(0) !== '/' && path !== '') path = '/' + path;
    return CONFIG.API_FALLBACK_BASE + CONFIG.API_PREFIX + path;
}

function buildHeaders(extra = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    Object.assign(headers, extra || {});
    return headers;
}

function withTimeout(fetchPromise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            const err = new Error('请求超时');
            err.code = 'TIMEOUT';
            err.status = 0;
            reject(err);
        }, ms);
        fetchPromise.then(
            (res) => { clearTimeout(timer); resolve(res); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

async function request(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const url = apiUrl(path);
    const headers = buildHeaders(options.headers || {});
    const opts = { method, headers };

    let body = options.body;
    if (body !== undefined && body !== null) {
        if (typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
            body = JSON.stringify(body);
            if (!headers['Content-Type'] && !headers['content-type']) {
                headers['Content-Type'] = 'application/json';
            }
        } else if (typeof body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
        }
        opts.body = body;
    }
    if (options.signal) opts.signal = options.signal;

    const timeout = options.timeout || CONFIG.TIMEOUT;
    let res;
    try {
        res = await withTimeout(fetch(url, opts), timeout);
    } catch (err) {
        const fallbackUrl = fallbackApiUrl(path);
        if (!fallbackUrl || fallbackUrl === url) throw err;
        res = await withTimeout(fetch(fallbackUrl, opts), timeout);
    }
    const fallbackUrlForStatus = fallbackApiUrl(path);
    if (res && res.status === 403 && fallbackUrlForStatus && fallbackUrlForStatus !== url) {
        res = await withTimeout(fetch(fallbackUrlForStatus, opts), timeout);
    }

    let data = null;
    const text = await res.text();
    if (text) {
        try { data = JSON.parse(text); } catch (e) { data = text; }
    }

    if (!res.ok) {
        let msg = '请求失败 (' + res.status + ')';
        if (data) {
            if (typeof data.error === 'object' && data.error) {
                msg = data.error.message || data.error.code || msg;
            } else if (typeof data.message === 'string') {
                msg = data.message;
            } else if (typeof data.error === 'string') {
                msg = data.error;
            }
        }
        const err = new Error(msg);
        err.status = res.status;
        err.response = data;
        throw err;
    }
    return data;
}

export const http = {
    request,
    get(path, options = {}) { return request(path, { ...options, method: 'GET' }); },
    post(path, body, options = {}) { return request(path, { ...options, method: 'POST', body }); },
    put(path, body, options = {}) { return request(path, { ...options, method: 'PUT', body }); },
    del(path, options = {}) { return request(path, { ...options, method: 'DELETE' }); },
    delete(path, options = {}) { return request(path, { ...options, method: 'DELETE' }); }
};

export default http;
