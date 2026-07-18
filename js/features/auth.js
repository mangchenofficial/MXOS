import { state } from '../state.js';
import { eventBus } from '../utils/event-bus.js';
import { http } from '../utils/http.js';

const TOKEN_KEY = 'mxos_session_token';
const USER_KEY = 'mxos_auth_user';
const SERVICE_AVAILABLE_KEY = 'mxos_auth_service_available';
const UNAVAILABLE_UNTIL_KEY = 'mxos-auth-unavailable-until';
const UNAVAILABLE_COOLDOWN = 30000;

window.MXOS = window.MXOS || {};
const MXOS = window.MXOS;
MXOS.User = MXOS.User || {};

let serviceAvailable = (() => {
    try {
        const until = parseInt(localStorage.getItem(UNAVAILABLE_UNTIL_KEY) || '0');
        if (Date.now() < until) return false;
        return true;
    } catch (e) { return true; }
})();

let serviceCheckPromise = null;

function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
}

function setToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    state.user.token = token || '';
}

function saveUserCache(user) {
    try {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_KEY);
    } catch (e) {}
}

function loadUserCache() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function authHeaders(extra = {}) {
    const headers = { 'Content-Type': 'application/json', ...extra };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
}

async function checkServiceAvailable() {
    try {
        const until = parseInt(localStorage.getItem(UNAVAILABLE_UNTIL_KEY) || '0');
        if (Date.now() < until) {
            serviceAvailable = false;
            return false;
        }
    } catch (e) {}
    try {
        await http.get('/apps', { timeout: 5000 });
        serviceAvailable = true;
        try { localStorage.removeItem(UNAVAILABLE_UNTIL_KEY); } catch (e) {}
        return true;
    } catch (e) {
        serviceAvailable = false;
        try { localStorage.setItem(UNAVAILABLE_UNTIL_KEY, String(Date.now() + UNAVAILABLE_COOLDOWN)); } catch (e) {}
        return false;
    }
}

function normalizeUserProfile(user) {
    if (!user) return null;
    const id = user.id || user.userId || user.email || null;
    const email = user.email || '';
    const name = user.displayName || user.name || user.username || (email ? email.split('@')[0] : '');
    const avatar = user.avatarUrl || user.avatar || '';
    return { id, email, name, avatar };
}

function setUser(user) {
    const profile = normalizeUserProfile(user);
    state.user.id = profile && profile.id != null ? profile.id : null;
    state.user.email = profile && profile.email ? profile.email : '';
    state.user.name = profile && profile.name ? profile.name : '';
    state.user.avatar = profile && profile.avatar ? profile.avatar : '';
    state.user.isLoggedIn = !!(profile && profile.id);
    saveUserCache(profile && profile.id ? {
        id: profile.id, email: profile.email || '', name: profile.name || '', avatar: profile.avatar || ''
    } : null);
    eventBus.emit('user:change', { ...state.user });
    updateTaskbarUser();
}

function notify(title, body, type = 'info') {
    if (MXOS.notify && typeof MXOS.notify === 'function') {
        try { MXOS.notify({ title, body, type, duration: 3500 }); return; } catch (e) {}
    }
    console.log('[Auth]', title, body);
}

function isEmail(s) {
    return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

async function request(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET') return http.get(path, options);
    if (method === 'POST') return http.post(path, options.body, options);
    if (method === 'PUT') return http.put(path, options.body, options);
    if (method === 'PATCH') return http.request(path, { ...options, method: 'PATCH' });
    if (method === 'DELETE') return http.del(path, options);
    return http.request(path, options);
}

async function login(email, password) {
    if (!serviceAvailable) {
        const avail = await checkServiceAvailable();
        if (!avail) throw new Error('认证服务暂不可用，无法连接到云端 Worker，请检查网络或确认 mxos-api 已部署');
    }
    if (!isEmail(email)) throw new Error('请输入有效的邮箱');
    if (!password || password.length < 6) throw new Error('密码长度至少 6 位');
    try {
        const data = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: email.trim(), password })
        });
        const user = data.user || data.data || data;
        const token = data.sessionToken || data.token || (user && (user.sessionToken || user.token)) || '';
        if (!token) throw new Error('登录响应缺少 token');
        setToken(token);
        setUser(user);
        notify('登录成功', `欢迎回来，${state.user.name}`, 'success');
        eventBus.emit('user:login', { ...state.user });
        return state.user;
    } catch (e) {
        if (e.code === 'TIMEOUT' || e.status === 0) throw new Error('登录请求超时，无法连接到认证服务，请检查网络或确认 Worker 已部署');
        throw e;
    }
}

