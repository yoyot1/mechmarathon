/** Tile size in pixels */
export const TILE_SIZE = 48;

/** Gap between tiles in pixels */
export const TILE_GAP = 1;

/** Wall thickness in pixels */
export const WALL_THICKNESS = 4;

/** Wall color */
export const WALL_COLOR = 0xff8800;

/** One-way wall colors */
export const ONEWAY_WALL_ENTRY_COLOR = 0x2ecc71;
export const ONEWAY_WALL_EXIT_COLOR = 0xe67e22;

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
  trap_pit: 0x1a0a0a,
  conveyor: 0x0a0a0a,
  express_conveyor: 0x0a0a0a,
  gear: 0x3a2a1a,
  repair: 0x1a3a3a,
  wall: 0x4a4a4a,
  flag: 0x3a3a1a,
  oil_slick: 0x1a1a1a,
  water: 0x1a2a4a,
  current: 0x1a3a5a,
  portal: 0x4a1a5a,
  drain: 0x0a0a1a,
  radioactive_drain: 0x2a3a0a,
  teleporter: 0x2a4a6a,
  randomizer: 0x5a3a5a,
  repulsor: 0x6a2a2a,
  radiation: 0x3a4a0a,
  radioactive_waste: 0x4a3a0a,
  chop_shop: 0x3a3a3a,
  ledge: 0x4a4a2a,
  ramp: 0x3a4a3a,
};

/** Tile symbols — non-directional types get a static string */
export const TILE_SYMBOLS = {
  gear: '\u21BB',
  repair: '+',
  pit: '\u2716',
  trap_pit: '\u2716',
  oil_slick: '\u25CF',
  water: '\u2248',
  portal: '\u25C9',
  drain: '\u2B07',
  radioactive_drain: '\u2622',
  teleporter: '\u2726',
  randomizer: '?',
  repulsor: '\u2298',
  radiation: '\u2622',
  radioactive_waste: '\u2623',
  chop_shop: '\u2692',
  ledge: '\u2581',
};

/** Ramp arrow symbols (directional, reuse conveyor arrows) */
export const RAMP_ARROWS = {
  north: '\u25B3',
  south: '\u25BD',
  east: '\u25B7',
  west: '\u25C1',
};

/** Laser beam rendering */
export const LASER_BEAM_COLOR = 0xff0000;
export const LASER_BEAM_ALPHA = 0.3;
export const LASER_MOUNT_COLOR = 0xff2222;
export const LASER_MOUNT_SIZE = 6;

/** Pusher rendering */
export const PUSHER_COLOR = 0x8888cc;
export const PUSHER_SIZE = 8;

/** Overlay rendering */
export const FLAMER_COLOR = 0xff6600;
export const CRUSHER_COLOR = 0x888888;
export const OVERLAY_INDICATOR_SIZE = 6;

/** Phase indicator */
export const PHASE_DOT_COLOR = 0xf39c12;
export const PHASE_DOT_SIZE = 3;

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

/** Elevation indicator */
export const ELEVATION_COLOR = 0xccaa44;

/** Max scale factor for auto-fit */
export const MAX_SCALE = 1.5;

/** Padding around board in pixels */
export const BOARD_PADDING = 16;

/** Convert a 0xRRGGBB hex number to CSS color string */
export function hexToCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

/** CSS string versions of frequently used colors */
export const WALL_COLOR_CSS = hexToCss(WALL_COLOR);
export const ONEWAY_WALL_ENTRY_COLOR_CSS = hexToCss(ONEWAY_WALL_ENTRY_COLOR);
export const ONEWAY_WALL_EXIT_COLOR_CSS = hexToCss(ONEWAY_WALL_EXIT_COLOR);
export const LASER_BEAM_COLOR_CSS = hexToCss(LASER_BEAM_COLOR);
export const LASER_MOUNT_COLOR_CSS = hexToCss(LASER_MOUNT_COLOR);
export const PUSHER_COLOR_CSS = hexToCss(PUSHER_COLOR);
export const FLAMER_COLOR_CSS = hexToCss(FLAMER_COLOR);
export const CRUSHER_COLOR_CSS = hexToCss(CRUSHER_COLOR);
export const BOARD_BG_COLOR_CSS = hexToCss(BOARD_BG_COLOR);
export const PHASE_DOT_COLOR_CSS = hexToCss(PHASE_DOT_COLOR);
export const ELEVATION_COLOR_CSS = hexToCss(ELEVATION_COLOR);
