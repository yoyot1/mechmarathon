/** Tile size in pixels */
export const TILE_SIZE = 48;

/** Gap between tiles in pixels */
export const TILE_GAP = 1;

/** Wall thickness in pixels */
export const WALL_THICKNESS = 4;

/** Wall color */
export const WALL_COLOR = 0xff8800;

/** Robot circle radius */
export const ROBOT_RADIUS = 14;

/** Base tween duration in milliseconds */
export const BASE_TWEEN_DURATION_MS = 300;

/** Board background color */
export const BOARD_BG_COLOR = 0x222222;

/** Tile background colors matching CSS grid */
export const TILE_COLORS = {
  floor: 0x2a2a3e,
  pit: 0x0a0a0a,
  conveyor: 0x1a3a1a,
  express_conveyor: 0x2a1a4a,
  gear_cw: 0x3a2a1a,
  gear_ccw: 0x3a1a2a,
  repair: 0x1a3a3a,
  wall: 0x4a4a4a,
  checkpoint: 0x3a3a1a,
  spawn: 0x2a2a3e,
  laser: 0x3a1a1a,
};

/** Tile symbols — non-directional types get a static string */
export const TILE_SYMBOLS = {
  gear_cw: '\u21BB',
  gear_ccw: '\u21BA',
  repair: '+',
  laser: '\u26A1',
  pit: '\u2716',
};

/** Directional arrow symbols for conveyors */
export const CONVEYOR_ARROWS = {
  north: '\u2191',
  south: '\u2193',
  east: '\u2192',
  west: '\u2190',
};

/** Double arrow symbols for express conveyors */
export const EXPRESS_CONVEYOR_ARROWS = {
  north: '\u21C8',
  south: '\u21CA',
  east: '\u21C9',
  west: '\u21C7',
};

/** Direction to radians (north = up = 0, clockwise) */
export const DIRECTION_RADIANS = {
  north: 0,
  east: Math.PI / 2,
  south: Math.PI,
  west: -Math.PI / 2,
};

/** Robot colors (hex numbers from ROBOT_COLORS string palette) */
export const ROBOT_COLORS_HEX = [
  0xe74c3c, // red
  0x3498db, // blue
  0x2ecc71, // green
  0xf39c12, // orange
  0x9b59b6, // purple
  0x1abc9c, // teal
  0xe67e22, // dark orange
  0xe84393, // pink
];

/** Max scale factor for auto-fit */
export const MAX_SCALE = 1.5;

/** Padding around board in pixels */
export const BOARD_PADDING = 16;