async function register(email, password, humanToken = '') {
    if (!serviceAvailable) {
        const avail = await checkServiceAvailable();
        if (!avail) throw new Error('认证服务暂不可用，无法连接到云端 Worker，请检查网络或确认 mxos-api 已部署');
    }
    if (!isEmail(email)) throw new Error('请输入有效的邮箱');
    if (!password || password.length < 6) throw new Error('密码长度至少 6 位');
    try {
        const data = await request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email: email.trim(), password, displayName: email.split('@')[0], humanToken })
        });
        const user = data.user || data.data || data;
        const token = data.sessionToken || data.token || (user && (user.sessionToken || user.token)) || '';
        if (!token) throw new Error('注册响应缺少 token');
        setToken(token);
        setUser(user);
        notify('注册成功', `欢迎加入 MXOS，${state.user.name}`, 'success');
        eventBus.emit('user:register', { ...state.user });
        return state.user;
    } catch (e) {
        if (e.code === 'TIMEOUT' || e.status === 0) throw new Error('注册请求超时，无法连接到认证服务，请检查网络或确认 Worker 已部署');
        throw e;
    }
}

async function logout() {
    const wasLoggedIn = state.user.isLoggedIn;
    try {
        if (wasLoggedIn) await request('/auth/logout', { method: 'POST' });
    } catch (e) {
    }
    setToken('');
    setUser({ id: null, name: '', avatar: '' });
    if (wasLoggedIn) notify('已注销', '您已退出登录', 'info');
    eventBus.emit('user:logout', {});
    return true;
}

async function getInfo() {
    if (!getToken()) return null;
    try {
        const data = await request('/auth/me', { method: 'GET' });
        const user = data.user || data.data || data;
        if (user && (user.id || user.userId || user.email)) {
            setUser(user);
        }
        return state.user;
    } catch (e) {
        if (e.status === 401 || e.status === 403) {
            setToken('');
            setUser({ id: null, name: '', avatar: '' });
        }
        return null;
    }
}

async function deleteAccount() {
    if (!getToken()) throw new Error('请先登录');
    await request('/auth/me', { method: 'DELETE' });
    setToken('');
    setUser({ id: null, name: '', avatar: '' });
    notify('账号已注销', '账号和云端数据已删除', 'success');
    eventBus.emit('user:delete', {});
    return true;
}

async function updateProfile(payload = {}) {
    if (!getToken()) throw new Error('请先登录');
    const body = {};
    if (payload.displayName !== undefined) body.displayName = payload.displayName;
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.avatarDataUrl !== undefined) body.avatarDataUrl = payload.avatarDataUrl;
    if (payload.avatarUrl !== undefined) body.avatarUrl = payload.avatarUrl;
    if (payload.clearAvatar !== undefined) body.clearAvatar = !!payload.clearAvatar;
    if (!Object.keys(body).length) throw new Error('没有需要保存的资料');
    const data = await request('/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
    const user = data.user || data.data || data;
    if (user && (user.id || user.userId || user.email)) setUser(user);
    notify('资料已更新', '账户头像和用户名已保存', 'success');
    eventBus.emit('user:profile', { ...state.user });
    return state.user;
}

function isLoggedIn() {
    return !!state.user.isLoggedIn;
}

function isServiceAvailable() {
    if (serviceAvailable) return true;
    try {
        const until = parseInt(localStorage.getItem(UNAVAILABLE_UNTIL_KEY) || '0');
        if (Date.now() >= until) {
            serviceAvailable = true;
            return true;
        }
    } catch (e) {}
    return false;
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}


function registerEmailProblem(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!value) return '请输入邮箱';
    if (!/^[^\s@]+@[^\s@]+\.(com|cn|org|net)$/i.test(value)) return '邮箱仅支持 .com/.cn/.org/.net';
    const domain = value.split('@')[1] || '';
    if (REG_DISPOSABLE_DOMAINS.has(domain)) return '不支持一次性邮箱';
    return '';
}

function resetRegisterVerificationState() {
    regHumanVerified = false;
    regEmailVerified = false;
    regHumanToken = '';
    regChallengeId = '';
    regChallengeEmail = '';
    regCodeSending = false;
    regSendCountdown = 0;
    if (regSendTimer) clearInterval(regSendTimer);
    regSendTimer = null;
}

let modalEl = null;
let modalMode = 'login';
let regHumanVerified = false;
let regEmailVerified = false;
let regHumanToken = '';
let regChallengeId = '';
let regChallengeEmail = '';
let regCodeSending = false;
let regSendCountdown = 0;
let regSendTimer = null;
const REG_DISPOSABLE_DOMAINS = new Set(['10minutemail.com','guerrillamail.com','mailinator.com','tempmail.com','temp-mail.org','yopmail.com','throwawaymail.com','getnada.com','trashmail.com','sharklasers.com','dispostable.com','maildrop.cc']);

