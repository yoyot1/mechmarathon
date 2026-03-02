import { PrismaClient } from '@prisma/client';
import { DEFAULT_BOARD } from '@mechmarathon/shared';

const prisma = new PrismaClient();

const DEFAULT_BOARD_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  await prisma.board.upsert({
    where: { id: DEFAULT_BOARD_ID },
    update: {
      name: DEFAULT_BOARD.name,
      tiles: DEFAULT_BOARD.tiles,
    },
    create: {
      id: DEFAULT_BOARD_ID,
      name: DEFAULT_BOARD.name,
      description: 'The classic Factory Floor board with conveyors, gears, pits, and walls.',
      tiles: DEFAULT_BOARD.tiles,
      isOfficial: true,
      isPublished: true,
    },
  });

  console.log('Seeded default board: Factory Floor');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
