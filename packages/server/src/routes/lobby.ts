import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { GAME, LOBBY, ROBOT_COLORS } from '@mechmarathon/shared';
import type { Lobby, LobbyError } from '@mechmarathon/shared';
import { prisma } from '../lib/prisma.js';
import { toLobby, lobbyInclude } from '../lib/lobbyUtils.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const createLobbySchema = z.object({
  name: z.string().min(LOBBY.NAME_MIN_LENGTH).max(LOBBY.NAME_MAX_LENGTH),
  visibility: z.enum(['public', 'private']),
  maxPlayers: z.number().int().min(GAME.MIN_PLAYERS).max(GAME.MAX_PLAYERS),
});

export const lobbyRouter: RouterType = Router();

// POST / — Create a new lobby
lobbyRouter.post('/', requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const parsed = createLobbySchema.safeParse(req.body);
  if (!parsed.success) {
    const error: LobbyError = { error: parsed.error.issues[0].message };
    res.status(400).json(error);
    return;
  }

  const { name, visibility, maxPlayers } = parsed.data;

  // Check if user is already in a waiting lobby
  const existing = await prisma.gamePlayer.findFirst({
    where: { userId: userId!, game: { status: 'waiting' } },
  });
  if (existing) {
    const error: LobbyError = { error: 'You are already in an active lobby' };
    res.status(409).json(error);
    return;
  }

  const game = await prisma.game.create({
    data: {
      name,
      hostId: userId!,
      visibility,
      maxPlayers,
      boardId: 'default',
      players: {
        create: {
          userId: userId!,
          color: ROBOT_COLORS[0],
        },
      },
    },
    include: lobbyInclude,
  });

  const lobby: Lobby = toLobby(game);
  res.status(201).json(lobby);
});

// GET / — List public waiting lobbies
lobbyRouter.get('/', requireAuth, async (_req, res) => {
  const games = await prisma.game.findMany({
    where: { status: 'waiting', visibility: 'public' },
    include: lobbyInclude,
    orderBy: { createdAt: 'desc' },
  });

  const lobbies: Lobby[] = games.map(toLobby);
  res.json(lobbies);
});

// GET /:id — Get a single lobby
lobbyRouter.get('/:id', requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;

  const game = await prisma.game.findUnique({
    where: { id },
    include: lobbyInclude,
  });

  if (!game) {
    const error: LobbyError = { error: 'Lobby not found' };
    res.status(404).json(error);
    return;
  }

  // Private lobbies are only visible to members
  if (game.visibility === 'private') {
    const isMember = game.players.some((p) => p.userId === userId);
    if (!isMember) {
      const error: LobbyError = { error: 'Lobby not found' };
      res.status(404).json(error);
      return;
    }
  }

  res.json(toLobby(game));
});
