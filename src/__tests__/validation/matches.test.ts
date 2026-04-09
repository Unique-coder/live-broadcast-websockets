import { describe, it, expect } from 'vitest';
import {
  MATCH_STATUS,
  listMatchesQuerySchema,
  matchIdParamSchema,
  createMatchSchema,
  updateScoreSchema,
} from '../../validation/matches.js';

// Fixed reference times for deterministic tests
const START_TIME = '2025-06-01T10:00:00.000Z';
const END_TIME = '2025-06-01T12:00:00.000Z';

// ─── MATCH_STATUS ────────────────────────────────────────────────────────────

describe('MATCH_STATUS', () => {
  it('exports the three expected string constants', () => {
    expect(MATCH_STATUS.SCHEDULED).toBe('scheduled');
    expect(MATCH_STATUS.LIVE).toBe('live');
    expect(MATCH_STATUS.FINISHED).toBe('finished');
  });
});

// ─── listMatchesQuerySchema ───────────────────────────────────────────────────

describe('listMatchesQuerySchema', () => {
  it('accepts an empty object (limit is optional)', () => {
    const result = listMatchesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBeUndefined();
  });

  it('coerces a numeric string to a number', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: '25' });
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(25);
  });

  it('accepts a numeric value directly', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 50 });
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(50);
  });

  it('accepts the boundary value of 100', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(true);
    expect(result.data?.limit).toBe(100);
  });

  it('rejects limit > 100', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects limit of 0 (must be positive)', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative limit', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer limit', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 10.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 'abc' });
    expect(result.success).toBe(false);
  });
});

// ─── matchIdParamSchema ───────────────────────────────────────────────────────

describe('matchIdParamSchema', () => {
  it('coerces a numeric string to a number', () => {
    const result = matchIdParamSchema.safeParse({ id: '42' });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(42);
  });

  it('accepts a numeric value directly', () => {
    const result = matchIdParamSchema.safeParse({ id: 1 });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(1);
  });

  it('rejects id of 0 (must be positive)', () => {
    const result = matchIdParamSchema.safeParse({ id: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative id', () => {
    const result = matchIdParamSchema.safeParse({ id: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer id', () => {
    const result = matchIdParamSchema.safeParse({ id: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    const result = matchIdParamSchema.safeParse({ id: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = matchIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── createMatchSchema ────────────────────────────────────────────────────────

describe('createMatchSchema', () => {
  const validPayload = {
    sport: 'football',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    startTime: START_TIME,
    endTime: END_TIME,
  };

  it('accepts a valid payload with required fields only', () => {
    const result = createMatchSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts a valid payload with optional score fields', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: 2,
      awayScore: 1,
    });
    expect(result.success).toBe(true);
    expect(result.data?.homeScore).toBe(2);
    expect(result.data?.awayScore).toBe(1);
  });

  it('coerces numeric strings in score fields', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: '3',
      awayScore: '0',
    });
    expect(result.success).toBe(true);
    expect(result.data?.homeScore).toBe(3);
    expect(result.data?.awayScore).toBe(0);
  });

  it('scores default to undefined when omitted', () => {
    const result = createMatchSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    expect(result.data?.homeScore).toBeUndefined();
    expect(result.data?.awayScore).toBeUndefined();
  });

  // sport validation
  it('rejects empty sport string', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, sport: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing sport', () => {
    const { sport: _, ...rest } = validPayload;
    const result = createMatchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // homeTeam / awayTeam validation
  it('rejects empty homeTeam string', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, homeTeam: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty awayTeam string', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, awayTeam: '' });
    expect(result.success).toBe(false);
  });

  // ISO date validation
  it('rejects a non-ISO startTime', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, startTime: '2025-06-01' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-ISO endTime', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, endTime: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects a locale-formatted date string as startTime', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, startTime: 'June 1, 2025 10:00:00' });
    expect(result.success).toBe(false);
  });

  it('rejects missing startTime', () => {
    const { startTime: _, ...rest } = validPayload;
    const result = createMatchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // endTime after startTime (superRefine)
  it('rejects endTime equal to startTime', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      endTime: START_TIME,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const endTimeError = result.error.issues.find(i => i.path.includes('endTime'));
      expect(endTimeError?.message).toBe('End time must be after start time');
    }
  });

  it('rejects endTime before startTime', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: END_TIME,
      endTime: START_TIME,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const endTimeError = result.error.issues.find(i => i.path.includes('endTime'));
      expect(endTimeError?.message).toBe('End time must be after start time');
    }
  });

  it('accepts endTime one millisecond after startTime', () => {
    const start = new Date(START_TIME);
    const endPlusOne = new Date(start.getTime() + 1).toISOString();
    const result = createMatchSchema.safeParse({
      ...validPayload,
      endTime: endPlusOne,
    });
    expect(result.success).toBe(true);
  });

  // score constraints
  it('rejects negative homeScore', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, homeScore: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects negative awayScore', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, awayScore: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts zero scores (boundary)', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, homeScore: 0, awayScore: 0 });
    expect(result.success).toBe(true);
  });
});

// ─── updateScoreSchema ────────────────────────────────────────────────────────

describe('updateScoreSchema', () => {
  it('accepts valid nonnegative integers', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 2, awayScore: 3 });
    expect(result.success).toBe(true);
    expect(result.data?.homeScore).toBe(2);
    expect(result.data?.awayScore).toBe(3);
  });

  it('accepts zero scores', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 0, awayScore: 0 });
    expect(result.success).toBe(true);
  });

  it('coerces numeric strings', () => {
    const result = updateScoreSchema.safeParse({ homeScore: '5', awayScore: '2' });
    expect(result.success).toBe(true);
    expect(result.data?.homeScore).toBe(5);
    expect(result.data?.awayScore).toBe(2);
  });

  it('rejects negative homeScore', () => {
    const result = updateScoreSchema.safeParse({ homeScore: -1, awayScore: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative awayScore', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 0, awayScore: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer homeScore', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 1.5, awayScore: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects missing homeScore', () => {
    const result = updateScoreSchema.safeParse({ awayScore: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects missing awayScore', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 0 });
    expect(result.success).toBe(false);
  });
});