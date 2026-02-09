import type { Lobby, LobbyPlayer } from '@mechmarathon/shared';
import type { Prisma } from '@prisma/client';

/** Prisma include object for loading a game as a lobby with player+user data */
export const lobbyInclude = {
  players: {
    include: { user: true },
  },
} satisfies Prisma.GameInclude;

/** Type of a Game row loaded with lobbyInclude */
type GameWithPlayers = Prisma.GameGetPayload<{ include: typeof lobbyInclude }>;

/** Serialize a Prisma Game (with players+users) into a Lobby DTO */
export function toLobby(game: GameWithPlayers): Lobby {
  return {
    id: game.id,
    name: game.name,
    hostId: game.hostId,
    visibility: game.visibility as Lobby['visibility'],
    status: game.status as Lobby['status'],
    maxPlayers: game.maxPlayers,
    boardId: game.boardId,
    createdAt: game.createdAt.toISOString(),
    players: game.players.map(
      (p): LobbyPlayer => ({
        userId: p.userId,
        username: p.user.username,
        ready: p.ready,
        color: p.color,
      }),
    ),
  };
}
