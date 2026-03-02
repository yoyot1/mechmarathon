-- CreateTable
CREATE TABLE "boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tiles" JSONB NOT NULL,
    "author_id" TEXT,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey for boards
ALTER TABLE "boards" ADD CONSTRAINT "boards_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add map_config, make board_id nullable
ALTER TABLE "games" ADD COLUMN "map_config" JSONB;
ALTER TABLE "games" ALTER COLUMN "board_id" DROP NOT NULL;

-- Clear old non-UUID boardId values so FK can be added
UPDATE "games" SET "board_id" = NULL WHERE "board_id" IS NOT NULL AND LENGTH("board_id") < 36;

-- AddForeignKey for games.board_id
ALTER TABLE "games" ADD CONSTRAINT "games_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
