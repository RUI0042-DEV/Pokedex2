/**
 * Pokédex National Ultimate Edition - Main Application
 */
class PokedexApp {
    constructor() {
        this.currentView = 'home';
        this.pokemonList = [];
        this.filteredList = [];
        this.store = new AppStore();
        this.collection = new CollectionManager(this.store);
        this.teamBuilder = new TeamBuilderStorage(this.store);
        this.favorites = this.collection.getFavorites();
        this.captured = this.collection.getCaptured();
        this.preferences = {
            reducedMotion: this.store.get('pref_reducedMotion', false),
            compactMode: this.store.get('pref_compactMode', false),
            shinySprites: this.store.get('pref_shinySprites', false),
            autoPlayCry: this.store.get('pref_autoPlayCry', false),
            detailedPanels: this.store.get('pref_detailedPanels', true),
            ambientEffects: this.store.get('pref_ambientEffects', true),
        };
        this.offset = 0;
        this.limit = 30;
        this.isLoading = false;
        this.currentPokemon = null;
        this.comparePokemon = [null, null];
        this.selectedTypes = [null, null];
        this.charts = {};
        this.pokemonIndex = [];
        this.generationBuckets = Object.fromEntries(
            Object.entries(pokeAPI.genRanges).map(([gen, range]) => [
                gen,
                Array.from({ length: range.end - range.start + 1 }, (_, idx) => range.start + idx),
            ])
        );
        
        // Estado: Movimientos
        this.movesData = [];
        this.filteredMoves = [];
        this.movesOffset = 0;
        this.movesLimit = 40;
        this.isLoadingMoves = false;
        this.allMovesLoaded = false;
        this.movesSearchQuery = '';
        this.movesCategoryFilter = '';
        this.movesTypeFilter = '';
        
        // Estado: Objetos
        this.itemsData = [];
        this.filteredItems = [];
        this.itemsOffset = 0;
        this.itemsLimit = 40;
        this.isLoadingItems = false;
        this.allItemsLoaded = false;
        this.itemsSearchQuery = '';
        this.itemsCategoryFilter = '';

        // Estado: Habilidades
        this.abilitiesData = [];
        this.filteredAbilities = [];
        this.abilitiesSearchQuery = '';
        this.abilitiesEffectFilter = '';

        // Estado: Calc
        this.calcState = {
            atk: { pokemon: null, iv: {hp:31,attack:31,defense:31,'special-attack':31,'special-defense':31,speed:31}, ev: {hp:0,attack:0,defense:0,'special-attack':0,'special-defense':0,speed:0} },
            def: { pokemon: null, iv: {hp:31,attack:31,defense:31,'special-attack':31,'special-defense':31,speed:31}, ev: {hp:0,attack:0,defense:0,'special-attack':0,'special-defense':0,speed:0} },
            move: null,
        };
        
        this.init();
    }
    
    async init() {
        this.applyPreferences();
        this.setupEventListeners();
        this.setupIntersectionObserver();
        await this.loadPokemonBatch();
        this.pokemonIndex = PokedexFilters.buildIndex(this.pokemonList);
        this.populateFilterOptions();
        this.renderTypeSelectors();
        this.initHome();
        this.navigate('home');
    }
    
