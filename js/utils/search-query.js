import { vfs } from '../vfs.js';
import { state, appConfigs } from '../state.js';
import { eventBus } from './event-bus.js';

window.MXOS = window.MXOS || {};
window.MXOS.Search = window.MXOS.Search || {};

const DEBOUNCE_MS = 50;
const BYTE_UNITS = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024, tb: 1024 * 1024 * 1024 * 1024 };
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
const DOC_EXTS = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

function wildcardToRegex(pattern) {
    let rx = '';
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === '*') rx += '.*';
        else if (ch === '?') rx += '.';
        else rx += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(rx, 'i');
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startsAt(s, prefix) {
    return s.length >= prefix.length && s.slice(0, prefix.length) === prefix;
}

function parseSizeValue(s) {
    const m = /^([<>]=?)?\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i.exec(String(s).trim());
    if (!m) return null;
    const op = m[1] || '==';
    const num = parseFloat(m[2]);
    const unit = (m[3] || 'b').toLowerCase();
    const bytes = Math.round(num * (BYTE_UNITS[unit] || 1));
    return { op, bytes };
}

function parseDateValue(s) {
    const v = String(s).trim().toLowerCase();
    const now = new Date();
    let start = null;
    let end = null;
    if (v === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 3600 * 1000);
    } else if (v === 'yesterday') {
        const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start = new Date(t.getTime() - 24 * 3600 * 1000);
        end = t;
    } else if (v === 'thisweek') {
        const day = (now.getDay() + 6) % 7;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
    } else if (v === 'thismonth') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (v === 'thisyear') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
    } else {
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
            start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            end = new Date(start.getTime() + 24 * 3600 * 1000);
        }
    }
    return { start, end };
}

function matchSizeFilter(sizeBytes, filter) {
    if (!filter) return true;
    const { op, bytes } = filter;
    if (op === '>') return sizeBytes > bytes;
    if (op === '<') return sizeBytes < bytes;
    if (op === '>=') return sizeBytes >= bytes;
    if (op === '<=') return sizeBytes <= bytes;
    return sizeBytes === bytes;
}

function matchDateFilter(ts, filter) {
    if (!filter || !filter.start) return true;
    const t = ts || 0;
    if (filter.start && t < filter.start.getTime()) return false;
    if (filter.end && t >= filter.end.getTime()) return false;
    return true;
}

function matchTypeFilter(fileName, typeFilter) {
    if (!typeFilter) return true;
    const dot = fileName.lastIndexOf('.');
    const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
    if (typeFilter === 'image') return IMAGE_EXTS.indexOf(ext) >= 0;
    if (typeFilter === 'video') return VIDEO_EXTS.indexOf(ext) >= 0;
    if (typeFilter === 'audio') return AUDIO_EXTS.indexOf(ext) >= 0;
    if (typeFilter === 'doc' || typeFilter === 'document') return DOC_EXTS.indexOf(ext) >= 0;
    if (typeFilter === 'folder') return false;
    return ext === typeFilter.toLowerCase();
}

function buildPath(filesById) {
    const cache = new Map();
    function pathOf(file) {
        if (cache.has(file.id)) return cache.get(file.id);
        const parts = [file.name];
        let cur = file;
        let guard = 0;
        while (cur.parentId != null && guard++ < 64) {
            const parent = filesById.get(cur.parentId);
            if (!parent) break;
            parts.unshift(parent.name);
            cur = parent;
        }
        const p = '/' + parts.join('/').replace(/^\/+/, '');
        cache.set(file.id, p);
        return p;
    }
    return pathOf;
}

function matchInFilter(filePath, inFilter) {
    if (!inFilter) return true;
    let p = inFilter;
    if (!p.startsWith('/')) p = '/' + p;
    p = p.replace(/\/+$/, '');
    if (p === '/') return true;
    const fp = filePath.startsWith('/') ? filePath : ('/' + filePath);
    return fp === p || fp.startsWith(p + '/');
}

