/**
 * DOM-based tile layer — replaces the PixiJS TileLayer.
 *
 * Renders the board as a grid of absolutely-positioned <div> cells,
 * each containing stacked <img> layers for tiles, plus SVG overlays
 * for laser beams and DOM elements for flags/walls/features.
 */
import {
  TILE_SIZE,
  TILE_GAP,
  TILE_COLORS,
  TILE_SYMBOLS,
  CONVEYOR_ARROWS,
  EXPRESS_CONVEYOR_ARROWS,
  RAMP_ARROWS,
  WALL_THICKNESS,
  WALL_COLOR_CSS,
  ONEWAY_WALL_ENTRY_COLOR_CSS,
  ONEWAY_WALL_EXIT_COLOR_CSS,
  BOARD_BG_COLOR_CSS,
  LASER_BEAM_COLOR_CSS,
  LASER_BEAM_ALPHA,
  LASER_MOUNT_COLOR_CSS,
  LASER_MOUNT_SIZE,
  PUSHER_COLOR_CSS,
  PUSHER_SIZE,
  FLAMER_COLOR_CSS,
  CRUSHER_COLOR_CSS,
  OVERLAY_INDICATOR_SIZE,
  PHASE_DOT_COLOR_CSS,
  ELEVATION_COLOR_CSS,
  hexToCss,
} from './constants.js';
import { renderTile, renderFloorBase } from './tile-renderer.js';
import { hasAsset } from './tile-assets.js';

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const DIR_DELTA = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };

// Tiles that ARE the base (no floor drawn underneath)
const BASE_TILES = new Set(['floor', 'pit', 'trap_pit', 'drain', 'radioactive_drain']);

