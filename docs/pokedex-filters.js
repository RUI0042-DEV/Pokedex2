class PokedexFilters {
    static buildIndex(pokemonList) {
        return pokemonList.map(pokemon => {
            const stats = {};
            (pokemon.stats || []).forEach(stat => {
                stats[stat.stat.name] = stat.base_stat;
            });

            const types = (pokemon.types || []).map(type => type.type?.name || type);
            const bst = Object.values(stats).reduce((sum, value) => sum + value, 0);
            const abilities = (pokemon.abilities || []).map(entry => entry.ability?.name || '');
            const generation = pokeAPI.getGeneration(pokemon.id);

            return {
                raw: pokemon,
                id: pokemon.id,
                name: pokemon.name,
                types,
                stats,
                bst,
                generation,
                abilities,
                height: pokemon.height || 0,
                weight: pokemon.weight || 0,
                isLegendaryLike: bst >= 600,
            };
        });
    }

    static apply(index, filters = {}) {
        const query = (filters.query || '').trim().toLowerCase();
        const type = filters.type || '';
        const secondaryType = filters.secondaryType || '';
        const generation = Number(filters.generation || 0);
        const minBST = Number(filters.minBST || 0);
        const maxBST = Number(filters.maxBST || 9999);
        const ability = (filters.ability || '').trim().toLowerCase();
        const sort = filters.sort || 'id-asc';
        const showOnlyCaptured = Boolean(filters.showOnlyCaptured);
        const showOnlyFavorites = Boolean(filters.showOnlyFavorites);
        const favorites = new Set(filters.favoriteIds || []);
        const captured = new Set(filters.capturedIds || []);

        let results = index.filter(entry => {
            const matchQuery = !query ||
                entry.name.includes(query) ||
                String(entry.id).includes(query);
            const matchType = !type || entry.types.includes(type);
            const matchSecondary = !secondaryType || entry.types.includes(secondaryType);
            const matchGen = !generation || entry.generation === generation;
            const matchBST = entry.bst >= minBST && entry.bst <= maxBST;
            const matchAbility = !ability || entry.abilities.some(item => item.includes(ability));
            const matchCaptured = !showOnlyCaptured || captured.has(entry.id);
            const matchFavorites = !showOnlyFavorites || favorites.has(entry.id);

            return matchQuery && matchType && matchSecondary && matchGen && matchBST && matchAbility && matchCaptured && matchFavorites;
        });

        results = this.sort(results, sort);
        return results.map(entry => entry.raw);
    }

    static sort(results, sort) {
        const sorted = [...results];
        const byName = (a, b) => a.name.localeCompare(b.name);
        const byId = (a, b) => a.id - b.id;
        const byBST = (a, b) => b.bst - a.bst || byId(a, b);
        const bySpeed = (a, b) => (b.stats.speed || 0) - (a.stats.speed || 0) || byId(a, b);

        switch (sort) {
            case 'name-asc':
                sorted.sort(byName);
                break;
            case 'bst-desc':
                sorted.sort(byBST);
                break;
            case 'speed-desc':
                sorted.sort(bySpeed);
                break;
            case 'id-desc':
                sorted.sort((a, b) => b.id - a.id);
                break;
            default:
                sorted.sort(byId);
                break;
        }
        return sorted;
    }

    static getTopRankings(index, limit = 5) {
        const topBy = stat => [...index]
            .sort((a, b) => (b.stats[stat] || 0) - (a.stats[stat] || 0))
            .slice(0, limit);

        return {
            bst: [...index].sort((a, b) => b.bst - a.bst).slice(0, limit),
            speed: topBy('speed'),
            attack: topBy('attack'),
            defense: topBy('defense'),
        };
    }
}
