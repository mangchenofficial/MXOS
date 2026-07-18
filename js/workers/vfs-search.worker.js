let fileStore = null;

self.onmessage = function (e) {
    const data = e.data || {};
    if (data.type === 'init') {
        fileStore = data.files || [];
        self.postMessage({ type: 'ready' });
        return;
    }
    if (data.type === 'update') {
        fileStore = data.files || [];
        return;
    }
    if (data.type === 'search') {
        const results = performSearch(data.query, data.options || {});
        self.postMessage({ type: 'results', id: data.id, results });
        return;
    }
};

function performSearch(query, options) {
    if (!fileStore || !query) return [];
    const q = String(query).toLowerCase();
    const limit = options.limit || 50;
    const results = [];
    for (let i = 0; i < fileStore.length; i++) {
        const f = fileStore[i];
        if (f.inTrash) continue;
        const name = (f.name || '').toLowerCase();
        const content = (typeof f.content === 'string') ? f.content.toLowerCase() : '';
        let score = 0;
        let matchedField = null;
        const nameIdx = name.indexOf(q);
        if (nameIdx === 0) { score = 100; matchedField = 'name'; }
        else if (nameIdx > 0) { score = 60; matchedField = 'name'; }
        else if (name.indexOf(q) !== -1) { score = 40; matchedField = 'name'; }
        if (content && content.indexOf(q) !== -1) {
            score += 20;
            if (!matchedField) matchedField = 'content';
        }
        if (score > 0) {
            results.push({
                id: f.id,
                name: f.name,
                type: f.type,
                parentId: f.parentId,
                score,
                matchedField,
                snippet: content ? buildSnippet(content, q) : ''
            });
        }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
}

function buildSnippet(content, q) {
    const idx = content.indexOf(q);
    if (idx === -1) return '';
    const start = Math.max(0, idx - 30);
    const end = Math.min(content.length, idx + q.length + 60);
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet.replace(/\s+/g, ' ').trim();
}
