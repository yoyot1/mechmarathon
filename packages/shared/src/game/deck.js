import { GAME } from '../constants.js';

/** Create the standard 84-card RoboRally deck */
export function createDeck() {
  const cards = [];
  let id = 0;

  function addCards(type, count, startPriority, step) {
    for (let i = 0; i < count; i++) {
      cards.push({ id: `card-${id++}`, type, priority: startPriority + i * step });
    }
  }

  // 18 Move 1 (priorities 490–660, step 10)
  addCards('move1', 18, 490, 10);
  // 12 Move 2 (priorities 670–780, step 10)
  addCards('move2', 12, 670, 10);
  // 6 Move 3 (priorities 790–840, step 10)
  addCards('move3', 6, 790, 10);
  // 6 Backup (priorities 430–480, step 10)
  addCards('backup', 6, 430, 10);
  // 18 Turn Right (priorities 80–420, step 20)
  addCards('turn_right', 18, 80, 20);
  // 18 Turn Left (priorities 70–410, step 20)
  addCards('turn_left', 18, 70, 20);
  // 6 U-Turn (priorities 10–60, step 10)
  addCards('u_turn', 6, 10, 10);

  return cards;
}

/** Fisher-Yates shuffle */
export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Deal cards to each player based on their health */
export function dealCards(deck, playerIds, healthMap) {
  const remaining = [...deck];
  const hands = new Map();

  for (const playerId of playerIds) {
    const health = healthMap.get(playerId) ?? GAME.STARTING_HEALTH;
    const cardCount = Math.max(1, GAME.CARDS_DEALT - (GAME.STARTING_HEALTH - health));
    const hand = remaining.splice(0, cardCount);
    hands.set(playerId, hand);
  }

  return { hands, remainingDeck: remaining };
}
