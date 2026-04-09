import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import inject from 'light-my-request';

// ── Mocks must be declared before the module under test is imported ──────────

// Mock the database module so no real DB connection is attempted
vi.mock('../../db/db.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Mock the schema module – drizzle table objects are only used as arguments to
// db.select().from() / db.insert(); we don't need their real implementation.
vi.mock('../../db/schema.js', () => ({
  matches: { createdAt: 'createdAt' }, // minimal stub
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { db } from '../../db/db.js';
import matchesRouter from '../../routes/matches.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/matches', matchesRouter);
  return app;
}

const START_TIME = '2025-06-01T10:00:00.000Z';
const END_TIME = '2025-06-01T12:00:00.000Z';

const mockMatchRow = {
  id: 1,
  sport: 'football',
  homeTeam: 'Team A',
  awayTeam: 'Team B',
  startTime: new Date(START_TIME),
  endTime: new Date(END_TIME),
  homeScore: 0,
  awayScore: 0,
  status: 'scheduled',
  createdAt: new Date(),
};

// Builds a fluent Drizzle-like SELECT chain that resolves to `rows`
function mockSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  chain.limit.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  return chain;
}

// Builds a fluent Drizzle-like INSERT chain that resolves to `rows`
function mockInsertChain(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const values = vi.fn().mockReturnValue({ returning });
  return { values };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /matches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with match data using default limit', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain([mockMatchRow]));

    const res = await inject(buildApp(), { method: 'GET', url: '/matches' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('List matches');
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(1);
  });

  it('passes an explicit limit from the query string', async () => {
    const chain = mockSelectChain([mockMatchRow]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await inject(buildApp(), { method: 'GET', url: '/matches?limit=5' });

    expect(res.statusCode).toBe(200);
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('rejects limit > 100 (schema max)', async () => {
    const res = await inject(buildApp(), { method: 'GET', url: '/matches?limit=999' });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid query parameters');
  });

  it('returns 400 for a non-numeric limit', async () => {
    const res = await inject(buildApp(), { method: 'GET', url: '/matches?limit=abc' });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid query parameters');
  });

  it('returns 400 for limit=0', async () => {
    const res = await inject(buildApp(), { method: 'GET', url: '/matches?limit=0' });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid query parameters');
  });

  it('returns 400 for a negative limit', async () => {
    const res = await inject(buildApp(), { method: 'GET', url: '/matches?limit=-5' });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid query parameters');
  });

  it('returns 200 with empty array when no matches exist', async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(mockSelectChain([]));

    const res = await inject(buildApp(), { method: 'GET', url: '/matches' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual([]);
  });

  it('returns 500 when the database throws', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockRejectedValue(new Error('DB down')),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await inject(buildApp(), { method: 'GET', url: '/matches' });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Failed to list matches');
  });

  it('uses default limit of 10 when none is provided', async () => {
    const chain = mockSelectChain([]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    await inject(buildApp(), { method: 'GET', url: '/matches' });

    expect(chain.limit).toHaveBeenCalledWith(10);
  });
});

describe('POST /matches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    sport: 'football',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    startTime: START_TIME,
    endTime: END_TIME,
  };

  it('returns 200 and the created match on a valid request', async () => {
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(mockInsertChain([mockMatchRow]));

    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: validBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Match created successfully');
    expect(body.data.id).toBe(1);
  });

  it('defaults homeScore and awayScore to 0 when omitted', async () => {
    let capturedValues: Record<string, unknown> = {};
    const returning = vi.fn().mockResolvedValue([mockMatchRow]);
    const values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues = v as Record<string, unknown>;
      return { returning };
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values });

    await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: validBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(capturedValues.homeScore).toBe(0);
    expect(capturedValues.awayScore).toBe(0);
  });

  it('passes provided scores to the DB insert', async () => {
    let capturedValues: Record<string, unknown> = {};
    const returning = vi.fn().mockResolvedValue([{ ...mockMatchRow, homeScore: 2, awayScore: 1 }]);
    const values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues = v as Record<string, unknown>;
      return { returning };
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values });

    await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: { ...validBody, homeScore: 2, awayScore: 1 },
      headers: { 'content-type': 'application/json' },
    });

    expect(capturedValues.homeScore).toBe(2);
    expect(capturedValues.awayScore).toBe(1);
  });

  it('returns 400 when sport is missing', async () => {
    const { sport: _, ...rest } = validBody;
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: rest,
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when homeTeam is missing', async () => {
    const { homeTeam: _, ...rest } = validBody;
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: rest,
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when awayTeam is missing', async () => {
    const { awayTeam: _, ...rest } = validBody;
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: rest,
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when startTime is not a valid ISO string', async () => {
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: { ...validBody, startTime: '2025-06-01' },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when endTime is before startTime', async () => {
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: { ...validBody, startTime: END_TIME, endTime: START_TIME },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when endTime equals startTime', async () => {
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: { ...validBody, endTime: START_TIME },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when homeScore is negative', async () => {
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: { ...validBody, homeScore: -1 },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 for an empty request body', async () => {
    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: {},
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 500 when the database insert throws', async () => {
    const returning = vi.fn().mockRejectedValue(new Error('insert failed'));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning }),
    });

    const res = await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: validBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Internal server error');
  });

  it('infers status as "finished" for a past match', async () => {
    let capturedValues: Record<string, unknown> = {};
    const returning = vi.fn().mockResolvedValue([mockMatchRow]);
    const values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues = v as Record<string, unknown>;
      return { returning };
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values });

    const pastStart = '2000-01-01T00:00:00.000Z';
    const pastEnd = '2000-01-01T01:00:00.000Z';

    await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: { ...validBody, startTime: pastStart, endTime: pastEnd },
      headers: { 'content-type': 'application/json' },
    });

    expect(capturedValues.status).toBe('finished');
  });

  it('infers status as "scheduled" for a future match', async () => {
    let capturedValues: Record<string, unknown> = {};
    const returning = vi.fn().mockResolvedValue([mockMatchRow]);
    const values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues = v as Record<string, unknown>;
      return { returning };
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values });

    const futureStart = '2099-01-01T10:00:00.000Z';
    const futureEnd = '2099-01-01T12:00:00.000Z';

    await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: { ...validBody, startTime: futureStart, endTime: futureEnd },
      headers: { 'content-type': 'application/json' },
    });

    expect(capturedValues.status).toBe('scheduled');
  });

  it('converts startTime and endTime strings to Date objects before inserting', async () => {
    let capturedValues: Record<string, unknown> = {};
    const returning = vi.fn().mockResolvedValue([mockMatchRow]);
    const values = vi.fn().mockImplementation((v: unknown) => {
      capturedValues = v as Record<string, unknown>;
      return { returning };
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values });

    await inject(buildApp(), {
      method: 'POST',
      url: '/matches',
      payload: validBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(capturedValues.startTime).toBeInstanceOf(Date);
    expect(capturedValues.endTime).toBeInstanceOf(Date);
  });
});