function openAuthModal(mode = 'login') {
    modalMode = mode === 'register' ? 'register' : 'login';
    resetRegisterVerificationState();
    if (modalEl && document.body.contains(modalEl)) {
        renderModalContent();
        return;
    }
    modalEl = document.createElement('div');
    modalEl.id = 'mxos-auth-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-label', 'MXOS 账户登录');
    modalEl.innerHTML = `
        <div class="mxos-auth-overlay"></div>
        <div class="mxos-auth-panel">
            <button class="mxos-auth-close" aria-label="关闭" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
            <div class="mxos-auth-body"></div>
        </div>
    `;
    document.body.appendChild(modalEl);
    injectAuthStyles();
    bindModalBase();
    renderModalContent();
    requestAnimationFrame(() => modalEl.classList.add('show'));
}

function closeAuthModal() {
    if (!modalEl) return;
    modalEl.classList.remove('show');
    document.removeEventListener('keydown', authEscHandler);
    if (regSendTimer) clearInterval(regSendTimer);
    regSendTimer = null;
    const el = modalEl;
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); if (el === modalEl) modalEl = null; }, 250);
}

function bindModalBase() {
    if (!modalEl) return;
    modalEl.querySelector('.mxos-auth-close').addEventListener('click', closeAuthModal);
    modalEl.querySelector('.mxos-auth-overlay').addEventListener('click', closeAuthModal);
    document.addEventListener('keydown', authEscHandler);
}

function authEscHandler(e) {
    if (e.key === 'Escape' && modalEl) closeAuthModal();
}

function renderModalContent() {
    if (!modalEl) return;
    const body = modalEl.querySelector('.mxos-auth-body');
    if (!body) return;
    const isReg = modalMode === 'register';
    body.innerHTML = `
        <div class="mxos-auth-logo">
            <svg width="44" height="44" viewBox="0 0 256 256"><use href="#svg-windows"/></svg>
        </div>
        <h2 class="mxos-auth-title">${isReg ? '创建 MXOS 账户' : '登录 MXOS 账户'}</h2>
        <p class="mxos-auth-subtitle">${isReg ? '注册前需完成人机验证和邮箱验证' : '登录后可同步设置、应用和桌面布局'}</p>
        <form class="mxos-auth-form" id="mxos-auth-form" autocomplete="on">
            <label class="mxos-auth-field">
                <span class="mxos-auth-label">邮箱</span>
                <input type="email" id="mxos-auth-email" required autocomplete="email" placeholder="you@example.com">
            </label>
            <label class="mxos-auth-field">
                <span class="mxos-auth-label">密码${isReg ? ' (至少 6 位)' : ''}</span>
                <input type="password" id="mxos-auth-password" required autocomplete="${isReg ? 'new-password' : 'current-password'}" placeholder="${isReg ? '设置密码' : '输入密码'}">
            </label>
            ${isReg ? `
            <div class="mxos-auth-register-extra">
                <div class="mxos-auth-email-state"><span id="mxos-reg-email-mark"></span><small id="mxos-reg-email-hint">请先完成人机验证，再发送邮箱验证码</small></div>
                <div class="mxos-auth-captcha" id="mxos-reg-captcha">
                    <div class="mxos-auth-captcha-head"><span>人机验证</span><strong id="mxos-reg-captcha-question">加载中...</strong></div>
                    <div class="mxos-auth-captcha-row"><input id="mxos-reg-captcha-answer" inputmode="numeric" maxlength="3" placeholder="答案"><button type="button" id="mxos-reg-verify-human">验证</button><button type="button" id="mxos-reg-refresh-human" title="换一题">↻</button></div>
                </div>
                <div class="mxos-auth-code-row"><button type="button" id="mxos-reg-send-code" disabled>发送验证码</button><input id="mxos-reg-code" inputmode="numeric" maxlength="6" placeholder="邮箱验证码"></div>
                <button type="button" id="mxos-reg-verify-code" class="mxos-auth-verify-btn" disabled>验证邮箱</button>
            </div>` : ''}
            <div class="mxos-auth-error" id="mxos-auth-error" style="display:none"></div>
            <button type="submit" class="mxos-auth-submit" id="mxos-auth-submit">${isReg ? '注册' : '登录'}</button>
        </form>
        <div class="mxos-auth-switch">
            ${isReg ? '已有账户？' : '还没有账户？'}
            <button type="button" class="mxos-auth-switch-btn" data-mode="${isReg ? 'login' : 'register'}">${isReg ? '去登录' : '去注册'}</button>
        </div>
        <div class="mxos-auth-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            <span>认证服务由云端 Worker 提供，未部署时将提示“服务暂不可用”</span>
        </div>
    `;
    const form = body.querySelector('#mxos-auth-form');
    form.addEventListener('submit', handleAuthSubmit);
    if (isReg) bindRegisterVerification(body);
    body.querySelector('.mxos-auth-switch-btn').addEventListener('click', (e) => {
        modalMode = e.currentTarget.dataset.mode === 'register' ? 'register' : 'login';
        resetRegisterVerificationState();
        renderModalContent();
    });
    setTimeout(() => {
        const emailInput = body.querySelector('#mxos-auth-email');
        if (emailInput) emailInput.focus();
    }, 100);
}

