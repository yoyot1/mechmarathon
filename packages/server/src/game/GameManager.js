import { GameInstance } from './GameInstance.js';

class GameManagerSingleton {
  constructor() {
    this.games = new Map();
    this.playerGameMap = new Map(); // userId → gameId
  }

  createGame(gameId, playerInfos, io, botPlayerIds) {
    const instance = new GameInstance(gameId, playerInfos, io, botPlayerIds);
    this.games.set(gameId, instance);

    for (const p of playerInfos) {
      this.playerGameMap.set(p.userId, gameId);
    }

    return instance;
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }

  getPlayerGame(userId) {
    const gameId = this.playerGameMap.get(userId);
    if (!gameId) return undefined;
    return this.games.get(gameId);
  }

  removeGame(gameId) {
    const instance = this.games.get(gameId);
    if (instance) {
      for (const playerId of instance.getPlayerIds()) {
        this.playerGameMap.delete(playerId);
      }
      instance.destroy();
      this.games.delete(gameId);
    }
  }
}

export const GameManager = new GameManagerSingleton();
