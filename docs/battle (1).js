/**
 * Pokédex Pro — Simulador de Batalla vs IA
 * Motor de combate por turnos completo con soporte para bots
 */

class BattleSimulator {
  constructor() {
    this.playerTeam  = [];
    this.enemyTeam   = [];
    this.playerIdx   = 0;
    this.enemyIdx    = 0;
    this.weather     = 'none';
    this.terrain     = 'none';
    this.weatherTurns = 0;
    this.terrainTurns = 0;
    this.turn        = 0;
    this.log         = [];
    this.isRunning   = false;
    this.isOver      = false;
    this.winner      = null;
    this.aiLevel     = 'smart'; // 'random' | 'smart' | 'expert'
    this.callbacks   = {};
    this.autoPlaying = false;
    this.autoInterval = null;
    this.playerField = this._createFieldState();
    this.enemyField = this._createFieldState();
    this.battleFormat = 'singles-ou';
    this.npcTrainer = null;
  }

  // ═══════════════════════════════════════════════════════════
  //  SETUP
  // ═══════════════════════════════════════════════════════════

  setupTeam(pokemonDataArray, side) {
    const team = pokemonDataArray.map(p => this._initBattlePokemon(p));
    if (side === 'player') this.playerTeam = team;
    else this.enemyTeam = team;
  }

  _createFieldState() {
    return {
      reflect: 0,
      lightScreen: 0,
      auroraVeil: 0,
      stealthRock: false,
      spikes: 0,
    };
  }

