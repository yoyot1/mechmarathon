import type { Server, Socket } from 'socket.io';
import { EVENTS, GAME, ROBOT_COLORS } from '@mechmarathon/shared';
import type { Lobby } from '@mechmarathon/shared';
import { prisma } from '../lib/prisma.js';
import { toLobby, lobbyInclude } from '../lib/lobbyUtils.js';
import { GameManager } from '../game/GameManager.js';
import { getOrCreateBot } from '../game/BotPlayer.js';

function lobbyRoom(gameId: string): string {
  return `lobby:${gameId}`;
}

/** Broadcast the current lobby state to all players in the room */
async function broadcastLobbyUpdate(io: Server, gameId: string): Promise<Lobby | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: lobbyInclude,
  });
  if (!game) return null;

  const lobby = toLobby(game);
  io.to(lobbyRoom(gameId)).emit(EVENTS.LOBBY_UPDATE, lobby);
  return lobby;
}

export function registerLobbyHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId;

  // lobby:join — Join an existing lobby
  socket.on(EVENTS.LOBBY_JOIN, async (data: { lobbyId: string }, ack?: (res: { error?: string; lobby?: Lobby }) => void) => {
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
  socket.on(EVENTS.LOBBY_LEAVE, async (data: { lobbyId: string }, ack?: (res: { error?: string }) => void) => {
    await handleLeaveLobby(io, socket, userId, data.lobbyId);
    ack?.({});
  });

  // lobby:ready — Toggle ready state
  socket.on(EVENTS.LOBBY_READY, async (data: { lobbyId: string }, ack?: (res: { error?: string }) => void) => {
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
  socket.on(EVENTS.LOBBY_ADD_BOT, async (data: { lobbyId: string }, ack?: (res: { error?: string }) => void) => {
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

  // lobby:start — Host starts the game
  socket.on(EVENTS.LOBBY_START, async (data: { lobbyId: string }, ack?: (res: { error?: string }) => void) => {
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

    // Create in-memory game instance
    const playerInfos = game.players.map((p) => ({
      userId: p.userId,
      username: p.user.username,
      color: p.color,
    }));
    const botIds = game.players
      .filter((p) => p.user.email.endsWith('@mechmarathon.local'))
      .map((p) => p.userId);
    GameManager.createGame(lobbyId, playerInfos, io, botIds);

    const lobby = await broadcastLobbyUpdate(io, lobbyId);
    ack?.({ lobby: lobby ?? undefined } as { error?: string });
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

async function handleLeaveLobby(io: Server, socket: Socket, userId: string, gameId: string): Promise<void> {
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
    const newHost = game.players.find((p) => p.userId !== userId)!;
    await prisma.game.update({
      where: { id: gameId },
      data: { hostId: newHost.userId },
    });
  }

  await broadcastLobbyUpdate(io, gameId);
}