function verificationPayload(res) {
    return res && typeof res === 'object' && res.data ? res.data : (res || {});
}

function setAuthInlineError(root, message) {
    const errEl = root.querySelector('#mxos-auth-error');
    if (!errEl) return;
    errEl.textContent = message || '';
    errEl.style.display = message ? 'block' : 'none';
}

function updateRegisterVerificationUi(root) {
    const emailEl = root.querySelector('#mxos-auth-email');
    const email = emailEl ? emailEl.value.trim().toLowerCase() : '';
    const problem = registerEmailProblem(email);
    const hint = root.querySelector('#mxos-reg-email-hint');
    const mark = root.querySelector('#mxos-reg-email-mark');
    const sendBtn = root.querySelector('#mxos-reg-send-code');
    const verifyBtn = root.querySelector('#mxos-reg-verify-code');
    const submitBtn = root.querySelector('#mxos-auth-submit');
    const codeInput = root.querySelector('#mxos-reg-code');
    const humanBtn = root.querySelector('#mxos-reg-verify-human');
    const answerInput = root.querySelector('#mxos-reg-captcha-answer');
    if (mark) {
        mark.className = regEmailVerified ? 'ok' : (regHumanVerified ? 'pending' : '');
        mark.textContent = regEmailVerified ? '✓' : (regHumanVerified ? '•' : '');
    }
    if (hint) {
        if (problem) hint.textContent = problem;
        else if (regEmailVerified) hint.textContent = '邮箱已验证，可以注册';
        else if (regHumanVerified) hint.textContent = '人机验证通过，请发送并输入邮箱验证码';
        else hint.textContent = '请先完成人机验证，再发送邮箱验证码';
    }
    if (sendBtn) {
        sendBtn.disabled = !!problem || !regHumanVerified || regEmailVerified || regCodeSending || regSendCountdown > 0;
        sendBtn.textContent = regSendCountdown > 0 ? regSendCountdown + 's 后重发' : (regCodeSending ? '发送中...' : '发送验证码');
    }
    if (verifyBtn) verifyBtn.disabled = !!problem || !regHumanVerified || regEmailVerified || !/^\d{6}$/.test((codeInput && codeInput.value.trim()) || '');
    if (submitBtn && modalMode === 'register') submitBtn.disabled = !regHumanVerified || !regEmailVerified;
    if (humanBtn) humanBtn.disabled = !!problem || !regChallengeId || regHumanVerified || !((answerInput && answerInput.value.trim()) || '');
}

async function loadCaptchaChallenge(root) {
    const q = root.querySelector('#mxos-reg-captcha-question');
    const answer = root.querySelector('#mxos-reg-captcha-answer');
    regHumanVerified = false;
    regHumanToken = '';
    regChallengeId = '';
    if (q) q.textContent = '加载中...';
    if (answer) answer.value = '';
    updateRegisterVerificationUi(root);
    try {
        const res = await request('/captcha/challenge', { method: 'POST', body: JSON.stringify({}) });
        const data = verificationPayload(res);
        regChallengeId = data.challengeId || '';
        if (q) q.textContent = data.question || '请刷新重试';
        setAuthInlineError(root, '');
    } catch (err) {
        if (q) q.textContent = '加载失败';
        setAuthInlineError(root, err.message || '人机验证加载失败');
    }
    updateRegisterVerificationUi(root);
}

async function verifyRegisterHuman(root) {
    const email = root.querySelector('#mxos-auth-email').value.trim().toLowerCase();
    const answer = root.querySelector('#mxos-reg-captcha-answer').value.trim();
    const problem = registerEmailProblem(email);
    if (problem) throw new Error(problem);
    if (!regChallengeId) throw new Error('请刷新人机验证');
    if (!answer) throw new Error('请输入人机验证答案');
    const data = verificationPayload(await request('/captcha/verify', {
        method: 'POST',
        body: JSON.stringify({ email, challengeId: regChallengeId, answer })
    }));
    regHumanVerified = true;
    regHumanToken = data.humanToken || '';
    regChallengeEmail = email;
    if (!regHumanToken) throw new Error('人机验证响应缺少 token');
}

function startRegisterSendCountdown(root, seconds) {
    regSendCountdown = Math.max(1, parseInt(seconds || '120', 10) || 120);
    if (regSendTimer) clearInterval(regSendTimer);
    regSendTimer = setInterval(() => {
        regSendCountdown -= 1;
        if (regSendCountdown <= 0) {
            clearInterval(regSendTimer);
            regSendTimer = null;
            regSendCountdown = 0;
        }
        updateRegisterVerificationUi(root);
    }, 1000);
    updateRegisterVerificationUi(root);
}