  _initBattlePokemon(p) {
    const stats = {};
    if (Array.isArray(p.stats)) {
      p.stats.forEach(s => { stats[s.stat.name] = s.base_stat; });
    } else {
      Object.assign(stats, p.stats || {});
    }
    const level = p.level || 50;

    const calcHP = (base) =>
      Math.floor(((2 * base + (p.ivs?.hp || 31) + Math.floor((p.evs?.hp || 0) / 4)) * level) / 100) + level + 10;

    const calcStat = (base, statName) => {
      const iv  = p.ivs?.[statName] ?? 31;
      const ev  = p.evs?.[statName] ?? 0;
      const nat = DamageCalc.NATURES[p.nature || 'Hardy'];
      let val = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
      if (nat?.plus  === statName) val = Math.floor(val * 1.1);
      if (nat?.minus === statName) val = Math.floor(val * 0.9);
      return Math.max(1, val);
    };

    const maxHP = calcHP(stats.hp || 45);
    return {
      id:         p.id,
      name:       p.name,
      nameES:     p.nameES || (p.name.charAt(0).toUpperCase() + p.name.slice(1)),
      types:      p.types?.map(t => typeof t === 'string' ? t : t.type.name) || ['normal'],
      level,
      nature:     p.nature || 'Hardy',
      item:       p.item   || 'none',
      ability:    p.ability || '',
      moves:      (p.selectedMoves || p.moves || []).slice(0, 4).map(m => this._initMove(m)),
      maxHP,
      currentHP:  maxHP,
      status:     null,
      statusTurns: 0,
      flinched:   false,
      protect:    false,
      fainted:    false,
      stages: { attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0, accuracy: 0, evasion: 0 },
      stats: {
        hp:               maxHP,
        attack:           calcStat(stats.attack || 45, 'attack'),
        defense:          calcStat(stats.defense || 45, 'defense'),
        'special-attack': calcStat(stats['special-attack'] || 45, 'special-attack'),
        'special-defense':calcStat(stats['special-defense'] || 45, 'special-defense'),
        speed:            calcStat(stats.speed || 45, 'speed'),
      },
      sprite: p.sprite || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`,
    };
  }

  _initMove(move) {
    if (!move || typeof move !== 'object') {
      return { name: 'tackle', nameES: 'Placaje', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35, maxPP: 35, priority: 0 };
    }
    return {
      name:     move.name || 'tackle',
      nameES:   move.nameES
                || move.names?.find(n => n.language?.name === 'es')?.name
                || (move.name?.charAt(0).toUpperCase() + move.name?.slice(1).replace(/-/g,' '))
                || '?',
      type:     move.type?.name || move.type || 'normal',
      category: move.damage_class?.name || move.category || 'physical',
      power:    move.power || 0,
      accuracy: move.accuracy || 100,
      pp:       move.pp || 10,
      maxPP:    move.pp || 10,
      priority: move.priority || 0,
    };
  }

  on(event, cb)   { this.callbacks[event] = cb; return this; }
  emit(event, data) { if (this.callbacks[event]) this.callbacks[event](data); }

  // ═══════════════════════════════════════════════════════════
  //  MAIN BATTLE LOOP
  // ═══════════════════════════════════════════════════════════

  get player() { return this.playerTeam[this.playerIdx]; }
  get enemy()  { return this.enemyTeam[this.enemyIdx]; }

  addLog(text, cls = '') {
    this.log.push({ text, cls });
    this.emit('log', { text, cls });
  }

  reset() {
    this.playerIdx   = 0;
    this.enemyIdx    = 0;
    this.weather     = 'none';
    this.terrain     = 'none';
    this.weatherTurns = 0;
    this.turn        = 0;
    this.log         = [];
    this.isRunning   = false;
    this.isOver      = false;
    this.winner      = null;
    this.playerField = this._createFieldState();
    this.enemyField = this._createFieldState();
    this.npcTrainer = null;
    this.stopAuto();
  }

  begin() {
    this.isRunning = true;
    this.isOver    = false;
    this.turn      = 0;
    this.addLog(`¡${this.npcTrainer?.name || this.enemy.nameES} quiere combatir!`, 'log-line-system');
    this.addLog(`¡Ve, ${this.player.nameES}!`, 'log-line-system');
    this._applyEntryHazards('player');
    this._applyEntryHazards('enemy');
    this.emit('update', this.getState());
  }

  async executeTurn(playerAction, switchTarget = null) {
    if (this.isOver || !this.isRunning) return;
    this.turn++;

    if (playerAction === 'switch') {
      if (switchTarget !== null) this._doSwitch('player', switchTarget);
      const enemyMove = this._chooseEnemyMove();
      await this._applyMove(this.enemy, this.player, enemyMove);
      this._endOfTurn();
      if (!this.isOver) this.emit('update', this.getState());
      return;
    }

    const playerMove = this.player.moves[playerAction];
    if (!playerMove || playerMove.pp <= 0) {
      this.addLog(`${this.player.nameES} no puede usar ese movimiento.`);
      this.emit('update', this.getState());
      return;
    }

    const enemyMove = this._chooseEnemyMove();

    const pSpeed = this._effectiveStat(this.player, 'speed');
    const eSpeed = this._effectiveStat(this.enemy,  'speed');
    const pFirst = (playerMove.priority > enemyMove.priority) ||
                   (playerMove.priority === enemyMove.priority && pSpeed >= eSpeed);

    if (pFirst) {
      if (!this.player.fainted) await this._applyMove(this.player, this.enemy, playerMove);
      if (!this.isOver && !this.enemy.fainted)  await this._applyMove(this.enemy, this.player, enemyMove);
    } else {
      if (!this.enemy.fainted)  await this._applyMove(this.enemy, this.player, enemyMove);
      if (!this.isOver && !this.player.fainted) await this._applyMove(this.player, this.enemy, playerMove);
    }

    if (!this.isOver) {
      this._endOfTurn();
      this.emit('update', this.getState());
    }
  }

  async _applyMove(attacker, defender, move) {
    if (this.isOver || attacker.fainted || defender.fainted) return;

    if (attacker.flinched) {
      attacker.flinched = false;
      this.addLog(`¡${attacker.nameES} retrocedió y perdió el turno!`, 'log-line-status');
      return;
    }

    // Status conditions blocking move
    if (attacker.status === 'par' && Math.random() < 0.25) {
      this.addLog(`¡${attacker.nameES} está paralizado y no puede moverse!`, 'log-line-status');
      return;
    }
    if (attacker.status === 'slp') {
      attacker.statusTurns--;
      if (attacker.statusTurns <= 0) {
        attacker.status = null;
        this.addLog(`¡${attacker.nameES} se ha despertado!`, 'log-line-status');
      } else {
        this.addLog(`${attacker.nameES} está dormido…`, 'log-line-status');
        return;
      }
    }
    if (attacker.status === 'frz') {
      if (Math.random() < 0.2) {
        attacker.status = null;
        this.addLog(`¡${attacker.nameES} se ha descongelado!`, 'log-line-status');
      } else {
        this.addLog(`${attacker.nameES} está congelado y no puede moverse.`, 'log-line-status');
        return;
      }
    }

    move.pp = Math.max(0, move.pp - 1);
    this.addLog(`${attacker.nameES} usó ${move.nameES}!`);

    if (defender.protect && move.category !== 'status') {
      this.addLog(`¡${defender.nameES} se protegió completamente!`, 'log-line-system');
      defender.protect = false;
      return;
    }

    // Accuracy
    if (move.accuracy && move.accuracy < 100) {
      const roll = Math.random() * 100;
      if (roll > move.accuracy * this._accMod(attacker, defender)) {
        this.addLog(`¡El ataque de ${attacker.nameES} falló!`, 'log-line-not-effective');
        this.emit('animate', { side: attacker === this.player ? 'player' : 'enemy', type: 'miss' });
        return;
      }
    }

    // Status moves
    if (move.category === 'status') {
      this._applyStatusMove(attacker, defender, move);
      return;
    }

    // Calculate damage
    const atkObj  = this._buildCalcObj(attacker);
    const defObj  = this._buildCalcObj(defender);
    const result  = DamageCalc.calculate(atkObj, defObj, move, {
      weather: this.weather,
      terrain: this.terrain,
      screens: this._hasActiveScreen(defender === this.player ? 'player' : 'enemy', move),
    });

    if (!result || result.max === 0) {
      this.addLog(`¡No afecta a ${defender.nameES}!`, 'log-line-not-effective');
      return;
    }

    const isCrit = Math.random() < 0.0625;
    const rawDmg = result.rolls[Math.floor(Math.random() * result.rolls.length)];
    const finalDmg = isCrit ? Math.floor(rawDmg * 1.5) : rawDmg;

    defender.currentHP = Math.max(0, defender.currentHP - finalDmg);

    if (result.typeEff === 0) { this.addLog(`¡No afecta a ${defender.nameES}!`, 'log-line-not-effective'); return; }
    if (result.typeEff >= 2)  this.addLog('¡Es super efectivo!', 'log-line-effective');
    if (result.typeEff < 1)   this.addLog('No es muy efectivo…', 'log-line-not-effective');
    if (isCrit)               this.addLog('¡Golpe crítico!', 'log-line-critical');

    this.emit('animate', { side: attacker === this.player ? 'player' : 'enemy', type: 'attack' });
    this.emit('damage',  { side: attacker === this.player ? 'enemy'  : 'player', hp: defender.currentHP, maxHP: defender.maxHP });

    this._applySecondaryEffects(attacker, defender, move);

    if (defender.currentHP <= 0) {
      defender.currentHP = 0;
      defender.fainted   = true;
      this.addLog(`¡${defender.nameES} se ha debilitado!`, 'log-line-system');
      this.emit('faint', { side: defender === this.player ? 'player' : 'enemy' });
      this._checkAfterFaint(defender);
    }
  }

  _checkAfterFaint(fainted) {
    if (fainted === this.player) {
      const allFainted = this.playerTeam.every(p => p.fainted);
      if (allFainted) { this._endBattle('enemy'); return; }
      // Player needs to switch — emit event for UI to handle
      this.emit('needSwitch', null);
    } else {
      const nextEnemy = this.enemyTeam.findIndex((p, i) => i > this.enemyIdx && !p.fainted);
      if (nextEnemy === -1) {
        // All enemies fainted
        const anyLeft = this.enemyTeam.findIndex((p, i) => i !== this.enemyIdx && !p.fainted);
        if (anyLeft === -1) { this._endBattle('player'); return; }
        this.enemyIdx = anyLeft;
      } else {
        this.enemyIdx = nextEnemy;
      }
      this.addLog(`¡El rival envía a ${this.enemy.nameES}!`, 'log-line-system');
    }
  }

  _applyStatusMove(attacker, defender, move) {
    const n = move.name.toLowerCase();
    const attackerSide = attacker === this.player ? 'player' : 'enemy';
    const defenderSide = defender === this.player ? 'player' : 'enemy';
    if ((n.includes('toxic')) && !defender.status) {
      defender.status = 'bps'; this.addLog(`¡${defender.nameES} ha sido gravemente envenenado!`, 'log-line-status');
    } else if (n.includes('thunder-wave') && !defender.status) {
      defender.status = 'par'; this.addLog(`¡${defender.nameES} está paralizado!`, 'log-line-status');
    } else if (n.includes('will-o-wisp') && !defender.status) {
      defender.status = 'brn'; this.addLog(`¡${defender.nameES} se ha quemado!`, 'log-line-status');
    } else if ((n.includes('spore') || n.includes('sleep-powder') || n.includes('hypnosis')) && !defender.status) {
      defender.status = 'slp'; defender.statusTurns = Math.floor(Math.random() * 3) + 1;
      this.addLog(`¡${defender.nameES} se ha dormido!`, 'log-line-status');
    } else if (n.includes('sunny-day')) {
      this.weather = 'sun'; this.weatherTurns = 5;
      this.addLog('¡El sol brilla intensamente!', 'log-line-system');
    } else if (n.includes('rain-dance')) {
      this.weather = 'rain'; this.weatherTurns = 5;
      this.addLog('¡Ha empezado a llover!', 'log-line-system');
    } else if (n.includes('sandstorm')) {
      this.weather = 'sand'; this.weatherTurns = 5;
      this.addLog('¡Se ha desatado una tormenta de arena!', 'log-line-system');
    } else if (n.includes('hail') || n.includes('snowscape')) {
      this.weather = 'hail'; this.weatherTurns = 5;
      this.addLog('¡Está granizando!', 'log-line-system');
    } else if (n.includes('swords-dance')) {
      attacker.stages.attack = Math.min(6, attacker.stages.attack + 2);
      this.addLog(`¡El Ataque de ${attacker.nameES} subió mucho!`, 'log-line-heal');
    } else if (n.includes('calm-mind')) {
      attacker.stages['special-attack']  = Math.min(6, attacker.stages['special-attack'] + 1);
      attacker.stages['special-defense'] = Math.min(6, attacker.stages['special-defense'] + 1);
      this.addLog(`¡${attacker.nameES} entró en meditación!`, 'log-line-heal');
    } else if (n.includes('nasty-plot')) {
      attacker.stages['special-attack'] = Math.min(6, attacker.stages['special-attack'] + 2);
      this.addLog(`¡El At.Esp de ${attacker.nameES} subió mucho!`, 'log-line-heal');
    } else if (n.includes('recover') || n.includes('roost') || n.includes('moonlight') || n.includes('synthesis') || n.includes('slack-off') || n.includes('soft-boiled')) {
      const heal = Math.floor(attacker.maxHP / 2);
      attacker.currentHP = Math.min(attacker.maxHP, attacker.currentHP + heal);
      this.addLog(`¡${attacker.nameES} recuperó ${heal} PS!`, 'log-line-heal');
      this.emit('damage', { side: attacker === this.player ? 'player' : 'enemy', hp: attacker.currentHP, maxHP: attacker.maxHP });
    } else if (n.includes('dragon-dance')) {
      attacker.stages.attack = Math.min(6, attacker.stages.attack + 1);
      attacker.stages.speed  = Math.min(6, attacker.stages.speed + 1);
      this.addLog(`¡${attacker.nameES} hizo Danza Dragón!`, 'log-line-heal');
    } else if (n.includes('protect')) {
      attacker.protect = true;
      this.addLog(`¡${attacker.nameES} se cubrió con Protección!`, 'log-line-system');
    } else if (n.includes('reflect')) {
      this._getField(attackerSide).reflect = 5;
      this.addLog(`¡Reflector protege al equipo de ${attacker.nameES}!`, 'log-line-system');
    } else if (n.includes('light-screen')) {
      this._getField(attackerSide).lightScreen = 5;
      this.addLog(`¡Pantalla Luz cubre el lado de ${attacker.nameES}!`, 'log-line-system');
    } else if (n.includes('aurora-veil')) {
      this._getField(attackerSide).auroraVeil = 5;
      this.addLog('¡Velo Aurora reduce el daño recibido!', 'log-line-system');
    } else if (n.includes('stealth-rock')) {
      this._getField(defenderSide).stealthRock = true;
      this.addLog(`¡Púas Rocosas flotan alrededor del lado rival!`, 'log-line-system');
    } else if (n.includes('spikes')) {
      const field = this._getField(defenderSide);
      field.spikes = Math.min(3, field.spikes + 1);
      this.addLog(`¡Se colocaron púas en el lado rival! (${field.spikes})`, 'log-line-system');
    } else {
      this.addLog(`${attacker.nameES} usó ${move.nameES}.`);
    }
  }

  _applySecondaryEffects(attacker, defender, move) {
    const n = move.name.toLowerCase();
    if (move.type === 'fire'     && !defender.status && Math.random() < 0.10) {
      defender.status = 'brn'; this.addLog(`¡${defender.nameES} se quemó!`, 'log-line-status');
    }
    if (move.type === 'electric' && !defender.status && Math.random() < 0.10) {
      defender.status = 'par'; this.addLog(`¡${defender.nameES} se paralizó!`, 'log-line-status');
    }
    if (move.type === 'ice'      && !defender.status && Math.random() < 0.10) {
      defender.status = 'frz'; this.addLog(`¡${defender.nameES} se congeló!`, 'log-line-status');
    }
    if ((n.includes('poison') || n.includes('sludge')) && !defender.status && Math.random() < 0.30) {
      defender.status = 'psn'; this.addLog(`¡${defender.nameES} se envenenó!`, 'log-line-status');
    }
    if ((n.includes('rock-slide') || n.includes('iron-head') || n.includes('air-slash')) && Math.random() < 0.30) {
      defender.flinched = true;
      this.addLog(`¡${defender.nameES} retrocedió!`, 'log-line-status');
    }
  }

  _endOfTurn() {
    [this.player, this.enemy].forEach(p => {
      if (p.fainted || this.isOver) return;
      p.protect = false;

      // Weather damage
      if (this.weather === 'sand' && !p.types.some(t => ['rock','steel','ground'].includes(t))) {
        const dmg = Math.floor(p.maxHP / 16);
        p.currentHP = Math.max(0, p.currentHP - dmg);
        this.addLog(`¡${p.nameES} recibe daño de la tormenta de arena!`);
        this.emit('damage', { side: p === this.player ? 'player' : 'enemy', hp: p.currentHP, maxHP: p.maxHP });
      }
      if (this.weather === 'hail' && !p.types.includes('ice')) {
        const dmg = Math.floor(p.maxHP / 16);
        p.currentHP = Math.max(0, p.currentHP - dmg);
        this.addLog(`¡${p.nameES} recibe daño del granizo!`);
        this.emit('damage', { side: p === this.player ? 'player' : 'enemy', hp: p.currentHP, maxHP: p.maxHP });
      }

      // Status damage
      if (p.status === 'psn') {
        const dmg = Math.floor(p.maxHP / 8);
        p.currentHP = Math.max(0, p.currentHP - dmg);
        this.addLog(`¡${p.nameES} sufre el envenenamiento!`, 'log-line-status');
        this.emit('damage', { side: p === this.player ? 'player' : 'enemy', hp: p.currentHP, maxHP: p.maxHP });
      }
      if (p.status === 'bps') {
        p.statusTurns++;
        const dmg = Math.floor(p.maxHP * p.statusTurns / 16);
        p.currentHP = Math.max(0, p.currentHP - dmg);
        this.addLog(`¡${p.nameES} sufre un grave envenenamiento!`, 'log-line-status');
        this.emit('damage', { side: p === this.player ? 'player' : 'enemy', hp: p.currentHP, maxHP: p.maxHP });
      }
      if (p.status === 'brn') {
        const dmg = Math.floor(p.maxHP / 16);
        p.currentHP = Math.max(0, p.currentHP - dmg);
        this.addLog(`¡${p.nameES} sufre la quemadura!`, 'log-line-status');
        this.emit('damage', { side: p === this.player ? 'player' : 'enemy', hp: p.currentHP, maxHP: p.maxHP });
      }

      // Faint from end-of-turn
      if (p.currentHP <= 0 && !p.fainted) {
        p.currentHP = 0; p.fainted = true;
        this.addLog(`¡${p.nameES} se ha debilitado!`, 'log-line-system');
        this.emit('faint', { side: p === this.player ? 'player' : 'enemy' });
        this._checkAfterFaint(p);
      }
    });

    // Weather tick
    if (this.weatherTurns > 0) {
      this.weatherTurns--;
      if (this.weatherTurns === 0) {
        this.weather = 'none';
        this.addLog('El tiempo ha vuelto a la normalidad.', 'log-line-system');
      }
    }
    this._tickFieldSide(this.playerField);
    this._tickFieldSide(this.enemyField);
    this.emit('turn', this.turn);
  }

  _endBattle(winner) {
    this.isRunning = false;
    this.isOver    = true;
    this.winner    = winner;
    this.stopAuto();
    const msg = winner === 'player' ? '🏆 ¡Has ganado la batalla!' : '💀 Has perdido la batalla…';
    this.addLog(msg, 'log-line-system');
    this._saveBattleResult(winner);
    this.emit('battleEnd', { winner });
  }

  _doSwitch(side, index) {
    if (side === 'player') {
      const t = this.playerTeam[index];
      if (!t || t.fainted || index === this.playerIdx) return;
      const prev = this.player.nameES;
      this.playerIdx = index;
      this.addLog(`¡${prev}, vuelve! ¡Ve, ${this.player.nameES}!`, 'log-line-system');
      this._applyEntryHazards('player');
      this.emit('update', this.getState());
    } else {
      const t = this.enemyTeam[index];
      if (!t || t.fainted || index === this.enemyIdx) return;
      this.enemyIdx = index;
      this.addLog(`¡El rival cambia a ${this.enemy.nameES}!`, 'log-line-system');
      this._applyEntryHazards('enemy');
      this.emit('update', this.getState());
    }
  }

  // Auto-play
  startAuto() {
    if (this.autoPlaying || this.isOver) return;
    this.autoPlaying = true;
    this.autoInterval = setInterval(() => {
      if (this.isOver) { this.stopAuto(); return; }
      const bestMove = this._chooseBestPlayerMove();
      this.executeTurn(bestMove);
    }, 1200);
    this.emit('autoStart', null);
  }

  stopAuto() {
    this.autoPlaying = false;
    if (this.autoInterval) { clearInterval(this.autoInterval); this.autoInterval = null; }
    this.emit('autoStop', null);
  }

  _chooseBestPlayerMove() {
    const avail = this.player.moves.map((m, i) => ({ m, i })).filter(x => x.m.pp > 0);
    if (avail.length === 0) return 0;
    const scored = avail.map(({ m, i }) => {
      let score = m.power || 0;
      if (m.category !== 'status') {
        const res = DamageCalc.calculate(
          this._buildCalcObj(this.player), this._buildCalcObj(this.enemy), m, {}
        );
        if (res) score = res.max;
      }
      return { i, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].i;
  }

  // ═══════════════════════════════════════════════════════════
  //  AI
  // ═══════════════════════════════════════════════════════════

  _chooseEnemyMove() {
    const avail = this.enemy.moves.filter(m => m.pp > 0);
    if (avail.length === 0) {
      return { name: 'struggle', nameES: 'Forcejeo', type: 'normal', category: 'physical', power: 50, accuracy: null, pp: Infinity, priority: 0 };
    }
    if (this.aiLevel === 'random') return avail[Math.floor(Math.random() * avail.length)];

    const scored = avail.map(move => {
      let score = 0;
      if (move.category === 'status') {
        score = this._scoreStatusMove(move);
      } else {
        const res = DamageCalc.calculate(
          this._buildCalcObj(this.enemy), this._buildCalcObj(this.player), move, {
            weather: this.weather,
            terrain: this.terrain,
            screens: this._hasActiveScreen('player', move),
          }
        );
        if (res) score = res.max;
        else score = move.power || 0;
        if ((this.player.currentHP / this.player.maxHP) * 100 <= 35 && res?.max >= this.player.currentHP) score += 60;
      }
      return { move, score };
    });
    scored.sort((a, b) => b.score - a.score);

    if (this.aiLevel === 'expert' && scored.length > 1 && Math.random() < 0.2) return scored[1].move;
    return scored[0].move;
  }

  _scoreStatusMove(move) {
    const n = move.name.toLowerCase();
    let score = 10;
    if ((n.includes('toxic') || n.includes('thunder-wave') || n.includes('will-o-wisp')) && !this.player.status) score += 45;
    if (n.includes('stealth-rock') && !this.playerField.stealthRock) score += 40;
    if (n.includes('spikes') && this.playerField.spikes < 3) score += 30;
    if ((n.includes('reflect') && this.enemyField.reflect === 0) || (n.includes('light-screen') && this.enemyField.lightScreen === 0)) score += 28;
    if (n.includes('protect') && (this.enemy.currentHP / this.enemy.maxHP) < 0.35) score += 20;
    if ((n.includes('recover') || n.includes('roost') || n.includes('slack-off') || n.includes('soft-boiled')) && (this.enemy.currentHP / this.enemy.maxHP) < 0.55) score += 55;
    if ((n.includes('swords-dance') || n.includes('dragon-dance') || n.includes('nasty-plot') || n.includes('calm-mind')) && this.enemy.stages.attack < 2) score += 34;
    return score;
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════

  _effectiveStat(pokemon, statName) {
    const base  = pokemon.stats[statName] || 45;
    const stage = pokemon.stages?.[statName] || 0;
    const mult  = stage >= 0 ? (2 + stage) / 2 : 2 / (2 + Math.abs(stage));
    let val = Math.floor(base * mult);
    if (this.weather === 'sun'  && statName === 'speed' && pokemon.ability === 'chlorophyll') val *= 2;
    if (this.weather === 'rain' && statName === 'speed' && pokemon.ability === 'swift-swim')   val *= 2;
    if (pokemon.status === 'par') val = Math.floor(val * 0.5);
    return Math.max(1, val);
  }

  _accMod(attacker, defender) {
    const accStage = (attacker.stages?.accuracy || 0) - (defender.stages?.evasion || 0);
    if (accStage >= 0) return (3 + accStage) / 3;
    return 3 / (3 + Math.abs(accStage));
  }

  _buildCalcObj(pokemon) {
    const statsObj = {};
    ['hp','attack','defense','special-attack','special-defense','speed']
      .forEach(s => { statsObj[s] = pokemon.stats?.[s] || 45; });
    return {
      types:    pokemon.types,
      level:    pokemon.level,
      nature:   pokemon.nature,
      item:     pokemon.item || 'none',
      ability:  pokemon.ability || '',
      status:   pokemon.status,
      baseStat: statsObj,
      iv: { hp:31, attack:31, defense:31, 'special-attack':31, 'special-defense':31, speed:31 },
      ev: { hp:0, attack:0, defense:0, 'special-attack':0, 'special-defense':0, speed:0 },
    };
  }

  _getField(side) {
    return side === 'player' ? this.playerField : this.enemyField;
  }

  _hasActiveScreen(side, move) {
    const field = this._getField(side);
    if (field.auroraVeil > 0) return true;
    if (move.category === 'physical' && field.reflect > 0) return true;
    if (move.category === 'special' && field.lightScreen > 0) return true;
    return false;
  }

  _tickFieldSide(field) {
    ['reflect', 'lightScreen', 'auroraVeil'].forEach(key => {
      if (field[key] > 0) field[key]--;
    });
  }

  _applyEntryHazards(side) {
    const active = side === 'player' ? this.player : this.enemy;
    const field = this._getField(side);
    if (!active || active.fainted) return;

    if (field.stealthRock) {
      const rockEffect = pokeAPI.calculateEffectiveness('rock', active.types);
      const rockDamage = Math.max(1, Math.floor(active.maxHP * (12.5 * rockEffect) / 100));
      active.currentHP = Math.max(0, active.currentHP - rockDamage);
      this.addLog(`¡Las rocas dañan a ${active.nameES}!`, 'log-line-system');
    }

    if (field.spikes > 0 && !active.types.includes('flying')) {
      const spikePct = field.spikes === 1 ? 12.5 : field.spikes === 2 ? 16.67 : 25;
      const spikeDamage = Math.max(1, Math.floor(active.maxHP * spikePct / 100));
      active.currentHP = Math.max(0, active.currentHP - spikeDamage);
      this.addLog(`¡${active.nameES} cae sobre las púas!`, 'log-line-system');
    }

    if (active.currentHP <= 0) {
      active.currentHP = 0;
      active.fainted = true;
      this.addLog(`¡${active.nameES} se debilitó al entrar!`, 'log-line-system');
      this._checkAfterFaint(active);
    }
  }

  getState() {
    return {
      player:      this.player,
      enemy:       this.enemy,
      playerTeam:  this.playerTeam,
      enemyTeam:   this.enemyTeam,
      playerIdx:   this.playerIdx,
      enemyIdx:    this.enemyIdx,
      weather:     this.weather,
      terrain:     this.terrain,
      turn:        this.turn,
      isOver:      this.isOver,
      winner:      this.winner,
      playerField: this.playerField,
      enemyField:  this.enemyField,
      npcTrainer:  this.npcTrainer,
      battleFormat: this.battleFormat,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  HISTORY & STATIC
  // ═══════════════════════════════════════════════════════════

  _saveBattleResult(winner) {
    const record = {
      date:       new Date().toISOString(),
      winner,
      turns:      this.turn,
      playerTeam: this.playerTeam.map(p => ({ name: p.nameES, id: p.id, fainted: p.fainted })),
      enemyTeam:  this.enemyTeam.map(p => ({ name: p.nameES, id: p.id, fainted: p.fainted })),
    };
    const history = BattleSimulator.getHistory();
    history.unshift(record);
    localStorage.setItem('battle_history', JSON.stringify(history.slice(0, 50)));
  }

  static getHistory() {
    return JSON.parse(localStorage.getItem('battle_history') || '[]');
  }

  static getStats() {
    const h = BattleSimulator.getHistory();
    const wins   = h.filter(b => b.winner === 'player').length;
    const losses = h.filter(b => b.winner === 'enemy').length;
    const avgTurns = h.length ? Math.round(h.reduce((s, b) => s + b.turns, 0) / h.length) : 0;
    return { total: h.length, wins, losses, avgTurns, winRate: h.length ? Math.round((wins / h.length) * 100) : 0 };
  }

  static NPC_TRAINERS = [
    { id: 'rookie', name: 'Entrenador Novel', aiLevel: 'random', format: 'casual', size: 3, pool: [25, 52, 58, 133, 172, 179, 280, 519] },
    { id: 'ace', name: 'Ace Trainer', aiLevel: 'smart', format: 'standard', size: 4, pool: [94, 130, 149, 248, 448, 445, 700, 645] },
    { id: 'leader', name: 'Líder de Gimnasio', aiLevel: 'smart', format: 'specialist', size: 4, pool: [6, 59, 76, 94, 130, 214, 282, 503] },
    { id: 'champion', name: 'Campeón', aiLevel: 'expert', format: 'elite', size: 6, pool: [376, 445, 448, 700, 792, 887, 968, 1000] },
    { id: 'frontier', name: 'Mente Frontera', aiLevel: 'expert', format: 'frontier', size: 6, pool: [65, 143, 212, 373, 637, 897, 956, 992] },
  ];

  static getNpcRoster() {
    return this.NPC_TRAINERS;
  }

  static async generateTrainerTeam(trainerId) {
    const trainer = this.NPC_TRAINERS.find(item => item.id === trainerId) || this.NPC_TRAINERS[1];
    const ids = [...trainer.pool].sort(() => Math.random() - 0.5).slice(0, trainer.size);
    const natures = Object.keys(DamageCalc.NATURES);
    const items = DamageCalc.getItemList().map(item => item.key).filter(key => key !== 'none');

    const team = await Promise.all(ids.map(async id => {
      try {
        const p = await pokeAPI.getPokemon(id);
        const moveNames = BattleSimulator._selectCompetitiveMoves(p.moves || []);
        const moveDetails = await Promise.all(moveNames.map(name => pokeAPI.getMove(name).catch(() => null)));
        const validMoves = moveDetails.filter(Boolean).slice(0, 4);
        return {
          id: p.id,
          name: p.name,
          nameES: p.name.charAt(0).toUpperCase() + p.name.slice(1),
          types: p.types.map(t => t.type.name),
          stats: p.stats,
          level: trainer.aiLevel === 'expert' ? 78 : trainer.aiLevel === 'smart' ? 65 : 55,
          nature: natures[Math.floor(Math.random() * natures.length)],
          item: items[Math.floor(Math.random() * items.length)] || 'none',
          ability: p.abilities[0]?.ability.name || '',
          selectedMoves: validMoves,
          sprite: pokeAPI.getPokemonSpriteUrl(p.id),
          ivs: { hp:31, attack:31, defense:31, 'special-attack':31, 'special-defense':31, speed:31 },
          evs: { hp:84, attack:84, defense:84, 'special-attack':84, 'special-defense':84, speed:84 },
        };
      } catch {
        return null;
      }
    }));

    return { trainer, team: team.filter(Boolean) };
  }

  static _selectCompetitiveMoves(moves) {
    const preferredKeywords = ['stealth-rock', 'spikes', 'recover', 'roost', 'protect', 'swords-dance', 'dragon-dance', 'calm-mind', 'nasty-plot', 'toxic', 'thunder-wave', 'will-o-wisp', 'earthquake', 'close-combat', 'ice-beam', 'shadow-ball', 'thunderbolt', 'flamethrower', 'surf'];
    const sorted = moves
      .map(m => m.move?.name)
      .filter(Boolean)
      .sort((a, b) => {
        const aScore = preferredKeywords.some(k => a.includes(k)) ? 1 : 0;
        const bScore = preferredKeywords.some(k => b.includes(k)) ? 1 : 0;
        return bScore - aScore;
      });
    return [...new Set(sorted)].slice(0, 4);
  }

  static async generateRandomTeam(size = 6) {
    const ids = new Set();
    while (ids.size < size) ids.add(Math.floor(Math.random() * 898) + 1);
    const natures = Object.keys(DamageCalc.NATURES);

    const team = await Promise.all([...ids].map(async id => {
      try {
        const p = await pokeAPI.getPokemon(id);
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
        const validMoves = moveDetails.filter(Boolean).slice(0, 4);
        if (validMoves.length === 0) {
          // fallback: tackle
          validMoves.push({ name: 'tackle', nameES: 'Placaje', type: { name:'normal' }, damage_class: { name:'physical' }, power: 40, accuracy: 100, pp: 35, priority: 0 });
        }
        return {
          id: p.id,
          name: p.name,
          nameES: p.name.charAt(0).toUpperCase() + p.name.slice(1),
          types: p.types.map(t => t.type.name),
          stats: p.stats,
          level: 50,
          nature: natures[Math.floor(Math.random() * natures.length)],
          item: 'none',
          ability: p.abilities[0]?.ability.name || '',
          selectedMoves: validMoves,
          sprite: pokeAPI.getPokemonSpriteUrl(p.id),
          ivs: { hp:31, attack:31, defense:31, 'special-attack':31, 'special-defense':31, speed:31 },
          evs: { hp:0,  attack:0,  defense:0,  'special-attack':0,  'special-defense':0,  speed:0 },
        };
      } catch { return null; }
    }));
    return team.filter(Boolean);
  }
}

// Global singleton
const battleSim = new BattleSimulator();
