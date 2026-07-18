import { eventBus } from './event-bus.js';

const STYLE_ID = 'mxos-dialog-style';
let styleInjected = false;

function injectStyle() {
    if (styleInjected) return;
    if (document.getElementById(STYLE_ID)) { styleInjected = true; return; }
    const css = `
.mxos-dialog-overlay {
    position: fixed; inset: 0; z-index: 100000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0); backdrop-filter: blur(0px);
    -webkit-backdrop-filter: blur(0px);
    transition: background-color 0.2s ease, backdrop-filter 0.2s ease, -webkit-backdrop-filter 0.2s ease;
}
.mxos-dialog-overlay.show {
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(6px) saturate(180%);
    -webkit-backdrop-filter: blur(6px) saturate(180%);
}
.mxos-dialog {
    min-width: 340px; max-width: 90vw; max-height: 85vh;
    background: var(--glass-bg, rgba(20, 25, 35, 0.55));
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    color: var(--text-color, #fff);
    overflow: hidden;
    display: flex; flex-direction: column;
    opacity: 0; transform: scale(0.9);
    transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mxos-dialog-overlay.show .mxos-dialog { opacity: 1; transform: scale(1); }
.mxos-dialog-header {
    display: flex; align-items: center; gap: 10px;
    padding: 16px 20px 8px;
    font-size: 15px; font-weight: 600;
}
.mxos-dialog-icon {
    width: 20px; height: 20px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
}
.mxos-dialog-body {
    padding: 4px 20px 18px;
    font-size: 14px; line-height: 1.55;
    color: var(--text-color, #fff); opacity: 0.92;
    word-break: break-word; white-space: pre-wrap;
}
.mxos-dialog-input {
    width: 100%; margin-top: 10px;
    padding: 9px 12px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: var(--text-color, #fff); font-size: 14px;
    outline: none; transition: border-color 0.15s ease;
    box-sizing: border-box;
}
.mxos-dialog-input:focus { border-color: var(--accent-color, #60a5fa); }
.mxos-dialog-actions {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 8px 16px 16px;
}
.mxos-dialog-btn {
    min-width: 84px; padding: 8px 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px; cursor: pointer;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-color, #fff); font-size: 13px; font-weight: 500;
    transition: background 0.15s ease, transform 0.1s ease;
}
.mxos-dialog-btn:hover { background: rgba(255, 255, 255, 0.12); }
.mxos-dialog-btn:active { transform: scale(0.97); }
.mxos-dialog-btn.primary {
    background: var(--accent-color, #60a5fa);
    border-color: transparent; color: #fff;
}
.mxos-dialog-btn.primary:hover { filter: brightness(1.1); }
.mxos-toast-wrap {
    position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
    z-index: 100001; display: flex; flex-direction: column; gap: 8px;
    pointer-events: none;
}
.mxos-toast {
    padding: 10px 18px; border-radius: 10px;
    background: var(--glass-bg, rgba(20, 25, 35, 0.7));
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    color: var(--text-color, #fff); font-size: 13px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    opacity: 0; transform: translateY(-12px);
    transition: opacity 0.22s ease, transform 0.22s ease;
    pointer-events: auto;
}
.mxos-toast.show { opacity: 1; transform: translateY(0); }
.mxos-toast.success { border-left: 3px solid #10b981; }
.mxos-toast.error { border-left: 3px solid #ef4444; }
.mxos-toast.warning { border-left: 3px solid #fbbf24; }
.mxos-toast.info { border-left: 3px solid #60a5fa; }
`;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
    styleInjected = true;
}

const ICONS = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M12 3L22 20H2L12 3z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/></svg>',
    question: '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4"/><path d="M12 17.5h.01"/></svg>'
};

function getToastWrap() {
    let wrap = document.querySelector('.mxos-toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'mxos-toast-wrap';
        document.body.appendChild(wrap);
    }
    return wrap;
}

function showToast(message, type = 'info', duration = 2500) {
    injectStyle();
    const wrap = getToastWrap();
    const toast = document.createElement('div');
    toast.className = 'mxos-toast ' + (type || 'info');
    toast.textContent = String(message == null ? '' : message);
    wrap.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 240);
    }, duration);
    eventBus.emit('dialog:toast', { message, type });
}

