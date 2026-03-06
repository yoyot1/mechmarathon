import { describe, it, expect } from 'vitest';
import {
  OPTION_CARDS,
  createOptionDeck,
  shuffleOptionDeck,
  drawOptionCard,
  hasOption,
  removeOption,
  getOptionInfo,
} from '../options.js';

describe('createOptionDeck', () => {
  it('creates 12 cards (2 copies of each)', () => {
    const deck = createOptionDeck();
    expect(deck).toHaveLength(12);
  });

  it('has exactly 2 of each option card ID', () => {
    const deck = createOptionDeck();
    const counts = {};
    for (const id of deck) {
      counts[id] = (counts[id] || 0) + 1;
    }
    for (const card of OPTION_CARDS) {
      expect(counts[card.id]).toBe(2);
    }
  });

  it('only contains valid option card IDs', () => {
    const deck = createOptionDeck();
    const validIds = OPTION_CARDS.map((c) => c.id);
    for (const id of deck) {
      expect(validIds).toContain(id);
    }
  });
});

describe('shuffleOptionDeck', () => {
  it('returns a new array of same length', () => {
    const deck = createOptionDeck();
    const shuffled = shuffleOptionDeck(deck);
    expect(shuffled).toHaveLength(12);
    expect(shuffled).not.toBe(deck);
  });

  it('contains the same cards', () => {
    const deck = createOptionDeck();
    const shuffled = shuffleOptionDeck(deck);
    expect([...shuffled].sort()).toEqual([...deck].sort());
  });

  it('does not mutate the original deck', () => {
    const deck = createOptionDeck();
    const original = [...deck];
    shuffleOptionDeck(deck);
    expect(deck).toEqual(original);
  });
});

describe('drawOptionCard', () => {
  it('returns the top card and remaining deck', () => {
    const deck = ['extra_memory', 'brakes', 'ramming_gear'];
    const result = drawOptionCard(deck);
    expect(result.card).toBe('extra_memory');
    expect(result.remainingDeck).toEqual(['brakes', 'ramming_gear']);
  });

  it('returns null for empty deck', () => {
    expect(drawOptionCard([])).toBeNull();
  });

  it('returns null for null/undefined deck', () => {
    expect(drawOptionCard(null)).toBeNull();
    expect(drawOptionCard(undefined)).toBeNull();
  });

  it('does not mutate the original deck', () => {
    const deck = ['extra_memory', 'brakes'];
    drawOptionCard(deck);
    expect(deck).toEqual(['extra_memory', 'brakes']);
  });
});

describe('hasOption', () => {
  it('returns true when robot has the option', () => {
    const robot = { options: ['extra_memory', 'brakes'] };
    expect(hasOption(robot, 'extra_memory')).toBe(true);
    expect(hasOption(robot, 'brakes')).toBe(true);
  });

  it('returns false when robot does not have the option', () => {
    const robot = { options: ['extra_memory'] };
    expect(hasOption(robot, 'brakes')).toBe(false);
  });

  it('returns false when robot has no options array', () => {
    const robot = {};
    expect(hasOption(robot, 'extra_memory')).toBe(false);
  });

  it('returns false when options is null', () => {
    const robot = { options: null };
    expect(hasOption(robot, 'extra_memory')).toBe(false);
  });
});

describe('removeOption', () => {
  it('removes the option from robot', () => {
    const robot = { options: ['extra_memory', 'brakes'] };
    removeOption(robot, 'extra_memory');
    expect(robot.options).toEqual(['brakes']);
  });

  it('does nothing when option not found', () => {
    const robot = { options: ['extra_memory'] };
    removeOption(robot, 'brakes');
    expect(robot.options).toEqual(['extra_memory']);
  });

  it('does nothing when robot has no options', () => {
    const robot = {};
    removeOption(robot, 'extra_memory');
    expect(robot.options).toBeUndefined();
  });

  it('removes only the first occurrence', () => {
    const robot = { options: ['extra_memory', 'extra_memory'] };
    removeOption(robot, 'extra_memory');
    expect(robot.options).toEqual(['extra_memory']);
  });
});

describe('getOptionInfo', () => {
  it('returns card info for valid option ID', () => {
    const info = getOptionInfo('extra_memory');
    expect(info).toEqual({
      id: 'extra_memory',
      name: 'Extra Memory',
      description: 'Draw 1 extra card during programming phase.',
    });
  });

  it('returns null for unknown option ID', () => {
    expect(getOptionInfo('nonexistent')).toBeNull();
  });

  it('returns info for all defined option cards', () => {
    for (const card of OPTION_CARDS) {
      expect(getOptionInfo(card.id)).toEqual(card);
    }
  });
});
