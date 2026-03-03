import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  TILE_SIZE,
  TILE_GAP,
  TILE_COLORS,
  TILE_SYMBOLS,
  CONVEYOR_ARROWS,
  EXPRESS_CONVEYOR_ARROWS,
  RAMP_ARROWS,
  WALL_THICKNESS,
  WALL_COLOR,
  BOARD_BG_COLOR,
  LASER_BEAM_COLOR,
  LASER_BEAM_ALPHA,
  LASER_MOUNT_COLOR,
  LASER_MOUNT_SIZE,
  PUSHER_COLOR,
  PUSHER_SIZE,
  FLAMER_COLOR,
  CRUSHER_COLOR,
  OVERLAY_INDICATOR_SIZE,
  PHASE_DOT_COLOR,
  PHASE_DOT_SIZE,
  ONEWAY_WALL_ENTRY_COLOR,
  ONEWAY_WALL_EXIT_COLOR,
  ELEVATION_COLOR,
} from './constants.js';

const SYMBOL_STYLE = new TextStyle({
  fontSize: 16,
  fill: 0xffffff,
  fontFamily: 'sans-serif',
});

const CHECKPOINT_STYLE = new TextStyle({
  fontSize: 10,
  fill: 0xffd700,
  fontWeight: 'bold',
  fontFamily: 'sans-serif',
});

const PHASE_LABEL_STYLE = new TextStyle({
  fontSize: 6,
  fill: 0xf39c12,
  fontFamily: 'sans-serif',
});

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const DIR_DELTA = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };

export class TileLayer {
  constructor() {
    this.container = new Container();
  }