async function sendRegisterEmailCode(root) {
    const email = root.querySelector('#mxos-auth-email').value.trim().toLowerCase();
    const problem = registerEmailProblem(email);
    if (problem) throw new Error(problem);
    if (!regHumanVerified || !regHumanToken || regChallengeEmail !== email) throw new Error('请先完成人机验证');
    regCodeSending = true;
    updateRegisterVerificationUi(root);
    try {
        const res = await request('/send-code', { method: 'POST', body: JSON.stringify({ email, humanToken: regHumanToken }) });
        const data = verificationPayload(res);
        startRegisterSendCountdown(root, data.cooldown || data.retryAfter || 120);
        notify('验证码已发送', '120 秒后可重新发送；当前验证码在重发前有效', 'success');
        return data;
    } finally {
        regCodeSending = false;
        updateRegisterVerificationUi(root);
    }
}

async function verifyRegisterEmailCode(root) {
    const email = root.querySelector('#mxos-auth-email').value.trim().toLowerCase();
    const code = root.querySelector('#mxos-reg-code').value.trim();
    const problem = registerEmailProblem(email);
    if (problem) throw new Error(problem);
    if (!regHumanVerified || !regHumanToken || regChallengeEmail !== email) throw new Error('请先完成人机验证');
    if (!/^\d{6}$/.test(code)) throw new Error('请输入 6 位邮箱验证码');
    await request('/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) });
    regEmailVerified = true;
    notify('邮箱验证通过', '现在可以注册账户', 'success');
}

function bindRegisterVerification(root) {
    const emailEl = root.querySelector('#mxos-auth-email');
    const codeEl = root.querySelector('#mxos-reg-code');
    const answerEl = root.querySelector('#mxos-reg-captcha-answer');
    const refreshBtn = root.querySelector('#mxos-reg-refresh-human');
    const humanBtn = root.querySelector('#mxos-reg-verify-human');
    const sendBtn = root.querySelector('#mxos-reg-send-code');
    const verifyBtn = root.querySelector('#mxos-reg-verify-code');
    emailEl.addEventListener('input', () => {
        const email = emailEl.value.trim().toLowerCase();
        if (regChallengeEmail && email !== regChallengeEmail) {
            regHumanVerified = false;
            regEmailVerified = false;
            regHumanToken = '';
            regChallengeEmail = '';
            if (codeEl) codeEl.value = '';
        }
        updateRegisterVerificationUi(root);
    });
    if (codeEl) codeEl.addEventListener('input', () => updateRegisterVerificationUi(root));
    if (answerEl) {
        answerEl.addEventListener('input', () => updateRegisterVerificationUi(root));
        answerEl.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!humanBtn.disabled) humanBtn.click();
            }
        });
    }
    refreshBtn.addEventListener('click', () => loadCaptchaChallenge(root));
    humanBtn.addEventListener('click', async () => {
        try {
            setAuthInlineError(root, '');
            humanBtn.disabled = true;
            humanBtn.textContent = '验证中...';
            await verifyRegisterHuman(root);
            humanBtn.textContent = '已通过';
        } catch (err) {
            humanBtn.textContent = '验证';
            setAuthInlineError(root, err.message || '人机验证失败');
            await loadCaptchaChallenge(root);
        }
        updateRegisterVerificationUi(root);
    });
    sendBtn.addEventListener('click', async () => {
        try { setAuthInlineError(root, ''); await sendRegisterEmailCode(root); }
        catch (err) { setAuthInlineError(root, err.message || '验证码发送失败'); }
    });
    verifyBtn.addEventListener('click', async () => {
        try { setAuthInlineError(root, ''); verifyBtn.disabled = true; verifyBtn.textContent = '验证中...'; await verifyRegisterEmailCode(root); verifyBtn.textContent = '已验证'; }
        catch (err) { verifyBtn.textContent = '验证邮箱'; setAuthInlineError(root, err.message || '邮箱验证失败'); }
        updateRegisterVerificationUi(root);
    });
    loadCaptchaChallenge(root);
    updateRegisterVerificationUi(root);
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!modalEl) return;
    const email = modalEl.querySelector('#mxos-auth-email').value.trim();
    const password = modalEl.querySelector('#mxos-auth-password').value;
    const errEl = modalEl.querySelector('#mxos-auth-error');
    const submitBtn = modalEl.querySelector('#mxos-auth-submit');
    errEl.style.display = 'none';
    errEl.textContent = '';
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '处理中...';
    try {
        if (modalMode === 'register') {
            if (!regHumanVerified || !regHumanToken) throw new Error('请先完成人机验证');
            if (!regEmailVerified) throw new Error('请先完成邮箱验证码验证');
            await register(email, password, regHumanToken);
        } else {
            await login(email, password);
        }
        closeAuthModal();
    } catch (err) {
        errEl.textContent = err.message || '操作失败';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        if (modalMode === 'register') updateRegisterVerificationUi(modalEl);
    }
}

