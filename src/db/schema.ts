import { pgTable, serial, text, timestamp, integer, varchar, pgEnum, jsonb, index } from 'drizzle-orm/pg-core';

// Enums
export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'finished']);

// Matches table
export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  sport: varchar('sport', { length: 50 }).notNull(),
  homeTeam: varchar('home_team', { length: 100 }).notNull(),
  awayTeam: varchar('away_team', { length: 100 }).notNull(),
  status: matchStatusEnum('status').notNull().default('scheduled'),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('matches_status_idx').on(table.status),
  startTimeIdx: index('matches_start_time_idx').on(table.startTime),
  sportIdx: index('matches_sport_idx').on(table.sport),
}));

// Commentary table
export const commentary = pgTable('commentary', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  minute: integer('minute').notNull(),
  sequence: integer('sequence').notNull(),
  period: varchar('period', { length: 20 }).notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  actor: varchar('actor', { length: 100 }),
  team: varchar('team', { length: 100 }),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  tags: varchar('tags', { length: 255 }).array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  matchIdIdx: index('commentary_match_id_idx').on(table.matchId),
  matchSequenceIdx: index('commentary_match_sequence_idx').on(table.matchId, table.sequence),
  minuteIdx: index('commentary_minute_idx').on(table.minute),
  eventTypeIdx: index('commentary_event_type_idx').on(table.eventType),
}));

// Export types for type-safe queries
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Commentary = typeof commentary.$inferSelect;
export type NewCommentary = typeof commentary.$inferInsert;
export type MatchStatus = typeof matchStatusEnum.enumValues[number];
