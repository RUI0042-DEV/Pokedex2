class CollectionManager {
    constructor(store) {
        this.store = store;
        this.keys = {
            favorites: 'pokedex_favorites',
            captured: 'pokedex_captured',
            recent: 'pokedex_recent',
            lists: 'pokedex_lists',
            variantChecks: 'pokedex_variant_checks',
            notes: 'pokedex_notes',
        };
    }

    _getArray(key) {
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    _setArray(key, items) {
        localStorage.setItem(key, JSON.stringify(items));
        this.store?.set(key, items);
        return items;
    }

    getFavorites() { return this._getArray(this.keys.favorites); }
    getCaptured() { return this._getArray(this.keys.captured); }
    getRecent() { return this._getArray(this.keys.recent); }
    getLists() { return this._getArray(this.keys.lists); }

    toggleFavorite(id) {
        return this._toggleInArray(this.keys.favorites, id);
    }

    toggleCaptured(id) {
        return this._toggleInArray(this.keys.captured, id);
    }

    _toggleInArray(key, id) {
        const items = this._getArray(key);
        const index = items.indexOf(id);
        if (index >= 0) items.splice(index, 1);
        else items.push(id);
        return this._setArray(key, items);
    }

    addRecent(id) {
        const recent = this.getRecent().filter(item => item !== id);
        recent.unshift(id);
        this._setArray(this.keys.recent, recent.slice(0, 18));
    }

    getVariantChecks() {
        return JSON.parse(localStorage.getItem(this.keys.variantChecks) || '{}');
    }

    getNotes() {
        return JSON.parse(localStorage.getItem(this.keys.notes) || '{}');
    }

    setVariantState(id, field, value) {
        const data = this.getVariantChecks();
        data[id] = { shiny: false, alpha: false, form: false, special: false, ...(data[id] || {}), [field]: value };
        localStorage.setItem(this.keys.variantChecks, JSON.stringify(data));
        this.store?.set(this.keys.variantChecks, data);
        return data[id];
    }

    setPokemonNote(id, note) {
        const notes = this.getNotes();
        if (note?.trim()) notes[id] = note.trim();
        else delete notes[id];
        localStorage.setItem(this.keys.notes, JSON.stringify(notes));
        this.store?.set(this.keys.notes, notes);
    }

    saveList(payload) {
        const lists = this.getLists();
        const clean = {
            id: payload.id || `list_${Date.now()}`,
            name: payload.name || 'Nueva lista',
            description: payload.description || '',
            pokemonIds: [...new Set((payload.pokemonIds || []).map(Number).filter(Boolean))],
            tags: payload.tags || [],
            updatedAt: new Date().toISOString(),
        };
        const index = lists.findIndex(list => list.id === clean.id);
        if (index >= 0) lists[index] = clean;
        else lists.unshift(clean);
        this._setArray(this.keys.lists, lists.slice(0, 30));
        return clean;
    }

    deleteList(id) {
        const lists = this.getLists().filter(list => list.id !== id);
        this._setArray(this.keys.lists, lists);
    }

    exportCollection() {
        return {
            favorites: this.getFavorites(),
            captured: this.getCaptured(),
            recent: this.getRecent(),
            lists: this.getLists(),
            variantChecks: this.getVariantChecks(),
            notes: this.getNotes(),
            exportedAt: new Date().toISOString(),
        };
    }

    importCollection(data) {
        if (!data || typeof data !== 'object') throw new Error('Formato inválido');
        this._setArray(this.keys.favorites, data.favorites || []);
        this._setArray(this.keys.captured, data.captured || []);
        this._setArray(this.keys.recent, data.recent || []);
        this._setArray(this.keys.lists, data.lists || []);
        localStorage.setItem(this.keys.variantChecks, JSON.stringify(data.variantChecks || {}));
        localStorage.setItem(this.keys.notes, JSON.stringify(data.notes || {}));
        this.store?.set(this.keys.variantChecks, data.variantChecks || {});
        this.store?.set(this.keys.notes, data.notes || {});
    }

    getCollectionStats(totalPokemon = 1025) {
        const favorites = this.getFavorites();
        const captured = this.getCaptured();
        const variantChecks = this.getVariantChecks();
        const lists = this.getLists();
        const shinyCount = Object.values(variantChecks).filter(v => v?.shiny).length;
        const formCount = Object.values(variantChecks).filter(v => v?.form).length;

        return {
            favorites: favorites.length,
            captured: captured.length,
            uncaptured: Math.max(0, totalPokemon - captured.length),
            captureRate: totalPokemon ? Math.round((captured.length / totalPokemon) * 100) : 0,
            shinyCount,
            formCount,
            customLists: lists.length,
        };
    }

    getGenerationProgress(totalByGen = {}) {
        const captured = new Set(this.getCaptured());
        return Object.entries(totalByGen).map(([gen, ids]) => {
            const total = ids.length;
            const count = ids.filter(id => captured.has(id)).length;
            return {
                gen: Number(gen),
                count,
                total,
                percent: total ? Math.round((count / total) * 100) : 0,
            };
        });
    }
}
