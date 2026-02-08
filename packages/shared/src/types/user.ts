/** Public user profile */
export interface UserProfile {
  id: string;
  username: string;
  createdAt: string;
  stats: UserStats;
  reputation: number;
}

/** User game statistics */
export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesAbandoned: number;
  totalCheckpointsReached: number;
}
