/**
 * Conveyor tile renderer — simple and enhanced modes.
 * Covers both 'conveyor' and 'express_conveyor' types.
 */
import { Graphics } from 'pixi.js';
import { registerRenderer } from './index.js';
import { drawChevrons } from './base.js';
import { TILE_COLORS } from '../constants.js';

function simpleConveyor(container, tile, px, py, tileSize) {
  const g = new Graphics();
  g.rect(px, py, tileSize, tileSize).fill(TILE_COLORS.conveyor);
  container.addChild(g);
}

function enhancedConveyor(container, tile, px, py, tileSize) {
  const g = new Graphics();

  // Base fill
  g.rect(px, py, tileSize, tileSize).fill(TILE_COLORS.conveyor);

  // Track rails (subtle lines on the edges perpendicular to direction)
  const railColor = 0x2a5a2a;
  const railW = 2;
  if (tile.direction === 'north' || tile.direction === 'south') {
    g.rect(px, py, railW, tileSize).fill(railColor);
    g.rect(px + tileSize - railW, py, railW, tileSize).fill(railColor);
  } else {
    g.rect(px, py, tileSize, railW).fill(railColor);
    g.rect(px, py + tileSize - railW, tileSize, railW).fill(railColor);
  }

  // Chevron arrows indicating direction
  if (tile.direction) {
    drawChevrons(g, px + tileSize / 2, py + tileSize / 2, tile.direction, 3, tileSize * 0.7, 0x66cc66);
  }

  container.addChild(g);
}

function simpleExpress(container, tile, px, py, tileSize) {
  const g = new Graphics();
  g.rect(px, py, tileSize, tileSize).fill(TILE_COLORS.express_conveyor);
  container.addChild(g);
}

function enhancedExpress(container, tile, px, py, tileSize) {
  const g = new Graphics();

  // Base fill
  g.rect(px, py, tileSize, tileSize).fill(TILE_COLORS.express_conveyor);

  // Track rails
  const railColor = 0x5a5a2a;
  const railW = 2;
  if (tile.direction === 'north' || tile.direction === 'south') {
    g.rect(px, py, railW, tileSize).fill(railColor);
    g.rect(px + tileSize - railW, py, railW, tileSize).fill(railColor);
  } else {
    g.rect(px, py, tileSize, railW).fill(railColor);
    g.rect(px, py + tileSize - railW, tileSize, railW).fill(railColor);
  }

  // Double chevrons for express
  if (tile.direction) {
    drawChevrons(g, px + tileSize / 2, py + tileSize / 2, tile.direction, 4, tileSize * 0.7, 0xcccc44);
  }

  container.addChild(g);
}

registerRenderer('conveyor', { simple: simpleConveyor, enhanced: enhancedConveyor });
registerRenderer('express_conveyor', { simple: simpleExpress, enhanced: enhancedExpress });
