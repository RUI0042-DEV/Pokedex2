class TeamBuilderStorage {
    constructor(store) {
        this.store = store;
        this.storageKey = 'pokedex_saved_teams';
    }

    getTeams() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        } catch {
            return [];
        }
    }

    saveTeam(team, meta = {}) {
        const teams = this.getTeams();
        const payload = {
            id: meta.id || `team_${Date.now()}`,
            name: meta.name || `Equipo ${teams.length + 1}`,
            mode: meta.mode || 'sandbox',
            notes: meta.notes || '',
            createdAt: meta.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            members: (team || []).slice(0, 6),
        };
        const index = teams.findIndex(item => item.id === payload.id);
        if (index >= 0) teams[index] = payload;
        else teams.unshift(payload);
        localStorage.setItem(this.storageKey, JSON.stringify(teams.slice(0, 20)));
        this.store?.set(this.storageKey, teams.slice(0, 20));
        return payload;
    }

    deleteTeam(id) {
        const teams = this.getTeams().filter(team => team.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(teams));
        this.store?.set(this.storageKey, teams);
    }

    exportTeam(teamId) {
        const team = this.getTeams().find(item => item.id === teamId);
        if (!team) throw new Error('Equipo no encontrado');
        return JSON.stringify(team, null, 2);
    }

    importTeam(rawText) {
        const parsed = JSON.parse(rawText);
        if (!parsed?.members || !Array.isArray(parsed.members)) {
            throw new Error('El equipo importado no es válido');
        }
        return this.saveTeam(parsed.members, parsed);
    }
}