function tokenize(query) {
    const tokens = [];
    let i = 0;
    const s = String(query || '');
    while (i < s.length) {
        const ch = s[i];
        if (ch === ' ' || ch === '\t') { i++; continue; }
        if (ch === '"') {
            let j = i + 1;
            let buf = '';
            while (j < s.length && s[j] !== '"') { buf += s[j]; j++; }
            tokens.push({ type: 'phrase', value: buf });
            i = j + 1;
            continue;
        }
        if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
        if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
        let buf = '';
        while (i < s.length && s[i] !== ' ' && s[i] !== '\t' && s[i] !== '"' && s[i] !== '(' && s[i] !== ')') {
            buf += s[i];
            i++;
        }
        const lower = buf.toLowerCase();
        if (lower === 'or' || lower === '||' || lower === '|') {
            tokens.push({ type: 'or' });
        } else if (lower === 'and' || lower === '&&' || lower === '&') {
            tokens.push({ type: 'and' });
        } else if (lower === 'not' || lower === '-' || lower === '!') {
            tokens.push({ type: 'not' });
        } else {
            tokens.push({ type: 'term', value: buf });
        }
    }
    return tokens;
}

function parseTerm(term) {
    const t = String(term || '');
    const colon = t.indexOf(':');
    if (colon < 0) {
        return { kind: 'keyword', value: t };
    }
    const key = t.slice(0, colon).toLowerCase();
    const value = t.slice(colon + 1);
    if (key === 'modified' || key === 'date' || key === 'mtime' || key === 'created' || key === 'ctime') {
        return { kind: 'filter', filter: { type: 'modified', value: parseDateValue(value) }, field: key };
    }
    if (key === 'size') {
        return { kind: 'filter', filter: { type: 'size', value: parseSizeValue(value) } };
    }
    if (key === 'type') {
        return { kind: 'filter', filter: { type: 'type', value: String(value).toLowerCase() } };
    }
    if (key === 'in' || key === 'path') {
        return { kind: 'filter', filter: { type: 'in', value: String(value) } };
    }
    if (key === 'ext') {
        return { kind: 'filter', filter: { type: 'type', value: String(value).toLowerCase() } };
    }
    return { kind: 'keyword', value: t };
}

function parseTokens(tokens) {
    let idx = 0;

    function peek() { return tokens[idx]; }
    function next() { return tokens[idx++]; }

    function parseFactor() {
        const tok = peek();
        if (!tok) return null;
        if (tok.type === 'lparen') {
            next();
            const node = parseOr();
            const rp = peek();
            if (rp && rp.type === 'rparen') next();
            return node;
        }
        if (tok.type === 'not') {
            next();
            return { op: 'not', child: parseFactor() };
        }
        if (tok.type === 'term') {
            next();
            return { op: 'term', term: parseTerm(tok.value) };
        }
        if (tok.type === 'phrase') {
            next();
            return { op: 'phrase', value: tok.value };
        }
        next();
        return null;
    }

    function parseAnd() {
        let left = parseFactor();
        while (true) {
            const tok = peek();
            if (!tok) break;
            if (tok.type === 'and') {
                next();
                const right = parseFactor();
                if (right) left = { op: 'and', left, right };
                continue;
            }
            if (tok.type === 'term' || tok.type === 'phrase' || tok.type === 'lparen' || tok.type === 'not') {
                const right = parseFactor();
                if (right) left = { op: 'and', left, right };
                continue;
            }
            break;
        }
        return left;
    }

    function parseOr() {
        let left = parseAnd();
        while (true) {
            const tok = peek();
            if (!tok) break;
            if (tok.type === 'or') {
                next();
                const right = parseAnd();
                if (right) left = { op: 'or', left, right };
                continue;
            }
            break;
        }
        return left;
    }

    const ast = parseOr();
    return ast;
}

