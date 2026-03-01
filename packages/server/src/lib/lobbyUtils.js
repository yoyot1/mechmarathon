/** Prisma include object for loading a game as a lobby with player+user data */
export const lobbyInclude = {
  players: {
    include: { user: true },
  },
};

/** Serialize a Prisma Game (with players+users) into a Lobby DTO */
export function toLobby(game) {
  return {
    id: game.id,
    name: game.name,
    hostId: game.hostId,
    visibility: game.visibility,
    status: game.status,
    maxPlayers: game.maxPlayers,
    boardId: game.boardId,
    createdAt: game.createdAt.toISOString(),
    players: game.players.map(
      (p) => ({
        userId: p.userId,
        username: p.user.username,
        ready: p.ready,
        color: p.color,
      }),
    ),
  };
}