function injectAuthStyles() {
    if (document.getElementById('mxos-auth-style')) return;
    const style = document.createElement('style');
    style.id = 'mxos-auth-style';
    style.textContent = `
    #mxos-auth-modal{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;pointer-events:none}
    #mxos-auth-modal .mxos-auth-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.45);opacity:0;transition:opacity 0.25s}
    #mxos-auth-modal .mxos-auth-panel{position:relative;width:400px;max-width:92vw;background:rgba(28,28,35,0.78);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border:1px solid rgba(255,255,255,0.12);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04) inset;padding:28px 26px 22px;color:#fff;transform:translateY(12px) scale(0.96);opacity:0;transition:transform 0.28s cubic-bezier(0.4,0,0.2,1),opacity 0.28s}
    #mxos-auth-modal.show{pointer-events:auto}
    #mxos-auth-modal.show .mxos-auth-overlay{opacity:1}
    #mxos-auth-modal.show .mxos-auth-panel{transform:translateY(0) scale(1);opacity:1}
    .mxos-auth-close{position:absolute;top:12px;right:12px;background:rgba(255,255,255,0.06);border:none;color:#cbd5e1;width:28px;height:28px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s}
    .mxos-auth-close:hover{background:rgba(255,255,255,0.14)}
    .mxos-auth-logo{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:0 8px 20px rgba(59,130,246,0.35)}
    .mxos-auth-title{margin:0 0 4px;font-size:20px;font-weight:600;text-align:center}
    .mxos-auth-subtitle{margin:0 0 22px;color:#94a3b8;font-size:12px;text-align:center}
    .mxos-auth-form{display:flex;flex-direction:column;gap:14px}
    .mxos-auth-field{display:flex;flex-direction:column;gap:6px}
    .mxos-auth-label{font-size:12px;color:#cbd5e1;font-weight:500}
    .mxos-auth-field input,.mxos-auth-captcha-row input,.mxos-auth-code-row input{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;color:#fff;font-size:14px;outline:none;transition:border-color 0.15s,background 0.15s}
    .mxos-auth-field input:focus,.mxos-auth-captcha-row input:focus,.mxos-auth-code-row input:focus{border-color:#3b82f6;background:rgba(59,130,246,0.08)}
    .mxos-auth-field input::placeholder,.mxos-auth-captcha-row input::placeholder,.mxos-auth-code-row input::placeholder{color:#64748b}
    .mxos-auth-register-extra{display:flex;flex-direction:column;gap:10px;margin-top:-2px}
    .mxos-auth-email-state{display:flex;align-items:center;gap:7px;color:#94a3b8;font-size:12px}
    #mxos-reg-email-mark{width:16px;height:16px;border-radius:50%;border:1px solid rgba(148,163,184,.45);display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8}
    #mxos-reg-email-mark.pending{background:rgba(59,130,246,.18);border-color:rgba(96,165,250,.75);color:#93c5fd}
    #mxos-reg-email-mark.ok{background:rgba(34,197,94,.18);border-color:rgba(74,222,128,.75);color:#86efac}
    .mxos-auth-captcha{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px;background:rgba(255,255,255,.04)}
    .mxos-auth-captcha-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;font-size:12px;color:#94a3b8}
    .mxos-auth-captcha-head strong{color:#e2e8f0;font-size:15px;letter-spacing:.5px}
    .mxos-auth-captcha-row,.mxos-auth-code-row{display:flex;gap:8px}
    .mxos-auth-captcha-row input{flex:1;min-width:0}
    .mxos-auth-code-row input{flex:1;min-width:0}
    .mxos-auth-captcha-row button,.mxos-auth-code-row button,.mxos-auth-verify-btn{border:none;border-radius:10px;padding:9px 11px;background:rgba(59,130,246,.18);color:#bfdbfe;cursor:pointer;font-size:12px;white-space:nowrap}
    .mxos-auth-captcha-row button:hover:not(:disabled),.mxos-auth-code-row button:hover:not(:disabled),.mxos-auth-verify-btn:hover:not(:disabled){background:rgba(59,130,246,.3)}
    .mxos-auth-captcha-row button:disabled,.mxos-auth-code-row button:disabled,.mxos-auth-verify-btn:disabled{opacity:.48;cursor:not-allowed}
    .mxos-auth-verify-btn{width:100%;padding:10px 11px;background:rgba(34,197,94,.16);color:#bbf7d0}
    .mxos-auth-error{background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:8px 12px;border-radius:8px;font-size:12px}
    .mxos-auth-submit{margin-top:4px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border:none;padding:11px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:transform 0.1s,box-shadow 0.2s;box-shadow:0 6px 16px rgba(59,130,246,0.3)}
    .mxos-auth-submit:hover:not(:disabled){box-shadow:0 8px 22px rgba(59,130,246,0.45)}
    .mxos-auth-submit:active:not(:disabled){transform:scale(0.98)}
    .mxos-auth-submit:disabled{opacity:0.6;cursor:not-allowed}
    .mxos-auth-switch{margin-top:16px;text-align:center;font-size:12px;color:#94a3b8}
    .mxos-auth-switch-btn{background:none;border:none;color:#60a5fa;cursor:pointer;font-size:12px;padding:0 2px}
    .mxos-auth-switch-btn:hover{text-decoration:underline}
    .mxos-auth-hint{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:flex-start;gap:6px;color:#64748b;font-size:11px;line-height:1.5}
    .mxos-auth-hint svg{flex-shrink:0;margin-top:1px}
    `;
    document.head.appendChild(style);
}