function parse(query) {
    const q = String(query || '').trim();
    if (!q) {
        return { query: q, ast: null, keywords: [], phrases: [], filters: { modified: null, size: null, type: null, in: null }, wildcards: [], isEmpty: true };
    }
    const tokens = tokenize(q);
    const ast = parseTokens(tokens);
    const keywords = [];
    const phrases = [];
    const wildcards = [];
    const filters = { modified: null, size: null, type: null, in: null, created: null };

    function walk(node) {
        if (!node) return;
        if (node.op === 'term') {
            const t = node.term;
            if (t.kind === 'keyword') {
                const v = t.value;
                if (v.indexOf('*') >= 0 || v.indexOf('?') >= 0) {
                    wildcards.push(v);
                } else {
                    keywords.push(v);
                }
            } else if (t.kind === 'filter') {
                const f = t.filter;
                if (f.type === 'modified') filters.modified = f.value;
                else if (f.type === 'size') filters.size = f.value;
                else if (f.type === 'type') filters.type = f.value;
                else if (f.type === 'in') filters.in = f.value;
            }
        } else if (node.op === 'phrase') {
            phrases.push(node.value);
        } else if (node.op === 'and' || node.op === 'or') {
            walk(node.left);
            walk(node.right);
        } else if (node.op === 'not') {
            walk(node.child);
        }
    }
    walk(ast);

    return {
        query: q,
        ast,
        keywords,
        phrases,
        filters,
        wildcards,
        isEmpty: keywords.length === 0 && phrases.length === 0 && wildcards.length === 0
    };
}

function collectApps() {
    const list = [];
    Object.keys(appConfigs).forEach(id => {
        const cfg = appConfigs[id];
        if (cfg && cfg.title) {
            list.push({ kind: 'app', id, title: cfg.title, icon: cfg.icon, keywords: cfg.title });
        }
    });
    (state.installedApps || []).forEach(app => {
        list.push({ kind: 'app', id: app.id, title: app.name, icon: app.icon, keywords: app.name, thirdparty: true });
    });
    return list;
}

function matchKeyword(text, keyword) {
    if (!keyword) return true;
    return String(text || '').toLowerCase().indexOf(String(keyword).toLowerCase()) >= 0;
}

function matchPhrase(text, phrase) {
    if (!phrase) return true;
    return String(text || '').toLowerCase().indexOf(String(phrase).toLowerCase()) >= 0;
}

function matchWildcard(text, pattern) {
    if (!pattern) return true;
    return wildcardToRegex(pattern).test(String(text || ''));
}

async function collectVfs() {
    try {
        await vfs.ensureInitialized();
        const all = await vfs.getAll();
        const filesById = new Map();
        all.forEach(f => filesById.set(f.id, f));
        const pathOf = buildPath(filesById);
        const items = [];
        for (const f of all) {
            if (f.inTrash) continue;
            const content = f.content || '';
            items.push({
                kind: 'file',
                id: f.id,
                name: f.name,
                path: pathOf(f),
                content,
                size: typeof f.size === 'number' ? f.size : (content ? content.length : 0),
                type: f.type || 'file',
                createdAt: f.createdAt ? new Date(f.createdAt).getTime() : null,
                modifiedAt: f.modifiedAt ? new Date(f.modifiedAt).getTime() : (f.createdAt ? new Date(f.createdAt).getTime() : null)
            });
        }
        return items;
    } catch (e) {
        return [];
    }
}

function evaluate(node, ctx) {
    if (!node) return true;
    if (node.op === 'and') return evaluate(node.left, ctx) && evaluate(node.right, ctx);
    if (node.op === 'or') return evaluate(node.left, ctx) || evaluate(node.right, ctx);
    if (node.op === 'not') return !evaluate(node.child, ctx);
    if (node.op === 'phrase') return matchPhrase(ctx.text, node.value);
    if (node.op === 'term') {
        const t = node.term;
        if (t.kind === 'keyword') {
            const v = t.value;
            if (v.indexOf('*') >= 0 || v.indexOf('?') >= 0) {
                return matchWildcard(ctx.text, v);
            }
            return matchKeyword(ctx.text, v);
        }
        if (t.kind === 'filter') {
            const f = t.filter;
            if (f.type === 'modified') return matchDateFilter(ctx.modifiedAt, f.value);
            if (f.type === 'size') return matchSizeFilter(ctx.size, f.value);
            if (f.type === 'type') return matchTypeFilter(ctx.name, f.value);
            if (f.type === 'in') return matchInFilter(ctx.path, f.value);
        }
    }
    return true;
}

