/**
 * Pit tile renderer.
 */
import { Graphics } from 'pixi.js';
import { registerRenderer } from './index.js';
import { drawHazardHatch } from './base.js';
import { TILE_COLORS } from '../constants.js';

function renderPit(container, tile, px, py, tileSize) {
  const g = new Graphics();

  // Dark outer fill
  g.rect(px, py, tileSize, tileSize).fill(TILE_COLORS.pit);

  // Gradient-like concentric rects getting darker toward center
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const inset = 3 + i * 3;
    const alpha = 0.15 + i * 0.1;
    g.rect(px + inset, py + inset, tileSize - inset * 2, tileSize - inset * 2)
      .fill({ color: 0x000000, alpha });
  }

  // Diagonal hatch lines for hazard pattern
  drawHazardHatch(g, px + 2, py + 2, tileSize - 4, tileSize - 4, 0x880000);

  container.addChild(g);
}

registerRenderer('pit', renderPit);
registerRenderer('trap_pit', renderPit);
