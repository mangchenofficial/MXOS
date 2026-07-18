window.MXOS = window.MXOS || {};
window.MXOS.IME = window.MXOS.IME || {};

const STORAGE_KEY = 'mxos_text_replace_rules';

const DEFAULT_RULES = [
    { from: ':)', to: '😊' },
    { from: ':(', to: '😢' },
    { from: ':D', to: '😃' },
    { from: ';)', to: '😉' },
    { from: ':P', to: '😛' },
    { from: ':O', to: '😮' },
    { from: '<3', to: '❤️' },
    { from: '</3', to: '💔' },
    { from: ':*', to: '😘' },
    { from: 'xD', to: '😆' },
    { from: ':|', to: '😐' },
    { from: ':/', to: '😕' },
    { from: 'B)', to: '😎' },
    { from: '>_<', to: '😣' },
    { from: '^_^', to: '😄' },
    { from: 'T_T', to: '😭' },
    { from: '-_-', to: '😑' },
    { from: ':sleeping:', to: '😴' },
    { from: ':fire:', to: '🔥' },
    { from: ':thumbsup:', to: '👍' },
    { from: '\\alpha', to: 'α' },
    { from: '\\beta', to: 'β' },
    { from: '\\gamma', to: 'γ' },
    { from: '\\delta', to: 'δ' },
    { from: '\\epsilon', to: 'ε' },
    { from: '\\zeta', to: 'ζ' },
    { from: '\\eta', to: 'η' },
    { from: '\\theta', to: 'θ' },
    { from: '\\iota', to: 'ι' },
    { from: '\\kappa', to: 'κ' },
    { from: '\\lambda', to: 'λ' },
    { from: '\\mu', to: 'μ' },
    { from: '\\nu', to: 'ν' },
    { from: '\\xi', to: 'ξ' },
    { from: '\\pi', to: 'π' },
    { from: '\\rho', to: 'ρ' },
    { from: '\\sigma', to: 'σ' },
    { from: '\\tau', to: 'τ' },
    { from: '\\upsilon', to: 'υ' },
    { from: '\\phi', to: 'φ' },
    { from: '\\chi', to: 'χ' },
    { from: '\\psi', to: 'ψ' },
    { from: '\\omega', to: 'ω' },
    { from: '\\sum', to: '∑' },
    { from: '\\prod', to: '∏' },
    { from: '\\int', to: '∫' },
    { from: '\\infty', to: '∞' },
    { from: '\\nabla', to: '∇' },
    { from: '\\partial', to: '∂' },
    { from: '\\pm', to: '±' },
    { from: '\\times', to: '×' },
    { from: '\\div', to: '÷' }
];

let rules = [];
let listenerBound = false;
let replacing = false;

function loadRules() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            rules = DEFAULT_RULES.slice();
            saveRules();
            return rules;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            rules = parsed;
        } else {
            rules = DEFAULT_RULES.slice();
        }
    } catch (e) {
        rules = DEFAULT_RULES.slice();
    }
    return rules;
}

function saveRules() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {}
}

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortRulesByLengthDesc() {
    rules.sort((a, b) => b.from.length - a.from.length);
}

function onInput(e) {
    if (replacing) return;
    const target = e.target;
    if (!target) return;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) return;
    if (target.dataset && target.dataset.mxosNoReplace === '1') return;

    if (target.isContentEditable) {
        handleContentEditable(target);
    } else {
        handleInputTextarea(target);
    }
}

function handleInputTextarea(target) {
    const value = target.value;
    const caret = target.selectionStart ?? value.length;
    if (caret < 1) return;
    const before = value.slice(0, caret);
    const after = value.slice(caret);

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!rule.from) continue;
        if (before.endsWith(rule.from)) {
            const newValue = before.slice(0, before.length - rule.from.length) + rule.to + after;
            const newCaret = before.length - rule.from.length + rule.to.length;
            try {
                const restore = target.scrollTop;
                target.value = newValue;
                target.selectionStart = newCaret;
                target.selectionEnd = newCaret;
                target.scrollTop = restore;
                replacing = true;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                replacing = false;
                if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
            } catch (err) {}
            return;
        }
    }
}

function handleContentEditable(target) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent;
    const offset = range.startOffset;
    if (offset < 1) return;
    const before = text.slice(0, offset);
    const after = text.slice(offset);

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!rule.from) continue;
        if (before.endsWith(rule.from)) {
            const newBefore = before.slice(0, before.length - rule.from.length);
            const newTextNode = document.createTextNode(newBefore + rule.to + after);
            const parent = node.parentNode;
            if (!parent) return;
            parent.replaceChild(newTextNode, node);
            const newRange = document.createRange();
            const newOffset = newBefore.length + rule.to.length;
            newRange.setStart(newTextNode, newOffset);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            replacing = true;
            target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: rule.to }));
            replacing = false;
            if (window.MXOS?.Sound?.play) window.MXOS.Sound.play('toggle');
            return;
        }
    }
}

function bindListener() {
    if (listenerBound) return;
    listenerBound = true;
    document.addEventListener('input', onInput, true);
}

function addRule(from, to) {
    if (!from || to == null) return false;
    const exists = rules.find(r => r.from === from);
    if (exists) {
        exists.to = String(to);
    } else {
        rules.push({ from: String(from), to: String(to) });
    }
    sortRulesByLengthDesc();
    saveRules();
    return true;
}

function removeRule(from) {
    const idx = rules.findIndex(r => r.from === from);
    if (idx === -1) return false;
    rules.splice(idx, 1);
    saveRules();
    return true;
}

function getRules() {
    return rules.slice();
}

function resetRules() {
    rules = DEFAULT_RULES.slice();
    sortRulesByLengthDesc();
    saveRules();
    return rules.slice();
}

function init() {
    loadRules();
    sortRulesByLengthDesc();
    bindListener();
    window.MXOS.IME.addRule = addRule;
    window.MXOS.IME.removeRule = removeRule;
    window.MXOS.IME.getRules = getRules;
    window.MXOS.IME.resetRules = resetRules;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export { addRule, removeRule, getRules, resetRules };
