import { EVENTS } from '@mechmarathon/shared';
import { GameManager } from '../game/GameManager.js';

function gameRoom(gameId) {
  return `game:${gameId}`;
}

export function registerGameHandlers(io, socket) {
  const userId = socket.data.userId;

  // game:state — Client joins game room and requests current state + hand
  socket.on(EVENTS.GAME_STATE, (data, ack) => {
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

  // game:program — Client submits their 5 programmed card IDs (+ optional direction)
  socket.on(EVENTS.GAME_PROGRAM, (data, ack) => {
    const { gameId, cardIds, direction } = data;
    const game = GameManager.getGame(gameId);

    if (!game) {
      ack?.({ error: 'Game not found' });
      return;
    }

    const result = game.submitProgram(userId, cardIds, direction);
    ack?.(result);
  });

  // game:speed — Change execution speed
  socket.on(EVENTS.GAME_SPEED, (data, ack) => {
    const { gameId, speed } = data;
    const game = GameManager.getGame(gameId);

    if (!game) {
      ack?.({ error: 'Game not found' });
      return;
    }

    if (speed !== 1 && speed !== 2 && speed !== 3) {
      ack?.({ error: 'Speed must be 1, 2, or 3' });
      return;
    }

    game.setSpeed(speed);
    ack?.({});
  });

  // game:choose_direction — Player chooses direction (for respawn)
  socket.on(EVENTS.GAME_CHOOSE_DIRECTION, (data, ack) => {
    const { gameId, direction } = data;
    const game = GameManager.getGame(gameId);

    if (!game) {
      ack?.({ error: 'Game not found' });
      return;
    }

    const validDirs = ['north', 'east', 'south', 'west'];
    if (!validDirs.includes(direction)) {
      ack?.({ error: 'Invalid direction' });
      return;
    }

    const result = game.chooseDirection(userId, direction);
    ack?.(result);
  });

  // game:debug_mode — Toggle debug/step-through mode
  socket.on(EVENTS.GAME_DEBUG_MODE, (data, ack) => {
    const { gameId, enabled } = data;
    const game = GameManager.getGame(gameId);
    if (!game) { ack?.({ error: 'Game not found' }); return; }
    game.setDebugMode(enabled);
    ack?.({});
  });

  // game:debug_step — Advance one step in debug mode
  socket.on(EVENTS.GAME_DEBUG_STEP, (data, ack) => {
    const { gameId } = data;
    const game = GameManager.getGame(gameId);
    if (!game) { ack?.({ error: 'Game not found' }); return; }
    const result = game.debugStep();
    ack?.(result);
  });

  // game:debug_step_back — Go back one step in debug mode
  socket.on(EVENTS.GAME_DEBUG_STEP_BACK, (data, ack) => {
    const { gameId } = data;
    const game = GameManager.getGame(gameId);
    if (!game) { ack?.({ error: 'Game not found' }); return; }
    const result = game.debugStepBack();
    ack?.(result);
  });

  // game:leave — Player leaves the game
  socket.on(EVENTS.GAME_LEAVE, (data, ack) => {
    const { gameId } = data;
    socket.leave(gameRoom(gameId));
    // Clean up the game if needed
    const game = GameManager.getGame(gameId);
    if (game) {
      game.handleDisconnect(userId);
    }
    ack?.({});
  });

  // Handle disconnect — mark player as disconnected in their game
  socket.on('disconnect', () => {
    const game = GameManager.getPlayerGame(userId);
    if (game) {
      game.handleDisconnect(userId);
    }
  });
}
