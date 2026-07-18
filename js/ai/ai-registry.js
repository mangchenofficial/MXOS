window.MXOS = window.MXOS || {};
window.MXOS.AI = window.MXOS.AI || {};

const CONFIG_KEY = 'mxos_ai_config_enc';
const KEY_SALT_KEY = 'mxos_ai_key_salt';
const KEY_IV_KEY = 'mxos_ai_key_iv';

let currentConfig = {
    provider: '',
    apiKey: '',
    endpoint: '/api/ai/chat',
    model: ''
};

async function deriveKey() {
    const enc = new TextEncoder();
    let salt = localStorage.getItem(KEY_SALT_KEY);
    if (!salt) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        salt = btoa(String.fromCharCode.apply(null, arr));
        localStorage.setItem(KEY_SALT_KEY, salt);
    }
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    const baseKey = await crypto.subtle.importKey(
        'raw',
        enc.encode('mxos-ai-static-passphrase'),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBytes, iterations: 50000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function encryptConfig(config) {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(config));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return {
        iv: bytesToBase64(iv),
        cipher: bytesToBase64(new Uint8Array(cipher))
    };
}

async function decryptConfig(stored) {
    const key = await deriveKey();
    const iv = base64ToBytes(stored.iv);
    const cipher = base64ToBytes(stored.cipher);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plain));
}

async function loadConfig() {
    try {
        const raw = localStorage.getItem(CONFIG_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw);
        const decrypted = await decryptConfig(stored);
        currentConfig = { ...currentConfig, ...decrypted };
    } catch (e) {
        // 解密失败时清空旧数据，避免卡死
        try { localStorage.removeItem(CONFIG_KEY); } catch (err) {}
    }
}

async function setConfig(provider, apiKey, endpoint, model) {
    currentConfig.provider = provider || currentConfig.provider || '';
    currentConfig.apiKey = apiKey != null ? apiKey : currentConfig.apiKey;
    if (endpoint) currentConfig.endpoint = endpoint;
    if (model) currentConfig.model = model;
    try {
        const stored = await encryptConfig(currentConfig);
        localStorage.setItem(CONFIG_KEY, JSON.stringify(stored));
    } catch (e) {
        console.error('[AI] 配置加密保存失败:', e);
    }
    return true;
}

function getConfig() {
    return { ...currentConfig };
}

function isConfigured() {
    return !!(currentConfig.apiKey && currentConfig.endpoint);
}

async function callChatApi(messages, options = {}) {
    const cfg = getConfig();
    if (!cfg.apiKey) {
        throw new Error('未配置 API Key，请先调用 MXOS.AI.setConfig');
    }
    const endpoint = cfg.endpoint || '/api/ai/chat';
    const body = {
        messages,
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model || undefined,
        stream: options.stream !== false,
        ...options
    };

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error('AI 请求失败 (' + res.status + '): ' + text.slice(0, 200));
    }
    return res;
}

async function* streamSse(res) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('data:')) {
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') return;
                try {
                    yield JSON.parse(data);
                } catch (e) {
                    yield { text: data };
                }
            }
        }
    }
    if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();
            if (data && data !== '[DONE]') {
                try { yield JSON.parse(data); } catch (e) { yield { text: data }; }
            }
        }
    }
}

async function callChatSimple(messages, options) {
    const res = await callChatApi(messages, { ...options, stream: false });
    const data = await res.json().catch(() => null);
    if (data && data.text) return data.text;
    if (data && data.choices && data.choices[0]) {
        return data.choices[0].message?.content || data.choices[0].text || '';
    }
    if (data && data.content) return data.content;
    return '';
}

function init() {
    loadConfig();
    window.MXOS.AI.setConfig = setConfig;
    window.MXOS.AI.getConfig = getConfig;
    window.MXOS.AI.isConfigured = isConfigured;
    window.MXOS.AI.callChatApi = callChatApi;
    window.MXOS.AI.streamSse = streamSse;
    window.MXOS.AI.callChatSimple = callChatSimple;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { setConfig, getConfig, isConfigured, callChatApi, streamSse, callChatSimple };
