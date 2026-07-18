import { eventBus } from '../utils/event-bus.js';

window.MXOS = window.MXOS || {};
window.MXOS.Sandbox = window.MXOS.Sandbox || {};

const MSG_API_CALL = 'api-call';
const MSG_API_RESPONSE = 'api-response';
const MSG_EVENT = 'event';
const MSG_HANDSHAKE = 'handshake';
const MSG_HANDSHAKE_ACK = 'handshake-ack';

const PENDING_TIMEOUT_MS = 30000;
const pendingCalls = new Map();
const knownOrigins = new Set();
const listeners = new Map();
const clientInfo = new Map();
let globalListenerBound = false;

function genId() {
    return 'rpc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function genToken() {
    const arr = new Uint8Array(24);
    try {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(arr);
            return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {}
    return genId() + genId();
}

function isValidMessage(evt, expectedOrigin) {
    if (!evt || typeof evt !== 'object') return false;
    const data = evt.data;
    if (!data || typeof data !== 'object') return false;
    if (typeof data.__mxos !== 'string' || data.__mxos !== 'sandbox') return false;
    if (typeof data.type !== 'string') return false;
    if (typeof data.appId !== 'string') return false;
    if (typeof data.token !== 'string') return false;
    if (expectedOrigin && evt.origin !== expectedOrigin && evt.origin !== 'null') return false;
    return true;
}

function postMessage(iframe, message, targetOrigin) {
    if (!iframe || !iframe.contentWindow) return false;
    try {
        iframe.contentWindow.postMessage(message, targetOrigin || '*');
        return true;
    } catch (e) {
        return false;
    }
}

function registerHandler(appId, token, api, options) {
    const opts = options || {};
    const origin = opts.origin || '*';
    const key = appId + '::' + token;
    const handler = async (evt) => {
        if (!isValidMessage(evt, origin === '*' ? null : origin)) return;
        const data = evt.data;
        if (data.appId !== appId || data.token !== token) return;

        if (data.type === MSG_HANDSHAKE) {
            clientInfo.set(key, { origin: evt.origin, source: evt.source, readyAt: Date.now() });
            postMessage(iframeForApp(appId), {
                __mxos: 'sandbox',
                type: MSG_HANDSHAKE_ACK,
                appId,
                token,
                ok: true
            }, evt.origin);
            eventBus.emit('sandbox:handshake', { appId, token, origin: evt.origin });
            return;
        }

        if (data.type === MSG_API_CALL) {
            const callId = data.callId;
            const name = data.name;
            const args = data.args || [];
            if (!api || typeof api[name] !== 'function') {
                postMessage(iframeForApp(appId), {
                    __mxos: 'sandbox',
                    type: MSG_API_RESPONSE,
                    appId,
                    token,
                    callId,
                    ok: false,
                    error: '未知 API: ' + name
                }, evt.origin);
                return;
            }
            try {
                const result = await api[name].apply({ appId, token, evt }, args);
                postMessage(iframeForApp(appId), {
                    __mxos: 'sandbox',
                    type: MSG_API_RESPONSE,
                    appId,
                    token,
                    callId,
                    ok: true,
                    result
                }, evt.origin);
            } catch (e) {
                postMessage(iframeForApp(appId), {
                    __mxos: 'sandbox',
                    type: MSG_API_RESPONSE,
                    appId,
                    token,
                    callId,
                    ok: false,
                    error: String(e && e.message || e)
                }, evt.origin);
            }
            return;
        }
    };
    listeners.set(key, { handler, origin, iframe: null });
    return handler;
}

function iframeForApp(appId) {
    const map = window.__mxos_sandbox_iframes || {};
    return map[appId] || null;
}

function setIframeForApp(appId, iframe) {
    if (!window.__mxos_sandbox_iframes) window.__mxos_sandbox_iframes = {};
    window.__mxos_sandbox_iframes[appId] = iframe;
}

function clearIframeForApp(appId) {
    if (!window.__mxos_sandbox_iframes) return;
    delete window.__mxos_sandbox_iframes[appId];
}

function ensureGlobalListener() {
    if (globalListenerBound) return;
    globalListenerBound = true;
    window.addEventListener('message', (evt) => {
        listeners.forEach((entry, key) => {
            const [appId, token] = key.split('::');
            if (entry.origin && entry.origin !== '*' && evt.origin !== entry.origin && evt.origin !== 'null') return;
            try { entry.handler(evt); } catch (e) {}
        });
    });
}

function attach(iframe, appId, token, api, options) {
    if (!iframe || !appId || !token) return null;
    const opts = options || {};
    const origin = opts.origin || '*';
    setIframeForApp(appId, iframe);
    ensureGlobalListener();
    const key = appId + '::' + token;
    const handler = async (evt) => {
        if (!isValidMessage(evt, origin === '*' ? null : origin)) return;
        const data = evt.data;
        if (data.appId !== appId || data.token !== token) return;

        if (data.type === MSG_HANDSHAKE) {
            clientInfo.set(key, { origin: evt.origin, source: evt.source, readyAt: Date.now() });
            postMessage(iframe, {
                __mxos: 'sandbox',
                type: MSG_HANDSHAKE_ACK,
                appId,
                token,
                ok: true
            }, evt.origin);
            eventBus.emit('sandbox:handshake', { appId, token, origin: evt.origin });
            return;
        }

        if (data.type === MSG_API_CALL) {
            const callId = data.callId;
            const name = data.name;
            const args = data.args || [];
            if (!api || typeof api[name] !== 'function') {
                postMessage(iframe, {
                    __mxos: 'sandbox',
                    type: MSG_API_RESPONSE,
                    appId,
                    token,
                    callId,
                    ok: false,
                    error: '未知 API: ' + name
                }, evt.origin);
                return;
            }
            try {
                const ctx = { appId, token, origin: evt.origin, evt, iframe };
                const result = await api[name].apply(ctx, args);
                postMessage(iframe, {
                    __mxos: 'sandbox',
                    type: MSG_API_RESPONSE,
                    appId,
                    token,
                    callId,
                    ok: true,
                    result
                }, evt.origin);
            } catch (e) {
                postMessage(iframe, {
                    __mxos: 'sandbox',
                    type: MSG_API_RESPONSE,
                    appId,
                    token,
                    callId,
                    ok: false,
                    error: String(e && e.message || e)
                }, evt.origin);
            }
        }
    };
    listeners.set(key, { handler, origin, iframe });
    return handler;
}

function detach(appId, token) {
    const key = appId + '::' + token;
    listeners.delete(key);
    clientInfo.delete(key);
    clearIframeForApp(appId);
}

function emitEvent(iframe, appId, token, eventName, payload, targetOrigin) {
    return postMessage(iframe, {
        __mxos: 'sandbox',
        type: MSG_EVENT,
        appId,
        token,
        name: eventName,
        payload
    }, targetOrigin);
}

function createClientBridge(appId, token, targetWindow, targetOrigin) {
    return {
        call(name, args, options) {
            const callId = genId();
            const timeoutMs = (options && options.timeout) || PENDING_TIMEOUT_MS;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    if (pendingCalls.has(callId)) {
                        pendingCalls.delete(callId);
                        reject(new Error('RPC 调用超时: ' + name));
                    }
                }, timeoutMs);
                pendingCalls.set(callId, { resolve, reject, timer, name });
                try {
                    targetWindow.postMessage({
                        __mxos: 'sandbox',
                        type: MSG_API_CALL,
                        appId,
                        token,
                        callId,
                        name,
                        args: args || []
                    }, targetOrigin || '*');
                } catch (e) {
                    clearTimeout(timer);
                    pendingCalls.delete(callId);
                    reject(e);
                }
            });
        },
        on(eventName, callback) {
            if (typeof callback !== 'function') return () => {};
            function handler(evt) {
                if (!isValidMessage(evt, targetOrigin === '*' ? null : targetOrigin)) return;
                const data = evt.data;
                if (data.appId !== appId || data.token !== token) return;
                if (data.type === MSG_EVENT && data.name === eventName) {
                    try { callback(data.payload); } catch (e) {}
                }
            }
            window.addEventListener('message', handler);
            return () => window.removeEventListener('message', handler);
        },
        handshake() {
            try {
                targetWindow.postMessage({
                    __mxos: 'sandbox',
                    type: MSG_HANDSHAKE,
                    appId,
                    token
                }, targetOrigin || '*');
            } catch (e) {}
        }
    };
}

function isKnownOrigin(origin) {
    return knownOrigins.has(origin);
}

function registerOrigin(origin) {
    if (origin && typeof origin === 'string') knownOrigins.add(origin);
}

const Rpc = {
    attach,
    detach,
    emitEvent,
    createClientBridge,
    registerHandler,
    isKnownOrigin,
    registerOrigin,
    genId,
    genToken,
    MSG_API_CALL,
    MSG_API_RESPONSE,
    MSG_EVENT,
    MSG_HANDSHAKE,
    MSG_HANDSHAKE_ACK
};

window.MXOS.Sandbox.rpc = Rpc;
window.MXOS.Sandbox.Rpc = Rpc;

export default Rpc;
export { attach, detach, emitEvent, createClientBridge, genId, genToken };
