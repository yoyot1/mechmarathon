/**
 * Floor tile renderer — simple and enhanced modes.
 */
import { Graphics } from 'pixi.js';
import { registerRenderer } from './index.js';
import { TILE_COLORS } from '../constants.js';

function simple(container, tile, px, py, tileSize) {
  const g = new Graphics();
  g.rect(px, py, tileSize, tileSize).fill(TILE_COLORS.floor);
  container.addChild(g);
}

function enhanced(container, tile, px, py, tileSize) {
  const g = new Graphics();
  // Base fill
  g.rect(px, py, tileSize, tileSize).fill(TILE_COLORS.floor);

  // Subtle inner border / grid pattern
  const inset = 1;
  g.setStrokeStyle({ width: 0.5, color: 0x3a3a5e });
  g.rect(px + inset, py + inset, tileSize - inset * 2, tileSize - inset * 2).stroke();

  // Center dot for subtle grid reference
  g.circle(px + tileSize / 2, py + tileSize / 2, 0.5).fill({ color: 0x4a4a6e, alpha: 0.3 });

  container.addChild(g);
}

registerRenderer('floor', { simple, enhanced });
