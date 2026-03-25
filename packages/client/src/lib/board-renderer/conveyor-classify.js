/**
 * Conveyor tile classification utilities.
 *
 * Classifies conveyors as straight, curve, or merge based on their
 * entry directions relative to their exit direction.
 */

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

export function classifyConveyor(tile) {
  const curveEntries = getCurveEntries(tile);
  const straight = hasStraightEntry(tile);
  if (curveEntries.length === 0) return 'straight';
  if (curveEntries.length === 1 && !straight) return 'curve';
  return 'merge';
}

export function getCurveEntries(tile) {
  if (!tile.entry || !Array.isArray(tile.entry) || !tile.direction) return [];
  return tile.entry.filter(e => e !== OPPOSITE[tile.direction]);
}

export function hasStraightEntry(tile) {
  if (!tile.entry || !Array.isArray(tile.entry) || !tile.direction) return false;
  return tile.entry.includes(OPPOSITE[tile.direction]);
}