function scoreResult(item, parsed) {
    let score = 0;
    const text = (item.kind === 'app' ? item.title : item.name) + ' ' + (item.path || '');
    parsed.keywords.forEach(k => {
        if (matchKeyword(item.name || item.title, k)) score += 10;
        else if (matchKeyword(text, k)) score += 5;
    });
    parsed.phrases.forEach(p => {
        if (matchPhrase(item.name || item.title, p)) score += 12;
        else if (matchPhrase(text, p)) score += 6;
    });
    parsed.wildcards.forEach(w => {
        if (matchWildcard(item.name || item.title, w)) score += 8;
        else if (matchWildcard(text, w)) score += 4;
    });
    if (item.kind === 'app') score += 2;
    return score;
}

async function execute(query, options) {
    const opts = options || {};
    const parsed = typeof query === 'string' ? parse(query) : query;
    if (parsed.isEmpty && !parsed.filters.modified && !parsed.filters.size && !parsed.filters.type && !parsed.filters.in) {
        return { results: [], parsed, total: 0 };
    }
    const results = [];

    const apps = collectApps();
    for (const app of apps) {
        const ctx = { text: app.title + ' ' + (app.keywords || ''), name: app.title, path: '', size: 0, modifiedAt: null };
        if (evaluate(parsed.ast, ctx)) {
            results.push({ kind: 'app', id: app.id, title: app.title, icon: app.icon, thirdparty: !!app.thirdparty, score: scoreResult(app, parsed) });
        }
    }

    if (opts.scanFiles !== false) {
        const files = await collectVfs();
        for (const f of files) {
            const ctx = {
                text: f.name + ' ' + (f.path || '') + ' ' + (f.content || ''),
                name: f.name,
                path: f.path,
                size: f.size,
                modifiedAt: f.modifiedAt
            };
            if (evaluate(parsed.ast, ctx)) {
                results.push({ kind: 'file', id: f.id, name: f.name, path: f.path, size: f.size, modifiedAt: f.modifiedAt, type: f.type, score: scoreResult(f, parsed) });
            }
        }
    }

    results.sort((a, b) => b.score - a.score);
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 200;
    if (results.length > limit) results.length = limit;
    return { results, parsed, total: results.length };
}

let searchInputBound = null;
function attachToInput(inputEl, options) {
    if (!inputEl || !inputEl.addEventListener) return null;
    const opts = options || {};
    let timer = null;
    let lastQuery = null;
    const handler = () => {
        const v = inputEl.value;
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
            timer = null;
            if (v === lastQuery) return;
            lastQuery = v;
            const parsed = parse(v);
            let res = null;
            if (parsed.isEmpty && !parsed.filters.modified && !parsed.filters.size && !parsed.filters.type && !parsed.filters.in) {
                res = { results: [], parsed, total: 0 };
            } else {
                try { res = await execute(parsed, { limit: opts.limit || 50 }); }
                catch (e) { res = { results: [], parsed, total: 0, error: String(e && e.message || e) }; }
            }
            eventBus.emit('search:instant', { query: v, results: res.results, parsed: res.parsed, source: inputEl });
            if (typeof opts.onResults === 'function') {
                try { opts.onResults(res.results, parsed, v); } catch (e) {}
            }
        }, DEBOUNCE_MS);
    };
    inputEl.addEventListener('input', handler);
    searchInputBound = inputEl;
    return () => {
        if (timer) clearTimeout(timer);
        inputEl.removeEventListener('input', handler);
        if (searchInputBound === inputEl) searchInputBound = null;
    };
}

