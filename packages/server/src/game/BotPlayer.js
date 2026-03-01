import { prisma } from '../lib/prisma.js';

const BOT_NAMES = [
  'MechBot-Alpha',
  'MechBot-Beta',
  'MechBot-Gamma',
  'MechBot-Delta',
  'MechBot-Epsilon',
  'MechBot-Zeta',
  'MechBot-Eta',
];

/** Get or create a bot user record in the database */
export async function getOrCreateBot(index) {
  const username = BOT_NAMES[index % BOT_NAMES.length];
  const email = `bot-${index}@mechmarathon.local`;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { id: existing.id, username: existing.username };

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: 'BOT_NO_LOGIN',
      stats: {
        create: {},
      },
    },
  });

  return { id: user.id, username: user.username };
}

/** Check if a userId belongs to a bot */
export function isBotUser(userId, botIds) {
  return botIds.has(userId);
}
