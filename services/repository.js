class SquadRepository {
  constructor(dataStore) {
    this.store = dataStore;
    this._cache = null;
    this._indexes = null;
  }

  _load() {
    if (!this._cache) {
      this._cache = this.store.read();
      this._rebuildIndexes(this._cache);
    }
    return this._cache;
  }

  _rebuildIndexes(db) {
    const usersById = new Map();
    const usersByUsername = new Map();
    const usersBySquad = new Map();
    const squadsById = new Map();
    const workoutsByUser = new Map();

    for (const sq of db.squads) {
      squadsById.set(sq.id, sq);
      usersBySquad.set(sq.id, []);
    }

    for (const user of db.users) {
      usersById.set(user.id, user);
      usersByUsername.set(user.username, user);
      if (!usersBySquad.has(user.squadId)) {
        usersBySquad.set(user.squadId, []);
      }
      usersBySquad.get(user.squadId).push(user);
      workoutsByUser.set(user.id, []);
    }

    for (const w of db.workouts) {
      if (!workoutsByUser.has(w.userId)) {
        workoutsByUser.set(w.userId, []);
      }
      workoutsByUser.get(w.userId).push(w);
    }

    // Pre-sort each user's workouts newest-first for O(1) pagination slicing
    for (const list of workoutsByUser.values()) {
      list.sort((a, b) => b.date - a.date);
    }

    this._indexes = {
      usersById,
      usersByUsername,
      usersBySquad,
      squadsById,
      workoutsByUser
    };
  }

  commit(db) {
    this.store.write(db);
    this._cache = db;
    this._rebuildIndexes(db);
  }

  getDb() {
    return this._load();
  }

  findUserById(id) {
    this._load();
    return this._indexes.usersById.get(id) || null;
  }

  findUserByUsername(username) {
    this._load();
    return this._indexes.usersByUsername.get(username) || null;
  }

  findSquadById(id) {
    this._load();
    return this._indexes.squadsById.get(id) || null;
  }

  getSquadMembers(squadId) {
    this._load();
    return this._indexes.usersBySquad.get(squadId) || [];
  }

  getUserWorkouts(userId) {
    this._load();
    return this._indexes.workoutsByUser.get(userId) || [];
  }

  getSession(token) {
    const db = this._load();
    return db.sessions[token] || null;
  }
}

module.exports = SquadRepository;