function bindStartMenuSearch() {
    const input = document.querySelector('.start-search');
    if (!input) return null;
    if (input.dataset.mxosSearchBound === '1') return null;
    input.dataset.mxosSearchBound = '1';
    let panel = null;
    const ensurePanel = () => {
        if (panel && document.body.contains(panel)) return panel;
        panel = document.createElement('div');
        panel.className = 'mxos-search-results';
        panel.setAttribute('role', 'listbox');
        Object.assign(panel.style, {
            position: 'absolute',
            top: '50px',
            left: '16px',
            right: '16px',
            maxHeight: '320px',
            overflowY: 'auto',
            background: 'var(--glass-bg, rgba(20,25,35,0.92))',
            border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
            borderRadius: '10px',
            padding: '6px',
            zIndex: '1100',
            display: 'none',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(12px) saturate(180%)',
            webkitBackdropFilter: 'blur(12px) saturate(180%)'
        });
        const startMenu = document.getElementById('startMenu');
        if (startMenu) startMenu.appendChild(panel);
        else document.body.appendChild(panel);
        return panel;
    };
    const detach = attachToInput(input, {
        limit: 30,
        onResults: (results, parsed, q) => {
            const p = ensurePanel();
            if (!q || results.length === 0) {
                p.style.display = 'none';
                p.innerHTML = '';
                return;
            }
            p.style.display = 'block';
            p.innerHTML = results.map(r => {
                if (r.kind === 'app') {
                    return `<div class="mxos-search-item" data-kind="app" data-id="${escapeAttr(r.id)}" role="option" tabindex="0" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer">
                        <svg width="24" height="24" viewBox="0 0 40 40"><use href="#svg-${escapeAttr(r.icon || 'app-default')}"/></svg>
                        <div style="flex:1;min-width:0">
                            <div style="font-size:13px;color:var(--text-color,#fff);font-weight:500">${escapeHtml(r.title)}</div>
                            <div style="font-size:11px;color:var(--text-secondary,#9ca3af)">应用</div>
                        </div>
                    </div>`;
                }
                const sizeLabel = r.size != null ? formatBytes(r.size) : '';
                return `<div class="mxos-search-item" data-kind="file" data-id="${escapeAttr(r.id)}" role="option" tabindex="0" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <div style="flex:1;min-width:0">
                        <div style="font-size:13px;color:var(--text-color,#fff);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.name)}</div>
                        <div style="font-size:11px;color:var(--text-secondary,#9ca3af);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.path || '')}${sizeLabel ? ' · ' + sizeLabel : ''}</div>
                    </div>
                </div>`;
            }).join('');
            p.querySelectorAll('.mxos-search-item').forEach(el => {
                el.addEventListener('mouseenter', () => {
                    p.querySelectorAll('.mxos-search-item').forEach(x => x.style.background = '');
                    el.style.background = 'var(--hover-bg, rgba(255,255,255,0.08))';
                });
                el.addEventListener('click', () => {
                    const kind = el.dataset.kind;
                    const id = el.dataset.id;
                    if (kind === 'app') {
                        if (window.MXOS && typeof window.MXOS.openApp === 'function') {
                            window.MXOS.openApp(id);
                        }
                    } else {
                        eventBus.emit('search:open-file', { id });
                        if (window.MXOS && typeof window.MXOS.notify === 'function') {
                            window.MXOS.notify({ title: '已选中文件', body: id, type: 'info', duration: 2000 });
                        }
                    }
                    p.style.display = 'none';
                    const startMenu = document.getElementById('startMenu');
                    if (startMenu) window.MXOS.closeStartMenu();
                });
            });
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (panel) { panel.style.display = 'none'; }
        }, 200);
    });
    input.addEventListener('focus', () => {
        if (input.value && panel && panel.children.length > 0) panel.style.display = 'block';
    });

    return detach;
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function formatBytes(b) {
    if (!b || b < 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return (b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

const Search = {
    parse,
    execute,
    attachToInput,
    bindStartMenuSearch,
    DEBOUNCE_MS
};

window.MXOS.Search = Search;

window.addEventListener('mxos:desktop-ready', () => {
    setTimeout(bindStartMenuSearch, 200);
});

export { parse, execute, attachToInput, bindStartMenuSearch };
export default Search;

