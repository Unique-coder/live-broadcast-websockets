import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { matches } from "../db/schema.js";
import { db } from "../db/db.js";
import { getMatchStatus } from "../utils/matchStatus.js";

const router = Router();
const MAX_LIMIT = 100;

router.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", details: JSON.stringify(parsed.error) });
  }

  const limit = Math.min(parsed.data.limit || 10, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(matches)
      .limit(limit)
      .orderBy(matches.createdAt);

    res.json({ message: "List matches", data });
  } catch (error) {
    console.error("Error listing matches:", error);
    res.status(500).json({
      error: "Failed to list matches",
    });
  }
});

router.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: JSON.stringify(parsed.error) });
  }

  const { startTime, endTime, homeScore, awayScore, sport, homeTeam, awayTeam } = parsed.data;

  try {
    const status = getMatchStatus(startTime, endTime) || 'scheduled';
    const [event] = await db.insert(matches).values({
     sport,
     homeTeam,
     awayTeam,
     startTime: new Date(startTime),
     endTime: new Date(endTime),
     homeScore: homeScore ?? 0,
     awayScore: awayScore ?? 0,
     status,
   }).returning();

   res.json({ message: "Match created successfully", data: event });
  } catch (error) {
    console.error("Error creating match:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;
