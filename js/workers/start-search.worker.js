let appList = [];
let settingsList = [];

self.onmessage = function (e) {
    const data = e.data || {};
    if (data.type === 'init') {
        appList = data.apps || [];
        settingsList = data.settings || [];
        self.postMessage({ type: 'ready' });
        return;
    }
    if (data.type === 'update') {
        if (data.apps) appList = data.apps;
        if (data.settings) settingsList = data.settings;
        return;
    }
    if (data.type === 'search') {
        const results = searchAll(data.query || '');
        self.postMessage({ type: 'results', id: data.id, results });
        return;
    }
};

function searchAll(query) {
    const q = String(query).trim().toLowerCase();
    if (!q) return { apps: [], settings: [], docs: [] };
    const apps = [];
    const settings = [];
    const docs = [];

    for (const app of appList) {
        const name = (app.name || '').toLowerCase();
        const id = (app.id || '').toLowerCase();
        const keywords = (app.keywords || []).join(' ').toLowerCase();
        if (name.includes(q) || id.includes(q) || keywords.includes(q)) {
            apps.push(app);
            if (apps.length >= 5) break;
        }
    }

    for (const s of settingsList) {
        const name = (s.name || '').toLowerCase();
        const id = (s.id || '').toLowerCase();
        if (name.includes(q) || id.includes(q)) {
            settings.push(s);
            if (settings.length >= 5) break;
        }
    }

    return { apps: apps.slice(0, 5), settings: settings.slice(0, 5), docs: docs.slice(0, 5) };
}
