class AppStore {
    constructor(namespace = 'pokedex_app_state') {
        this.namespace = namespace;
        this.listeners = new Map();
        this.state = this._loadState();
    }

    _loadState() {
        try {
            return JSON.parse(localStorage.getItem(this.namespace) || '{}');
        } catch {
            return {};
        }
    }

    _saveState() {
        localStorage.setItem(this.namespace, JSON.stringify(this.state));
    }

    get(key, fallback = null) {
        return this.state[key] ?? fallback;
    }

    set(key, value) {
        this.state[key] = value;
        this._saveState();
        this.emit(key, value);
        return value;
    }

    update(key, updater, fallback = null) {
        const nextValue = updater(this.get(key, fallback));
        return this.set(key, nextValue);
    }

    subscribe(key, listener) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(listener);
        return () => this.listeners.get(key)?.delete(listener);
    }

    emit(key, value) {
        const keyListeners = this.listeners.get(key);
        if (!keyListeners) return;
        keyListeners.forEach(listener => {
            try {
                listener(value, this.state);
            } catch (error) {
                console.error('Store listener error:', error);
            }
        });
    }
}
