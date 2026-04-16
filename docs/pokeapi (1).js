/**
 * PokeAPI Centralized Module
 * Maneja todas las interacciones con la PokeAPI
 */
class PokeAPI {
    constructor() {
        this.baseURL = 'https://pokeapi.co/api/v2';
        this.cache = new Map();
        this.batchSize = 20;
        this.persistentCachePrefix = 'pokeapi_cache_v2:';
        this.persistentCacheTTL = 1000 * 60 * 60 * 24 * 7;
        this.indexCacheKey = 'pokedex_summary_index_v1';
        
        // Type colors mapping
        this.typeColors = {
            normal: { bg: 'bg-[#A8A878]', text: 'text-[#A8A878]', border: 'border-[#A8A878]' },
            fire: { bg: 'bg-[#F08030]', text: 'text-[#F08030]', border: 'border-[#F08030]' },
            water: { bg: 'bg-[#6890F0]', text: 'text-[#6890F0]', border: 'border-[#6890F0]' },
            electric: { bg: 'bg-[#F8D030]', text: 'text-[#F8D030]', border: 'border-[#F8D030]' },
            grass: { bg: 'bg-[#78C850]', text: 'text-[#78C850]', border: 'border-[#78C850]' },
            ice: { bg: 'bg-[#98D8D8]', text: 'text-[#98D8D8]', border: 'border-[#98D8D8]' },
            fighting: { bg: 'bg-[#C03028]', text: 'text-[#C03028]', border: 'border-[#C03028]' },
            poison: { bg: 'bg-[#A040A0]', text: 'text-[#A040A0]', border: 'border-[#A040A0]' },
            ground: { bg: 'bg-[#E0C068]', text: 'text-[#E0C068]', border: 'border-[#E0C068]' },
            flying: { bg: 'bg-[#A890F0]', text: 'text-[#A890F0]', border: 'border-[#A890F0]' },
            psychic: { bg: 'bg-[#F85888]', text: 'text-[#F85888]', border: 'border-[#F85888]' },
            bug: { bg: 'bg-[#A8B820]', text: 'text-[#A8B820]', border: 'border-[#A8B820]' },
            rock: { bg: 'bg-[#B8A038]', text: 'text-[#B8A038]', border: 'border-[#B8A038]' },
            ghost: { bg: 'bg-[#705898]', text: 'text-[#705898]', border: 'border-[#705898]' },
            dragon: { bg: 'bg-[#7038F8]', text: 'text-[#7038F8]', border: 'border-[#7038F8]' },
            dark: { bg: 'bg-[#705848]', text: 'text-[#705848]', border: 'border-[#705848]' },
            steel: { bg: 'bg-[#B8B8D0]', text: 'text-[#B8B8D0]', border: 'border-[#B8B8D0]' },
            fairy: { bg: 'bg-[#EE99AC]', text: 'text-[#EE99AC]', border: 'border-[#EE99AC]' },
        };
        
        // Type effectiveness chart
        this.typeEffectiveness = {
            normal: { weak: ['fighting'], immune: ['ghost'], resist: [] },
            fire: { weak: ['water', 'ground', 'rock'], immune: [], resist: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'] },
            water: { weak: ['electric', 'grass'], immune: [], resist: ['fire', 'water', 'ice', 'steel'] },
            electric: { weak: ['ground'], immune: [], resist: ['electric', 'flying', 'steel'] },
            grass: { weak: ['fire', 'ice', 'poison', 'flying', 'bug'], immune: [], resist: ['water', 'electric', 'grass', 'ground'] },
            ice: { weak: ['fire', 'fighting', 'rock', 'steel'], immune: [], resist: ['ice'] },
            fighting: { weak: ['flying', 'psychic', 'fairy'], immune: [], resist: ['bug', 'rock', 'dark'] },
            poison: { weak: ['ground', 'psychic'], immune: [], resist: ['grass', 'fighting', 'poison', 'bug', 'fairy'] },
            ground: { weak: ['water', 'grass', 'ice'], immune: ['electric'], resist: ['poison', 'rock'] },
            flying: { weak: ['electric', 'ice', 'rock'], immune: ['ground'], resist: ['grass', 'fighting', 'bug'] },
            psychic: { weak: ['bug', 'ghost', 'dark'], immune: [], resist: ['fighting', 'psychic'] },
            bug: { weak: ['fire', 'flying', 'rock'], immune: [], resist: ['grass', 'fighting', 'ground'] },
            rock: { weak: ['water', 'grass', 'fighting', 'ground', 'steel'], immune: [], resist: ['normal', 'fire', 'poison', 'flying'] },
            ghost: { weak: ['ghost', 'dark'], immune: ['normal', 'fighting'], resist: ['poison', 'bug'] },
            dragon: { weak: ['ice', 'dragon', 'fairy'], immune: [], resist: ['fire', 'water', 'electric', 'grass'] },
            dark: { weak: ['fighting', 'bug', 'fairy'], immune: ['psychic'], resist: ['ghost', 'dark'] },
            steel: { weak: ['fire', 'fighting', 'ground'], immune: ['poison'], resist: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'] },
            fairy: { weak: ['poison', 'steel'], immune: ['dragon'], resist: ['fighting', 'bug', 'dark'] },
        };
        
        // Stat names in Spanish
        this.statNames = {
            hp: 'PS',
            attack: 'Ataque',
            defense: 'Defensa',
            'special-attack': 'At. Esp.',
            'special-defense': 'Def. Esp.',
            speed: 'Velocidad',
        };
        
        // Generation ranges
        this.genRanges = {
            1: { start: 1, end: 151 },
            2: { start: 152, end: 251 },
            3: { start: 252, end: 386 },
            4: { start: 387, end: 493 },
            5: { start: 494, end: 649 },
            6: { start: 650, end: 721 },
            7: { start: 722, end: 809 },
            8: { start: 810, end: 905 },
            9: { start: 906, end: 1025 },
        };
        
        // Nombres de tipos en español
        this.typeNamesES = {
            normal: 'Normal',
            fire: 'Fuego',
            water: 'Agua',
            electric: 'Eléctrico',
            grass: 'Planta',
            ice: 'Hielo',
            fighting: 'Lucha',
            poison: 'Veneno',
            ground: 'Tierra',
            flying: 'Volador',
            psychic: 'Psíquico',
            bug: 'Bicho',
            rock: 'Roca',
            ghost: 'Fantasma',
            dragon: 'Dragón',
            dark: 'Siniestro',
            steel: 'Acero',
            fairy: 'Hada',
        };
        
        // Categorías de movimiento en español
        this.damageClassES = {
            physical: 'Físico',
            special: 'Especial',
            status: 'Estado',
        };
    }
    
    /**
     * Fetch with caching
     */
    async fetch(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        const persistent = this.getPersistentCache(url);
        if (persistent) {
            this.cache.set(url, persistent);
            return persistent;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.cache.set(url, data);
            this.setPersistentCache(url, data);
            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    getPersistentCache(url) {
        try {
            const raw = localStorage.getItem(this.persistentCachePrefix + url);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed.timestamp || Date.now() - parsed.timestamp > this.persistentCacheTTL) {
                localStorage.removeItem(this.persistentCachePrefix + url);
                return null;
            }
            return parsed.data;
        } catch {
            return null;
        }
    }

    setPersistentCache(url, data) {
        try {
            localStorage.setItem(this.persistentCachePrefix + url, JSON.stringify({
                timestamp: Date.now(),
                data,
            }));
        } catch (error) {
            console.warn('Persistent cache unavailable:', error);
        }
    }
    
    /**
     * Get Pokemon list with pagination
     */
    async getPokemonList(offset = 0, limit = 20) {
        const url = `${this.baseURL}/pokemon?offset=${offset}&limit=${limit}`;
        return this.fetch(url);
    }
    
    /**
     * Get Pokemon details by ID or name
     */
    async getPokemon(idOrName) {
        const url = `${this.baseURL}/pokemon/${idOrName}`;
        return this.fetch(url);
    }

    async getPokemonBatchDetailed(offset = 0, limit = 20) {
        const list = await this.getPokemonList(offset, limit);
        const entries = list.results || [];
        const details = await Promise.all(entries.map(async entry => {
            const id = entry.url.split('/').slice(-2, -1)[0];
            try {
                return await this.getPokemon(id);
            } catch {
                return null;
            }
        }));
        return details.filter(Boolean);
    }

    async getSummaryIndex(forceRefresh = false) {
        if (!forceRefresh) {
            try {
                const raw = localStorage.getItem(this.indexCacheKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed?.data) && parsed.data.length) {
                        return parsed.data;
                    }
                }
            } catch {
                // Ignore malformed cache.
            }
        }

        const data = await this.getPokemonList(0, 1025);
        const summary = (data.results || []).map((pokemon, index) => ({
            id: index + 1,
            name: pokemon.name,
            url: pokemon.url,
        }));

        try {
            localStorage.setItem(this.indexCacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: summary,
            }));
        } catch (error) {
            console.warn('Summary index cache unavailable:', error);
        }
        return summary;
    }
    
    /**
     * Get Pokemon species data
     */
    async getPokemonSpecies(idOrName) {
        const url = `${this.baseURL}/pokemon-species/${idOrName}`;
        return this.fetch(url);
    }
    
    /**
     * Get Pokemon evolution chain
     */
    async getEvolutionChain(id) {
        const url = `${this.baseURL}/evolution-chain/${id}`;
        return this.fetch(url);
    }
    
    /**
     * Get Pokemon forms
     */
    async getPokemonForm(id) {
        const url = `${this.baseURL}/pokemon-form/${id}`;
        return this.fetch(url);
    }
    
    /**
     * Get type data
     */
    async getType(typeName) {
        const url = `${this.baseURL}/type/${typeName}`;
        return this.fetch(url);
    }
    
    /**
     * Get all types
     */
    async getAllTypes() {
        const url = `${this.baseURL}/type`;
        const data = await this.fetch(url);
        return data.results.filter(t => !['unknown', 'shadow'].includes(t.name));
    }
    
    /**
     * Get all colors
     */
    async getAllColors() {
        const url = `${this.baseURL}/pokemon-color`;
        return this.fetch(url);
    }
    
    /**
     * Get all habitats
     */
    async getAllHabitats() {
        const url = `${this.baseURL}/pokemon-habitat`;
        return this.fetch(url);
    }
    
    /**
     * Get Pokemon moves
     */
    async getMove(moveName) {
        const url = `${this.baseURL}/move/${moveName}`;
        return this.fetch(url);
    }
    
    /**
     * Get ability details
     */
    async getAbility(abilityName) {
        const url = `${this.baseURL}/ability/${abilityName}`;
        return this.fetch(url);
    }
    
    /**
     * Get location area details
     */
    async getLocationArea(id) {
        const url = `${this.baseURL}/location-area/${id}`;
        return this.fetch(url);
    }
    
    /**
     * Get Pokemon cry URL
     */
    getPokemonCryUrl(id) {
        return `https://play.pokemonshowdown.com/audio/cries/${id}.mp3`;
    }
    
    /**
     * Get Pokemon image URL (official artwork)
     */
    getPokemonImageUrl(id, variant = 'default') {
        const baseUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other';
        switch (variant) {
            case 'shiny':
                return `${baseUrl}/official-artwork/shiny/${id}.png`;
            case 'back':
                return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${id}.png`;
            case 'back-shiny':
                return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${id}.png`;
            default:
                return `${baseUrl}/official-artwork/${id}.png`;
        }
    }
    
    /**
     * Get Pokemon sprite URL
     */
    getPokemonSpriteUrl(id, variant = 'default') {
        const baseUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
        switch (variant) {
            case 'shiny':
                return `${baseUrl}/shiny/${id}.png`;
            case 'back':
                return `${baseUrl}/back/${id}.png`;
            case 'back-shiny':
                return `${baseUrl}/back/shiny/${id}.png`;
            default:
                return `${baseUrl}/${id}.png`;
        }
    }
    
    /**
     * Get description in Spanish
     */
    getSpanishDescription(speciesData) {
        const entry = speciesData.flavor_text_entries.find(
            entry => entry.language.name === 'es'
        );
        return entry ? entry.flavor_text.replace(/\n|\f/g, ' ') : 'Descripción no disponible.';
    }
    
    /**
     * Get genus (category) in Spanish
     */
    getSpanishGenus(speciesData) {
        const genus = speciesData.genera.find(
            g => g.language.name === 'es'
        );
        return genus ? genus.genus : 'Pokémon';
    }
    
    /**
     * Get ability name in Spanish
     */
    getSpanishAbilityName(abilityData) {
        const name = abilityData.names.find(
            n => n.language.name === 'es'
        );
        return name ? name.name : abilityData.name;
    }
    
    /**
     * Get move name in Spanish
     */
    getSpanishMoveName(moveData) {
        const name = moveData.names.find(
            n => n.language.name === 'es'
        );
        return name ? name.name : moveData.name;
    }
    
    /**
     * Format Pokemon ID with leading zeros
     */
    formatId(id) {
        return `#${String(id).padStart(4, '0')}`;
    }
    
    /**
     * Get generation from Pokemon ID
     */
    getGeneration(id) {
        for (const [gen, range] of Object.entries(this.genRanges)) {
            if (id >= range.start && id <= range.end) {
                return parseInt(gen);
            }
        }
        return 9;
    }
    
    /**
     * Calculate max stat at level 100
     */
    calculateMaxStat(baseStat, isHP = false) {
        if (isHP) {
            return Math.floor(((2 * baseStat + 31 + 252 / 4) * 100) / 100) + 100 + 10;
        }
        return Math.floor((((2 * baseStat + 31 + 252 / 4) * 100) / 100 + 5) * 1.1);
    }
    
    /**
     * Calculate type effectiveness
     */
    calculateEffectiveness(attackingType, defendingTypes) {
        let multiplier = 1;
        
        for (const defType of defendingTypes) {
            const effectiveness = this.typeEffectiveness[defType];
            if (!effectiveness) continue;
            
            if (effectiveness.weak.includes(attackingType)) {
                multiplier *= 2;
            } else if (effectiveness.resist.includes(attackingType)) {
                multiplier *= 0.5;
            } else if (effectiveness.immune.includes(attackingType)) {
                multiplier *= 0;
            }
        }
        
        return multiplier;
    }
    
    /**
     * Get all effectiveness against types
     */
    getAllEffectiveness(defendingTypes) {
        const allTypes = Object.keys(this.typeEffectiveness);
        const effectiveness = {
            '4x': [],
            '2x': [],
            '1x': [],
            '0.5x': [],
            '0.25x': [],
            '0x': [],
        };
        
        for (const type of allTypes) {
            const multiplier = this.calculateEffectiveness(type, defendingTypes);
            const key = multiplier === 4 ? '4x' : 
                       multiplier === 2 ? '2x' : 
                       multiplier === 1 ? '1x' : 
                       multiplier === 0.5 ? '0.5x' : 
                       multiplier === 0.25 ? '0.25x' : '0x';
            effectiveness[key].push(type);
        }
        
        return effectiveness;
    }
    
    /**
     * Get egg groups in Spanish
     */
    getSpanishEggGroup(groupName) {
        const translations = {
            monster: 'Monstruo',
            water1: 'Agua 1',
            water2: 'Agua 2',
            water3: 'Agua 3',
            bug: 'Bicho',
            flying: 'Volador',
            ground: 'Campo',
            fairy: 'Hada',
            plant: 'Planta',
            humanshape: 'Humanoide',
            mineral: 'Mineral',
            indeterminate: 'Amorfo',
            ditto: 'Ditto',
            dragon: 'Dragón',
            no_eggs: 'Desconocido',
        };
        return translations[groupName] || groupName;
    }
    
    /**
     * Get habitat in Spanish
     */
    getSpanishHabitat(habitatName) {
        const translations = {
            cave: 'Cueva',
            forest: 'Bosque',
            grassland: 'Pradera',
            mountain: 'Montaña',
            rare: 'Raro',
            'rough-terrain': 'Terreno abrupto',
            sea: 'Mar',
            urban: 'Urbano',
            'waters-edge': 'Orilla del agua',
        };
        return translations[habitatName] || habitatName;
    }
    
    /**
     * Search Pokemon by name
     */
    async searchPokemon(query) {
        const url = `${this.baseURL}/pokemon?limit=1025`;
        const data = await this.fetch(url);
        const lowerQuery = query.toLowerCase();
        
        return data.results.filter(pokemon => 
            pokemon.name.includes(lowerQuery) || 
            pokemon.url.split('/').slice(-2, -1)[0].includes(lowerQuery)
        );
    }
    
    /**
     * Get Pokemon by generation
     */
    async getPokemonByGeneration(gen) {
        const range = this.genRanges[gen];
        if (!range) return [];
        
        const pokemonList = [];
        for (let i = range.start; i <= range.end; i++) {
            pokemonList.push(this.getPokemon(i));
        }
        
        return Promise.all(pokemonList);
    }
    
    /**
     * Get Pokemon by type
     */
    async getPokemonByType(typeName) {
        const typeData = await this.getType(typeName);
        return typeData.pokemon.map(p => p.pokemon);
    }
    
    /**
     * Get Pokemon by color
     */
    async getPokemonByColor(colorName) {
        const url = `${this.baseURL}/pokemon-color/${colorName}`;
        const data = await this.fetch(url);
        return data.pokemon_species;
    }
    
    /**
     * Get Pokemon by habitat
     */
    async getPokemonByHabitat(habitatName) {
        const url = `${this.baseURL}/pokemon-habitat/${habitatName}`;
        const data = await this.fetch(url);
        return data.pokemon_species;
    }
    
    /**
     * Get growth rate name in Spanish
     */
    getSpanishGrowthRate(rateName) {
        const translations = {
            slow: 'Lento',
            medium: 'Medio',
            fast: 'Rápido',
            'medium-slow': 'Medio-Lento',
            'slow-then-very-fast': 'Lento, luego muy rápido',
            'fast-then-very-slow': 'Rápido, luego muy lento',
        };
        return translations[rateName] || rateName;
    }
    
    /**
     * Get shape name in Spanish
     */
    getSpanishShape(shapeName) {
        const translations = {
            ball: 'Bola',
            squiggle: 'Serpiente',
            fish: 'Pez',
            arms: 'Brazos',
            blob: 'Masa',
            upright: 'Bípedo',
            legs: 'Patas',
            quadruped: 'Cuadrúpedo',
            wings: 'Alas',
            tentacles: 'Tentáculos',
            heads: 'Cabezas',
            humanoid: 'Humanoide',
            'bug-wings': 'Alas de bicho',
            armor: 'Armadura',
        };
        return translations[shapeName] || shapeName;
    }
    
    /**
     * Get move list with pagination
     */
    async getMoveList(offset = 0, limit = 40) {
        const url = `${this.baseURL}/move?offset=${offset}&limit=${limit}`;
        return this.fetch(url);
    }
    
    /**
     * Get item data by name or ID
     */
    async getItem(idOrName) {
        const url = `${this.baseURL}/item/${idOrName}`;
        return this.fetch(url);
    }
    
    /**
     * Get item list with pagination
     */
    async getItemList(offset = 0, limit = 40) {
        const url = `${this.baseURL}/item?offset=${offset}&limit=${limit}`;
        return this.fetch(url);
    }
    
    /**
     * Get move flavor text in Spanish
     */
    getSpanishMoveDescription(moveData) {
        const entry = moveData.flavor_text_entries?.find(e => e.language.name === 'es');
        if (entry) return entry.flavor_text.replace(/\n|\f/g, ' ');
        const enEntry = moveData.flavor_text_entries?.find(e => e.language.name === 'en');
        return enEntry ? enEntry.flavor_text.replace(/\n|\f/g, ' ') : 'Sin descripción disponible.';
    }
    
    /**
     * Get item description in Spanish
     */
    getSpanishItemDescription(itemData) {
        const entry = itemData.flavor_text_entries?.find(e => e.language.name === 'es');
        if (entry) return entry.text.replace(/\n|\f/g, ' ');
        const effectEntry = itemData.effect_entries?.find(e => e.language.name === 'es');
        if (effectEntry) return effectEntry.short_effect;
        const enEntry = itemData.flavor_text_entries?.find(e => e.language.name === 'en');
        return enEntry ? enEntry.text.replace(/\n|\f/g, ' ') : 'Sin descripción disponible.';
    }
    
    /**
     * Get item name in Spanish
     */
    getSpanishItemName(itemData) {
        const name = itemData.names?.find(n => n.language.name === 'es');
        if (name) return name.name;
        const enName = itemData.names?.find(n => n.language.name === 'en');
        return enName ? enName.name : itemData.name.replace(/-/g, ' ');
    }
    
    /**
     * Get item category name in Spanish
     */
    getItemCategoryES(categoryName) {
        const translations = {
            'stat-boosts': 'Subida de estadísticas',
            'effort-drop': 'Reducción de EV',
            'medicine': 'Medicina',
            'other': 'Otros',
            'in-a-pinch': 'Baya de apuro',
            'picky-healing': 'Curación selectiva',
            'type-protection': 'Protección de tipo',
            'baked-goods': 'Alimentos',
            'collectibles': 'Coleccionables',
            'evolution': 'Evolución',
            'spelunking': 'Exploración',
            'held-items': 'Objetos retenidos',
            'choice': 'Pañuelo elegido',
            'effort-training': 'Entrenamiento de EV',
            'bad-held-items': 'Objetos perjudiciales',
            'training': 'Entrenamiento',
            'plates': 'Placas',
            'species-specific': 'Específico de especie',
            'type-enhancement': 'Mejora de tipo',
            'event-items': 'Objetos de evento',
            'gameplay': 'Jugabilidad',
            'plot-advancement': 'Avance del juego',
            'unused': 'Sin uso',
            'loot': 'Botín',
            'all-machines': 'MT/MO',
            'flutes': 'Flautas',
            'apricorn-balls': 'Bolas Apricorn',
            'standard-balls': 'Poké Balls estándar',
            'special-balls': 'Poké Balls especiales',
            'apricorn-box': 'Caja Apricorn',
            'data-cards': 'Tarjetas de datos',
            'jewels': 'Gemas',
            'miracle-shooter': 'Lanzador milagroso',
            'mega-stones': 'Mega Piedras',
            'memories': 'Memorias',
            'z-crystals': 'Cristales Z',
            'mulch': 'Mantillo',
            'vitamins': 'Vitaminas',
            'healing': 'Curación',
            'pp-recovery': 'Recuperación de PP',
            'revival': 'Revivir',
            'status-cures': 'Curas de estado',
            'berries': 'Bayas',
            'natural-gifts': 'Dones naturales',
            'dex-completion': 'Completar Pokédex',
        };
        return translations[categoryName] || categoryName.replace(/-/g, ' ');
    }
    
    /**
     * Get ability details (with caching)
     */
    async getAbility(nameOrId) {
        const url = `${this.baseURL}/ability/${nameOrId}`;
        return this.fetch(url);
    }

    /**
     * Get ability description in Spanish
     */
    getSpanishAbilityDescription(abilityData) {
        const entry = abilityData.effect_entries?.find(e => e.language.name === 'es');
        if (entry) return entry.short_effect || entry.effect;
        const en = abilityData.effect_entries?.find(e => e.language.name === 'en');
        if (en) return en.short_effect || en.effect;
        const fe = abilityData.flavor_text_entries?.find(e => e.language.name === 'es');
        if (fe) return fe.flavor_text.replace(/\n|\f/g, ' ');
        return 'Sin descripción disponible.';
    }

    /**
     * Get ability name in Spanish
     */
    getSpanishAbilityName(abilityData) {
        const n = abilityData.names?.find(n => n.language.name === 'es');
        if (n) return n.name;
        const en = abilityData.names?.find(n => n.language.name === 'en');
        return en ? en.name : abilityData.name.replace(/-/g, ' ');
    }

    /**
     * Get move name in Spanish (helper for move data objects)
     */
    getSpanishMoveName(moveData) {
        const n = moveData.names?.find(n => n.language.name === 'es');
        if (n) return n.name;
        const en = moveData.names?.find(n => n.language.name === 'en');
        return en ? en.name : moveData.name.replace(/-/g, ' ');
    }

    /**
     * Preload images
     */
    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = reject;
            img.src = url;
        });
    }
}

// Create global instance
const pokeAPI = new PokeAPI();
