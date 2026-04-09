import { describe, it, expect, vi } from 'vitest';
import { getMatchStatus, syncMatchStatus } from '../../utils/matchStatus.js';
import { MATCH_STATUS } from '../../validation/matches.js';

// Fixed reference times
const START = '2025-06-01T10:00:00.000Z';
const END = '2025-06-01T12:00:00.000Z';

// Helpers to build a `now` that is before/during/after the match
const before = new Date('2025-06-01T09:59:59.999Z'); // 1 ms before start
const atStart = new Date(START);                       // exactly at start
const during = new Date('2025-06-01T11:00:00.000Z');  // midway
const atEnd = new Date(END);                           // exactly at end
const after = new Date('2025-06-01T12:00:00.001Z');   // 1 ms after end

// ─── getMatchStatus ───────────────────────────────────────────────────────────

describe('getMatchStatus', () => {
  it('returns SCHEDULED when now is before startTime', () => {
    expect(getMatchStatus(START, END, before)).toBe(MATCH_STATUS.SCHEDULED);
  });

  it('returns LIVE when now equals startTime (boundary)', () => {
    expect(getMatchStatus(START, END, atStart)).toBe(MATCH_STATUS.LIVE);
  });

  it('returns LIVE when now is between startTime and endTime', () => {
    expect(getMatchStatus(START, END, during)).toBe(MATCH_STATUS.LIVE);
  });

  it('returns FINISHED when now equals endTime (boundary)', () => {
    expect(getMatchStatus(START, END, atEnd)).toBe(MATCH_STATUS.FINISHED);
  });

  it('returns FINISHED when now is after endTime', () => {
    expect(getMatchStatus(START, END, after)).toBe(MATCH_STATUS.FINISHED);
  });

  it('returns null for an invalid startTime', () => {
    expect(getMatchStatus('not-a-date', END, during)).toBeNull();
  });

  it('returns null for an invalid endTime', () => {
    expect(getMatchStatus(START, 'not-a-date', during)).toBeNull();
  });

  it('returns null when both times are invalid', () => {
    expect(getMatchStatus('bad', 'bad', during)).toBeNull();
  });

  it('uses current time when `now` is not supplied', () => {
    // Supply a past match (started and ended well before now)
    const pastStart = '2000-01-01T00:00:00.000Z';
    const pastEnd = '2000-01-01T01:00:00.000Z';
    expect(getMatchStatus(pastStart, pastEnd)).toBe(MATCH_STATUS.FINISHED);
  });

  it('handles a match that starts and ends at the same millisecond as the boundary', () => {
    // now is 1 ms before start → SCHEDULED
    const justBefore = new Date(new Date(START).getTime() - 1);
    expect(getMatchStatus(START, END, justBefore)).toBe(MATCH_STATUS.SCHEDULED);
  });
});

// ─── syncMatchStatus ─────────────────────────────────────────────────────────

describe('syncMatchStatus', () => {
  it('calls updateStatus and mutates match.status when status has changed', async () => {
    const match = { startTime: START, endTime: END, status: MATCH_STATUS.SCHEDULED };
    const updateStatus = vi.fn().mockResolvedValue(undefined);

    // Patch getMatchStatus indirectly by providing a `now` that makes the match LIVE.
    // syncMatchStatus uses getMatchStatus internally with the real clock, so we
    // construct a match whose status will differ at call time.
    // We use a match currently in progress (started long ago, ends far in future).
    const liveMatch = {
      startTime: '2000-01-01T00:00:00.000Z',
      endTime: '2099-12-31T23:59:59.000Z',
      status: MATCH_STATUS.SCHEDULED,
    };
    const result = await syncMatchStatus(liveMatch, updateStatus);

    expect(updateStatus).toHaveBeenCalledOnce();
    expect(updateStatus).toHaveBeenCalledWith(MATCH_STATUS.LIVE);
    expect(liveMatch.status).toBe(MATCH_STATUS.LIVE);
    expect(result).toBe(MATCH_STATUS.LIVE);
  });

  it('does NOT call updateStatus when status is already correct', async () => {
    const finishedMatch = {
      startTime: '2000-01-01T00:00:00.000Z',
      endTime: '2000-01-01T01:00:00.000Z',
      status: MATCH_STATUS.FINISHED,
    };
    const updateStatus = vi.fn().mockResolvedValue(undefined);

    const result = await syncMatchStatus(finishedMatch, updateStatus);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(MATCH_STATUS.FINISHED);
  });

  it('returns the original status when dates are invalid (getMatchStatus returns null)', async () => {
    const match = { startTime: 'bad-date', endTime: 'bad-date', status: MATCH_STATUS.SCHEDULED };
    const updateStatus = vi.fn().mockResolvedValue(undefined);

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(MATCH_STATUS.SCHEDULED);
  });

  it('propagates errors thrown by updateStatus', async () => {
    const liveMatch = {
      startTime: '2000-01-01T00:00:00.000Z',
      endTime: '2099-12-31T23:59:59.000Z',
      status: MATCH_STATUS.SCHEDULED,
    };
    const updateStatus = vi.fn().mockRejectedValue(new Error('DB failure'));

    await expect(syncMatchStatus(liveMatch, updateStatus)).rejects.toThrow('DB failure');
  });

  it('updates status from LIVE to FINISHED when match ends', async () => {
    const pastMatch = {
      startTime: '2000-01-01T00:00:00.000Z',
      endTime: '2000-01-01T01:00:00.000Z',
      status: MATCH_STATUS.LIVE,
    };
    const updateStatus = vi.fn().mockResolvedValue(undefined);

    const result = await syncMatchStatus(pastMatch, updateStatus);

    expect(updateStatus).toHaveBeenCalledWith(MATCH_STATUS.FINISHED);
    expect(result).toBe(MATCH_STATUS.FINISHED);
  });
});