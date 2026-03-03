import { Router } from 'express';
import { z } from 'zod';
import { BOARD } from '@mechmarathon/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const directionEnum = z.enum(BOARD.DIRECTIONS);

const sideFeatureSchema = z.object({
  type: z.enum(BOARD.SIDE_FEATURE_TYPES),
  side: directionEnum,
  strength: z.number().int().min(1).max(3).optional(),
  phases: z.array(z.number().int().min(1).max(5)).optional(),
});

const overlaySchema = z.object({
  type: z.enum(BOARD.OVERLAY_TYPES),
  phases: z.array(z.number().int().min(1).max(5)).optional(),
});

const oneWayWallSchema = z.object({
  side: directionEnum,
  blocks: z.enum(['entry', 'exit']),
});

const tileSchema = z.object({
  type: z.enum(BOARD.TILE_TYPES),
  direction: directionEnum.optional(),
  walls: z.array(directionEnum).optional(),
  oneWayWalls: z.array(oneWayWallSchema).optional(),
  entry: z.array(directionEnum).optional(),
  sideFeatures: z.array(sideFeatureSchema).optional(),
  overlays: z.array(overlaySchema).optional(),
  phases: z.array(z.number().int().min(1).max(5)).optional(),
  group: z.string().max(4).optional(),
  elevation: z.number().int().min(0).max(2).optional(),
});

const tilesSchema = z.array(z.array(tileSchema).length(BOARD.SIZE)).length(BOARD.SIZE);

const createBoardSchema = z.object({
  name: z.string().min(BOARD.NAME_MIN_LENGTH).max(BOARD.NAME_MAX_LENGTH),
  description: z.string().max(BOARD.DESCRIPTION_MAX_LENGTH).default(''),
  tiles: tilesSchema,
});

const updateBoardSchema = z.object({
  name: z.string().min(BOARD.NAME_MIN_LENGTH).max(BOARD.NAME_MAX_LENGTH).optional(),
  description: z.string().max(BOARD.DESCRIPTION_MAX_LENGTH).optional(),
  tiles: tilesSchema.optional(),
  isPublished: z.boolean().optional(),
});

export const boardRouter = Router();

// GET / — List published + official boards (no tiles payload)
boardRouter.get('/', requireAuth, async (_req, res) => {
  const boards = await prisma.board.findMany({
    where: {
      OR: [{ isPublished: true }, { isOfficial: true }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      isOfficial: true,
      isPublished: true,
      authorId: true,
      createdAt: true,
      author: { select: { username: true } },
    },
    orderBy: [{ isOfficial: 'desc' }, { createdAt: 'desc' }],
  });

  res.json(boards);
});

// GET /mine — User's own boards
boardRouter.get('/mine', requireAuth, async (req, res) => {
  const boards = await prisma.board.findMany({
    where: { authorId: req.userId },
    select: {
      id: true,
      name: true,
      description: true,
      isOfficial: true,
      isPublished: true,
      authorId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(boards);
});

// GET /:id — Full board with tiles
boardRouter.get('/:id', requireAuth, async (req, res) => {
  const board = await prisma.board.findUnique({
    where: { id: req.params.id },
    include: { author: { select: { username: true } } },
  });

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  // Only return if published, official, or owned by the user
  if (!board.isPublished && !board.isOfficial && board.authorId !== req.userId) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  res.json(board);
});

// POST / — Create a new board
boardRouter.post('/', requireAuth, async (req, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const board = await prisma.board.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      tiles: parsed.data.tiles,
      authorId: req.userId,
    },
  });

  res.status(201).json(board);
});

// PUT /:id — Update a board (owner only)
boardRouter.put('/:id', requireAuth, async (req, res) => {
  const board = await prisma.board.findUnique({ where: { id: req.params.id } });

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  if (board.authorId !== req.userId) {
    res.status(403).json({ error: 'You can only edit your own boards' });
    return;
  }

  if (board.isOfficial) {
    res.status(403).json({ error: 'Cannot edit official boards' });
    return;
  }

  const parsed = updateBoardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const updated = await prisma.board.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json(updated);
});

// DELETE /:id — Delete a board (owner only, not in active game)
boardRouter.delete('/:id', requireAuth, async (req, res) => {
  const board = await prisma.board.findUnique({
    where: { id: req.params.id },
    include: { games: { where: { status: { in: ['waiting', 'in_progress'] } } } },
  });

  if (!board) {
    res.status(404).json({ error: 'Board not found' });
    return;
  }

  if (board.authorId !== req.userId) {
    res.status(403).json({ error: 'You can only delete your own boards' });
    return;
  }

  if (board.isOfficial) {
    res.status(403).json({ error: 'Cannot delete official boards' });
    return;
  }

  if (board.games.length > 0) {
    res.status(409).json({ error: 'Board is in use by an active game' });
    return;
  }

  await prisma.board.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
