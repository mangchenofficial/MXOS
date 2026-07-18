class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(event, callback) {
        if (typeof event !== 'string' || typeof callback !== 'function') return () => {};
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (typeof event !== 'string') return;
        const set = this._listeners.get(event);
        if (!set) return;
        if (callback) {
            set.delete(callback);
        } else {
            set.clear();
        }
        if (set.size === 0) this._listeners.delete(event);
    }

    once(event, callback) {
        if (typeof event !== 'string' || typeof callback !== 'function') return () => {};
        const wrapper = (data) => {
            this.off(event, wrapper);
            try { callback(data); } catch (e) { console.error('[EventBus] once 回调错误:', e); }
        };
        return this.on(event, wrapper);
    }

    emit(event, data) {
        if (typeof event !== 'string') return;
        const set = this._listeners.get(event);
        if (!set || set.size === 0) return;
        const snapshot = Array.from(set);
        snapshot.forEach(fn => {
            try { fn(data); } catch (e) { console.error('[EventBus] 回调错误:', e); }
        });
    }

    clear() {
        this._listeners.clear();
    }

    listenerCount(event) {
        const set = this._listeners.get(event);
        return set ? set.size : 0;
    }
}

const eventBus = new EventBus();
Object.freeze(eventBus);

export { EventBus, eventBus };
export default eventBus;
