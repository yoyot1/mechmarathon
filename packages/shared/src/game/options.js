/**
 * Option card definitions and deck management.
 * Option cards are special abilities robots can hold and use.
 * Robots store their options in `robot.options` (array of option card IDs).
 */

/** All available option card types */
export const OPTION_CARDS = [
  {
    id: 'extra_memory',
    name: 'Extra Memory',
    description: 'Draw 1 extra card during programming phase.',
  },
  {
    id: 'gyroscopic_stabilizer',
    name: 'Gyroscopic Stabilizer',
    description: 'Immune to gear rotation.',
  },
  {
    id: 'rear_firing_laser',
    name: 'Rear-Firing Laser',
    description: 'Also fire laser backward each register.',
  },
  {
    id: 'ramming_gear',
    name: 'Ramming Gear',
    description: 'Deal 1 damage when pushing another robot.',
  },
  {
    id: 'ablative_coat',
    name: 'Ablative Coat',
    description: 'Absorb the next point of damage, then discard this card.',
  },
  {
    id: 'brakes',
    name: 'Brakes',
    description: 'May choose to not execute a movement card.',
  },
];

/** Create the option card deck (2 copies of each card) */
export function createOptionDeck() {
  const deck = [];
  for (const card of OPTION_CARDS) {
    deck.push(card.id, card.id);
  }
  return deck;
}

/** Shuffle an option deck (Fisher-Yates) */
export function shuffleOptionDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Draw the top card from the option deck. Returns { card, remainingDeck } or null if empty. */
export function drawOptionCard(deck) {
  if (!deck || deck.length === 0) return null;
  const remaining = [...deck];
  const card = remaining.shift();
  return { card, remainingDeck: remaining };
}

/** Check if a robot has a specific option card */
export function hasOption(robot, optionId) {
  return robot.options?.includes(optionId) ?? false;
}

/** Remove an option card from a robot (e.g. ablative coat after use) */
export function removeOption(robot, optionId) {
  if (!robot.options) return;
  const idx = robot.options.indexOf(optionId);
  if (idx >= 0) robot.options.splice(idx, 1);
}

/** Get the display info for an option card ID */
export function getOptionInfo(optionId) {
  return OPTION_CARDS.find((c) => c.id === optionId) ?? null;
}
