import type { Position, Direction } from '@mechmarathon/shared';
import { TILE_SIZE, TILE_GAP, DIRECTION_RADIANS } from './constants';

/** Convert board grid position to pixel center */
export function boardToPixel(pos: Position): { x: number; y: number } {
  const cellPitch = TILE_SIZE + TILE_GAP;
  return {
    x: pos.x * cellPitch + TILE_SIZE / 2,
    y: pos.y * cellPitch + TILE_SIZE / 2,
  };
}

/** Convert board grid position to pixel top-left corner */
export function boardToPixelTopLeft(pos: Position): { x: number; y: number } {
  const cellPitch = TILE_SIZE + TILE_GAP;
  return {
    x: pos.x * cellPitch,
    y: pos.y * cellPitch,
  };
}

/** Get radians for a direction */
export function directionToRadians(dir: Direction): number {
  return DIRECTION_RADIANS[dir] ?? 0;
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate between two angles (radians), taking the shortest path.
 * Handles wrapping around -PI/PI boundary.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

/** Ease in-out cubic */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
