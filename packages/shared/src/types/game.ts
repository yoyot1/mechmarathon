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
  /** True when the robot is virtual (non-colliding) — first turn or stacked */
  virtual: boolean;
  /** Last checkpoint or repair site — used as respawn location */
  archivePosition: Position;
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

/** Board definition — a reusable board layout */
export interface BoardDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Tile[][];
}

/** Checkpoint overlay configuration */
export interface CheckpointConfig {
  position: Position;
  number: number;
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
  checkpoints: CheckpointConfig[];
  winnerId: string | null;
  executionSpeed: 1 | 2 | 3;
  pendingDirectionChoices: string[];
  debugMode: boolean;
}

/** Types of events that occur during execution */
export type ExecutionEventType =
  | 'move'
  | 'rotate'
  | 'push'
  | 'fall'
  | 'checkpoint'
  | 'repair'
  | 'conveyor'
  | 'gear'
  | 'respawn';

/** An event that occurs during register execution */
export interface ExecutionEvent {
  type: ExecutionEventType;
  robotId: string;
  from?: Position;
  to?: Position;
  direction?: Direction;
  details?: string;
}

/** Payload sent when cards are dealt */
export interface CardsDealtPayload {
  hand: Card[];
  timerSeconds: number;
}

/** A single sub-step within register execution (one card or one board element phase) */
export interface ExecutionStep {
  label: string;
  events: ExecutionEvent[];
  robotsAfter: Robot[];
}

/** Payload sent for each register execution (or each sub-step in debug mode) */
export interface ExecutePayload {
  registerIndex: number;
  stepIndex: number;
  totalSteps: number;
  stepLabel: string;
  events: ExecutionEvent[];
  updatedRobots: Robot[];
}

/** Payload sent on phase change */
export interface PhaseChangePayload {
  phase: GamePhase;
  round: number;
  timerSeconds?: number;
}

/** Payload sent when game ends */
export interface GameOverPayload {
  winnerId: string;
  finalState: GameState;
}

/** Payload sent at execution start with all players' programs */
export interface ProgramsPayload {
  programs: Record<string, Card[]>;
}

/** Payload for speed change */
export interface SpeedChangePayload {
  speed: 1 | 2 | 3;
}

/** Payload when server requests direction choices */
export interface DirectionNeededPayload {
  playerIds: string[];
  reason: 'initial' | 'respawn';
  timeoutSeconds: number;
}

/** Payload when client submits direction choice */
export interface ChooseDirectionPayload {
  gameId: string;
  direction: Direction;
}

/** Payload for debug mode toggle */
export interface DebugModePayload {
  enabled: boolean;
}
