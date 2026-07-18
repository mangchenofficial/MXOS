import { registerAppRenderer } from '../core.js';

window.MXOS = window.MXOS || {};

const HISTORY_KEY = 'mxos_calculator_history';

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function saveHistory(list) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
}

const ICONS = {
    backspace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H8L3 12l5 7h13a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>',
    sci: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19A4 4 0 0 1 8 5"/><path d="M20 19A4 4 0 0 0 16 5"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

function fmt(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    if (!isFinite(num)) return 'Error';
    const s = String(num);
    if (s.length > 14 && s.includes('.')) {
        return parseFloat(num.toPrecision(12)).toString();
    }
    return s;
}

function safeEval(expr) {
    expr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'Math.PI').replace(/(?<![a-zA-Z])e(?![a-zA-Z])/g, 'Math.E');
    expr = expr.replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(');
    expr = expr.replace(/log\(/g, 'Math.log10(').replace(/ln\(/g, 'Math.log(');
    expr = expr.replace(/√\(/g, 'Math.sqrt(').replace(/\^/g, '**');
    if (!/^[-+*/().,\d\sMath.*PIEcosintaqlr]+$/.test(expr)) throw new Error('invalid');
    return Function('"use strict";return (' + expr + ')')();
}

registerAppRenderer('calculator', (contentEl) => {
    let expr = '';
    let result = '0';
    let sciMode = false;
    let historyOpen = false;
    let history = loadHistory();
    let justEvaluated = false;

    const root = document.createElement('div');
    root.className = 'calc-app';
    root.innerHTML = `
        <style>
            .calc-app{display:flex;height:100%;font-family:'MiSans',sans-serif;color:#fff;position:relative;overflow:hidden}
            .calc-main{flex:1;display:flex;flex-direction:column;transition:margin .25s ease}
            .calc-toolbar{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.08)}
            .calc-tool-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;cursor:pointer;font-size:12px;backdrop-filter:blur(8px)}
            .calc-tool-btn:hover{background:rgba(255,255,255,.18)}
            .calc-tool-btn.active{background:var(--accent-color,#3b82f6);border-color:transparent}
            .calc-display{padding:16px 20px;text-align:right;background:rgba(0,0,0,.25);border-bottom:1px solid rgba(255,255,255,.06)}
            .calc-expr{font-size:14px;color:rgba(255,255,255,.55);min-height:20px;word-break:break-all}
            .calc-result{font-size:42px;font-weight:300;line-height:1.2;word-break:break-all}
            .calc-pad{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:12px}
            .calc-pad.sci{grid-template-columns:repeat(5,1fr)}
            .calc-btn{display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:18px;cursor:pointer;user-select:none;backdrop-filter:blur(10px);transition:transform .08s ease,background .15s ease}
            .calc-btn:hover{background:rgba(255,255,255,.16)}
            .calc-btn:active{transform:scale(.94)}
            .calc-btn.op{background:rgba(59,130,246,.28);color:#93c5fd}
            .calc-btn.op:hover{background:rgba(59,130,246,.45)}
            .calc-btn.fn{background:rgba(148,163,184,.18);color:#cbd5e1}
            .calc-btn.fn:hover{background:rgba(148,163,184,.3)}
            .calc-btn.eq{background:var(--accent-color,#3b82f6);color:#fff;grid-column:span 1}
            .calc-btn.eq:hover{filter:brightness(1.1)}
            .calc-btn svg{width:20px;height:20px}
            .calc-btn.span2{grid-column:span 2}
            .calc-history{position:absolute;top:0;right:0;bottom:0;width:240px;background:rgba(15,23,42,.92);border-left:1px solid rgba(255,255,255,.1);transform:translateX(100%);transition:transform .25s ease;display:flex;flex-direction:column;backdrop-filter:blur(20px);z-index:5}
            .calc-history.open{transform:translateX(0)}
            .calc-history-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;color:#cbd5e1}
            .calc-history-list{flex:1;overflow-y:auto;padding:8px}
            .calc-history-item{padding:8px 10px;border-radius:6px;font-size:12px;cursor:pointer;margin-bottom:4px}
            .calc-history-item:hover{background:rgba(255,255,255,.08)}
            .calc-h-expr{color:rgba(255,255,255,.5);word-break:break-all}
            .calc-h-res{color:#93c5fd;font-size:14px;word-break:break-all}
            .calc-empty{color:rgba(255,255,255,.3);text-align:center;padding:24px 8px;font-size:12px}
        </style>
        <div class="calc-main">
            <div class="calc-toolbar">
                <div class="calc-tool-btn" id="calcSci"><span style="display:inline-flex">${ICONS.sci}</span><span>科学</span></div>
                <div class="calc-tool-btn" id="calcHist"><span style="display:inline-flex">${ICONS.history}</span><span>历史</span></div>
            </div>
            <div class="calc-display">
                <div class="calc-expr" id="calcExpr"></div>
                <div class="calc-result" id="calcResult">0</div>
            </div>
            <div class="calc-pad" id="calcPad"></div>
        </div>
        <div class="calc-history" id="calcHistoryPanel">
            <div class="calc-history-head">
                <span>历史记录</span>
                <span class="calc-tool-btn" id="calcClearHist" style="padding:4px">${ICONS.trash}</span>
            </div>
            <div class="calc-history-list" id="calcHistoryList"></div>
        </div>
    `;
    contentEl.appendChild(root);

    const pad = root.querySelector('#calcPad');
    const exprEl = root.querySelector('#calcExpr');
    const resultEl = root.querySelector('#calcResult');
    const histPanel = root.querySelector('#calcHistoryPanel');
    const histList = root.querySelector('#calcHistoryList');

    function render() {
        exprEl.textContent = expr || '';
        resultEl.textContent = result;
        pad.classList.toggle('sci', sciMode);
        root.querySelector('#calcSci').classList.toggle('active', sciMode);
        renderButtons();
        renderHistory();
    }

    function renderButtons() {
        const std = [
            { l: 'AC', cls: 'fn', a: () => { expr=''; result='0'; justEvaluated=false; } },
            { l: ICONS.backspace, cls: 'fn', a: () => backspace() },
            { l: '+/−', cls: 'fn', a: () => toggleSign() },
            { l: '÷', cls: 'op', a: () => append('÷') },
            { l: '7', a: () => append('7') },
            { l: '8', a: () => append('8') },
            { l: '9', a: () => append('9') },
            { l: '×', cls: 'op', a: () => append('×') },
            { l: '4', a: () => append('4') },
            { l: '5', a: () => append('5') },
            { l: '6', a: () => append('6') },
            { l: '−', cls: 'op', a: () => append('−') },
            { l: '1', a: () => append('1') },
            { l: '2', a: () => append('2') },
            { l: '3', a: () => append('3') },
            { l: '+', cls: 'op', a: () => append('+') },
            { l: '%', cls: 'fn', a: () => append('%') },
            { l: '0', a: () => append('0') },
            { l: '.', a: () => append('.') },
            { l: '=', cls: 'eq', a: () => evaluate() }
        ];

        const sciExtra = [
            { l: 'sin', cls: 'fn', a: () => appendFunc('sin(') },
            { l: 'cos', cls: 'fn', a: () => appendFunc('cos(') },
            { l: 'tan', cls: 'fn', a: () => appendFunc('tan(') },
            { l: 'log', cls: 'fn', a: () => appendFunc('log(') },
            { l: 'ln', cls: 'fn', a: () => appendFunc('ln(') },
            { l: 'π', cls: 'fn', a: () => append('π') },
            { l: 'e', cls: 'fn', a: () => append('e') },
            { l: 'x^y', cls: 'fn', a: () => append('^') },
            { l: '√', cls: 'fn', a: () => appendFunc('√(') },
            { l: '(', cls: 'fn', a: () => append('(') },
            { l: ')', cls: 'fn', a: () => append(')') }
        ];

        let btns = [];
        if (sciMode) {
            btns.push(...sciExtra);
            btns.push(...std);
        } else {
            btns.push(...std);
        }

        pad.innerHTML = '';
        btns.forEach(b => {
            const el = document.createElement('div');
            el.className = 'calc-btn ' + (b.cls || '');
            el.innerHTML = b.l;
            el.addEventListener('click', () => { b.a(); render(); });
            pad.appendChild(el);
        });
    }

    function append(ch) {
        if (justEvaluated && /[0-9.]/.test(ch)) {
            expr = '';
            result = '0';
        }
        justEvaluated = false;
        if (ch === '.' && /\.\d*$/.test(expr.split(/[+\-×÷^%]/).pop())) return;
        expr += ch;
        updatePreview();
    }

    function appendFunc(f) {
        justEvaluated = false;
        expr += f;
        updatePreview();
    }

    function updatePreview() {
        try {
            if (expr.trim()) {
                const v = safeEval(expr);
                if (isFinite(v)) result = fmt(v);
            } else {
                result = '0';
            }
        } catch (e) {}
    }

    function backspace() {
        justEvaluated = false;
        const m = expr.match(/(sin\(|cos\(|tan\(|log\(|ln\(|√\()$/);
        if (m) {
            expr = expr.slice(0, -m[1].length);
        } else {
            expr = expr.slice(0, -1);
        }
        updatePreview();
        render();
    }

    function toggleSign() {
        if (!expr) return;
        try {
            const v = safeEval(expr);
            if (isFinite(v)) {
                expr = fmt(-v);
                updatePreview();
            }
        } catch (e) {}
    }

    function evaluate() {
        if (!expr.trim()) return;
        try {
            const v = safeEval(expr);
            if (!isFinite(v) || isNaN(v)) { result = 'Error'; return; }
            const entry = { expr: expr, result: fmt(v), ts: Date.now() };
            history.unshift(entry);
            saveHistory(history);
            result = fmt(v);
            expr = String(result);
            justEvaluated = true;
            renderHistory();
        } catch (e) {
            result = 'Error';
        }
    }

    function renderHistory() {
        if (!history.length) {
            histList.innerHTML = '<div class="calc-empty">暂无历史记录</div>';
            return;
        }
        histList.innerHTML = history.map((h, i) => `
            <div class="calc-history-item" data-i="${i}">
                <div class="calc-h-expr">${h.expr.replace(/</g,'&lt;')} =</div>
                <div class="calc-h-res">${h.result.replace(/</g,'&lt;')}</div>
            </div>
        `).join('');
        histList.querySelectorAll('.calc-history-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.i);
                expr = history[idx].result;
                updatePreview();
                render();
            });
        });
    }

    root.querySelector('#calcSci').addEventListener('click', () => { sciMode = !sciMode; render(); });
    root.querySelector('#calcHist').addEventListener('click', () => { historyOpen = !historyOpen; histPanel.classList.toggle('open', historyOpen); });
    root.querySelector('#calcClearHist').addEventListener('click', () => { history = []; saveHistory(history); renderHistory(); });

    function handleKey(e) {
        const k = e.key;
        if (k >= '0' && k <= '9') { append(k); }
        else if (k === '.') { append('.'); }
        else if (k === '+') { append('+'); }
        else if (k === '-') { append('−'); }
        else if (k === '*') { append('×'); }
        else if (k === '/') { e.preventDefault(); append('÷'); }
        else if (k === '%') { append('%'); }
        else if (k === '(' || k === ')') { append(k); }
        else if (k === '^') { append('^'); }
        else if (k === 'Enter' || k === '=') { e.preventDefault(); evaluate(); }
        else if (k === 'Backspace') { backspace(); return; }
        else if (k === 'Escape') { expr=''; result='0'; justEvaluated=false; }
        else { return; }
        render();
    }
    contentEl.tabIndex = 0;
    contentEl.addEventListener('keydown', handleKey);

    render();
    setTimeout(() => contentEl.focus(), 100);
});

window.MXOS.Calculator = {
    evaluate(expr) {
        try { return fmt(safeEval(expr)); } catch (e) { return 'Error'; }
    },
    getHistory() { return loadHistory(); },
    clearHistory() { saveHistory([]); }
};

console.log('[MXOS.Calculator] 计算器应用已加载');