export class DomTileLayer {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tile-layer';
    this.tileCells = []; // 2D array [y][x] of tile cell divs
  }

  build(board, flags) {
    this.element.innerHTML = '';
    this.tileCells = [];

    const cellPitch = TILE_SIZE + TILE_GAP;
    const totalW = board.width * cellPitch - TILE_GAP;
    const totalH = board.height * cellPitch - TILE_GAP;

    this.element.style.width = totalW + 'px';
    this.element.style.height = totalH + 'px';
    this.element.style.backgroundColor = BOARD_BG_COLOR_CSS;

    // Build tile cells
    for (let y = 0; y < board.height; y++) {
      this.tileCells[y] = [];
      for (let x = 0; x < board.width; x++) {
        const tile = board.tiles[y]?.[x];
        if (!tile) {
          this.tileCells[y][x] = null;
          continue;
        }
        const cell = this._buildTileCell(tile, x, y, cellPitch);
        this.tileCells[y][x] = cell;
        this.element.appendChild(cell);
      }
    }

    // Laser beams (SVG overlay)
    this._drawAllLaserBeams(board, cellPitch, totalW, totalH);

    // Flag badges
    for (const fl of flags) {
      this._drawFlag(fl.number, fl.position.x, fl.position.y, cellPitch);
    }
  }

  updateTile(board, x, y, flags) {
    const tile = board.tiles[y]?.[x];
    if (!tile) return;

    if (!this.tileCells[y]) this.tileCells[y] = [];

    const old = this.tileCells[y][x];
    const cellPitch = TILE_SIZE + TILE_GAP;
    const cell = this._buildTileCell(tile, x, y, cellPitch);

    // Update reference immediately to prevent races on rapid updates
    this.tileCells[y][x] = cell;

    // Pre-decode all <img> elements before swapping into the DOM.
    // This eliminates flicker caused by async SVG decode — the old tile
    // stays visible until the new tile's images are fully rendered.
    const imgs = cell.querySelectorAll('img');
    const decodePromises = Array.from(imgs).map((img) =>
      img.decode().catch(() => {}), // cached/already-decoded images may reject
    );

    if (decodePromises.length === 0 || !old) {
      // No images to decode or no old cell to hold — swap immediately
      this.element.appendChild(cell);
      if (old) old.remove();
    } else {
      Promise.all(decodePromises).then(() => {
        this.element.appendChild(cell);
        if (old.parentNode) old.remove();
      });
    }
  }

  _buildTileCell(tile, x, y, cellPitch) {
    const px = x * cellPitch;
    const py = y * cellPitch;

    const cell = document.createElement('div');
    cell.className = 'tile-cell';
    cell.style.left = px + 'px';
    cell.style.top = py + 'px';
    cell.style.width = TILE_SIZE + 'px';
    cell.style.height = TILE_SIZE + 'px';

    // Floor base underneath non-base tiles
    if (!BASE_TILES.has(tile.type)) {
      cell.appendChild(renderFloorBase());
    }

    // Main tile image
    cell.appendChild(renderTile(tile));

    // Walls
    this._addWalls(tile, cell);
    this._addOneWayWalls(tile, cell);

    // Text symbol (for tiles without SVG renderer)
    this._addSymbol(tile, cell);

    // Side features (laser mounts, pushers)
    this._addSideFeatures(tile, cell);

    // Overlays (flamers, crushers)
    this._addOverlays(tile, cell);

    // Phase indicators
    this._addPhaseIndicators(tile, cell);

    // Group label (portals)
    this._addGroupLabel(tile, cell);

    // Elevation indicator
    this._addElevationIndicator(tile, cell);

    return cell;
  }

  _addWalls(tile, cell) {
    if (!tile.walls?.length) return;

    for (const dir of tile.walls) {
      const wall = document.createElement('div');
      wall.className = `tile-wall tile-wall-${dir}`;
      cell.appendChild(wall);
    }
  }

  _addOneWayWalls(tile, cell) {
    if (!tile.oneWayWalls?.length) return;

    for (const ow of tile.oneWayWalls) {
      const wall = document.createElement('div');
      const color = ow.blocks === 'entry' ? ONEWAY_WALL_ENTRY_COLOR_CSS : ONEWAY_WALL_EXIT_COLOR_CSS;
      wall.className = `tile-wall tile-wall-oneway tile-wall-${ow.side}`;
      wall.style.borderColor = color;
      cell.appendChild(wall);
    }
  }

  _addSymbol(tile, cell) {
    // Skip symbols for tiles with SVG assets — the artwork is sufficient
    const type = tile.type;
    if (type === 'conveyor' || type === 'express_conveyor') return;
    if (hasAsset(type)) return;

    let symbol;

    if (type === 'current' && tile.direction) {
      symbol = CONVEYOR_ARROWS[tile.direction];
    } else if (type === 'ramp' && tile.direction) {
      symbol = RAMP_ARROWS[tile.direction];
    } else {
      symbol = TILE_SYMBOLS[type];
    }

    if (!symbol) return;

    const span = document.createElement('span');
    span.className = 'tile-symbol';
    span.textContent = symbol;
    cell.appendChild(span);
  }

  _addSideFeatures(tile, cell) {
    if (!tile.sideFeatures?.length) return;

    for (const feature of tile.sideFeatures) {
      if (feature.type === 'laser') {
        this._addLaserMount(feature, cell);
      } else if (feature.type === 'pusher') {
        this._addPusherMount(feature, cell);
      }
    }
  }

  _addLaserMount(feature, cell) {
    const mount = document.createElement('div');
    mount.className = `laser-mount laser-mount-${feature.side}`;

    const strength = feature.strength || 1;
    if (strength > 1) {
      mount.textContent = String(strength);
    }

    cell.appendChild(mount);

    if (feature.phases?.length) {
      this._addFeaturePhases(feature.phases, feature.side, cell);
    }
  }

  _addPusherMount(feature, cell) {
    const mount = document.createElement('div');
    mount.className = `pusher-mount pusher-mount-${feature.side}`;
    cell.appendChild(mount);

    if (feature.phases?.length) {
      this._addFeaturePhases(feature.phases, feature.side, cell);
    }
  }

  _addFeaturePhases(phases, side, cell) {
    const label = document.createElement('span');
    label.className = `feature-phases feature-phases-${side}`;
    label.textContent = phases.join('');
    cell.appendChild(label);
  }

  _addOverlays(tile, cell) {
    if (!tile.overlays?.length) return;

    for (const overlay of tile.overlays) {
      const indicator = document.createElement('div');
      const color = overlay.type === 'flamer' ? FLAMER_COLOR_CSS : CRUSHER_COLOR_CSS;
      indicator.className = 'overlay-indicator';
      indicator.style.borderColor = color;

      if (overlay.phases?.length) {
        const label = document.createElement('span');
        label.className = 'overlay-phases';
        label.textContent = overlay.phases.join('');
        indicator.appendChild(label);
      }

      cell.appendChild(indicator);
    }
  }

  _addPhaseIndicators(tile, cell) {
    if (!tile.phases?.length) return;

    const label = document.createElement('span');
    label.className = 'tile-phases';
    label.textContent = tile.phases.join('');
    cell.appendChild(label);
  }

  _addGroupLabel(tile, cell) {
    if (!tile.group) return;

    const label = document.createElement('span');
    label.className = 'tile-group';
    label.textContent = tile.group;
    cell.appendChild(label);
  }

  _addElevationIndicator(tile, cell) {
    if (!tile.elevation || tile.elevation <= 0) return;

    const label = document.createElement('span');
    label.className = 'tile-elevation';
    label.textContent = `E${tile.elevation}`;
    cell.appendChild(label);
  }

  _drawAllLaserBeams(board, cellPitch, totalW, totalH) {
    const beams = [];

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const tile = board.tiles[y]?.[x];
        if (!tile?.sideFeatures) continue;

        for (const feature of tile.sideFeatures) {
          if (feature.type === 'laser') {
            const beam = this._traceLaserBeam(x, y, feature, board, cellPitch);
            if (beam) beams.push(beam);
          }
        }
      }
    }

    if (beams.length === 0) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'laser-overlay');
    svg.setAttribute('width', totalW);
    svg.setAttribute('height', totalH);
    svg.style.width = totalW + 'px';
    svg.style.height = totalH + 'px';

    for (const beam of beams) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', beam.x1);
      line.setAttribute('y1', beam.y1);
      line.setAttribute('x2', beam.x2);
      line.setAttribute('y2', beam.y2);
      line.setAttribute('stroke', LASER_BEAM_COLOR_CSS);
      line.setAttribute('stroke-width', beam.strength);
      line.setAttribute('opacity', LASER_BEAM_ALPHA);
      svg.appendChild(line);
    }

    this.element.appendChild(svg);
  }

  _traceLaserBeam(startX, startY, feature, board, cellPitch) {
    const fireDir = OPPOSITE[feature.side];
    const delta = DIR_DELTA[fireDir];
    const strength = feature.strength || 1;

    const startPx = startX * cellPitch + TILE_SIZE / 2;
    const startPy = startY * cellPitch + TILE_SIZE / 2;

    let cx = startX, cy = startY;
    let endPx = startPx, endPy = startPy;

    while (true) {
      const currentTile = board.tiles[cy]?.[cx];
      if (currentTile?.walls?.includes(fireDir)) break;
      if (currentTile?.oneWayWalls?.some((ow) => ow.side === fireDir && ow.blocks === 'exit')) break;

      const nx = cx + delta.x;
      const ny = cy + delta.y;

      if (nx < 0 || nx >= board.width || ny < 0 || ny >= board.height) {
        endPx = nx * cellPitch + TILE_SIZE / 2;
        endPy = ny * cellPitch + TILE_SIZE / 2;
        break;
      }

      const enterSide = OPPOSITE[fireDir];
      const nextTile = board.tiles[ny]?.[nx];
      if (nextTile?.walls?.includes(enterSide)) break;
      if (nextTile?.oneWayWalls?.some((ow) => ow.side === enterSide && ow.blocks === 'entry')) break;

      endPx = nx * cellPitch + TILE_SIZE / 2;
      endPy = ny * cellPitch + TILE_SIZE / 2;
      cx = nx;
      cy = ny;
    }

    return { x1: startPx, y1: startPy, x2: endPx, y2: endPy, strength };
  }

  _drawFlag(num, x, y, cellPitch) {
    const px = x * cellPitch;
    const py = y * cellPitch;

    const badge = document.createElement('div');
    badge.className = 'flag-badge';
    badge.style.left = (px + TILE_SIZE - 17) + 'px';
    badge.style.top = (py + 1) + 'px';
    badge.textContent = String(num);

    this.element.appendChild(badge);
  }
}
