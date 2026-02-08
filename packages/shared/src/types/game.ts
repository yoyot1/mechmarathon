/** Direction a robot can face */
export type Direction = 'north' | 'east' | 'south' | 'west';

/** Card types that players can program */
export type CardType =
  | 'move1'
  | 'move2'
  | 'move3'
  | 'backup'
  | 'turn_left'
  | 'turn_right'
  | 'u_turn';

/** A programming card */
export interface Card {
  id: string;
  type: CardType;
  priority: number;
}

/** Position on the game board */
export interface Position {
  x: number;
  y: number;
}

/** A robot on the board */
export interface Robot {
  id: string;
  playerId: string;
  position: Position;
  direction: Direction;
  health: number;
  lives: number;
  checkpoint: number;
}

/** Board tile types */
export type TileType =
  | 'floor'
  | 'wall'
  | 'pit'
  | 'conveyor'
  | 'express_conveyor'
  | 'gear_cw'
  | 'gear_ccw'
  | 'laser'
  | 'checkpoint'
  | 'repair'
  | 'spawn';

/** A tile on the game board */
export interface Tile {
  type: TileType;
  direction?: Direction;
  walls?: Direction[];
  laserCount?: number;
  checkpointNumber?: number;
}

/** The game board */
export interface Board {
  width: number;
  height: number;
  tiles: Tile[][];
}

/** Phases of a game round */
export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'programming'
  | 'executing'
  | 'cleanup'
  | 'finished';

/** State of a single register (program slot) */
export interface RegisterState {
  registerIndex: number;
  cardPlayed: Card | null;
}

/** Full game state */
export interface GameState {
  id: string;
  board: Board;
  robots: Robot[];
  phase: GamePhase;
  currentRegister: number;
  round: number;
  totalCheckpoints: number;
  winnerId: string | null;
}
