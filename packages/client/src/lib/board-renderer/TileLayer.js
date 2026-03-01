import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  TILE_SIZE,
  TILE_GAP,
  TILE_COLORS,
  TILE_SYMBOLS,
  CONVEYOR_ARROWS,
  EXPRESS_CONVEYOR_ARROWS,
  WALL_THICKNESS,
  WALL_COLOR,
  BOARD_BG_COLOR,
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
        this._drawSymbol(tile, px, py);
      }
    }

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

  _drawSymbol(tile, px, py) {
    let symbol;

    if (tile.type === 'conveyor' && tile.direction) {
      symbol = CONVEYOR_ARROWS[tile.direction];
    } else if (tile.type === 'express_conveyor' && tile.direction) {
      symbol = EXPRESS_CONVEYOR_ARROWS[tile.direction];
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