function getAvatarHtml(size = 24) {
    const u = state.user;
    if (u.avatar) {
        return `<img src="${escapeHtml(u.avatar)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block" onerror="this.style.display='none';this.parentNode.innerHTML='<svg width=&quot;${size}&quot; height=&quot;${size}&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot;><use href=&quot;#icon-user&quot;/></svg>'">`;
    }
    if (u.isLoggedIn && u.name) {
        const initial = u.name.charAt(0).toUpperCase();
        return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.5)}px;font-weight:600">${escapeHtml(initial)}</div>`;
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-user"/></svg>`;
}

function createTaskbarUserWidget() {
    const widget = document.createElement('div');
    widget.id = 'mxos-taskbar-user';
    widget.className = 'mxos-taskbar-user';
    widget.setAttribute('role', 'button');
    widget.setAttribute('tabindex', '0');
    widget.setAttribute('aria-label', '账户');
    widget.innerHTML = `
        <div class="mxos-taskbar-user-avatar"></div>
        <div class="mxos-taskbar-user-menu" id="mxos-user-menu"></div>
    `;
    widget.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleUserMenu();
    });
    widget.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleUserMenu();
        }
    });
    document.addEventListener('click', (e) => {
        if (!widget.contains(e.target)) {
            const menu = widget.querySelector('#mxos-user-menu');
            if (menu) menu.classList.remove('show');
        }
    });
    injectTaskbarUserStyles();
    return widget;
}

function injectTaskbarUserStyles() {
    if (document.getElementById('mxos-taskbar-user-style')) return;
    const style = document.createElement('style');
    style.id = 'mxos-taskbar-user-style';
    style.textContent = `
    .mxos-taskbar-user{position:relative;padding:4px 8px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background 0.15s}
    .mxos-taskbar-user:hover{background:var(--hover-bg,rgba(255,255,255,0.08))}
    .mxos-taskbar-user-avatar{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#cbd5e1;border:1px solid rgba(255,255,255,0.12)}
    .mxos-taskbar-user-avatar svg{display:block}
    .mxos-taskbar-user.logged-in .mxos-taskbar-user-avatar{border-color:rgba(96,165,250,0.6);box-shadow:0 0 0 1px rgba(59,130,246,0.3)}
    .mxos-taskbar-user-menu{position:absolute;bottom:calc(100% + 6px);right:0;min-width:220px;background:rgba(28,28,35,0.88);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,0.5);padding:6px;opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 0.2s,transform 0.2s;z-index:10001}
    .mxos-taskbar-user-menu.show{opacity:1;transform:translateY(0);pointer-events:auto}
    .mxos-user-menu-header{padding:10px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px}
    .mxos-user-menu-header .avatar{width:36px;height:36px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#cbd5e1;background:rgba(255,255,255,0.06)}
    .mxos-user-menu-header .info{flex:1;min-width:0}
    .mxos-user-menu-header .name{font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mxos-user-menu-header .desc{font-size:11px;color:#94a3b8}
    .mxos-user-menu-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;font-size:13px;color:#e2e8f0;cursor:pointer;transition:background 0.12s}
    .mxos-user-menu-item:hover{background:rgba(255,255,255,0.08)}
    .mxos-user-menu-item.danger{color:#fca5a5}
    .mxos-user-menu-item.danger:hover{background:rgba(239,68,68,0.12)}
    .mxos-user-menu-item svg{flex-shrink:0}
    .mxos-user-menu-divider{height:1px;background:rgba(255,255,255,0.08);margin:4px 0}
    .mxos-user-menu-service{padding:8px 12px;font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:6px}
    .mxos-user-menu-service .dot{width:6px;height:6px;border-radius:50%;background:#ef4444}
    .mxos-user-menu-service.available .dot{background:#10b981}
    `;
    document.head.appendChild(style);
}

function toggleUserMenu() {
    const widget = document.getElementById('mxos-taskbar-user');
    if (!widget) return;
    const menu = widget.querySelector('#mxos-user-menu');
    if (!menu) return;
    renderUserMenu(menu);
    menu.classList.toggle('show');
}

