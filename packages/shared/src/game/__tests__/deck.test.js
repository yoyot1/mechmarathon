import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck, dealCards } from '../deck.js';
import { GAME } from '../../constants.js';

describe('createDeck', () => {
  const deck = createDeck();

  it('creates exactly 84 cards', () => {
    expect(deck).toHaveLength(84);
  });

  it('has correct type distribution', () => {
    const counts = {};
    for (const card of deck) {
      counts[card.type] = (counts[card.type] || 0) + 1;
    }
    expect(counts.move1).toBe(18);
    expect(counts.move2).toBe(12);
    expect(counts.move3).toBe(6);
    expect(counts.backup).toBe(6);
    expect(counts.turn_right).toBe(18);
    expect(counts.turn_left).toBe(18);
    expect(counts.u_turn).toBe(6);
  });

  it('has unique IDs for all cards', () => {
    const ids = deck.map((c) => c.id);
    expect(new Set(ids).size).toBe(84);
  });

  it('has unique priorities for all cards', () => {
    const priorities = deck.map((c) => c.priority);
    expect(new Set(priorities).size).toBe(84);
  });

  it('move1 cards have priorities 490-660', () => {
    const move1 = deck.filter((c) => c.type === 'move1');
    const priorities = move1.map((c) => c.priority).sort((a, b) => a - b);
    expect(priorities[0]).toBe(490);
    expect(priorities[priorities.length - 1]).toBe(660);
  });

  it('u_turn cards have lowest priorities (10-60)', () => {
    const uturns = deck.filter((c) => c.type === 'u_turn');
    const priorities = uturns.map((c) => c.priority).sort((a, b) => a - b);
    expect(priorities[0]).toBe(10);
    expect(priorities[priorities.length - 1]).toBe(60);
  });

  it('move3 cards have highest priorities (790-840)', () => {
    const move3 = deck.filter((c) => c.type === 'move3');
    const priorities = move3.map((c) => c.priority).sort((a, b) => a - b);
    expect(priorities[0]).toBe(790);
    expect(priorities[priorities.length - 1]).toBe(840);
  });
});

describe('shuffleDeck', () => {
  it('returns a new array of same length', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(84);
    expect(shuffled).not.toBe(deck); // different reference
  });

  it('contains the same cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const originalIds = deck.map((c) => c.id).sort();
    const shuffledIds = shuffled.map((c) => c.id).sort();
    expect(shuffledIds).toEqual(originalIds);
  });

  it('does not mutate the original deck', () => {
    const deck = createDeck();
    const originalOrder = deck.map((c) => c.id);
    shuffleDeck(deck);
    expect(deck.map((c) => c.id)).toEqual(originalOrder);
  });
});

describe('dealCards', () => {
  it('deals 9 cards to healthy players', () => {
    const deck = createDeck();
    const playerIds = ['p1', 'p2'];
    const healthMap = new Map([
      ['p1', GAME.STARTING_HEALTH],
      ['p2', GAME.STARTING_HEALTH],
    ]);
    const { hands, remainingDeck } = dealCards(deck, playerIds, healthMap);
    expect(hands.get('p1')).toHaveLength(9);
    expect(hands.get('p2')).toHaveLength(9);
    expect(remainingDeck).toHaveLength(84 - 18);
  });

  it('deals fewer cards to damaged players', () => {
    const deck = createDeck();
    const playerIds = ['p1'];
    // Health 7 → 9 - (10 - 7) = 6 cards
    const healthMap = new Map([['p1', 7]]);
    const { hands } = dealCards(deck, playerIds, healthMap);
    expect(hands.get('p1')).toHaveLength(6);
  });

  it('deals minimum 1 card even at health 1', () => {
    const deck = createDeck();
    const playerIds = ['p1'];
    const healthMap = new Map([['p1', 1]]);
    const { hands } = dealCards(deck, playerIds, healthMap);
    expect(hands.get('p1').length).toBeGreaterThanOrEqual(1);
  });

  it('deals minimum 1 card at health 2', () => {
    const deck = createDeck();
    const playerIds = ['p1'];
    // Health 2 → 9 - (10 - 2) = 1 card
    const healthMap = new Map([['p1', 2]]);
    const { hands } = dealCards(deck, playerIds, healthMap);
    expect(hands.get('p1')).toHaveLength(1);
  });

  it('uses default health when player not in healthMap', () => {
    const deck = createDeck();
    const playerIds = ['p1'];
    const healthMap = new Map(); // empty
    const { hands } = dealCards(deck, playerIds, healthMap);
    expect(hands.get('p1')).toHaveLength(9);
  });

  it('deals unique cards (no card given to two players)', () => {
    const deck = createDeck();
    const playerIds = ['p1', 'p2', 'p3'];
    const healthMap = new Map([
      ['p1', 10],
      ['p2', 10],
      ['p3', 10],
    ]);
    const { hands } = dealCards(deck, playerIds, healthMap);
    const allDealt = [
      ...hands.get('p1'),
      ...hands.get('p2'),
      ...hands.get('p3'),
    ];
    const ids = allDealt.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
