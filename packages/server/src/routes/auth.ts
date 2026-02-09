import { Router, type Router as RouterType } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AUTH } from '@mechmarathon/shared';
import type { AuthResponse, AuthError, UserProfile } from '@mechmarathon/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const registerSchema = z.object({
  username: z
    .string()
    .min(AUTH.USERNAME_MIN_LENGTH)
    .max(AUTH.USERNAME_MAX_LENGTH)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH).max(AUTH.PASSWORD_MAX_LENGTH),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });
}

function toUserProfile(user: {
  id: string;
  username: string;
  reputation: number;
  createdAt: Date;
  stats: { gamesPlayed: number; gamesWon: number; gamesAbandoned: number; totalCheckpointsReached: number } | null;
}): UserProfile {
  return {
    id: user.id,
    username: user.username,
    reputation: user.reputation,
    createdAt: user.createdAt.toISOString(),
    stats: user.stats
      ? {
          gamesPlayed: user.stats.gamesPlayed,
          gamesWon: user.stats.gamesWon,
          gamesAbandoned: user.stats.gamesAbandoned,
          totalCheckpointsReached: user.stats.totalCheckpointsReached,
        }
      : { gamesPlayed: 0, gamesWon: 0, gamesAbandoned: 0, totalCheckpointsReached: 0 },
  };
}

export const authRouter: RouterType = Router();

// POST /register
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const error: AuthError = { error: firstIssue.message, field: firstIssue.path[0] as string };
    res.status(400).json(error);
    return;
  }

  const { username, email, password } = parsed.data;

  // Check uniqueness
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    const field = existing.email === email ? 'email' : 'username';
    const error: AuthError = { error: `${field === 'email' ? 'Email' : 'Username'} already taken`, field };
    res.status(409).json(error);
    return;
  }

  const hash = await bcrypt.hash(password, AUTH.BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hash,
      stats: { create: {} },
    },
    include: { stats: true },
  });

  const token = signToken(user.id);
  const response: AuthResponse = { token, user: toUserProfile(user) };
  res.status(201).json(response);
});

// POST /login
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const error: AuthError = { error: 'Invalid email or password' };
    res.status(400).json(error);
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { stats: true },
  });
  if (!user) {
    const error: AuthError = { error: 'Invalid email or password' };
    res.status(401).json(error);
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const error: AuthError = { error: 'Invalid email or password' };
    res.status(401).json(error);
    return;
  }

  const token = signToken(user.id);
  const response: AuthResponse = { token, user: toUserProfile(user) };
  res.json(response);
});

// GET /me
authRouter.get('/me', requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { stats: true },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(toUserProfile(user));
});