function renderUserMenu(menu) {
    const u = state.user;
    if (u.isLoggedIn) {
        menu.innerHTML = `
            <div class="mxos-user-menu-header">
                <div class="avatar">${getAvatarHtml(36)}</div>
                <div class="info">
                    <div class="name">${escapeHtml(u.name || '用户')}</div>
                    <div class="desc">已登录</div>
                </div>
            </div>
            <div class="mxos-user-menu-item" data-action="account">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#icon-user"/></svg>
                <span>账户中心 / 编辑资料</span>
            </div>
            <div class="mxos-user-menu-item" data-action="sync">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
                <span>立即同步</span>
            </div>
            <div class="mxos-user-menu-divider"></div>
            <div class="mxos-user-menu-item" data-action="switch">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                <span>切换账号</span>
            </div>
            <div class="mxos-user-menu-item danger" data-action="logout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
                <span>退出登录</span>
            </div>
            <div class="mxos-user-menu-service ${serviceAvailable ? 'available' : ''}">
                <span class="dot"></span>
                <span>${serviceAvailable ? '认证服务在线' : '认证服务不可用'}</span>
            </div>
        `;
    } else {
        menu.innerHTML = `
            <div class="mxos-user-menu-header">
                <div class="avatar">${getAvatarHtml(36)}</div>
                <div class="info">
                    <div class="name">未登录</div>
                    <div class="desc">登录以同步数据</div>
                </div>
            </div>
            <div class="mxos-user-menu-item" data-action="login">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
                <span>登录</span>
            </div>
            <div class="mxos-user-menu-item" data-action="register">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>
                <span>注册新账户</span>
            </div>
            <div class="mxos-user-menu-service ${serviceAvailable ? 'available' : ''}">
                <span class="dot"></span>
                <span>${serviceAvailable ? '认证服务在线' : '认证服务不可用'}</span>
            </div>
        `;
    }

    menu.querySelectorAll('.mxos-user-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            menu.classList.remove('show');
            handleMenuAction(action);
        });
    });
}

async function handleMenuAction(action) {
    switch (action) {
        case 'login':
            openAuthModal('login');
            break;
        case 'register':
            openAuthModal('register');
            break;
        case 'logout':
            await logout();
            break;
        case 'switch':
            await logout();
            setTimeout(() => openAuthModal('login'), 300);
            break;
        case 'account':
            if (MXOS.openApp) MXOS.openApp('settings');
            setTimeout(() => {
                const item = document.querySelector('.settings-item[data-page="account"]');
                if (item) item.click();
            }, 300);
            break;
        case 'sync':
            if (MXOS.Cloud && MXOS.Cloud.sync) {
                try { await MXOS.Cloud.sync(); } catch (e) {}
            }
            break;
    }
}

function updateTaskbarUser() {
    const widget = document.getElementById('mxos-taskbar-user');
    if (!widget) return;
    const avatar = widget.querySelector('.mxos-taskbar-user-avatar');
    if (avatar) avatar.innerHTML = getAvatarHtml(22);
    widget.classList.toggle('logged-in', state.user.isLoggedIn);
    widget.setAttribute('aria-label', state.user.isLoggedIn ? `账户：${state.user.name}` : '点击登录');
}

function mountTaskbarUser() {
    const tray = document.querySelector('#taskbar .taskbar-right');
    if (!tray) return;
    let widget = document.getElementById('mxos-taskbar-user');
    if (widget) {
        if (!widget.querySelector('.mxos-taskbar-user-avatar')) {
            widget.innerHTML = `
                <div class="mxos-taskbar-user-avatar"></div>
                <div class="mxos-taskbar-user-menu" id="mxos-user-menu"></div>
            `;
            widget.classList.add('mxos-taskbar-user');
            widget.setAttribute('role', 'button');
            widget.setAttribute('tabindex', '0');
            widget.setAttribute('aria-label', '账户');
            widget.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleUserMenu();
            });
            widget.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleUserMenu();
                }
            });
            const docClickHandler = (e) => {
                if (!widget.contains(e.target)) {
                    const menu = widget.querySelector('#mxos-user-menu');
                    if (menu) menu.classList.remove('show');
                }
            };
            document.addEventListener('click', docClickHandler);
            injectTaskbarUserStyles();
        }
        updateTaskbarUser();
        return;
    }
    widget = createTaskbarUserWidget();
    tray.insertBefore(widget, tray.firstChild);
    updateTaskbarUser();
}

async function init() {
    const cached = loadUserCache();
    if (cached && cached.id) {
        setUser(cached);
    }
    mountTaskbarUser();
    checkServiceAvailable().then(() => {
        updateTaskbarUser();
        if (serviceAvailable && getToken()) getInfo();
    });
}

MXOS.User = {
    login,
    register,
    logout,
    deleteAccount,
    getInfo,
    updateProfile,
    isLoggedIn,
    isServiceAvailable,
    openAuthModal,
    closeAuthModal,
    get state() { return state.user; }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { login, register, logout, deleteAccount, getInfo, updateProfile, isLoggedIn, isServiceAvailable };
export default MXOS.User;
