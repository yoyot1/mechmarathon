import type { Server, Socket } from 'socket.io';
import { EVENTS } from '@mechmarathon/shared';
import type { GameState, Card } from '@mechmarathon/shared';
import { GameManager } from '../game/GameManager.js';

function gameRoom(gameId: string): string {
  return `game:${gameId}`;
}

export function registerGameHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  // game:state — Client joins game room and requests current state + hand
  socket.on(EVENTS.GAME_STATE, (data: { gameId: string }, ack?: (res: { error?: string; state?: GameState; hand?: Card[] }) => void) => {
    const { gameId } = data;
    const game = GameManager.getGame(gameId);

    if (!game) {
      ack?.({ error: 'Game not found' });
      return;
    }

    if (!game.getPlayerIds().includes(userId)) {
      ack?.({ error: 'You are not in this game' });
      return;
    }

    socket.join(gameRoom(gameId));
    game.handleReconnect(userId);

    ack?.({
      state: game.toGameState(),
      hand: game.getPlayerHand(userId),
    });
  });

  // game:program — Client submits their 5 programmed card IDs
  socket.on(EVENTS.GAME_PROGRAM, (data: { gameId: string; cardIds: string[] }, ack?: (res: { error?: string }) => void) => {
    const { gameId, cardIds } = data;
    const game = GameManager.getGame(gameId);

    if (!game) {
      ack?.({ error: 'Game not found' });
      return;
    }

    const result = game.submitProgram(userId, cardIds);
    ack?.(result);
  });

  // Handle disconnect — mark player as disconnected in their game
  socket.on('disconnect', () => {
    const game = GameManager.getPlayerGame(userId);
    if (game) {
      game.handleDisconnect(userId);
    }
  });
}
