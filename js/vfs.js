export class VirtualFileSystem {
    constructor() {
        this.dbName = 'MXOS_FileSystem';
        this.dbVersion = 1;
        this.db = null;
        this._searchWorker = null;
        this._searchWorkerReady = false;
        this._searchSeq = 0;
        this._searchPending = new Map();
        this._allCache = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    const store = db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('parentId', 'parentId', { unique: false });
                    store.createIndex('inTrash', 'inTrash', { unique: false });
                }
            };
        });
    }

    async ensureInitialized() {
        if (!this.db) await this.init();
    }

    async getAll(useCache = true) {
        await this.ensureInitialized();
        if (useCache && this._allCache) {
            return this._allCache;
        }
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();
            request.onsuccess = () => {
                this._allCache = request.result;
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    invalidateCache() {
        this._allCache = null;
    }

    async getChildren(parentId) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const index = store.index('parentId');
            const request = index.getAll(parentId);
            request.onsuccess = () => resolve(request.result.filter(f => !f.inTrash));
            request.onerror = () => reject(request.error);
        });
    }

    async getChildrenBulk(parentIds) {
        if (!Array.isArray(parentIds) || parentIds.length === 0) return [];
        await this.ensureInitialized();
        return Promise.all(parentIds.map(id => this.getChildren(id)));
    }

    async addBatch(files) {
        if (!Array.isArray(files) || files.length === 0) return [];
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const ids = [];
            const now = new Date().toISOString();
            let pending = files.length;
            if (pending === 0) { resolve([]); return; }
            transaction.oncomplete = () => { this._allCache = null; resolve(ids); };
            transaction.onerror = () => reject(transaction.error);
            files.forEach(file => {
                const request = store.add({ ...file, createdAt: now });
                request.onsuccess = () => {
                    ids.push(request.result);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    async deleteBatch(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return;
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            transaction.oncomplete = () => { this._allCache = null; resolve(); };
            transaction.onerror = () => reject(transaction.error);
            ids.forEach(id => store.delete(id));
        });
    }

    async getChildrenWithFallback(parentId) {
        if (parentId === null || parentId === undefined) {
            return this.getChildren(null);
        }
        return this.getChildren(parentId);
    }

    listChildrenFilter(children, filterText) {
        if (!filterText) return children;
        const q = String(filterText).toLowerCase();
        return children.filter(f => f && typeof f.name === 'string' && f.name.toLowerCase().indexOf(q) !== -1);
    }

    _initSearchWorker() {
        if (this._searchWorker) return this._searchWorker;
        try {
            this._searchWorker = new Worker(new URL('./workers/vfs-search.worker.js', import.meta.url), { type: 'module' });
        } catch (e) {
            try {
                this._searchWorker = new Worker('js/workers/vfs-search.worker.js');
            } catch (e2) {
                this._searchWorker = null;
                return null;
            }
        }
        this._searchWorker.onmessage = (e) => {
            const data = e.data || {};
            if (data.type === 'results') {
                const cb = this._searchPending.get(data.id);
                if (cb) {
                    this._searchPending.delete(data.id);
                    cb(data.results || []);
                }
            }
        };
        this._searchWorker.onerror = () => {};
        return this._searchWorker;
    }

    async _refreshSearchWorker() {
        const worker = this._initSearchWorker();
        if (!worker) return false;
        const files = await this.getAll();
        if (this._searchWorkerReady) {
            worker.postMessage({ type: 'update', files });
        } else {
            worker.postMessage({ type: 'init', files });
            this._searchWorkerReady = true;
        }
        return true;
    }

    async search(query, options = {}) {
        if (!query) return [];
        const worker = this._initSearchWorker();
        if (worker) {
            await this._refreshSearchWorker();
            const id = ++this._searchSeq;
            return new Promise((resolve) => {
                this._searchPending.set(id, resolve);
                worker.postMessage({ type: 'search', query, options, id });
                setTimeout(() => {
                    if (this._searchPending.has(id)) {
                        this._searchPending.delete(id);
                        resolve(this._searchSync(query, options));
                    }
                }, 5000);
            });
        }
        return this._searchSync(query, options);
    }

    async _searchSync(query, options = {}) {
        const files = await this.getAll();
        const q = String(query).toLowerCase();
        const limit = options.limit || 50;
        const results = [];
        for (const f of files) {
            if (f.inTrash) continue;
            const name = (f.name || '').toLowerCase();
            const content = (typeof f.content === 'string') ? f.content.toLowerCase() : '';
            let score = 0;
            let matchedField = null;
            const nameIdx = name.indexOf(q);
            if (nameIdx === 0) { score = 100; matchedField = 'name'; }
            else if (nameIdx > 0) { score = 60; matchedField = 'name'; }
            if (content && content.indexOf(q) !== -1) {
                score += 20;
                if (!matchedField) matchedField = 'content';
            }
            if (score > 0) {
                results.push({
                    id: f.id, name: f.name, type: f.type, parentId: f.parentId,
                    score, matchedField, snippet: ''
                });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    async getTrashItems() {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const index = store.index('inTrash');
            const request = index.getAll(true);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async add(file) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.add({
                ...file,
                createdAt: new Date().toISOString()
            });
            request.onsuccess = () => { this.invalidateCache(); resolve(request.result); };
            request.onerror = () => reject(request.error);
        });
    }

    async update(id, updates) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const file = getRequest.result;
                if (file) {
                    const updateRequest = store.put({ ...file, ...updates });
                    updateRequest.onsuccess = () => { this.invalidateCache(); resolve(); };
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('File not found'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async delete(id) {
        await this.ensureInitialized();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.delete(id);
            request.onsuccess = () => { this.invalidateCache(); resolve(); };
            request.onerror = () => reject(request.error);
        });
    }

    async moveToTrash(id) {
        await this.ensureInitialized();
        return this.update(id, { inTrash: true });
    }

    async restoreFromTrash(id) {
        await this.ensureInitialized();
        return this.update(id, { inTrash: false });
    }

    async clearTrash() {
        await this.ensureInitialized();
        const trashItems = await this.getTrashItems();
        await this.deleteBatch(trashItems.map(i => i.id));
    }

    async initializeDefaultStructure() {
        await this.ensureInitialized();
        const allFiles = await this.getAll();
        if (allFiles.length > 0) return;

        const rootC = await this.add({
            name: '本地磁盘 (C:)',
            type: 'drive',
            parentId: null,
            drive: 'C',
            inTrash: false
        });

        const rootD = await this.add({
            name: '本地磁盘 (D:)',
            type: 'drive',
            parentId: null,
            drive: 'D',
            inTrash: false
        });

        await this.add({ name: 'Program Files', type: 'folder', parentId: rootC, inTrash: false });
        await this.add({ name: 'Program Files (x86)', type: 'folder', parentId: rootC, inTrash: false });
        await this.add({ name: 'Users', type: 'folder', parentId: rootC, inTrash: false });
        const windowsId = await this.add({ name: 'Windows', type: 'folder', parentId: rootC, inTrash: false });
        await this.add({ name: '喜Edge', type: 'folder', parentId: rootD, inTrash: false });
        await this.add({ name: '设置', type: 'folder', parentId: rootD, inTrash: false });
        await this.add({ name: '喜Office', type: 'folder', parentId: rootD, inTrash: false });

        const system32Id = await this.add({ name: 'System32', type: 'folder', parentId: windowsId, inTrash: false });
        await this.add({ name: 'notepad.exe', type: 'file', content: '', parentId: windowsId, inTrash: false });
        await this.add({ name: 'calc.exe', type: 'file', content: '', parentId: windowsId, inTrash: false });
        await this.add({ name: 'mspaint.exe', type: 'file', content: '', parentId: windowsId, inTrash: false });

        await this.add({ name: 'cmd.exe', type: 'file', content: '', parentId: system32Id, inTrash: false });
        await this.add({ name: 'taskmgr.exe', type: 'file', content: '', parentId: system32Id, inTrash: false });
        await this.add({ name: 'regedit.exe', type: 'file', content: '', parentId: system32Id, inTrash: false });
    }
}

export const vfs = new VirtualFileSystem();
vfs.init();

export const fileIconMap = {
    'txt': '#svg-text',
    'md': '#svg-text',
    'log': '#svg-text',
    'json': '#svg-file',
    'xml': '#svg-file',
    'html': '#svg-file',
    'css': '#svg-file',
    'js': '#svg-file',
    'py': '#svg-file',
    'exe': '#svg-notepad',
    'default': '#svg-file'
};

export function getFileIcon(fileName, type) {
    if (type === 'folder') return '#svg-folder';
    if (type === 'drive') return '#svg-hard-disk';
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'exe') {
        if (fileName.includes('notepad')) return '#svg-notepad';
        if (fileName.includes('calc')) return '#svg-calc';
        if (fileName.includes('mspaint')) return '#svg-mspaint';
        if (fileName.includes('cmd')) return '#svg-cmd';
        if (fileName.includes('taskmgr')) return '#svg-taskmgr';
        if (fileName.includes('regedit')) return '#svg-regedit';
    }
    return fileIconMap[ext] || fileIconMap.default;
}

export function getFileExtension(fileName) {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function isTextFile(fileName) {
    const ext = getFileExtension(fileName);
    const textExtensions = ['txt', 'md', 'log', 'json', 'xml', 'html', 'css', 'js', 'py', 'c', 'cpp', 'h', 'java', 'php', 'go', 'rs'];
    return textExtensions.includes(ext);
}