    setupEventListeners() {
        // Scroll handler for infinite scroll
        window.addEventListener('scroll', () => {
            if (this.currentView === 'list') this.handleInfiniteScroll();
            else if (this.currentView === 'moves') this.handleMovesScroll();
            else if (this.currentView === 'items') this.handleItemsScroll();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.currentView === 'detail') this.navigate('list');
                document.getElementById('search-bar')?.classList.add('hidden');
                document.querySelectorAll('.search-dropdown').forEach(d => d.classList.add('hidden'));
            }
            if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                this.toggleSearch();
                this.navigate('list');
            }
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-dropdown') && !e.target.closest('input')) {
                document.querySelectorAll('.search-dropdown').forEach(d => d.classList.add('hidden'));
            }
        });

        document.addEventListener('change', (e) => {
            const preferenceKey = e.target?.dataset?.preference;
            if (preferenceKey) {
                this.updatePreference(preferenceKey, e.target.checked);
            }
        });
    }
    
    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '100px',
            threshold: 0.1,
        };
        
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading && this.currentView === 'list') {
                    this.loadPokemonBatch();
                }
            });
        }, options);
        
        const trigger = document.getElementById('loading-trigger');
        if (trigger) {
            this.observer.observe(trigger);
        }
    }
    
    // ==================== NAVIGATION ====================

    openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('mobile-sidebar-overlay').classList.add('open');
    }
    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('mobile-sidebar-overlay').classList.remove('open');
    }
    
    navigate(view, params = null) {
        if (view === 'detail') {
            this.previousView = this.currentView;
        }
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.add('hidden');
        });
        
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected view
        this.currentView = view;
        const viewEl = document.getElementById(`view-${view}`);
        if (viewEl) {
            viewEl.classList.remove('hidden');
            viewEl.classList.add('animate-enter');
            setTimeout(() => viewEl.classList.remove('animate-enter'), 400);
        }
        
        // Update active nav item
        const activeBtn = document.querySelector(`[data-view="${view}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        // Close mobile sidebar
        this.closeSidebar();
        
        // Handle specific views
        switch (view) {
            case 'home':
                this.initHome();
                break;
            case 'list':
                this.renderPokemonList();
                break;
            case 'favorites':
                this.renderFavorites();
                break;
            case 'detail':
                if (params) this.loadPokemonDetail(params);
                break;
            case 'calc':
                this.initCalcView();
                break;
            case 'typechart':
                this.renderTypeChart();
                break;
            case 'moves':
                this.initMovesView();
                break;
            case 'items':
                this.initItemsView();
                break;
            case 'compare':
                this.renderCompareView();
                break;
            case 'abilities':
                this.initAbilitiesView();
                break;
            case 'battle':
                this.initBattleView();
                break;
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        lucide.createIcons();
    }
    
    toggleSearch() {
        const bar = document.getElementById('search-bar');
        if (bar) {
            bar.classList.toggle('hidden');
            if (!bar.classList.contains('hidden')) {
                document.getElementById('search-input')?.focus();
            }
        }
    }
    
    // ==================== POKEMON LIST ====================
    
    async loadPokemonBatch() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const loadingTrigger = document.getElementById('loading-trigger');
        if (loadingTrigger) {
            loadingTrigger.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>';
        }
        
        try {
            const validPokemon = await pokeAPI.getPokemonBatchDetailed(this.offset, this.limit);
            this.pokemonList = [...this.pokemonList, ...validPokemon];
            this.pokemonIndex = PokedexFilters.buildIndex(this.pokemonList);
            this.filteredList = [...this.pokemonList];
            
            this.offset += this.limit;
            this.renderPokemonList();
            
            // Update count
            document.getElementById('pokemon-count').textContent = 
                `${this.filteredList.length} / 1025 Pokémon`;
            
        } catch (error) {
            console.error('Error loading pokemon:', error);
        } finally {
            this.isLoading = false;
            if (loadingTrigger) {
                loadingTrigger.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>';
            }
        }
    }
    
    renderPokemonList() {
        const grid = document.getElementById('pokemon-grid');
        if (!grid) return;
        
        const pokemonToRender = this.filteredList.slice(0, this.offset);
        
        grid.innerHTML = pokemonToRender.map(pokemon => this.createPokemonCard(pokemon)).join('');
        lucide.createIcons();
    }
    
    createPokemonCard(pokemon) {
        const id = pokemon.id;
        const name = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);
        const types = pokemon.types.map(t => t.type.name);
        const primaryType = types[0];
        const typeColor = pokeAPI.typeColors[primaryType]?.text || 'text-gray-400';
        const typeBg = pokeAPI.typeColors[primaryType]?.bg || 'bg-gray-700';
        
        const isFavorite = this.favorites.includes(id);
        const isCaptured = this.captured.includes(id);
        
        return `
            <div class="pokemon-card glass-panel rounded-xl p-4 cursor-pointer relative group animate-slide-up"
                 onclick="app.navigate('detail', ${id})"
                 style="--stat-color: var(--neon-${primaryType === 'electric' ? 'yellow' : primaryType === 'fire' ? 'pink' : 'blue'})">
                
                <div class="absolute top-2 right-2 flex gap-1">
                    <button onclick="event.stopPropagation(); app.toggleFavorite(${id})" 
                            class="p-1.5 rounded-full ${isFavorite ? 'bg-pink-500 text-white' : 'bg-white/10 text-gray-400'} hover:scale-110 transition-all">
                        <i data-lucide="heart" class="w-4 h-4 ${isFavorite ? 'fill-current' : ''}"></i>
                    </button>
                </div>
                
                <div class="absolute top-2 left-2">
                    <span class="text-xs font-orbitron text-gray-500">${pokeAPI.formatId(id)}</span>
                </div>
                
                <div class="flex flex-col items-center">
                    <div class="relative w-24 h-24 mb-3">
                        <img src="${this.getPreferredArtworkUrl(id)}" 
                             alt="${name}" 
                             class="w-full h-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform premium-image"
                             loading="lazy"
                             onerror="this.src='${pokeAPI.getPokemonSpriteUrl(id)}'">
                        ${isCaptured ? `
                            <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <i data-lucide="check" class="w-4 h-4 text-white"></i>
                            </div>
                        ` : ''}
                    </div>
                    
                    <h3 class="font-orbitron font-bold text-sm text-center mb-2 ${typeColor}">${name}</h3>
                    
                    <div class="flex gap-1 flex-wrap justify-center">
                        ${types.map(type => `
                            <span class="${pokeAPI.typeColors[type]?.bg || 'bg-gray-600'} text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                                ${pokeAPI.typeNamesES[type] || type}
                            </span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    createSkeletonCard() {
        return `
            <div class="glass-panel rounded-xl p-4 animate-pulse">
                <div class="skeleton w-24 h-24 mx-auto mb-3 rounded-lg"></div>
                <div class="skeleton h-4 w-20 mx-auto mb-2 rounded"></div>
                <div class="flex gap-1 justify-center">
                    <div class="skeleton h-3 w-12 rounded-full"></div>
                    <div class="skeleton h-3 w-12 rounded-full"></div>
                </div>
            </div>
        `;
    }
    
    handleInfiniteScroll() {
        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        
        if (scrollPosition >= documentHeight - 500 && !this.isLoading) {
            if (this.filteredList.length < this.pokemonList.length) {
                // Load more from filtered list
                this.offset += this.limit;
                this.renderPokemonList();
            } else if (this.offset < 1025) {
                // Load more from API
                this.loadPokemonBatch();
            }
        }
    }
    
    // ==================== POKEMON DETAIL ====================
    
    async loadPokemonDetail(id) {
        const content = document.getElementById('detail-content');
        content.innerHTML = this.createDetailSkeleton();
        
        try {
            const [pokemon, species] = await Promise.all([
                pokeAPI.getPokemon(id),
                pokeAPI.getPokemonSpecies(id),
            ]);
            
            this.currentPokemon = { ...pokemon, species };
            this.collection.addRecent(pokemon.id);
            this.renderPokemonDetail(this.currentPokemon);
            this.renderRecentPokemon();
            
        } catch (error) {
            content.innerHTML = `
                <div class="text-center py-20">
                    <i data-lucide="alert-circle" class="w-16 h-16 mx-auto text-red-500 mb-4"></i>
                    <p class="text-gray-400">Error al cargar el Pokémon</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
    
    createDetailSkeleton() {
        return `
            <div class="animate-pulse space-y-6">
                <div class="glass-panel rounded-2xl p-6">
                    <div class="flex flex-col lg:flex-row gap-8">
                        <div class="skeleton w-full lg:w-1/3 aspect-square rounded-xl"></div>
                        <div class="flex-1 space-y-4">
                            <div class="skeleton h-8 w-48 rounded"></div>
                            <div class="skeleton h-4 w-32 rounded"></div>
                            <div class="flex gap-2">
                                <div class="skeleton h-6 w-20 rounded-full"></div>
                                <div class="skeleton h-6 w-20 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderPokemonDetail(pokemon) {
        const content = document.getElementById('detail-content');
        const id = pokemon.id;
        const name = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);
        const types = pokemon.types.map(t => t.type.name);
        const primaryType = types[0];
        const typeColor = pokeAPI.typeColors[primaryType]?.text || 'text-cyan-400';
        
        const description = pokeAPI.getSpanishDescription(pokemon.species);
        const genus = pokeAPI.getSpanishGenus(pokemon.species);
        const generation = pokeAPI.getGeneration(id);
        const variantState = this.collection.getVariantChecks()[id] || {};
        const trainerNote = this.collection.getNotes()[id] || '';
        const competitiveRole = this.getPokemonPrimaryRole(stats);
        const matchup = this.getPokemonMatchupSummary(types);
        const build = this.getPokemonBuildSummary(pokemon, stats);
        const premiumSummaryHTML = this.preferences.detailedPanels ? `
                            <div class="glass-panel rounded-xl p-4">
                                <div class="text-xs text-cyan-400/70 font-orbitron tracking-widest mb-3">RESUMEN COMPETITIVO</div>
                                <div class="grid sm:grid-cols-2 gap-3 text-sm">
                                    <div class="insight-card">
                                        <div class="insight-label">Rol principal</div>
                                        <div class="insight-value">${competitiveRole}</div>
                                    </div>
                                    <div class="insight-card">
                                        <div class="insight-label">Build sugerida</div>
                                        <div class="insight-value">${build.summary}</div>
                                    </div>
                                    <div class="insight-card">
                                        <div class="insight-label">Presión ofensiva</div>
                                        <div class="insight-value">${matchup.offense}</div>
                                    </div>
                                    <div class="insight-card">
                                        <div class="insight-label">Perfil defensivo</div>
                                        <div class="insight-value">${matchup.defense}</div>
                                    </div>
                                </div>
                                <div class="text-xs text-gray-400 mt-3">${build.detail}</div>
                            </div>
        ` : '';
        
        // Calculate stats
        const stats = {};
        pokemon.stats.forEach(s => {
            stats[s.stat.name] = s.base_stat;
        });
        
        // Get gender ratio
        const genderRate = pokemon.species.gender_rate;
        const femalePercent = genderRate === -1 ? 0 : (genderRate / 8) * 100;
        const malePercent = genderRate === -1 ? 0 : 100 - femalePercent;
        
        // Get egg groups
        const eggGroups = pokemon.species.egg_groups.map(g => pokeAPI.getSpanishEggGroup(g.name));
        
        content.innerHTML = `
            <div class="space-y-6">
                <!-- Header Card -->
                <div class="glass-panel rounded-2xl p-6 neon-border">
                    <div class="flex flex-col lg:flex-row gap-8">
                        <!-- Images -->
                        <div class="flex-1 flex flex-col items-center">
                            <div class="relative">
                                <img id="main-image" src="${this.getPreferredArtworkUrl(id)}" 
                                     alt="${name}" 
                                     class="w-64 h-64 lg:w-80 lg:h-80 object-contain drop-shadow-2xl premium-image">
                                <button onclick="app.playCry(${id})" 
                                        class="cry-button absolute bottom-4 right-4 w-12 h-12 rounded-full bg-cyan-500/80 flex items-center justify-center hover:bg-cyan-400 transition-all">
                                    <i data-lucide="volume-2" class="w-6 h-6 text-white"></i>
                                </button>
                            </div>
                            
                            <!-- Image Variants -->
                            <div class="flex gap-4 mt-4">
                                <button onclick="app.switchImage('default', ${id})" class="p-2 rounded-lg bg-white/10 hover:bg-cyan-500/30 transition-all">
                                    <img src="${pokeAPI.getPokemonSpriteUrl(id)}" class="w-10 h-10">
                                </button>
                                <button onclick="app.switchImage('shiny', ${id})" class="p-2 rounded-lg bg-white/10 hover:bg-yellow-500/30 transition-all relative">
                                    <img src="${pokeAPI.getPokemonSpriteUrl(id, 'shiny')}" class="w-10 h-10">
                                    <span class="absolute -top-1 -right-1 text-xs">✨</span>
                                </button>
                                <button onclick="app.switchImage('back', ${id})" class="p-2 rounded-lg bg-white/10 hover:bg-purple-500/30 transition-all">
                                    <img src="${pokeAPI.getPokemonSpriteUrl(id, 'back')}" class="w-10 h-10">
                                </button>
                            </div>
                        </div>
                        
                        <!-- Info -->
                        <div class="flex-1 space-y-6">
                            <div>
                                <span class="text-gray-400 font-orbitron">${pokeAPI.formatId(id)}</span>
                                <h1 class="text-4xl lg:text-5xl font-orbitron font-bold ${typeColor} mb-2">${name}</h1>
                                <p class="text-gray-400 italic">${genus}</p>
                            </div>
                            
                            <!-- Types -->
                            <div class="flex gap-2">
                                ${types.map(type => `
                                    <span class="${pokeAPI.typeColors[type]?.bg || 'bg-gray-600'} text-white px-4 py-2 rounded-full font-bold shadow-lg">
                                        ${pokeAPI.typeNamesES[type] || type}
                                    </span>
                                `).join('')}
                            </div>
                            
                            <!-- Quick Stats -->
                            <div class="grid grid-cols-3 gap-4">
                                <div class="glass-panel rounded-xl p-3 text-center">
                                    <i data-lucide="ruler" class="w-5 h-5 mx-auto mb-1 text-cyan-400"></i>
                                    <span class="text-sm text-gray-400">Altura</span>
                                    <p class="font-bold">${(pokemon.height / 10).toFixed(1)} m</p>
                                </div>
                                <div class="glass-panel rounded-xl p-3 text-center">
                                    <i data-lucide="weight" class="w-5 h-5 mx-auto mb-1 text-pink-400"></i>
                                    <span class="text-sm text-gray-400">Peso</span>
                                    <p class="font-bold">${(pokemon.weight / 10).toFixed(1)} kg</p>
                                </div>
                                <div class="glass-panel rounded-xl p-3 text-center">
                                    <i data-lucide="star" class="w-5 h-5 mx-auto mb-1 text-yellow-400"></i>
                                    <span class="text-sm text-gray-400">Generación</span>
                                    <p class="font-bold">Gen ${generation}</p>
                                </div>
                            </div>
                            
                            <!-- Description -->
                            <div class="glass-panel rounded-xl p-4">
                                <p class="text-gray-300 leading-relaxed">${description}</p>
                            </div>
                            ${premiumSummaryHTML}
                            
                            <!-- Actions -->
                            <div class="flex gap-3">
                                <button onclick="app.toggleFavorite(${id})" 
                                        class="flex-1 py-3 rounded-xl ${this.favorites.includes(id) ? 'bg-pink-500' : 'bg-white/10'} hover:bg-pink-500/80 transition-all flex items-center justify-center gap-2">
                                    <i data-lucide="heart" class="w-5 h-5 ${this.favorites.includes(id) ? 'fill-current' : ''}"></i>
                                    <span>${this.favorites.includes(id) ? 'Favorito' : 'Añadir Favorito'}</span>
                                </button>
                                <button onclick="app.toggleCaptured(${id})" 
                                        class="flex-1 py-3 rounded-xl ${this.captured.includes(id) ? 'bg-green-500' : 'bg-white/10'} hover:bg-green-500/80 transition-all flex items-center justify-center gap-2">
                                    <i data-lucide="check-circle" class="w-5 h-5"></i>
                                    <span>${this.captured.includes(id) ? 'Capturado' : 'Marcar Capturado'}</span>
                                </button>
                            </div>
                            <div class="glass-panel rounded-xl p-4">
                                <div class="text-xs text-gray-400 font-orbitron tracking-widest mb-3">TRACKER DE COLECCIÓN</div>
                                <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                                    <label class="filter-check justify-between"><span>Shiny</span><input type="checkbox" ${variantState.shiny ? 'checked' : ''} onchange="app.updateVariantState(${id}, 'shiny', this.checked)"></label>
                                    <label class="filter-check justify-between"><span>Forma</span><input type="checkbox" ${variantState.form ? 'checked' : ''} onchange="app.updateVariantState(${id}, 'form', this.checked)"></label>
                                    <label class="filter-check justify-between"><span>Alpha</span><input type="checkbox" ${variantState.alpha ? 'checked' : ''} onchange="app.updateVariantState(${id}, 'alpha', this.checked)"></label>
                                    <label class="filter-check justify-between"><span>Especial</span><input type="checkbox" ${variantState.special ? 'checked' : ''} onchange="app.updateVariantState(${id}, 'special', this.checked)"></label>
                                </div>
                                <textarea id="pokemon-note" class="pro-input min-h-[96px]" placeholder="Notas del entrenador, set ideal, objetivos, rareza..." onblur="app.savePokemonNote(${id}, this.value)">${trainerNote}</textarea>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Stats & Training Grid -->
                <div class="grid lg:grid-cols-2 gap-6">
                    <!-- Stats Chart -->
                    <div class="glass-panel rounded-2xl p-6">
                        <h2 class="font-orbitron text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                            <i data-lucide="bar-chart-2" class="w-5 h-5"></i>
                            Estadísticas Base
                        </h2>
                        <canvas id="stats-chart" class="w-full"></canvas>
                        <div class="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                            <div class="glass-panel rounded-lg p-2">
                                <span class="text-gray-400">Total</span>
                                <p class="font-bold text-lg">${Object.values(stats).reduce((a, b) => a + b, 0)}</p>
                            </div>
                            <div class="glass-panel rounded-lg p-2">
                                <span class="text-gray-400">Min (Niv. 100)</span>
                                <p class="font-bold text-lg">${this.calculateMinTotal(stats)}</p>
                            </div>
                            <div class="glass-panel rounded-lg p-2">
                                <span class="text-gray-400">Max (Niv. 100)</span>
                                <p class="font-bold text-lg">${this.calculateMaxTotal(stats)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Training Info -->
                    <div class="glass-panel rounded-2xl p-6">
                        <h2 class="font-orbitron text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                            <i data-lucide="target" class="w-5 h-5"></i>
                            Información de Entrenamiento
                        </h2>
                        <div class="space-y-4">
                            <div class="flex justify-between items-center py-2 border-b border-white/10">
                                <span class="text-gray-400">Ratio de captura</span>
                                <span class="font-bold">${pokemon.species.capture_rate}/255</span>
                            </div>
                            <div class="flex justify-between items-center py-2 border-b border-white/10">
                                <span class="text-gray-400">Amistad base</span>
                                <span class="font-bold">${pokemon.species.base_happiness}</span>
                            </div>
                            <div class="flex justify-between items-center py-2 border-b border-white/10">
                                <span class="text-gray-400">Experiencia base</span>
                                <span class="font-bold">${pokemon.base_experience}</span>
                            </div>
                            <div class="flex justify-between items-center py-2 border-b border-white/10">
                                <span class="text-gray-400">Crecimiento</span>
                                <span class="font-bold">${pokeAPI.getSpanishGrowthRate(pokemon.species.growth_rate.name)}</span>
                            </div>
                            <div class="py-2">
                                <span class="text-gray-400 block mb-2">EVs otorgados:</span>
                                <div class="flex flex-wrap gap-2">
                                    ${pokemon.stats.filter(s => s.effort > 0).map(s => `
                                        <span class="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-sm">
                                            +${s.effort} ${pokeAPI.statNames[s.stat.name]}
                                        </span>
                                    `).join('') || '<span class="text-gray-500">Ninguno</span>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Breeding & Gender -->
                <div class="grid lg:grid-cols-2 gap-6">
                    <div class="glass-panel rounded-2xl p-6">
                        <h2 class="font-orbitron text-xl font-bold text-pink-400 mb-4 flex items-center gap-2">
                            <i data-lucide="heart" class="w-5 h-5"></i>
                            Cría
                        </h2>
                        <div class="space-y-4">
                            <div>
                                <span class="text-gray-400 block mb-2">Grupos de huevo:</span>
                                <div class="flex flex-wrap gap-2">
                                    ${eggGroups.map(g => `
                                        <span class="bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full text-sm">${g}</span>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="flex justify-between items-center py-2 border-t border-white/10">
                                <span class="text-gray-400">Ciclos de huevo</span>
                                <span class="font-bold">${pokemon.species.hatch_counter} (${pokemon.species.hatch_counter * 255} pasos)</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="glass-panel rounded-2xl p-6">
                        <h2 class="font-orbitron text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                            <i data-lucide="users" class="w-5 h-5"></i>
                            Género
                        </h2>
                        ${genderRate === -1 ? `
                            <div class="text-center py-4">
                                <span class="text-gray-400">Sin género</span>
                            </div>
                        ` : `
                            <div class="space-y-4">
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-blue-400">♂ Macho</span>
                                        <span class="font-bold">${malePercent}%</span>
                                    </div>
                                    <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
                                        <div class="h-full bg-blue-500 rounded-full" style="width: ${malePercent}%"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-pink-400">♀ Hembra</span>
                                        <span class="font-bold">${femalePercent}%</span>
                                    </div>
                                    <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
                                        <div class="h-full bg-pink-500 rounded-full" style="width: ${femalePercent}%"></div>
                                    </div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Evolution Chain -->
                <div class="glass-panel rounded-2xl p-6">
                    <h2 class="font-orbitron text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                        <i data-lucide="git-branch" class="w-5 h-5"></i>
                        Línea Evolutiva
                    </h2>
                    <div id="evolution-chain" class="py-4">
                        <div class="text-center text-gray-400">Cargando evoluciones...</div>
                    </div>
                </div>
                
                <!-- Moves -->
                <div class="glass-panel rounded-2xl p-6">
                    <h2 class="font-orbitron text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
                        <i data-lucide="zap" class="w-5 h-5"></i>
                        Movimientos
                    </h2>
                    <div class="flex gap-2 mb-4 flex-wrap">
                        <button onclick="app.filterPokemonMoves('level-up')" class="move-filter px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/40 transition-all active">Por nivel</button>
                        <button onclick="app.filterPokemonMoves('machine')" class="move-filter px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all">MT/MO</button>
                        <button onclick="app.filterPokemonMoves('tutor')" class="move-filter px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all">Tutor</button>
                        <button onclick="app.filterPokemonMoves('egg')" class="move-filter px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all">Huevo</button>
                    </div>
                    <div id="moves-table" class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="text-gray-400 border-b border-white/10">
                                    <th class="text-left py-2">Movimiento</th>
                                    <th class="text-center py-2">Tipo</th>
                                    <th class="text-center py-2">Cat.</th>
                                    <th class="text-center py-2">Pot.</th>
                                    <th class="text-center py-2">Prec.</th>
                                    <th class="text-center py-2">PP</th>
                                </tr>
                            </thead>
                            <tbody id="moves-tbody">
                                <!-- Moves will be inserted here -->
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Locations -->
                <div class="glass-panel rounded-2xl p-6">
                    <h2 class="font-orbitron text-xl font-bold text-orange-400 mb-4 flex items-center gap-2">
                        <i data-lucide="map-pin" class="w-5 h-5"></i>
                        Ubicaciones
                    </h2>
                    <div id="locations-list" class="max-h-60 overflow-y-auto">
                        ${pokemon.location_area_encounters.length > 0 ? `
                            <div class="text-gray-400">Cargando ubicaciones...</div>
                        ` : `
                            <div class="text-center text-gray-500 py-4">
                                <i data-lucide="map-off" class="w-8 h-8 mx-auto mb-2"></i>
                                <p>No hay datos de ubicación disponibles</p>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Abilities -->
                <div class="glass-panel rounded-2xl p-6">
                    <h2 class="font-orbitron text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <i data-lucide="sparkles" class="w-5 h-5"></i>
                        Habilidades
                    </h2>
                    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${pokemon.abilities.map(a => `
                            <div class="glass-panel rounded-xl p-4 ${a.is_hidden ? 'border border-purple-500/50' : ''}">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="font-bold capitalize">${a.ability.name.replace('-', ' ')}</span>
                                    ${a.is_hidden ? '<span class="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">Oculta</span>' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        lucide.createIcons();
        
        // Render stats chart
        this.renderStatsChart(stats);
        
        // Load evolution chain
        this.loadEvolutionChain(pokemon.species.evolution_chain.url);
        
        // Load moves
        this.renderMoves(pokemon.moves, 'level-up');
        
        // Load locations
        this.loadLocations(pokemon.location_area_encounters);
    }
    
    renderStatsChart(stats) {
        const ctx = document.getElementById('stats-chart');
        if (!ctx) return;
        
        const labels = ['PS', 'Ataque', 'Defensa', 'At. Esp.', 'Def. Esp.', 'Velocidad'];
        const data = [
            stats.hp,
            stats.attack,
            stats.defense,
            stats['special-attack'],
            stats['special-defense'],
            stats.speed,
        ];
        
        if (this.charts.stats) {
            this.charts.stats.destroy();
        }
        
        this.charts.stats = new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [{
                    label: 'Estadísticas Base',
                    data,
                    backgroundColor: 'rgba(0, 243, 255, 0.2)',
                    borderColor: 'rgba(0, 243, 255, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(0, 243, 255, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(0, 243, 255, 1)',
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 150,
                        ticks: {
                            display: false,
                            stepSize: 30,
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                        },
                        angleLines: {
                            color: 'rgba(255, 255, 255, 0.1)',
                        },
                        pointLabels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                family: 'Rajdhani',
                                size: 12,
                            },
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                },
            },
        });
    }
    
    calculateMinTotal(stats) {
        const minStats = {
            hp: Math.floor(((2 * stats.hp + 0 + 0) * 100) / 100) + 100 + 10,
            attack: Math.floor((((2 * stats.attack + 0 + 0) * 100) / 100 + 5) * 0.9),
            defense: Math.floor((((2 * stats.defense + 0 + 0) * 100) / 100 + 5) * 0.9),
            'special-attack': Math.floor((((2 * stats['special-attack'] + 0 + 0) * 100) / 100 + 5) * 0.9),
            'special-defense': Math.floor((((2 * stats['special-defense'] + 0 + 0) * 100) / 100 + 5) * 0.9),
            speed: Math.floor((((2 * stats.speed + 0 + 0) * 100) / 100 + 5) * 0.9),
        };
        return Object.values(minStats).reduce((a, b) => a + b, 0);
    }
    
    calculateMaxTotal(stats) {
        const maxStats = {
            hp: pokeAPI.calculateMaxStat(stats.hp, true),
            attack: pokeAPI.calculateMaxStat(stats.attack),
            defense: pokeAPI.calculateMaxStat(stats.defense),
            'special-attack': pokeAPI.calculateMaxStat(stats['special-attack']),
            'special-defense': pokeAPI.calculateMaxStat(stats['special-defense']),
            speed: pokeAPI.calculateMaxStat(stats.speed),
        };
        return Object.values(maxStats).reduce((a, b) => a + b, 0);
    }
    
    async loadEvolutionChain(url) {
        const container = document.getElementById('evolution-chain');
        if (!container) return;
        
        try {
            const id = url.split('/').slice(-2, -1)[0];
            const chain = await pokeAPI.getEvolutionChain(id);
            
            const evolutions = this.parseEvolutionChain(chain.chain);
            
            container.innerHTML = `
                <div class="flex flex-wrap items-center justify-center gap-4">
                    ${evolutions.map((evo, index) => `
                        <div class="flex items-center gap-4">
                            ${index > 0 ? `
                                <div class="flex flex-col items-center text-gray-400">
                                    <i data-lucide="arrow-right" class="w-6 h-6"></i>
                                    <span class="text-xs">${evo.method}</span>
                                </div>
                            ` : ''}
                            <div class="glass-panel rounded-xl p-4 text-center cursor-pointer hover:bg-white/10 transition-all"
                                 onclick="app.navigate('detail', ${evo.id})">
                                <img src="${pokeAPI.getPokemonSpriteUrl(evo.id)}" 
                                     alt="${evo.name}" 
                                     class="w-20 h-20 mx-auto mb-2">
                                <p class="font-bold capitalize text-sm">${evo.name}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            lucide.createIcons();
            
        } catch (error) {
            container.innerHTML = '<div class="text-center text-gray-500">No hay información de evolución</div>';
        }
    }
    
    parseEvolutionChain(chain) {
        const evolutions = [];
        
        const extractEvolution = (evo) => {
            const id = evo.species.url.split('/').slice(-2, -1)[0];
            let method = 'Nivel';
            
            if (evo.evolution_details && evo.evolution_details.length > 0) {
                const detail = evo.evolution_details[0];
                if (detail.min_level) method = `Nivel ${detail.min_level}`;
                else if (detail.item) method = detail.item.name;
                else if (detail.trigger && detail.trigger.name === 'trade') method = 'Intercambio';
                else if (detail.min_happiness) method = 'Amistad';
            }
            
            evolutions.push({
                id,
                name: evo.species.name,
                method,
            });
            
            if (evo.evolves_to) {
                evo.evolves_to.forEach(e => extractEvolution(e));
            }
        };
        
        // Add base pokemon
        const baseId = chain.species.url.split('/').slice(-2, -1)[0];
        evolutions.push({
            id: baseId,
            name: chain.species.name,
            method: 'Base',
        });
        
        if (chain.evolves_to) {
            chain.evolves_to.forEach(e => extractEvolution(e));
        }
        
        return evolutions;
    }
    
    async renderMoves(moves, filterMethod) {
        const tbody = document.getElementById('moves-tbody');
        if (!tbody) return;
        
        const filteredMoves = moves.filter(m => {
            const versionDetail = m.version_group_details[0];
            if (!versionDetail) return false;
            return versionDetail.move_learn_method.name === filterMethod;
        });
        
        if (filteredMoves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No hay movimientos disponibles</td></tr>';
            return;
        }
        
        // Sort by level if level-up
        if (filterMethod === 'level-up') {
            filteredMoves.sort((a, b) => {
                const levelA = a.version_group_details[0].level_learned_at;
                const levelB = b.version_group_details[0].level_learned_at;
                return levelA - levelB;
            });
        }
        
        // Load move details
        const moveDetails = await Promise.all(
            filteredMoves.slice(0, 20).map(async m => {
                try {
                    return await pokeAPI.getMove(m.move.name);
                } catch (e) {
                    return null;
                }
            })
        );
        
        tbody.innerHTML = moveDetails.filter(m => m !== null).map((move, index) => {
            const versionDetail = filteredMoves[index].version_group_details[0];
            const levelInfo = filterMethod === 'level-up' ? 
                `<span class="text-cyan-400 text-xs ml-1">Nv.${versionDetail.level_learned_at}</span>` : '';
            const nameES = pokeAPI.getSpanishMoveName(move);
            const typeES = pokeAPI.typeNamesES[move.type?.name] || move.type?.name || '?';
            const categoryES = pokeAPI.damageClassES[move.damage_class?.name] || '?';
            const catColor = move.damage_class?.name === 'physical' ? 'text-orange-400' :
                             move.damage_class?.name === 'special' ? 'text-blue-400' : 'text-gray-400';
            
            return `
                <tr class="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td class="py-2 pr-2">
                        <span class="font-medium">${nameES}</span>
                        ${levelInfo}
                    </td>
                    <td class="text-center py-2">
                        <span class="${pokeAPI.typeColors[move.type?.name]?.bg || 'bg-gray-600'} text-white text-xs px-2 py-0.5 rounded-full">
                            ${typeES}
                        </span>
                    </td>
                    <td class="text-center py-2">
                        <span class="${catColor} text-xs">${categoryES}</span>
                    </td>
                    <td class="text-center py-2">${move.power || '\u2014'}</td>
                    <td class="text-center py-2">${move.accuracy || '\u2014'}</td>
                    <td class="text-center py-2">${move.pp}</td>
                </tr>
            `;
        }).join('');
    }
    
    filterPokemonMoves(method) {
        // Update active button
        document.querySelectorAll('.move-filter').forEach(btn => {
            btn.classList.remove('bg-cyan-500/20', 'text-cyan-400', 'active');
            btn.classList.add('bg-white/10');
        });
        event.target.classList.add('bg-cyan-500/20', 'text-cyan-400', 'active');
        event.target.classList.remove('bg-white/10');
        
        if (this.currentPokemon) {
            this.renderMoves(this.currentPokemon.moves, method);
        }
    }
    
    async loadLocations(url) {
        const container = document.getElementById('locations-list');
        if (!container) return;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-gray-500 py-4">
                        <i data-lucide="map-off" class="w-8 h-8 mx-auto mb-2"></i>
                        <p>No hay datos de ubicación disponibles</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }
            
            // Group by version
            const locationsByVersion = {};
            data.forEach(encounter => {
                encounter.version_details.forEach(vd => {
                    const version = vd.version.name;
                    if (!locationsByVersion[version]) {
                        locationsByVersion[version] = new Set();
                    }
                    locationsByVersion[version].add(encounter.location_area.name);
                });
            });
            
            container.innerHTML = Object.entries(locationsByVersion).slice(0, 10).map(([version, locations]) => `
                <div class="mb-3">
                    <span class="text-cyan-400 font-bold text-sm uppercase">${version.replace('-', ' ')}</span>
                    <div class="flex flex-wrap gap-1 mt-1">
                        ${Array.from(locations).slice(0, 5).map(loc => `
                            <span class="text-xs bg-white/10 px-2 py-1 rounded">${loc.replace(/-/g, ' ')}</span>
                        `).join('')}
                        ${locations.size > 5 ? `<span class="text-xs text-gray-500">+${locations.size - 5} más</span>` : ''}
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <i data-lucide="map-off" class="w-8 h-8 mx-auto mb-2"></i>
                    <p>Error al cargar ubicaciones</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
    
    switchImage(variant, id) {
        const img = document.getElementById('main-image');
        if (!img) return;
        img.classList.add('image-switching');
        
        switch (variant) {
            case 'shiny':
                img.src = pokeAPI.getPokemonImageUrl(id, 'shiny');
                break;
            case 'back':
                img.src = pokeAPI.getPokemonSpriteUrl(id, 'back');
                break;
            default:
                img.src = this.getPreferredArtworkUrl(id, false);
        }
        setTimeout(() => img.classList.remove('image-switching'), 260);
    }
    
    playCry(id) {
        const audio = new Audio(pokeAPI.getPokemonCryUrl(id));
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // ==================== FAVORITES & CAPTURED ====================
    
    toggleFavorite(id) {
        this.favorites = this.collection.toggleFavorite(id);
        if (this.currentView === 'detail' && this.currentPokemon?.id === id) {
            this.renderPokemonDetail(this.currentPokemon);
        } else if (this.currentView === 'list') {
            this.renderPokemonList();
        } else if (this.currentView === 'favorites') {
            this.renderFavorites();
        }
        this.updateDashboardStats();
        this.applyFilters();
    }
    
    toggleCaptured(id) {
        this.captured = this.collection.toggleCaptured(id);
        if (this.currentView === 'detail' && this.currentPokemon?.id === id) {
            this.renderPokemonDetail(this.currentPokemon);
        } else if (this.currentView === 'list') {
            this.renderPokemonList();
        }
        this.updateDashboardStats();
        this.applyFilters();
    }
    
    renderFavorites() {
        const grid = document.getElementById('favorites-grid');
        const noFavorites = document.getElementById('no-favorites');
        this.renderCollectionLists();
        
        if (this.favorites.length === 0) {
            grid.innerHTML = '';
            noFavorites.classList.remove('hidden');
            return;
        }
        
        noFavorites.classList.add('hidden');
        
        // Load favorite pokemon details
        Promise.all(this.favorites.map(id => pokeAPI.getPokemon(id)))
            .then(pokemonList => {
                grid.innerHTML = pokemonList.map(pokemon => this.createPokemonCard(pokemon)).join('');
                lucide.createIcons();
            })
            .catch(error => {
                grid.innerHTML = '<div class="text-center text-red-400 col-span-full">Error al cargar favoritos</div>';
            });
    }
    
    // ==================== SEARCH & FILTERS ====================
    
    handleSearch(query) {
        if (!query.trim()) {
            this.filteredList = [...this.pokemonList];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredList = this.pokemonList.filter(p => 
                p.name.toLowerCase().includes(lowerQuery) ||
                String(p.id).includes(lowerQuery)
            );
        }
        
        this.applyFilters();
    }
    
    async populateFilterOptions() {
        try {
            const types = await pokeAPI.getAllTypes();
            const typeSelect = document.getElementById('filter-type');
            const secondarySelect = document.getElementById('filter-type-secondary');
            if (typeSelect) {
                types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.name;
                    option.textContent = pokeAPI.typeNamesES[type.name] || type.name.charAt(0).toUpperCase() + type.name.slice(1);
                    typeSelect.appendChild(option);
                    if (secondarySelect) secondarySelect.appendChild(option.cloneNode(true));
                });
            }
        } catch(e) { console.warn('populateFilterOptions error:', e); }
    }
    
    applyFilters() {
        this.favorites = this.collection.getFavorites();
        this.captured = this.collection.getCaptured();
        this.pokemonIndex = PokedexFilters.buildIndex(this.pokemonList);
        this.filteredList = PokedexFilters.apply(this.pokemonIndex, {
            query: document.getElementById('search-input')?.value || '',
            type: document.getElementById('filter-type')?.value || '',
            secondaryType: document.getElementById('filter-type-secondary')?.value || '',
            generation: document.getElementById('filter-gen')?.value || '',
            ability: document.getElementById('filter-ability')?.value || '',
            minBST: document.getElementById('filter-bst-min')?.value || 0,
            sort: document.getElementById('filter-sort')?.value || 'id-asc',
            showOnlyCaptured: document.getElementById('filter-only-captured')?.checked || false,
            showOnlyFavorites: document.getElementById('filter-only-favorites')?.checked || false,
            favoriteIds: this.favorites,
            capturedIds: this.captured,
        });
        this.renderPokemonList();
        
        const countEl = document.getElementById('pokemon-count');
        if (countEl) countEl.textContent = `${this.filteredList.length} Pokémon encontrados`;
    }
    
    resetFilters() {
        const si = document.getElementById('search-input'); if (si) si.value = '';
        const ft = document.getElementById('filter-type');  if (ft) ft.value = '';
        const fs = document.getElementById('filter-type-secondary'); if (fs) fs.value = '';
        const fg = document.getElementById('filter-gen');   if (fg) fg.value = '';
        const fa = document.getElementById('filter-ability'); if (fa) fa.value = '';
        const fb = document.getElementById('filter-bst-min'); if (fb) fb.value = '';
        const fo = document.getElementById('filter-sort'); if (fo) fo.value = 'id-asc';
        const fc = document.getElementById('filter-only-captured'); if (fc) fc.checked = false;
        const ff = document.getElementById('filter-only-favorites'); if (ff) ff.checked = false;
        
        this.filteredList = [...this.pokemonList];
        this.renderPokemonList();
        
        const countEl = document.getElementById('pokemon-count');
        if (countEl) countEl.textContent = `${this.pokemonList.length} Pokémon`;
    }
    
    // ==================== TYPE CALCULATOR ====================
    
    renderTypeSelectors() {
        const types = Object.keys(pokeAPI.typeEffectiveness);
        
        const createTypeButtons = (containerId, slot) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            container.innerHTML = types.map(type => `
                <button onclick="app.selectType(${slot}, '${type}')" 
                        class="type-btn-${slot} p-2 rounded-lg ${pokeAPI.typeColors[type]?.bg || 'bg-gray-600'} text-white text-xs hover:scale-110 transition-all"
                        data-type="${type}">
                    ${pokeAPI.typeNamesES[type] || type}
                </button>
            `).join('');
        };
        
        createTypeButtons('type-selector-1', 0);
        createTypeButtons('type-selector-2', 1);
    }
    
    selectType(slot, type) {
        this.selectedTypes[slot] = this.selectedTypes[slot] === type ? null : type;
        
        // Update button styles
        document.querySelectorAll(`.type-btn-${slot}`).forEach(btn => {
            if (btn.dataset.type === this.selectedTypes[slot]) {
                btn.classList.add('ring-2', 'ring-white', 'scale-110');
            } else {
                btn.classList.remove('ring-2', 'ring-white', 'scale-110');
            }
        });
        
        this.renderEffectivenessResults();
    }
    
    renderEffectivenessResults() {
        const container = document.getElementById('effectiveness-results');
        if (!container) return;
        
        const activeTypes = this.selectedTypes.filter(t => t !== null);
        
        if (activeTypes.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-8">Selecciona al menos un tipo para ver las efectividades</p>';
            return;
        }
        
        const effectiveness = pokeAPI.getAllEffectiveness(activeTypes);
        
        const renderTypeList = (types, colorClass) => {
            if (types.length === 0) return '<span class="text-gray-500 text-sm">Ninguno</span>';
            return types.map(type => `
                <span class="${pokeAPI.typeColors[type]?.bg || 'bg-gray-600'} text-white text-xs px-2 py-1 rounded-full uppercase">
                    ${type}
                </span>
            `).join('');
        };
        
        container.innerHTML = `
            <div class="space-y-4">
                <div class="glass-panel rounded-xl p-4 border-l-4 border-red-500">
                    <h4 class="font-bold text-red-400 mb-2">4x Daño (Muy débil)</h4>
                    <div class="flex flex-wrap gap-2">${renderTypeList(effectiveness['4x'])}</div>
                </div>
                <div class="glass-panel rounded-xl p-4 border-l-4 border-orange-500">
                    <h4 class="font-bold text-orange-400 mb-2">2x Daño (Débil)</h4>
                    <div class="flex flex-wrap gap-2">${renderTypeList(effectiveness['2x'])}</div>
                </div>
                <div class="glass-panel rounded-xl p-4 border-l-4 border-gray-500">
                    <h4 class="font-bold text-gray-400 mb-2">1x Daño (Normal)</h4>
                    <div class="flex flex-wrap gap-2">${renderTypeList(effectiveness['1x'])}</div>
                </div>
                <div class="glass-panel rounded-xl p-4 border-l-4 border-green-500">
                    <h4 class="font-bold text-green-400 mb-2">0.5x Daño (Resistente)</h4>
                    <div class="flex flex-wrap gap-2">${renderTypeList(effectiveness['0.5x'])}</div>
                </div>
                <div class="glass-panel rounded-xl p-4 border-l-4 border-emerald-500">
                    <h4 class="font-bold text-emerald-400 mb-2">0.25x Daño (Muy resistente)</h4>
                    <div class="flex flex-wrap gap-2">${renderTypeList(effectiveness['0.25x'])}</div>
                </div>
                <div class="glass-panel rounded-xl p-4 border-l-4 border-purple-500">
                    <h4 class="font-bold text-purple-400 mb-2">0x Daño (Inmune)</h4>
                    <div class="flex flex-wrap gap-2">${renderTypeList(effectiveness['0x'])}</div>
                </div>
            </div>
        `;
    }
    
    // ==================== COMPARE ====================
    
    renderCompareView() {
        // Reset compare state
        this.comparePokemon = [null, null];
        document.getElementById('compare-search-1').value = '';
        document.getElementById('compare-search-2').value = '';
        document.getElementById('compare-pokemon-1').innerHTML = `
            <i data-lucide="search" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
            <p>Selecciona un Pokémon</p>
        `;
        document.getElementById('compare-pokemon-2').innerHTML = `
            <i data-lucide="search" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
            <p>Selecciona un Pokémon</p>
        `;
        document.getElementById('compare-stats').classList.add('hidden');
        lucide.createIcons();
    }
    
    async searchComparePokemon(slot, query) {
        const resultsContainer = document.getElementById(`compare-results-${slot}`);
        
        if (!query.trim()) {
            resultsContainer.classList.add('hidden');
            return;
        }
        
        try {
            const results = await pokeAPI.searchPokemon(query);
            const limitedResults = results.slice(0, 5);
            
            resultsContainer.innerHTML = limitedResults.map(p => {
                const id = p.url.split('/').slice(-2, -1)[0];
                return `
                    <div class="p-3 hover:bg-white/10 cursor-pointer flex items-center gap-3"
                         onclick="app.selectComparePokemon(${slot}, ${id})">
                        <img src="${pokeAPI.getPokemonSpriteUrl(id)}" class="w-8 h-8">
                        <span class="capitalize">${p.name}</span>
                        <span class="text-gray-500 text-sm ml-auto">${pokeAPI.formatId(id)}</span>
                    </div>
                `;
            }).join('');
            
            resultsContainer.classList.remove('hidden');
            
        } catch (error) {
            resultsContainer.classList.add('hidden');
        }
    }
    
    async selectComparePokemon(slot, id) {
        document.getElementById(`compare-results-${slot}`).classList.add('hidden');
        document.getElementById(`compare-search-${slot}`).value = '';
        
        try {
            const pokemon = await pokeAPI.getPokemon(id);
            this.comparePokemon[slot - 1] = pokemon;
            
            const container = document.getElementById(`compare-pokemon-${slot}`);
            const types = pokemon.types.map(t => t.type.name);
            
            container.innerHTML = `
                <div class="text-center">
                    <img src="${pokeAPI.getPokemonImageUrl(id)}" 
                         alt="${pokemon.name}" 
                         class="w-32 h-32 mx-auto mb-2 object-contain">
                    <h3 class="font-orbitron font-bold text-xl capitalize">${pokemon.name}</h3>
                    <span class="text-gray-400">${pokeAPI.formatId(id)}</span>
                    <div class="flex gap-2 justify-center mt-2">
                        ${types.map(type => `
                            <span class="${pokeAPI.typeColors[type]?.bg || 'bg-gray-600'} text-white text-xs px-2 py-1 rounded-full">
                                ${pokeAPI.typeNamesES[type] || type}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
            
            this.updateCompareChart();
            
        } catch (error) {
            console.error('Error loading compare pokemon:', error);
        }
    }
    
    updateCompareChart() {
        const statsContainer = document.getElementById('compare-stats');
        
        if (!this.comparePokemon[0] || !this.comparePokemon[1]) {
            statsContainer.classList.add('hidden');
            return;
        }
        
        statsContainer.classList.remove('hidden');
        
        const p1 = this.comparePokemon[0];
        const p2 = this.comparePokemon[1];
        
        const stats1 = {
            hp: p1.stats.find(s => s.stat.name === 'hp')?.base_stat || 0,
            attack: p1.stats.find(s => s.stat.name === 'attack')?.base_stat || 0,
            defense: p1.stats.find(s => s.stat.name === 'defense')?.base_stat || 0,
            'special-attack': p1.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0,
            'special-defense': p1.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0,
            speed: p1.stats.find(s => s.stat.name === 'speed')?.base_stat || 0,
        };
        
        const stats2 = {
            hp: p2.stats.find(s => s.stat.name === 'hp')?.base_stat || 0,
            attack: p2.stats.find(s => s.stat.name === 'attack')?.base_stat || 0,
            defense: p2.stats.find(s => s.stat.name === 'defense')?.base_stat || 0,
            'special-attack': p2.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0,
            'special-defense': p2.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0,
            speed: p2.stats.find(s => s.stat.name === 'speed')?.base_stat || 0,
        };
        
        const labels = ['PS', 'Ataque', 'Defensa', 'At. Esp.', 'Def. Esp.', 'Velocidad'];
        const data1 = [stats1.hp, stats1.attack, stats1.defense, stats1['special-attack'], stats1['special-defense'], stats1.speed];
        const data2 = [stats2.hp, stats2.attack, stats2.defense, stats2['special-attack'], stats2['special-defense'], stats2.speed];
        
        if (this.charts.compare) {
            this.charts.compare.destroy();
        }
        
        const ctx = document.getElementById('compare-chart');
        this.charts.compare = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: p1.name.charAt(0).toUpperCase() + p1.name.slice(1),
                        data: data1,
                        backgroundColor: 'rgba(0, 243, 255, 0.6)',
                        borderColor: 'rgba(0, 243, 255, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: p2.name.charAt(0).toUpperCase() + p2.name.slice(1),
                        data: data2,
                        backgroundColor: 'rgba(255, 0, 255, 0.6)',
                        borderColor: 'rgba(255, 0, 255, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 150,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                        },
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                        },
                    },
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                        },
                    },
                },
            },
        });
    }
    // ==================== TABLA DE TIPOS ====================
    
    renderTypeChart() {
        const container = document.getElementById('type-chart-table');
        if (!container) return;
        
        const types = Object.keys(pokeAPI.typeEffectiveness);
        
        const getMultiplier = (attackType, defendType) => {
            const eff = pokeAPI.typeEffectiveness[defendType];
            if (!eff) return 1;
            if (eff.immune.includes(attackType)) return 0;
            if (eff.weak.includes(attackType)) return 2;
            if (eff.resist.includes(attackType)) return 0.5;
            return 1;
        };
        
        const getCellStyle = (mult) => {
            if (mult === 0) return 'background:rgba(20,20,35,0.95);color:#374151;';
            if (mult === 2) return 'background:rgba(220,38,38,0.8);color:#fff;font-weight:700;';
            if (mult === 0.5) return 'background:rgba(21,128,61,0.8);color:#fff;';
            return 'background:rgba(255,255,255,0.04);color:#6b7280;';
        };
        
        const getCellText = (mult) => {
            if (mult === 0) return '0';
            if (mult === 2) return '×2';
            if (mult === 0.5) return '½';
            return '·';
        };
        
        // Color map from Tailwind classes to hex
        const colorMap = {
            'bg-[#A8A878]':'#A8A878','bg-[#F08030]':'#F08030','bg-[#6890F0]':'#6890F0',
            'bg-[#F8D030]':'#F8D030','bg-[#78C850]':'#78C850','bg-[#98D8D8]':'#98D8D8',
            'bg-[#C03028]':'#C03028','bg-[#A040A0]':'#A040A0','bg-[#E0C068]':'#E0C068',
            'bg-[#A890F0]':'#A890F0','bg-[#F85888]':'#F85888','bg-[#A8B820]':'#A8B820',
            'bg-[#B8A038]':'#B8A038','bg-[#705898]':'#705898','bg-[#7038F8]':'#7038F8',
            'bg-[#705848]':'#705848','bg-[#B8B8D0]':'#B8B8D0','bg-[#EE99AC]':'#EE99AC',
        };
        
        // Header row (defender column labels)
        const headerRow = `<tr>
            <th style="position:sticky;left:0;z-index:20;background:rgba(10,10,20,0.98);padding:4px;">
                <div style="width:68px;font-size:9px;color:#6b7280;text-align:center;line-height:1.4;padding:4px;">
                    Atk↓ vs Def→
                </div>
            </th>
            ${types.map(t => {
                const color = colorMap[pokeAPI.typeColors[t]?.bg] || '#6b7280';
                const name = pokeAPI.typeNamesES[t] || t;
                return `<th style="padding:2px;vertical-align:bottom;">
                    <div style="writing-mode:vertical-rl;transform:rotate(180deg);background:${color};color:#fff;font-size:9px;font-weight:700;padding:4px 3px;border-radius:4px;min-height:50px;display:flex;align-items:center;justify-content:center;width:22px;">
                        ${name}
                    </div>
                </th>`;
            }).join('')}
        </tr>`;
        
        // Body rows (attacker row labels + cells)
        const bodyRows = types.map(attackType => {
            const color = colorMap[pokeAPI.typeColors[attackType]?.bg] || '#6b7280';
            const cells = types.map(defendType => {
                const mult = getMultiplier(attackType, defendType);
                return `<td style="padding:2px;">
                    <div style="${getCellStyle(mult)};width:26px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:3px;font-size:11px;">
                        ${getCellText(mult)}
                    </div>
                </td>`;
            }).join('');
            return `<tr>
                <td style="position:sticky;left:0;z-index:10;background:rgba(10,10,20,0.98);padding:2px;">
                    <div style="background:${color};color:#fff;font-size:9px;font-weight:700;padding:3px 6px;border-radius:4px;white-space:nowrap;width:64px;text-align:center;">
                        ${pokeAPI.typeNamesES[attackType] || attackType}
                    </div>
                </td>
                ${cells}
            </tr>`;
        }).join('');
        
        container.innerHTML = `
            <table style="border-collapse:separate;border-spacing:0;min-width:max-content;">
                <thead>${headerRow}</thead>
                <tbody>${bodyRows}</tbody>
            </table>
        `;
    }
    
    // ==================== SECCIÓN DE MOVIMIENTOS ====================
    
    async initMovesView() {
        const typeFilter = document.getElementById('moves-filter-type');
        if (typeFilter && typeFilter.options.length === 1) {
            Object.entries(pokeAPI.typeNamesES).forEach(([key, value]) => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = value;
                typeFilter.appendChild(opt);
            });
        }
        if (this.movesData.length === 0) {
            await this.loadMovesBatch();
        } else {
            this.applyMovesFilters();
        }
    }
    
    async loadMovesBatch() {
        if (this.isLoadingMoves || this.allMovesLoaded) return;
        this.isLoadingMoves = true;
        const loadingEl = document.getElementById('moves-loading');
        if (loadingEl) loadingEl.classList.remove('hidden');
        
        try {
            const data = await pokeAPI.getMoveList(this.movesOffset, this.movesLimit);
            if (!data.next) this.allMovesLoaded = true;
            
            const moveDetails = await Promise.all(
                data.results.map(async (m) => {
                    try { return await pokeAPI.getMove(m.name); }
                    catch { return null; }
                })
            );
            
            const valid = moveDetails.filter(m => m !== null);
            this.movesData = [...this.movesData, ...valid];
            this.movesOffset += this.movesLimit;
            this.applyMovesFilters();
            
            const countEl = document.getElementById('moves-count');
            if (countEl) countEl.textContent = `${this.movesData.length}${this.allMovesLoaded ? '' : '+'} movimientos`;
        } catch (err) {
            console.error('Error al cargar movimientos:', err);
        } finally {
            this.isLoadingMoves = false;
            const loadingEl = document.getElementById('moves-loading');
            if (loadingEl && this.allMovesLoaded) loadingEl.classList.add('hidden');
        }
    }
    
    handleMovesScroll() {
        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        if (scrollPosition >= documentHeight - 800 && !this.isLoadingMoves) {
            this.loadMovesBatch();
        }
    }
    
    applyMovesFilters() {
        let filtered = [...this.movesData];
        if (this.movesSearchQuery) {
            const q = this.movesSearchQuery.toLowerCase();
            filtered = filtered.filter(m => {
                const nameES = pokeAPI.getSpanishMoveName(m).toLowerCase();
                return nameES.includes(q) || m.name.replace(/-/g, ' ').includes(q);
            });
        }
        if (this.movesTypeFilter) {
            filtered = filtered.filter(m => m.type?.name === this.movesTypeFilter);
        }
        if (this.movesCategoryFilter) {
            filtered = filtered.filter(m => m.damage_class?.name === this.movesCategoryFilter);
        }
        this.filteredMoves = filtered;
        this.renderMovesGrid();
        const countEl = document.getElementById('moves-count');
        if (countEl && (this.movesSearchQuery || this.movesTypeFilter || this.movesCategoryFilter)) {
            countEl.textContent = `${this.filteredMoves.length} encontrados`;
        }
    }
    
    searchMoves(query) {
        this.movesSearchQuery = query;
        this.applyMovesFilters();
    }
    
    filterMovesView() {
        this.movesTypeFilter = document.getElementById('moves-filter-type')?.value || '';
        this.movesCategoryFilter = document.getElementById('moves-filter-category')?.value || '';
        this.applyMovesFilters();
    }
    
    renderMovesGrid() {
        const grid = document.getElementById('moves-grid');
        if (!grid) return;
        if (this.filteredMoves.length === 0 && !this.isLoadingMoves) {
            grid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-500 text-sm">No se encontraron movimientos</div>';
            return;
        }
        grid.innerHTML = this.filteredMoves.map(move => this.createMoveCard(move)).join('');
        lucide.createIcons();
    }
    
    createMoveCard(move) {
        const nameES = pokeAPI.getSpanishMoveName(move);
        const typeBg = pokeAPI.typeColors[move.type?.name]?.bg || 'bg-gray-600';
        const typeNameES = pokeAPI.typeNamesES[move.type?.name] || move.type?.name || '?';
        const categoryES = pokeAPI.damageClassES[move.damage_class?.name] || '?';
        const description = pokeAPI.getSpanishMoveDescription(move);
        const catColor = move.damage_class?.name === 'physical' ? 'text-orange-400' :
                         move.damage_class?.name === 'special' ? 'text-blue-400' : 'text-gray-400';
        const catIcon = move.damage_class?.name === 'physical' ? '💪' :
                        move.damage_class?.name === 'special' ? '⚡' : '🔄';
        return `
            <div class="glass-panel rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all pokemon-card"
                 onclick="app.showMoveDetail('${move.name}')">
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-bold text-sm leading-tight pr-2">${nameES}</h3>
                    <span class="${typeBg} text-white text-[10px] px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">${typeNameES}</span>
                </div>
                <div class="mb-3">
                    <span class="${catColor} text-xs">${catIcon} ${categoryES}</span>
                </div>
                <div class="grid grid-cols-3 gap-1 text-center text-xs mb-3">
                    <div class="glass-panel rounded p-1">
                        <div class="text-gray-500 text-[10px]">Potencia</div>
                        <div class="font-bold">${move.power || '—'}</div>
                    </div>
                    <div class="glass-panel rounded p-1">
                        <div class="text-gray-500 text-[10px]">Precisión</div>
                        <div class="font-bold">${move.accuracy || '—'}</div>
                    </div>
                    <div class="glass-panel rounded p-1">
                        <div class="text-gray-500 text-[10px]">PP</div>
                        <div class="font-bold">${move.pp || '—'}</div>
                    </div>
                </div>
                <p class="text-gray-400 text-xs leading-relaxed line-clamp-2">${description}</p>
            </div>
        `;
    }
    
    async showMoveDetail(moveName) {
        const move = this.movesData.find(m => m.name === moveName);
        if (!move) return;
        
        const nameES = pokeAPI.getSpanishMoveName(move);
        const typeBg = pokeAPI.typeColors[move.type?.name]?.bg || 'bg-gray-600';
        const typeNameES = pokeAPI.typeNamesES[move.type?.name] || move.type?.name || '?';
        const categoryES = pokeAPI.damageClassES[move.damage_class?.name] || '?';
        const description = pokeAPI.getSpanishMoveDescription(move);
        const learnedBy = move.learned_by_pokemon?.slice(0, 24) || [];
        const totalLearners = move.learned_by_pokemon?.length || 0;
        
        document.getElementById('move-modal')?.remove();
        
        const modal = document.createElement('div');
        modal.id = 'move-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="glass-panel rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in neon-border">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h2 class="font-orbitron text-xl font-bold">${nameES}</h2>
                        <p class="text-gray-500 text-xs mt-1 capitalize">${move.name.replace(/-/g, ' ')}</p>
                    </div>
                    <button onclick="document.getElementById('move-modal').remove()"
                            class="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all ml-4 shrink-0">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    <span class="${typeBg} text-white px-3 py-1 rounded-full text-sm font-bold">${typeNameES}</span>
                    <span class="bg-white/10 text-white px-3 py-1 rounded-full text-sm">${categoryES}</span>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-4">
                    <div class="glass-panel rounded-xl p-3 text-center">
                        <div class="text-gray-400 text-xs mb-1">Potencia</div>
                        <div class="font-orbitron font-bold text-xl">${move.power || '—'}</div>
                    </div>
                    <div class="glass-panel rounded-xl p-3 text-center">
                        <div class="text-gray-400 text-xs mb-1">Precisión</div>
                        <div class="font-orbitron font-bold text-xl">${move.accuracy || '—'}</div>
                    </div>
                    <div class="glass-panel rounded-xl p-3 text-center">
                        <div class="text-gray-400 text-xs mb-1">PP</div>
                        <div class="font-orbitron font-bold text-xl">${move.pp || '—'}</div>
                    </div>
                </div>
                <div class="glass-panel rounded-xl p-4 mb-4">
                    <p class="text-gray-300 leading-relaxed text-sm">${description || 'Sin descripción disponible.'}</p>
                </div>
                ${totalLearners > 0 ? `
                    <div>
                        <h3 class="font-orbitron text-sm font-bold text-cyan-400 mb-3">
                            Pokémon que aprenden este movimiento
                            <span class="text-gray-500 font-normal text-xs">(${totalLearners} en total)</span>
                        </h3>
                        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            ${learnedBy.map(p => {
                                const id = p.url.split('/').slice(-2, -1)[0];
                                return `
                                    <div class="glass-panel rounded-lg p-2 text-center cursor-pointer hover:bg-white/10 transition-all"
                                         onclick="document.getElementById('move-modal').remove(); app.navigate('detail', ${id})">
                                        <img src="${pokeAPI.getPokemonSpriteUrl(id)}"
                                             alt="${p.name}"
                                             class="w-10 h-10 mx-auto object-contain"
                                             onerror="this.style.display='none'">
                                        <p class="text-[9px] capitalize mt-1 truncate">${p.name.replace(/-/g, ' ')}</p>
                                    </div>
                                `;
                            }).join('')}
                            ${totalLearners > 24 ? `
                                <div class="col-span-full text-center text-gray-500 text-xs py-2">
                                    ... y ${totalLearners - 24} Pokémon más
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : '<p class="text-gray-500 text-sm">Ningún Pokémon aprende este movimiento por métodos estándar.</p>'}
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        lucide.createIcons();
    }
    
    // ==================== SECCIÓN DE OBJETOS ====================
    
    async initItemsView() {
        if (this.itemsData.length === 0) {
            await this.loadItemsBatch();
        } else {
            this.applyItemsFilters();
        }
    }
    
    async loadItemsBatch() {
        if (this.isLoadingItems || this.allItemsLoaded) return;
        this.isLoadingItems = true;
        const loadingEl = document.getElementById('items-loading');
        if (loadingEl) loadingEl.classList.remove('hidden');
        
        try {
            const data = await pokeAPI.getItemList(this.itemsOffset, this.itemsLimit);
            if (!data.next) this.allItemsLoaded = true;
            
            const itemDetails = await Promise.all(
                data.results.map(async (item) => {
                    try { return await pokeAPI.getItem(item.name); }
                    catch { return null; }
                })
            );
            
            const valid = itemDetails.filter(i => i !== null);
            this.itemsData = [...this.itemsData, ...valid];
            this.itemsOffset += this.itemsLimit;
            this.updateItemCategoryFilter();
            this.applyItemsFilters();
            
            const countEl = document.getElementById('items-count');
            if (countEl) countEl.textContent = `${this.itemsData.length}${this.allItemsLoaded ? '' : '+'} objetos`;
        } catch (err) {
            console.error('Error al cargar objetos:', err);
        } finally {
            this.isLoadingItems = false;
            const loadingEl = document.getElementById('items-loading');
            if (loadingEl && this.allItemsLoaded) loadingEl.classList.add('hidden');
        }
    }
    
    handleItemsScroll() {
        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        if (scrollPosition >= documentHeight - 800 && !this.isLoadingItems) {
            this.loadItemsBatch();
        }
    }
    
    updateItemCategoryFilter() {
        const select = document.getElementById('items-filter-category');
        if (!select) return;
        const categories = new Set(this.itemsData.map(i => i.category?.name).filter(Boolean));
        const existingValues = new Set(Array.from(select.options).map(o => o.value));
        categories.forEach(cat => {
            if (!existingValues.has(cat)) {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = pokeAPI.getItemCategoryES(cat);
                select.appendChild(opt);
            }
        });
    }
    
    applyItemsFilters() {
        let filtered = [...this.itemsData];
        if (this.itemsSearchQuery) {
            const q = this.itemsSearchQuery.toLowerCase();
            filtered = filtered.filter(item => {
                const nameES = pokeAPI.getSpanishItemName(item).toLowerCase();
                return nameES.includes(q) || item.name.replace(/-/g, ' ').toLowerCase().includes(q);
            });
        }
        if (this.itemsCategoryFilter) {
            filtered = filtered.filter(i => i.category?.name === this.itemsCategoryFilter);
        }
        this.filteredItems = filtered;
        this.renderItemsGrid();
        const countEl = document.getElementById('items-count');
        if (countEl && (this.itemsSearchQuery || this.itemsCategoryFilter)) {
            countEl.textContent = `${this.filteredItems.length} encontrados`;
        }
    }
    
    searchItems(query) {
        this.itemsSearchQuery = query;
        this.applyItemsFilters();
    }
    
    filterItems() {
        this.itemsCategoryFilter = document.getElementById('items-filter-category')?.value || '';
        this.applyItemsFilters();
    }
    
    renderItemsGrid() {
        const grid = document.getElementById('items-grid');
        if (!grid) return;
        if (this.filteredItems.length === 0 && !this.isLoadingItems) {
            grid.innerHTML = '<div class="col-span-full text-center py-20 text-gray-500 text-sm">No se encontraron objetos</div>';
            return;
        }
        grid.innerHTML = this.filteredItems.map(item => this.createItemCard(item)).join('');
        lucide.createIcons();
    }
    
    createItemCard(item) {
        const nameES = pokeAPI.getSpanishItemName(item);
        const description = pokeAPI.getSpanishItemDescription(item);
        const categoryES = pokeAPI.getItemCategoryES(item.category?.name || '');
        const imgUrl = item.sprites?.default || '';
        return `
            <div class="glass-panel rounded-xl p-3 hover:bg-white/10 transition-all pokemon-card text-center">
                <div class="h-12 flex items-center justify-center mb-2">
                    ${imgUrl ?
                        `<img src="${imgUrl}" alt="" class="w-10 h-10 object-contain drop-shadow-lg" loading="lazy">` :
                        '<div class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center mx-auto"><i data-lucide="package" class="w-5 h-5 text-gray-500"></i></div>'
                    }
                </div>
                <h3 class="font-bold text-xs mb-1 leading-tight line-clamp-2">${nameES}</h3>
                <span class="text-[9px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full inline-block mb-2">${categoryES}</span>
                <p class="text-gray-400 text-[10px] leading-relaxed line-clamp-3">${description}</p>
            </div>
        `;
    }

    // ==================== HOME DASHBOARD ====================

    initHome() {
        this.updateDashboardStats();
        this.loadPokemonOfDay();
        this.showDailyTip();
        this.renderRecentPokemon();
        this.renderBattleHistoryPreview();
        this.renderCollectionOverview();
        this.renderMetaRankings();
        this.renderAppStatusPanel();
        this.renderActivityInsights();
    }

    updateDashboardStats() {
        this.favorites = this.collection.getFavorites();
        this.captured = this.collection.getCaptured();
        const stats = BattleSimulator.getStats();
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('ds-total',     this.pokemonList.length);
        setEl('ds-captured',  this.captured.length);
        setEl('ds-favorites', this.favorites.length);
        setEl('ds-wins',      stats.wins);
        setEl('sf-captured',  this.captured.length);
        setEl('sf-favorites', this.favorites.length);
        setEl('sf-wins',      stats.wins);
        const favCount = document.getElementById('nav-fav-count');
        if (favCount) { favCount.textContent = this.favorites.length; favCount.classList.toggle('hidden', this.favorites.length === 0); }
        const winsCount = document.getElementById('nav-wins');
        if (winsCount) { winsCount.textContent = `${stats.wins}W`; winsCount.classList.toggle('hidden', stats.wins === 0); }
    }

    async loadPokemonOfDay() {
        const container = document.getElementById('pokemon-of-day');
        if (!container) return;
        const dayIndex = Math.floor(Date.now() / 86400000) % 898 + 1;
        try {
            const p = await pokeAPI.getPokemon(dayIndex);
            const name = p.name.charAt(0).toUpperCase() + p.name.slice(1);
            const types = p.types.map(t => t.type.name);
            const stats = {};
            p.stats.forEach(s => stats[s.stat.name] = s.base_stat);
            container.innerHTML = `
                <img src="${this.getPreferredArtworkUrl(p.id)}"
                     class="w-28 h-28 object-contain drop-shadow-xl cursor-pointer hover:scale-110 transition-transform premium-image"
                     onclick="app.navigate('detail', ${p.id})"
                     alt="${name}">
                <div class="flex-1">
                    <div class="font-orbitron font-bold text-xl text-white mb-1 cursor-pointer hover:text-cyan-400 transition-colors" onclick="app.navigate('detail', ${p.id})">${name}</div>
                    <div class="text-gray-400 text-xs mb-2">${pokeAPI.formatId(p.id)}</div>
                    <div class="flex gap-1 mb-3">${types.map(t => `<span class="${pokeAPI.typeColors[t]?.bg||'bg-gray-600'} text-white text-[10px] px-2 py-0.5 rounded-full font-bold">${pokeAPI.typeNamesES[t]||t}</span>`).join('')}</div>
                    <div class="grid grid-cols-3 gap-1 text-xs">
                        ${[['PS','hp','text-green-400'],['Atk','attack','text-red-400'],['Vel','speed','text-yellow-400']].map(([label,key,color]) =>
                            `<div class="text-center"><div class="${color} font-bold font-orbitron text-sm">${stats[key]||0}</div><div class="text-gray-500">${label}</div></div>`
                        ).join('')}
                    </div>
                </div>
            `;
            if (this.preferences.autoPlayCry) {
                setTimeout(() => this.playCry(p.id), this.preferences.reducedMotion ? 0 : 250);
            }
        } catch(e) { container.innerHTML = '<p class="text-gray-500 text-sm">No disponible</p>'; }
    }

    showDailyTip() {
        const tips = [
            'Mewtwo tiene un BST de 680, siendo uno de los Pokémon más poderosos de la Gen I.',
            'Shedinja tiene solo 1 PS pero su habilidad Guardia Mágica lo hace inmune a todos los ataques no super efectivos.',
            'La habilidad Adaptación de Greninja permite cambiar su tipo según el último movimiento usado.',
            'Blissey tiene los PS base más altos de todos los Pokémon: 255.',
            'Archeops tiene el ataque base más alto de todos los fósiles: 140.',
            'Smeargle puede aprender cualquier movimiento del juego gracias a Bosquejo.',
            'Los Pokémon de tipo Acero resisten hasta 12 tipos diferentes, el récord de resistencias.',
            'Regigigas tiene Inicio Lento, que reduce sus stats a la mitad durante los primeros 5 turnos.',
            'La habilidad Levitación hace inmune a Tierra, uno de los tipos de movimiento más comunes.',
            'Ditto es el único Pokémon que puede reproducirse con casi cualquier otro Pokémon.',
            'Hyper Voice atraviesa la habilidad Sustituto del rival cuando lo usa un Pokémon con Pixilar.',
            'Choice Scarf aumenta la Velocidad en ×1.5 pero bloquea el Pokémon a un solo movimiento.',
            'En Gen 9, los Pokémon Paradoja no tienen habilidades ocultas.',
            'El movimiento más potente es Explosión con 250 de potencia, aunque ahora ya no reduce la Defensa del defensor.',
        ];
        const tip = document.getElementById('daily-tip');
        if (tip) tip.textContent = tips[Math.floor(Date.now() / 86400000) % tips.length];
    }

    renderRecentPokemon() {
        const recent = this.collection.getRecent();
        const container = document.getElementById('recent-pokemon');
        if (!container) return;
        if (recent.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Aún no has visto ningún Pokémon.</p>';
            return;
        }
        container.innerHTML = recent.slice(0, 12).map(id => `
            <div class="cursor-pointer hover:scale-110 transition-transform text-center" onclick="app.navigate('detail', ${id})">
                <img src="${pokeAPI.getPokemonSpriteUrl(id)}" class="w-12 h-12 object-contain mx-auto" loading="lazy">
                <div class="text-[10px] text-gray-500">${pokeAPI.formatId(id)}</div>
            </div>
        `).join('');
    }

    renderBattleHistoryPreview() {
        const container = document.getElementById('battle-history-preview');
        if (!container) return;
        const history = BattleSimulator.getHistory().slice(0, 5);
        if (history.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No hay batallas registradas.</p>';
            return;
        }
        container.innerHTML = history.map(b => {
            const won = b.winner === 'player';
            const date = new Date(b.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="flex items-center gap-3 p-3 glass rounded-xl">
                    <div class="text-2xl">${won ? '🏆' : '💀'}</div>
                    <div class="flex-1">
                        <div class="text-sm font-bold ${won ? 'text-green-400' : 'text-red-400'}">${won ? 'Victoria' : 'Derrota'}</div>
                        <div class="text-xs text-gray-500">${b.turns} turnos · ${date}</div>
                    </div>
                    <div class="flex gap-1">${b.playerTeam.slice(0,3).map(p => `<img src="${pokeAPI.getPokemonSpriteUrl(p.id)}" class="w-8 h-8 object-contain ${p.fainted ? 'opacity-30' : ''}" loading="lazy">`).join('')}</div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ==================== CALCULADORA DE DAÑO (SHOWDOWN STYLE) ====================

    initCalcView() {
        // Populate natures
        const natures = DamageCalc.getNatureList();
        ['calc-atk-nature','calc-def-nature'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel || sel.options.length > 1) return;
            sel.innerHTML = natures.map(n => `<option value="${n.key}">${n.label} — ${DamageCalc.describeNature(n.key)}</option>`).join('');
        });

        // Populate items
        const items = DamageCalc.getItemList();
        ['calc-atk-item','calc-def-item'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel || sel.options.length > 1) return;
            sel.innerHTML = items.map(i => `<option value="${i.key}">${i.label}</option>`).join('');
        });

        // Populate ability selects
        const abilities = DamageCalc.getAbilityList();
        const atkAbSel = document.getElementById('calc-atk-ability');
        const defAbSel = document.getElementById('calc-def-ability');
        if (atkAbSel && atkAbSel.options.length <= 1) {
            abilities.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.key; opt.textContent = `${a.label} — ${a.data.desc}`;
                atkAbSel.appendChild(opt);
            });
        }
        if (defAbSel && defAbSel.options.length <= 1) {
            abilities.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.key; opt.textContent = `${a.label} — ${a.data.desc}`;
                defAbSel.appendChild(opt);
            });
        }

        // Ability description watchers
        atkAbSel?.addEventListener('change', () => {
            const desc = document.getElementById('calc-atk-ability-desc');
            const ab = DamageCalc.ABILITIES[atkAbSel.value];
            if (desc && ab) { desc.textContent = ab.desc; desc.classList.remove('hidden'); }
            else if (desc) desc.classList.add('hidden');
            this.calcUpdate();
        });
        defAbSel?.addEventListener('change', () => {
            const desc = document.getElementById('calc-def-ability-desc');
            const ab = DamageCalc.ABILITIES[defAbSel.value];
            if (desc && ab) { desc.textContent = ab.desc; desc.classList.remove('hidden'); }
            else if (desc) desc.classList.add('hidden');
            this.calcUpdate();
        });
    }

    calcSwap() {
        // Swap Pokémon data
        const atkPok = this.calcState.atk.pokemon;
        const defPok = this.calcState.def.pokemon;
        const atkIV = { ...this.calcState.atk.iv };
        const defIV = { ...this.calcState.def.iv };
        const atkEV = { ...this.calcState.atk.ev };
        const defEV = { ...this.calcState.def.ev };

        this.calcState.atk.pokemon = defPok;
        this.calcState.def.pokemon = atkPok;
        this.calcState.atk.iv = defIV;
        this.calcState.def.iv = atkIV;
        this.calcState.atk.ev = defEV;
        this.calcState.def.ev = atkEV;

        // Swap UI previews
        const atkImg  = document.getElementById('calc-atk-img');
        const defImg  = document.getElementById('calc-def-img');
        const atkName = document.getElementById('calc-atk-name');
        const defName = document.getElementById('calc-def-name');
        const atkTypes = document.getElementById('calc-atk-types');
        const defTypes = document.getElementById('calc-def-types');
        const atkPrev  = document.getElementById('calc-atk-preview');
        const defPrev  = document.getElementById('calc-def-preview');

        if (defPok && atkImg) {
            atkImg.src = pokeAPI.getPokemonImageUrl(defPok.id);
            atkName.textContent = defPok.name.charAt(0).toUpperCase() + defPok.name.slice(1);
            atkTypes.innerHTML = defPok.types.map(t => `<span class="type-badge ${pokeAPI.typeColors[t.type.name]?.bg||'bg-gray-600'} text-white">${pokeAPI.typeNamesES[t.type.name]||t.type.name}</span>`).join('');
            atkPrev.classList.remove('hidden');
        }
        if (atkPok && defImg) {
            defImg.src = pokeAPI.getPokemonImageUrl(atkPok.id);
            defName.textContent = atkPok.name.charAt(0).toUpperCase() + atkPok.name.slice(1);
            defTypes.innerHTML = atkPok.types.map(t => `<span class="type-badge ${pokeAPI.typeColors[t.type.name]?.bg||'bg-gray-600'} text-white">${pokeAPI.typeNamesES[t.type.name]||t.type.name}</span>`).join('');
            defPrev.classList.remove('hidden');
        }

        this.calcUpdate();
    }

    // Override runCalc to use Showdown-style output
    runCalc() {
        const atkPok = this.calcState.atk.pokemon;
        const defPok = this.calcState.def.pokemon;
        const moveName = document.getElementById('calc-move-search')?.value;
        const move = this.calcState.move;

        if (!atkPok || !defPok || !move) {
            document.getElementById('calc-result-content').innerHTML =
                '<p class="text-yellow-400 text-sm">⚠️ Selecciona atacante, defensor y movimiento.</p>';
            return;
        }

        const getStatObj = (side) => {
            const st = this.calcState[side];
            const pok = st.pokemon;
            const baseStat = {};
            pok.stats.forEach(s => baseStat[s.stat.name] = s.base_stat);
            return {
                types:    pok.types.map(t => t.type.name),
                level:    parseInt(document.getElementById(`calc-${side}-level`)?.value) || 50,
                nature:   document.getElementById(`calc-${side}-nature`)?.value || 'Hardy',
                item:     document.getElementById(`calc-${side}-item`)?.value || 'none',
                ability:  document.getElementById(`calc-${side}-ability`)?.value || '',
                status:   null,
                baseStat,
                iv:       st.iv,
                ev:       st.ev,
            };
        };

        const atk = getStatObj('atk');
        const def = getStatObj('def');
        const conditions = {
            weather: document.getElementById('calc-weather')?.value || 'none',
            terrain: document.getElementById('calc-terrain')?.value || 'none',
            screens: document.getElementById('calc-screen')?.checked || false,
            isCrit:  document.getElementById('calc-crit')?.checked || false,
        };

        const result = DamageCalc.calculate(atk, def, move, conditions);
        const ko = DamageCalc.koMessage(result);

        if (!result || result.max === 0) {
            document.getElementById('calc-result-content').innerHTML = `
                <div class="calc-ko-badge ${ko.cls} text-base mb-2">${ko.label}</div>
                ${result?.notes?.length ? `<div class="text-xs text-purple-300/60 mt-2">${result.notes.join(' · ')}</div>` : ''}
            `;
            return;
        }

        const mn  = parseFloat(result.percentMin);
        const mx  = parseFloat(result.percentMax);
        const stabTxt = result.stab > 1 ? (result.stab >= 2 ? '(STAB ×2)' : '(STAB)') : '';
        const effTxt  = result.typeEff === 4 ? '×4 super efectivo!' : result.typeEff === 2 ? '×2 super efectivo' : result.typeEff === 0.5 ? '×0.5 poco efectivo' : result.typeEff === 0.25 ? '×0.25 muy resistente' : '';

        // Statsline like Showdown: "156 Atk vs 120 Def"
        const atkStatName = move.category === 'physical' ? 'Atk' : 'At.Esp';
        const defStatName = move.category === 'physical' ? 'Def' : 'Def.Esp';
        const statsline = `${result.atkStatVal} ${atkStatName} vs ${result.defStatVal} ${defStatName}`;

        // Rolls display
        const rollsHTML = result.rolls.map((r, i) => {
            const isKO = r >= result.defHP;
            return `<div class="roll-chip ${isKO ? 'ko' : ''}">${r}</div>`;
        }).join('');

        // Dots
        const dotsHTML = result.rolls.map(r => {
            const isKO = r >= result.defHP;
            return `<div class="roll-dot ${isKO ? 'ko' : 'safe'}"></div>`;
        }).join('');

        // Ability notes
        const notesHTML = result.notes?.length
            ? `<div class="text-xs text-purple-300/70 mt-2">✦ ${result.notes.join(' · ')}</div>` : '';

        document.getElementById('calc-result-content').innerHTML = `
            <div class="calc-damage-range">${mn}%–${mx}%</div>
            <div class="calc-statsline">${move.nameES || move.name} · ${statsline}</div>
            ${stabTxt ? `<div class="text-xs text-yellow-400 mt-1">${stabTxt}</div>` : ''}
            ${effTxt  ? `<div class="text-xs text-red-400 mt-1">${effTxt}</div>` : ''}

            <!-- Damage bar -->
            <div class="calc-damage-bar-wrap">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span>0%</span><span>50%</span><span>100%</span>
                </div>
                <div class="calc-damage-bar-track">
                    <div class="calc-damage-bar-min" style="width: ${Math.min(mn,100)}%"></div>
                    <div class="calc-damage-bar-max" style="width: ${Math.min(mx,100)}%"></div>
                </div>
            </div>

            <!-- KO Badge -->
            <div class="calc-ko-badge ${ko.cls}">${ko.label}</div>
            ${notesHTML}

            <!-- 16 Rolls table -->
            <div class="mt-4">
                <div class="text-xs text-gray-500 font-orbitron tracking-wider mb-2">16 ROLLS (85%–100%)</div>
                <div class="rolls-grid">${rollsHTML}</div>
            </div>

            <!-- Dots summary -->
            <div class="roll-dots">${dotsHTML}</div>

            <!-- Absolute damage -->
            <div class="text-sm text-gray-400 mt-3">
                Daño: <span class="text-white font-bold">${result.min}–${result.max}</span>
                / <span class="text-gray-500">${result.defHP} PS def.</span>
            </div>
        `;
    }

    calcUpdate() {
        // Auto-calc if we have all data
        if (this.calcState.atk.pokemon && this.calcState.def.pokemon && this.calcState.move) {
            this.runCalc();
        }
    }

    // ==================== SECCIÓN DE HABILIDADES ====================

    initAbilitiesView() {
        // Populate from DamageCalc ABILITIES + API
        this.renderAbilitiesFromCalc();
        // Optionally load more from API in background
    }

    renderAbilitiesFromCalc() {
        const grid = document.getElementById('abilities-grid');
        if (!grid) return;

        const abilities = DamageCalc.getAbilityList();
        const countEl = document.getElementById('abilities-count');
        if (countEl) countEl.textContent = `${abilities.length} habilidades con efecto de batalla`;

        const effectFilter = document.getElementById('abilities-filter-effect')?.value || '';
        const searchQ      = (document.getElementById('abilities-search')?.value || '').toLowerCase();

        let filtered = abilities;
        if (searchQ) {
            filtered = filtered.filter(a =>
                a.label.toLowerCase().includes(searchQ) ||
                a.key.replace(/-/g,' ').includes(searchQ) ||
                (a.data?.desc||'').toLowerCase().includes(searchQ)
            );
        }
        if (effectFilter) {
            filtered = filtered.filter(a => {
                const d = a.data || {};
                if (effectFilter === 'immune')  return d.immuneType;
                if (effectFilter === 'boost')   return d.atkMult > 1 || d.typeMult > 1 || d.superEffMult;
                if (effectFilter === 'defense') return d.defMult || d.specialDef;
                if (effectFilter === 'weather') return d.requiresWeather;
                if (effectFilter === 'stab')    return d.stabMult;
                return true;
            });
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-16 text-gray-500">No se encontraron habilidades.</div>';
            return;
        }

        grid.innerHTML = filtered.map(ab => this.createAbilityCard(ab)).join('');
        lucide.createIcons();
    }

    createAbilityCard(ab) {
        const d = ab.data || {};
        const isImmune  = !!d.immuneType;
        const isBoost   = d.atkMult > 1 || d.typeMult > 1 || d.superEffMult;
        const isDef     = d.defMult || d.specialDef;
        const isSTAB    = d.stabMult;

        let badge = '';
        if (isImmune)  badge = `<span class="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">Inmunidad</span>`;
        if (isBoost)   badge += `<span class="text-[10px] bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">Boost Atk</span>`;
        if (isDef)     badge += `<span class="text-[10px] bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">Defensa</span>`;
        if (isSTAB)    badge += `<span class="text-[10px] bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">STAB</span>`;

        let statLines = '';
        if (d.atkMult  && d.atkMult  !== 1) statLines += `<div class="text-green-400 text-xs">Ataque ×${d.atkMult}</div>`;
        if (d.defMult  && d.defMult  !== 1) statLines += `<div class="text-blue-400 text-xs">Defensa ×${d.defMult}</div>`;
        if (d.stabMult)                     statLines += `<div class="text-yellow-400 text-xs">STAB ×${d.stabMult}</div>`;
        if (d.typeMult && d.type)            statLines += `<div class="text-orange-400 text-xs">${pokeAPI.typeNamesES[d.type]||d.type} ×${d.typeMult}</div>`;
        if (d.immuneType)                   statLines += `<div class="text-gray-400 text-xs">Inmune: ${pokeAPI.typeNamesES[d.immuneType]||d.immuneType}</div>`;
        if (d.superEffMult)                 statLines += `<div class="text-red-400 text-xs">SE ×${d.superEffMult}</div>`;

        return `
            <div class="ability-card ${isImmune?'':'has-battle-effect'}" onclick="app.openAbilityDetail('${ab.key}')">
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <div class="font-bold text-sm text-white mb-0.5">${ab.label}</div>
                        <div class="text-[10px] text-gray-500">${ab.key.replace(/-/g,' ')}</div>
                    </div>
                    <i data-lucide="sparkles" class="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5"></i>
                </div>
                <p class="text-gray-300 text-xs leading-relaxed mb-3">${d.desc||'Sin descripción.'}</p>
                <div class="flex flex-wrap gap-1 mb-2">${badge}</div>
                <div class="space-y-0.5">${statLines}</div>
            </div>
        `;
    }

    openAbilityDetail(key) {
        const ab = DamageCalc.ABILITIES[key];
        const label = DamageCalc.ABILITIES_ES[key] || key;
        if (!ab) return;

        document.getElementById('ability-modal')?.remove();
        const modal = document.createElement('div');
        modal.id = 'ability-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="glass rounded-2xl p-6 max-w-lg w-full relative">
                <button onclick="document.getElementById('ability-modal').remove()" class="absolute top-4 right-4 btn btn-ghost btn-sm">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                        <i data-lucide="sparkles" class="w-5 h-5 text-purple-400"></i>
                    </div>
                    <div>
                        <h2 class="font-orbitron font-bold text-lg text-white">${label}</h2>
                        <p class="text-gray-500 text-xs">${key.replace(/-/g,' ')}</p>
                    </div>
                </div>
                <div class="glass rounded-xl p-4 mb-4">
                    <p class="text-gray-200 leading-relaxed">${ab.desc}</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    ${ab.atkMult  && ab.atkMult!==1 ? `<div class="glass-sm rounded-lg p-3 text-sm"><div class="text-gray-400 text-xs mb-1">Mult. Ataque</div><div class="text-green-400 font-bold font-orbitron">×${ab.atkMult}</div></div>` : ''}
                    ${ab.defMult  && ab.defMult!==1 ? `<div class="glass-sm rounded-lg p-3 text-sm"><div class="text-gray-400 text-xs mb-1">Mult. Defensa</div><div class="text-blue-400 font-bold font-orbitron">×${ab.defMult}</div></div>` : ''}
                    ${ab.stabMult ? `<div class="glass-sm rounded-lg p-3 text-sm"><div class="text-gray-400 text-xs mb-1">STAB</div><div class="text-yellow-400 font-bold font-orbitron">×${ab.stabMult}</div></div>` : ''}
                    ${ab.immuneType ? `<div class="glass-sm rounded-lg p-3 text-sm"><div class="text-gray-400 text-xs mb-1">Inmune a</div><div class="font-bold" style="color:${pokeAPI.typeColors[ab.immuneType]?.text||'#fff'}">${pokeAPI.typeNamesES[ab.immuneType]||ab.immuneType}</div></div>` : ''}
                    ${ab.typeMult && ab.type ? `<div class="glass-sm rounded-lg p-3 text-sm"><div class="text-gray-400 text-xs mb-1">Boost tipo</div><div class="text-orange-400 font-bold">${pokeAPI.typeNamesES[ab.type]||ab.type} ×${ab.typeMult}</div></div>` : ''}
                    ${ab.requiresWeather ? `<div class="glass-sm rounded-lg p-3 text-sm"><div class="text-gray-400 text-xs mb-1">Requiere</div><div class="text-cyan-400 font-bold">${{sun:'Sol',rain:'Lluvia',sand:'Arena',hail:'Granizo'}[ab.requiresWeather]||ab.requiresWeather}</div></div>` : ''}
                </div>
                <button onclick="document.getElementById('ability-modal').remove(); app.navigate('calc')" class="btn btn-purple w-full mt-4">
                    <i data-lucide="calculator" class="w-4 h-4"></i> Usar en Calculadora
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        lucide.createIcons();
    }

    searchAbilities(query) {
        this.abilitiesSearchQuery = query;
        this.renderAbilitiesFromCalc();
    }

    filterAbilities() {
        this.abilitiesEffectFilter = document.getElementById('abilities-filter-effect')?.value || '';
        this.renderAbilitiesFromCalc();
    }

    // ==================== CALC HELPERS ====================

    navigateBack() {
        this.navigate(this.previousView || 'list');
    }

    async calcSearchPokemon(side, query) {
        const resultsId = `calc-${side}-results`;
        const resultsEl = document.getElementById(resultsId);
        if (!resultsEl) return;

        if (!query.trim()) { resultsEl.classList.add('hidden'); return; }

        try {
            const results = await pokeAPI.searchPokemon(query);
            resultsEl.innerHTML = results.slice(0, 8).map(p => {
                const id = p.url.split('/').slice(-2, -1)[0];
                return `
                    <div class="search-result-item" onclick="app.calcLoadPokemon('${side}', ${id})">
                        <img src="${pokeAPI.getPokemonSpriteUrl(id)}" loading="lazy" alt="${p.name}">
                        <span class="capitalize">${p.name.replace(/-/g,' ')}</span>
                        <span class="ml-auto text-gray-500 text-xs">${pokeAPI.formatId(id)}</span>
                    </div>
                `;
            }).join('');
            resultsEl.classList.remove('hidden');
        } catch(e) { resultsEl.classList.add('hidden'); }
    }

    async calcLoadPokemon(side, id) {
        const resultsEl = document.getElementById(`calc-${side}-results`);
        if (resultsEl) resultsEl.classList.add('hidden');

        try {
            const p = await pokeAPI.getPokemon(id);
            this.calcState[side].pokemon = p;

            const imgEl   = document.getElementById(`calc-${side}-img`);
            const nameEl  = document.getElementById(`calc-${side}-name`);
            const typesEl = document.getElementById(`calc-${side}-types`);
            const prevEl  = document.getElementById(`calc-${side}-preview`);

            if (imgEl)   imgEl.src = pokeAPI.getPokemonImageUrl(id);
            if (nameEl)  nameEl.textContent = p.name.charAt(0).toUpperCase() + p.name.slice(1);
            if (typesEl) typesEl.innerHTML = p.types.map(t =>
                `<span class="type-badge ${pokeAPI.typeColors[t.type.name]?.bg||'bg-gray-600'} text-white">${pokeAPI.typeNamesES[t.type.name]||t.type.name}</span>`
            ).join('');
            if (prevEl) prevEl.classList.remove('hidden');

            const searchEl = document.getElementById(`calc-${side}-search`);
            if (searchEl) searchEl.value = p.name.charAt(0).toUpperCase() + p.name.slice(1);

            this.calcUpdate();
        } catch(e) { console.error('Error loading calc pokémon:', e); }
    }

    async calcSearchMove(query) {
        const resultsEl = document.getElementById('calc-move-results');
        if (!resultsEl) return;
        if (!query.trim()) { resultsEl.classList.add('hidden'); return; }

        // Search from loaded moves first
        const q = query.toLowerCase();
        let matches = this.movesData.filter(m => {
            const es = pokeAPI.getSpanishMoveName(m).toLowerCase();
            return es.includes(q) || m.name.replace(/-/g,' ').includes(q);
        }).slice(0, 8);

        // If no moves loaded yet, do quick API search
        if (matches.length === 0) {
            try {
                const data = await pokeAPI.getMoveList(0, 200);
                const apiMatch = data.results.filter(m => m.name.includes(q)).slice(0, 5);
                const details = await Promise.all(apiMatch.map(m => pokeAPI.getMove(m.name).catch(() => null)));
                matches = details.filter(Boolean);
            } catch(e) {}
        }

        resultsEl.innerHTML = matches.map(m => {
            const nameES = pokeAPI.getSpanishMoveName(m);
            const typeBg = pokeAPI.typeColors[m.type?.name]?.bg || 'bg-gray-600';
            const cat = m.damage_class?.name || 'status';
            const catColor = cat === 'physical' ? 'text-orange-400' : cat === 'special' ? 'text-blue-400' : 'text-gray-400';
            return `
                <div class="search-result-item flex-wrap" onclick="app.calcSelectMove('${m.name}')">
                    <span>${nameES}</span>
                    <span class="${typeBg} text-white text-[10px] px-2 rounded-full">${pokeAPI.typeNamesES[m.type?.name]||m.type?.name||'?'}</span>
                    <span class="${catColor} text-xs ml-auto">${m.power||'—'} pot.</span>
                </div>
            `;
        }).join('') || '<div class="p-3 text-gray-500 text-sm">No encontrado. Escribe más.</div>';
        resultsEl.classList.remove('hidden');
    }

    calcSelectMove(moveName) {
        const resultsEl = document.getElementById('calc-move-results');
        if (resultsEl) resultsEl.classList.add('hidden');

        // Find from loaded moves or fetch
        const existing = this.movesData.find(m => m.name === moveName);
        if (existing) {
            this.calcState.move = {
                name:     existing.name,
                nameES:   pokeAPI.getSpanishMoveName(existing),
                type:     existing.type?.name || 'normal',
                category: existing.damage_class?.name || 'physical',
                power:    existing.power || 0,
                pp:       existing.pp || 0,
            };
            this.showCalcMoveInfo(existing);
            this.calcUpdate();
            return;
        }
        // Fetch if not in cache
        pokeAPI.getMove(moveName).then(m => {
            if (!m) return;
            this.movesData.push(m);
            this.calcState.move = {
                name:     m.name,
                nameES:   pokeAPI.getSpanishMoveName(m),
                type:     m.type?.name || 'normal',
                category: m.damage_class?.name || 'physical',
                power:    m.power || 0,
                pp:       m.pp || 0,
            };
            this.showCalcMoveInfo(m);
            this.calcUpdate();
        }).catch(e => console.error(e));
    }

    showCalcMoveInfo(m) {
        const el = document.getElementById('calc-move-info');
        if (!el) return;
        const nameES   = pokeAPI.getSpanishMoveName(m);
        const typeES   = pokeAPI.typeNamesES[m.type?.name] || m.type?.name || '?';
        const typeBg   = pokeAPI.typeColors[m.type?.name]?.bg || 'bg-gray-600';
        const catES    = pokeAPI.damageClassES?.[m.damage_class?.name] || m.damage_class?.name || '?';
        const input    = document.getElementById('calc-move-search');
        if (input) input.value = nameES;
        el.classList.remove('hidden');
        el.innerHTML = `
            <div class="flex items-center gap-2 flex-wrap">
                <span class="${typeBg} text-white text-[10px] px-2 py-0.5 rounded-full font-bold">${typeES}</span>
                <span class="text-gray-400">${catES}</span>
                <span class="text-white font-bold">Pot: ${m.power || '—'}</span>
                <span class="text-gray-400">Prec: ${m.accuracy || '—'}</span>
                <span class="text-gray-400">PP: ${m.pp || '—'}</span>
            </div>
        `;
    }

    calcUpdateIV(side, stat, value) {
        this.calcState[side].iv[stat] = parseInt(value);
        const el = document.getElementById(`calc-${side}-iv-${stat.replace('special-attack','spa').replace('special-defense','spd').replace('-','')}-val`);
        if (el) el.textContent = value;
        this.calcUpdate();
    }

    calcUpdateEV(side, stat, value) {
        this.calcState[side].ev[stat] = parseInt(value);
        const el = document.getElementById(`calc-${side}-ev-${stat.replace('special-attack','spa').replace('special-defense','spd').replace('-','')}-val`);
        if (el) el.textContent = value;
        this.calcUpdate();
    }

    // ==================== BATTLE HELPERS (thin wrappers for new HTML) ====================

    battleSetTeamType(type) {
        const randomBtn = document.getElementById('btn-team-random');
        const manualBtn = document.getElementById('btn-team-manual');
        const randomPreview = document.getElementById('battle-random-preview');
        const teamBuilder = document.getElementById('battle-team-builder');
        if (type === 'random') {
            randomBtn?.classList.replace('btn-ghost','btn-purple');
            manualBtn?.classList.replace('btn-purple','btn-ghost');
            randomPreview?.classList.remove('hidden');
            teamBuilder?.classList.add('hidden');
        } else {
            randomBtn?.classList.replace('btn-purple','btn-ghost');
            manualBtn?.classList.replace('btn-ghost','btn-purple');
            randomPreview?.classList.add('hidden');
            teamBuilder?.classList.remove('hidden');
            this.renderTeamSlots();
        }
    }

    renderTeamSlots() {
        const grid = document.getElementById('team-slots');
        if (!grid || !BattleSimulator) return;
        const team = BattleSimulator.playerTeam || [];
        grid.innerHTML = Array(6).fill(null).map((_, i) => {
            const p = team[i];
            if (p) {
                return `
                    <div class="team-slot filled">
                        <button class="slot-remove" onclick="BattleSimulator.removeFromTeam(${i}); app.renderTeamSlots()">×</button>
                        <img src="${pokeAPI.getPokemonSpriteUrl(p.id)}" class="w-12 h-12 object-contain" loading="lazy">
                        <div class="text-xs capitalize">${p.name}</div>
                    </div>
                `;
            }
            return `<div class="team-slot" onclick="document.getElementById('team-search').focus()">
                <i data-lucide="plus" class="w-5 h-5"></i>
                <span class="text-[10px]">Añadir</span>
            </div>`;
        }).join('');
        lucide.createIcons();
        const startBtn = document.getElementById('btn-start-battle');
        if (startBtn) startBtn.disabled = team.length === 0;
    }

    // ==================== BÚSQUEDA / FILTRO (corregido) ====================

    handleSearch(query) {
        if (this.currentView !== 'list') this.navigate('list');
        const input = document.getElementById('search-input');
        if (input && input.value !== query) input.value = query;
        this.applyFilters();
    }

    // ==================== SIMULADOR DE BATALLA ====================

    /** Estado de la batalla en esta sesión */
    get _battle() { return battleSim; }

    initBattleView() {
        // Reset view to setup
        document.getElementById('battle-setup')?.classList.remove('hidden');
        document.getElementById('battle-active')?.classList.add('hidden');

        // Clear any previous team state
        this.battleTeam = this.battleTeam || [];
        this._syncBattleUI();
        this.renderTeamSlots();
        this.renderSavedTeams();
        this.renderNpcTrainerOptions();
        this.renderTeamSetEditor();
        this.renderBattleBuilderInsights();

        // Wire up battleSim events (idempotent)
        if (!this._battleEventsWired) {
            this._battleEventsWired = true;
            this._wireBattleEvents();
        }
    }

    _wireBattleEvents() {
        battleSim.on('log', ({ text, cls }) => {
            const log = document.getElementById('battle-log');
            if (!log) return;
            const el = document.createElement('div');
            el.className = `log-line ${cls || ''}`;
            el.textContent = text;
            log.appendChild(el);
            log.scrollTop = log.scrollHeight;
        });

        battleSim.on('update', (state) => {
            this._updateBattleUI(state);
        });

        battleSim.on('damage', ({ side, hp, maxHP }) => {
            this._updateHPBar(side, hp, maxHP);
        });

        battleSim.on('faint', ({ side }) => {
            const sprite = document.getElementById(`b-${side}-sprite`);
            if (sprite) sprite.classList.add('opacity-30');
        });

        battleSim.on('battleEnd', ({ winner }) => {
            this._showBattleResult(winner);
        });

        battleSim.on('needSwitch', () => {
            this.battleOpenSwitch(true);
        });

        battleSim.on('autoStart', () => {
            const btn = document.getElementById('btn-auto');
            if (btn) { btn.innerHTML = '<i data-lucide="pause" class="w-3 h-3"></i> Pausar'; lucide.createIcons(); }
        });
        battleSim.on('autoStop', () => {
            const btn = document.getElementById('btn-auto');
            if (btn) { btn.innerHTML = '<i data-lucide="play" class="w-3 h-3"></i> Auto'; lucide.createIcons(); }
        });
    }

    setAILevel(level) {
        battleSim.aiLevel = level;
        document.querySelectorAll('.ai-btn').forEach(btn => {
            const active = btn.dataset.ai === level;
            btn.className = btn.className.replace(/btn-(cyan|red|ghost)/g, '');
            btn.classList.add(active ? (level === 'expert' ? 'btn-red' : 'btn-cyan') : 'btn-ghost');
        });
    }

    renderNpcTrainerOptions() {
        const select = document.getElementById('battle-trainer-select');
        if (!select) return;
        const roster = BattleSimulator.getNpcRoster();
        const selected = this.selectedNpcTrainer || roster[1]?.id || roster[0]?.id;
        select.innerHTML = roster.map(trainer => `
            <option value="${trainer.id}" ${trainer.id === selected ? 'selected' : ''}>
                ${trainer.name} · ${trainer.aiLevel.toUpperCase()} · ${trainer.size}v${trainer.size}
            </option>
        `).join('');
        this.selectedNpcTrainer = selected;
    }

    selectNpcTrainer(trainerId) {
        this.selectedNpcTrainer = trainerId;
        this.renderBattleBuilderInsights();
    }

    updateBattleFormat(format) {
        this.selectedBattleFormat = format;
        battleSim.battleFormat = format;
        this.renderBattleBuilderInsights();
    }

    battleSetTeamType(type) {
        this.selectedBattleTeamType = type;
        const randomBtn = document.getElementById('btn-team-random');
        const manualBtn = document.getElementById('btn-team-manual');
        const randomPreview = document.getElementById('battle-random-preview');
        const teamBuilder = document.getElementById('battle-team-builder');

        if (type === 'random') {
            randomBtn?.classList.remove('btn-ghost'); randomBtn?.classList.add('btn-purple');
            manualBtn?.classList.remove('btn-purple'); manualBtn?.classList.add('btn-ghost');
            randomPreview?.classList.remove('hidden');
            teamBuilder?.classList.add('hidden');
        } else {
            randomBtn?.classList.remove('btn-purple'); randomBtn?.classList.add('btn-ghost');
            manualBtn?.classList.remove('btn-ghost'); manualBtn?.classList.add('btn-purple');
            randomPreview?.classList.add('hidden');
            teamBuilder?.classList.remove('hidden');
            this.renderTeamSlots();
        }
    }

    async generateRandomTeam() {
        const previewGrid = document.getElementById('random-team-preview');
        const startBtn    = document.getElementById('btn-start-battle');
        if (!previewGrid) return;

        previewGrid.innerHTML = '<div class="col-span-full flex justify-center py-4"><div class="spinner"></div></div>';
        if (startBtn) startBtn.disabled = true;

        try {
            const team = await BattleSimulator.generateRandomTeam(6);
            this.battleTeam = team;
            this.selectedBattleTeamType = 'random';

            previewGrid.innerHTML = team.map(p => `
                <div class="glass rounded-xl p-3 text-center">
                    <img src="${pokeAPI.getPokemonSpriteUrl(p.id)}" class="w-14 h-14 object-contain mx-auto" loading="lazy">
                    <div class="text-xs font-bold capitalize mt-1 truncate">${p.nameES}</div>
                    <div class="flex flex-wrap gap-0.5 justify-center mt-1">
                        ${p.types.map(t => `<span class="${pokeAPI.typeColors[t]?.bg||'bg-gray-600'} text-[9px] text-white px-1.5 rounded-full">${pokeAPI.typeNamesES[t]||t}</span>`).join('')}
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1">
                        ${p.selectedMoves.slice(0,2).map(m => pokeAPI.getSpanishMoveName?.(m) || m.name.replace(/-/g,' ')).join(' / ')}
                    </div>
                </div>
            `).join('');

            if (startBtn) startBtn.disabled = false;
        } catch(e) {
            previewGrid.innerHTML = '<div class="col-span-full text-red-400 text-sm text-center">Error generando equipo. Inténtalo de nuevo.</div>';
            console.error(e);
        }
    }

    async searchTeamPokemon(query) {
        const resultsEl = document.getElementById('team-search-results');
        if (!resultsEl) return;
        if (!query.trim()) { resultsEl.classList.add('hidden'); return; }

        try {
            const results = await pokeAPI.searchPokemon(query);
            resultsEl.innerHTML = results.slice(0, 8).map(p => {
                const id = p.url.split('/').slice(-2, -1)[0];
                return `
                    <div class="search-result-item" onclick="app.addToTeam(${id})">
                        <img src="${pokeAPI.getPokemonSpriteUrl(id)}" loading="lazy">
                        <span class="capitalize">${p.name.replace(/-/g,' ')}</span>
                        <span class="ml-auto text-gray-500 text-xs">${pokeAPI.formatId(id)}</span>
                    </div>
                `;
            }).join('');
            resultsEl.classList.remove('hidden');
        } catch(e) { resultsEl.classList.add('hidden'); }
    }

    async addToTeam(id) {
        document.getElementById('team-search-results')?.classList.add('hidden');
        document.getElementById('team-search').value = '';

        if (!this.battleTeam) this.battleTeam = [];
        if (this.battleTeam.length >= 6) {
            this._toastMsg('El equipo ya tiene 6 Pokémon.'); return;
        }

        try {
            const p = await pokeAPI.getPokemon(id);
            // Get a couple of moves
            const levelUpMoves = p.moves
                .filter(m => m.version_group_details.some(v => v.move_learn_method.name === 'level-up'))
                .sort((a, b) => {
                    const la = a.version_group_details[0]?.level_learned_at || 0;
                    const lb = b.version_group_details[0]?.level_learned_at || 0;
                    return lb - la;
                })
                .slice(0, 4);
            const moveDetails = await Promise.all(
                levelUpMoves.map(m => pokeAPI.getMove(m.move.name).catch(() => null))
            );
            const validMoves = moveDetails.filter(Boolean);
            if (validMoves.length === 0) {
                validMoves.push({ name: 'tackle', nameES: 'Placaje', type: { name:'normal' }, damage_class: { name:'physical' }, power: 40, accuracy: 100, pp: 35, priority: 0 });
            }

            this.battleTeam.push({
                id: p.id,
                name: p.name,
                nameES: p.name.charAt(0).toUpperCase() + p.name.slice(1),
                types: p.types.map(t => t.type.name),
                stats: p.stats,
                level: 50,
                nature: 'Hardy',
                item: 'none',
                ability: p.abilities[0]?.ability.name || '',
                selectedMoves: validMoves,
                sprite: pokeAPI.getPokemonSpriteUrl(p.id),
                ivs: { hp:31, attack:31, defense:31, 'special-attack':31, 'special-defense':31, speed:31 },
                evs: { hp:0,  attack:0,  defense:0,  'special-attack':0,  'special-defense':0,  speed:0  },
            });
            this.renderTeamSlots();
            this.renderTeamSetEditor();
            this.renderBattleBuilderInsights();
        } catch(e) { console.error('Error adding to team:', e); }
    }

    renderTeamSlots() {
        const grid = document.getElementById('team-slots');
        if (!grid) return;
        const team = this.battleTeam || [];
        grid.innerHTML = Array(6).fill(null).map((_, i) => {
            const p = team[i];
            if (p) {
                return `
                    <div class="glass rounded-xl p-2 text-center relative">
                        <button onclick="app._removeFromTeam(${i})"
                                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs hover:bg-red-500/40 transition-all">×</button>
                        <img src="${pokeAPI.getPokemonSpriteUrl(p.id)}" class="w-12 h-12 object-contain mx-auto" loading="lazy">
                        <div class="text-[10px] capitalize truncate mt-1">${p.nameES}</div>
                    </div>
                `;
            }
            return `
                <div class="glass rounded-xl p-2 text-center flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all min-h-[80px]"
                     onclick="document.getElementById('team-search')?.focus()">
                    <i data-lucide="plus" class="w-5 h-5 text-gray-500"></i>
                    <span class="text-[10px] text-gray-500 mt-1">Añadir</span>
                </div>
            `;
        }).join('');
        lucide.createIcons();
        const startBtn = document.getElementById('btn-start-battle');
        if (startBtn) startBtn.disabled = team.length === 0;
        this.renderSavedTeams();
        this.renderTeamSetEditor();
        this.renderBattleBuilderInsights();
    }

    _removeFromTeam(index) {
        if (!this.battleTeam) return;
        this.battleTeam.splice(index, 1);
        this.renderTeamSlots();
        this.renderTeamSetEditor();
        this.renderBattleBuilderInsights();
    }

    renderTeamSetEditor() {
        const container = document.getElementById('team-set-editor');
        if (!container) return;
        const team = this.battleTeam || [];
        if (team.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Añade Pokémon al equipo para ajustar nivel, objeto, habilidad y perfil EV.</p>';
            return;
        }
        const itemOptions = DamageCalc.getItemList().slice(0, 18);
        container.innerHTML = team.map((pokemon, index) => `
            <div class="glass-sm rounded-xl p-4">
                <div class="flex items-center gap-3 mb-3">
                    <img src="${pokeAPI.getPokemonSpriteUrl(pokemon.id)}" class="w-12 h-12 object-contain" loading="lazy">
                    <div>
                        <div class="font-bold text-sm">${pokemon.nameES}</div>
                        <div class="text-xs text-gray-500">${pokemon.types.map(t => pokeAPI.typeNamesES[t] || t).join(' / ')}</div>
                    </div>
                </div>
                <div class="grid md:grid-cols-4 gap-3">
                    <label class="text-xs text-gray-400">Nivel
                        <input type="number" min="1" max="100" value="${pokemon.level || 50}" class="pro-input mt-1" onchange="app.updateTeamMonField(${index}, 'level', this.value)">
                    </label>
                    <label class="text-xs text-gray-400">Objeto
                        <select class="pro-select mt-1" onchange="app.updateTeamMonField(${index}, 'item', this.value)">
                            <option value="none">Sin objeto</option>
                            ${itemOptions.map(item => `<option value="${item.key}" ${pokemon.item === item.key ? 'selected' : ''}>${item.label}</option>`).join('')}
                        </select>
                    </label>
                    <label class="text-xs text-gray-400">Habilidad
                        <input type="text" value="${pokemon.ability || ''}" class="pro-input mt-1" onchange="app.updateTeamMonField(${index}, 'ability', this.value)">
                    </label>
                    <label class="text-xs text-gray-400">Preset EV
                        <select class="pro-select mt-1" onchange="app.applyTeamPreset(${index}, this.value)">
                            <option value="">Sin preset</option>
                            <option value="sweeper">Sweeper</option>
                            <option value="bulky">Bulky</option>
                            <option value="support">Support</option>
                            <option value="scarfer">Scarfer</option>
                        </select>
                    </label>
                </div>
            </div>
        `).join('');
    }

    updateTeamMonField(index, field, value) {
        if (!this.battleTeam?.[index]) return;
        this.battleTeam[index][field] = field === 'level' ? Math.max(1, Math.min(100, parseInt(value) || 50)) : value;
        this.renderBattleBuilderInsights();
    }

    applyTeamPreset(index, preset) {
        const mon = this.battleTeam?.[index];
        if (!mon || !preset) return;
        const presets = {
            sweeper: { evs: { hp:0, attack:252, defense:0, 'special-attack':252, 'special-defense':0, speed:252 }, item: 'life-orb' },
            bulky: { evs: { hp:252, attack:0, defense:252, 'special-attack':0, 'special-defense':252, speed:0 }, item: 'assault-vest' },
            support: { evs: { hp:252, attack:0, defense:120, 'special-attack':0, 'special-defense':136, speed:0 }, item: 'rocky-helmet' },
            scarfer: { evs: { hp:0, attack:252, defense:0, 'special-attack':0, 'special-defense':4, speed:252 }, item: 'choice-scarf' },
        };
        const selected = presets[preset];
        mon.evs = { ...selected.evs };
        mon.item = selected.item;
        this.renderTeamSetEditor();
        this.renderBattleBuilderInsights();
        this._toastMsg(`Preset ${preset} aplicado a ${mon.nameES}.`);
    }

    renderBattleBuilderInsights() {
        const container = document.getElementById('battle-builder-insights');
        if (!container) return;
        const team = this.battleTeam || [];
        if (team.length === 0) {
            container.innerHTML = 'Tu equipo aún no tiene estructura. Empieza con un lead, una wincon y algo de soporte.';
            return;
        }
        const speedCount = team.filter(mon => {
            const stats = {};
            (mon.stats || []).forEach?.(s => stats[s.stat.name] = s.base_stat);
            if (!Object.keys(stats).length) Object.assign(stats, mon.stats || {});
            return (stats.speed || 0) >= 100;
        }).length;
        const itemSet = new Set(team.map(mon => mon.item).filter(Boolean));
        const trainer = BattleSimulator.getNpcRoster().find(npc => npc.id === this.selectedNpcTrainer);
        container.innerHTML = `
            <div class="space-y-2">
                <div><span class="text-cyan-400">Formato:</span> ${this.selectedBattleFormat || 'singles-ou'}</div>
                <div><span class="text-cyan-400">Rival seleccionado:</span> ${trainer?.name || 'Ace Trainer'} (${trainer?.aiLevel || 'smart'})</div>
                <div><span class="text-cyan-400">Velocidad del equipo:</span> ${speedCount}/${team.length} slots rápidos</div>
                <div><span class="text-cyan-400">Diversidad de objetos:</span> ${itemSet.size} elecciones distintas</div>
            </div>
        `;
    }

    async startBattle() {
        const team = this.battleTeam;
        if (!team || team.length === 0) {
            this._toastMsg('Genera o construye un equipo primero.'); return;
        }

        // Show loading
        const startBtn = document.getElementById('btn-start-battle');
        if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Cargando…'; }

        try {
            const trainerPackage = await BattleSimulator.generateTrainerTeam(this.selectedNpcTrainer || 'ace');
            const enemyTeam = trainerPackage.team.length ? trainerPackage.team : await BattleSimulator.generateRandomTeam(team.length);

            // Reset & setup
            battleSim.reset();
            battleSim.npcTrainer = trainerPackage.trainer;
            battleSim.battleFormat = this.selectedBattleFormat || 'singles-ou';
            battleSim.aiLevel = trainerPackage.trainer?.aiLevel || battleSim.aiLevel;
            battleSim.setupTeam(team, 'player');
            battleSim.setupTeam(enemyTeam, 'enemy');

            // Show active battle
            document.getElementById('battle-setup')?.classList.add('hidden');
            document.getElementById('battle-active')?.classList.remove('hidden');
            document.getElementById('battle-over')?.classList.add('hidden');
            document.getElementById('battle-log').innerHTML = '';

            battleSim.begin();
            this._renderMoveButtons();
            this._renderTeamBalls();
            this._updateBattleUI(battleSim.getState());
            this.setAILevel(battleSim.aiLevel);

        } catch(e) {
            console.error('Error starting battle:', e);
            this._toastMsg('Error al iniciar la batalla.');
        } finally {
            if (startBtn) { startBtn.disabled = false; startBtn.innerHTML = '<i data-lucide="swords" class="w-5 h-5"></i> ¡Comenzar Batalla!'; lucide.createIcons(); }
        }
    }

    _renderMoveButtons() {
        const movesEl = document.getElementById('battle-moves');
        if (!movesEl || !battleSim.player) return;
        const moves = battleSim.player.moves;
        movesEl.innerHTML = moves.map((m, i) => {
            const typeBg = pokeAPI.typeColors[m.type]?.bg || 'bg-gray-600';
            const pp = m.pp <= 0 ? 'sin PP' : `${m.pp}/${m.maxPP} PP`;
            const disabled = m.pp <= 0 || battleSim.isOver;
            return `
                <button onclick="app._playerMove(${i})"
                        ${disabled ? 'disabled' : ''}
                        class="move-btn ${typeBg} ${disabled ? 'opacity-40' : ''}">
                    <div class="font-bold text-sm">${m.nameES}</div>
                    <div class="text-[10px] opacity-70">${pp} • ${m.power || '—'} pot.</div>
                </button>
            `;
        }).join('');
    }

    async _playerMove(moveIndex) {
        if (battleSim.isOver || !battleSim.isRunning) return;
        // Disable buttons while executing
        document.querySelectorAll('.move-btn').forEach(b => b.disabled = true);
        document.getElementById('battle-switch-panel')?.classList.add('hidden');

        await battleSim.executeTurn(moveIndex);

        if (!battleSim.isOver) this._renderMoveButtons();
    }

    _updateBattleUI(state) {
        if (!state) return;
        const { player, enemy, weather, turn, npcTrainer, battleFormat, playerField, enemyField } = state;

        // Enemy
        if (enemy) {
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('b-enemy-name', enemy.nameES);
            setEl('b-enemy-level', enemy.level);
            setEl('b-enemy-hp-num', `${enemy.currentHP}/${enemy.maxHP}`);
            this._updateHPBar('enemy', enemy.currentHP, enemy.maxHP);
            const sprite = document.getElementById('b-enemy-sprite');
            if (sprite) {
                sprite.src = enemy.sprite || pokeAPI.getPokemonSpriteUrl(enemy.id);
                sprite.classList.toggle('opacity-30', enemy.fainted);
            }
            this._showStatus('enemy', enemy.status);
            const abilityEl = document.getElementById('b-enemy-ability');
            if (abilityEl && enemy.ability) {
                const es = DamageCalc.ABILITIES_ES?.[enemy.ability];
                abilityEl.textContent = es ? `✦ ${es}` : '';
                abilityEl.classList.toggle('hidden', !es);
            }
        }

        // Player
        if (player) {
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('b-player-name', player.nameES);
            setEl('b-player-level', player.level);
            setEl('b-player-hp-num', `${player.currentHP}/${player.maxHP}`);
            this._updateHPBar('player', player.currentHP, player.maxHP);
            const sprite = document.getElementById('b-player-sprite');
            if (sprite) {
                sprite.src = player.sprite || pokeAPI.getPokemonSpriteUrl(player.id);
                sprite.classList.toggle('opacity-30', player.fainted);
            }
            this._showStatus('player', player.status);
            const abilityEl = document.getElementById('b-player-ability');
            if (abilityEl && player.ability) {
                const es = DamageCalc.ABILITIES_ES?.[player.ability];
                abilityEl.textContent = es ? `✦ ${es}` : '';
                abilityEl.classList.toggle('hidden', !es);
            }
        }

        // Weather
        const weatherEl = document.getElementById('b-weather');
        const weatherIcons = { sun: '☀️ Sol', rain: '🌧️ Lluvia', sand: '🌪️ Arena', hail: '❄️ Granizo' };
        if (weatherEl) {
            if (weather && weather !== 'none') {
                weatherEl.textContent = weatherIcons[weather] || weather;
                weatherEl.classList.remove('hidden');
            } else {
                weatherEl.classList.add('hidden');
            }
        }

        // Turn
        const turnEl = document.getElementById('b-turn');
        if (turnEl) turnEl.textContent = `Turno ${turn || 0} · ${npcTrainer?.name || 'Rival'} · ${battleFormat || 'singles-ou'}`;

        if (weatherEl && enemyField) {
            const sideText = [];
            if (enemyField.stealthRock) sideText.push('SR rival');
            if (enemyField.spikes) sideText.push(`Spikes rival ${enemyField.spikes}`);
            if (playerField?.reflect) sideText.push('Reflect tuyo');
            if (playerField?.lightScreen) sideText.push('Light Screen tuya');
            if (sideText.length && weatherEl.classList.contains('hidden')) {
                weatherEl.textContent = sideText.join(' · ');
                weatherEl.classList.remove('hidden');
            }
        }

        this._renderTeamBalls();
    }

    _updateHPBar(side, hp, maxHP) {
        const bar = document.getElementById(`b-${side}-hp`);
        const num = document.getElementById(`b-${side}-hp-num`);
        if (!bar) return;
        const pct = maxHP > 0 ? Math.max(0, (hp / maxHP) * 100) : 0;
        bar.style.width = pct + '%';
        bar.className = `hp-bar-fill ${pct > 50 ? 'hp-high' : pct > 20 ? 'hp-mid' : 'hp-low'}`;
        if (num) num.textContent = `${hp}/${maxHP}`;
    }

    _showStatus(side, status) {
        const el = document.getElementById(`b-${side}-status`);
        if (!el) return;
        const statusMap = { brn:'🔥BRN', par:'⚡PAR', slp:'💤SLP', psn:'☠️PSN', bps:'☠️PSN+', frz:'❄️FRZ' };
        if (status && statusMap[status]) {
            el.textContent = statusMap[status];
            el.className = `status-badge status-${status}`;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    _renderTeamBalls() {
        const container = document.getElementById('battle-team-balls');
        if (!container) return;
        const balls = battleSim.playerTeam.map((p, i) => {
            const cls = p.fainted ? 'opacity-20 grayscale' : i === battleSim.playerIdx ? 'ring-2 ring-cyan-400 scale-125' : '';
            return `<img src="${pokeAPI.getPokemonSpriteUrl(p.id)}" class="w-8 h-8 object-contain transition-all ${cls}" title="${p.nameES}" loading="lazy">`;
        }).join('');
        container.innerHTML = balls;
    }

    battleOpenSwitch(required = false) {
        const panel = document.getElementById('battle-switch-panel');
        const grid  = document.getElementById('battle-team-grid');
        if (!panel || !grid) return;

        grid.innerHTML = battleSim.playerTeam.map((p, i) => {
            if (i === battleSim.playerIdx && !required) return '';
            const hp = p.maxHP > 0 ? Math.round((p.currentHP / p.maxHP) * 100) : 0;
            const disabled = p.fainted || (!required && i === battleSim.playerIdx);
            return `
                <div class="glass rounded-xl p-3 text-center ${disabled ? 'opacity-40' : 'cursor-pointer hover:bg-white/10'} transition-all"
                     onclick="${disabled ? '' : `app._switchTo(${i})`}">
                    <img src="${pokeAPI.getPokemonSpriteUrl(p.id)}" class="w-12 h-12 object-contain mx-auto" loading="lazy">
                    <div class="text-[10px] font-bold capitalize truncate mt-1">${p.nameES}</div>
                    <div class="text-[10px] ${hp > 50 ? 'text-green-400' : hp > 20 ? 'text-yellow-400' : 'text-red-400'}">${hp}% PS</div>
                    ${p.status ? `<div class="text-[9px] text-orange-400">${p.status.toUpperCase()}</div>` : ''}
                </div>
            `;
        }).join('');

        panel.classList.toggle('hidden', panel.classList.contains('hidden') === false && !required);
        if (required) panel.classList.remove('hidden');
    }

    async _switchTo(index) {
        document.getElementById('battle-switch-panel')?.classList.add('hidden');
        if (battleSim.isOver) return;

        if (!battleSim.isRunning) {
            // Force switch (after faint, no cost)
            battleSim._doSwitch('player', index);
            if (!battleSim.isOver) this._renderMoveButtons();
            return;
        }
        await battleSim.executeTurn('switch', index);
        this._renderMoveButtons();
    }

    battleAutoPlay() {
        if (battleSim.autoPlaying) {
            battleSim.stopAuto();
        } else {
            battleSim.startAuto();
        }
    }

    battleForfeit() {
        if (!battleSim.isRunning || battleSim.isOver) return;
        if (!confirm('¿Seguro que quieres rendirte?')) return;
        battleSim.addLog('Te has rendido.', 'log-line-system');
        battleSim._endBattle('enemy');
        this._showBattleResult('enemy');
    }

    _showBattleResult(winner) {
        document.getElementById('battle-over')?.classList.remove('hidden');
        document.getElementById('battle-actions')?.classList.add('hidden');

        const icon  = document.getElementById('battle-result-icon');
        const title = document.getElementById('battle-result-title');
        const sub   = document.getElementById('battle-result-subtitle');
        const stats = BattleSimulator.getStats();

        if (icon)  icon.textContent  = winner === 'player' ? '🏆' : '💀';
        if (title) {
            title.textContent = winner === 'player' ? '¡Has ganado!' : 'Has perdido…';
            title.className   = `font-orbitron text-2xl font-bold mb-2 ${winner === 'player' ? 'text-yellow-400' : 'text-red-400'}`;
        }
        if (sub)   sub.textContent   = `Turno ${battleSim.turn} • ${stats.wins}V / ${stats.losses}D total`;

        // Update dashboard stats
        this.updateDashboardStats();
        this.renderCollectionOverview();
    }

    restartBattle() {
        document.getElementById('battle-over')?.classList.add('hidden');
        document.getElementById('battle-actions')?.classList.remove('hidden');
        this.startBattle();
    }

    rematchNpcTrainer() {
        document.getElementById('battle-over')?.classList.add('hidden');
        document.getElementById('battle-actions')?.classList.remove('hidden');
        this.startBattle();
    }

    showBattleHistory() {
        const history = BattleSimulator.getHistory();
        document.getElementById('battle-modal-hist')?.remove();

        const modal = document.createElement('div');
        modal.id = 'battle-modal-hist';
        modal.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';

        const rows = history.length === 0
            ? '<p class="text-gray-500 text-center py-8">No hay batallas registradas aún.</p>'
            : history.slice(0, 20).map(b => {
                const won  = b.winner === 'player';
                const date = new Date(b.date).toLocaleDateString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
                return `
                    <div class="flex items-center gap-3 p-3 glass rounded-xl">
                        <div class="text-2xl">${won ? '🏆' : '💀'}</div>
                        <div class="flex-1">
                            <div class="font-bold ${won ? 'text-green-400' : 'text-red-400'}">${won ? 'Victoria' : 'Derrota'}</div>
                            <div class="text-xs text-gray-500">${b.turns} turnos · ${date}</div>
                        </div>
                        <div class="flex gap-1">${b.playerTeam.slice(0,3).map(p =>
                            `<img src="${pokeAPI.getPokemonSpriteUrl(p.id)}" class="w-8 h-8 object-contain ${p.fainted?'opacity-30':''}" loading="lazy">`
                        ).join('')}</div>
                    </div>
                `;
            }).join('');

        const stats = BattleSimulator.getStats();
        modal.innerHTML = `
            <div class="glass rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="font-orbitron text-lg font-bold text-purple-400">HISTORIAL DE BATALLAS</h2>
                    <button onclick="document.getElementById('battle-modal-hist').remove()" class="btn btn-ghost btn-sm">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-4">
                    <div class="glass rounded-xl p-3 text-center">
                        <div class="font-orbitron text-xl font-bold text-cyan-400">${stats.total}</div>
                        <div class="text-xs text-gray-400">Batallas</div>
                    </div>
                    <div class="glass rounded-xl p-3 text-center">
                        <div class="font-orbitron text-xl font-bold text-green-400">${stats.wins}</div>
                        <div class="text-xs text-gray-400">Victorias</div>
                    </div>
                    <div class="glass rounded-xl p-3 text-center">
                        <div class="font-orbitron text-xl font-bold text-yellow-400">${stats.winRate}%</div>
                        <div class="text-xs text-gray-400">Win Rate</div>
                    </div>
                </div>
                <div class="space-y-2">${rows}</div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        lucide.createIcons();
    }

    getPreferredArtworkUrl(id, allowPreferredVariant = true) {
        const preferredShiny = allowPreferredVariant && this.preferences.shinySprites;
        return preferredShiny ? pokeAPI.getPokemonImageUrl(id, 'shiny') : pokeAPI.getPokemonImageUrl(id);
    }

    applyPreferences() {
        document.body.classList.toggle('reduced-motion', this.preferences.reducedMotion);
        document.body.classList.toggle('compact-mode', this.preferences.compactMode);
        document.body.classList.toggle('ambient-effects-off', !this.preferences.ambientEffects);
        document.body.classList.toggle('detail-mode-off', !this.preferences.detailedPanels);
    }

    updatePreference(key, value) {
        this.preferences[key] = value;
        this.store.set(`pref_${key}`, value);
        this.applyPreferences();
        this.renderAppStatusPanel();
        this.renderActivityInsights();
        if (this.currentView === 'home') this.loadPokemonOfDay();
        if (this.currentView === 'detail' && this.currentPokemon) this.renderPokemonDetail(this.currentPokemon);
        if (this.currentView === 'list') this.renderPokemonList();
    }

    openSettings() {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) return;
        modalRoot.innerHTML = `
            <div id="settings-modal" class="modal-overlay" onclick="app.closeSettings(event)">
                <div class="settings-modal glass" onclick="event.stopPropagation()">
                    <div class="flex items-center justify-between mb-5">
                        <div>
                            <div class="font-orbitron text-lg text-gradient-cyan">Configuración Pro</div>
                            <div class="text-sm text-gray-500">Ajusta detalle visual, animaciones y comportamiento premium.</div>
                        </div>
                        <button class="btn btn-ghost btn-sm" onclick="app.closeSettings()">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <div class="settings-grid">
                        ${this.createPreferenceToggle('reducedMotion', 'Reducir movimiento', 'Menos animaciones y transiciones para una experiencia más limpia.')}
                        ${this.createPreferenceToggle('compactMode', 'Modo compacto', 'Reduce espacios y densidad visual para navegar más rápido.')}
                        ${this.createPreferenceToggle('shinySprites', 'Sprites shiny por defecto', 'Muestra la variante shiny como preferida donde sea posible.')}
                        ${this.createPreferenceToggle('autoPlayCry', 'Cry automático', 'Reproduce el sonido del Pokémon del día al cargar el inicio.')}
                        ${this.createPreferenceToggle('detailedPanels', 'Detalle extremo', 'Mantiene activas las tarjetas de información premium y resúmenes extra.')}
                        ${this.createPreferenceToggle('ambientEffects', 'Efectos ambientales', 'Controla brillos, capas vivas y ambiente de fondo.')}
                    </div>
                    <div class="glass-sm rounded-xl p-4 mt-5">
                        <div class="text-xs text-gray-400 font-orbitron tracking-widest mb-2">PERFIL ACTUAL</div>
                        <div class="text-sm text-gray-300">${this.describeCurrentProfile()}</div>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    createPreferenceToggle(key, title, description) {
        return `
            <label class="preference-tile">
                <div class="flex-1">
                    <div class="preference-title">${title}</div>
                    <div class="preference-desc">${description}</div>
                </div>
                <input type="checkbox" data-preference="${key}" ${this.preferences[key] ? 'checked' : ''}>
            </label>
        `;
    }

    closeSettings(event = null) {
        if (event && event.target?.id !== 'settings-modal') return;
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot) modalRoot.innerHTML = '';
    }

    describeCurrentProfile() {
        const parts = [];
        parts.push(this.preferences.compactMode ? 'modo compacto' : 'modo inmersivo');
        parts.push(this.preferences.reducedMotion ? 'movimiento reducido' : 'animaciones suaves activas');
        parts.push(this.preferences.shinySprites ? 'preferencia shiny' : 'artwork oficial estándar');
        parts.push(this.preferences.detailedPanels ? 'detalle alto' : 'detalle esencial');
        return `Perfil ${parts.join(' · ')}.`;
    }

    getPokemonPrimaryRole(stats) {
        const attack = stats.attack || 0;
        const spAttack = stats['special-attack'] || 0;
        const speed = stats.speed || 0;
        const bulk = (stats.hp || 0) + Math.max(stats.defense || 0, stats['special-defense'] || 0);

        if (speed >= 110 && Math.max(attack, spAttack) >= 100) return 'Cleaner / revenge killer';
        if (bulk >= 190 && speed < 90) return 'Wall / pivote defensivo';
        if (attack >= 120 && attack > spAttack + 15) return 'Breaker físico';
        if (spAttack >= 120 && spAttack > attack + 15) return 'Breaker especial';
        if (speed >= 95 && bulk >= 170) return 'Balance ofensivo';
        return 'Utility / soporte flexible';
    }

    getPokemonMatchupSummary(types) {
        const offenseTargets = [];
        const defenseRisks = [];
        Object.keys(pokeAPI.typeEffectiveness).forEach(type => {
            const offensiveHit = types.some(ownType => pokeAPI.calculateEffectiveness(ownType, [type]) > 1);
            const defensiveHit = pokeAPI.calculateEffectiveness(type, types);
            if (offensiveHit) offenseTargets.push(type);
            if (defensiveHit > 1) defenseRisks.push(type);
        });
        const offense = offenseTargets.length ? offenseTargets.slice(0, 4).map(t => pokeAPI.typeNamesES[t]).join(', ') : 'Cobertura neutral';
        const defense = defenseRisks.length ? `Debe vigilar ${defenseRisks.slice(0, 4).map(t => pokeAPI.typeNamesES[t]).join(', ')}` : 'Perfil defensivo estable';
        return { offense, defense };
    }

    getPokemonBuildSummary(pokemon, stats) {
        const bestOffense = (stats.attack || 0) >= (stats['special-attack'] || 0) ? 'Ataque' : 'At. Esp.';
        const bestDefense = (stats.defense || 0) >= (stats['special-defense'] || 0) ? 'Defensa' : 'Def. Esp.';
        const fast = (stats.speed || 0) >= 100;
        const detail = fast
            ? `Aprovecha ${bestOffense} y Velocidad alta. Funciona mejor con presión ofensiva, pivoting y entrada segura.`
            : `Combina ${bestOffense} con ${bestDefense} para intercambios más sólidos y castigar cambios rivales.`;
        return {
            summary: fast ? `${bestOffense} + Speed` : `${bestOffense} + ${bestDefense}`,
            detail,
        };
    }

    updateVariantState(id, field, checked) {
        this.collection.setVariantState(id, field, checked);
        this.renderCollectionOverview();
    }

    savePokemonNote(id, note) {
        this.collection.setPokemonNote(id, note);
        this._toastMsg('Nota guardada.');
    }

    renderCollectionOverview() {
        const stats = this.collection.getCollectionStats(1025);
        const overview = document.getElementById('collection-overview');
        const progress = document.getElementById('collection-gen-progress');
        if (overview) {
            overview.innerHTML = `
                <div class="glass-sm rounded-xl p-3">
                    <div class="text-[11px] text-gray-500">Capturados</div>
                    <div class="font-orbitron text-2xl text-green-400">${stats.captured}</div>
                    <div class="text-xs text-gray-500">${stats.captureRate}% de la National Dex</div>
                </div>
                <div class="glass-sm rounded-xl p-3">
                    <div class="text-[11px] text-gray-500">Favoritos</div>
                    <div class="font-orbitron text-2xl text-pink-400">${stats.favorites}</div>
                    <div class="text-xs text-gray-500">${stats.customLists} listas personalizadas</div>
                </div>
                <div class="glass-sm rounded-xl p-3">
                    <div class="text-[11px] text-gray-500">Shiny check</div>
                    <div class="font-orbitron text-2xl text-yellow-400">${stats.shinyCount}</div>
                    <div class="text-xs text-gray-500">${stats.formCount} variantes extra</div>
                </div>
                <div class="glass-sm rounded-xl p-3">
                    <div class="text-[11px] text-gray-500">Pendientes</div>
                    <div class="font-orbitron text-2xl text-cyan-400">${stats.uncaptured}</div>
                    <div class="text-xs text-gray-500">Objetivo: living dex</div>
                </div>
            `;
        }
        if (progress) {
            progress.innerHTML = this.collection.getGenerationProgress(this.generationBuckets).map(item => `
                <div>
                    <div class="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Gen ${item.gen}</span>
                        <span>${item.count}/${item.total}</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${item.percent}%"></div>
                    </div>
                </div>
            `).join('');
        }
    }

    renderAppStatusPanel() {
        const container = document.getElementById('app-status-panel');
        if (!container) return;
        const cacheSize = this.pokemonList.length;
        const activeEffects = [
            this.preferences.ambientEffects ? 'ambiente on' : 'ambiente off',
            this.preferences.reducedMotion ? 'motion reducido' : 'motion suave',
            this.preferences.compactMode ? 'compacta' : 'expandida',
        ];
        container.innerHTML = `
            <div class="status-card-row">
                <div class="status-chip-large">
                    <span class="status-chip-label">Dataset activo</span>
                    <span class="status-chip-value">${cacheSize} Pokémon</span>
                </div>
                <div class="status-chip-large">
                    <span class="status-chip-label">Render profile</span>
                    <span class="status-chip-value">${activeEffects.join(' · ')}</span>
                </div>
            </div>
            <div class="status-card-row">
                <div class="status-chip-large">
                    <span class="status-chip-label">Colección</span>
                    <span class="status-chip-value">${this.collection.getLists().length} listas, ${this.collection.getVariantChecks() ? Object.keys(this.collection.getVariantChecks()).length : 0} fichas con tracking</span>
                </div>
            </div>
        `;
    }

    renderActivityInsights() {
        const container = document.getElementById('activity-insights');
        if (!container) return;
        const collectionStats = this.collection.getCollectionStats(1025);
        const battleStats = BattleSimulator.getStats();
        const hints = [
            `${Math.max(0, 12 - this.collection.getRecent().length)} huecos libres para ampliar tu historial reciente antes de reciclarse.`,
            collectionStats.captureRate < 50 ? 'Te conviene priorizar capturas por generación para acelerar el living dex.' : 'Tu living dex ya va muy sólido; toca refinar variantes y cajas temáticas.',
            battleStats.total < 5 ? 'Haz más combates para llenar el historial y generar métricas más fiables.' : `Tu win rate actual es ${battleStats.winRate}% en el sandbox.`,
        ];
        container.innerHTML = hints.map((hint, index) => `
            <div class="insight-banner ${index === 1 ? 'primary' : ''}">
                <div class="text-sm text-gray-200">${hint}</div>
            </div>
        `).join('');
    }

    renderMetaRankings() {
        const container = document.getElementById('meta-rankings');
        if (!container) return;
        this.pokemonIndex = PokedexFilters.buildIndex(this.pokemonList);
        const rankings = PokedexFilters.getTopRankings(this.pokemonIndex, 4);
        const renderGroup = (label, entries, key) => `
            <div class="glass-sm rounded-xl p-3">
                <div class="text-[11px] text-gray-500 font-orbitron tracking-widest mb-2">${label}</div>
                <div class="space-y-2">
                    ${entries.map(entry => `
                        <button onclick="app.navigate('detail', ${entry.id})" class="ranking-row">
                            <span class="text-cyan-400">${pokeAPI.formatId(entry.id)}</span>
                            <span class="capitalize">${entry.name.replace(/-/g, ' ')}</span>
                            <span class="ml-auto text-gray-400">${key === 'bst' ? entry.bst : entry.stats[key]}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        container.innerHTML = [
            renderGroup('BST MÁS ALTOS', rankings.bst, 'bst'),
            renderGroup('SPEED TIERS', rankings.speed, 'speed'),
            renderGroup('ATAQUE BRUTO', rankings.attack, 'attack'),
            renderGroup('MUROS FÍSICOS', rankings.defense, 'defense'),
        ].join('');
    }

    renderCollectionLists() {
        const container = document.getElementById('collection-custom-lists');
        if (!container) return;
        const lists = this.collection.getLists();
        if (lists.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Aún no hay listas guardadas. Puedes guardar tus favoritos actuales como caja temática.</p>';
            return;
        }
        container.innerHTML = lists.map(list => `
            <div class="glass-sm rounded-xl p-4">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="font-orbitron text-sm text-pink-300">${list.name}</div>
                        <div class="text-xs text-gray-500 mt-1">${list.description || 'Sin descripción'}</div>
                    </div>
                    <button onclick="app.deleteCollectionList('${list.id}')" class="btn btn-ghost btn-sm">Borrar</button>
                </div>
                <div class="text-xs text-gray-400 mt-3">${list.pokemonIds.length} Pokémon guardados</div>
                <div class="flex flex-wrap gap-1 mt-3">
                    ${list.pokemonIds.slice(0, 12).map(id => `<img src="${pokeAPI.getPokemonSpriteUrl(id)}" class="w-8 h-8 object-contain" loading="lazy">`).join('')}
                </div>
            </div>
        `).join('');
    }

    saveCurrentFavoritesAsList() {
        const name = document.getElementById('collection-list-name')?.value?.trim();
        const description = document.getElementById('collection-list-description')?.value?.trim();
        if (!name) {
            this._toastMsg('Ponle un nombre a la lista.');
            return;
        }
        this.collection.saveList({ name, description, pokemonIds: this.favorites });
        document.getElementById('collection-list-name').value = '';
        document.getElementById('collection-list-description').value = '';
        this.renderCollectionLists();
        this.renderCollectionOverview();
        this._toastMsg('Lista guardada en tu colección.');
    }

    deleteCollectionList(id) {
        this.collection.deleteList(id);
        this.renderCollectionLists();
        this.renderCollectionOverview();
    }

    exportCollection() {
        const data = this.collection.exportCollection();
        navigator.clipboard.writeText(JSON.stringify(data, null, 2))
            .then(() => this._toastMsg('Colección copiada al portapapeles en JSON.'))
            .catch(() => this._toastMsg('No se pudo copiar la colección.'));
    }

    async importCollection() {
        const raw = prompt('Pega aquí el JSON de tu colección exportada:');
        if (!raw) return;
        try {
            this.collection.importCollection(JSON.parse(raw));
            this.favorites = this.collection.getFavorites();
            this.captured = this.collection.getCaptured();
            this.renderFavorites();
            this.renderCollectionOverview();
            this.updateDashboardStats();
            this._toastMsg('Colección importada correctamente.');
        } catch (error) {
            this._toastMsg('El JSON de colección no es válido.');
        }
    }

    saveCurrentTeam() {
        if (!this.battleTeam?.length) {
            this._toastMsg('No hay equipo para guardar.');
            return;
        }
        const name = document.getElementById('team-name')?.value?.trim() || '';
        const notes = document.getElementById('team-notes')?.value?.trim() || '';
        this.teamBuilder.saveTeam(this.battleTeam, { name: name || undefined, notes, mode: this.selectedBattleTeamType || 'manual' });
        if (document.getElementById('team-name')) document.getElementById('team-name').value = '';
        if (document.getElementById('team-notes')) document.getElementById('team-notes').value = '';
        this.renderSavedTeams();
        this._toastMsg('Equipo guardado.');
    }

    renderSavedTeams() {
        const container = document.getElementById('saved-teams');
        if (!container) return;
        const teams = this.teamBuilder.getTeams();
        if (teams.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Todavía no hay equipos guardados.</p>';
            return;
        }
        container.innerHTML = teams.map(team => `
            <div class="glass-sm rounded-xl p-3">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="font-orbitron text-sm text-cyan-300">${team.name}</div>
                        <div class="text-xs text-gray-500 mt-1">${team.notes || 'Sin notas'}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="app.loadSavedTeam('${team.id}')" class="btn btn-ghost btn-sm">Cargar</button>
                        <button onclick="app.exportTeam('${team.id}')" class="btn btn-ghost btn-sm">Exportar</button>
                        <button onclick="app.deleteSavedTeam('${team.id}')" class="btn btn-ghost btn-sm">Borrar</button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1 mt-3">
                    ${team.members.map(member => `<img src="${pokeAPI.getPokemonSpriteUrl(member.id)}" class="w-9 h-9 object-contain" loading="lazy">`).join('')}
                </div>
            </div>
        `).join('');
    }

    loadSavedTeam(teamId) {
        const team = this.teamBuilder.getTeams().find(item => item.id === teamId);
        if (!team) {
            this._toastMsg('No se encontró ese equipo.');
            return;
        }
        this.battleTeam = team.members;
        this.selectedBattleTeamType = 'manual';
        this.battleSetTeamType('manual');
        this.renderTeamSlots();
        this._toastMsg(`Equipo "${team.name}" cargado.`);
    }

    deleteSavedTeam(teamId) {
        this.teamBuilder.deleteTeam(teamId);
        this.renderSavedTeams();
    }

    exportTeam(teamId) {
        try {
            const raw = this.teamBuilder.exportTeam(teamId);
            navigator.clipboard.writeText(raw)
                .then(() => this._toastMsg('Equipo copiado al portapapeles.'))
                .catch(() => this._toastMsg('No se pudo copiar el equipo.'));
        } catch (error) {
            this._toastMsg('No se pudo exportar el equipo.');
        }
    }

    importTeam() {
        const raw = prompt('Pega aquí el JSON de un equipo exportado:');
        if (!raw) return;
        try {
            const saved = this.teamBuilder.importTeam(raw);
            this.renderSavedTeams();
            this._toastMsg(`Equipo "${saved.name}" importado.`);
        } catch (error) {
            this._toastMsg('No se pudo importar el equipo.');
        }
    }

    _syncBattleUI() {
        // Re-generate slot display
        if (!this.battleTeam) this.battleTeam = [];
    }

    _toastMsg(msg) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 z-50 glass rounded-xl px-4 py-3 text-sm text-white shadow-lg';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Initialize app
const app = new PokedexApp();
