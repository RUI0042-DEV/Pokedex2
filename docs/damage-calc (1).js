/**
 * Pokédex Pro — Calculadora de Daño (Fórmula Gen 9)
 * Basada en la mecánica oficial de Pokémon Escarlata/Violeta
 * Con soporte para habilidades de batalla
 */

const DamageCalc = (() => {

  // ── Naturalezas ────────────────────────────────────────────
  const NATURES = {
    'Hardy':    { plus: null, minus: null },
    'Lonely':   { plus: 'attack',  minus: 'defense' },
    'Brave':    { plus: 'attack',  minus: 'speed' },
    'Adamant':  { plus: 'attack',  minus: 'special-attack' },
    'Naughty':  { plus: 'attack',  minus: 'special-defense' },
    'Bold':     { plus: 'defense', minus: 'attack' },
    'Docile':   { plus: null, minus: null },
    'Relaxed':  { plus: 'defense', minus: 'speed' },
    'Impish':   { plus: 'defense', minus: 'special-attack' },
    'Lax':      { plus: 'defense', minus: 'special-defense' },
    'Timid':    { plus: 'speed',   minus: 'attack' },
    'Hasty':    { plus: 'speed',   minus: 'defense' },
    'Serious':  { plus: null, minus: null },
    'Jolly':    { plus: 'speed',   minus: 'special-attack' },
    'Naive':    { plus: 'speed',   minus: 'special-defense' },
    'Modest':   { plus: 'special-attack', minus: 'attack' },
    'Mild':     { plus: 'special-attack', minus: 'defense' },
    'Quiet':    { plus: 'special-attack', minus: 'speed' },
    'Bashful':  { plus: null, minus: null },
    'Rash':     { plus: 'special-attack', minus: 'special-defense' },
    'Calm':     { plus: 'special-defense', minus: 'attack' },
    'Gentle':   { plus: 'special-defense', minus: 'defense' },
    'Sassy':    { plus: 'special-defense', minus: 'speed' },
    'Careful':  { plus: 'special-defense', minus: 'special-attack' },
    'Quirky':   { plus: null, minus: null },
  };

  const NATURES_ES = {
    'Hardy':'Fuerte','Lonely':'Solitaria','Brave':'Audaz','Adamant':'Firme','Naughty':'Pícara',
    'Bold':'Osada','Docile':'Dócil','Relaxed':'Plácida','Impish':'Agitada','Lax':'Floja',
    'Timid':'Miedosa','Hasty':'Activa','Serious':'Seria','Jolly':'Alegre','Naive':'Ingenua',
    'Modest':'Modesta','Mild':'Afable','Quiet':'Quieta','Bashful':'Tímida','Rash':'Alocada',
    'Calm':'Serena','Gentle':'Amable','Sassy':'Grosera','Careful':'Cauta','Quirky':'Rara',
  };

  // ── Objetos ────────────────────────────────────────────────
  const ITEMS = {
    'none': {},
    // Choice items
    'choice-band':       { atkMult: 1.5, cat: 'physical' },
    'choice-specs':      { atkMult: 1.5, cat: 'special' },
    'choice-scarf':      { spdMult: 1.5 },
    // Power items
    'life-orb':          { atkMult: 1.3 },
    'expert-belt':       { superEffMult: 1.2 },
    'muscle-band':       { atkMult: 1.1, cat: 'physical' },
    'wise-glasses':      { atkMult: 1.1, cat: 'special' },
    // Defense items
    'assault-vest':      { spDefMult: 1.5 },
    'eviolite':          { defMult: 1.5, spDefMult: 1.5 },
    'rocky-helmet':      {},
    // Gen 9
    'loaded-dice':       {},
    'covert-cloak':      {},
    'booster-energy':    {},
    'mirror-herb':       {},
    'clear-amulet':      {},
    // Type boosters +20%
    'black-belt':        { typeMult: 1.2, type: 'fighting' },
    'charcoal':          { typeMult: 1.2, type: 'fire' },
    'mystic-water':      { typeMult: 1.2, type: 'water' },
    'miracle-seed':      { typeMult: 1.2, type: 'grass' },
    'magnet':            { typeMult: 1.2, type: 'electric' },
    'never-melt-ice':    { typeMult: 1.2, type: 'ice' },
    'black-glasses':     { typeMult: 1.2, type: 'dark' },
    'sharp-beak':        { typeMult: 1.2, type: 'flying' },
    'poison-barb':       { typeMult: 1.2, type: 'poison' },
    'soft-sand':         { typeMult: 1.2, type: 'ground' },
    'hard-stone':        { typeMult: 1.2, type: 'rock' },
    'silver-powder':     { typeMult: 1.2, type: 'bug' },
    'spell-tag':         { typeMult: 1.2, type: 'ghost' },
    'twisted-spoon':     { typeMult: 1.2, type: 'psychic' },
    'dragon-fang':       { typeMult: 1.2, type: 'dragon' },
    'metal-coat':        { typeMult: 1.2, type: 'steel' },
    'silk-scarf':        { typeMult: 1.2, type: 'normal' },
    'fairy-feather':     { typeMult: 1.2, type: 'fairy' },
    // Plates (Arceus) +20%
    'flame-plate':       { typeMult: 1.2, type: 'fire' },
    'splash-plate':      { typeMult: 1.2, type: 'water' },
    'meadow-plate':      { typeMult: 1.2, type: 'grass' },
    'zap-plate':         { typeMult: 1.2, type: 'electric' },
    'icicle-plate':      { typeMult: 1.2, type: 'ice' },
    'fist-plate':        { typeMult: 1.2, type: 'fighting' },
    'toxic-plate':       { typeMult: 1.2, type: 'poison' },
    'earth-plate':       { typeMult: 1.2, type: 'ground' },
    'sky-plate':         { typeMult: 1.2, type: 'flying' },
    'mind-plate':        { typeMult: 1.2, type: 'psychic' },
    'insect-plate':      { typeMult: 1.2, type: 'bug' },
    'stone-plate':       { typeMult: 1.2, type: 'rock' },
    'spooky-plate':      { typeMult: 1.2, type: 'ghost' },
    'draco-plate':       { typeMult: 1.2, type: 'dragon' },
    'dread-plate':       { typeMult: 1.2, type: 'dark' },
    'iron-plate':        { typeMult: 1.2, type: 'steel' },
    'pixie-plate':       { typeMult: 1.2, type: 'fairy' },
  };

  const ITEMS_ES = {
    'none': 'Sin objeto',
    'choice-band': 'Cinta Elegida',
    'choice-specs': 'Gafas Elegidas',
    'choice-scarf': 'Pañuelo Elegido',
    'life-orb': 'Orbe Vida',
    'assault-vest': 'Chaleco Asalto',
    'eviolite': 'Eviolita',
    'rocky-helmet': 'Casco Tachonado',
    'expert-belt': 'Cinturón Experto',
    'muscle-band': 'Cinta Muscular',
    'wise-glasses': 'Gafas Sabias',
    'loaded-dice': 'Dado Cargado',
    'covert-cloak': 'Capa Encubierta',
    'booster-energy': 'Energía Turbo',
    'mirror-herb': 'Hierba Espejo',
    'clear-amulet': 'Amuleto Puro',
    'black-belt': 'Cinto Negro',
    'charcoal': 'Carbón',
    'mystic-water': 'Agua Mística',
    'miracle-seed': 'Semilla Milagro',
    'magnet': 'Imán',
    'never-melt-ice': 'Hielo Eterno',
    'black-glasses': 'Gafas Negras',
    'sharp-beak': 'Pico Afilado',
    'poison-barb': 'Clavovenen',
    'soft-sand': 'Arena Suave',
    'hard-stone': 'Piedra Dura',
    'silver-powder': 'Polvoplata',
    'spell-tag': 'Tarjeta Suerte',
    'twisted-spoon': 'Cucharatorcida',
    'dragon-fang': 'Colmillo Dragón',
    'metal-coat': 'Baño Metálico',
    'silk-scarf': 'Pañuelofino',
    'fairy-feather': 'Pluma Hada',
    'flame-plate': 'Tabla Llama',
    'splash-plate': 'Tabla Salpicadura',
    'meadow-plate': 'Tabla Pradera',
    'zap-plate': 'Tabla Rayo',
    'icicle-plate': 'Tabla Carámbano',
    'fist-plate': 'Tabla Puño',
    'toxic-plate': 'Tabla Tóxica',
    'earth-plate': 'Tabla Tierra',
    'sky-plate': 'Tabla Cielo',
    'mind-plate': 'Tabla Mente',
    'insect-plate': 'Tabla Insecto',
    'stone-plate': 'Tabla Piedra',
    'spooky-plate': 'Tabla Espectro',
    'draco-plate': 'Tabla Draco',
    'dread-plate': 'Tabla Terror',
    'iron-plate': 'Tabla Hierro',
    'pixie-plate': 'Tabla Pixie',
  };

  // ── Habilidades con efecto en el cálculo de daño ──────────
  const ABILITIES = {
    // Atacante — Boost ataque
    'huge-power':        { desc: 'Duplica el Ataque físico', atkMult: 2.0, cat: 'physical' },
    'pure-power':        { desc: 'Duplica el Ataque físico', atkMult: 2.0, cat: 'physical' },
    'gorilla-tactics':   { desc: 'Multiplica Ataque ×1.5', atkMult: 1.5, cat: 'physical' },
    'hustle':            { desc: 'Ataque ×1.5 pero precisión física ×0.8', atkMult: 1.5, cat: 'physical' },
    'guts':              { desc: 'Ataque ×1.5 con estado (Coraje)', atkMult: 1.5, cat: 'physical', requiresStatus: true },
    'flower-gift':       { desc: 'En sol: Ataque y Def.Esp del equipo ×1.5', atkMult: 1.5, requiresWeather: 'sun', cat: 'physical' },
    'plus':              { desc: '+50% At.Esp en dupla con Minus', atkMult: 1.5, cat: 'special' },
    'minus':             { desc: '+50% At.Esp en dupla con Plus', atkMult: 1.5, cat: 'special' },
    'solar-power':       { desc: 'En sol: At.Esp ×1.5 pero pierde PS', atkMult: 1.5, cat: 'special', requiresWeather: 'sun' },
    // STAB boost
    'adaptability':      { desc: 'STAB sube de ×1.5 a ×2', stabMult: 2.0 },
    // Tipo boost
    'blaze':             { desc: 'Fuego ×1.5 con PS bajos', typeMult: 1.5, type: 'fire', requiresLowHP: true },
    'torrent':           { desc: 'Agua ×1.5 con PS bajos', typeMult: 1.5, type: 'water', requiresLowHP: true },
    'overgrow':          { desc: 'Planta ×1.5 con PS bajos', typeMult: 1.5, type: 'grass', requiresLowHP: true },
    'swarm':             { desc: 'Bicho ×1.5 con PS bajos', typeMult: 1.5, type: 'bug', requiresLowHP: true },
    'technician':        { desc: 'Movimientos de pol ≤60 reciben ×1.5', special: 'technician' },
    'tough-claws':       { desc: 'Ataques de contacto ×1.3', special: 'tough-claws', atkMult: 1.3, cat: 'physical' },
    'iron-fist':         { desc: 'Movimientos de puño ×1.2', special: 'iron-fist' },
    'strong-jaw':        { desc: 'Ataques de mordida ×1.5', special: 'strong-jaw' },
    'mega-launcher':     { desc: 'Pulso y onda de aire ×1.5', special: 'mega-launcher' },
    'sheer-force':       { desc: '+30% poder, elimina efectos secundarios', atkMult: 1.3 },
    'reckless':          { desc: '+20% poder a ataques de retroceso', special: 'reckless' },
    'pixilate':          { desc: 'Normal → Hada +20%', special: 'pixilate' },
    'refrigerate':       { desc: 'Normal → Hielo +20%', special: 'refrigerate' },
    'galvanize':         { desc: 'Normal → Eléctrico +20%', special: 'galvanize' },
    'aerilate':          { desc: 'Normal → Volador +20%', special: 'aerilate' },
    'normalize':         { desc: 'Todos los ataques → Normal', special: 'normalize' },
    'sand-force':        { desc: 'Tierra/Roca/Acero ×1.3 en tormenta', typeMult: 1.3, special: 'sand-force', requiresWeather: 'sand' },
    'analytic':          { desc: '+30% poder si el rival mueve primero', atkMult: 1.3 },
    'sniper':            { desc: 'Críticos hacen ×2.25 en lugar de ×1.5', special: 'sniper' },
    'neuroforce':        { desc: 'Super efectivo ×1.25', superEffMult: 1.25 },
    // Atacante — Cambio de categoría
    'photon-geyser':     { desc: 'Usa el stat más alto', special: 'photon-geyser' },
    // Defensor — Resistencias
    'thick-fat':         { desc: 'Resiste Fuego e Hielo ×0.5', special: 'thick-fat' },
    'heatproof':         { desc: 'Daño de fuego a la mitad', resistType: 'fire', resistMult: 0.5 },
    'dry-skin':          { desc: 'Inmune al Agua; Fuego hace ×1.25', special: 'dry-skin' },
    'filter':            { desc: 'Super efectivo ×0.75', specialDef: 'filter' },
    'solid-rock':        { desc: 'Super efectivo ×0.75', specialDef: 'solid-rock' },
    'prism-armor':       { desc: 'Super efectivo ×0.75', specialDef: 'prism-armor' },
    'multiscale':        { desc: 'A PS máximos: daño ×0.5', specialDef: 'multiscale' },
    'shadow-shield':     { desc: 'A PS máximos: daño ×0.5', specialDef: 'shadow-shield' },
    'fluffy':            { desc: 'Contacto ×0.5; Fuego ×2', specialDef: 'fluffy' },
    'fur-coat':          { desc: 'Defensa física ×2', defMult: 2.0, cat: 'physical' },
    'ice-scales':        { desc: 'Def. Especial ×2', defMult: 2.0, cat: 'special' },
    // Inmunidades tipo
    'levitate':          { desc: 'Inmune a Tierra', immuneType: 'ground' },
    'flash-fire':        { desc: 'Inmune a Fuego; activa boost ×1.5', immuneType: 'fire', boostOnHit: 1.5 },
    'water-absorb':      { desc: 'Inmune a Agua; recupera PS', immuneType: 'water' },
    'volt-absorb':       { desc: 'Inmune a Eléctrico; recupera PS', immuneType: 'electric' },
    'motor-drive':       { desc: 'Inmune a Eléctrico; sube Velocidad', immuneType: 'electric' },
    'lightning-rod':     { desc: 'Inmune a Eléctrico; sube At.Esp', immuneType: 'electric' },
    'storm-drain':       { desc: 'Inmune a Agua; sube At.Esp', immuneType: 'water' },
    'sap-sipper':        { desc: 'Inmune a Planta; sube Ataque', immuneType: 'grass' },
    'earth-eater':       { desc: 'Inmune a Tierra; recupera PS', immuneType: 'ground' },
    'wonder-guard':      { desc: 'Solo daña super efectivo', special: 'wonder-guard' },
    // Boost en condiciones
    'chlorophyll':       { desc: 'Velocidad ×2 en sol', spdMult: 2.0, requiresWeather: 'sun' },
    'swift-swim':        { desc: 'Velocidad ×2 en lluvia', spdMult: 2.0, requiresWeather: 'rain' },
    // Otros con efecto notable en batalla
    'intimidate':        { desc: 'Al entrar en combate, baja el Ataque del rival', defMult: 1.0, special: 'intimidate' },
    'download':          { desc: 'Sube At. o At.Esp según las defensas del rival', special: 'download' },
    'pressure':          { desc: 'Los movimientos del rival gastan 2 PP en lugar de 1', special: 'pressure' },
    'speed-boost':       { desc: 'Velocidad sube 1 nivel al final de cada turno', special: 'speed-boost' },
    'protean':           { desc: 'Cambia el tipo del Pkm al tipo del movimiento usado', special: 'protean' },
    'libero':            { desc: 'Idéntico a Mutatipo: cambia tipo al usar un movimiento', special: 'libero' },
    'magic-guard':       { desc: 'Solo recibe daño de ataques directos, no daño indirecto', special: 'magic-guard' },
    'regenerator':       { desc: 'Recupera 1/3 de sus PS al ser retirado del combate', special: 'regenerator' },
    'natural-cure':      { desc: 'Cualquier estado se cura al ser retirado del combate', special: 'natural-cure' },
    'sturdy':            { desc: 'No puede ser noqueado de un golpe si tiene los PS llenos', special: 'sturdy' },
    'mummy':             { desc: 'Al ser golpeado por contacto, la habilidad del rival se convierte en Momia', special: 'mummy' },
    'truant':            { desc: 'El Pokémon solo puede atacar cada dos turnos', special: 'truant' },
    'defiant':           { desc: 'Cuando bajan sus stats, el Ataque sube 2 niveles', atkMult: 1.0, special: 'defiant' },
    'competitive':       { desc: 'Cuando bajan sus stats, el At.Esp sube 2 niveles', special: 'competitive' },
    'unnerve':           { desc: 'El rival no puede comer su baya durante el combate', special: 'unnerve' },
    'scrappy':           { desc: 'Puede golpear a Pokémon tipo Fantasma con ataques Normales y Lucha', special: 'scrappy' },
    'serene-grace':      { desc: 'Dobla la probabilidad de efectos secundarios de los movimientos', special: 'serene-grace' },
    'magician':          { desc: 'Roba el objeto del rival al golpearle', special: 'magician' },
  };

  const ABILITIES_ES = {
    'huge-power':      'Potencia',
    'pure-power':      'Fuerza Pura',
    'gorilla-tactics': 'Tácticas Bruta',
    'hustle':          'Entusiasmo',
    'guts':            'Agallas',
    'adaptability':    'Adaptación',
    'blaze':           'Mar Llamas',
    'torrent':         'Torrente',
    'overgrow':        'Espesura',
    'swarm':           'Enjambre',
    'technician':      'Técnico',
    'tough-claws':     'Garras Toscas',
    'iron-fist':       'Puño Férreo',
    'strong-jaw':      'Mandíbula Fuerte',
    'mega-launcher':   'Mega Lanzador',
    'sheer-force':     'Potencia Bruta',
    'reckless':        'Osadía',
    'pixilate':        'Pixilar',
    'refrigerate':     'Refrigerar',
    'galvanize':       'Galvanizar',
    'aerilate':        'Aerodinámica',
    'normalize':       'Normalizar',
    'sand-force':      'Fuerza Arena',
    'analytic':        'Análisis',
    'sniper':          'Francotirador',
    'neuroforce':      'Neurofuerza',
    'thick-fat':       'Grasa',
    'heatproof':       'Ignífugo',
    'dry-skin':        'Piel Seca',
    'filter':          'Filtro',
    'solid-rock':      'Roca Sólida',
    'prism-armor':     'Armadura Prisma',
    'multiscale':      'Multiescamas',
    'shadow-shield':   'Escudo Umbra',
    'fluffy':          'Mullido',
    'fur-coat':        'Pelo Espeso',
    'ice-scales':      'Escamas Hielo',
    'levitate':        'Levitación',
    'flash-fire':      'Absorbe Fuego',
    'water-absorb':    'Absorbe Agua',
    'volt-absorb':     'Absorbe Elec.',
    'motor-drive':     'Motor Eléctrico',
    'lightning-rod':   'Pararrayos',
    'storm-drain':     'Rompeolas',
    'sap-sipper':      'Herbívoro',
    'earth-eater':     'Geófago',
    'wonder-guard':    'Guardia Mágica',
    'chlorophyll':     'Clorofila',
    'swift-swim':      'Nado Rápido',
    'flower-gift':     'Don Flora',
    'plus':            'Más',
    'minus':           'Menos',
    'solar-power':     'Poder Solar',
    'intimidate':      'Intimidación',
    'download':        'Descarga',
    'pressure':        'Presión',
    'speed-boost':     'Impulso',
    'protean':         'Mutatipo',
    'libero':          'Líbero',
    'magic-guard':     'Barrera Mágica',
    'mummy':           'Momia',
    'truant':          'Holgazán',
    'defiant':         'Combativo',
    'competitive':     'Competitividad',
    'unnerve':         'Tensión',
    'scrappy':         'Temerario',
    'sturdy':          'Robustez',
    'regenerator':     'Regeneración',
    'natural-cure':    'Cura Natural',
    'serene-grace':    'Gracia Serena',
    'magician':        'Mago',
  };


  // ── Stat Calc ──────────────────────────────────────────────
  function calcStat(base, iv, ev, level, statName, nature) {
    iv  = Math.max(0, Math.min(31, iv));
    ev  = Math.max(0, Math.min(252, ev));
    const evBonus = Math.floor(ev / 4);
    let stat;
    if (statName === 'hp') {
      stat = Math.floor(((2 * base + iv + evBonus) * level) / 100) + level + 10;
    } else {
      stat = Math.floor(((2 * base + iv + evBonus) * level) / 100) + 5;
      const nat = NATURES[nature];
      if (nat) {
        if (nat.plus === statName)  stat = Math.floor(stat * 1.1);
        if (nat.minus === statName) stat = Math.floor(stat * 0.9);
      }
    }
    return stat;
  }

  // ── Effectiveness ──────────────────────────────────────────
  function getTypeEffectiveness(moveType, defenderTypes) {
    let mult = 1;
    const eff = typeof pokeAPI !== 'undefined' ? pokeAPI.typeEffectiveness : {};
    defenderTypes.forEach(defType => {
      const data = eff[defType];
      if (!data) return;
      if (data.immune.includes(moveType))  mult *= 0;
      else if (data.weak.includes(moveType))   mult *= 2;
      else if (data.resist.includes(moveType)) mult *= 0.5;
    });
    return mult;
  }

  // ── Ability processing ─────────────────────────────────────
  /**
   * Apply attacker ability modifiers
   * Returns { atkMult, stabMult, typeOverride, immuneOverride, powerMult, notes }
   */
  function applyAttackerAbility(ability, move, weather, atkLowHP) {
    const ab = ABILITIES[ability];
    if (!ab) return { atkMult: 1, stabMult: null, powerMult: 1, notes: [] };

    const notes = [];
    let atkMult  = 1;
    let stabMult = null;
    let powerMult = 1;

    // Huge Power / Pure Power
    if (ab.atkMult && (!ab.requiresStatus) && (!ab.requiresWeather || ab.requiresWeather === weather)) {
      if (!ab.cat || ab.cat === move.category) {
        atkMult *= ab.atkMult;
        notes.push(`${ABILITIES_ES[ability] || ability}: ×${ab.atkMult}`);
      }
    }

    // Type boosts
    if (ab.typeMult && ab.type === move.type && (!ab.requiresWeather || ab.requiresWeather === weather)) {
      powerMult *= ab.typeMult;
      notes.push(`${ABILITIES_ES[ability] || ability}: +${Math.round((ab.typeMult-1)*100)}%`);
    }

    // Low HP boosts (Blaze, Torrent, etc.)
    if (ab.requiresLowHP && atkLowHP && ab.typeMult && ab.type === move.type) {
      powerMult *= ab.typeMult;
      notes.push(`${ABILITIES_ES[ability] || ability}: PS bajos ×${ab.typeMult}`);
    }

    // Adaptability
    if (ab.stabMult) {
      stabMult = ab.stabMult;
      notes.push(`${ABILITIES_ES[ability] || ability}: STAB ×${ab.stabMult}`);
    }

    // Sheer Force
    if (ab.special === undefined && ab.atkMult && ab.cat === move.category) {
      // already handled
    }

    // Super-eff multiplier
    if (ab.superEffMult && ab.superEffMult) {
      // handled in main calc
    }

    return { atkMult, stabMult, powerMult, notes };
  }

  /**
   * Apply defender ability modifiers
   * Returns { defMult, immuneType, specialFlags, notes }
   */
  function applyDefenderAbility(ability, move, defenderTypes, defenderHP, defenderMaxHP) {
    const ab = ABILITIES[ability];
    if (!ab) return { defMult: 1, immuneType: null, notes: [] };

    const notes = [];
    let defMult = 1;
    let immuneType = null;

    // Type immunity
    if (ab.immuneType === move.type) {
      immuneType = ab.immuneType;
      notes.push(`${ABILITIES_ES[ability] || ability}: Inmune a ${move.type}`);
      return { defMult, immuneType, notes };
    }

    // Fur Coat / Ice Scales
    if (ab.defMult && (!ab.cat || ab.cat === move.category)) {
      defMult *= ab.defMult;
      notes.push(`${ABILITIES_ES[ability] || ability}: Defensa ×${ab.defMult}`);
    }

    // Multiscale / Shadow Shield
    if ((ab.specialDef === 'multiscale' || ab.specialDef === 'shadow-shield') &&
        defenderHP >= defenderMaxHP) {
      defMult *= 0.5;
      notes.push(`${ABILITIES_ES[ability] || ability}: PS máximos ×0.5`);
    }

    // Filter / Solid Rock / Prism Armor
    if ((ab.specialDef === 'filter' || ab.specialDef === 'solid-rock' || ab.specialDef === 'prism-armor')) {
      // Applied after effectiveness
      notes.push(`${ABILITIES_ES[ability] || ability}: SE ×0.75`);
    }

    // Thick Fat
    if (ab.special === 'thick-fat' && (move.type === 'fire' || move.type === 'ice')) {
      defMult *= 2; // ×0.5 damage = ×2 effective defense
      notes.push(`Grasa: ${move.type === 'fire' ? 'Fuego' : 'Hielo'} ×0.5`);
    }

    // Fluffy
    if (ab.specialDef === 'fluffy') {
      if (move.type === 'fire') {
        defMult *= 0.5; // takes ×2 from fire
        notes.push('Mullido: Fuego ×2');
      } else if (move.category === 'physical') {
        defMult *= 2; // ×0.5 from contact
        notes.push('Mullido: Contacto ×0.5');
      }
    }

    // Dry Skin
    if (ab.special === 'dry-skin') {
      if (move.type === 'water') { immuneType = 'water'; notes.push('Piel Seca: Inmune a Agua'); }
      if (move.type === 'fire') { defMult *= 0.8; notes.push('Piel Seca: Fuego ×1.25'); }
    }

    // Wonder Guard
    if (ab.special === 'wonder-guard') {
      notes.push('Guardia Mágica: Solo SE');
      // handled in main calc
    }

    return { defMult, immuneType, notes };
  }

  // ── Main Formula ───────────────────────────────────────────
  /**
   * Calcula el rango de daño (16 rolls)
   * @returns { min, max, rolls: number[], koChance, percentMin, percentMax, notes }
   */
  function calculate(atk, def, move, conditions = {}) {
    const {
      weather  = 'none',
      terrain  = 'none',
      screens  = false,
      isCrit   = false,
    } = conditions;

    const atkStatName = move.category === 'physical' ? 'attack' : 'special-attack';
    const defStatName = move.category === 'physical' ? 'defense' : 'special-defense';

    const atkBase = calcStat(
      atk.baseStat[atkStatName], atk.iv[atkStatName], atk.ev[atkStatName],
      atk.level, atkStatName, atk.nature
    );
    const defBase = calcStat(
      def.baseStat[defStatName], def.iv[defStatName], def.ev[defStatName],
      def.level, defStatName, def.nature
    );
    const defHP = calcStat(def.baseStat.hp, def.iv.hp, def.ev.hp, def.level, 'hp', def.nature);
    const atkHP = calcStat(atk.baseStat.hp, atk.iv.hp, atk.ev.hp, atk.level, 'hp', atk.nature);

    let power = move.power || 0;
    if (power === 0) return null; // status move

    const notes = [];

    // ── Attacker ability processing ────────────────────────
    const atkLowHP = (atk.currentHP || atkHP) <= Math.floor(atkHP / 3);
    const defCurrHP = def.currentHP || defHP;

    const atkAbilityRes = applyAttackerAbility(atk.ability || '', move, weather, atkLowHP);
    const defAbilityRes = applyDefenderAbility(def.ability || '', move, def.types, defCurrHP, defHP);

    notes.push(...atkAbilityRes.notes, ...defAbilityRes.notes);

    // Immune via defender ability
    if (defAbilityRes.immuneType === move.type) {
      return { min: 0, max: 0, rolls: Array(16).fill(0), typeEff: 0, defHP, percentMin: 0, percentMax: 0, notes };
    }

    // STAB
    let stab = atk.types.includes(move.type) ? (atkAbilityRes.stabMult || 1.5) : 1;
    if (atk.types.includes(move.type) && atkAbilityRes.stabMult) stab = atkAbilityRes.stabMult;

    // Type effectiveness
    let typeEff = getTypeEffectiveness(move.type, def.types);

    // Wonder Guard — only SE works
    if (ABILITIES[def.ability || '']?.special === 'wonder-guard' && typeEff < 2) {
      return { min: 0, max: 0, rolls: Array(16).fill(0), typeEff: 0, defHP, percentMin: 0, percentMax: 0, notes };
    }

    if (typeEff === 0) {
      return { min: 0, max: 0, rolls: Array(16).fill(0), typeEff: 0, defHP, percentMin: 0, percentMax: 0, notes };
    }

    // Apply item to attack stat multiplier
    let atkMult = atkAbilityRes.atkMult;
    const atkItem = ITEMS[atk.item] || {};
    if (atkItem.atkMult) {
      if (!atkItem.cat || atkItem.cat === move.category) atkMult *= atkItem.atkMult;
    }
    if (atkItem.typeMult && atkItem.type === move.type) atkMult *= atkItem.typeMult;

    // Power multiplier from ability
    power = Math.floor(power * atkAbilityRes.powerMult);

    // Expert Belt
    if ((atkItem.superEffMult || ABILITIES[atk.ability || '']?.superEffMult) && typeEff > 1) {
      atkMult *= (atkItem.superEffMult || ABILITIES[atk.ability]?.superEffMult || 1);
    }

    // Apply item to defense
    let defMult = defAbilityRes.defMult;
    const defItem = ITEMS[def.item] || {};
    if (defItem.defMult  && move.category === 'physical')  defMult *= defItem.defMult;
    if (defItem.spDefMult && move.category === 'special')  defMult *= defItem.spDefMult;
    if (defItem.atkMult) { /* item on defender affects nothing here */ }

    // Filter / Solid Rock / Prism Armor (defender)
    const defAbKey = def.ability || '';
    if (['filter','solid-rock','prism-armor'].includes(defAbKey) && typeEff > 1) {
      typeEff *= 0.75;
      // already noted
    }

    // Weather boost/drop
    let weatherMult = 1;
    if (weather === 'sun') {
      if (move.type === 'fire')  weatherMult = 1.5;
      if (move.type === 'water') weatherMult = 0.5;
    }
    if (weather === 'rain') {
      if (move.type === 'water') weatherMult = 1.5;
      if (move.type === 'fire')  weatherMult = 0.5;
    }
    if (weather === 'sand' && move.category === 'special') {
      if (def.types.includes('rock')) defMult *= 1.5;
    }
    if (weather === 'hail' && move.category === 'special') {
      if (def.types.includes('ice')) defMult *= 1.5;
    }

    // Terrain boost
    let terrainMult = 1;
    if (terrain === 'electric' && move.type === 'electric') terrainMult = 1.3;
    if (terrain === 'grassy'   && move.type === 'grass')    terrainMult = 1.3;
    if (terrain === 'psychic'  && move.type === 'psychic')  terrainMult = 1.3;
    if (terrain === 'misty'    && move.type === 'dragon')   terrainMult = 0.5;

    // Screen
    if (screens && !isCrit) defMult *= 2;

    // Burn
    if (atk.status === 'brn' && move.category === 'physical') atkMult *= 0.5;

    // Crit
    const critMult = isCrit ? 1.5 : 1;

    const atkStat = Math.floor(atkBase * atkMult);
    const defStat = Math.floor(defBase * defMult);

    // Base damage formula
    const baseDamage = Math.floor(
      Math.floor(
        Math.floor(2 * atk.level / 5 + 2) * power *
        atkStat / defStat / 50
      ) + 2
    );

    // 16 damage rolls (85%–100%)
    const rolls = [];
    for (let r = 85; r <= 100; r++) {
      let dmg = Math.floor(baseDamage * critMult);
      dmg = Math.floor(dmg * stab);
      dmg = Math.floor(dmg * typeEff);
      dmg = Math.floor(dmg * weatherMult);
      dmg = Math.floor(dmg * terrainMult);
      dmg = Math.floor(dmg * r / 100);
      rolls.push(dmg);
    }

    const min = rolls[0];
    const max = rolls[15];
    const ko  = koRolls(rolls, defHP);

    return {
      min, max, rolls, typeEff, stab, defHP,
      percentMin: ((min / defHP) * 100).toFixed(1),
      percentMax: ((max / defHP) * 100).toFixed(1),
      koChance: ko,
      atkStatVal: atkStat,
      defStatVal: defStat,
      notes,
    };
  }

  function koRolls(rolls, hp) {
    const killCount = rolls.filter(r => r >= hp).length;
    return Math.round((killCount / rolls.length) * 100);
  }

  function koMessage(res) {
    if (!res || res.max === 0) return { label: '⚠️ Sin efecto / Inmune', cls: 'calc-ko-safe' };
    const { percentMin, percentMax, koChance, min, max, defHP } = res;
    const mn = parseFloat(percentMin);
    const mx = parseFloat(percentMax);
    if (max >= defHP) {
      if (min >= defHP) return { label: `💀 KO garantizado (${koChance}%)`, cls: 'calc-ko-1' };
      return { label: `💀 KO posible (${koChance}%)`, cls: 'calc-ko-2' };
    }
    if (max * 2 >= defHP) return { label: `⚡ 2HKO posible (${mx.toFixed(0)}% máx)`, cls: 'calc-ko-2' };
    if (max * 3 >= defHP) return { label: `⚡ 3HKO posible (${mx.toFixed(0)}% máx)`, cls: 'calc-ko-3' };
    return { label: `🛡️ ${mn.toFixed(0)}–${mx.toFixed(0)}% PS`, cls: 'calc-ko-safe' };
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    NATURES,
    NATURES_ES,
    ITEMS,
    ITEMS_ES,
    ABILITIES,
    ABILITIES_ES,
    calcStat,
    calculate,
    koMessage,
    getNatureList:  () => Object.entries(NATURES_ES).map(([k,v]) => ({ key: k, label: v, nature: NATURES[k] })),
    getItemList:    () => Object.entries(ITEMS_ES).map(([k,v]) => ({ key: k, label: v })),
    getAbilityList: () => Object.entries(ABILITIES_ES).map(([k,v]) => ({ key: k, label: v, data: ABILITIES[k] })),
    describeNature: (name) => {
      const n = NATURES[name];
      if (!n) return '';
      if (!n.plus) return 'Naturaleza neutra';
      const statES = { attack:'Ataque', defense:'Defensa', 'special-attack':'At. Esp.', 'special-defense':'Def. Esp.', speed:'Velocidad' };
      return `↑ ${statES[n.plus]} / ↓ ${statES[n.minus]}`;
    },
  };

})();
