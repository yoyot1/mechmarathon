import type { Server } from 'socket.io';
import { GameInstance } from './GameInstance.js';

interface PlayerInfo {
  userId: string;
  username: string;
  color: string;
}

class GameManagerSingleton {
  private games = new Map<string, GameInstance>();
  private playerGameMap = new Map<string, string>(); // userId → gameId

  createGame(gameId: string, playerInfos: PlayerInfo[], io: Server, botPlayerIds?: string[]): GameInstance {
    const instance = new GameInstance(gameId, playerInfos, io, botPlayerIds);
    this.games.set(gameId, instance);

    for (const p of playerInfos) {
      this.playerGameMap.set(p.userId, gameId);
    }

    return instance;
  }

  getGame(gameId: string): GameInstance | undefined {
    return this.games.get(gameId);
  }

  getPlayerGame(userId: string): GameInstance | undefined {
    const gameId = this.playerGameMap.get(userId);
    if (!gameId) return undefined;
    return this.games.get(gameId);
  }

  removeGame(gameId: string): void {
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
