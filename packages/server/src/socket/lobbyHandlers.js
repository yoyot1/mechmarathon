import { EVENTS, GAME, ROBOT_COLORS, assembleMap } from '@mechmarathon/shared';
import { prisma } from '../lib/prisma.js';
import { toLobby, lobbyInclude } from '../lib/lobbyUtils.js';
import { GameManager } from '../game/GameManager.js';
import { getOrCreateBot } from '../game/BotPlayer.js';

function lobbyRoom(gameId) {
  return `lobby:${gameId}`;
}

/** Broadcast the current lobby state to all players in the room */
async function broadcastLobbyUpdate(io, gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: lobbyInclude,
  });
  if (!game) return null;

  const lobby = toLobby(game);
  io.to(lobbyRoom(gameId)).emit(EVENTS.LOBBY_UPDATE, lobby);
  return lobby;
}

export function registerLobbyHandlers(io, socket) {
  const userId = socket.data.userId;

  // lobby:join — Join an existing lobby
  socket.on(EVENTS.LOBBY_JOIN, async (data, ack) => {
    const { lobbyId } = data;

    const game = await prisma.game.findUnique({
      where: { id: lobbyId },
      include: lobbyInclude,
    });

    if (!game || game.status !== 'waiting') {
      ack?.({ error: 'Lobby not found or already started' });
      return;
    }

    if (game.players.length >= game.maxPlayers) {
      ack?.({ error: 'Lobby is full' });
      return;
    }

    if (game.players.some((p) => p.userId === userId)) {
      // Already in lobby — just join the room
      socket.join(lobbyRoom(lobbyId));
      const lobby = toLobby(game);
      ack?.({ lobby });
      return;
    }

    // Check if user is already in another waiting lobby
    const existingPlayer = await prisma.gamePlayer.findFirst({
      where: { userId, game: { status: 'waiting' } },
    });
    if (existingPlayer) {
      ack?.({ error: 'You are already in another lobby' });
      return;
    }

    // Pick the first available color
    const usedColors = new Set(game.players.map((p) => p.color));
    const color = ROBOT_COLORS.find((c) => !usedColors.has(c)) ?? ROBOT_COLORS[0];

    await prisma.gamePlayer.create({
      data: { gameId: lobbyId, userId, color },
    });

    socket.join(lobbyRoom(lobbyId));
    const lobby = await broadcastLobbyUpdate(io, lobbyId);
    ack?.({ lobby: lobby ?? undefined });
  });

  // lobby:leave — Leave a lobby
  socket.on(EVENTS.LOBBY_LEAVE, async (data, ack) => {
    await handleLeaveLobby(io, socket, userId, data.lobbyId);
    ack?.({});
  });

  // lobby:ready — Toggle ready state
  socket.on(EVENTS.LOBBY_READY, async (data, ack) => {
    const { lobbyId } = data;

    const player = await prisma.gamePlayer.findFirst({
      where: { gameId: lobbyId, userId },
    });
    if (!player) {
      ack?.({ error: 'You are not in this lobby' });
      return;
    }

    // Host doesn't need to toggle ready
    const game = await prisma.game.findUnique({ where: { id: lobbyId } });
    if (!game || game.status !== 'waiting') {
      ack?.({ error: 'Lobby not found' });
      return;
    }

    await prisma.gamePlayer.update({
      where: { id: player.id },
      data: { ready: !player.ready },
    });

    await broadcastLobbyUpdate(io, lobbyId);
    ack?.({});
  });

  // lobby:add_bot — Host adds an AI bot to the lobby
  socket.on(EVENTS.LOBBY_ADD_BOT, async (data, ack) => {
    const { lobbyId } = data;

    const game = await prisma.game.findUnique({
      where: { id: lobbyId },
      include: lobbyInclude,
    });

    if (!game || game.status !== 'waiting') {
      ack?.({ error: 'Lobby not found' });
      return;
    }

    if (game.hostId !== userId) {
      ack?.({ error: 'Only the host can add bots' });
      return;
    }

    if (game.players.length >= game.maxPlayers) {
      ack?.({ error: 'Lobby is full' });
      return;
    }

    // Count existing bots to pick the next bot index
    const botCount = game.players.filter((p) => p.user.email.endsWith('@mechmarathon.local')).length;
    const bot = await getOrCreateBot(botCount);

    // Pick available color
    const usedColors = new Set(game.players.map((p) => p.color));
    const color = ROBOT_COLORS.find((c) => !usedColors.has(c)) ?? ROBOT_COLORS[0];

    await prisma.gamePlayer.create({
      data: { gameId: lobbyId, userId: bot.id, color, ready: true },
    });

    await broadcastLobbyUpdate(io, lobbyId);
    ack?.({});
  });

  // lobby:map_config — Host configures the map
  socket.on(EVENTS.LOBBY_MAP_CONFIG, async (data, ack) => {
    const { lobbyId, mapConfig } = data;

    const game = await prisma.game.findUnique({ where: { id: lobbyId } });
    if (!game || game.status !== 'waiting') {
      ack?.({ error: 'Lobby not found' });
      return;
    }

    if (game.hostId !== userId) {
      ack?.({ error: 'Only the host can configure the map' });
      return;
    }

    // Validate mapConfig structure
    if (!mapConfig || !Array.isArray(mapConfig.boards) || mapConfig.boards.length === 0) {
      ack?.({ error: 'Invalid map configuration: must have at least one board' });
      return;
    }

    // Validate all referenced board IDs exist
    const boardIds = mapConfig.boards.map((b) => b.boardId);
    const boards = await prisma.board.findMany({
      where: { id: { in: boardIds } },
      select: { id: true },
    });
    const foundIds = new Set(boards.map((b) => b.id));
    const missing = boardIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      ack?.({ error: `Board(s) not found: ${missing.join(', ')}` });
      return;
    }

    // Validate flags and spawn points
    if (mapConfig.flags && !Array.isArray(mapConfig.flags)) {
      ack?.({ error: 'Invalid flags format' });
      return;
    }
    if (mapConfig.spawnPoints && !Array.isArray(mapConfig.spawnPoints)) {
      ack?.({ error: 'Invalid spawn points format' });
      return;
    }

    await prisma.game.update({
      where: { id: lobbyId },
      data: { mapConfig },
    });

    // Broadcast map config update to all lobby members
    io.to(lobbyRoom(lobbyId)).emit(EVENTS.LOBBY_MAP_UPDATE, { mapConfig });
    await broadcastLobbyUpdate(io, lobbyId);
    ack?.({});
  });

  // lobby:start — Host starts the game
  socket.on(EVENTS.LOBBY_START, async (data, ack) => {
    const { lobbyId } = data;

    const game = await prisma.game.findUnique({
      where: { id: lobbyId },
      include: lobbyInclude,
    });

    if (!game || game.status !== 'waiting') {
      ack?.({ error: 'Lobby not found' });
      return;
    }

    if (game.hostId !== userId) {
      ack?.({ error: 'Only the host can start the game' });
      return;
    }

    if (game.players.length < GAME.MIN_PLAYERS) {
      ack?.({ error: `Need at least ${GAME.MIN_PLAYERS} players to start` });
      return;
    }

    // Check all non-host players are ready
    const allReady = game.players.every((p) => p.userId === game.hostId || p.ready);
    if (!allReady) {
      ack?.({ error: 'All players must be ready' });
      return;
    }

    await prisma.game.update({
      where: { id: lobbyId },
      data: { status: 'in_progress' },
    });

    // Assemble board data from mapConfig or use defaults
    let boardData = null;
    if (game.mapConfig) {
      try {
        const boardIds = game.mapConfig.boards.map((b) => b.boardId);
        const boards = await prisma.board.findMany({
          where: { id: { in: boardIds } },
        });
        const boardsById = new Map(boards.map((b) => [b.id, { width: 12, height: 12, tiles: b.tiles }]));
        boardData = assembleMap(game.mapConfig, boardsById);
      } catch (e) {
        console.error('Failed to assemble map, falling back to default:', e);
      }
    }

    // Create in-memory game instance
    const playerInfos = game.players.map((p) => ({
      userId: p.userId,
      username: p.user.username,
      color: p.color,
    }));
    const botIds = game.players
      .filter((p) => p.user.email.endsWith('@mechmarathon.local'))
      .map((p) => p.userId);
    GameManager.createGame(lobbyId, playerInfos, io, botIds, boardData);

    const lobby = await broadcastLobbyUpdate(io, lobbyId);
    ack?.({ lobby: lobby ?? undefined });
  });

  // disconnect — Auto-leave any lobby the player is in
  socket.on('disconnect', async () => {
    const players = await prisma.gamePlayer.findMany({
      where: { userId, game: { status: 'waiting' } },
    });

    for (const player of players) {
      await handleLeaveLobby(io, socket, userId, player.gameId);
    }
  });
}

async function handleLeaveLobby(io, socket, userId, gameId) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: lobbyInclude,
  });

  if (!game || game.status !== 'waiting') return;

  const player = game.players.find((p) => p.userId === userId);
  if (!player) return;

  // Remove the player
  await prisma.gamePlayer.delete({
    where: { id: player.id },
  });

  socket.leave(lobbyRoom(gameId));

  // If no players left, delete the game
  const remainingCount = game.players.length - 1;
  if (remainingCount === 0) {
    await prisma.game.delete({ where: { id: gameId } });
    return;
  }

  // If host left, transfer host to first remaining player
  if (game.hostId === userId) {
    const newHost = game.players.find((p) => p.userId !== userId);
    await prisma.game.update({
      where: { id: gameId },
      data: { hostId: newHost.userId },
    });
  }

  await broadcastLobbyUpdate(io, gameId);
}