  build(board, checkpoints) {
    this.container.removeChildren();

    const cellPitch = TILE_SIZE + TILE_GAP;
    const totalW = board.width * cellPitch - TILE_GAP;
    const totalH = board.height * cellPitch - TILE_GAP;

    // Background
    const bg = new Graphics();
    bg.rect(-2, -2, totalW + 4, totalH + 4).fill(BOARD_BG_COLOR);
    this.container.addChild(bg);

    // Tiles
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const tile = board.tiles[y]?.[x];
        if (!tile) continue;

        const px = x * cellPitch;
        const py = y * cellPitch;

        this._drawTile(tile, px, py);
        this._drawWalls(tile, px, py);
        this._drawOneWayWalls(tile, px, py);
        this._drawSymbol(tile, px, py);
        this._drawSideFeatures(tile, px, py);
        this._drawOverlays(tile, px, py);
        this._drawPhaseIndicators(tile, px, py);
        this._drawGroupLabel(tile, px, py);
        this._drawElevationIndicator(tile, px, py);
      }
    }

    // Laser beams (drawn after all tiles so they render on top)
    this._drawAllLaserBeams(board, cellPitch);

    // Checkpoint overlays
    for (const cp of checkpoints) {
      const px = cp.position.x * cellPitch;
      const py = cp.position.y * cellPitch;
      this._drawCheckpoint(cp.number, px, py);
    }
  }

  _drawTile(tile, px, py) {
    const g = new Graphics();
    g.rect(px, py, TILE_SIZE, TILE_SIZE).fill(TILE_COLORS[tile.type] ?? TILE_COLORS.floor);
    this.container.addChild(g);
  }

  _drawWalls(tile, px, py) {
    if (!tile.walls?.length) return;

    const g = new Graphics();
    for (const wall of tile.walls) {
      g.setStrokeStyle({ width: WALL_THICKNESS, color: WALL_COLOR });
      const coords = this._wallLine(wall, px, py);
      g.moveTo(coords.x1, coords.y1).lineTo(coords.x2, coords.y2).stroke();
    }
    this.container.addChild(g);
  }

  _wallLine(dir, px, py) {
    switch (dir) {
      case 'north':
        return { x1: px, y1: py, x2: px + TILE_SIZE, y2: py };
      case 'south':
        return { x1: px, y1: py + TILE_SIZE, x2: px + TILE_SIZE, y2: py + TILE_SIZE };
      case 'east':
        return { x1: px + TILE_SIZE, y1: py, x2: px + TILE_SIZE, y2: py + TILE_SIZE };
      case 'west':
        return { x1: px, y1: py, x2: px, y2: py + TILE_SIZE };
    }
  }

  /** Draw one-way walls as dashed lines with directional color */
  _drawOneWayWalls(tile, px, py) {
    if (!tile.oneWayWalls?.length) return;

    for (const ow of tile.oneWayWalls) {
      const color = ow.blocks === 'entry' ? ONEWAY_WALL_ENTRY_COLOR : ONEWAY_WALL_EXIT_COLOR;
      const coords = this._wallLine(ow.side, px, py);

      // Draw dashed line segments
      const g = new Graphics();
      const dashLen = 4;
      const gapLen = 3;
      const dx = coords.x2 - coords.x1;
      const dy = coords.y2 - coords.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / len;
      const ny = dy / len;

      let pos = 0;
      g.setStrokeStyle({ width: WALL_THICKNESS - 1, color });
      while (pos < len) {
        const segEnd = Math.min(pos + dashLen, len);
        g.moveTo(coords.x1 + nx * pos, coords.y1 + ny * pos)
          .lineTo(coords.x1 + nx * segEnd, coords.y1 + ny * segEnd)
          .stroke();
        pos = segEnd + gapLen;
      }
      this.container.addChild(g);
    }
  }

  _drawSymbol(tile, px, py) {
    let symbol;

    if (tile.type === 'conveyor' && tile.direction) {
      symbol = CONVEYOR_ARROWS[tile.direction];
    } else if (tile.type === 'express_conveyor' && tile.direction) {
      symbol = EXPRESS_CONVEYOR_ARROWS[tile.direction];
    } else if (tile.type === 'current' && tile.direction) {
      symbol = CONVEYOR_ARROWS[tile.direction];
    } else if (tile.type === 'ramp' && tile.direction) {
      symbol = RAMP_ARROWS[tile.direction];
    } else {
      symbol = TILE_SYMBOLS[tile.type];
    }

    if (!symbol) return;

    const text = new Text({ text: symbol, style: SYMBOL_STYLE });
    text.anchor.set(0.5, 0.5);
    text.x = px + TILE_SIZE / 2;
    text.y = py + TILE_SIZE / 2;
    text.alpha = 0.4;
    this.container.addChild(text);
  }

  _drawSideFeatures(tile, px, py) {
    if (!tile.sideFeatures?.length) return;

    for (const feature of tile.sideFeatures) {
      if (feature.type === 'laser') {
        this._drawLaserMount(feature, px, py);
      } else if (feature.type === 'pusher') {
        this._drawPusherMount(feature, px, py);
      }
    }
  }

  /** Draw a small laser mount indicator on the tile edge */
  _drawLaserMount(feature, px, py) {
    const g = new Graphics();
    const s = LASER_MOUNT_SIZE;
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;

    let mx, my;
    switch (feature.side) {
      case 'north': mx = cx; my = py + s / 2; break;
      case 'south': mx = cx; my = py + TILE_SIZE - s / 2; break;
      case 'east':  mx = px + TILE_SIZE - s / 2; my = cy; break;
      case 'west':  mx = px + s / 2; my = cy; break;
    }

    g.circle(mx, my, s / 2).fill(LASER_MOUNT_COLOR);

    // Draw strength number for multi-strength lasers
    const strength = feature.strength || 1;
    if (strength > 1) {
      const dotStyle = new TextStyle({ fontSize: 7, fill: 0xffffff, fontFamily: 'sans-serif' });
      const label = new Text({ text: String(strength), style: dotStyle });
      label.anchor.set(0.5, 0.5);
      label.x = mx;
      label.y = my;
      this.container.addChild(label);
    }

    this.container.addChild(g);
  }

  /** Draw a pusher indicator on the tile edge — a rectangular bar with arrow */
  _drawPusherMount(feature, px, py) {
    const g = new Graphics();
    const s = PUSHER_SIZE;
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;

    // Draw a small rectangle on the mount side
    switch (feature.side) {
      case 'north':
        g.rect(cx - s, py, s * 2, s / 2).fill(PUSHER_COLOR);
        break;
      case 'south':
        g.rect(cx - s, py + TILE_SIZE - s / 2, s * 2, s / 2).fill(PUSHER_COLOR);
        break;
      case 'east':
        g.rect(px + TILE_SIZE - s / 2, cy - s, s / 2, s * 2).fill(PUSHER_COLOR);
        break;
      case 'west':
        g.rect(px, cy - s, s / 2, s * 2).fill(PUSHER_COLOR);
        break;
    }

    this.container.addChild(g);

    // Draw phase numbers next to pusher
    if (feature.phases?.length) {
      this._drawFeaturePhases(feature.phases, feature.side, px, py);
    }
  }

  /** Draw overlay indicators on tile */
  _drawOverlays(tile, px, py) {
    if (!tile.overlays?.length) return;

    for (const overlay of tile.overlays) {
      const color = overlay.type === 'flamer' ? FLAMER_COLOR : CRUSHER_COLOR;
      const g = new Graphics();
      const s = OVERLAY_INDICATOR_SIZE;

      // Draw a small diamond in the bottom-left area
      const ox = px + s + 2;
      const oy = py + TILE_SIZE - s - 2;

      g.moveTo(ox, oy - s / 2)
        .lineTo(ox + s / 2, oy)
        .lineTo(ox, oy + s / 2)
        .lineTo(ox - s / 2, oy)
        .closePath()
        .fill({ color, alpha: 0.7 });

      this.container.addChild(g);

      // Draw phase numbers
      if (overlay.phases?.length) {
        const label = new Text({ text: overlay.phases.join(''), style: PHASE_LABEL_STYLE });
        label.anchor.set(0, 0.5);
        label.x = ox + s / 2 + 2;
        label.y = oy;
        label.alpha = 0.8;
        this.container.addChild(label);
      }
    }
  }

  /** Draw phase indicators for ground-level phase elements (trap_pit) */
  _drawPhaseIndicators(tile, px, py) {
    if (!tile.phases?.length) return;

    // Small phase number text in bottom-right corner
    const label = new Text({ text: tile.phases.join(''), style: PHASE_LABEL_STYLE });
    label.anchor.set(1, 1);
    label.x = px + TILE_SIZE - 2;
    label.y = py + TILE_SIZE - 2;
    label.alpha = 0.8;
    this.container.addChild(label);
  }

  /** Draw portal group label on portal tiles */
  _drawGroupLabel(tile, px, py) {
    if (!tile.group) return;

    const style = new TextStyle({ fontSize: 12, fill: 0xffffff, fontWeight: 'bold', fontFamily: 'sans-serif' });
    const label = new Text({ text: tile.group, style });
    label.anchor.set(0, 0);
    label.x = px + 2;
    label.y = py + 2;
    label.alpha = 0.7;
    this.container.addChild(label);
  }

  /** Draw elevation indicator (small number badge in top-left) for tiles with elevation > 0 */
  _drawElevationIndicator(tile, px, py) {
    if (!tile.elevation || tile.elevation <= 0) return;

    const style = new TextStyle({ fontSize: 8, fill: ELEVATION_COLOR, fontWeight: 'bold', fontFamily: 'sans-serif' });
    const label = new Text({ text: `E${tile.elevation}`, style });
    label.anchor.set(1, 0);
    label.x = px + TILE_SIZE - 2;
    label.y = py + 2;
    label.alpha = 0.8;
    this.container.addChild(label);
  }

  /** Draw phase numbers near a side feature */
  _drawFeaturePhases(phases, side, px, py) {
    const label = new Text({ text: phases.join(''), style: PHASE_LABEL_STYLE });
    label.alpha = 0.8;

    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;

    switch (side) {
      case 'north':
        label.anchor.set(0.5, 0);
        label.x = cx;
        label.y = py + PUSHER_SIZE / 2 + 1;
        break;
      case 'south':
        label.anchor.set(0.5, 1);
        label.x = cx;
        label.y = py + TILE_SIZE - PUSHER_SIZE / 2 - 1;
        break;
      case 'east':
        label.anchor.set(1, 0.5);
        label.x = px + TILE_SIZE - PUSHER_SIZE / 2 - 1;
        label.y = cy;
        break;
      case 'west':
        label.anchor.set(0, 0.5);
        label.x = px + PUSHER_SIZE / 2 + 1;
        label.y = cy;
        break;
    }

    this.container.addChild(label);
  }

  /** Draw all laser beams across the board */
  _drawAllLaserBeams(board, cellPitch) {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const tile = board.tiles[y]?.[x];
        if (!tile?.sideFeatures) continue;

        for (const feature of tile.sideFeatures) {
          if (feature.type === 'laser') {
            this._drawLaserBeam(x, y, feature, board, cellPitch);
          }
        }
      }
    }
  }

  /** Draw a laser beam from mount point to nearest wall */
  _drawLaserBeam(startX, startY, feature, board, cellPitch) {
    const fireDir = OPPOSITE[feature.side];
    const delta = DIR_DELTA[fireDir];
    const strength = feature.strength || 1;

    // Starting pixel position (center of the mount side)
    const startPx = startX * cellPitch + TILE_SIZE / 2;
    const startPy = startY * cellPitch + TILE_SIZE / 2;

    // Walk in fire direction until hitting a wall or edge
    let cx = startX;
    let cy = startY;
    let endPx = startPx;
    let endPy = startPy;

    while (true) {
      // Check wall on current cell leaving in direction
      const currentTile = board.tiles[cy]?.[cx];
      if (currentTile?.walls?.includes(fireDir)) break;
      if (currentTile?.oneWayWalls?.some((ow) => ow.side === fireDir && ow.blocks === 'exit')) break;

      const nx = cx + delta.x;
      const ny = cy + delta.y;

      if (nx < 0 || nx >= board.width || ny < 0 || ny >= board.height) {
        // Beam reaches board edge
        endPx = nx * cellPitch + TILE_SIZE / 2;
        endPy = ny * cellPitch + TILE_SIZE / 2;
        break;
      }

      // Check wall on destination cell entering from opposite direction
      const enterSide = OPPOSITE[fireDir];
      const nextTile = board.tiles[ny]?.[nx];
      if (nextTile?.walls?.includes(enterSide)) break;
      if (nextTile?.oneWayWalls?.some((ow) => ow.side === enterSide && ow.blocks === 'entry')) break;

      endPx = nx * cellPitch + TILE_SIZE / 2;
      endPy = ny * cellPitch + TILE_SIZE / 2;
      cx = nx;
      cy = ny;
    }

    // Draw the beam line
    const g = new Graphics();
    const beamWidth = strength;
    g.setStrokeStyle({ width: beamWidth, color: LASER_BEAM_COLOR });
    g.moveTo(startPx, startPy).lineTo(endPx, endPy).stroke();
    g.alpha = LASER_BEAM_ALPHA;
    this.container.addChild(g);
  }

  _drawCheckpoint(num, px, py) {
    // Badge background
    const badge = new Graphics();
    const badgeSize = 16;
    const bx = px + TILE_SIZE - badgeSize - 1;
    const by = py + 1;
    badge.circle(bx + badgeSize / 2, by + badgeSize / 2, badgeSize / 2).fill({ color: 0x000000, alpha: 0.6 });
    this.container.addChild(badge);

    // Number
    const text = new Text({ text: String(num), style: CHECKPOINT_STYLE });
    text.anchor.set(0.5, 0.5);
    text.x = bx + badgeSize / 2;
    text.y = by + badgeSize / 2;
    this.container.addChild(text);
  }
}
