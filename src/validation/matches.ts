import { z } from 'zod';

// Match status constants
export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
} as const;

// Query schema for listing matches with optional limit
export const listMatchesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .optional(),
});

// Schema for match ID parameter
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Helper function to validate ISO date string
const isValidISODateString = (dateString: string) => {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString() === dateString;
};

// Schema for creating a match
export const createMatchSchema = z.object({
  sport: z.string().min(1, 'Sport is required'),
  homeTeam: z.string().min(1, 'Home team is required'),
  awayTeam: z.string().min(1, 'Away team is required'),
  startTime: z.string().refine(
    (date) => isValidISODateString(date),
    { message: 'Start time must be a valid ISO date string' }
  ),
  endTime: z.string().refine(
    (date) => isValidISODateString(date),
    { message: 'End time must be a valid ISO date string' }
  ),
  homeScore: z.coerce.number().int().nonnegative().optional(),
  awayScore: z.coerce.number().int().nonnegative().optional(),
}).superRefine((data, ctx) => {
  // Ensure endTime is after startTime
  const startDate = new Date(data.startTime);
  const endDate = new Date(data.endTime);

  if (endDate <= startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'End time must be after start time',
    });
  }
});

// Schema for updating scores
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});

// Export types
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
export type MatchIdParam = z.infer<typeof matchIdParamSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;
