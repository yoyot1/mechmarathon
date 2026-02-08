/** Lobby visibility */
export type LobbyVisibility = 'public' | 'private';

/** Lobby status */
export type LobbyStatus = 'waiting' | 'in_progress' | 'finished';

/** A game lobby */
export interface Lobby {
  id: string;
  name: string;
  hostId: string;
  visibility: LobbyVisibility;
  status: LobbyStatus;
  maxPlayers: number;
  players: LobbyPlayer[];
  boardId: string;
  createdAt: string;
}

/** A player in a lobby */
export interface LobbyPlayer {
  userId: string;
  username: string;
  ready: boolean;
  color: string;
}