function buildDialog({ title, message, icon, inputConfig, buttons }) {
    injectStyle();
    const overlay = document.createElement('div');
    overlay.className = 'mxos-dialog-overlay';
    const dlg = document.createElement('div');
    dlg.className = 'mxos-dialog';
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-modal', 'true');

    const headerHtml = (title || icon) ? `
        <div class="mxos-dialog-header">
            ${icon ? `<span class="mxos-dialog-icon">${icon}</span>` : ''}
            <span>${escapeHtml(title || '')}</span>
        </div>` : '';
    let bodyHtml = '';
    if (message != null && message !== '') {
        bodyHtml += `<div class="mxos-dialog-body">${escapeHtml(String(message))}</div>`;
    } else {
        bodyHtml += `<div class="mxos-dialog-body" style="padding-bottom:8px"></div>`;
    }
    let inputHtml = '';
    if (inputConfig) {
        inputHtml = `<input class="mxos-dialog-input" type="${inputConfig.type || 'text'}" 
            placeholder="${escapeHtml(inputConfig.placeholder || '')}" 
            value="${escapeHtml(inputConfig.value != null ? inputConfig.value : '')}">`;
    }
    const actionsHtml = '<div class="mxos-dialog-actions">' +
        buttons.map((b, i) => `<button class="mxos-dialog-btn ${b.primary ? 'primary' : ''}" data-idx="${i}">${escapeHtml(b.label)}</button>`).join('') +
        '</div>';

    dlg.innerHTML = headerHtml + bodyHtml + inputHtml + actionsHtml;
    overlay.appendChild(dlg);
    return { overlay, dlg };
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function openDialog({ title, message, icon, inputConfig, buttons, defaultIdx, cancelIdx, closeOnOverlay = true }) {
    return new Promise((resolve) => {
        const { overlay, dlg } = buildDialog({ title, message, icon, inputConfig, buttons });
        document.body.appendChild(overlay);
        const inputEl = dlg.querySelector('.mxos-dialog-input');

        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 220);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                const cancelBtn = cancelIdx != null ? buttons[cancelIdx] : null;
                finish(cancelBtn ? cancelBtn.value : null);
            } else if (e.key === 'Enter' && inputEl) {
                e.preventDefault();
                const defBtn = defaultIdx != null ? buttons[defaultIdx] : null;
                finish(defBtn ? defBtn.value : inputEl.value);
            }
        };

        dlg.querySelectorAll('.mxos-dialog-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const b = buttons[idx];
                if (b && b.resolveInput && inputEl) {
                    finish(inputEl.value);
                } else {
                    finish(b ? b.value : null);
                }
            });
        });

        if (closeOnOverlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const cancelBtn = cancelIdx != null ? buttons[cancelIdx] : null;
                    finish(cancelBtn ? cancelBtn.value : null);
                }
            });
        }

        document.addEventListener('keydown', onKey);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            overlay.classList.add('show');
            if (inputEl) { inputEl.focus(); inputEl.select(); }
        }));
    });
}

function alert(title, message) {
    return openDialog({
        title,
        message,
        icon: ICONS.info,
        buttons: [
            { label: '确定', value: true, primary: true }
        ],
        defaultIdx: 0,
        cancelIdx: 0
    }).then(() => undefined);
}

function confirm(title, message) {
    return openDialog({
        title,
        message,
        icon: ICONS.question,
        buttons: [
            { label: '取消', value: false },
            { label: '确定', value: true, primary: true }
        ],
        defaultIdx: 1,
        cancelIdx: 0
    }).then(r => r === true);
}

function prompt(title, defaultValue = '') {
    return openDialog({
        title,
        icon: ICONS.info,
        inputConfig: { type: 'text', value: defaultValue },
        buttons: [
            { label: '取消', value: null },
            { label: '确定', value: true, primary: true, resolveInput: true }
        ],
        defaultIdx: 1,
        cancelIdx: 0
    }).then(r => (r === null ? null : (typeof r === 'string' ? r : (r ? '' : null))));
}

const dialog = { alert, confirm, prompt, toast: showToast };

export { alert, confirm, prompt, showToast, dialog };
export default dialog;
